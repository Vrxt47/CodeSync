import type { z } from "zod";
import type { createMessageSchema, messageQuerySchema } from "./message.schema";

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type MessageQueryInput = z.infer<typeof messageQuerySchema>;

export interface MessageResponse {
  id: string;
  workspaceId: string;
  senderId: string;
  content: string;
  createdAt: Date;
}
