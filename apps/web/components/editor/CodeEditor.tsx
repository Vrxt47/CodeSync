"use client";

import React, { useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import type { OnMount, OnChange } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { defaultEditorOptions } from "@/lib/editor/editorConfig";
import { registerAllCompletionProviders } from "@/lib/editor/completion";
import type { EditorTheme, SupportedMonacoLanguage } from "@/lib/editor/editorTypes";
import { Loader2 } from "lucide-react";

// Dynamically import Monaco to prevent any browser API evaluation during SSR
const MonacoEditorComponent = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 w-full h-full flex flex-col items-center justify-center bg-[#1E1E1E] text-[#858585] gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-[#007ACC]" />
      <span className="text-xs">Initializing Monaco Editor...</span>
    </div>
  ),
});

interface CodeEditorProps {
  value: string;
  language: SupportedMonacoLanguage;
  theme: EditorTheme;
  onChange: (value: string) => void;
  onCursorChange?: (lineNumber: number, column: number) => void;
  isLoading?: boolean;
  readOnly?: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  language,
  theme,
  onChange,
  onCursorChange,
  isLoading = false,
  readOnly = false,
}) => {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;

      // Register language-specific completion providers (keywords & snippets)
      registerAllCompletionProviders(monaco);

      // Configure editor formatting defaults for all languages
      monaco.languages.typescript?.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });

      // Track cursor position
      editor.onDidChangeCursorPosition((e) => {
        onCursorChange?.(e.position.lineNumber, e.position.column);
      });

      // Focus editor on mount
      editor.focus();
    },
    [onCursorChange]
  );

  const handleContentChange: OnChange = useCallback(
    (newValue) => {
      onChange(newValue ?? "");
    },
    [onChange]
  );

  if (isLoading) {
    return (
      <div className="flex-1 w-full h-full flex flex-col items-center justify-center bg-[#1E1E1E] text-[#858585] gap-3 select-none">
        <Loader2 className="h-6 w-6 animate-spin text-[#007ACC]" />
        <span className="text-xs">Loading file content...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full h-full overflow-hidden relative min-h-0 min-w-0">
      <MonacoEditorComponent
        height="100%"
        width="100%"
        language={language}
        theme={theme}
        value={value}
        onChange={handleContentChange}
        onMount={handleEditorMount}
        options={{
          ...defaultEditorOptions,
          readOnly,
        }}
        className="monaco-editor-container"
      />
    </div>
  );
};
