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
import { ExceptionsService } from "./exceptions.service.js";
import {
  leadRecycleActions,
  type AssessMarginRequestBody,
  type LinkDuplicateLeadRequestBody,
  type LogComplaintRequestBody,
  type RecycleLeadRequestBody,
  type RegressStageRequestBody,
  type ResolveConflictRequestBody
} from "@crm/types";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const readPermissions: string[] = ["leads.view", "opportunities.view", "accounts.view", "admin.view", "partners.view"];
const writePermissions: string[] = ["leads.edit", "leads.assign", "opportunities.edit", "support.edit", "partners.edit", "admin.configure"];
const approvePermissions: string[] = ["opportunities.approve", "admin.configure", "opportunities.edit"];

const leadIdParams = z.object({ leadId: uuidSchema });
const opportunityIdParams = z.object({ opportunityId: uuidSchema });
const accountIdParams = z.object({ accountId: uuidSchema });
const orgParams = z.object({ organization: z.string().min(1).max(200) });

const linkSchema = z.object({ existingLeadId: uuidSchema, campaign: nullableText(200), source: nullableText(160) });
const recycleSchema = z.object({ action: z.enum(leadRecycleActions), reason: z.string().min(1).max(2000), toOwnerId: uuidSchema.nullable().optional() });
const regressSchema = z.object({ toStageKey: z.string().min(1).max(160), reason: z.string().min(1).max(2000) });
const complaintSchema = z.object({ entityType: z.enum(["lead", "opportunity"]), entityId: uuidSchema, subject: z.string().min(1).max(300), description: nullableText(8000), severity: z.enum(["low", "medium", "high", "critical"]).optional() });
const marginSchema = z.object({ listPrice: z.coerce.number().min(0), cost: z.coerce.number().min(0), discountPct: z.coerce.number().min(0).max(100) });
const conflictSchema = z.object({ decision: z.enum(["direct", "partner"]), note: nullableText(2000) });

export function createExceptionsRouter({ databaseService }: RouterDependencies) {
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
  const service = new ExceptionsService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS });

  router.use(createAuthMiddleware(authService));

  // EXC-001
  router.get("/leads/:leadId/duplicates", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: leadIdParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.checkDuplicate(request.auth!, request.params.leadId));
  }));
  router.post("/leads/:leadId/link-duplicate", requirePermissions({ oneOf: writePermissions }), validateRequest({ params: leadIdParams, body: linkSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.linkDuplicate(request.auth!, getAuditMetadata(request), request.params.leadId, request.body as LinkDuplicateLeadRequestBody));
  }));

  // EXC-002
  router.post("/leads/:leadId/route-existing-customer", requirePermissions({ oneOf: writePermissions }), validateRequest({ params: leadIdParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.routeExistingCustomer(request.auth!, getAuditMetadata(request), request.params.leadId));
  }));
  router.post("/leads/:leadId/expansion-opportunity", requirePermissions({ oneOf: writePermissions }), validateRequest({ params: leadIdParams }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createExpansionFromLead(request.auth!, getAuditMetadata(request), request.params.leadId));
  }));

  // EXC-003
  router.get("/stakeholder-engagement", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getStakeholderEngagement(request.auth!));
  }));
  router.post("/stakeholder-engagement/:organization/alert", requirePermissions({ oneOf: writePermissions }), validateRequest({ params: orgParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.alertStakeholderOwner(request.auth!, getAuditMetadata(request), request.params.organization));
  }));

  // EXC-004
  router.post("/leads/:leadId/recycle", requirePermissions({ oneOf: writePermissions }), validateRequest({ params: leadIdParams, body: recycleSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.recycleLead(request.auth!, getAuditMetadata(request), request.params.leadId, request.body as RecycleLeadRequestBody));
  }));

  // EXC-005
  router.post("/opportunities/:opportunityId/regress-stage", requirePermissions({ oneOf: writePermissions }), validateRequest({ params: opportunityIdParams, body: regressSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.regressStage(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.body as RegressStageRequestBody));
  }));

  // EXC-007
  router.post("/complaints", requirePermissions({ oneOf: writePermissions }), validateRequest({ body: complaintSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.logComplaint(request.auth!, getAuditMetadata(request), request.body as LogComplaintRequestBody));
  }));

  // EXC-008
  router.get("/accounts/:accountId/conflict", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: accountIdParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.checkConflict(request.auth!, request.params.accountId));
  }));
  router.post("/accounts/:accountId/conflict/resolve", requirePermissions({ oneOf: writePermissions }), validateRequest({ params: accountIdParams, body: conflictSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.resolveConflict(request.auth!, getAuditMetadata(request), request.params.accountId, request.body as ResolveConflictRequestBody));
  }));

  // EXC-009
  router.post("/opportunities/:opportunityId/assess-margin", requirePermissions({ oneOf: writePermissions }), validateRequest({ params: opportunityIdParams, body: marginSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.assessMargin(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.body as AssessMarginRequestBody));
  }));
  router.post("/opportunities/:opportunityId/approve-margin", requirePermissions({ oneOf: approvePermissions }), validateRequest({ params: opportunityIdParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.approveMargin(request.auth!, getAuditMetadata(request), request.params.opportunityId));
  }));

  return router;
}
