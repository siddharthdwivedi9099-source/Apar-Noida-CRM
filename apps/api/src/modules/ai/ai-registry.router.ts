import { Router, type Request } from "express";
import { z } from "zod";
import {
  aiAgentDataScopes,
  aiAgentStatuses,
  aiApprovalStatuses,
  aiPromptRoles,
  type AiAgentListQuery,
  type AiPromptListQuery,
  type CreateAiAgentRequestBody,
  type CreateAiPromptRequestBody,
  type CreateAiPromptVersionRequestBody,
  type UpdateAiAgentRequestBody,
  type UpdateAiPromptApprovalRequestBody,
  type UpdateAiPromptRequestBody
} from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { AgentRegistryService } from "./agent-registry.service.js";
import { PromptRegistryService } from "./prompt-registry.service.js";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const recordSchema = z.record(z.unknown());
const guardrailsSchema = z.array(z.string().min(1).max(500)).max(50);
const escalationRulesSchema = z
  .array(z.object({ trigger: z.string().min(1).max(120), action: z.string().min(1).max(120), escalateTo: z.string().min(1).max(120) }))
  .max(50);

const createPromptSchema = z.object({
  promptKey: z.string().min(1).max(120).regex(/^[a-zA-Z0-9_.-]+$/, "Prompt key may only contain letters, numbers, dots, dashes, and underscores."),
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  module: z.string().min(1).max(60).optional(),
  promptRole: z.enum(aiPromptRoles).optional(),
  content: z.string().min(1).max(20000),
  inputSchema: recordSchema.optional(),
  outputSchema: recordSchema.optional(),
  guardrails: guardrailsSchema.optional(),
  changeSummary: z.string().max(500).optional(),
  metadata: recordSchema.optional()
});

const updatePromptSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  description: z.string().max(2000).optional(),
  module: z.string().min(1).max(60).optional(),
  promptRole: z.enum(aiPromptRoles).optional(),
  metadata: recordSchema.optional()
});

const createVersionSchema = z.object({
  content: z.string().min(1).max(20000),
  inputSchema: recordSchema.optional(),
  outputSchema: recordSchema.optional(),
  guardrails: guardrailsSchema.optional(),
  changeSummary: z.string().max(500).optional(),
  activate: z.boolean().optional()
});

const approvalSchema = z.object({ approvalStatus: z.enum(aiApprovalStatuses) });
const setActiveSchema = z.object({ isActive: z.boolean() });

const promptListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  module: z.string().max(60).optional(),
  approvalStatus: z.string().max(60).optional(),
  isActive: z.string().max(10).optional(),
  search: z.string().max(160).optional()
});

const promptIdParamsSchema = z.object({ promptId: z.string().uuid() });
const promptVersionParamsSchema = z.object({ promptId: z.string().uuid(), version: z.coerce.number().int().positive() });

const createAgentSchema = z.object({
  agentKey: z.string().min(1).max(120).regex(/^[a-zA-Z0-9_.-]+$/, "Agent key may only contain letters, numbers, dots, dashes, and underscores."),
  name: z.string().min(1).max(160),
  purpose: z.string().max(2000).optional(),
  module: z.string().min(1).max(60).optional(),
  allowedTools: z.array(z.string().min(1).max(120)).max(50).optional(),
  allowedRoles: z.array(z.string().min(1).max(120)).max(50).optional(),
  dataAccessScope: z.enum(aiAgentDataScopes).optional(),
  requiresHumanApproval: z.boolean().optional(),
  status: z.enum(aiAgentStatuses).optional(),
  loggingEnabled: z.boolean().optional(),
  escalationRules: escalationRulesSchema.optional(),
  metadata: recordSchema.optional()
});

const updateAgentSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  purpose: z.string().max(2000).optional(),
  module: z.string().min(1).max(60).optional(),
  allowedTools: z.array(z.string().min(1).max(120)).max(50).optional(),
  allowedRoles: z.array(z.string().min(1).max(120)).max(50).optional(),
  dataAccessScope: z.enum(aiAgentDataScopes).optional(),
  requiresHumanApproval: z.boolean().optional(),
  status: z.enum(aiAgentStatuses).optional(),
  loggingEnabled: z.boolean().optional(),
  escalationRules: escalationRulesSchema.optional(),
  metadata: recordSchema.optional()
});

const agentListQuerySchema = z.object({
  module: z.string().max(60).optional(),
  status: z.string().max(60).optional(),
  search: z.string().max(160).optional()
});

const agentIdParamsSchema = z.object({ agentId: z.string().uuid() });

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
const createPermissions: string[] = ["ai.create", "ai.configure", "ai.manage_ai"];
const editPermissions: string[] = ["ai.edit", "ai.configure", "ai.manage_ai"];
const activatePermissions: string[] = ["ai.configure", "ai.manage_ai"];
const approvePermissions: string[] = ["ai.approve", "ai.configure", "ai.manage_ai"];

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

export function createAiRegistryRouter({ databaseService }: RouterDependencies) {
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
  const promptService = new PromptRegistryService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS });
  const agentService = new AgentRegistryService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS });

  router.use(authMiddleware);

  // ----- Prompt Registry -----
  router.get("/prompts", requirePermissions({ oneOf: readPermissions }), validateRequest({ query: promptListQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await promptService.listPrompts(request.auth!, request.query as AiPromptListQuery));
  }));

  router.post("/prompts", requirePermissions({ oneOf: createPermissions }), validateRequest({ body: createPromptSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await promptService.createPrompt(request.auth!, getAuditMetadata(request), request.body as CreateAiPromptRequestBody));
  }));

  router.get("/prompts/:promptId", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: promptIdParamsSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await promptService.getPrompt(request.auth!, request.params.promptId));
  }));

  router.patch("/prompts/:promptId", requirePermissions({ oneOf: editPermissions }), validateRequest({ params: promptIdParamsSchema, body: updatePromptSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await promptService.updatePrompt(request.auth!, getAuditMetadata(request), request.params.promptId, request.body as UpdateAiPromptRequestBody));
  }));

  router.get("/prompts/:promptId/versions", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: promptIdParamsSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await promptService.listVersions(request.auth!, request.params.promptId));
  }));

  router.post("/prompts/:promptId/versions", requirePermissions({ oneOf: editPermissions }), validateRequest({ params: promptIdParamsSchema, body: createVersionSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await promptService.createVersion(request.auth!, getAuditMetadata(request), request.params.promptId, request.body as CreateAiPromptVersionRequestBody));
  }));

  router.post("/prompts/:promptId/versions/:version/activate", requirePermissions({ oneOf: activatePermissions }), validateRequest({ params: promptVersionParamsSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await promptService.activateVersion(request.auth!, getAuditMetadata(request), request.params.promptId, Number(request.params.version)));
  }));

  router.post("/prompts/:promptId/approval", requirePermissions({ oneOf: approvePermissions }), validateRequest({ params: promptIdParamsSchema, body: approvalSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await promptService.setApproval(request.auth!, getAuditMetadata(request), request.params.promptId, request.body as UpdateAiPromptApprovalRequestBody));
  }));

  router.post("/prompts/:promptId/active", requirePermissions({ oneOf: activatePermissions }), validateRequest({ params: promptIdParamsSchema, body: setActiveSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await promptService.setActive(request.auth!, getAuditMetadata(request), request.params.promptId, Boolean((request.body as { isActive: boolean }).isActive)));
  }));

  // ----- Agent Registry -----
  router.get("/agents", requirePermissions({ oneOf: readPermissions }), validateRequest({ query: agentListQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await agentService.listAgents(request.auth!, request.query as AiAgentListQuery));
  }));

  router.post("/agents", requirePermissions({ oneOf: createPermissions }), validateRequest({ body: createAgentSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await agentService.createAgent(request.auth!, getAuditMetadata(request), request.body as CreateAiAgentRequestBody));
  }));

  router.get("/agents/:agentId", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: agentIdParamsSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await agentService.getAgent(request.auth!, request.params.agentId));
  }));

  router.patch("/agents/:agentId", requirePermissions({ oneOf: editPermissions }), validateRequest({ params: agentIdParamsSchema, body: updateAgentSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await agentService.updateAgent(request.auth!, getAuditMetadata(request), request.params.agentId, request.body as UpdateAiAgentRequestBody));
  }));

  return router;
}
