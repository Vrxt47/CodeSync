export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, code?: string, isOperational = true) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    // Restore prototype chain
    Object.setPrototypeOf(this, new.target.prototype);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ConcurrentRefreshError extends AppError {
  constructor(message = "Concurrent refresh request detected. Token has already been rotated.") {
    super(message, 409, "CONCURRENT_REFRESH");
    this.name = "ConcurrentRefreshError";
  }
}
