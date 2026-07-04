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
import { AiGovernanceService } from "./ai-governance.service.js";
import {
  aiFeedbackRatings,
  aiRiskLevels,
  aiUseCaseActionTypes,
  type AiUseCaseDecisionRequestBody,
  type CreateImprovementTaskRequestBody,
  type RecordAiFeedbackRequestBody,
  type UpsertAiUseCaseRequestBody
} from "@crm/types";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const readPermissions: string[] = ["ai.view", "ai.view_dashboard", "ai.manage_ai", "ai.configure", "ai.approve"];
const writePermissions: string[] = ["ai.manage_ai", "ai.configure"];
const approvePermissions: string[] = ["ai.approve", "ai.manage_ai", "ai.configure"];

const useCaseSchema = z.object({
  name: z.string().min(1).max(200),
  ownerId: uuidSchema.nullable().optional(),
  objectType: nullableText(160),
  persona: nullableText(160),
  dataUsed: nullableText(4000),
  actionType: z.enum(aiUseCaseActionTypes).optional(),
  riskLevel: z.enum(aiRiskLevels).optional(),
  model: nullableText(160),
  prompt: nullableText(20000),
  monitoringPlan: nullableText(8000),
  changeReason: nullableText(500)
});
const useCaseIdSchema = z.object({ useCaseId: uuidSchema });
const decisionSchema = z.object({ decision: z.enum(["submit", "approve", "reject"]), note: nullableText(2000) });
const feedbackSchema = z.object({
  runId: uuidSchema.nullable().optional(),
  useCaseId: uuidSchema.nullable().optional(),
  entityType: nullableText(120),
  entityId: uuidSchema.nullable().optional(),
  rating: z.enum(aiFeedbackRatings),
  isHallucination: z.boolean().optional(),
  confidenceFlag: z.enum(["normal", "low"]).optional(),
  comment: nullableText(4000)
});
const improvementTaskSchema = z.object({
  title: z.string().min(1).max(300),
  description: nullableText(8000),
  source: z.enum(["feedback", "hallucination", "quality", "override"]).optional(),
  useCaseId: uuidSchema.nullable().optional(),
  feedbackId: uuidSchema.nullable().optional(),
  ownerId: uuidSchema.nullable().optional()
});

export function createAiGovernanceRouter({ databaseService }: RouterDependencies) {
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
  const service = new AiGovernanceService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS });

  router.use(createAuthMiddleware(authService));

  // ---- AIG-001: use-case registry --------------------------------------------------------------
  router.get("/use-cases", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listUseCases(request.auth!));
  }));
  router.post("/use-cases", requirePermissions({ oneOf: writePermissions }), validateRequest({ body: useCaseSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createUseCase(request.auth!, getAuditMetadata(request), request.body as UpsertAiUseCaseRequestBody));
  }));
  router.get("/use-cases/:useCaseId", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: useCaseIdSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getUseCase(request.auth!, request.params.useCaseId));
  }));
  router.put("/use-cases/:useCaseId", requirePermissions({ oneOf: writePermissions }), validateRequest({ params: useCaseIdSchema, body: useCaseSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.updateUseCase(request.auth!, getAuditMetadata(request), request.params.useCaseId, request.body as UpsertAiUseCaseRequestBody));
  }));
  router.post("/use-cases/:useCaseId/decision", requirePermissions({ oneOf: approvePermissions }), validateRequest({ params: useCaseIdSchema, body: decisionSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.decideUseCase(request.auth!, getAuditMetadata(request), request.params.useCaseId, request.body as AiUseCaseDecisionRequestBody));
  }));

  // ---- AIG-003 / AIG-004: feedback -------------------------------------------------------------
  router.post("/feedback", requirePermissions({ oneOf: readPermissions }), validateRequest({ body: feedbackSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.recordFeedback(request.auth!, getAuditMetadata(request), request.body as RecordAiFeedbackRequestBody));
  }));

  // ---- AIG-005: quality dashboard + improvement tasks ------------------------------------------
  router.get("/quality", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getQualityDashboard(request.auth!));
  }));
  router.post("/improvement-tasks", requirePermissions({ oneOf: writePermissions }), validateRequest({ body: improvementTaskSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createImprovementTask(request.auth!, getAuditMetadata(request), request.body as CreateImprovementTaskRequestBody));
  }));

  return router;
}
