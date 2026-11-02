import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/token.utils";
import { AppError } from "../utils/AppError";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware to authenticate requests using a JWT Bearer access token.
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AppError("Authorization header is missing", 401, "AUTH_HEADER_MISSING");
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
    throw new AppError(
      "Authorization header format must be Bearer <token>",
      401,
      "INVALID_TOKEN_FORMAT"
    );
  }

  const token = parts[1];
  const payload = verifyAccessToken(token);

  req.user = {
    id: payload.userId,
    email: payload.email,
    name: payload.name,
  };

  next();
}
