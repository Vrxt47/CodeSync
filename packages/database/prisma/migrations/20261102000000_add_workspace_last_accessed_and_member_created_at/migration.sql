-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN "last_accessed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "workspace_members" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "workspaces_last_accessed_at_idx" ON "workspaces"("last_accessed_at");

