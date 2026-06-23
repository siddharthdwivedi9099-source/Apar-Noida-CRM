import type {
  AccountLookupSummary,
  ContactRelationshipSummary,
  CreateResellerDealRegistrationRequestBody,
  CreateResellerRequestBody,
  CrmLookupUserSummary,
  CrmMutationSuccessResponse,
  CrmOptionValueSummary,
  OpportunityLookupSummary,
  ResellerAiPlaceholderSummary,
  ResellerContactInput,
  ResellerContactSummary,
  ResellerDashboardResponse,
  ResellerDealRegistrationResponse,
  ResellerDealRegistrationSummary,
  ResellerDealRegistrationsResponse,
  ResellerDetail,
  ResellerListQuery,
  ResellerOnboardingTaskInput,
  ResellerOnboardingTaskStatus,
  ResellerOnboardingTaskSummary,
  ResellerOptionsResponse,
  ResellerPipelineScope,
  ResellerResponse,
  ResellerSummary,
  ResellersResponse,
  RoleSummary,
  UpdateResellerDealRegistrationRequestBody,
  UpdateResellerRequestBody
} from "@crm/types";
import type { PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import { buildPagination } from "../../common/pagination.js";
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

interface ContactLookupRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  role_id: string | null;
  role_key: string | null;
  role_label: string | null;
  role_description: string | null;
  role_color: string | null;
  role_is_default: boolean | null;
  role_is_active: boolean | null;
}

interface OpportunityLookupRow {
  id: string;
  name: string;
  stage_id: string | null;
  stage_key: string | null;
  stage_label: string | null;
  stage_description: string | null;
  stage_color: string | null;
  stage_is_default: boolean | null;
  stage_is_active: boolean | null;
}

const ONBOARDING_TASK_STATUSES: ResellerOnboardingTaskStatus[] = ["pending", "in_progress", "completed", "blocked"];

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

  return {
    id: input.id,
    displayName: input.displayName,
    email: input.email,
    teamName: input.teamName,
    departmentName: input.departmentName
  };
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

function mapContact(row: ContactLookupRow): ContactRelationshipSummary {
  return {
    id: row.id,
    fullName: `${row.first_name} ${row.last_name}`.trim(),
    email: row.email,
    role: mapOptionValue({
      id: row.role_id,
      key: row.role_key,
      label: row.role_label,
      description: row.role_description,
      color: row.role_color,
      isDefault: row.role_is_default,
      isActive: row.role_is_active
    })
  };
}

function normalizeOnboardingTaskStatus(value: unknown): ResellerOnboardingTaskStatus {
  return ONBOARDING_TASK_STATUSES.includes(value as ResellerOnboardingTaskStatus)
    ? (value as ResellerOnboardingTaskStatus)
    : "pending";
}

function averageOf(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export class ResellersService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {}

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(
        503,
        "Reseller management is unavailable until the database connection is enabled.",
        undefined,
        "RESELLERS_UNAVAILABLE"
      );
    }
  }

  private async recordAuditLog(
    client: PoolClient,
    actor: ActorContext,
    audit: AuditMetadata,
    input: {
      action: string;
      resourceType: string;
      resourceId?: string | null;
      status: "success" | "failure" | "denied" | "error";
      metadata?: Record<string, unknown>;
    }
  ) {
    if (!this.config.enableAuditLogs) {
      return;
    }

    await client.query(
      `
        INSERT INTO audit_logs (
          tenant_id, actor_user_id, session_id, event_type, action, resource_type,
          resource_id, status, ip_address, user_agent, request_id, metadata
        )
        VALUES ($1, $2, $3, 'crm', $4, $5, $6, $7, NULLIF($8, '')::inet, $9, $10, $11::jsonb)
      `,
      [
        actor.tenantId,
        actor.userId,
        actor.sessionId,
        input.action,
        input.resourceType,
        input.resourceId ?? null,
        input.status,
        audit.ipAddress ?? "",
        audit.userAgent ?? null,
        audit.requestId,
        JSON.stringify(input.metadata ?? {})
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

    return result.rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      email: row.email,
      teamName: row.team_name,
      departmentName: row.department_name
    }));
  }

  private async loadOptionSetValues(client: PoolClient, tenantId: string, setKey: string): Promise<CrmOptionValueSummary[]> {
    const result = await client.query<OptionValueRow>(
      `
        SELECT
          tenant_option_values.id,
          tenant_option_values.value_key AS key,
          tenant_option_values.label,
          tenant_option_values.description,
          tenant_option_values.color,
          tenant_option_values.is_default,
          tenant_option_values.is_active
        FROM tenant_option_sets
        INNER JOIN tenant_option_values
          ON tenant_option_values.option_set_id = tenant_option_sets.id
         AND tenant_option_values.tenant_id = tenant_option_sets.tenant_id
        WHERE tenant_option_sets.tenant_id = $1
          AND tenant_option_sets.set_key = $2
          AND tenant_option_sets.deleted_at IS NULL
          AND tenant_option_values.deleted_at IS NULL
        ORDER BY tenant_option_values.sort_order ASC, tenant_option_values.label ASC
      `,
      [tenantId, setKey]
    );

    return result.rows.map((row) => ({
      id: row.id,
      key: row.key,
      label: row.label,
      description: row.description,
      color: row.color,
      isDefault: row.is_default,
      isActive: row.is_active
    }));
  }

  private async loadAccountsLookup(client: PoolClient, tenantId: string): Promise<AccountLookupSummary[]> {
    const result = await client.query<AccountLookupRow>(
      `SELECT id, name, website FROM accounts WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY name ASC`,
      [tenantId]
    );

    return result.rows.map((row) => ({ id: row.id, name: row.name, website: row.website }));
  }

  private async loadContactsLookup(client: PoolClient, tenantId: string): Promise<ContactRelationshipSummary[]> {
    const result = await client.query<ContactLookupRow>(
      `
        SELECT
          contacts.id, contacts.first_name, contacts.last_name, contacts.email,
          role_values.id AS role_id, role_values.value_key AS role_key, role_values.label AS role_label,
          role_values.description AS role_description, role_values.color AS role_color,
          role_values.is_default AS role_is_default, role_values.is_active AS role_is_active
        FROM contacts
        LEFT JOIN tenant_option_values AS role_values
          ON role_values.id = contacts.role_option_id AND role_values.tenant_id = contacts.tenant_id
        WHERE contacts.tenant_id = $1 AND contacts.deleted_at IS NULL
        ORDER BY contacts.first_name ASC, contacts.last_name ASC
      `,
      [tenantId]
    );

    return result.rows.map((row) => mapContact(row));
  }

  private async loadOpportunitiesLookup(client: PoolClient, tenantId: string): Promise<OpportunityLookupSummary[]> {
    const result = await client.query<OpportunityLookupRow>(
      `
        SELECT
          opportunities.id, opportunities.name,
          stage_values.id AS stage_id, stage_values.value_key AS stage_key, stage_values.label AS stage_label,
          stage_values.description AS stage_description, stage_values.color AS stage_color,
          stage_values.is_default AS stage_is_default, stage_values.is_active AS stage_is_active
        FROM opportunities
        LEFT JOIN tenant_option_values AS stage_values
          ON stage_values.id = opportunities.stage_option_id AND stage_values.tenant_id = opportunities.tenant_id
        WHERE opportunities.tenant_id = $1 AND opportunities.deleted_at IS NULL
        ORDER BY opportunities.updated_at DESC
        LIMIT 200
      `,
      [tenantId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      stage: mapOptionValue({
        id: row.stage_id,
        key: row.stage_key,
        label: row.stage_label,
        description: row.stage_description,
        color: row.stage_color,
        isDefault: row.stage_is_default,
        isActive: row.stage_is_active
      })
    }));
  }

  private async resolveOptionValueId(client: PoolClient, tenantId: string, setKey: string, valueKey: string, label: string) {
    const result = await client.query<{ id: string }>(
      `
        SELECT tenant_option_values.id
        FROM tenant_option_sets
        INNER JOIN tenant_option_values
          ON tenant_option_values.option_set_id = tenant_option_sets.id
         AND tenant_option_values.tenant_id = tenant_option_sets.tenant_id
        WHERE tenant_option_sets.tenant_id = $1
          AND tenant_option_sets.set_key = $2
          AND tenant_option_sets.deleted_at IS NULL
          AND tenant_option_values.deleted_at IS NULL
          AND tenant_option_values.is_active = true
          AND tenant_option_values.value_key = $3
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

  private async ensureReference(
    client: PoolClient,
    tenantId: string,
    table: "users" | "accounts" | "contacts" | "opportunities" | "leads",
    id: string | null | undefined,
    code: string,
    label: string
  ) {
    if (!id) {
      return null;
    }

    const statusClause = table === "users" ? "AND status IN ('active', 'invited')" : "";
    const result = await client.query<{ id: string }>(
      `SELECT id FROM ${table} WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL ${statusClause} LIMIT 1`,
      [id, tenantId]
    );

    const resolvedId = result.rows[0]?.id ?? null;

    if (!resolvedId) {
      throw new AppError(400, `The selected ${label} is invalid for this tenant.`, undefined, code);
    }

    return resolvedId;
  }

  private getSharedScopePermissions(actor: ActorContext) {
    return (
      actor.permissionCodes.includes("resellers.assign") ||
      actor.permissionCodes.includes("resellers.configure") ||
      actor.permissionCodes.includes("resellers.view_dashboard") ||
      actor.permissionCodes.includes("resellers.manage_workflow") ||
      actor.permissionCodes.includes("sales.view_dashboard") ||
      actor.permissionCodes.includes("dashboards.view_dashboard")
    );
  }

  private async getAvailableScopes(client: PoolClient, actor: ActorContext): Promise<ResellerPipelineScope[]> {
    if (!this.getSharedScopePermissions(actor)) {
      return ["mine"];
    }

    const actorTeamId = await this.getActorTeamId(client, actor.tenantId, actor.userId);
    return actorTeamId ? ["mine", "team", "all"] : ["mine", "all"];
  }

  private async resolveScope(
    client: PoolClient,
    actor: ActorContext,
    requestedScope: ResellerPipelineScope | undefined
  ): Promise<ResellerPipelineScope> {
    const availableScopes = await this.getAvailableScopes(client, actor);
    const effectiveScope = requestedScope ?? (availableScopes.includes("all") ? "all" : "mine");

    if (!availableScopes.includes(effectiveScope)) {
      throw new AppError(403, "You do not have permission to inspect this scope.", undefined, "AUTHORIZATION_ERROR");
    }

    return effectiveScope;
  }

  private buildAiPlaceholders(actor: ActorContext): ResellerAiPlaceholderSummary {
    const permissionCodes = new Set(actor.permissionCodes);
    const canUseAi =
      permissionCodes.has("resellers.use_ai") ||
      permissionCodes.has("resellers.manage_ai") ||
      permissionCodes.has("ai.use_ai") ||
      permissionCodes.has("ai.manage_ai");
    const canManageAi = permissionCodes.has("resellers.manage_ai") || permissionCodes.has("ai.manage_ai");

    return {
      actions: canUseAi
        ? [
            {
              key: "reseller_performance_insight",
              label: "Reseller performance insight",
              description: "Placeholder entry point for future reseller performance analysis."
            },
            {
              key: "reseller_sales_prediction",
              label: "Reseller sales prediction",
              description: "Placeholder entry point for future reseller sales forecasting."
            },
            {
              key: "margin_optimization",
              label: "Margin optimization",
              description: "Placeholder entry point for future margin and pricing optimization."
            },
            {
              key: "reseller_opportunity_recommendation",
              label: "Reseller opportunity recommendation",
              description: "Placeholder entry point for future reseller opportunity recommendations."
            },
            {
              key: "inactivity_alert",
              label: "Inactivity alert",
              description: "Placeholder entry point for future reseller inactivity detection."
            },
            {
              key: "reseller_coaching_recommendation",
              label: "Reseller coaching recommendation",
              description: "Placeholder entry point for future reseller coaching and enablement guidance."
            }
          ]
        : [],
      governanceHint: canManageAi
        ? "AI placeholders are visible and will later connect to the governed AI Gateway with reseller-specific controls."
        : canUseAi
          ? "AI placeholders are visible for this role, but execution remains deferred until the AI Gateway phase."
          : "AI placeholders remain hidden until the role includes reseller or global AI usage permissions."
    };
  }

  private async getResellerState(client: PoolClient, tenantId: string, resellerId: string) {
    const result = await client.query<{ id: string; owner_id: string | null }>(
      `SELECT id, owner_id FROM resellers WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [resellerId, tenantId]
    );

    const row = result.rows[0];

    if (!row) {
      throw new AppError(404, "Reseller not found.", undefined, "RESELLER_NOT_FOUND");
    }

    return row;
  }

  private assertResellerMutation(actor: ActorContext, keys: string[]) {
    if (keys.length === 0) {
      throw new AppError(400, "At least one field must be updated.", undefined, "VALIDATION_ERROR");
    }

    const canEdit = actor.permissionCodes.includes("resellers.edit") || actor.permissionCodes.includes("resellers.configure");
    const canAssign = actor.permissionCodes.includes("resellers.assign") || actor.permissionCodes.includes("resellers.configure");
    const ownerOnlyMutation = keys.every((key) => key === "ownerId");

    if (!canEdit && !(canAssign && ownerOnlyMutation)) {
      throw new AppError(403, "You do not have permission to update this reseller.", undefined, "AUTHORIZATION_ERROR");
    }

    if (!canAssign && keys.includes("ownerId")) {
      throw new AppError(403, "You do not have permission to reassign reseller ownership.", undefined, "AUTHORIZATION_ERROR");
    }
  }

  private resellerSelectColumns() {
    return `
      resellers.id,
      resellers.name,
      resellers.region,
      resellers.territory,
      resellers.margin_percent,
      resellers.agreement_reference,
      resellers.agreement_start_date,
      resellers.agreement_end_date,
      resellers.agreement_notes,
      resellers.metadata,
      resellers.created_at,
      resellers.updated_at,
      resellers.account_id,
      reseller_accounts.name AS account_name,
      reseller_accounts.website AS account_website,
      owner_users.id AS owner_id,
      owner_users.display_name AS owner_display_name,
      owner_users.email AS owner_email,
      owner_teams.name AS owner_team_name,
      owner_departments.name AS owner_department_name,
      status_values.id AS status_id, status_values.value_key AS status_key, status_values.label AS status_label,
      status_values.description AS status_description, status_values.color AS status_color,
      status_values.is_default AS status_is_default, status_values.is_active AS status_is_active,
      pricing_values.id AS pricing_id, pricing_values.value_key AS pricing_key, pricing_values.label AS pricing_label,
      pricing_values.description AS pricing_description, pricing_values.color AS pricing_color,
      pricing_values.is_default AS pricing_is_default, pricing_values.is_active AS pricing_is_active,
      margin_values.id AS margin_id, margin_values.value_key AS margin_key, margin_values.label AS margin_label,
      margin_values.description AS margin_description, margin_values.color AS margin_color,
      margin_values.is_default AS margin_is_default, margin_values.is_active AS margin_is_active,
      onboarding_values.id AS onboarding_id, onboarding_values.value_key AS onboarding_key, onboarding_values.label AS onboarding_label,
      onboarding_values.description AS onboarding_description, onboarding_values.color AS onboarding_color,
      onboarding_values.is_default AS onboarding_is_default, onboarding_values.is_active AS onboarding_is_active,
      COALESCE(contact_counts.count, 0)::int AS contact_count,
      COALESCE(deal_counts.count, 0)::int AS deal_count,
      COALESCE(deal_counts.won_count, 0)::int AS won_deal_count,
      COALESCE(deal_counts.registered_value, 0)::numeric AS registered_deal_value,
      deal_counts.average_margin AS deal_average_margin,
      COALESCE(task_counts.count, 0)::int AS onboarding_task_count,
      COALESCE(task_counts.completed_count, 0)::int AS completed_onboarding_task_count
    `;
  }

  private resellerFromClause() {
    return `
      FROM resellers
      INNER JOIN tenant_option_values AS status_values
        ON status_values.id = resellers.status_option_id AND status_values.tenant_id = resellers.tenant_id
      INNER JOIN tenant_option_values AS pricing_values
        ON pricing_values.id = resellers.pricing_tier_option_id AND pricing_values.tenant_id = resellers.tenant_id
      INNER JOIN tenant_option_values AS margin_values
        ON margin_values.id = resellers.margin_profile_option_id AND margin_values.tenant_id = resellers.tenant_id
      INNER JOIN tenant_option_values AS onboarding_values
        ON onboarding_values.id = resellers.onboarding_status_option_id AND onboarding_values.tenant_id = resellers.tenant_id
      LEFT JOIN accounts AS reseller_accounts
        ON reseller_accounts.id = resellers.account_id AND reseller_accounts.tenant_id = resellers.tenant_id AND reseller_accounts.deleted_at IS NULL
      LEFT JOIN users AS owner_users
        ON owner_users.id = resellers.owner_id AND owner_users.tenant_id = resellers.tenant_id AND owner_users.deleted_at IS NULL
      LEFT JOIN teams AS owner_teams
        ON owner_teams.id = owner_users.team_id AND owner_teams.tenant_id = owner_users.tenant_id AND owner_teams.deleted_at IS NULL
      LEFT JOIN departments AS owner_departments
        ON owner_departments.id = owner_users.department_id AND owner_departments.tenant_id = owner_users.tenant_id AND owner_departments.deleted_at IS NULL
      LEFT JOIN (
        SELECT tenant_id, reseller_id, COUNT(*) AS count
        FROM reseller_contacts WHERE deleted_at IS NULL GROUP BY tenant_id, reseller_id
      ) AS contact_counts
        ON contact_counts.tenant_id = resellers.tenant_id AND contact_counts.reseller_id = resellers.id
      LEFT JOIN (
        SELECT reseller_deal_registrations.tenant_id, reseller_deal_registrations.reseller_id,
          COUNT(*) AS count,
          COUNT(*) FILTER (WHERE deal_stage_values.value_key = 'won') AS won_count,
          COALESCE(SUM(reseller_deal_registrations.amount), 0) AS registered_value,
          AVG(reseller_deal_registrations.margin_percent) AS average_margin
        FROM reseller_deal_registrations
        INNER JOIN tenant_option_values AS deal_stage_values
          ON deal_stage_values.id = reseller_deal_registrations.stage_option_id
         AND deal_stage_values.tenant_id = reseller_deal_registrations.tenant_id
        WHERE reseller_deal_registrations.deleted_at IS NULL
        GROUP BY reseller_deal_registrations.tenant_id, reseller_deal_registrations.reseller_id
      ) AS deal_counts
        ON deal_counts.tenant_id = resellers.tenant_id AND deal_counts.reseller_id = resellers.id
      LEFT JOIN (
        SELECT tenant_id, reseller_id, COUNT(*) AS count, COUNT(*) FILTER (WHERE status = 'completed') AS completed_count
        FROM reseller_onboarding_tasks WHERE deleted_at IS NULL GROUP BY tenant_id, reseller_id
      ) AS task_counts
        ON task_counts.tenant_id = resellers.tenant_id AND task_counts.reseller_id = resellers.id
    `;
  }

  private mapResellerSummary(row: ResellerRow): ResellerSummary {
    return {
      id: row.id,
      name: row.name,
      account: row.account_id ? { id: row.account_id, name: row.account_name ?? "", website: row.account_website } : null,
      owner: mapUser({
        id: row.owner_id,
        displayName: row.owner_display_name,
        email: row.owner_email,
        teamName: row.owner_team_name,
        departmentName: row.owner_department_name
      }),
      status: mapOptionValue({
        id: row.status_id,
        key: row.status_key,
        label: row.status_label,
        description: row.status_description,
        color: row.status_color,
        isDefault: row.status_is_default,
        isActive: row.status_is_active
      }),
      pricingTier: mapOptionValue({
        id: row.pricing_id,
        key: row.pricing_key,
        label: row.pricing_label,
        description: row.pricing_description,
        color: row.pricing_color,
        isDefault: row.pricing_is_default,
        isActive: row.pricing_is_active
      }),
      marginProfile: mapOptionValue({
        id: row.margin_id,
        key: row.margin_key,
        label: row.margin_label,
        description: row.margin_description,
        color: row.margin_color,
        isDefault: row.margin_is_default,
        isActive: row.margin_is_active
      }),
      onboardingStatus: mapOptionValue({
        id: row.onboarding_id,
        key: row.onboarding_key,
        label: row.onboarding_label,
        description: row.onboarding_description,
        color: row.onboarding_color,
        isDefault: row.onboarding_is_default,
        isActive: row.onboarding_is_active
      }),
      region: row.region,
      territory: row.territory,
      marginPercent: parseNumeric(row.margin_percent),
      agreementReference: row.agreement_reference,
      agreementStartDate: row.agreement_start_date,
      agreementEndDate: row.agreement_end_date,
      agreementNotes: row.agreement_notes,
      contactCount: row.contact_count,
      dealCount: row.deal_count,
      onboardingTaskCount: row.onboarding_task_count,
      completedOnboardingTaskCount: row.completed_onboarding_task_count,
      metadata: getMetadata(row.metadata),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private async loadResellerContacts(client: PoolClient, tenantId: string, resellerId: string): Promise<ResellerContactSummary[]> {
    const result = await client.query<{
      id: string;
      name: string;
      title: string | null;
      email: string | null;
      phone: string | null;
      is_primary: boolean;
      created_at: Date;
      updated_at: Date;
      contact_id: string | null;
      contact_first_name: string | null;
      contact_last_name: string | null;
      contact_email: string | null;
      contact_role_id: string | null;
      contact_role_key: string | null;
      contact_role_label: string | null;
      contact_role_description: string | null;
      contact_role_color: string | null;
      contact_role_is_default: boolean | null;
      contact_role_is_active: boolean | null;
    }>(
      `
        SELECT
          reseller_contacts.id, reseller_contacts.name, reseller_contacts.title, reseller_contacts.email,
          reseller_contacts.phone, reseller_contacts.is_primary, reseller_contacts.created_at, reseller_contacts.updated_at,
          contacts.id AS contact_id, contacts.first_name AS contact_first_name, contacts.last_name AS contact_last_name,
          contacts.email AS contact_email,
          role_values.id AS contact_role_id, role_values.value_key AS contact_role_key, role_values.label AS contact_role_label,
          role_values.description AS contact_role_description, role_values.color AS contact_role_color,
          role_values.is_default AS contact_role_is_default, role_values.is_active AS contact_role_is_active
        FROM reseller_contacts
        LEFT JOIN contacts
          ON contacts.id = reseller_contacts.contact_id AND contacts.tenant_id = reseller_contacts.tenant_id AND contacts.deleted_at IS NULL
        LEFT JOIN tenant_option_values AS role_values
          ON role_values.id = contacts.role_option_id AND role_values.tenant_id = contacts.tenant_id
        WHERE reseller_contacts.tenant_id = $1 AND reseller_contacts.reseller_id = $2 AND reseller_contacts.deleted_at IS NULL
        ORDER BY reseller_contacts.is_primary DESC, reseller_contacts.created_at ASC
      `,
      [tenantId, resellerId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      title: row.title,
      email: row.email,
      phone: row.phone,
      isPrimary: row.is_primary,
      contact: row.contact_id
        ? mapContact({
            id: row.contact_id,
            first_name: row.contact_first_name ?? "",
            last_name: row.contact_last_name ?? "",
            email: row.contact_email,
            role_id: row.contact_role_id,
            role_key: row.contact_role_key,
            role_label: row.contact_role_label,
            role_description: row.contact_role_description,
            role_color: row.contact_role_color,
            role_is_default: row.contact_role_is_default,
            role_is_active: row.contact_role_is_active
          })
        : null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    }));
  }

  private async loadOnboardingTasks(client: PoolClient, tenantId: string, resellerId: string): Promise<ResellerOnboardingTaskSummary[]> {
    const result = await client.query<{
      id: string;
      label: string;
      status: string;
      sort_order: number;
      due_date: string | null;
      completed_at: Date | null;
      notes: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        SELECT id, label, status, sort_order, due_date, completed_at, notes, created_at, updated_at
        FROM reseller_onboarding_tasks
        WHERE tenant_id = $1 AND reseller_id = $2 AND deleted_at IS NULL
        ORDER BY sort_order ASC, created_at ASC
      `,
      [tenantId, resellerId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      label: row.label,
      status: normalizeOnboardingTaskStatus(row.status),
      sortOrder: row.sort_order,
      dueDate: row.due_date,
      completedAt: toIsoString(row.completed_at),
      notes: row.notes,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    }));
  }

  private dealSelectColumns() {
    return `
      reseller_deal_registrations.id,
      reseller_deal_registrations.reseller_id,
      reseller_deal_registrations.name,
      reseller_deal_registrations.customer_name,
      reseller_deal_registrations.amount,
      reseller_deal_registrations.margin_percent,
      reseller_deal_registrations.expected_close_date,
      reseller_deal_registrations.notes,
      reseller_deal_registrations.lead_id,
      reseller_deal_registrations.metadata,
      reseller_deal_registrations.created_at,
      reseller_deal_registrations.updated_at,
      reseller_deal_registrations.opportunity_id,
      deal_opportunities.name AS opportunity_name,
      opportunity_stage_values.id AS opportunity_stage_id, opportunity_stage_values.value_key AS opportunity_stage_key,
      opportunity_stage_values.label AS opportunity_stage_label, opportunity_stage_values.description AS opportunity_stage_description,
      opportunity_stage_values.color AS opportunity_stage_color, opportunity_stage_values.is_default AS opportunity_stage_is_default,
      opportunity_stage_values.is_active AS opportunity_stage_is_active,
      reseller_deal_registrations.account_id,
      deal_accounts.name AS account_name, deal_accounts.website AS account_website,
      stage_values.id AS stage_id, stage_values.value_key AS stage_key, stage_values.label AS stage_label,
      stage_values.description AS stage_description, stage_values.color AS stage_color,
      stage_values.is_default AS stage_is_default, stage_values.is_active AS stage_is_active
    `;
  }

  private dealFromClause() {
    return `
      FROM reseller_deal_registrations
      INNER JOIN tenant_option_values AS stage_values
        ON stage_values.id = reseller_deal_registrations.stage_option_id AND stage_values.tenant_id = reseller_deal_registrations.tenant_id
      LEFT JOIN opportunities AS deal_opportunities
        ON deal_opportunities.id = reseller_deal_registrations.opportunity_id AND deal_opportunities.tenant_id = reseller_deal_registrations.tenant_id AND deal_opportunities.deleted_at IS NULL
      LEFT JOIN tenant_option_values AS opportunity_stage_values
        ON opportunity_stage_values.id = deal_opportunities.stage_option_id AND opportunity_stage_values.tenant_id = deal_opportunities.tenant_id
      LEFT JOIN accounts AS deal_accounts
        ON deal_accounts.id = reseller_deal_registrations.account_id AND deal_accounts.tenant_id = reseller_deal_registrations.tenant_id AND deal_accounts.deleted_at IS NULL
    `;
  }

  private mapDeal(row: ResellerDealRow): ResellerDealRegistrationSummary {
    return {
      id: row.id,
      resellerId: row.reseller_id,
      name: row.name,
      customerName: row.customer_name,
      stage: mapOptionValue({
        id: row.stage_id,
        key: row.stage_key,
        label: row.stage_label,
        description: row.stage_description,
        color: row.stage_color,
        isDefault: row.stage_is_default,
        isActive: row.stage_is_active
      }),
      amount: parseNumeric(row.amount),
      marginPercent: parseNumeric(row.margin_percent),
      expectedCloseDate: row.expected_close_date,
      notes: row.notes,
      opportunity: row.opportunity_id
        ? {
            id: row.opportunity_id,
            name: row.opportunity_name ?? "",
            stage: mapOptionValue({
              id: row.opportunity_stage_id,
              key: row.opportunity_stage_key,
              label: row.opportunity_stage_label,
              description: row.opportunity_stage_description,
              color: row.opportunity_stage_color,
              isDefault: row.opportunity_stage_is_default,
              isActive: row.opportunity_stage_is_active
            })
          }
        : null,
      account: row.account_id ? { id: row.account_id, name: row.account_name ?? "", website: row.account_website } : null,
      leadId: row.lead_id,
      metadata: getMetadata(row.metadata),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private async loadDeals(client: PoolClient, tenantId: string, resellerId: string): Promise<ResellerDealRegistrationSummary[]> {
    const result = await client.query<ResellerDealRow>(
      `
        SELECT ${this.dealSelectColumns()}
        ${this.dealFromClause()}
        WHERE reseller_deal_registrations.tenant_id = $1
          AND reseller_deal_registrations.reseller_id = $2
          AND reseller_deal_registrations.deleted_at IS NULL
        ORDER BY reseller_deal_registrations.updated_at DESC
      `,
      [tenantId, resellerId]
    );

    return result.rows.map((row) => this.mapDeal(row));
  }

  private async syncResellerContacts(client: PoolClient, actor: ActorContext, resellerId: string, contacts: ResellerContactInput[]) {
    await client.query(
      `UPDATE reseller_contacts SET deleted_at = NOW(), updated_by = $3 WHERE tenant_id = $1 AND reseller_id = $2 AND deleted_at IS NULL`,
      [actor.tenantId, resellerId, actor.userId]
    );

    for (const contact of contacts) {
      const name = contact.name.trim();

      if (name.length === 0) {
        continue;
      }

      const contactId = await this.ensureReference(client, actor.tenantId, "contacts", contact.contactId ?? null, "INVALID_CONTACT", "contact");

      await client.query(
        `
          INSERT INTO reseller_contacts (tenant_id, reseller_id, contact_id, name, title, email, phone, is_primary, created_by, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
        `,
        [
          actor.tenantId,
          resellerId,
          contactId,
          name,
          getTrimmedNullableString(contact.title),
          getTrimmedNullableString(contact.email),
          getTrimmedNullableString(contact.phone),
          Boolean(contact.isPrimary),
          actor.userId
        ]
      );
    }
  }

  private async syncOnboardingTasks(client: PoolClient, actor: ActorContext, resellerId: string, tasks: ResellerOnboardingTaskInput[]) {
    await client.query(
      `UPDATE reseller_onboarding_tasks SET deleted_at = NOW(), updated_by = $3 WHERE tenant_id = $1 AND reseller_id = $2 AND deleted_at IS NULL`,
      [actor.tenantId, resellerId, actor.userId]
    );

    let sortOrder = 0;

    for (const task of tasks) {
      const label = task.label.trim();

      if (label.length === 0) {
        continue;
      }

      const status = normalizeOnboardingTaskStatus(task.status);

      await client.query(
        `
          INSERT INTO reseller_onboarding_tasks (tenant_id, reseller_id, label, status, sort_order, due_date, completed_at, notes, created_by, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6::date, CASE WHEN $4 = 'completed' THEN NOW() ELSE NULL END, $7, $8, $8)
        `,
        [
          actor.tenantId,
          resellerId,
          label,
          status,
          task.sortOrder ?? sortOrder,
          task.dueDate ?? null,
          getTrimmedNullableString(task.notes),
          actor.userId
        ]
      );

      sortOrder += 1;
    }
  }

  async getResellerOptions(actor: ActorContext): Promise<ResellerOptionsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => ({
      owners: await this.loadOwners(client, actor.tenantId),
      accounts: await this.loadAccountsLookup(client, actor.tenantId),
      contacts: await this.loadContactsLookup(client, actor.tenantId),
      opportunities: await this.loadOpportunitiesLookup(client, actor.tenantId),
      statuses: await this.loadOptionSetValues(client, actor.tenantId, "reseller-status"),
      pricingTiers: await this.loadOptionSetValues(client, actor.tenantId, "reseller-pricing-tier"),
      marginProfiles: await this.loadOptionSetValues(client, actor.tenantId, "reseller-margin-profile"),
      onboardingStatuses: await this.loadOptionSetValues(client, actor.tenantId, "reseller-onboarding-status"),
      dealStages: await this.loadOptionSetValues(client, actor.tenantId, "reseller-deal-stage"),
      availableScopes: await this.getAvailableScopes(client, actor)
    }));
  }

  private async buildScopedWhere(client: PoolClient, actor: ActorContext, scope: ResellerPipelineScope) {
    const conditions = ["resellers.tenant_id = $1", "resellers.deleted_at IS NULL"];
    const params: unknown[] = [actor.tenantId];

    if (scope === "mine") {
      params.push(actor.userId);
      conditions.push(`resellers.owner_id = $${params.length}`);
    } else if (scope === "team") {
      const actorTeamId = await this.getActorTeamId(client, actor.tenantId, actor.userId);
      params.push(actorTeamId);
      conditions.push(`owner_users.team_id = $${params.length}`);
    }

    return { conditions, params };
  }

  async getResellerDashboard(actor: ActorContext, query: ResellerListQuery): Promise<ResellerDashboardResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const scope = await this.resolveScope(client, actor, query.scope);
      const { conditions, params } = await this.buildScopedWhere(client, actor, scope);
      const whereClause = conditions.join(" AND ");

      const result = await client.query<ResellerRow>(
        `SELECT ${this.resellerSelectColumns()} ${this.resellerFromClause()} WHERE ${whereClause}`,
        params
      );
      const resellers = result.rows.map((row) => this.mapResellerSummary(row));

      const pricingMap = new Map<string, { pricingTier: CrmOptionValueSummary | null; resellerCount: number }>();
      for (const reseller of resellers) {
        const key = reseller.pricingTier?.key ?? "__none__";
        const existing = pricingMap.get(key) ?? { pricingTier: reseller.pricingTier, resellerCount: 0 };
        existing.resellerCount += 1;
        pricingMap.set(key, existing);
      }

      const marginValues = resellers
        .map((reseller) => reseller.marginPercent)
        .filter((value): value is number => value !== null);

      const dealResult = await client.query<{ count: string; won_count: string; registered_value: string }>(
        `
          SELECT
            COUNT(*) AS count,
            COUNT(*) FILTER (WHERE deal_stage_values.value_key = 'won') AS won_count,
            COALESCE(SUM(reseller_deal_registrations.amount), 0) AS registered_value
          FROM reseller_deal_registrations
          INNER JOIN resellers ON resellers.id = reseller_deal_registrations.reseller_id AND resellers.tenant_id = reseller_deal_registrations.tenant_id
          LEFT JOIN users AS owner_users ON owner_users.id = resellers.owner_id AND owner_users.tenant_id = resellers.tenant_id
          INNER JOIN tenant_option_values AS deal_stage_values
            ON deal_stage_values.id = reseller_deal_registrations.stage_option_id AND deal_stage_values.tenant_id = reseller_deal_registrations.tenant_id
          WHERE reseller_deal_registrations.deleted_at IS NULL AND resellers.deleted_at IS NULL AND ${whereClause}
        `,
        params
      );
      const dealRow = dealResult.rows[0];

      return {
        scope,
        totalResellers: resellers.length,
        activeResellers: resellers.filter((reseller) => reseller.status?.key === "active").length,
        onboardingInProgress: resellers.filter((reseller) => reseller.onboardingStatus?.key === "in_progress").length,
        registeredDealCount: Number(dealRow?.count ?? "0"),
        registeredDealValue: Number(dealRow?.registered_value ?? "0"),
        wonDealCount: Number(dealRow?.won_count ?? "0"),
        averageMarginPercent: averageOf(marginValues),
        pricingTierDistribution: Array.from(pricingMap.values()),
        performancePlaceholder: {
          available: false,
          message: "Deeper reseller performance analytics will connect once channel reporting pipelines are introduced."
        }
      };
    });
  }

  async listResellers(actor: ActorContext, query: ResellerListQuery): Promise<ResellersResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const scope = await this.resolveScope(client, actor, query.scope);
      const page = Math.max(1, query.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
      const { conditions, params } = await this.buildScopedWhere(client, actor, scope);

      if (query.search) {
        params.push(`%${query.search.trim()}%`);
        conditions.push(`(resellers.name ILIKE $${params.length} OR resellers.region ILIKE $${params.length} OR resellers.territory ILIKE $${params.length})`);
      }
      if (query.status) {
        params.push(query.status);
        conditions.push(`status_values.value_key = $${params.length}`);
      }
      if (query.pricingTier) {
        params.push(query.pricingTier);
        conditions.push(`pricing_values.value_key = $${params.length}`);
      }
      if (query.marginProfile) {
        params.push(query.marginProfile);
        conditions.push(`margin_values.value_key = $${params.length}`);
      }
      if (query.onboardingStatus) {
        params.push(query.onboardingStatus);
        conditions.push(`onboarding_values.value_key = $${params.length}`);
      }
      if (query.ownerId) {
        params.push(query.ownerId);
        conditions.push(`resellers.owner_id = $${params.length}`);
      }

      const whereClause = conditions.join(" AND ");
      const sortColumnMap: Record<string, string> = {
        name: "resellers.name",
        status: "status_values.sort_order",
        pricingTier: "pricing_values.sort_order",
        updatedAt: "resellers.updated_at",
        createdAt: "resellers.created_at"
      };
      const sortColumn = sortColumnMap[query.sortBy ?? "updatedAt"] ?? "resellers.updated_at";
      const sortOrder = query.sortOrder === "asc" ? "ASC" : "DESC";

      const countResult = await client.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total ${this.resellerFromClause()} WHERE ${whereClause}`,
        params
      );
      const total = Number(countResult.rows[0]?.total ?? "0");

      const listParams = [...params, pageSize, (page - 1) * pageSize];
      const listResult = await client.query<ResellerRow>(
        `
          SELECT ${this.resellerSelectColumns()}
          ${this.resellerFromClause()}
          WHERE ${whereClause}
          ORDER BY ${sortColumn} ${sortOrder} NULLS LAST, resellers.created_at DESC
          LIMIT $${listParams.length - 1} OFFSET $${listParams.length}
        `,
        listParams
      );

      return {
        resellers: listResult.rows.map((row) => this.mapResellerSummary(row)),
        pagination: buildPagination(page, pageSize, total)
      };
    });
  }

  private async loadResellerDetail(client: PoolClient, actor: ActorContext, resellerId: string): Promise<ResellerDetail> {
    const result = await client.query<ResellerRow>(
      `
        SELECT ${this.resellerSelectColumns()}
        ${this.resellerFromClause()}
        WHERE resellers.tenant_id = $1 AND resellers.id = $2 AND resellers.deleted_at IS NULL
        LIMIT 1
      `,
      [actor.tenantId, resellerId]
    );

    const row = result.rows[0];

    if (!row) {
      throw new AppError(404, "Reseller not found.", undefined, "RESELLER_NOT_FOUND");
    }

    const summary = this.mapResellerSummary(row);
    const contacts = await this.loadResellerContacts(client, actor.tenantId, resellerId);
    const onboardingTasks = await this.loadOnboardingTasks(client, actor.tenantId, resellerId);
    const deals = await this.loadDeals(client, actor.tenantId, resellerId);
    const completedOnboarding = onboardingTasks.filter((task) => task.status === "completed").length;
    const dealMargins = deals.map((deal) => deal.marginPercent).filter((value): value is number => value !== null);

    return {
      ...summary,
      contacts,
      onboardingTasks,
      deals,
      performance: {
        onboardingTaskCount: onboardingTasks.length,
        completedOnboardingTaskCount: completedOnboarding,
        onboardingCompletionRate: onboardingTasks.length === 0 ? 0 : completedOnboarding / onboardingTasks.length,
        dealCount: deals.length,
        registeredDealValue: deals.reduce((sum, deal) => sum + (deal.amount ?? 0), 0),
        wonDealCount: deals.filter((deal) => deal.stage?.key === "won").length,
        averageMarginPercent: averageOf(dealMargins),
        contactCount: contacts.length
      },
      catalogPlaceholder: {
        available: false,
        message: "The reseller catalog will connect once the product and pricing catalog is introduced."
      },
      orderTrackingPlaceholder: {
        available: false,
        message: "Reseller order tracking will connect once the order management runtime is introduced."
      },
      trainingPlaceholder: {
        available: false,
        message: "Reseller training linkage will connect once the training module is introduced."
      },
      certificationPlaceholder: {
        available: false,
        message: "Reseller certification will connect once the certification module is introduced."
      },
      supportTicketsPlaceholder: {
        available: false,
        message: "Reseller support tickets will connect once the support module is operational."
      },
      aiPlaceholders: this.buildAiPlaceholders(actor)
    };
  }

  async getReseller(actor: ActorContext, resellerId: string): Promise<ResellerResponse> {
    this.assertEnabled();

    const reseller = await this.databaseService.withClient(async (client) => this.loadResellerDetail(client, actor, resellerId));
    return { reseller };
  }

  async createReseller(actor: ActorContext, audit: AuditMetadata, input: CreateResellerRequestBody): Promise<ResellerResponse> {
    this.assertEnabled();

    const resellerId = await this.databaseService.withTransaction(async (client) => {
      const accountId = await this.ensureReference(client, actor.tenantId, "accounts", input.accountId ?? null, "INVALID_ACCOUNT", "account");
      const ownerId = await this.ensureReference(client, actor.tenantId, "users", input.ownerId ?? null, "INVALID_OWNER", "owner");
      const statusOptionId = await this.resolveOptionValueId(client, actor.tenantId, "reseller-status", input.statusKey ?? "prospect", "Reseller status");
      const pricingTierOptionId = await this.resolveOptionValueId(client, actor.tenantId, "reseller-pricing-tier", input.pricingTierKey, "Reseller pricing tier");
      const marginProfileOptionId = await this.resolveOptionValueId(client, actor.tenantId, "reseller-margin-profile", input.marginProfileKey, "Reseller margin profile");
      const onboardingStatusOptionId = await this.resolveOptionValueId(client, actor.tenantId, "reseller-onboarding-status", input.onboardingStatusKey ?? "not_started", "Reseller onboarding status");

      const result = await client.query<{ id: string }>(
        `
          INSERT INTO resellers (
            tenant_id, account_id, owner_id, name, status_option_id, pricing_tier_option_id, margin_profile_option_id,
            onboarding_status_option_id, region, territory, margin_percent, agreement_reference, agreement_start_date,
            agreement_end_date, agreement_notes, metadata, created_by, updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::date, $14::date, $15, $16::jsonb, $17, $17)
          RETURNING id
        `,
        [
          actor.tenantId,
          accountId,
          ownerId,
          input.name.trim(),
          statusOptionId,
          pricingTierOptionId,
          marginProfileOptionId,
          onboardingStatusOptionId,
          getTrimmedNullableString(input.region),
          getTrimmedNullableString(input.territory),
          input.marginPercent ?? null,
          getTrimmedNullableString(input.agreementReference),
          input.agreementStartDate ?? null,
          input.agreementEndDate ?? null,
          getTrimmedNullableString(input.agreementNotes),
          JSON.stringify(input.metadata ?? {}),
          actor.userId
        ]
      );

      const nextResellerId = result.rows[0]?.id;

      if (!nextResellerId) {
        throw new AppError(500, "Reseller creation failed.", undefined, "RESELLER_CREATE_FAILED");
      }

      if (input.contacts && input.contacts.length > 0) {
        await this.syncResellerContacts(client, actor, nextResellerId, input.contacts);
      }
      if (input.onboardingTasks && input.onboardingTasks.length > 0) {
        await this.syncOnboardingTasks(client, actor, nextResellerId, input.onboardingTasks);
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "reseller.create",
        resourceType: "reseller",
        resourceId: nextResellerId,
        status: "success",
        metadata: { pricingTierKey: input.pricingTierKey, marginProfileKey: input.marginProfileKey, ownerId, accountId }
      });

      return nextResellerId;
    });

    return this.getReseller(actor, resellerId);
  }

  async updateReseller(actor: ActorContext, audit: AuditMetadata, resellerId: string, input: UpdateResellerRequestBody): Promise<ResellerResponse> {
    this.assertEnabled();

    await this.databaseService.withTransaction(async (client) => {
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateResellerRequestBody] !== undefined);
      this.assertResellerMutation(actor, keys);
      await this.getResellerState(client, actor.tenantId, resellerId);

      const assignments: string[] = [];
      const params: unknown[] = [resellerId, actor.tenantId, actor.userId];

      const pushAssignment = (column: string, value: unknown, cast = "") => {
        params.push(value);
        assignments.push(`${column} = $${params.length}${cast}`);
      };

      if (keys.includes("name") && input.name !== undefined) {
        pushAssignment("name", input.name.trim());
      }
      if (keys.includes("accountId")) {
        pushAssignment("account_id", await this.ensureReference(client, actor.tenantId, "accounts", input.accountId ?? null, "INVALID_ACCOUNT", "account"));
      }
      if (keys.includes("ownerId")) {
        pushAssignment("owner_id", await this.ensureReference(client, actor.tenantId, "users", input.ownerId ?? null, "INVALID_OWNER", "owner"));
      }
      if (keys.includes("statusKey") && input.statusKey) {
        pushAssignment("status_option_id", await this.resolveOptionValueId(client, actor.tenantId, "reseller-status", input.statusKey, "Reseller status"));
      }
      if (keys.includes("pricingTierKey") && input.pricingTierKey) {
        pushAssignment("pricing_tier_option_id", await this.resolveOptionValueId(client, actor.tenantId, "reseller-pricing-tier", input.pricingTierKey, "Reseller pricing tier"));
      }
      if (keys.includes("marginProfileKey") && input.marginProfileKey) {
        pushAssignment("margin_profile_option_id", await this.resolveOptionValueId(client, actor.tenantId, "reseller-margin-profile", input.marginProfileKey, "Reseller margin profile"));
      }
      if (keys.includes("onboardingStatusKey") && input.onboardingStatusKey) {
        pushAssignment("onboarding_status_option_id", await this.resolveOptionValueId(client, actor.tenantId, "reseller-onboarding-status", input.onboardingStatusKey, "Reseller onboarding status"));
      }
      if (keys.includes("region")) {
        pushAssignment("region", getTrimmedNullableString(input.region));
      }
      if (keys.includes("territory")) {
        pushAssignment("territory", getTrimmedNullableString(input.territory));
      }
      if (keys.includes("marginPercent")) {
        pushAssignment("margin_percent", input.marginPercent ?? null);
      }
      if (keys.includes("agreementReference")) {
        pushAssignment("agreement_reference", getTrimmedNullableString(input.agreementReference));
      }
      if (keys.includes("agreementStartDate")) {
        pushAssignment("agreement_start_date", input.agreementStartDate ?? null, "::date");
      }
      if (keys.includes("agreementEndDate")) {
        pushAssignment("agreement_end_date", input.agreementEndDate ?? null, "::date");
      }
      if (keys.includes("agreementNotes")) {
        pushAssignment("agreement_notes", getTrimmedNullableString(input.agreementNotes));
      }
      if (keys.includes("metadata")) {
        pushAssignment("metadata", JSON.stringify(input.metadata ?? {}), "::jsonb");
      }

      if (assignments.length > 0) {
        await client.query(
          `UPDATE resellers SET ${assignments.join(", ")}, updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          params
        );
      } else {
        await client.query(`UPDATE resellers SET updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, params);
      }

      if (keys.includes("contacts") && input.contacts) {
        await this.syncResellerContacts(client, actor, resellerId, input.contacts);
      }
      if (keys.includes("onboardingTasks") && input.onboardingTasks) {
        await this.syncOnboardingTasks(client, actor, resellerId, input.onboardingTasks);
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "reseller.update",
        resourceType: "reseller",
        resourceId: resellerId,
        status: "success",
        metadata: { updatedFields: keys }
      });
    });

    return this.getReseller(actor, resellerId);
  }

  async deleteReseller(actor: ActorContext, audit: AuditMetadata, resellerId: string): Promise<CrmMutationSuccessResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      await this.getResellerState(client, actor.tenantId, resellerId);

      for (const table of ["reseller_contacts", "reseller_onboarding_tasks", "reseller_deal_registrations"]) {
        await client.query(
          `UPDATE ${table} SET deleted_at = NOW(), updated_by = $3 WHERE tenant_id = $1 AND reseller_id = $2 AND deleted_at IS NULL`,
          [actor.tenantId, resellerId, actor.userId]
        );
      }
      await client.query(
        `UPDATE resellers SET deleted_at = NOW(), updated_by = $3 WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [actor.tenantId, resellerId, actor.userId]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "reseller.delete",
        resourceType: "reseller",
        resourceId: resellerId,
        status: "success"
      });

      return { success: true };
    });
  }

  async listResellerDeals(actor: ActorContext, resellerId: string): Promise<ResellerDealRegistrationsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      await this.getResellerState(client, actor.tenantId, resellerId);
      return { deals: await this.loadDeals(client, actor.tenantId, resellerId) };
    });
  }

  private async loadDeal(client: PoolClient, tenantId: string, resellerId: string, dealId: string) {
    const result = await client.query<ResellerDealRow>(
      `
        SELECT ${this.dealSelectColumns()}
        ${this.dealFromClause()}
        WHERE reseller_deal_registrations.tenant_id = $1
          AND reseller_deal_registrations.reseller_id = $2
          AND reseller_deal_registrations.id = $3
          AND reseller_deal_registrations.deleted_at IS NULL
        LIMIT 1
      `,
      [tenantId, resellerId, dealId]
    );

    const row = result.rows[0];

    if (!row) {
      throw new AppError(404, "Reseller deal registration not found.", undefined, "RESELLER_DEAL_NOT_FOUND");
    }

    return this.mapDeal(row);
  }

  async createResellerDeal(
    actor: ActorContext,
    audit: AuditMetadata,
    resellerId: string,
    input: CreateResellerDealRegistrationRequestBody
  ): Promise<ResellerDealRegistrationResponse> {
    this.assertEnabled();

    const dealId = await this.databaseService.withTransaction(async (client) => {
      await this.getResellerState(client, actor.tenantId, resellerId);
      const opportunityId = await this.ensureReference(client, actor.tenantId, "opportunities", input.opportunityId ?? null, "INVALID_OPPORTUNITY", "opportunity");
      const accountId = await this.ensureReference(client, actor.tenantId, "accounts", input.accountId ?? null, "INVALID_ACCOUNT", "account");
      const leadId = await this.ensureReference(client, actor.tenantId, "leads", input.leadId ?? null, "INVALID_LEAD", "lead");
      const stageOptionId = await this.resolveOptionValueId(client, actor.tenantId, "reseller-deal-stage", input.stageKey ?? "registered", "Reseller deal stage");

      const result = await client.query<{ id: string }>(
        `
          INSERT INTO reseller_deal_registrations (
            tenant_id, reseller_id, opportunity_id, account_id, lead_id, name, customer_name,
            stage_option_id, amount, margin_percent, expected_close_date, notes, metadata, created_by, updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::date, $12, $13::jsonb, $14, $14)
          RETURNING id
        `,
        [
          actor.tenantId,
          resellerId,
          opportunityId,
          accountId,
          leadId,
          input.name.trim(),
          getTrimmedNullableString(input.customerName),
          stageOptionId,
          input.amount ?? null,
          input.marginPercent ?? null,
          input.expectedCloseDate ?? null,
          getTrimmedNullableString(input.notes),
          JSON.stringify(input.metadata ?? {}),
          actor.userId
        ]
      );

      const nextDealId = result.rows[0]?.id;

      if (!nextDealId) {
        throw new AppError(500, "Reseller deal registration failed.", undefined, "RESELLER_DEAL_CREATE_FAILED");
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "reseller.deal.register",
        resourceType: "reseller_deal_registration",
        resourceId: nextDealId,
        status: "success",
        metadata: { resellerId, opportunityId, stageKey: input.stageKey ?? "registered" }
      });

      return nextDealId;
    });

    const deal = await this.databaseService.withClient(async (client) => this.loadDeal(client, actor.tenantId, resellerId, dealId));
    return { deal };
  }

  async updateResellerDeal(
    actor: ActorContext,
    audit: AuditMetadata,
    resellerId: string,
    dealId: string,
    input: UpdateResellerDealRegistrationRequestBody
  ): Promise<ResellerDealRegistrationResponse> {
    this.assertEnabled();

    await this.databaseService.withTransaction(async (client) => {
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateResellerDealRegistrationRequestBody] !== undefined);

      if (keys.length === 0) {
        throw new AppError(400, "At least one field must be updated.", undefined, "VALIDATION_ERROR");
      }

      const canEdit =
        actor.permissionCodes.includes("resellers.edit") ||
        actor.permissionCodes.includes("resellers.approve") ||
        actor.permissionCodes.includes("resellers.configure") ||
        actor.permissionCodes.includes("resellers.manage_workflow");

      if (!canEdit) {
        throw new AppError(403, "You do not have permission to update reseller deals.", undefined, "AUTHORIZATION_ERROR");
      }

      await this.getResellerState(client, actor.tenantId, resellerId);
      await this.loadDeal(client, actor.tenantId, resellerId, dealId);

      const assignments: string[] = [];
      const params: unknown[] = [dealId, actor.tenantId, resellerId, actor.userId];

      const pushAssignment = (column: string, value: unknown, cast = "") => {
        params.push(value);
        assignments.push(`${column} = $${params.length}${cast}`);
      };

      if (keys.includes("name") && input.name !== undefined) {
        pushAssignment("name", input.name.trim());
      }
      if (keys.includes("stageKey") && input.stageKey) {
        pushAssignment("stage_option_id", await this.resolveOptionValueId(client, actor.tenantId, "reseller-deal-stage", input.stageKey, "Reseller deal stage"));
      }
      if (keys.includes("customerName")) {
        pushAssignment("customer_name", getTrimmedNullableString(input.customerName));
      }
      if (keys.includes("amount")) {
        pushAssignment("amount", input.amount ?? null);
      }
      if (keys.includes("marginPercent")) {
        pushAssignment("margin_percent", input.marginPercent ?? null);
      }
      if (keys.includes("expectedCloseDate")) {
        pushAssignment("expected_close_date", input.expectedCloseDate ?? null, "::date");
      }
      if (keys.includes("notes")) {
        pushAssignment("notes", getTrimmedNullableString(input.notes));
      }
      if (keys.includes("opportunityId")) {
        pushAssignment("opportunity_id", await this.ensureReference(client, actor.tenantId, "opportunities", input.opportunityId ?? null, "INVALID_OPPORTUNITY", "opportunity"));
      }
      if (keys.includes("accountId")) {
        pushAssignment("account_id", await this.ensureReference(client, actor.tenantId, "accounts", input.accountId ?? null, "INVALID_ACCOUNT", "account"));
      }
      if (keys.includes("leadId")) {
        pushAssignment("lead_id", await this.ensureReference(client, actor.tenantId, "leads", input.leadId ?? null, "INVALID_LEAD", "lead"));
      }
      if (keys.includes("metadata")) {
        pushAssignment("metadata", JSON.stringify(input.metadata ?? {}), "::jsonb");
      }

      if (assignments.length > 0) {
        await client.query(
          `UPDATE reseller_deal_registrations SET ${assignments.join(", ")}, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND reseller_id = $3 AND deleted_at IS NULL`,
          params
        );
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "reseller.deal.update",
        resourceType: "reseller_deal_registration",
        resourceId: dealId,
        status: "success",
        metadata: { resellerId, updatedFields: keys }
      });
    });

    const deal = await this.databaseService.withClient(async (client) => this.loadDeal(client, actor.tenantId, resellerId, dealId));
    return { deal };
  }
}

interface ResellerRow {
  id: string;
  name: string;
  region: string | null;
  territory: string | null;
  margin_percent: string | number | null;
  agreement_reference: string | null;
  agreement_start_date: string | null;
  agreement_end_date: string | null;
  agreement_notes: string | null;
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
  status_id: string | null;
  status_key: string | null;
  status_label: string | null;
  status_description: string | null;
  status_color: string | null;
  status_is_default: boolean | null;
  status_is_active: boolean | null;
  pricing_id: string | null;
  pricing_key: string | null;
  pricing_label: string | null;
  pricing_description: string | null;
  pricing_color: string | null;
  pricing_is_default: boolean | null;
  pricing_is_active: boolean | null;
  margin_id: string | null;
  margin_key: string | null;
  margin_label: string | null;
  margin_description: string | null;
  margin_color: string | null;
  margin_is_default: boolean | null;
  margin_is_active: boolean | null;
  onboarding_id: string | null;
  onboarding_key: string | null;
  onboarding_label: string | null;
  onboarding_description: string | null;
  onboarding_color: string | null;
  onboarding_is_default: boolean | null;
  onboarding_is_active: boolean | null;
  contact_count: number;
  deal_count: number;
  won_deal_count: number;
  registered_deal_value: string | number | null;
  deal_average_margin: string | number | null;
  onboarding_task_count: number;
  completed_onboarding_task_count: number;
}

interface ResellerDealRow {
  id: string;
  reseller_id: string;
  name: string;
  customer_name: string | null;
  amount: string | number | null;
  margin_percent: string | number | null;
  expected_close_date: string | null;
  notes: string | null;
  lead_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  opportunity_id: string | null;
  opportunity_name: string | null;
  opportunity_stage_id: string | null;
  opportunity_stage_key: string | null;
  opportunity_stage_label: string | null;
  opportunity_stage_description: string | null;
  opportunity_stage_color: string | null;
  opportunity_stage_is_default: boolean | null;
  opportunity_stage_is_active: boolean | null;
  account_id: string | null;
  account_name: string | null;
  account_website: string | null;
  stage_id: string | null;
  stage_key: string | null;
  stage_label: string | null;
  stage_description: string | null;
  stage_color: string | null;
  stage_is_default: boolean | null;
  stage_is_active: boolean | null;
}
