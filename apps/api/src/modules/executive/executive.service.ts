import type { PoolClient } from "pg";
import type {
  AssignInsightActionRequestBody,
  CommandCenterFilters,
  CreateStrategicRiskRequestBody,
  ExecutiveCommandCenterResponse,
  ExecutiveInsightsResponse,
  ExecutiveKpi,
  StrategicRiskSummary,
  StrategicRisksResponse,
  UpdateStrategicRiskRequestBody
} from "@crm/types";
import type { RoleSummary } from "@crm/types";
import {
  computeExecWinRate,
  computeRoi,
  computeWeightedForecast,
  detectExecutiveInsights,
  riskSources,
  strategicRiskSeverities,
  riskStatuses
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

function normalize<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return list.includes(value as T) ? (value as T) : fallback;
}

function trimmed(value: string | null | undefined): string | null {
  const next = value?.trim();
  return next && next.length > 0 ? next : null;
}

export class ExecutiveService {
  private readonly notificationService: NotificationService;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {
    this.notificationService = new NotificationService(databaseService, config);
  }

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "Executive analytics are unavailable until the database connection is enabled.", undefined, "EXECUTIVE_UNAVAILABLE");
    }
  }

  private async recordAuditLog(client: PoolClient, actor: ActorContext, audit: AuditMetadata, input: { action: string; resourceType: string; resourceId?: string | null; status: "success" | "failure"; metadata?: Record<string, unknown> }) {
    if (!this.config.enableAuditLogs) {
      return;
    }
    await client.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, event_type, action, resource_type, resource_id, status, ip_address, user_agent, metadata)
       VALUES ($1, $2, 'executive', $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [actor.tenantId, actor.userId, input.action, input.resourceType, input.resourceId ?? null, input.status, audit.ipAddress, audit.userAgent, JSON.stringify(input.metadata ?? {})]
    );
  }

  // ---- shared metric loader --------------------------------------------------------------------

  private async loadMetrics(client: PoolClient, tenantId: string, filters: CommandCenterFilters) {
    // Period filter on opportunity creation; region/product narrow via opportunity metadata.
    const oppConds = ["o.tenant_id = $1", "o.deleted_at IS NULL"];
    const params: unknown[] = [tenantId];
    if (filters.from) { params.push(filters.from); oppConds.push(`o.created_at >= $${params.length}::timestamptz`); }
    if (filters.to) { params.push(filters.to); oppConds.push(`o.created_at <= $${params.length}::timestamptz`); }
    if (filters.region) { params.push(filters.region); oppConds.push(`o.metadata->>'region' = $${params.length}`); }
    if (filters.product) { params.push(filters.product); oppConds.push(`o.metadata->>'product' = $${params.length}`); }
    if (filters.team) { params.push(filters.team); oppConds.push(`(SELECT team_id::text FROM users u WHERE u.id = o.owner_id AND u.tenant_id = o.tenant_id) = $${params.length}`); }

    const opps = await client.query<{ amount: string | null; probability: number | null; outcome_key: string | null; stage_key: string | null; source_key: string | null }>(
      `SELECT o.amount, o.probability, oc.value_key AS outcome_key, st.value_key AS stage_key, src.value_key AS source_key
       FROM opportunities o
       LEFT JOIN tenant_option_values oc ON oc.id = o.outcome_status_option_id AND oc.tenant_id = o.tenant_id
       LEFT JOIN tenant_option_values st ON st.id = o.stage_option_id AND st.tenant_id = o.tenant_id
       LEFT JOIN tenant_option_values src ON src.id = o.source_option_id AND src.tenant_id = o.tenant_id
       WHERE ${oppConds.join(" AND ")}`,
      params
    );

    let revenue = 0, pipeline = 0, wonCount = 0, lostCount = 0, partnerRevenue = 0;
    const forecastBuckets: Array<{ amount: number; probability: number }> = [];
    for (const row of opps.rows) {
      const amount = Number(row.amount ?? 0);
      if (row.outcome_key === "won") { revenue += amount; wonCount += 1; if (["partner", "reseller", "expansion"].includes(row.source_key ?? "")) partnerRevenue += amount; }
      else if (row.outcome_key === "lost") { lostCount += 1; }
      else { pipeline += amount; forecastBuckets.push({ amount, probability: row.probability ?? 20 }); }
    }

    const csAgg = await client.query<{ avg_health: string | null; total: string; at_risk: string; renewal_risk: string }>(
      `SELECT AVG(health_score) AS avg_health, COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE health_score IS NOT NULL AND health_score < 50)::text AS at_risk,
              COUNT(*) FILTER (WHERE renewal_date IS NOT NULL AND renewal_date <= NOW() + INTERVAL '90 days' AND health_score IS NOT NULL AND health_score < 60)::text AS renewal_risk
       FROM customer_success_accounts WHERE tenant_id = $1 AND deleted_at IS NULL`,
      [tenantId]
    );

    const sla = await client.query<{ total: string; breached: string }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE resolution_due_at IS NOT NULL AND COALESCE(resolved_at, NOW()) > resolution_due_at)::text AS breached
       FROM support_tickets WHERE tenant_id = $1 AND deleted_at IS NULL`,
      [tenantId]
    );

    const budget = await client.query<{ total_budget: string | null }>(`SELECT SUM(budget_amount) AS total_budget FROM campaigns WHERE tenant_id = $1 AND deleted_at IS NULL`, [tenantId]);
    const openRisks = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM strategic_risks WHERE tenant_id = $1 AND deleted_at IS NULL AND status IN ('open', 'monitoring')`, [tenantId]);

    const totalCustomers = Number(csAgg.rows[0]?.total ?? "0");
    const atRiskCustomers = Number(csAgg.rows[0]?.at_risk ?? "0");
    const slaTotal = Number(sla.rows[0]?.total ?? "0");
    const slaBreached = Number(sla.rows[0]?.breached ?? "0");
    const totalBudget = Number(budget.rows[0]?.total_budget ?? "0");

    return {
      revenue,
      pipeline,
      forecast: computeWeightedForecast(forecastBuckets),
      winRate: computeExecWinRate(wonCount, lostCount),
      campaignRoi: computeRoi(revenue, totalBudget),
      avgHealth: csAgg.rows[0]?.avg_health ? Math.round(Number(csAgg.rows[0].avg_health)) : null,
      totalCustomers,
      atRiskCustomers,
      renewalRisk: Number(csAgg.rows[0]?.renewal_risk ?? "0"),
      supportSlaPct: slaTotal > 0 ? Math.round(((slaTotal - slaBreached) / slaTotal) * 100) : 100,
      partnerRevenue,
      openStrategicRisks: Number(openRisks.rows[0]?.count ?? "0"),
      wonCount
    };
  }

  // ---- EXE-001: command center -----------------------------------------------------------------

  async getCommandCenter(actor: ActorContext, filters: CommandCenterFilters): Promise<ExecutiveCommandCenterResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const m = await this.loadMetrics(client, actor.tenantId, filters);
      const kpis: ExecutiveKpi[] = [
        { key: "revenue", label: "Revenue (won)", value: m.revenue, unit: "currency" },
        { key: "pipeline", label: "Open pipeline", value: m.pipeline, unit: "currency" },
        { key: "forecast", label: "Weighted forecast", value: m.forecast, unit: "currency" },
        { key: "win_rate", label: "Win rate", value: m.winRate, unit: "percent" },
        { key: "campaign_roi", label: "Campaign ROI", value: m.campaignRoi, unit: "percent" },
        { key: "customer_health", label: "Avg customer health", value: m.avgHealth, unit: "count" },
        { key: "renewal_risk", label: "Renewal risk accounts", value: m.renewalRisk, unit: "count" },
        { key: "support_sla", label: "Support SLA attainment", value: m.supportSlaPct, unit: "percent" },
        { key: "partner_revenue", label: "Partner revenue", value: m.partnerRevenue, unit: "currency" },
        { key: "strategic_risks", label: "Open strategic risks", value: m.openStrategicRisks, unit: "count" }
      ];
      return {
        filters,
        kpis,
        openStrategicRisks: m.openStrategicRisks,
        aiSummary: { available: false, message: "AI executive summary will connect with the governed AI Gateway; deterministic KPIs are shown meanwhile." }
      };
    });
  }

  // ---- EXE-002: AI business insights -----------------------------------------------------------

  async getInsights(actor: ActorContext, filters: CommandCenterFilters): Promise<ExecutiveInsightsResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const m = await this.loadMetrics(client, actor.tenantId, filters);
      // Coverage/attainment against simple derived targets (forecast is the near-term target proxy).
      const target = Math.max(1, m.forecast);
      const inactivePartners = (await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM partners p WHERE p.tenant_id = $1 AND p.deleted_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM partner_deal_registrations d WHERE d.partner_id = p.id AND d.tenant_id = p.tenant_id AND d.created_at > NOW() - INTERVAL '90 days')`,
        [actor.tenantId]
      ).catch(() => ({ rows: [{ count: "0" }] }))).rows[0]?.count ?? "0";

      const insights = detectExecutiveInsights({
        pipelineCoverage: m.pipeline / target,
        forecastAttainment: m.forecast / target,
        atRiskCustomers: m.atRiskCustomers,
        totalCustomers: m.totalCustomers,
        quotaAttainment: m.revenue / target,
        campaignRoi: m.campaignRoi,
        inactivePartners: Number(inactivePartners)
      });
      return { insights, aiPlaceholder: { available: false, message: "AI insight narration will connect with the governed AI Gateway; deterministic signals are shown meanwhile." } };
    });
  }

  async assignInsightAction(actor: ActorContext, audit: AuditMetadata, input: AssignInsightActionRequestBody) {
    this.assertEnabled();
    if (!input.title?.trim() || !input.assignedTo) {
      throw new AppError(400, "An action title and an assignee are required.", undefined, "VALIDATION_ERROR");
    }
    return this.databaseService.withTransaction(async (client) => {
      const assignee = await client.query<{ id: string }>(`SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL AND status IN ('active','invited') LIMIT 1`, [input.assignedTo, actor.tenantId]);
      if (assignee.rowCount === 0) {
        throw new AppError(400, "The selected leader is invalid for this tenant.", undefined, "INVALID_ASSIGNEE");
      }
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO executive_insight_actions (tenant_id, insight_key, title, description, assigned_to, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`,
        [actor.tenantId, trimmed(input.insightKey) ?? "manual", input.title.trim(), trimmed(input.description), input.assignedTo, actor.userId]
      );
      if (input.assignedTo !== actor.userId) {
        await this.notificationService.createNotificationWithClient(client, actor, audit, { notificationType: "record_assignment", recipientUserId: input.assignedTo, title: `Executive action: ${input.title.trim()}`, message: trimmed(input.description) ?? "An executive insight action was assigned to you.", linkedRecord: { entityType: "executive_insight_action", entityId: inserted.rows[0].id } });
      }
      await this.recordAuditLog(client, actor, audit, { action: "executive.insight.assign", resourceType: "executive_insight_action", resourceId: inserted.rows[0].id, status: "success", metadata: { insightKey: input.insightKey, assignedTo: input.assignedTo } });
      return { actionId: inserted.rows[0].id };
    });
  }

  // ---- EXE-003: strategic risk register --------------------------------------------------------

  private mapRisk(row: { id: string; title: string; source: string; owner_id: string | null; severity: string; impact: string | null; mitigation: string | null; due_date: string | null; status: string; created_at: Date; updated_at: Date }): StrategicRiskSummary {
    return {
      id: row.id,
      title: row.title,
      source: normalize(riskSources, row.source, "manual"),
      ownerId: row.owner_id,
      severity: normalize(strategicRiskSeverities, row.severity, "medium"),
      impact: row.impact,
      mitigation: row.mitigation,
      dueDate: row.due_date,
      status: normalize(riskStatuses, row.status, "open"),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  async listRisks(actor: ActorContext): Promise<StrategicRisksResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const result = await client.query(
        `SELECT id, title, source, owner_id, severity, impact, mitigation, due_date, status, created_at, updated_at
         FROM strategic_risks WHERE tenant_id = $1 AND deleted_at IS NULL
         ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at DESC LIMIT 200`,
        [actor.tenantId]
      );
      const risks = result.rows.map((row) => this.mapRisk(row));
      return { risks, openCount: risks.filter((r) => r.status === "open" || r.status === "monitoring").length };
    });
  }

  async createRisk(actor: ActorContext, audit: AuditMetadata, input: CreateStrategicRiskRequestBody): Promise<StrategicRisksResponse> {
    this.assertEnabled();
    if (!input.title?.trim()) {
      throw new AppError(400, "A risk title is required.", undefined, "VALIDATION_ERROR");
    }
    if (!input.ownerId) {
      throw new AppError(400, "A risk owner is required.", undefined, "VALIDATION_ERROR");
    }
    await this.databaseService.withTransaction(async (client) => {
      const owner = await client.query<{ id: string }>(`SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [input.ownerId, actor.tenantId]);
      if (owner.rowCount === 0) {
        throw new AppError(400, "The selected risk owner is invalid for this tenant.", undefined, "INVALID_OWNER");
      }
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO strategic_risks (tenant_id, title, source, source_entity_type, source_entity_id, owner_id, severity, impact, mitigation, due_date, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date, $11, $11) RETURNING id`,
        [actor.tenantId, input.title.trim(), normalize(riskSources, input.source, "manual"), trimmed(input.sourceEntityType), input.sourceEntityId ?? null, input.ownerId, normalize(strategicRiskSeverities, input.severity, "medium"), trimmed(input.impact), trimmed(input.mitigation), trimmed(input.dueDate), actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "executive.risk.create", resourceType: "strategic_risk", resourceId: inserted.rows[0].id, status: "success", metadata: { source: input.source, severity: input.severity } });
    });
    return this.listRisks(actor);
  }

  async updateRisk(actor: ActorContext, audit: AuditMetadata, riskId: string, input: UpdateStrategicRiskRequestBody): Promise<StrategicRisksResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      const existing = await client.query<{ id: string }>(`SELECT id FROM strategic_risks WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [riskId, actor.tenantId]);
      if (existing.rowCount === 0) {
        throw new AppError(404, "Strategic risk not found.", undefined, "NOT_FOUND");
      }
      const sets: string[] = [];
      const params: unknown[] = [riskId, actor.tenantId];
      const push = (value: unknown) => { params.push(value); return `$${params.length}`; };
      if (input.ownerId !== undefined) sets.push(`owner_id = ${push(input.ownerId)}`);
      if (input.severity !== undefined) sets.push(`severity = ${push(normalize(strategicRiskSeverities, input.severity, "medium"))}`);
      if (input.impact !== undefined) sets.push(`impact = ${push(trimmed(input.impact))}`);
      if (input.mitigation !== undefined) sets.push(`mitigation = ${push(trimmed(input.mitigation))}`);
      if (input.dueDate !== undefined) sets.push(`due_date = ${push(trimmed(input.dueDate))}::date`);
      if (input.status !== undefined) sets.push(`status = ${push(normalize(riskStatuses, input.status, "open"))}`);
      if (sets.length === 0) {
        throw new AppError(400, "No fields to update.", undefined, "VALIDATION_ERROR");
      }
      sets.push(`updated_by = ${push(actor.userId)}`);
      await client.query(`UPDATE strategic_risks SET ${sets.join(", ")} WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, params);
      await this.recordAuditLog(client, actor, audit, { action: "executive.risk.update", resourceType: "strategic_risk", resourceId: riskId, status: "success", metadata: { status: input.status } });
    });
    return this.listRisks(actor);
  }
}
