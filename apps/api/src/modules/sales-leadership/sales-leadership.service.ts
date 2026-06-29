import type {
  AddLeadershipCommentRequestBody,
  CreateSalesQuotaRequestBody,
  CrmLookupUserSummary,
  CrmOptionValueSummary,
  DealReviewBoardEntry,
  DealReviewBoardResponse,
  RevenueDashboardResponse,
  ReviveLostDealRequestBody,
  RoleSummary,
  SalesQuotaSummary,
  SalesQuotasResponse,
  SetDealReviewBoardRequestBody,
  UpdateSalesQuotaRequestBody,
  WinLossAnalyticsResponse,
  WinLossDimensionEntry
} from "@crm/types";
import { computeQuotaAttainment, computeWinRate, projectQuotaRisk, quotaPeriodTypes } from "@crm/types";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import { DatabaseService } from "../../platform/database/database.service.js";
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

export interface RevenueDashboardQuery {
  from?: string;
  to?: string;
  region?: string;
  product?: string;
  segment?: string;
  teamId?: string;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function num(value: unknown): number {
  return toNullableNumber(value) ?? 0;
}

function trimmed(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const next = value.trim();
  return next.length > 0 ? next : null;
}

function getMetadata(value: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function mapUser(row: { id: string | null; display_name?: string | null; email?: string | null; team_name?: string | null; department_name?: string | null }): CrmLookupUserSummary | null {
  if (!row.id) {
    return null;
  }
  return {
    id: row.id,
    displayName: row.display_name ?? "",
    email: row.email ?? "",
    teamName: row.team_name ?? null,
    departmentName: row.department_name ?? null
  };
}

function mapStage(row: { stage_id: string | null; stage_key: string | null; stage_label: string | null; stage_description: string | null; stage_color: string | null; stage_is_default: boolean | null; stage_is_active: boolean | null }): CrmOptionValueSummary | null {
  if (!row.stage_id || !row.stage_key) {
    return null;
  }
  return {
    id: row.stage_id,
    key: row.stage_key,
    label: row.stage_label ?? row.stage_key,
    description: row.stage_description ?? null,
    color: row.stage_color ?? null,
    isDefault: row.stage_is_default ?? false,
    isActive: row.stage_is_active ?? true
  };
}

const AI_PLACEHOLDER = (message: string) => ({ available: false as const, message });

export class SalesLeadershipService {
  private readonly notificationService: NotificationService;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {
    this.notificationService = new NotificationService(databaseService, config);
  }

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "Sales leadership analytics are unavailable until the database connection is enabled.", undefined, "SALES_LEADERSHIP_UNAVAILABLE");
    }
  }

  private async recordAuditLog(
    client: PoolClient,
    actor: ActorContext,
    audit: AuditMetadata,
    input: { action: string; resourceType: string; resourceId?: string | null; status: "success" | "failure" | "denied" | "error"; metadata?: Record<string, unknown> }
  ) {
    if (!this.config.enableAuditLogs) {
      return;
    }
    await client.query(
      `
        INSERT INTO audit_logs (tenant_id, actor_user_id, session_id, event_type, action, resource_type, resource_id, status, ip_address, user_agent, request_id, metadata)
        VALUES ($1, $2, $3, 'crm', $4, $5, $6, $7, NULLIF($8, '')::inet, $9, $10, $11::jsonb)
      `,
      [actor.tenantId, actor.userId, actor.sessionId, input.action, input.resourceType, input.resourceId ?? null, input.status, audit.ipAddress ?? "", audit.userAgent ?? null, audit.requestId, JSON.stringify(input.metadata ?? {})]
    );
  }

  private async ensureUserId(client: PoolClient, tenantId: string, userId: string | null | undefined): Promise<string | null> {
    if (!userId) {
      return null;
    }
    const result = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [userId, tenantId]
    );
    if (result.rowCount === 0) {
      throw new AppError(400, "Referenced user was not found in this tenant.", undefined, "VALIDATION_ERROR");
    }
    return result.rows[0].id;
  }

  private async ensureTeamId(client: PoolClient, tenantId: string, teamId: string | null | undefined): Promise<string | null> {
    if (!teamId) {
      return null;
    }
    const result = await client.query<{ id: string }>(
      `SELECT id FROM teams WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [teamId, tenantId]
    );
    if (result.rowCount === 0) {
      throw new AppError(400, "Referenced team was not found in this tenant.", undefined, "VALIDATION_ERROR");
    }
    return result.rows[0].id;
  }

  // ---- SH-001 Revenue dashboard -----------------------------------------------------------------

  async getRevenueDashboard(actor: ActorContext, query: RevenueDashboardQuery): Promise<RevenueDashboardResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const conditions = ["opportunities.tenant_id = $1", "opportunities.deleted_at IS NULL"];
      const params: unknown[] = [actor.tenantId];
      const addFilter = (sql: string, value: unknown) => {
        params.push(value);
        conditions.push(sql.replace("$$", `$${params.length}`));
      };
      if (query.from) addFilter("opportunities.expected_close_date >= $$::date", query.from);
      if (query.to) addFilter("opportunities.expected_close_date <= $$::date", query.to);
      if (query.region) addFilter("opportunities.metadata->>'region' = $$", query.region);
      if (query.product) addFilter("opportunities.metadata->>'product' = $$", query.product);
      if (query.segment) addFilter("opportunities.metadata->>'segment' = $$", query.segment);
      if (query.teamId) addFilter("owner_users.team_id = $$", query.teamId);
      const where = conditions.join(" AND ");

      const metrics = await client.query<{
        won_value: string; pipeline_value: string; weighted_forecast: string; renewal_pipeline: string;
        won_count: number; lost_count: number; avg_deal: string | null; avg_cycle: string | null;
      }>(
        `
          SELECT
            COALESCE(SUM(CASE WHEN outcome_values.value_key = 'won' THEN COALESCE(opportunities.amount, 0) ELSE 0 END), 0) AS won_value,
            COALESCE(SUM(CASE WHEN outcome_values.value_key = 'open' THEN COALESCE(opportunities.amount, 0) ELSE 0 END), 0) AS pipeline_value,
            COALESCE(SUM(CASE WHEN outcome_values.value_key = 'open' THEN COALESCE(opportunities.amount, 0) * COALESCE(opportunities.probability, 0) / 100.0 ELSE 0 END), 0) AS weighted_forecast,
            COALESCE(SUM(CASE WHEN outcome_values.value_key = 'open' AND (source_values.value_key ILIKE '%renew%' OR opportunities.metadata->>'renewal' = 'true') THEN COALESCE(opportunities.amount, 0) ELSE 0 END), 0) AS renewal_pipeline,
            COUNT(*) FILTER (WHERE outcome_values.value_key = 'won')::int AS won_count,
            COUNT(*) FILTER (WHERE outcome_values.value_key = 'lost')::int AS lost_count,
            COALESCE(AVG(opportunities.amount) FILTER (WHERE outcome_values.value_key = 'won'), 0) AS avg_deal,
            COALESCE(AVG(EXTRACT(EPOCH FROM (opportunities.last_stage_changed_at - opportunities.created_at)) / 86400.0) FILTER (WHERE outcome_values.value_key = 'won'), 0) AS avg_cycle
          FROM opportunities
          INNER JOIN tenant_option_values AS outcome_values ON outcome_values.id = opportunities.outcome_status_option_id AND outcome_values.tenant_id = opportunities.tenant_id
          INNER JOIN tenant_option_values AS source_values ON source_values.id = opportunities.source_option_id AND source_values.tenant_id = opportunities.tenant_id
          LEFT JOIN users AS owner_users ON owner_users.id = opportunities.owner_id AND owner_users.tenant_id = opportunities.tenant_id AND owner_users.deleted_at IS NULL
          WHERE ${where}
        `,
        params
      );

      const byTeamResult = await client.query<{ team_id: string | null; team_name: string | null; pipeline_value: string; weighted_forecast: string; won_value: string }>(
        `
          SELECT owner_teams.id AS team_id, owner_teams.name AS team_name,
            COALESCE(SUM(CASE WHEN outcome_values.value_key = 'open' THEN COALESCE(opportunities.amount, 0) ELSE 0 END), 0) AS pipeline_value,
            COALESCE(SUM(CASE WHEN outcome_values.value_key = 'open' THEN COALESCE(opportunities.amount, 0) * COALESCE(opportunities.probability, 0) / 100.0 ELSE 0 END), 0) AS weighted_forecast,
            COALESCE(SUM(CASE WHEN outcome_values.value_key = 'won' THEN COALESCE(opportunities.amount, 0) ELSE 0 END), 0) AS won_value
          FROM opportunities
          INNER JOIN tenant_option_values AS outcome_values ON outcome_values.id = opportunities.outcome_status_option_id AND outcome_values.tenant_id = opportunities.tenant_id
          INNER JOIN tenant_option_values AS source_values ON source_values.id = opportunities.source_option_id AND source_values.tenant_id = opportunities.tenant_id
          LEFT JOIN users AS owner_users ON owner_users.id = opportunities.owner_id AND owner_users.tenant_id = opportunities.tenant_id AND owner_users.deleted_at IS NULL
          LEFT JOIN teams AS owner_teams ON owner_teams.id = owner_users.team_id AND owner_teams.tenant_id = owner_users.tenant_id
          WHERE ${where}
          GROUP BY owner_teams.id, owner_teams.name
          ORDER BY pipeline_value DESC
        `,
        params
      );

      // Target from quota table (filtered consistently where possible).
      const quotaConditions = ["sales_quotas.tenant_id = $1", "sales_quotas.deleted_at IS NULL"];
      const quotaParams: unknown[] = [actor.tenantId];
      if (query.from) {
        quotaParams.push(query.from);
        quotaConditions.push(`sales_quotas.period_end >= $${quotaParams.length}::date`);
      }
      if (query.to) {
        quotaParams.push(query.to);
        quotaConditions.push(`sales_quotas.period_start <= $${quotaParams.length}::date`);
      }
      if (query.region) {
        quotaParams.push(query.region);
        quotaConditions.push(`(sales_quotas.region IS NULL OR sales_quotas.region = $${quotaParams.length})`);
      }
      if (query.product) {
        quotaParams.push(query.product);
        quotaConditions.push(`(sales_quotas.product IS NULL OR sales_quotas.product = $${quotaParams.length})`);
      }
      if (query.teamId) {
        quotaParams.push(query.teamId);
        quotaConditions.push(`(sales_quotas.team_id IS NULL OR sales_quotas.team_id = $${quotaParams.length})`);
      }
      const targetResult = await client.query<{ target: string }>(
        `SELECT COALESCE(SUM(target_amount), 0) AS target FROM sales_quotas WHERE ${quotaConditions.join(" AND ")}`,
        quotaParams
      );

      const row = metrics.rows[0];
      const achievedAmount = num(row.won_value);
      const targetAmount = num(targetResult.rows[0]?.target);

      return {
        targetAmount,
        achievedAmount,
        gap: Math.max(0, Math.round(targetAmount - achievedAmount)),
        pipelineValue: num(row.pipeline_value),
        weightedForecast: Math.round(num(row.weighted_forecast)),
        winRate: computeWinRate(row.won_count, row.lost_count),
        avgDealSize: Math.round(num(row.avg_deal)),
        avgCycleDays: Math.round(num(row.avg_cycle)),
        renewalPipelineValue: num(row.renewal_pipeline),
        byTeam: byTeamResult.rows.map((teamRow) => ({
          team: teamRow.team_id ? { id: teamRow.team_id, name: teamRow.team_name ?? "" } : null,
          pipelineValue: num(teamRow.pipeline_value),
          weightedForecast: Math.round(num(teamRow.weighted_forecast)),
          wonValue: num(teamRow.won_value)
        })),
        filters: {
          region: trimmed(query.region),
          product: trimmed(query.product),
          segment: trimmed(query.segment),
          teamId: trimmed(query.teamId),
          from: trimmed(query.from),
          to: trimmed(query.to)
        },
        aiPlaceholder: AI_PLACEHOLDER("AI revenue risk/opportunity summarization will connect with the AI Gateway phase.")
      };
    });
  }

  // ---- SH-002 Quota management ------------------------------------------------------------------

  private async mapQuota(client: PoolClient, tenantId: string, row: QuotaRow, childCount: number): Promise<SalesQuotaSummary> {
    // Attainment: closed-won revenue attributable to this quota's scope within its period.
    const conditions = ["opportunities.tenant_id = $1", "opportunities.deleted_at IS NULL", "outcome_values.value_key = 'won'", "opportunities.expected_close_date >= $2::date", "opportunities.expected_close_date <= $3::date"];
    const params: unknown[] = [tenantId, row.period_start, row.period_end];
    if (row.owner_id) {
      params.push(row.owner_id);
      conditions.push(`opportunities.owner_id = $${params.length}`);
    }
    if (row.team_id) {
      params.push(row.team_id);
      conditions.push(`owner_users.team_id = $${params.length}`);
    }
    if (row.product) {
      params.push(row.product);
      conditions.push(`opportunities.metadata->>'product' = $${params.length}`);
    }
    if (row.region) {
      params.push(row.region);
      conditions.push(`opportunities.metadata->>'region' = $${params.length}`);
    }
    if (row.segment) {
      params.push(row.segment);
      conditions.push(`opportunities.metadata->>'segment' = $${params.length}`);
    }
    const achievement = await client.query<{ won: string; weighted: string }>(
      `
        SELECT
          COALESCE(SUM(COALESCE(opportunities.amount, 0)), 0) AS won,
          0 AS weighted
        FROM opportunities
        INNER JOIN tenant_option_values AS outcome_values ON outcome_values.id = opportunities.outcome_status_option_id AND outcome_values.tenant_id = opportunities.tenant_id
        LEFT JOIN users AS owner_users ON owner_users.id = opportunities.owner_id AND owner_users.tenant_id = opportunities.tenant_id
        WHERE ${conditions.join(" AND ")}
      `,
      params
    );
    // Weighted open pipeline in scope for risk projection.
    const openConditions = conditions.map((c) => c.replace("outcome_values.value_key = 'won'", "outcome_values.value_key = 'open'"));
    const weightedResult = await client.query<{ weighted: string }>(
      `
        SELECT COALESCE(SUM(COALESCE(opportunities.amount, 0) * COALESCE(opportunities.probability, 0) / 100.0), 0) AS weighted
        FROM opportunities
        INNER JOIN tenant_option_values AS outcome_values ON outcome_values.id = opportunities.outcome_status_option_id AND outcome_values.tenant_id = opportunities.tenant_id
        LEFT JOIN users AS owner_users ON owner_users.id = opportunities.owner_id AND owner_users.tenant_id = opportunities.tenant_id
        WHERE ${openConditions.join(" AND ")}
      `,
      params
    );

    const target = num(row.target_amount);
    const achieved = num(achievement.rows[0]?.won);
    const weighted = num(weightedResult.rows[0]?.weighted);

    return {
      id: row.id,
      name: row.name,
      periodType: row.period_type,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      owner: mapUser({ id: row.owner_id, display_name: row.owner_display_name, email: row.owner_email, team_name: row.owner_team_name, department_name: row.owner_department_name }),
      team: row.team_id ? { id: row.team_id, name: row.team_name ?? "" } : null,
      product: row.product,
      region: row.region,
      segment: row.segment,
      targetAmount: target,
      parentQuotaId: row.parent_quota_id,
      attainment: computeQuotaAttainment(target, achieved),
      risk: projectQuotaRisk(target, achieved, weighted),
      childCount
    };
  }

  async listQuotas(actor: ActorContext): Promise<SalesQuotasResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const result = await client.query<QuotaRow & { child_count: number }>(
        `
          SELECT q.*,
            owner_users.display_name AS owner_display_name, owner_users.email AS owner_email,
            owner_teams.name AS owner_team_name, owner_departments.name AS owner_department_name,
            teams.name AS team_name,
            (SELECT COUNT(*)::int FROM sales_quotas children WHERE children.parent_quota_id = q.id AND children.deleted_at IS NULL) AS child_count
          FROM sales_quotas q
          LEFT JOIN users AS owner_users ON owner_users.id = q.owner_id AND owner_users.tenant_id = q.tenant_id
          LEFT JOIN teams AS owner_teams ON owner_teams.id = owner_users.team_id
          LEFT JOIN departments AS owner_departments ON owner_departments.id = owner_users.department_id
          LEFT JOIN teams ON teams.id = q.team_id AND teams.tenant_id = q.tenant_id
          WHERE q.tenant_id = $1 AND q.deleted_at IS NULL
          ORDER BY q.period_start DESC, q.name ASC
        `,
        [actor.tenantId]
      );
      const quotas: SalesQuotaSummary[] = [];
      for (const row of result.rows) {
        quotas.push(await this.mapQuota(client, actor.tenantId, row, row.child_count));
      }
      return { quotas, aiPlaceholder: AI_PLACEHOLDER("AI quota-risk prediction will connect with the AI Gateway phase.") };
    });
  }

  async createQuota(actor: ActorContext, audit: AuditMetadata, input: CreateSalesQuotaRequestBody): Promise<SalesQuotaSummary> {
    this.assertEnabled();
    const name = trimmed(input.name);
    if (!name) {
      throw new AppError(400, "A quota name is required.", undefined, "VALIDATION_ERROR");
    }
    if (!quotaPeriodTypes.includes(input.periodType)) {
      throw new AppError(400, "Invalid quota period type.", undefined, "VALIDATION_ERROR");
    }
    return this.databaseService.withTransaction(async (client) => {
      const ownerId = await this.ensureUserId(client, actor.tenantId, input.ownerId);
      const teamId = await this.ensureTeamId(client, actor.tenantId, input.teamId);
      let parentQuotaId: string | null = null;
      if (input.parentQuotaId) {
        const parent = await client.query<{ id: string }>(`SELECT id FROM sales_quotas WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [input.parentQuotaId, actor.tenantId]);
        if (parent.rowCount === 0) {
          throw new AppError(400, "Parent quota was not found.", undefined, "VALIDATION_ERROR");
        }
        parentQuotaId = parent.rows[0].id;
      }
      const inserted = await client.query<{ id: string }>(
        `
          INSERT INTO sales_quotas (tenant_id, name, period_type, period_start, period_end, owner_id, team_id, product, region, segment, target_amount, parent_quota_id, created_by, updated_by)
          VALUES ($1, $2, $3, $4::date, $5::date, $6, $7, $8, $9, $10, $11, $12, $13, $13)
          RETURNING id
        `,
        [actor.tenantId, name, input.periodType, input.periodStart, input.periodEnd, ownerId, teamId, trimmed(input.product), trimmed(input.region), trimmed(input.segment), input.targetAmount, parentQuotaId, actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "sales_quota.create", resourceType: "sales_quota", resourceId: inserted.rows[0].id, status: "success" });
      const row = await this.loadQuotaRow(client, actor.tenantId, inserted.rows[0].id);
      return this.mapQuota(client, actor.tenantId, row, 0);
    });
  }

  async updateQuota(actor: ActorContext, audit: AuditMetadata, quotaId: string, input: UpdateSalesQuotaRequestBody): Promise<SalesQuotaSummary> {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      const current = await this.loadQuotaRow(client, actor.tenantId, quotaId);
      const ownerId = input.ownerId !== undefined ? await this.ensureUserId(client, actor.tenantId, input.ownerId) : current.owner_id;
      const teamId = input.teamId !== undefined ? await this.ensureTeamId(client, actor.tenantId, input.teamId) : current.team_id;
      await client.query(
        `
          UPDATE sales_quotas
          SET name = $3, target_amount = $4, owner_id = $5, team_id = $6, product = $7, region = $8, segment = $9, updated_by = $10
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
        `,
        [
          quotaId,
          actor.tenantId,
          input.name !== undefined ? trimmed(input.name) ?? current.name : current.name,
          input.targetAmount !== undefined ? input.targetAmount : current.target_amount,
          ownerId,
          teamId,
          input.product !== undefined ? trimmed(input.product) : current.product,
          input.region !== undefined ? trimmed(input.region) : current.region,
          input.segment !== undefined ? trimmed(input.segment) : current.segment,
          actor.userId
        ]
      );
      await this.recordAuditLog(client, actor, audit, { action: "sales_quota.update", resourceType: "sales_quota", resourceId: quotaId, status: "success" });
      const row = await this.loadQuotaRow(client, actor.tenantId, quotaId);
      const childCountResult = await client.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM sales_quotas WHERE parent_quota_id = $1 AND deleted_at IS NULL`, [quotaId]);
      return this.mapQuota(client, actor.tenantId, row, childCountResult.rows[0]?.count ?? 0);
    });
  }

  async deleteQuota(actor: ActorContext, audit: AuditMetadata, quotaId: string): Promise<{ success: true }> {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      await this.loadQuotaRow(client, actor.tenantId, quotaId);
      await client.query(`UPDATE sales_quotas SET deleted_at = NOW(), updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [quotaId, actor.tenantId, actor.userId]);
      await client.query(`UPDATE sales_quotas SET parent_quota_id = NULL WHERE parent_quota_id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [quotaId, actor.tenantId]);
      await this.recordAuditLog(client, actor, audit, { action: "sales_quota.delete", resourceType: "sales_quota", resourceId: quotaId, status: "success" });
      return { success: true };
    });
  }

  private async loadQuotaRow(client: PoolClient, tenantId: string, quotaId: string): Promise<QuotaRow> {
    const result = await client.query<QuotaRow>(
      `
        SELECT q.*,
          owner_users.display_name AS owner_display_name, owner_users.email AS owner_email,
          owner_teams.name AS owner_team_name, owner_departments.name AS owner_department_name,
          teams.name AS team_name
        FROM sales_quotas q
        LEFT JOIN users AS owner_users ON owner_users.id = q.owner_id AND owner_users.tenant_id = q.tenant_id
        LEFT JOIN teams AS owner_teams ON owner_teams.id = owner_users.team_id
        LEFT JOIN departments AS owner_departments ON owner_departments.id = owner_users.department_id
        LEFT JOIN teams ON teams.id = q.team_id AND teams.tenant_id = q.tenant_id
        WHERE q.id = $1 AND q.tenant_id = $2 AND q.deleted_at IS NULL
      `,
      [quotaId, tenantId]
    );
    if (result.rowCount === 0) {
      throw new AppError(404, "Quota was not found.", undefined, "NOT_FOUND");
    }
    return result.rows[0];
  }

  // ---- SH-003 Strategic deal review board -------------------------------------------------------

  async getDealReviewBoard(actor: ActorContext, threshold: number): Promise<DealReviewBoardResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const result = await client.query<DealRow>(
        `
          SELECT opportunities.id, opportunities.name, opportunities.amount, opportunities.metadata,
            accounts.id AS account_id, accounts.name AS account_name,
            owner_users.id AS owner_id, owner_users.display_name AS owner_display_name, owner_users.email AS owner_email, owner_teams.name AS owner_team_name, owner_departments.name AS owner_department_name,
            stage_values.id AS stage_id, stage_values.value_key AS stage_key, stage_values.label AS stage_label, stage_values.description AS stage_description, stage_values.color AS stage_color, stage_values.is_default AS stage_is_default, stage_values.is_active AS stage_is_active
          FROM opportunities
          INNER JOIN tenant_option_values AS outcome_values ON outcome_values.id = opportunities.outcome_status_option_id AND outcome_values.tenant_id = opportunities.tenant_id
          INNER JOIN tenant_option_values AS stage_values ON stage_values.id = opportunities.stage_option_id AND stage_values.tenant_id = opportunities.tenant_id
          LEFT JOIN accounts ON accounts.id = opportunities.account_id AND accounts.tenant_id = opportunities.tenant_id
          LEFT JOIN users AS owner_users ON owner_users.id = opportunities.owner_id AND owner_users.tenant_id = opportunities.tenant_id
          LEFT JOIN teams AS owner_teams ON owner_teams.id = owner_users.team_id
          LEFT JOIN departments AS owner_departments ON owner_departments.id = owner_users.department_id
          WHERE opportunities.tenant_id = $1 AND opportunities.deleted_at IS NULL AND outcome_values.value_key = 'open' AND COALESCE(opportunities.amount, 0) >= $2
          ORDER BY opportunities.amount DESC NULLS LAST
          LIMIT 100
        `,
        [actor.tenantId, threshold]
      );
      return {
        thresholdAmount: threshold,
        entries: result.rows.map((row) => this.mapDealReviewEntry(row)),
        aiPlaceholder: AI_PLACEHOLDER("AI executive-intervention suggestions will connect with the AI Gateway phase.")
      };
    });
  }

  private mapDealReviewEntry(row: DealRow): DealReviewBoardEntry {
    const board = getMetadata(getMetadata(row.metadata).dealReviewBoard as Record<string, unknown> | undefined);
    const rawComments = Array.isArray(board.comments) ? board.comments : [];
    return {
      opportunityId: row.id,
      name: row.name,
      account: row.account_id ? { id: row.account_id, name: row.account_name ?? "" } : null,
      owner: mapUser({ id: row.owner_id, display_name: row.owner_display_name, email: row.owner_email, team_name: row.owner_team_name, department_name: row.owner_department_name }),
      stage: mapStage(row),
      amount: toNullableNumber(row.amount),
      executiveSponsor: (board.executiveSponsor as string) ?? null,
      businessCase: (board.businessCase as string) ?? null,
      competitiveRisk: (board.competitiveRisk as string) ?? null,
      commercials: (board.commercials as string) ?? null,
      deliveryRisk: (board.deliveryRisk as string) ?? null,
      legalStatus: (board.legalStatus as string) ?? null,
      nextAction: (board.nextAction as string) ?? null,
      comments: rawComments
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
        .map((entry) => ({
          id: (entry.id as string) ?? randomUUID(),
          author: entry.author && typeof entry.author === "object"
            ? mapUser({ id: (entry.author as Record<string, unknown>).id as string, display_name: (entry.author as Record<string, unknown>).displayName as string, email: (entry.author as Record<string, unknown>).email as string })
            : null,
          comment: (entry.comment as string) ?? "",
          createdAt: (entry.createdAt as string) ?? new Date().toISOString()
        }))
    };
  }

  private async loadOpportunityMetadata(client: PoolClient, tenantId: string, opportunityId: string): Promise<Record<string, unknown>> {
    const result = await client.query<{ metadata: Record<string, unknown> | null }>(
      `SELECT metadata FROM opportunities WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [opportunityId, tenantId]
    );
    if (result.rowCount === 0) {
      throw new AppError(404, "Opportunity was not found.", undefined, "NOT_FOUND");
    }
    return getMetadata(result.rows[0].metadata);
  }

  async setDealReviewBoard(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: SetDealReviewBoardRequestBody): Promise<DealReviewBoardEntry> {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      const metadata = await this.loadOpportunityMetadata(client, actor.tenantId, opportunityId);
      const board = getMetadata(metadata.dealReviewBoard as Record<string, unknown> | undefined);
      const fields: (keyof SetDealReviewBoardRequestBody)[] = ["executiveSponsor", "businessCase", "competitiveRisk", "commercials", "deliveryRisk", "legalStatus", "nextAction"];
      const nextBoard: Record<string, unknown> = { ...board };
      for (const field of fields) {
        if (input[field] !== undefined) {
          nextBoard[field] = trimmed(input[field] ?? null);
        }
      }
      await client.query(
        `UPDATE opportunities SET metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [opportunityId, actor.tenantId, JSON.stringify({ ...metadata, dealReviewBoard: nextBoard }), actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "deal_review_board.set", resourceType: "opportunity", resourceId: opportunityId, status: "success" });
      const row = await this.loadDealRow(client, actor.tenantId, opportunityId);
      return this.mapDealReviewEntry(row);
    });
  }

  async addLeadershipComment(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: AddLeadershipCommentRequestBody): Promise<DealReviewBoardEntry> {
    this.assertEnabled();
    const comment = trimmed(input.comment);
    if (!comment) {
      throw new AppError(400, "A comment is required.", undefined, "VALIDATION_ERROR");
    }
    return this.databaseService.withTransaction(async (client) => {
      const metadata = await this.loadOpportunityMetadata(client, actor.tenantId, opportunityId);
      const board = getMetadata(metadata.dealReviewBoard as Record<string, unknown> | undefined);
      const comments = Array.isArray(board.comments) ? board.comments : [];
      const entry = { id: randomUUID(), author: { id: actor.userId, displayName: actor.displayName, email: actor.email }, comment, createdAt: new Date().toISOString() };
      await client.query(
        `UPDATE opportunities SET metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [opportunityId, actor.tenantId, JSON.stringify({ ...metadata, dealReviewBoard: { ...board, comments: [...comments, entry] } }), actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "deal_review_board.comment", resourceType: "opportunity", resourceId: opportunityId, status: "success" });
      const row = await this.loadDealRow(client, actor.tenantId, opportunityId);
      return this.mapDealReviewEntry(row);
    });
  }

  private async loadDealRow(client: PoolClient, tenantId: string, opportunityId: string): Promise<DealRow> {
    const result = await client.query<DealRow>(
      `
        SELECT opportunities.id, opportunities.name, opportunities.amount, opportunities.metadata,
          accounts.id AS account_id, accounts.name AS account_name,
          owner_users.id AS owner_id, owner_users.display_name AS owner_display_name, owner_users.email AS owner_email, owner_teams.name AS owner_team_name, owner_departments.name AS owner_department_name,
          stage_values.id AS stage_id, stage_values.value_key AS stage_key, stage_values.label AS stage_label, stage_values.description AS stage_description, stage_values.color AS stage_color, stage_values.is_default AS stage_is_default, stage_values.is_active AS stage_is_active
        FROM opportunities
        INNER JOIN tenant_option_values AS stage_values ON stage_values.id = opportunities.stage_option_id AND stage_values.tenant_id = opportunities.tenant_id
        LEFT JOIN accounts ON accounts.id = opportunities.account_id AND accounts.tenant_id = opportunities.tenant_id
        LEFT JOIN users AS owner_users ON owner_users.id = opportunities.owner_id AND owner_users.tenant_id = opportunities.tenant_id
        LEFT JOIN teams AS owner_teams ON owner_teams.id = owner_users.team_id
        LEFT JOIN departments AS owner_departments ON owner_departments.id = owner_users.department_id
        WHERE opportunities.id = $1 AND opportunities.tenant_id = $2 AND opportunities.deleted_at IS NULL
      `,
      [opportunityId, tenantId]
    );
    if (result.rowCount === 0) {
      throw new AppError(404, "Opportunity was not found.", undefined, "NOT_FOUND");
    }
    return result.rows[0];
  }

  // ---- SH-004 Win/loss analytics ----------------------------------------------------------------

  async getWinLossAnalytics(actor: ActorContext, query: RevenueDashboardQuery): Promise<WinLossAnalyticsResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const conditions = ["opportunities.tenant_id = $1", "opportunities.deleted_at IS NULL", "outcome_values.value_key IN ('won','lost')"];
      const params: unknown[] = [actor.tenantId];
      const addFilter = (sql: string, value: unknown) => {
        params.push(value);
        conditions.push(sql.replace("$$", `$${params.length}`));
      };
      if (query.from) addFilter("opportunities.expected_close_date >= $$::date", query.from);
      if (query.to) addFilter("opportunities.expected_close_date <= $$::date", query.to);
      if (query.teamId) addFilter("owner_users.team_id = $$", query.teamId);

      const result = await client.query<{ outcome_key: string; amount: string | null; competitor: string | null; win_loss_reason: string | null; owner_name: string | null; product: string | null; segment: string | null; region: string | null }>(
        `
          SELECT outcome_values.value_key AS outcome_key, opportunities.amount, opportunities.competitor, opportunities.win_loss_reason,
            owner_users.display_name AS owner_name,
            opportunities.metadata->>'product' AS product,
            opportunities.metadata->>'segment' AS segment,
            opportunities.metadata->>'region' AS region
          FROM opportunities
          INNER JOIN tenant_option_values AS outcome_values ON outcome_values.id = opportunities.outcome_status_option_id AND outcome_values.tenant_id = opportunities.tenant_id
          LEFT JOIN users AS owner_users ON owner_users.id = opportunities.owner_id AND owner_users.tenant_id = opportunities.tenant_id
          WHERE ${conditions.join(" AND ")}
        `,
        params
      );

      const dims: Record<"byLossReason" | "byCompetitor" | "byRep" | "byProduct" | "bySegment" | "byGeography", Map<string, { won: number; lost: number; wonValue: number; lostValue: number }>> = {
        byLossReason: new Map(),
        byCompetitor: new Map(),
        byRep: new Map(),
        byProduct: new Map(),
        bySegment: new Map(),
        byGeography: new Map()
      };
      const bump = (map: Map<string, { won: number; lost: number; wonValue: number; lostValue: number }>, label: string | null, won: boolean, amount: number) => {
        const key = trimmed(label) ?? "Unspecified";
        const entry = map.get(key) ?? { won: 0, lost: 0, wonValue: 0, lostValue: 0 };
        if (won) {
          entry.won += 1;
          entry.wonValue += amount;
        } else {
          entry.lost += 1;
          entry.lostValue += amount;
        }
        map.set(key, entry);
      };

      let totalWon = 0;
      let totalLost = 0;
      let wonValue = 0;
      let lostValue = 0;
      for (const row of result.rows) {
        const won = row.outcome_key === "won";
        const amount = num(row.amount);
        if (won) {
          totalWon += 1;
          wonValue += amount;
        } else {
          totalLost += 1;
          lostValue += amount;
        }
        if (!won) {
          bump(dims.byLossReason, row.win_loss_reason, won, amount);
        }
        bump(dims.byCompetitor, row.competitor, won, amount);
        bump(dims.byRep, row.owner_name, won, amount);
        bump(dims.byProduct, row.product, won, amount);
        bump(dims.bySegment, row.segment, won, amount);
        bump(dims.byGeography, row.region, won, amount);
      }

      const toEntries = (map: Map<string, { won: number; lost: number; wonValue: number; lostValue: number }>): WinLossDimensionEntry[] =>
        Array.from(map.entries())
          .map(([label, value]) => ({ label, wonCount: value.won, lostCount: value.lost, wonValue: value.wonValue, lostValue: value.lostValue, winRate: computeWinRate(value.won, value.lost) }))
          .sort((a, b) => b.wonCount + b.lostCount - (a.wonCount + a.lostCount));

      return {
        totalWon,
        totalLost,
        wonValue,
        lostValue,
        winRate: computeWinRate(totalWon, totalLost),
        byLossReason: toEntries(dims.byLossReason),
        byCompetitor: toEntries(dims.byCompetitor),
        byRep: toEntries(dims.byRep),
        byProduct: toEntries(dims.byProduct),
        bySegment: toEntries(dims.bySegment),
        byGeography: toEntries(dims.byGeography),
        aiPlaceholder: AI_PLACEHOLDER("AI win/loss pattern detection will connect with the AI Gateway phase.")
      };
    });
  }

  async reviveLostDeal(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: ReviveLostDealRequestBody): Promise<{ success: true }> {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<{ metadata: Record<string, unknown> | null; outcome_key: string }>(
        `
          SELECT opportunities.metadata, outcome_values.value_key AS outcome_key
          FROM opportunities
          INNER JOIN tenant_option_values AS outcome_values ON outcome_values.id = opportunities.outcome_status_option_id AND outcome_values.tenant_id = opportunities.tenant_id
          WHERE opportunities.id = $1 AND opportunities.tenant_id = $2 AND opportunities.deleted_at IS NULL
        `,
        [opportunityId, actor.tenantId]
      );
      if (result.rowCount === 0) {
        throw new AppError(404, "Opportunity was not found.", undefined, "NOT_FOUND");
      }
      if (result.rows[0].outcome_key !== "lost") {
        throw new AppError(409, "Only closed-lost opportunities can be assigned for revival.", undefined, "INVALID_STATE");
      }
      const newOwnerId = await this.ensureUserId(client, actor.tenantId, input.ownerId);
      if (!newOwnerId) {
        throw new AppError(400, "A valid owner is required to assign the deal for revival.", undefined, "VALIDATION_ERROR");
      }
      const metadata = getMetadata(result.rows[0].metadata);
      const revival = { assignedBy: actor.userId, ownerId: newOwnerId, note: trimmed(input.note ?? null), assignedAt: new Date().toISOString() };
      await client.query(
        `UPDATE opportunities SET owner_id = $3, metadata = $4::jsonb, updated_by = $5 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [opportunityId, actor.tenantId, newOwnerId, JSON.stringify({ ...metadata, revival }), actor.userId]
      );
      await this.notificationService.createNotificationWithClient(client, actor, audit, {
        notificationType: "record_assignment",
        recipientUserId: newOwnerId,
        title: "Lost deal assigned for revival",
        message: revival.note ?? "A closed-lost opportunity has been assigned to you for a fresh attempt.",
        linkedRecord: { entityType: "opportunity", entityId: opportunityId }
      });
      await this.recordAuditLog(client, actor, audit, { action: "opportunity.revive", resourceType: "opportunity", resourceId: opportunityId, status: "success", metadata: { ownerId: newOwnerId } });
      return { success: true };
    });
  }
}

interface QuotaRow {
  id: string;
  name: string;
  period_type: "month" | "quarter" | "year";
  period_start: string;
  period_end: string;
  owner_id: string | null;
  team_id: string | null;
  product: string | null;
  region: string | null;
  segment: string | null;
  target_amount: string | number;
  parent_quota_id: string | null;
  owner_display_name?: string | null;
  owner_email?: string | null;
  owner_team_name?: string | null;
  owner_department_name?: string | null;
  team_name?: string | null;
}

interface DealRow {
  id: string;
  name: string;
  amount: string | number | null;
  metadata: Record<string, unknown> | null;
  account_id: string | null;
  account_name: string | null;
  owner_id: string | null;
  owner_display_name: string | null;
  owner_email: string | null;
  owner_team_name: string | null;
  owner_department_name: string | null;
  stage_id: string | null;
  stage_key: string | null;
  stage_label: string | null;
  stage_description: string | null;
  stage_color: string | null;
  stage_is_default: boolean | null;
  stage_is_active: boolean | null;
}
