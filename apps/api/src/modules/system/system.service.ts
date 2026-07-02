import type { PoolClient } from "pg";
import type {
  BackupPolicySummary,
  BackupRunSummary,
  BackupStatusResponse,
  CreateDeploymentRequestBody,
  CreateEnvironmentRequestBody,
  CreateIntegrationConnectionRequestBody,
  DeploymentDecisionRequestBody,
  EnvironmentDeploymentsResponse,
  EnvironmentsResponse,
  IntegrationConnectionStatus,
  IntegrationMonitoringResponse,
  IntegrationRunsResponse,
  RecordBackupRunRequestBody,
  RecordSyncRunRequestBody,
  UpsertBackupPolicyRequestBody
} from "@crm/types";
import type { RoleSummary } from "@crm/types";
import {
  backupRunStatuses,
  backupRunTypes,
  computeBackupStatus,
  computeIntegrationHealth,
  deploymentStatuses,
  environmentKinds,
  integrationConnectionStatuses,
  integrationDirections,
  integrationSyncStatuses,
  requiresDeploymentApproval
} from "@crm/types";
import { AppError } from "../../common/errors/app-error.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { NotificationService } from "../notifications/notifications.service.js";

interface ActorContext {
  userId: string;
  tenantId: string;
  sessionId: string;
  email: string;
  displayName: string;
  permissionCodes: string[];
  roles: RoleSummary[];
}

interface AuditMetadata {
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function normalize<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return list.includes(value as T) ? (value as T) : fallback;
}

export class SystemAdminService {
  private readonly notificationService: NotificationService;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {
    this.notificationService = new NotificationService(databaseService, config);
  }

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "System administration is unavailable until the database connection is enabled.", undefined, "SYSTEM_ADMIN_UNAVAILABLE");
    }
  }

  private async recordAuditLog(client: PoolClient, actor: ActorContext, audit: AuditMetadata, input: { action: string; resourceType: string; resourceId?: string | null; status: "success" | "failure"; metadata?: Record<string, unknown> }) {
    if (!this.config.enableAuditLogs) {
      return;
    }
    await client.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, event_type, action, resource_type, resource_id, status, ip_address, user_agent, metadata)
       VALUES ($1, $2, 'system', $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [actor.tenantId, actor.userId, input.action, input.resourceType, input.resourceId ?? null, input.status, audit.ipAddress, audit.userAgent, JSON.stringify(input.metadata ?? {})]
    );
  }

  private async alert(client: PoolClient, actor: ActorContext, audit: AuditMetadata, title: string, message: string, linked: { entityType: string; entityId: string }) {
    await this.notificationService.createNotificationWithClient(client, actor, audit, {
      notificationType: "system_announcement",
      recipientUserId: actor.userId,
      title,
      message,
      linkedRecord: linked
    });
  }

  // ---- SYS-001: integration monitoring ---------------------------------------------------------

  private async loadConnectionHealth(client: PoolClient, tenantId: string, connectionId: string) {
    const runs = await client.query<{ status: string; latency_ms: number | null; started_at: Date; retry_of: string | null; resolved: boolean }>(
      `SELECT status, latency_ms, started_at, retry_of, resolved FROM integration_sync_runs WHERE tenant_id = $1 AND connection_id = $2 ORDER BY started_at DESC LIMIT 100`,
      [tenantId, connectionId]
    );
    return computeIntegrationHealth(
      runs.rows.map((row) => ({
        status: normalize(integrationSyncStatuses, row.status, "running"),
        latencyMs: row.latency_ms,
        startedAtMs: row.started_at.getTime(),
        isRetry: row.retry_of !== null,
        resolved: row.resolved
      }))
    );
  }

  async getIntegrationMonitoring(actor: ActorContext): Promise<IntegrationMonitoringResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const result = await client.query<{ id: string; name: string; provider: string; status: string; created_at: Date; updated_at: Date }>(
        `SELECT id, name, provider, status, created_at, updated_at FROM integration_connections WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 100`,
        [actor.tenantId]
      );
      const connections = [];
      for (const row of result.rows) {
        connections.push({
          id: row.id,
          name: row.name,
          provider: row.provider,
          status: normalize(integrationConnectionStatuses, row.status, "active") as IntegrationConnectionStatus,
          health: await this.loadConnectionHealth(client, actor.tenantId, row.id),
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString()
        });
      }
      return { connections };
    });
  }

  async createIntegrationConnection(actor: ActorContext, audit: AuditMetadata, input: CreateIntegrationConnectionRequestBody) {
    this.assertEnabled();
    const name = input.name?.trim();
    const provider = input.provider?.trim();
    if (!name || !provider) {
      throw new AppError(400, "Connection name and provider are required.", undefined, "VALIDATION_ERROR");
    }
    return this.databaseService.withTransaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO integration_connections (tenant_id, name, provider, status, config, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $6) RETURNING id`,
        [actor.tenantId, name, provider, normalize(integrationConnectionStatuses, input.status, "active"), JSON.stringify(input.config ?? {}), actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "system.integration.create", resourceType: "integration_connection", resourceId: inserted.rows[0].id, status: "success", metadata: { provider } });
      return { connectionId: inserted.rows[0].id };
    });
  }

  private async ensureConnection(client: PoolClient, tenantId: string, connectionId: string) {
    const result = await client.query<{ id: string; name: string; status: string }>(`SELECT id, name, status FROM integration_connections WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [connectionId, tenantId]);
    if (result.rowCount === 0) {
      throw new AppError(404, "Integration connection not found.", undefined, "NOT_FOUND");
    }
    return result.rows[0];
  }

  async recordSyncRun(actor: ActorContext, audit: AuditMetadata, connectionId: string, input: RecordSyncRunRequestBody, retryOf: string | null = null) {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      const connection = await this.ensureConnection(client, actor.tenantId, connectionId);
      const status = normalize(integrationSyncStatuses, input.status, "running");
      const finishedAt = status === "running" ? null : new Date();
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO integration_sync_runs (tenant_id, connection_id, direction, status, records_processed, latency_ms, error_message, retry_of, finished_at, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10, $10) RETURNING id`,
        [actor.tenantId, connectionId, normalize(integrationDirections, input.direction, "inbound"), status, input.recordsProcessed ?? 0, input.latencyMs ?? null, input.errorMessage?.trim() || null, retryOf, finishedAt, actor.userId]
      );
      // A failed run flips the connection to error and raises an alert (SYS-001).
      if (status === "failed") {
        await client.query(`UPDATE integration_connections SET status = 'error', updated_by = $3 WHERE id = $1 AND tenant_id = $2`, [connectionId, actor.tenantId, actor.userId]);
        await this.alert(client, actor, audit, `Integration failure: ${connection.name}`, input.errorMessage?.trim() || "A sync run failed.", { entityType: "integration_connection", entityId: connectionId });
      } else if (status === "success") {
        await client.query(`UPDATE integration_connections SET status = 'active', updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND status = 'error'`, [connectionId, actor.tenantId, actor.userId]);
      }
      await this.recordAuditLog(client, actor, audit, { action: "system.integration.sync_run", resourceType: "integration_sync_run", resourceId: inserted.rows[0].id, status: "success", metadata: { status, retryOf } });
      return { runId: inserted.rows[0].id, status };
    });
  }

  async retrySyncRun(actor: ActorContext, audit: AuditMetadata, connectionId: string, runId: string) {
    this.assertEnabled();
    const original = await this.databaseService.withClient(async (client) => {
      const result = await client.query<{ id: string; direction: string }>(`SELECT id, direction FROM integration_sync_runs WHERE id = $1 AND tenant_id = $2 AND connection_id = $3 LIMIT 1`, [runId, actor.tenantId, connectionId]);
      if (result.rowCount === 0) {
        throw new AppError(404, "Sync run not found.", undefined, "NOT_FOUND");
      }
      return result.rows[0];
    });
    // A retry is a fresh run linked to the original; it starts optimistically as a success record.
    return this.recordSyncRun(actor, audit, connectionId, { direction: normalize(integrationDirections, original.direction, "inbound"), status: "success", recordsProcessed: 0 }, runId);
  }

  async markRunResolved(actor: ActorContext, audit: AuditMetadata, connectionId: string, runId: string) {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query(`UPDATE integration_sync_runs SET resolved = true, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND connection_id = $3`, [runId, actor.tenantId, connectionId, actor.userId]);
      if (result.rowCount === 0) {
        throw new AppError(404, "Sync run not found.", undefined, "NOT_FOUND");
      }
      // Clear the connection error state when no unresolved failures remain.
      const unresolved = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM integration_sync_runs WHERE tenant_id = $1 AND connection_id = $2 AND status = 'failed' AND resolved = false`, [actor.tenantId, connectionId]);
      if (Number(unresolved.rows[0]?.count ?? "0") === 0) {
        await client.query(`UPDATE integration_connections SET status = 'active', updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND status = 'error'`, [connectionId, actor.tenantId, actor.userId]);
      }
      await this.recordAuditLog(client, actor, audit, { action: "system.integration.resolve", resourceType: "integration_sync_run", resourceId: runId, status: "success" });
      return { runId, resolved: true };
    });
  }

  async listSyncRuns(actor: ActorContext, connectionId: string): Promise<IntegrationRunsResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const result = await client.query<{ id: string; connection_id: string; direction: string; status: string; records_processed: number; latency_ms: number | null; error_message: string | null; retry_of: string | null; resolved: boolean; started_at: Date; finished_at: Date | null }>(
        `SELECT id, connection_id, direction, status, records_processed, latency_ms, error_message, retry_of, resolved, started_at, finished_at FROM integration_sync_runs WHERE tenant_id = $1 AND connection_id = $2 ORDER BY started_at DESC LIMIT 200`,
        [actor.tenantId, connectionId]
      );
      return {
        runs: result.rows.map((row) => ({
          id: row.id,
          connectionId: row.connection_id,
          direction: normalize(integrationDirections, row.direction, "inbound"),
          status: normalize(integrationSyncStatuses, row.status, "running"),
          recordsProcessed: row.records_processed,
          latencyMs: row.latency_ms,
          errorMessage: row.error_message,
          isRetry: row.retry_of !== null,
          resolved: row.resolved,
          startedAt: row.started_at.toISOString(),
          finishedAt: toIso(row.finished_at)
        }))
      };
    });
  }

  // ---- SYS-003: environment management ---------------------------------------------------------

  async listEnvironments(actor: ActorContext): Promise<EnvironmentsResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const result = await client.query<{ id: string; label: string; kind: string; is_production: boolean; notes: string | null; active: boolean; created_at: Date; updated_at: Date }>(
        `SELECT id, label, kind, is_production, notes, active, created_at, updated_at FROM environments WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY is_production DESC, created_at ASC`,
        [actor.tenantId]
      );
      return {
        environments: result.rows.map((row) => {
          const kind = normalize(environmentKinds, row.kind, "dev");
          return { id: row.id, label: row.label, kind, isProduction: row.is_production, notes: row.notes, active: row.active, requiresApproval: requiresDeploymentApproval(kind, row.is_production), createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() };
        })
      };
    });
  }

  async createEnvironment(actor: ActorContext, audit: AuditMetadata, input: CreateEnvironmentRequestBody) {
    this.assertEnabled();
    if (!input.label?.trim()) {
      throw new AppError(400, "An environment label is required.", undefined, "VALIDATION_ERROR");
    }
    const kind = normalize(environmentKinds, input.kind, "dev");
    return this.databaseService.withTransaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO environments (tenant_id, label, kind, is_production, notes, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`,
        [actor.tenantId, input.label.trim(), kind, Boolean(input.isProduction) || kind === "production", input.notes?.trim() || null, actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "system.environment.create", resourceType: "environment", resourceId: inserted.rows[0].id, status: "success", metadata: { kind } });
      return { environmentId: inserted.rows[0].id };
    });
  }

  private async ensureEnvironment(client: PoolClient, tenantId: string, environmentId: string) {
    const result = await client.query<{ id: string; kind: string; is_production: boolean }>(`SELECT id, kind, is_production FROM environments WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [environmentId, tenantId]);
    if (result.rowCount === 0) {
      throw new AppError(404, "Environment not found.", undefined, "NOT_FOUND");
    }
    return result.rows[0];
  }

  async createDeployment(actor: ActorContext, audit: AuditMetadata, environmentId: string, input: CreateDeploymentRequestBody) {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      const env = await this.ensureEnvironment(client, actor.tenantId, environmentId);
      const needsApproval = requiresDeploymentApproval(normalize(environmentKinds, env.kind, "dev"), env.is_production);
      // SYS-003: production deployments start pending approval; others are ready to deploy.
      const status = needsApproval ? "pending_approval" : "pending";
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO environment_deployments (tenant_id, environment_id, configuration_version_id, status, rollback_plan, metadata, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $7) RETURNING id`,
        [actor.tenantId, environmentId, input.configurationVersionId ?? null, status, input.rollbackPlan?.trim() || null, JSON.stringify({ notes: input.notes?.trim() || null }), actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "system.deployment.create", resourceType: "environment_deployment", resourceId: inserted.rows[0].id, status: "success", metadata: { environmentId, needsApproval } });
      return { deploymentId: inserted.rows[0].id, status };
    });
  }

  async decideDeployment(actor: ActorContext, audit: AuditMetadata, environmentId: string, deploymentId: string, input: DeploymentDecisionRequestBody) {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      const env = await this.ensureEnvironment(client, actor.tenantId, environmentId);
      const current = await client.query<{ id: string; status: string; rollback_plan: string | null }>(`SELECT id, status, rollback_plan FROM environment_deployments WHERE id = $1 AND tenant_id = $2 AND environment_id = $3 LIMIT 1`, [deploymentId, actor.tenantId, environmentId]);
      if (current.rowCount === 0) {
        throw new AppError(404, "Deployment not found.", undefined, "NOT_FOUND");
      }
      const needsApproval = requiresDeploymentApproval(normalize(environmentKinds, env.kind, "dev"), env.is_production);
      const status = current.rows[0].status;
      let nextStatus = status;
      const sets: string[] = [];
      const params: unknown[] = [deploymentId, actor.tenantId];
      const push = (value: unknown) => { params.push(value); return `$${params.length}`; };

      if (input.decision === "approve") {
        if (status !== "pending_approval") throw new AppError(409, "Only a deployment pending approval can be approved.", undefined, "INVALID_STATE");
        nextStatus = "approved";
        sets.push(`approved_by = ${push(actor.userId)}`, "approved_at = NOW()");
      } else if (input.decision === "reject") {
        if (status !== "pending_approval") throw new AppError(409, "Only a deployment pending approval can be rejected.", undefined, "INVALID_STATE");
        nextStatus = "rejected";
      } else if (input.decision === "deploy") {
        // SYS-003: production cannot be deployed without an approval.
        if (needsApproval && status !== "approved") throw new AppError(409, "Production deployment requires approval before it can be deployed.", undefined, "APPROVAL_REQUIRED");
        if (!needsApproval && status !== "pending" && status !== "approved") throw new AppError(409, "This deployment cannot be deployed from its current state.", undefined, "INVALID_STATE");
        nextStatus = "deployed";
        sets.push("deployed_at = NOW()");
      } else if (input.decision === "rollback") {
        if (status !== "deployed") throw new AppError(409, "Only a deployed deployment can be rolled back.", undefined, "INVALID_STATE");
        nextStatus = "rolled_back";
      } else {
        throw new AppError(400, "Invalid deployment decision.", undefined, "VALIDATION_ERROR");
      }
      sets.push(`status = ${push(nextStatus)}`, `updated_by = ${push(actor.userId)}`);
      if (input.rollbackPlan?.trim()) {
        sets.push(`rollback_plan = ${push(input.rollbackPlan.trim())}`);
      }
      await client.query(`UPDATE environment_deployments SET ${sets.join(", ")} WHERE id = $1 AND tenant_id = $2`, params);
      await this.recordAuditLog(client, actor, audit, { action: `system.deployment.${input.decision}`, resourceType: "environment_deployment", resourceId: deploymentId, status: "success", metadata: { environmentId, from: status, to: nextStatus } });
      return { deploymentId, status: nextStatus };
    });
  }

  async listDeployments(actor: ActorContext, environmentId: string): Promise<EnvironmentDeploymentsResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const result = await client.query<{ id: string; environment_id: string; configuration_version_id: string | null; status: string; rollback_plan: string | null; approved_by: string | null; approved_at: Date | null; deployed_at: Date | null; created_at: Date }>(
        `SELECT id, environment_id, configuration_version_id, status, rollback_plan, approved_by, approved_at, deployed_at, created_at FROM environment_deployments WHERE tenant_id = $1 AND environment_id = $2 ORDER BY created_at DESC LIMIT 100`,
        [actor.tenantId, environmentId]
      );
      return {
        deployments: result.rows.map((row) => ({
          id: row.id,
          environmentId: row.environment_id,
          configurationVersionId: row.configuration_version_id,
          status: normalize(deploymentStatuses, row.status, "pending"),
          rollbackPlan: row.rollback_plan,
          approvedBy: row.approved_by,
          approvedAt: toIso(row.approved_at),
          deployedAt: toIso(row.deployed_at),
          createdAt: row.created_at.toISOString()
        }))
      };
    });
  }

  // ---- SYS-004: backup & recovery --------------------------------------------------------------

  private mapPolicy(row: { id: string; name: string; schedule_cron: string; rpo_minutes: number; rto_minutes: number; retention_days: number; enabled: boolean; updated_at: Date }): BackupPolicySummary {
    return { id: row.id, name: row.name, scheduleCron: row.schedule_cron, rpoMinutes: row.rpo_minutes, rtoMinutes: row.rto_minutes, retentionDays: row.retention_days, enabled: row.enabled, updatedAt: row.updated_at.toISOString() };
  }

  private async loadPolicyRow(client: PoolClient, tenantId: string) {
    const result = await client.query<{ id: string; name: string; schedule_cron: string; rpo_minutes: number; rto_minutes: number; retention_days: number; enabled: boolean; updated_at: Date }>(
      `SELECT id, name, schedule_cron, rpo_minutes, rto_minutes, retention_days, enabled, updated_at FROM backup_policies WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1`,
      [tenantId]
    );
    return result.rows[0] ?? null;
  }

  async getBackupStatus(actor: ActorContext): Promise<BackupStatusResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const policyRow = await this.loadPolicyRow(client, actor.tenantId);
      const runsResult = await client.query<{ id: string; run_type: string; status: string; size_bytes: string | null; error_message: string | null; notes: string | null; started_at: Date; finished_at: Date | null }>(
        `SELECT id, run_type, status, size_bytes, error_message, notes, started_at, finished_at FROM backup_runs WHERE tenant_id = $1 ORDER BY started_at DESC LIMIT 100`,
        [actor.tenantId]
      );
      const rpoMinutes = policyRow?.rpo_minutes ?? 1440;
      const rtoMinutes = policyRow?.rto_minutes ?? 240;
      const status = computeBackupStatus(
        runsResult.rows.map((row) => ({ runType: normalize(backupRunTypes, row.run_type, "backup"), status: normalize(backupRunStatuses, row.status, "running"), startedAtMs: row.started_at.getTime(), finishedAtMs: row.finished_at ? row.finished_at.getTime() : null })),
        { rpoMinutes, rtoMinutes },
        Date.now()
      );
      return {
        policy: policyRow ? this.mapPolicy(policyRow) : null,
        status,
        runs: runsResult.rows.map((row) => ({ id: row.id, runType: normalize(backupRunTypes, row.run_type, "backup"), status: normalize(backupRunStatuses, row.status, "running"), sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes), errorMessage: row.error_message, notes: row.notes, startedAt: row.started_at.toISOString(), finishedAt: toIso(row.finished_at) }))
      };
    });
  }

  async upsertBackupPolicy(actor: ActorContext, audit: AuditMetadata, input: UpsertBackupPolicyRequestBody) {
    this.assertEnabled();
    if (!input.scheduleCron?.trim() || input.rpoMinutes <= 0 || input.rtoMinutes <= 0) {
      throw new AppError(400, "A schedule and positive RPO/RTO are required.", undefined, "VALIDATION_ERROR");
    }
    await this.databaseService.withTransaction(async (client) => {
      const existing = await this.loadPolicyRow(client, actor.tenantId);
      if (existing) {
        await client.query(
          `UPDATE backup_policies SET name = $3, schedule_cron = $4, rpo_minutes = $5, rto_minutes = $6, retention_days = $7, enabled = $8, updated_by = $9 WHERE id = $1 AND tenant_id = $2`,
          [existing.id, actor.tenantId, input.name?.trim() || existing.name, input.scheduleCron.trim(), input.rpoMinutes, input.rtoMinutes, input.retentionDays ?? existing.retention_days, input.enabled ?? existing.enabled, actor.userId]
        );
      } else {
        await client.query(
          `INSERT INTO backup_policies (tenant_id, name, schedule_cron, rpo_minutes, rto_minutes, retention_days, enabled, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
          [actor.tenantId, input.name?.trim() || "Default backup policy", input.scheduleCron.trim(), input.rpoMinutes, input.rtoMinutes, input.retentionDays ?? 30, input.enabled ?? true, actor.userId]
        );
      }
      await this.recordAuditLog(client, actor, audit, { action: "system.backup.policy_upsert", resourceType: "backup_policy", status: "success", metadata: { rpoMinutes: input.rpoMinutes, rtoMinutes: input.rtoMinutes } });
    });
    return this.getBackupStatus(actor);
  }

  async recordBackupRun(actor: ActorContext, audit: AuditMetadata, input: RecordBackupRunRequestBody) {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      const policyRow = await this.loadPolicyRow(client, actor.tenantId);
      const runType = normalize(backupRunTypes, input.runType, "backup");
      const status = normalize(backupRunStatuses, input.status, "running");
      const finishedAt = status === "running" ? null : new Date();
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO backup_runs (tenant_id, policy_id, run_type, status, size_bytes, error_message, notes, finished_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9) RETURNING id`,
        [actor.tenantId, policyRow?.id ?? null, runType, status, input.sizeBytes ?? null, input.errorMessage?.trim() || null, input.notes?.trim() || null, finishedAt, actor.userId]
      );
      // SYS-004: a failed backup/restore-test raises an alert.
      if (status === "failed") {
        await this.alert(client, actor, audit, `${runType === "backup" ? "Backup" : "Restore test"} failed`, input.errorMessage?.trim() || "A backup job failed.", { entityType: "backup_run", entityId: inserted.rows[0].id });
      }
      await this.recordAuditLog(client, actor, audit, { action: "system.backup.run", resourceType: "backup_run", resourceId: inserted.rows[0].id, status: "success", metadata: { runType, status } });
    });
    return this.getBackupStatus(actor);
  }
}
