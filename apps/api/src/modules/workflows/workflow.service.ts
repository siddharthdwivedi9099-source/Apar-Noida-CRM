import {
  type ApprovalType,
  findWorkflowAction,
  type NotificationType,
  workflowActionCatalog,
  workflowActionTypes,
  workflowTriggerCatalog,
  workflowTriggerTypes,
  type CreateWorkflowActionRequestBody,
  type CreateApprovalRequestBody,
  type CreateWorkflowRequestBody,
  type RoleSummary,
  type UpdateWorkflowActionRequestBody,
  type UpdateWorkflowRequestBody,
  type WorkflowAction,
  type WorkflowActionResponse,
  type WorkflowCatalogResponse,
  type WorkflowCondition,
  type WorkflowConditionOperator,
  type WorkflowDetail,
  type WorkflowListQuery,
  type WorkflowListResponse,
  type WorkflowLog,
  type WorkflowResponse,
  type WorkflowRun,
  type WorkflowRunDetail,
  type WorkflowRunListResponse,
  type WorkflowRunResponse,
  type WorkflowSummary
} from "@crm/types";
import type { PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AiGatewayService, type AiGatewayConfig } from "../ai/ai-gateway.service.js";
import { ApprovalService } from "../approvals/approvals.service.js";
import { NotificationService } from "../notifications/notifications.service.js";

interface AuditMetadata {
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

interface ActorContext {
  userId: string;
  tenantId: string;
  sessionId: string;
  email: string;
  displayName: string;
  permissionCodes: string[];
  roles: RoleSummary[];
}

function getField(context: Record<string, unknown>, field: string): unknown {
  return field.split(".").reduce<unknown>((value, key) => (value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined), context);
}

function evaluateCondition(condition: WorkflowCondition, context: Record<string, unknown>): boolean {
  const actual = getField(context, condition.field);
  const expected = condition.value;
  switch (condition.operator as WorkflowConditionOperator) {
    case "eq":
      return String(actual) === String(expected);
    case "ne":
      return String(actual) !== String(expected);
    case "gt":
      return Number(actual) > Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "gte":
      return Number(actual) >= Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
    case "contains":
      return String(actual ?? "").toLowerCase().includes(String(expected ?? "").toLowerCase());
    case "exists":
      return actual !== undefined && actual !== null;
    case "in":
      return Array.isArray(expected) && expected.map((entry) => String(entry)).includes(String(actual));
    default:
      return false;
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asConditions(value: unknown): WorkflowCondition[] {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
        .map((entry) => ({ field: String(entry.field ?? ""), operator: (entry.operator as WorkflowConditionOperator) ?? "exists", value: entry.value }))
    : [];
}

export class WorkflowService {
  private readonly gateway: AiGatewayService;
  private readonly notificationService: NotificationService;
  private readonly approvalService: ApprovalService;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly gatewayConfig: AiGatewayConfig
  ) {
    this.gateway = new AiGatewayService(databaseService, gatewayConfig);
    this.notificationService = new NotificationService(databaseService, {
      enableAuditLogs: gatewayConfig.enableAuditLogs
    });
    this.approvalService = new ApprovalService(databaseService, {
      enableAuditLogs: gatewayConfig.enableAuditLogs
    });
  }

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "Workflows are unavailable until the database connection is enabled.", undefined, "WORKFLOWS_UNAVAILABLE");
    }
  }

  private async recordAuditLog(client: PoolClient, actor: ActorContext, audit: AuditMetadata, input: { action: string; resourceId: string; status: "success" | "failure"; metadata?: Record<string, unknown> }) {
    if (!this.gatewayConfig.enableAuditLogs) {
      return;
    }
    await client.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, session_id, event_type, action, resource_type, resource_id, status, ip_address, user_agent, request_id, metadata) VALUES ($1, $2, $3, 'workflows', $4, 'workflow', $5, $6, NULLIF($7, '')::inet, $8, $9, $10::jsonb)`,
      [actor.tenantId, actor.userId, actor.sessionId, input.action, input.resourceId, input.status, audit.ipAddress ?? "", audit.userAgent ?? null, audit.requestId, JSON.stringify(input.metadata ?? {})]
    );
  }

  catalog(): WorkflowCatalogResponse {
    return { triggers: workflowTriggerCatalog, actions: workflowActionCatalog };
  }

  // -------------------------------------------------------------------------
  // Mapping
  // -------------------------------------------------------------------------

  private mapAction(row: Record<string, unknown>): WorkflowAction {
    return {
      id: row.id as string,
      workflowId: row.workflow_id as string,
      actionType: row.action_type as WorkflowAction["actionType"],
      actionConfig: asObject(row.action_config),
      requiresPermission: (row.requires_permission as string | null) ?? null,
      sequence: Number(row.sequence ?? 0),
      isEnabled: row.is_enabled as boolean,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString()
    };
  }

  private mapSummary(row: Record<string, unknown>): WorkflowSummary {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      module: row.module as string,
      triggerType: row.trigger_type as WorkflowSummary["triggerType"],
      status: row.status as WorkflowSummary["status"],
      isEnabled: row.is_enabled as boolean,
      conditionCount: Array.isArray(row.conditions) ? (row.conditions as unknown[]).length : 0,
      actionCount: Number(row.action_count ?? 0),
      runCount: Number(row.run_count ?? 0),
      lastRunAt: row.last_run_at ? (row.last_run_at as Date).toISOString() : null,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
      createdBy: (row.created_by as string | null) ?? null,
      updatedBy: (row.updated_by as string | null) ?? null
    };
  }

  private mapRun(row: Record<string, unknown>): WorkflowRun {
    return {
      id: row.id as string,
      workflowId: row.workflow_id as string,
      triggerType: row.trigger_type as string,
      status: row.status as WorkflowRun["status"],
      actionsTotal: Number(row.actions_total ?? 0),
      actionsSucceeded: Number(row.actions_succeeded ?? 0),
      actionsFailed: Number(row.actions_failed ?? 0),
      errorMessage: row.error_message as string,
      startedAt: (row.started_at as Date).toISOString(),
      finishedAt: row.finished_at ? (row.finished_at as Date).toISOString() : null,
      triggeredBy: (row.triggered_by as string | null) ?? null,
      createdAt: (row.created_at as Date).toISOString()
    };
  }

  private mapLog(row: Record<string, unknown>): WorkflowLog {
    return {
      id: row.id as string,
      runId: row.run_id as string,
      workflowId: row.workflow_id as string,
      actionId: (row.action_id as string | null) ?? null,
      actionType: (row.action_type as string | null) ?? null,
      sequence: Number(row.sequence ?? 0),
      status: row.status as WorkflowLog["status"],
      message: row.message as string,
      detail: asObject(row.detail),
      createdAt: (row.created_at as Date).toISOString()
    };
  }

  private async loadWorkflowRow(client: PoolClient, tenantId: string, workflowId: string) {
    const result = await client.query(`SELECT * FROM workflows WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [workflowId, tenantId]);
    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, "The requested workflow was not found.", undefined, "WORKFLOW_NOT_FOUND");
    }
    return row;
  }

  private async loadActions(client: PoolClient, tenantId: string, workflowId: string, enabledOnly = false) {
    const result = await client.query(
      `SELECT * FROM workflow_actions WHERE tenant_id = $1 AND workflow_id = $2 AND deleted_at IS NULL${enabledOnly ? " AND is_enabled = TRUE" : ""} ORDER BY sequence ASC, created_at ASC`,
      [tenantId, workflowId]
    );
    return result.rows;
  }

  private async buildDetail(client: PoolClient, tenantId: string, row: Record<string, unknown>): Promise<WorkflowDetail> {
    const actions = await this.loadActions(client, tenantId, row.id as string);
    return {
      ...this.mapSummary({ ...row, action_count: actions.length }),
      triggerConfig: asObject(row.trigger_config),
      conditions: asConditions(row.conditions),
      actions: actions.map((action) => this.mapAction(action))
    };
  }

  // -------------------------------------------------------------------------
  // Workflow CRUD
  // -------------------------------------------------------------------------

  async createWorkflow(actor: ActorContext, audit: AuditMetadata, input: CreateWorkflowRequestBody): Promise<WorkflowResponse> {
    this.assertEnabled();
    if (!workflowTriggerTypes.includes(input.triggerType)) {
      throw new AppError(400, "Unknown trigger type.", undefined, "VALIDATION_ERROR");
    }
    const workflow = await this.databaseService.withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO workflows (tenant_id, name, description, module, trigger_type, trigger_config, conditions, metadata, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $9) RETURNING *`,
        [actor.tenantId, input.name.trim(), (input.description ?? "").trim(), (input.module ?? "workflows").trim(), input.triggerType, JSON.stringify(input.triggerConfig ?? {}), JSON.stringify(asConditions(input.conditions)), JSON.stringify(input.metadata ?? {}), actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "workflow.create", resourceId: inserted.rows[0].id as string, status: "success", metadata: { triggerType: input.triggerType } });
      return this.buildDetail(client, actor.tenantId, inserted.rows[0]);
    });
    return { workflow };
  }

  async listWorkflows(actor: ActorContext, query: WorkflowListQuery): Promise<WorkflowListResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const page = Math.max(1, query.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
      const conditions = ["w.tenant_id = $1", "w.deleted_at IS NULL"];
      const params: unknown[] = [actor.tenantId];
      if (query.triggerType) {
        params.push(query.triggerType);
        conditions.push(`w.trigger_type = $${params.length}`);
      }
      if (query.status) {
        params.push(query.status);
        conditions.push(`w.status = $${params.length}`);
      }
      if (query.search) {
        params.push(`%${query.search.toLowerCase()}%`);
        conditions.push(`LOWER(w.name) LIKE $${params.length}`);
      }
      const whereClause = conditions.join(" AND ");
      const countResult = await client.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM workflows w WHERE ${whereClause}`, params);
      const total = Number(countResult.rows[0]?.total ?? "0");
      const listParams = [...params, pageSize, (page - 1) * pageSize];
      const listResult = await client.query(
        `SELECT w.*, (SELECT COUNT(*) FROM workflow_actions a WHERE a.workflow_id = w.id AND a.tenant_id = w.tenant_id AND a.deleted_at IS NULL) AS action_count
         FROM workflows w WHERE ${whereClause} ORDER BY w.updated_at DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams
      );
      const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
      return {
        workflows: listResult.rows.map((row) => this.mapSummary(row)),
        pagination: { page, pageSize, total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 }
      };
    });
  }

  async getWorkflow(actor: ActorContext, workflowId: string): Promise<WorkflowResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const row = await this.loadWorkflowRow(client, actor.tenantId, workflowId);
      return { workflow: await this.buildDetail(client, actor.tenantId, row) };
    });
  }

  async updateWorkflow(actor: ActorContext, audit: AuditMetadata, workflowId: string, input: UpdateWorkflowRequestBody): Promise<WorkflowResponse> {
    this.assertEnabled();
    const workflow = await this.databaseService.withTransaction(async (client) => {
      await this.loadWorkflowRow(client, actor.tenantId, workflowId);
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateWorkflowRequestBody] !== undefined);
      if (keys.length === 0) {
        throw new AppError(400, "At least one field must be updated.", undefined, "VALIDATION_ERROR");
      }
      const assignments: string[] = [];
      const params: unknown[] = [workflowId, actor.tenantId, actor.userId];
      const push = (column: string, value: unknown, cast = "") => {
        params.push(value);
        assignments.push(`${column} = $${params.length}${cast}`);
      };
      if (input.name !== undefined) push("name", input.name.trim());
      if (input.description !== undefined) push("description", input.description.trim());
      if (input.module !== undefined) push("module", input.module.trim());
      if (input.triggerType !== undefined) push("trigger_type", input.triggerType);
      if (input.triggerConfig !== undefined) push("trigger_config", JSON.stringify(input.triggerConfig), "::jsonb");
      if (input.conditions !== undefined) push("conditions", JSON.stringify(asConditions(input.conditions)), "::jsonb");
      if (input.status !== undefined) push("status", input.status);
      if (input.isEnabled !== undefined) push("is_enabled", Boolean(input.isEnabled));
      if (input.metadata !== undefined) push("metadata", JSON.stringify(input.metadata), "::jsonb");
      await client.query(`UPDATE workflows SET ${assignments.join(", ")}, updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, params);
      await this.recordAuditLog(client, actor, audit, { action: "workflow.update", resourceId: workflowId, status: "success", metadata: { updatedFields: keys } });
      return this.buildDetail(client, actor.tenantId, await this.loadWorkflowRow(client, actor.tenantId, workflowId));
    });
    return { workflow };
  }

  async addAction(actor: ActorContext, audit: AuditMetadata, workflowId: string, input: CreateWorkflowActionRequestBody): Promise<WorkflowActionResponse> {
    this.assertEnabled();
    if (!workflowActionTypes.includes(input.actionType)) {
      throw new AppError(400, "Unknown action type.", undefined, "VALIDATION_ERROR");
    }
    const action = await this.databaseService.withTransaction(async (client) => {
      await this.loadWorkflowRow(client, actor.tenantId, workflowId);
      const def = findWorkflowAction(input.actionType);
      const requiresPermission = input.requiresPermission !== undefined ? input.requiresPermission : def?.defaultRequiredPermission ?? null;
      const sequence = input.sequence ?? (await client.query<{ next: number }>(`SELECT COALESCE(MAX(sequence), 0) + 1 AS next FROM workflow_actions WHERE tenant_id = $1 AND workflow_id = $2 AND deleted_at IS NULL`, [actor.tenantId, workflowId])).rows[0].next;
      const inserted = await client.query(
        `INSERT INTO workflow_actions (tenant_id, workflow_id, action_type, action_config, requires_permission, sequence, is_enabled, created_by, updated_by)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $8) RETURNING *`,
        [actor.tenantId, workflowId, input.actionType, JSON.stringify(input.actionConfig ?? {}), requiresPermission, sequence, input.isEnabled ?? true, actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "workflow.action.add", resourceId: workflowId, status: "success", metadata: { actionType: input.actionType } });
      return this.mapAction(inserted.rows[0]);
    });
    return { action };
  }

  async updateAction(actor: ActorContext, audit: AuditMetadata, workflowId: string, actionId: string, input: UpdateWorkflowActionRequestBody): Promise<WorkflowActionResponse> {
    this.assertEnabled();
    const action = await this.databaseService.withTransaction(async (client) => {
      await this.loadWorkflowRow(client, actor.tenantId, workflowId);
      const existing = await client.query(`SELECT id FROM workflow_actions WHERE id = $1 AND tenant_id = $2 AND workflow_id = $3 AND deleted_at IS NULL LIMIT 1`, [actionId, actor.tenantId, workflowId]);
      if (!existing.rows[0]) {
        throw new AppError(404, "The requested workflow action was not found.", undefined, "WORKFLOW_ACTION_NOT_FOUND");
      }
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateWorkflowActionRequestBody] !== undefined);
      if (keys.length === 0) {
        throw new AppError(400, "At least one field must be updated.", undefined, "VALIDATION_ERROR");
      }
      const assignments: string[] = [];
      const params: unknown[] = [actionId, actor.tenantId, actor.userId];
      const push = (column: string, value: unknown, cast = "") => {
        params.push(value);
        assignments.push(`${column} = $${params.length}${cast}`);
      };
      if (input.actionConfig !== undefined) push("action_config", JSON.stringify(input.actionConfig), "::jsonb");
      if (input.requiresPermission !== undefined) push("requires_permission", input.requiresPermission);
      if (input.sequence !== undefined) push("sequence", input.sequence);
      if (input.isEnabled !== undefined) push("is_enabled", Boolean(input.isEnabled));
      await client.query(`UPDATE workflow_actions SET ${assignments.join(", ")}, updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, params);
      const updated = await client.query(`SELECT * FROM workflow_actions WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [actionId, actor.tenantId]);
      return this.mapAction(updated.rows[0]);
    });
    return { action };
  }

  async deleteAction(actor: ActorContext, workflowId: string, actionId: string): Promise<{ deleted: boolean }> {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      await this.loadWorkflowRow(client, actor.tenantId, workflowId);
      const existing = await client.query(`SELECT id FROM workflow_actions WHERE id = $1 AND tenant_id = $2 AND workflow_id = $3 AND deleted_at IS NULL LIMIT 1`, [actionId, actor.tenantId, workflowId]);
      if (!existing.rows[0]) {
        throw new AppError(404, "The requested workflow action was not found.", undefined, "WORKFLOW_ACTION_NOT_FOUND");
      }
      await client.query(`UPDATE workflow_actions SET deleted_at = NOW(), updated_by = $3 WHERE id = $1 AND tenant_id = $2`, [actionId, actor.tenantId, actor.userId]);
      return { deleted: true };
    });
  }

  // -------------------------------------------------------------------------
  // Execution engine
  // -------------------------------------------------------------------------

  private getStringValue(candidate: unknown) {
    return typeof candidate === "string" && candidate.trim().length > 0 ? candidate.trim() : null;
  }

  private getLinkedRecord(
    actionConfig: Record<string, unknown>,
    context: Record<string, unknown>
  ) {
    const configLinkedRecord = asObject(actionConfig.linkedRecord);
    const contextLinkedRecord = asObject(context.linkedRecord);
    const entityType =
      this.getStringValue(configLinkedRecord.entityType) ??
      this.getStringValue(contextLinkedRecord.entityType) ??
      this.getStringValue(context.recordType) ??
      this.getStringValue(context.entityType);
    const entityId =
      this.getStringValue(configLinkedRecord.entityId) ??
      this.getStringValue(contextLinkedRecord.entityId) ??
      this.getStringValue(context.recordId) ??
      this.getStringValue(context.entityId);

    return entityType && entityId
      ? {
          entityType,
          entityId
        }
      : null;
  }

  private async executeAction(
    client: PoolClient,
    actor: ActorContext,
    audit: AuditMetadata,
    action: Record<string, unknown>,
    workflowId: string,
    runId: string,
    context: Record<string, unknown>
  ): Promise<{ message: string; detail: Record<string, unknown> }> {
    const actionType = action.action_type as string;
    const config = asObject(action.action_config);
    const def = findWorkflowAction(actionType);

    if (actionType === "run_ai_prompt") {
      const templateKey = typeof config.templateKey === "string" ? config.templateKey : "generic_assistant";
      const variables = asObject(config.variables) as Record<string, string>;
      const effectiveVars = Object.keys(variables).length > 0 ? variables : { prompt: String(config.prompt ?? "Summarize the triggering record.") };
      // Rule 4: AI actions go through the AI Gateway.
      const result = await this.gateway.execute(actor, audit, { templateKey, variables: effectiveVars });
      return { message: `AI prompt executed via gateway (${result.provider}/${result.model}).`, detail: { templateKey, provider: result.provider, model: result.model, status: result.status, output: result.output } };
    }

    if (actionType === "run_ai_agent") {
      const templateKey = typeof config.templateKey === "string" ? config.templateKey : "generic_assistant";
      const agentKey = typeof config.agentKey === "string" ? config.agentKey : "assistant";
      const variables = asObject(config.variables) as Record<string, string>;
      const effectiveVars = Object.keys(variables).length > 0 ? variables : { prompt: String(config.instruction ?? `Dispatch agent ${agentKey}.`) };
      const result = await this.gateway.execute(actor, audit, { templateKey, variables: effectiveVars });
      return { message: `AI agent ${agentKey} dispatched via gateway (${result.provider}/${result.model}).`, detail: { agentKey, templateKey, provider: result.provider, status: result.status } };
    }

    if (actionType === "send_notification") {
      const notification = await this.notificationService.createNotificationWithClient(client, actor, audit, {
        notificationType:
          (this.getStringValue(config.notificationType) as NotificationType | null) ?? "workflow_signal",
        title: this.getStringValue(config.title) ?? "Workflow notification",
        message:
          this.getStringValue(config.message) ??
          "A workflow generated a new notification for this workspace.",
        recipientUserId:
          this.getStringValue(config.recipientUserId) ??
          this.getStringValue(context.recipientUserId) ??
          (config.deliverToActor === false ? null : actor.userId),
        recipientRoleId: this.getStringValue(config.recipientRoleId),
        recipientRoleSlug: this.getStringValue(config.recipientRoleSlug),
        linkedRecord: this.getLinkedRecord(config, context),
        metadata: {
          workflowId,
          runId,
          actionId: action.id,
          source: "workflow"
        }
      });

      return {
        message: "In-app notification created.",
        detail: {
          actionType,
          notificationId: notification.id,
          notificationType: notification.notificationType
        }
      };
    }

    if (actionType === "trigger_approval") {
      const approvalType =
        (this.getStringValue(config.approvalType) as ApprovalType | null) ?? null;

      if (!approvalType) {
        throw new AppError(
          400,
          "Approval actions require an approvalType.",
          undefined,
          "WORKFLOW_APPROVAL_TYPE_REQUIRED"
        );
      }

      const approval = await this.approvalService.createApprovalWithClient(client, actor, audit, {
        approvalType: approvalType as CreateApprovalRequestBody["approvalType"],
        title: this.getStringValue(config.title) ?? "Workflow approval request",
        description:
          this.getStringValue(config.description) ??
          "A workflow created a new approval request for review.",
        approverUserId:
          this.getStringValue(config.approverUserId) ??
          this.getStringValue(context.approverUserId),
        approverRoleId: this.getStringValue(config.approverRoleId),
        approverRoleSlug: this.getStringValue(config.approverRoleSlug),
        linkedRecord: this.getLinkedRecord(config, context),
        initialComment: this.getStringValue(config.comment),
        metadata: {
          workflowId,
          runId,
          actionId: action.id,
          source: "workflow"
        }
      });

      return {
        message: "Approval request created.",
        detail: {
          actionType,
          approvalId: approval.id,
          approvalType: approval.approvalType
        }
      };
    }

    // Remaining non-AI actions are still governed, logged effects.
    return {
      message: `${def?.label ?? actionType} executed${def?.placeholder ? " (deferred placeholder)" : ""}.`,
      detail: { actionType, config }
    };
  }

  async run(actor: ActorContext, audit: AuditMetadata, workflowId: string, context: Record<string, unknown>): Promise<WorkflowRunResponse> {
    this.assertEnabled();
    const result = await this.databaseService.withTransaction(async (client) => {
      const workflowRow = await this.loadWorkflowRow(client, actor.tenantId, workflowId);
      if (workflowRow.status !== "active" || workflowRow.is_enabled !== true) {
        throw new AppError(400, "The workflow must be active and enabled before it can run.", undefined, "WORKFLOW_NOT_ACTIVE");
      }
      const conditions = asConditions(workflowRow.conditions);
      const actions = await this.loadActions(client, actor.tenantId, workflowId, true);

      const runInsert = await client.query(
        `INSERT INTO workflow_runs (tenant_id, workflow_id, trigger_type, status, trigger_context, actions_total, triggered_by) VALUES ($1, $2, $3, 'running', $4::jsonb, $5, $6) RETURNING *`,
        [actor.tenantId, workflowId, workflowRow.trigger_type, JSON.stringify(context), actions.length, actor.userId]
      );
      const runId = runInsert.rows[0].id as string;
      let sequence = 0;

      const writeLog = async (status: "succeeded" | "failed" | "skipped", message: string, detail: Record<string, unknown>, actionId: string | null, actionType: string | null) => {
        await client.query(
          `INSERT INTO workflow_logs (tenant_id, run_id, workflow_id, action_id, action_type, sequence, status, message, detail) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
          [actor.tenantId, runId, workflowId, actionId, actionType, sequence++, status, message, JSON.stringify(detail)]
        );
      };

      // Conditions gate the run; an unmet condition produces a skipped, traceable run.
      const conditionsMet = conditions.every((condition) => evaluateCondition(condition, context));
      if (!conditionsMet) {
        await writeLog("skipped", "Workflow conditions were not met.", { conditions }, null, null);
        await client.query(`UPDATE workflow_runs SET status = 'skipped', finished_at = NOW() WHERE id = $1 AND tenant_id = $2`, [runId, actor.tenantId]);
        await client.query(`UPDATE workflows SET run_count = run_count + 1, last_run_at = NOW(), updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [workflowId, actor.tenantId, actor.userId]);
        await this.recordAuditLog(client, actor, audit, { action: "workflow.run", resourceId: workflowId, status: "success", metadata: { runId, status: "skipped" } });
        return this.buildRunDetail(client, actor.tenantId, runId);
      }

      let succeeded = 0;
      let failed = 0;
      for (const action of actions) {
        const def = findWorkflowAction(action.action_type as string);
        const requiredPermission = (action.requires_permission as string | null) ?? def?.defaultRequiredPermission ?? null;
        // Rule 1: workflow actions respect permissions.
        if (requiredPermission && !actor.permissionCodes.includes(requiredPermission)) {
          await writeLog("failed", `Permission denied: ${requiredPermission}.`, { actionType: action.action_type, requiredPermission }, action.id as string, action.action_type as string);
          failed += 1;
          continue;
        }
        try {
          const outcome = await this.executeAction(client, actor, audit, action, workflowId, runId, context);
          await writeLog("succeeded", outcome.message, outcome.detail, action.id as string, action.action_type as string);
          succeeded += 1;
        } catch (error) {
          const message = error instanceof AppError ? error.message : "Action execution failed.";
          const code = error instanceof AppError ? error.code : "ACTION_FAILED";
          await writeLog("failed", message, { actionType: action.action_type, code }, action.id as string, action.action_type as string);
          failed += 1;
        }
      }

      const status = failed > 0 ? "failed" : "succeeded";
      await client.query(
        `UPDATE workflow_runs SET status = $3, actions_succeeded = $4, actions_failed = $5, error_message = $6, finished_at = NOW() WHERE id = $1 AND tenant_id = $2`,
        [runId, actor.tenantId, status, succeeded, failed, failed > 0 ? `${failed} action(s) failed.` : ""]
      );
      await client.query(`UPDATE workflows SET run_count = run_count + 1, last_run_at = NOW(), updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [workflowId, actor.tenantId, actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "workflow.run", resourceId: workflowId, status: failed > 0 ? "failure" : "success", metadata: { runId, status, succeeded, failed } });
      return this.buildRunDetail(client, actor.tenantId, runId);
    });
    return { run: result };
  }

  private async buildRunDetail(client: PoolClient, tenantId: string, runId: string): Promise<WorkflowRunDetail> {
    const runResult = await client.query(`SELECT * FROM workflow_runs WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [runId, tenantId]);
    const row = runResult.rows[0];
    const logsResult = await client.query(`SELECT * FROM workflow_logs WHERE tenant_id = $1 AND run_id = $2 ORDER BY sequence ASC`, [tenantId, runId]);
    return {
      ...this.mapRun(row),
      triggerContext: asObject(row.trigger_context),
      logs: logsResult.rows.map((logRow) => this.mapLog(logRow))
    };
  }

  async listRuns(actor: ActorContext, workflowId: string): Promise<WorkflowRunListResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      await this.loadWorkflowRow(client, actor.tenantId, workflowId);
      const result = await client.query(`SELECT * FROM workflow_runs WHERE tenant_id = $1 AND workflow_id = $2 ORDER BY created_at DESC LIMIT 100`, [actor.tenantId, workflowId]);
      return { runs: result.rows.map((row) => this.mapRun(row)) };
    });
  }

  async getRun(actor: ActorContext, runId: string): Promise<WorkflowRunResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const runResult = await client.query(`SELECT id FROM workflow_runs WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [runId, actor.tenantId]);
      if (!runResult.rows[0]) {
        throw new AppError(404, "The requested workflow run was not found.", undefined, "WORKFLOW_RUN_NOT_FOUND");
      }
      return { run: await this.buildRunDetail(client, actor.tenantId, runId) };
    });
  }
}
