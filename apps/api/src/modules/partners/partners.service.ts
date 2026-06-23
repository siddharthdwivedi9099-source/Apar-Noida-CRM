import type {
  AccountLookupSummary,
  ContactRelationshipSummary,
  CreatePartnerDealRegistrationRequestBody,
  CreatePartnerRequestBody,
  CrmLookupUserSummary,
  CrmMutationSuccessResponse,
  CrmOptionValueSummary,
  OpportunityLookupSummary,
  PartnerAiPlaceholderSummary,
  PartnerContactInput,
  PartnerContactSummary,
  PartnerDashboardResponse,
  PartnerDealRegistrationResponse,
  PartnerDealRegistrationSummary,
  PartnerDealRegistrationsResponse,
  PartnerDetail,
  PartnerListQuery,
  PartnerOnboardingTaskInput,
  PartnerOnboardingTaskStatus,
  PartnerOnboardingTaskSummary,
  PartnerOptionsResponse,
  PartnerPipelineScope,
  PartnerResponse,
  PartnerSummary,
  PartnersResponse,
  RoleSummary,
  UpdatePartnerDealRegistrationRequestBody,
  UpdatePartnerRequestBody
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

const ONBOARDING_TASK_STATUSES: PartnerOnboardingTaskStatus[] = ["pending", "in_progress", "completed", "blocked"];

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

function normalizeOnboardingTaskStatus(value: unknown): PartnerOnboardingTaskStatus {
  return ONBOARDING_TASK_STATUSES.includes(value as PartnerOnboardingTaskStatus)
    ? (value as PartnerOnboardingTaskStatus)
    : "pending";
}

export class PartnersService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {}

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(
        503,
        "Partner channel management is unavailable until the database connection is enabled.",
        undefined,
        "PARTNERS_UNAVAILABLE"
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

  private async loadOptionSetValues(
    client: PoolClient,
    tenantId: string,
    setKey: string
  ): Promise<CrmOptionValueSummary[]> {
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

  private async resolveOptionValueId(
    client: PoolClient,
    tenantId: string,
    setKey: string,
    valueKey: string,
    label: string
  ) {
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
      actor.permissionCodes.includes("partners.assign") ||
      actor.permissionCodes.includes("partners.configure") ||
      actor.permissionCodes.includes("partners.view_dashboard") ||
      actor.permissionCodes.includes("partners.manage_workflow") ||
      actor.permissionCodes.includes("sales.view_dashboard") ||
      actor.permissionCodes.includes("dashboards.view_dashboard")
    );
  }

  private async getAvailableScopes(client: PoolClient, actor: ActorContext): Promise<PartnerPipelineScope[]> {
    if (!this.getSharedScopePermissions(actor)) {
      return ["mine"];
    }

    const actorTeamId = await this.getActorTeamId(client, actor.tenantId, actor.userId);
    return actorTeamId ? ["mine", "team", "all"] : ["mine", "all"];
  }

  private async resolveScope(
    client: PoolClient,
    actor: ActorContext,
    requestedScope: PartnerPipelineScope | undefined
  ): Promise<PartnerPipelineScope> {
    const availableScopes = await this.getAvailableScopes(client, actor);
    const effectiveScope = requestedScope ?? (availableScopes.includes("all") ? "all" : "mine");

    if (!availableScopes.includes(effectiveScope)) {
      throw new AppError(403, "You do not have permission to inspect this scope.", undefined, "AUTHORIZATION_ERROR");
    }

    return effectiveScope;
  }

  private buildAiPlaceholders(actor: ActorContext): PartnerAiPlaceholderSummary {
    const permissionCodes = new Set(actor.permissionCodes);
    const canUseAi =
      permissionCodes.has("partners.use_ai") ||
      permissionCodes.has("partners.manage_ai") ||
      permissionCodes.has("ai.use_ai") ||
      permissionCodes.has("ai.manage_ai");
    const canManageAi = permissionCodes.has("partners.manage_ai") || permissionCodes.has("ai.manage_ai");

    return {
      actions: canUseAi
        ? [
            {
              key: "partner_fit_score",
              label: "Partner fit score",
              description: "Placeholder entry point for future partner fit and qualification scoring."
            },
            {
              key: "partner_performance_summary",
              label: "Partner performance summary",
              description: "Placeholder entry point for future partner performance summarization."
            },
            {
              key: "partner_action_plan",
              label: "Partner action plan",
              description: "Placeholder entry point for future partner enablement and action plans."
            },
            {
              key: "partner_churn_risk",
              label: "Partner churn risk",
              description: "Placeholder entry point for future partner churn and disengagement risk detection."
            },
            {
              key: "partner_conflict_detection",
              label: "Partner conflict detection",
              description: "Placeholder entry point for future deal-registration and channel conflict detection."
            }
          ]
        : [],
      governanceHint: canManageAi
        ? "AI placeholders are visible and will later connect to the governed AI Gateway with partner-specific controls."
        : canUseAi
          ? "AI placeholders are visible for this role, but execution remains deferred until the AI Gateway phase."
          : "AI placeholders remain hidden until the role includes partner or global AI usage permissions."
    };
  }

  private async getPartnerState(client: PoolClient, tenantId: string, partnerId: string) {
    const result = await client.query<{ id: string; owner_id: string | null }>(
      `SELECT id, owner_id FROM partners WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [partnerId, tenantId]
    );

    const row = result.rows[0];

    if (!row) {
      throw new AppError(404, "Partner not found.", undefined, "PARTNER_NOT_FOUND");
    }

    return row;
  }

  private assertPartnerMutation(actor: ActorContext, keys: string[]) {
    if (keys.length === 0) {
      throw new AppError(400, "At least one field must be updated.", undefined, "VALIDATION_ERROR");
    }

    const canEdit = actor.permissionCodes.includes("partners.edit") || actor.permissionCodes.includes("partners.configure");
    const canAssign =
      actor.permissionCodes.includes("partners.assign") || actor.permissionCodes.includes("partners.configure");
    const ownerOnlyMutation = keys.every((key) => key === "ownerId");

    if (!canEdit && !(canAssign && ownerOnlyMutation)) {
      throw new AppError(403, "You do not have permission to update this partner.", undefined, "AUTHORIZATION_ERROR");
    }

    if (!canAssign && keys.includes("ownerId")) {
      throw new AppError(403, "You do not have permission to reassign partner ownership.", undefined, "AUTHORIZATION_ERROR");
    }
  }

  private partnerSelectColumns() {
    return `
      partners.id,
      partners.name,
      partners.region,
      partners.territory,
      partners.agreement_reference,
      partners.agreement_start_date,
      partners.agreement_end_date,
      partners.agreement_notes,
      partners.metadata,
      partners.created_at,
      partners.updated_at,
      partners.account_id,
      partner_accounts.name AS account_name,
      partner_accounts.website AS account_website,
      owner_users.id AS owner_id,
      owner_users.display_name AS owner_display_name,
      owner_users.email AS owner_email,
      owner_teams.name AS owner_team_name,
      owner_departments.name AS owner_department_name,
      type_values.id AS type_id, type_values.value_key AS type_key, type_values.label AS type_label,
      type_values.description AS type_description, type_values.color AS type_color,
      type_values.is_default AS type_is_default, type_values.is_active AS type_is_active,
      tier_values.id AS tier_id, tier_values.value_key AS tier_key, tier_values.label AS tier_label,
      tier_values.description AS tier_description, tier_values.color AS tier_color,
      tier_values.is_default AS tier_is_default, tier_values.is_active AS tier_is_active,
      status_values.id AS status_id, status_values.value_key AS status_key, status_values.label AS status_label,
      status_values.description AS status_description, status_values.color AS status_color,
      status_values.is_default AS status_is_default, status_values.is_active AS status_is_active,
      onboarding_values.id AS onboarding_id, onboarding_values.value_key AS onboarding_key, onboarding_values.label AS onboarding_label,
      onboarding_values.description AS onboarding_description, onboarding_values.color AS onboarding_color,
      onboarding_values.is_default AS onboarding_is_default, onboarding_values.is_active AS onboarding_is_active,
      COALESCE(contact_counts.count, 0)::int AS contact_count,
      COALESCE(deal_counts.count, 0)::int AS deal_count,
      COALESCE(deal_counts.won_count, 0)::int AS won_deal_count,
      COALESCE(deal_counts.registered_value, 0)::numeric AS registered_deal_value,
      COALESCE(task_counts.count, 0)::int AS onboarding_task_count,
      COALESCE(task_counts.completed_count, 0)::int AS completed_onboarding_task_count
    `;
  }

  private partnerFromClause() {
    return `
      FROM partners
      INNER JOIN tenant_option_values AS type_values
        ON type_values.id = partners.type_option_id AND type_values.tenant_id = partners.tenant_id
      INNER JOIN tenant_option_values AS tier_values
        ON tier_values.id = partners.tier_option_id AND tier_values.tenant_id = partners.tenant_id
      INNER JOIN tenant_option_values AS status_values
        ON status_values.id = partners.status_option_id AND status_values.tenant_id = partners.tenant_id
      INNER JOIN tenant_option_values AS onboarding_values
        ON onboarding_values.id = partners.onboarding_status_option_id AND onboarding_values.tenant_id = partners.tenant_id
      LEFT JOIN accounts AS partner_accounts
        ON partner_accounts.id = partners.account_id AND partner_accounts.tenant_id = partners.tenant_id AND partner_accounts.deleted_at IS NULL
      LEFT JOIN users AS owner_users
        ON owner_users.id = partners.owner_id AND owner_users.tenant_id = partners.tenant_id AND owner_users.deleted_at IS NULL
      LEFT JOIN teams AS owner_teams
        ON owner_teams.id = owner_users.team_id AND owner_teams.tenant_id = owner_users.tenant_id AND owner_teams.deleted_at IS NULL
      LEFT JOIN departments AS owner_departments
        ON owner_departments.id = owner_users.department_id AND owner_departments.tenant_id = owner_users.tenant_id AND owner_departments.deleted_at IS NULL
      LEFT JOIN (
        SELECT tenant_id, partner_id, COUNT(*) AS count
        FROM partner_contacts WHERE deleted_at IS NULL GROUP BY tenant_id, partner_id
      ) AS contact_counts
        ON contact_counts.tenant_id = partners.tenant_id AND contact_counts.partner_id = partners.id
      LEFT JOIN (
        SELECT partner_deal_registrations.tenant_id, partner_deal_registrations.partner_id,
          COUNT(*) AS count,
          COUNT(*) FILTER (WHERE deal_stage_values.value_key = 'won') AS won_count,
          COALESCE(SUM(partner_deal_registrations.amount), 0) AS registered_value
        FROM partner_deal_registrations
        INNER JOIN tenant_option_values AS deal_stage_values
          ON deal_stage_values.id = partner_deal_registrations.stage_option_id
         AND deal_stage_values.tenant_id = partner_deal_registrations.tenant_id
        WHERE partner_deal_registrations.deleted_at IS NULL
        GROUP BY partner_deal_registrations.tenant_id, partner_deal_registrations.partner_id
      ) AS deal_counts
        ON deal_counts.tenant_id = partners.tenant_id AND deal_counts.partner_id = partners.id
      LEFT JOIN (
        SELECT tenant_id, partner_id, COUNT(*) AS count, COUNT(*) FILTER (WHERE status = 'completed') AS completed_count
        FROM partner_onboarding_tasks WHERE deleted_at IS NULL GROUP BY tenant_id, partner_id
      ) AS task_counts
        ON task_counts.tenant_id = partners.tenant_id AND task_counts.partner_id = partners.id
    `;
  }

  private mapPartnerSummary(row: PartnerRow): PartnerSummary {
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
      type: mapOptionValue({
        id: row.type_id,
        key: row.type_key,
        label: row.type_label,
        description: row.type_description,
        color: row.type_color,
        isDefault: row.type_is_default,
        isActive: row.type_is_active
      }),
      tier: mapOptionValue({
        id: row.tier_id,
        key: row.tier_key,
        label: row.tier_label,
        description: row.tier_description,
        color: row.tier_color,
        isDefault: row.tier_is_default,
        isActive: row.tier_is_active
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

  private async loadPartnerContacts(
    client: PoolClient,
    tenantId: string,
    partnerId: string
  ): Promise<PartnerContactSummary[]> {
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
          partner_contacts.id, partner_contacts.name, partner_contacts.title, partner_contacts.email,
          partner_contacts.phone, partner_contacts.is_primary, partner_contacts.created_at, partner_contacts.updated_at,
          contacts.id AS contact_id, contacts.first_name AS contact_first_name, contacts.last_name AS contact_last_name,
          contacts.email AS contact_email,
          role_values.id AS contact_role_id, role_values.value_key AS contact_role_key, role_values.label AS contact_role_label,
          role_values.description AS contact_role_description, role_values.color AS contact_role_color,
          role_values.is_default AS contact_role_is_default, role_values.is_active AS contact_role_is_active
        FROM partner_contacts
        LEFT JOIN contacts
          ON contacts.id = partner_contacts.contact_id AND contacts.tenant_id = partner_contacts.tenant_id AND contacts.deleted_at IS NULL
        LEFT JOIN tenant_option_values AS role_values
          ON role_values.id = contacts.role_option_id AND role_values.tenant_id = contacts.tenant_id
        WHERE partner_contacts.tenant_id = $1 AND partner_contacts.partner_id = $2 AND partner_contacts.deleted_at IS NULL
        ORDER BY partner_contacts.is_primary DESC, partner_contacts.created_at ASC
      `,
      [tenantId, partnerId]
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

  private async loadOnboardingTasks(
    client: PoolClient,
    tenantId: string,
    partnerId: string
  ): Promise<PartnerOnboardingTaskSummary[]> {
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
        FROM partner_onboarding_tasks
        WHERE tenant_id = $1 AND partner_id = $2 AND deleted_at IS NULL
        ORDER BY sort_order ASC, created_at ASC
      `,
      [tenantId, partnerId]
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
      partner_deal_registrations.id,
      partner_deal_registrations.partner_id,
      partner_deal_registrations.name,
      partner_deal_registrations.customer_name,
      partner_deal_registrations.amount,
      partner_deal_registrations.expected_close_date,
      partner_deal_registrations.notes,
      partner_deal_registrations.lead_id,
      partner_deal_registrations.metadata,
      partner_deal_registrations.created_at,
      partner_deal_registrations.updated_at,
      partner_deal_registrations.opportunity_id,
      deal_opportunities.name AS opportunity_name,
      opportunity_stage_values.id AS opportunity_stage_id, opportunity_stage_values.value_key AS opportunity_stage_key,
      opportunity_stage_values.label AS opportunity_stage_label, opportunity_stage_values.description AS opportunity_stage_description,
      opportunity_stage_values.color AS opportunity_stage_color, opportunity_stage_values.is_default AS opportunity_stage_is_default,
      opportunity_stage_values.is_active AS opportunity_stage_is_active,
      partner_deal_registrations.account_id,
      deal_accounts.name AS account_name, deal_accounts.website AS account_website,
      stage_values.id AS stage_id, stage_values.value_key AS stage_key, stage_values.label AS stage_label,
      stage_values.description AS stage_description, stage_values.color AS stage_color,
      stage_values.is_default AS stage_is_default, stage_values.is_active AS stage_is_active
    `;
  }

  private dealFromClause() {
    return `
      FROM partner_deal_registrations
      INNER JOIN tenant_option_values AS stage_values
        ON stage_values.id = partner_deal_registrations.stage_option_id AND stage_values.tenant_id = partner_deal_registrations.tenant_id
      LEFT JOIN opportunities AS deal_opportunities
        ON deal_opportunities.id = partner_deal_registrations.opportunity_id AND deal_opportunities.tenant_id = partner_deal_registrations.tenant_id AND deal_opportunities.deleted_at IS NULL
      LEFT JOIN tenant_option_values AS opportunity_stage_values
        ON opportunity_stage_values.id = deal_opportunities.stage_option_id AND opportunity_stage_values.tenant_id = deal_opportunities.tenant_id
      LEFT JOIN accounts AS deal_accounts
        ON deal_accounts.id = partner_deal_registrations.account_id AND deal_accounts.tenant_id = partner_deal_registrations.tenant_id AND deal_accounts.deleted_at IS NULL
    `;
  }

  private mapDeal(row: PartnerDealRow): PartnerDealRegistrationSummary {
    return {
      id: row.id,
      partnerId: row.partner_id,
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

  private async loadDeals(client: PoolClient, tenantId: string, partnerId: string): Promise<PartnerDealRegistrationSummary[]> {
    const result = await client.query<PartnerDealRow>(
      `
        SELECT ${this.dealSelectColumns()}
        ${this.dealFromClause()}
        WHERE partner_deal_registrations.tenant_id = $1
          AND partner_deal_registrations.partner_id = $2
          AND partner_deal_registrations.deleted_at IS NULL
        ORDER BY partner_deal_registrations.updated_at DESC
      `,
      [tenantId, partnerId]
    );

    return result.rows.map((row) => this.mapDeal(row));
  }

  private async syncPartnerContacts(
    client: PoolClient,
    actor: ActorContext,
    partnerId: string,
    contacts: PartnerContactInput[]
  ) {
    await client.query(
      `UPDATE partner_contacts SET deleted_at = NOW(), updated_by = $3 WHERE tenant_id = $1 AND partner_id = $2 AND deleted_at IS NULL`,
      [actor.tenantId, partnerId, actor.userId]
    );

    for (const contact of contacts) {
      const name = contact.name.trim();

      if (name.length === 0) {
        continue;
      }

      const contactId = await this.ensureReference(client, actor.tenantId, "contacts", contact.contactId ?? null, "INVALID_CONTACT", "contact");

      await client.query(
        `
          INSERT INTO partner_contacts (tenant_id, partner_id, contact_id, name, title, email, phone, is_primary, created_by, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
        `,
        [
          actor.tenantId,
          partnerId,
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

  private async syncOnboardingTasks(
    client: PoolClient,
    actor: ActorContext,
    partnerId: string,
    tasks: PartnerOnboardingTaskInput[]
  ) {
    await client.query(
      `UPDATE partner_onboarding_tasks SET deleted_at = NOW(), updated_by = $3 WHERE tenant_id = $1 AND partner_id = $2 AND deleted_at IS NULL`,
      [actor.tenantId, partnerId, actor.userId]
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
          INSERT INTO partner_onboarding_tasks (tenant_id, partner_id, label, status, sort_order, due_date, completed_at, notes, created_by, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6::date, CASE WHEN $4 = 'completed' THEN NOW() ELSE NULL END, $7, $8, $8)
        `,
        [
          actor.tenantId,
          partnerId,
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

  async getPartnerOptions(actor: ActorContext): Promise<PartnerOptionsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => ({
      owners: await this.loadOwners(client, actor.tenantId),
      accounts: await this.loadAccountsLookup(client, actor.tenantId),
      contacts: await this.loadContactsLookup(client, actor.tenantId),
      opportunities: await this.loadOpportunitiesLookup(client, actor.tenantId),
      types: await this.loadOptionSetValues(client, actor.tenantId, "partner-type"),
      tiers: await this.loadOptionSetValues(client, actor.tenantId, "partner-tier"),
      statuses: await this.loadOptionSetValues(client, actor.tenantId, "partner-status"),
      onboardingStatuses: await this.loadOptionSetValues(client, actor.tenantId, "partner-onboarding-status"),
      dealStages: await this.loadOptionSetValues(client, actor.tenantId, "partner-deal-stage"),
      availableScopes: await this.getAvailableScopes(client, actor)
    }));
  }

  private async buildScopedWhere(client: PoolClient, actor: ActorContext, scope: PartnerPipelineScope) {
    const conditions = ["partners.tenant_id = $1", "partners.deleted_at IS NULL"];
    const params: unknown[] = [actor.tenantId];

    if (scope === "mine") {
      params.push(actor.userId);
      conditions.push(`partners.owner_id = $${params.length}`);
    } else if (scope === "team") {
      const actorTeamId = await this.getActorTeamId(client, actor.tenantId, actor.userId);
      params.push(actorTeamId);
      conditions.push(`owner_users.team_id = $${params.length}`);
    }

    return { conditions, params };
  }

  async getPartnerDashboard(actor: ActorContext, query: PartnerListQuery): Promise<PartnerDashboardResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const scope = await this.resolveScope(client, actor, query.scope);
      const { conditions, params } = await this.buildScopedWhere(client, actor, scope);
      const whereClause = conditions.join(" AND ");

      const result = await client.query<PartnerRow>(
        `SELECT ${this.partnerSelectColumns()} ${this.partnerFromClause()} WHERE ${whereClause}`,
        params
      );
      const partners = result.rows.map((row) => this.mapPartnerSummary(row));

      const tierMap = new Map<string, { tier: CrmOptionValueSummary | null; partnerCount: number }>();
      for (const partner of partners) {
        const key = partner.tier?.key ?? "__none__";
        const existing = tierMap.get(key) ?? { tier: partner.tier, partnerCount: 0 };
        existing.partnerCount += 1;
        tierMap.set(key, existing);
      }

      const dealResult = await client.query<{ count: string; won_count: string; registered_value: string }>(
        `
          SELECT
            COUNT(*) AS count,
            COUNT(*) FILTER (WHERE deal_stage_values.value_key = 'won') AS won_count,
            COALESCE(SUM(partner_deal_registrations.amount), 0) AS registered_value
          FROM partner_deal_registrations
          INNER JOIN partners ON partners.id = partner_deal_registrations.partner_id AND partners.tenant_id = partner_deal_registrations.tenant_id
          LEFT JOIN users AS owner_users ON owner_users.id = partners.owner_id AND owner_users.tenant_id = partners.tenant_id
          INNER JOIN tenant_option_values AS deal_stage_values
            ON deal_stage_values.id = partner_deal_registrations.stage_option_id AND deal_stage_values.tenant_id = partner_deal_registrations.tenant_id
          WHERE partner_deal_registrations.deleted_at IS NULL AND partners.deleted_at IS NULL AND ${whereClause}
        `,
        params
      );
      const dealRow = dealResult.rows[0];

      return {
        scope,
        totalPartners: partners.length,
        activePartners: partners.filter((partner) => partner.status?.key === "active").length,
        onboardingInProgress: partners.filter((partner) => partner.onboardingStatus?.key === "in_progress").length,
        registeredDealCount: Number(dealRow?.count ?? "0"),
        registeredDealValue: Number(dealRow?.registered_value ?? "0"),
        wonDealCount: Number(dealRow?.won_count ?? "0"),
        tierDistribution: Array.from(tierMap.values()),
        performancePlaceholder: {
          available: false,
          message: "Deeper partner performance analytics will connect once channel reporting pipelines are introduced."
        }
      };
    });
  }

  async listPartners(actor: ActorContext, query: PartnerListQuery): Promise<PartnersResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const scope = await this.resolveScope(client, actor, query.scope);
      const page = Math.max(1, query.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
      const { conditions, params } = await this.buildScopedWhere(client, actor, scope);

      if (query.search) {
        params.push(`%${query.search.trim()}%`);
        conditions.push(`(partners.name ILIKE $${params.length} OR partners.region ILIKE $${params.length} OR partners.territory ILIKE $${params.length})`);
      }
      if (query.type) {
        params.push(query.type);
        conditions.push(`type_values.value_key = $${params.length}`);
      }
      if (query.tier) {
        params.push(query.tier);
        conditions.push(`tier_values.value_key = $${params.length}`);
      }
      if (query.status) {
        params.push(query.status);
        conditions.push(`status_values.value_key = $${params.length}`);
      }
      if (query.onboardingStatus) {
        params.push(query.onboardingStatus);
        conditions.push(`onboarding_values.value_key = $${params.length}`);
      }
      if (query.ownerId) {
        params.push(query.ownerId);
        conditions.push(`partners.owner_id = $${params.length}`);
      }

      const whereClause = conditions.join(" AND ");
      const sortColumnMap: Record<string, string> = {
        name: "partners.name",
        type: "type_values.sort_order",
        tier: "tier_values.sort_order",
        status: "status_values.sort_order",
        updatedAt: "partners.updated_at",
        createdAt: "partners.created_at"
      };
      const sortColumn = sortColumnMap[query.sortBy ?? "updatedAt"] ?? "partners.updated_at";
      const sortOrder = query.sortOrder === "asc" ? "ASC" : "DESC";

      const countResult = await client.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total ${this.partnerFromClause()} WHERE ${whereClause}`,
        params
      );
      const total = Number(countResult.rows[0]?.total ?? "0");

      const listParams = [...params, pageSize, (page - 1) * pageSize];
      const listResult = await client.query<PartnerRow>(
        `
          SELECT ${this.partnerSelectColumns()}
          ${this.partnerFromClause()}
          WHERE ${whereClause}
          ORDER BY ${sortColumn} ${sortOrder} NULLS LAST, partners.created_at DESC
          LIMIT $${listParams.length - 1} OFFSET $${listParams.length}
        `,
        listParams
      );

      return {
        partners: listResult.rows.map((row) => this.mapPartnerSummary(row)),
        pagination: buildPagination(page, pageSize, total)
      };
    });
  }

  private async loadPartnerDetail(client: PoolClient, actor: ActorContext, partnerId: string): Promise<PartnerDetail> {
    const result = await client.query<PartnerRow>(
      `
        SELECT ${this.partnerSelectColumns()}
        ${this.partnerFromClause()}
        WHERE partners.tenant_id = $1 AND partners.id = $2 AND partners.deleted_at IS NULL
        LIMIT 1
      `,
      [actor.tenantId, partnerId]
    );

    const row = result.rows[0];

    if (!row) {
      throw new AppError(404, "Partner not found.", undefined, "PARTNER_NOT_FOUND");
    }

    const summary = this.mapPartnerSummary(row);
    const contacts = await this.loadPartnerContacts(client, actor.tenantId, partnerId);
    const onboardingTasks = await this.loadOnboardingTasks(client, actor.tenantId, partnerId);
    const deals = await this.loadDeals(client, actor.tenantId, partnerId);
    const completedOnboarding = onboardingTasks.filter((task) => task.status === "completed").length;

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
        contactCount: contacts.length
      },
      enablementAssetsPlaceholder: {
        available: false,
        message: "Partner enablement assets will connect once the content and collateral library is introduced."
      },
      trainingPlaceholder: {
        available: false,
        message: "Partner training linkage will connect once the training and certification module is introduced."
      },
      supportTicketsPlaceholder: {
        available: false,
        message: "Partner support tickets will connect once the support module is operational."
      },
      aiPlaceholders: this.buildAiPlaceholders(actor)
    };
  }

  async getPartner(actor: ActorContext, partnerId: string): Promise<PartnerResponse> {
    this.assertEnabled();

    const partner = await this.databaseService.withClient(async (client) =>
      this.loadPartnerDetail(client, actor, partnerId)
    );

    return { partner };
  }

  async createPartner(actor: ActorContext, audit: AuditMetadata, input: CreatePartnerRequestBody): Promise<PartnerResponse> {
    this.assertEnabled();

    const partnerId = await this.databaseService.withTransaction(async (client) => {
      const accountId = await this.ensureReference(client, actor.tenantId, "accounts", input.accountId ?? null, "INVALID_ACCOUNT", "account");
      const ownerId = await this.ensureReference(client, actor.tenantId, "users", input.ownerId ?? null, "INVALID_OWNER", "owner");
      const typeOptionId = await this.resolveOptionValueId(client, actor.tenantId, "partner-type", input.typeKey, "Partner type");
      const tierOptionId = await this.resolveOptionValueId(client, actor.tenantId, "partner-tier", input.tierKey, "Partner tier");
      const statusOptionId = await this.resolveOptionValueId(client, actor.tenantId, "partner-status", input.statusKey ?? "prospect", "Partner status");
      const onboardingStatusOptionId = await this.resolveOptionValueId(
        client,
        actor.tenantId,
        "partner-onboarding-status",
        input.onboardingStatusKey ?? "not_started",
        "Partner onboarding status"
      );

      const result = await client.query<{ id: string }>(
        `
          INSERT INTO partners (
            tenant_id, account_id, owner_id, name, type_option_id, tier_option_id, status_option_id,
            onboarding_status_option_id, region, territory, agreement_reference, agreement_start_date,
            agreement_end_date, agreement_notes, metadata, created_by, updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::date, $13::date, $14, $15::jsonb, $16, $16)
          RETURNING id
        `,
        [
          actor.tenantId,
          accountId,
          ownerId,
          input.name.trim(),
          typeOptionId,
          tierOptionId,
          statusOptionId,
          onboardingStatusOptionId,
          getTrimmedNullableString(input.region),
          getTrimmedNullableString(input.territory),
          getTrimmedNullableString(input.agreementReference),
          input.agreementStartDate ?? null,
          input.agreementEndDate ?? null,
          getTrimmedNullableString(input.agreementNotes),
          JSON.stringify(input.metadata ?? {}),
          actor.userId
        ]
      );

      const nextPartnerId = result.rows[0]?.id;

      if (!nextPartnerId) {
        throw new AppError(500, "Partner creation failed.", undefined, "PARTNER_CREATE_FAILED");
      }

      if (input.contacts && input.contacts.length > 0) {
        await this.syncPartnerContacts(client, actor, nextPartnerId, input.contacts);
      }
      if (input.onboardingTasks && input.onboardingTasks.length > 0) {
        await this.syncOnboardingTasks(client, actor, nextPartnerId, input.onboardingTasks);
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "partner.create",
        resourceType: "partner",
        resourceId: nextPartnerId,
        status: "success",
        metadata: { typeKey: input.typeKey, tierKey: input.tierKey, ownerId, accountId }
      });

      return nextPartnerId;
    });

    return this.getPartner(actor, partnerId);
  }

  async updatePartner(
    actor: ActorContext,
    audit: AuditMetadata,
    partnerId: string,
    input: UpdatePartnerRequestBody
  ): Promise<PartnerResponse> {
    this.assertEnabled();

    await this.databaseService.withTransaction(async (client) => {
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdatePartnerRequestBody] !== undefined);
      this.assertPartnerMutation(actor, keys);
      await this.getPartnerState(client, actor.tenantId, partnerId);

      const assignments: string[] = [];
      const params: unknown[] = [partnerId, actor.tenantId, actor.userId];

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
      if (keys.includes("typeKey") && input.typeKey) {
        pushAssignment("type_option_id", await this.resolveOptionValueId(client, actor.tenantId, "partner-type", input.typeKey, "Partner type"));
      }
      if (keys.includes("tierKey") && input.tierKey) {
        pushAssignment("tier_option_id", await this.resolveOptionValueId(client, actor.tenantId, "partner-tier", input.tierKey, "Partner tier"));
      }
      if (keys.includes("statusKey") && input.statusKey) {
        pushAssignment("status_option_id", await this.resolveOptionValueId(client, actor.tenantId, "partner-status", input.statusKey, "Partner status"));
      }
      if (keys.includes("onboardingStatusKey") && input.onboardingStatusKey) {
        pushAssignment(
          "onboarding_status_option_id",
          await this.resolveOptionValueId(client, actor.tenantId, "partner-onboarding-status", input.onboardingStatusKey, "Partner onboarding status")
        );
      }
      if (keys.includes("region")) {
        pushAssignment("region", getTrimmedNullableString(input.region));
      }
      if (keys.includes("territory")) {
        pushAssignment("territory", getTrimmedNullableString(input.territory));
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
          `UPDATE partners SET ${assignments.join(", ")}, updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          params
        );
      } else {
        await client.query(
          `UPDATE partners SET updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          params
        );
      }

      if (keys.includes("contacts") && input.contacts) {
        await this.syncPartnerContacts(client, actor, partnerId, input.contacts);
      }
      if (keys.includes("onboardingTasks") && input.onboardingTasks) {
        await this.syncOnboardingTasks(client, actor, partnerId, input.onboardingTasks);
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "partner.update",
        resourceType: "partner",
        resourceId: partnerId,
        status: "success",
        metadata: { updatedFields: keys }
      });
    });

    return this.getPartner(actor, partnerId);
  }

  async deletePartner(actor: ActorContext, audit: AuditMetadata, partnerId: string): Promise<CrmMutationSuccessResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      await this.getPartnerState(client, actor.tenantId, partnerId);

      for (const table of ["partner_contacts", "partner_onboarding_tasks", "partner_deal_registrations"]) {
        await client.query(
          `UPDATE ${table} SET deleted_at = NOW(), updated_by = $3 WHERE tenant_id = $1 AND partner_id = $2 AND deleted_at IS NULL`,
          [actor.tenantId, partnerId, actor.userId]
        );
      }
      await client.query(
        `UPDATE partners SET deleted_at = NOW(), updated_by = $3 WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [actor.tenantId, partnerId, actor.userId]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "partner.delete",
        resourceType: "partner",
        resourceId: partnerId,
        status: "success"
      });

      return { success: true };
    });
  }

  async listPartnerDeals(actor: ActorContext, partnerId: string): Promise<PartnerDealRegistrationsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      await this.getPartnerState(client, actor.tenantId, partnerId);
      return { deals: await this.loadDeals(client, actor.tenantId, partnerId) };
    });
  }

  private async loadDeal(client: PoolClient, tenantId: string, partnerId: string, dealId: string) {
    const result = await client.query<PartnerDealRow>(
      `
        SELECT ${this.dealSelectColumns()}
        ${this.dealFromClause()}
        WHERE partner_deal_registrations.tenant_id = $1
          AND partner_deal_registrations.partner_id = $2
          AND partner_deal_registrations.id = $3
          AND partner_deal_registrations.deleted_at IS NULL
        LIMIT 1
      `,
      [tenantId, partnerId, dealId]
    );

    const row = result.rows[0];

    if (!row) {
      throw new AppError(404, "Partner deal registration not found.", undefined, "PARTNER_DEAL_NOT_FOUND");
    }

    return this.mapDeal(row);
  }

  async createPartnerDeal(
    actor: ActorContext,
    audit: AuditMetadata,
    partnerId: string,
    input: CreatePartnerDealRegistrationRequestBody
  ): Promise<PartnerDealRegistrationResponse> {
    this.assertEnabled();

    const dealId = await this.databaseService.withTransaction(async (client) => {
      await this.getPartnerState(client, actor.tenantId, partnerId);
      const opportunityId = await this.ensureReference(client, actor.tenantId, "opportunities", input.opportunityId ?? null, "INVALID_OPPORTUNITY", "opportunity");
      const accountId = await this.ensureReference(client, actor.tenantId, "accounts", input.accountId ?? null, "INVALID_ACCOUNT", "account");
      const leadId = await this.ensureReference(client, actor.tenantId, "leads", input.leadId ?? null, "INVALID_LEAD", "lead");
      const stageOptionId = await this.resolveOptionValueId(client, actor.tenantId, "partner-deal-stage", input.stageKey ?? "registered", "Partner deal stage");

      const result = await client.query<{ id: string }>(
        `
          INSERT INTO partner_deal_registrations (
            tenant_id, partner_id, opportunity_id, account_id, lead_id, name, customer_name,
            stage_option_id, amount, expected_close_date, notes, metadata, created_by, updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date, $11, $12::jsonb, $13, $13)
          RETURNING id
        `,
        [
          actor.tenantId,
          partnerId,
          opportunityId,
          accountId,
          leadId,
          input.name.trim(),
          getTrimmedNullableString(input.customerName),
          stageOptionId,
          input.amount ?? null,
          input.expectedCloseDate ?? null,
          getTrimmedNullableString(input.notes),
          JSON.stringify(input.metadata ?? {}),
          actor.userId
        ]
      );

      const nextDealId = result.rows[0]?.id;

      if (!nextDealId) {
        throw new AppError(500, "Partner deal registration failed.", undefined, "PARTNER_DEAL_CREATE_FAILED");
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "partner.deal.register",
        resourceType: "partner_deal_registration",
        resourceId: nextDealId,
        status: "success",
        metadata: { partnerId, opportunityId, stageKey: input.stageKey ?? "registered" }
      });

      return nextDealId;
    });

    const deal = await this.databaseService.withClient(async (client) => this.loadDeal(client, actor.tenantId, partnerId, dealId));
    return { deal };
  }

  async updatePartnerDeal(
    actor: ActorContext,
    audit: AuditMetadata,
    partnerId: string,
    dealId: string,
    input: UpdatePartnerDealRegistrationRequestBody
  ): Promise<PartnerDealRegistrationResponse> {
    this.assertEnabled();

    await this.databaseService.withTransaction(async (client) => {
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdatePartnerDealRegistrationRequestBody] !== undefined);

      if (keys.length === 0) {
        throw new AppError(400, "At least one field must be updated.", undefined, "VALIDATION_ERROR");
      }

      const canEdit =
        actor.permissionCodes.includes("partners.edit") ||
        actor.permissionCodes.includes("partners.approve") ||
        actor.permissionCodes.includes("partners.configure") ||
        actor.permissionCodes.includes("partners.manage_workflow");

      if (!canEdit) {
        throw new AppError(403, "You do not have permission to update partner deals.", undefined, "AUTHORIZATION_ERROR");
      }

      await this.getPartnerState(client, actor.tenantId, partnerId);
      await this.loadDeal(client, actor.tenantId, partnerId, dealId);

      const assignments: string[] = [];
      const params: unknown[] = [dealId, actor.tenantId, partnerId, actor.userId];

      const pushAssignment = (column: string, value: unknown, cast = "") => {
        params.push(value);
        assignments.push(`${column} = $${params.length}${cast}`);
      };

      if (keys.includes("name") && input.name !== undefined) {
        pushAssignment("name", input.name.trim());
      }
      if (keys.includes("stageKey") && input.stageKey) {
        pushAssignment("stage_option_id", await this.resolveOptionValueId(client, actor.tenantId, "partner-deal-stage", input.stageKey, "Partner deal stage"));
      }
      if (keys.includes("customerName")) {
        pushAssignment("customer_name", getTrimmedNullableString(input.customerName));
      }
      if (keys.includes("amount")) {
        pushAssignment("amount", input.amount ?? null);
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
          `UPDATE partner_deal_registrations SET ${assignments.join(", ")}, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND partner_id = $3 AND deleted_at IS NULL`,
          params
        );
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "partner.deal.update",
        resourceType: "partner_deal_registration",
        resourceId: dealId,
        status: "success",
        metadata: { partnerId, updatedFields: keys }
      });
    });

    const deal = await this.databaseService.withClient(async (client) => this.loadDeal(client, actor.tenantId, partnerId, dealId));
    return { deal };
  }
}

interface PartnerRow {
  id: string;
  name: string;
  region: string | null;
  territory: string | null;
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
  type_id: string | null;
  type_key: string | null;
  type_label: string | null;
  type_description: string | null;
  type_color: string | null;
  type_is_default: boolean | null;
  type_is_active: boolean | null;
  tier_id: string | null;
  tier_key: string | null;
  tier_label: string | null;
  tier_description: string | null;
  tier_color: string | null;
  tier_is_default: boolean | null;
  tier_is_active: boolean | null;
  status_id: string | null;
  status_key: string | null;
  status_label: string | null;
  status_description: string | null;
  status_color: string | null;
  status_is_default: boolean | null;
  status_is_active: boolean | null;
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
  onboarding_task_count: number;
  completed_onboarding_task_count: number;
}

interface PartnerDealRow {
  id: string;
  partner_id: string;
  name: string;
  customer_name: string | null;
  amount: string | number | null;
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
