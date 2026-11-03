export function getLanguageFromExtension(ext?: string): string {
  switch (ext?.toLowerCase()) {
    case "ts":
      return "TypeScript";
    case "tsx":
      return "TypeScript React";
    case "js":
      return "JavaScript";
    case "jsx":
      return "JavaScript React";
    case "py":
      return "Python";
    case "java":
      return "Java";
    case "cpp":
    case "cc":
    case "cxx":
      return "C++";
    case "c":
      return "C";
    case "h":
    case "hpp":
      return "C/C++ Header";
    case "json":
      return "JSON";
    case "md":
      return "Markdown";
    case "html":
      return "HTML";
    case "css":
      return "CSS";
    case "scss":
      return "SCSS";
    case "sql":
      return "SQL";
    case "sh":
    case "bash":
      return "Shell";
    default:
      return "Plain Text";
  }
}

export function getExtensionFromName(name: string): string | undefined {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop()?.toLowerCase() : undefined;
}

export { getMonacoLanguage, getLanguageDisplayName } from "./editor/languageUtils";
