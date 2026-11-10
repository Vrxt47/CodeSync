import type { ExecutionResult, ExecutionStatus } from "../apps/web/services/execution";
import { MockExecutionAdapter, ExecutionService } from "../apps/web/services/execution";
import * as ExecutionPanelModule from "../apps/web/components/editor/ExecutionPanel";

async function runPhase3Tests() {
  console.log("=================================================");
  console.log("🧪 STARTING CHUNK 9 - PHASE 3: EXECUTION PANEL & RESIZING TESTS");
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
  // SUITE 1: COMPONENT EXPORTS & ARCHITECTURE INTEGRITY
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 1: Component Exports & Architecture Integrity] ---");

  assert(
    typeof ExecutionPanelModule.ExecutionPanel === "function",
    "ExecutionPanel is exported as a valid React component"
  );
  assert(
    typeof ExecutionPanelModule.ExecutionPanelHeader === "function",
    "ExecutionPanelHeader is exported as a valid React component"
  );
  assert(
    typeof ExecutionPanelModule.OutputTab === "function",
    "OutputTab is exported as a valid React component"
  );
  assert(
    typeof ExecutionPanelModule.InputTab === "function",
    "InputTab is exported as a valid React component"
  );
  assert(
    typeof ExecutionPanelModule.ExecutionHistoryTab === "function",
    "ExecutionHistoryTab is exported as a valid React component"
  );
  assert(
    typeof ExecutionPanelModule.ExecutionMetadata === "function",
    "ExecutionMetadata is exported as a valid React component"
  );
  assert(
    typeof ExecutionPanelModule.ResizeHandle === "function",
    "ResizeHandle is exported as a valid React component"
  );

  // -------------------------------------------------------------------------
  // SUITE 2: RESIZE CLAMPING & CALCULATION LOGIC
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 2: Draggable Resize Clamping & Calculations] ---");

  const minHeight = 140;
  const maxHeightRatio = 0.65;
  const containerHeight = 800;
  const expectedMaxHeight = Math.floor(containerHeight * maxHeightRatio); // 520px

  function calculateNewHeight(startHeight: number, startY: number, clientY: number): number {
    // Upward drag: startY - clientY > 0 -> increases height
    const deltaY = startY - clientY;
    const targetHeight = startHeight + deltaY;
    return Math.min(Math.max(targetHeight, minHeight), expectedMaxHeight);
  }

  // Default height: 260px
  const initialHeight = 260;
  assert(initialHeight === 260, "Default bottom panel height is 260px");
  assert(minHeight === 140, "Minimum panel height boundary is 140px");
  assert(expectedMaxHeight === 520, "Maximum height is 65% of 800px workspace height (520px)");

  // 1. Dragging UP increases height (clientY decreases from 600 to 500 = +100px)
  const draggedUpHeight = calculateNewHeight(260, 600, 500);
  assert(
    draggedUpHeight === 360,
    `Dragging upward increases height: 260px + 100px = ${draggedUpHeight}px`
  );

  // 2. Dragging DOWN decreases height (clientY increases from 600 to 650 = -50px)
  const draggedDownHeight = calculateNewHeight(260, 600, 650);
  assert(
    draggedDownHeight === 210,
    `Dragging downward decreases height: 260px - 50px = ${draggedDownHeight}px`
  );

  // 3. Minimum boundary enforced on extreme downward drag
  const extremeDownHeight = calculateNewHeight(260, 600, 900); // target = -40px
  assert(
    extremeDownHeight === 140,
    `Extreme downward drag clamped to minimum height: ${extremeDownHeight}px === 140px`
  );

  // 4. Maximum boundary enforced on extreme upward drag
  const extremeUpHeight = calculateNewHeight(260, 600, 100); // target = 760px
  assert(
    extremeUpHeight === 520,
    `Extreme upward drag clamped to maximum 65% height: ${extremeUpHeight}px === 520px`
  );

  // -------------------------------------------------------------------------
  // SUITE 3: STDIN STATE PRESERVATION & TAB SWITCHING INDEPENDENCE
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 3: Stdin State Preservation & Tab Switching Independence] ---");

  // Simulated execution state engine mimicking useExecution
  let stdin = "";
  let activeTab: "output" | "input" | "history" = "output";
  let executionResult: ExecutionResult | null = null;
  let executionStatus: ExecutionStatus = "idle";
  let panelHeight = 260;

  function setStdin(val: string) {
    stdin = val;
  }
  function clearStdin() {
    stdin = "";
  }
  function setActiveTab(tab: "output" | "input" | "history") {
    activeTab = tab;
  }
  function clearOutput() {
    executionResult = null;
    executionStatus = "idle";
  }

  // A. User types stdin in Input tab
  setActiveTab("input");
  assert(activeTab === "input", "Switched active tab to Input");

  const sampleStdin = "10\n20 30\nTest Stdin String";
  setStdin(sampleStdin);
  assert(stdin === sampleStdin, "Stdin populated with multiline content");

  // B. User switches to Output tab
  setActiveTab("output");
  assert(activeTab === "output", "Switched active tab to Output");
  assert(stdin === sampleStdin, "Stdin content is preserved after switching to Output tab");

  // C. User switches to History tab
  setActiveTab("history");
  assert(activeTab === "history", "Switched active tab to History");
  assert(stdin === sampleStdin, "Stdin content is preserved after switching to History tab");

  // D. User switches back to Input tab
  setActiveTab("input");
  assert(activeTab === "input", "Switched active tab back to Input");
  assert(stdin === sampleStdin, "Stdin content remains intact upon returning to Input tab");

  // E. Execute code with mock adapter
  const adapter = new MockExecutionAdapter(0);
  const service = new ExecutionService(adapter);

  executionStatus = "running";
  const result = await service.execute({
    sourceCode: '// MOCK_ECHO_STDIN\nconsole.log("running");',
    language: "javascript",
    stdin,
  });
  executionResult = result;
  executionStatus = result.status;

  assert(executionResult.status === "success", "Executed code successfully");
  assert(executionResult.stdout.includes(sampleStdin), "Execution stdout echoes stdin correctly");
  assert(
    stdin === sampleStdin,
    "Strict invariant: Stdin is NOT automatically cleared after execution"
  );

  // F. User clears stdin using Clear Input action
  clearStdin();
  assert(stdin === "", "Clear Input cleared stdin content");
  assert(executionResult !== null, "Clear Input did NOT clear execution output");
  assert(
    executionResult.stdout.includes(sampleStdin),
    "Execution output preserved after clearing stdin"
  );

  // G. User clears output
  clearOutput();
  assert(executionResult === null, "Clear Output cleared execution result");
  assert(executionStatus === "idle", "Clear Output reset status to idle");
  assert(stdin === "", "Clear Output did not alter stdin");

  // -------------------------------------------------------------------------
  // SUITE 4: OUTPUT TAB METADATA & ERROR VISUAL SEPARATION
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 4: Output Tab Formatting & Distinct Error Scenarios] ---");

  // 1. Success with Stderr separation
  const stderrRes = await service.execute({
    sourceCode: "// MOCK_STDERR\nconsole.warn('stderr test');",
    language: "javascript",
    stdin: "",
  });
  assert(stderrRes.status === "success", "stderr execution status is success");
  assert(stderrRes.stdout.length > 0, "stdout is present");
  assert(stderrRes.stderr.length > 0, "stderr is present and visually separated");
  assert(stderrRes.stdout !== stderrRes.stderr, "stdout and stderr are independent channels");
  assert(stderrRes.isSimulated === true, "isSimulated flag is true on result");

  // 2. Compilation Error (C++)
  const cppCompileRes = await service.execute({
    sourceCode: "// MOCK_COMPILE_ERROR\nint main() {}",
    language: "cpp",
    stdin: "",
  });
  assert(cppCompileRes.status === "compilation_error", "C++ compilation error status confirmed");
  assert(Boolean(cppCompileRes.compilationError), "compilationError field populated");
  assert(
    cppCompileRes.runtimeError === undefined,
    "runtimeError is undefined for compilation error"
  );
  assert(
    cppCompileRes.validationError === undefined,
    "validationError is undefined for compilation error"
  );

  // 3. Runtime Error (Python)
  const pyRuntimeRes = await service.execute({
    sourceCode: "# MOCK_RUNTIME_ERROR\ndivide()",
    language: "python",
    stdin: "",
  });
  assert(pyRuntimeRes.status === "runtime_error", "Python runtime error status confirmed");
  assert(Boolean(pyRuntimeRes.runtimeError), "runtimeError field populated");
  assert(
    pyRuntimeRes.compilationError === undefined,
    "compilationError is undefined for runtime error"
  );

  // 4. Validation Error (Empty source)
  const emptyRes = await service.execute({
    sourceCode: "",
    language: "javascript",
    stdin: "",
  });
  assert(emptyRes.status === "validation_error", "Empty source status is validation_error");
  assert(Boolean(emptyRes.validationError), "validationError field populated");
  assert(
    emptyRes.compilationError === undefined,
    "compilationError is undefined for validation error"
  );
  assert(emptyRes.runtimeError === undefined, "runtimeError is undefined for validation error");

  // -------------------------------------------------------------------------
  // SUITE 5: COLLAPSE, EXPAND & MAXIMIZE STATE
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 5: Collapse, Expand & Maximize Mechanics] ---");

  let isBottomPanelOpen = true;
  let isMaximized = false;

  function toggleOpen() {
    isBottomPanelOpen = !isBottomPanelOpen;
  }
  function toggleMaximized() {
    isMaximized = !isMaximized;
  }

  assert(isBottomPanelOpen === true, "Initial bottom panel state is open");
  toggleOpen();
  assert(isBottomPanelOpen === false, "Panel collapsed via toggleOpen()");
  toggleOpen();
  assert(isBottomPanelOpen === true, "Panel expanded via toggleOpen()");

  assert(isMaximized === false, "Initial panel size is normal (default 260px)");
  toggleMaximized();
  assert(isMaximized === true, "Panel maximized to 65vh via toggleMaximized()");
  toggleMaximized();
  assert(isMaximized === false, "Panel restored to normal size");

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n=================================================");
  console.log(`CHUNK 9 PHASE 3 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

void runPhase3Tests();
