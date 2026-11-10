import { prisma, type Prisma } from "../../config/database";
import { AppError } from "../../utils/AppError";
import { fileQueue } from "../../utils/fileQueue";
import type {
  CreateFileInput,
  CreateFolderInput,
  RenameFileInput,
  MoveFileInput,
  UpdateFileContentInput,
  FileItemResponse,
  FileTreeNode,
  WorkspaceTreeResponse,
} from "./file.types";

export class FileService {
  /**
   * Helper to verify that the user is an active member of the workspace
   * and has sufficient permissions for the requested action.
   */
  private static async verifyWorkspacePermission(
    workspaceId: string,
    userId: string,
    requireWrite = false
  ) {
    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!member) {
      throw new AppError(
        "You do not have access to this workspace",
        403,
        "WORKSPACE_ACCESS_DENIED"
      );
    }

    if (requireWrite && member.role === "VIEWER") {
      throw new AppError(
        "You do not have permission to modify files in this workspace",
        403,
        "INSUFFICIENT_PERMISSIONS"
      );
    }

    return member;
  }

  /**
   * Retrieve the complete directory tree for a workspace.
   * Folders are sorted before files, and items at the same level are sorted alphabetically.
   * Content is excluded to keep payload lightweight.
   */
  public static async getWorkspaceTree(
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceTreeResponse> {
    await this.verifyWorkspacePermission(workspaceId, userId, false);

    const items = await prisma.file.findMany({
      where: { workspaceId },
      select: {
        id: true,
        workspaceId: true,
        parentId: true,
        name: true,
        type: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Build hierarchical tree
    const nodeMap = new Map<string, FileTreeNode>();
    const rootNodes: FileTreeNode[] = [];

    // First pass: instantiate nodes
    for (const item of items) {
      const node: FileTreeNode = {
        id: item.id,
        workspaceId: item.workspaceId,
        parentId: item.parentId,
        name: item.name,
        type: item.type,
        version: item.version,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        ...(item.type === "FOLDER" ? { children: [] } : {}),
      };
      nodeMap.set(item.id, node);
    }

    // Second pass: attach to parents or root
    for (const item of items) {
      const node = nodeMap.get(item.id)!;
      if (item.parentId === null) {
        rootNodes.push(node);
      } else {
        const parentNode = nodeMap.get(item.parentId);
        if (parentNode && parentNode.children) {
          parentNode.children.push(node);
        } else {
          // If parent is missing or not a folder, treat as root to prevent orphaned invisible files
          rootNodes.push(node);
        }
      }
    }

    // Sort nodes recursively: folders first, then alphabetically case-insensitive
    const sortNodes = (nodes: FileTreeNode[]) => {
      nodes.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "FOLDER" ? -1 : 1;
        }
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });

      for (const node of nodes) {
        if (node.children && node.children.length > 0) {
          sortNodes(node.children);
        }
      }
    };

    sortNodes(rootNodes);

    return {
      workspaceId,
      tree: rootNodes,
    };
  }

  /**
   * Retrieve a single file's complete metadata and content.
   * Validates workspace membership and restricts folder reading.
   */
  public static async getFileById(fileId: string, userId: string): Promise<FileItemResponse> {
    return fileQueue.enqueue(fileId, async () => {
      const file = await prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        throw new AppError("File not found", 404, "FILE_NOT_FOUND");
      }

      await this.verifyWorkspacePermission(file.workspaceId, userId, false);

      if (file.type !== "FILE") {
        throw new AppError(
          "Cannot retrieve file content for a directory",
          400,
          "CANNOT_OPEN_FOLDER"
        );
      }

      return file;
    });
  }

  /**
   * Update a file's content atomically with optimistic concurrency locking.
   * Requires write permission (EDITOR or OWNER; VIEWER is rejected with 403).
   * Rejects modification of folders with 400.
   */
  public static async updateContent(
    fileId: string,
    userId: string,
    input: UpdateFileContentInput
  ): Promise<FileItemResponse> {
    return fileQueue.enqueue(fileId, async () => {
      const file = await prisma.file.findUnique({
        where: { id: fileId },
        select: { id: true, workspaceId: true, type: true },
      });

      if (!file) {
        throw new AppError("File not found", 404, "FILE_NOT_FOUND");
      }

      await this.verifyWorkspacePermission(file.workspaceId, userId, true);

      if (file.type !== "FILE") {
        throw new AppError("Cannot save content to a directory", 400, "CANNOT_MODIFY_FOLDER");
      }

      if (typeof input.expectedVersion !== "number" || Number.isNaN(input.expectedVersion)) {
        throw new AppError(
          "expectedVersion is required for file content updates",
          400,
          "VERSION_REQUIRED"
        );
      }

      // Atomic conditional update in a single SQL statement in PostgreSQL
      const result = await prisma.file.updateMany({
        where: {
          id: fileId,
          version: input.expectedVersion,
        },
        data: {
          content: input.content,
          // Reset binary CRDT snapshot so next collaborative session re-seeds from authoritative plain text
          yjsState: null,
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      if (result.count === 0) {
        const current = await prisma.file.findUnique({
          where: { id: fileId },
          select: { id: true, version: true },
        });

        if (!current) {
          throw new AppError("File not found", 404, "FILE_NOT_FOUND");
        }

        throw new AppError(
          "File has been modified by another user or session",
          409,
          "CONCURRENT_MODIFICATION",
          true,
          {
            expectedVersion: input.expectedVersion,
            currentVersion: current.version,
          }
        );
      }

      const updated = await prisma.file.findUnique({
        where: { id: fileId },
      });

      return updated!;
    });
  }

  /**
   * Create a new file inside a workspace.
   */
  public static async createFile(
    workspaceId: string,
    userId: string,
    input: CreateFileInput
  ): Promise<FileItemResponse> {
    await this.verifyWorkspacePermission(workspaceId, userId, true);

    const parentId = input.parentId ?? null;

    if (parentId !== null) {
      const parent = await prisma.file.findUnique({
        where: { id: parentId },
      });

      if (!parent || parent.workspaceId !== workspaceId) {
        throw new AppError("Parent folder not found in this workspace", 400, "INVALID_PARENT");
      }

      if (parent.type !== "FOLDER") {
        throw new AppError("Parent item must be a folder", 400, "PARENT_NOT_FOLDER");
      }
    }

    // Check sibling duplicate name
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM files
      WHERE workspace_id = ${workspaceId}
        AND (
          (${parentId}::text IS NULL AND parent_id IS NULL)
          OR (parent_id = ${parentId})
        )
        AND lower(name) = lower(${input.name})
      LIMIT 1
    `;

    if (existing.length > 0) {
      throw new AppError(
        `An item named '${input.name}' already exists in this folder`,
        409,
        "DUPLICATE_NAME"
      );
    }

    try {
      const file = await prisma.file.create({
        data: {
          name: input.name,
          type: "FILE",
          workspaceId,
          parentId,
          content: "",
        },
      });

      return file;
    } catch (error: any) {
      if (error?.code === "P2002") {
        throw new AppError(
          `An item named '${input.name}' already exists in this folder`,
          409,
          "DUPLICATE_NAME"
        );
      }
      if (error?.code === "P2003") {
        throw new AppError("Parent folder not found or has been deleted", 400, "INVALID_PARENT");
      }
      throw error;
    }
  }

  /**
   * Create a new folder inside a workspace.
   */
  public static async createFolder(
    workspaceId: string,
    userId: string,
    input: CreateFolderInput
  ): Promise<FileItemResponse> {
    await this.verifyWorkspacePermission(workspaceId, userId, true);

    const parentId = input.parentId ?? null;

    if (parentId !== null) {
      const parent = await prisma.file.findUnique({
        where: { id: parentId },
      });

      if (!parent || parent.workspaceId !== workspaceId) {
        throw new AppError("Parent folder not found in this workspace", 400, "INVALID_PARENT");
      }

      if (parent.type !== "FOLDER") {
        throw new AppError("Parent item must be a folder", 400, "PARENT_NOT_FOLDER");
      }
    }

    // Check sibling duplicate name
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM files
      WHERE workspace_id = ${workspaceId}
        AND (
          (${parentId}::text IS NULL AND parent_id IS NULL)
          OR (parent_id = ${parentId})
        )
        AND lower(name) = lower(${input.name})
      LIMIT 1
    `;

    if (existing.length > 0) {
      throw new AppError(
        `An item named '${input.name}' already exists in this folder`,
        409,
        "DUPLICATE_NAME"
      );
    }

    try {
      const folder = await prisma.file.create({
        data: {
          name: input.name,
          type: "FOLDER",
          workspaceId,
          parentId,
        },
      });

      return folder;
    } catch (error: any) {
      if (error?.code === "P2002") {
        throw new AppError(
          `An item named '${input.name}' already exists in this folder`,
          409,
          "DUPLICATE_NAME"
        );
      }
      if (error?.code === "P2003") {
        throw new AppError("Parent folder not found or has been deleted", 400, "INVALID_PARENT");
      }
      throw error;
    }
  }

  /**
   * Rename a file or folder. Preserves original ID, parentId, workspaceId, and content.
   */
  public static async renameItem(
    fileId: string,
    userId: string,
    input: RenameFileInput
  ): Promise<FileItemResponse> {
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new AppError("File or folder not found", 404, "FILE_NOT_FOUND");
    }

    await this.verifyWorkspacePermission(file.workspaceId, userId, true);

    if (file.name === input.name) {
      return file;
    }

    // Check sibling uniqueness in the same folder
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM files
      WHERE workspace_id = ${file.workspaceId}
        AND (
          (${file.parentId}::text IS NULL AND parent_id IS NULL)
          OR (parent_id = ${file.parentId})
        )
        AND lower(name) = lower(${input.name})
        AND id != ${fileId}
      LIMIT 1
    `;

    if (existing.length > 0) {
      throw new AppError(
        `An item named '${input.name}' already exists in this folder`,
        409,
        "DUPLICATE_NAME"
      );
    }

    try {
      const updated = await prisma.file.update({
        where: { id: fileId },
        data: {
          name: input.name,
          updatedAt: new Date(),
        },
      });

      return updated;
    } catch (error: any) {
      if (error?.code === "P2002") {
        throw new AppError(
          `An item named '${input.name}' already exists in this folder`,
          409,
          "DUPLICATE_NAME"
        );
      }
      throw error;
    }
  }

  /**
   * Delete a file or recursively delete a folder and all descendants.
   */
  public static async deleteItem(fileId: string, userId: string): Promise<void> {
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new AppError("File or folder not found", 404, "FILE_NOT_FOUND");
    }

    await this.verifyWorkspacePermission(file.workspaceId, userId, true);

    // PostgreSQL composite foreign key ON DELETE CASCADE automatically removes
    // all descendants cleanly and atomically.
    try {
      await prisma.file.delete({
        where: { id: fileId },
      });
    } catch (error: any) {
      if (error?.code === "P2025") {
        throw new AppError("File or folder not found", 404, "FILE_NOT_FOUND");
      }
      throw error;
    }
  }

  /**
   * Move a file or folder into a destination folder or to the workspace root.
   * Prevents circular nesting, cross-workspace movement, and duplicate sibling names.
   * Uses an advisory transaction lock to serialize tree hierarchy mutations per workspace,
   * completely preventing race conditions such as mutual inversion cycles.
   */
  public static async moveItem(
    fileId: string,
    userId: string,
    input: MoveFileInput
  ): Promise<FileItemResponse> {
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new AppError("File or folder not found", 404, "FILE_NOT_FOUND");
    }

    await this.verifyWorkspacePermission(file.workspaceId, userId, true);

    const targetParentId = input.targetParentId ?? null;

    // Moving to same location is a no-op
    if (file.parentId === targetParentId) {
      return file;
    }

    return await prisma.$transaction(async (tx) => {
      // Serialize tree restructuring within the same workspace to prevent
      // mutual concurrent moves (e.g. A into B and B into A) from creating circular hierarchies.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('workspace_tree'), hashtext(${file.workspaceId}::text))`;

      const currentFile = await tx.file.findUnique({
        where: { id: fileId },
      });

      if (!currentFile) {
        throw new AppError("File or folder not found", 404, "FILE_NOT_FOUND");
      }

      if (currentFile.parentId === targetParentId) {
        return currentFile;
      }

      if (targetParentId !== null) {
        // Cannot move item into itself
        if (targetParentId === fileId) {
          throw new AppError("Cannot move an item into itself", 400, "CANNOT_MOVE_INTO_SELF");
        }

        const targetParent = await tx.file.findUnique({
          where: { id: targetParentId },
        });

        if (!targetParent || targetParent.workspaceId !== currentFile.workspaceId) {
          throw new AppError(
            "Destination folder not found in this workspace",
            400,
            "INVALID_DESTINATION"
          );
        }

        if (targetParent.type !== "FOLDER") {
          throw new AppError("Destination must be a folder", 400, "DESTINATION_NOT_FOLDER");
        }

        // Circular nesting prevention: ensure targetParent is not a descendant of file
        if (currentFile.type === "FOLDER") {
          let currentAncestorId: string | null = targetParentId;
          const visited = new Set<string>();

          while (currentAncestorId !== null) {
            if (currentAncestorId === fileId) {
              throw new AppError(
                "Cannot move a folder into itself or one of its descendants",
                400,
                "CIRCULAR_NESTING_DETECTED"
              );
            }

            if (visited.has(currentAncestorId)) {
              break;
            }
            visited.add(currentAncestorId);

            const ancestorRecord: { parentId: string | null } | null = await tx.file.findUnique({
              where: { id: currentAncestorId },
              select: { parentId: true },
            });

            currentAncestorId = ancestorRecord?.parentId ?? null;
          }
        }
      }

      // Check sibling duplicate name at destination
      const existing = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM files
        WHERE workspace_id = ${currentFile.workspaceId}
          AND (
            (${targetParentId}::text IS NULL AND parent_id IS NULL)
            OR (parent_id = ${targetParentId})
          )
          AND lower(name) = lower(${currentFile.name})
          AND id != ${fileId}
        LIMIT 1
      `;

      if (existing.length > 0) {
        throw new AppError(
          `An item named '${currentFile.name}' already exists in the destination folder`,
          409,
          "DUPLICATE_NAME"
        );
      }

      try {
        const moved = await tx.file.update({
          where: { id: fileId },
          data: {
            parentId: targetParentId,
            updatedAt: new Date(),
          },
        });

        return moved;
      } catch (error: any) {
        if (error?.code === "P2002") {
          throw new AppError(
            `An item named '${currentFile.name}' already exists in the destination folder`,
            409,
            "DUPLICATE_NAME"
          );
        }
        if (error?.code === "P2003") {
          throw new AppError(
            "Destination folder not found in this workspace",
            400,
            "INVALID_DESTINATION"
          );
        }
        throw error;
      }
    });
  }
}
