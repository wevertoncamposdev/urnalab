-- AlterTable
ALTER TABLE "positions" ADD COLUMN     "description" TEXT;

-- Retroage a descrição nos 7 cargos padrão de contas já existentes (mesmo padrão já usado
-- no projeto para retroagir dados em contas anteriores a uma funcionalidade nova, ver
-- confirmação de e-mail). Só afeta cargos cujo `code` bate exatamente com o padrão — um
-- cargo renomeado mas com o code original ainda recebe a descrição; um cargo totalmente
-- customizado (code diferente) não é afetado e continua editável manualmente.
UPDATE "positions" SET "description" = 'Chefe do Poder Executivo federal: comanda a administração pública da União, sanciona ou veta leis e representa o Brasil internacionalmente.' WHERE "code" = 'PRESIDENTE' AND "description" IS NULL;
UPDATE "positions" SET "description" = 'Chefe do Poder Executivo estadual (ou distrital, no caso do Distrito Federal): administra o estado, propõe o orçamento e sanciona leis estaduais.' WHERE "code" = 'GOVERNADOR' AND "description" IS NULL;
UPDATE "positions" SET "description" = 'Representa o estado (3 vagas por estado, independente da população) no Senado Federal. As eleições se alternam, a cada 4 anos, entre renovar 1/3 e 2/3 das vagas de cada estado.' WHERE "code" = 'SENADOR' AND "description" IS NULL;
UPDATE "positions" SET "description" = 'Representa o estado na Câmara dos Deputados, elaborando e votando leis federais e fiscalizando o Poder Executivo.' WHERE "code" = 'DEPUTADO_FEDERAL' AND "description" IS NULL;
UPDATE "positions" SET "description" = 'Representa a população do estado na Assembleia Legislativa, legislando sobre temas estaduais e fiscalizando o governo do estado.' WHERE "code" = 'DEPUTADO_ESTADUAL' AND "description" IS NULL;
UPDATE "positions" SET "description" = 'Chefe do Poder Executivo municipal: administra a prefeitura, os serviços públicos locais e sanciona leis municipais.' WHERE "code" = 'PREFEITO' AND "description" IS NULL;
UPDATE "positions" SET "description" = 'Representa a população do município na Câmara Municipal, legislando sobre temas locais e fiscalizando a prefeitura.' WHERE "code" = 'VEREADOR' AND "description" IS NULL;
