import { z } from "zod";

export const createActivitySchema = z.object({
  action: z
    .string()
    .trim()
    .min(1, "Action name is required")
    .max(100, "Action cannot exceed 100 characters"),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
});
