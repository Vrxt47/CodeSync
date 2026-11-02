import type { Request, Response, NextFunction } from "express";
import { type AnyZodObject, ZodError } from "zod";

export interface RequestValidationSchemas {
  body?: AnyZodObject;
  query?: AnyZodObject;
  params?: AnyZodObject;
}

/**
 * Express middleware to validate request body, params, and/or query using Zod schemas.
 */
export function validate(schemas: RequestValidationSchemas) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = (await schemas.query.parseAsync(req.query)) as Request["query"];
      }
      if (schemas.params) {
        req.params = (await schemas.params.parseAsync(req.params)) as Request["params"];
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: "Request validation failed",
          code: "VALIDATION_ERROR",
          errors: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
        return;
      }
      next(error);
    }
  };
}
