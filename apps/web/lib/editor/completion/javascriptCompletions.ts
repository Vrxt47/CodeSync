import type * as Monaco from "monaco-editor";
import type {
  KeywordItem,
  SnippetItem,
  CompletionItemsCollection,
  MinimalTextModel,
} from "./completionTypes";

/**
 * Modern ECMAScript / JavaScript keywords with documentation.
 */
export const JS_KEYWORDS: KeywordItem[] = [
  {
    label: "async",
    detail: "keyword",
    documentation: "Declares an async function returning a Promise implicitly.",
  },
  {
    label: "await",
    detail: "keyword",
    documentation: "Pauses async function execution until a Promise settles.",
  },
  { label: "break", detail: "keyword", documentation: "Breaks out of a switch or loop statement." },
  {
    label: "case",
    detail: "keyword",
    documentation: "Marks a case block inside a switch statement.",
  },
  {
    label: "catch",
    detail: "keyword",
    documentation: "Specifies a block of code to handle exceptions from try block.",
  },
  {
    label: "class",
    detail: "keyword",
    documentation: "Declares a class using prototypal inheritance semantics.",
  },
  {
    label: "const",
    detail: "keyword",
    documentation: "Declares a block-scoped, read-only constant reference.",
  },
  {
    label: "continue",
    detail: "keyword",
    documentation: "Advances loop execution to the next iteration.",
  },
  {
    label: "debugger",
    detail: "keyword",
    documentation: "Invokes available debugging functionality or breakpoint.",
  },
  {
    label: "default",
    detail: "keyword",
    documentation: "Specifies default branch in switch, or default module export.",
  },
  { label: "delete", detail: "keyword", documentation: "Deletes a property from an object." },
  {
    label: "do",
    detail: "keyword",
    documentation: "Executes a statement block before evaluating while condition.",
  },
  {
    label: "else",
    detail: "keyword",
    documentation: "Conditional branch executing when if expression is falsy.",
  },
  {
    label: "export",
    detail: "keyword",
    documentation: "Exports functions, objects, or primitives from a module.",
  },
  {
    label: "extends",
    detail: "keyword",
    documentation: "Creates a class that inherits from another parent class.",
  },
  {
    label: "finally",
    detail: "keyword",
    documentation: "Executes after try and catch clauses regardless of outcome.",
  },
  {
    label: "for",
    detail: "keyword",
    documentation: "Creates a loop with variable initialization, condition, and update.",
  },
  { label: "function", detail: "keyword", documentation: "Declares a JavaScript function object." },
  {
    label: "if",
    detail: "keyword",
    documentation: "Executes a statement block conditionally if test passes.",
  },
  {
    label: "import",
    detail: "keyword",
    documentation: "Imports bindings exported by an external module.",
  },
  {
    label: "in",
    detail: "keyword",
    documentation: "Checks whether a specified property exists in an object.",
  },
  {
    label: "instanceof",
    detail: "keyword",
    documentation: "Tests whether an object has in its prototype chain the constructor prototype.",
  },
  {
    label: "let",
    detail: "keyword",
    documentation: "Declares a reassignable, block-scoped local variable.",
  },
  {
    label: "new",
    detail: "keyword",
    documentation: "Instantiates an instance of an object having a constructor function.",
  },
  {
    label: "return",
    detail: "keyword",
    documentation: "Specifies value returned from a function and stops execution.",
  },
  {
    label: "static",
    detail: "keyword",
    documentation: "Defines static methods or fields bound to the class itself.",
  },
  {
    label: "super",
    detail: "keyword",
    documentation: "Calls the constructor or methods of a parent class.",
  },
  {
    label: "switch",
    detail: "keyword",
    documentation: "Evaluates an expression matching against multiple case clauses.",
  },
  {
    label: "this",
    detail: "keyword",
    documentation: "Refers to the context object executing current code.",
  },
  { label: "throw", detail: "keyword", documentation: "Throws a user-defined exception." },
  {
    label: "try",
    detail: "keyword",
    documentation: "Defines a block of code to test for errors while being executed.",
  },
  {
    label: "typeof",
    detail: "keyword",
    documentation: "Returns a string indicating the unevaluated operand type.",
  },
  {
    label: "var",
    detail: "keyword",
    documentation: "Declares a function-scoped or globally-scoped variable.",
  },
  {
    label: "void",
    detail: "keyword",
    documentation: "Evaluates an expression and returns undefined.",
  },
  {
    label: "while",
    detail: "keyword",
    documentation: "Executes a block while a specified condition is true.",
  },
  { label: "yield", detail: "keyword", documentation: "Pauses and resumes a generator function." },
];

/**
 * Productive JavaScript code snippets.
 */
export const JS_SNIPPETS: SnippetItem[] = [
  {
    label: "clg",
    detail: "console.log()",
    documentation: "Logs output to browser console or node terminal.",
    insertText: "console.log(${1:value});",
  },
  {
    label: "function",
    detail: "Function declaration",
    documentation: "Standard named function declaration.",
    insertText: "function ${1:name}(${2:params}) {\n\t${0}\n}",
  },
  {
    label: "arrow",
    detail: "Arrow function",
    documentation: "Constant arrow function assignment.",
    insertText: "const ${1:name} = (${2:params}) => {\n\t${0}\n};",
  },
  {
    label: "async",
    detail: "Async function",
    documentation: "Asynchronous function declaration returning a Promise.",
    insertText: "async function ${1:name}(${2:params}) {\n\t${0}\n}",
  },
  {
    label: "trycatch",
    detail: "Try-Catch block",
    documentation: "Standard error handling block.",
    insertText: "try {\n\t${1}\n} catch (error) {\n\t${0}\n}",
  },
  {
    label: "for",
    detail: "Index for loop",
    documentation: "Iterates over indexed elements using length property.",
    insertText: "for (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {\n\t${0}\n}",
  },
  {
    label: "foreach",
    detail: "Array.prototype.forEach",
    documentation: "Iterates over each item in an array using callback.",
    insertText: "${1:array}.forEach((${2:item}) => {\n\t${0}\n});",
  },
  {
    label: "class",
    detail: "Class declaration",
    documentation: "ES6 class structure with constructor.",
    insertText: "class ${1:ClassName} {\n\tconstructor(${2:params}) {\n\t\t${0}\n\t}\n}",
  },
];

export const JS_COMPLETIONS: CompletionItemsCollection = {
  keywords: JS_KEYWORDS,
  snippets: JS_SNIPPETS,
};

/**
 * Builds Monaco completion items for JavaScript based on cursor position.
 */
export function getJavascriptCompletionItems(
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
  for (const kw of JS_KEYWORDS) {
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
  for (const snip of JS_SNIPPETS) {
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
 * Registers the JavaScript completion provider on Monaco.
 */
export function registerJavascriptCompletionProvider(monaco: typeof Monaco): Monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider("javascript", {
    provideCompletionItems: (model, position) => {
      const suggestions = getJavascriptCompletionItems(monaco, model, position);
      return { suggestions };
    },
  });
}
