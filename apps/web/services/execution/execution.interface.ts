import type { ExecutionRequest, ExecutionResult } from "./execution.types";

/**
 * Common execution adapter interface.
 * Decouples presentation and orchestration layers from execution sandboxes.
 * Allows seamless switching between MockExecutionAdapter (simulated) and Judge0ExecutionAdapter (production sandbox).
 */
export interface ExecutionAdapter {
  readonly name: string;
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}
