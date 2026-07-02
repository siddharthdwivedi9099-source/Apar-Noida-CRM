import type { PoolClient } from "pg";
import type {
  AiFeedbackSummary,
  AiImprovementTaskSummary,
  AiQualityDashboardResponse,
  AiUseCaseDecisionRequestBody,
  AiUseCaseResponse,
  AiUseCasesResponse,
  AiUseCaseSummary,
  CreateImprovementTaskRequestBody,
  RecordAiFeedbackRequestBody,
  UpsertAiUseCaseRequestBody
} from "@crm/types";
import {
  aiFeedbackRatings,
  aiRiskLevels,
  aiUseCaseActionTypes,
  aiUseCaseApprovalStatuses,
  computeAiQuality,
  requiresUseCaseApproval
} from "@crm/types";
import { AppError } from "../../common/errors/app-error.js";
import { DatabaseService } from "../../platform/database/database.service.js";

interface ActorContext {
  userId: string;
  tenantId: string;
  email: string;
  displayName: string;
  permissionCodes: string[];
}

interface AuditMetadata {
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

function normalize<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return list.includes(value as T) ? (value as T) : fallback;
}

function trimmed(value: string | null | undefined): string | null {
  const next = value?.trim();
  return next && next.length > 0 ? next : null;
}

interface UseCaseRow {
  id: string;
  name: string;
  owner_id: string | null;
  object_type: string | null;
  persona: string | null;
  data_used: string | null;
  action_type: string;
  risk_level: string;
  approval_status: string;
  model: string | null;
  prompt: string | null;
  monitoring_plan: string | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

export class AiGovernanceService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {}

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "AI governance is unavailable until the database connection is enabled.", undefined, "AI_GOVERNANCE_UNAVAILABLE");
    }
  }

  private async recordAuditLog(client: PoolClient, actor: ActorContext, audit: AuditMetadata, input: { action: string; resourceType: string; resourceId?: string | null; status: "success" | "failure"; metadata?: Record<string, unknown> }) {
    if (!this.config.enableAuditLogs) {
      return;
    }
    await client.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, event_type, action, resource_type, resource_id, status, ip_address, user_agent, metadata)
       VALUES ($1, $2, 'ai', $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [actor.tenantId, actor.userId, input.action, input.resourceType, input.resourceId ?? null, input.status, audit.ipAddress, audit.userAgent, JSON.stringify(input.metadata ?? {})]
    );
  }

  private mapUseCase(row: UseCaseRow): AiUseCaseSummary {
    const riskLevel = normalize(aiRiskLevels, row.risk_level, "low");
    return {
      id: row.id,
      name: row.name,
      ownerId: row.owner_id,
      objectType: row.object_type,
      persona: row.persona,
      dataUsed: row.data_used,
      actionType: normalize(aiUseCaseActionTypes, row.action_type, "assist"),
      riskLevel,
      approvalStatus: normalize(aiUseCaseApprovalStatuses, row.approval_status, "draft"),
      model: row.model,
      prompt: row.prompt,
      monitoringPlan: row.monitoring_plan,
      version: row.version,
      requiresApproval: requiresUseCaseApproval(riskLevel),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private useCaseSelect() {
    return `id, name, owner_id, object_type, persona, data_used, action_type, risk_level, approval_status, model, prompt, monitoring_plan, version, created_at, updated_at`;
  }

  // ---- AIG-001: AI use-case registry -----------------------------------------------------------

  async listUseCases(actor: ActorContext): Promise<AiUseCasesResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const result = await client.query<UseCaseRow>(`SELECT ${this.useCaseSelect()} FROM ai_use_cases WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 200`, [actor.tenantId]);
      return { useCases: result.rows.map((row) => this.mapUseCase(row)) };
    });
  }

  private async loadUseCaseResponse(client: PoolClient, tenantId: string, id: string): Promise<AiUseCaseResponse> {
    const row = (await client.query<UseCaseRow>(`SELECT ${this.useCaseSelect()} FROM ai_use_cases WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [id, tenantId])).rows[0];
    if (!row) {
      throw new AppError(404, "AI use case not found.", undefined, "NOT_FOUND");
    }
    const versions = await client.query<{ id: string; version: number; change_reason: string | null; created_at: Date }>(
      `SELECT id, version, change_reason, created_at FROM ai_use_case_versions WHERE tenant_id = $1 AND use_case_id = $2 ORDER BY version DESC LIMIT 50`,
      [tenantId, id]
    );
    return { useCase: this.mapUseCase(row), versions: versions.rows.map((v) => ({ id: v.id, version: v.version, changeReason: v.change_reason, createdAt: v.created_at.toISOString() })) };
  }

  async getUseCase(actor: ActorContext, id: string): Promise<AiUseCaseResponse> {
    this.assertEnabled();
    return this.databaseService.withClient((client) => this.loadUseCaseResponse(client, actor.tenantId, id));
  }

  async createUseCase(actor: ActorContext, audit: AuditMetadata, input: UpsertAiUseCaseRequestBody): Promise<AiUseCaseResponse> {
    this.assertEnabled();
    const name = input.name?.trim();
    if (!name) {
      throw new AppError(400, "A use-case name is required.", undefined, "VALIDATION_ERROR");
    }
    const riskLevel = normalize(aiRiskLevels, input.riskLevel, "low");
    // AIG-001: high-risk use cases cannot go live without approval, so they start pending.
    const approvalStatus = requiresUseCaseApproval(riskLevel) ? "pending_approval" : "draft";
    return this.databaseService.withTransaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO ai_use_cases (tenant_id, name, owner_id, object_type, persona, data_used, action_type, risk_level, approval_status, model, prompt, monitoring_plan, version, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1, $13, $13) RETURNING id`,
        [actor.tenantId, name, input.ownerId ?? null, trimmed(input.objectType), trimmed(input.persona), trimmed(input.dataUsed), normalize(aiUseCaseActionTypes, input.actionType, "assist"), riskLevel, approvalStatus, trimmed(input.model), trimmed(input.prompt), trimmed(input.monitoringPlan), actor.userId]
      );
      const id = inserted.rows[0].id;
      await this.writeVersion(client, actor, id, 1, input.changeReason ?? "Initial version");
      await this.recordAuditLog(client, actor, audit, { action: "ai.use_case.create", resourceType: "ai_use_case", resourceId: id, status: "success", metadata: { riskLevel, approvalStatus } });
      return this.loadUseCaseResponse(client, actor.tenantId, id);
    });
  }

  private async writeVersion(client: PoolClient, actor: ActorContext, useCaseId: string, version: number, changeReason: string | null) {
    const row = (await client.query<UseCaseRow>(`SELECT ${this.useCaseSelect()} FROM ai_use_cases WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [useCaseId, actor.tenantId])).rows[0];
    await client.query(
      `INSERT INTO ai_use_case_versions (tenant_id, use_case_id, version, change_reason, snapshot, created_by) VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [actor.tenantId, useCaseId, version, trimmed(changeReason), JSON.stringify(this.mapUseCase(row)), actor.userId]
    );
  }

  async updateUseCase(actor: ActorContext, audit: AuditMetadata, id: string, input: UpsertAiUseCaseRequestBody): Promise<AiUseCaseResponse> {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      const current = (await client.query<{ version: number; risk_level: string }>(`SELECT version, risk_level FROM ai_use_cases WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [id, actor.tenantId])).rows[0];
      if (!current) {
        throw new AppError(404, "AI use case not found.", undefined, "NOT_FOUND");
      }
      const riskLevel = normalize(aiRiskLevels, input.riskLevel, normalize(aiRiskLevels, current.risk_level, "low"));
      // A high-risk change re-enters approval; the new version increments (AIG-001 "changes versioned").
      const approvalStatus = requiresUseCaseApproval(riskLevel) ? "pending_approval" : "draft";
      const nextVersion = current.version + 1;
      await client.query(
        `UPDATE ai_use_cases SET name = COALESCE($3, name), owner_id = $4, object_type = $5, persona = $6, data_used = $7, action_type = $8, risk_level = $9, approval_status = $10, model = $11, prompt = $12, monitoring_plan = $13, version = $14, approved_by = NULL, approved_at = NULL, updated_by = $15 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [id, actor.tenantId, input.name?.trim() || null, input.ownerId ?? null, trimmed(input.objectType), trimmed(input.persona), trimmed(input.dataUsed), normalize(aiUseCaseActionTypes, input.actionType, "assist"), riskLevel, approvalStatus, trimmed(input.model), trimmed(input.prompt), trimmed(input.monitoringPlan), nextVersion, actor.userId]
      );
      await this.writeVersion(client, actor, id, nextVersion, input.changeReason ?? `Updated to v${nextVersion}`);
      await this.recordAuditLog(client, actor, audit, { action: "ai.use_case.update", resourceType: "ai_use_case", resourceId: id, status: "success", metadata: { version: nextVersion, riskLevel } });
      return this.loadUseCaseResponse(client, actor.tenantId, id);
    });
  }

  async decideUseCase(actor: ActorContext, audit: AuditMetadata, id: string, input: AiUseCaseDecisionRequestBody): Promise<AiUseCaseResponse> {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      const current = (await client.query<{ approval_status: string; risk_level: string }>(`SELECT approval_status, risk_level FROM ai_use_cases WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [id, actor.tenantId])).rows[0];
      if (!current) {
        throw new AppError(404, "AI use case not found.", undefined, "NOT_FOUND");
      }
      let nextStatus: string;
      if (input.decision === "submit") {
        nextStatus = "pending_approval";
      } else if (input.decision === "approve") {
        if (current.approval_status !== "pending_approval") throw new AppError(409, "Only a use case pending approval can be approved.", undefined, "INVALID_STATE");
        nextStatus = "approved";
      } else if (input.decision === "reject") {
        if (current.approval_status !== "pending_approval") throw new AppError(409, "Only a use case pending approval can be rejected.", undefined, "INVALID_STATE");
        nextStatus = "rejected";
      } else {
        throw new AppError(400, "Invalid decision.", undefined, "VALIDATION_ERROR");
      }
      if (input.decision === "approve") {
        await client.query(`UPDATE ai_use_cases SET approval_status = $3, approved_by = $4, approved_at = NOW(), updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [id, actor.tenantId, nextStatus, actor.userId]);
      } else {
        await client.query(`UPDATE ai_use_cases SET approval_status = $3, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [id, actor.tenantId, nextStatus, actor.userId]);
      }
      await this.recordAuditLog(client, actor, audit, { action: `ai.use_case.${input.decision}`, resourceType: "ai_use_case", resourceId: id, status: "success", metadata: { from: current.approval_status, to: nextStatus, note: trimmed(input.note) } });
      return this.loadUseCaseResponse(client, actor.tenantId, id);
    });
  }

  // ---- AIG-003 / AIG-004: AI feedback ----------------------------------------------------------

  async recordFeedback(actor: ActorContext, audit: AuditMetadata, input: RecordAiFeedbackRequestBody) {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO ai_feedback (tenant_id, run_id, use_case_id, entity_type, entity_id, rating, is_hallucination, confidence_flag, comment, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [actor.tenantId, input.runId ?? null, input.useCaseId ?? null, trimmed(input.entityType), input.entityId ?? null, normalize(aiFeedbackRatings, input.rating, "neutral"), Boolean(input.isHallucination), input.confidenceFlag === "low" ? "low" : "normal", trimmed(input.comment), actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "ai.feedback.record", resourceType: "ai_feedback", resourceId: inserted.rows[0].id, status: "success", metadata: { rating: input.rating, isHallucination: Boolean(input.isHallucination) } });
      return { feedbackId: inserted.rows[0].id };
    });
  }

  // ---- AIG-005: AI quality dashboard -----------------------------------------------------------

  async getQualityDashboard(actor: ActorContext): Promise<AiQualityDashboardResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const runs = await client.query<{ review_status: string; requires_review: boolean; metadata: Record<string, unknown> | null }>(
        `SELECT review_status, requires_review, metadata FROM ai_action_runs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 500`,
        [actor.tenantId]
      );
      const feedback = await client.query<{ id: string; run_id: string | null; rating: string; is_hallucination: boolean; confidence_flag: string; comment: string | null; created_at: Date }>(
        `SELECT id, run_id, rating, is_hallucination, confidence_flag, comment, created_at FROM ai_feedback WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200`,
        [actor.tenantId]
      );
      const tasks = await client.query<{ id: string; source: string; title: string; status: string; created_at: Date }>(
        `SELECT id, source, title, status, created_at FROM ai_improvement_tasks WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [actor.tenantId]
      );

      const quality = computeAiQuality(
        runs.rows.map((row) => {
          const meta = (row.metadata ?? {}) as Record<string, unknown>;
          return {
            reviewStatus: normalize(["not_required", "pending_review", "approved", "rejected"] as const, row.review_status, "not_required"),
            requiresReview: row.requires_review,
            confidence: typeof meta.confidence === "number" ? (meta.confidence as number) : null,
            responseMs: typeof meta.responseMs === "number" ? (meta.responseMs as number) : typeof meta.latencyMs === "number" ? (meta.latencyMs as number) : null
          };
        }),
        feedback.rows.map((row) => ({ rating: normalize(aiFeedbackRatings, row.rating, "neutral"), isHallucination: row.is_hallucination }))
      );

      const recentFeedback: AiFeedbackSummary[] = feedback.rows.slice(0, 10).map((row) => ({ id: row.id, runId: row.run_id, rating: normalize(aiFeedbackRatings, row.rating, "neutral"), isHallucination: row.is_hallucination, confidenceFlag: row.confidence_flag === "low" ? "low" : "normal", comment: row.comment, createdAt: row.created_at.toISOString() }));
      const improvementTasks: AiImprovementTaskSummary[] = tasks.rows.map((row) => ({ id: row.id, source: normalize(["feedback", "hallucination", "quality", "override"] as const, row.source, "quality"), title: row.title, status: normalize(["open", "in_progress", "done"] as const, row.status, "open"), createdAt: row.created_at.toISOString() }));

      return { quality, recentFeedback, improvementTasks };
    });
  }

  async createImprovementTask(actor: ActorContext, audit: AuditMetadata, input: CreateImprovementTaskRequestBody) {
    this.assertEnabled();
    const title = input.title?.trim();
    if (!title) {
      throw new AppError(400, "An improvement task title is required.", undefined, "VALIDATION_ERROR");
    }
    return this.databaseService.withTransaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO ai_improvement_tasks (tenant_id, use_case_id, feedback_id, source, title, description, owner_id, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8) RETURNING id`,
        [actor.tenantId, input.useCaseId ?? null, input.feedbackId ?? null, normalize(["feedback", "hallucination", "quality", "override"] as const, input.source, "quality"), title, trimmed(input.description), input.ownerId ?? null, actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "ai.improvement_task.create", resourceType: "ai_improvement_task", resourceId: inserted.rows[0].id, status: "success" });
      return { taskId: inserted.rows[0].id };
    });
  }
}
