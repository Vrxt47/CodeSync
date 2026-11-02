import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@codesync/database";
import { AppError } from "../utils/AppError";
import { env } from "../config/env";

export interface ApiErrorPayload {
  success: false;
  message: string;
  code?: string;
  errors?: Array<{ field?: string; message: string }>;
  stack?: string;
}

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // 1. Handled AppError
  if (err instanceof AppError) {
    const payload: ApiErrorPayload = {
      success: false,
      message: err.message,
      code: err.code || "APPLICATION_ERROR",
    };
    if (env.NODE_ENV !== "production" && err.stack) {
      payload.stack = err.stack;
    }
    res.status(err.statusCode).json(payload);
    return;
  }

  // 2. Zod Validation Error
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));

    const payload: ApiErrorPayload = {
      success: false,
      message: "Request validation failed",
      code: "VALIDATION_ERROR",
      errors: formattedErrors,
    };
    res.status(400).json(payload);
    return;
  }

  // 3. Prisma Known Request Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": {
        const target = Array.isArray(err.meta?.target) ? err.meta.target.join(", ") : "resource";
        res.status(409).json({
          success: false,
          message: `A duplicate record already exists with the same ${target}.`,
          code: "DUPLICATE_ENTITY",
        });
        return;
      }
      case "P2003": {
        res.status(409).json({
          success: false,
          message:
            "Foreign key constraint violation. The referenced resource does not exist or cannot be modified.",
          code: "FOREIGN_KEY_VIOLATION",
        });
        return;
      }
      case "P2025": {
        res.status(404).json({
          success: false,
          message: "The requested record was not found.",
          code: "RECORD_NOT_FOUND",
        });
        return;
      }
      default: {
        res.status(400).json({
          success: false,
          message: "Database request could not be processed.",
          code: `DB_REQUEST_ERROR_${err.code}`,
        });
        return;
      }
    }
  }

  // 4. Prisma Client Validation Error
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      message: "Invalid data provided for database operation.",
      code: "DB_VALIDATION_ERROR",
    });
    return;
  }

  // 5. Unexpected / Unhandled Error
  console.error("Unhandled Server Error:", err);

  const payload: ApiErrorPayload = {
    success: false,
    message:
      env.NODE_ENV === "production"
        ? "Internal server error"
        : (err as Error)?.message || "Unknown error occurred",
    code: "INTERNAL_SERVER_ERROR",
  };

  if (env.NODE_ENV !== "production" && (err as Error)?.stack) {
    payload.stack = (err as Error).stack;
  }

  res.status(500).json(payload);
}
