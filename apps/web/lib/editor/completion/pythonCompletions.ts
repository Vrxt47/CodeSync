import type * as Monaco from "monaco-editor";
import type {
  KeywordItem,
  SnippetItem,
  CompletionItemsCollection,
  MinimalTextModel,
} from "./completionTypes";

/**
 * Complete set of Python keywords with documentation.
 */
export const PYTHON_KEYWORDS: KeywordItem[] = [
  { label: "False", detail: "keyword", documentation: "Boolean value false." },
  {
    label: "None",
    detail: "keyword",
    documentation: "Represents the absence of a value or null pointer equivalent.",
  },
  { label: "True", detail: "keyword", documentation: "Boolean value true." },
  {
    label: "and",
    detail: "keyword",
    documentation: "Logical AND operator; evaluates second operand only if first is true.",
  },
  {
    label: "as",
    detail: "keyword",
    documentation: "Creates an alias in import statements or context manager expressions.",
  },
  {
    label: "assert",
    detail: "keyword",
    documentation: "Debugging aid that tests a condition, raising AssertionError if false.",
  },
  {
    label: "async",
    detail: "keyword",
    documentation: "Declares a coroutine function or asynchronous context/iteration.",
  },
  {
    label: "await",
    detail: "keyword",
    documentation: "Suspends the execution of a coroutine until the awaitable completes.",
  },
  {
    label: "break",
    detail: "keyword",
    documentation: "Terminates the nearest enclosing loop prematurely.",
  },
  { label: "class", detail: "keyword", documentation: "Defines a new user-defined class." },
  {
    label: "continue",
    detail: "keyword",
    documentation: "Skips the remainder of the current loop iteration and advances.",
  },
  { label: "def", detail: "keyword", documentation: "Defines a new function or method." },
  {
    label: "del",
    detail: "keyword",
    documentation: "Deletes a reference to an object, variable, or collection item.",
  },
  {
    label: "elif",
    detail: "keyword",
    documentation: "Short for 'else if', chained after an initial if statement.",
  },
  {
    label: "else",
    detail: "keyword",
    documentation: "Executes when preceding conditions evaluate to false, or on normal loop exit.",
  },
  {
    label: "except",
    detail: "keyword",
    documentation: "Catches and handles specified exceptions raised in a try block.",
  },
  {
    label: "finally",
    detail: "keyword",
    documentation: "Cleanup clause in a try block that executes under all circumstances.",
  },
  {
    label: "for",
    detail: "keyword",
    documentation: "Iterates over the elements of a sequence or iterable.",
  },
  {
    label: "from",
    detail: "keyword",
    documentation: "Specifies the module from which to import specific members.",
  },
  {
    label: "global",
    detail: "keyword",
    documentation: "Declares that a variable within a function belongs to module scope.",
  },
  {
    label: "if",
    detail: "keyword",
    documentation: "Executes a block of code conditionally if expression evaluates to true.",
  },
  {
    label: "import",
    detail: "keyword",
    documentation: "Loads external modules, packages, or namespaces into current scope.",
  },
  {
    label: "in",
    detail: "keyword",
    documentation: "Membership test operator and iteration keyword in for loops.",
  },
  {
    label: "is",
    detail: "keyword",
    documentation: "Tests for object identity (whether two references point to the same object).",
  },
  {
    label: "lambda",
    detail: "keyword",
    documentation: "Creates an anonymous inline function with a single expression.",
  },
  {
    label: "nonlocal",
    detail: "keyword",
    documentation: "Declares that a variable belongs to the nearest enclosing non-global scope.",
  },
  { label: "not", detail: "keyword", documentation: "Logical negation operator." },
  {
    label: "or",
    detail: "keyword",
    documentation: "Logical OR operator; short-circuits on first truthy value.",
  },
  {
    label: "pass",
    detail: "keyword",
    documentation: "Null operation placeholder when a statement is syntactically required.",
  },
  { label: "raise", detail: "keyword", documentation: "Raises an exception explicitly." },
  {
    label: "return",
    detail: "keyword",
    documentation: "Returns a value from a function and exits the execution context.",
  },
  {
    label: "try",
    detail: "keyword",
    documentation: "Encloses a block of statements to monitor and catch exceptions.",
  },
  {
    label: "while",
    detail: "keyword",
    documentation: "Executes a statement block repeatedly as long as condition remains true.",
  },
  {
    label: "with",
    detail: "keyword",
    documentation: "Wraps code execution within methods defined by a context manager.",
  },
  {
    label: "yield",
    detail: "keyword",
    documentation: "Yields a value from a generator function and suspends execution.",
  },
];

/**
 * Idiomatic Python code snippets.
 */
export const PYTHON_SNIPPETS: SnippetItem[] = [
  {
    label: "def",
    detail: "Function definition",
    documentation: "Defines a new Python function with parameters and return block.",
    insertText: "def ${1:function_name}(${2:args}):\n\t${0:pass}",
  },
  {
    label: "class",
    detail: "Class definition",
    documentation: "Defines a class with an __init__ constructor.",
    insertText: "class ${1:ClassName}:\n\tdef __init__(self${2:, args}):\n\t\t${0:pass}",
  },
  {
    label: "if",
    detail: "If statement",
    documentation: "Conditional branch based on boolean evaluation.",
    insertText: "if ${1:condition}:\n\t${0:pass}",
  },
  {
    label: "ifelse",
    detail: "If-Else statement",
    documentation: "Two-way conditional execution branch.",
    insertText: "if ${1:condition}:\n\t${2:pass}\nelse:\n\t${0:pass}",
  },
  {
    label: "for",
    detail: "For in loop",
    documentation: "Iterates through each element in an iterable collection.",
    insertText: "for ${1:item} in ${2:iterable}:\n\t${0:pass}",
  },
  {
    label: "while",
    detail: "While loop",
    documentation: "Repeatedly executes code while condition evaluates to true.",
    insertText: "while ${1:condition}:\n\t${0:pass}",
  },
  {
    label: "try",
    detail: "Try-Except block",
    documentation: "Exception handling block catching standard Exception with alias.",
    insertText: "try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${0:pass}",
  },
  {
    label: "main",
    detail: "if __name__ == '__main__':",
    documentation: "Boilerplate entry point check for executable script execution.",
    insertText: 'if __name__ == "__main__":\n\t${0:main()}',
  },
];

export const PYTHON_COMPLETIONS: CompletionItemsCollection = {
  keywords: PYTHON_KEYWORDS,
  snippets: PYTHON_SNIPPETS,
};

/**
 * Builds Monaco completion items for Python based on cursor position.
 */
export function getPythonCompletionItems(
  monaco: typeof Monaco,
  model: MinimalTextModel,
  position: Monaco.Position
): Monaco.languages.CompletionItem[] {
  const word = model.getWordUntilPosition(position);
  const range: Monaco.IRange = {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  };

  const suggestions: Monaco.languages.CompletionItem[] = [];

  // Register keywords
  for (const kw of PYTHON_KEYWORDS) {
    suggestions.push({
      label: kw.label,
      kind: monaco.languages.CompletionItemKind.Keyword,
      detail: kw.detail,
      documentation: kw.documentation,
      insertText: kw.label,
      range,
      sortText: `1_${kw.label}`,
    });
  }

  // Register snippets
  for (const snip of PYTHON_SNIPPETS) {
    suggestions.push({
      label: snip.label,
      kind: monaco.languages.CompletionItemKind.Snippet,
      detail: snip.detail,
      documentation: snip.documentation,
      insertText: snip.insertText,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      sortText: `0_${snip.label}`,
    });
  }

  return suggestions;
}

/**
 * Registers the Python completion provider on Monaco.
 */
export function registerPythonCompletionProvider(monaco: typeof Monaco): Monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider("python", {
    provideCompletionItems: (model, position) => {
      const suggestions = getPythonCompletionItems(monaco, model, position);
      return { suggestions };
    },
  });
}
