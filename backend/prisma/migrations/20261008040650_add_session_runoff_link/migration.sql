-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "runoffOfSessionId" TEXT;

-- CreateIndex
CREATE INDEX "sessions_runoffOfSessionId_idx" ON "sessions"("runoffOfSessionId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_runoffOfSessionId_fkey" FOREIGN KEY ("runoffOfSessionId") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
