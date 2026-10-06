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
- **Exportar resultado em PDF/imagem**: pra divulgar o resultado de uma eleição fora da
  aplicação (mural da escola, por exemplo) — hoje só dá pra tirar print da tela.

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

### Duplicar sessão (reaproveitar candidatos entre eleições)

Cenário motivador: a mesma sala de aula elege o representante de turma todo mês, sempre com a
mesma estrutura — os mesmos cargos, quase sempre os mesmos candidatos — e só precisa tirar do
páreo quem já foi eleito da vez passada. Hoje isso exige recadastrar cada candidatura na mão a
cada eleição nova, mesmo pessoa e partido já cadastrados.

**Por que duplicar, e não reabrir a sessão finalizada**: reabrir misturaria votos de duas rodadas
diferentes na mesma cadeia de hash/auditoria, e o modelo inteiro (`SESSION_STATUS`,
`startedAt`/`finishedAt`, resultado por sessão) pressupõe um evento fechado. Pedagogicamente
também é melhor manter um registro por mês (dá pra comparar resultado de um mês com o outro).
Duplicar cria uma sessão nova (rascunho) e preserva a antiga intacta.

**O que já é reaproveitável hoje, sem mudança nenhuma**: `Position`, `Party` e `Person` já são
cadastros por conta (`userId`), não por sessão — já valem pra qualquer eleição nova sem duplicar
nada. Só `Candidate` é por sessão (`sessionId` + `personId` + `partyId` + `position` + `number`).
Ou seja: duplicar sessão, na prática, é só (1) criar uma `Session` nova com os mesmos `positions`
e (2) recriar os registros de `Candidate` na sessão nova, sem tocar em pessoa/partido/cargo.

**Fluxo proposto**:

1. Botão "Duplicar" em `SessionDetails.jsx` (e opcionalmente em `SessionsTable`/`SessionCard`),
   disponível pra sessão em qualquer status (DRAFT/OPEN/FINISHED) — inclusive sem candidato
   nenhum, caso a professora só queira reaproveitar os cargos.
2. Abre um dialog novo (`DuplicateSessionDialog.jsx`) com campos **Nome** (padrão: nome da sessão
   original) e **Ano** (padrão: ano corrente), e uma lista dos candidatos **ACTIVE** da sessão
   original (via `api.candidates.list({ sessionId, status: 'ACTIVE' })`), cada um com checkbox
   marcada por padrão, mais "selecionar todos"/"nenhum". **É aqui, nessa lista, que a professora
   desmarca quem já foi eleito e não concorre de novo** — não precisa (e não dá: sessão FINISHED
   trava edição de candidato) editar a sessão antiga pra isso. Candidatos já INACTIVE na sessão
   original nem aparecem na lista — já saíram.
3. Ao confirmar, cria a sessão nova e, pra cada candidato marcado, uma candidatura nova nela.

**Backend**:

- Rota nova `POST /api/sessions/:id/duplicate`, corpo `{ name, year, candidateIds }`.
- `sessionService.duplicate(sourceId, { name, year, candidateIds }, userId)`:
  1. Carrega a sessão de origem (confere dono).
  2. Chama o `sessionService.create` já existente com
     `{ name, year, positions: source.positions }` — reaproveita toda validação atual (nome, ano,
     cargos, `INSTITUTION_PROFILE_REQUIRED`), sem duplicar lógica.
  3. Pra cada id em `candidateIds` que pertence à sessão de origem e está `ACTIVE`: busca o
     registro e chama `candidateService.create({ sessionId: novaSessao.id, partyId, personId,
     position, number }, userId)`. Se vier `CANDIDATE_PARTY_INACTIVE` (partido que era ativo na
     época e não é mais), pula esse candidato em vez de falhar a operação inteira — outros erros
     inesperados propagam normalmente.
  4. Retorna `{ session: novaSessao, copied: N, skipped: [{ name, reason }] }` pro frontend
     avisar quantos candidatos entraram e quais ficaram de fora (e por quê).
- Como a sessão nova nasce vazia, não existe risco de conflito de número (unicidade de número é
  por `sessionId` + `position`) — todo candidato copiado entra limpo.

**Frontend**:

- `api.sessions.duplicate(id, data)` em `services/api.js`.
- `DuplicateSessionDialog.jsx`: formulário nome/ano + lista de checkboxes dos candidatos ACTIVE
  da sessão de origem, agrupados por cargo (mesma ordem usada no resto do app). Ao salvar, navega
  pra tela da sessão nova (`/sessoes/:id`) já em rascunho, pronta pra revisar e abrir a votação.
- Toast resumindo o resultado ("6 candidatos copiados, 1 pulado — partido inativo"), se houver
  algum `skipped`.

**Trava de segurança (já implementada)**: ao editar os cargos (`positions`) de uma sessão em
rascunho, `sessionService.update` agora bloqueia remover um cargo que ainda tenha candidato
`ACTIVE` vinculado — sem isso, o candidato ficaria "órfão" (continua `ACTIVE`, mas inalcançável,
já que a votação só pergunta pelos cargos que sobraram em `positions`). O erro
(`SESSION_POSITION_HAS_CANDIDATES`) nomeia o(s) cargo(s) travado(s) ("Desative os candidatos de
Governador antes de remover esse cargo da sessão.") e já aparece no campo certo do formulário de
edição (`SessionForm.jsx` casa pelo substring `POSITION` do código, igual já fazia com
`SESSION_POSITION_INVALID`). Relevante pro fluxo de duplicar sessão acima: se a professora
reaproveitar os cargos mas decidir depois tirar um deles, primeiro precisa desativar quem foi
copiado pra ele.
