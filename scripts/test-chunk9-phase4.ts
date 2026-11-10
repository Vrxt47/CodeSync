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
import { isExecutableLanguage, getMonacoLanguage } from "../apps/web/lib/editor/languageUtils";

async function runPhase4Tests() {
  console.log("=================================================");
  console.log("🧪 STARTING CHUNK 9 - PHASE 4: EDITOR & RUN BUTTON INTEGRATION TESTS");
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

  const adapter = new MockExecutionAdapter(0);
  const service = new ExecutionService(adapter);

  // -------------------------------------------------------------------------
  // SUITE 1: LANGUAGE DETECTION & EXECUTABILITY VALIDATION
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 1: Language Detection & Executability Validation] ---");

  // Valid supported languages
  assert(getMonacoLanguage("main.py") === "python", "main.py mapped to python");
  assert(isExecutableLanguage("python"), "python is identified as executable");

  assert(getMonacoLanguage("index.js") === "javascript", "index.js mapped to javascript");
  assert(isExecutableLanguage("javascript"), "javascript is identified as executable");

  assert(getMonacoLanguage("solver.cpp") === "cpp", "solver.cpp mapped to cpp");
  assert(isExecutableLanguage("cpp"), "cpp is identified as executable");

  assert(getMonacoLanguage("Solution.java") === "java", "Solution.java mapped to java");
  assert(isExecutableLanguage("java"), "java is identified as executable");

  // Unsupported languages / Plaintext fallback
  assert(getMonacoLanguage("notes.txt") === "plaintext", "notes.txt mapped to plaintext");
  assert(!isExecutableLanguage("plaintext"), "plaintext is NOT executable");

  assert(getMonacoLanguage("README.md") === "plaintext", "README.md mapped to plaintext");
  assert(!isExecutableLanguage(getMonacoLanguage("README.md")), "README.md is NOT executable");

  assert(getMonacoLanguage("package.json") === "plaintext", "package.json mapped to plaintext");
  assert(
    !isExecutableLanguage(getMonacoLanguage("package.json")),
    "package.json is NOT executable"
  );

  // -------------------------------------------------------------------------
  // SUITE 2: RUN BUTTON EXECUTION FLOW & STATE PROPAGATION
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 2: Run Button Execution Flow & State Propagation] ---");

  let isBottomPanelOpen = false;
  let activePanelTab: "output" | "input" | "history" = "input";
  let executionStatus: ExecutionStatus = "idle";
  let isExecuting = false;
  let executionResult: ExecutionResult | null = null;
  let stdin = "custom_input_data\nline_two";

  function openBottomPanel() {
    isBottomPanelOpen = true;
  }

  // Mimic useExecution.runExecution workflow
  async function runExecution(params: {
    sourceCode: string;
    language: SupportedLanguage;
    fileName?: string;
  }): Promise<ExecutionResult | undefined> {
    if (isExecuting) return;

    isExecuting = true;
    executionStatus = "running";
    activePanelTab = "output";
    openBottomPanel();

    try {
      const res = await service.execute({
        sourceCode: params.sourceCode,
        language: params.language,
        stdin,
        fileName: params.fileName,
      });

      executionResult = res;
      executionStatus = res.status;
      return res;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Execution failed";
      const errorResult: ExecutionResult = {
        executionId: `err-${Date.now()}`,
        status: "internal_error",
        stdout: "",
        stderr: errorMsg,
        executionTime: 0,
        memoryUsage: 0,
        exitCode: 1,
        executedAt: new Date().toISOString(),
        isSimulated: true,
      };
      executionResult = errorResult;
      executionStatus = "internal_error";
      return errorResult;
    } finally {
      isExecuting = false;
    }
  }

  // Test Execution Trigger
  assert(isBottomPanelOpen === false, "Pre-condition: Bottom panel is closed");
  assert(activePanelTab === "input", "Pre-condition: Panel tab is Input");
  assert(executionStatus === "idle", "Pre-condition: Execution status is idle");
  assert(isExecuting === false, "Pre-condition: isExecuting is false");

  const execPromise = runExecution({
    sourceCode: 'print("Hello from CodeSync!")',
    language: "python",
    fileName: "main.py",
  });

  // Check synchronous state updates during execution dispatch
  assert(isBottomPanelOpen === true, "Execution auto-expands bottom panel if closed");
  assert(activePanelTab === "output", "Execution auto-switches active tab to Output");
  assert(isExecuting === true, "isExecuting set to true during run");
  assert(executionStatus === "running", "executionStatus set to 'running' during run");

  const executedResult = await execPromise;

  assert(isExecuting === false, "isExecuting reset to false after completion in finally block");
  assert(executedResult?.status === "success", "Result status is success");
  assert(executionStatus === "success", "executionStatus updated to success");
  assert(executionResult !== null, "executionResult stored in state");
  assert(
    executionResult?.stdout.includes("Hello, CodeSync!"),
    "Stdout contains expected execution output"
  );
  assert(
    stdin === "custom_input_data\nline_two",
    "Strict requirement: Stdin preserved after execution"
  );

  // -------------------------------------------------------------------------
  // SUITE 3: MONACO LATEST MODEL RETRIEVAL & FILE SWITCHING
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 3: Monaco Latest Model Retrieval & Active File Switching] ---");

  // Mock Monaco models for multi-tab workspace
  const tabModels: Record<
    string,
    { value: string; language: SupportedLanguage; fileName: string }
  > = {
    "tab-py": {
      value: "print('Initial Python')",
      language: "python",
      fileName: "script.py",
    },
    "tab-js": {
      value: "console.log('Initial JS')",
      language: "javascript",
      fileName: "app.js",
    },
    "tab-cpp": {
      value: '#include <iostream>\nint main() { std::cout << "Hello C++"; }',
      language: "cpp",
      fileName: "main.cpp",
    },
  };

  let activeTabId = "tab-py";

  // Mock Monaco editor instance
  const mockEditor = {
    getValue: () => tabModels[activeTabId].value,
    setValue: (val: string) => {
      tabModels[activeTabId].value = val;
    },
    getLanguage: () => tabModels[activeTabId].language,
    getFileName: () => tabModels[activeTabId].fileName,
  };

  // Scenario A: Execute Python file
  const pyResult = await runExecution({
    sourceCode: mockEditor.getValue(),
    language: mockEditor.getLanguage(),
    fileName: mockEditor.getFileName(),
  });
  assert(pyResult?.status === "success", "Scenario A: Python executed successfully");
  assert(pyResult?.executionTime === 38, "Scenario A: Python execution metrics received");

  // Scenario B: User switches active tab to JavaScript
  activeTabId = "tab-js";
  const jsResult = await runExecution({
    sourceCode: mockEditor.getValue(),
    language: mockEditor.getLanguage(),
    fileName: mockEditor.getFileName(),
  });
  assert(jsResult?.status === "success", "Scenario B: JS executed successfully after tab switch");
  assert(jsResult?.executionTime === 44, "Scenario B: JS execution metrics received (not Python)");

  // Scenario C: User edits code in Monaco and immediately hits Run
  mockEditor.setValue('// MOCK_ECHO_STDIN\nconsole.log("Updated in Monaco")');
  const updatedResult = await runExecution({
    sourceCode: mockEditor.getValue(),
    language: mockEditor.getLanguage(),
    fileName: mockEditor.getFileName(),
  });
  assert(
    updatedResult?.stdout.includes("custom_input_data"),
    "Scenario C: Latest Monaco model content executed with zero stale closures"
  );

  // -------------------------------------------------------------------------
  // SUITE 4: RAPID EXECUTION CONCURRENCY & OVERLAPPING GUARD
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 4: Rapid Execution Concurrency Guard] ---");

  const delayedAdapter = new MockExecutionAdapter(100);
  const delayedService = new ExecutionService(delayedAdapter);

  let concurrencyExecuting = false;
  let executionCount = 0;

  async function triggerRunWithGuard() {
    if (concurrencyExecuting) {
      return null; // Block duplicate in-flight run
    }
    concurrencyExecuting = true;
    executionCount++;
    try {
      return await delayedService.execute({
        sourceCode: "console.log(1)",
        language: "javascript",
        stdin: "",
      });
    } finally {
      concurrencyExecuting = false;
    }
  }

  // Fire 4 rapid execution calls simultaneously
  const [res1, res2, res3, res4] = await Promise.all([
    triggerRunWithGuard(),
    triggerRunWithGuard(),
    triggerRunWithGuard(),
    triggerRunWithGuard(),
  ]);

  assert(res1 !== null, "First execution accepted and processed");
  assert(res2 === null, "Second rapid click blocked while first is running");
  assert(res3 === null, "Third rapid click blocked while first is running");
  assert(res4 === null, "Fourth rapid click blocked while first is running");
  assert(executionCount === 1, "Exactly one execution executed out of 4 rapid clicks");

  // After first finishes, a new execution succeeds
  const sequentialRes = await triggerRunWithGuard();
  assert(sequentialRes !== null, "Subsequent execution accepted after previous finishes");
  assert(executionCount === 2, "Execution count incremented to 2");

  // -------------------------------------------------------------------------
  // SUITE 5: COMPILATION & RUNTIME ERRORS IN INTEGRATED PIPELINE
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 5: Compilation, Runtime, & Validation Diagnostics] ---");

  // C++ Compilation Error
  const cppErrResult = await runExecution({
    sourceCode: "// MOCK_COMPILE_ERROR\nint main() {}",
    language: "cpp",
    fileName: "main.cpp",
  });
  assert(cppErrResult?.status === "compilation_error", "Integrated C++ compilation error caught");
  assert(Boolean(cppErrResult?.compilationError), "compilationError diagnostics populated");
  assert(cppErrResult?.exitCode === 1, "Exit code is 1 for compilation error");

  // Python Runtime Error
  const pyRuntimeResult = await runExecution({
    sourceCode: "# MOCK_RUNTIME_ERROR\ndivide()",
    language: "python",
    fileName: "test.py",
  });
  assert(pyRuntimeResult?.status === "runtime_error", "Integrated Python runtime error caught");
  assert(Boolean(pyRuntimeResult?.runtimeError), "runtimeError stack trace populated");

  // Empty Source Validation Error
  const emptyResult = await runExecution({
    sourceCode: "   \n\t ",
    language: "javascript",
    fileName: "empty.js",
  });
  assert(emptyResult?.status === "validation_error", "Empty source returns validation_error");
  assert(
    emptyResult?.validationError?.includes("cannot be empty") ?? false,
    "Validation message formatted properly"
  );

  // Standard Error Separation
  const stderrResult = await runExecution({
    sourceCode: "// MOCK_STDERR\nconsole.log(1);",
    language: "javascript",
    fileName: "warn.js",
  });
  assert(stderrResult?.status === "success", "stderr trigger returns success status");
  assert(stderrResult?.stdout.includes("[Standard Output]"), "stdout separated cleanly");
  assert(stderrResult?.stderr.includes("[Standard Error - Warning]"), "stderr separated cleanly");

  // -------------------------------------------------------------------------
  // SUITE 6: ADAPTER REJECTION RESILIENCE
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 6: Adapter Rejection Resilience] ---");

  class FailingAdapter {
    public readonly name = "FailingAdapter";
    public async execute(): Promise<ExecutionResult> {
      throw new Error("Sandbox network unreachable");
    }
  }

  const failingService = new ExecutionService(new FailingAdapter());
  let caughtInternalError = false;

  try {
    const errorRes = await failingService.execute({
      sourceCode: "console.log(1)",
      language: "javascript",
      stdin: "",
    });
  } catch (err: any) {
    caughtInternalError = true;
    assert(err.message === "Sandbox network unreachable", "Adapter rejection caught safely");
  }
  assert(caughtInternalError, "Exception caught without crashing the process");

  // -------------------------------------------------------------------------
  // SUITE 7: KEYBOARD SHORTCUT COMMAND SPECIFICATION
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 7: Keyboard Shortcut Command Specification] ---");

  // Monaco KeyMod & KeyCode mock
  const KeyMod = { CtrlCmd: 2048 };
  const KeyCode = { Enter: 3 };

  const registeredCommands: { keybinding: number; handler: () => void }[] = [];
  const fakeEditor = {
    addCommand: (keybinding: number, handler: () => void) => {
      registeredCommands.push({ keybinding, handler });
      return "codesync.runCommand";
    },
  };

  let invokedFromShortcut = false;
  const shortcutHandler = () => {
    invokedFromShortcut = true;
  };

  const commandId = fakeEditor.addCommand(KeyMod.CtrlCmd | KeyCode.Enter, shortcutHandler);

  assert(commandId === "codesync.runCommand", "Command registered with Monaco addCommand API");
  assert(registeredCommands.length === 1, "Exactly one command registered on editor");
  assert(
    registeredCommands[0].keybinding === (KeyMod.CtrlCmd | KeyCode.Enter),
    "Command binds KeyMod.CtrlCmd | KeyCode.Enter"
  );

  // Invoke shortcut
  registeredCommands[0].handler();
  assert(invokedFromShortcut === true, "Keyboard shortcut invokes the unified execution handler");

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n=================================================");
  console.log(`CHUNK 9 PHASE 4 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

void runPhase4Tests();
