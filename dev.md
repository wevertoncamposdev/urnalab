# Ideias para evoluir o projeto

Lista de possíveis próximos passos, fora do roteiro das 7 etapas já concluídas. Não é um
compromisso nem uma ordem — é um banco de ideias para escolher o que estudar a seguir.

## Produto e conteúdo educacional (concluído)

- **Página explicando o sistema eleitoral brasileiro**: cargos, mandatos, turno único vs. dois
  turnos, o que faz cada posição (Presidente, Governador, Senador, Deputado Federal/Estadual,
  Prefeito, Vereador). Pode linkar a partir da tela de votação, por cargo.
- **Nomear/configurar cargos livremente**: hoje `POSITION_RULES` é uma lista fixa em
  `rules/position-rules.js`. Virar um cadastro (nome, dígitos, ordem) abriria o simulador para
  eleições fora do modelo brasileiro (sindicato, grêmio, condomínio, etc.).
- **Dois turnos**: regra de maioria absoluta para Presidente/Governador/Prefeito, com um segundo
  turno entre os dois mais votados quando ninguém passa de 50% dos votos válidos.
- **Linha do tempo do projeto**: uma página (ou seção do README) contando o que cada etapa
  ensinou — bom para quem for usar este repo como material de estudo.

## Contas e multiusuário

- ~~**Cadastro público de usuários**: autenticação (sessão ou JWT), cada pessoa com suas próprias
  sessões/partidos/candidatos. Hoje tudo é um banco único, sem noção de "dono".~~ (concluído:
  registro/login com JWT, token em `localStorage`, rotas protegidas por padrão.)
- ~~**Multi-tenancy**: isolar os dados por organização/conta (`tenantId` em cada coleção, ou um
  `JsonDatabase`/schema por tenant se já tiver migrado para um banco real). Decidir entre
  isolamento lógico (coluna) e físico (schema/banco separado) é a primeira escolha de design.~~
  (concluído: isolamento lógico — `userId` em cada coleção, filtrado em todo repository/service;
  cada conta nova já ganha os 7 cargos padrão.)
- **Papéis de acesso**: admin (gerencia sessões/partidos/candidatos), mesário (opera a urna),
  eleitor (só vota) — hoje qualquer pessoa com acesso à API faz tudo. (Ainda em aberto — por
  enquanto, cada conta tem controle total só sobre os próprios dados, sem papéis dentro dela.)
- **Convite/compartilhamento de eleição**: permitir que mais de uma conta administre a mesma
  sessão (útil para simular uma comissão eleitoral). (Ainda em aberto — depende de papéis de
  acesso para fazer sentido: hoje uma sessão pertence a uma única conta.)

## Dados e infraestrutura

- ~~**Migração para PostgreSQL**: trocar só os repositories (o contrato já foi desenhado pensando
  nisso — `database/index.js` era o único ponto que conhecia o `JsonDatabase`).~~ (concluído: Prisma
  + PostgreSQL, só os repositories e `database/index.js` mudaram — services/controllers/frontend
  intocados. Unicidade virou `UNIQUE CONSTRAINT` real no banco, com o erro `P2002` mapeado para o
  mesmo formato de conflito que `insertUnless`/`updateUnless` usavam. A cadeia de hash dos votos
  precisou de uma coluna `seq` auto-incremento — `createdAt` sozinho não garante ordem sob dois
  votos no mesmo milissegundo. `sessionRepository.withLock` deixou de ser a fila do `JsonDatabase`
  e passou a ser um mutex em processo (`enqueueSessionTask`), mesma garantia de antes.)
- ~~**Docker Compose**: um `docker-compose up` subindo backend + frontend + Postgres, pra não
  depender de instalar Node/Postgres local.~~ (concluído, junto com o deploy — ver `DEPLOY.md`.)
- **Backup/restore**: comando para exportar/importar o estado completo de uma eleição (hoje só
  existe `npm run seed`, que sempre recria do zero).
- **Paginação** nas listagens (`/api/candidates`, `/api/votes` se virar endpoint): hoje tudo é
  carregado de uma vez, o que não escala para uma eleição com muitos votos.

## Segurança e integridade

- ~~**Rate limiting / proteção contra abuso** nos endpoints de voto (hoje qualquer cliente pode
  disparar requisições sem limite).~~ (concluído: limite em memória por IP,
  `middleware/rate-limit.js`, aplicado em login/registro/confirmação/reset de senha e no voto
  público — 120/hora nesse último, calibrado pra não travar uma sala de aula inteira votando pela
  mesma rede. Se o backend algum dia rodar em múltiplas instâncias, precisa virar um store
  compartilhado tipo Redis — hoje é só um `Map` em memória do processo.)
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
- **Revogar tokens JWT emitidos antes de um reset de senha** (Etapa 8.2): hoje a autenticação é
  stateless (sem lista de revogação) — um token emitido antes do reset continua válido até
  expirar (7 dias) mesmo depois da senha trocar. Resolver isso exigiria algum estado no servidor
  (lista de tokens revogados, ou um campo `tokenVersion`/`passwordChangedAt` no `User` checado a
  cada requisição autenticada), o que é uma mudança de arquitetura, não só do fluxo de senha.

## Qualidade e testes

- **Suíte de testes automatizada** (ex.: `node:test` ou Vitest) cobrindo os services do backend.
  Hoje a validação é feita com scripts de fumaça ad hoc durante o desenvolvimento, não comitados.
- **Testes end-to-end automatizados** (Playwright) para o fluxo de votação, cadastro de
  candidatos e apuração — hoje essa cobertura também é manual.
- **CI** (GitHub Actions) rodando lint, build do frontend e os testes a cada PR.

## Experiência da urna (votação)

- ~~**Múltiplos terminais por sessão**: hoje a tela de votação funciona bem para um terminal único;
  seria interessante simular várias urnas votando na mesma sessão ao mesmo tempo (já é seguro
  pela trava de concorrência, falta só a UX de "qual terminal sou eu").~~ (concluído, por outro
  caminho: **link público de votação** — cada sessão tem um token único; enquanto `OPEN`, qualquer
  pessoa com o link vota pelo próprio celular, sem conta. Para de funcionar sozinho ao finalizar.
  A cédula virou um hook compartilhado — `useBallotFlow` — entre a votação autenticada e a pública.)
- **Acessibilidade**: navegação 100% por teclado na tela de votação (já dá pra digitar e confirmar
  com Enter), leitor de tela, modo de alto contraste — importante justamente por ser uma simulação
  de urna eletrônica.
- **Modo quiosque**: tela cheia (já existe) e menu recolhível (já existe); falta bloqueio de
  navegação do navegador e timeout que volta pro cargo 1 se o eleitor ficar inativo.
- ~~**Organization chart no "Sistema eleitoral"**: trocar os cards de cargo por uma hierarquia
  visual (Executivo/Legislativo × Federal/Estadual/Municipal), com o card de detalhe abrindo ao
  clicar no cargo — mesmo conteúdo que já existe, só mais visual.~~ (concluído: componente
  `OrgChart` genérico — reaproveitável futuramente pra mostrar candidatos vencedores de uma sessão
  nas mesmas posições — e a página virou uma landpage em seções, com modo imersivo de tela cheia.)
- ~~**Assistente de criação de sessão**: um wizard guiado (sessão → partidos → pessoas →
  candidatos → revisão) pra quem está começando não precisar adivinhar a ordem certa de
  cadastro.~~ (concluído: `/sessoes/assistente`, reaproveitando os diálogos de cadastro já
  existentes.)
- ~~**Identidade visual única**: paleta, raio de borda e menu lateral revisados pra um design mais
  coeso entre as telas (desktop e mobile).~~ (concluído: tokens em `styles/globals.css`, sidebar
  reorganizada em grupos, componentes de base com visual mais consistente.)

## Operação

- **Logs estruturados** (nível, timestamp, rota, duração) em vez de `console.log`/`console.error`
  soltos — ajuda a depurar problemas depois que o projeto sair do ambiente de estudo.
- **Métricas básicas**: contagem de votos por minuto, tempo de resposta da API — dá pra expor um
  painel simples de operação da eleição.
