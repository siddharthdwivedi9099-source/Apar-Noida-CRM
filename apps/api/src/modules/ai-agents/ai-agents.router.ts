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
import { AiAgentsService } from "./ai-agents.service.js";
import { aiAgentKinds, type DecideAgentRunRequestBody, type RunAgentRequestBody } from "@crm/types";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
// AI agents are available to CRM users with AI access or the relevant module dashboard access.
const usePermissions: string[] = ["ai.view", "ai.use_ai", "ai.view_dashboard", "ai.manage_ai", "leads.view", "opportunities.view", "support.view", "customer_success.view", "admin.view"];
const actPermissions: string[] = ["ai.use_ai", "ai.manage_ai", "leads.edit", "opportunities.edit", "support.edit", "customer_success.edit", "admin.configure"];

const kindParams = z.object({ agentKind: z.enum(aiAgentKinds) });
const runIdParams = z.object({ runId: uuidSchema });
const runSchema = z.object({ entityType: z.string().max(60).nullable().optional(), entityId: uuidSchema.nullable().optional(), input: z.record(z.unknown()).optional() });
const decideSchema = z.object({ decision: z.enum(["accept", "override", "reject"]), corrected: z.record(z.unknown()).optional(), feedbackComment: z.string().max(4000).nullable().optional(), logActivity: z.boolean().optional() });
const listQuery = z.object({ entityType: z.string().max(60).optional(), entityId: uuidSchema.optional(), agentKind: z.enum(aiAgentKinds).optional() });

export function createAiAgentsRouter({ databaseService }: RouterDependencies) {
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
  const service = new AiAgentsService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS });

  router.use(createAuthMiddleware(authService));

  router.get("/runs", requirePermissions({ oneOf: usePermissions }), validateRequest({ query: listQuery }), asyncHandler(async (request, response) => {
    const q = request.query as z.infer<typeof listQuery>;
    response.status(200).json(await service.listRuns(request.auth!, q.entityType ?? null, q.entityId ?? null, q.agentKind ?? null));
  }));
  router.post("/:agentKind/run", requirePermissions({ oneOf: usePermissions }), validateRequest({ params: kindParams, body: runSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.runAgent(request.auth!, getAuditMetadata(request), request.params.agentKind, request.body as RunAgentRequestBody));
  }));
  router.post("/runs/:runId/decision", requirePermissions({ oneOf: actPermissions }), validateRequest({ params: runIdParams, body: decideSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.decideRun(request.auth!, getAuditMetadata(request), request.params.runId, request.body as DecideAgentRunRequestBody));
  }));

  return router;
}
