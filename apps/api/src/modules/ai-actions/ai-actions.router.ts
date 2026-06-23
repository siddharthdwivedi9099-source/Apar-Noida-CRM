import { Router } from "express";
import { getAuditMetadata } from "../../common/http/request-metadata.js";
import { z } from "zod";
import type { AiActionRunListQuery, ExecuteAiActionRequestBody, ReviewAiActionRunRequestBody } from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { AiActionsService } from "./ai-actions.service.js";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const recordSchema = z.record(z.unknown());

const executeSchema = z.object({
  variables: z.record(z.string()).optional(),
  entityType: z.string().max(60).optional(),
  entityId: z.string().uuid().optional(),
  metadata: recordSchema.optional()
});

const reviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(2000).optional()
});

const catalogQuerySchema = z.object({ module: z.string().max(60).optional() });

const runListQuerySchema = z.object({
  module: z.string().max(60).optional(),
  actionKey: z.string().max(120).optional(),
  status: z.string().max(40).optional(),
  reviewStatus: z.string().max(40).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional()
});

const actionKeyParams = z.object({ actionKey: z.string().min(1).max(120) });
const runIdParams = z.object({ runId: z.string().uuid() });

const observabilityPermissions: string[] = ["ai.view", "ai.view_dashboard", "ai.manage_ai", "ai.configure", "ai.approve"];

export function createAiActionsRouter({ databaseService }: RouterDependencies) {
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
  const service = new AiActionsService(databaseService, {
    enableAuditLogs: env.ENABLE_AUDIT_LOGS,
    gatewayEnabled: env.AI_GATEWAY_ENABLED,
    defaultProvider: env.AI_DEFAULT_PROVIDER,
    defaultModel: env.AI_DEFAULT_MODEL,
    rateLimitPerMinute: env.AI_RATE_LIMIT_PER_MINUTE,
    providerConfig: {
      openaiApiKey: env.AI_OPENAI_API_KEY,
      anthropicApiKey: env.AI_ANTHROPIC_API_KEY,
      azureOpenAiApiKey: env.AI_AZURE_OPENAI_API_KEY,
      azureOpenAiEndpoint: env.AI_AZURE_OPENAI_ENDPOINT,
      localEndpoint: env.AI_LOCAL_ENDPOINT
    }
  });

  router.use(authMiddleware);

  // The catalog is readable by any authenticated user; each action carries a
  // `permitted` flag derived from the actor's permissions.
  router.get("/actions", validateRequest({ query: catalogQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(service.listActions(request.auth!, (request.query as { module?: string }).module));
  }));

  router.get("/actions/runs", requirePermissions({ oneOf: observabilityPermissions }), validateRequest({ query: runListQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listRuns(request.auth!, request.query as AiActionRunListQuery));
  }));

  router.get("/actions/runs/:runId", requirePermissions({ oneOf: observabilityPermissions }), validateRequest({ params: runIdParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getRun(request.auth!, request.params.runId));
  }));

  // Per-action review permission (module approve or ai.approve/manage_ai) is enforced in the service.
  router.post("/actions/runs/:runId/review", validateRequest({ params: runIdParams, body: reviewSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.reviewRun(request.auth!, getAuditMetadata(request), request.params.runId, request.body as ReviewAiActionRunRequestBody));
  }));

  // Per-action permission is enforced inside the service against the catalog.
  router.post("/actions/:actionKey/execute", validateRequest({ params: actionKeyParams, body: executeSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.execute(request.auth!, getAuditMetadata(request), request.params.actionKey, request.body as ExecuteAiActionRequestBody));
  }));

  return router;
}
