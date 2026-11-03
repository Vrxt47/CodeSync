import {
  PYTHON_COMPLETIONS,
  PYTHON_KEYWORDS,
  PYTHON_SNIPPETS,
  getPythonCompletionItems,
  registerPythonCompletionProvider,
} from "../apps/web/lib/editor/completion/pythonCompletions";
import {
  CPP_COMPLETIONS,
  CPP_KEYWORDS,
  CPP_SNIPPETS,
  getCppCompletionItems,
  registerCppCompletionProvider,
} from "../apps/web/lib/editor/completion/cppCompletions";
import {
  JS_COMPLETIONS,
  JS_KEYWORDS,
  JS_SNIPPETS,
  getJavascriptCompletionItems,
  registerJavascriptCompletionProvider,
} from "../apps/web/lib/editor/completion/javascriptCompletions";
import {
  JAVA_COMPLETIONS,
  JAVA_KEYWORDS,
  JAVA_SNIPPETS,
  getJavaCompletionItems,
  registerJavaCompletionProvider,
} from "../apps/web/lib/editor/completion/javaCompletions";
import {
  registerAllCompletionProviders,
  unregisterAllCompletionProviders,
  areCompletionProvidersRegistered,
} from "../apps/web/lib/editor/completion/completionRegistry";
import { defaultEditorOptions } from "../apps/web/lib/editor/editorConfig";

async function runCompletionTests() {
  console.log("=================================================");
  console.log("🧪 STARTING LANGUAGE INTELLISENSE & COMPLETION TESTS");
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

  // Mock Monaco environment for unit testing
  const mockRegisteredProviders: Record<string, any[]> = {
    python: [],
    cpp: [],
    javascript: [],
    java: [],
  };

  let mockDisposedCount = 0;

  const mockMonaco: any = {
    languages: {
      CompletionItemKind: {
        Keyword: 17,
        Snippet: 28,
      },
      CompletionItemInsertTextRule: {
        InsertAsSnippet: 4,
      },
      registerCompletionItemProvider: (languageId: string, provider: any) => {
        if (!mockRegisteredProviders[languageId]) {
          mockRegisteredProviders[languageId] = [];
        }
        mockRegisteredProviders[languageId].push(provider);
        return {
          dispose: () => {
            mockDisposedCount++;
            const idx = mockRegisteredProviders[languageId].indexOf(provider);
            if (idx !== -1) {
              mockRegisteredProviders[languageId].splice(idx, 1);
            }
          },
        };
      },
    },
  };

  // -------------------------------------------------------------------------
  // TEST SUITE 1: Python Completion Items & Snippets
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 1: Python Completion Items & Snippets] ---");

  assert(
    PYTHON_KEYWORDS.length === 35,
    `Python defines 35 keywords (got ${PYTHON_KEYWORDS.length})`
  );
  const pythonRequiredKeywords = [
    "def",
    "class",
    "if",
    "elif",
    "else",
    "for",
    "while",
    "try",
    "except",
    "finally",
    "import",
    "from",
    "return",
    "yield",
    "async",
    "await",
    "lambda",
    "pass",
    "raise",
  ];
  for (const kw of pythonRequiredKeywords) {
    assert(
      PYTHON_KEYWORDS.some((k) => k.label === kw),
      `Python contains keyword '${kw}'`
    );
  }

  assert(PYTHON_SNIPPETS.length === 8, `Python defines 8 snippets (got ${PYTHON_SNIPPETS.length})`);
  const pythonRequiredSnippets = ["def", "class", "if", "ifelse", "for", "while", "try", "main"];
  for (const snip of pythonRequiredSnippets) {
    assert(
      PYTHON_SNIPPETS.some((s) => s.label === snip),
      `Python contains snippet '${snip}'`
    );
  }

  const pyMainSnip = PYTHON_SNIPPETS.find((s) => s.label === "main");
  assert(
    !!pyMainSnip && pyMainSnip.insertText.includes('if __name__ == "__main__":'),
    "Python 'main' snippet contains correct entry point check"
  );

  const pyDefSnip = PYTHON_SNIPPETS.find((s) => s.label === "def");
  assert(
    !!pyDefSnip && pyDefSnip.insertText.includes("def ${1:function_name}"),
    "Python 'def' snippet contains tabstop placeholders"
  );

  // -------------------------------------------------------------------------
  // TEST SUITE 2: C++ Completion Items & Snippets
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 2: C++ Completion Items & Snippets] ---");

  assert(CPP_KEYWORDS.length === 49, `C++ defines 49 keywords (got ${CPP_KEYWORDS.length})`);
  const cppRequiredKeywords = [
    "int",
    "char",
    "bool",
    "float",
    "double",
    "void",
    "auto",
    "class",
    "struct",
    "template",
    "namespace",
    "public",
    "private",
    "protected",
    "virtual",
    "nullptr",
    "return",
    "if",
    "else",
    "for",
    "while",
    "do",
    "switch",
    "case",
    "try",
    "catch",
  ];
  for (const kw of cppRequiredKeywords) {
    assert(
      CPP_KEYWORDS.some((k) => k.label === kw),
      `C++ contains keyword '${kw}'`
    );
  }

  assert(CPP_SNIPPETS.length === 7, `C++ defines 7 snippets (got ${CPP_SNIPPETS.length})`);
  const cppRequiredSnippets = ["main", "cout", "cin", "for", "class", "ifelse", "namespace"];
  for (const snip of cppRequiredSnippets) {
    assert(
      CPP_SNIPPETS.some((s) => s.label === snip),
      `C++ contains snippet '${snip}'`
    );
  }

  const cppMain = CPP_SNIPPETS.find((s) => s.label === "main");
  assert(
    !!cppMain && cppMain.insertText.includes("int main(int argc, char* argv[])"),
    "C++ 'main' snippet creates standard main entry point"
  );

  const cppCout = CPP_SNIPPETS.find((s) => s.label === "cout");
  assert(
    !!cppCout && cppCout.insertText.includes("std::cout <<"),
    "C++ 'cout' snippet outputs to std::cout"
  );

  // -------------------------------------------------------------------------
  // TEST SUITE 3: JavaScript Completion Items & Snippets
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 3: JavaScript Completion Items & Snippets] ---");

  assert(JS_KEYWORDS.length === 36, `JavaScript defines 36 keywords (got ${JS_KEYWORDS.length})`);
  const jsRequiredKeywords = [
    "async",
    "await",
    "function",
    "class",
    "const",
    "let",
    "var",
    "return",
    "if",
    "else",
    "switch",
    "case",
    "try",
    "catch",
    "finally",
    "export",
    "import",
    "new",
  ];
  for (const kw of jsRequiredKeywords) {
    assert(
      JS_KEYWORDS.some((k) => k.label === kw),
      `JavaScript contains keyword '${kw}'`
    );
  }

  assert(JS_SNIPPETS.length === 8, `JavaScript defines 8 snippets (got ${JS_SNIPPETS.length})`);
  const jsRequiredSnippets = [
    "clg",
    "function",
    "arrow",
    "async",
    "trycatch",
    "for",
    "foreach",
    "class",
  ];
  for (const snip of jsRequiredSnippets) {
    assert(
      JS_SNIPPETS.some((s) => s.label === snip),
      `JavaScript contains snippet '${snip}'`
    );
  }

  const jsClg = JS_SNIPPETS.find((s) => s.label === "clg");
  assert(
    !!jsClg && jsClg.insertText.includes("console.log(${1:value});"),
    "JavaScript 'clg' snippet outputs console.log"
  );

  // -------------------------------------------------------------------------
  // TEST SUITE 4: Java Completion Items & Snippets
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 4: Java Completion Items & Snippets] ---");

  assert(JAVA_KEYWORDS.length === 50, `Java defines 50 keywords (got ${JAVA_KEYWORDS.length})`);
  const javaRequiredKeywords = [
    "public",
    "private",
    "protected",
    "static",
    "final",
    "class",
    "interface",
    "abstract",
    "extends",
    "implements",
    "void",
    "int",
    "boolean",
    "if",
    "else",
    "try",
    "catch",
    "finally",
    "return",
    "new",
    "super",
    "this",
    "package",
    "import",
  ];
  for (const kw of javaRequiredKeywords) {
    assert(
      JAVA_KEYWORDS.some((k) => k.label === kw),
      `Java contains keyword '${kw}'`
    );
  }

  assert(JAVA_SNIPPETS.length === 7, `Java defines 7 snippets (got ${JAVA_SNIPPETS.length})`);
  const javaRequiredSnippets = ["main", "class", "sout", "for", "foreach", "trycatch", "ifelse"];
  for (const snip of javaRequiredSnippets) {
    assert(
      JAVA_SNIPPETS.some((s) => s.label === snip),
      `Java contains snippet '${snip}'`
    );
  }

  const javaMain = JAVA_SNIPPETS.find((s) => s.label === "main");
  assert(
    !!javaMain && javaMain.insertText.includes("public static void main(String[] args)"),
    "Java 'main' snippet contains public static void main"
  );

  const javaSout = JAVA_SNIPPETS.find((s) => s.label === "sout");
  assert(
    !!javaSout && javaSout.insertText.includes("System.out.println("),
    "Java 'sout' snippet contains System.out.println"
  );

  // -------------------------------------------------------------------------
  // TEST SUITE 5: Dynamic Range Calculation & Word Replacement
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 5: Dynamic Range Calculation & Word Replacement] ---");

  // Scenario 1: Empty file, cursor at line 1 column 1
  const emptyModel = {
    getWordUntilPosition: (pos: any) => ({
      word: "",
      startColumn: pos.column,
      endColumn: pos.column,
    }),
  };
  const emptyPos = { lineNumber: 1, column: 1 };

  const pyItemsEmpty = getPythonCompletionItems(mockMonaco, emptyModel as any, emptyPos as any);
  assert(
    pyItemsEmpty.length === 35 + 8,
    `Python returns all 43 suggestions on empty file (got ${pyItemsEmpty.length})`
  );

  const defKeyword = pyItemsEmpty.find((i) => i.label === "def" && i.kind === 17);
  assert(!!defKeyword, "Found 'def' keyword suggestion in empty file");
  assert(
    (defKeyword?.range as any).startColumn === 1 && (defKeyword?.range as any).endColumn === 1,
    "Range correctly collapses to column 1 in empty file"
  );

  const defSnippet = pyItemsEmpty.find((i) => i.label === "def" && i.kind === 28);
  assert(!!defSnippet, "Found 'def' snippet suggestion in empty file");
  assert(
    defSnippet?.insertTextRules === 4,
    "Snippet sets insertTextRules to CompletionItemInsertTextRule.InsertAsSnippet (4)"
  );

  // Scenario 2: User has typed "de" on line 2, columns 1..3
  const typedModel = {
    getWordUntilPosition: (_pos: any) => ({
      word: "de",
      startColumn: 1,
      endColumn: 3,
    }),
  };
  const typedPos = { lineNumber: 2, column: 3 };

  const pyItemsTyped = getPythonCompletionItems(mockMonaco, typedModel as any, typedPos as any);
  const typedDefKeyword = pyItemsTyped.find((i) => i.label === "def" && i.kind === 17);
  assert(
    (typedDefKeyword?.range as any).startLineNumber === 2 &&
      (typedDefKeyword?.range as any).startColumn === 1 &&
      (typedDefKeyword?.range as any).endColumn === 3,
    "Range accurately spans startColumn 1 to endColumn 3 for word replacement"
  );

  // Check C++, JS, and Java providers return expected counts
  const cppItems = getCppCompletionItems(mockMonaco, emptyModel as any, emptyPos as any);
  assert(cppItems.length === 49 + 7, `C++ returns all 56 suggestions (got ${cppItems.length})`);

  const jsItems = getJavascriptCompletionItems(mockMonaco, emptyModel as any, emptyPos as any);
  assert(
    jsItems.length === 36 + 8,
    `JavaScript returns all 44 suggestions (got ${jsItems.length})`
  );

  const javaItems = getJavaCompletionItems(mockMonaco, emptyModel as any, emptyPos as any);
  assert(javaItems.length === 50 + 7, `Java returns all 57 suggestions (got ${javaItems.length})`);

  // -------------------------------------------------------------------------
  // TEST SUITE 6: Provider Registry, Idempotency & Clean Disposal
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 6: Provider Registry & Idempotency] ---");

  // Reset before testing
  unregisterAllCompletionProviders();
  assert(!areCompletionProvidersRegistered(), "Initial registry state is unregistered");

  // First registration
  const disposables = registerAllCompletionProviders(mockMonaco);
  assert(
    areCompletionProvidersRegistered(),
    "areCompletionProvidersRegistered is true after registration"
  );
  assert(
    disposables.length === 4,
    `registerAllCompletionProviders returns 4 disposables (got ${disposables.length})`
  );
  assert(mockRegisteredProviders.python.length === 1, "Python provider registered exactly once");
  assert(mockRegisteredProviders.cpp.length === 1, "C++ provider registered exactly once");
  assert(
    mockRegisteredProviders.javascript.length === 1,
    "JavaScript provider registered exactly once"
  );
  assert(mockRegisteredProviders.java.length === 1, "Java provider registered exactly once");

  // Second registration (Idempotent guard test)
  const duplicateCallDisposables = registerAllCompletionProviders(mockMonaco);
  assert(
    duplicateCallDisposables.length === 4,
    "Subsequent registration returns existing disposables"
  );
  assert(
    mockRegisteredProviders.python.length === 1,
    "Python provider still registered exactly once (no duplicates created)"
  );
  assert(
    mockRegisteredProviders.cpp.length === 1,
    "C++ provider still registered exactly once (no duplicates created)"
  );
  assert(
    mockRegisteredProviders.javascript.length === 1,
    "JavaScript provider still registered exactly once (no duplicates created)"
  );
  assert(
    mockRegisteredProviders.java.length === 1,
    "Java provider still registered exactly once (no duplicates created)"
  );

  // Unregister / Disposal
  unregisterAllCompletionProviders();
  assert(
    !areCompletionProvidersRegistered(),
    "areCompletionProvidersRegistered is false after unregistering"
  );
  assert(
    mockDisposedCount === 4,
    `All 4 disposables were cleanly disposed (got ${mockDisposedCount})`
  );
  assert(mockRegisteredProviders.python.length === 0, "Python provider cleaned up");
  assert(mockRegisteredProviders.cpp.length === 0, "C++ provider cleaned up");
  assert(mockRegisteredProviders.javascript.length === 0, "JavaScript provider cleaned up");
  assert(mockRegisteredProviders.java.length === 0, "Java provider cleaned up");

  // -------------------------------------------------------------------------
  // TEST SUITE 7: Monaco Editor Configuration Settings
  // -------------------------------------------------------------------------
  console.log("\n--- [SUITE 7: Monaco Editor Configuration Settings] ---");

  assert(
    defaultEditorOptions.acceptSuggestionOnEnter === "on",
    "acceptSuggestionOnEnter is set to 'on'"
  );
  assert(defaultEditorOptions.tabCompletion === "on", "tabCompletion is set to 'on'");
  assert(
    defaultEditorOptions.wordBasedSuggestions === "matchingDocuments",
    "wordBasedSuggestions is set to 'matchingDocuments'"
  );
  assert(
    defaultEditorOptions.suggestOnTriggerCharacters === true,
    "suggestOnTriggerCharacters is enabled"
  );
  assert(
    typeof defaultEditorOptions.quickSuggestions === "object" &&
      (defaultEditorOptions.quickSuggestions as any).other === true &&
      (defaultEditorOptions.quickSuggestions as any).comments === false &&
      (defaultEditorOptions.quickSuggestions as any).strings === false,
    "quickSuggestions is enabled for code (other: true) and disabled for comments/strings"
  );
  assert(
    typeof defaultEditorOptions.parameterHints === "object" &&
      (defaultEditorOptions.parameterHints as any).enabled === true,
    "parameterHints is enabled"
  );
  assert(
    typeof defaultEditorOptions.suggest === "object" &&
      (defaultEditorOptions.suggest as any).showKeywords === true &&
      (defaultEditorOptions.suggest as any).showSnippets === true &&
      (defaultEditorOptions.suggest as any).showWords === true &&
      (defaultEditorOptions.suggest as any).preview === true &&
      (defaultEditorOptions.suggest as any).matchOnWordStartOnly === false,
    "suggest configuration has preview, keywords, snippets, words enabled, and matchOnWordStartOnly false"
  );

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n=================================================");
  console.log(`COMPLETION TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runCompletionTests().catch((err) => {
  console.error("Unexpected completion test runner failure:", err);
  process.exit(1);
});
