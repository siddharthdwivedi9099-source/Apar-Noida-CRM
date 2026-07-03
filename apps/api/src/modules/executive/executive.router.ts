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
import { ExecutiveService } from "./executive.service.js";
import { riskSources, strategicRiskSeverities, riskStatuses, type AssignInsightActionRequestBody, type CommandCenterFilters, type CreateStrategicRiskRequestBody, type UpdateStrategicRiskRequestBody } from "@crm/types";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
// Executive analytics are read/govern surfaces available to the executive-leadership role.
const execPermissions: string[] = ["dashboards.view_dashboard", "dashboards.view", "admin.view", "opportunities.view_dashboard", "admin.configure"];

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const filterQuery = z.object({
  from: z.string().max(40).optional(),
  to: z.string().max(40).optional(),
  region: z.string().max(120).optional(),
  product: z.string().max(120).optional(),
  team: uuidSchema.optional(),
  segment: z.string().max(120).optional()
});
const assignActionSchema = z.object({ insightKey: z.string().max(120), title: z.string().min(1).max(300), description: nullableText(4000), assignedTo: uuidSchema });
const createRiskSchema = z.object({
  title: z.string().min(1).max(300),
  source: z.enum(riskSources).optional(),
  sourceEntityType: nullableText(120),
  sourceEntityId: uuidSchema.nullable().optional(),
  ownerId: uuidSchema,
  severity: z.enum(strategicRiskSeverities).optional(),
  impact: nullableText(8000),
  mitigation: nullableText(8000),
  dueDate: dateOnly.nullable().optional()
});
const updateRiskSchema = z.object({
  ownerId: uuidSchema.nullable().optional(),
  severity: z.enum(strategicRiskSeverities).optional(),
  impact: nullableText(8000),
  mitigation: nullableText(8000),
  dueDate: dateOnly.nullable().optional(),
  status: z.enum(riskStatuses).optional()
});
const riskIdSchema = z.object({ riskId: uuidSchema });

function toFilters(query: z.infer<typeof filterQuery>): CommandCenterFilters {
  return { from: query.from ?? null, to: query.to ?? null, region: query.region ?? null, product: query.product ?? null, team: query.team ?? null, segment: query.segment ?? null };
}

export function createExecutiveRouter({ databaseService }: RouterDependencies) {
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
  const service = new ExecutiveService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS });

  router.use(createAuthMiddleware(authService));

  // EXE-001
  router.get("/command-center", requirePermissions({ oneOf: execPermissions }), validateRequest({ query: filterQuery }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getCommandCenter(request.auth!, toFilters(request.query as z.infer<typeof filterQuery>)));
  }));
  // EXE-002
  router.get("/insights", requirePermissions({ oneOf: execPermissions }), validateRequest({ query: filterQuery }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getInsights(request.auth!, toFilters(request.query as z.infer<typeof filterQuery>)));
  }));
  router.post("/insights/assign", requirePermissions({ oneOf: execPermissions }), validateRequest({ body: assignActionSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.assignInsightAction(request.auth!, getAuditMetadata(request), request.body as AssignInsightActionRequestBody));
  }));
  // EXE-003
  router.get("/risks", requirePermissions({ oneOf: execPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listRisks(request.auth!));
  }));
  router.post("/risks", requirePermissions({ oneOf: execPermissions }), validateRequest({ body: createRiskSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createRisk(request.auth!, getAuditMetadata(request), request.body as CreateStrategicRiskRequestBody));
  }));
  router.patch("/risks/:riskId", requirePermissions({ oneOf: execPermissions }), validateRequest({ params: riskIdSchema, body: updateRiskSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.updateRisk(request.auth!, getAuditMetadata(request), request.params.riskId, request.body as UpdateStrategicRiskRequestBody));
  }));

  return router;
}
