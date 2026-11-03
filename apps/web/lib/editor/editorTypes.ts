export type EditorTheme = "vs-dark" | "vs";

export type SaveStatus = "saved" | "saving" | "unsaved" | "error";

export interface CursorPosition {
  lineNumber: number;
  column: number;
}

export type SupportedMonacoLanguage = "cpp" | "python" | "javascript" | "java" | "plaintext";

export interface LanguageDefinition {
  monacoId: SupportedMonacoLanguage;
  displayName: string;
  tabSize: number;
  insertSpaces: boolean;
}

export interface ActiveEditorState {
  fileId: string | null;
  fileName: string;
  filePath: string;
  extension?: string;
  displayName: string;
  monacoLanguage: SupportedMonacoLanguage;
  content: string;
  savedContent: string;
  isDirty: boolean;
  saveStatus: SaveStatus;
  cursorPosition: CursorPosition;
  theme: EditorTheme;
  errorMessage?: string;
}
