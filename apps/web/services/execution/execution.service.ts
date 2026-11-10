import type { ExecutionAdapter } from "./execution.interface";
import type { ExecutionRequest, ExecutionResult, SupportedLanguage } from "./execution.types";
import { MockExecutionAdapter } from "./adapters/MockExecutionAdapter";

const SUPPORTED_LANGUAGES: ReadonlySet<SupportedLanguage> = new Set([
  "javascript",
  "python",
  "cpp",
  "java",
]);

/**
 * Central Execution Service.
 * Decouples the UI layer from specific sandbox adapters.
 *
 * Current: MockExecutionAdapter (simulated execution)
 * Future:  Judge0ExecutionAdapter (remote isolated execution)
 */
export class ExecutionService {
  private adapter: ExecutionAdapter;

  constructor(adapter: ExecutionAdapter = new MockExecutionAdapter()) {
    this.adapter = adapter;
  }

  /**
   * Returns the identifier of the active execution adapter.
   */
  public getAdapterName(): string {
    return this.adapter.name;
  }

  /**
   * Hot-swaps the active execution adapter.
   * Enables seamless replacement with Judge0ExecutionAdapter in future chunks without UI changes.
   */
  public setAdapter(adapter: ExecutionAdapter): void {
    if (!adapter) {
      throw new Error("Execution adapter cannot be null or undefined");
    }
    this.adapter = adapter;
  }

  /**
   * Dispatches code execution to the configured adapter with input validation.
   */
  public async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    if (!request) {
      throw new Error("Execution request cannot be null or undefined");
    }

    if (!request.language) {
      throw new Error("Execution request must specify a programming language");
    }

    if (!SUPPORTED_LANGUAGES.has(request.language)) {
      throw new Error(
        `Unsupported programming language: "${String(request.language)}". Supported languages are: ${Array.from(
          SUPPORTED_LANGUAGES
        ).join(", ")}`
      );
    }

    // Pass through to the configured adapter
    return this.adapter.execute(request);
  }
}

/**
 * Singleton execution service instance utilized across the IDE application.
 */
export const executionService = new ExecutionService();
