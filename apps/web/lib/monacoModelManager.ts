import type * as Monaco from "monaco-editor";

/**
 * Utility functions for managing Monaco editor text models.
 * Isolates model creation, retrieval, and disposal for multi-file editing.
 */
export const monacoModelManager = {
  /**
   * Get an existing Monaco model by URI, or create a new one if it does not exist.
   */
  getModel(
    monaco: typeof Monaco,
    uri: Monaco.Uri,
    content: string,
    language: string
  ): Monaco.editor.ITextModel {
    const existing = monaco.editor.getModel(uri);
    if (existing) {
      return existing;
    }
    return monaco.editor.createModel(content, language, uri);
  },

  /**
   * Safely dispose a Monaco model when a file is closed or deleted.
   */
  disposeModel(monaco: typeof Monaco, uri: Monaco.Uri): void {
    const existing = monaco.editor.getModel(uri);
    if (existing) {
      existing.dispose();
    }
  },
};
