# Deploy em produção (Railway)

O projeto sobe como **dois serviços Railway separados**, cada um a partir do seu
próprio `Dockerfile` — não existe backend/frontend num único container.

    backend/   → Dockerfile  (Node 20, API HTTP pura, porta via $PORT)
    frontend/  → Dockerfile  (build Vite + nginx, porta via $PORT)

## 1. Banco de dados (Postgres)

1. No projeto Railway: New → Database → **Add PostgreSQL**. O Railway cria o
   serviço e já expõe as variáveis `DATABASE_URL`, `PGUSER`, etc. nele.
2. Não copie o valor de `DATABASE_URL` manualmente para o backend. No serviço
   **backend**, em Variables, clique em **Add Reference** e aponte para
   `DATABASE_URL` do serviço Postgres (equivale a escrever
   `${{Postgres.DATABASE_URL}}`). O Railway resolve isso automaticamente e os
   dois serviços conversam pela rede privada, sem expor o banco na internet.

## 2. Backend

1. New Service → Deploy from GitHub repo → **Root Directory: `backend`**. O Railway
   detecta o `backend/Dockerfile` e o `backend/railway.json` automaticamente.
2. Variáveis de ambiente (Settings → Variables):

   | Nome | Valor | Obrigatório |
   | --- | --- | --- |
   | `DATABASE_URL` | referência ao Postgres (ver passo 1) — **não** copiar o valor manualmente | **sim** |
   | `JWT_SECRET` | string aleatória forte (ex.: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) | **sim** — o servidor não inicia sem ele em produção |
   | `FRONTEND_URL` | URL pública do serviço frontend (ex.: `https://urna-frontend.up.railway.app`) | sim, senão o CORS bloqueia o navegador |
   | `DATA_PATH` | `/app/data` | sim, ver volume abaixo |
   | `NODE_ENV` | `production` | já vem assim do Dockerfile; não precisa repetir |
   | `RESEND_API_KEY` | chave de API do [Resend](https://resend.com) (painel → API Keys) | **sim** — confirmação de e-mail (Etapa 8.1); o servidor não inicia sem ela |
   | `EMAIL_FROM_ADDRESS` | e-mail remetente, de um domínio verificado no Resend (painel → Domains) | **sim** |
   | `EMAIL_FROM_NAME` | nome de exibição do remetente (ex.: `UrnaLab`) | **sim** |

   `PORT` e `HOST` **não devem ser definidos manualmente** — o Railway injeta `PORT`
   e o backend já escuta em `0.0.0.0` automaticamente quando `NODE_ENV=production`.

3. **Volume persistente** para as fotos de candidatos: Settings → Volumes → Add
   Volume, monte em `/app/data`. Sessões, votos e todo o resto já ficam no
   Postgres (persistente por natureza) — só as fotos são arquivo em disco. Sem
   o volume, as fotos somem a cada deploy porque o filesystem do container é
   efêmero.
4. **Migrações**: o `Dockerfile` já roda `prisma migrate deploy` automaticamente
   antes de iniciar o servidor, a cada deploy (ver `CMD` no final do arquivo) —
   não é preciso rodar nada manualmente no Railway.
5. Health check já configurado em `backend/railway.json` (`/api/health`).

## 3. Frontend

1. New Service → Deploy from GitHub repo → **Root Directory: `frontend`**.
2. Em **Variables** (a aba normal — o Railway não tem uma seção separada de "build
   arguments"; ele passa qualquer variável do serviço para o build automaticamente,
   desde que o `Dockerfile` a declare com `ARG`, que é o que `frontend/Dockerfile`
   já faz):

   | Nome | Valor |
   | --- | --- |
   | `VITE_API_URL` | URL pública do serviço backend (ex.: `https://urna-backend.up.railway.app`) |

   Mesmo estando na aba "Variables", `VITE_API_URL` só é usada em **build time**
   (embutida no bundle) — mudar o valor depois exige um **redeploy** (rebuild),
   simples reiniciar o serviço não pega o novo valor.
3. Nenhuma outra variável é necessária em runtime — é um nginx servindo
   arquivos estáticos. `PORT` é injetado pelo Railway e o nginx escuta nele
   automaticamente (`nginx.conf.template` + `envsubst`).

## 4. Ordem de deploy

Suba **Postgres → backend → frontend**, nessa ordem: o backend precisa da
referência ao banco antes de poder migrar, e o frontend precisa da URL pública
do backend já no ar para o build. Se trocar a URL do backend depois, é preciso
**rebuildar o frontend** (não só reiniciar) — `VITE_API_URL` está embutida no
bundle.

## 5. Testando localmente antes de subir

Dia a dia (banco em Docker, app no host, com watch/hot-reload):

    docker compose up postgres -d
    npm run dev:backend     # ver backend/.env (DATABASE_URL=postgresql://urna:urna@localhost:5433/urna)
    npm run dev:frontend

Simulando o deploy completo (mesmas imagens do Railway):

    docker compose up --build
    # backend:  http://localhost:3000/api/health
    # frontend: http://localhost:8080

Isso usa os mesmos `Dockerfile`s do Railway, então um build que funciona aqui tem
boa chance de funcionar lá. Ver `docker-compose.yml` para os valores de exemplo
(troque `JWT_SECRET` antes de usar fora de teste local).

## 6. Checklist de segurança antes de ir ao ar

- [ ] `JWT_SECRET` é um valor aleatório gerado para produção, não o padrão de dev.
- [ ] `DATABASE_URL` é uma **referência** ao serviço Postgres do Railway, nunca um
      valor copiado à mão (evita senha real espalhada em `.env`/histórico).
- [ ] `FRONTEND_URL` aponta exatamente para a URL pública do frontend (sem isso,
      toda chamada do navegador é bloqueada por CORS).
- [ ] Volume montado em `/app/data` no backend, para as fotos de candidatos
      (confirme com um redeploy de teste: as fotos devem continuar lá depois).
- [ ] HTTPS: o Railway já serve cada serviço com TLS por padrão no domínio
      `*.up.railway.app` — se usar domínio próprio, configure o certificado nas
      configurações de domínio do serviço.
- [ ] Domínio próprio atrás do Cloudflare (proxy "Proxied"/nuvem laranja): em
      Settings → Networking do serviço no Railway, confira se a porta pública
      configurada bate com a porta que o container realmente escuta (`$PORT`
      injetado pelo Railway, lido pelo `nginx.conf.template` no frontend). Uma
      porta errada aí (ex.: fixar `80` manualmente) faz o Railway não conseguir
      encaminhar a requisição pro container, e o Cloudflare devolve **502 Bad
      Gateway** mesmo com o DNS e o proxy corretos.
- [ ] `backend/.env` e `frontend/.env` **nunca** são commitados (já cobertos pelo
      `.gitignore`); só os `.env.example` entram no repositório.
- [ ] `EMAIL_FROM_ADDRESS` é de um domínio **verificado** no Resend (painel → Domains) — com
      um domínio não verificado, o envio do código de confirmação falha silenciosamente (o
      cadastro ainda funciona, mas o e-mail nunca chega; ver `console.error` nos logs do
      backend).
