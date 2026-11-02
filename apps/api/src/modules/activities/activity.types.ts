import type { z } from "zod";
import type { createActivitySchema, activityQuerySchema } from "./activity.schema";

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type ActivityQueryInput = z.infer<typeof activityQuerySchema>;

export interface ActivityLogResponse {
  id: string;
  workspaceId: string;
  userId: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}
