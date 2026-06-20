import {
  dashboardCatalog,
  findDashboard,
  type CreateDashboardViewRequestBody,
  type DashboardCatalogResponse,
  type DashboardDataResponse,
  type DashboardDrilldownResponse,
  type DashboardExportResponse,
  type DashboardSavedView,
  type DashboardSavedViewListResponse,
  type DashboardSavedViewResponse,
  type DashboardWidgetData,
  type DashboardWidgetDataKind,
  type RoleSummary,
  type UpdateDashboardViewRequestBody
} from "@crm/types";
import type { PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { CacheService } from "../../platform/cache/cache.service.js";

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

interface MetricContext {
  tenantId: string;
  from: string | null;
  to: string | null;
}

interface MetricResult {
  kind: DashboardWidgetDataKind;
  value?: number | null;
  unit?: string | null;
  breakdown?: Array<{ label: string; value: number }>;
  series?: Array<{ label: string; value: number }>;
  rows?: Array<Record<string, unknown>>;
  note?: string | null;
}

export interface DashboardConfig {
  enableAuditLogs: boolean;
}

const DRILLDOWN_METRICS = new Set(["leads_by_status", "lead_source", "opportunities_by_stage", "open_tickets", "at_risk_customers", "customer_risk_summary", "deal_risk_summary"]);

export class DashboardService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: DashboardConfig,
    private readonly cacheService: CacheService
  ) {}

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "Dashboards are unavailable until the database connection is enabled.", undefined, "DASHBOARDS_UNAVAILABLE");
    }
  }

  private hasAny(actor: ActorContext, permissions: string[]) {
    return permissions.some((code) => actor.permissionCodes.includes(code));
  }

  private requirePermission(actor: ActorContext, permissions: string[], message: string) {
    if (!this.hasAny(actor, permissions)) {
      throw new AppError(403, message, undefined, "AUTHORIZATION_ERROR");
    }
  }

  // -------------------------------------------------------------------------
  // Catalog
  // -------------------------------------------------------------------------

  listDashboards(actor: ActorContext): DashboardCatalogResponse {
    return {
      dashboards: dashboardCatalog.map((dashboard) => ({
        key: dashboard.key,
        name: dashboard.name,
        category: dashboard.category,
        description: dashboard.description,
        widgetCount: dashboard.widgets.length,
        permitted: this.hasAny(actor, dashboard.requiredPermissions)
      })),
      categories: Array.from(new Set(dashboardCatalog.map((dashboard) => dashboard.category)))
    };
  }

  // -------------------------------------------------------------------------
  // Metric helpers
  // -------------------------------------------------------------------------

  private dateConditions(ctx: MetricContext, alias: string, column: string, startIndex: number): { clause: string; params: unknown[] } {
    const params: unknown[] = [];
    const parts: string[] = [];
    if (ctx.from) {
      params.push(ctx.from);
      parts.push(`${alias}.${column} >= $${startIndex + params.length}::date`);
    }
    if (ctx.to) {
      params.push(ctx.to);
      parts.push(`${alias}.${column} < ($${startIndex + params.length}::date + INTERVAL '1 day')`);
    }
    return { clause: parts.length ? ` AND ${parts.join(" AND ")}` : "", params };
  }

  private async optionBreakdown(client: PoolClient, ctx: MetricContext, table: string, optionColumn: string): Promise<Array<{ label: string; value: number }>> {
    const date = this.dateConditions(ctx, "t", "created_at", 1);
    const result = await client.query<{ label: string; value: number }>(
      `SELECT COALESCE(ov.label, 'Unknown') AS label, COUNT(*)::int AS value
       FROM ${table} t
       LEFT JOIN tenant_option_values ov ON ov.id = t.${optionColumn} AND ov.tenant_id = t.tenant_id
       WHERE t.tenant_id = $1 AND t.deleted_at IS NULL${date.clause}
       GROUP BY ov.label ORDER BY value DESC`,
      [ctx.tenantId, ...date.params]
    );
    return result.rows.map((row) => ({ label: row.label, value: Number(row.value) }));
  }

  private async scalarCount(client: PoolClient, ctx: MetricContext, table: string, extraWhere = ""): Promise<number> {
    const date = this.dateConditions(ctx, "t", "created_at", 1);
    const result = await client.query<{ value: number }>(
      `SELECT COUNT(*)::int AS value FROM ${table} t WHERE t.tenant_id = $1 AND t.deleted_at IS NULL${extraWhere ? ` AND ${extraWhere}` : ""}${date.clause}`,
      [ctx.tenantId, ...date.params]
    );
    return Number(result.rows[0]?.value ?? 0);
  }

  private async computeMetric(client: PoolClient, ctx: MetricContext, metricKey: string): Promise<MetricResult> {
    switch (metricKey) {
      case "leads_by_status":
        return { kind: "breakdown", breakdown: await this.optionBreakdown(client, ctx, "leads", "status_option_id") };
      case "lead_source":
        return { kind: "breakdown", breakdown: await this.optionBreakdown(client, ctx, "leads", "source_option_id") };
      case "opportunities_by_stage":
        return { kind: "funnel", breakdown: await this.optionBreakdown(client, ctx, "opportunities", "stage_option_id") };
      case "social_posts_summary":
        return { kind: "breakdown", breakdown: await this.optionBreakdown(client, ctx, "social_posts", "status_option_id") };
      case "partner_summary":
        return { kind: "breakdown", breakdown: await this.optionBreakdown(client, ctx, "partners", "status_option_id") };
      case "reseller_summary":
        return { kind: "breakdown", breakdown: await this.optionBreakdown(client, ctx, "resellers", "status_option_id") };
      case "ticket_status":
        return { kind: "breakdown", breakdown: await this.optionBreakdown(client, ctx, "support_tickets", "status_option_id") };
      case "ticket_priority":
        return { kind: "breakdown", breakdown: await this.optionBreakdown(client, ctx, "support_tickets", "priority_option_id") };
      case "ticket_category":
        return { kind: "breakdown", breakdown: await this.optionBreakdown(client, ctx, "support_tickets", "category_option_id") };
      case "campaign_count":
        return { kind: "scalar", value: await this.scalarCount(client, ctx, "campaigns") };
      case "campaign_members":
        return { kind: "scalar", value: await this.scalarCount(client, ctx, "campaign_members") };
      case "open_tickets":
        return { kind: "scalar", value: await this.scalarCount(client, ctx, "support_tickets", "t.resolved_at IS NULL") };
      case "sla_breaches":
        return { kind: "scalar", value: await this.scalarCount(client, ctx, "support_tickets", "t.resolved_at IS NULL AND t.resolution_due_at IS NOT NULL AND t.resolution_due_at < NOW()") };
      case "campaign_conversion":
        return { kind: "scalar", value: null, note: "Campaign conversion tracking is deferred." };
      case "csat":
        return { kind: "scalar", value: null, note: "CSAT capture is deferred." };
      case "pipeline_value":
        return this.pipelineValue(client, ctx);
      case "win_rate":
        return this.winRate(client, ctx);
      case "forecast_value":
        return this.forecastValue(client, ctx);
      case "health_score_distribution":
        return this.healthDistribution(client, ctx);
      case "at_risk_customers":
        return { kind: "scalar", value: await this.scalarCount(client, ctx, "customer_success_accounts", "t.health_score IS NOT NULL AND t.health_score < 60") };
      case "adoption_score":
        return this.adoptionScore(client, ctx);
      case "training_completion":
        return this.trainingCompletion(client, ctx);
      case "renewal_timeline":
        return this.renewalTimeline(client, ctx);
      case "onboarding_progress":
        return this.onboardingProgress(client, ctx);
      case "risk_alerts":
        return this.riskAlerts(client, ctx);
      case "recommended_actions":
        return this.recommendedActions(client, ctx);
      case "underperforming_areas":
        return this.underperformingAreas(client, ctx);
      case "customer_risk_summary":
        return this.customerRiskSummary(client, ctx);
      case "deal_risk_summary":
        return this.dealRiskSummary(client, ctx);
      default:
        return { kind: "scalar", value: null, note: "Metric is not available." };
    }
  }

  private async pipelineValue(client: PoolClient, ctx: MetricContext): Promise<MetricResult> {
    const result = await client.query<{ total: string; open_count: number }>(
      `SELECT COALESCE(SUM(COALESCE(NULLIF(o.metadata->>'amount', '')::numeric, 0)), 0) AS total, COUNT(*)::int AS open_count
       FROM opportunities o
       LEFT JOIN tenant_option_values ov ON ov.id = o.outcome_status_option_id AND ov.tenant_id = o.tenant_id
       WHERE o.tenant_id = $1 AND o.deleted_at IS NULL AND (ov.value_key IS NULL OR (ov.value_key NOT ILIKE '%won%' AND ov.value_key NOT ILIKE '%lost%'))`,
      [ctx.tenantId]
    );
    const row = result.rows[0];
    return { kind: "scalar", value: Math.round(Number(row?.total ?? 0)), unit: "currency", note: `${Number(row?.open_count ?? 0)} open opportunities` };
  }

  private async winRate(client: PoolClient, ctx: MetricContext): Promise<MetricResult> {
    const result = await client.query<{ value_key: string | null; c: number }>(
      `SELECT ov.value_key, COUNT(*)::int AS c FROM opportunities o
       JOIN tenant_option_values ov ON ov.id = o.outcome_status_option_id AND ov.tenant_id = o.tenant_id
       WHERE o.tenant_id = $1 AND o.deleted_at IS NULL GROUP BY ov.value_key`,
      [ctx.tenantId]
    );
    let won = 0;
    let lost = 0;
    for (const row of result.rows) {
      const key = (row.value_key ?? "").toLowerCase();
      if (key.includes("won")) won += Number(row.c);
      else if (key.includes("lost")) lost += Number(row.c);
    }
    const decided = won + lost;
    return { kind: "scalar", value: decided === 0 ? 0 : Math.round((won / decided) * 100), unit: "%", note: `${won} won / ${lost} lost` };
  }

  private async forecastValue(client: PoolClient, ctx: MetricContext): Promise<MetricResult> {
    const result = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(COALESCE(r.forecast_value, r.contract_value * COALESCE(r.probability, 0) / 100.0, 0)), 0) AS total
       FROM renewals r WHERE r.tenant_id = $1 AND r.deleted_at IS NULL`,
      [ctx.tenantId]
    );
    return { kind: "scalar", value: Math.round(Number(result.rows[0]?.total ?? 0)), unit: "currency" };
  }

  private async healthDistribution(client: PoolClient, ctx: MetricContext): Promise<MetricResult> {
    const result = await client.query<{ label: string; value: number }>(
      `SELECT CASE WHEN health_score < 50 THEN 'Critical (<50)' WHEN health_score < 70 THEN 'At risk (50-69)' ELSE 'Healthy (70-100)' END AS label, COUNT(*)::int AS value
       FROM customer_success_accounts WHERE tenant_id = $1 AND deleted_at IS NULL AND health_score IS NOT NULL GROUP BY 1 ORDER BY 1`,
      [ctx.tenantId]
    );
    return { kind: "breakdown", breakdown: result.rows.map((row) => ({ label: row.label, value: Number(row.value) })) };
  }

  private async adoptionScore(client: PoolClient, ctx: MetricContext): Promise<MetricResult> {
    const result = await client.query<{ avg: string | null }>(`SELECT ROUND(AVG(adoption_score))::text AS avg FROM customer_success_accounts WHERE tenant_id = $1 AND deleted_at IS NULL AND adoption_score IS NOT NULL`, [ctx.tenantId]);
    return { kind: "scalar", value: result.rows[0]?.avg ? Number(result.rows[0].avg) : 0, unit: "score" };
  }

  private async trainingCompletion(client: PoolClient, ctx: MetricContext): Promise<MetricResult> {
    const result = await client.query<{ completed: number; total: number }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'completed')::int AS completed, COUNT(*)::int AS total FROM training_assignments WHERE tenant_id = $1 AND deleted_at IS NULL`,
      [ctx.tenantId]
    );
    const total = Number(result.rows[0]?.total ?? 0);
    const completed = Number(result.rows[0]?.completed ?? 0);
    return { kind: "scalar", value: total === 0 ? 0 : Math.round((completed / total) * 100), unit: "%", note: `${completed}/${total} assignments completed` };
  }

  private async renewalTimeline(client: PoolClient, ctx: MetricContext): Promise<MetricResult> {
    const result = await client.query<{ label: string; value: number }>(
      `SELECT to_char(date_trunc('month', renewal_date), 'YYYY-MM') AS label, COUNT(*)::int AS value
       FROM renewals WHERE tenant_id = $1 AND deleted_at IS NULL AND renewal_date >= CURRENT_DATE AND renewal_date < CURRENT_DATE + INTERVAL '6 months'
       GROUP BY 1 ORDER BY 1`,
      [ctx.tenantId]
    );
    return { kind: "series", series: result.rows.map((row) => ({ label: row.label, value: Number(row.value) })) };
  }

  private async onboardingProgress(client: PoolClient, ctx: MetricContext): Promise<MetricResult> {
    const result = await client.query<{ label: string; value: number }>(
      `SELECT status AS label, COUNT(*)::int AS value FROM onboarding_plans WHERE tenant_id = $1 AND deleted_at IS NULL GROUP BY status ORDER BY value DESC`,
      [ctx.tenantId]
    );
    return { kind: "breakdown", breakdown: result.rows.map((row) => ({ label: row.label, value: Number(row.value) })) };
  }

  private async riskAlerts(client: PoolClient, ctx: MetricContext): Promise<MetricResult> {
    const queryEsc = await client.query<{ value: number }>(`SELECT COUNT(*)::int AS value FROM customer_query_escalations WHERE tenant_id = $1 AND status = 'open' AND deleted_at IS NULL`, [ctx.tenantId]);
    const atRisk = await this.scalarCount(client, ctx, "customer_success_accounts", "t.health_score IS NOT NULL AND t.health_score < 60");
    const sla = await this.scalarCount(client, ctx, "support_tickets", "t.resolved_at IS NULL AND t.resolution_due_at IS NOT NULL AND t.resolution_due_at < NOW()");
    const breakdown = [
      { label: "Open query escalations", value: Number(queryEsc.rows[0]?.value ?? 0) },
      { label: "At-risk customers", value: atRisk },
      { label: "SLA breaches", value: sla }
    ];
    return { kind: "breakdown", breakdown, value: breakdown.reduce((sum, entry) => sum + entry.value, 0) };
  }

  private async recommendedActions(client: PoolClient, ctx: MetricContext): Promise<MetricResult> {
    const result = await client.query<{ label: string; value: number }>(
      `SELECT module AS label, COUNT(*)::int AS value FROM ai_action_runs WHERE tenant_id = $1 AND review_status = 'pending_review' GROUP BY module ORDER BY value DESC`,
      [ctx.tenantId]
    );
    const breakdown = result.rows.map((row) => ({ label: row.label, value: Number(row.value) }));
    return { kind: "breakdown", breakdown, value: breakdown.reduce((sum, entry) => sum + entry.value, 0), note: breakdown.length === 0 ? "No AI recommendations pending review." : null };
  }

  private async underperformingAreas(client: PoolClient, ctx: MetricContext): Promise<MetricResult> {
    const win = await this.winRate(client, ctx);
    const atRisk = await this.scalarCount(client, ctx, "customer_success_accounts", "t.health_score IS NOT NULL AND t.health_score < 60");
    const sla = await this.scalarCount(client, ctx, "support_tickets", "t.resolved_at IS NULL AND t.resolution_due_at IS NOT NULL AND t.resolution_due_at < NOW()");
    const openTickets = await this.scalarCount(client, ctx, "support_tickets", "t.resolved_at IS NULL");
    return {
      kind: "breakdown",
      breakdown: [
        { label: "Win rate %", value: win.value ?? 0 },
        { label: "At-risk customers", value: atRisk },
        { label: "SLA breaches", value: sla },
        { label: "Open tickets", value: openTickets }
      ],
      note: "Signals to monitor across the business."
    };
  }

  private async customerRiskSummary(client: PoolClient, ctx: MetricContext): Promise<MetricResult> {
    const result = await client.query(
      `SELECT csa.id, COALESCE(a.name, 'Account') AS account, csa.health_score AS "healthScore", csa.adoption_score AS "adoptionScore", csa.renewal_date AS "renewalDate"
       FROM customer_success_accounts csa
       LEFT JOIN accounts a ON a.id = csa.account_id AND a.tenant_id = csa.tenant_id
       WHERE csa.tenant_id = $1 AND csa.deleted_at IS NULL AND csa.health_score IS NOT NULL
       ORDER BY csa.health_score ASC LIMIT 10`,
      [ctx.tenantId]
    );
    return { kind: "table", rows: result.rows };
  }

  private async dealRiskSummary(client: PoolClient, ctx: MetricContext): Promise<MetricResult> {
    const result = await client.query(
      `SELECT o.id, o.name, COALESCE(stage.label, '') AS stage, o.expected_close_date AS "expectedCloseDate", o.next_step AS "nextStep"
       FROM opportunities o
       LEFT JOIN tenant_option_values stage ON stage.id = o.stage_option_id AND stage.tenant_id = o.tenant_id
       LEFT JOIN tenant_option_values outc ON outc.id = o.outcome_status_option_id AND outc.tenant_id = o.tenant_id
       WHERE o.tenant_id = $1 AND o.deleted_at IS NULL
         AND (outc.value_key IS NULL OR (outc.value_key NOT ILIKE '%won%' AND outc.value_key NOT ILIKE '%lost%'))
         AND o.expected_close_date IS NOT NULL AND o.expected_close_date < CURRENT_DATE
       ORDER BY o.expected_close_date ASC LIMIT 10`,
      [ctx.tenantId]
    );
    return { kind: "table", rows: result.rows };
  }

  // -------------------------------------------------------------------------
  // Dashboard resolution
  // -------------------------------------------------------------------------

  async getDashboard(actor: ActorContext, dashboardKey: string, filter: { from: string | null; to: string | null }): Promise<DashboardDataResponse> {
    this.assertEnabled();
    const dashboard = findDashboard(dashboardKey);
    if (!dashboard) {
      throw new AppError(404, "The requested dashboard was not found.", undefined, "DASHBOARD_NOT_FOUND");
    }
    this.requirePermission(actor, dashboard.requiredPermissions, `You do not have permission to view the ${dashboard.name}.`);

    const ctx: MetricContext = { tenantId: actor.tenantId, from: filter.from, to: filter.to };

    // Phase 29: route this read-mostly, expensive metric computation through the
    // dashboard cache. Keyed by tenant + dashboard + date filter so cached entries
    // never leak across tenants or filters. (Redis-backed serving is deferred; the
    // strategy and key shape are in place and recompute live until then.)
    const cacheKey = this.cacheService.buildKey(["dashboard", actor.tenantId, dashboard.key, filter.from, filter.to]);
    const widgets = await this.cacheService.wrap<DashboardWidgetData[]>(cacheKey, () =>
      this.databaseService.withClient(async (client) => {
        const resolved: DashboardWidgetData[] = [];
        for (const widget of dashboard.widgets) {
          const metric = await this.computeMetric(client, ctx, widget.metricKey);
          resolved.push({
            key: widget.key,
            label: widget.label,
            type: widget.type,
            metricKey: widget.metricKey,
            kind: metric.kind,
            drilldown: widget.drilldown,
            value: metric.value ?? null,
            unit: metric.unit ?? null,
            breakdown: metric.breakdown ?? [],
            series: metric.series ?? [],
            rows: metric.rows ?? [],
            note: metric.note ?? null
          });
        }
        return resolved;
      })
    );

    return {
      key: dashboard.key,
      name: dashboard.name,
      category: dashboard.category,
      filter: { from: filter.from, to: filter.to },
      generatedAt: new Date().toISOString(),
      widgets
    };
  }

  async drilldown(actor: ActorContext, dashboardKey: string, widgetKey: string, filter: { from: string | null; to: string | null }): Promise<DashboardDrilldownResponse> {
    this.assertEnabled();
    const dashboard = findDashboard(dashboardKey);
    if (!dashboard) {
      throw new AppError(404, "The requested dashboard was not found.", undefined, "DASHBOARD_NOT_FOUND");
    }
    this.requirePermission(actor, dashboard.requiredPermissions, `You do not have permission to view the ${dashboard.name}.`);
    const widget = dashboard.widgets.find((entry) => entry.key === widgetKey);
    if (!widget) {
      throw new AppError(404, "The requested widget was not found.", undefined, "DASHBOARD_WIDGET_NOT_FOUND");
    }
    if (!widget.drilldown || !DRILLDOWN_METRICS.has(widget.metricKey)) {
      throw new AppError(400, "This widget does not support drill-down.", undefined, "DASHBOARD_DRILLDOWN_UNSUPPORTED");
    }

    const ctx: MetricContext = { tenantId: actor.tenantId, from: filter.from, to: filter.to };
    const rows = await this.databaseService.withClient((client) => this.drilldownRows(client, ctx, widget.metricKey));
    return { dashboardKey, widgetKey, rows, total: rows.length };
  }

  private async drilldownRows(client: PoolClient, ctx: MetricContext, metricKey: string): Promise<Array<Record<string, unknown>>> {
    switch (metricKey) {
      case "leads_by_status":
      case "lead_source": {
        const result = await client.query(
          `SELECT l.id, l.first_name AS "firstName", l.last_name AS "lastName", l.company_name AS "company", COALESCE(st.label, '') AS status, COALESCE(src.label, '') AS source
           FROM leads l
           LEFT JOIN tenant_option_values st ON st.id = l.status_option_id AND st.tenant_id = l.tenant_id
           LEFT JOIN tenant_option_values src ON src.id = l.source_option_id AND src.tenant_id = l.tenant_id
           WHERE l.tenant_id = $1 AND l.deleted_at IS NULL ORDER BY l.created_at DESC LIMIT 100`,
          [ctx.tenantId]
        );
        return result.rows;
      }
      case "opportunities_by_stage":
      case "deal_risk_summary": {
        const result = await client.query(
          `SELECT o.id, o.name, COALESCE(stage.label, '') AS stage, o.expected_close_date AS "expectedCloseDate"
           FROM opportunities o LEFT JOIN tenant_option_values stage ON stage.id = o.stage_option_id AND stage.tenant_id = o.tenant_id
           WHERE o.tenant_id = $1 AND o.deleted_at IS NULL ORDER BY o.created_at DESC LIMIT 100`,
          [ctx.tenantId]
        );
        return result.rows;
      }
      case "open_tickets": {
        const result = await client.query(
          `SELECT t.id, t.subject, COALESCE(st.label, '') AS status, t.resolution_due_at AS "resolutionDueAt"
           FROM support_tickets t LEFT JOIN tenant_option_values st ON st.id = t.status_option_id AND st.tenant_id = t.tenant_id
           WHERE t.tenant_id = $1 AND t.deleted_at IS NULL AND t.resolved_at IS NULL ORDER BY t.created_at DESC LIMIT 100`,
          [ctx.tenantId]
        );
        return result.rows;
      }
      case "at_risk_customers":
      case "customer_risk_summary": {
        const result = await client.query(
          `SELECT csa.id, COALESCE(a.name, 'Account') AS account, csa.health_score AS "healthScore", csa.adoption_score AS "adoptionScore", csa.renewal_date AS "renewalDate"
           FROM customer_success_accounts csa LEFT JOIN accounts a ON a.id = csa.account_id AND a.tenant_id = csa.tenant_id
           WHERE csa.tenant_id = $1 AND csa.deleted_at IS NULL AND csa.health_score IS NOT NULL ORDER BY csa.health_score ASC LIMIT 100`,
          [ctx.tenantId]
        );
        return result.rows;
      }
      default:
        return [];
    }
  }

  async exportDashboard(actor: ActorContext, audit: AuditMetadata, dashboardKey: string, filter: { from: string | null; to: string | null }): Promise<DashboardExportResponse> {
    this.assertEnabled();
    const dashboard = findDashboard(dashboardKey);
    if (!dashboard) {
      throw new AppError(404, "The requested dashboard was not found.", undefined, "DASHBOARD_NOT_FOUND");
    }
    // Export permission check: a dedicated export permission (or a module export permission) is required.
    const exportPermissions = ["dashboards.export", ...dashboard.modules.map((module) => `${module}.export`)];
    this.requirePermission(actor, exportPermissions, "You do not have permission to export this dashboard.");

    const data = await this.getDashboard(actor, dashboardKey, filter);
    const rows = data.widgets.map((widget) => ({
      widget: widget.label,
      metric: widget.metricKey,
      kind: widget.kind,
      value: widget.value,
      unit: widget.unit,
      breakdown: widget.breakdown,
      series: widget.series,
      rowCount: widget.rows.length
    }));

    if (this.config.enableAuditLogs) {
      await this.databaseService.withClient((client) => client.query(
        `INSERT INTO audit_logs (tenant_id, actor_user_id, session_id, event_type, action, resource_type, resource_id, status, ip_address, user_agent, request_id, metadata) VALUES ($1, $2, $3, 'dashboards', 'dashboard.export', 'dashboard', NULL, 'success', NULLIF($4, '')::inet, $5, $6, $7::jsonb)`,
        [actor.tenantId, actor.userId, actor.sessionId, audit.ipAddress ?? "", audit.userAgent ?? null, audit.requestId, JSON.stringify({ dashboardKey, widgets: rows.length })]
      ));
    }

    return { dashboardKey, exportedAt: new Date().toISOString(), filter: { from: filter.from, to: filter.to }, rows };
  }

  // -------------------------------------------------------------------------
  // Saved views
  // -------------------------------------------------------------------------

  private mapView(row: Record<string, unknown>): DashboardSavedView {
    const config = row.config && typeof row.config === "object" && !Array.isArray(row.config) ? (row.config as Record<string, unknown>) : {};
    return {
      id: row.id as string,
      dashboardKey: row.dashboard_key as string,
      name: row.name as string,
      ownerUserId: row.owner_user_id as string,
      isShared: row.is_shared as boolean,
      isDefault: row.is_default as boolean,
      config,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString()
    };
  }

  private dashboardOr404(dashboardKey: string) {
    const dashboard = findDashboard(dashboardKey);
    if (!dashboard) {
      throw new AppError(404, "The requested dashboard was not found.", undefined, "DASHBOARD_NOT_FOUND");
    }
    return dashboard;
  }

  async listViews(actor: ActorContext, dashboardKey: string): Promise<DashboardSavedViewListResponse> {
    this.assertEnabled();
    const dashboard = this.dashboardOr404(dashboardKey);
    this.requirePermission(actor, dashboard.requiredPermissions, `You do not have permission to view the ${dashboard.name}.`);
    return this.databaseService.withClient(async (client) => {
      const result = await client.query(
        `SELECT * FROM dashboard_saved_views WHERE tenant_id = $1 AND dashboard_key = $2 AND deleted_at IS NULL AND (owner_user_id = $3 OR is_shared = TRUE) ORDER BY updated_at DESC`,
        [actor.tenantId, dashboardKey, actor.userId]
      );
      return { views: result.rows.map((row) => this.mapView(row)) };
    });
  }

  async createView(actor: ActorContext, dashboardKey: string, input: CreateDashboardViewRequestBody): Promise<DashboardSavedViewResponse> {
    this.assertEnabled();
    const dashboard = this.dashboardOr404(dashboardKey);
    this.requirePermission(actor, dashboard.requiredPermissions, `You do not have permission to save views for the ${dashboard.name}.`);
    const view = await this.databaseService.withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO dashboard_saved_views (tenant_id, dashboard_key, owner_user_id, name, config, is_shared, is_default, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $3, $3) RETURNING *`,
        [actor.tenantId, dashboardKey, actor.userId, input.name.trim(), JSON.stringify(input.config ?? {}), input.isShared ?? false, input.isDefault ?? false]
      );
      return this.mapView(inserted.rows[0]);
    });
    return { view };
  }

  private async loadOwnView(client: PoolClient, actor: ActorContext, viewId: string) {
    const result = await client.query(`SELECT * FROM dashboard_saved_views WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [viewId, actor.tenantId]);
    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, "The requested saved view was not found.", undefined, "DASHBOARD_VIEW_NOT_FOUND");
    }
    if (row.owner_user_id !== actor.userId) {
      throw new AppError(403, "You can only modify your own saved views.", undefined, "AUTHORIZATION_ERROR");
    }
    return row;
  }

  async updateView(actor: ActorContext, viewId: string, input: UpdateDashboardViewRequestBody): Promise<DashboardSavedViewResponse> {
    this.assertEnabled();
    const view = await this.databaseService.withTransaction(async (client) => {
      await this.loadOwnView(client, actor, viewId);
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateDashboardViewRequestBody] !== undefined);
      if (keys.length === 0) {
        throw new AppError(400, "At least one field must be updated.", undefined, "VALIDATION_ERROR");
      }
      const assignments: string[] = [];
      const params: unknown[] = [viewId, actor.tenantId, actor.userId];
      const push = (column: string, value: unknown, cast = "") => {
        params.push(value);
        assignments.push(`${column} = $${params.length}${cast}`);
      };
      if (input.name !== undefined) push("name", input.name.trim());
      if (input.config !== undefined) push("config", JSON.stringify(input.config), "::jsonb");
      if (input.isShared !== undefined) push("is_shared", Boolean(input.isShared));
      if (input.isDefault !== undefined) push("is_default", Boolean(input.isDefault));
      await client.query(`UPDATE dashboard_saved_views SET ${assignments.join(", ")}, updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, params);
      const updated = await client.query(`SELECT * FROM dashboard_saved_views WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [viewId, actor.tenantId]);
      return this.mapView(updated.rows[0]);
    });
    return { view };
  }

  async deleteView(actor: ActorContext, viewId: string): Promise<{ deleted: boolean }> {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      await this.loadOwnView(client, actor, viewId);
      await client.query(`UPDATE dashboard_saved_views SET deleted_at = NOW(), updated_by = $3 WHERE id = $1 AND tenant_id = $2`, [viewId, actor.tenantId, actor.userId]);
      return { deleted: true };
    });
  }
}
