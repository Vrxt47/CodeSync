import { z } from "zod";
import { workspaceRoleSchema } from "../workspaces/workspace.schema";

export const createInvitationSchema = z.object({
  role: workspaceRoleSchema,
  expiresAt: z.coerce.date().refine((date) => date.getTime() > Date.now(), {
    message: "Expiration date must be in the future",
  }),
});

export const acceptInvitationSchema = z.object({
  token: z.string().trim().min(1, "Invitation token is required"),
});

export const invitationIdParamSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID format"),
  invitationId: z.string().uuid("Invalid invitation ID format"),
});
