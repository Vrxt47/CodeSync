import fs from "node:fs";
import path from "node:path";

// Explicitly load root .env (development database) with zero external dependencies
function loadRootDevEnv(): void {
  const envPath = path.resolve(__dirname, "../.env");
  if (!fs.existsSync(envPath)) {
    throw new Error(`❌ FATAL: Root .env file not found at ${envPath}`);
  }

  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

loadRootDevEnv();

import { prisma } from "../packages/database/src";

// Strictly protected production / development real user emails
export const PROTECTED_USER_EMAILS = [
  "developer@codesync.dev",
  "vrut.a003@gmail.com",
  "concurrency@test.com",
  "jenil@gmail.com",
  "poojan@gmail.com",
];

// Strictly protected workspace names
export const PROTECTED_WORKSPACE_NAMES = [
  "Demo Workspace",
  "First First",
  "Jenil First",
  "Hello",
  "Hello 2",
];

export interface FullCleanupManifest {
  isDryRun: boolean;
  connectedDatabase: string;
  protectedUsers: Array<{ id: string; email: string; name: string }>;
  protectedWorkspaces: Array<{ id: string; name: string; ownerEmail: string }>;
  protectedFilesCount: number;
  protectedMembershipsCount: number;
  candidateUsers: Array<{ id: string; email: string; name: string }>;
  candidateWorkspaces: Array<{
    id: string;
    name: string;
    ownerId: string;
    ownerEmail: string;
  }>;
  candidateFiles: Array<{
    id: string;
    name: string;
    type: string;
    workspaceId: string;
    workspaceName: string;
  }>;
  candidateMemberships: Array<{
    id: string;
    workspaceId: string;
    workspaceName: string;
    userId: string;
    userEmail: string;
    role: string;
  }>;
  candidateSessions: Array<{
    id: string;
    userId: string;
    userEmail: string;
    createdAt: Date;
  }>;
  candidateActivityLogs: Array<{
    id: string;
    workspaceId: string;
    userId: string | null;
    action: string;
    createdAt: Date;
  }>;
}

export async function runDevDbAudit(execute: boolean = false): Promise<FullCleanupManifest> {
  const dbUrl = process.env.DATABASE_URL || "";
  const dbNameMatch = dbUrl.match(/\/([^/?]+)(\?|$)/);
  const currentDbName = dbNameMatch ? dbNameMatch[1] : "unknown";

  console.log("=================================================");
  console.log(`🔍 CODESYNC DEV DATABASE AUDIT & CLEANUP`);
  console.log(`   Configured DB in .env: ${currentDbName}`);
  console.log(`   Mode: ${execute ? "⚠️ LIVE EXECUTION" : "🛡️ DRY-RUN (Read-Only)"}`);
  console.log("=================================================");

  if (currentDbName !== "codesync") {
    throw new Error(
      `ABORT: Expected to target 'codesync' dev database, but configured DATABASE_URL is '${currentDbName}'!`
    );
  }

  // 1. Live SQL current_database() verification
  const dbQuery = await prisma.$queryRaw<Array<{ current_database: string }>>`
    SELECT current_database();
  `;
  const liveDbName = dbQuery[0]?.current_database;
  console.log(`  🛡️ Live PostgreSQL current_database(): "${liveDbName}"`);

  if (liveDbName !== "codesync") {
    throw new Error(
      `ABORT: Live PostgreSQL current_database() is '${liveDbName}', but expected 'codesync'!`
    );
  }

  // 2. Fetch real / protected records
  const allUsers = await prisma.user.findMany({
    include: {
      workspaces: true,
      memberships: true,
    },
  });

  const protectedUsers = allUsers.filter((u) => PROTECTED_USER_EMAILS.includes(u.email));
  const protectedUserIds = new Set(protectedUsers.map((u) => u.id));

  const allWorkspaces = await prisma.workspace.findMany({
    include: {
      owner: true,
      files: true,
      members: {
        include: { user: true },
      },
    },
  });

  const protectedWorkspaces = allWorkspaces.filter(
    (ws) => protectedUserIds.has(ws.ownerId) || PROTECTED_WORKSPACE_NAMES.includes(ws.name)
  );
  const protectedWorkspaceIds = new Set(protectedWorkspaces.map((ws) => ws.id));

  const protectedFilesCount = protectedWorkspaces.reduce((acc, ws) => acc + ws.files.length, 0);
  const protectedMembershipsCount = protectedWorkspaces.reduce(
    (acc, ws) => acc + ws.members.length,
    0
  );

  // 3. Identify candidate test pollution users
  const candidateUsers = allUsers
    .filter((u) => {
      if (protectedUserIds.has(u.id) || PROTECTED_USER_EMAILS.includes(u.email)) {
        return false;
      }
      return (
        u.email.startsWith("live-owner-") ||
        u.email.startsWith("live-collab-") ||
        u.email.startsWith("live-viewer-") ||
        u.email.startsWith("live-outsider-") ||
        u.email.startsWith("live-") ||
        u.name === "Owner Alice" ||
        u.name === "Collaborator Bob" ||
        u.name === "Viewer Charlie" ||
        u.name === "Outsider Dave"
      );
    })
    .map((u) => ({ id: u.id, email: u.email, name: u.name }));

  const candidateUserIds = new Set(candidateUsers.map((u) => u.id));

  // 4. Identify candidate test pollution workspaces
  const candidateWorkspaces = allWorkspaces
    .filter((ws) => {
      if (protectedWorkspaceIds.has(ws.id) || PROTECTED_WORKSPACE_NAMES.includes(ws.name)) {
        return false;
      }
      return ws.name.startsWith("Concurrency WS ") || candidateUserIds.has(ws.ownerId);
    })
    .map((ws) => ({
      id: ws.id,
      name: ws.name,
      ownerId: ws.ownerId,
      ownerEmail: ws.owner.email,
    }));

  const candidateWorkspaceIds = new Set(candidateWorkspaces.map((ws) => ws.id));

  // 5. Identify candidate files
  const candidateFiles = await prisma.file.findMany({
    where: {
      workspaceId: { in: Array.from(candidateWorkspaceIds) },
    },
    include: {
      workspace: { select: { name: true } },
    },
  });

  // 6. Identify candidate memberships
  const candidateMemberships = await prisma.workspaceMember.findMany({
    where: {
      OR: [
        { workspaceId: { in: Array.from(candidateWorkspaceIds) } },
        { userId: { in: Array.from(candidateUserIds) } },
      ],
    },
    include: {
      workspace: { select: { name: true } },
      user: { select: { email: true } },
    },
  });

  // 7. Identify candidate sessions
  const candidateSessions = await prisma.session.findMany({
    where: {
      userId: { in: Array.from(candidateUserIds) },
    },
    include: {
      user: { select: { email: true } },
    },
  });

  // 8. Identify candidate activity logs
  const candidateActivityLogs = await prisma.activityLog.findMany({
    where: {
      OR: [
        { workspaceId: { in: Array.from(candidateWorkspaceIds) } },
        { userId: { in: Array.from(candidateUserIds) } },
      ],
    },
  });

  // =========================================================================
  // STRICT SAFETY ASSERTIONS
  // =========================================================================

  // A. Zero candidate intersection with protected users
  for (const cUser of candidateUsers) {
    if (protectedUserIds.has(cUser.id) || PROTECTED_USER_EMAILS.includes(cUser.email)) {
      throw new Error(
        `CRITICAL INTEGRITY FAILURE: Candidate user ${cUser.email} [${cUser.id}] is a PROTECTED USER!`
      );
    }
  }

  // B. Zero candidate intersection with protected workspaces
  for (const cWs of candidateWorkspaces) {
    if (protectedWorkspaceIds.has(cWs.id) || PROTECTED_WORKSPACE_NAMES.includes(cWs.name)) {
      throw new Error(
        `CRITICAL INTEGRITY FAILURE: Candidate workspace "${cWs.name}" [${cWs.id}] is a PROTECTED WORKSPACE!`
      );
    }
  }

  // C. Every candidate file belongs strictly to candidate workspaces
  for (const cFile of candidateFiles) {
    if (protectedWorkspaceIds.has(cFile.workspaceId)) {
      throw new Error(
        `CRITICAL INTEGRITY FAILURE: File "${cFile.name}" belongs to protected workspace ${cFile.workspaceId}!`
      );
    }
    if (!candidateWorkspaceIds.has(cFile.workspaceId)) {
      throw new Error(
        `CRITICAL INTEGRITY FAILURE: File "${cFile.name}" workspace ${cFile.workspaceId} is not in candidate workspaces!`
      );
    }
  }

  // D. Every candidate membership belongs strictly to candidate workspaces and users
  for (const cMem of candidateMemberships) {
    if (protectedWorkspaceIds.has(cMem.workspaceId) || protectedUserIds.has(cMem.userId)) {
      throw new Error(`CRITICAL INTEGRITY FAILURE: Protected membership flagged as candidate!`);
    }
    if (!candidateWorkspaceIds.has(cMem.workspaceId) || !candidateUserIds.has(cMem.userId)) {
      throw new Error(
        `CRITICAL INTEGRITY FAILURE: Membership [user: ${cMem.userId}, ws: ${cMem.workspaceId}] is not exclusively between candidate test entities!`
      );
    }
  }

  // E. Candidate Users Cross-Reference Verification (Zero references outside candidate workspaces)
  const candidateUsersInOtherWorkspaces = await prisma.workspace.findMany({
    where: {
      ownerId: { in: Array.from(candidateUserIds) },
      id: { notIn: Array.from(candidateWorkspaceIds) },
    },
  });
  if (candidateUsersInOtherWorkspaces.length > 0) {
    throw new Error(
      `CRITICAL INTEGRITY FAILURE: Candidate users own ${candidateUsersInOtherWorkspaces.length} workspaces outside candidate set!`
    );
  }

  const candidateMembershipsInOtherWorkspaces = await prisma.workspaceMember.findMany({
    where: {
      userId: { in: Array.from(candidateUserIds) },
      workspaceId: { notIn: Array.from(candidateWorkspaceIds) },
    },
  });
  if (candidateMembershipsInOtherWorkspaces.length > 0) {
    throw new Error(
      `CRITICAL INTEGRITY FAILURE: Candidate users are members in ${candidateMembershipsInOtherWorkspaces.length} workspaces outside candidate set!`
    );
  }

  const candidateMessagesInOtherWorkspaces = await prisma.message.findMany({
    where: {
      senderId: { in: Array.from(candidateUserIds) },
      workspaceId: { notIn: Array.from(candidateWorkspaceIds) },
    },
  });
  if (candidateMessagesInOtherWorkspaces.length > 0) {
    throw new Error(
      `CRITICAL INTEGRITY FAILURE: Candidate users sent messages in workspaces outside candidate set!`
    );
  }

  const candidateExecutionsInOtherWorkspaces = await prisma.execution.findMany({
    where: {
      userId: { in: Array.from(candidateUserIds) },
      workspaceId: { notIn: Array.from(candidateWorkspaceIds) },
    },
  });
  if (candidateExecutionsInOtherWorkspaces.length > 0) {
    throw new Error(
      `CRITICAL INTEGRITY FAILURE: Candidate users triggered executions in workspaces outside candidate set!`
    );
  }

  const candidateLogsInOtherWorkspaces = await prisma.activityLog.findMany({
    where: {
      userId: { in: Array.from(candidateUserIds) },
      workspaceId: { notIn: Array.from(candidateWorkspaceIds) },
    },
  });
  if (candidateLogsInOtherWorkspaces.length > 0) {
    throw new Error(
      `CRITICAL INTEGRITY FAILURE: Candidate users have activity logs in workspaces outside candidate set!`
    );
  }

  // F. Protected Users In Candidate Workspaces Verification (Zero protected user references)
  const protectedUsersOwningCandidateWs = await prisma.workspace.findMany({
    where: {
      id: { in: Array.from(candidateWorkspaceIds) },
      ownerId: { in: Array.from(protectedUserIds) },
    },
  });
  if (protectedUsersOwningCandidateWs.length > 0) {
    throw new Error(`CRITICAL INTEGRITY FAILURE: Protected user owns a candidate workspace!`);
  }

  const protectedMembershipsInCandidateWs = await prisma.workspaceMember.findMany({
    where: {
      workspaceId: { in: Array.from(candidateWorkspaceIds) },
      userId: { in: Array.from(protectedUserIds) },
    },
  });
  if (protectedMembershipsInCandidateWs.length > 0) {
    throw new Error(
      `CRITICAL INTEGRITY FAILURE: Protected user has membership in a candidate workspace!`
    );
  }

  // G. Verify expected exact counts
  if (candidateUsers.length !== 32) {
    throw new Error(
      `COUNT MISMATCH: Expected exactly 32 candidate users, found ${candidateUsers.length}`
    );
  }
  if (candidateWorkspaces.length !== 8) {
    throw new Error(
      `COUNT MISMATCH: Expected exactly 8 candidate workspaces, found ${candidateWorkspaces.length}`
    );
  }
  if (candidateFiles.length !== 61) {
    throw new Error(
      `COUNT MISMATCH: Expected exactly 61 candidate files, found ${candidateFiles.length}`
    );
  }
  if (candidateMemberships.length !== 22) {
    throw new Error(
      `COUNT MISMATCH: Expected exactly 22 candidate memberships, found ${candidateMemberships.length}`
    );
  }
  if (candidateSessions.length !== 32) {
    throw new Error(
      `COUNT MISMATCH: Expected exactly 32 candidate sessions, found ${candidateSessions.length}`
    );
  }
  if (candidateActivityLogs.length !== 8) {
    throw new Error(
      `COUNT MISMATCH: Expected exactly 8 candidate activity logs, found ${candidateActivityLogs.length}`
    );
  }

  const manifest: FullCleanupManifest = {
    isDryRun: !execute,
    connectedDatabase: liveDbName,
    protectedUsers: protectedUsers.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
    })),
    protectedWorkspaces: protectedWorkspaces.map((ws) => ({
      id: ws.id,
      name: ws.name,
      ownerEmail: ws.owner.email,
    })),
    protectedFilesCount,
    protectedMembershipsCount,
    candidateUsers,
    candidateWorkspaces,
    candidateFiles: candidateFiles.map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      workspaceId: f.workspaceId,
      workspaceName: f.workspace.name,
    })),
    candidateMemberships: candidateMemberships.map((m) => ({
      id: m.id,
      workspaceId: m.workspaceId,
      workspaceName: m.workspace.name,
      userId: m.userId,
      userEmail: m.user.email,
      role: m.role,
    })),
    candidateSessions: candidateSessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      userEmail: s.user.email,
      createdAt: s.createdAt,
    })),
    candidateActivityLogs: candidateActivityLogs.map((l) => ({
      id: l.id,
      workspaceId: l.workspaceId,
      userId: l.userId,
      action: l.action,
      createdAt: l.createdAt,
    })),
  };

  // =========================================================================
  // PRINT SUMMARY AND MANIFEST
  // =========================================================================
  console.log("\n--- [PROTECTED APPLICATION RECORDS (100% UNTOUCHED)] ---");
  console.log(`  🛡️ Protected Users:       ${manifest.protectedUsers.length}`);
  for (const u of manifest.protectedUsers) {
    console.log(`     • ${u.name} (${u.email}) [id: ${u.id}]`);
  }
  console.log(`  🛡️ Protected Workspaces:  ${manifest.protectedWorkspaces.length}`);
  for (const ws of manifest.protectedWorkspaces) {
    console.log(`     • "${ws.name}" [id: ${ws.id}] (Owner: ${ws.ownerEmail})`);
  }
  console.log(`  🛡️ Protected Files:       ${manifest.protectedFilesCount}`);
  console.log(`  🛡️ Protected Memberships: ${manifest.protectedMembershipsCount}`);

  console.log("\n--- [VERIFIED CANDIDATE RECORD COUNTS] ---");
  console.log(
    `  🎯 Candidate Workspaces:   ${manifest.candidateWorkspaces.length} (Verified expected: 8)`
  );
  console.log(
    `  🎯 Candidate Files:        ${manifest.candidateFiles.length} (Verified expected: 61)`
  );
  console.log(
    `  🎯 Candidate Memberships:  ${manifest.candidateMemberships.length} (Verified expected: 22)`
  );
  console.log(
    `  🎯 Candidate Sessions:     ${manifest.candidateSessions.length} (Verified expected: 32)`
  );
  console.log(
    `  🎯 Candidate ActivityLogs: ${manifest.candidateActivityLogs.length} (Verified expected: 8)`
  );
  console.log(
    `  🎯 Candidate Users:        ${manifest.candidateUsers.length} (Verified expected: 32)`
  );

  console.log("\n--- [FOREIGN-KEY & CROSS-REFERENCE SAFETY VERIFICATION] ---");
  console.log(`  ✅ 0 candidate users referenced in workspaces outside candidate set`);
  console.log(`  ✅ 0 candidate users referenced in memberships outside candidate set`);
  console.log(`  ✅ 0 candidate users referenced in messages outside candidate set`);
  console.log(`  ✅ 0 candidate users referenced in executions outside candidate set`);
  console.log(`  ✅ 0 candidate users referenced in activity logs outside candidate set`);
  console.log(`  ✅ 0 protected users referenced in candidate workspaces`);

  if (execute) {
    console.log("\n⚠️ EXECUTING CLEANUP INSIDE SINGLE ATOMIC PRISMA TRANSACTION...");

    await prisma.$transaction(
      async (tx) => {
        // Step 0A: Live in-transaction database verification
        const txDbQuery = await tx.$queryRaw<
          Array<{ current_database: string }>
        >`SELECT current_database();`;
        const txDb = txDbQuery[0]?.current_database;
        if (txDb !== "codesync") {
          throw new Error(
            `ABORT: In-transaction current_database() is '${txDb}', expected 'codesync'!`
          );
        }

        // Step 0B: In-transaction candidate ID revalidation immediately before deletion
        const revalUsers = await tx.user.findMany({
          where: { id: { in: Array.from(candidateUserIds) } },
        });
        if (revalUsers.length !== candidateUsers.length) {
          throw new Error(
            `REVALIDATION FAILURE: Candidate user count changed before deletion! Expected ${candidateUsers.length}, found ${revalUsers.length}`
          );
        }
        for (const u of revalUsers) {
          if (protectedUserIds.has(u.id) || PROTECTED_USER_EMAILS.includes(u.email)) {
            throw new Error(
              `REVALIDATION FAILURE: Protected user ${u.email} found in revalidated candidate set!`
            );
          }
        }

        const revalWs = await tx.workspace.findMany({
          where: { id: { in: Array.from(candidateWorkspaceIds) } },
        });
        if (revalWs.length !== candidateWorkspaces.length) {
          throw new Error(
            `REVALIDATION FAILURE: Candidate workspace count changed before deletion! Expected ${candidateWorkspaces.length}, found ${revalWs.length}`
          );
        }
        for (const ws of revalWs) {
          if (protectedWorkspaceIds.has(ws.id) || PROTECTED_WORKSPACE_NAMES.includes(ws.name)) {
            throw new Error(
              `REVALIDATION FAILURE: Protected workspace "${ws.name}" found in revalidated candidate set!`
            );
          }
        }

        // Step 1: Delete candidate workspaces
        // PostgreSQL foreign key CASCADE deletes:
        // - files (and child files + document snapshots)
        // - workspace_members
        // - invitations
        // - messages
        // - executions
        // - activity_logs
        const deletedWs = await tx.workspace.deleteMany({
          where: { id: { in: Array.from(candidateWorkspaceIds) } },
        });
        console.log(
          `  ✅ Step 1: Deleted ${deletedWs.count} candidate workspaces (cascading files, members, logs)`
        );

        // Step 2: Delete candidate sessions
        const deletedSessions = await tx.session.deleteMany({
          where: { userId: { in: Array.from(candidateUserIds) } },
        });
        console.log(`  ✅ Step 2: Deleted ${deletedSessions.count} candidate sessions`);

        // Step 3: Delete candidate users
        const deletedUsers = await tx.user.deleteMany({
          where: { id: { in: Array.from(candidateUserIds) } },
        });
        console.log(`  ✅ Step 3: Deleted ${deletedUsers.count} candidate users`);

        // Step 4: Comprehensive atomic post-cleanup verification
        const remainingWs = await tx.workspace.count({
          where: { id: { in: Array.from(candidateWorkspaceIds) } },
        });
        const remainingUsers = await tx.user.count({
          where: { id: { in: Array.from(candidateUserIds) } },
        });
        const remainingFiles = await tx.file.count({
          where: { id: { in: candidateFiles.map((f) => f.id) } },
        });
        const remainingMembers = await tx.workspaceMember.count({
          where: { id: { in: candidateMemberships.map((m) => m.id) } },
        });
        const remainingSessions = await tx.session.count({
          where: { id: { in: candidateSessions.map((s) => s.id) } },
        });
        const remainingLogs = await tx.activityLog.count({
          where: { id: { in: candidateActivityLogs.map((l) => l.id) } },
        });
        const remainingMessages = await tx.message.count({
          where: {
            OR: [
              { workspaceId: { in: Array.from(candidateWorkspaceIds) } },
              { senderId: { in: Array.from(candidateUserIds) } },
            ],
          },
        });
        const remainingExecutions = await tx.execution.count({
          where: {
            OR: [
              { workspaceId: { in: Array.from(candidateWorkspaceIds) } },
              { userId: { in: Array.from(candidateUserIds) } },
            ],
          },
        });
        const remainingInvitations = await tx.invitation.count({
          where: { workspaceId: { in: Array.from(candidateWorkspaceIds) } },
        });
        const remainingSnapshots = await tx.documentSnapshot.count({
          where: {
            documentId: { in: candidateFiles.map((f) => f.id) },
          },
        });

        if (
          remainingWs > 0 ||
          remainingUsers > 0 ||
          remainingFiles > 0 ||
          remainingMembers > 0 ||
          remainingSessions > 0 ||
          remainingLogs > 0 ||
          remainingMessages > 0 ||
          remainingExecutions > 0 ||
          remainingInvitations > 0 ||
          remainingSnapshots > 0
        ) {
          throw new Error(
            `TRANSACTION INTEGRITY VIOLATION: Residual candidate records remain! ` +
              `ws=${remainingWs}, users=${remainingUsers}, files=${remainingFiles}, members=${remainingMembers}, ` +
              `sessions=${remainingSessions}, logs=${remainingLogs}, messages=${remainingMessages}, ` +
              `executions=${remainingExecutions}, invitations=${remainingInvitations}, snapshots=${remainingSnapshots}. ` +
              `Rolling back entire transaction.`
          );
        }

        // Step 5: Verify protected application records remain 100% intact
        const postProtectedUserCount = await tx.user.count({
          where: { id: { in: Array.from(protectedUserIds) } },
        });
        const postProtectedWsCount = await tx.workspace.count({
          where: { id: { in: Array.from(protectedWorkspaceIds) } },
        });
        const postProtectedFileCount = await tx.file.count({
          where: { workspaceId: { in: Array.from(protectedWorkspaceIds) } },
        });
        const postProtectedMemCount = await tx.workspaceMember.count({
          where: { workspaceId: { in: Array.from(protectedWorkspaceIds) } },
        });

        if (
          postProtectedUserCount !== protectedUsers.length ||
          postProtectedWsCount !== protectedWorkspaces.length ||
          postProtectedFileCount !== protectedFilesCount ||
          postProtectedMemCount !== protectedMembershipsCount
        ) {
          throw new Error(
            `PROTECTED RECORD MUTATION DETECTED: Protected counts mismatch post-cleanup! ` +
              `users: ${postProtectedUserCount}/${protectedUsers.length}, ` +
              `workspaces: ${postProtectedWsCount}/${protectedWorkspaces.length}, ` +
              `files: ${postProtectedFileCount}/${protectedFilesCount}, ` +
              `memberships: ${postProtectedMemCount}/${protectedMembershipsCount}. ` +
              `Rolling back entire transaction.`
          );
        }
      },
      { timeout: 30000 }
    );

    console.log(
      "\n🎉 TRANSACTION COMMITTED: All 32 candidate test users and 8 workspaces deleted cleanly."
    );
  } else {
    console.log("\n🛡️ DRY-RUN COMPLETED: 0 records deleted. Database remains 100% untouched.");
  }

  return manifest;
}

if (require.main === module) {
  const isExecute = process.argv.includes("--execute");
  runDevDbAudit(isExecute)
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n❌ SAFETY AUDIT REJECTION:", err.message);
      process.exit(1);
    });
}
