import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { AppError, ConcurrentRefreshError } from "../../utils/AppError";
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  getRefreshTokenExpiresAt,
} from "../../utils/token.utils";
import type { RegisterInput, LoginInput, AuthResult, PublicUser } from "./auth.types";

export { ConcurrentRefreshError };

export interface RefreshSessionOptions {
  simulateSuccessorFailure?: boolean;
  gracePeriodMs?: number;
}

export class AuthService {
  /**
   * Register a new user and create an initial authenticated session.
   */
  public static async register(input: RegisterInput): Promise<AuthResult> {
    const normalizedEmail = input.email.toLowerCase().trim();

    // Check duplicate email
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new AppError("A user with this email address already exists", 409, "DUPLICATE_EMAIL");
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(input.password, salt);

    // Create user in database
    const user = await prisma.user.create({
      data: {
        name: input.name.trim(),
        email: normalizedEmail,
        passwordHash,
      },
    });

    // Create authenticated session & tokens with new family ID
    return await AuthService.createSessionForUser(user);
  }

  /**
   * Authenticate a user with email and password.
   */
  public static async login(input: LoginInput): Promise<AuthResult> {
    const normalizedEmail = input.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    return await AuthService.createSessionForUser(user);
  }

  /**
   * Refresh session using atomic refresh token rotation and session family tracking.
   *
   * Security & Concurrency Guarantees:
   * 1. Atomic Claim: Uses conditional PostgreSQL update (revokedAt: null, expiresAt > now).
   * 2. Transactional Scope: Claiming the old session and creating the successor occur in the
   *    same database transaction, rolling back on any failure.
   * 3. Concurrency Grace Window: A losing concurrent request arriving within the grace period
   *    is rejected with ConcurrentRefreshError (409 CONCURRENT_REFRESH) without revoking the winner.
   * 4. Genuine Reuse Detection: Replaying a revoked token outside the grace period invalidates
   *    the entire compromised session family (TOKEN_REVOKED) while leaving independent session
   *    families on other devices intact.
   */
  public static async refreshSession(
    rawRefreshToken: string,
    options?: RefreshSessionOptions
  ): Promise<AuthResult> {
    if (!rawRefreshToken || typeof rawRefreshToken !== "string") {
      throw new AppError("Refresh token is required", 401, "REFRESH_TOKEN_REQUIRED");
    }

    const tokenHash = hashRefreshToken(rawRefreshToken);
    const gracePeriodMs = options?.gracePeriodMs ?? env.REFRESH_TOKEN_GRACE_WINDOW_MS;

    // 1. Find the incoming refresh-token session
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      throw new AppError("Invalid refresh token", 401, "INVALID_REFRESH_TOKEN");
    }

    const now = new Date();

    // 2. Validate revocation and handle grace period vs genuine reuse
    if (session.revokedAt) {
      // If the session was explicitly logged out or already invalidated by reuse detection, reject immediately with 401
      if (session.revocationReason === "LOGGED_OUT") {
        throw new AppError(
          "Session has been terminated. Please log in again.",
          401,
          "TOKEN_REVOKED"
        );
      }

      if (session.revocationReason === "REUSE_DETECTED") {
        throw new AppError(
          "Revoked refresh token presented. Session family has been invalidated.",
          401,
          "TOKEN_REVOKED"
        );
      }

      const elapsedMs = now.getTime() - session.revokedAt.getTime();

      // Only normally rotated tokens are eligible for the concurrency grace window
      if (session.revocationReason === "ROTATED" && elapsedMs <= gracePeriodMs) {
        // In-flight concurrent request within grace window:
        // Reject safely without revoking the winning successor or family.
        throw new ConcurrentRefreshError(
          "Concurrent refresh request detected. Token has already been rotated."
        );
      }

      // Genuine token reuse replay attack outside grace window:
      // Invalidate all active sessions in this specific compromised session family.
      await prisma.session.updateMany({
        where: {
          familyId: session.familyId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          revocationReason: "REUSE_DETECTED",
        },
      });

      throw new AppError(
        "Revoked refresh token presented. Session family has been invalidated.",
        401,
        "TOKEN_REVOKED"
      );
    }

    // 3. Check expiration
    if (session.expiresAt.getTime() <= now.getTime()) {
      throw new AppError("Refresh token has expired", 401, "REFRESH_TOKEN_EXPIRED");
    }

    // 4. Atomic rotation in transaction
    return await prisma.$transaction(async (tx) => {
      // Atomically claim the existing session using conditional update
      const claimResult = await tx.session.updateMany({
        where: {
          id: session.id,
          tokenHash,
          revokedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          revokedAt: now,
          revocationReason: "ROTATED",
        },
      });

      if (claimResult.count !== 1) {
        // Another concurrent request claimed it first in a parallel transaction
        throw new ConcurrentRefreshError(
          "Concurrent refresh request detected. Token has already been rotated."
        );
      }

      // 5. Test hook: simulate successor creation failure for rollback verification
      if (options?.simulateSuccessorFailure) {
        throw new Error("Simulated successor session creation failure");
      }

      // 6. Generate successor tokens and create session within the same family
      const accessToken = generateAccessToken({
        userId: session.user.id,
        email: session.user.email,
        name: session.user.name,
      });

      const newRefreshToken = generateRefreshToken();
      const newTokenHash = hashRefreshToken(newRefreshToken);
      const expiresAt = getRefreshTokenExpiresAt();

      await tx.session.create({
        data: {
          userId: session.userId,
          tokenHash: newTokenHash,
          familyId: session.familyId, // Preserves the session family lineage
          expiresAt,
        },
      });

      return {
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          avatar: session.user.avatar,
          createdAt: session.user.createdAt,
        },
        accessToken,
        refreshToken: newRefreshToken,
      };
    });
  }

  /**
   * Invalidate the current session during logout.
   */
  public static async logout(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }

    const tokenHash = hashRefreshToken(rawRefreshToken);
    await prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: {
        revokedAt: new Date(),
        revocationReason: "LOGGED_OUT",
      },
    });
  }

  /**
   * Retrieve the authenticated user's public profile.
   */
  public static async getCurrentUser(userId: string): Promise<PublicUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    return user;
  }

  /**
   * Helper to create a new root session and generate access + refresh token pair.
   */
  private static async createSessionForUser(
    user: {
      id: string;
      name: string;
      email: string;
      avatar?: string | null;
      createdAt: Date;
    },
    familyId?: string
  ): Promise<AuthResult> {
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const refreshToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(refreshToken);
    const expiresAt = getRefreshTokenExpiresAt();

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        familyId: familyId ?? crypto.randomUUID(),
        expiresAt,
      },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
    };
  }
}
