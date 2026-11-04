import { z } from "zod";

export const fileTypeSchema = z.enum(["FILE", "FOLDER"]);

export const fileNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(255, "Name cannot exceed 255 characters")
  .refine((val) => !val.includes("/") && !val.includes("\\"), {
    message: "Name cannot contain path separators ('/' or '\\')",
  })
  .refine((val) => !val.includes("\0"), {
    message: "Name cannot contain null bytes",
  })
  .refine((val) => val !== "." && val !== "..", {
    message: "Name cannot be reserved dot paths ('.' or '..')",
  });

export const createFileSchema = z.object({
  name: fileNameSchema,
  parentId: z.string().uuid("Parent ID must be a valid UUID").optional().nullable(),
});

export const createFolderSchema = z.object({
  name: fileNameSchema,
  parentId: z.string().uuid("Parent ID must be a valid UUID").optional().nullable(),
});

export const renameFileSchema = z.object({
  name: fileNameSchema,
});

export const moveFileSchema = z.object({
  targetParentId: z.string().uuid("Target parent ID must be a valid UUID").optional().nullable(),
});

export const updateFileContentSchema = z.object({
  content: z.string({ required_error: "Content must be a string" }),
  expectedVersion: z
    .number({
      required_error: "expectedVersion is required for file content updates",
      invalid_type_error: "expectedVersion must be an integer",
    })
    .int("expectedVersion must be an integer")
    .min(1, "expectedVersion must be at least 1"),
});

export const workspaceIdParamSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID format"),
});

export const fileIdParamSchema = z.object({
  fileId: z.string().uuid("Invalid file ID format"),
});
