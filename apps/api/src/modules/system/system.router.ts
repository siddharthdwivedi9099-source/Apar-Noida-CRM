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
import { SystemAdminService } from "./system.service.js";
import {
  backupRunStatuses,
  backupRunTypes,
  environmentKinds,
  integrationConnectionStatuses,
  integrationDirections,
  integrationSyncStatuses,
  type CreateDeploymentRequestBody,
  type CreateEnvironmentRequestBody,
  type CreateIntegrationConnectionRequestBody,
  type DeploymentDecisionRequestBody,
  type RecordBackupRunRequestBody,
  type RecordSyncRunRequestBody,
  type UpsertBackupPolicyRequestBody
} from "@crm/types";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
const readPermissions: string[] = ["admin.view", "admin.view_dashboard", "admin.configure", "admin.manage_workflow"];
const writePermissions: string[] = ["admin.configure", "admin.manage_workflow"];
const approvePermissions: string[] = ["admin.approve", "admin.configure"];

const connectionSchema = z.object({ name: z.string().min(1).max(200), provider: z.string().min(1).max(120), status: z.enum(integrationConnectionStatuses).optional(), config: z.record(z.unknown()).optional() });
const syncRunSchema = z.object({ direction: z.enum(integrationDirections).optional(), status: z.enum(integrationSyncStatuses), recordsProcessed: z.coerce.number().int().min(0).optional(), latencyMs: z.coerce.number().int().min(0).nullable().optional(), errorMessage: z.string().max(4000).nullable().optional() });
const connectionIdSchema = z.object({ connectionId: uuidSchema });
const runParamsSchema = z.object({ connectionId: uuidSchema, runId: uuidSchema });

const environmentSchema = z.object({ label: z.string().min(1).max(200), kind: z.enum(environmentKinds), isProduction: z.boolean().optional(), notes: z.string().max(4000).nullable().optional() });
const environmentIdSchema = z.object({ environmentId: uuidSchema });
const deploymentSchema = z.object({ configurationVersionId: uuidSchema.nullable().optional(), rollbackPlan: z.string().max(8000).nullable().optional(), notes: z.string().max(4000).nullable().optional() });
const deploymentParamsSchema = z.object({ environmentId: uuidSchema, deploymentId: uuidSchema });
const deploymentDecisionSchema = z.object({ decision: z.enum(["approve", "reject", "deploy", "rollback"]), rollbackPlan: z.string().max(8000).nullable().optional() });

const backupPolicySchema = z.object({ name: z.string().max(200).optional(), scheduleCron: z.string().min(1).max(120), rpoMinutes: z.coerce.number().int().positive(), rtoMinutes: z.coerce.number().int().positive(), retentionDays: z.coerce.number().int().positive().optional(), enabled: z.boolean().optional() });
const backupRunSchema = z.object({ runType: z.enum(backupRunTypes), status: z.enum(backupRunStatuses), sizeBytes: z.coerce.number().int().min(0).nullable().optional(), errorMessage: z.string().max(4000).nullable().optional(), notes: z.string().max(4000).nullable().optional() });

export function createSystemRouter({ databaseService }: RouterDependencies) {
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
  const service = new SystemAdminService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS });

  router.use(createAuthMiddleware(authService));

  // ---- SYS-001: integration monitoring ---------------------------------------------------------
  router.get("/integrations", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getIntegrationMonitoring(request.auth!));
  }));
  router.post("/integrations", requirePermissions({ oneOf: writePermissions }), validateRequest({ body: connectionSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createIntegrationConnection(request.auth!, getAuditMetadata(request), request.body as CreateIntegrationConnectionRequestBody));
  }));
  router.get("/integrations/:connectionId/runs", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: connectionIdSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listSyncRuns(request.auth!, request.params.connectionId));
  }));
  router.post("/integrations/:connectionId/runs", requirePermissions({ oneOf: writePermissions }), validateRequest({ params: connectionIdSchema, body: syncRunSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.recordSyncRun(request.auth!, getAuditMetadata(request), request.params.connectionId, request.body as RecordSyncRunRequestBody));
  }));
  router.post("/integrations/:connectionId/runs/:runId/retry", requirePermissions({ oneOf: writePermissions }), validateRequest({ params: runParamsSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.retrySyncRun(request.auth!, getAuditMetadata(request), request.params.connectionId, request.params.runId));
  }));
  router.post("/integrations/:connectionId/runs/:runId/resolve", requirePermissions({ oneOf: writePermissions }), validateRequest({ params: runParamsSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.markRunResolved(request.auth!, getAuditMetadata(request), request.params.connectionId, request.params.runId));
  }));

  // ---- SYS-003: environment management ---------------------------------------------------------
  router.get("/environments", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listEnvironments(request.auth!));
  }));
  router.post("/environments", requirePermissions({ oneOf: writePermissions }), validateRequest({ body: environmentSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createEnvironment(request.auth!, getAuditMetadata(request), request.body as CreateEnvironmentRequestBody));
  }));
  router.get("/environments/:environmentId/deployments", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: environmentIdSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listDeployments(request.auth!, request.params.environmentId));
  }));
  router.post("/environments/:environmentId/deployments", requirePermissions({ oneOf: writePermissions }), validateRequest({ params: environmentIdSchema, body: deploymentSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createDeployment(request.auth!, getAuditMetadata(request), request.params.environmentId, request.body as CreateDeploymentRequestBody));
  }));
  router.post("/environments/:environmentId/deployments/:deploymentId/decision", requirePermissions({ oneOf: approvePermissions }), validateRequest({ params: deploymentParamsSchema, body: deploymentDecisionSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.decideDeployment(request.auth!, getAuditMetadata(request), request.params.environmentId, request.params.deploymentId, request.body as DeploymentDecisionRequestBody));
  }));

  // ---- SYS-004: backup & recovery --------------------------------------------------------------
  router.get("/backups", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getBackupStatus(request.auth!));
  }));
  router.put("/backups/policy", requirePermissions({ oneOf: writePermissions }), validateRequest({ body: backupPolicySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.upsertBackupPolicy(request.auth!, getAuditMetadata(request), request.body as UpsertBackupPolicyRequestBody));
  }));
  router.post("/backups/runs", requirePermissions({ oneOf: writePermissions }), validateRequest({ body: backupRunSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.recordBackupRun(request.auth!, getAuditMetadata(request), request.body as RecordBackupRunRequestBody));
  }));

  return router;
}
