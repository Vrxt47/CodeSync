import { z } from "zod";

export const fileTypeSchema = z.enum(["FILE", "FOLDER"]);

export const createFileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "File or folder name is required")
    .max(255, "Name cannot exceed 255 characters")
    .refine((val) => !val.includes("/") && !val.includes("\\"), {
      message: "File or folder name cannot contain path separators",
    }),
  type: fileTypeSchema,
  parentId: z.string().uuid("Parent ID must be a valid UUID").optional().nullable(),
});

export const updateFileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(255, "Name cannot exceed 255 characters")
    .refine((val) => !val.includes("/") && !val.includes("\\"), {
      message: "File or folder name cannot contain path separators",
    })
    .optional(),
  parentId: z.string().uuid("Parent ID must be a valid UUID").optional().nullable(),
});

export const fileIdParamSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID format"),
  fileId: z.string().uuid("Invalid file ID format"),
});
