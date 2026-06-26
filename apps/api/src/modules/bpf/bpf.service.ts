import {
  computeBpfStageAging,
  getBpfAllowedNextStages,
  getBpfEntryStage,
  getBpfStage,
  validateBpfTransition,
  type BpfStateView,
  type BpfStageView,
  type BusinessProcessFlowPayload,
  type RoleSummary
} from "@crm/types";
import type { PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import { DatabaseService } from "../../platform/database/database.service.js";

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

interface BpfServiceConfig {
  enableAuditLogs: boolean;
}

// CRM object -> RBAC module for permission gating.
const OBJECT_MODULE: Record<string, string> = {
  lead: "leads",
  opportunity: "opportunities",
  campaign: "campaigns",
  partner: "partners",
  support_ticket: "support",
  customer_success: "customer_success"
};

interface TransitionInput {
  toStage: string;
  reason?: string | null;
  overrideReason?: string | null;
  isManagerOverride?: boolean;
  record?: Record<string, unknown>;
}

interface BpfRow {
  definition_key: string;
  name: string;
  definition: BusinessProcessFlowPayload;
}

export class BpfService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: BpfServiceConfig
  ) {}

  private ensureEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "BPF runtime is unavailable until the database connection is enabled.", undefined, "BPF_UNAVAILABLE");
    }
  }

  private assertPermission(actor: ActorContext, object: string, action: "view" | "edit") {
    const moduleKey = OBJECT_MODULE[object];
    if (!moduleKey) {
      throw new AppError(404, `No business process flow is configured for object "${object}".`, undefined, "BPF_UNKNOWN_OBJECT");
    }
    const allowed = [`${moduleKey}.${action}`, `${moduleKey}.configure`, "admin.configure"];
    if (!actor.permissionCodes.some((code) => allowed.includes(code))) {
      throw new AppError(403, "You do not have permission for this object's process flow.", undefined, "FORBIDDEN");
    }
  }

  private async loadBpf(client: PoolClient, tenantId: string, object: string): Promise<BpfRow> {
    const result = await client.query<BpfRow>(
      `SELECT definition_key, name, definition
       FROM configuration_definitions
       WHERE tenant_id = $1 AND definition_type = 'business_process_flow'
         AND is_active = true AND deleted_at IS NULL
         AND definition->>'object' = $2
       ORDER BY updated_at DESC
       LIMIT 1`,
      [tenantId, object]
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, `No business process flow is configured for object "${object}".`, undefined, "BPF_NOT_CONFIGURED");
    }
    return row;
  }

  private buildStateView(bpf: BpfRow, currentStage: string, enteredAt: string | null, initialized: boolean): BpfStateView {
    const payload = bpf.definition;
    const stages = [...(payload.stages ?? [])].sort((a, b) => a.order - b.order);
    const currentOrder = getBpfStage(payload, currentStage)?.order ?? 0;
    const stageViews: BpfStageView[] = stages.map((stage) => ({
      key: stage.key,
      label: stage.label ?? stage.key,
      order: stage.order,
      isEntry: stage.isEntry === true,
      isTerminal: stage.isTerminal === true,
      requiredFields: stage.requiredFields ?? [],
      status: stage.key === currentStage ? "current" : stage.order < currentOrder ? "done" : "upcoming"
    }));
    const currentStageDef = getBpfStage(payload, currentStage);
    const aging = currentStageDef && enteredAt
      ? computeBpfStageAging(currentStageDef, enteredAt, new Date().toISOString())
      : { ageHours: 0, slaStatus: "none" as const, aging: false };

    return {
      object: payload.object,
      recordId: "",
      bpfKey: bpf.definition_key,
      bpfName: bpf.name,
      currentStage,
      enteredAt,
      initialized,
      stages: stageViews,
      allowedNextStages: getBpfAllowedNextStages(payload, currentStage),
      aging
    };
  }

  async getStateView(actor: ActorContext, object: string, recordId: string): Promise<BpfStateView> {
    this.ensureEnabled();
    this.assertPermission(actor, object, "view");
    return this.databaseService.withClient(async (client) => {
      const bpf = await this.loadBpf(client, actor.tenantId, object);
      const stateResult = await client.query<{ current_stage: string; entered_at: Date }>(
        `SELECT current_stage, entered_at FROM bpf_record_state
         WHERE tenant_id = $1 AND object = $2 AND record_id = $3 AND bpf_key = $4 AND deleted_at IS NULL`,
        [actor.tenantId, object, recordId, bpf.definition_key]
      );
      const state = stateResult.rows[0];
      if (state) {
        const view = this.buildStateView(bpf, state.current_stage, new Date(state.entered_at).toISOString(), true);
        view.recordId = recordId;
        return view;
      }
      const entry = getBpfEntryStage(bpf.definition);
      const view = this.buildStateView(bpf, entry?.key ?? "", null, false);
      view.recordId = recordId;
      return view;
    });
  }

  async getHistory(actor: ActorContext, object: string, recordId: string) {
    this.ensureEnabled();
    this.assertPermission(actor, object, "view");
    return this.databaseService.withClient(async (client) => {
      const bpf = await this.loadBpf(client, actor.tenantId, object);
      const result = await client.query(
        `SELECT from_stage, to_stage, reason, override_reason, is_backward, is_override, changed_by, created_at
         FROM bpf_stage_history
         WHERE tenant_id = $1 AND object = $2 AND record_id = $3 AND bpf_key = $4
         ORDER BY created_at DESC`,
        [actor.tenantId, object, recordId, bpf.definition_key]
      );
      return {
        bpfKey: bpf.definition_key,
        history: result.rows.map((row) => ({
          fromStage: row.from_stage as string | null,
          toStage: row.to_stage as string,
          reason: row.reason as string | null,
          overrideReason: row.override_reason as string | null,
          isBackward: row.is_backward as boolean,
          isOverride: row.is_override as boolean,
          changedBy: row.changed_by as string | null,
          createdAt: new Date(row.created_at as string).toISOString()
        }))
      };
    });
  }

  async transition(actor: ActorContext, audit: AuditMetadata, object: string, recordId: string, input: TransitionInput): Promise<BpfStateView> {
    this.ensureEnabled();
    this.assertPermission(actor, object, "edit");
    return this.databaseService.withTransaction(async (client) => {
      const bpf = await this.loadBpf(client, actor.tenantId, object);
      const stateResult = await client.query<{ current_stage: string }>(
        `SELECT current_stage FROM bpf_record_state
         WHERE tenant_id = $1 AND object = $2 AND record_id = $3 AND bpf_key = $4 AND deleted_at IS NULL`,
        [actor.tenantId, object, recordId, bpf.definition_key]
      );
      const fromStage = stateResult.rows[0]?.current_stage ?? null;

      const validation = validateBpfTransition(bpf.definition, {
        fromStage,
        toStage: input.toStage,
        record: input.record,
        reason: input.reason,
        overrideReason: input.overrideReason,
        isManagerOverride: input.isManagerOverride
      });

      if (!validation.allowed) {
        const summary = validation.issues[0]?.message ?? "Stage transition is not permitted.";
        throw new AppError(422, summary, { issues: validation.issues }, "BPF_TRANSITION_INVALID");
      }

      await client.query(
        `INSERT INTO bpf_record_state (tenant_id, object, record_id, bpf_key, current_stage, entered_at, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6, $6)
         ON CONFLICT (tenant_id, object, record_id, bpf_key) DO UPDATE SET
           current_stage = EXCLUDED.current_stage, entered_at = NOW(), deleted_at = NULL, updated_by = $6, updated_at = NOW()`,
        [actor.tenantId, object, recordId, bpf.definition_key, input.toStage, actor.userId]
      );

      await client.query(
        `INSERT INTO bpf_stage_history
           (tenant_id, object, record_id, bpf_key, from_stage, to_stage, reason, override_reason, is_backward, is_override, changed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          actor.tenantId, object, recordId, bpf.definition_key, fromStage, input.toStage,
          input.reason?.trim() || null, input.overrideReason?.trim() || null,
          validation.isBackward, validation.isOverride, actor.userId
        ]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "bpf.stage_changed",
        resourceId: recordId,
        metadata: { object, bpfKey: bpf.definition_key, fromStage, toStage: input.toStage, isBackward: validation.isBackward, isOverride: validation.isOverride }
      });

      const view = this.buildStateView(bpf, input.toStage, new Date().toISOString(), true);
      view.recordId = recordId;
      return view;
    });
  }

  private async recordAuditLog(
    client: PoolClient,
    actor: ActorContext,
    audit: AuditMetadata,
    input: { action: string; resourceId: string; metadata?: Record<string, unknown> }
  ) {
    if (!this.config.enableAuditLogs) {
      return;
    }
    await client.query(
      `INSERT INTO audit_logs (
         tenant_id, actor_user_id, session_id, event_type, action, resource_type,
         resource_id, status, ip_address, user_agent, request_id, metadata
       )
       VALUES ($1, $2, $3, 'bpf', $4, 'bpf_record_state', $5, 'success', NULLIF($6, '')::inet, $7, $8, $9::jsonb)`,
      [
        actor.tenantId, actor.userId, actor.sessionId, input.action, input.resourceId,
        audit.ipAddress ?? "", audit.userAgent ?? null, audit.requestId, JSON.stringify(input.metadata ?? {})
      ]
    );
  }
}
