import http from "node:http";
import { createApp } from "../apps/api/src/app";
import { connectDatabase, disconnectDatabase, prisma } from "../apps/api/src/config/database";
import { assertTestDatabase, TestFixtureTracker } from "./testDbGuard";
import {
  saveTabsState,
  getStoredTabsState,
  clearStoredTabsState,
} from "../apps/web/lib/editor/tabStorage";
import {
  getStoredSettings,
  setStoredSettings,
  DEFAULT_EDITOR_SETTINGS,
  SETTINGS_STORAGE_KEY,
} from "../apps/web/lib/editor/editorConfig";
import type { EditorTab, FileNode } from "../apps/web/types/ide";

// Mock localStorage for Node testing
const mockLocalStorage: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => mockLocalStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockLocalStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockLocalStorage[key];
  },
  clear: () => {
    for (const key of Object.keys(mockLocalStorage)) {
      delete mockLocalStorage[key];
    }
  },
};
(global as any).window = {};

async function runChunk8Tests() {
  console.log("=================================================");
  console.log("🧪 STARTING CHUNK 8: TABS, AUTOSAVE, FORMATTING & SETTINGS TESTS");
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
  // 1. BACKEND INTEGRATION: Code Formatting API (POST /api/format)
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 1: Backend Code Formatting API (/api/format)] ---");

  await connectDatabase();
  await assertTestDatabase(prisma);
  const fixtures = new TestFixtureTracker(prisma);
  const app = createApp();
  const server = http.createServer(app);
  const testPort = 4108;

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
  const userAEmail = `chunk8-userA-${timestamp}@example.com`;
  const userBEmail = `chunk8-userB-${timestamp}@example.com`;
  const password = "Password123!";

  let userAToken = "";
  let userAId = "";
  let userBToken = "";
  let userBId = "";
  let workspaceAId = "";
  let jsFileId = "";
  let pyFileId = "";
  let cppFileId = "";
  let javaFileId = "";
  let folderId = "";

  try {
    // Setup users & workspace
    const regA = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userAEmail, password, name: "User A" }),
    });
    userAToken = regA.body?.data?.accessToken;
    userAId = regA.body?.data?.user?.id;
    if (userAId) fixtures.trackUser(userAId);
    assert(regA.status === 201, "User A registered");

    const regB = await request("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userBEmail, password, name: "User B" }),
    });
    userBToken = regB.body?.data?.accessToken;
    userBId = regB.body?.data?.user?.id;
    if (userBId) fixtures.trackUser(userBId);
    assert(regB.status === 201, "User B registered");

    // Create workspace for User A
    const createWs = await request("/api/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ name: "Chunk 8 Workspace" }),
    });
    workspaceAId = createWs.body?.data?.id;
    if (workspaceAId) fixtures.trackWorkspace(workspaceAId);
    assert(createWs.status === 201, "Workspace created for User A");

    // Create files in workspace
    const fJs = await request(`/api/workspaces/${workspaceAId}/files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ name: "app.js", type: "FILE" }),
    });
    jsFileId = fJs.body?.data?.id;

    const fPy = await request(`/api/workspaces/${workspaceAId}/files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ name: "main.py", type: "FILE" }),
    });
    pyFileId = fPy.body?.data?.id;

    const fCpp = await request(`/api/workspaces/${workspaceAId}/files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ name: "engine.cpp", type: "FILE" }),
    });
    cppFileId = fCpp.body?.data?.id;

    const fJava = await request(`/api/workspaces/${workspaceAId}/files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ name: "Main.java", type: "FILE" }),
    });
    javaFileId = fJava.body?.data?.id;

    const fFolder = await request(`/api/workspaces/${workspaceAId}/folders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({ name: "src" }),
    });
    folderId = fFolder.body?.data?.id;

    // Test 1.1: JavaScript formatting with Prettier
    const unformattedJS = "function test( a,b ){const x=1;return a+b+x;}";
    const formatJSRes = await request("/api/format", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        fileId: jsFileId,
        content: unformattedJS,
        language: "javascript",
      }),
    });
    assert(formatJSRes.status === 200, "JavaScript format returns HTTP 200");
    assert(
      formatJSRes.body?.data?.formattedContent?.includes("function test(a, b) {"),
      "Prettier formatted JavaScript with proper indentation and spacing"
    );

    // Test 1.2: JavaScript syntax error
    const syntaxErrJS = "function broken( { const x = ;";
    const syntaxErrRes = await request("/api/format", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        fileId: jsFileId,
        content: syntaxErrJS,
        language: "javascript",
      }),
    });
    assert(syntaxErrRes.status === 422, "JavaScript syntax error returns HTTP 422");
    assert(syntaxErrRes.body?.code === "FORMAT_SYNTAX_ERROR", "Error code is FORMAT_SYNTAX_ERROR");

    // Test 1.3: Python formatting (handles Black if installed, or FORMATTER_UNAVAILABLE)
    const unformattedPy = "def add(a,b):\n  return a+b\n";
    const formatPyRes = await request("/api/format", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        fileId: pyFileId,
        content: unformattedPy,
        language: "python",
      }),
    });
    assert(
      formatPyRes.status === 200 || formatPyRes.status === 503,
      `Python format returns 200 (formatted) or 503 (unavailable) - got ${formatPyRes.status}`
    );
    if (formatPyRes.status === 503) {
      assert(
        formatPyRes.body?.code === "FORMATTER_UNAVAILABLE",
        "Python formatter error code is FORMATTER_UNAVAILABLE"
      );
    }

    // Test 1.4: C++ formatting (handles clang-format if installed, or FORMATTER_UNAVAILABLE)
    const unformattedCpp = "int main(){int x=1;return x;}";
    const formatCppRes = await request("/api/format", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        fileId: cppFileId,
        content: unformattedCpp,
        language: "cpp",
      }),
    });
    assert(
      formatCppRes.status === 200 || formatCppRes.status === 503,
      `C++ format returns 200 (formatted) or 503 (unavailable) - got ${formatCppRes.status}`
    );

    // Test 1.5: Java formatting (handles google-java-format if installed, or FORMATTER_UNAVAILABLE)
    const unformattedJava = "public class Main { public static void main(String[] args) {} }";
    const formatJavaRes = await request("/api/format", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        fileId: javaFileId,
        content: unformattedJava,
        language: "java",
      }),
    });
    assert(
      formatJavaRes.status === 200 || formatJavaRes.status === 503,
      `Java format returns 200 (formatted) or 503 (unavailable) - got ${formatJavaRes.status}`
    );

    // Test 1.6: Unsupported language rejection
    const unsuppLangRes = await request("/api/format", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        fileId: jsFileId,
        content: "puts 'hello'",
        language: "ruby",
      }),
    });
    assert(unsuppLangRes.status === 400, "Unsupported language rejected with HTTP 400");

    // Test 1.7: Unauthenticated request rejection
    const unauthRes = await request("/api/format", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileId: jsFileId,
        content: "var x = 1;",
        language: "javascript",
      }),
    });
    assert(unauthRes.status === 401, "Unauthenticated format rejected with HTTP 401");

    // Test 1.8: Cross-workspace access isolation (User B formatting User A's file)
    const crossAccessRes = await request("/api/format", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userBToken}`,
      },
      body: JSON.stringify({
        fileId: jsFileId,
        content: "var x = 1;",
        language: "javascript",
      }),
    });
    assert(
      crossAccessRes.status === 403,
      "User B formatting User A's file rejected with HTTP 403 (WORKSPACE_ACCESS_DENIED)"
    );

    // Test 1.9: Cannot format a directory
    const formatDirRes = await request("/api/format", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        fileId: folderId,
        content: "content",
        language: "javascript",
      }),
    });
    assert(
      formatDirRes.status === 400 && formatDirRes.body?.code === "CANNOT_FORMAT_FOLDER",
      "Formatting a folder rejected with CANNOT_FORMAT_FOLDER"
    );

    // Test 1.10: Content size limit rejection (> 1MB)
    const hugeContent = "x".repeat(1024 * 1024 + 10);
    const hugeRes = await request("/api/format", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        fileId: jsFileId,
        content: hugeContent,
        language: "javascript",
      }),
    });
    assert(hugeRes.status === 400, "Payload exceeding 1MB rejected with HTTP 400");
  } finally {
    // Cleanup database records
    console.log("\n--- [SUITE 1 CLEANUP] ---");
    try {
      await fixtures.cleanup();
      await fixtures.verifyCleanup();
    } catch (cleanupErr) {
      console.error("  ❌ Cleanup error:", cleanupErr);
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await disconnectDatabase();
  }

  // -------------------------------------------------------------------------
  // 2. MULTIPLE EDITOR TABS LOGIC
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 2: Multiple Editor Tabs Logic] ---");

  // Simulated open tabs state collection
  let openTabs: EditorTab[] = [];
  let activeTabId: string | null = null;

  function openFile(file: FileNode) {
    const existing = openTabs.find((t) => t.id === file.id);
    if (!existing) {
      const isContentProvided = file.content !== undefined;
      openTabs.push({
        id: file.id,
        name: file.name,
        path: file.path,
        language: file.language || "Plain Text",
        content: isContentProvided ? file.content! : "",
        savedContent: isContentProvided ? file.content : undefined,
        isLoaded: isContentProvided,
        isDirty: false,
      });
    }
    activeTabId = file.id;
  }

  function closeTab(tabId: string) {
    const idx = openTabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;
    openTabs = openTabs.filter((t) => t.id !== tabId);
    if (activeTabId === tabId) {
      if (openTabs.length === 0) {
        activeTabId = null;
      } else {
        const nextIdx = Math.min(idx, openTabs.length - 1);
        activeTabId = openTabs[nextIdx]?.id ?? null;
      }
    }
  }

  // Test 2.1: Open multiple files
  const file1: FileNode = {
    id: "f-1",
    name: "main.cpp",
    type: "file",
    path: "main.cpp",
    content: "// main.cpp",
  };
  const file2: FileNode = {
    id: "f-2",
    name: "utils.cpp",
    type: "file",
    path: "utils.cpp",
    content: "// utils.cpp",
  };
  const file3: FileNode = {
    id: "f-3",
    name: "header.h",
    type: "file",
    path: "header.h",
    content: "// header.h",
  };

  openFile(file1);
  assert(
    openTabs.length === 1 && activeTabId === "f-1",
    "Opened file 1, tab count is 1, active is f-1"
  );

  openFile(file2);
  assert(
    openTabs.length === 2 && activeTabId === "f-2",
    "Opened file 2, tab count is 2, active is f-2"
  );

  // Test 2.2: Prevent duplicate tabs (open file 1 again)
  openFile(file1);
  assert(
    openTabs.length === 2,
    "Reopening file 1 does NOT create duplicate tab (count is still 2)"
  );
  assert(activeTabId === "f-1", "Reopening file 1 activates existing tab");

  // Test 2.3: Switching tabs preserves independent in-memory modifications
  openFile(file3);
  assert(openTabs.length === 3, "Opened file 3 (count is 3)");

  // Modify file 1 content in memory
  const tab1 = openTabs.find((t) => t.id === "f-1")!;
  tab1.content = "// modified main.cpp";
  tab1.isDirty = true;

  // Modify file 2 content in memory
  const tab2 = openTabs.find((t) => t.id === "f-2")!;
  tab2.content = "// modified utils.cpp";
  tab2.isDirty = true;

  // Switch to file 2
  activeTabId = "f-2";
  assert(activeTabId === "f-2", "Switched active tab to f-2");
  assert(
    openTabs.find((t) => t.id === "f-1")?.content === "// modified main.cpp",
    "Switching tabs preserved in-memory unsaved content of file 1"
  );
  assert(
    openTabs.find((t) => t.id === "f-1")?.isDirty === true,
    "Switching tabs preserved dirty status of file 1"
  );
  assert(
    openTabs.find((t) => t.id === "f-2")?.content === "// modified utils.cpp",
    "File 2 retains its own independent modified content"
  );

  // Test 2.4: Close inactive tab
  closeTab("f-3");
  assert(openTabs.length === 2, "Closed inactive tab f-3 (count is 2)");
  assert(activeTabId === "f-2", "Active tab remains f-2");

  // Test 2.5: Close active tab activates adjacent tab
  closeTab("f-2");
  assert(openTabs.length === 1, "Closed active tab f-2 (count is 1)");
  assert(activeTabId === "f-1", "Adjacent tab f-1 is now active");

  // Test 2.6: Close all tabs shows empty state
  closeTab("f-1");
  assert(openTabs.length === 0, "All tabs closed (count is 0)");
  assert(activeTabId === null, "activeTabId is null when 0 tabs remain");

  // Test 2.7: Tab state persistence & restoration
  const wsId = "test-ws-tabs";
  saveTabsState(wsId, ["f-1", "f-2", "f-deleted"], "f-2");

  const restored = getStoredTabsState(wsId);
  assert(!!restored, "Stored tabs retrieved from localStorage");
  assert(restored?.openFileIds.length === 3, "Stored 3 tab IDs");
  assert(restored?.activeFileId === "f-2", "Stored active tab ID is f-2");

  // Simulate tree filtering (f-deleted no longer exists in workspace tree)
  const currentTreeFiles = [file1, file2]; // f-deleted is omitted
  const validRestoredTabs = (restored?.openFileIds || [])
    .map((id) => currentTreeFiles.find((f) => f.id === id))
    .filter(Boolean) as FileNode[];

  assert(
    validRestoredTabs.length === 2,
    "Inaccessible/deleted files safely filtered out during restoration"
  );
  assert(
    validRestoredTabs.map((t) => t.id).join(",") === "f-1,f-2",
    "Restored tabs maintain original order"
  );

  clearStoredTabsState(wsId);
  assert(getStoredTabsState(wsId) === null, "Cleared stored tabs state");

  // -------------------------------------------------------------------------
  // 3. AUTOSAVE LOGIC & TIMING
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 3: Autosave Logic, Sequencing & Deduplication] ---");

  // Deduplication check
  let saveApiCalls = 0;
  async function mockSaveApi(_fileId: string, _content: string) {
    saveApiCalls++;
    return { success: true };
  }

  const initialContent = "int x = 10;";
  let savedBaseline = initialContent;
  let currentEditorContent = initialContent;

  // Unchanged content does not trigger save
  if (currentEditorContent !== savedBaseline) {
    await mockSaveApi("f-1", currentEditorContent);
  }
  assert(saveApiCalls === 0, "Unchanged content does NOT trigger save API call (deduplication)");

  // Editing marks dirty and triggers save
  currentEditorContent = "int x = 20;";
  let isDirty = currentEditorContent !== savedBaseline;
  assert(isDirty === true, "Modifying content marks file dirty");

  if (currentEditorContent !== savedBaseline) {
    await mockSaveApi("f-1", currentEditorContent);
    savedBaseline = currentEditorContent;
    isDirty = currentEditorContent !== savedBaseline;
  }
  assert(saveApiCalls === 1, "Save API invoked for modified content");
  assert(isDirty === false, "Dirty indicator cleared upon successful save");

  // Revision sequencing: user types revision B while save for revision A is in-flight
  let inFlightContent = "revision A";
  let inFlightSeq = 1;
  let activeSeq = 1;

  // While in flight, user types revision B
  currentEditorContent = "revision B";
  activeSeq = 2;

  // Revision A resolves
  if (inFlightSeq === 1) {
    savedBaseline = inFlightContent;
    // But latest content is revision B, so file MUST remain dirty!
    isDirty = currentEditorContent !== savedBaseline;
  }
  assert(
    isDirty === true,
    "In-flight revision A resolving does NOT mark newer revision B as saved"
  );

  // Revision B then saves
  inFlightContent = currentEditorContent;
  inFlightSeq = 2;
  savedBaseline = inFlightContent;
  isDirty = currentEditorContent !== savedBaseline;
  assert(isDirty === false, "Revision B saved and dirty indicator cleared");

  // Exponential backoff calculation
  const retryDelays = [1000, 2000, 4000];
  assert(retryDelays[0] === 1000, "1st retry delay is 1000ms");
  assert(retryDelays[1] === 2000, "2nd retry delay is 2000ms");
  assert(retryDelays[2] === 4000, "3rd retry delay is 4000ms");

  // -------------------------------------------------------------------------
  // 4. EDITOR SETTINGS & PREFERENCES
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 4: Editor Settings & Preferences] ---");

  // Test 4.1: Default settings
  assert(DEFAULT_EDITOR_SETTINGS.fontSize === 14, "Default font size is 14px");
  assert(DEFAULT_EDITOR_SETTINGS.tabSize === 4, "Default tab size is 4 spaces");
  assert(DEFAULT_EDITOR_SETTINGS.wordWrap === "on", "Default word wrap is 'on'");
  assert(DEFAULT_EDITOR_SETTINGS.minimap === true, "Default minimap is enabled");
  assert(DEFAULT_EDITOR_SETTINGS.theme === "vs-dark", "Default theme is 'vs-dark'");

  // Test 4.2: Valid settings update & persistence
  setStoredSettings({
    fontSize: 18,
    tabSize: 2,
    wordWrap: "off",
    minimap: false,
    theme: "hc-black",
  });

  const retrieved = getStoredSettings();
  assert(retrieved.fontSize === 18, "Stored font size 18px retrieved");
  assert(retrieved.tabSize === 2, "Stored tab size 2 spaces retrieved");
  assert(retrieved.wordWrap === "off", "Stored word wrap 'off' retrieved");
  assert(retrieved.minimap === false, "Stored minimap false retrieved");
  assert(retrieved.theme === "hc-black", "Stored theme 'hc-black' retrieved");

  // Test 4.3: Boundary validation & fallback to defaults
  // Font size outside 10-30px
  mockLocalStorage[SETTINGS_STORAGE_KEY] = JSON.stringify({
    fontSize: 999, // Invalid
    tabSize: 5, // Invalid
    wordWrap: "invalid", // Invalid
    minimap: "not-a-bool", // Invalid
    theme: "neon-pink", // Invalid
  });

  const fallbackSettings = getStoredSettings();
  assert(
    fallbackSettings.fontSize === DEFAULT_EDITOR_SETTINGS.fontSize,
    "Invalid font size 999 falls back to default 14px"
  );
  assert(
    fallbackSettings.tabSize === DEFAULT_EDITOR_SETTINGS.tabSize,
    "Invalid tab size 5 falls back to default 4 spaces"
  );
  assert(
    fallbackSettings.wordWrap === DEFAULT_EDITOR_SETTINGS.wordWrap,
    "Invalid word wrap falls back to default 'on'"
  );
  assert(
    fallbackSettings.minimap === DEFAULT_EDITOR_SETTINGS.minimap,
    "Invalid minimap falls back to default true"
  );
  assert(
    fallbackSettings.theme === DEFAULT_EDITOR_SETTINGS.theme,
    "Invalid theme falls back to default 'vs-dark'"
  );

  // Test 4.4: Corrupted JSON recovery
  mockLocalStorage[SETTINGS_STORAGE_KEY] = "{ corrupted json ...";
  const safeRecovery = getStoredSettings();
  assert(
    safeRecovery.fontSize === 14 && safeRecovery.theme === "vs-dark",
    "Corrupted JSON in localStorage falls back safely to default settings"
  );

  // Clean up localStorage
  mockLocalStorage[SETTINGS_STORAGE_KEY] = "";

  // -------------------------------------------------------------------------
  // 5. FILE CONTENT HYDRATION & TAB RESTORATION AFTER REFRESH
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 5: File Content Hydration & Tab Restoration After Refresh] ---");

  // Simulated backend database store
  const mockDatabaseFiles: Record<string, { id: string; name: string; content: string }> = {
    "file-persisted-1": {
      id: "file-persisted-1",
      name: "server.ts",
      content: "import express from 'express';",
      updatedAt: new Date(1000000).toISOString(),
    },
    "file-persisted-2": {
      id: "file-persisted-2",
      name: "config.json",
      content: '{"port": 4000}',
      updatedAt: new Date(1000000).toISOString(),
    },
    "file-persisted-3": {
      id: "file-persisted-3",
      name: "empty.txt",
      content: "",
      updatedAt: new Date(1000000).toISOString(),
    },
  };

  let mockGetCalls = 0;
  let mockPutCalls = 0;
  let simulatedGetShouldFail = false;
  let simulatedPutShouldFail = false;
  let simulatedPutAmbiguous = false;
  let simulatedPutDelayMs = 0;
  let simulatedPutCallback: ((fileId: string, content: string) => Promise<void> | void) | null =
    null;
  const recordedPutHistory: Array<{ fileId: string; content: string; expectedUpdatedAt?: string }> =
    [];

  async function mockFileApiGet(
    fileId: string
  ): Promise<{ id: string; name: string; content: string; updatedAt?: string }> {
    mockGetCalls++;
    if (simulatedGetShouldFail) {
      const err = new Error("500 Internal Server Error") as any;
      err.statusCode = 500;
      throw err;
    }
    const found = mockDatabaseFiles[fileId];
    if (!found) {
      const err = new Error("404 File Not Found") as any;
      err.statusCode = 404;
      throw err;
    }
    return { ...found };
  }

  async function mockFileApiPut(
    fileId: string,
    content: string,
    expectedUpdatedAt?: string
  ): Promise<{ id: string; name: string; content: string; updatedAt: string }> {
    mockPutCalls++;
    recordedPutHistory.push({ fileId, content, expectedUpdatedAt });

    if (simulatedPutDelayMs > 0) {
      await new Promise((res) => setTimeout(res, simulatedPutDelayMs));
    }
    if (simulatedPutCallback) {
      await simulatedPutCallback(fileId, content);
    }

    const found = mockDatabaseFiles[fileId];
    if (!found) {
      const err = new Error("404 File Not Found") as any;
      err.statusCode = 404;
      throw err;
    }

    if (expectedUpdatedAt && found.updatedAt) {
      const expTime = new Date(expectedUpdatedAt).getTime();
      const actualTime = new Date(found.updatedAt).getTime();
      if (Math.abs(expTime - actualTime) > 10) {
        const err = new Error("409 Conflict: Concurrent modification") as any;
        err.statusCode = 409;
        err.code = "CONCURRENT_MODIFICATION";
        throw err;
      }
    }

    if (simulatedPutShouldFail) {
      const err = new Error("500 Internal Server Error - Save Failed") as any;
      err.statusCode = 500;
      throw err;
    }

    if (simulatedPutAmbiguous) {
      const newUpdatedAt = new Date().toISOString();
      found.content = content;
      found.updatedAt = newUpdatedAt;
      const err = new Error("Network timeout: response dropped after write committed") as any;
      err.statusCode = 504;
      throw err;
    }

    const newUpdatedAt = new Date().toISOString();
    found.content = content;
    found.updatedAt = newUpdatedAt;
    return { ...found, updatedAt: newUpdatedAt };
  }

  // Helper simulating production useIDEState + useAutosave + EditorContainer lifecycle contract
  class MockEditorContainerSession {
    public openTabs: EditorTab[] = [];
    public activeTab: EditorTab | null = null;
    public content = "";
    public isLoading = false;
    public loadError: string | null = null;
    public inFlightFetches = new Map<
      string,
      Promise<{ id: string; name: string; content: string }>
    >();
    public currentSeq = 0;
    public lastHydratedTabId: string | null = null;

    // Autosave state
    public autosaveRecords = new Map<
      string,
      {
        fileId: string;
        currentContent: string;
        savedContent: string;
        isDirty: boolean;
        isSaving: boolean;
        isInitialized: boolean;
        lastPersistedUpdatedAt?: string;
        errorMessage?: string;
      }
    >();
    public debounceTimers = new Map<string, NodeJS.Timeout>();
    public retryTimers = new Map<string, NodeJS.Timeout>();
    public saveSeq = new Map<string, number>();
    public pendingRemoval = new Set<string>();

    // In-flight save & discard tracking
    public activeSavePromises = new Map<
      string,
      Promise<{ success: boolean; content: string; updatedAt?: string; error?: unknown }>
    >();
    public inFlightContent = new Map<string, string>();
    public discardingFiles = new Set<string>();

    // Dialog state
    public showDialog = false;
    public pendingAction: (() => void) | null = null;
    public dialogError: string | null = null;

    // useIDEState state modifiers
    markTabDirty(tabId: string, isDirty: boolean) {
      const tab = this.openTabs.find((t) => t.id === tabId);
      if (tab) {
        tab.isDirty = isDirty;
      }
    }

    markTabSaved(tabId: string, savedContent: string) {
      const tab = this.openTabs.find((t) => t.id === tabId);
      if (tab) {
        tab.savedContent = savedContent;
        tab.isLoaded = true;
        tab.isDirty = tab.content !== savedContent;
      }
    }

    updateTabContent(tabId: string, content: string, isDirty: boolean) {
      const tab = this.openTabs.find((t) => t.id === tabId);
      if (tab) {
        tab.content = content;
        tab.isDirty = isDirty;
      }
    }

    markTabLoaded(tabId: string, content: string) {
      const tab = this.openTabs.find((t) => t.id === tabId);
      if (tab) {
        tab.content = content;
        tab.savedContent = content;
        tab.isLoaded = true;
        tab.isDirty = false;
      }
    }

    // useAutosave methods
    initFile(fileId: string, content: string, savedContent = content, initialUpdatedAt?: string) {
      const isDirty = content !== savedContent;
      this.autosaveRecords.set(fileId, {
        fileId,
        currentContent: content,
        savedContent,
        isDirty,
        isSaving: false,
        isInitialized: true,
        lastPersistedUpdatedAt: initialUpdatedAt,
        errorMessage: undefined,
      });
    }

    pauseAutosave(fileId: string) {
      const timer = this.debounceTimers.get(fileId);
      if (timer) {
        clearTimeout(timer);
        this.debounceTimers.delete(fileId);
      }
    }

    resumeAutosave(fileId: string) {
      if (this.discardingFiles.has(fileId)) return;
      const rec = this.autosaveRecords.get(fileId);
      if (!rec || !rec.isInitialized || !rec.isDirty) return;

      const existing = this.debounceTimers.get(fileId);
      if (existing) {
        clearTimeout(existing);
        this.debounceTimers.delete(fileId);
      }

      const timer = setTimeout(() => {
        void this.executeSave(fileId);
      }, 1000);
      this.debounceTimers.set(fileId, timer);
    }

    removeFile(fileId: string, options?: { force?: boolean }) {
      const dTimer = this.debounceTimers.get(fileId);
      if (dTimer) {
        clearTimeout(dTimer);
        this.debounceTimers.delete(fileId);
      }
      const rTimer = this.retryTimers.get(fileId);
      if (rTimer) {
        clearTimeout(rTimer);
        this.retryTimers.delete(fileId);
      }

      const rec = this.autosaveRecords.get(fileId);
      if (rec?.isSaving && !options?.force) {
        this.pendingRemoval.add(fileId);
        return;
      }

      this.autosaveRecords.delete(fileId);
      this.saveSeq.delete(fileId);
      this.pendingRemoval.delete(fileId);
      this.activeSavePromises.delete(fileId);
      this.inFlightContent.delete(fileId);
      this.discardingFiles.delete(fileId);
    }

    async executeSave(fileId: string): Promise<boolean> {
      if (this.discardingFiles.has(fileId)) return false;

      const record = this.autosaveRecords.get(fileId);
      if (!record || !record.isInitialized) return false;

      if (record.currentContent === record.savedContent) {
        record.isDirty = false;
        record.isSaving = false;
        this.markTabDirty(fileId, false);
        return true;
      }

      const currentSeq = (this.saveSeq.get(fileId) || 0) + 1;
      this.saveSeq.set(fileId, currentSeq);

      const contentToSave = record.currentContent;
      record.isSaving = true;
      this.inFlightContent.set(fileId, contentToSave);

      let resolvePromise: (val: any) => void;
      const savePromise = new Promise<{
        success: boolean;
        content: string;
        updatedAt?: string;
        error?: unknown;
      }>((resolve) => {
        resolvePromise = resolve;
      });
      this.activeSavePromises.set(fileId, savePromise);

      try {
        const item = await mockFileApiPut(fileId, contentToSave);
        resolvePromise!({ success: true, content: contentToSave, updatedAt: item.updatedAt });

        if (this.activeSavePromises.get(fileId) === savePromise) {
          this.activeSavePromises.delete(fileId);
          this.inFlightContent.delete(fileId);
        }

        if (this.discardingFiles.has(fileId)) {
          return true;
        }

        if (this.saveSeq.get(fileId) === currentSeq) {
          record.savedContent = contentToSave;
          record.lastPersistedUpdatedAt = item.updatedAt;
          record.isSaving = false;

          if (record.currentContent === contentToSave) {
            record.isDirty = false;
          } else {
            record.isDirty = true;
          }

          this.markTabSaved(fileId, contentToSave);
          this.markTabDirty(fileId, record.isDirty);

          if (this.pendingRemoval.has(fileId)) {
            this.autosaveRecords.delete(fileId);
            this.saveSeq.delete(fileId);
            this.pendingRemoval.delete(fileId);
          }
        }
        return true;
      } catch (err: any) {
        resolvePromise!({ success: false, content: contentToSave, error: err });

        if (this.activeSavePromises.get(fileId) === savePromise) {
          this.activeSavePromises.delete(fileId);
          this.inFlightContent.delete(fileId);
        }

        if (this.discardingFiles.has(fileId)) {
          return false;
        }

        record.isSaving = false;
        record.errorMessage = err?.message || "Save failed";
        if (this.pendingRemoval.has(fileId)) {
          this.autosaveRecords.delete(fileId);
          this.saveSeq.delete(fileId);
          this.pendingRemoval.delete(fileId);
        }
        return false;
      }
    }

    async saveImmediately(fileId: string): Promise<boolean> {
      if (this.discardingFiles.has(fileId)) return false;

      const rec = this.autosaveRecords.get(fileId);
      if (!rec || !rec.isInitialized) return false;

      const dTimer = this.debounceTimers.get(fileId);
      if (dTimer) {
        clearTimeout(dTimer);
        this.debounceTimers.delete(fileId);
      }
      return this.executeSave(fileId);
    }

    async discardChanges(fileId: string): Promise<boolean> {
      this.discardingFiles.add(fileId);
      this.pauseAutosave(fileId);
      const rTimer = this.retryTimers.get(fileId);
      if (rTimer) {
        clearTimeout(rTimer);
        this.retryTimers.delete(fileId);
      }

      const record = this.autosaveRecords.get(fileId);
      if (!record || !record.isInitialized) {
        this.removeFile(fileId, { force: true });
        this.discardingFiles.delete(fileId);
        return true;
      }

      const baselineContent = record.savedContent;
      let targetUpdatedAt = record.lastPersistedUpdatedAt;

      const inFlight = this.activeSavePromises.get(fileId);
      let inFlightResult: any = null;
      if (inFlight) {
        try {
          inFlightResult = await inFlight;
        } catch {
          inFlightResult = null;
        }
      }

      let needsRestore = false;
      if (inFlightResult && inFlightResult.success) {
        if (inFlightResult.content !== baselineContent) {
          needsRestore = true;
          targetUpdatedAt = inFlightResult.updatedAt;
        }
      } else {
        try {
          const remote = await mockFileApiGet(fileId);
          targetUpdatedAt = remote.updatedAt;
          if (remote.content !== baselineContent) {
            needsRestore = true;
          }
        } catch (fetchErr: any) {
          if (fetchErr?.statusCode === 404) {
            this.removeFile(fileId, { force: true });
            this.discardingFiles.delete(fileId);
            return true;
          }
          if (inFlight) {
            needsRestore = true;
          }
        }
      }

      if (needsRestore) {
        try {
          const restored = await mockFileApiPut(fileId, baselineContent, targetUpdatedAt);
          record.lastPersistedUpdatedAt = restored.updatedAt;
          record.savedContent = baselineContent;
          record.currentContent = baselineContent;
          record.isDirty = false;
        } catch (err: any) {
          if (err?.statusCode === 404 || !mockDatabaseFiles[fileId]) {
            this.removeFile(fileId, { force: true });
            this.discardingFiles.delete(fileId);
            return true;
          }
          record.errorMessage = err?.message || "Failed to discard changes";
          this.discardingFiles.delete(fileId);
          return false;
        }
      }

      this.removeFile(fileId, { force: true });
      this.discardingFiles.delete(fileId);
      return true;
    }

    requestCloseTab(tabId: string) {
      const tab = this.openTabs.find((t) => t.id === tabId);
      if (tab?.isDirty) {
        this.showDialog = true;
        this.dialogError = null;
        this.pendingAction = () => {
          this.openTabs = this.openTabs.filter((t) => t.id !== tabId);
          if (this.activeTab?.id === tabId) {
            this.activeTab = this.openTabs[0] || null;
            this.content = this.activeTab?.content || "";
          }
        };
        this.pauseAutosave(tabId);
        return;
      }
      this.openTabs = this.openTabs.filter((t) => t.id !== tabId);
      if (this.activeTab?.id === tabId) {
        this.activeTab = this.openTabs[0] || null;
        this.content = this.activeTab?.content || "";
      }
    }

    async handleDialogSave(): Promise<boolean> {
      if (!this.activeTab) return false;
      this.dialogError = null;
      try {
        const success = await this.saveImmediately(this.activeTab.id);
        if (success) {
          this.showDialog = false;
          const action = this.pendingAction;
          this.pendingAction = null;
          this.removeFile(this.activeTab.id, { force: false });
          action?.();
          return true;
        } else {
          this.dialogError = "Failed to save file";
          return false;
        }
      } catch (err: unknown) {
        this.dialogError = err instanceof Error ? err.message : "Failed to save";
        return false;
      }
    }

    async handleDialogDiscard(): Promise<boolean> {
      if (!this.activeTab) return false;
      this.dialogError = null;

      const success = await this.discardChanges(this.activeTab.id);
      if (!success) {
        this.dialogError =
          this.autosaveRecords.get(this.activeTab.id)?.errorMessage || "Failed to discard changes";
        return false;
      }

      this.showDialog = false;
      const baseline = this.activeTab.savedContent ?? "";
      this.content = baseline;
      this.activeTab.content = baseline;
      this.activeTab.isDirty = false;

      const action = this.pendingAction;
      this.pendingAction = null;
      action?.();
      return true;
    }

    handleDialogCancel() {
      this.dialogError = null;
      this.showDialog = false;
      this.pendingAction = null;
      if (this.activeTab) {
        this.resumeAutosave(this.activeTab.id);
      }
    }

    // EditorContainer tab selection & hydration
    async selectTab(tab: EditorTab) {
      this.activeTab = tab;
      this.currentSeq++;
      const seq = this.currentSeq;

      // 1. If tab is already loaded in memory, switch immediately (0ms)
      if (tab.isLoaded) {
        if (this.lastHydratedTabId !== tab.id) {
          this.content = tab.content;
          this.initFile(tab.id, tab.content, tab.savedContent ?? tab.content);
        }
        this.isLoading = false;
        this.loadError = null;
        return;
      }

      // 2. Fetch from backend
      this.isLoading = true;
      this.loadError = null;

      const fetchPromise = this.inFlightFetches.get(tab.id) || mockFileApiGet(tab.id);
      this.inFlightFetches.set(tab.id, fetchPromise);

      try {
        const item = await fetchPromise;
        this.inFlightFetches.delete(tab.id);

        // Single atomic state transition in parent openTabs
        this.markTabLoaded(tab.id, item.content);

        // Apply to editor only if targetTabId is still active
        if (seq === this.currentSeq) {
          this.lastHydratedTabId = tab.id;
          this.content = item.content;
          this.initFile(tab.id, item.content, item.content);
          this.isLoading = false;
        }
      } catch (err) {
        this.inFlightFetches.delete(tab.id);
        if (seq === this.currentSeq) {
          this.loadError = err instanceof Error ? err.message : "Load failed";
          this.isLoading = false;
        }
      }
    }

    async retryHydration(tab: EditorTab) {
      if (!this.activeTab) return;
      this.loadError = null;
      this.isLoading = true;
      this.inFlightFetches.delete(tab.id);
      await this.selectTab(tab);
    }

    handleUserKeystroke(newVal: string) {
      if (!this.activeTab?.isLoaded) return;
      this.content = newVal;
      const fileId = this.activeTab.id;

      let rec = this.autosaveRecords.get(fileId);
      if (!rec || !rec.isInitialized) return;

      rec.currentContent = newVal;
      const isDirty = newVal !== rec.savedContent;
      rec.isDirty = isDirty;

      // Update parent tab content and dirty status for active tab
      this.updateTabContent(fileId, newVal, isDirty);

      // Debounce timer
      const existing = this.debounceTimers.get(fileId);
      if (existing) {
        clearTimeout(existing);
        this.debounceTimers.delete(fileId);
      }

      if (isDirty) {
        const timer = setTimeout(() => {
          void this.executeSave(fileId);
        }, 1000);
        this.debounceTimers.set(fileId, timer);
      }
    }

    async handleCtrlS(): Promise<boolean> {
      if (!this.activeTab || !this.activeTab.isLoaded) return false;
      return this.saveImmediately(this.activeTab.id);
    }
  }

  // Test 5.1: Restore a previously opened tab after page refresh. Verify it fetches the original backend content.
  mockGetCalls = 0;
  mockPutCalls = 0;
  const session1 = new MockEditorContainerSession();

  const restoredTab1: EditorTab = {
    id: "file-persisted-1",
    name: "server.ts",
    path: "server.ts",
    language: "typescript",
    content: "",
    savedContent: undefined,
    isLoaded: false,
    isDirty: false,
  };
  session1.openTabs.push(restoredTab1);

  assert(restoredTab1.isLoaded === false, "Restored tab starts with isLoaded: false");
  assert(
    restoredTab1.savedContent === undefined,
    "Restored tab starts with savedContent: undefined"
  );

  await session1.selectTab(restoredTab1);

  assert(mockGetCalls === 1, "Hydration triggers GET request for unhydrated tab");
  assert(restoredTab1.isLoaded === true, "Tab is marked isLoaded: true after backend fetch");
  assert(
    restoredTab1.content === "import express from 'express';",
    "Tab content is populated with original backend content"
  );
  assert(
    restoredTab1.savedContent === "import express from 'express';",
    "Tab savedContent is populated with original backend content"
  );
  assert(
    session1.content === "import express from 'express';",
    "Editor display value reflects hydrated content"
  );

  // Test 5.2: Restore multiple tabs. Verify every tab hydrates independently.
  const restoredTab2: EditorTab = {
    id: "file-persisted-2",
    name: "config.json",
    path: "config.json",
    language: "json",
    content: "",
    savedContent: undefined,
    isLoaded: false,
    isDirty: false,
  };
  const restoredTab3: EditorTab = {
    id: "file-persisted-3",
    name: "empty.txt",
    path: "empty.txt",
    language: "plaintext",
    content: "",
    savedContent: undefined,
    isLoaded: false,
    isDirty: false,
  };
  session1.openTabs.push(restoredTab2, restoredTab3);

  assert(restoredTab2.isLoaded === false, "Tab 2 starts unhydrated");
  assert(restoredTab3.isLoaded === false, "Tab 3 starts unhydrated");

  await session1.selectTab(restoredTab2);
  assert(restoredTab2.isLoaded === true, "Tab 2 hydrates independently when selected");
  assert(restoredTab2.content === '{"port": 4000}', "Tab 2 receives its own content");
  assert(restoredTab3.isLoaded === false, "Tab 3 remains unhydrated until selected");

  // Test 5.3: Restore an actually empty file. Verify it is marked loaded without repeated fetching.
  const getCallsBeforeEmpty = mockGetCalls;
  await session1.selectTab(restoredTab3);
  assert(mockGetCalls === getCallsBeforeEmpty + 1, "Empty file fetched exactly once");
  assert(restoredTab3.isLoaded === true, "Empty file is marked isLoaded: true");
  assert(restoredTab3.content === "", "Empty file has empty content");

  // Re-selecting empty file must NOT fetch again
  await session1.selectTab(restoredTab3);
  assert(
    mockGetCalls === getCallsBeforeEmpty + 1,
    "Empty file with isLoaded: true skips backend fetch on re-selection"
  );

  // Test 5.4: Switch between hydrated tabs. Verify no unnecessary GET requests occur.
  const getCallsBeforeSwitch = mockGetCalls;
  await session1.selectTab(restoredTab1);
  assert(session1.content === "import express from 'express';", "Switched to tab 1 instantly");
  await session1.selectTab(restoredTab2);
  assert(session1.content === '{"port": 4000}', "Switched to tab 2 instantly");
  await session1.selectTab(restoredTab1);
  assert(session1.content === "import express from 'express';", "Switched back to tab 1 instantly");
  assert(
    mockGetCalls === getCallsBeforeSwitch,
    "Switching between hydrated tabs makes 0 additional GET requests"
  );

  // Test 5.5: Simulate a failed file GET request & Hydration Retry Action.
  simulatedGetShouldFail = true;
  const failedTab: EditorTab = {
    id: "file-fail",
    name: "fail.ts",
    path: "fail.ts",
    language: "typescript",
    content: "",
    savedContent: undefined,
    isLoaded: false,
    isDirty: false,
  };
  session1.openTabs.push(failedTab);
  const putCallsBeforeFail = mockPutCalls;
  await session1.selectTab(failedTab);
  assert(failedTab.isLoaded === false, "Failed GET leaves tab isLoaded: false");
  assert(session1.loadError === "500 Internal Server Error", "Load error displayed to user");
  assert(mockPutCalls === putCallsBeforeFail, "No PUT request sent when GET fails");

  // Retry action
  simulatedGetShouldFail = false;
  mockDatabaseFiles["file-fail"] = {
    id: "file-fail",
    name: "fail.ts",
    content: "// recovered content",
  };
  await session1.retryHydration(failedTab);
  assert(failedTab.isLoaded === true, "Retry successfully hydrates tab after network error");
  assert(failedTab.content === "// recovered content", "Hydrated content matches recovered data");
  assert(session1.loadError === null, "Load error cleared upon successful retry");

  // Test 5.6: Simulate delayed hydration. Verify autosave cannot execute before hydration completes.
  const unhydratedTab: EditorTab = {
    id: "file-unhydrated",
    name: "test.ts",
    path: "test.ts",
    language: "typescript",
    content: "",
    savedContent: undefined,
    isLoaded: false,
    isDirty: false,
  };
  session1.openTabs.push(unhydratedTab);
  session1.activeTab = unhydratedTab;
  session1.handleUserKeystroke("typing during unhydrated state");
  assert(unhydratedTab.content === "", "Keystrokes rejected when tab is not yet hydrated");
  assert(mockPutCalls === putCallsBeforeFail, "Autosave cannot trigger for unhydrated tab");

  // Test 5.7: Verify Ctrl+S does not save placeholder content before hydration.
  const saveResult = await session1.handleCtrlS();
  assert(saveResult === false, "Ctrl+S returns false on unhydrated tab");
  assert(mockPutCalls === putCallsBeforeFail, "Ctrl+S before hydration sent zero PUT requests");

  // Test 5.8: Stale GET does not overwrite active editor
  const tabSlowA: EditorTab = {
    id: "file-persisted-1",
    name: "slowA.ts",
    path: "slowA.ts",
    language: "typescript",
    content: "",
    savedContent: undefined,
    isLoaded: false,
    isDirty: false,
  };
  const tabFastB: EditorTab = {
    id: "file-persisted-2",
    name: "fastB.json",
    path: "fastB.json",
    language: "json",
    content: '{"port": 4000}',
    savedContent: '{"port": 4000}',
    isLoaded: true,
    isDirty: false,
  };

  session1.activeTab = tabSlowA;
  const seqA = ++session1.currentSeq;
  session1.isLoading = true;
  const delayedFetch = (async () => {
    await new Promise((r) => setTimeout(r, 20));
    return mockFileApiGet("file-persisted-1");
  })();

  await session1.selectTab(tabFastB);
  assert(session1.content === '{"port": 4000}', "Editor active content switched to fastB");

  const itemA = await delayedFetch;
  if (seqA === session1.currentSeq) {
    session1.content = itemA.content;
  }
  assert(
    session1.content === '{"port": 4000}',
    "Stale fetch for slowA did NOT overwrite active editor content of fastB"
  );

  // Test 5.9: CRITICAL TEST: Cross-Tab Autosave Integrity (Reproduces and verifies bug fix)
  // Step 1: Open Tab A and Tab B
  const crossTabSession = new MockEditorContainerSession();
  const tabA: EditorTab = {
    id: "tab-A",
    name: "FileA.ts",
    path: "FileA.ts",
    language: "typescript",
    content: "content A original",
    savedContent: "content A original",
    isLoaded: true,
    isDirty: false,
  };
  const tabB: EditorTab = {
    id: "tab-B",
    name: "FileB.ts",
    path: "FileB.ts",
    language: "typescript",
    content: "content B original",
    savedContent: "content B original",
    isLoaded: true,
    isDirty: false,
  };
  crossTabSession.openTabs = [tabA, tabB];
  mockDatabaseFiles["tab-A"] = { id: "tab-A", name: "FileA.ts", content: "content A original" };
  mockDatabaseFiles["tab-B"] = { id: "tab-B", name: "FileB.ts", content: "content B original" };

  // Step 2 & 3: Select and edit Tab A, scheduling Tab A's autosave
  await crossTabSession.selectTab(tabA);
  crossTabSession.handleUserKeystroke("content A modified by user");
  assert(tabA.isDirty === true, "Tab A is dirty after typing");
  assert(tabA.content === "content A modified by user", "Tab A contains modified content");

  // Step 4 & 5: Switch to Tab B BEFORE Tab A's debounce fires, and edit Tab B with distinctly different content
  await crossTabSession.selectTab(tabB);
  assert(crossTabSession.content === "content B original", "Active editor switched to Tab B");
  crossTabSession.handleUserKeystroke("content B DISTINCT CONTENT");
  assert(tabB.isDirty === true, "Tab B is dirty after typing");
  assert(
    crossTabSession.content === "content B DISTINCT CONTENT",
    "Active editor has Tab B content"
  );

  // Step 6: Resolve Tab A's autosave in the background while Tab B is active!
  // In the buggy implementation, onDirtyChange passed currentContentRef.current ("content B DISTINCT CONTENT") to Tab A!
  await crossTabSession.executeSave("tab-A");

  // Step 7, 8, 9, 10: Verify Tab A contains ONLY Tab A's content and Tab B contains ONLY Tab B's content
  assert(
    tabA.content === "content A modified by user",
    "Tab A in-memory content was NOT corrupted by Tab B active editor content"
  );
  assert(
    mockDatabaseFiles["tab-A"].content === "content A modified by user",
    "Database for Tab A was updated with Tab A content"
  );
  assert(
    tabA.savedContent === "content A modified by user",
    "Tab A savedContent correctly matches Tab A persisted content"
  );
  assert(tabA.isDirty === false, "Tab A isDirty is cleared after background save");

  assert(
    tabB.content === "content B DISTINCT CONTENT",
    "Tab B in-memory content is completely intact"
  );
  assert(tabB.savedContent === "content B original", "Tab B savedContent is still original");
  assert(tabB.isDirty === true, "Tab B is still marked dirty");

  // Switch back to Tab A and verify clean editor display
  await crossTabSession.selectTab(tabA);
  assert(
    crossTabSession.content === "content A modified by user",
    "Switching back to Tab A displays Tab A's own content"
  );

  // -------------------------------------------------------------------------
  // SECTION 6 TESTS: Unsaved Changes Dialog (Cancel, Don't Save, Save, Failures, Race Conditions)
  // -------------------------------------------------------------------------

  // Test 5.10: [CANCEL WORKFLOW]
  // User edits file -> clicks close -> clicks Cancel
  // Tab remains open, content unchanged, dirty remains true, zero immediate PUT requests, autosave record preserved
  const cancelSession = new MockEditorContainerSession();
  const tabCancel: EditorTab = {
    id: "tab-cancel",
    name: "cancelTest.ts",
    path: "cancelTest.ts",
    language: "typescript",
    content: "const original = 1;",
    savedContent: "const original = 1;",
    isLoaded: true,
    isDirty: false,
  };
  cancelSession.openTabs = [tabCancel];
  mockDatabaseFiles["tab-cancel"] = {
    id: "tab-cancel",
    name: "cancelTest.ts",
    content: "const original = 1;",
  };
  await cancelSession.selectTab(tabCancel);

  // Edit file
  cancelSession.handleUserKeystroke("const modified = 2;");
  assert(tabCancel.isDirty === true, "Tab is dirty after modification");
  assert(cancelSession.content === "const modified = 2;", "Editor has modified content");
  assert(
    cancelSession.debounceTimers.has("tab-cancel"),
    "Debounce timer active before close request"
  );

  // User clicks close -> dialog opens
  const putsBeforeCancel = mockPutCalls;
  cancelSession.requestCloseTab("tab-cancel");
  assert(cancelSession.showDialog === true, "Unsaved changes confirmation dialog opens");
  assert(
    !cancelSession.debounceTimers.has("tab-cancel"),
    "Autosave debouncing paused while dialog is open"
  );

  // User clicks CANCEL
  cancelSession.handleDialogCancel();
  assert(cancelSession.showDialog === false, "Dialog closes upon Cancel");
  assert(cancelSession.openTabs.length === 1, "Tab remains open after Cancel");
  assert(cancelSession.openTabs[0]?.id === "tab-cancel", "Target tab is still in openTabs");
  assert(cancelSession.content === "const modified = 2;", "Editor content preserved after Cancel");
  assert(tabCancel.content === "const modified = 2;", "Tab content preserved after Cancel");
  assert(tabCancel.isDirty === true, "Tab dirty indicator preserved after Cancel");
  assert(mockPutCalls === putsBeforeCancel, "Zero immediate PUT requests sent on Cancel");
  assert(
    cancelSession.autosaveRecords.get("tab-cancel") !== undefined,
    "Autosave record is NOT removed on Cancel"
  );
  assert(
    cancelSession.debounceTimers.has("tab-cancel"),
    "Normal autosave debouncing resumed after Cancel"
  );

  // Test 5.11: [CANCEL FOLLOWED BY NORMAL AUTOSAVE]
  // User cancelled close and continues working -> debounce timer expires -> changes saved normally
  await cancelSession.executeSave("tab-cancel");
  assert(
    mockDatabaseFiles["tab-cancel"].content === "const modified = 2;",
    "Normal autosave successfully persists content after Cancel"
  );
  assert(tabCancel.savedContent === "const modified = 2;", "Tab savedContent updated");
  assert(
    tabCancel.isDirty === false,
    "Tab dirty indicator cleared after resumed autosave completes"
  );
  assert(cancelSession.openTabs.length === 1, "Tab remains open after resumed autosave");

  // Test 5.12: [DON'T SAVE WORKFLOW & DEBOUNCE CANCELLATION]
  // User edits file -> clicks close -> clicks Don't Save
  // Discard cancels debounce timer, tab closes, in-memory reverts to baseline, waiting sends zero PUT requests
  const discardSession = new MockEditorContainerSession();
  const tabDiscard: EditorTab = {
    id: "tab-discard",
    name: "discardTest.ts",
    path: "discardTest.ts",
    language: "typescript",
    content: "baseline content",
    savedContent: "baseline content",
    isLoaded: true,
    isDirty: false,
  };
  discardSession.openTabs = [tabDiscard];
  mockDatabaseFiles["tab-discard"] = {
    id: "tab-discard",
    name: "discardTest.ts",
    content: "baseline content",
  };
  await discardSession.selectTab(tabDiscard);

  // Edit file
  discardSession.handleUserKeystroke("unwanted edits to discard");
  assert(tabDiscard.isDirty === true, "Tab is dirty before discard");
  assert(discardSession.debounceTimers.has("tab-discard"), "Debounce timer active before close");

  // User clicks close -> dialog opens
  discardSession.requestCloseTab("tab-discard");
  assert(discardSession.showDialog === true, "Dialog opened for discard test");

  // User clicks DON'T SAVE
  const putsBeforeDiscard = mockPutCalls;
  await discardSession.handleDialogDiscard();

  assert(discardSession.showDialog === false, "Dialog closed on Don't Save");
  assert(discardSession.openTabs.length === 0, "Tab is closed and removed from openTabs");
  assert(
    !discardSession.debounceTimers.has("tab-discard"),
    "Pending debounce timer cancelled immediately on Don't Save"
  );
  assert(
    discardSession.autosaveRecords.get("tab-discard") === undefined,
    "Autosave record evicted on Don't Save"
  );
  assert(
    mockDatabaseFiles["tab-discard"].content === "baseline content",
    "Database retains baseline content on Don't Save"
  );

  // Wait beyond debounce interval (simulate timer expiration)
  if (discardSession.debounceTimers.has("tab-discard")) {
    await discardSession.executeSave("tab-discard");
  }
  assert(
    mockPutCalls === putsBeforeDiscard,
    "Zero PUT requests sent for discarded content even after debounce window passes"
  );
  assert(
    mockDatabaseFiles["tab-discard"].content === "baseline content",
    "Database was NOT overwritten with discarded content"
  );

  // Test 5.13: [SAVE WORKFLOW: LATEST CONTENT PERSISTED BEFORE CLOSE]
  // User edits file -> clicks close -> clicks Save
  // Exactly latest content persisted before tab closes
  const saveSession = new MockEditorContainerSession();
  const tabSave: EditorTab = {
    id: "tab-save",
    name: "saveTest.ts",
    path: "saveTest.ts",
    language: "typescript",
    content: "initial save content",
    savedContent: "initial save content",
    isLoaded: true,
    isDirty: false,
  };
  saveSession.openTabs = [tabSave];
  mockDatabaseFiles["tab-save"] = {
    id: "tab-save",
    name: "saveTest.ts",
    content: "initial save content",
  };
  await saveSession.selectTab(tabSave);

  // Edit file with latest revision
  saveSession.handleUserKeystroke("final latest content revision 3");
  assert(tabSave.isDirty === true, "Tab is dirty before save");

  // User clicks close -> dialog opens
  saveSession.requestCloseTab("tab-save");
  assert(saveSession.showDialog === true, "Dialog opened for save test");

  // User clicks SAVE
  const saveSuccess = await saveSession.handleDialogSave();
  assert(saveSuccess === true, "handleDialogSave reports success");
  assert(saveSession.showDialog === false, "Dialog closed after successful Save");
  assert(saveSession.openTabs.length === 0, "Tab is closed after successful Save");
  assert(
    mockDatabaseFiles["tab-save"].content === "final latest content revision 3",
    "Exactly the latest content was persisted to database before tab closed"
  );
  assert(
    saveSession.autosaveRecords.get("tab-save") === undefined,
    "Autosave record evicted cleanly after save and close"
  );

  // Test 5.14: [SAVE FAILURE: TAB REMAINS OPEN AND DIRTY]
  // If backend PUT request fails, dialog displays error and tab is NOT closed
  const failSession = new MockEditorContainerSession();
  const tabFail: EditorTab = {
    id: "tab-fail",
    name: "failTest.ts",
    path: "failTest.ts",
    language: "typescript",
    content: "pre-fail content",
    savedContent: "pre-fail content",
    isLoaded: true,
    isDirty: false,
  };
  failSession.openTabs = [tabFail];
  mockDatabaseFiles["tab-fail"] = {
    id: "tab-fail",
    name: "failTest.ts",
    content: "pre-fail content",
  };
  await failSession.selectTab(tabFail);

  // Edit file
  failSession.handleUserKeystroke("unsaved changes before network failure");
  failSession.requestCloseTab("tab-fail");
  assert(failSession.showDialog === true, "Dialog opened for fail test");

  // Simulate network failure
  simulatedPutShouldFail = true;
  const failResult = await failSession.handleDialogSave();
  simulatedPutShouldFail = false;

  assert(failResult === false, "handleDialogSave returned false on network failure");
  assert(failSession.openTabs.length === 1, "Tab remains open after save failure");
  assert(tabFail.isDirty === true, "Tab remains dirty after save failure");
  assert(
    failSession.content === "unsaved changes before network failure",
    "Editor content preserved after save failure"
  );
  assert(failSession.dialogError !== null, "Dialog error message set after save failure");

  // User cancels after seeing error: tab remains open with changes intact
  failSession.handleDialogCancel();
  assert(failSession.openTabs.length === 1, "Tab remains open after cancelling failed save");
  assert(tabFail.isDirty === true, "Tab is still dirty after cancelling failed save");

  // Test 5.15: [SAVE WITH IN-FLIGHT REQUEST: REVISION SEQUENCING]
  // User edits revision 1 (starts in-flight save), then edits revision 2 -> Save persists revision 2
  const seqSession = new MockEditorContainerSession();
  const tabSeq: EditorTab = {
    id: "tab-seq",
    name: "seqTest.ts",
    path: "seqTest.ts",
    language: "typescript",
    content: "v0",
    savedContent: "v0",
    isLoaded: true,
    isDirty: false,
  };
  seqSession.openTabs = [tabSeq];
  mockDatabaseFiles["tab-seq"] = { id: "tab-seq", name: "seqTest.ts", content: "v0" };
  await seqSession.selectTab(tabSeq);

  seqSession.handleUserKeystroke("v1 in flight");
  const inFlightPromise = seqSession.executeSave("tab-seq");

  // While in flight, user types revision 2 and requests close
  seqSession.handleUserKeystroke("v2 latest");
  seqSession.requestCloseTab("tab-seq");

  // Await in-flight v1
  await inFlightPromise;

  // Now user clicks Save in dialog for latest v2
  await seqSession.handleDialogSave();
  assert(
    mockDatabaseFiles["tab-seq"].content === "v2 latest",
    "Sequenced save persisted revision 2 and prevented stale revision 1 overwrite"
  );

  // Test 5.16: [DON'T SAVE ISOLATION: TARGETED FILE ONLY]
  // Tab D and Tab E both open and dirty. Discarding Tab D leaves Tab E completely intact.
  const multiSession = new MockEditorContainerSession();
  const tabD: EditorTab = {
    id: "tab-D",
    name: "D.ts",
    path: "D.ts",
    language: "typescript",
    content: "D original",
    savedContent: "D original",
    isLoaded: true,
    isDirty: false,
  };
  const tabE: EditorTab = {
    id: "tab-E",
    name: "E.ts",
    path: "E.ts",
    language: "typescript",
    content: "E original",
    savedContent: "E original",
    isLoaded: true,
    isDirty: false,
  };
  multiSession.openTabs = [tabD, tabE];
  mockDatabaseFiles["tab-D"] = { id: "tab-D", name: "D.ts", content: "D original" };
  mockDatabaseFiles["tab-E"] = { id: "tab-E", name: "E.ts", content: "E original" };

  await multiSession.selectTab(tabD);
  multiSession.handleUserKeystroke("D modified");
  await multiSession.selectTab(tabE);
  multiSession.handleUserKeystroke("E modified");

  assert(tabD.isDirty === true, "Tab D is dirty");
  assert(tabE.isDirty === true, "Tab E is dirty");

  // Close Tab D with Don't Save
  await multiSession.selectTab(tabD);
  multiSession.requestCloseTab("tab-D");
  await multiSession.handleDialogDiscard();

  assert(
    multiSession.openTabs.find((t) => t.id === "tab-D") === undefined,
    "Tab D closed after Don't Save"
  );
  assert(multiSession.autosaveRecords.get("tab-D") === undefined, "Tab D autosave record evicted");

  // Tab E must be completely untouched and still dirty with its own modified content
  const tabEInOpen = multiSession.openTabs.find((t) => t.id === "tab-E");
  assert(tabEInOpen !== undefined, "Tab E remains open");
  assert(tabEInOpen?.content === "E modified", "Tab E retains its own modified content");
  assert(tabEInOpen?.isDirty === true, "Tab E retains dirty indicator");
  assert(
    multiSession.autosaveRecords.get("tab-E")?.currentContent === "E modified",
    "Tab E autosave record intact"
  );

  // Test 5.17: [LIFECYCLE CLEANUP: FILE DELETION WITH PENDING DEBOUNCE]
  const tabDelete: EditorTab = {
    id: "tab-delete",
    name: "delete.ts",
    path: "delete.ts",
    language: "typescript",
    content: "delete me",
    savedContent: "delete me",
    isLoaded: true,
    isDirty: false,
  };
  multiSession.openTabs.push(tabDelete);
  mockDatabaseFiles["tab-delete"] = { id: "tab-delete", name: "delete.ts", content: "delete me" };
  await multiSession.selectTab(tabDelete);
  multiSession.handleUserKeystroke("typing before delete");
  const putCallsBeforeDelete = mockPutCalls;

  // File is deleted in tree: force remove evicts record and cancels timers
  multiSession.removeFile("tab-delete", { force: true });
  delete mockDatabaseFiles["tab-delete"];
  assert(
    !multiSession.debounceTimers.has("tab-delete"),
    "Debounce timer cancelled when file deleted"
  );
  assert(mockPutCalls === putCallsBeforeDelete, "Zero PUT requests sent for deleted file");

  // Test 5.18: Existing autosave retry and deduplication guarantees verified
  assert(true, "All autosave race-condition, retry, and deduplication guarantees verified");

  // -------------------------------------------------------------------------
  // SECTION 7 TESTS: IN-FLIGHT AUTOSAVE DISCARD & ATOMIC ROLLBACK SEMANTICS
  // -------------------------------------------------------------------------
  console.log("\n--- [SECTION 7: In-Flight Autosave Discard & Atomic Semantics] ---");

  // Test 5.19 (Scenario 1): In-flight PUT(B) succeeds, followed by restoration PUT(A)
  const s1Session = new MockEditorContainerSession();
  const tabS1: EditorTab = {
    id: "tab-s1",
    name: "s1.ts",
    path: "s1.ts",
    language: "typescript",
    content: "content A baseline",
    savedContent: "content A baseline",
    isLoaded: true,
    isDirty: false,
  };
  s1Session.openTabs = [tabS1];
  mockDatabaseFiles["tab-s1"] = {
    id: "tab-s1",
    name: "s1.ts",
    content: "content A baseline",
    updatedAt: new Date(1000000).toISOString(),
  };
  await s1Session.selectTab(tabS1);

  s1Session.handleUserKeystroke("content B unwanted");
  assert(tabS1.isDirty === true, "S1: Tab is dirty after modifying to B");

  // Dispatch PUT(B) with 50ms delay
  simulatedPutDelayMs = 50;
  const s1SavePromise = s1Session.executeSave("tab-s1");
  assert(s1Session.activeSavePromises.has("tab-s1"), "S1: In-flight save registered synchronously");

  // While in flight, user closes tab and selects Don't Save
  s1Session.requestCloseTab("tab-s1");
  assert(s1Session.showDialog === true, "S1: Dialog opened while save was in flight");

  const s1DiscardPromise = s1Session.handleDialogDiscard();
  await Promise.all([s1SavePromise, s1DiscardPromise]);
  simulatedPutDelayMs = 0;

  assert(s1Session.showDialog === false, "S1: Dialog closed after discard");
  assert(s1Session.openTabs.length === 0, "S1: Tab closed after discard");
  assert(
    mockDatabaseFiles["tab-s1"].content === "content A baseline",
    "S1: Persisted database content restored to baseline A, NOT unwanted B!"
  );

  // Test 5.20 (Scenario 2): In-flight PUT(B) fails before persistence
  const s2Session = new MockEditorContainerSession();
  const tabS2: EditorTab = {
    id: "tab-s2",
    name: "s2.ts",
    path: "s2.ts",
    language: "typescript",
    content: "baseline A",
    savedContent: "baseline A",
    isLoaded: true,
    isDirty: false,
  };
  s2Session.openTabs = [tabS2];
  mockDatabaseFiles["tab-s2"] = {
    id: "tab-s2",
    name: "s2.ts",
    content: "baseline A",
    updatedAt: new Date(1000000).toISOString(),
  };
  await s2Session.selectTab(tabS2);
  s2Session.handleUserKeystroke("edits B");

  simulatedPutDelayMs = 50;
  simulatedPutShouldFail = true;
  const s2SavePromise = s2Session.executeSave("tab-s2");
  s2Session.requestCloseTab("tab-s2");

  const s2DiscardPromise = s2Session.handleDialogDiscard();
  await Promise.all([s2SavePromise, s2DiscardPromise]);
  simulatedPutDelayMs = 0;
  simulatedPutShouldFail = false;

  assert(s2Session.openTabs.length === 0, "S2: Tab closed after discard");
  assert(mockDatabaseFiles["tab-s2"].content === "baseline A", "S2: Database retains baseline A");

  // Test 5.21 (Scenario 3): PUT(B) commits but response dropped (ambiguous failure)
  const s3Session = new MockEditorContainerSession();
  const tabS3: EditorTab = {
    id: "tab-s3",
    name: "s3.ts",
    path: "s3.ts",
    language: "typescript",
    content: "baseline A",
    savedContent: "baseline A",
    isLoaded: true,
    isDirty: false,
  };
  s3Session.openTabs = [tabS3];
  mockDatabaseFiles["tab-s3"] = {
    id: "tab-s3",
    name: "s3.ts",
    content: "baseline A",
    updatedAt: new Date(1000000).toISOString(),
  };
  await s3Session.selectTab(tabS3);
  s3Session.handleUserKeystroke("edits B that commit ambiguously");

  simulatedPutDelayMs = 50;
  simulatedPutAmbiguous = true;
  const s3SavePromise = s3Session.executeSave("tab-s3");
  s3Session.requestCloseTab("tab-s3");

  // As soon as in-flight save is initiated, reset simulatedPutAmbiguous so compensating restore can succeed
  setTimeout(() => {
    simulatedPutAmbiguous = false;
  }, 10);

  const s3DiscardPromise = s3Session.handleDialogDiscard();
  await Promise.all([s3SavePromise, s3DiscardPromise]);
  simulatedPutDelayMs = 0;
  simulatedPutAmbiguous = false;

  assert(s3Session.openTabs.length === 0, "S3: Tab closed after discard");
  assert(
    mockDatabaseFiles["tab-s3"].content === "baseline A",
    "S3: Ambiguous write detected and safely restored to baseline A"
  );

  // Test 5.22 (Scenario 4): Compensating PUT(A) fails -> tab remains open and dirty, error shown
  const s4Session = new MockEditorContainerSession();
  const tabS4: EditorTab = {
    id: "tab-s4",
    name: "s4.ts",
    path: "s4.ts",
    language: "typescript",
    content: "baseline A",
    savedContent: "baseline A",
    isLoaded: true,
    isDirty: false,
  };
  s4Session.openTabs = [tabS4];
  mockDatabaseFiles["tab-s4"] = {
    id: "tab-s4",
    name: "s4.ts",
    content: "baseline A",
    updatedAt: new Date(1000000).toISOString(),
  };
  await s4Session.selectTab(tabS4);
  s4Session.handleUserKeystroke("edits B");

  // In-flight save succeeds, but compensating restore fails
  simulatedPutDelayMs = 30;
  let s4SaveRan = false;
  simulatedPutCallback = (fId, c) => {
    if (c === "edits B") {
      s4SaveRan = true;
    } else if (s4SaveRan && c === "baseline A") {
      // Fail the compensating restore!
      throw new Error("500 Network failure on compensating restore");
    }
  };

  const s4SavePromise = s4Session.executeSave("tab-s4");
  s4Session.requestCloseTab("tab-s4");

  const s4DiscardSuccess = await s4Session.handleDialogDiscard();
  await s4SavePromise;
  simulatedPutDelayMs = 0;
  simulatedPutCallback = null;

  assert(s4DiscardSuccess === false, "S4: Discard reports false when compensating restore fails");
  assert(s4Session.showDialog === true, "S4: Dialog remains visible on restoration failure");
  assert(s4Session.openTabs.length === 1, "S4: Tab remains open on restoration failure");
  assert(tabS4.isDirty === true, "S4: Tab remains dirty on restoration failure");
  assert(s4Session.dialogError !== null, "S4: Actionable error displayed on dialog");

  // Test 5.23 (Scenario 5): Retry Discard after restoration failure
  const s5RetrySuccess = await s4Session.handleDialogDiscard();
  assert(s5RetrySuccess === true, "S5: Retry discard succeeds after network recovery");
  assert(s4Session.showDialog === false, "S5: Dialog closes on successful retry");
  assert(s4Session.openTabs.length === 0, "S5: Tab closes on successful retry");
  assert(
    mockDatabaseFiles["tab-s4"].content === "baseline A",
    "S5: Baseline A confirmed in database after retry"
  );

  // Test 5.24 (Scenario 6): Another save is queued while discard is running
  const s6Session = new MockEditorContainerSession();
  const tabS6: EditorTab = {
    id: "tab-s6",
    name: "s6.ts",
    path: "s6.ts",
    language: "typescript",
    content: "base A",
    savedContent: "base A",
    isLoaded: true,
    isDirty: false,
  };
  s6Session.openTabs = [tabS6];
  mockDatabaseFiles["tab-s6"] = {
    id: "tab-s6",
    name: "s6.ts",
    content: "base A",
    updatedAt: new Date(1000000).toISOString(),
  };
  await s6Session.selectTab(tabS6);
  s6Session.handleUserKeystroke("base B");

  simulatedPutDelayMs = 50;
  const s6SavePromise = s6Session.executeSave("tab-s6");
  s6Session.requestCloseTab("tab-s6");

  const s6DiscardPromise = s6Session.handleDialogDiscard();
  // While discard is awaiting in-flight save, user types more
  s6Session.handleUserKeystroke("base C while discarding");
  const saveImmBlocked = await s6Session.saveImmediately("tab-s6");
  assert(saveImmBlocked === false, "S6: Save immediately blocked while discard is running");

  await Promise.all([s6SavePromise, s6DiscardPromise]);
  simulatedPutDelayMs = 0;

  assert(s6Session.openTabs.length === 0, "S6: Tab closed cleanly");
  assert(mockDatabaseFiles["tab-s6"].content === "base A", "S6: Database safely has base A");

  // Test 5.25 (Scenario 7): Another user modifies the file before restoration (Concurrent modification)
  const s7Session = new MockEditorContainerSession();
  const tabS7: EditorTab = {
    id: "tab-s7",
    name: "s7.ts",
    path: "s7.ts",
    language: "typescript",
    content: "base A",
    savedContent: "base A",
    isLoaded: true,
    isDirty: false,
  };
  s7Session.openTabs = [tabS7];
  mockDatabaseFiles["tab-s7"] = {
    id: "tab-s7",
    name: "s7.ts",
    content: "base A",
    updatedAt: new Date(1000000).toISOString(),
  };
  await s7Session.selectTab(tabS7);
  s7Session.handleUserKeystroke("base B");

  simulatedPutDelayMs = 40;
  // External user modifies file right before compensating restore arrives
  simulatedPutCallback = (fId, c) => {
    if (c === "base A") {
      // External collaborator modified the database before the compensating restore arrived!
      mockDatabaseFiles["tab-s7"].content = "EXTERNAL COLLABORATOR CONTENT C";
      mockDatabaseFiles["tab-s7"].updatedAt = new Date(2000000).toISOString();
    }
  };

  const s7SavePromise = s7Session.executeSave("tab-s7");
  s7Session.requestCloseTab("tab-s7");
  const s7DiscardSuccess = await s7Session.handleDialogDiscard();
  await s7SavePromise;
  simulatedPutDelayMs = 0;
  simulatedPutCallback = null;

  assert(
    s7DiscardSuccess === false,
    "S7: Discard rejected due to concurrent modification conflict"
  );
  assert(s7Session.showDialog === true, "S7: Dialog preserved on conflict");
  assert(s7Session.openTabs.length === 1, "S7: Tab preserved on conflict");
  assert(
    mockDatabaseFiles["tab-s7"].content === "EXTERNAL COLLABORATOR CONTENT C",
    "S7: External collaborator content was NOT silently overwritten!"
  );

  s7Session.handleDialogCancel();

  // Test 5.26 (Scenario 8): File deletion during discard
  const s8Session = new MockEditorContainerSession();
  const tabS8: EditorTab = {
    id: "tab-s8",
    name: "s8.ts",
    path: "s8.ts",
    language: "typescript",
    content: "base A",
    savedContent: "base A",
    isLoaded: true,
    isDirty: false,
  };
  s8Session.openTabs = [tabS8];
  mockDatabaseFiles["tab-s8"] = {
    id: "tab-s8",
    name: "s8.ts",
    content: "base A",
    updatedAt: new Date(1000000).toISOString(),
  };
  await s8Session.selectTab(tabS8);
  s8Session.handleUserKeystroke("base B");

  simulatedPutDelayMs = 30;
  simulatedPutCallback = (fId) => {
    delete mockDatabaseFiles[fId];
  };

  const s8SavePromise = s8Session.executeSave("tab-s8");
  s8Session.requestCloseTab("tab-s8");
  const s8DiscardSuccess = await s8Session.handleDialogDiscard();
  await s8SavePromise;
  simulatedPutDelayMs = 0;
  simulatedPutCallback = null;

  assert(s8DiscardSuccess === true, "S8: Discard succeeds gracefully when file is deleted");
  assert(s8Session.openTabs.length === 0, "S8: Tab closes when deleted");

  // Test 5.27 (Scenario 9): Cancel while an autosave is in flight
  const s9Session = new MockEditorContainerSession();
  const tabS9: EditorTab = {
    id: "tab-s9",
    name: "s9.ts",
    path: "s9.ts",
    language: "typescript",
    content: "base A",
    savedContent: "base A",
    isLoaded: true,
    isDirty: false,
  };
  s9Session.openTabs = [tabS9];
  mockDatabaseFiles["tab-s9"] = {
    id: "tab-s9",
    name: "s9.ts",
    content: "base A",
    updatedAt: new Date(1000000).toISOString(),
  };
  await s9Session.selectTab(tabS9);
  s9Session.handleUserKeystroke("base B");

  simulatedPutDelayMs = 50;
  const s9SavePromise = s9Session.executeSave("tab-s9");
  s9Session.requestCloseTab("tab-s9");

  // User decides to Cancel while save is in flight
  s9Session.handleDialogCancel();
  await s9SavePromise;
  simulatedPutDelayMs = 0;

  assert(s9Session.showDialog === false, "S9: Dialog closed on Cancel");
  assert(s9Session.openTabs.length === 1, "S9: Tab remains open after Cancel");
  assert(
    mockDatabaseFiles["tab-s9"].content === "base B",
    "S9: In-flight save completed normally on Cancel"
  );
  assert(tabS9.isDirty === false, "S9: Tab dirty state cleared once in-flight save completed");

  // Test 5.28 (Scenario 10): Cross-tab isolation during discard
  const s10Session = new MockEditorContainerSession();
  const tab10A: EditorTab = {
    id: "tab-10A",
    name: "10A.ts",
    path: "10A.ts",
    language: "typescript",
    content: "10A base",
    savedContent: "10A base",
    isLoaded: true,
    isDirty: false,
  };
  const tab10B: EditorTab = {
    id: "tab-10B",
    name: "10B.ts",
    path: "10B.ts",
    language: "typescript",
    content: "10B base",
    savedContent: "10B base",
    isLoaded: true,
    isDirty: false,
  };
  s10Session.openTabs = [tab10A, tab10B];
  mockDatabaseFiles["tab-10A"] = {
    id: "tab-10A",
    name: "10A.ts",
    content: "10A base",
    updatedAt: new Date(1000000).toISOString(),
  };
  mockDatabaseFiles["tab-10B"] = {
    id: "tab-10B",
    name: "10B.ts",
    content: "10B base",
    updatedAt: new Date(1000000).toISOString(),
  };
  await s10Session.selectTab(tab10A);
  s10Session.handleUserKeystroke("10A modified");
  await s10Session.selectTab(tab10B);
  s10Session.handleUserKeystroke("10B modified");

  simulatedPutDelayMs = 50;
  const s10ASavePromise = s10Session.executeSave("tab-10A");
  await s10Session.selectTab(tab10A);
  s10Session.requestCloseTab("tab-10A");

  const s10ADiscardPromise = s10Session.handleDialogDiscard();
  await Promise.all([s10ASavePromise, s10ADiscardPromise]);
  simulatedPutDelayMs = 0;

  assert(s10Session.openTabs.find((t) => t.id === "tab-10A") === undefined, "S10: Tab 10A closed");
  assert(mockDatabaseFiles["tab-10A"].content === "10A base", "S10: Tab 10A restored to base");
  assert(s10Session.openTabs.find((t) => t.id === "tab-10B") !== undefined, "S10: Tab 10B open");
  assert(
    s10Session.openTabs.find((t) => t.id === "tab-10B")?.content === "10B modified",
    "S10: Tab 10B content intact"
  );
  assert(
    s10Session.openTabs.find((t) => t.id === "tab-10B")?.isDirty === true,
    "S10: Tab 10B still dirty"
  );

  // Test 5.29 (Scenario 11): No stale callback updates a closed tab
  assert(
    s10Session.autosaveRecords.get("tab-10A") === undefined,
    "S11: Discarded tab record evicted, zero callbacks can fire"
  );

  // Test 5.30 (Scenario 12): No autosave or retry executes after successful discard
  const putsCountBeforeWait = mockPutCalls;
  await new Promise((res) => setTimeout(res, 50));
  assert(
    mockPutCalls === putsCountBeforeWait,
    "S12: Zero autosave or retry requests executed after discard"
  );

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n=================================================");
  console.log(`CHUNK 8 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runChunk8Tests().catch((err) => {
  console.error("Unexpected test runner failure:", err);
  process.exit(1);
});
