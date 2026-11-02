import type { z } from "zod";
import type {
  executionStatusSchema,
  createExecutionSchema,
  updateExecutionSchema,
} from "./execution.schema";

export type ExecutionStatus = z.infer<typeof executionStatusSchema>;
export type CreateExecutionInput = z.infer<typeof createExecutionSchema>;
export type UpdateExecutionInput = z.infer<typeof updateExecutionSchema>;

export interface ExecutionResponse {
  id: string;
  workspaceId: string;
  fileId: string;
  userId: string;
  language: string;
  status: ExecutionStatus;
  stdout: string | null;
  stderr: string | null;
  executionTime: number | null;
  createdAt: Date;
}
