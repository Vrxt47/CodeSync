import { prisma } from "../packages/database/src";

async function main() {
  const userCount = await prisma.user.count();
  const workspaceCount = await prisma.workspace.count();
  const fileCount = await prisma.file.count();
  const memberCount = await prisma.workspaceMember.count();
  const sessionCount = await prisma.session.count();

  console.log("----------------------------------------");
  console.log(
    "📊 POSTGRESQL RECORD COUNTS (Target: " +
      (process.env.DATABASE_URL?.includes("codesync_test") ? "codesync_test" : "codesync") +
      ")"
  );
  console.log("----------------------------------------");
  console.log(`  Users:              ${userCount}`);
  console.log(`  Workspaces:         ${workspaceCount}`);
  console.log(`  Files:              ${fileCount}`);
  console.log(`  Workspace Members:  ${memberCount}`);
  console.log(`  Sessions:           ${sessionCount}`);
  console.log("----------------------------------------");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
