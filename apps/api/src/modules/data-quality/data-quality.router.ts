import { Router } from "express";
import { z } from "zod";
import { getAuditMetadata } from "../../common/http/request-metadata.js";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { DataQualityService } from "./data-quality.service.js";
import type { CommitImportRequestBody, MergeRecordsRequestBody, ResolveEnrichmentRequestBody, ValidateImportRequestBody } from "@crm/types";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
const readPermissions: string[] = ["leads.view", "admin.view", "admin.view_dashboard", "dashboards.view_dashboard", "admin.configure"];
const writePermissions: string[] = ["leads.edit", "leads.import", "admin.import", "admin.configure"];
const mergePermissions: string[] = ["leads.edit", "leads.delete", "admin.configure"];

const importRowSchema = z.record(z.unknown());
const validateImportSchema = z.object({ entityType: z.literal("lead").optional(), rows: z.array(importRowSchema).min(1).max(5000), requireConsent: z.boolean().optional() });
const commitImportSchema = z.object({ rows: z.array(importRowSchema).min(1).max(5000), requireConsent: z.boolean().optional() });
const entryIdSchema = z.object({ entryId: uuidSchema });
const resolveEnrichmentSchema = z.object({ decision: z.enum(["accept", "reject", "edit"]), values: z.record(z.string()).optional() });
const mergeSchema = z.object({
  entityType: z.literal("lead").optional(),
  masterId: uuidSchema,
  duplicateId: uuidSchema,
  fieldSelections: z.record(z.enum(["master", "duplicate"])).optional(),
  reason: z.string().min(1).max(2000)
});

export function createDataQualityRouter({ databaseService }: RouterDependencies) {
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
  const service = new DataQualityService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS });

  router.use(createAuthMiddleware(authService));

  // DQM-001
  router.get("/dashboard", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getDashboard(request.auth!));
  }));

  // DQM-002
  router.post("/import/validate", requirePermissions({ oneOf: readPermissions }), validateRequest({ body: validateImportSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.validateImport(request.auth!, request.body as ValidateImportRequestBody));
  }));
  router.post("/import/commit", requirePermissions({ oneOf: writePermissions }), validateRequest({ body: commitImportSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.commitImport(request.auth!, getAuditMetadata(request), request.body as CommitImportRequestBody));
  }));

  // DQM-003
  router.get("/enrichment", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listEnrichmentQueue(request.auth!));
  }));
  router.post("/enrichment/generate", requirePermissions({ oneOf: writePermissions }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.generateEnrichmentQueue(request.auth!, getAuditMetadata(request)));
  }));
  router.post("/enrichment/:entryId/resolve", requirePermissions({ oneOf: writePermissions }), validateRequest({ params: entryIdSchema, body: resolveEnrichmentSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.resolveEnrichment(request.auth!, getAuditMetadata(request), request.params.entryId, request.body as ResolveEnrichmentRequestBody));
  }));

  // DQM-004
  router.post("/merge", requirePermissions({ oneOf: mergePermissions }), validateRequest({ body: mergeSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.mergeRecords(request.auth!, getAuditMetadata(request), request.body as MergeRecordsRequestBody));
  }));

  return router;
}
