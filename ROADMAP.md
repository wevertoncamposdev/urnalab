# Roadmap

Fonte única sobre o que vem a seguir no projeto: o que está sendo trabalhado agora e o banco de
ideias ainda em aberto. Antes isso vivia em dois arquivos separados (`PLANO.md` e `dev.md`); como
na prática um sempre ficava vazio enquanto o outro crescia, viraram duas seções de um arquivo só.

## Em andamento

Só o que está **de fato sendo planejado ou implementado agora** entra aqui, organizado por Etapa
— continuando a numeração já usada no [README.md](README.md) e no [CHANGELOG.md](CHANGELOG.md).

Cada Etapa pode ter subitens fecháveis individualmente (ex.: 8.1, 8.2). Quando um subitem fecha:

1. O código é commitado.
2. Uma entrada é adicionada ao `CHANGELOG.md` (em `[Não lançado]` ou numa versão nova).
3. O subitem é marcado `[x]` aqui, com a data de fechamento.
4. Quando **todos** os subitens de uma Etapa fecham, a Etapa inteira é removida deste arquivo —
   o `CHANGELOG.md` passa a ser a única fonte de verdade sobre o que foi feito.

Status possíveis: `planejado` (ainda não começou) · `em andamento` · `concluído`.

---

Nenhuma etapa em andamento no momento — ver `CHANGELOG.md` para o histórico.

---

## Ideias futuras

Lista de possíveis próximos passos, sem compromisso nem ordem — um banco de ideias pra escolher o
que estudar a seguir. Quando uma ideia daqui vira trabalho de verdade, ela sobe pra seção "Em
andamento" acima como uma Etapa nova.

### Produto e conteúdo educacional

- **Nomear/configurar cargos livremente**: hoje `POSITION_RULES` é uma lista fixa em
  `rules/position-rules.js`. Virar um cadastro (nome, dígitos, ordem) abriria o simulador para
  eleições fora do modelo brasileiro (sindicato, grêmio, condomínio, etc.).
- **Dois turnos**: regra de maioria absoluta para Presidente/Governador/Prefeito, com um segundo
  turno entre os dois mais votados quando ninguém passa de 50% dos votos válidos.

### Contas e multiusuário

- **Papéis de acesso**: admin (gerencia sessões/partidos/candidatos), mesário (opera a urna),
  eleitor (só vota) — hoje qualquer pessoa com acesso à API faz tudo. Por enquanto, cada conta
  tem controle total só sobre os próprios dados, sem papéis dentro dela.
- **Convite/compartilhamento de eleição**: permitir que mais de uma conta administre a mesma
  sessão (útil para simular uma comissão eleitoral). Depende de papéis de acesso pra fazer
  sentido: hoje uma sessão pertence a uma única conta.

### Dados e infraestrutura

- **Backup/restore**: comando para exportar/importar o estado completo de uma eleição (hoje só
  existe `npm run seed`, que sempre recria do zero).
- **Paginação** nas listagens (`/api/candidates`, `/api/votes` se virar endpoint): hoje tudo é
  carregado de uma vez, o que não escala para uma eleição com muitos votos.

### Segurança e integridade

- **Content-Security-Policy**: headers de baixo risco (`X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security`) já estão em
  `frontend/nginx.conf.template` e `backend/src/middleware/security-headers.js`. CSP ficou de
  fora porque precisa mapear todo recurso externo carregado (Google Fonts da identidade visual,
  Resend, etc.) e testar com cuidado — um CSP errado quebra a aplicação inteira silenciosamente.
- **Checar tamanho da foto antes de decodificar**: `person.service.js` decodifica o base64 em
  `Buffer` antes de comparar com `PHOTO_MAX_BYTES` — dá pra checar `base64.length` antes do
  `Buffer.from` e economizar o decode em tentativas inválidas. Hoje não é uma vulnerabilidade de
  verdade (o corpo da requisição já tem teto de 1MB em `utils/http.js`), só desperdício de CPU.
- **Exportar a cadeia de auditoria**: um botão "baixar CSV/JSON" na tela de Auditoria, pra
  verificação por terceiros fora da aplicação.
- **Ancoragem externa do hash**: publicar periodicamente o hash do último voto de uma sessão em
  algum lugar fora do controle do próprio sistema (um log público, por exemplo) — fecha a lacuna
  de "o hash só prova algo se alguém guardou uma cópia de fora".
- **Autenticação de mesário** antes de abrir/finalizar uma sessão ou editar candidatos — hoje
  essas ações não pedem nenhuma credencial.
- **Revogar tokens JWT emitidos antes de um reset de senha**: hoje a autenticação é stateless
  (sem lista de revogação) — um token emitido antes do reset continua válido até expirar (7 dias)
  mesmo depois da senha trocar. Resolver isso exigiria algum estado no servidor (lista de tokens
  revogados, ou um campo `tokenVersion`/`passwordChangedAt` no `User` checado a cada requisição
  autenticada), o que é uma mudança de arquitetura, não só do fluxo de senha.

### Qualidade e testes

- **Suíte de testes automatizada** (ex.: `node:test` ou Vitest) cobrindo os services do backend.
  Hoje a validação é feita com scripts de fumaça ad hoc durante o desenvolvimento, não comitados.
- **Testes end-to-end automatizados** (Playwright) para o fluxo de votação, cadastro de
  candidatos e apuração — hoje essa cobertura também é manual.
- **CI** (GitHub Actions) rodando lint, build do frontend e os testes a cada PR.

### Experiência da urna (votação)

- **Acessibilidade**: navegação 100% por teclado na tela de votação (já dá pra digitar e
  confirmar com Enter), leitor de tela, modo de alto contraste — importante justamente por ser
  uma simulação de urna eletrônica.
- **Modo quiosque**: tela cheia (já existe) e menu recolhível (já existe); falta bloqueio de
  navegação do navegador e timeout que volta pro cargo 1 se o eleitor ficar inativo.
- **Linha do tempo**: a página existe (`/linha-do-tempo`, `Timeline.jsx`) mas saiu do menu por
  ora — ideia em aberto de pra onde evoluir ela, ainda sem formato definido.

### Operação

- **Logs estruturados** (nível, timestamp, rota, duração) em vez de `console.log`/`console.error`
  soltos — ajuda a depurar problemas depois que o projeto sair do ambiente de estudo.
- **Métricas básicas**: contagem de votos por minuto, tempo de resposta da API — dá pra expor um
  painel simples de operação da eleição.
