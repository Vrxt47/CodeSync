import jwt from "jsonwebtoken";
import { prisma, type WorkspaceRole } from "@codesync/database";
import { env } from "../config/env";
import { parseCollabDocumentName } from "../utils/document.utils";

export interface CollabAuthResult {
  userId: string;
  email?: string;
  name?: string;
  workspaceId: string;
  fileId: string;
  role: WorkspaceRole;
  readOnly: boolean;
}

export interface AccessTokenPayload {
  sub?: string;
  userId?: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
}

/**
 * Validates a JWT access token using the shared application secret.
 */
export function verifyCollabToken(token: string): AccessTokenPayload {
  if (!token || typeof token !== "string") {
    throw new Error("Authentication required: token is missing or invalid");
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    const userId = payload.userId || payload.sub;

    if (!userId || typeof userId !== "string") {
      throw new Error("Invalid token: subject/userId claim is missing");
    }

    return {
      ...payload,
      userId,
    };
  } catch (error: unknown) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Authentication failed: token has expired");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error(`Authentication failed: invalid token signature (${error.message})`);
    }
    throw error;
  }
}

/**
 * Validates token, document name, and database authorization for incoming connections.
 * Enforces Role-Based Access Control:
 * - OWNER: Read-Write
 * - EDITOR: Read-Write
 * - VIEWER: Read-Only
 */
export async function authorizeCollabConnection(
  token: string,
  documentName: string
): Promise<CollabAuthResult> {
  // 1. Verify token & extract identity
  const payload = verifyCollabToken(token);
  const userId = payload.userId!;

  // 2. Parse and validate document name
  const parsed = parseCollabDocumentName(documentName);
  if (!parsed) {
    throw new Error(
      `Invalid document name format: "${documentName}". Expected "workspace:<workspaceId>:file:<fileId>" with valid UUIDs.`
    );
  }

  const { workspaceId, fileId } = parsed;

  // 3. Verify workspace existence and user membership / ownership
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, ownerId: true },
  });

  if (!workspace) {
    throw new Error(`Workspace not found: "${workspaceId}"`);
  }

  let role: WorkspaceRole;

  if (workspace.ownerId === userId) {
    role = "OWNER";
  } else {
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      select: { role: true },
    });

    if (!member) {
      throw new Error(
        `Access denied: User "${userId}" is not a member of workspace "${workspaceId}"`
      );
    }

    role = member.role;
  }

  // 4. Verify file exists in workspace and is of type FILE (not FOLDER)
  const file = await prisma.file.findUnique({
    where: {
      workspaceId_id: {
        workspaceId,
        id: fileId,
      },
    },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      type: true,
    },
  });

  if (!file) {
    throw new Error(`File "${fileId}" not found in workspace "${workspaceId}"`);
  }

  if (file.type === "FOLDER") {
    throw new Error(
      `Cannot open "${file.name}" as a collaborative document: folder entities cannot be edited directly`
    );
  }

  // 5. Enforce read-only mode for VIEWERS
  const readOnly = role === "VIEWER";

  return {
    userId,
    email: payload.email,
    name: payload.name,
    workspaceId,
    fileId,
    role,
    readOnly,
  };
}
