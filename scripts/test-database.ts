import { prisma, WorkspaceRole, FileType, ExecutionStatus, Prisma } from "../packages/database/src";

async function runDatabaseTests() {
  console.log("=================================================");
  console.log("🧪 STARTING CHUNK 3 DATABASE INTEGRITY TESTS");
  console.log("=================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: User
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 1: User Model] ---");
    const testEmail = `test.user.${Date.now()}@codesync.dev`;
    const user1 = await prisma.user.create({
      data: {
        name: "Test User 1",
        email: testEmail,
        passwordHash: "$2a$10$FakeHashedPasswordStringForTestingOnly",
        avatar: "https://example.com/avatar.png",
      },
    });

    assert(
      Boolean(user1.id && user1.createdAt && user1.updatedAt),
      "User created with UUID, timestamps"
    );

    // Unique email rejection
    let duplicateEmailRejected = false;
    try {
      await prisma.user.create({
        data: {
          name: "Test User Duplicate",
          email: testEmail,
          passwordHash: "$2a$10$FakeHash",
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        duplicateEmailRejected = true;
      }
    }
    assert(duplicateEmailRejected, "User duplicate email rejected by unique constraint (P2002)");

    // -------------------------------------------------------------------------
    // TEST 2: Workspace
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 2: Workspace Model] ---");
    const workspace1 = await prisma.workspace.create({
      data: {
        name: "Test Workspace 1",
        description: "Integration test workspace",
        ownerId: user1.id,
      },
      include: { owner: true },
    });

    assert(workspace1.owner.id === user1.id, "Workspace created with valid owner relation");

    // Invalid owner rejected
    let invalidOwnerRejected = false;
    try {
      await prisma.workspace.create({
        data: {
          name: "Orphan Workspace",
          ownerId: "00000000-0000-0000-0000-000000000000",
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
        invalidOwnerRejected = true;
      }
    }
    assert(
      invalidOwnerRejected,
      "Workspace with non-existent ownerId rejected by foreign key (P2003)"
    );

    // -------------------------------------------------------------------------
    // TEST 3: Workspace Membership
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 3: WorkspaceMember Model] ---");
    const user2 = await prisma.user.create({
      data: {
        name: "Editor User",
        email: `editor.${Date.now()}@codesync.dev`,
        passwordHash: "$2a$10$FakeHash",
      },
    });

    const memberOwner = await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace1.id,
        userId: user1.id,
        role: WorkspaceRole.OWNER,
      },
    });

    const memberEditor = await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace1.id,
        userId: user2.id,
        role: WorkspaceRole.EDITOR,
      },
    });

    assert(
      memberOwner.role === "OWNER" && memberEditor.role === "EDITOR",
      "Workspace roles OWNER and EDITOR assigned"
    );

    // Duplicate membership rejection
    let duplicateMemberRejected = false;
    try {
      await prisma.workspaceMember.create({
        data: {
          workspaceId: workspace1.id,
          userId: user1.id,
          role: WorkspaceRole.VIEWER,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        duplicateMemberRejected = true;
      }
    }
    assert(
      duplicateMemberRejected,
      "Duplicate membership [workspaceId, userId] rejected by compound unique (P2002)"
    );

    // -------------------------------------------------------------------------
    // TEST 4: File Hierarchy & Unique Constraints
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 4: File Hierarchy & Uniqueness] ---");
    // Root folder
    const rootFolder = await prisma.file.create({
      data: {
        workspaceId: workspace1.id,
        name: "src",
        type: FileType.FOLDER,
        parentId: null,
      },
    });

    // Nested folder
    const nestedFolder = await prisma.file.create({
      data: {
        workspaceId: workspace1.id,
        name: "utils",
        type: FileType.FOLDER,
        parentId: rootFolder.id,
      },
      include: { parent: true },
    });

    assert(nestedFolder.parent?.id === rootFolder.id, "Parent-child folder hierarchy created");

    // Root file
    const rootFile = await prisma.file.create({
      data: {
        workspaceId: workspace1.id,
        name: "package.json",
        type: FileType.FILE,
        parentId: null,
      },
    });
    assert(rootFile.parentId === null, "Root-level file created with parentId = null");

    // File in folder
    const nestedFile = await prisma.file.create({
      data: {
        workspaceId: workspace1.id,
        name: "math.ts",
        type: FileType.FILE,
        parentId: nestedFolder.id,
      },
    });
    assert(nestedFile.parentId === nestedFolder.id, "Nested file created within subfolder");

    // Reject duplicate root file name
    let duplicateRootRejected = false;
    try {
      await prisma.file.create({
        data: {
          workspaceId: workspace1.id,
          name: "package.json",
          type: FileType.FILE,
          parentId: null,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        duplicateRootRejected = true;
      }
    }
    assert(
      duplicateRootRejected,
      "Duplicate root-level file rejected by partial unique index (P2002)"
    );

    // Reject duplicate name in same parent folder
    let duplicateNestedRejected = false;
    try {
      await prisma.file.create({
        data: {
          workspaceId: workspace1.id,
          name: "math.ts",
          type: FileType.FILE,
          parentId: nestedFolder.id,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        duplicateNestedRejected = true;
      }
    }
    assert(
      duplicateNestedRejected,
      "Duplicate file name within same folder rejected by partial unique index (P2002)"
    );

    // Reject cross-workspace parent assignment
    const workspace2 = await prisma.workspace.create({
      data: {
        name: "Workspace 2",
        ownerId: user1.id,
      },
    });

    let crossWorkspaceParentRejected = false;
    try {
      await prisma.file.create({
        data: {
          workspaceId: workspace2.id, // workspace 2
          name: "illegal-child.ts",
          type: FileType.FILE,
          parentId: rootFolder.id, // parent is in workspace 1
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
        crossWorkspaceParentRejected = true;
      }
    }
    assert(
      crossWorkspaceParentRejected,
      "Cross-workspace parent assignment rejected by composite foreign key (P2003)"
    );

    // -------------------------------------------------------------------------
    // TEST 5: Invitation Model
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 5: Invitation Model] ---");
    const tokenHash = `fake_sha256_token_hash_${Date.now()}`;
    const futureDate = new Date(Date.now() + 86400000 * 7);

    const invitation = await prisma.invitation.create({
      data: {
        workspaceId: workspace1.id,
        tokenHash,
        role: WorkspaceRole.EDITOR,
        expiresAt: futureDate,
      },
    });

    assert(
      invitation.role === "EDITOR" && invitation.revokedAt === null,
      "Invitation created with future expiration and null revocation"
    );

    // Unique tokenHash rejection
    let duplicateTokenRejected = false;
    try {
      await prisma.invitation.create({
        data: {
          workspaceId: workspace1.id,
          tokenHash,
          role: WorkspaceRole.VIEWER,
          expiresAt: futureDate,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        duplicateTokenRejected = true;
      }
    }
    assert(
      duplicateTokenRejected,
      "Duplicate invitation tokenHash rejected by unique constraint (P2002)"
    );

    // -------------------------------------------------------------------------
    // TEST 6: Message Model
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 6: Message Model] ---");
    const message = await prisma.message.create({
      data: {
        workspaceId: workspace1.id,
        senderId: user1.id,
        content: "Hello CodeSync team!",
      },
      include: {
        sender: true,
        workspace: true,
      },
    });

    assert(
      message.sender.id === user1.id && message.workspace.id === workspace1.id,
      "Message created with valid sender and workspace relations"
    );

    // -------------------------------------------------------------------------
    // TEST 7: Execution Model
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 7: Execution Model] ---");
    const execution = await prisma.execution.create({
      data: {
        workspaceId: workspace1.id,
        fileId: nestedFile.id,
        userId: user1.id,
        language: "typescript",
        status: ExecutionStatus.PENDING,
        stdout: "Output: 42",
        stderr: null,
        executionTime: 120,
      },
    });

    assert(
      execution.status === "PENDING" && execution.executionTime === 120,
      "Execution record created with default status and timing"
    );

    // Cross-workspace execution file rejection
    let crossWorkspaceExecutionRejected = false;
    try {
      await prisma.execution.create({
        data: {
          workspaceId: workspace2.id, // workspace 2
          fileId: nestedFile.id, // file belongs to workspace 1
          userId: user1.id,
          language: "typescript",
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
        crossWorkspaceExecutionRejected = true;
      }
    }
    assert(
      crossWorkspaceExecutionRejected,
      "Cross-workspace execution file assignment rejected by composite foreign key (P2003)"
    );

    // -------------------------------------------------------------------------
    // TEST 8: ActivityLog Model
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 8: ActivityLog Model] ---");
    const activity = await prisma.activityLog.create({
      data: {
        workspaceId: workspace1.id,
        userId: user1.id,
        action: "FILE_CREATED",
        metadata: { fileName: "math.ts", size: 1024, tags: ["utils", "math"] },
      },
    });

    assert(
      Boolean(
        activity.metadata && (activity.metadata as Record<string, unknown>).fileName === "math.ts"
      ),
      "ActivityLog created with JSON metadata"
    );

    const systemActivity = await prisma.activityLog.create({
      data: {
        workspaceId: workspace1.id,
        userId: null, // system generated
        action: "SYSTEM_BACKUP_COMPLETED",
        metadata: { durationMs: 450 },
      },
    });

    assert(
      systemActivity.userId === null,
      "ActivityLog supports nullable userId for system-generated events"
    );

    // -------------------------------------------------------------------------
    // TEST 9: DocumentSnapshot Model
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 9: DocumentSnapshot Model] ---");
    const snapshot1 = await prisma.documentSnapshot.create({
      data: {
        documentId: nestedFile.id,
        version: 1,
        storageReference: "s3://snapshots/math_v1.bin",
      },
    });

    const snapshot2 = await prisma.documentSnapshot.create({
      data: {
        documentId: nestedFile.id,
        version: 2,
        storageReference: "s3://snapshots/math_v2.bin",
      },
    });

    assert(
      snapshot1.version === 1 && snapshot2.version === 2,
      "Multiple snapshots created for same file with incrementing versions"
    );

    // Duplicate version rejection
    let duplicateVersionRejected = false;
    try {
      await prisma.documentSnapshot.create({
        data: {
          documentId: nestedFile.id,
          version: 1, // duplicate version
          storageReference: "s3://snapshots/math_v1_dup.bin",
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        duplicateVersionRejected = true;
      }
    }
    assert(
      duplicateVersionRejected,
      "Duplicate snapshot version rejected by [documentId, version] compound unique (P2002)"
    );

    // -------------------------------------------------------------------------
    // Clean up test data
    // -------------------------------------------------------------------------
    console.log("\n--- [CLEANUP] ---");
    await prisma.workspace.delete({ where: { id: workspace2.id } });
    await prisma.workspace.delete({ where: { id: workspace1.id } }); // Cascades to members, files, snapshots, messages, executions, activities
    await prisma.user.delete({ where: { id: user2.id } });
    await prisma.user.delete({ where: { id: user1.id } });
    console.log("🧹 Test records cleaned up successfully.");
  } catch (error) {
    console.error("❌ Unexpected test runner error:", error);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log("\n=================================================");
  console.log(`📊 DATABASE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

void runDatabaseTests();
