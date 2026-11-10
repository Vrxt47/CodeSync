import type { SupportedMonacoLanguage, LanguageDefinition } from "./editorTypes";
import type { SupportedLanguage } from "@/services/execution";

/**
 * Maps a file extension or filename to a supported Monaco language identifier.
 * First-class languages:
 * - C++: .cpp, .cc, .cxx, .hpp, .h -> 'cpp'
 * - Python: .py -> 'python'
 * - JavaScript: .js, .jsx, .mjs, .cjs -> 'javascript'
 * - Java: .java -> 'java'
 *
 * All other extensions fall back to 'plaintext' without misclassification.
 */
export function getMonacoLanguage(fileNameOrExt?: string): SupportedMonacoLanguage {
  if (!fileNameOrExt) return "plaintext";

  let ext = fileNameOrExt.toLowerCase();
  if (ext.includes(".")) {
    const parts = ext.split(".");
    ext = parts.pop() || "";
  }

  switch (ext) {
    case "cpp":
    case "cc":
    case "cxx":
    case "hpp":
    case "h":
      return "cpp";

    case "py":
      return "python";

    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "javascript";

    case "java":
      return "java";

    default:
      return "plaintext";
  }
}

/**
 * Returns human-readable display label for a Monaco language identifier.
 */
export function getLanguageDisplayName(lang: SupportedMonacoLanguage): string {
  switch (lang) {
    case "cpp":
      return "C++";
    case "python":
      return "Python";
    case "javascript":
      return "JavaScript";
    case "java":
      return "Java";
    default:
      return "Plain Text";
  }
}

/**
 * Returns the full language definition including editor formatting rules.
 */
export function getLanguageDefinition(fileNameOrExt?: string): LanguageDefinition {
  const monacoId = getMonacoLanguage(fileNameOrExt);
  return {
    monacoId,
    displayName: getLanguageDisplayName(monacoId),
    tabSize: 4,
    insertSpaces: true,
  };
}

/**
 * Validates whether a given language identifier is executable in CodeSync sandbox.
 */
export function isExecutableLanguage(lang?: string): lang is SupportedLanguage {
  return lang === "cpp" || lang === "python" || lang === "javascript" || lang === "java";
}
