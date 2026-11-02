import type { z } from "zod";
import type { createSnapshotSchema, snapshotParamsSchema } from "./snapshot.schema";

export type CreateSnapshotInput = z.infer<typeof createSnapshotSchema>;
export type SnapshotParams = z.infer<typeof snapshotParamsSchema>;

export interface DocumentSnapshotResponse {
  id: string;
  documentId: string;
  version: number;
  storageReference: string;
  createdAt: Date;
}
