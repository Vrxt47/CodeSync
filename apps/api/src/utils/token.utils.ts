import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "./AppError";

export interface AccessTokenPayload {
  sub: string;
  userId: string;
  email: string;
  name: string;
}

/**
 * Generate a short-lived JWT access token (15m default).
 */
export function generateAccessToken(payload: {
  userId: string;
  email: string;
  name: string;
}): string {
  const tokenPayload: AccessTokenPayload = {
    sub: payload.userId,
    userId: payload.userId,
    email: payload.email,
    name: payload.name,
  };

  const options: SignOptions = {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  };

  return jwt.sign(tokenPayload, env.JWT_ACCESS_SECRET, options);
}

/**
 * Verify a JWT access token.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    if (!decoded || !decoded.userId) {
      throw new AppError("Invalid access token payload", 401, "INVALID_ACCESS_TOKEN");
    }
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError("Access token expired", 401, "ACCESS_TOKEN_EXPIRED");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError("Invalid access token", 401, "INVALID_ACCESS_TOKEN");
    }
    throw error;
  }
}

/**
 * Generate a cryptographically secure random refresh token.
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString("hex");
}

/**
 * Hash a refresh token using SHA-256 for secure database storage.
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Calculate refresh token expiration date based on environment configuration (7 days default).
 */
export function getRefreshTokenExpiresAt(): Date {
  const daysInMs = env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + daysInMs);
}
