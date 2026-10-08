-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "fileKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- Seed do produto "exportação de PDF" (Etapa 11/12), que já existia antes deste produto
-- genérico existir — id fixo e legível (não um uuid gerado) porque o backend referencia
-- esse produto por id direto (ver rules/product-rules.js SESSION_EXPORT_PRODUCT_ID), sem
-- precisar de uma consulta por slug a cada chamada. Preço inicial igual ao antigo
-- default de SESSION_RESULTS_PRICE_CENTS (R$ 9,90) — editável depois (Etapa 16).
INSERT INTO "products" ("id", "slug", "name", "description", "kind", "priceCents", "active", "updatedAt")
VALUES (
    'session-export',
    'session-export',
    'Exportação do resultado em PDF',
    'Libera o download do PDF da apuração de uma sessão finalizada, quantas vezes quiser.',
    'SESSION_EXPORT',
    990,
    true,
    CURRENT_TIMESTAMP
);

-- AlterTable: productId chega como NULLABLE pra poder ser preenchido na linha de baixo
-- antes de virar NOT NULL — payments já existentes (todos da exportação de PDF, único
-- produto que existia até aqui) migram pro produto seed acima.
ALTER TABLE "payments" ADD COLUMN "productId" TEXT,
ALTER COLUMN "sessionId" DROP NOT NULL;

UPDATE "payments" SET "productId" = 'session-export' WHERE "productId" IS NULL;

ALTER TABLE "payments" ALTER COLUMN "productId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "payments_productId_idx" ON "payments"("productId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
