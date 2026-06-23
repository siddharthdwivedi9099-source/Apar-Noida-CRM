import { Router } from "express";
import { getAuditMetadata } from "../../common/http/request-metadata.js";
import { z } from "zod";
import { aiProviderKeys, aiRequestTypes, type AiGatewayRequestBody, type AiUsageLogListQuery, type UpdateAiSettingsRequestBody } from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { AiGatewayService } from "./ai-gateway.service.js";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const recordSchema = z.record(z.unknown());

const settingsUpdateSchema = z.object({
  isEnabled: z.boolean().optional(),
  defaultProvider: z.enum(aiProviderKeys).optional(),
  defaultModel: z.string().min(1).max(120).optional(),
  rateLimitPerMinute: z.coerce.number().int().positive().max(100000).optional(),
  allowUserOverrides: z.boolean().optional(),
  redactionEnabled: z.boolean().optional(),
  loggingEnabled: z.boolean().optional(),
  metadata: recordSchema.optional()
});

const executeSchema = z.object({
  templateKey: z.string().min(1).max(160),
  variables: z.record(z.string()).optional(),
  providerKey: z.enum(aiProviderKeys).optional(),
  model: z.string().min(1).max(120).optional(),
  requestType: z.enum(aiRequestTypes).optional(),
  metadata: recordSchema.optional()
});

const logsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  provider: z.string().max(60).optional(),
  status: z.string().max(60).optional(),
  templateKey: z.string().max(160).optional()
});

const readPermissions: string[] = [
  "ai.view",
  "ai.create",
  "ai.edit",
  "ai.delete",
  "ai.assign",
  "ai.approve",
  "ai.export",
  "ai.configure",
  "ai.use_ai",
  "ai.manage_ai",
  "ai.view_dashboard",
  "ai.manage_workflow"
];
const usePermissions: string[] = ["ai.use_ai", "ai.manage_ai", "ai.configure"];
const configurePermissions: string[] = ["ai.configure", "ai.manage_ai"];
const logsPermissions: string[] = ["ai.view", "ai.manage_ai", "ai.configure", "ai.view_dashboard"];

export function createAiGatewayRouter({ databaseService }: RouterDependencies) {
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
  const service = new AiGatewayService(databaseService, {
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

  router.get("/settings", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getSettings(request.auth!));
  }));

  router.patch("/settings", requirePermissions({ oneOf: configurePermissions }), validateRequest({ body: settingsUpdateSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.updateSettings(request.auth!, getAuditMetadata(request), request.body as UpdateAiSettingsRequestBody));
  }));

  router.get("/providers", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listProviders(request.auth!));
  }));

  router.get("/templates", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (_request, response) => {
    response.status(200).json(service.listTemplates());
  }));

  router.post("/gateway/execute", requirePermissions({ oneOf: usePermissions }), validateRequest({ body: executeSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.execute(request.auth!, getAuditMetadata(request), request.body as AiGatewayRequestBody));
  }));

  router.get("/logs", requirePermissions({ oneOf: logsPermissions }), validateRequest({ query: logsQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listLogs(request.auth!, request.query as AiUsageLogListQuery));
  }));

  router.get("/usage", requirePermissions({ oneOf: logsPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getUsageSummary(request.auth!));
  }));

  return router;
}
