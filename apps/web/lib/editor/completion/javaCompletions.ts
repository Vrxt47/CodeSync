import type * as Monaco from "monaco-editor";
import type {
  KeywordItem,
  SnippetItem,
  CompletionItemsCollection,
  MinimalTextModel,
} from "./completionTypes";

/**
 * Standard Java language keywords with documentation.
 */
export const JAVA_KEYWORDS: KeywordItem[] = [
  {
    label: "abstract",
    detail: "keyword",
    documentation: "Declares a class or method without implementation to be extended/implemented.",
  },
  {
    label: "assert",
    detail: "keyword",
    documentation: "Tests an assertion condition; throws AssertionError if false.",
  },
  {
    label: "boolean",
    detail: "keyword",
    documentation: "Primitive boolean data type having true or false values.",
  },
  {
    label: "break",
    detail: "keyword",
    documentation: "Breaks out of a switch block or loop construct.",
  },
  {
    label: "byte",
    detail: "keyword",
    documentation: "Primitive 8-bit signed two's complement integer.",
  },
  {
    label: "case",
    detail: "keyword",
    documentation: "Marks an execution branch in a switch statement.",
  },
  {
    label: "catch",
    detail: "keyword",
    documentation: "Handles specific exceptions thrown within a try block.",
  },
  {
    label: "char",
    detail: "keyword",
    documentation: "Primitive 16-bit Unicode character data type.",
  },
  {
    label: "class",
    detail: "keyword",
    documentation: "Defines the blueprint for an object or user type.",
  },
  {
    label: "const",
    detail: "keyword",
    documentation: "Reserved keyword in Java; not used, use final instead.",
  },
  {
    label: "continue",
    detail: "keyword",
    documentation: "Skips remainder of current loop iteration and advances.",
  },
  {
    label: "default",
    detail: "keyword",
    documentation: "Specifies default branch in switch statement, or default method in interface.",
  },
  {
    label: "do",
    detail: "keyword",
    documentation: "Initiates a do-while loop with post-condition check.",
  },
  {
    label: "double",
    detail: "keyword",
    documentation: "Primitive double-precision 64-bit IEEE 754 floating point.",
  },
  {
    label: "else",
    detail: "keyword",
    documentation: "Defines the alternative block in an if statement.",
  },
  {
    label: "enum",
    detail: "keyword",
    documentation: "Defines a fixed set of named constants type-safely.",
  },
  {
    label: "extends",
    detail: "keyword",
    documentation: "Indicates that a class or interface inherits from a superclass/interface.",
  },
  {
    label: "final",
    detail: "keyword",
    documentation:
      "Declares that a variable cannot be reassigned, method cannot be overridden, or class cannot be subclassed.",
  },
  {
    label: "finally",
    detail: "keyword",
    documentation: "Guaranteed cleanup block following a try-catch sequence.",
  },
  {
    label: "float",
    detail: "keyword",
    documentation: "Primitive single-precision 32-bit IEEE 754 floating point.",
  },
  {
    label: "for",
    detail: "keyword",
    documentation: "Initiates a counting or enhanced collection iteration loop.",
  },
  { label: "goto", detail: "keyword", documentation: "Reserved keyword in Java; not used." },
  {
    label: "if",
    detail: "keyword",
    documentation: "Conditional execution branching based on boolean condition.",
  },
  {
    label: "implements",
    detail: "keyword",
    documentation: "Declares that a class realizes one or more interfaces.",
  },
  {
    label: "import",
    detail: "keyword",
    documentation: "Brings classes, interfaces, or static members from packages into scope.",
  },
  {
    label: "instanceof",
    detail: "keyword",
    documentation: "Tests whether an object reference is an instance of a specified type.",
  },
  {
    label: "int",
    detail: "keyword",
    documentation: "Primitive 32-bit signed two's complement integer.",
  },
  {
    label: "interface",
    detail: "keyword",
    documentation: "Declares an interface contract containing method signatures and constants.",
  },
  {
    label: "long",
    detail: "keyword",
    documentation: "Primitive 64-bit signed two's complement integer.",
  },
  {
    label: "native",
    detail: "keyword",
    documentation: "Specifies that a method is implemented in native platform code via JNI.",
  },
  {
    label: "new",
    detail: "keyword",
    documentation: "Instantiates a new instance of a class by invoking constructor.",
  },
  {
    label: "package",
    detail: "keyword",
    documentation: "Declares the namespace package group to which the file belongs.",
  },
  {
    label: "private",
    detail: "keyword",
    documentation: "Access modifier restricting visibility strictly to declaring class.",
  },
  {
    label: "protected",
    detail: "keyword",
    documentation: "Access modifier restricting visibility to declaring package and subclasses.",
  },
  {
    label: "public",
    detail: "keyword",
    documentation: "Access modifier granting universal visibility across all packages.",
  },
  {
    label: "return",
    detail: "keyword",
    documentation: "Returns from a method and optionally supplies the return value.",
  },
  {
    label: "short",
    detail: "keyword",
    documentation: "Primitive 16-bit signed two's complement integer.",
  },
  {
    label: "static",
    detail: "keyword",
    documentation: "Denotes members belonging to the class type rather than instances.",
  },
  {
    label: "strictfp",
    detail: "keyword",
    documentation: "Restricts floating-point calculations to strict IEEE precision.",
  },
  {
    label: "super",
    detail: "keyword",
    documentation: "Refers to the immediate parent class instance or constructor.",
  },
  {
    label: "switch",
    detail: "keyword",
    documentation: "Multi-branch statement comparing variable against constant values.",
  },
  {
    label: "synchronized",
    detail: "keyword",
    documentation: "Acquires an intrinsic monitor lock on a code block or method.",
  },
  {
    label: "this",
    detail: "keyword",
    documentation: "Refers to current instance of the class in non-static context.",
  },
  {
    label: "throw",
    detail: "keyword",
    documentation: "Explicitly throws an instance of Throwable or subclass.",
  },
  {
    label: "throws",
    detail: "keyword",
    documentation: "Declares checked exceptions that may be propagated from a method.",
  },
  {
    label: "transient",
    detail: "keyword",
    documentation: "Prevents a field from being included in serialization streams.",
  },
  {
    label: "try",
    detail: "keyword",
    documentation: "Guards a code block for exception monitoring or try-with-resources.",
  },
  {
    label: "void",
    detail: "keyword",
    documentation: "Specifies that a method does not return a value.",
  },
  {
    label: "volatile",
    detail: "keyword",
    documentation: "Guarantees memory visibility of variable reads and writes across threads.",
  },
  {
    label: "while",
    detail: "keyword",
    documentation: "Repeatedly executes code while condition evaluates to true.",
  },
];

/**
 * Common Java snippets.
 */
export const JAVA_SNIPPETS: SnippetItem[] = [
  {
    label: "main",
    detail: "public static void main",
    documentation: "Standard public static void main entry point.",
    insertText: "public static void main(String[] args) {\n\t${0}\n}",
  },
  {
    label: "class",
    detail: "public class declaration",
    documentation: "Public class definition with matching constructor.",
    insertText: "public class ${1:ClassName} {\n\tpublic ${1:ClassName}() {\n\t\t${0}\n\t}\n}",
  },
  {
    label: "sout",
    detail: "System.out.println()",
    documentation: "Prints an expression to standard output with trailing newline.",
    insertText: "System.out.println(${1});",
  },
  {
    label: "for",
    detail: "for loop",
    documentation: "Indexed loop counting with integer index variable.",
    insertText: "for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t${0}\n}",
  },
  {
    label: "foreach",
    detail: "enhanced for loop",
    documentation: "Iterates through elements of an Iterable collection or array.",
    insertText: "for (${1:Type} ${2:item} : ${3:collection}) {\n\t${0}\n}",
  },
  {
    label: "trycatch",
    detail: "try-catch block",
    documentation: "Exception handling block catching Exception.",
    insertText: "try {\n\t${1}\n} catch (${2:Exception} e) {\n\t${0}\n}",
  },
  {
    label: "ifelse",
    detail: "if-else statement",
    documentation: "Two-branch conditional execution.",
    insertText: "if (${1:condition}) {\n\t${2}\n} else {\n\t${0}\n}",
  },
];

export const JAVA_COMPLETIONS: CompletionItemsCollection = {
  keywords: JAVA_KEYWORDS,
  snippets: JAVA_SNIPPETS,
};

/**
 * Builds Monaco completion items for Java based on cursor position.
 */
export function getJavaCompletionItems(
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
  for (const kw of JAVA_KEYWORDS) {
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
  for (const snip of JAVA_SNIPPETS) {
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
 * Registers the Java completion provider on Monaco.
 */
export function registerJavaCompletionProvider(monaco: typeof Monaco): Monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider("java", {
    provideCompletionItems: (model, position) => {
      const suggestions = getJavaCompletionItems(monaco, model, position);
      return { suggestions };
    },
  });
}
