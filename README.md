
<div align="center">
  <img src="frontend/public/img/urnalab-banner.png" alt="Texto alternativo" width="500">
</div>

<div align="center">
 <h1>Simulador de Urna Eletrônica (educacional)</h1>
</div>

## ⚠️ **Aviso**: Sobre o UrnaLab

O **UrnaLab** é uma iniciativa privada, independente e de caráter educacional, criada com o objetivo de promover **educação cívica, cidadania e compreensão dos processos eleitorais** por meio da tecnologia e da experiência prática.

O projeto não possui qualquer vínculo, representação ou parceria institucional com órgãos governamentais, entidades eleitorais, partidos políticos ou candidatos.

O UrnaLab utiliza uma experiência de votação **simulada e exclusivamente educativa**, permitindo que estudantes, educadores e cidadãos conheçam, de forma prática e acessível, conceitos relacionados a eleições, candidaturas, votação, apuração, resultados e auditoria de dados.

Para preservar seu caráter **educacional, independente e apartidário**, o projeto evita deliberadamente o uso de nomes, imagens, símbolos, campanhas, candidatos ou conteúdos de natureza partidária. Os exemplos utilizados são fictícios ou genéricos e têm como finalidade exclusivamente didática.

Mais do que simular uma votação, o UrnaLab busca criar um ambiente para **aprender, experimentar e compreender a importância da participação cidadã**, utilizando a tecnologia como ferramenta de educação e conscientização.

**UrnaLab — tecnologia para aprender, cidadania para participar.**

Projeto para estudar Node.js puro, HTTP, APIs REST, arquitetura em camadas, persistência e React.
**Não é uma urna eletrônica oficial** e não reproduz sistemas ou interfaces oficiais de votação.

Lista de funcionalidades e histórico de versões: [CHANGELOG.md](CHANGELOG.md). O que está sendo
trabalhado agora e o banco de ideias futuras ficam em [ROADMAP.md](ROADMAP.md).

## Arquitetura

    HTTP → Routes → Controllers → Services → Repositories → Prisma → PostgreSQL

Só os repositories (`src/repositories/*.js`) e `database/index.js` conhecem o Prisma — trocar de
banco (ou de ORM) significa reescrever essa camada, sem tocar em controllers, services, routes ou
frontend. Fotos de candidatos são a única coisa que continua em arquivo (`storage/photo-storage.js`).

## Como executar

    npm run install:all
    docker compose up postgres -d   # só o Postgres, em container (ver backend/.env.example)
    npm run dev:backend             # http://localhost:3000  (teste: /api/health)
    npm run dev:frontend            # http://localhost:5173

Variáveis do backend: `PORT`, `HOST`, `DATABASE_URL`, `DATA_PATH`, `FRONTEND_URL`, `JWT_SECRET`,
`NODE_ENV` (ver `backend/.env.example`). Frontend: `VITE_API_URL` (ver `frontend/.env.example`).

## Deploy em produção

Guia completo (Docker + Railway, variáveis de ambiente, volume persistente,
checklist de segurança) em [docs/DEPLOY.md](docs/DEPLOY.md). Resumo: cada pasta (`backend/`,
`frontend/`) tem seu próprio `Dockerfile` e `railway.json`; teste localmente com
`docker compose up --build` antes de subir.

Por padrão os dois servidores só aceitam conexão da própria máquina. Para acessar de outro
aparelho na mesma rede (ex.: votar pelo celular pelo link público), descubra o IP local da máquina
(`ipconfig`, procure "Endereço IPv4") e rode:

    # backend (PowerShell)
    $env:HOST="0.0.0.0"; $env:FRONTEND_URL="http://localhost:5173,http://SEU_IP:5173"; npm run dev:backend

    # frontend — defina VITE_API_URL=http://SEU_IP:3000 no frontend/.env e rode normalmente
    npm run dev:frontend

O Vite já escuta em todas as interfaces por padrão (`server.host: true`); o terminal mostra o
endereço de rede ao subir. Pode ser necessário liberar as portas 3000 e 5173 no firewall do
Windows. Isso só abre acesso dentro da mesma rede (Wi-Fi/LAN) — para acesso pela internet, use um
túnel (ex.: `ngrok http 5173`) ou um deploy de verdade; nenhuma das duas formas está configurada
aqui, já que o projeto não usa HTTPS nem outros cuidados de produção.

## Banco de dados

PostgreSQL via Prisma (`backend/prisma/schema.prisma`). Migrações ficam em
`backend/prisma/migrations/` e são aplicadas com `npm run prisma:deploy`
(automático a cada start em produção, ver `backend/Dockerfile`) ou
`npm run prisma:migrate` ao criar uma nova migração em desenvolvimento.
`npm run prisma:studio` abre uma UI pra inspecionar os dados.

## Contas e multiusuário

Toda rota exige login, exceto `/api/health` e as rotas de `/api/auth` abaixo que não pedem
`{ public: true }`. O token (JWT, HS256 implementado à mão em `utils/jwt.js` — sem biblioteca) vai
no header `Authorization: Bearer <token>`; o frontend guarda esse token no `localStorage` e
desloga sozinho se qualquer requisição voltar `401`. Senhas usam `scrypt` nativo do Node
(`utils/password.js`).

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | /api/auth/register | Cria a conta (nome, e-mail, senha) e envia o código de confirmação — **não** devolve token |
| POST | /api/auth/verify-email | Confirma o código de 6 dígitos; só então devolve o token |
| POST | /api/auth/resend-verification | Reenvia o código (cooldown de 60s) |
| POST | /api/auth/login | Autentica e devolve o token — recusa (`EMAIL_NOT_VERIFIED`, 403) enquanto o e-mail não for confirmado |
| POST | /api/auth/forgot-password | Envia link de redefinição por e-mail — resposta sempre igual, exista ou não o e-mail |
| POST | /api/auth/reset-password | Define nova senha a partir do link (token de uso único, 30 min) — não devolve token |
| GET | /api/auth/me | Dados da conta logada |
| POST | /api/auth/change-password | Troca a senha (exige a senha atual) |

### Confirmação de e-mail (Etapa 8.1)

Cadastro não loga a conta direto: um código de 6 dígitos é enviado por e-mail (via
[Resend](https://resend.com), `services/email.service.js`) e precisa ser confirmado em
`POST /api/auth/verify-email` antes de qualquer login funcionar. O código expira em 15 minutos e
tem limite de 5 tentativas (`VERIFICATION_CODE_LOCKED` depois disso — peça um novo com
`resend-verification`). Falha no envio do e-mail (Resend fora do ar, chave inválida) não derruba
o cadastro — a conta já foi criada e o usuário pode pedir reenvio depois; o erro só é logado no
servidor (`[email] falha ao enviar código de verificação`). Contas criadas antes desta
funcionalidade existir foram retroagidas como confirmadas na própria migração, para não trancar
quem já tinha conta.

### Reset de senha (Etapa 8.2)

"Esqueci minha senha" no login manda um link de redefinição por e-mail (mesmo
`email.service.js` da 8.1), com token opaco de uso único válido por 30 minutos — mesmo padrão do
link público de votação, só que com token opaco e longo (`generatePublicToken`, `utils/id.js`), de
uso único e enviado por e-mail. `POST /api/auth/forgot-password` **sempre** responde `{ sent: true }`, exista ou não o
e-mail e mesmo que o reenvio esteja em cooldown (60s) — a resposta nunca revela se uma conta
existe. Depois de `POST /api/auth/reset-password`, o usuário não é logado automaticamente —
precisa entrar de novo com a senha nova. Limitação conhecida (ver `ROADMAP.md`): como a autenticação é
stateless (JWT sem lista de revogação), um token emitido antes do reset continua válido até
expirar.

### Perfil da instituição e tela de perfil do usuário (Etapas 8.3 e 8.4)

Cada conta tem um `InstitutionProfile` próprio (nome, endereço, telefone, site opcional —
`GET`/`PUT /api/institution-profile`). O telefone exige DDD (10 ou 11 dígitos, validado e
formatado em `institution-profile.service.js`, com máscara no cliente); o site precisa de um
domínio com ponto (`https://algo.com`, não só `https://algo`). A tela `/perfil` (menu do usuário
no canto superior direito → "Configurações") reúne os dados da conta (somente leitura), o
formulário da instituição e a troca de senha (`POST /api/auth/change-password`, pede a senha
atual) — cada seção valida no cliente e no backend.

Diferente de um gate global, a obrigatoriedade é pontual: `POST /api/sessions` recusa criar uma
sessão (`403 INSTITUTION_PROFILE_REQUIRED`) enquanto a conta não tiver o perfil da instituição
cadastrado — o resto do sistema funciona normalmente sem ele. Perfil incompleto
(`user.institutionProfileComplete`, vindo de `/api/auth/me`/login/etc.) aparece como uma
notificação — um balão no menu do usuário, não mais um alerta fixo no Dashboard
(`frontend/src/lib/notifications.js`, pensado pra crescer com outras notificações no futuro).

## Link público de votação

Toda sessão tem um `publicToken` — um código de 4 dígitos (`generateSessionCode`, `utils/id.js`),
fácil de digitar ou ditar em voz alta, sem relação com o id — desde que criada; sessões mais
antigas ganham o token na primeira vez que forem abertas (`GET /api/sessions` ou `/:id`). Como só
há 10 mil combinações, a geração tenta de novo em caso de colisão (`withUniqueSessionCode`,
`session.service.js`) até achar um código livre. Enquanto a sessão está `OPEN`, o link
`/votar/:token` do frontend vota nela sem precisar de conta; funciona bem pelo celular, e a tela da
sessão destaca o código em si para digitação manual. Ele para de aceitar voto sozinho fora do
estado `OPEN` — o token em si é a autorização, não há usuário por trás. É a **única** tela de
votação do projeto (`PublicVoting.jsx`) — uma versão autenticada antiga (`/votacao`) foi removida;
votar, mesmo testando como administrador, é sempre por este link.

A tela (Etapa 17) simula o corpo físico de uma urna de verdade: visor, teclado numérico e botão
"Confirma" reunidos num componente só (`components/voting/Urna.jsx`, fundo escuro, tela clara) —
a foto do candidato aparece direto nessa tela assim que o número fecha. Ao lado, uma lista
(`CandidateList.jsx`) mostra quem concorre ao cargo sendo votado agora (troca sozinha a cada
avanço de cargo); clicar num nome mostra a proposta de governo dele.

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | /api/public/sessions/:token | Nome, cargos e status da sessão (sem dados sensíveis) |
| GET | /api/public/sessions/:token/votes/lookup | Prévia do candidato pelo número, igual à votação autenticada |
| POST | /api/public/sessions/:token/votes | Registra o voto — só funciona com a sessão `OPEN` |

Cada conta é isolada das demais: cargos, partidos, pessoas, candidatos, sessões e votos carregam
um `userId`, filtrado em todo repository e service (isolamento lógico — mesmo banco Postgres,
nunca misturando contas). Uma conta nova já nasce com os 7 cargos padrão, prontos pra editar.
Tentar acessar um registro de outra conta responde `404` (nunca `403`, pra não revelar que existe).

## API de sessões (Etapa 2)

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | /api/positions | Cargos e regras (dígitos, ordem) |
| GET | /api/sessions | Lista sessões com totais (cargos, candidatos, votos) |
| GET | /api/sessions/:id | Detalhes de uma sessão |
| POST | /api/sessions | Cria sessão (status DRAFT) |
| PUT | /api/sessions/:id | Edita sessão (somente DRAFT) |
| POST | /api/sessions/:id/open | DRAFT → OPEN |
| POST | /api/sessions/:id/finish | OPEN → FINISHED |

Erros seguem `{ "success": false, "error": { "code", "message" } }`
(400 validação, 404 não encontrada, 409 transição/edição inválida).

## API de partidos e candidatos (Etapas 3 e 4)

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | /api/parties?search=&status= | Lista partidos (com total de candidatos) |
| GET/POST | /api/parties, /api/parties/:id | Consulta e criação |
| PUT | /api/parties/:id | Edita (nome, sigla, número, status) |
| DELETE | /api/parties/:id | **Desativa** (não apaga) |
| GET | /api/candidates?sessionId=&position=&partyId=&status=&search= | Lista candidatos com o partido |
| GET/POST | /api/candidates, /api/candidates/:id | Consulta e criação (somente sessão em DRAFT) |
| PUT | /api/candidates/:id | Edita; com a votação aberta, só nome, foto e status |
| DELETE | /api/candidates/:id | **Desativa** (não apaga) |

Regras principais: número do partido (1–99) e sigla são únicos; o número do candidato tem a
quantidade de dígitos do cargo e é único por sessão + cargo (inclusive entre inativos);
candidato inativo não recebe votos. A unicidade é garantida por constraint `UNIQUE` no Postgres
(nunca checada "na mão" antes de gravar) — o repository só traduz a violação (`P2002`) de volta
pro código de conflito esperado (`isUniqueViolation`/`conflictFieldFrom`, `database/index.js`),
então cadastros simultâneos não geram duplicados.

### Foto do candidato: link ou webcam

O campo `photo` de `POST/PUT /api/candidates` aceita três formatos: um link `http(s)://`
(como antes), um data URI (`data:image/jpeg;base64,...`) capturado agora pela webcam do
navegador, ou um caminho já salvo (`/photos/...`, quando a edição reenvia a foto sem trocá-la).
Um data URI é decodificado e gravado em `backend/data/photos/<uuid>.<ext>` por
`storage/photo-storage.js` — o que fica salvo no candidato é só o caminho, nunca o base64, para
não inflar as linhas do banco. O backend serve esses arquivos em `GET /photos/:arquivo`
(`middleware/photo-static.js`, sem depender de nenhum framework de arquivos estáticos; o nome do
arquivo é validado contra o formato exato gerado por `photoStorage.save`, então não há risco de
path traversal). Trocar ou remover a foto de um candidato apaga o arquivo antigo do disco depois
que a atualização é confirmada.

## API de votação (Etapa 5)

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | /api/votes/lookup?sessionId=&position=&number= | Prévia do candidato na tela de votação |
| POST | /api/votes | Registra um voto (válido, branco ou nulo) |

`POST /api/votes` espera `{ sessionId, position, type, number?, confirmed }`, com
`type` ∈ `VALID` \| `BLANK` \| `NULL`. A sessão precisa estar `OPEN`; `confirmed` precisa ser
`true`. Em voto `VALID`, `number` é obrigatório e precisa ser de um candidato ativo da sessão e
cargo (senão `CANDIDATE_NOT_FOUND`/`CANDIDATE_INACTIVE`). Em voto `NULL`, o número é opcional e
só é gravado para auditoria quando não corresponde a nenhum candidato. Nada sobre o eleitor é
armazenado, e votos não têm update nem delete.

A checagem "sessão está `OPEN`" e a gravação do voto rodam como uma única operação atômica
(`sessionRepository.withLock`, usada também por `sessionService.finish`), então uma finalização
concorrente nunca deixa passar um voto depois de completada.

`npm run seed [-- --voters=N] [-- --finish]` (ou `node scripts/seed.js --voters=N --finish`) recria
a conta demo no Postgres (`demo@urna.local` / `demo12345`, perfil de instituição já preenchido),
com 3 partidos, uma sessão com 9 candidatos fictícios, o produto de demonstração da Loja (ver
"Cobrança e produtos" abaixo) e, opcionalmente, simula N eleitores votando (válido/branco/nulo,
gerador de semente fixa) e finaliza a sessão — usando os services, como qualquer outro cliente da
API. Idempotente: pode rodar várias vezes seguidas (apaga a conta demo anterior, se houver, antes
de recriar — `onDelete: Cascade` em toda relação de `User` cuida do resto).

## API de resultados (Etapa 6)

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | /api/sessions/:id/results | Apuração por cargo da sessão |
| GET | /api/sessions/:id/results/pdf | PDF pronto pra impressão com o resultado da apuração |

Assim como numa eleição real, a apuração só é publicada depois que a votação é finalizada
(`RESULTS_NOT_AVAILABLE`, 409, em sessões `DRAFT`/`OPEN`). Por cargo, devolve o ranking de
candidatos (nome, partido, votos e percentual sobre os votos válidos — brancos e nulos não
entram nessa conta, seguindo a convenção eleitoral), os totais (válidos/brancos/nulos) e o(s)
vencedor(es) (mais de um id em caso de empate no primeiro lugar).

## API de auditoria (Etapa 7)

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | /api/sessions/:id/audit | Reconfere a cadeia de hashes dos votos da sessão |

Cada voto grava `hash` (sha256 do seu conteúdo + `previousHash`) e `previousHash` (o `hash` do
voto anterior da mesma sessão) — ver `utils/hash.js`. Como toda gravação de voto passa pelo mesmo
lock que `sessionService.finish` usa (`sessionRepository.withLock`), não há corrida possível entre
dois votos calculando o elo da cadeia ao mesmo tempo.

A auditoria (também só disponível com a sessão `FINISHED`, `AUDIT_NOT_AVAILABLE` caso contrário)
reconfere cada voto, na ordem em que foi gravado, contra dois critérios independentes:
`hashValid` (o hash bate com o conteúdo gravado) e `previousHashValid` (o `previousHash` aponta
para o `hash` do voto anterior). Isso detecta alteração de conteúdo, remoção e reordenação de
qualquer voto feita diretamente no banco depois da gravação. A resposta inclui `valid`
(booleano geral) e `brokenAtIndex` (posição do primeiro voto onde a cadeia quebra, ou `null`).

## Área de Gerenciamento (Etapas 9, 16 e 18)

Painel interno de métricas e suporte, visível só pra uma única conta — a configurada em
`ADMIN_EMAIL` (`backend/.env.example`). Não existe campo de role no banco de propósito: é
literalmente "a conta cujo e-mail bate com essa variável", nada mais. No frontend fica numa árvore
de rotas própria, `/gerenciamento*` (Etapa 16.1), separada da área comum do usuário e com as
páginas carregadas via `React.lazy` — o código delas nem chega a ser baixado por uma conta comum.
Além da rota, a área também tem **shell visual próprio** (`AdminLayout.jsx`, Etapa 18): cabeçalho
e navegação específicos, sem nenhum componente compartilhado com `AppLayout`/`Sidebar.jsx` da área
comum — o menu principal nunca lista nem menciona `/gerenciamento*`, pra conta nenhuma. Isso não
muda a autorização (que já era sólida), só elimina o acoplamento visual entre as duas áreas: uma
mudança futura num dos dois shells não tem como vazar pro outro. No backend, cada rota é marcada
com `adminOnly: true` (`utils/router.js`) e checada em `server.js` **antes** de qualquer handler
rodar, comparando o e-mail já carimbado no próprio JWT (claim `email`, `auth.service.js
issueToken`) contra `ADMIN_EMAIL` — sem nenhuma consulta ao banco pra autorizar. Todo acesso é
registrado (`AdminAccessLog`, accountability LGPD).

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | /api/admin/overview | Métricas agregadas (contas, instituições, sessões, votos) |
| GET | /api/admin/users | Lista contas cadastradas (e-mail mascarado, minimização de dados) |
| GET | /api/admin/analytics/funnel | Funil de uso anônimo (ver "Analytics e feedback" abaixo) |
| GET/PUT | /api/admin/feedback, /api/admin/feedback/:id | Lista feedback recebido e muda o status |
| GET/POST | /api/admin/products | Lista (inclusive inativos) e cria produto (ver "Cobrança e produtos") |
| PUT | /api/admin/products/:id | Edita nome, descrição, preço, ativo/inativo de um produto |
| GET | /api/admin/products/:id/sales | Quantidade e receita aprovada de um produto, sem dado de quem comprou |

## Analytics e feedback (Etapa 10)

Funil de uso **sempre anônimo**: cada evento (`AnalyticsEvent`) carrega só um `visitorId` (UUID
aleatório gerado no navegador, `frontend/src/lib/analytics.js`, guardado em `localStorage`), nunca
nome ou e-mail — mesmo em contas autenticadas. `POST /api/analytics/events` é pública, sem login.
Feedback (`Feedback`) é opcional e tem uma versão autenticada (`POST /api/feedback`, grava o
`userId`) e uma anônima, embutida na votação pública (`POST /api/public/feedback`, sempre sem
`userId` — mesmo que o navegador tenha feedback anterior).

## Cobrança e produtos (Etapas 11 a 16)

A exportação do resultado em PDF (`GET /api/sessions/:id/results/pdf`) é paga: uma cobrança
aprovada libera o download daquela sessão pra sempre. Pagamento via **Mercado Pago** (Checkout
Pro), chamado direto pela API REST deles (`backend/src/services/mercadopago.service.js`, com
`fetch` nativo — sem SDK). `POST /api/payments/webhook` (rota pública) recebe a notificação de
pagamento, valida a assinatura (`MERCADOPAGO_WEBHOOK_SECRET`, opcional mas recomendado — veja
`backend/.env.example`) e **sempre reconsulta o pagamento na API deles** antes de aprovar, nunca
confiando no status que vem no corpo da notificação.

O sistema de cobrança é genérico: todo pagamento é de um `Product` (model único, catálogo do
sistema). `kind` decide como o acesso é concedido — `SESSION_EXPORT` (a exportação de PDF acima,
ligada a uma sessão) ou `EBOOK` (produto "por conta", com um arquivo fixo, liberado direto pro
usuário sem sessão envolvida). A loja (`/loja` no frontend, menu "Atividades") vende os produtos
`EBOOK` — hoje materiais didáticos (planos de aula de cidadania usando o UrnaLab), cadastrados e
com arquivo/capa enviados pela Área de Gerenciamento.

| Método | Rota | Descrição |
| --- | --- | --- |
| GET/POST | /api/sessions/:id/payment | Status do pagamento da sessão / inicia o checkout |
| GET | /api/payments | Histórico de cobranças da própria conta (`/financeiro` no frontend) |
| POST | /api/payments/:id/refund | Reembolso — só antes do primeiro download do material comprado |
| GET | /api/products | Catálogo público (produtos ativos) |
| GET/POST | /api/products/:id/payment | Status / inicia o checkout de um produto "por conta" |
| GET | /api/products/:id/download | Baixa o arquivo — só com pagamento aprovado |

Uma cobrança nunca é reembolsável depois do primeiro download (`Payment.downloadedAt`) — senão a
conta ficaria com o material **e** o dinheiro de volta. Preço de cada produto mora no banco
(editável pela Área de Gerenciamento), não em variável de ambiente.
