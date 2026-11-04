import type * as Monaco from "monaco-editor";

/**
 * Raw definition for a keyword completion item.
 */
export interface KeywordItem {
  label: string;
  detail?: string;
  documentation: string;
}

/**
 * Raw definition for a snippet completion item.
 */
export interface SnippetItem {
  label: string;
  detail: string;
  documentation: string;
  insertText: string;
}

/**
 * Common shape for completion provider results.
 */
export interface CompletionItemsCollection {
  keywords: KeywordItem[];
  snippets: SnippetItem[];
}

/**
 * Minimal interface representing a Monaco TextModel for range calculation.
 */
export interface MinimalTextModel {
  getWordUntilPosition(position: Monaco.Position): {
    word: string;
    startColumn: number;
    endColumn: number;
  };
}
