import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/app-error.js";
import { logger } from "../../platform/logger/logger.js";
import type { DatabaseService } from "../../platform/database/database.service.js";
import { env } from "../../config/env.js";

// Failed-access logging (Phase 27): permission denials for authenticated
// requests are written to the audit log as security events. Best-effort and
// fire-and-forget so it never blocks or fails the response.
function recordFailedAccess(databaseService: DatabaseService | undefined, request: Request, error: AppError) {
  if (!databaseService || !databaseService.isEnabled() || !env.ENABLE_AUDIT_LOGS) {
    return;
  }
  const auth = request.auth;
  if (!auth) {
    return;
  }
  const status = error.statusCode === 401 ? "failure" : "denied";
  void databaseService
    .query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, session_id, event_type, action, resource_type, resource_id, status, ip_address, user_agent, request_id, metadata)
       VALUES ($1, $2, $3, 'security', 'security.access_denied', 'api', NULL, $4, NULLIF($5, '')::inet, $6, $7, $8::jsonb)`,
      [
        auth.tenantId,
        auth.userId,
        auth.sessionId,
        status,
        request.ip ?? "",
        request.header("user-agent") ?? null,
        request.requestId ?? null,
        JSON.stringify({ method: request.method, path: request.originalUrl, code: error.code })
      ]
    )
    .catch((logError) => logger.warn({ err: logError }, "Failed to record access-denied audit event"));
}

export function createErrorHandler(databaseService?: DatabaseService) {
  return function errorHandler(error: unknown, request: Request, response: Response, _next: NextFunction) {
    if (error instanceof ZodError) {
      logger.warn({ issues: error.issues }, "Request validation failed");
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

      if (error.statusCode === 401 || error.statusCode === 403) {
        recordFailedAccess(databaseService, request, error);
      }

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
  };
}

// Backwards-compatible default handler (no database-backed failed-access logging).
export const errorHandler = createErrorHandler();
