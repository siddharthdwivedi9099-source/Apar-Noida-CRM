import {
  aiActionCatalog,
  findAiAction,
  type AiActionCatalogResponse,
  type AiActionExecuteResponse,
  type AiActionRun,
  type AiActionRunListQuery,
  type AiActionRunListResponse,
  type AiActionRunResponse,
  type ExecuteAiActionRequestBody,
  type ReviewAiActionRunRequestBody,
  type RoleSummary
} from "@crm/types";
import type { PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AiGatewayService, type AiGatewayConfig } from "../ai/ai-gateway.service.js";

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

export class AiActionsService {
  private readonly gateway: AiGatewayService;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly gatewayConfig: AiGatewayConfig
  ) {
    this.gateway = new AiGatewayService(databaseService, gatewayConfig);
  }

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "AI actions are unavailable until the database connection is enabled.", undefined, "AI_ACTIONS_UNAVAILABLE");
    }
  }

  private hasAny(actor: ActorContext, permissions: string[]) {
    return permissions.some((code) => actor.permissionCodes.includes(code));
  }

  private async recordAuditLog(client: PoolClient, actor: ActorContext, audit: AuditMetadata, input: { action: string; resourceId: string; status: "success" | "failure"; metadata?: Record<string, unknown> }) {
    if (!this.gatewayConfig.enableAuditLogs) {
      return;
    }
    await client.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, session_id, event_type, action, resource_type, resource_id, status, ip_address, user_agent, request_id, metadata) VALUES ($1, $2, $3, 'ai', $4, 'ai_action_run', $5, $6, NULLIF($7, '')::inet, $8, $9, $10::jsonb)`,
      [actor.tenantId, actor.userId, actor.sessionId, input.action, input.resourceId, input.status, audit.ipAddress ?? "", audit.userAgent ?? null, audit.requestId, JSON.stringify(input.metadata ?? {})]
    );
  }

  private mapRun(row: Record<string, unknown>): AiActionRun {
    const variables = row.variables && typeof row.variables === "object" && !Array.isArray(row.variables) ? (row.variables as Record<string, string>) : {};
    return {
      id: row.id as string,
      actionKey: row.action_key as string,
      module: row.module as string,
      capability: row.capability as string,
      templateKey: row.template_key as string,
      entityType: (row.entity_type as string | null) ?? null,
      entityId: (row.entity_id as string | null) ?? null,
      provider: row.provider as string,
      model: row.model as string,
      status: row.status as AiActionRun["status"],
      requiresReview: row.requires_review as boolean,
      reviewStatus: row.review_status as AiActionRun["reviewStatus"],
      output: row.output as string,
      resolvedPrompt: row.resolved_prompt as string,
      variables,
      promptTokens: row.prompt_tokens === null || row.prompt_tokens === undefined ? null : Number(row.prompt_tokens),
      completionTokens: row.completion_tokens === null || row.completion_tokens === undefined ? null : Number(row.completion_tokens),
      totalTokens: row.total_tokens === null || row.total_tokens === undefined ? null : Number(row.total_tokens),
      reviewedBy: (row.reviewed_by as string | null) ?? null,
      reviewedAt: row.reviewed_at ? (row.reviewed_at as Date).toISOString() : null,
      reviewNote: row.review_note as string,
      createdAt: (row.created_at as Date).toISOString(),
      createdBy: (row.created_by as string | null) ?? null
    };
  }

  listActions(actor: ActorContext, module?: string): AiActionCatalogResponse {
    const filtered = aiActionCatalog.filter((action) => !module || action.module === module);
    return {
      actions: filtered.map((action) => ({
        key: action.key,
        module: action.module,
        label: action.label,
        description: action.description,
        category: action.category,
        templateKey: action.templateKey,
        capability: action.capability,
        sensitive: action.sensitive,
        entityType: action.entityType,
        variables: action.variables,
        permitted: this.hasAny(actor, action.requiredPermissions)
      })),
      modules: Array.from(new Set(aiActionCatalog.map((action) => action.module)))
    };
  }

  async execute(actor: ActorContext, audit: AuditMetadata, actionKey: string, input: ExecuteAiActionRequestBody): Promise<AiActionExecuteResponse> {
    this.assertEnabled();
    const action = findAiAction(actionKey);
    if (!action) {
      throw new AppError(404, "The requested AI action was not found.", undefined, "AI_ACTION_NOT_FOUND");
    }
    // Rule 1: every AI action checks permission.
    if (!this.hasAny(actor, action.requiredPermissions)) {
      throw new AppError(403, `You do not have permission to run the ${action.label} action.`, undefined, "AUTHORIZATION_ERROR");
    }

    const variables: Record<string, string> = {};
    for (const [key, value] of Object.entries(input.variables ?? {})) {
      variables[key] = String(value);
    }

    // Rule 4: every AI action executes through the AI Gateway.
    // Rule 3: the gateway resolves the prompt from the managed Prompt Registry.
    const result = await this.gateway.execute(actor, audit, { templateKey: action.templateKey, variables });

    // Rule 5: sensitive actions require human review before use.
    const requiresReview = action.sensitive;
    const status = requiresReview ? "pending_review" : "completed";
    const reviewStatus = requiresReview ? "pending_review" : "not_required";

    const run = await this.databaseService.withTransaction(async (client) => {
      // Rule 2: log the request and response of every action.
      const inserted = await client.query(
        `INSERT INTO ai_action_runs (tenant_id, action_key, module, capability, template_key, entity_type, entity_id, provider, model, status, requires_review, review_status, output, resolved_prompt, variables, prompt_tokens, completion_tokens, total_tokens, metadata, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17, $18, $19::jsonb, $20, $20) RETURNING *`,
        [
          actor.tenantId,
          action.key,
          action.module,
          action.capability,
          action.templateKey,
          input.entityType ?? action.entityType,
          input.entityId ?? null,
          result.provider,
          result.model,
          status,
          requiresReview,
          reviewStatus,
          result.output,
          result.resolvedPrompt,
          JSON.stringify(variables),
          result.usage.promptTokens,
          result.usage.completionTokens,
          result.usage.totalTokens,
          JSON.stringify({ ...(input.metadata ?? {}), gatewayRequestId: result.requestId, placeholder: result.placeholder }),
          actor.userId
        ]
      );
      await this.recordAuditLog(client, actor, audit, { action: "ai.action.execute", resourceId: inserted.rows[0].id as string, status: "success", metadata: { actionKey: action.key, module: action.module, requiresReview } });
      return this.mapRun(inserted.rows[0]);
    });

    return { run, requiresReview };
  }

  async getRun(actor: ActorContext, runId: string): Promise<AiActionRunResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const result = await client.query(`SELECT * FROM ai_action_runs WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [runId, actor.tenantId]);
      if (!result.rows[0]) {
        throw new AppError(404, "The requested AI action run was not found.", undefined, "AI_ACTION_RUN_NOT_FOUND");
      }
      return { run: this.mapRun(result.rows[0]) };
    });
  }

  async listRuns(actor: ActorContext, query: AiActionRunListQuery): Promise<AiActionRunListResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const page = Math.max(1, query.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
      const conditions = ["tenant_id = $1"];
      const params: unknown[] = [actor.tenantId];
      if (query.module) {
        params.push(query.module);
        conditions.push(`module = $${params.length}`);
      }
      if (query.actionKey) {
        params.push(query.actionKey);
        conditions.push(`action_key = $${params.length}`);
      }
      if (query.status) {
        params.push(query.status);
        conditions.push(`status = $${params.length}`);
      }
      if (query.reviewStatus) {
        params.push(query.reviewStatus);
        conditions.push(`review_status = $${params.length}`);
      }
      const whereClause = conditions.join(" AND ");
      const countResult = await client.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM ai_action_runs WHERE ${whereClause}`, params);
      const total = Number(countResult.rows[0]?.total ?? "0");
      const listParams = [...params, pageSize, (page - 1) * pageSize];
      const listResult = await client.query(`SELECT * FROM ai_action_runs WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`, listParams);
      const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
      return {
        runs: listResult.rows.map((row) => this.mapRun(row)),
        pagination: { page, pageSize, total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 }
      };
    });
  }

  async reviewRun(actor: ActorContext, audit: AuditMetadata, runId: string, input: ReviewAiActionRunRequestBody): Promise<AiActionRunResponse> {
    this.assertEnabled();
    const run = await this.databaseService.withTransaction(async (client) => {
      const result = await client.query(`SELECT * FROM ai_action_runs WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [runId, actor.tenantId]);
      const row = result.rows[0];
      if (!row) {
        throw new AppError(404, "The requested AI action run was not found.", undefined, "AI_ACTION_RUN_NOT_FOUND");
      }
      const action = findAiAction(row.action_key as string);
      const reviewPermissions = action?.reviewPermissions ?? ["ai.approve", "ai.manage_ai"];
      if (!this.hasAny(actor, reviewPermissions)) {
        throw new AppError(403, "You do not have permission to review this AI action.", undefined, "AUTHORIZATION_ERROR");
      }
      if (row.review_status !== "pending_review") {
        throw new AppError(400, "This AI action run is not pending review.", undefined, "AI_ACTION_NOT_PENDING_REVIEW");
      }
      const reviewStatus = input.decision === "approved" ? "approved" : "rejected";
      await client.query(
        `UPDATE ai_action_runs SET review_status = $3, status = 'completed', reviewed_by = $4, reviewed_at = NOW(), review_note = $5, updated_by = $4 WHERE id = $1 AND tenant_id = $2`,
        [runId, actor.tenantId, reviewStatus, actor.userId, (input.note ?? "").trim()]
      );
      await this.recordAuditLog(client, actor, audit, { action: "ai.action.review", resourceId: runId, status: "success", metadata: { decision: reviewStatus } });
      const updated = await client.query(`SELECT * FROM ai_action_runs WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [runId, actor.tenantId]);
      return this.mapRun(updated.rows[0]);
    });
    return { run };
  }
}
