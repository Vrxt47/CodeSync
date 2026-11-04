import { runDevDbAudit } from "./cleanup-dev-db";

async function main() {
  const manifest = await runDevDbAudit(false);
  console.log("\n===============================================================================");
  console.log("📜 COMPLETE TEST POLLUTION MANIFEST (ALL CANDIDATE IDS FOR CODESYNC CLEANUP)");
  console.log("===============================================================================");

  console.log("\n### 1. CANDIDATE WORKSPACES (8 RECORDS)");
  manifest.candidateWorkspaces.forEach((ws, i) => {
    console.log(`  [${i + 1}] ID: ${ws.id} | Name: "${ws.name}" | Owner: ${ws.ownerEmail}`);
  });

  console.log("\n### 2. CANDIDATE USERS (32 RECORDS)");
  manifest.candidateUsers.forEach((u, i) => {
    console.log(`  [${i + 1}] ID: ${u.id} | Email: ${u.email} | Name: ${u.name}`);
  });

  console.log("\n### 3. CANDIDATE FILES (61 RECORDS)");
  manifest.candidateFiles.forEach((f, i) => {
    console.log(
      `  [${i + 1}] ID: ${f.id} | Name: ${f.name} (${f.type}) | WS ID: ${f.workspaceId} ("${f.workspaceName}")`
    );
  });

  console.log("\n### 4. CANDIDATE WORKSPACE MEMBERSHIPS (22 RECORDS)");
  manifest.candidateMemberships.forEach((m, i) => {
    console.log(
      `  [${i + 1}] ID: ${m.id} | User: ${m.userEmail} [${m.userId}] | WS: "${m.workspaceName}" [${m.workspaceId}] | Role: ${m.role}`
    );
  });

  console.log("\n### 5. CANDIDATE SESSIONS (32 RECORDS)");
  manifest.candidateSessions.forEach((s, i) => {
    console.log(
      `  [${i + 1}] ID: ${s.id} | User ID: ${s.userId} (${s.userEmail}) | CreatedAt: ${s.createdAt.toISOString()}`
    );
  });

  console.log("\n### 6. CANDIDATE ACTIVITY LOGS (8 RECORDS)");
  manifest.candidateActivityLogs.forEach((l, i) => {
    console.log(
      `  [${i + 1}] ID: ${l.id} | Action: ${l.action} | WS ID: ${l.workspaceId} | User ID: ${l.userId}`
    );
  });

  console.log("\n===============================================================================");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
