import { z } from "zod";

export const workspaceRoleSchema = z.enum(["OWNER", "EDITOR", "VIEWER"]);

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Workspace name is required")
    .max(100, "Name cannot exceed 100 characters"),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .nullable(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional().nullable(),
});

export const workspaceIdParamSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID format"),
});

export const addWorkspaceMemberSchema = z.object({
  userId: z.string().uuid("Invalid user ID format"),
  role: workspaceRoleSchema,
});

export const updateMemberRoleSchema = z.object({
  role: workspaceRoleSchema,
});
