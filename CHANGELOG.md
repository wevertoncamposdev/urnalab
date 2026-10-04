# Changelog

Todas as mudanças notáveis deste projeto são documentadas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa
[Versionamento Semântico](https://semver.org/lang/pt-BR/) (`MAJOR.MINOR.PATCH`): `MINOR` para
funcionalidade nova compatível, `PATCH` para correções, `MAJOR` reservado para quando o projeto
sair do estágio educacional/0.x. Enquanto estiver em `0.x`, cada `MINOR` pode incluir mudanças
incompatíveis sem aviso extra, como é comum nessa faixa de versão.

## [Não lançado]

### Added

- **Área de Gerenciamento (Etapa 9)**: painel administrativo (`/admin`, `GET /api/admin/overview`
  e `GET /api/admin/users`) visível só para a conta cujo e-mail bate com a variável nova
  `ADMIN_EMAIL` (ver `backend/.env.example`) — sem campo de role no banco, de propósito, já que
  hoje é uma única conta. Mostra métricas agregadas (usuários, instituições com perfil, sessões e
  votos, novos cadastros nos últimos 7/30 dias) e uma listagem paginada de usuários com **e-mail
  parcialmente mascarado** (ex.: `wev***@gmail.com`) — minimização de dados pensando na LGPD, já
  que é informação de terceiros. Somente leitura nesta primeira versão: nenhuma ação sobre contas
  de outras pessoas. Todo acesso a essas rotas grava um registro em `AdminAccessLog` (migração
  `add_admin_access_log`) — accountability, e semente do item futuro "log de atividade
  administrativa" do `ROADMAP.md`. `GET /api/auth/me` (e login) passam a devolver também
  `isAdmin`, usado pelo frontend para mostrar ou não o item "Área de Gerenciamento" no menu.
- **Rate limiting por IP** (`backend/src/middleware/rate-limit.js`, em memória — sem dependência
  nova): login (10/15min), registro, reenvio de código e "esqueci minha senha" (5/hora),
  confirmação de e-mail/reset/troca de senha (10/15min) e voto público (120/hora — número alto
  de propósito, pra não travar uma sala de aula inteira votando pela mesma rede Wi-Fi). Estourar
  o limite responde `429 RATE_LIMITED` com header `Retry-After`.
- **Headers de segurança HTTP**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`
  em toda resposta da API (`backend/src/middleware/security-headers.js`) e também no frontend
  (`frontend/nginx.conf.template`), que ganhou ainda `Strict-Transport-Security`.
  `Content-Security-Policy` ficou de fora dessa leva — entra depois de mapear com cuidado todo
  recurso externo carregado (Google Fonts, etc.), pra não quebrar a aplicação silenciosamente.

### Changed

- **Raiz do projeto organizada**: `DEPLOY.md` e `identidade visual.md` foram pra `docs/`;
  `PLANO.md` e `dev.md` (que na prática sempre tinham um vazio enquanto o outro crescia) viraram
  as seções "Em andamento" e "Ideias futuras" de um `ROADMAP.md` só. Sem mudança de conteúdo, só
  de organização — ver `.clauderules` pra a lista atualizada de onde encontrar cada coisa.
- **Menu lateral reorganizado**: ordem agora segue o fluxo de pré-requisito — Cargos, Partidos e
  Pessoas (precisam existir antes) até Eleições. Candidatos saiu do menu (continua acessível
  direto da tela da sessão, como já era) e "Linha do tempo" saiu por ora do menu (rota e página
  continuam existindo, ideia em aberto pra ela).
- **Identidade visual UrnaLab** (`identidade visual.md`): wordmark oficial ("urna" em azul
  profundo + "lab" em verde, sempre minúsculo) substitui o texto "UrnaLab" solto no cabeçalho,
  no menu lateral, na landing e no login (`components/branding/Wordmark.jsx`). Tipografia da
  marca (Manrope para texto, Sora para títulos, IBM Plex Mono para dados técnicos — hashes,
  números, códigos) carregada via Google Fonts. Novo tom de coral (`--coral`/`--coral-soft`,
  único hex novo — o resto da paleta já existia no projeto) para alertas leves: a notificação de
  perfil incompleto no menu do usuário e o aviso de perfil pendente no `/perfil` deixaram de usar
  a cor de erro. E-mails transacionais (confirmação de e-mail, redefinição de senha) ganharam
  layout com cabeçalho, wordmark e rodapé institucional, seguindo a mesma paleta do site.

## [0.13.0] — 2026-10-03

### Added

- **Confirmação de e-mail no cadastro (Etapa 8.1)**: `POST /api/auth/register` cria a conta e
  envia um código de 6 dígitos por e-mail (via [Resend](https://resend.com)), mas não devolve
  mais token — só depois de confirmado (`POST /api/auth/verify-email`) a conta recebe acesso.
  `POST /api/auth/login` passa a recusar contas não confirmadas (`EMAIL_NOT_VERIFIED`, 403); o
  frontend redireciona automaticamente para a tela de confirmação nesse caso. Código expira em
  15 minutos, tem limite de 5 tentativas e reenvio (`POST /api/auth/resend-verification`) tem
  cooldown de 60 segundos. Contas criadas antes desta mudança foram retroagidas como já
  confirmadas (migração `add_email_verification`), para não trancar quem já tinha conta.
  Variáveis novas: `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` (ver
  `backend/.env.example` e `DEPLOY.md`).
- **Reset de senha (Etapa 8.2)**: "Esqueci minha senha" no login (`POST /api/auth/forgot-
  password`) envia um link de redefinição por e-mail (reaproveita o Resend da 8.1), válido por
  30 minutos e de uso único (`POST /api/auth/reset-password`). A resposta de `forgot-password` é
  **sempre igual**, exista ou não o e-mail — não revela quais e-mails têm conta. Depois de
  redefinir, é preciso logar de novo com a senha nova (sem login automático).
- **Perfil da instituição (Etapa 8.3)**: nova entidade `InstitutionProfile` (1:1 com a conta) —
  nome, endereço, contato e site (opcional) — com `GET`/`PUT /api/institution-profile`.
- **Tela de perfil do usuário e obrigatoriedade na criação de sessão (Etapa 8.4)**: nova tela
  `/perfil` (acessível pelo menu — antes só o nome da conta, agora um dropdown com
  "Configurações" e "Sair") reúne os dados da conta, o formulário da instituição e a troca de
  senha (`POST /api/auth/change-password`, exige a senha atual). Em vez de bloquear o sistema
  inteiro (como a 8.3 fazia inicialmente), a exigência agora é pontual: `POST /api/sessions`
  recusa criar sessão (`403 INSTITUTION_PROFILE_REQUIRED`) sem o perfil da instituição
  cadastrado. Perfil incompleto não mostra mais um alerta fixo no Dashboard — vira uma
  notificação (balão vermelho no menu do usuário, `lib/notifications.js`), primeiro caso de uma
  estrutura pensada pra crescer com outras notificações depois. Telefone da instituição ganhou
  máscara e validação (10 ou 11 dígitos com DDD) e o site passou a exigir um domínio com ponto
  (`https://algo.com`, não só `https://algo`). Login sempre abre o Dashboard, mesmo quando o
  usuário foi desviado pro login a partir de outra página.

## [0.12.0] — 2026-10-02

### Added

- **Landing page e identidade visual (UrnaLab)**: `/` agora é uma landpage pública (antes era o
  Dashboard autenticado, que passou para `/painel`) — hero com o banner da marca, cards das
  funcionalidades reais (urna, apuração, auditoria com cadeia de hash, link público de votação,
  isolamento por conta), seção "como funciona" e CTA para criar conta ou entrar. A logo oficial
  (`frontend/public/img/urnalab-logo.png`) substitui o ícone genérico em toda a borda do app —
  sidebar, cabeçalho mobile, telas de login/registro, votação pública e favicon da aba.

### Fixed

- Card "Estado do sistema" do Dashboard ainda rotulava o banco como "armazenamento JSON" —
  resquício da migração para PostgreSQL (0.11.0). Agora mostra "Banco de dados (PostgreSQL)".

## [0.11.0] — 2026-10-02

### Changed

- **Banco de dados: JSON em arquivo → PostgreSQL (Prisma)**. Só os repositories
  (`src/repositories/*.js`) e `src/database/index.js` mudaram — services, controllers e frontend
  ficaram intocados, como o desenho em camadas sempre prometeu. Unicidade (e-mail, sigla/número de
  partido, código de cargo, número de candidato por sessão+cargo) agora é `UNIQUE CONSTRAINT` real
  no banco, com o erro de violação (`P2002`) mapeado pro mesmo formato de conflito que
  `insertUnless`/`updateUnless` usavam. A cadeia de hash dos votos (auditoria) ganhou uma coluna de
  sequência (`seq`, auto-incremento) pra garantir a ordem de leitura mesmo quando dois votos caem
  no mesmo milissegundo — só por `createdAt` isso não era garantido. `sessionRepository.withLock`
  deixou de depender da fila do `JsonDatabase` e passou a usar um mutex em processo
  (`enqueueSessionTask`), preservando a mesma garantia de exclusão mútua entre um voto sendo
  registrado e a sessão sendo finalizada ao mesmo tempo. Migração e schema em `backend/prisma/`.
- **Deploy pronto para produção**: `Dockerfile` (backend e frontend) e `docker-compose.yml` (com
  Postgres local em dev), `railway.json` por serviço, `.env.example` documentando todas as
  variáveis, e `DEPLOY.md` com o passo a passo completo para o Railway. `config.js` agora recusa
  iniciar em produção sem `JWT_SECRET`/`DATABASE_URL` em vez de cair num padrão silencioso.

## [0.10.0] — 2026-10-02

### Added

- **Acesso pela rede local**: Vite agora escuta em todas as interfaces (`server.host: true`), e o
  CORS do backend aceita uma lista de origens (`FRONTEND_URL` separado por vírgula) em vez de uma
  só — dá pra usar o app por `localhost` e pelo IP da rede ao mesmo tempo (ex.: votar pelo link
  público direto do celular). Ver README para os comandos.
- **Resultado no link público**: quando a sessão votada pelo link público é finalizada, a mesma
  tela passa a mostrar a apuração por cargo (igual à tela de Resultados autenticada), em vez de só
  avisar que a votação encerrou.
- **Organograma do sistema eleitoral**: a página "Sistema eleitoral brasileiro" virou uma landpage
  (uma seção por conceito — poderes, esferas, sistema de votação, turnos — com botão pra rolar de
  uma pra outra) terminando num organograma clicável dos cargos (Poder x Esfera de governo); clicar
  num cargo abre o detalhe dele. Tem um modo imersivo (overlay de tela cheia com rolagem própria,
  Esc fecha) pra acompanhar a explicação inteira em foco. O componente `OrgChart` é genérico —
  pensado para, futuramente, mostrar os candidatos vencedores de uma sessão nas mesmas posições.
- **Assistente guiado de nova eleição** (`/sessoes/assistente`): cria a sessão e, passo a passo,
  cadastra partidos, pessoas e candidatos (reaproveitando os mesmos diálogos das telas normais),
  terminando num resumo com a opção de abrir a votação direto. Pensado pra quem está usando o
  simulador pela primeira vez e não sabe por onde começar.
- **Identidade visual**: paleta e raio de borda revisados (tokens em `styles/globals.css`), menu
  lateral reorganizado em grupos (Montar a eleição, Dia da votação, Conteúdo) com uma cor de
  destaque própria para o Assistente, e os componentes de base (botão, card, badge, input, select,
  diálogo) com um visual mais coeso entre si.

### Changed

- **Tela de votação no celular**: painel da foto do candidato passou a aparecer acima do teclado
  (antes vinha depois), e os elementos (dígitos, botões, espaçamento) encolheram o suficiente pra
  caber na tela de um celular sem precisar rolar — sem mudar o layout do desktop.

## [0.9.0] — 2026-10-02

### Added

- **Link público de votação**: cada sessão ganha um token único e aleatório; enquanto a sessão
  está `OPEN`, a tela da sessão mostra um link (`/votar/:token`) que qualquer pessoa pode abrir
  pelo celular pra votar, sem precisar de conta. O link para de funcionar sozinho quando a eleição
  é finalizada (ou ainda não foi aberta). Sessões criadas antes dessa funcionalidade ganham o
  token automaticamente na primeira vez que forem abertas.

### Changed

- A lógica da cédula de votação (dígitos, teclado físico, consulta do candidato, confirmação) foi
  extraída pra um hook compartilhado (`useBallotFlow`), reaproveitado pela votação autenticada e
  pelo link público — a mesma experiência dos dois lados, sem duplicar a parte mais delicada.

## [0.8.0] — 2026-10-02

### Added

- **Contas e login**: cadastro (nome, e-mail, senha) e login com JWT (HS256 implementado à mão,
  sem biblioteca — `utils/jwt.js`), senha com hash `scrypt` nativo do Node (`utils/password.js`).
  Toda rota exige login por padrão (`/api/auth/register` e `/api/auth/login` são as únicas
  públicas, além de `/api/health`); o front guarda o token no `localStorage` e desloga sozinho se
  qualquer requisição voltar 401.
- **Multi-tenancy (isolamento lógico)**: toda coleção — cargos, partidos, pessoas, candidatos,
  sessões, votos — ganhou um `userId`, filtrado em todo repository e service. Uma conta nunca
  enxerga nem referencia dados de outra (tentar acessar por id direto responde 404, nunca 403 —
  não revela que existe). Cada conta nova já nasce com os 7 cargos padrão, prontos pra editar.
- Tela de **Login** e **Cadastro**, botão de sair no cabeçalho, e `npm run seed` atualizado para
  criar (ou reaproveitar) uma conta demo fixa antes de popular os dados.

### Fixed

- CORS não liberava o header `Authorization`, bloqueando toda requisição autenticada vinda do
  navegador (preflight falhava antes mesmo do login terminar).

## [0.7.0] — 2026-10-02

### Added

- **Criar sessão de 2º turno**: na tela de Resultados, quando algum cargo não teve maioria
  absoluta, um banner mostra quem vai disputar a segunda rodada com um botão "Criar sessão de 2º
  turno". Ele cria a nova sessão (rascunho, mesmo ano) já com a candidatura dos dois mais votados
  de cada cargo — mesma pessoa, partido e número, só o vínculo com a sessão é novo — faltando só
  abrir a votação.

## [0.6.0] — 2026-10-02

### Added

- **Dois turnos**: cargos majoritários agora têm a opção "Permite 2º turno" (tela de Cargos). Com
  ela ativada, a apuração só declara um vencedor se alguém passar de 50% dos votos válidos no 1º
  turno (maioria absoluta); senão, mostra os dois mais votados que disputariam a segunda rodada,
  em vez de eleger alguém. `Presidente` e `Governador` já vêm com a opção ativada por padrão.
  O simulador calcula a regra e indica quem iria ao 2º turno, mas não cria uma sessão de 2º turno
  automaticamente — isso continua como ideia em aberto no dev.md.
- **Linha do tempo do projeto** (`/linha-do-tempo`): página contando o que cada etapa — as 7
  originais e o que veio depois — construiu e o que ela ensina, pensada pra quem usar o repo como
  material de estudo.

## [0.5.0] — 2026-10-02

### Added

- **Menu lateral recolhível**: botão no cabeçalho (ícone de painel) esconde/mostra a sidebar,
  deixando a tela mais limpa — útil sobretudo na Votação. A preferência fica salva no navegador
  (`localStorage`) e persiste entre recarregamentos.

## [0.4.0] — 2026-10-02

### Added

- **Painel lateral do candidato**: foto, nome e partido do candidato localizado passaram para um
  painel maior ao lado do teclado, em vez de um avatar pequeno embutido no cartão de dígitos —
  mais fácil de enxergar à distância, como o monitor separado de uma urna real.
- **Votação pelo teclado físico**: dígitos 0-9 digitam o número, Backspace/Delete corrige (igual
  ao botão "Corrige"), Enter confirma o voto e também avança pro próximo eleitor na tela de "Voto
  computado".
- **Som de confirmação**: o "pili-pim" clássico toca ao fechar a cédula (todos os cargos
  confirmados), sintetizado no navegador via Web Audio — sem depender de nenhum arquivo de áudio.
- **Botão de tela cheia** na Votação: usa a API nativa de fullscreen do navegador, com o ícone
  trocando para "sair" automaticamente (inclusive ao sair pelo Esc).

## [0.3.0] — 2026-10-02

### Added

- **Cadastro de pessoas (Pessoas)**: nova entidade `people` (nome + foto), com tela própria de
  CRUD (`/pessoas`, `/api/people`) separada da candidatura. Uma pessoa só pode ser removida se
  não tiver nenhuma candidatura vinculada.

### Changed

- **Candidatura virou só o vínculo**: o formulário de "Candidatos" não cria mais nome/foto — ele
  só registra a candidatura de uma pessoa já cadastrada (sessão + cargo + partido + número).
  Editar nome/foto agora acontece exclusivamente em Pessoas, e o ajuste aparece em todas as
  sessões onde a pessoa é candidata. `personId` é imutável depois que a candidatura é criada.
- **Migração de dados existente**: candidatos cadastrados no formato antigo (nome/foto no próprio
  registro) foram convertidos para o novo modelo por `scripts/migrate-candidates-to-people.js`.

## [0.2.0] — 2026-10-02

### Added

- **Cadastro de cargos (Cargos)**: `POSITION_RULES` deixou de ser uma lista fixa em código e virou
  um registro com CRUD completo (`/api/positions`) — nome, dígitos do número de urna e ordem na
  cédula são livres, com o identificador interno (`code`) gerado automaticamente a partir do nome.
  Um cargo em uso por alguma sessão não pode ser removido. Isso abre o simulador para eleições
  fora do modelo brasileiro (sindicato, grêmio, condomínio, etc.). Nova página **Cargos** no menu.
- **Página "Sistema eleitoral brasileiro"**: conteúdo educacional explicando cargos, mandatos,
  poderes (Executivo/Legislativo), abrangência (federal/estadual/municipal), sistema majoritário
  vs. proporcional e a regra de turno único vs. dois turnos. Acessível pelo menu e linkada a partir
  de cada cargo na tela de votação ("Saiba mais sobre este cargo").

### Changed

- **Captura de foto por webcam**: antes de confirmar, agora é possível rever o quadro capturado e
  escolher "Usar foto" ou "Tirar outra" sem precisar pedir permissão da câmera de novo. A prévia ao
  vivo e a foto final ficam espelhadas (efeito selfie). Mensagens de erro específicas para
  permissão negada, câmera não encontrada ou câmera em uso por outro aplicativo.

### Fixed

- **Captura de foto por webcam**: corrigida a tela preta que aparecia ao religar a câmera depois do
  primeiro uso (o vídeo era conectado ao stream antes do elemento `<video>` existir no DOM).

## [0.1.0] — Etapas 1 a 7

Primeira versão funcional do simulador, construída em 7 etapas de estudo (arquitetura em camadas,
Node.js puro sem framework HTTP, persistência em JSON, depois React no frontend).

### Added

- **Arquitetura em camadas**: `HTTP → Routes → Controllers → Services → Repositories →
  JsonDatabase → arquivo JSON`, com roteador e servidor HTTP próprios (sem Express). Só o
  `JsonDatabase`/`database/index.js` conhece o armazenamento, isolando uma futura troca para
  SQLite/PostgreSQL nos repositories.
- **Persistência em JSON** (`backend/data/*.json`): fila de operações (uma por vez) e gravação
  atômica (arquivo temporário + rename), evitando corrupção por escritas simultâneas.
- **Sessões eleitorais**: CRUD com ciclo de vida `DRAFT → OPEN → FINISHED`; cada sessão define
  quais cargos estão em disputa.
- **Partidos**: CRUD com sigla e número únicos; desativação (não exclusão) preserva candidatos e
  votos já vinculados.
- **Candidatos**: CRUD vinculado a sessão + cargo + partido; número único por cargo dentro da
  sessão (inclusive entre inativos); número com a quantidade de dígitos do cargo; identidade
  (partido/cargo/número) travada depois que a votação abre — só nome, foto e status continuam
  editáveis; candidato inativo não recebe votos.
- **Foto do candidato por link ou webcam**: aceita um link `http(s)://`, uma captura da câmera do
  navegador (vira arquivo em `backend/data/photos/`, nunca fica base64 no JSON) ou o caminho já
  salvo; arquivo antigo é removido do disco ao trocar ou remover a foto.
- **Votação**: busca do candidato pelo número digitado (`/api/votes/lookup`) e registro de voto
  válido, branco ou nulo; sessão precisa estar `OPEN`; nenhum dado do eleitor é armazenado; votos
  não têm edição nem exclusão.
- **Resultados**: apuração por cargo disponível só depois que a sessão é finalizada — ranking de
  candidatos, percentual sobre votos válidos (brancos/nulos ficam de fora, como numa eleição real)
  e vencedor(es) (mais de um em caso de empate no primeiro lugar).
- **Auditoria**: cada voto grava um hash encadeado ao voto anterior da sessão (`utils/hash.js`);
  `/api/sessions/:id/audit` reconfere a cadeia inteira e aponta o primeiro ponto de quebra, se
  houver — detecta alteração, remoção ou reordenação de votos feita direto no arquivo.
- **Trava de concorrência**: checar "sessão está OPEN" e gravar o voto (ou finalizar a sessão)
  rodam como uma única operação atômica, então uma finalização concorrente nunca deixa passar um
  voto depois de completada.
- **Frontend React**: páginas de Dashboard, Sessões, Partidos, Candidatos, Votação, Resultados e
  Auditoria, com layout, navegação lateral e componentes de UI próprios (tabelas, diálogos,
  badges de status, estados vazio/erro/carregando).
- **Script de seed** (`npm run seed [-- --voters=N] [-- --finish]`): recria os dados com partidos,
  uma sessão e candidatos fictícios e, opcionalmente, simula eleitores votando.
