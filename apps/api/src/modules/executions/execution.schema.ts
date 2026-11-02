import { z } from "zod";

export const executionStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "SUCCESS",
  "FAILED",
  "TIMEOUT",
  "CANCELLED",
]);

export const createExecutionSchema = z.object({
  fileId: z.string().uuid("Invalid file ID format"),
  language: z
    .string()
    .trim()
    .min(1, "Language is required")
    .max(50, "Language cannot exceed 50 characters"),
  stdin: z.string().optional(),
});

export const updateExecutionSchema = z.object({
  status: executionStatusSchema,
  stdout: z.string().optional().nullable(),
  stderr: z.string().optional().nullable(),
  executionTime: z.number().int().nonnegative().optional().nullable(),
});
