/**
 * Document Name Validation & Parsing Utilities
 * Canonical format: workspace:<workspaceId>:file:<fileId>
 */

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ParsedDocumentName {
  workspaceId: string;
  fileId: string;
}

export function isValidUUID(id: string): boolean {
  return typeof id === "string" && UUID_REGEX.test(id);
}

export function formatCollabDocumentName(workspaceId: string, fileId: string): string {
  return `workspace:${workspaceId}:file:${fileId}`;
}

export function parseCollabDocumentName(documentName: string): ParsedDocumentName | null {
  if (typeof documentName !== "string") return null;

  const match = documentName.match(/^workspace:([^:]+):file:([^:]+)$/);
  if (!match || !match[1] || !match[2]) {
    return null;
  }

  const workspaceId = match[1];
  const fileId = match[2];

  if (!isValidUUID(workspaceId) || !isValidUUID(fileId)) {
    return null;
  }

  return { workspaceId, fileId };
}
