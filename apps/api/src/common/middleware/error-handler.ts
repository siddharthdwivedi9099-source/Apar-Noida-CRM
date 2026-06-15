import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/app-error.js";
import { logger } from "../../platform/logger/logger.js";

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction
) {
  if (error instanceof ZodError) {
    logger.error({ issues: error.issues }, "Request validation failed");
    return response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "The request payload did not pass validation.",
        details: error.flatten()
      }
    });
  }

  if (error instanceof AppError) {
    const logMethod = error.statusCode >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);
    logMethod({ code: error.code, details: error.details }, error.message);
    return response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details ?? null
      }
    });
  }

  logger.error({ error }, "Unexpected API error");
  return response.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred."
    }
  });
}
