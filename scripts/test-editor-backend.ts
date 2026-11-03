import http from "node:http";
import { createApp } from "../apps/api/src/app";
import { connectDatabase, disconnectDatabase, prisma } from "../apps/api/src/config/database";

async function runEditorBackendTests() {
  console.log("=================================================");
  console.log("🧪 STARTING CHUNK 7 EDITOR BACKEND INTEGRATION TESTS");
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

  await connectDatabase();
  const app = createApp();
  const server = http.createServer(app);
  const testPort = 4105;

  await new Promise<void>((resolve) => {
    server.listen(testPort, () => {
      console.log(`  📡 Test server listening on http://localhost:${testPort}`);
      resolve();
    });
  });

  async function request(path: string, options: RequestInit = {}) {
    const res = await fetch(`http://localhost:${testPort}${path}`, options);
    const body = (await res.json().catch(() => null)) as Record<string, any> | null;
    return { status: res.status, body };
  }

  const timestamp = Date.now();
  const ownerEmail = `editor-owner-${timestamp}@example.com`;
  const viewerEmail = `editor-viewer-${timestamp}@example.com`;
  const outsiderEmail = `editor-outsider-${timestamp}@example.com`;
  const password = "Password123!";

  let ownerToken = "";
  let ownerId = "";
  let viewerToken = "";
  let viewerId = "";
  let outsiderToken = "";
  let outsiderId = "";
  let workspaceId = "";
  let testFileId = "";
  let testFolderId = "";

  try {
    // -------------------------------------------------------------------------
    // SETUP: Create users and workspace
    // -------------------------------------------------------------------------
    console.log("\n--- [SETUP: Users & Workspace] ---");
    const regOwner = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ownerEmail, password, name: "Owner Alice" }),
    });
    ownerToken = regOwner.body?.data?.accessToken;
    ownerId = regOwner.body?.data?.user?.id;
    assert(regOwner.status === 201, "Owner registered");

    const regViewer = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: viewerEmail, password, name: "Viewer Bob" }),
    });
    viewerToken = regViewer.body?.data?.accessToken;
    viewerId = regViewer.body?.data?.user?.id;
    assert(regViewer.status === 201, "Viewer registered");

    const regOutsider = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: outsiderEmail, password, name: "Outsider Charlie" }),
    });
    outsiderToken = regOutsider.body?.data?.accessToken;
    outsiderId = regOutsider.body?.data?.user?.id;
    assert(regOutsider.status === 201, "Outsider registered");

    const wsRes = await request("/api/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ name: "Editor Test Workspace" }),
    });
    workspaceId = wsRes.body?.data?.id;
    assert(wsRes.status === 201, "Workspace created");

    // Add viewer to workspace
    await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: viewerId,
        role: "VIEWER",
      },
    });

    // Create a folder and a file
    const folderRes = await request(`/api/workspaces/${workspaceId}/folders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ name: "src", parentId: null }),
    });
    testFolderId = folderRes.body?.data?.id;
    assert(folderRes.status === 201, "Folder created");

    const initialContent = `#include <iostream>\n\nint main() {\n    std::cout << "Hello CodeSync!" << std::endl;\n    return 0;\n}\n`;
    const fileRes = await prisma.file.create({
      data: {
        name: "main.cpp",
        type: "FILE",
        content: initialContent,
        workspaceId,
        parentId: testFolderId,
      },
    });
    testFileId = fileRes.id;
    assert(!!testFileId, "C++ test file created with initial content");

    // -------------------------------------------------------------------------
    // TEST 1: GET /api/files/:fileId (Read Content)
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 1: GET /api/files/:fileId] ---");
    const getRes = await request(`/api/files/${testFileId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(getRes.status === 200, "Owner can retrieve file content (200 OK)");
    assert(getRes.body?.success === true, "Response has success: true");
    assert(getRes.body?.data?.name === "main.cpp", "File name is correct");
    assert(getRes.body?.data?.type === "FILE", "File type is FILE");
    assert(
      getRes.body?.data?.content === initialContent,
      "File content matches expected initial code"
    );

    // Viewer can also read
    const viewerGetRes = await request(`/api/files/${testFileId}`, {
      headers: { Authorization: `Bearer ${viewerToken}` },
    });
    assert(viewerGetRes.status === 200, "Viewer role can read file content (200 OK)");

    // Outsider cannot read
    const outsiderGetRes = await request(`/api/files/${testFileId}`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    assert(outsiderGetRes.status === 403, "Outsider cannot read file content (403 Forbidden)");

    // Attempting to read a folder returns 400
    const folderGetRes = await request(`/api/files/${testFolderId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(folderGetRes.status === 400, "Attempting to retrieve content for folder returns 400");
    assert(folderGetRes.body?.code === "CANNOT_OPEN_FOLDER", "Error code is CANNOT_OPEN_FOLDER");

    // -------------------------------------------------------------------------
    // TEST 2: PUT /api/files/:fileId (Save/Update Content)
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 2: PUT /api/files/:fileId] ---");
    const updatedContent = `#include <iostream>\n\nint main() {\n    std::cout << "Updated CodeSync C++ Editor!" << std::endl;\n    return 0;\n}\n`;

    const saveRes = await request(`/api/files/${testFileId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ content: updatedContent }),
    });
    assert(saveRes.status === 200, "Owner can save updated file content (200 OK)");
    assert(saveRes.body?.data?.content === updatedContent, "Response returns updated content");

    // Verify in database directly
    const dbFile = await prisma.file.findUnique({ where: { id: testFileId } });
    assert(dbFile?.content === updatedContent, "Database reflects updated content");

    // Test alias route: PUT /api/files/:fileId/content
    const aliasContent = `#include <iostream>\n// Alias updated\n`;
    const aliasRes = await request(`/api/files/${testFileId}/content`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ content: aliasContent }),
    });
    assert(aliasRes.status === 200, "Alias route PUT /api/files/:fileId/content works");

    // -------------------------------------------------------------------------
    // TEST 3: Permission & Guard Checks on Save
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 3: Permission & Guard Checks] ---");
    // Viewer cannot save (read-only role)
    const viewerSaveRes = await request(`/api/files/${testFileId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${viewerToken}`,
      },
      body: JSON.stringify({ content: "Malicious edit" }),
    });
    assert(viewerSaveRes.status === 403, "Viewer role cannot save file content (403 Forbidden)");

    // Outsider cannot save
    const outsiderSaveRes = await request(`/api/files/${testFileId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${outsiderToken}`,
      },
      body: JSON.stringify({ content: "Malicious edit" }),
    });
    assert(outsiderSaveRes.status === 403, "Outsider cannot save file content (403 Forbidden)");

    // Cannot save content to a folder
    const folderSaveRes = await request(`/api/files/${testFolderId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ content: "Some content" }),
    });
    assert(folderSaveRes.status === 400, "Cannot save content to a folder (400 Bad Request)");
    assert(
      folderSaveRes.body?.code === "CANNOT_MODIFY_FOLDER",
      "Error code is CANNOT_MODIFY_FOLDER"
    );

    // Non-existent file ID
    const notFoundRes = await request("/api/files/00000000-0000-0000-0000-000000000000", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ content: "test" }),
    });
    assert(notFoundRes.status === 404, "Non-existent file returns 404 Not Found");

    // Invalid non-UUID file ID
    const badUuidRes = await request("/api/files/not-a-uuid", {
      method: "GET",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(badUuidRes.status === 400, "Invalid UUID parameter returns 400");
  } finally {
    console.log("\n--- [CLEANUP] ---");
    if (workspaceId) {
      await prisma.file.deleteMany({ where: { workspaceId } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId } });
      await prisma.workspace.delete({ where: { id: workspaceId } });
    }
    const userIds = [ownerId, viewerId, outsiderId].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await disconnectDatabase();
  }

  console.log("\n=================================================");
  console.log(`📊 EDITOR BACKEND TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

void runEditorBackendTests();
