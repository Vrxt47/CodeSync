-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "family_id" TEXT NOT NULL DEFAULT gen_random_uuid();

-- CreateIndex
CREATE INDEX "sessions_family_id_idx" ON "sessions"("family_id");

