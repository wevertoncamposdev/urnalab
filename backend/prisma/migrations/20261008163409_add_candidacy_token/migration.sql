-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "candidacyToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "sessions_candidacyToken_key" ON "sessions"("candidacyToken");
