# Changelog

Todas as mudanças notáveis deste projeto são documentadas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa
[Versionamento Semântico](https://semver.org/lang/pt-BR/) (`MAJOR.MINOR.PATCH`): `MINOR` para
funcionalidade nova compatível, `PATCH` para correções, `MAJOR` reservado para quando o projeto
sair do estágio educacional/0.x. Enquanto estiver em `0.x`, cada `MINOR` pode incluir mudanças
incompatíveis sem aviso extra, como é comum nessa faixa de versão.

## [Não lançado]

### Added

- **Urna simulada na tela de votação (Etapa 17)**: `BallotCard` + `VoteKeypad` + botão "Confirma"
  avulsos viraram um componente só, `Urna` (`components/voting/Urna.jsx`), estilizado como o corpo
  físico de uma urna de verdade — fundo azul-marinho (`bg-sidebar`), tela clara e teclado dentro do
  próprio corpo. A tela da urna mostra os dígitos enquanto o eleitor digita e, assim que o número
  fecha, troca pra foto/nome do candidato (ou o aviso de voto nulo) **direto nela**, igual uma urna
  de verdade — antes a foto só aparecia num painel lateral separado. Esse veredito (branco/
  carregando/encontrado/nulo) ficou num util compartilhado (`lib/candidate-preview.js`
  `getCandidatePreviewState`), pra não duplicar a mesma lógica em cada lugar que precisa mostrar
  esse status. `PublicVoting.jsx` passou de três colunas (consulta de proposta / cédula+teclado /
  preview) pra duas: a `Urna` de um lado, e do outro um novo componente `CandidateList`
  (`components/voting/CandidateList.jsx`) — lista os candidatos do **cargo sendo votado agora**
  (não mais todos os cargos misturados num `Select`), trocando sozinha a cada avanço de cargo;
  clicar num nome expande a proposta de governo ali mesmo na lista, substituindo tanto o antigo
  painel de preview quanto o `Select` de consulta por um elemento só. No celular, a urna vem
  primeiro (é a interação principal), a lista depois. `BallotCard.jsx` e `CandidatePreviewPanel.jsx`
  saíram do projeto, função absorvida pela `Urna`/`CandidateList`. `VoteKeypad` não precisou de
  nenhum ajuste visual: os botões de dígito (fundo branco) já liam bem como teclas físicas claras
  sobre o corpo escuro.
- **Upload de arquivo e capa de produto pela Área de Gerenciamento**: fechava dois itens do
  `ROADMAP.md` levantados na revisão da Etapa 16. (1) `/gerenciamento/produtos` agora faz upload de
  verdade do PDF de um produto `EBOOK` (campo `file`, data URI, decodificado e gravado por
  `storage/product-file-storage.js`) — antes só dava pra cadastrar via `scripts/seed.js`/banco
  direto. Corpo da requisição de criar/editar produto ganhou um teto maior
  (`PRODUCT_FILE_LIMITS.requestBodyMaxBytes`, 21MB) só nessas duas rotas — `maxBodyBytes` virou uma
  opção por rota no roteador (`utils/router.js`/`utils/http.js readJsonBody`), em vez de aumentar o
  teto padrão de 1MB pra toda a API. Arquivo do ebook tem seu próprio teto, bem mais generoso
  (`PRODUCT_FILE_LIMITS.ebookMaxBytes`, 15MB) — bem acima do antigo limite de 1MB que tornava
  qualquer ebook de verdade inviável. (2) Novo campo `Product.coverImage` — uma capa pública
  (reaproveitando `photo-storage.js`, mesmo armazenamento das fotos de candidato, servida sem gate
  nenhum) que aparece na loja (`/loja`) como pré-visualização do produto antes da compra; o arquivo
  pago em si continua só liberado depois do pagamento aprovado. Com isso, a conta admin já pode
  cadastrar o material didático de verdade (substituindo o placeholder do seed) quando tiver o
  conteúdo pronto — decisão de conteúdo, não mais limitação técnica.
- **Área de Gerenciamento: rota própria e gestão de produtos (Etapa 16)**: a Área de Gerenciamento
  saiu de `/admin*` (dentro da árvore de rotas comum do usuário) para `/gerenciamento*`, numa árvore
  de rotas própria no React Router (`App.jsx`), com as páginas (`Admin`, `AdminAnalytics`,
  `AdminFeedback`, nova `AdminProducts`) carregadas via `React.lazy` — o código delas não é mais
  baixado por uma conta comum, só por quem de fato navega pra lá e já passou pelo guard
  (`RequireAuth` + `RequireAdmin`). No backend, a autorização admin deixou de ser checada dentro de
  cada método de `admin.service.js` (uma consulta ao banco por chamada) e passou pro roteador: toda
  rota `/api/admin/*` agora tem `adminOnly: true` (`utils/router.js`), verificado em `server.js`
  antes de qualquer handler/controller/service rodar, comparando o e-mail já carimbado no token
  (`auth.service.js issueToken`, novo claim `email`) contra `ADMIN_EMAIL` — sem nenhuma consulta ao
  banco. **Importante**: tokens emitidos antes deste deploy não têm esse claim — a conta admin
  precisa logar de novo uma vez pra o acesso à Área de Gerenciamento voltar a funcionar. Nova
  gestão de produtos (16.2/16.3, tela `/gerenciamento/produtos`): CRUD de nome/descrição/preço/
  ativo de qualquer `Product` (`POST`/`PUT /api/admin/products`) e histórico de vendas por produto
  (`GET /api/admin/products/:id/sales`, quantidade e receita aprovadas + lista de cobranças, sem
  nenhum dado de quem comprou). Upload do arquivo de um produto `EBOOK` ainda não existe nessa
  tela — o corpo da requisição tem um teto de 1MB (`utils/http.js`) incompatível com um ebook de
  verdade, e o roteador não lê `multipart/form-data`; produtos `EBOOK` continuam cadastrados via
  `scripts/seed.js`/banco direto até isso existir.
- **Produtos genéricos e loja (Etapa 15)**: o sistema de cobrança deixou de ser exclusivo da
  exportação de PDF — novo model `Product` (`prisma/schema.prisma`) é o catálogo de qualquer coisa
  vendável, com preço editável em banco (não mais via env var: `SESSION_RESULTS_PRICE_CENTS` saiu
  de `config.js`). `Payment` passou a referenciar um `productId` (antes só `sessionId`); o campo
  `kind` do produto decide como o acesso é concedido depois de aprovado
  (`payment.service.js scopeForProduct`): `SESSION_EXPORT` continua exigindo uma sessão finalizada
  da própria conta (`sessionId` obrigatório) — é o que a exportação de PDF sempre foi, migrado pra
  esse model pela própria migração (`20261007234700_add_products`, que já cria o produto
  `session-export` com R$ 9,90); `EBOOK` libera direto pro `userId`, sem sessão, com um arquivo
  fixo (`Product.fileKey`, `storage/product-file-storage.js`). As rotas e o front da exportação de
  PDF (`/api/sessions/:id/payment`, tela de Resultados) não mudaram por fora — o motor novo foi só
  por dentro. Nova loja (`GET /api/products`, `GET/POST /api/products/:id/payment`,
  `GET /api/products/:id/download`, página `/loja`) vende o primeiro produto "por conta" de
  verdade: um ebook, com CTA a partir de `/sistema-eleitoral`. A área financeira (`/financeiro`,
  Etapa 14) agora mostra o produto de cada cobrança, não só a sessão. O produto ebook real
  (conteúdo, upload) ainda depende da Etapa 16 (CRUD de produto pelo admin) para ser cadastrado em
  produção — hoje só existe um exemplo placeholder, criado pelo seed de desenvolvimento
  (`npm run seed`, `scripts/seed.js`), pra validar o fluxo de compra/download ponta a ponta.

### Security

- **Cobrança pela exportação em PDF — reforço de segurança (Etapa 13)**: levantado numa revisão de
  código da Etapa 12. (1) `POST /api/payments/webhook` agora valida a assinatura
  (`x-signature`/`x-request-id`) da notificação do Mercado Pago, via
  `MERCADOPAGO_WEBHOOK_SECRET` (opcional — sem ela, o comportamento é o mesmo de antes, só com um
  aviso no log); a reconsulta à API deles antes de aprovar (já existente) continua sendo a fonte de
  verdade do status, a assinatura só evita gastar essa chamada com notificação forjada. (2)
  `payment.service.js confirmPayment` agora revalida `transaction_amount` contra o `amountCents`
  cobrado antes de aprovar um pagamento. (3) `mapMercadoPagoStatus` (`payment-rules.js`) passa a
  reconhecer `refunded`/`charged_back` como estados próprios (`REFUNDED`/`CHARGED_BACK`) em vez de
  cair genericamente em `PENDING` — e `paidAt` não é mais apagado nessa transição, preservando
  quando o pagamento foi aprovado originalmente. (4) Rate limit (10 por 15 min, por IP) em
  `POST /api/sessions/:id/payment`. (5) Tentativas `PENDING` abandonadas (sessão nunca paga) agora
  expiram sozinhas (`paymentRepository.expireStalePending`, verificação "lazy" no início de um novo
  checkout da mesma sessão) em vez de acumular pra sempre.
- **Correções encontradas numa revisão das Etapas 13/14**: (1) `resultController.downloadPdf`
  gravava `downloadedAt` **antes** de gerar o PDF — se `resultsReportService.build`/
  `renderResultsPdf` falhasse, a cobrança ficava travada pra reembolso sem o usuário ter recebido
  nada; agora só grava depois do PDF gerado com sucesso. (2) a validação de assinatura do webhook
  (Etapa 13) era aplicada também ao formato IPN legado (`?topic=payment&id=...`), que nunca envia
  `x-signature` — com `MERCADOPAGO_WEBHOOK_SECRET` configurado, isso rejeitava notificações legadas
  genuínas; o IPN legado agora fica de fora dessa checagem (sua defesa continua sendo a reconsulta
  à API, como sempre foi). (3) sem `MERCADOPAGO_WEBHOOK_SECRET`, a assinatura falhava aberta mesmo
  em produção, só com um aviso no log — inconsistente com o padrão já usado pra `JWT_SECRET`/Resend;
  `config.js` agora recusa subir em produção se `MERCADOPAGO_ACCESS_TOKEN` estiver configurado sem
  o segredo do webhook. (4) `mercadoPagoService.refundPayment` mandava `Content-Type: application/
  json` sem nenhum corpo; removido. De quebra, as três chamadas à API do Mercado Pago
  (`createPreference`/`getPayment`/`refundPayment`) passaram a compartilhar um único helper
  (`callMercadoPago`) em vez de repetir o mesmo bloco de fetch/erro três vezes.

### Added

- **Área financeira do usuário e reembolso (Etapa 14)**: nova página `/financeiro` (link na
  sidebar, grupo "Conta") lista o histórico de cobranças da própria conta — sessão, data, valor,
  status e se já foi baixado (`GET /api/payments`, `paymentRepository.findByUser`). Uma cobrança
  `APPROVED` ainda não baixada ganha um botão "Solicitar reembolso"
  (`POST /api/payments/:id/refund`, via `mercadoPagoService.refundPayment`); **regra de negócio
  inegociável**: depois do primeiro download do PDF (`Payment.downloadedAt`, gravado por
  `resultController.downloadPdf` no primeiro acesso bem-sucedido), o reembolso não fica mais
  disponível nem no backend nem na tela — sem essa trava a conta ficaria com o PDF **e** o
  dinheiro de volta. Na tela de Resultados, o botão "Pagar R$ X e baixar PDF" virou um "Exportar"
  com ícone de cadeado que abre um diálogo explicando a cobrança (o que libera, que vale pra
  sempre, o valor, que é processado pelo Mercado Pago) antes de redirecionar ao checkout.
- **Cobrança pela exportação em PDF**: baixar o PDF da apuração (Etapa 11) agora exige uma cobrança
  aprovada por sessão — paga uma vez, libera o download daquela sessão pra sempre. Integração com
  o **Mercado Pago** (Checkout Pro) via chamadas diretas à API REST deles
  (`backend/src/services/mercadopago.service.js`, com `fetch` nativo do Node — sem SDK novo como
  dependência), no mesmo padrão de serviço externo já usado pro Resend (`email.service.js`):
  `MERCADOPAGO_ACCESS_TOKEN`/`BACKEND_URL` opcionais na subida do servidor, só exigidas na hora de
  criar uma cobrança de verdade. Novo model `Payment` (`prisma/schema.prisma`) guarda cada
  tentativa (`PENDING`/`APPROVED`/`REJECTED`) por sessão; `payment.service.js` cria a preference
  (`POST /api/sessions/:id/payment`) e expõe o status pro front (`GET /api/sessions/:id/payment`);
  `POST /api/payments/webhook` (rota pública) recebe a notificação do Mercado Pago e sempre
  reconsulta o pagamento na API deles antes de aprovar — nunca confia no status que vem no corpo da
  notificação. Gate em `result.controller.js downloadPdf` (402 `PAYMENT_REQUIRED` sem pagamento
  aprovado). Na tela de Resultados, o botão "Baixar PDF" vira "Pagar e baixar PDF" (com o preço,
  `SESSION_RESULTS_PRICE_CENTS`, padrão R$ 9,90) enquanto a sessão não tem pagamento aprovado;
  pagar redireciona pro Checkout Pro e a volta (`back_urls`) cai de novo em `/resultados` com
  `?payment=success|pending|failure`, recarregando o status. **Ainda não validado ponta a ponta**:
  depende de uma conta/credenciais reais do Mercado Pago (sandbox), que o projeto ainda não tem —
  ver `ROADMAP.md`.
- **Exportar resultado da apuração em PDF**: novo botão "Baixar PDF" na tela de Resultados, pra
  dar pra professora/responsável um relatório pronto pra impressão/mural da escola — hoje só dava
  pra tirar print da tela. Gerado no **backend** com `pdfkit` (puro JS, sem Chromium/Puppeteer —
  imagem Docker continua enxuta), reaproveitando os dados que `resultService.getBySession` já
  calcula (vencedores, percentuais, 2º turno), sem nenhuma lógica de apuração nova.
  Novo endpoint `GET /api/sessions/:id/results/pdf` (autenticado, mesmas travas de dono/sessão
  finalizada de `/results`); nome do arquivo decidido pelo backend
  (`apuracao-<slug-da-sessão>-<ano>.pdf`) e lido do `Content-Disposition` no frontend.
  Relatório dividido em **3 partes, cada uma começando numa página nova** em vez de empilhar tudo
  em sequência (`backend/src/reports/results-pdf.js`):
  1. **Detalhes da eleição** — instituição, nome/ano da sessão, resumo em 4 cards (cargos, votos,
     votos válidos, candidatos — cada um com uma faixa de cor diferente) e o aviso de quais cargos
     vão pro 2º turno, se houver.
  2. **Candidatos eleitos** — vitrine própria, maior, separada da Parte 1: um card por eleito
     (foto grande, cargo, nome, partido/número, votos/%); um único eleito vira um card-herói na
     largura toda, mais de um usa grade de 2 colunas (empate em 1º lugar = um card por empatado);
     sem eleitos ainda, mostra um aviso em vez de ficar vazia.
  3. **Resultado por cargo** — a tabela completa de ranking por cargo (foto, nome, partido,
     número, votos, %, barra proporcional, chip de eleito/2º turno, `status INACTIVE` com sufixo)
     e a barra 100% empilhada de válidos/brancos/nulos, fechando com "Como ler este relatório".

  Cada parte abre com um cabeçalho pequeno ("Parte 1 de 3 · ...", cor própria) pra ajudar na
  navegação. Marca d'água da logo da urnalab (bem clara, atrás do conteúdo) em toda página, e um
  selo circular da mesma logo no cabeçalho — reaproveita o PNG que já existia em
  `frontend/public/img/urnalab-logo.png` (copiado pra `backend/src/reports/assets/`, já que o
  Dockerfile do backend só empacota `src`). Foto de candidato só é embutida quando é um arquivo
  local `.jpg`/`.png` (`photoStorage.read`); `.webp`, URL remota ou arquivo ausente caem pro
  monograma de iniciais — nunca derruba a geração do PDF.
- **Código de votação com 4 dígitos (em vez de hash)**: o link público de votação
  (`/votar/:token`) agora usa um código curto de 4 dígitos (`generateSessionCode`, `utils/id.js`),
  fácil de digitar ou ditar em voz alta, em vez do token longo em base64url de antes. Como só há 10
  mil combinações, colisão é esperada: `withUniqueSessionCode` (`session.service.js`) sorteia de
  novo até achar um código livre, tanto na criação da sessão quanto no "self-heal" de sessões
  antigas sem token. O token opaco e longo original (`generatePublicToken`) continua existindo e é
  usado só pelo reset de senha, onde um código curto seria adivinhável. A tela da sessão
  (`SessionDetails.jsx`) agora destaca o código em si, além do link completo, pra facilitar a
  digitação manual. Sessões já existentes mantêm o token antigo até trocarem — sem migração de
  banco, já que a coluna continua `TEXT`.
- **Captura de foto corrigida (sem distorção entre dispositivos)**: `PhotoCaptureField.jsx`
  (usado no cadastro de Pessoas) agora sempre captura um **quadrado**, recortado do centro do
  quadro nativo da câmera (`video.videoWidth`/`videoHeight`), em vez de esticar o retângulo
  inteiro pra um 320x240 fixo. Antes, como a câmera quase nunca devolve exatamente 320x240 (webcam
  de notebook costuma ser 16:9; celular, outra coisa), a foto saía espremida/distorcida de um
  jeito diferente em cada aparelho — e ainda era recortada de novo na exibição, já que a foto
  sempre aparece como círculo (`CandidateAvatar`, `object-cover`). Como o destino final é sempre
  circular, capturar em quadrado elimina a distorção em qualquer câmera: a prévia ao vivo também
  virou quadrada (`aspect-square`, antes `aspect-[4/3]`), então o que a pessoa vê enquadrando o
  rosto é exatamente o que é salvo. Captura agora em 480x480 (antes 320x240), ainda bem abaixo do
  limite de tamanho (`PHOTO_MAX_BYTES`, 300KB). Validado com câmeras sintéticas 16:9 e 9:16 via
  Playwright, confirmando matematicamente o recorte central nos dois sentidos.
- **Upload de foto a partir do dispositivo**: `PhotoCaptureField.jsx` (cadastro de Pessoas) ganhou
  um botão "Fazer upload", permitindo escolher um arquivo de imagem do computador/celular como
  alternativa à webcam e ao link http(s) já existentes. Passa pelo mesmo recorte central quadrado
  (480x480) e pela mesma validação de tamanho (`PHOTO_MAX_BYTES`) do restante do fluxo de foto —
  nenhuma regra nova, só mais uma fonte de imagem de entrada.
- **Duplicar sessão**: botão "Duplicar" em `SessionDetails.jsx` (qualquer status) abre um dialog
  (`DuplicateSessionDialog.jsx`) com nome/ano da sessão nova e a lista de candidatos **ativos**
  da sessão de origem, cada um com checkbox marcada por padrão — pensado pro caso de eleições que
  se repetem com o mesmo elenco (ex.: representante de turma todo mês): a professora desmarca só
  quem já foi eleito da vez passada e não concorre de novo. Novo endpoint
  `POST /api/sessions/:id/duplicate` (`sessionService.duplicate`) cria a sessão nova em rascunho
  com os mesmos cargos da original e, pra cada candidato marcado, uma candidatura nova nela —
  reaproveitando `sessionService.create`/`candidateService.create` já existentes, sem duplicar
  nenhuma validação. Partido/pessoa/cargo não são duplicados (já são cadastros por conta, não por
  sessão); se o partido de algum candidato ficou inativo desde a eleição original, ele é pulado
  automaticamente em vez de travar a operação inteira, e o toast final avisa quantos foram
  copiados e quais ficaram de fora (e por quê). A sessão de origem nunca é alterada.
- **Trava ao remover cargo de uma sessão com candidato cadastrado**: `PUT /api/sessions/:id`
  agora recusa (`SESSION_POSITION_HAS_CANDIDATES`) tirar um cargo de `positions` enquanto ainda
  houver candidato `ACTIVE` vinculado a ele naquela sessão — evita candidato "órfão" (ativo, mas
  que a votação nunca pergunta por ele, já que só pergunta pelos cargos habilitados). A mensagem
  nomeia o(s) cargo(s) bloqueado(s) e já aparece no campo certo do formulário de edição de sessão.
- **Proposta de governo do candidato**: campo opcional (textarea, até 2000 caracteres) na
  candidatura (`POST`/`PUT /api/candidates`), onde o candidato descreve seus planos para o
  mandato. Não é uma identidade do candidato — pode ser preenchido ou alterado mesmo depois que a
  votação abre, só travando quando a sessão é finalizada (migração
  `add_candidate_government_proposal`). Nova ação "Ver proposta" na tabela de Candidatos. Novo
  endpoint público `GET /api/public/sessions/:token/candidates` (só candidatos ativos, só os
  campos já expostos em outro lugar da votação pública: nome, foto, partido e proposta) alimenta
  um seletor de candidatos na própria tela de votação (ver item abaixo).
- **Votação pública redesenhada**: a tela de votação autenticada (`/votacao`) foi removida —
  votar, mesmo testando como administrador, passa a ser sempre pelo link público (`/votar/:token`,
  já existente); o botão "Votar" em `SessionDetails.jsx`/`SessionCard.jsx` agora abre esse link em
  vez da rota interna. Essa tela, por ser o coração da aplicação (é nela que a votação de verdade
  acontece), ganhou um visual mais organizado: cabeçalho fixo com a marca e o nome da sessão, uma
  barra de progresso com uma "pílula" por cargo (votado / atual / a votar, em vez de só "cargo 2 de
  4" em texto), um visor de dígitos escuro lembrando o de uma urna de verdade, teclado com
  "Branco"/"Corrige" em cores próprias pra se diferenciar dos números à primeira vista, e um anel
  colorido (verde/coral/amarelo) ao redor do painel do candidato indicando o resultado da consulta
  sem precisar ler o texto. O layout é em três colunas no desktop (empilha no celular): logo +
  dados da sessão + um seletor de candidatos com a proposta de governo logo abaixo (substituiu o
  antigo botão/dialog "Ver candidatos", que cobria a cédula) na coluna 1, a cédula/teclado na
  coluna 2, e a prévia do candidato digitado na coluna 3 — assim a cédula nunca some de vista
  enquanto se consulta uma proposta. A tela de "voto computado" também ganhou uma mensagem de
  fechamento ligada à proposta educacional do projeto (promover cidadania nas escolas). O
  cabeçalho tem um botão de tela cheia (mesma função que existia na antiga tela autenticada). O
  contêiner da página ficou mais largo (até 1440px, antes 1152px) com menos padding lateral no
  desktop, pra sobrar menos moldura vazia em monitores grandes/projetor de sala. O botão flutuante
  "Enviar feedback" (global no resto do app) some nessa tela — o feedback já é pedido depois do
  voto, na própria tela de "voto computado" (`PostVoteFeedback`).
- **Trava ao remover cargo de uma sessão com candidato cadastrado**: `PUT /api/sessions/:id`
  agora recusa (`SESSION_POSITION_HAS_CANDIDATES`) tirar um cargo de `positions` enquanto ainda
  houver candidato `ACTIVE` vinculado a ele naquela sessão — evita candidato "órfão" (ativo, mas
  que a votação nunca pergunta por ele, já que só pergunta pelos cargos habilitados). A mensagem
  nomeia o(s) cargo(s) bloqueado(s) e já aparece no campo certo do formulário de edição de sessão.
- **Validação e Feedback (Etapa 10)**: analytics de uso e feedback contextual, estendendo a
  Área de Gerenciamento (Etapa 9). *Analytics* (`POST /api/analytics/events`, público, sem
  nenhum dado pessoal): cada navegação grava um evento (`PAGE_VIEW`, `SESSION_CREATED`,
  `CANDIDATE_REGISTERED`, `VOTING_STARTED`, `VOTING_COMPLETED`, `RESULTS_VIEWED`) identificado só
  por um `visitorId` anônimo (UUID em `localStorage`, nunca ligado a nome/e-mail/conta) —
  `GET /api/admin/analytics/funnel` (nova tela `/admin/analytics`) mostra quantos visitantes
  únicos passam por cada etapa, páginas mais acessadas e origem dos visitantes. *Feedback*: botão
  flutuante "Enviar feedback" em toda a aplicação (`POST /api/feedback` autenticado,
  `POST /api/public/feedback` anônimo na votação pública) com tipo (Sugestão/Problema/Dúvida/
  Outro) e mensagem, mais uma pergunta opcional de 1-5 estrelas ao concluir uma votação. Fica
  vinculado ao `userId` quando enviado de dentro da área autenticada; sempre anônimo na votação
  pública. Nova tela `/admin/feedback` lista e filtra por tipo/status, com mudança de status
  (Novo/Em análise/Resolvido/Ignorado) — única escrita cross-tenant nova da Área de Gerenciamento
  até agora (era só leitura), registrada em `AdminAccessLog` como as demais.
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

### Fixed

- **Criação de sessão de 2º turno falhava**: `resultService.createRunoffSession`
  (`result.service.js`) chamava `sessionRepository.create` direto, sem passar `publicToken` —
  campo obrigatório e único desde que o link público de votação foi implementado. O Prisma
  rejeitava a criação por faltar esse campo, então toda tentativa de gerar o 2º turno de uma
  eleição sem maioria absoluta falhava (bug preexistente, não introduzido pela mudança do código de
  4 dígitos acima — só não tinha sido notado até agora). Corrigido reaproveitando o mesmo helper
  `withUniqueSessionCode` (agora exportado de `session.service.js`) pra gerar um código único
  também para a sessão nova do 2º turno.
- **Candidatura recriada sem a proposta de governo (2º turno e "Duplicar sessão")**: tanto
  `resultService.createRunoffSession` quanto `sessionService.duplicate` recriam a candidatura
  copiando partido, pessoa, cargo e número, mas nenhum dos dois incluía `governmentProposal` —
  campo adicionado depois que esse código de cópia já existia, então ficou de fora e a proposta
  cadastrada no 1º turno (ou na sessão de origem) se perdia ao gerar a cópia. Corrigido nos dois
  lugares: `createRunoffSession` agora repassa `original.governmentProposal` ao criar o candidato,
  e `duplicate` repassa `candidate.governmentProposal` na chamada de `candidateService.create`.
- **Logo/imagens em `public/img/` não atualizavam depois do deploy**: essas imagens mantêm o
  mesmo nome de arquivo pra sempre (a logo, em especial, precisa — é embutida como URL fixa nos
  e-mails transacionais, `backend/src/services/email.service.js`), então, sem nenhum
  `Cache-Control` explícito, o navegador podia continuar usando a versão antiga guardada em cache
  indefinidamente mesmo depois de um deploy novo trocar o arquivo no servidor — o sintoma: trocar
  a logo localmente funcionava, mas em produção (Railway) continuava aparecendo a antiga.
  `frontend/nginx.conf.template` ganhou um `location /img/` com `Cache-Control: no-cache`, que
  obriga o navegador a sempre revalidar (barato — vira um `304 Not Modified` quando o arquivo não
  mudou) em vez de usar a cópia em cache sem perguntar. Validado rodando o template real num
  nginx local: a resposta sai com o header novo, os headers de segurança continuam presentes
  (precisam ser repetidos no `location` — `add_header` não herda do bloco `server` quando o
  `location` define os seus próprios), e uma requisição condicional com o `ETag` certo já
  devolve `304`.

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

### Fixed

- **`scripts/seed.js` quebrado desde a Etapa 8.3**: `npm run seed` falhava com
  `INSTITUTION_PROFILE_REQUIRED` ao criar a sessão demo — o script nunca foi atualizado depois que
  perfil de instituição passou a ser exigido antes de criar uma sessão. Mais dois problemas
  apareceram ao corrigir isso: (1) a conta demo, criada via `authService.register`, nunca era
  confirmada (`emailVerifiedAt` nulo) — uma segunda execução do seed caía em
  `authService.login`, que exige e-mail confirmado, e falhava com `EMAIL_NOT_VERIFIED`; agora o
  script confirma a conta direto no banco (não passa pelo Resend, então não faz sentido exigir o
  fluxo real de confirmação aqui). (2) o script nunca limpava os dados da execução anterior no
  Postgres — só zerava uns arquivos `.json` que não são mais lidos por nada desde a migração para
  o Postgres —, então a segunda execução sempre falhava tentando recriar os mesmos partidos
  (mesmo número/sigla) para uma conta que já os tinha. `clearPreviousDemoData` agora apaga a conta
  demo de uma execução anterior (se houver) antes de recriar tudo — o `onDelete: Cascade` em toda
  relação de `User` já leva partidos/pessoas/candidatos/sessões/votos/pagamentos junto. Rodar
  `npm run seed` várias vezes seguidas agora é seguro.

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
