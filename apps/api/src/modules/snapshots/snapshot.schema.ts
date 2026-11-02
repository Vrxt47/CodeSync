import { z } from "zod";

export const createSnapshotSchema = z.object({
  documentId: z.string().uuid("Invalid document/file ID format"),
  version: z.number().int().positive("Version must be a positive integer"),
  storageReference: z.string().trim().min(1, "Storage reference is required"),
});

export const snapshotParamsSchema = z.object({
  documentId: z.string().uuid("Invalid document/file ID format"),
});
