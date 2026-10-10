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

### Etapa 12 — Cobrança pela exportação em PDF

- [x] 12.1 — Integração com Mercado Pago (Checkout Pro), model `Payment`, gate no download do PDF
  e tela de Resultados com o fluxo de pagamento (2026-10-07, ver `CHANGELOG.md`).
- [ ] 12.2 — Validar o fluxo ponta a ponta com uma conta/credenciais reais do Mercado Pago
  (sandbox): criar `MERCADOPAGO_ACCESS_TOKEN` de teste, configurar `BACKEND_URL` publicamente
  alcançável (o webhook não funciona com `localhost`) e conferir que o webhook aprova o
  pagamento e libera o PDF de verdade.

---

### Etapa 19 — Verificação em duas etapas na Área de Gerenciamento

Camada extra sobre a já existente (ADMIN_EMAIL + shell próprio, Etapas 16 e 18): mesmo
logada como a conta admin, a entrada em `/gerenciamento*` agora também exige confirmar um
código de 6 dígitos mandado por e-mail — "algo que a conta sabe" (senha) deixa de ser
suficiente sozinho, precisa também de "algo que só o dono do e-mail recebe".

- [x] 19.1 — Backend: model `AdminVerificationCode` (mesmo desenho de
  `EmailVerificationCode` — código só em hash sha256, expiração, limite de tentativas),
  `POST /api/admin/verify/request` (manda o código, cooldown de reenvio) e
  `POST /api/admin/verify/confirm` (valida e devolve um token à parte, escopo
  `admin-verified`, válido por 60 min) — as duas únicas rotas `adminOnly` que não exigem
  esse token pra rodar (`skipAdminVerification`, ver `utils/router.js`/`server.js`). Toda
  outra rota `/api/admin/*` passa a exigir esse token (header `X-Admin-Verification`),
  além do JWT normal já exigir ADMIN_EMAIL (2026-10-08, ver `CHANGELOG.md`).
- [x] 19.2 — Frontend: `AdminVerificationGate.jsx` — ao entrar em `AdminLayout`, manda o
  código automaticamente e pede confirmação antes de mostrar qualquer página admin; o
  token fica só em `sessionStorage` (nunca localStorage), então expira sozinho ao fechar
  a aba — sem sessão nova guardada no servidor pra isso (2026-10-08).
- [ ] 19.3 — Validar o fluxo completo pela UI de verdade, logado como a conta admin real
  (login + e-mail de verdade): o ciclo request→401 sem token→confirm→200 com token, e a
  rejeição de token com escopo errado, já foram validados ponta a ponta por HTTP numa
  instância descartável com `ADMIN_EMAIL` apontado pra uma conta de teste — só falta o
  clique na tela de verdade (`AdminVerificationGate.jsx`) e o e-mail chegando na caixa de
  entrada real, que dependem de login que a IA não tem acesso.

---

### Etapa 23 — Apresentação automática dos candidatos com Text-to-Speech

Um botão na própria tela de votação pública (`PublicVoting.jsx`) abre um dialog que apresenta os
candidatos da sessão um por vez, em card grande (foto, número, nome, proposta), lendo cada um em
voz alta automaticamente antes do eleitor começar a votar.

Levantado no Teste de Usabilidade em Campos de 2026-10-08. Refinado em 2026-10-08: a ideia
original era uma tela própria (`/apresentacao/:sessionId`); virou um dialog disparado por um
botão na tela de votação, reaproveitando os candidatos que `PublicVoting.jsx` já busca
(`candidatesState.data`, todos os cargos da sessão de uma vez) — **sem endpoint novo no backend**,
essa etapa é 100% frontend.

**Pesquisa de TTS (2026-10-08)** — a pergunta foi se existe "IA TTS grátis com API pra leitura em
pt-BR". Resposta: a melhor opção pra esse caso **não é uma API de IA paga** (Google Cloud TTS,
Azure Speech, AWS Polly, ElevenLabs — todas têm camada grátis limitada, mas exigem conta, chave de
API e faturamento configurado, complexidade desproporcional pra um botão de "ouvir os
candidatos"), e sim a **Web Speech API** (`window.speechSynthesis`), nativa do navegador:

- Sem custo, sem chave, sem backend, sem limite de uso — roda 100% no navegador do eleitor.
- No Chrome/Edge (o navegador mais comum em Chromebook/laboratório de escola), as vozes "Google
  português do Brasil" disponíveis via `speechSynthesis.getVoices()` já são de qualidade neural
  (o mesmo motor do Google Cloud TTS, só que de graça pelo navegador) — dá pra escolher uma delas
  explicitamente em vez de deixar a voz padrão do SO.
- Limitação conhecida: a lista de vozes carrega de forma assíncrona (evento `voiceschanged`) e
  varia por navegador/SO/dispositivo — em alguns (Firefox em Linux sem voz pt-BR instalada, por
  exemplo) pode não ter nenhuma voz em português disponível; precisa de um fallback (mostrar o
  texto normalmente, com um aviso de que a leitura em voz alta não está disponível nesse
  navegador) em vez de quebrar a funcionalidade.

- [ ] 23.1 — Frontend: `CandidatePresentationDialog.jsx` — dialog (não uma rota nova) com um card
  grande por candidato (foto grande, número em destaque, nome, proposta), percorrendo todos os
  candidatos da sessão agrupados por cargo (cabeçalho "Presidente", depois cada candidato a
  Presidente, depois "Governador"...). Controles de pausar/retomar, avançar/voltar manualmente e
  fechar (que também interrompe a leitura em andamento).
- [ ] 23.2 — Integração com a Web Speech API: ao exibir cada candidato, monta um
  `SpeechSynthesisUtterance` (`lang = 'pt-BR'`, voz pt-BR escolhida de `getVoices()` quando
  disponível) lendo cargo (quando muda), número, nome e proposta; ao terminar de falar
  (`utterance.onend`), avança sozinho pro próximo candidato após uma pequena pausa. Trata o caso
  de `speechSynthesis` indisponível ou sem voz pt-BR (mostra o card normalmente, só sem a leitura
  automática, com um aviso).
- [ ] 23.3 — Botão "Apresentar candidatos" (com ícone, ex.: `Volume2`/`Megaphone`) na tela de
  votação pública, visível antes/durante a votação, que abre o dialog da 23.1.

---

## Ideias futuras

Lista de possíveis próximos passos, sem compromisso nem ordem — um banco de ideias pra escolher o
que estudar a seguir. Quando uma ideia daqui vira trabalho de verdade, ela sobe pra seção "Em
andamento" acima como uma Etapa nova.

### Produto e conteúdo educacional

- **Importação em massa de candidatos/partidos (CSV)**: hoje é tudo cadastro manual, um por um —
  pesa pra eleições com muitos candidatos (grêmio de escola grande, por exemplo). Essa
  funcionalidade será um recurso premium, cobrado por importação — o sistema de produtos genérico
  (`Product`, Etapa 15) já dá a base pra isso: bastaria um novo produto `kind` "por conta" (como o
  `EBOOK` da loja), sem precisar de assinatura mensal (que ainda não existe, ver "Resultados e
  relatórios" abaixo).

### Contas e multiusuário

- **Papéis de acesso**: admin (gerencia sessões/partidos/candidatos), mesário (opera a urna),
  eleitor (só vota) — hoje qualquer pessoa com acesso à API faz tudo. Por enquanto, cada conta
  tem controle total só sobre os próprios dados, sem papéis dentro dela.
- **Convite/compartilhamento de eleição**: permitir que mais de uma conta administre a mesma
  sessão (útil para simular uma comissão eleitoral). Depende de papéis de acesso pra fazer
  sentido: hoje uma sessão pertence a uma única conta.
- **Convite de colaborador por e-mail**: reaproveitaria o Resend já integrado
  (`email.service.js`, Etapa 8) pra mandar um link de convite pra outra conta entrar numa sessão
  como colaboradora. Só faz sentido depois de papéis de acesso existir.
- **Logo da instituição no perfil**: `InstitutionProfile` (Etapa 8.3) hoje só guarda texto —
  acrescentar um upload de logo (reaproveitando `photo-storage.js`, já usado pra foto de
  candidato) daria identidade visual própria pra cada eleição na cédula e nos resultados, além do
  UrnaLab.
- **Avatares mais dinâmicos e lúdicos**: pedido em 2026-10-08, pesquisado e implementado no mesmo
  dia — ver `CHANGELOG.md` ("Avatares prontos no campo de foto, no lugar do link", Etapa 20) pelo
  resultado final (DiceBear, 5 estilos, lazy-load por estilo, "Sortear de novo").

### Dados e infraestrutura

- **Backup/restore**: comando para exportar/importar o estado completo de uma eleição (hoje só
  existe `npm run seed`, que sempre recria do zero).
- **Paginação** nas listagens (`/api/candidates`, `/api/votes` se virar endpoint): hoje tudo é
  carregado de uma vez, o que não escala para uma eleição com muitos votos.
- **Liberar/reciclar os códigos curtos dos links públicos (votação e candidatura)**: levantado em
  2026-10-08, pensando em uso de longo prazo. Hoje `Session.publicToken` (4 dígitos, 10 mil
  combinações) e `Session.candidacyToken` (4 letras maiúsculas, ~457 mil combinações) nunca são
  liberados — ficam reservados pra sempre na sessão, mesmo depois de finalizada. Isso não é um bug
  (o banco garante unicidade e nunca há ambiguidade sobre a qual sessão um código pertence — ver
  discussão na Etapa 20), mas com o tempo o espaço de 10 mil códigos de votação tende a esgotar.
  Como a constraint é `@unique`, não `NOT NULL`, "liberar" é só zerar o campo — o gerador que já
  existe (`withUniqueSessionCode`/`withUniqueCandidacyCode`, `session.service.js`) já sorteia de
  novo em caso de colisão, então um código zerado já volta a ser sorteável sem nenhuma lógica
  extra. Revisitado em 2026-10-10 com um plano em duas frentes:
  - **Mitigação imediata (barata, sem migração)**: subir `generateSessionCode` (`utils/id.js`) de 4
    para 6 dígitos — 10 mil → 1 milhão de combinações, ainda só dígitos (fácil de digitar/ditar em
    voz alta, sem a ambiguidade visual/sonora que letras introduziriam). Aproveitar pra trocar o
    erro cru do Prisma que `withUniqueCode` relança hoje quando `MAX_CODE_ATTEMPTS` esgota por um
    `AppError` de negócio (`serviceUnavailable('SESSION_CODE_EXHAUSTED', ...)`, já existe em
    `utils/errors.js`, mesmo 503 já usado pra falha de gateway do Mercado Pago). Convive sem
    problema com códigos de 4 dígitos já emitidos — campo é `String` sem tamanho fixo no banco.
  - **Correção estrutural (a de verdade)**: `candidacyToken` dá pra zerar sem contrapartida nenhuma
    dentro de `sessionService.open()` — ele só serve durante `DRAFT`, então nada depende dele depois
    desse ponto. `publicToken` é mais delicado: hoje o mesmo link `/votar/:token` serve pra votar
    (`OPEN`) *e* pra ver o resultado depois (`PublicVoting.jsx` mostra o resultado quando
    `status === FINISHED`, no mesmo link) — zerar esse token ao finalizar quebraria o link de
    resultado de quem compartilhou/guardou ele. Pra resolver, precisa separar isso antes: um
    `resultsToken` novo (longo e opaco, tipo o `generatePublicToken()` já usado no reset de senha —
    não precisa ser curto/memorizável, só é clicado, nunca digitado) nasce quando a sessão finaliza
    (`session.resultsToken ?? generatePublicToken()`, nunca sobrescrevendo um já existente — um
    `resume()`→`finish()` não pode invalidar um link já compartilhado) e vira o link de resultado
    pra sempre, servido por uma rota pública nova (`GET /api/public/results/:token`,
    `findByResultsToken` em `session.repository.js`) e uma página própria no frontend
    (`/resultado/:token`, reaproveitando a renderização de resultado já existente em
    `PublicVoting.jsx` via componente extraído, ex. `PublicResultsView`). Retrofit pras sessões já
    finalizadas sem esse token: lazy-on-read em `withStats`, mesmo padrão já usado pros outros dois
    tokens — sem script de backfill. Só depois disso — e só depois de validado em produção —
    `publicToken` pode ser zerado em `finish()` sem quebrar nada; **não fazer isso no mesmo deploy**
    do `resultsToken`: zerar no instante exato da finalização quebraria a própria aba que está
    exibindo a votação ao vivo naquele momento (ela faz polling pelo `publicToken`) — a aba
    precisaria primeiro passar a depender do `resultsToken` antes de o `publicToken` sumir. Depois
    que a cobrança por compartilhar resultado (ver "Resultados e relatórios" abaixo) existir, a
    urgência de "proteger" o resultado zerando o token some — o resultado já passa a exigir
    pagamento (ou assinatura ativa) independente de qual dos dois links for usado.

### Segurança e integridade

- **Pagamento com valor divergente fica travado sem alerta**: levantado numa revisão de código da
  Etapa 13. Se `mpPayment.transaction_amount` divergir do `amountCents` cobrado,
  `payment.service.js confirmPayment` recusa aprovar (correto) mas o `Payment` fica `PENDING` pra
  sempre, só com um `console.error` — sem sinal pro admin, sem caminho de recuperação além de
  mexer no banco direto. Não é explorável hoje (o preço é definido só pelo servidor), mas merece
  algum tipo de alerta/visibilidade quando existir infraestrutura pra isso (ver "Logs
  estruturados"/"Métricas básicas" em Operação, abaixo).
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
- **Política de privacidade / LGPD**: o sistema já guarda nome, e-mail e dados da instituição de
  pessoas reais (desde a Etapa 8). Conforme o uso cresce, vale ter uma página de privacidade
  pública e um jeito self-service de excluir a própria conta e os dados associados — hoje isso só
  dá pra fazer direto no banco. Quando essa página existir, precisa citar a Área de Gerenciamento
  (Etapa 9) e o analytics de uso (Etapa 10 — id anônimo de visitante em `localStorage`, nunca
  ligado a nome/e-mail) como finalidades de tratamento: monitoramento agregado de uso do sistema
  pelo administrador.
- **Log de atividade administrativa**: só o voto (`utils/hash.js`) e o acesso à Área de
  Gerenciamento (`AdminAccessLog`, Etapa 9) têm registro auditável hoje. Quem criou, editou ou
  excluiu um cargo, partido, pessoa ou candidato não fica registrado em lugar nenhum — útil pra
  investigar problema ou uso indevido de uma conta colaborativa (ver convite de colaborador,
  acima).

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
- **Contagem de votos em tempo real**: quem acompanha uma sessão aberta hoje precisa atualizar a
  página pra ver o progresso. Um contador simples ("quantos votos já foram registrados", sem
  revelar em quem) via polling já resolveria, sem precisar de WebSocket.
- **PWA instalável**: o uso principal do link público é votar pelo celular — um manifest + ícone
  deixaria instalável, com cara de app em vez de aba do navegador.
- **Modo escuro**: o sistema de cores já é todo por token CSS (`styles/globals.css`,
  `@theme inline`) — então dar um tema escuro seria "só" definir os mesmos tokens em
  `prefers-color-scheme: dark`, sem tocar em nenhum componente.

### Resultados e relatórios

- **Exportar resultado em PDF/imagem**: subiu pra "Em andamento" como Etapa 11.
- **Cobrança pela exportação em PDF**: subiu pra "Em andamento" como Etapa 12. O modelo "por sessão"
  (paga uma vez, baixa quantas vezes quiser) e o sistema de cobrança genérico por trás dele (model
  `Product`, Etapa 15) já existem — é o que a loja de materiais didáticos (Etapas 15/16) usa pra
  vender produtos "por conta", sem sessão envolvida.
- **Cobrança por compartilhar resultado publicamente**: levantado em 2026-10-10, junto com o
  `resultsToken`/rota `/resultado` descritos em "Dados e infraestrutura" acima. Hoje qualquer pessoa
  com o link (antigo ou o novo, quando existir) vê o resultado de graça, sem login — a ideia é que
  nenhum acesso público ao resultado funcione sem a sessão ter sido paga antes (ou a conta ter
  assinatura ativa, ver item abaixo). Reaproveita o sistema de produtos genérico: novo
  `PRODUCT_KIND.RESULT_SHARE` + produto fixo por id (`RESULT_SHARE_PRODUCT_ID`, mesmo padrão de
  `SESSION_EXPORT_PRODUCT_ID`), e generaliza o `if` binário de `scopeForProduct`
  (`payment.service.js`) pra um conjunto de kinds "por sessão" (já deixando espaço pra outras
  features premium por sessão no futuro, ex. a importação de CSV citada acima). O gate fica num
  ponto só dentro de `public-voting.service.js` (`getResultsForSession`), reaproveitado tanto pela
  rota antiga (`/api/public/sessions/:token/results`) quanto pela nova — então vale pros dois links
  igual. Sessões já finalizadas antes dessa mudança existir precisam de uma migração de
  "grandfathering": inserir um `Payment` `APPROVED` de R$0 pro produto novo em cada sessão já
  `FINISHED` — assim o `isPaidFor` já existente resolve sozinho, sem nenhuma condicional de data
  espalhada pelo código. UI espelha o botão/diálogo já existente de compra do PDF (`SessionDetails`
  → aba Resultados).
- O que falta de verdade pra fechar o ciclo é um modelo de **assinatura mensal** (cobrança
  recorrente) pensado pra a escola assinar e liberar de uma vez as funcionalidades pagas por sessão
  (PDF + compartilhamento de resultado acima, e futuras premium por sessão) — **sem** cobrir os
  produtos avulsos da Loja (ebooks continuam comprados separados). Hoje só existe cobrança avulsa;
  Mercado Pago (Checkout Pro) continua o gateway decidido pra pagamento único, mas assinatura precisa
  da API de **preapproval** do Mercado Pago, nunca integrada aqui — maior risco técnico da ideia,
  precisa validar em sandbox os nomes de campo (`auto_recurring`, `back_url`) e os eventos de webhook
  de assinatura antes de implementar (é possível até que cada cobrança recorrente mensal chegue como
  um evento de pagamento comum, não como evento de preapproval — precisa confirmar). Desenho: novo
  model `Subscription` (1:1 com a conta; status `PENDING/ACTIVE/PAST_DUE/CANCELED`;
  `mpPreapprovalId`; `currentPeriodEnd`) + `SubscriptionPlan` (preço editável, singleton) — **não**
  reaproveitar `Product`/`Payment` pra isso, o ciclo de vida de recorrência (pausa, cancelamento,
  renovação) não cabe no modelo "paga uma vez, libera pra sempre" que `Payment` já é. Checagem de
  "assinatura ativa" é só leitura, sem cron (`status === ACTIVE && currentPeriodEnd > now()`), mesmo
  idioma já usado em `paymentRepository.expireStalePending`; entra como um atalho "OR" nos dois gates
  por sessão acima (`isPaidFor(...) || subscriptionService.isActive(userId)`). UI própria (ideia:
  página "Plano" ao lado de "Financeiro" no menu da conta — assinar, ver status/vencimento,
  cancelar), fora da Loja de propósito, já que o escopo da assinatura e o da Loja são coisas
  diferentes.

### Notificações

O balão no menu do usuário (`lib/notifications.js`, Etapa 8.4) hoje só tem uma notificação
("complete o perfil da instituição"). Ideias de próximas:

- **Sessão aberta sem voto há muito tempo**: lembrete pra quem esqueceu de divulgar o link depois
  de abrir a votação.
- **Resultado disponível**: avisar assim que uma sessão é finalizada e a apuração fica pronta.
- **Convite pendente**: se a ideia de convite de colaborador (acima) sair do papel, o convite
  pendente apareceria aqui.

### Operação

- **Logs estruturados** (nível, timestamp, rota, duração) em vez de `console.log`/`console.error`
  soltos — ajuda a depurar problemas depois que o projeto sair do ambiente de estudo.
- **Métricas básicas**: contagem de votos por minuto, tempo de resposta da API — dá pra expor um
  painel simples de operação da eleição.

### Descrição do Cargo

- Adicionar um campo para descrição do cargo, onde detalha quais são os direitos, deveres e obrigações de cada cargo.

### Hierarquia

- Seria interessante poder criar hierarquias de cargos para entender a relação entre eles.
