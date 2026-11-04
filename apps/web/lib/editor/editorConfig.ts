import type { EditorTheme, EditorSettings } from "./editorTypes";
import type { EditorProps } from "@monaco-editor/react";

export const THEME_STORAGE_KEY = "codesync_editor_theme";
export const SETTINGS_STORAGE_KEY = "codesync_editor_settings";
export const DEFAULT_THEME: EditorTheme = "vs-dark";

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 14,
  tabSize: 4,
  wordWrap: "on",
  minimap: true,
  theme: "vs-dark",
};

/**
 * Retrieve persisted editor settings preference with strict fallback validation.
 */
export function getStoredSettings(): EditorSettings {
  if (typeof window === "undefined") return DEFAULT_EDITOR_SETTINGS;
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") {
        const fontSize =
          typeof parsed.fontSize === "number" && parsed.fontSize >= 10 && parsed.fontSize <= 30
            ? parsed.fontSize
            : DEFAULT_EDITOR_SETTINGS.fontSize;

        const tabSize =
          parsed.tabSize === 2 || parsed.tabSize === 4 || parsed.tabSize === 8
            ? parsed.tabSize
            : DEFAULT_EDITOR_SETTINGS.tabSize;

        const wordWrap =
          parsed.wordWrap === "on" || parsed.wordWrap === "off"
            ? parsed.wordWrap
            : DEFAULT_EDITOR_SETTINGS.wordWrap;

        const minimap =
          typeof parsed.minimap === "boolean" ? parsed.minimap : DEFAULT_EDITOR_SETTINGS.minimap;

        const theme: EditorTheme =
          parsed.theme === "vs" || parsed.theme === "vs-dark" || parsed.theme === "hc-black"
            ? parsed.theme
            : DEFAULT_EDITOR_SETTINGS.theme;

        return {
          fontSize,
          tabSize,
          wordWrap,
          minimap,
          theme,
        };
      }
    }
  } catch {
    // Fallback on parse or storage access error
  }
  return DEFAULT_EDITOR_SETTINGS;
}

/**
 * Store editor settings preference in localStorage.
 */
export function setStoredSettings(settings: EditorSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors in restricted iframe/browser environments
  }
}

/**
 * Retrieve persisted editor theme preference, defaulting to VS Code Dark+.
 */
export function getStoredTheme(): EditorTheme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "vs" || stored === "vs-dark" || stored === "hc-black") {
      return stored;
    }
  } catch {
    // Fallback if localStorage access is blocked
  }
  return DEFAULT_THEME;
}

/**
 * Store editor theme preference in localStorage.
 */
export function setStoredTheme(theme: EditorTheme): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage errors in restricted iframe/browser environments
  }
}

/**
 * Default Monaco Editor options strictly complying with Chunk 7 specifications.
 */
export const defaultEditorOptions: NonNullable<EditorProps["options"]> = {
  // Line numbers
  lineNumbers: "on",

  // Minimap
  minimap: {
    enabled: true,
  },

  // Code folding
  folding: true,
  showFoldingControls: "mouseover",

  // Bracket matching & colorization
  matchBrackets: "always",
  bracketPairColorization: {
    enabled: true,
  },

  // Auto indentation
  autoIndent: "advanced",

  // Word wrapping
  wordWrap: "on",
  wrappingIndent: "indent",

  // Automatic layout calculation on container resize
  automaticLayout: true,

  // Smooth scrolling
  smoothScrolling: true,

  // Scroll beyond last line disabled
  scrollBeyondLastLine: false,

  // Render whitespace on selection
  renderWhitespace: "selection",

  // Highlight active line
  renderLineHighlight: "all",

  // IntelliSense & Suggestions
  suggestOnTriggerCharacters: true,
  quickSuggestions: {
    other: true,
    comments: false,
    strings: false,
  },
  parameterHints: {
    enabled: true,
  },
  acceptSuggestionOnEnter: "on",
  tabCompletion: "on",
  wordBasedSuggestions: "matchingDocuments",
  suggest: {
    preview: true,
    showKeywords: true,
    showSnippets: true,
    showWords: true,
    matchOnWordStartOnly: false,
  },

  // Format on paste & type
  formatOnPaste: true,
  formatOnType: true,

  // Indentation: 4 spaces
  tabSize: 4,
  insertSpaces: true,

  // Typography & UI polish
  fontSize: 13,
  lineHeight: 20,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
  fontLigatures: true,
  cursorBlinking: "smooth",
  cursorSmoothCaretAnimation: "on",

  // Accessibility & Context menu
  contextmenu: true,
  fixedOverflowWidgets: true,
  padding: {
    top: 10,
    bottom: 10,
  },
};
