import { Router } from "express";
import { z } from "zod";
import type {
  AddLegalClauseRequestBody,
  InitLegalRequestBody,
  SubmitClauseApprovalRequestBody,
  UpdateLegalClauseRequestBody,
  UploadSignedContractRequestBody
} from "@crm/types";
import { legalClauseStatuses, legalRiskLevels } from "@crm/types";
import { getAuditMetadata } from "../../common/http/request-metadata.js";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { LegalService } from "./legal.service.js";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
const nullableText = (max: number) => z.string().max(max).nullable().optional();

const readPermissions = ["opportunities.view", "opportunities.view_dashboard", "opportunities.configure", "opportunities.manage_workflow", "opportunities.approve"];
const managePermissions = ["opportunities.edit", "opportunities.configure", "opportunities.manage_workflow", "opportunities.approve"];

const opportunityParam = z.object({ opportunityId: uuidSchema });

const initSchema = z.object({
  contractTypeKey: z.string().min(1).max(160).nullable().optional(),
  dueDate: z.string().max(40).nullable().optional(),
  redlines: nullableText(8000),
  riskLevel: z.enum(legalRiskLevels).nullable().optional(),
  legalOwnerId: uuidSchema.nullable().optional()
});
const clauseSchema = z.object({ title: z.string().min(1).max(300), category: nullableText(160), status: z.enum(legalClauseStatuses).optional(), riskNote: nullableText(4000) });
const clauseUpdateSchema = clauseSchema.partial();
const clauseApprovalSchema = z.object({ approverUserId: uuidSchema, note: nullableText(2000) });
const signedSchema = z.object({ signedFileRef: z.string().min(1).max(2000), signedAt: z.string().max(40).nullable().optional() });

export function createLegalRouter({ databaseService }: RouterDependencies) {
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
  const service = new LegalService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS });

  router.use(authMiddleware);

  router.get("/options", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getOptions(request.auth!));
  }));

  router.get("/:opportunityId", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: opportunityParam }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getLegal(request.auth!, request.params.opportunityId));
  }));

  // LEG-001
  router.put("/:opportunityId", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: opportunityParam, body: initSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.initLegalRequest(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.body as InitLegalRequestBody));
  }));

  // LEG-002
  router.post("/:opportunityId/clauses", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: opportunityParam, body: clauseSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.addClause(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.body as AddLegalClauseRequestBody));
  }));
  router.patch("/:opportunityId/clauses/:clauseId", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: opportunityParam.extend({ clauseId: uuidSchema }), body: clauseUpdateSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.updateClause(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.params.clauseId, request.body as UpdateLegalClauseRequestBody));
  }));
  router.delete("/:opportunityId/clauses/:clauseId", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: opportunityParam.extend({ clauseId: uuidSchema }) }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.removeClause(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.params.clauseId));
  }));
  router.post("/:opportunityId/clauses/:clauseId/approval", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: opportunityParam.extend({ clauseId: uuidSchema }), body: clauseApprovalSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.submitClauseForApproval(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.params.clauseId, request.body as SubmitClauseApprovalRequestBody));
  }));

  // LEG-003
  router.post("/:opportunityId/signed", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: opportunityParam, body: signedSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.uploadSigned(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.body as UploadSignedContractRequestBody));
  }));
  router.post("/:opportunityId/approve", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: opportunityParam }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.approveContract(request.auth!, getAuditMetadata(request), request.params.opportunityId));
  }));

  return router;
}
