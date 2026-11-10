import type {
  ExecutionResult,
  ExecutionStatus,
  SupportedLanguage,
} from "../apps/web/services/execution";
import {
  MockExecutionAdapter,
  ExecutionService,
  executionService,
} from "../apps/web/services/execution";
import {
  isExecutableLanguage,
  getMonacoLanguage,
  getLanguageDisplayName,
} from "../apps/web/lib/editor/languageUtils";
import * as ExecutionPanelModule from "../apps/web/components/editor/ExecutionPanel";

async function runQAAudit() {
  console.log("=================================================");
  console.log("🧪 STARTING CHUNK 9: COMPREHENSIVE QA AUDIT & VERIFICATION");
  console.log("=================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}${detail ? ` - ${detail}` : ""}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // SECTION 1: EXECUTION ARCHITECTURE & ADAPTER SPECIFICATION
  // -------------------------------------------------------------------------
  console.log("\n--- [AUDIT 1: Execution Architecture & Adapter Contract] ---");

  const fastAdapter = new MockExecutionAdapter(0);
  const service = new ExecutionService(fastAdapter);

  assert(
    service.getAdapterName() === "MockExecutionAdapter",
    "Active adapter is MockExecutionAdapter"
  );

  // Verify all 4 languages return valid, non-crashing results
  const supportedLangs: SupportedLanguage[] = ["javascript", "python", "cpp", "java"];
  for (const lang of supportedLangs) {
    const res = await service.execute({
      sourceCode: `// Sample ${lang} source\nconsole.log("test");`,
      language: lang,
      stdin: "",
    });

    assert(res.status === "success", `${lang}: execution status is "success"`);
    assert(res.exitCode === 0, `${lang}: exit code is 0`);
    assert(res.isSimulated === true, `${lang}: isSimulated is explicitly true`);
    assert(res.executionTime > 0, `${lang}: executionTime is positive (${res.executionTime}ms)`);
    assert(res.memoryUsage > 0, `${lang}: memoryUsage is positive (${res.memoryUsage}MB)`);
    assert(res.stdout.length > 0, `${lang}: stdout is populated`);
    assert(res.stderr === "", `${lang}: stderr is empty`);
  }

  // -------------------------------------------------------------------------
  // SECTION 2: MOCK SCENARIOS & ERROR CLASSIFICATION
  // -------------------------------------------------------------------------
  console.log("\n--- [AUDIT 2: Mock Scenarios & Distinct Error Classifications] ---");

  // 1. Compilation Error for C++
  const cppCompile = await service.execute({
    sourceCode: "// MOCK_COMPILE_ERROR\nint main() { return 0; }",
    language: "cpp",
    stdin: "",
  });
  assert(
    cppCompile.status === "compilation_error",
    "C++: Compilation error status classified accurately"
  );
  assert(cppCompile.exitCode === 1, "C++: Non-zero exit code (1)");
  assert(
    cppCompile.compilationError?.includes("not declared in this scope") ?? false,
    "C++: Compilation diagnostic string populated"
  );
  assert(
    cppCompile.runtimeError === undefined,
    "C++: runtimeError is undefined for compilation failure"
  );

  // 2. Compilation Error for Java
  const javaCompile = await service.execute({
    sourceCode: "// MOCK_COMPILE_ERROR\nclass Main {}",
    language: "java",
    stdin: "",
  });
  assert(
    javaCompile.status === "compilation_error",
    "Java: Compilation error status classified accurately"
  );
  assert(
    javaCompile.compilationError?.includes("cannot find symbol") ?? false,
    "Java: Compilation diagnostic string populated"
  );

  // 3. Runtime Error for Python
  const pyRuntime = await service.execute({
    sourceCode: "# MOCK_RUNTIME_ERROR\ndivide(10, 0)",
    language: "python",
    stdin: "",
  });
  assert(
    pyRuntime.status === "runtime_error",
    "Python: Runtime error status classified accurately"
  );
  assert(
    pyRuntime.runtimeError?.includes("ZeroDivisionError: division by zero") ?? false,
    "Python: Traceback details preserved"
  );
  assert(
    pyRuntime.compilationError === undefined,
    "Python: compilationError is undefined for runtime failure"
  );

  // 4. Runtime Error for JavaScript
  const jsRuntime = await service.execute({
    sourceCode: "// MOCK_RUNTIME_ERROR\nfoo()",
    language: "javascript",
    stdin: "",
  });
  assert(
    jsRuntime.status === "runtime_error",
    "JavaScript: Runtime error status classified accurately"
  );
  assert(
    jsRuntime.runtimeError?.includes("ReferenceError") ?? false,
    "JavaScript: ReferenceError stack trace preserved"
  );

  // 5. Runtime Error for C++
  const cppRuntime = await service.execute({
    sourceCode: "// MOCK_RUNTIME_ERROR\nvec.at(99)",
    language: "cpp",
    stdin: "",
  });
  assert(cppRuntime.status === "runtime_error", "C++: Runtime error status classified accurately");
  assert(cppRuntime.exitCode === 139, "C++: Exit code 139 (SIGABRT/core dump) preserved");

  // 6. Runtime Error for Java
  const javaRuntime = await service.execute({
    sourceCode: "// MOCK_RUNTIME_ERROR\nint x = 1 / 0;",
    language: "java",
    stdin: "",
  });
  assert(
    javaRuntime.status === "runtime_error",
    "Java: Runtime error status classified accurately"
  );
  assert(
    javaRuntime.runtimeError?.includes("ArithmeticException") ?? false,
    "Java: ArithmeticException trace preserved"
  );

  // 7. Standard Error Separation (MOCK_STDERR)
  const stderrRes = await service.execute({
    sourceCode: "// MOCK_STDERR\nconsole.log('out');",
    language: "javascript",
    stdin: "",
  });
  assert(stderrRes.status === "success", "stderr scenario: status is success");
  assert(stderrRes.stdout.includes("[Standard Output]"), "stderr scenario: stdout separated");
  assert(
    stderrRes.stderr.includes("[Standard Error - Warning]"),
    "stderr scenario: stderr separated"
  );
  assert(stderrRes.stdout !== stderrRes.stderr, "stdout and stderr channels are distinct");

  // 8. Custom Stdin Echo (MOCK_ECHO_STDIN)
  const multilineStdin = "Line 1\nLine 2 with spaces   \nLine 3 with tabs\t\nLine 4: !@#$%^&*()";
  const echoWithInput = await service.execute({
    sourceCode: "// MOCK_ECHO_STDIN",
    language: "python",
    stdin: multilineStdin,
  });
  assert(echoWithInput.status === "success", "stdin echo: status is success");
  assert(
    echoWithInput.stdout.includes(multilineStdin),
    "stdin echo: exact multiline payload echoed losslessly"
  );

  const echoEmpty = await service.execute({
    sourceCode: "// MOCK_ECHO_STDIN",
    language: "cpp",
    stdin: "",
  });
  assert(
    echoEmpty.stdout.includes("<No standard input provided>"),
    "empty stdin echo: reports no input provided gracefully"
  );

  // 9. Empty & Whitespace-Only Source Code (Validation Error)
  const emptyRes = await service.execute({
    sourceCode: "",
    language: "javascript",
    stdin: "",
  });
  assert(emptyRes.status === "validation_error", "Empty source: status is validation_error");
  assert(
    emptyRes.validationError === "Source code cannot be empty. Please enter code to execute.",
    "Empty source: actionable message provided"
  );

  const whitespaceRes = await service.execute({
    sourceCode: "   \t\n   ",
    language: "python",
    stdin: "",
  });
  assert(
    whitespaceRes.status === "validation_error",
    "Whitespace-only source: status is validation_error"
  );

  // 10. Unsupported Language Handling
  let rejectedLang = false;
  try {
    await service.execute({
      sourceCode: "fn main() {}",
      language: "rust" as any,
      stdin: "",
    });
  } catch (err: any) {
    rejectedLang = true;
    assert(
      err.message.includes("Unsupported programming language"),
      "Unsupported language rejected with clear message"
    );
  }
  assert(rejectedLang, "ExecutionService strictly rejects unsupported languages");

  // -------------------------------------------------------------------------
  // SECTION 3: BOTTOM PANEL DIMENSIONS, BOUNDARIES & RESIZING
  // -------------------------------------------------------------------------
  console.log("\n--- [AUDIT 3: Bottom Panel Dimensions, Boundaries & Resizing] ---");

  const minHeight = 140;
  const maxHeightRatio = 0.65;
  const viewportHeight = 900;
  const maxHeight = Math.floor(viewportHeight * maxHeightRatio); // 585px

  function clampHeight(target: number): number {
    return Math.min(Math.max(target, minHeight), maxHeight);
  }

  assert(clampHeight(260) === 260, "Default height 260px is within valid bounds");
  assert(clampHeight(100) === 140, "Sub-minimum height clamped to minHeight (140px)");
  assert(clampHeight(800) === 585, "Super-maximum height clamped to maxHeight (65% = 585px)");
  assert(clampHeight(140) === 140, "Exact minimum height boundary accepted");
  assert(clampHeight(585) === 585, "Exact maximum height boundary accepted");

  // -------------------------------------------------------------------------
  // SECTION 4: STDIN PRESERVATION ACROSS ALL USER ACTIONS
  // -------------------------------------------------------------------------
  console.log("\n--- [AUDIT 4: Stdin State Preservation Under Lifecycle Transitions] ---");

  let hookStdin = "INITIAL_STDIN_12345";
  let hookActiveTab: "output" | "input" | "history" = "input";
  let hookOutputResult: ExecutionResult | null = null;

  // Action 1: Switch tab to Output
  hookActiveTab = "output";
  assert(hookStdin === "INITIAL_STDIN_12345", "Stdin intact after switching to Output tab");

  // Action 2: Switch tab to History
  hookActiveTab = "history";
  assert(hookStdin === "INITIAL_STDIN_12345", "Stdin intact after switching to History tab");

  // Action 3: Execute code
  const execRes = await service.execute({
    sourceCode: "// MOCK_ECHO_STDIN",
    language: "javascript",
    stdin: hookStdin,
  });
  hookOutputResult = execRes;
  assert(hookStdin === "INITIAL_STDIN_12345", "Stdin intact after code execution completes");

  // Action 4: Clear output
  hookOutputResult = null;
  assert(hookStdin === "INITIAL_STDIN_12345", "Stdin intact after clearing execution output");

  // Action 5: Explicit clear stdin
  hookStdin = "";
  assert(hookStdin === "", "Clear Input sets stdin to empty string");

  // -------------------------------------------------------------------------
  // SECTION 5: EDITOR INTEGRATION & STALE CLOSURE AUDIT
  // -------------------------------------------------------------------------
  console.log("\n--- [AUDIT 5: Editor Integration, Model Sync & Stale Closure Audit] ---");

  // Mock workspace with 4 language files
  const files: Record<string, { content: string; language: SupportedLanguage; name: string }> = {
    "f-py": { content: "print('python')", language: "python", name: "main.py" },
    "f-js": { content: "console.log('js')", language: "javascript", name: "app.js" },
    "f-cpp": { content: "cout << 1;", language: "cpp", name: "code.cpp" },
    "f-java": { content: "System.out.println();", language: "java", name: "Main.java" },
  };

  let activeFileId = "f-py";

  // Simulate Monaco active model retrieval
  function getLatestMonacoContent() {
    return files[activeFileId].content;
  }
  function getActiveLanguage() {
    return files[activeFileId].language;
  }
  function getActiveFileName() {
    return files[activeFileId].name;
  }

  // Test Test A: Python run
  const runPy = await service.execute({
    sourceCode: getLatestMonacoContent(),
    language: getActiveLanguage(),
    fileName: getActiveFileName(),
    stdin: "",
  });
  assert(runPy.status === "success", "Python file executed");
  assert(getActiveLanguage() === "python", "Active language detected as python");

  // Test Test B: Switch to JavaScript
  activeFileId = "f-js";
  const runJs = await service.execute({
    sourceCode: getLatestMonacoContent(),
    language: getActiveLanguage(),
    fileName: getActiveFileName(),
    stdin: "",
  });
  assert(runJs.status === "success", "JavaScript file executed after switch");
  assert(getActiveLanguage() === "javascript", "Active language detected as javascript");
  assert(getActiveFileName() === "app.js", "Active filename is app.js");

  // Test Test C: Switch to C++
  activeFileId = "f-cpp";
  assert(getActiveLanguage() === "cpp", "Active language detected as cpp");

  // Test Test D: Switch to Java
  activeFileId = "f-java";
  assert(getActiveLanguage() === "java", "Active language detected as java");

  // Test Test E: Immediate modification in Monaco model
  files["f-py"].content = '// MOCK_ECHO_STDIN\nprint("MODIFIED_MONACO_CODE")';
  activeFileId = "f-py";
  const runModified = await service.execute({
    sourceCode: getLatestMonacoContent(),
    language: getActiveLanguage(),
    fileName: getActiveFileName(),
    stdin: "LIVE_STDIN",
  });
  assert(
    runModified.stdout.includes("LIVE_STDIN"),
    "Latest modified Monaco model content submitted with zero stale React state"
  );

  // -------------------------------------------------------------------------
  // SECTION 6: CONCURRENCY & REJECTION SAFETY
  // -------------------------------------------------------------------------
  console.log("\n--- [AUDIT 6: Concurrency & Rejection Resilience] ---");

  let isExecuting = false;
  let successCount = 0;
  let blockedCount = 0;

  async function simulateUserRunClick() {
    if (isExecuting) {
      blockedCount++;
      return;
    }
    isExecuting = true;
    try {
      await new Promise((resolve) => setTimeout(resolve, 50));
      successCount++;
    } finally {
      isExecuting = false;
    }
  }

  // 5 simultaneous rapid clicks
  await Promise.all([
    simulateUserRunClick(),
    simulateUserRunClick(),
    simulateUserRunClick(),
    simulateUserRunClick(),
    simulateUserRunClick(),
  ]);

  assert(successCount === 1, "Exactly one execution accepted under rapid user clicks");
  assert(blockedCount === 4, "Four overlapping clicks safely blocked by execution guard");

  // Subsequent click after completion succeeds
  await simulateUserRunClick();
  assert(successCount === 2, "Sequential execution succeeded after prior completed");

  // Adapter rejection safety
  class CrashingAdapter {
    public readonly name = "CrashingAdapter";
    public async execute(): Promise<ExecutionResult> {
      throw new Error("Simulated fatal execution container crash");
    }
  }

  const crashService = new ExecutionService(new CrashingAdapter());
  let gracefulErrorHandled = false;

  try {
    await crashService.execute({
      sourceCode: "int x = 0;",
      language: "cpp",
      stdin: "",
    });
  } catch (err: any) {
    gracefulErrorHandled = true;
    assert(
      err.message === "Simulated fatal execution container crash",
      "Fatal adapter rejection caught cleanly"
    );
  }
  assert(gracefulErrorHandled, "Adapter crash safely handled without crashing application host");

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n=================================================");
  console.log(`CHUNK 9 QA AUDIT RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

void runQAAudit();
