-- AlterTable
ALTER TABLE "files" ADD COLUMN "content" TEXT NOT NULL DEFAULT '';

-- DropIndex
DROP INDEX IF EXISTS "files_workspace_id_parent_id_name_key";
DROP INDEX IF EXISTS "files_workspace_id_root_name_key";

-- Create functional unique indexes for case-insensitive sibling uniqueness
CREATE UNIQUE INDEX "files_workspace_id_parent_id_lower_name_key" ON "files"("workspace_id", "parent_id", lower("name")) WHERE "parent_id" IS NOT NULL;
CREATE UNIQUE INDEX "files_workspace_id_root_lower_name_key" ON "files"("workspace_id", lower("name")) WHERE "parent_id" IS NULL;