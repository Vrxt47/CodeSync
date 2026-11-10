"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ExecutionResult, ExecutionStatus, SupportedLanguage } from "@/services/execution";
import { executionService } from "@/services/execution";

export type ExecutionPanelTab = "output" | "input" | "history";

export interface UseExecutionOptions {
  initialStdin?: string;
  defaultHeight?: number;
  onEnsureOpen?: () => void;
}

export function useExecution(options?: UseExecutionOptions) {
  // 1. Custom stdin state - preserved across tab switching and executions
  const [stdin, setStdin] = useState<string>(options?.initialStdin ?? "");

  // 2. Active tab within the execution panel (Output / Input / Execution History)
  const [activeTab, setActiveTab] = useState<ExecutionPanelTab>("output");

  // 3. Current execution status and result (preserved across tab switches)
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>("idle");
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  // 4. Panel dimensions & resizing state
  const [panelHeight, setPanelHeightState] = useState<number>(options?.defaultHeight ?? 260);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  // Safe refs to avoid stale closures in callbacks
  const isExecutingRef = useRef(isExecuting);
  isExecutingRef.current = isExecuting;
  const stdinRef = useRef(stdin);
  stdinRef.current = stdin;
  const onEnsureOpenRef = useRef(options?.onEnsureOpen);
  onEnsureOpenRef.current = options?.onEnsureOpen;

  // Stdin actions
  const clearStdin = useCallback(() => {
    setStdin("");
  }, []);

  // Execution result actions
  const clearOutput = useCallback(() => {
    setExecutionResult(null);
    setExecutionStatus("idle");
  }, []);

  // Resizing actions
  const setPanelHeight = useCallback((height: number) => {
    setPanelHeightState(height);
  }, []);

  const toggleMaximized = useCallback(() => {
    setIsMaximized((prev) => !prev);
  }, []);

  // Execution operation
  const runExecution = useCallback(
    async (params: {
      sourceCode: string;
      language: SupportedLanguage;
      fileName?: string;
    }): Promise<ExecutionResult | undefined> => {
      // Guard against rapid duplicate or overlapping executions
      if (isExecutingRef.current) {
        return;
      }

      setIsExecuting(true);
      setExecutionStatus("running");
      setActiveTab("output");

      // Auto-expand panel if collapsed
      onEnsureOpenRef.current?.();

      try {
        const result = await executionService.execute({
          sourceCode: params.sourceCode,
          language: params.language,
          stdin: stdinRef.current,
          fileName: params.fileName,
        });

        setExecutionResult(result);
        setExecutionStatus(result.status);
        return result;
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error ? err.message : "Execution failed due to an unexpected error.";
        const errorResult: ExecutionResult = {
          executionId: `err-${Date.now()}`,
          status: "internal_error",
          stdout: "",
          stderr: errorMsg,
          executionTime: 0,
          memoryUsage: 0,
          exitCode: 1,
          executedAt: new Date().toISOString(),
          isSimulated: true,
        };
        setExecutionResult(errorResult);
        setExecutionStatus("internal_error");
        return errorResult;
      } finally {
        setIsExecuting(false);
      }
    },
    []
  );

  return {
    // Stdin
    stdin,
    setStdin,
    clearStdin,

    // Tabs
    activeTab,
    setActiveTab,

    // Execution Result & Status
    executionResult,
    setExecutionResult,
    executionStatus,
    setExecutionStatus,
    isExecuting,
    setIsExecuting,
    clearOutput,

    // Operation
    runExecution,

    // Sizing
    panelHeight,
    setPanelHeight,
    isMaximized,
    toggleMaximized,
  };
}
