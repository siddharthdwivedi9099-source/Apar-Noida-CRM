import type {
  AccountLookupSummary,
  AdoptionMetricSummary,
  AdoptionMetricTrend,
  CreateAdoptionMetricRequestBody,
  CreateCustomerSuccessAccountRequestBody,
  CreateEscalationRequestBody,
  CreateQbrRequestBody,
  CreateRenewalRequestBody,
  CrmLookupUserSummary,
  CrmMutationSuccessResponse,
  CrmOptionValueSummary,
  CrmPagination,
  CsAiPlaceholderSummary,
  CsStakeholder,
  CsSupportTrend,
  CsTrainingStatus,
  CustomerHealthDashboardResponse,
  CustomerHealthScoreSummary,
  CustomerSuccessAccountDetail,
  CustomerSuccessAccountListQuery,
  CustomerSuccessAccountResponse,
  CustomerSuccessAccountsResponse,
  CustomerSuccessAccountSummary,
  CustomerSuccessDashboardResponse,
  CustomerSuccessOptionsResponse,
  CustomerSuccessScope,
  CsEnterpriseWorkspaceResponse,
  CsOnboardingWorkspaceResponse,
  CsScaledWorkspaceResponse,
  EscalationSeverity,
  EscalationStatus,
  EscalationSummary,
  OnboardingMilestoneInput,
  OnboardingMilestoneStatus,
  OnboardingMilestoneSummary,
  OnboardingPlanStatus,
  OnboardingPlanSummary,
  ProductActivationStatus,
  QbrStatus,
  QbrSummary,
  QbrType,
  RecordHealthScoreRequestBody,
  RenewalDashboardResponse,
  RenewalSummary,
  RoleSummary,
  SuccessPlanStatus,
  SuccessPlanSummary,
  UpdateCustomerSuccessAccountRequestBody,
  UpdateEscalationRequestBody,
  UpdateQbrRequestBody,
  UpdateRenewalRequestBody,
  UpsertOnboardingPlanRequestBody,
  UpsertSuccessPlanRequestBody
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

interface UserLookupRow {
  id: string;
  display_name: string;
  email: string;
  team_name: string | null;
  department_name: string | null;
}

interface OptionValueRow {
  id: string;
  key: string;
  label: string;
  description: string | null;
  color: string | null;
  is_default: boolean;
  is_active: boolean;
}

interface AccountLookupRow {
  id: string;
  name: string;
  website: string | null;
}

const SUPPORT_TRENDS: CsSupportTrend[] = ["improving", "stable", "declining"];
const TRAINING_STATUSES: CsTrainingStatus[] = ["not_started", "in_progress", "completed"];
const PLAN_STATUSES: OnboardingPlanStatus[] = ["not_started", "in_progress", "completed", "blocked"];
const ACTIVATION_STATUSES: ProductActivationStatus[] = ["not_started", "in_progress", "activated"];
const MILESTONE_STATUSES: OnboardingMilestoneStatus[] = ["pending", "in_progress", "completed", "blocked"];
const SUCCESS_PLAN_STATUSES: SuccessPlanStatus[] = ["draft", "active", "completed"];
const ADOPTION_TRENDS: AdoptionMetricTrend[] = ["up", "flat", "down"];
const QBR_TYPES: QbrType[] = ["qbr", "ebr"];
const QBR_STATUSES: QbrStatus[] = ["scheduled", "completed", "cancelled"];
const ESCALATION_SEVERITIES: EscalationSeverity[] = ["low", "medium", "high", "critical"];
const ESCALATION_STATUSES: EscalationStatus[] = ["open", "in_progress", "resolved", "closed"];
const OPEN_ESCALATION_STATUSES = new Set(["open", "in_progress"]);

function toIsoString(value: Date | null) {
  return value ? value.toISOString() : null;
}

function getMetadata(value: Record<string, unknown> | null | undefined) {
  return value ?? {};
}

function getTrimmedNullableString(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function parseNumeric(value: string | number | null) {
  if (value === null || value === undefined) {
    return null;
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function averageOf(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

function normalizeFromList<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return list.includes(value as T) ? (value as T) : fallback;
}

function mapUser(input: {
  id: string | null;
  displayName: string | null;
  email: string | null;
  teamName: string | null;
  departmentName: string | null;
}): CrmLookupUserSummary | null {
  if (!input.id || !input.displayName || !input.email) {
    return null;
  }

  return { id: input.id, displayName: input.displayName, email: input.email, teamName: input.teamName, departmentName: input.departmentName };
}

function mapOptionValue(input: {
  id: string | null;
  key: string | null;
  label: string | null;
  description: string | null;
  color: string | null;
  isDefault: boolean | null;
  isActive: boolean | null;
}): CrmOptionValueSummary | null {
  if (!input.id || !input.key || !input.label) {
    return null;
  }

  return {
    id: input.id,
    key: input.key,
    label: input.label,
    description: input.description,
    color: input.color,
    isDefault: Boolean(input.isDefault),
    isActive: Boolean(input.isActive)
  };
}

function normalizeStakeholders(value: unknown): CsStakeholder[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: CsStakeholder[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }

    const item = entry as Partial<Record<keyof CsStakeholder, unknown>>;
    const name = typeof item.name === "string" ? item.name.trim() : "";

    if (name.length === 0) {
      continue;
    }

    result.push({
      name,
      title: typeof item.title === "string" ? item.title.trim() || null : null,
      role: typeof item.role === "string" ? item.role.trim() || null : null,
      sentiment: typeof item.sentiment === "string" ? item.sentiment.trim() || null : null
    });
  }

  return result;
}

function buildPagination(page: number, pageSize: number, total: number): CrmPagination {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  return { page, pageSize, total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 };
}

export class CustomerSuccessService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {}

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "Customer success is unavailable until the database connection is enabled.", undefined, "CUSTOMER_SUCCESS_UNAVAILABLE");
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
      [
        actor.tenantId, actor.userId, actor.sessionId, input.action, input.resourceType, input.resourceId ?? null, input.status,
        audit.ipAddress ?? "", audit.userAgent ?? null, audit.requestId, JSON.stringify(input.metadata ?? {})
      ]
    );
  }

  private async loadOwners(client: PoolClient, tenantId: string): Promise<CrmLookupUserSummary[]> {
    const result = await client.query<UserLookupRow>(
      `
        SELECT users.id, users.display_name, users.email, teams.name AS team_name, departments.name AS department_name
        FROM users
        LEFT JOIN teams ON teams.id = users.team_id AND teams.tenant_id = users.tenant_id AND teams.deleted_at IS NULL
        LEFT JOIN departments ON departments.id = users.department_id AND departments.tenant_id = users.tenant_id AND departments.deleted_at IS NULL
        WHERE users.tenant_id = $1 AND users.deleted_at IS NULL AND users.status IN ('active', 'invited')
        ORDER BY users.display_name ASC
      `,
      [tenantId]
    );

    return result.rows.map((row) => ({ id: row.id, displayName: row.display_name, email: row.email, teamName: row.team_name, departmentName: row.department_name }));
  }

  private async loadOptionSetValues(client: PoolClient, tenantId: string, setKey: string): Promise<CrmOptionValueSummary[]> {
    const result = await client.query<OptionValueRow>(
      `
        SELECT tenant_option_values.id, tenant_option_values.value_key AS key, tenant_option_values.label, tenant_option_values.description,
          tenant_option_values.color, tenant_option_values.is_default, tenant_option_values.is_active
        FROM tenant_option_sets
        INNER JOIN tenant_option_values ON tenant_option_values.option_set_id = tenant_option_sets.id AND tenant_option_values.tenant_id = tenant_option_sets.tenant_id
        WHERE tenant_option_sets.tenant_id = $1 AND tenant_option_sets.set_key = $2 AND tenant_option_sets.deleted_at IS NULL AND tenant_option_values.deleted_at IS NULL
        ORDER BY tenant_option_values.sort_order ASC, tenant_option_values.label ASC
      `,
      [tenantId, setKey]
    );

    return result.rows.map((row) => ({
      id: row.id, key: row.key, label: row.label, description: row.description, color: row.color, isDefault: row.is_default, isActive: row.is_active
    }));
  }

  private async loadAccountsLookup(client: PoolClient, tenantId: string): Promise<AccountLookupSummary[]> {
    const result = await client.query<AccountLookupRow>(
      `SELECT id, name, website FROM accounts WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY name ASC`,
      [tenantId]
    );

    return result.rows.map((row) => ({ id: row.id, name: row.name, website: row.website }));
  }

  private async resolveOptionValueId(client: PoolClient, tenantId: string, setKey: string, valueKey: string, label: string) {
    const result = await client.query<{ id: string }>(
      `
        SELECT tenant_option_values.id
        FROM tenant_option_sets
        INNER JOIN tenant_option_values ON tenant_option_values.option_set_id = tenant_option_sets.id AND tenant_option_values.tenant_id = tenant_option_sets.tenant_id
        WHERE tenant_option_sets.tenant_id = $1 AND tenant_option_sets.set_key = $2 AND tenant_option_sets.deleted_at IS NULL
          AND tenant_option_values.deleted_at IS NULL AND tenant_option_values.is_active = true AND tenant_option_values.value_key = $3
        LIMIT 1
      `,
      [tenantId, setKey, valueKey.trim()]
    );

    const optionValueId = result.rows[0]?.id;

    if (!optionValueId) {
      throw new AppError(400, `${label} is invalid for this tenant.`, undefined, "INVALID_OPTION_VALUE");
    }

    return optionValueId;
  }

  private async getActorTeamId(client: PoolClient, tenantId: string, userId: string) {
    const result = await client.query<{ team_id: string | null }>(
      `SELECT team_id FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [userId, tenantId]
    );

    return result.rows[0]?.team_id ?? null;
  }

  private async ensureUserId(client: PoolClient, tenantId: string, id: string | null | undefined, code: string, label: string) {
    if (!id) {
      return null;
    }

    const result = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL AND status IN ('active', 'invited') LIMIT 1`,
      [id, tenantId]
    );

    const resolvedId = result.rows[0]?.id ?? null;

    if (!resolvedId) {
      throw new AppError(400, `The selected ${label} is invalid for this tenant.`, undefined, code);
    }

    return resolvedId;
  }

  private async ensureAccountId(client: PoolClient, tenantId: string, id: string) {
    const result = await client.query<{ id: string }>(
      `SELECT id FROM accounts WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [id, tenantId]
    );

    const resolvedId = result.rows[0]?.id ?? null;

    if (!resolvedId) {
      throw new AppError(400, "The selected account is invalid for this tenant.", undefined, "INVALID_ACCOUNT");
    }

    return resolvedId;
  }

  private getSharedScopePermissions(actor: ActorContext) {
    return (
      actor.permissionCodes.includes("customer_success.assign") ||
      actor.permissionCodes.includes("customer_success.configure") ||
      actor.permissionCodes.includes("customer_success.view_dashboard") ||
      actor.permissionCodes.includes("customer_success.manage_workflow") ||
      actor.permissionCodes.includes("dashboards.view_dashboard")
    );
  }

  private async getAvailableScopes(client: PoolClient, actor: ActorContext): Promise<CustomerSuccessScope[]> {
    if (!this.getSharedScopePermissions(actor)) {
      return ["mine"];
    }

    const actorTeamId = await this.getActorTeamId(client, actor.tenantId, actor.userId);
    return actorTeamId ? ["mine", "team", "all"] : ["mine", "all"];
  }

  private async resolveScope(client: PoolClient, actor: ActorContext, requestedScope: CustomerSuccessScope | undefined): Promise<CustomerSuccessScope> {
    const availableScopes = await this.getAvailableScopes(client, actor);
    const effectiveScope = requestedScope ?? (availableScopes.includes("all") ? "all" : "mine");

    if (!availableScopes.includes(effectiveScope)) {
      throw new AppError(403, "You do not have permission to inspect this scope.", undefined, "AUTHORIZATION_ERROR");
    }

    return effectiveScope;
  }

  private buildAiPlaceholders(actor: ActorContext): CsAiPlaceholderSummary {
    const permissionCodes = new Set(actor.permissionCodes);
    const canUseAi =
      permissionCodes.has("customer_success.use_ai") || permissionCodes.has("customer_success.manage_ai") || permissionCodes.has("ai.use_ai") || permissionCodes.has("ai.manage_ai");
    const canManageAi = permissionCodes.has("customer_success.manage_ai") || permissionCodes.has("ai.manage_ai");

    return {
      actions: canUseAi
        ? [
            { key: "onboarding_plan_generator", label: "Onboarding plan generator", description: "Placeholder entry point for future onboarding plan generation." },
            { key: "customer_health_summary", label: "Customer health summary", description: "Placeholder entry point for future health summarization." },
            { key: "churn_risk_prediction", label: "Churn risk prediction", description: "Placeholder entry point for future churn risk prediction." },
            { key: "adoption_recommendation", label: "Adoption recommendation", description: "Placeholder entry point for future adoption recommendations." },
            { key: "qbr_ebr_summary", label: "QBR/EBR summary", description: "Placeholder entry point for future QBR and EBR summarization." },
            { key: "executive_account_brief", label: "Executive account brief", description: "Placeholder entry point for future executive account briefs." },
            { key: "renewal_strategy_recommendation", label: "Renewal strategy recommendation", description: "Placeholder entry point for future renewal strategy recommendations." },
            { key: "customer_success_email_draft", label: "Customer success email draft", description: "Placeholder entry point for future customer success email drafting." }
          ]
        : [],
      governanceHint: canManageAi
        ? "AI placeholders are visible and will later connect to the governed AI Gateway with customer-success controls."
        : canUseAi
          ? "AI placeholders are visible for this role, but execution remains deferred until the AI Gateway phase."
          : "AI placeholders remain hidden until the role includes customer success or global AI usage permissions."
    };
  }

  private async getCsAccountState(client: PoolClient, tenantId: string, csAccountId: string) {
    const result = await client.query<{ id: string; csm_owner_id: string | null }>(
      `SELECT id, csm_owner_id FROM customer_success_accounts WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [csAccountId, tenantId]
    );

    const row = result.rows[0];

    if (!row) {
      throw new AppError(404, "Customer success account not found.", undefined, "CS_ACCOUNT_NOT_FOUND");
    }

    return row;
  }

  private assertAccountMutation(actor: ActorContext, keys: string[]) {
    if (keys.length === 0) {
      throw new AppError(400, "At least one field must be updated.", undefined, "VALIDATION_ERROR");
    }

    const canEdit = actor.permissionCodes.includes("customer_success.edit") || actor.permissionCodes.includes("customer_success.configure");
    const canAssign = actor.permissionCodes.includes("customer_success.assign") || actor.permissionCodes.includes("customer_success.configure");
    const ownerOnlyMutation = keys.every((key) => key === "csmOwnerId");

    if (!canEdit && !(canAssign && ownerOnlyMutation)) {
      throw new AppError(403, "You do not have permission to update this customer success account.", undefined, "AUTHORIZATION_ERROR");
    }

    if (!canAssign && keys.includes("csmOwnerId")) {
      throw new AppError(403, "You do not have permission to reassign customer success ownership.", undefined, "AUTHORIZATION_ERROR");
    }
  }

  private assertChildMutation(actor: ActorContext) {
    const canMutate =
      actor.permissionCodes.includes("customer_success.edit") ||
      actor.permissionCodes.includes("customer_success.create") ||
      actor.permissionCodes.includes("customer_success.configure") ||
      actor.permissionCodes.includes("customer_success.manage_workflow");

    if (!canMutate) {
      throw new AppError(403, "You do not have permission to update customer success records.", undefined, "AUTHORIZATION_ERROR");
    }
  }

  private accountSelectColumns() {
    return `
      customer_success_accounts.id,
      customer_success_accounts.health_score,
      customer_success_accounts.adoption_score,
      customer_success_accounts.renewal_date,
      customer_success_accounts.contract_value,
      customer_success_accounts.support_trend,
      customer_success_accounts.training_status,
      customer_success_accounts.last_touchpoint_at,
      customer_success_accounts.next_action,
      customer_success_accounts.metadata,
      customer_success_accounts.created_at,
      customer_success_accounts.updated_at,
      customer_success_accounts.account_id,
      cs_accounts.name AS account_name,
      cs_accounts.website AS account_website,
      owner_users.id AS owner_id, owner_users.display_name AS owner_display_name, owner_users.email AS owner_email,
      owner_teams.name AS owner_team_name, owner_departments.name AS owner_department_name,
      segment_values.id AS segment_id, segment_values.value_key AS segment_key, segment_values.label AS segment_label,
      segment_values.description AS segment_description, segment_values.color AS segment_color, segment_values.is_default AS segment_is_default, segment_values.is_active AS segment_is_active,
      lifecycle_values.id AS lifecycle_id, lifecycle_values.value_key AS lifecycle_key, lifecycle_values.label AS lifecycle_label,
      lifecycle_values.description AS lifecycle_description, lifecycle_values.color AS lifecycle_color, lifecycle_values.is_default AS lifecycle_is_default, lifecycle_values.is_active AS lifecycle_is_active,
      risk_values.id AS risk_id, risk_values.value_key AS risk_key, risk_values.label AS risk_label,
      risk_values.description AS risk_description, risk_values.color AS risk_color, risk_values.is_default AS risk_is_default, risk_values.is_active AS risk_is_active,
      expansion_values.id AS expansion_id, expansion_values.value_key AS expansion_key, expansion_values.label AS expansion_label,
      expansion_values.description AS expansion_description, expansion_values.color AS expansion_color, expansion_values.is_default AS expansion_is_default, expansion_values.is_active AS expansion_is_active,
      COALESCE(plan_counts.count, 0)::int AS onboarding_plan_count,
      COALESCE(health_counts.count, 0)::int AS health_score_count,
      COALESCE(qbr_counts.count, 0)::int AS qbr_count,
      COALESCE(renewal_counts.count, 0)::int AS renewal_count,
      COALESCE(escalation_counts.open_count, 0)::int AS open_escalation_count
    `;
  }

  private accountFromClause() {
    return `
      FROM customer_success_accounts
      INNER JOIN accounts AS cs_accounts ON cs_accounts.id = customer_success_accounts.account_id AND cs_accounts.tenant_id = customer_success_accounts.tenant_id
      INNER JOIN tenant_option_values AS segment_values ON segment_values.id = customer_success_accounts.segment_option_id AND segment_values.tenant_id = customer_success_accounts.tenant_id
      INNER JOIN tenant_option_values AS lifecycle_values ON lifecycle_values.id = customer_success_accounts.lifecycle_stage_option_id AND lifecycle_values.tenant_id = customer_success_accounts.tenant_id
      INNER JOIN tenant_option_values AS risk_values ON risk_values.id = customer_success_accounts.risk_status_option_id AND risk_values.tenant_id = customer_success_accounts.tenant_id
      INNER JOIN tenant_option_values AS expansion_values ON expansion_values.id = customer_success_accounts.expansion_potential_option_id AND expansion_values.tenant_id = customer_success_accounts.tenant_id
      LEFT JOIN users AS owner_users ON owner_users.id = customer_success_accounts.csm_owner_id AND owner_users.tenant_id = customer_success_accounts.tenant_id AND owner_users.deleted_at IS NULL
      LEFT JOIN teams AS owner_teams ON owner_teams.id = owner_users.team_id AND owner_teams.tenant_id = owner_users.tenant_id AND owner_teams.deleted_at IS NULL
      LEFT JOIN departments AS owner_departments ON owner_departments.id = owner_users.department_id AND owner_departments.tenant_id = owner_users.tenant_id AND owner_departments.deleted_at IS NULL
      LEFT JOIN (SELECT tenant_id, cs_account_id, COUNT(*) AS count FROM onboarding_plans WHERE deleted_at IS NULL GROUP BY tenant_id, cs_account_id) AS plan_counts
        ON plan_counts.tenant_id = customer_success_accounts.tenant_id AND plan_counts.cs_account_id = customer_success_accounts.id
      LEFT JOIN (SELECT tenant_id, cs_account_id, COUNT(*) AS count FROM customer_health_scores WHERE deleted_at IS NULL GROUP BY tenant_id, cs_account_id) AS health_counts
        ON health_counts.tenant_id = customer_success_accounts.tenant_id AND health_counts.cs_account_id = customer_success_accounts.id
      LEFT JOIN (SELECT tenant_id, cs_account_id, COUNT(*) AS count FROM qbrs WHERE deleted_at IS NULL GROUP BY tenant_id, cs_account_id) AS qbr_counts
        ON qbr_counts.tenant_id = customer_success_accounts.tenant_id AND qbr_counts.cs_account_id = customer_success_accounts.id
      LEFT JOIN (SELECT tenant_id, cs_account_id, COUNT(*) AS count FROM renewals WHERE deleted_at IS NULL GROUP BY tenant_id, cs_account_id) AS renewal_counts
        ON renewal_counts.tenant_id = customer_success_accounts.tenant_id AND renewal_counts.cs_account_id = customer_success_accounts.id
      LEFT JOIN (SELECT tenant_id, cs_account_id, COUNT(*) FILTER (WHERE status IN ('open', 'in_progress')) AS open_count FROM escalations WHERE deleted_at IS NULL GROUP BY tenant_id, cs_account_id) AS escalation_counts
        ON escalation_counts.tenant_id = customer_success_accounts.tenant_id AND escalation_counts.cs_account_id = customer_success_accounts.id
    `;
  }

  private mapAccountSummary(row: CsAccountRow): CustomerSuccessAccountSummary {
    return {
      id: row.id,
      account: row.account_id ? { id: row.account_id, name: row.account_name ?? "", website: row.account_website } : null,
      csmOwner: mapUser({
        id: row.owner_id, displayName: row.owner_display_name, email: row.owner_email, teamName: row.owner_team_name, departmentName: row.owner_department_name
      }),
      segment: mapOptionValue({ id: row.segment_id, key: row.segment_key, label: row.segment_label, description: row.segment_description, color: row.segment_color, isDefault: row.segment_is_default, isActive: row.segment_is_active }),
      lifecycleStage: mapOptionValue({ id: row.lifecycle_id, key: row.lifecycle_key, label: row.lifecycle_label, description: row.lifecycle_description, color: row.lifecycle_color, isDefault: row.lifecycle_is_default, isActive: row.lifecycle_is_active }),
      riskStatus: mapOptionValue({ id: row.risk_id, key: row.risk_key, label: row.risk_label, description: row.risk_description, color: row.risk_color, isDefault: row.risk_is_default, isActive: row.risk_is_active }),
      expansionPotential: mapOptionValue({ id: row.expansion_id, key: row.expansion_key, label: row.expansion_label, description: row.expansion_description, color: row.expansion_color, isDefault: row.expansion_is_default, isActive: row.expansion_is_active }),
      healthScore: row.health_score,
      adoptionScore: row.adoption_score,
      renewalDate: row.renewal_date,
      contractValue: parseNumeric(row.contract_value),
      supportTrend: normalizeFromList(SUPPORT_TRENDS, row.support_trend, "stable"),
      trainingStatus: normalizeFromList(TRAINING_STATUSES, row.training_status, "not_started"),
      lastTouchpointAt: toIsoString(row.last_touchpoint_at),
      nextAction: row.next_action,
      onboardingPlanCount: row.onboarding_plan_count,
      healthScoreCount: row.health_score_count,
      qbrCount: row.qbr_count,
      renewalCount: row.renewal_count,
      openEscalationCount: row.open_escalation_count,
      metadata: getMetadata(row.metadata),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  async getOptions(actor: ActorContext): Promise<CustomerSuccessOptionsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => ({
      owners: await this.loadOwners(client, actor.tenantId),
      accounts: await this.loadAccountsLookup(client, actor.tenantId),
      segments: await this.loadOptionSetValues(client, actor.tenantId, "cs-segment"),
      lifecycleStages: await this.loadOptionSetValues(client, actor.tenantId, "customer-success-stage"),
      riskStatuses: await this.loadOptionSetValues(client, actor.tenantId, "cs-risk-status"),
      expansionPotentials: await this.loadOptionSetValues(client, actor.tenantId, "cs-expansion-potential"),
      renewalStatuses: await this.loadOptionSetValues(client, actor.tenantId, "cs-renewal-status"),
      availableScopes: await this.getAvailableScopes(client, actor)
    }));
  }

  private async buildScopedWhere(client: PoolClient, actor: ActorContext, scope: CustomerSuccessScope) {
    const conditions = ["customer_success_accounts.tenant_id = $1", "customer_success_accounts.deleted_at IS NULL"];
    const params: unknown[] = [actor.tenantId];

    if (scope === "mine") {
      params.push(actor.userId);
      conditions.push(`customer_success_accounts.csm_owner_id = $${params.length}`);
    } else if (scope === "team") {
      const actorTeamId = await this.getActorTeamId(client, actor.tenantId, actor.userId);
      params.push(actorTeamId);
      conditions.push(`owner_users.team_id = $${params.length}`);
    }

    return { conditions, params };
  }

  private async loadScopedAccounts(client: PoolClient, actor: ActorContext, scope: CustomerSuccessScope, extraConditions: string[] = [], extraParams: unknown[] = []) {
    const { conditions, params } = await this.buildScopedWhere(client, actor, scope);
    const allParams = [...params, ...extraParams];
    const whereClause = [...conditions, ...extraConditions].join(" AND ");
    const result = await client.query<CsAccountRow>(
      `SELECT ${this.accountSelectColumns()} ${this.accountFromClause()} WHERE ${whereClause} ORDER BY customer_success_accounts.updated_at DESC`,
      allParams
    );
    return result.rows.map((row) => this.mapAccountSummary(row));
  }

  async listAccounts(actor: ActorContext, query: CustomerSuccessAccountListQuery): Promise<CustomerSuccessAccountsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const scope = await this.resolveScope(client, actor, query.scope);
      const page = Math.max(1, query.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
      const { conditions, params } = await this.buildScopedWhere(client, actor, scope);

      if (query.search) {
        params.push(`%${query.search.trim()}%`);
        conditions.push(`(cs_accounts.name ILIKE $${params.length} OR customer_success_accounts.next_action ILIKE $${params.length})`);
      }
      if (query.segment) {
        params.push(query.segment);
        conditions.push(`segment_values.value_key = $${params.length}`);
      }
      if (query.lifecycleStage) {
        params.push(query.lifecycleStage);
        conditions.push(`lifecycle_values.value_key = $${params.length}`);
      }
      if (query.riskStatus) {
        params.push(query.riskStatus);
        conditions.push(`risk_values.value_key = $${params.length}`);
      }
      if (query.csmOwnerId) {
        params.push(query.csmOwnerId);
        conditions.push(`customer_success_accounts.csm_owner_id = $${params.length}`);
      }

      const whereClause = conditions.join(" AND ");
      const sortColumnMap: Record<string, string> = {
        account: "cs_accounts.name",
        healthScore: "customer_success_accounts.health_score",
        adoptionScore: "customer_success_accounts.adoption_score",
        renewalDate: "customer_success_accounts.renewal_date",
        updatedAt: "customer_success_accounts.updated_at",
        createdAt: "customer_success_accounts.created_at"
      };
      const sortColumn = sortColumnMap[query.sortBy ?? "updatedAt"] ?? "customer_success_accounts.updated_at";
      const sortOrder = query.sortOrder === "asc" ? "ASC" : "DESC";

      const countResult = await client.query<{ total: string }>(`SELECT COUNT(*)::text AS total ${this.accountFromClause()} WHERE ${whereClause}`, params);
      const total = Number(countResult.rows[0]?.total ?? "0");

      const listParams = [...params, pageSize, (page - 1) * pageSize];
      const listResult = await client.query<CsAccountRow>(
        `SELECT ${this.accountSelectColumns()} ${this.accountFromClause()} WHERE ${whereClause} ORDER BY ${sortColumn} ${sortOrder} NULLS LAST, customer_success_accounts.created_at DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams
      );

      return {
        customerSuccessAccounts: listResult.rows.map((row) => this.mapAccountSummary(row)),
        pagination: buildPagination(page, pageSize, total)
      };
    });
  }

  private async loadOnboardingPlans(client: PoolClient, tenantId: string, csAccountId: string): Promise<OnboardingPlanSummary[]> {
    const plansResult = await client.query<OnboardingPlanRow>(
      `
        SELECT id, name, status, start_date, target_go_live_date, product_activation_status, first_value_at, training_completion, risk_notes, handover_notes, created_at, updated_at
        FROM onboarding_plans WHERE tenant_id = $1 AND cs_account_id = $2 AND deleted_at IS NULL ORDER BY created_at DESC
      `,
      [tenantId, csAccountId]
    );

    if (plansResult.rows.length === 0) {
      return [];
    }

    const planIds = plansResult.rows.map((row) => row.id);
    const milestonesResult = await client.query<OnboardingMilestoneRow>(
      `
        SELECT id, onboarding_plan_id, label, status, sort_order, due_date, completed_at, notes, created_at, updated_at
        FROM onboarding_milestones WHERE tenant_id = $1 AND onboarding_plan_id = ANY($2::uuid[]) AND deleted_at IS NULL
        ORDER BY sort_order ASC, created_at ASC
      `,
      [tenantId, planIds]
    );

    const milestonesByPlan = new Map<string, OnboardingMilestoneSummary[]>();
    for (const row of milestonesResult.rows) {
      const summary: OnboardingMilestoneSummary = {
        id: row.id,
        label: row.label,
        status: normalizeFromList(MILESTONE_STATUSES, row.status, "pending"),
        sortOrder: row.sort_order,
        dueDate: row.due_date,
        completedAt: toIsoString(row.completed_at),
        notes: row.notes,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString()
      };
      const existing = milestonesByPlan.get(row.onboarding_plan_id) ?? [];
      existing.push(summary);
      milestonesByPlan.set(row.onboarding_plan_id, existing);
    }

    return plansResult.rows.map((row) => {
      const milestones = milestonesByPlan.get(row.id) ?? [];
      return {
        id: row.id,
        name: row.name,
        status: normalizeFromList(PLAN_STATUSES, row.status, "not_started"),
        startDate: row.start_date,
        targetGoLiveDate: row.target_go_live_date,
        productActivationStatus: normalizeFromList(ACTIVATION_STATUSES, row.product_activation_status, "not_started"),
        firstValueAt: toIsoString(row.first_value_at),
        trainingCompletion: row.training_completion,
        riskNotes: row.risk_notes,
        handoverNotes: row.handover_notes,
        milestones,
        milestoneCount: milestones.length,
        completedMilestoneCount: milestones.filter((milestone) => milestone.status === "completed").length,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString()
      };
    });
  }

  private async loadSuccessPlans(client: PoolClient, tenantId: string, csAccountId: string): Promise<SuccessPlanSummary[]> {
    const result = await client.query<SuccessPlanRow>(
      `
        SELECT id, name, status, objective, value_realization, executive_sponsor, stakeholders, expansion_opportunities, renewal_strategy, created_at, updated_at
        FROM success_plans WHERE tenant_id = $1 AND cs_account_id = $2 AND deleted_at IS NULL ORDER BY created_at DESC
      `,
      [tenantId, csAccountId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: normalizeFromList(SUCCESS_PLAN_STATUSES, row.status, "draft"),
      objective: row.objective,
      valueRealization: row.value_realization,
      executiveSponsor: row.executive_sponsor,
      stakeholders: normalizeStakeholders(row.stakeholders),
      expansionOpportunities: row.expansion_opportunities,
      renewalStrategy: row.renewal_strategy,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    }));
  }

  private async loadHealthScores(client: PoolClient, tenantId: string, csAccountId: string): Promise<CustomerHealthScoreSummary[]> {
    const result = await client.query<HealthScoreRow>(
      `
        SELECT customer_health_scores.id, customer_health_scores.score, customer_health_scores.drivers, customer_health_scores.notes,
          customer_health_scores.recorded_at, customer_health_scores.created_at,
          risk_values.id AS risk_id, risk_values.value_key AS risk_key, risk_values.label AS risk_label,
          risk_values.description AS risk_description, risk_values.color AS risk_color, risk_values.is_default AS risk_is_default, risk_values.is_active AS risk_is_active
        FROM customer_health_scores
        LEFT JOIN tenant_option_values AS risk_values ON risk_values.id = customer_health_scores.risk_status_option_id AND risk_values.tenant_id = customer_health_scores.tenant_id
        WHERE customer_health_scores.tenant_id = $1 AND customer_health_scores.cs_account_id = $2 AND customer_health_scores.deleted_at IS NULL
        ORDER BY customer_health_scores.recorded_at DESC LIMIT 50
      `,
      [tenantId, csAccountId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      score: row.score,
      riskStatus: mapOptionValue({ id: row.risk_id, key: row.risk_key, label: row.risk_label, description: row.risk_description, color: row.risk_color, isDefault: row.risk_is_default, isActive: row.risk_is_active }),
      drivers: row.drivers,
      notes: row.notes,
      recordedAt: row.recorded_at.toISOString(),
      createdAt: row.created_at.toISOString()
    }));
  }

  private async loadAdoptionMetrics(client: PoolClient, tenantId: string, csAccountId: string): Promise<AdoptionMetricSummary[]> {
    const result = await client.query<AdoptionMetricRow>(
      `
        SELECT id, metric_key, label, value, target, unit, trend, period_start, period_end, created_at, updated_at
        FROM adoption_metrics WHERE tenant_id = $1 AND cs_account_id = $2 AND deleted_at IS NULL ORDER BY period_end DESC NULLS LAST, created_at DESC LIMIT 50
      `,
      [tenantId, csAccountId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      metricKey: row.metric_key,
      label: row.label,
      value: Number(parseNumeric(row.value) ?? 0),
      target: parseNumeric(row.target),
      unit: row.unit,
      trend: normalizeFromList(ADOPTION_TRENDS, row.trend, "flat"),
      periodStart: row.period_start,
      periodEnd: row.period_end,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    }));
  }

  private mapUserRow(row: { owner_id: string | null; owner_display_name: string | null; owner_email: string | null; owner_team_name: string | null; owner_department_name: string | null }) {
    return mapUser({ id: row.owner_id, displayName: row.owner_display_name, email: row.owner_email, teamName: row.owner_team_name, departmentName: row.owner_department_name });
  }

  private async loadQbrs(client: PoolClient, tenantId: string, csAccountId: string): Promise<QbrSummary[]> {
    const result = await client.query<QbrRow>(
      `
        SELECT qbrs.id, qbrs.title, qbrs.qbr_type, qbrs.status, qbrs.scheduled_at, qbrs.summary, qbrs.outcomes, qbrs.next_steps, qbrs.created_at, qbrs.updated_at,
          owner_users.id AS owner_id, owner_users.display_name AS owner_display_name, owner_users.email AS owner_email, owner_teams.name AS owner_team_name, owner_departments.name AS owner_department_name
        FROM qbrs
        LEFT JOIN users AS owner_users ON owner_users.id = qbrs.owner_id AND owner_users.tenant_id = qbrs.tenant_id AND owner_users.deleted_at IS NULL
        LEFT JOIN teams AS owner_teams ON owner_teams.id = owner_users.team_id AND owner_teams.tenant_id = owner_users.tenant_id AND owner_teams.deleted_at IS NULL
        LEFT JOIN departments AS owner_departments ON owner_departments.id = owner_users.department_id AND owner_departments.tenant_id = owner_users.tenant_id AND owner_departments.deleted_at IS NULL
        WHERE qbrs.tenant_id = $1 AND qbrs.cs_account_id = $2 AND qbrs.deleted_at IS NULL ORDER BY qbrs.scheduled_at DESC NULLS LAST, qbrs.created_at DESC
      `,
      [tenantId, csAccountId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      qbrType: normalizeFromList(QBR_TYPES, row.qbr_type, "qbr"),
      status: normalizeFromList(QBR_STATUSES, row.status, "scheduled"),
      scheduledAt: toIsoString(row.scheduled_at),
      summary: row.summary,
      outcomes: row.outcomes,
      nextSteps: row.next_steps,
      owner: this.mapUserRow(row),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    }));
  }

  private async loadRenewals(client: PoolClient, tenantId: string, csAccountId: string): Promise<RenewalSummary[]> {
    const result = await client.query<RenewalRow>(
      `
        SELECT renewals.id, renewals.renewal_date, renewals.contract_value, renewals.forecast_value, renewals.probability, renewals.risk_notes, renewals.strategy, renewals.created_at, renewals.updated_at,
          status_values.id AS status_id, status_values.value_key AS status_key, status_values.label AS status_label, status_values.description AS status_description,
          status_values.color AS status_color, status_values.is_default AS status_is_default, status_values.is_active AS status_is_active,
          owner_users.id AS owner_id, owner_users.display_name AS owner_display_name, owner_users.email AS owner_email, owner_teams.name AS owner_team_name, owner_departments.name AS owner_department_name
        FROM renewals
        INNER JOIN tenant_option_values AS status_values ON status_values.id = renewals.status_option_id AND status_values.tenant_id = renewals.tenant_id
        LEFT JOIN users AS owner_users ON owner_users.id = renewals.owner_id AND owner_users.tenant_id = renewals.tenant_id AND owner_users.deleted_at IS NULL
        LEFT JOIN teams AS owner_teams ON owner_teams.id = owner_users.team_id AND owner_teams.tenant_id = owner_users.tenant_id AND owner_teams.deleted_at IS NULL
        LEFT JOIN departments AS owner_departments ON owner_departments.id = owner_users.department_id AND owner_departments.tenant_id = owner_users.tenant_id AND owner_departments.deleted_at IS NULL
        WHERE renewals.tenant_id = $1 AND renewals.cs_account_id = $2 AND renewals.deleted_at IS NULL ORDER BY renewals.renewal_date ASC
      `,
      [tenantId, csAccountId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      renewalDate: row.renewal_date,
      status: mapOptionValue({ id: row.status_id, key: row.status_key, label: row.status_label, description: row.status_description, color: row.status_color, isDefault: row.status_is_default, isActive: row.status_is_active }),
      contractValue: parseNumeric(row.contract_value),
      forecastValue: parseNumeric(row.forecast_value),
      probability: row.probability,
      riskNotes: row.risk_notes,
      strategy: row.strategy,
      owner: this.mapUserRow(row),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    }));
  }

  private async loadEscalations(client: PoolClient, tenantId: string, csAccountId: string): Promise<EscalationSummary[]> {
    const result = await client.query<EscalationRow>(
      `
        SELECT escalations.id, escalations.title, escalations.severity, escalations.status, escalations.description, escalations.resolution, escalations.opened_at, escalations.resolved_at, escalations.created_at, escalations.updated_at,
          owner_users.id AS owner_id, owner_users.display_name AS owner_display_name, owner_users.email AS owner_email, owner_teams.name AS owner_team_name, owner_departments.name AS owner_department_name
        FROM escalations
        LEFT JOIN users AS owner_users ON owner_users.id = escalations.owner_id AND owner_users.tenant_id = escalations.tenant_id AND owner_users.deleted_at IS NULL
        LEFT JOIN teams AS owner_teams ON owner_teams.id = owner_users.team_id AND owner_teams.tenant_id = owner_users.tenant_id AND owner_teams.deleted_at IS NULL
        LEFT JOIN departments AS owner_departments ON owner_departments.id = owner_users.department_id AND owner_departments.tenant_id = owner_users.tenant_id AND owner_departments.deleted_at IS NULL
        WHERE escalations.tenant_id = $1 AND escalations.cs_account_id = $2 AND escalations.deleted_at IS NULL ORDER BY escalations.opened_at DESC
      `,
      [tenantId, csAccountId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      severity: normalizeFromList(ESCALATION_SEVERITIES, row.severity, "medium"),
      status: normalizeFromList(ESCALATION_STATUSES, row.status, "open"),
      description: row.description,
      resolution: row.resolution,
      owner: this.mapUserRow(row),
      openedAt: row.opened_at.toISOString(),
      resolvedAt: toIsoString(row.resolved_at),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    }));
  }

  private async loadAccountDetail(client: PoolClient, actor: ActorContext, csAccountId: string): Promise<CustomerSuccessAccountDetail> {
    const result = await client.query<CsAccountRow>(
      `SELECT ${this.accountSelectColumns()} ${this.accountFromClause()} WHERE customer_success_accounts.tenant_id = $1 AND customer_success_accounts.id = $2 AND customer_success_accounts.deleted_at IS NULL LIMIT 1`,
      [actor.tenantId, csAccountId]
    );

    const row = result.rows[0];

    if (!row) {
      throw new AppError(404, "Customer success account not found.", undefined, "CS_ACCOUNT_NOT_FOUND");
    }

    return {
      ...this.mapAccountSummary(row),
      onboardingPlans: await this.loadOnboardingPlans(client, actor.tenantId, csAccountId),
      successPlans: await this.loadSuccessPlans(client, actor.tenantId, csAccountId),
      healthScores: await this.loadHealthScores(client, actor.tenantId, csAccountId),
      adoptionMetrics: await this.loadAdoptionMetrics(client, actor.tenantId, csAccountId),
      qbrs: await this.loadQbrs(client, actor.tenantId, csAccountId),
      renewals: await this.loadRenewals(client, actor.tenantId, csAccountId),
      escalations: await this.loadEscalations(client, actor.tenantId, csAccountId),
      lowTouchCampaignsPlaceholder: { available: false, message: "Low-touch campaigns will connect once the lifecycle automation runtime is introduced." },
      automatedCheckInPlaceholder: { available: false, message: "Automated check-ins will connect once the lifecycle automation runtime is introduced." },
      aiPlaceholders: this.buildAiPlaceholders(actor)
    };
  }

  async getAccount(actor: ActorContext, csAccountId: string): Promise<CustomerSuccessAccountResponse> {
    this.assertEnabled();

    const customerSuccessAccount = await this.databaseService.withClient(async (client) => this.loadAccountDetail(client, actor, csAccountId));
    return { customerSuccessAccount };
  }

  async createAccount(actor: ActorContext, audit: AuditMetadata, input: CreateCustomerSuccessAccountRequestBody): Promise<CustomerSuccessAccountResponse> {
    this.assertEnabled();

    const csAccountId = await this.databaseService.withTransaction(async (client) => {
      const accountId = await this.ensureAccountId(client, actor.tenantId, input.accountId);
      const csmOwnerId = await this.ensureUserId(client, actor.tenantId, input.csmOwnerId ?? null, "INVALID_OWNER", "CSM owner");
      const segmentOptionId = await this.resolveOptionValueId(client, actor.tenantId, "cs-segment", input.segmentKey ?? "onboarding", "CS segment");
      const lifecycleOptionId = await this.resolveOptionValueId(client, actor.tenantId, "customer-success-stage", input.lifecycleStageKey ?? "onboarding", "Lifecycle stage");
      const riskOptionId = await this.resolveOptionValueId(client, actor.tenantId, "cs-risk-status", input.riskStatusKey ?? "healthy", "Risk status");
      const expansionOptionId = await this.resolveOptionValueId(client, actor.tenantId, "cs-expansion-potential", input.expansionPotentialKey ?? "low", "Expansion potential");

      const result = await client.query<{ id: string }>(
        `
          INSERT INTO customer_success_accounts (
            tenant_id, account_id, csm_owner_id, segment_option_id, lifecycle_stage_option_id, risk_status_option_id, expansion_potential_option_id,
            health_score, adoption_score, renewal_date, contract_value, support_trend, training_status, last_touchpoint_at, next_action, metadata, created_by, updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date, $11, $12, $13, $14::timestamptz, $15, $16::jsonb, $17, $17)
          RETURNING id
        `,
        [
          actor.tenantId, accountId, csmOwnerId, segmentOptionId, lifecycleOptionId, riskOptionId, expansionOptionId,
          input.healthScore ?? null, input.adoptionScore ?? null, input.renewalDate ?? null, input.contractValue ?? null,
          normalizeFromList(SUPPORT_TRENDS, input.supportTrend, "stable"), normalizeFromList(TRAINING_STATUSES, input.trainingStatus, "not_started"),
          input.lastTouchpointAt ?? null, getTrimmedNullableString(input.nextAction), JSON.stringify(input.metadata ?? {}), actor.userId
        ]
      );

      const nextId = result.rows[0]?.id;

      if (!nextId) {
        throw new AppError(500, "Customer success account creation failed.", undefined, "CS_ACCOUNT_CREATE_FAILED");
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "customer_success.account.create",
        resourceType: "customer_success_account",
        resourceId: nextId,
        status: "success",
        metadata: { accountId, csmOwnerId, segmentKey: input.segmentKey ?? "onboarding" }
      });

      return nextId;
    });

    return this.getAccount(actor, csAccountId);
  }

  async updateAccount(actor: ActorContext, audit: AuditMetadata, csAccountId: string, input: UpdateCustomerSuccessAccountRequestBody): Promise<CustomerSuccessAccountResponse> {
    this.assertEnabled();

    await this.databaseService.withTransaction(async (client) => {
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateCustomerSuccessAccountRequestBody] !== undefined);
      this.assertAccountMutation(actor, keys);
      await this.getCsAccountState(client, actor.tenantId, csAccountId);

      const assignments: string[] = [];
      const params: unknown[] = [csAccountId, actor.tenantId, actor.userId];
      const pushAssignment = (column: string, value: unknown, cast = "") => {
        params.push(value);
        assignments.push(`${column} = $${params.length}${cast}`);
      };

      if (keys.includes("csmOwnerId")) {
        pushAssignment("csm_owner_id", await this.ensureUserId(client, actor.tenantId, input.csmOwnerId ?? null, "INVALID_OWNER", "CSM owner"));
      }
      if (keys.includes("segmentKey") && input.segmentKey) {
        pushAssignment("segment_option_id", await this.resolveOptionValueId(client, actor.tenantId, "cs-segment", input.segmentKey, "CS segment"));
      }
      if (keys.includes("lifecycleStageKey") && input.lifecycleStageKey) {
        pushAssignment("lifecycle_stage_option_id", await this.resolveOptionValueId(client, actor.tenantId, "customer-success-stage", input.lifecycleStageKey, "Lifecycle stage"));
      }
      if (keys.includes("riskStatusKey") && input.riskStatusKey) {
        pushAssignment("risk_status_option_id", await this.resolveOptionValueId(client, actor.tenantId, "cs-risk-status", input.riskStatusKey, "Risk status"));
      }
      if (keys.includes("expansionPotentialKey") && input.expansionPotentialKey) {
        pushAssignment("expansion_potential_option_id", await this.resolveOptionValueId(client, actor.tenantId, "cs-expansion-potential", input.expansionPotentialKey, "Expansion potential"));
      }
      if (keys.includes("healthScore")) {
        pushAssignment("health_score", input.healthScore ?? null);
      }
      if (keys.includes("adoptionScore")) {
        pushAssignment("adoption_score", input.adoptionScore ?? null);
      }
      if (keys.includes("renewalDate")) {
        pushAssignment("renewal_date", input.renewalDate ?? null, "::date");
      }
      if (keys.includes("contractValue")) {
        pushAssignment("contract_value", input.contractValue ?? null);
      }
      if (keys.includes("supportTrend")) {
        pushAssignment("support_trend", normalizeFromList(SUPPORT_TRENDS, input.supportTrend, "stable"));
      }
      if (keys.includes("trainingStatus")) {
        pushAssignment("training_status", normalizeFromList(TRAINING_STATUSES, input.trainingStatus, "not_started"));
      }
      if (keys.includes("lastTouchpointAt")) {
        pushAssignment("last_touchpoint_at", input.lastTouchpointAt ?? null, "::timestamptz");
      }
      if (keys.includes("nextAction")) {
        pushAssignment("next_action", getTrimmedNullableString(input.nextAction));
      }
      if (keys.includes("metadata")) {
        pushAssignment("metadata", JSON.stringify(input.metadata ?? {}), "::jsonb");
      }

      if (assignments.length > 0) {
        await client.query(`UPDATE customer_success_accounts SET ${assignments.join(", ")}, updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, params);
      } else {
        await client.query(`UPDATE customer_success_accounts SET updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, params);
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "customer_success.account.update",
        resourceType: "customer_success_account",
        resourceId: csAccountId,
        status: "success",
        metadata: { updatedFields: keys }
      });
    });

    return this.getAccount(actor, csAccountId);
  }

  async deleteAccount(actor: ActorContext, audit: AuditMetadata, csAccountId: string): Promise<CrmMutationSuccessResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      await this.getCsAccountState(client, actor.tenantId, csAccountId);

      await client.query(
        `UPDATE onboarding_milestones SET deleted_at = NOW(), updated_by = $3 WHERE tenant_id = $1 AND deleted_at IS NULL AND onboarding_plan_id IN (SELECT id FROM onboarding_plans WHERE tenant_id = $1 AND cs_account_id = $2)`,
        [actor.tenantId, csAccountId, actor.userId]
      );
      for (const table of ["onboarding_plans", "success_plans", "customer_health_scores", "adoption_metrics", "qbrs", "renewals", "escalations"]) {
        await client.query(`UPDATE ${table} SET deleted_at = NOW(), updated_by = $3 WHERE tenant_id = $1 AND cs_account_id = $2 AND deleted_at IS NULL`, [actor.tenantId, csAccountId, actor.userId]);
      }
      await client.query(`UPDATE customer_success_accounts SET deleted_at = NOW(), updated_by = $3 WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`, [actor.tenantId, csAccountId, actor.userId]);

      await this.recordAuditLog(client, actor, audit, {
        action: "customer_success.account.delete",
        resourceType: "customer_success_account",
        resourceId: csAccountId,
        status: "success"
      });

      return { success: true };
    });
  }

  // ==========================================================================
  // Child records
  // ==========================================================================

  async upsertOnboardingPlan(actor: ActorContext, audit: AuditMetadata, csAccountId: string, input: UpsertOnboardingPlanRequestBody): Promise<CustomerSuccessAccountResponse> {
    this.assertEnabled();
    this.assertChildMutation(actor);

    await this.databaseService.withTransaction(async (client) => {
      await this.getCsAccountState(client, actor.tenantId, csAccountId);

      const existing = await client.query<{ id: string }>(
        `SELECT id FROM onboarding_plans WHERE tenant_id = $1 AND cs_account_id = $2 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
        [actor.tenantId, csAccountId]
      );

      let planId = existing.rows[0]?.id ?? null;

      if (planId) {
        await client.query(
          `
            UPDATE onboarding_plans SET name = $4, status = $5, start_date = $6::date, target_go_live_date = $7::date, product_activation_status = $8,
              first_value_at = $9::timestamptz, training_completion = $10, risk_notes = $11, handover_notes = $12, metadata = $13::jsonb, updated_by = $3
            WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
          `,
          [
            planId, actor.tenantId, actor.userId, input.name.trim(), normalizeFromList(PLAN_STATUSES, input.status, "not_started"),
            input.startDate ?? null, input.targetGoLiveDate ?? null, normalizeFromList(ACTIVATION_STATUSES, input.productActivationStatus, "not_started"),
            input.firstValueAt ?? null, input.trainingCompletion ?? null, getTrimmedNullableString(input.riskNotes), getTrimmedNullableString(input.handoverNotes), JSON.stringify(input.metadata ?? {})
          ]
        );
      } else {
        const inserted = await client.query<{ id: string }>(
          `
            INSERT INTO onboarding_plans (tenant_id, cs_account_id, name, status, start_date, target_go_live_date, product_activation_status, first_value_at, training_completion, risk_notes, handover_notes, metadata, created_by, updated_by)
            VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8::timestamptz, $9, $10, $11, $12::jsonb, $13, $13) RETURNING id
          `,
          [
            actor.tenantId, csAccountId, input.name.trim(), normalizeFromList(PLAN_STATUSES, input.status, "not_started"),
            input.startDate ?? null, input.targetGoLiveDate ?? null, normalizeFromList(ACTIVATION_STATUSES, input.productActivationStatus, "not_started"),
            input.firstValueAt ?? null, input.trainingCompletion ?? null, getTrimmedNullableString(input.riskNotes), getTrimmedNullableString(input.handoverNotes), JSON.stringify(input.metadata ?? {}), actor.userId
          ]
        );
        planId = inserted.rows[0]?.id ?? null;
      }

      if (!planId) {
        throw new AppError(500, "Onboarding plan upsert failed.", undefined, "ONBOARDING_PLAN_FAILED");
      }

      if (input.milestones) {
        await this.syncMilestones(client, actor, planId, input.milestones);
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "customer_success.onboarding_plan.upsert",
        resourceType: "onboarding_plan",
        resourceId: planId,
        status: "success",
        metadata: { csAccountId }
      });
    });

    return this.getAccount(actor, csAccountId);
  }

  private async syncMilestones(client: PoolClient, actor: ActorContext, planId: string, milestones: OnboardingMilestoneInput[]) {
    await client.query(`UPDATE onboarding_milestones SET deleted_at = NOW(), updated_by = $3 WHERE tenant_id = $1 AND onboarding_plan_id = $2 AND deleted_at IS NULL`, [actor.tenantId, planId, actor.userId]);

    let sortOrder = 0;
    for (const milestone of milestones) {
      const label = milestone.label.trim();
      if (label.length === 0) {
        continue;
      }
      const status = normalizeFromList(MILESTONE_STATUSES, milestone.status, "pending");
      await client.query(
        `
          INSERT INTO onboarding_milestones (tenant_id, onboarding_plan_id, label, status, sort_order, due_date, completed_at, notes, created_by, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6::date, CASE WHEN $4 = 'completed' THEN NOW() ELSE NULL END, $7, $8, $8)
        `,
        [actor.tenantId, planId, label, status, milestone.sortOrder ?? sortOrder, milestone.dueDate ?? null, getTrimmedNullableString(milestone.notes), actor.userId]
      );
      sortOrder += 1;
    }
  }

  async upsertSuccessPlan(actor: ActorContext, audit: AuditMetadata, csAccountId: string, input: UpsertSuccessPlanRequestBody): Promise<CustomerSuccessAccountResponse> {
    this.assertEnabled();
    this.assertChildMutation(actor);

    await this.databaseService.withTransaction(async (client) => {
      await this.getCsAccountState(client, actor.tenantId, csAccountId);
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM success_plans WHERE tenant_id = $1 AND cs_account_id = $2 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
        [actor.tenantId, csAccountId]
      );
      const stakeholders = JSON.stringify(normalizeStakeholders(input.stakeholders));
      let planId = existing.rows[0]?.id ?? null;

      if (planId) {
        await client.query(
          `UPDATE success_plans SET name = $4, status = $5, objective = $6, value_realization = $7, executive_sponsor = $8, stakeholders = $9::jsonb, expansion_opportunities = $10, renewal_strategy = $11, metadata = $12::jsonb, updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          [
            planId, actor.tenantId, actor.userId, input.name.trim(), normalizeFromList(SUCCESS_PLAN_STATUSES, input.status, "draft"),
            getTrimmedNullableString(input.objective), getTrimmedNullableString(input.valueRealization), getTrimmedNullableString(input.executiveSponsor),
            stakeholders, getTrimmedNullableString(input.expansionOpportunities), getTrimmedNullableString(input.renewalStrategy), JSON.stringify(input.metadata ?? {})
          ]
        );
      } else {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO success_plans (tenant_id, cs_account_id, name, status, objective, value_realization, executive_sponsor, stakeholders, expansion_opportunities, renewal_strategy, metadata, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11::jsonb, $12, $12) RETURNING id`,
          [
            actor.tenantId, csAccountId, input.name.trim(), normalizeFromList(SUCCESS_PLAN_STATUSES, input.status, "draft"),
            getTrimmedNullableString(input.objective), getTrimmedNullableString(input.valueRealization), getTrimmedNullableString(input.executiveSponsor),
            stakeholders, getTrimmedNullableString(input.expansionOpportunities), getTrimmedNullableString(input.renewalStrategy), JSON.stringify(input.metadata ?? {}), actor.userId
          ]
        );
        planId = inserted.rows[0]?.id ?? null;
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "customer_success.success_plan.upsert",
        resourceType: "success_plan",
        resourceId: planId,
        status: "success",
        metadata: { csAccountId }
      });
    });

    return this.getAccount(actor, csAccountId);
  }

  async recordHealthScore(actor: ActorContext, audit: AuditMetadata, csAccountId: string, input: RecordHealthScoreRequestBody): Promise<CustomerSuccessAccountResponse> {
    this.assertEnabled();
    this.assertChildMutation(actor);

    await this.databaseService.withTransaction(async (client) => {
      await this.getCsAccountState(client, actor.tenantId, csAccountId);
      const riskOptionId = input.riskStatusKey ? await this.resolveOptionValueId(client, actor.tenantId, "cs-risk-status", input.riskStatusKey, "Risk status") : null;

      await client.query(
        `INSERT INTO customer_health_scores (tenant_id, cs_account_id, score, risk_status_option_id, drivers, notes, metadata, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $8)`,
        [actor.tenantId, csAccountId, input.score, riskOptionId, getTrimmedNullableString(input.drivers), getTrimmedNullableString(input.notes), JSON.stringify(input.metadata ?? {}), actor.userId]
      );

      // Keep the denormalized account health score (and risk, when provided) current.
      if (riskOptionId) {
        await client.query(`UPDATE customer_success_accounts SET health_score = $3, risk_status_option_id = $4, updated_by = $5 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [csAccountId, actor.tenantId, input.score, riskOptionId, actor.userId]);
      } else {
        await client.query(`UPDATE customer_success_accounts SET health_score = $3, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [csAccountId, actor.tenantId, input.score, actor.userId]);
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "customer_success.health_score.record",
        resourceType: "customer_success_account",
        resourceId: csAccountId,
        status: "success",
        metadata: { score: input.score }
      });
    });

    return this.getAccount(actor, csAccountId);
  }

  async createAdoptionMetric(actor: ActorContext, audit: AuditMetadata, csAccountId: string, input: CreateAdoptionMetricRequestBody): Promise<CustomerSuccessAccountResponse> {
    this.assertEnabled();
    this.assertChildMutation(actor);

    await this.databaseService.withTransaction(async (client) => {
      await this.getCsAccountState(client, actor.tenantId, csAccountId);
      await client.query(
        `INSERT INTO adoption_metrics (tenant_id, cs_account_id, metric_key, label, value, target, unit, trend, period_start, period_end, metadata, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::date, $10::date, $11::jsonb, $12, $12)`,
        [
          actor.tenantId, csAccountId, input.metricKey.trim(), input.label.trim(), input.value, input.target ?? null, getTrimmedNullableString(input.unit),
          normalizeFromList(ADOPTION_TRENDS, input.trend, "flat"), input.periodStart ?? null, input.periodEnd ?? null, JSON.stringify(input.metadata ?? {}), actor.userId
        ]
      );

      await this.recordAuditLog(client, actor, audit, { action: "customer_success.adoption_metric.create", resourceType: "customer_success_account", resourceId: csAccountId, status: "success", metadata: { metricKey: input.metricKey } });
    });

    return this.getAccount(actor, csAccountId);
  }

  async createQbr(actor: ActorContext, audit: AuditMetadata, csAccountId: string, input: CreateQbrRequestBody): Promise<CustomerSuccessAccountResponse> {
    this.assertEnabled();
    this.assertChildMutation(actor);

    await this.databaseService.withTransaction(async (client) => {
      await this.getCsAccountState(client, actor.tenantId, csAccountId);
      const ownerId = await this.ensureUserId(client, actor.tenantId, input.ownerId ?? null, "INVALID_OWNER", "owner");
      await client.query(
        `INSERT INTO qbrs (tenant_id, cs_account_id, owner_id, title, qbr_type, status, scheduled_at, summary, outcomes, next_steps, metadata, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8, $9, $10, $11::jsonb, $12, $12)`,
        [
          actor.tenantId, csAccountId, ownerId, input.title.trim(), normalizeFromList(QBR_TYPES, input.qbrType, "qbr"), normalizeFromList(QBR_STATUSES, input.status, "scheduled"),
          input.scheduledAt ?? null, getTrimmedNullableString(input.summary), getTrimmedNullableString(input.outcomes), getTrimmedNullableString(input.nextSteps), JSON.stringify(input.metadata ?? {}), actor.userId
        ]
      );

      await this.recordAuditLog(client, actor, audit, { action: "customer_success.qbr.create", resourceType: "customer_success_account", resourceId: csAccountId, status: "success", metadata: { qbrType: input.qbrType ?? "qbr" } });
    });

    return this.getAccount(actor, csAccountId);
  }

  async updateQbr(actor: ActorContext, audit: AuditMetadata, csAccountId: string, qbrId: string, input: UpdateQbrRequestBody): Promise<CustomerSuccessAccountResponse> {
    this.assertEnabled();
    this.assertChildMutation(actor);

    await this.databaseService.withTransaction(async (client) => {
      await this.getCsAccountState(client, actor.tenantId, csAccountId);
      const existing = await client.query<{ id: string }>(`SELECT id FROM qbrs WHERE id = $1 AND tenant_id = $2 AND cs_account_id = $3 AND deleted_at IS NULL LIMIT 1`, [qbrId, actor.tenantId, csAccountId]);
      if (!existing.rows[0]) {
        throw new AppError(404, "QBR not found.", undefined, "QBR_NOT_FOUND");
      }

      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateQbrRequestBody] !== undefined);
      const assignments: string[] = [];
      const params: unknown[] = [qbrId, actor.tenantId, csAccountId, actor.userId];
      const pushAssignment = (column: string, value: unknown, cast = "") => {
        params.push(value);
        assignments.push(`${column} = $${params.length}${cast}`);
      };

      if (keys.includes("title") && input.title !== undefined) pushAssignment("title", input.title.trim());
      if (keys.includes("qbrType")) pushAssignment("qbr_type", normalizeFromList(QBR_TYPES, input.qbrType, "qbr"));
      if (keys.includes("status")) pushAssignment("status", normalizeFromList(QBR_STATUSES, input.status, "scheduled"));
      if (keys.includes("scheduledAt")) pushAssignment("scheduled_at", input.scheduledAt ?? null, "::timestamptz");
      if (keys.includes("summary")) pushAssignment("summary", getTrimmedNullableString(input.summary));
      if (keys.includes("outcomes")) pushAssignment("outcomes", getTrimmedNullableString(input.outcomes));
      if (keys.includes("nextSteps")) pushAssignment("next_steps", getTrimmedNullableString(input.nextSteps));
      if (keys.includes("ownerId")) pushAssignment("owner_id", await this.ensureUserId(client, actor.tenantId, input.ownerId ?? null, "INVALID_OWNER", "owner"));
      if (keys.includes("metadata")) pushAssignment("metadata", JSON.stringify(input.metadata ?? {}), "::jsonb");

      if (assignments.length > 0) {
        await client.query(`UPDATE qbrs SET ${assignments.join(", ")}, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND cs_account_id = $3 AND deleted_at IS NULL`, params);
      }

      await this.recordAuditLog(client, actor, audit, { action: "customer_success.qbr.update", resourceType: "qbr", resourceId: qbrId, status: "success", metadata: { csAccountId } });
    });

    return this.getAccount(actor, csAccountId);
  }

  async createRenewal(actor: ActorContext, audit: AuditMetadata, csAccountId: string, input: CreateRenewalRequestBody): Promise<CustomerSuccessAccountResponse> {
    this.assertEnabled();
    this.assertChildMutation(actor);

    await this.databaseService.withTransaction(async (client) => {
      await this.getCsAccountState(client, actor.tenantId, csAccountId);
      const ownerId = await this.ensureUserId(client, actor.tenantId, input.ownerId ?? null, "INVALID_OWNER", "owner");
      const statusOptionId = await this.resolveOptionValueId(client, actor.tenantId, "cs-renewal-status", input.statusKey ?? "not_started", "Renewal status");
      await client.query(
        `INSERT INTO renewals (tenant_id, cs_account_id, owner_id, renewal_date, status_option_id, contract_value, forecast_value, probability, risk_notes, strategy, metadata, created_by, updated_by)
         VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $12)`,
        [
          actor.tenantId, csAccountId, ownerId, input.renewalDate, statusOptionId, input.contractValue ?? null, input.forecastValue ?? null,
          input.probability ?? null, getTrimmedNullableString(input.riskNotes), getTrimmedNullableString(input.strategy), JSON.stringify(input.metadata ?? {}), actor.userId
        ]
      );

      await this.recordAuditLog(client, actor, audit, { action: "customer_success.renewal.create", resourceType: "customer_success_account", resourceId: csAccountId, status: "success", metadata: { renewalDate: input.renewalDate } });
    });

    return this.getAccount(actor, csAccountId);
  }

  async updateRenewal(actor: ActorContext, audit: AuditMetadata, csAccountId: string, renewalId: string, input: UpdateRenewalRequestBody): Promise<CustomerSuccessAccountResponse> {
    this.assertEnabled();
    this.assertChildMutation(actor);

    await this.databaseService.withTransaction(async (client) => {
      await this.getCsAccountState(client, actor.tenantId, csAccountId);
      const existing = await client.query<{ id: string }>(`SELECT id FROM renewals WHERE id = $1 AND tenant_id = $2 AND cs_account_id = $3 AND deleted_at IS NULL LIMIT 1`, [renewalId, actor.tenantId, csAccountId]);
      if (!existing.rows[0]) {
        throw new AppError(404, "Renewal not found.", undefined, "RENEWAL_NOT_FOUND");
      }

      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateRenewalRequestBody] !== undefined);
      const assignments: string[] = [];
      const params: unknown[] = [renewalId, actor.tenantId, csAccountId, actor.userId];
      const pushAssignment = (column: string, value: unknown, cast = "") => {
        params.push(value);
        assignments.push(`${column} = $${params.length}${cast}`);
      };

      if (keys.includes("renewalDate") && input.renewalDate) pushAssignment("renewal_date", input.renewalDate, "::date");
      if (keys.includes("statusKey") && input.statusKey) pushAssignment("status_option_id", await this.resolveOptionValueId(client, actor.tenantId, "cs-renewal-status", input.statusKey, "Renewal status"));
      if (keys.includes("contractValue")) pushAssignment("contract_value", input.contractValue ?? null);
      if (keys.includes("forecastValue")) pushAssignment("forecast_value", input.forecastValue ?? null);
      if (keys.includes("probability")) pushAssignment("probability", input.probability ?? null);
      if (keys.includes("riskNotes")) pushAssignment("risk_notes", getTrimmedNullableString(input.riskNotes));
      if (keys.includes("strategy")) pushAssignment("strategy", getTrimmedNullableString(input.strategy));
      if (keys.includes("ownerId")) pushAssignment("owner_id", await this.ensureUserId(client, actor.tenantId, input.ownerId ?? null, "INVALID_OWNER", "owner"));
      if (keys.includes("metadata")) pushAssignment("metadata", JSON.stringify(input.metadata ?? {}), "::jsonb");

      if (assignments.length > 0) {
        await client.query(`UPDATE renewals SET ${assignments.join(", ")}, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND cs_account_id = $3 AND deleted_at IS NULL`, params);
      }

      await this.recordAuditLog(client, actor, audit, { action: "customer_success.renewal.update", resourceType: "renewal", resourceId: renewalId, status: "success", metadata: { csAccountId } });
    });

    return this.getAccount(actor, csAccountId);
  }

  async createEscalation(actor: ActorContext, audit: AuditMetadata, csAccountId: string, input: CreateEscalationRequestBody): Promise<CustomerSuccessAccountResponse> {
    this.assertEnabled();
    this.assertChildMutation(actor);

    await this.databaseService.withTransaction(async (client) => {
      await this.getCsAccountState(client, actor.tenantId, csAccountId);
      const ownerId = await this.ensureUserId(client, actor.tenantId, input.ownerId ?? null, "INVALID_OWNER", "owner");
      await client.query(
        `INSERT INTO escalations (tenant_id, cs_account_id, owner_id, title, severity, status, description, resolution, metadata, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $10)`,
        [
          actor.tenantId, csAccountId, ownerId, input.title.trim(), normalizeFromList(ESCALATION_SEVERITIES, input.severity, "medium"), normalizeFromList(ESCALATION_STATUSES, input.status, "open"),
          getTrimmedNullableString(input.description), getTrimmedNullableString(input.resolution), JSON.stringify(input.metadata ?? {}), actor.userId
        ]
      );

      await this.recordAuditLog(client, actor, audit, { action: "customer_success.escalation.create", resourceType: "customer_success_account", resourceId: csAccountId, status: "success", metadata: { severity: input.severity ?? "medium" } });
    });

    return this.getAccount(actor, csAccountId);
  }

  async updateEscalation(actor: ActorContext, audit: AuditMetadata, csAccountId: string, escalationId: string, input: UpdateEscalationRequestBody): Promise<CustomerSuccessAccountResponse> {
    this.assertEnabled();
    this.assertChildMutation(actor);

    await this.databaseService.withTransaction(async (client) => {
      await this.getCsAccountState(client, actor.tenantId, csAccountId);
      const existing = await client.query<{ id: string; status: string }>(`SELECT id, status FROM escalations WHERE id = $1 AND tenant_id = $2 AND cs_account_id = $3 AND deleted_at IS NULL LIMIT 1`, [escalationId, actor.tenantId, csAccountId]);
      if (!existing.rows[0]) {
        throw new AppError(404, "Escalation not found.", undefined, "ESCALATION_NOT_FOUND");
      }

      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateEscalationRequestBody] !== undefined);
      const assignments: string[] = [];
      const params: unknown[] = [escalationId, actor.tenantId, csAccountId, actor.userId];
      const pushAssignment = (column: string, value: unknown, cast = "") => {
        params.push(value);
        assignments.push(`${column} = $${params.length}${cast}`);
      };

      if (keys.includes("title") && input.title !== undefined) pushAssignment("title", input.title.trim());
      if (keys.includes("severity")) pushAssignment("severity", normalizeFromList(ESCALATION_SEVERITIES, input.severity, "medium"));
      let nextStatus = existing.rows[0].status;
      if (keys.includes("status")) {
        nextStatus = normalizeFromList(ESCALATION_STATUSES, input.status, "open");
        pushAssignment("status", nextStatus);
      }
      if (keys.includes("description")) pushAssignment("description", getTrimmedNullableString(input.description));
      if (keys.includes("resolution")) pushAssignment("resolution", getTrimmedNullableString(input.resolution));
      if (keys.includes("ownerId")) pushAssignment("owner_id", await this.ensureUserId(client, actor.tenantId, input.ownerId ?? null, "INVALID_OWNER", "owner"));
      if (keys.includes("metadata")) pushAssignment("metadata", JSON.stringify(input.metadata ?? {}), "::jsonb");

      if (keys.includes("status")) {
        const wasOpen = OPEN_ESCALATION_STATUSES.has(existing.rows[0].status);
        const isOpen = OPEN_ESCALATION_STATUSES.has(nextStatus);
        if (!isOpen && wasOpen) {
          assignments.push("resolved_at = NOW()");
        } else if (isOpen && !wasOpen) {
          assignments.push("resolved_at = NULL");
        }
      }

      if (assignments.length > 0) {
        await client.query(`UPDATE escalations SET ${assignments.join(", ")}, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND cs_account_id = $3 AND deleted_at IS NULL`, params);
      }

      await this.recordAuditLog(client, actor, audit, { action: "customer_success.escalation.update", resourceType: "escalation", resourceId: escalationId, status: "success", metadata: { csAccountId } });
    });

    return this.getAccount(actor, csAccountId);
  }

  // ==========================================================================
  // Workspaces and dashboards
  // ==========================================================================

  async getOnboardingWorkspace(actor: ActorContext, scopeQuery: CustomerSuccessScope | undefined): Promise<CsOnboardingWorkspaceResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const scope = await this.resolveScope(client, actor, scopeQuery);
      const accounts = await this.loadScopedAccounts(client, actor, scope, ["segment_values.value_key = 'onboarding'"]);

      return {
        scope,
        newCustomerCount: accounts.filter((account) => account.lifecycleStage?.key === "onboarding").length,
        inOnboardingCount: accounts.filter((account) => account.onboardingPlanCount > 0 && account.lifecycleStage?.key === "onboarding").length,
        completedOnboardingCount: accounts.filter((account) => account.trainingStatus === "completed").length,
        atRiskCount: accounts.filter((account) => ["at_risk", "critical"].includes(account.riskStatus?.key ?? "")).length,
        accounts,
        aiPlaceholders: this.buildAiPlaceholders(actor)
      };
    });
  }

  async getScaledWorkspace(actor: ActorContext, scopeQuery: CustomerSuccessScope | undefined): Promise<CsScaledWorkspaceResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const scope = await this.resolveScope(client, actor, scopeQuery);
      const accounts = await this.loadScopedAccounts(client, actor, scope, ["segment_values.value_key = 'scaled'"]);
      const now = Date.now();
      const ninetyDays = now + 90 * 24 * 60 * 60 * 1000;
      const segmentMap = new Map<string, { segment: CrmOptionValueSummary | null; accountCount: number }>();
      for (const account of accounts) {
        const key = account.segment?.key ?? "__none__";
        const entry = segmentMap.get(key) ?? { segment: account.segment, accountCount: 0 };
        entry.accountCount += 1;
        segmentMap.set(key, entry);
      }

      return {
        scope,
        portfolioCount: accounts.length,
        healthyCount: accounts.filter((account) => account.riskStatus?.key === "healthy").length,
        atRiskCount: accounts.filter((account) => ["at_risk", "critical"].includes(account.riskStatus?.key ?? "")).length,
        renewalsDueCount: accounts.filter((account) => account.renewalDate && new Date(account.renewalDate).getTime() <= ninetyDays).length,
        averageHealthScore: averageOf(accounts.map((account) => account.healthScore).filter((value): value is number => value !== null)),
        segmentDistribution: Array.from(segmentMap.values()),
        accounts,
        lowTouchCampaignsPlaceholder: { available: false, message: "Low-touch campaigns will connect once the lifecycle automation runtime is introduced." },
        automatedCheckInPlaceholder: { available: false, message: "Automated check-ins will connect once the lifecycle automation runtime is introduced." },
        aiPlaceholders: this.buildAiPlaceholders(actor)
      };
    });
  }

  async getEnterpriseWorkspace(actor: ActorContext, scopeQuery: CustomerSuccessScope | undefined): Promise<CsEnterpriseWorkspaceResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const scope = await this.resolveScope(client, actor, scopeQuery);
      const accounts = await this.loadScopedAccounts(client, actor, scope, ["segment_values.value_key = 'enterprise'"]);

      return {
        scope,
        accountCount: accounts.length,
        openEscalationCount: accounts.reduce((sum, account) => sum + account.openEscalationCount, 0),
        upcomingQbrCount: accounts.reduce((sum, account) => sum + account.qbrCount, 0),
        expansionOpportunityCount: accounts.filter((account) => ["medium", "high"].includes(account.expansionPotential?.key ?? "")).length,
        totalContractValue: accounts.reduce((sum, account) => sum + (account.contractValue ?? 0), 0),
        accounts,
        aiPlaceholders: this.buildAiPlaceholders(actor)
      };
    });
  }

  async getDashboard(actor: ActorContext, scopeQuery: CustomerSuccessScope | undefined): Promise<CustomerSuccessDashboardResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const scope = await this.resolveScope(client, actor, scopeQuery);
      const accounts = await this.loadScopedAccounts(client, actor, scope);
      const now = Date.now();
      const ninetyDays = now + 90 * 24 * 60 * 60 * 1000;

      const distribute = <T>(key: (account: CustomerSuccessAccountSummary) => CrmOptionValueSummary | null, label: T) => {
        const map = new Map<string, { value: CrmOptionValueSummary | null; accountCount: number }>();
        for (const account of accounts) {
          const value = key(account);
          const mapKey = value?.key ?? "__none__";
          const entry = map.get(mapKey) ?? { value, accountCount: 0 };
          entry.accountCount += 1;
          map.set(mapKey, entry);
        }
        return Array.from(map.values());
      };

      return {
        scope,
        totalAccounts: accounts.length,
        averageHealthScore: averageOf(accounts.map((account) => account.healthScore).filter((value): value is number => value !== null)),
        averageAdoptionScore: averageOf(accounts.map((account) => account.adoptionScore).filter((value): value is number => value !== null)),
        atRiskCount: accounts.filter((account) => ["at_risk", "critical"].includes(account.riskStatus?.key ?? "")).length,
        openEscalationCount: accounts.reduce((sum, account) => sum + account.openEscalationCount, 0),
        renewalsDueCount: accounts.filter((account) => account.renewalDate && new Date(account.renewalDate).getTime() <= ninetyDays).length,
        totalContractValue: accounts.reduce((sum, account) => sum + (account.contractValue ?? 0), 0),
        segmentDistribution: distribute((account) => account.segment, "segment").map((entry) => ({ segment: entry.value, accountCount: entry.accountCount })),
        riskDistribution: distribute((account) => account.riskStatus, "risk").map((entry) => ({ riskStatus: entry.value, accountCount: entry.accountCount })),
        lifecycleDistribution: distribute((account) => account.lifecycleStage, "lifecycle").map((entry) => ({ lifecycleStage: entry.value, accountCount: entry.accountCount }))
      };
    });
  }

  async getHealthDashboard(actor: ActorContext, scopeQuery: CustomerSuccessScope | undefined): Promise<CustomerHealthDashboardResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const scope = await this.resolveScope(client, actor, scopeQuery);
      const accounts = await this.loadScopedAccounts(client, actor, scope);
      const riskMap = new Map<string, { riskStatus: CrmOptionValueSummary | null; accountCount: number }>();
      for (const account of accounts) {
        const key = account.riskStatus?.key ?? "__none__";
        const entry = riskMap.get(key) ?? { riskStatus: account.riskStatus, accountCount: 0 };
        entry.accountCount += 1;
        riskMap.set(key, entry);
      }

      return {
        scope,
        averageHealthScore: averageOf(accounts.map((account) => account.healthScore).filter((value): value is number => value !== null)),
        averageAdoptionScore: averageOf(accounts.map((account) => account.adoptionScore).filter((value): value is number => value !== null)),
        healthyCount: accounts.filter((account) => account.riskStatus?.key === "healthy").length,
        watchCount: accounts.filter((account) => account.riskStatus?.key === "watch").length,
        atRiskCount: accounts.filter((account) => account.riskStatus?.key === "at_risk").length,
        criticalCount: accounts.filter((account) => account.riskStatus?.key === "critical").length,
        decliningSupportCount: accounts.filter((account) => account.supportTrend === "declining").length,
        riskDistribution: Array.from(riskMap.values())
      };
    });
  }

  async getRenewalDashboard(actor: ActorContext, scopeQuery: CustomerSuccessScope | undefined): Promise<RenewalDashboardResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const scope = await this.resolveScope(client, actor, scopeQuery);
      const { conditions, params } = await this.buildScopedWhere(client, actor, scope);
      const whereClause = conditions.join(" AND ");

      const result = await client.query<{
        id: string;
        renewal_date: string;
        contract_value: string | number | null;
        forecast_value: string | number | null;
        status_key: string | null;
        status_id: string | null;
        status_label: string | null;
        status_description: string | null;
        status_color: string | null;
        status_is_default: boolean | null;
        status_is_active: boolean | null;
      }>(
        `
          SELECT renewals.id, renewals.renewal_date, renewals.contract_value, renewals.forecast_value,
            status_values.id AS status_id, status_values.value_key AS status_key, status_values.label AS status_label, status_values.description AS status_description,
            status_values.color AS status_color, status_values.is_default AS status_is_default, status_values.is_active AS status_is_active
          FROM renewals
          INNER JOIN customer_success_accounts ON customer_success_accounts.id = renewals.cs_account_id AND customer_success_accounts.tenant_id = renewals.tenant_id
          LEFT JOIN users AS owner_users ON owner_users.id = customer_success_accounts.csm_owner_id AND owner_users.tenant_id = customer_success_accounts.tenant_id
          INNER JOIN tenant_option_values AS status_values ON status_values.id = renewals.status_option_id AND status_values.tenant_id = renewals.tenant_id
          WHERE renewals.deleted_at IS NULL AND customer_success_accounts.deleted_at IS NULL AND ${whereClause}
        `,
        params
      );

      const now = Date.now();
      const ninetyDays = now + 90 * 24 * 60 * 60 * 1000;
      const statusMap = new Map<string, { status: CrmOptionValueSummary | null; renewalCount: number; forecastValue: number }>();
      let totalContractValue = 0;
      let forecastValue = 0;
      let renewedCount = 0;
      let churnedCount = 0;
      let renewalsDueSoonCount = 0;

      for (const row of result.rows) {
        totalContractValue += parseNumeric(row.contract_value) ?? 0;
        const forecast = parseNumeric(row.forecast_value) ?? 0;
        forecastValue += forecast;
        if (row.status_key === "renewed") renewedCount += 1;
        if (row.status_key === "churned") churnedCount += 1;
        if (row.renewal_date && new Date(row.renewal_date).getTime() <= ninetyDays) renewalsDueSoonCount += 1;
        const key = row.status_key ?? "__none__";
        const entry = statusMap.get(key) ?? {
          status: mapOptionValue({ id: row.status_id, key: row.status_key, label: row.status_label, description: row.status_description, color: row.status_color, isDefault: row.status_is_default, isActive: row.status_is_active }),
          renewalCount: 0,
          forecastValue: 0
        };
        entry.renewalCount += 1;
        entry.forecastValue += forecast;
        statusMap.set(key, entry);
      }

      return {
        scope,
        totalRenewals: result.rows.length,
        renewalsDueSoonCount,
        totalContractValue,
        forecastValue,
        renewedCount,
        churnedCount,
        statusDistribution: Array.from(statusMap.values())
      };
    });
  }
}

interface CsAccountRow {
  id: string;
  health_score: number | null;
  adoption_score: number | null;
  renewal_date: string | null;
  contract_value: string | number | null;
  support_trend: string;
  training_status: string;
  last_touchpoint_at: Date | null;
  next_action: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  account_id: string | null;
  account_name: string | null;
  account_website: string | null;
  owner_id: string | null;
  owner_display_name: string | null;
  owner_email: string | null;
  owner_team_name: string | null;
  owner_department_name: string | null;
  segment_id: string | null;
  segment_key: string | null;
  segment_label: string | null;
  segment_description: string | null;
  segment_color: string | null;
  segment_is_default: boolean | null;
  segment_is_active: boolean | null;
  lifecycle_id: string | null;
  lifecycle_key: string | null;
  lifecycle_label: string | null;
  lifecycle_description: string | null;
  lifecycle_color: string | null;
  lifecycle_is_default: boolean | null;
  lifecycle_is_active: boolean | null;
  risk_id: string | null;
  risk_key: string | null;
  risk_label: string | null;
  risk_description: string | null;
  risk_color: string | null;
  risk_is_default: boolean | null;
  risk_is_active: boolean | null;
  expansion_id: string | null;
  expansion_key: string | null;
  expansion_label: string | null;
  expansion_description: string | null;
  expansion_color: string | null;
  expansion_is_default: boolean | null;
  expansion_is_active: boolean | null;
  onboarding_plan_count: number;
  health_score_count: number;
  qbr_count: number;
  renewal_count: number;
  open_escalation_count: number;
}

interface OnboardingPlanRow {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  target_go_live_date: string | null;
  product_activation_status: string;
  first_value_at: Date | null;
  training_completion: number | null;
  risk_notes: string | null;
  handover_notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface OnboardingMilestoneRow {
  id: string;
  onboarding_plan_id: string;
  label: string;
  status: string;
  sort_order: number;
  due_date: string | null;
  completed_at: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface SuccessPlanRow {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  value_realization: string | null;
  executive_sponsor: string | null;
  stakeholders: unknown;
  expansion_opportunities: string | null;
  renewal_strategy: string | null;
  created_at: Date;
  updated_at: Date;
}

interface HealthScoreRow {
  id: string;
  score: number;
  drivers: string | null;
  notes: string | null;
  recorded_at: Date;
  created_at: Date;
  risk_id: string | null;
  risk_key: string | null;
  risk_label: string | null;
  risk_description: string | null;
  risk_color: string | null;
  risk_is_default: boolean | null;
  risk_is_active: boolean | null;
}

interface AdoptionMetricRow {
  id: string;
  metric_key: string;
  label: string;
  value: string | number;
  target: string | number | null;
  unit: string | null;
  trend: string;
  period_start: string | null;
  period_end: string | null;
  created_at: Date;
  updated_at: Date;
}

interface QbrRow {
  id: string;
  title: string;
  qbr_type: string;
  status: string;
  scheduled_at: Date | null;
  summary: string | null;
  outcomes: string | null;
  next_steps: string | null;
  created_at: Date;
  updated_at: Date;
  owner_id: string | null;
  owner_display_name: string | null;
  owner_email: string | null;
  owner_team_name: string | null;
  owner_department_name: string | null;
}

interface RenewalRow {
  id: string;
  renewal_date: string;
  contract_value: string | number | null;
  forecast_value: string | number | null;
  probability: number | null;
  risk_notes: string | null;
  strategy: string | null;
  created_at: Date;
  updated_at: Date;
  status_id: string | null;
  status_key: string | null;
  status_label: string | null;
  status_description: string | null;
  status_color: string | null;
  status_is_default: boolean | null;
  status_is_active: boolean | null;
  owner_id: string | null;
  owner_display_name: string | null;
  owner_email: string | null;
  owner_team_name: string | null;
  owner_department_name: string | null;
}

interface EscalationRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  description: string | null;
  resolution: string | null;
  opened_at: Date;
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
  owner_id: string | null;
  owner_display_name: string | null;
  owner_email: string | null;
  owner_team_name: string | null;
  owner_department_name: string | null;
}
