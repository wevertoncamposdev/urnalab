# Descrição das funções de cada cargo

## Contexto

Hoje `Position` só tem nome, dígitos, ordem e flag de 2º turno — não há onde explicar o que o
cargo faz. O pedido é um campo de descrição editável por cargo, com as descrições dos 7 cargos
padrão (Presidente, Governador...) já preenchidas, e acessível em toda tela que menciona um cargo
— incluindo a tela pública de votação.

Já existe um precedente de texto educativo pronto: `frontend/src/content/electoral-system.js`
(`POSITIONS_INFO[...].summary`) tem um parágrafo por cargo padrão, explicando as atribuições —
usado hoje só na página estática `/sistema-eleitoral`, desacoplado do cadastro real. Vou reaproveitar
esse texto como a descrição inicial dos 7 cargos padrão, em vez de escrever de novo.

## Backend

### Schema (`backend/prisma/schema.prisma`)

Adicionar `description String?` (nullable, sem default) ao model `Position`.

### Migração (`backend/prisma/migrations/<timestamp>_add_position_description/migration.sql`)

```sql
ALTER TABLE "positions" ADD COLUMN "description" TEXT;

UPDATE "positions" SET "description" = '<summary do Presidente>' WHERE "code" = 'PRESIDENTE' AND "description" IS NULL;
UPDATE "positions" SET "description" = '<summary do Governador>' WHERE "code" = 'GOVERNADOR' AND "description" IS NULL;
-- ... mesma UPDATE pra SENADOR, DEPUTADO_FEDERAL, DEPUTADO_ESTADUAL, PREFEITO, VEREADOR
```

Mesmo padrão já usado no projeto pra retroagir dados em contas já existentes dentro da própria
migração (ex. confirmação de e-mail). Cobre contas novas (via `DEFAULT_POSITIONS` atualizado,
abaixo) **e** contas que já existem hoje (demo, conta real) — desde que o `code` do cargo bata
com o padrão; cargo renomeado mas com `code` original ainda recebe a descrição (código nunca é
regenerado em `update`, ver `position.service.js`), cargo totalmente customizado continua sem
descrição, editável manualmente dali em diante.

### `backend/src/rules/position-rules.js`

Adicionar `descriptionMaxLength: 1000`.

### `backend/src/services/position.service.js`

Em `normalizeFields` (linhas 22-53): validar `description` como opcional — string, `trim()`,
vira `null` se vazia, erro `POSITION_DESCRIPTION_TOO_LONG` se passar de `descriptionMaxLength`.
**Atenção**: o `return` da função (linha 52, `return { label, digits, order, twoRoundEnabled }`)
é um objeto literal explícito — `description` precisa entrar nesse `return` também, senão é
descartado silenciosamente (mesmo problema que campos extras do `input` já sofrem hoje).

Em `update` (linhas 95-104): a base montada antes do merge (`{ label: current.label, digits:
current.digits, order: current.order, twoRoundEnabled: current.twoRoundEnabled, ...changes }`)
precisa incluir `description: current.description` — senão um update parcial que não toca
`description` apaga o valor existente.

`create` não precisa de mudança: já espalha `...data` bruto em `normalizeFields`.

### `backend/src/services/auth.service.js`

`DEFAULT_POSITIONS` (linhas 22-30) ganha `description` em cada uma das 7 entradas, com o mesmo
texto da migração (copiado de `POSITIONS_INFO[...].summary`). `seedDefaultPositions` já espalha
`...position`, não precisa de mudança.

### Três lugares que remontam `Position` manualmente (precisam do campo novo explicitamente — não herdam de graça)

- `backend/src/services/public-voting.service.js` (~linha 31): `{ code, label: rule?.label ??
  code, digits: rule?.digits ?? 0 }` → acrescentar `description: rule?.description ?? null`.
- `backend/src/services/public-candidacy.service.js` (~linha 52): mesmo ajuste.
- `backend/src/services/result.service.js`, função `tallyPosition` (~linhas 120-123): acrescentar
  `description: position.description ?? null` no objeto retornado.

`backend/src/repositories/position.repository.js` não precisa de mudança (sem `select`, tudo
passa automático pelas rotas `GET/POST/PUT /api/positions*`).

## Frontend

### Componente novo: `frontend/src/components/positions/PositionDescriptionButton.jsx`

`PositionDescriptionButton({ label, description, className })` — renderiza `null` se não houver
`description`; senão um botão ícone pequeno (`Info` do lucide-react, `variant="ghost" size="icon"`)
que abre um `Dialog` (reaproveitando o primitivo já existente — sem instalar Popover/Tooltip novo)
com `label` como título e `description` como corpo. Um componente só, reusado em todos os pontos
abaixo — inclusive nos dois formulários com `Select` de cargo, passado como parte do `label` do
`FormField` (que já aceita qualquer node, ver `components/ui/form-field.jsx`), em vez de hint —
evita o problema de uma descrição longa desalinhar o grid ao lado do campo "Número".

### `frontend/src/components/positions/PositionFormDialog.jsx`

Adicionar `Textarea` "Descrição (opcional)" — estado novo, incluído no payload de create/update.
Adicionar `['DESCRIPTION', 'description']` em `FIELD_RULES` (linha 13) — sem isso,
`POSITION_DESCRIPTION_TOO_LONG` cai no alerta genérico do topo em vez do erro inline, diferente do
comportamento de `label`/`digits`/`order`.

### Pontos de exibição (reusam `PositionDescriptionButton`)

- **`frontend/src/pages/Positions.jsx`** (~linha 80) — ao lado de `position.label` na tabela.
- **`frontend/src/pages/SessionWizard.jsx`** (~linha 442) — ao lado do label no checkbox de cargo.
- **`frontend/src/pages/SessionDetails.jsx`** (~linha 297) — ao lado do label em "Cargos em
  disputa" (`rules[code]?.description`, já disponível pois `rules` vem de `api.positions.list()`).
- **`frontend/src/components/results/PositionResult.jsx`** — incluir `description` no
  destructuring (linha 15: `const { label, description, candidates, ... } = result;`) e colocar o
  botão ao lado do `CardTitle` (linha 23).
- **`frontend/src/components/candidates/CandidateFormDialog.jsx`** (~linha 91) — botão dentro do
  `label` do `FormField` "Cargo", usando `rules[position]?.description` (mesma fonte que já
  resolve `rules[position]?.digits` na linha 39).
- **`frontend/src/pages/PublicCandidacy.jsx`**:
  - `FormField` "Cargo" (~linha 251) — mesmo padrão, `positionRule?.description`.
  - `CandidacyHero` (~linhas 141-149) — a fileira de badges com `p.label` por cargo, exibida antes
    do formulário (é o momento em que a descrição mais ajuda a escolher a qual cargo concorrer);
    botão ao lado do label dentro de cada badge.
- **Tela pública de votação** — `rule.description` chega em `Urna`/`CandidateList` de graça
  (`useBallotFlow` usa o objeto `rule` inteiro, sem reconstrução), só precisa ser repassado:
  - `frontend/src/pages/PublicVoting.jsx` — passar `positionDescription={rule.description}` pros
    dois componentes.
  - `frontend/src/components/voting/Urna.jsx`, `UrnaScreen` (linhas 20-26) — novo prop
    `positionDescription`; mudar o label de `flex flex-col` pra uma linha `flex items-center gap-1`
    com o botão ao lado (tela trava o scroll no desktop, `min-h` já justo — manter compacto, sem
    acrescentar uma segunda linha).
  - `frontend/src/components/voting/CandidateList.jsx` (linha 41) — novo prop
    `positionDescription`, botão ao lado do header "Candidatos a {label}".

## Fora de escopo (decisão explícita, não esquecimento)

- **PDF de resultados** (`backend/src/reports/results-pdf.js`, `drawPositionSection`) continua só
  com `position.label` no título de cada cargo — ainda que o dado já chegue até lá via
  `results-report.service.js` (spread `{ ...position, candidates }`), não entra no layout
  impresso por agora.
- **Tabelas densas** (`frontend/src/components/candidates/CandidatesTable.jsx`,
  `frontend/src/components/audit/VoteChainTable.jsx`) e o filtro "Filtrar por cargo" em
  `Candidates.jsx` continuam mostrando só o label, sem botão por linha/item — um ícone por linha
  numa tabela ou dentro de cada opção de um filtro `Select` seria ruído sem ganho real.

## Verificação

1. Backend: `npm run prisma:migrate` (gera e aplica a migração), depois `npm run dev:backend`.
   - Conferir via Prisma Studio ou curl que uma conta já existente (demo) teve os 7 cargos padrão
     retroagidos com `description` preenchida.
   - `POST /api/auth/register` de uma conta nova → `GET /api/positions` já traz os 7 com descrição.
   - `PUT /api/positions/:id` só com `{ digits: 3 }` (sem tocar `description`) → confirmar que a
     descrição existente não é apagada.
   - `GET /api/public/sessions/:token` e `GET /api/public/sessions/:token/results` (sessão
     finalizada) → confirmar `description` presente em cada cargo.
2. Frontend: `npm run build` (ou `npm run dev:frontend` e navegar manualmente por Cargos, o
   wizard de nova sessão, Detalhes da sessão, Resultados, Candidatos, e o link público de votação
   `/votar/:token` e de candidatura `/candidatar/:token`) confirmando que o botão de descrição
   aparece e abre o conteúdo certo em cada tela listada acima.
