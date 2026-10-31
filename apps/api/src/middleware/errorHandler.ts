import type { Request, Response, NextFunction } from "express";
import type { ApiErrorResponse } from "@codesync/shared";
import { ZodError } from "zod";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  const timestamp = new Date().toISOString();

  if (err instanceof ZodError) {
    const errorResponse: ApiErrorResponse = {
      status: "error",
      message: "Validation Error",
      statusCode: 400,
      timestamp,
      errors: err.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    };
    res.status(400).json(errorResponse);
    return;
  }

  if (err instanceof AppError) {
    const errorResponse: ApiErrorResponse = {
      status: "error",
      message: err.message,
      statusCode: err.statusCode,
      timestamp,
    };
    res.status(err.statusCode).json(errorResponse);
    return;
  }

  console.error("Unhandled error:", err);

  const errorResponse: ApiErrorResponse = {
    status: "error",
    message: process.env.NODE_ENV === "production" ? "Internal Server Error" : err.message,
    statusCode: 500,
    timestamp,
  };

  res.status(500).json(errorResponse);
}
