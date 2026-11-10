import {
  ExecutionService,
  MockExecutionAdapter,
  type ExecutionAdapter,
  type ExecutionRequest,
  type ExecutionResult,
  type SupportedLanguage,
} from "../apps/web/services/execution";

async function runExecutionArchitectureTests() {
  console.log("=================================================");
  console.log("🧪 STARTING CHUNK 9 - PHASE 2: EXECUTION ARCHITECTURE TESTS");
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

  // Use a fast adapter (0ms delay) for unit assertions
  const fastAdapter = new MockExecutionAdapter(0);
  const service = new ExecutionService(fastAdapter);

  // -------------------------------------------------------------------------
  // SUITE 1: SUCCESSFUL EXECUTION ACROSS ALL 4 LANGUAGES
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 1: Successful Execution for Supported Languages] ---");

  const languages: SupportedLanguage[] = ["javascript", "python", "cpp", "java"];

  for (const lang of languages) {
    const res = await service.execute({
      sourceCode: 'print("Hello, CodeSync!")',
      language: lang,
      stdin: "",
    });

    assert(res.status === "success", `${lang}: status is "success"`);
    assert(res.exitCode === 0, `${lang}: exitCode is 0`);
    assert(res.stdout.length > 0, `${lang}: stdout is non-empty`);
    assert(res.stderr === "", `${lang}: stderr is empty`);
    assert(res.executionTime > 0, `${lang}: executionTime > 0ms (${res.executionTime}ms)`);
    assert(res.memoryUsage > 0, `${lang}: memoryUsage > 0MB (${res.memoryUsage}MB)`);
    assert(res.isSimulated === true, `${lang}: isSimulated is explicitly true`);
    assert(res.executionId.startsWith("mock-exec-"), `${lang}: executionId formatted properly`);
    assert(Boolean(res.executedAt), `${lang}: executedAt timestamp is set`);
  }

  // -------------------------------------------------------------------------
  // SUITE 2: COMPILATION ERRORS (C++, JAVA, PYTHON, JAVASCRIPT)
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 2: Compilation Error Scenarios] ---");

  const cppCompileRes = await service.execute({
    sourceCode: "// MOCK_COMPILE_ERROR\nint main() { cout << 123; }",
    language: "cpp",
    stdin: "",
  });
  assert(cppCompileRes.status === "compilation_error", "C++: status is compilation_error");
  assert(cppCompileRes.exitCode === 1, "C++: non-zero exit code (1)");
  assert(
    cppCompileRes.compilationError?.includes("not declared in this scope") ?? false,
    "C++: contains realistic gcc compilation diagnostics"
  );
  assert(cppCompileRes.isSimulated === true, "C++: isSimulated is true");

  const javaCompileRes = await service.execute({
    sourceCode: "// MOCK_COMPILE_ERROR\npublic class Main {}",
    language: "java",
    stdin: "",
  });
  assert(javaCompileRes.status === "compilation_error", "Java: status is compilation_error");
  assert(
    javaCompileRes.compilationError?.includes("cannot find symbol") ?? false,
    "Java: contains realistic javac compilation diagnostics"
  );

  const pyCompileRes = await service.execute({
    sourceCode: "# MOCK_COMPILE_ERROR\nprint('hello",
    language: "python",
    stdin: "",
  });
  assert(pyCompileRes.status === "compilation_error", "Python: status is compilation_error");
  assert(
    pyCompileRes.compilationError?.includes("SyntaxError") ?? false,
    "Python: contains SyntaxError simulation"
  );

  // -------------------------------------------------------------------------
  // SUITE 3: RUNTIME ERRORS (ALL 4 LANGUAGES)
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 3: Runtime Error Scenarios] ---");

  const pyRuntimeRes = await service.execute({
    sourceCode: "# MOCK_RUNTIME_ERROR\ndivide(10, 0)",
    language: "python",
    stdin: "",
  });
  assert(pyRuntimeRes.status === "runtime_error", "Python: status is runtime_error");
  assert(
    pyRuntimeRes.runtimeError?.includes("ZeroDivisionError: division by zero") ?? false,
    "Python: contains ZeroDivisionError traceback"
  );
  assert(pyRuntimeRes.exitCode === 1, "Python: non-zero exit code");

  const jsRuntimeRes = await service.execute({
    sourceCode: "// MOCK_RUNTIME_ERROR\nmyUndefinedVariable()",
    language: "javascript",
    stdin: "",
  });
  assert(jsRuntimeRes.status === "runtime_error", "JavaScript: status is runtime_error");
  assert(
    jsRuntimeRes.runtimeError?.includes("ReferenceError") ?? false,
    "JavaScript: contains ReferenceError stack trace"
  );

  const cppRuntimeRes = await service.execute({
    sourceCode: "// MOCK_RUNTIME_ERROR\nvec.at(10);",
    language: "cpp",
    stdin: "",
  });
  assert(cppRuntimeRes.status === "runtime_error", "C++: status is runtime_error");
  assert(
    cppRuntimeRes.runtimeError?.includes("std::out_of_range") ?? false,
    "C++: contains out_of_range exception"
  );
  assert(cppRuntimeRes.exitCode === 139, "C++: exitCode 139 (SIGABRT/core dump)");

  const javaRuntimeRes = await service.execute({
    sourceCode: "// MOCK_RUNTIME_ERROR\nint x = 10 / 0;",
    language: "java",
    stdin: "",
  });
  assert(javaRuntimeRes.status === "runtime_error", "Java: status is runtime_error");
  assert(
    javaRuntimeRes.runtimeError?.includes("ArithmeticException: / by zero") ?? false,
    "Java: contains ArithmeticException"
  );

  // -------------------------------------------------------------------------
  // SUITE 4: STANDARD ERROR SEPARATION (MOCK_STDERR)
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 4: Standard Error Separation] ---");

  const stderrRes = await service.execute({
    sourceCode: "// MOCK_STDERR\nconsole.warn('warning');",
    language: "javascript",
    stdin: "",
  });
  assert(stderrRes.status === "success", "stderr trigger: status is success");
  assert(stderrRes.stdout.includes("[Standard Output]"), "stderr trigger: stdout populated");
  assert(
    stderrRes.stderr.includes("[Standard Error - Warning]"),
    "stderr trigger: stderr separated"
  );
  assert(stderrRes.exitCode === 0, "stderr trigger: exitCode is 0");

  // -------------------------------------------------------------------------
  // SUITE 5: CUSTOM STDIN ECHO (MOCK_ECHO_STDIN)
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 5: Custom Stdin Echo] ---");

  const customInput = "42\n100 200\nHello from STDIN";
  const echoWithInputRes = await service.execute({
    sourceCode: "// MOCK_ECHO_STDIN",
    language: "python",
    stdin: customInput,
  });
  assert(echoWithInputRes.status === "success", "stdin echo: status is success");
  assert(
    echoWithInputRes.stdout.includes(customInput),
    "stdin echo: stdout contains exact stdin payload"
  );

  const echoEmptyInputRes = await service.execute({
    sourceCode: "// MOCK_ECHO_STDIN",
    language: "cpp",
    stdin: "",
  });
  assert(echoEmptyInputRes.status === "success", "empty stdin echo: status is success");
  assert(
    echoEmptyInputRes.stdout.includes("<No standard input provided>"),
    "empty stdin echo: stdout indicates no input provided"
  );

  // -------------------------------------------------------------------------
  // SUITE 6: EMPTY SOURCE CODE VALIDATION ERROR
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 6: Empty Source Code Validation Error] ---");

  const emptyCodeRes = await service.execute({
    sourceCode: "   \n\t  ",
    language: "javascript",
    stdin: "",
  });
  assert(
    emptyCodeRes.status === "validation_error",
    "Empty code: status is validation_error (NOT compilation_error)"
  );
  assert(
    emptyCodeRes.validationError === "Source code cannot be empty. Please enter code to execute.",
    "Empty code: friendly validation message returned"
  );
  assert(emptyCodeRes.exitCode === 1, "Empty code: non-zero exit code");
  assert(emptyCodeRes.stdout === "", "Empty code: stdout is empty");

  // -------------------------------------------------------------------------
  // SUITE 7: SERVICE LEVEL INPUT VALIDATION
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 7: Service Input Validation] ---");

  let threwOnNull = false;
  try {
    await service.execute(null as any);
  } catch (err: any) {
    threwOnNull = true;
    assert(err.message.includes("cannot be null or undefined"), "Service throws on null request");
  }
  assert(threwOnNull, "Service rejected null request");

  let threwOnInvalidLang = false;
  try {
    await service.execute({
      sourceCode: "print(1)",
      language: "rust" as any,
      stdin: "",
    });
  } catch (err: any) {
    threwOnInvalidLang = true;
    assert(
      err.message.includes("Unsupported programming language"),
      "Service throws on unsupported language"
    );
  }
  assert(threwOnInvalidLang, "Service rejected unsupported language");

  // -------------------------------------------------------------------------
  // SUITE 8: ADAPTER SWITCHING (JUDGE0 PREPAREDNESS)
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 8: Adapter Switching & Judge0 Preparedness] ---");

  assert(
    service.getAdapterName() === "MockExecutionAdapter",
    "Initial adapter is MockExecutionAdapter"
  );

  class MockJudge0Adapter implements ExecutionAdapter {
    public readonly name = "Judge0ExecutionAdapter";
    public async execute(req: ExecutionRequest): Promise<ExecutionResult> {
      return {
        executionId: "judge0-submission-token-12345",
        status: "success",
        stdout: `[Judge0 Remote Sandbox] Executed ${req.language}`,
        stderr: "",
        executionTime: 85,
        memoryUsage: 8.5,
        exitCode: 0,
        executedAt: new Date().toISOString(),
        isSimulated: false,
      };
    }
  }

  const judge0Adapter = new MockJudge0Adapter();
  service.setAdapter(judge0Adapter);
  assert(
    service.getAdapterName() === "Judge0ExecutionAdapter",
    "Switched adapter to Judge0ExecutionAdapter"
  );

  const judge0Res = await service.execute({
    sourceCode: 'console.log("judge0")',
    language: "javascript",
    stdin: "",
  });
  assert(judge0Res.status === "success", "Judge0 adapter returned success");
  assert(judge0Res.isSimulated === false, "Judge0 adapter result isSimulated is false");
  assert(judge0Res.stdout.includes("[Judge0 Remote Sandbox]"), "Judge0 adapter output verified");

  // Restore mock adapter
  service.setAdapter(fastAdapter);
  assert(
    service.getAdapterName() === "MockExecutionAdapter",
    "Restored MockExecutionAdapter cleanly"
  );

  // -------------------------------------------------------------------------
  // SUITE 9: ARTIFICIAL DELAY VERIFICATION
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 9: Artificial Execution Delay] ---");

  const delayedAdapter = new MockExecutionAdapter(150);
  const start = Date.now();
  await delayedAdapter.execute({
    sourceCode: 'console.log("delay test")',
    language: "javascript",
    stdin: "",
  });
  const elapsed = Date.now() - start;
  assert(elapsed >= 140, `Artificial delay observed (${elapsed}ms >= 140ms)`);

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n=================================================");
  console.log(`CHUNK 9 PHASE 2 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

void runExecutionArchitectureTests();
