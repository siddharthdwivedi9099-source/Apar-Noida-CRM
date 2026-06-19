import { Router, type Request } from "express";
import { z } from "zod";
import {
  workflowActionTypes,
  workflowConditionOperators,
  workflowStatuses,
  workflowTriggerTypes,
  type CreateWorkflowActionRequestBody,
  type CreateWorkflowRequestBody,
  type RunWorkflowRequestBody,
  type UpdateWorkflowActionRequestBody,
  type UpdateWorkflowRequestBody,
  type WorkflowListQuery
} from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { WorkflowService } from "./workflow.service.js";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const recordSchema = z.record(z.unknown());
const conditionSchema = z.object({ field: z.string().min(1).max(120), operator: z.enum(workflowConditionOperators), value: z.unknown().optional() });
const conditionsSchema = z.array(conditionSchema).max(50);

const createWorkflowSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  module: z.string().min(1).max(60).optional(),
  triggerType: z.enum(workflowTriggerTypes),
  triggerConfig: recordSchema.optional(),
  conditions: conditionsSchema.optional(),
  metadata: recordSchema.optional()
});

const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  description: z.string().max(2000).optional(),
  module: z.string().min(1).max(60).optional(),
  triggerType: z.enum(workflowTriggerTypes).optional(),
  triggerConfig: recordSchema.optional(),
  conditions: conditionsSchema.optional(),
  status: z.enum(workflowStatuses).optional(),
  isEnabled: z.boolean().optional(),
  metadata: recordSchema.optional()
});

const createActionSchema = z.object({
  actionType: z.enum(workflowActionTypes),
  actionConfig: recordSchema.optional(),
  requiresPermission: z.string().max(120).nullable().optional(),
  sequence: z.coerce.number().int().min(0).max(1000).optional(),
  isEnabled: z.boolean().optional()
});

const updateActionSchema = z.object({
  actionConfig: recordSchema.optional(),
  requiresPermission: z.string().max(120).nullable().optional(),
  sequence: z.coerce.number().int().min(0).max(1000).optional(),
  isEnabled: z.boolean().optional()
});

const runSchema = z.object({ context: recordSchema.optional() });

const listQuerySchema = z.object({
  triggerType: z.string().max(60).optional(),
  status: z.string().max(40).optional(),
  search: z.string().max(160).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional()
});

const workflowIdParams = z.object({ workflowId: z.string().uuid() });
const actionParams = z.object({ workflowId: z.string().uuid(), actionId: z.string().uuid() });
const runIdParams = z.object({ runId: z.string().uuid() });

const readPermissions: string[] = ["workflows.view", "workflows.view_dashboard", "workflows.create", "workflows.edit", "workflows.configure", "workflows.manage_workflow", "workflows.approve"];
const createPermissions: string[] = ["workflows.create", "workflows.configure", "workflows.manage_workflow"];
const editPermissions: string[] = ["workflows.edit", "workflows.configure", "workflows.manage_workflow"];
const runPermissions: string[] = ["workflows.manage_workflow", "workflows.configure", "workflows.edit"];

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

export function createWorkflowsRouter({ databaseService }: RouterDependencies) {
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
  const service = new WorkflowService(databaseService, {
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

  router.get("/catalog", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (_request, response) => {
    response.status(200).json(service.catalog());
  }));

  router.get("/runs/:runId", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: runIdParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getRun(request.auth!, request.params.runId));
  }));

  router.get("/", requirePermissions({ oneOf: readPermissions }), validateRequest({ query: listQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listWorkflows(request.auth!, request.query as WorkflowListQuery));
  }));

  router.post("/", requirePermissions({ oneOf: createPermissions }), validateRequest({ body: createWorkflowSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createWorkflow(request.auth!, getAuditMetadata(request), request.body as CreateWorkflowRequestBody));
  }));

  router.get("/:workflowId", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: workflowIdParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getWorkflow(request.auth!, request.params.workflowId));
  }));

  router.patch("/:workflowId", requirePermissions({ oneOf: editPermissions }), validateRequest({ params: workflowIdParams, body: updateWorkflowSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.updateWorkflow(request.auth!, getAuditMetadata(request), request.params.workflowId, request.body as UpdateWorkflowRequestBody));
  }));

  router.post("/:workflowId/actions", requirePermissions({ oneOf: editPermissions }), validateRequest({ params: workflowIdParams, body: createActionSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.addAction(request.auth!, getAuditMetadata(request), request.params.workflowId, request.body as CreateWorkflowActionRequestBody));
  }));

  router.patch("/:workflowId/actions/:actionId", requirePermissions({ oneOf: editPermissions }), validateRequest({ params: actionParams, body: updateActionSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.updateAction(request.auth!, getAuditMetadata(request), request.params.workflowId, request.params.actionId, request.body as UpdateWorkflowActionRequestBody));
  }));

  router.delete("/:workflowId/actions/:actionId", requirePermissions({ oneOf: editPermissions }), validateRequest({ params: actionParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.deleteAction(request.auth!, request.params.workflowId, request.params.actionId));
  }));

  router.post("/:workflowId/run", requirePermissions({ oneOf: runPermissions }), validateRequest({ params: workflowIdParams, body: runSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.run(request.auth!, getAuditMetadata(request), request.params.workflowId, (request.body as RunWorkflowRequestBody).context ?? {}));
  }));

  router.get("/:workflowId/runs", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: workflowIdParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listRuns(request.auth!, request.params.workflowId));
  }));

  return router;
}
