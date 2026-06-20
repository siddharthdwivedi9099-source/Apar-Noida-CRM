import { Router, type Request } from "express";
import { z } from "zod";
import { auditLogCategoryKeys, type AuditLogListQuery, type UpdateDataGovernanceSettingsRequestBody } from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { createRateLimiter } from "../../common/middleware/rate-limit.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { AuditService } from "./audit.service.js";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const recordSchema = z.record(z.unknown());
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Dates must start with YYYY-MM-DD.");

const logListQuerySchema = z.object({
  eventType: z.string().max(60).optional(),
  action: z.string().max(160).optional(),
  actorUserId: z.string().uuid().optional(),
  resourceType: z.string().max(80).optional(),
  status: z.enum(["success", "failure", "denied", "error"]).optional(),
  category: z.enum(auditLogCategoryKeys).optional(),
  search: z.string().max(160).optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional()
});

const summaryQuerySchema = z.object({ windowDays: z.coerce.number().int().positive().max(365).optional() });

const governanceUpdateSchema = z.object({
  auditLogRetentionDays: z.coerce.number().int().positive().max(36500).optional(),
  aiLogRetentionDays: z.coerce.number().int().positive().max(36500).optional(),
  exportLogRetentionDays: z.coerce.number().int().positive().max(36500).optional(),
  piiRedactionEnabled: z.boolean().optional(),
  failedAccessLoggingEnabled: z.boolean().optional(),
  fileUploadMaxMb: z.coerce.number().int().positive().max(1024).optional(),
  allowedFileTypes: z.array(z.string().min(1).max(20)).max(50).optional(),
  metadata: recordSchema.optional()
});

const readPermissions: string[] = ["admin.view", "admin.view_dashboard", "admin.configure", "admin.manage_workflow"];
const exportPermissions: string[] = ["admin.export", "admin.configure"];
const configurePermissions: string[] = ["admin.configure"];

function getClientIp(request: Request) {
  const forwardedFor = request.header("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }
  return request.ip ?? null;
}

function getAuditMetadata(request: Request) {
  return { requestId: request.requestId, ipAddress: getClientIp(request), userAgent: request.header("user-agent") ?? null };
}

export function createAuditRouter({ databaseService }: RouterDependencies) {
  const router = Router();
  const authService = new AuthService(databaseService, {
    enabled: env.DATABASE_ENABLED,
    accessTokenSecret: env.JWT_ACCESS_TOKEN_SECRET,
    refreshTokenSecret: env.JWT_REFRESH_TOKEN_SECRET,
    accessTokenTtlMinutes: env.JWT_ACCESS_TOKEN_TTL_MINUTES,
    refreshTokenTtlDays: env.JWT_REFRESH_TOKEN_TTL_DAYS,
    accountLockThreshold: env.AUTH_ACCOUNT_LOCK_THRESHOLD,
    accountLockMinutes: env.AUTH_ACCOUNT_LOCK_MINUTES,
    enableAuditLogs: env.ENABLE_AUDIT_LOGS
  });
  const authMiddleware = createAuthMiddleware(authService);
  const service = new AuditService(databaseService, {
    enableAuditLogs: env.ENABLE_AUDIT_LOGS,
    retentionDefaults: {
      auditLogRetentionDays: env.AUDIT_LOG_RETENTION_DAYS,
      aiLogRetentionDays: env.AI_LOG_RETENTION_DAYS,
      exportLogRetentionDays: env.EXPORT_LOG_RETENTION_DAYS,
      fileUploadMaxMb: env.FILE_UPLOAD_MAX_MB
    }
  });

  router.use(authMiddleware);

  // A strict, deterministic rate-limit probe (any authenticated user). Demonstrates
  // the rate-limiting control without affecting the generous global API limit.
  const probeLimiter = createRateLimiter({ windowMs: env.API_RATE_LIMIT_WINDOW_MS, max: env.SECURITY_PROBE_RATE_LIMIT_MAX, keyPrefix: "audit-probe" });
  router.get("/security/rate-limit-check", probeLimiter, asyncHandler(async (_request, response) => {
    response.status(200).json({ ok: true, limit: env.SECURITY_PROBE_RATE_LIMIT_MAX });
  }));

  router.get("/security-review", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (_request, response) => {
    response.status(200).json(service.securityReview());
  }));

  router.get("/summary", requirePermissions({ oneOf: readPermissions }), validateRequest({ query: summaryQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getSummary(request.auth!, (request.query as { windowDays?: number }).windowDays));
  }));

  router.get("/export", requirePermissions({ oneOf: exportPermissions }), validateRequest({ query: logListQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.exportLogs(request.auth!, getAuditMetadata(request), request.query as AuditLogListQuery));
  }));

  router.get("/governance", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getGovernance(request.auth!));
  }));

  router.patch("/governance", requirePermissions({ oneOf: configurePermissions }), validateRequest({ body: governanceUpdateSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.updateGovernance(request.auth!, getAuditMetadata(request), request.body as UpdateDataGovernanceSettingsRequestBody));
  }));

  router.get("/logs", requirePermissions({ oneOf: readPermissions }), validateRequest({ query: logListQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listLogs(request.auth!, request.query as AuditLogListQuery));
  }));

  return router;
}
