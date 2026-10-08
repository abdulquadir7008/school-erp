import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { AppError, ValidationError } from "../utils/errors";
import { config } from "../config";
import { ApiResponse } from "../types";

export const validate = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        next(new ValidationError("Validation failed", errors));
      } else {
        next(error);
      }
    }
  };
};

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    const response: ApiResponse = {
      success: false,
      message: err.message,
      code: err.code,
      errors: "errors" in err ? (err as ValidationError).errors : undefined,
    };
    res.status(err.statusCode).json(response);
    return;
  }

  console.error("Unhandled error:", err);

  const response: ApiResponse = {
    success: false,
    message:
      config.nodeEnv === "production"
        ? "Internal server error"
        : err.message,
    code: "INTERNAL_ERROR",
  };

  res.status(500).json(response);
};

export const notFoundHandler = (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    code: "NOT_FOUND",
  };
  res.status(404).json(response);
};
