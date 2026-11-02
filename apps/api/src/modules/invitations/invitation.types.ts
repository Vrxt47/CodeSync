import type { z } from "zod";
import type {
  createInvitationSchema,
  acceptInvitationSchema,
  invitationIdParamSchema,
} from "./invitation.schema";
import type { WorkspaceRole } from "../workspaces/workspace.types";

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type InvitationIdParam = z.infer<typeof invitationIdParamSchema>;

export interface InvitationResponse {
  id: string;
  workspaceId: string;
  role: WorkspaceRole;
  expiresAt: Date;
  revokedAt: Date | null;
}
