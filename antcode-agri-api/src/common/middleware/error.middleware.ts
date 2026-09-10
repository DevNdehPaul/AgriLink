import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/app-error.js";
import { env } from "../../config/env.js";

/**
 * Handles requests that did not match any registered API route.
 * It forwards a controlled 404 error to the global error handler.
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(`Route ${req.method} ${req.originalUrl} was not found`, 404));
}

/**
 * Final Express error middleware. It converts application errors into a
 * consistent JSON response and prevents internal error details leaking out.
 */
export const globalErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  // Request validation errors produced by Zod.
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  // Errors intentionally thrown by our application code.
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
    return;
  }

  // Express/body-parser raises this before route validation when the request
  // exceeds the configured JSON or URL-encoded body limit. Preserve the
  // correct HTTP semantics without exposing parser internals to the client.
  if (
    error != null &&
    typeof error === "object" &&
    (
      ("status" in error && error.status === 413) ||
      ("statusCode" in error && error.statusCode === 413) ||
      ("type" in error && error.type === "entity.too.large")
    )
  ) {
    res.status(413).json({
      success: false,
      message: "Request body is too large",
    });
    return;
  }

  // Unexpected errors are logged server-side but hidden from API consumers.
  if (env.NODE_ENV === "production") {
    console.error("Unexpected application error", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Non-Error value thrown",
    });
  } else {
    console.error("Unexpected application error:", error);
  }
  res.status(500).json({
    success: false,
    message: "An unexpected server error occurred.",
  });
};
