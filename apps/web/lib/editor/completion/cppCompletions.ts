import type * as Monaco from "monaco-editor";
import type {
  KeywordItem,
  SnippetItem,
  CompletionItemsCollection,
  MinimalTextModel,
} from "./completionTypes";

/**
 * Standard C++ keywords with concise documentation.
 */
export const CPP_KEYWORDS: KeywordItem[] = [
  {
    label: "auto",
    detail: "keyword",
    documentation: "Specifies that the type of the variable is deduced from its initializer.",
  },
  { label: "bool", detail: "keyword", documentation: "Primitive boolean type (true or false)." },
  {
    label: "break",
    detail: "keyword",
    documentation: "Terminates the nearest enclosing loop or switch statement.",
  },
  {
    label: "case",
    detail: "keyword",
    documentation: "Introduces a branch label within a switch statement.",
  },
  {
    label: "catch",
    detail: "keyword",
    documentation: "Defines an exception handler block for a try block.",
  },
  { label: "char", detail: "keyword", documentation: "Primitive character type." },
  {
    label: "class",
    detail: "keyword",
    documentation: "Declares a user-defined class type with private default access.",
  },
  {
    label: "const",
    detail: "keyword",
    documentation: "Specifies that an object, variable, or pointer cannot be modified.",
  },
  {
    label: "continue",
    detail: "keyword",
    documentation: "Skips remaining statements in current loop iteration and advances.",
  },
  {
    label: "default",
    detail: "keyword",
    documentation:
      "Defines the default branch in a switch statement or explicitly defaulted function.",
  },
  {
    label: "delete",
    detail: "keyword",
    documentation: "Deallocates dynamic memory allocated with new, or disables a function.",
  },
  {
    label: "do",
    detail: "keyword",
    documentation: "Initiates a do-while loop with guaranteed post-condition check.",
  },
  { label: "double", detail: "keyword", documentation: "Double-precision floating-point type." },
  {
    label: "else",
    detail: "keyword",
    documentation: "Conditional alternative branch for an if statement.",
  },
  {
    label: "enum",
    detail: "keyword",
    documentation: "Declares an enumerated type comprising a set of named constants.",
  },
  {
    label: "extern",
    detail: "keyword",
    documentation: "Specifies external linkage for a variable or function declaration.",
  },
  { label: "false", detail: "keyword", documentation: "Boolean literal false." },
  { label: "float", detail: "keyword", documentation: "Single-precision floating-point type." },
  {
    label: "for",
    detail: "keyword",
    documentation: "Initiates a loop with initialization, condition, and increment expressions.",
  },
  {
    label: "if",
    detail: "keyword",
    documentation: "Conditionally executes a code block based on expression truthiness.",
  },
  {
    label: "inline",
    detail: "keyword",
    documentation:
      "Suggests function inlining to compiler and allows multiple definitions across translation units.",
  },
  { label: "int", detail: "keyword", documentation: "Standard signed integer primitive type." },
  {
    label: "long",
    detail: "keyword",
    documentation: "Integer modifier or type providing at least 32 bits (often 64 bits).",
  },
  {
    label: "namespace",
    detail: "keyword",
    documentation: "Declares a named scope that helps prevent identifier name collisions.",
  },
  {
    label: "new",
    detail: "keyword",
    documentation: "Allocates and constructs objects dynamically on the free store (heap).",
  },
  {
    label: "nullptr",
    detail: "keyword",
    documentation: "Type-safe null pointer literal constant of type std::nullptr_t.",
  },
  {
    label: "private",
    detail: "keyword",
    documentation: "Access specifier: members are accessible only within the declaring class.",
  },
  {
    label: "protected",
    detail: "keyword",
    documentation: "Access specifier: members are accessible within class and derived classes.",
  },
  {
    label: "public",
    detail: "keyword",
    documentation: "Access specifier: members are accessible from any scope.",
  },
  {
    label: "return",
    detail: "keyword",
    documentation: "Returns flow of control and optional value from a function.",
  },
  {
    label: "short",
    detail: "keyword",
    documentation: "Signed integer type providing at least 16 bits of storage.",
  },
  {
    label: "signed",
    detail: "keyword",
    documentation: "Modifier explicitly denoting a signed integer representation.",
  },
  {
    label: "sizeof",
    detail: "keyword",
    documentation: "Compile-time operator querying the byte size of a type or object.",
  },
  {
    label: "static",
    detail: "keyword",
    documentation: "Declares static duration, internal linkage, or class-scoped static member.",
  },
  {
    label: "struct",
    detail: "keyword",
    documentation: "Declares a user-defined record type with public default member access.",
  },
  {
    label: "switch",
    detail: "keyword",
    documentation: "Control flow statement transferring control to matching case label.",
  },
  {
    label: "template",
    detail: "keyword",
    documentation: "Declares a generic class, function, variable, or concept template.",
  },
  {
    label: "this",
    detail: "keyword",
    documentation: "Pointer to the current object instance inside a non-static member function.",
  },
  {
    label: "throw",
    detail: "keyword",
    documentation: "Signals the occurrence of an anomaly by raising an exception object.",
  },
  { label: "true", detail: "keyword", documentation: "Boolean literal true." },
  {
    label: "try",
    detail: "keyword",
    documentation: "Initiates an exception-handling block followed by catch clauses.",
  },
  {
    label: "typedef",
    detail: "keyword",
    documentation: "Creates a type alias for an existing data type.",
  },
  {
    label: "typename",
    detail: "keyword",
    documentation: "Declares a template type parameter or identifies a dependent type name.",
  },
  {
    label: "unsigned",
    detail: "keyword",
    documentation: "Modifier designating an unsigned (non-negative) integer type.",
  },
  {
    label: "using",
    detail: "keyword",
    documentation: "Brings names into scope or defines modern type aliases.",
  },
  {
    label: "virtual",
    detail: "keyword",
    documentation: "Enables polymorphic dynamic dispatch for member functions.",
  },
  {
    label: "void",
    detail: "keyword",
    documentation: "Represents the absence of type or an empty parameter list.",
  },
  {
    label: "volatile",
    detail: "keyword",
    documentation: "Informs compiler that value may change asynchronously (prevents caching).",
  },
  {
    label: "while",
    detail: "keyword",
    documentation: "Executes a block of code repeatedly while condition evaluates to true.",
  },
];

/**
 * Idiomatic C++ snippets.
 */
export const CPP_SNIPPETS: SnippetItem[] = [
  {
    label: "main",
    detail: "int main() template",
    documentation: "Standard C++ main function entry point.",
    insertText: "int main(int argc, char* argv[]) {\n\t${0}\n\treturn 0;\n}",
  },
  {
    label: "cout",
    detail: "std::cout statement",
    documentation: "Prints formatted output to standard output with newline.",
    insertText: "std::cout << ${1:value} << std::endl;",
  },
  {
    label: "cin",
    detail: "std::cin statement",
    documentation: "Reads formatted input from standard input stream.",
    insertText: "std::cin >> ${1:variable};",
  },
  {
    label: "for",
    detail: "for loop",
    documentation: "Standard indexed counting loop with pre-increment.",
    insertText: "for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n\t${0}\n}",
  },
  {
    label: "class",
    detail: "class declaration",
    documentation: "C++ class boilerplate with constructor, destructor, and access sections.",
    insertText:
      "class ${1:ClassName} {\npublic:\n\t${1:ClassName}();\n\t~${1:ClassName}();\n\nprivate:\n\t${0}\n};",
  },
  {
    label: "ifelse",
    detail: "if-else statement",
    documentation: "Standard C++ conditional branching construct.",
    insertText: "if (${1:condition}) {\n\t${2}\n} else {\n\t${0}\n}",
  },
  {
    label: "namespace",
    detail: "namespace block",
    documentation: "Declares a scoped namespace block.",
    insertText: "namespace ${1:name} {\n\t${0}\n}",
  },
];

export const CPP_COMPLETIONS: CompletionItemsCollection = {
  keywords: CPP_KEYWORDS,
  snippets: CPP_SNIPPETS,
};

/**
 * Builds Monaco completion items for C++ based on cursor position.
 */
export function getCppCompletionItems(
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
  for (const kw of CPP_KEYWORDS) {
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
  for (const snip of CPP_SNIPPETS) {
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
 * Registers the C++ completion provider on Monaco.
 */
export function registerCppCompletionProvider(monaco: typeof Monaco): Monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider("cpp", {
    provideCompletionItems: (model, position) => {
      const suggestions = getCppCompletionItems(monaco, model, position);
      return { suggestions };
    },
  });
}
