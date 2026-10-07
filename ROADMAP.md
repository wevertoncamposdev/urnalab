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

- **Dois turnos — casos de borda não cobertos**: a criação de sessão de 2º turno
  (`resultService.createRunoffSession`) já funciona pro caso comum (dois candidatos mais votados,
  sem empate), mas foi encontrada uma lista de lacunas numa revisão de código: (1) empate no 2º/3º
  lugar é quebrado só por ordem alfabética, sem indicar que houve empate nem avançar mais de dois
  candidatos; (2) nada impede criar mais de uma sessão de 2º turno pra mesma sessão original (não
  há campo ligando o runoff à sessão-mãe, nem trava no backend); (3) o nome da sessão nova sempre
  vira `"<nome> - 2º turno"`, então um 3º turno (teoricamente possível se o 2º turno também
  empatar) viraria `"- 2º turno - 2º turno"`; (4) a cópia de candidato pro 2º turno usa
  `candidateRepository.create` direto, sem passar pela validação de partido ativo que o resto do
  código (`candidateService.create`) sempre aplica.
- **Importação em massa de candidatos/partidos (CSV)**: hoje é tudo cadastro manual, um por um —
  pesa pra eleições com muitos candidatos (grêmio de escola grande, por exemplo). Essa funcionalidade será um recurso premium que precisa de assinatura mensal, ou cobrança por importação.

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

- **Gráfico visual na apuração**: `PositionResult.jsx` já mostra uma barra de progresso por
  candidato; um gráfico de pizza/barras consolidado por cargo ajudaria a enxergar o resultado de
  relance, principalmente em apresentação pra turma.
- **Exportar resultado em PDF/imagem**: subiu pra "Em andamento" como Etapa 11.
- **Cobrança pela exportação em PDF** (depende da Etapa 11 estar pronta e validada): Mercado Pago
  (PIX/boleto/cartão) como gateway. Modelo progressivo combinado com o usuário: começar cobrando
  por exportação avulsa (preço pequeno, baixo compromisso pra uso escolar ocasional), migrar
  depois pra cobrança por sessão/eleição (paga uma vez por eleição, baixa quantas vezes quiser
  depois) e, mais adiante, assinatura mensal (exportação ilimitada em todas as sessões da conta).
  Exige peças que hoje não existem: campo de plano/entitlement em `User` (nova migração), um
  service novo de integração com o gateway (mesmo padrão de API key via `config.js`/`.env` já
  usado por `email.service.js`/Resend) e um gate de acesso no controller do PDF.

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
