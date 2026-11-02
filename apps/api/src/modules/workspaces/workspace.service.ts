import { prisma, type Prisma } from "../../config/database";
import { AppError } from "../../utils/AppError";
import type {
  CreateWorkspaceInput,
  RenameWorkspaceInput,
  WorkspaceResponse,
} from "./workspace.types";

export class WorkspaceService {
  /**
   * Create a new workspace.
   * Transactionally creates the workspace, assigns the creator as OWNER,
   * and creates a WORKSPACE_CREATED activity log record.
   */
  public static async createWorkspace(
    userId: string,
    input: CreateWorkspaceInput
  ): Promise<WorkspaceResponse> {
    return prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          ownerId: userId,
        },
        include: {
          owner: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: "OWNER",
        },
      });

      await tx.activityLog.create({
        data: {
          workspaceId: workspace.id,
          userId,
          action: "WORKSPACE_CREATED",
          metadata: { name: workspace.name },
        },
      });

      return {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        ownerId: workspace.ownerId,
        lastAccessedAt: workspace.lastAccessedAt,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
        role: "OWNER",
        memberCount: 1,
        owner: workspace.owner,
      };
    });
  }

  /**
   * List all workspaces where the user is an active member.
   * Supports optional case-insensitive search filtering on workspace name.
   */
  public static async getUserWorkspaces(
    userId: string,
    search?: string
  ): Promise<WorkspaceResponse[]> {
    const whereClause: Prisma.WorkspaceWhereInput = {
      members: {
        some: {
          userId,
        },
      },
    };

    if (search && search.trim().length > 0) {
      whereClause.name = {
        contains: search.trim(),
        mode: "insensitive",
      };
    }

    const workspaces = await prisma.workspace.findMany({
      where: whereClause,
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        members: {
          where: { userId },
          select: { role: true },
        },
        _count: {
          select: { members: true },
        },
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return workspaces.map((ws) => ({
      id: ws.id,
      name: ws.name,
      description: ws.description,
      ownerId: ws.ownerId,
      lastAccessedAt: ws.lastAccessedAt,
      createdAt: ws.createdAt,
      updatedAt: ws.updatedAt,
      role: ws.members[0]?.role ?? "VIEWER",
      memberCount: ws._count.members,
      owner: ws.owner,
    }));
  }

  /**
   * Retrieve workspace details by ID.
   * Enforces that the requesting user must be a member of the workspace.
   * Automatically updates lastAccessedAt to the current timestamp.
   */
  public static async getWorkspaceDetails(
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceResponse> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          where: { userId },
          select: { role: true },
        },
        _count: {
          select: { members: true },
        },
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404, "WORKSPACE_NOT_FOUND");
    }

    const userMember = workspace.members[0];
    if (!userMember) {
      throw new AppError(
        "You do not have access to this workspace",
        403,
        "WORKSPACE_ACCESS_DENIED"
      );
    }

    const now = new Date();
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { lastAccessedAt: now },
    });

    return {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      ownerId: workspace.ownerId,
      lastAccessedAt: now,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      role: userMember.role,
      memberCount: workspace._count.members,
      owner: workspace.owner,
    };
  }

  /**
   * Rename/update a workspace.
   * Enforces OWNER role. Transactionally updates workspace and logs WORKSPACE_UPDATED.
   */
  public static async renameWorkspace(
    workspaceId: string,
    userId: string,
    input: RenameWorkspaceInput
  ): Promise<WorkspaceResponse> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          where: { userId },
          select: { role: true },
        },
      },
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404, "WORKSPACE_NOT_FOUND");
    }

    const userMember = workspace.members[0];
    if (!userMember) {
      throw new AppError(
        "You do not have access to this workspace",
        403,
        "WORKSPACE_ACCESS_DENIED"
      );
    }

    if (userMember.role !== "OWNER") {
      throw new AppError(
        "Only the workspace owner can rename this workspace",
        403,
        "OWNER_PERMISSION_REQUIRED"
      );
    }

    const oldName = workspace.name;

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.workspace.update({
        where: { id: workspaceId },
        data: {
          name: input.name,
          ...(input.description !== undefined ? { description: input.description } : {}),
        },
        include: {
          _count: {
            select: { members: true },
          },
          owner: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await tx.activityLog.create({
        data: {
          workspaceId,
          userId,
          action: "WORKSPACE_UPDATED",
          metadata: {
            oldName,
            newName: input.name,
          },
        },
      });

      return res;
    });

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      ownerId: updated.ownerId,
      lastAccessedAt: updated.lastAccessedAt,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      role: "OWNER",
      memberCount: updated._count.members,
      owner: updated.owner,
    };
  }

  /**
   * Delete a workspace.
   * Enforces OWNER role. Relies on Prisma cascading delete for related records.
   */
  public static async deleteWorkspace(workspaceId: string, userId: string): Promise<void> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          where: { userId },
          select: { role: true },
        },
      },
    });

    if (!workspace) {
      throw new AppError("Workspace not found", 404, "WORKSPACE_NOT_FOUND");
    }

    const userMember = workspace.members[0];
    if (!userMember) {
      throw new AppError(
        "You do not have access to this workspace",
        403,
        "WORKSPACE_ACCESS_DENIED"
      );
    }

    if (userMember.role !== "OWNER") {
      throw new AppError(
        "Only the workspace owner can delete this workspace",
        403,
        "OWNER_PERMISSION_REQUIRED"
      );
    }

    await prisma.workspace.delete({
      where: { id: workspaceId },
    });
  }
}

