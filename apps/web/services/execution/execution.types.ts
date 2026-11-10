import type { SupportedLanguageId } from "@codesync/shared";

/**
 * First-class supported languages in CodeSync execution environment.
 */
export type SupportedLanguage = SupportedLanguageId; // "javascript" | "python" | "cpp" | "java"

/**
 * Granular execution lifecycle and terminal statuses.
 */
export type ExecutionStatus =
  | "idle"
  | "queued"
  | "running"
  | "success"
  | "compilation_error"
  | "runtime_error"
  | "validation_error"
  | "time_limit_exceeded"
  | "memory_limit_exceeded"
  | "internal_error";

/**
 * Strongly-typed request payload delivered to execution adapters.
 */
export interface ExecutionRequest {
  sourceCode: string;
  language: SupportedLanguage;
  stdin: string;
  fileName?: string;
}

/**
 * Strongly-typed execution result returned by execution adapters.
 */
export interface ExecutionResult {
  executionId: string;
  status: ExecutionStatus;
  stdout: string;
  stderr: string;
  compilationError?: string;
  runtimeError?: string;
  validationError?: string;
  executionTime: number; // in milliseconds (simulated in mock adapter)
  memoryUsage: number; // in megabytes (simulated in mock adapter)
  exitCode: number | null;
  executedAt: string; // ISO 8601 timestamp
  isSimulated: boolean; // explicitly labels simulated metrics
}
