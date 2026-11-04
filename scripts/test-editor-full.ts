import http from "node:http";
import { createApp } from "../apps/api/src/app";
import { connectDatabase, disconnectDatabase, prisma } from "../apps/api/src/config/database";
import { getMonacoLanguage, getLanguageDisplayName } from "../apps/web/lib/editor/languageUtils";
import { assertTestDatabase, TestFixtureTracker } from "./testDbGuard";

async function runEditorFullTests() {
  console.log("=================================================");
  console.log("🧪 STARTING CHUNK 7 COMPREHENSIVE EDITOR & PERSISTENCE TESTS");
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

  // -------------------------------------------------------------------------
  // UNIT TESTS: Language Detection & Extension Mapping
  // -------------------------------------------------------------------------
  console.log("\n--- [UNIT TEST 1: Language Detection & Extension Mappings] ---");

  // C++ mappings: .cpp, .cc, .cxx, .hpp, .h
  assert(getMonacoLanguage("main.cpp") === "cpp", ".cpp maps to 'cpp'");
  assert(getMonacoLanguage("engine.cc") === "cpp", ".cc maps to 'cpp'");
  assert(getMonacoLanguage("algo.cxx") === "cpp", ".cxx maps to 'cpp'");
  assert(getMonacoLanguage("types.hpp") === "cpp", ".hpp maps to 'cpp'");
  assert(getMonacoLanguage("header.h") === "cpp", ".h maps to 'cpp'");
  assert(getLanguageDisplayName("cpp") === "C++", "'cpp' display name is 'C++'");

  // Python mapping: .py
  assert(getMonacoLanguage("script.py") === "python", ".py maps to 'python'");
  assert(getLanguageDisplayName("python") === "Python", "'python' display name is 'Python'");

  // JavaScript mappings: .js, .jsx, .mjs, .cjs
  assert(getMonacoLanguage("app.js") === "javascript", ".js maps to 'javascript'");
  assert(getMonacoLanguage("Component.jsx") === "javascript", ".jsx maps to 'javascript'");
  assert(getMonacoLanguage("module.mjs") === "javascript", ".mjs maps to 'javascript'");
  assert(getMonacoLanguage("bundle.cjs") === "javascript", ".cjs maps to 'javascript'");
  assert(
    getLanguageDisplayName("javascript") === "JavaScript",
    "'javascript' display name is 'JavaScript'"
  );

  // Java mapping: .java
  assert(getMonacoLanguage("Main.java") === "java", ".java maps to 'java'");
  assert(getLanguageDisplayName("java") === "Java", "'java' display name is 'Java'");

  // Unsupported extensions fallback to 'plaintext' without misclassification
  assert(getMonacoLanguage("notes.txt") === "plaintext", ".txt falls back to 'plaintext'");
  assert(getMonacoLanguage("unknown_file") === "plaintext", "No-ext falls back to 'plaintext'");
  assert(getMonacoLanguage(".gitignore") === "plaintext", "Dotfile falls back to 'plaintext'");
  assert(
    getLanguageDisplayName("plaintext") === "Plain Text",
    "'plaintext' display name is 'Plain Text'"
  );

  // -------------------------------------------------------------------------
  // BACKEND INTEGRATION: Full File Content Lifecycle for all 4 Languages
  // -------------------------------------------------------------------------
  await connectDatabase();
  await assertTestDatabase(prisma);
  const fixtures = new TestFixtureTracker(prisma);
  const app = createApp();
  const server = http.createServer(app);
  const testPort = 4106;

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
  const ownerEmail = `editor-full-owner-${timestamp}@example.com`;
  const viewerEmail = `editor-full-viewer-${timestamp}@example.com`;
  const outsiderEmail = `editor-full-outsider-${timestamp}@example.com`;
  const password = "Password123!";

  let ownerToken = "";
  let ownerId = "";
  let viewerToken = "";
  let viewerId = "";
  let outsiderToken = "";
  let outsiderId = "";
  let workspaceId = "";

  const createdFileIds: Record<string, string> = {};

  try {
    console.log("\n--- [SETUP: Users & Workspace] ---");
    const regOwner = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ownerEmail, password, name: "Owner Alice" }),
    });
    ownerToken = regOwner.body?.data?.accessToken;
    ownerId = regOwner.body?.data?.user?.id;
    if (ownerId) fixtures.trackUser(ownerId);
    assert(regOwner.status === 201, "Owner user registered");

    const regViewer = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: viewerEmail, password, name: "Viewer Bob" }),
    });
    viewerToken = regViewer.body?.data?.accessToken;
    viewerId = regViewer.body?.data?.user?.id;
    if (viewerId) fixtures.trackUser(viewerId);
    assert(regViewer.status === 201, "Viewer user registered");

    const regOutsider = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: outsiderEmail, password, name: "Outsider Charlie" }),
    });
    outsiderToken = regOutsider.body?.data?.accessToken;
    outsiderId = regOutsider.body?.data?.user?.id;
    if (outsiderId) fixtures.trackUser(outsiderId);
    assert(regOutsider.status === 201, "Outsider user registered");

    const wsRes = await request("/api/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ name: "Editor Multi-Language Project" }),
    });
    workspaceId = wsRes.body?.data?.id;
    if (workspaceId) fixtures.trackWorkspace(workspaceId);
    assert(wsRes.status === 201, "Workspace created successfully");

    // Add viewer to workspace
    await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: viewerId,
        role: "VIEWER",
      },
    });

    // -------------------------------------------------------------------------
    // TEST 2: Creation & Content Retrieval for all 4 Supported Languages
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 2: Four Languages Source Code Persistence & Retrieval] ---");

    const testFiles = [
      {
        name: "main.cpp",
        lang: "cpp",
        initialCode: `#include <iostream>\n\nint main() {\n    std::cout << "Hello C++ CodeSync!" << std::endl;\n    return 0;\n}\n`,
        updatedCode: `#include <iostream>\n\nint main() {\n    std::cout << "Persisted C++ Modifications!" << std::endl;\n    return 0;\n}\n`,
      },
      {
        name: "main.py",
        lang: "python",
        initialCode: `def greet(name: str) -> str:\n    return f"Hello, {name}!"\n\nif __name__ == "__main__":\n    print(greet("Python CodeSync"))\n`,
        updatedCode: `def greet(name: str) -> str:\n    return f"Hello, {name}!"\n\nif __name__ == "__main__":\n    print(greet("Persisted Python Modifications!"))\n`,
      },
      {
        name: "app.js",
        lang: "javascript",
        initialCode: `function calculateTotal(items) {\n    return items.reduce((sum, item) => sum + item.price, 0);\n}\nconsole.log("JavaScript ready!");\n`,
        updatedCode: `function calculateTotal(items) {\n    return items.reduce((sum, item) => sum + item.price, 0);\n}\nconsole.log("Persisted JavaScript Modifications!");\n`,
      },
      {
        name: "Main.java",
        lang: "java",
        initialCode: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello Java CodeSync!");\n    }\n}\n`,
        updatedCode: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Persisted Java Modifications!");\n    }\n}\n`,
      },
    ];

    for (const tf of testFiles) {
      // 1. Create file in workspace
      const createRes = await prisma.file.create({
        data: {
          name: tf.name,
          type: "FILE",
          content: tf.initialCode,
          workspaceId,
        },
      });
      createdFileIds[tf.name] = createRes.id;
      assert(!!createRes.id, `Created ${tf.name} (${tf.lang})`);

      // 2. Retrieve file content via GET /api/files/:id
      const getRes = await request(`/api/files/${createRes.id}`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert(getRes.status === 200, `GET /api/files/:id returns 200 for ${tf.name}`);
      assert(
        getRes.body?.data?.content === tf.initialCode,
        `Initial content matches for ${tf.name}`
      );

      // 3. Save modified content via PUT /api/files/:id
      const saveRes = await request(`/api/files/${createRes.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ content: tf.updatedCode, expectedVersion: 1 }),
      });
      assert(saveRes.status === 200, `PUT /api/files/:id returns 200 for ${tf.name}`);
      assert(
        saveRes.body?.data?.content === tf.updatedCode,
        `Save response returns updated content for ${tf.name}`
      );

      // 4. Reload file to verify database persistence across reloads
      const reloadRes = await request(`/api/files/${createRes.id}`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert(
        reloadRes.body?.data?.content === tf.updatedCode,
        `Reloaded file reflects persisted changes for ${tf.name}`
      );
    }

    // -------------------------------------------------------------------------
    // TEST 3: RBAC Authorization & Security Verification
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 3: RBAC Authorization & Folder Security] ---");
    const cppFileId = createdFileIds["main.cpp"];

    // Viewer can read all files
    const viewerReadRes = await request(`/api/files/${cppFileId}`, {
      headers: { Authorization: `Bearer ${viewerToken}` },
    });
    assert(viewerReadRes.status === 200, "Viewer role can read file content");

    // Viewer is rejected from saving changes (403 Forbidden)
    const viewerSaveRes = await request(`/api/files/${cppFileId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${viewerToken}`,
      },
      body: JSON.stringify({ content: "Malicious viewer edit", expectedVersion: 2 }),
    });
    assert(viewerSaveRes.status === 403, "Viewer role rejected with 403 Forbidden on file save");

    // Outsider cannot read or write
    const outsiderReadRes = await request(`/api/files/${cppFileId}`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    assert(outsiderReadRes.status === 403, "Outsider rejected with 403 Forbidden on file read");

    const outsiderWriteRes = await request(`/api/files/${cppFileId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${outsiderToken}`,
      },
      body: JSON.stringify({ content: "Malicious outsider edit", expectedVersion: 2 }),
    });
    assert(outsiderWriteRes.status === 403, "Outsider rejected with 403 Forbidden on file save");

    // Unauthenticated request is rejected with 401
    const unauthRes = await request(`/api/files/${cppFileId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Unauthenticated edit", expectedVersion: 2 }),
    });
    assert(unauthRes.status === 401, "Unauthenticated request rejected with 401");

    // Folder cannot have content retrieved or modified
    const folder = await prisma.file.create({
      data: {
        name: "test-dir",
        type: "FOLDER",
        workspaceId,
      },
    });

    const folderGetRes = await request(`/api/files/${folder.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(
      folderGetRes.status === 400 && folderGetRes.body?.code === "CANNOT_OPEN_FOLDER",
      "Folder read rejected with CANNOT_OPEN_FOLDER"
    );

    const folderPutRes = await request(`/api/files/${folder.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ content: "Should not work", expectedVersion: 1 }),
    });
    assert(
      folderPutRes.status === 400 && folderPutRes.body?.code === "CANNOT_MODIFY_FOLDER",
      "Folder save rejected with CANNOT_MODIFY_FOLDER"
    );
  } finally {
    console.log("\n--- [CLEANUP] ---");
    try {
      await fixtures.cleanup();
      await fixtures.verifyCleanup();
    } catch (cleanupErr) {
      console.error("  ❌ Cleanup error:", cleanupErr);
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await disconnectDatabase();
  }

  console.log("\n=================================================");
  console.log(`📊 COMPREHENSIVE EDITOR TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

void runEditorFullTests();
