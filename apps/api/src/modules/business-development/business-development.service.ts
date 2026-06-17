import type {
  AccountLookupSummary,
  BdAccountStakeholderInput,
  BdAccountStakeholderSummary,
  BdAiPlaceholderSummary,
  BdInfluenceLevel,
  BdPipelineScope,
  BdRelationshipStrength,
  BdTargetAccountDetail,
  BdTargetAccountListQuery,
  BdTargetAccountOptionsResponse,
  BdTargetAccountResponse,
  BdTargetAccountSummary,
  BdTargetAccountsResponse,
  ContactRelationshipSummary,
  CreateBdTargetAccountRequestBody,
  CreatePresalesRequestRequestBody,
  CrmLookupUserSummary,
  CrmMutationSuccessResponse,
  CrmOptionValueSummary,
  CrmPagination,
  OpportunityLookupSummary,
  PresalesAiPlaceholderSummary,
  PresalesComplianceStatus,
  PresalesPipelineScope,
  PresalesPriority,
  PresalesRequestDetail,
  PresalesRequestListQuery,
  PresalesRequestOptionsResponse,
  PresalesRequestResponse,
  PresalesRequestSummary,
  PresalesRequestsResponse,
  PresalesRequirementCategory,
  PresalesRequirementInput,
  PresalesRequirementSummary,
  RoleSummary,
  UpdateBdTargetAccountRequestBody,
  UpdatePresalesRequestRequestBody
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

const PRESALES_PRIORITIES: PresalesPriority[] = ["low", "medium", "high", "urgent"];
const BD_INFLUENCE_LEVELS: BdInfluenceLevel[] = ["low", "medium", "high", "champion", "blocker"];
const BD_RELATIONSHIP_STRENGTHS: BdRelationshipStrength[] = ["none", "developing", "engaged", "strong"];
const PRESALES_REQUIREMENT_CATEGORIES: PresalesRequirementCategory[] = [
  "functional",
  "technical",
  "security",
  "commercial",
  "integration",
  "other"
];
const PRESALES_COMPLIANCE_STATUSES: PresalesComplianceStatus[] = [
  "pending",
  "met",
  "partial",
  "gap",
  "not_applicable"
];

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

function normalizeInfluenceLevel(value: unknown): BdInfluenceLevel {
  return BD_INFLUENCE_LEVELS.includes(value as BdInfluenceLevel) ? (value as BdInfluenceLevel) : "medium";
}

function normalizeRelationshipStrength(value: unknown): BdRelationshipStrength {
  return BD_RELATIONSHIP_STRENGTHS.includes(value as BdRelationshipStrength)
    ? (value as BdRelationshipStrength)
    : "developing";
}

function normalizePriority(value: unknown): PresalesPriority {
  return PRESALES_PRIORITIES.includes(value as PresalesPriority) ? (value as PresalesPriority) : "medium";
}

function normalizeRequirementCategory(value: unknown): PresalesRequirementCategory {
  return PRESALES_REQUIREMENT_CATEGORIES.includes(value as PresalesRequirementCategory)
    ? (value as PresalesRequirementCategory)
    : "functional";
}

function normalizeComplianceStatus(value: unknown): PresalesComplianceStatus {
  return PRESALES_COMPLIANCE_STATUSES.includes(value as PresalesComplianceStatus)
    ? (value as PresalesComplianceStatus)
    : "pending";
}

function buildPagination(page: number, pageSize: number, total: number): CrmPagination {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
}

export class BusinessDevelopmentService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {}

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(
        503,
        "Business development and presales are unavailable until the database connection is enabled.",
        undefined,
        "BUSINESS_DEVELOPMENT_UNAVAILABLE"
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
          tenant_id,
          actor_user_id,
          session_id,
          event_type,
          action,
          resource_type,
          resource_id,
          status,
          ip_address,
          user_agent,
          request_id,
          metadata
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
        SELECT
          users.id,
          users.display_name,
          users.email,
          teams.name AS team_name,
          departments.name AS department_name
        FROM users
        LEFT JOIN teams
          ON teams.id = users.team_id
         AND teams.tenant_id = users.tenant_id
         AND teams.deleted_at IS NULL
        LEFT JOIN departments
          ON departments.id = users.department_id
         AND departments.tenant_id = users.tenant_id
         AND departments.deleted_at IS NULL
        WHERE users.tenant_id = $1
          AND users.deleted_at IS NULL
          AND users.status IN ('active', 'invited')
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
      `
        SELECT id, name, website
        FROM accounts
        WHERE tenant_id = $1
          AND deleted_at IS NULL
        ORDER BY name ASC
      `,
      [tenantId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      website: row.website
    }));
  }

  private async loadContactsLookup(client: PoolClient, tenantId: string): Promise<ContactRelationshipSummary[]> {
    const result = await client.query<ContactLookupRow>(
      `
        SELECT
          contacts.id,
          contacts.first_name,
          contacts.last_name,
          contacts.email,
          role_values.id AS role_id,
          role_values.value_key AS role_key,
          role_values.label AS role_label,
          role_values.description AS role_description,
          role_values.color AS role_color,
          role_values.is_default AS role_is_default,
          role_values.is_active AS role_is_active
        FROM contacts
        LEFT JOIN tenant_option_values AS role_values
          ON role_values.id = contacts.role_option_id
         AND role_values.tenant_id = contacts.tenant_id
        WHERE contacts.tenant_id = $1
          AND contacts.deleted_at IS NULL
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
          opportunities.id,
          opportunities.name,
          stage_values.id AS stage_id,
          stage_values.value_key AS stage_key,
          stage_values.label AS stage_label,
          stage_values.description AS stage_description,
          stage_values.color AS stage_color,
          stage_values.is_default AS stage_is_default,
          stage_values.is_active AS stage_is_active
        FROM opportunities
        LEFT JOIN tenant_option_values AS stage_values
          ON stage_values.id = opportunities.stage_option_id
         AND stage_values.tenant_id = opportunities.tenant_id
        WHERE opportunities.tenant_id = $1
          AND opportunities.deleted_at IS NULL
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
      `
        SELECT team_id
        FROM users
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [userId, tenantId]
    );

    return result.rows[0]?.team_id ?? null;
  }

  private async ensureOwnerId(client: PoolClient, tenantId: string, ownerId: string | null | undefined) {
    if (!ownerId) {
      return null;
    }

    const result = await client.query<{ id: string }>(
      `
        SELECT id
        FROM users
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
          AND status IN ('active', 'invited')
        LIMIT 1
      `,
      [ownerId, tenantId]
    );

    const resolvedOwnerId = result.rows[0]?.id ?? null;

    if (!resolvedOwnerId) {
      throw new AppError(400, "The selected user is invalid for this tenant.", undefined, "INVALID_OWNER");
    }

    return resolvedOwnerId;
  }

  private async ensureAccountId(client: PoolClient, tenantId: string, accountId: string | null | undefined) {
    if (!accountId) {
      return null;
    }

    const result = await client.query<{ id: string }>(
      `
        SELECT id
        FROM accounts
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [accountId, tenantId]
    );

    const resolvedAccountId = result.rows[0]?.id ?? null;

    if (!resolvedAccountId) {
      throw new AppError(400, "The selected account is invalid for this tenant.", undefined, "INVALID_ACCOUNT");
    }

    return resolvedAccountId;
  }

  private async ensureContactId(client: PoolClient, tenantId: string, contactId: string | null | undefined) {
    if (!contactId) {
      return null;
    }

    const result = await client.query<{ id: string }>(
      `
        SELECT id
        FROM contacts
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [contactId, tenantId]
    );

    const resolvedContactId = result.rows[0]?.id ?? null;

    if (!resolvedContactId) {
      throw new AppError(400, "The selected contact is invalid for this tenant.", undefined, "INVALID_CONTACT");
    }

    return resolvedContactId;
  }

  private async ensureOpportunityId(client: PoolClient, tenantId: string, opportunityId: string | null | undefined) {
    if (!opportunityId) {
      return null;
    }

    const result = await client.query<{ id: string }>(
      `
        SELECT id
        FROM opportunities
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [opportunityId, tenantId]
    );

    const resolvedOpportunityId = result.rows[0]?.id ?? null;

    if (!resolvedOpportunityId) {
      throw new AppError(400, "The selected opportunity is invalid for this tenant.", undefined, "INVALID_OPPORTUNITY");
    }

    return resolvedOpportunityId;
  }

  private getSharedScopePermissions(actor: ActorContext, moduleKey: "business_development" | "presales") {
    return (
      actor.permissionCodes.includes(`${moduleKey}.assign`) ||
      actor.permissionCodes.includes(`${moduleKey}.configure`) ||
      actor.permissionCodes.includes(`${moduleKey}.view_dashboard`) ||
      actor.permissionCodes.includes(`${moduleKey}.manage_workflow`) ||
      actor.permissionCodes.includes("sales.view_dashboard") ||
      actor.permissionCodes.includes("dashboards.view_dashboard")
    );
  }

  private async getAvailableScopes(
    client: PoolClient,
    actor: ActorContext,
    moduleKey: "business_development" | "presales"
  ): Promise<BdPipelineScope[]> {
    if (!this.getSharedScopePermissions(actor, moduleKey)) {
      return ["mine"];
    }

    const actorTeamId = await this.getActorTeamId(client, actor.tenantId, actor.userId);
    return actorTeamId ? ["mine", "team", "all"] : ["mine", "all"];
  }

  private async resolveScope(
    client: PoolClient,
    actor: ActorContext,
    moduleKey: "business_development" | "presales",
    requestedScope: BdPipelineScope | undefined
  ): Promise<BdPipelineScope> {
    const availableScopes = await this.getAvailableScopes(client, actor, moduleKey);
    const effectiveScope = requestedScope ?? (availableScopes.includes("all") ? "all" : "mine");

    if (!availableScopes.includes(effectiveScope)) {
      throw new AppError(
        403,
        "You do not have permission to inspect this scope.",
        undefined,
        "AUTHORIZATION_ERROR"
      );
    }

    return effectiveScope;
  }

  // ==========================================================================
  // Business Development: target accounts
  // ==========================================================================

  private buildBdAiPlaceholders(actor: ActorContext): BdAiPlaceholderSummary {
    const permissionCodes = new Set(actor.permissionCodes);
    const canUseAi =
      permissionCodes.has("business_development.use_ai") ||
      permissionCodes.has("business_development.manage_ai") ||
      permissionCodes.has("ai.use_ai") ||
      permissionCodes.has("ai.manage_ai");
    const canManageAi =
      permissionCodes.has("business_development.manage_ai") || permissionCodes.has("ai.manage_ai");

    return {
      actions: canUseAi
        ? [
            {
              key: "account_research_brief",
              label: "Account research brief",
              description: "Placeholder entry point for future account intelligence and firmographic summaries."
            },
            {
              key: "stakeholder_map",
              label: "Stakeholder map",
              description: "Placeholder entry point for future relationship and influence mapping suggestions."
            }
          ]
        : [],
      governanceHint: canManageAi
        ? "AI placeholders are visible and will later connect to the governed AI Gateway with BD-specific controls."
        : canUseAi
          ? "AI placeholders are visible for this role, but execution remains deferred until the AI Gateway phase."
          : "AI placeholders remain hidden until the role includes business development or global AI usage permissions."
    };
  }

  private async getBdOwnerId(client: PoolClient, tenantId: string, targetAccountId: string) {
    const result = await client.query<{ id: string; owner_id: string | null }>(
      `
        SELECT id, owner_id
        FROM bd_target_accounts
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [targetAccountId, tenantId]
    );

    const row = result.rows[0];

    if (!row) {
      throw new AppError(404, "Target account not found.", undefined, "TARGET_ACCOUNT_NOT_FOUND");
    }

    return row.owner_id;
  }

  private assertBdMutation(actor: ActorContext, keys: string[]) {
    if (keys.length === 0) {
      throw new AppError(400, "At least one field must be updated.", undefined, "VALIDATION_ERROR");
    }

    const canEdit =
      actor.permissionCodes.includes("business_development.edit") ||
      actor.permissionCodes.includes("business_development.configure");
    const canAssign =
      actor.permissionCodes.includes("business_development.assign") ||
      actor.permissionCodes.includes("business_development.configure");
    const ownerOnlyMutation = keys.every((key) => key === "ownerId");

    if (!canEdit && !(canAssign && ownerOnlyMutation)) {
      throw new AppError(
        403,
        "You do not have permission to update this target account.",
        undefined,
        "AUTHORIZATION_ERROR"
      );
    }

    if (!canAssign && keys.includes("ownerId")) {
      throw new AppError(
        403,
        "You do not have permission to reassign target account ownership.",
        undefined,
        "AUTHORIZATION_ERROR"
      );
    }
  }

  private async loadBdStakeholders(
    client: PoolClient,
    tenantId: string,
    targetAccountIds: string[]
  ): Promise<Map<string, BdAccountStakeholderSummary[]>> {
    const map = new Map<string, BdAccountStakeholderSummary[]>();

    if (targetAccountIds.length === 0) {
      return map;
    }

    const result = await client.query<{
      id: string;
      target_account_id: string;
      name: string;
      title: string | null;
      influence_level: string;
      relationship_strength: string;
      is_executive: boolean;
      last_engagement_at: Date | null;
      engagement_notes: string | null;
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
          bd_account_stakeholders.id,
          bd_account_stakeholders.target_account_id,
          bd_account_stakeholders.name,
          bd_account_stakeholders.title,
          bd_account_stakeholders.influence_level,
          bd_account_stakeholders.relationship_strength,
          bd_account_stakeholders.is_executive,
          bd_account_stakeholders.last_engagement_at,
          bd_account_stakeholders.engagement_notes,
          bd_account_stakeholders.created_at,
          bd_account_stakeholders.updated_at,
          contacts.id AS contact_id,
          contacts.first_name AS contact_first_name,
          contacts.last_name AS contact_last_name,
          contacts.email AS contact_email,
          role_values.id AS contact_role_id,
          role_values.value_key AS contact_role_key,
          role_values.label AS contact_role_label,
          role_values.description AS contact_role_description,
          role_values.color AS contact_role_color,
          role_values.is_default AS contact_role_is_default,
          role_values.is_active AS contact_role_is_active
        FROM bd_account_stakeholders
        LEFT JOIN contacts
          ON contacts.id = bd_account_stakeholders.contact_id
         AND contacts.tenant_id = bd_account_stakeholders.tenant_id
         AND contacts.deleted_at IS NULL
        LEFT JOIN tenant_option_values AS role_values
          ON role_values.id = contacts.role_option_id
         AND role_values.tenant_id = contacts.tenant_id
        WHERE bd_account_stakeholders.tenant_id = $1
          AND bd_account_stakeholders.target_account_id = ANY($2::uuid[])
          AND bd_account_stakeholders.deleted_at IS NULL
        ORDER BY bd_account_stakeholders.is_executive DESC, bd_account_stakeholders.created_at ASC
      `,
      [tenantId, targetAccountIds]
    );

    for (const row of result.rows) {
      const summary: BdAccountStakeholderSummary = {
        id: row.id,
        name: row.name,
        title: row.title,
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
        influenceLevel: normalizeInfluenceLevel(row.influence_level),
        relationshipStrength: normalizeRelationshipStrength(row.relationship_strength),
        isExecutive: row.is_executive,
        lastEngagementAt: toIsoString(row.last_engagement_at),
        engagementNotes: row.engagement_notes,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString()
      };

      const existing = map.get(row.target_account_id) ?? [];
      existing.push(summary);
      map.set(row.target_account_id, existing);
    }

    return map;
  }

  private mapBdSummary(row: BdTargetAccountRow): BdTargetAccountSummary {
    return {
      id: row.id,
      name: row.name,
      account: row.account_id
        ? { id: row.account_id, name: row.account_name ?? "", website: row.account_website }
        : null,
      owner: mapUser({
        id: row.owner_id,
        displayName: row.owner_display_name,
        email: row.owner_email,
        teamName: row.owner_team_name,
        departmentName: row.owner_department_name
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
      stage: mapOptionValue({
        id: row.stage_id,
        key: row.stage_key,
        label: row.stage_label,
        description: row.stage_description,
        color: row.stage_color,
        isDefault: row.stage_is_default,
        isActive: row.stage_is_active
      }),
      partnershipType: mapOptionValue({
        id: row.partnership_type_id,
        key: row.partnership_type_key,
        label: row.partnership_type_label,
        description: row.partnership_type_description,
        color: row.partnership_type_color,
        isDefault: row.partnership_type_is_default,
        isActive: row.partnership_type_is_active
      }),
      industry: row.industry,
      region: row.region,
      annualRevenue: parseNumeric(row.annual_revenue),
      employeeCount: row.employee_count,
      marketOpportunityNotes: row.market_opportunity_notes,
      executiveSponsor: row.executive_sponsor,
      nextStep: row.next_step,
      isPartnership: row.is_partnership,
      stakeholderCount: row.stakeholder_count,
      executiveStakeholderCount: row.executive_stakeholder_count,
      metadata: getMetadata(row.metadata),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private bdSelectColumns() {
    return `
      bd_target_accounts.id,
      bd_target_accounts.name,
      bd_target_accounts.industry,
      bd_target_accounts.region,
      bd_target_accounts.annual_revenue,
      bd_target_accounts.employee_count,
      bd_target_accounts.market_opportunity_notes,
      bd_target_accounts.executive_sponsor,
      bd_target_accounts.next_step,
      bd_target_accounts.is_partnership,
      bd_target_accounts.metadata,
      bd_target_accounts.created_at,
      bd_target_accounts.updated_at,
      bd_target_accounts.account_id,
      target_accounts.name AS account_name,
      target_accounts.website AS account_website,
      owner_users.id AS owner_id,
      owner_users.display_name AS owner_display_name,
      owner_users.email AS owner_email,
      owner_teams.name AS owner_team_name,
      owner_departments.name AS owner_department_name,
      tier_values.id AS tier_id,
      tier_values.value_key AS tier_key,
      tier_values.label AS tier_label,
      tier_values.description AS tier_description,
      tier_values.color AS tier_color,
      tier_values.is_default AS tier_is_default,
      tier_values.is_active AS tier_is_active,
      stage_values.id AS stage_id,
      stage_values.value_key AS stage_key,
      stage_values.label AS stage_label,
      stage_values.description AS stage_description,
      stage_values.color AS stage_color,
      stage_values.is_default AS stage_is_default,
      stage_values.is_active AS stage_is_active,
      partnership_values.id AS partnership_type_id,
      partnership_values.value_key AS partnership_type_key,
      partnership_values.label AS partnership_type_label,
      partnership_values.description AS partnership_type_description,
      partnership_values.color AS partnership_type_color,
      partnership_values.is_default AS partnership_type_is_default,
      partnership_values.is_active AS partnership_type_is_active,
      COALESCE(stakeholder_counts.count, 0)::int AS stakeholder_count,
      COALESCE(stakeholder_counts.executive_count, 0)::int AS executive_stakeholder_count
    `;
  }

  private bdFromClause() {
    return `
      FROM bd_target_accounts
      INNER JOIN tenant_option_values AS tier_values
        ON tier_values.id = bd_target_accounts.tier_option_id
       AND tier_values.tenant_id = bd_target_accounts.tenant_id
      INNER JOIN tenant_option_values AS stage_values
        ON stage_values.id = bd_target_accounts.stage_option_id
       AND stage_values.tenant_id = bd_target_accounts.tenant_id
      LEFT JOIN tenant_option_values AS partnership_values
        ON partnership_values.id = bd_target_accounts.partnership_type_option_id
       AND partnership_values.tenant_id = bd_target_accounts.tenant_id
      LEFT JOIN accounts AS target_accounts
        ON target_accounts.id = bd_target_accounts.account_id
       AND target_accounts.tenant_id = bd_target_accounts.tenant_id
       AND target_accounts.deleted_at IS NULL
      LEFT JOIN users AS owner_users
        ON owner_users.id = bd_target_accounts.owner_id
       AND owner_users.tenant_id = bd_target_accounts.tenant_id
       AND owner_users.deleted_at IS NULL
      LEFT JOIN teams AS owner_teams
        ON owner_teams.id = owner_users.team_id
       AND owner_teams.tenant_id = owner_users.tenant_id
       AND owner_teams.deleted_at IS NULL
      LEFT JOIN departments AS owner_departments
        ON owner_departments.id = owner_users.department_id
       AND owner_departments.tenant_id = owner_users.tenant_id
       AND owner_departments.deleted_at IS NULL
      LEFT JOIN (
        SELECT tenant_id, target_account_id,
          COUNT(*) AS count,
          COUNT(*) FILTER (WHERE is_executive) AS executive_count
        FROM bd_account_stakeholders
        WHERE deleted_at IS NULL
        GROUP BY tenant_id, target_account_id
      ) AS stakeholder_counts
        ON stakeholder_counts.tenant_id = bd_target_accounts.tenant_id
       AND stakeholder_counts.target_account_id = bd_target_accounts.id
    `;
  }

  private async syncBdStakeholders(
    client: PoolClient,
    actor: ActorContext,
    targetAccountId: string,
    stakeholders: BdAccountStakeholderInput[]
  ) {
    await client.query(
      `
        UPDATE bd_account_stakeholders
        SET deleted_at = NOW(), updated_by = $3
        WHERE tenant_id = $1
          AND target_account_id = $2
          AND deleted_at IS NULL
      `,
      [actor.tenantId, targetAccountId, actor.userId]
    );

    for (const stakeholder of stakeholders) {
      const name = stakeholder.name.trim();

      if (name.length === 0) {
        continue;
      }

      const contactId = await this.ensureContactId(client, actor.tenantId, stakeholder.contactId ?? null);

      await client.query(
        `
          INSERT INTO bd_account_stakeholders (
            tenant_id,
            target_account_id,
            contact_id,
            name,
            title,
            influence_level,
            relationship_strength,
            is_executive,
            last_engagement_at,
            engagement_notes,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10, $11, $11)
        `,
        [
          actor.tenantId,
          targetAccountId,
          contactId,
          name,
          getTrimmedNullableString(stakeholder.title),
          normalizeInfluenceLevel(stakeholder.influenceLevel),
          normalizeRelationshipStrength(stakeholder.relationshipStrength),
          Boolean(stakeholder.isExecutive),
          stakeholder.lastEngagementAt ?? null,
          getTrimmedNullableString(stakeholder.engagementNotes),
          actor.userId
        ]
      );
    }
  }

  async getBdOptions(actor: ActorContext): Promise<BdTargetAccountOptionsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => ({
      owners: await this.loadOwners(client, actor.tenantId),
      accounts: await this.loadAccountsLookup(client, actor.tenantId),
      contacts: await this.loadContactsLookup(client, actor.tenantId),
      tiers: await this.loadOptionSetValues(client, actor.tenantId, "bd-account-tier"),
      stages: await this.loadOptionSetValues(client, actor.tenantId, "bd-pipeline-stage"),
      partnershipTypes: await this.loadOptionSetValues(client, actor.tenantId, "bd-partnership-type"),
      availableScopes: await this.getAvailableScopes(client, actor, "business_development")
    }));
  }

  async listBdTargetAccounts(
    actor: ActorContext,
    query: BdTargetAccountListQuery
  ): Promise<BdTargetAccountsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const scope = await this.resolveScope(client, actor, "business_development", query.scope);
      const page = Math.max(1, query.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
      const conditions = ["bd_target_accounts.tenant_id = $1", "bd_target_accounts.deleted_at IS NULL"];
      const params: unknown[] = [actor.tenantId];

      if (scope === "mine") {
        params.push(actor.userId);
        conditions.push(`bd_target_accounts.owner_id = $${params.length}`);
      } else if (scope === "team") {
        const actorTeamId = await this.getActorTeamId(client, actor.tenantId, actor.userId);
        params.push(actorTeamId);
        conditions.push(`owner_users.team_id = $${params.length}`);
      }

      if (query.search) {
        params.push(`%${query.search.trim()}%`);
        conditions.push(
          `(bd_target_accounts.name ILIKE $${params.length} OR bd_target_accounts.industry ILIKE $${params.length} OR bd_target_accounts.region ILIKE $${params.length})`
        );
      }

      if (query.tier) {
        params.push(query.tier);
        conditions.push(`tier_values.value_key = $${params.length}`);
      }

      if (query.stage) {
        params.push(query.stage);
        conditions.push(`stage_values.value_key = $${params.length}`);
      }

      if (query.partnershipType) {
        params.push(query.partnershipType);
        conditions.push(`partnership_values.value_key = $${params.length}`);
      }

      if (query.ownerId) {
        params.push(query.ownerId);
        conditions.push(`bd_target_accounts.owner_id = $${params.length}`);
      }

      if (query.isPartnership !== undefined) {
        params.push(query.isPartnership);
        conditions.push(`bd_target_accounts.is_partnership = $${params.length}`);
      }

      const whereClause = conditions.join(" AND ");
      const sortColumnMap: Record<string, string> = {
        name: "bd_target_accounts.name",
        tier: "tier_values.sort_order",
        stage: "stage_values.sort_order",
        owner: "owner_users.display_name",
        annualRevenue: "bd_target_accounts.annual_revenue",
        updatedAt: "bd_target_accounts.updated_at",
        createdAt: "bd_target_accounts.created_at"
      };
      const sortColumn = sortColumnMap[query.sortBy ?? "updatedAt"] ?? "bd_target_accounts.updated_at";
      const sortOrder = query.sortOrder === "asc" ? "ASC" : "DESC";

      const countResult = await client.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total ${this.bdFromClause()} WHERE ${whereClause}`,
        params
      );
      const total = Number(countResult.rows[0]?.total ?? "0");

      const listParams = [...params, pageSize, (page - 1) * pageSize];
      const listResult = await client.query<BdTargetAccountRow>(
        `
          SELECT ${this.bdSelectColumns()}
          ${this.bdFromClause()}
          WHERE ${whereClause}
          ORDER BY ${sortColumn} ${sortOrder} NULLS LAST, bd_target_accounts.created_at DESC
          LIMIT $${listParams.length - 1} OFFSET $${listParams.length}
        `,
        listParams
      );

      return {
        targetAccounts: listResult.rows.map((row) => this.mapBdSummary(row)),
        pagination: buildPagination(page, pageSize, total)
      };
    });
  }

  private async loadBdDetail(
    client: PoolClient,
    actor: ActorContext,
    targetAccountId: string
  ): Promise<BdTargetAccountDetail> {
    const result = await client.query<BdTargetAccountRow>(
      `
        SELECT ${this.bdSelectColumns()}
        ${this.bdFromClause()}
        WHERE bd_target_accounts.tenant_id = $1
          AND bd_target_accounts.id = $2
          AND bd_target_accounts.deleted_at IS NULL
        LIMIT 1
      `,
      [actor.tenantId, targetAccountId]
    );

    const row = result.rows[0];

    if (!row) {
      throw new AppError(404, "Target account not found.", undefined, "TARGET_ACCOUNT_NOT_FOUND");
    }

    const stakeholdersMap = await this.loadBdStakeholders(client, actor.tenantId, [targetAccountId]);

    return {
      ...this.mapBdSummary(row),
      stakeholders: stakeholdersMap.get(targetAccountId) ?? [],
      territoryPlaceholder: {
        available: false,
        message: "Territory mapping will connect once geographic and account-coverage planning is introduced."
      },
      aiPlaceholders: this.buildBdAiPlaceholders(actor)
    };
  }

  async getBdTargetAccount(actor: ActorContext, targetAccountId: string): Promise<BdTargetAccountResponse> {
    this.assertEnabled();

    const targetAccount = await this.databaseService.withClient(async (client) =>
      this.loadBdDetail(client, actor, targetAccountId)
    );

    return { targetAccount };
  }

  async createBdTargetAccount(
    actor: ActorContext,
    audit: AuditMetadata,
    input: CreateBdTargetAccountRequestBody
  ): Promise<BdTargetAccountResponse> {
    this.assertEnabled();

    const targetAccountId = await this.databaseService.withTransaction(async (client) => {
      const accountId = await this.ensureAccountId(client, actor.tenantId, input.accountId ?? null);
      const ownerId = await this.ensureOwnerId(client, actor.tenantId, input.ownerId ?? null);
      const tierOptionId = await this.resolveOptionValueId(
        client,
        actor.tenantId,
        "bd-account-tier",
        input.tierKey,
        "BD account tier"
      );
      const stageOptionId = await this.resolveOptionValueId(
        client,
        actor.tenantId,
        "bd-pipeline-stage",
        input.stageKey,
        "BD pipeline stage"
      );
      const partnershipTypeOptionId = input.partnershipTypeKey
        ? await this.resolveOptionValueId(
            client,
            actor.tenantId,
            "bd-partnership-type",
            input.partnershipTypeKey,
            "BD partnership type"
          )
        : null;

      const result = await client.query<{ id: string }>(
        `
          INSERT INTO bd_target_accounts (
            tenant_id,
            account_id,
            owner_id,
            name,
            industry,
            region,
            tier_option_id,
            stage_option_id,
            partnership_type_option_id,
            annual_revenue,
            employee_count,
            market_opportunity_notes,
            executive_sponsor,
            next_step,
            is_partnership,
            metadata,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17, $17)
          RETURNING id
        `,
        [
          actor.tenantId,
          accountId,
          ownerId,
          input.name.trim(),
          getTrimmedNullableString(input.industry),
          getTrimmedNullableString(input.region),
          tierOptionId,
          stageOptionId,
          partnershipTypeOptionId,
          input.annualRevenue ?? null,
          input.employeeCount ?? null,
          getTrimmedNullableString(input.marketOpportunityNotes),
          getTrimmedNullableString(input.executiveSponsor),
          getTrimmedNullableString(input.nextStep),
          Boolean(input.isPartnership),
          JSON.stringify(input.metadata ?? {}),
          actor.userId
        ]
      );

      const nextTargetAccountId = result.rows[0]?.id;

      if (!nextTargetAccountId) {
        throw new AppError(500, "Target account creation failed.", undefined, "TARGET_ACCOUNT_CREATE_FAILED");
      }

      if (input.stakeholders && input.stakeholders.length > 0) {
        await this.syncBdStakeholders(client, actor, nextTargetAccountId, input.stakeholders);
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "bd.target_account.create",
        resourceType: "bd_target_account",
        resourceId: nextTargetAccountId,
        status: "success",
        metadata: { tierKey: input.tierKey, stageKey: input.stageKey, ownerId, accountId }
      });

      return nextTargetAccountId;
    });

    return this.getBdTargetAccount(actor, targetAccountId);
  }

  async updateBdTargetAccount(
    actor: ActorContext,
    audit: AuditMetadata,
    targetAccountId: string,
    input: UpdateBdTargetAccountRequestBody
  ): Promise<BdTargetAccountResponse> {
    this.assertEnabled();

    await this.databaseService.withTransaction(async (client) => {
      const keys = Object.keys(input).filter(
        (key) => input[key as keyof UpdateBdTargetAccountRequestBody] !== undefined
      );
      this.assertBdMutation(actor, keys);
      await this.getBdOwnerId(client, actor.tenantId, targetAccountId);

      const assignments: string[] = [];
      const params: unknown[] = [targetAccountId, actor.tenantId, actor.userId];

      const pushAssignment = (column: string, value: unknown, cast = "") => {
        params.push(value);
        assignments.push(`${column} = $${params.length}${cast}`);
      };

      if (keys.includes("name") && input.name !== undefined) {
        pushAssignment("name", input.name.trim());
      }
      if (keys.includes("accountId")) {
        pushAssignment("account_id", await this.ensureAccountId(client, actor.tenantId, input.accountId ?? null));
      }
      if (keys.includes("ownerId")) {
        pushAssignment("owner_id", await this.ensureOwnerId(client, actor.tenantId, input.ownerId ?? null));
      }
      if (keys.includes("tierKey") && input.tierKey) {
        pushAssignment(
          "tier_option_id",
          await this.resolveOptionValueId(client, actor.tenantId, "bd-account-tier", input.tierKey, "BD account tier")
        );
      }
      if (keys.includes("stageKey") && input.stageKey) {
        pushAssignment(
          "stage_option_id",
          await this.resolveOptionValueId(
            client,
            actor.tenantId,
            "bd-pipeline-stage",
            input.stageKey,
            "BD pipeline stage"
          )
        );
      }
      if (keys.includes("partnershipTypeKey")) {
        pushAssignment(
          "partnership_type_option_id",
          input.partnershipTypeKey
            ? await this.resolveOptionValueId(
                client,
                actor.tenantId,
                "bd-partnership-type",
                input.partnershipTypeKey,
                "BD partnership type"
              )
            : null
        );
      }
      if (keys.includes("industry")) {
        pushAssignment("industry", getTrimmedNullableString(input.industry));
      }
      if (keys.includes("region")) {
        pushAssignment("region", getTrimmedNullableString(input.region));
      }
      if (keys.includes("annualRevenue")) {
        pushAssignment("annual_revenue", input.annualRevenue ?? null);
      }
      if (keys.includes("employeeCount")) {
        pushAssignment("employee_count", input.employeeCount ?? null);
      }
      if (keys.includes("marketOpportunityNotes")) {
        pushAssignment("market_opportunity_notes", getTrimmedNullableString(input.marketOpportunityNotes));
      }
      if (keys.includes("executiveSponsor")) {
        pushAssignment("executive_sponsor", getTrimmedNullableString(input.executiveSponsor));
      }
      if (keys.includes("nextStep")) {
        pushAssignment("next_step", getTrimmedNullableString(input.nextStep));
      }
      if (keys.includes("isPartnership")) {
        pushAssignment("is_partnership", Boolean(input.isPartnership));
      }
      if (keys.includes("metadata")) {
        pushAssignment("metadata", JSON.stringify(input.metadata ?? {}), "::jsonb");
      }

      if (assignments.length > 0) {
        await client.query(
          `
            UPDATE bd_target_accounts
            SET ${assignments.join(", ")}, updated_by = $3
            WHERE id = $1
              AND tenant_id = $2
              AND deleted_at IS NULL
          `,
          params
        );
      } else {
        await client.query(
          `UPDATE bd_target_accounts SET updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          params
        );
      }

      if (keys.includes("stakeholders") && input.stakeholders) {
        await this.syncBdStakeholders(client, actor, targetAccountId, input.stakeholders);
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "bd.target_account.update",
        resourceType: "bd_target_account",
        resourceId: targetAccountId,
        status: "success",
        metadata: { updatedFields: keys }
      });
    });

    return this.getBdTargetAccount(actor, targetAccountId);
  }

  async deleteBdTargetAccount(
    actor: ActorContext,
    audit: AuditMetadata,
    targetAccountId: string
  ): Promise<CrmMutationSuccessResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      await this.getBdOwnerId(client, actor.tenantId, targetAccountId);

      await client.query(
        `
          UPDATE bd_account_stakeholders
          SET deleted_at = NOW(), updated_by = $3
          WHERE tenant_id = $1 AND target_account_id = $2 AND deleted_at IS NULL
        `,
        [actor.tenantId, targetAccountId, actor.userId]
      );
      await client.query(
        `
          UPDATE bd_target_accounts
          SET deleted_at = NOW(), updated_by = $3
          WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
        `,
        [actor.tenantId, targetAccountId, actor.userId]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "bd.target_account.delete",
        resourceType: "bd_target_account",
        resourceId: targetAccountId,
        status: "success"
      });

      return { success: true };
    });
  }

  // ==========================================================================
  // Presales: requests
  // ==========================================================================

  private buildPresalesAiPlaceholders(actor: ActorContext): PresalesAiPlaceholderSummary {
    const permissionCodes = new Set(actor.permissionCodes);
    const canUseAi =
      permissionCodes.has("presales.use_ai") ||
      permissionCodes.has("presales.manage_ai") ||
      permissionCodes.has("ai.use_ai") ||
      permissionCodes.has("ai.manage_ai");
    const canManageAi = permissionCodes.has("presales.manage_ai") || permissionCodes.has("ai.manage_ai");

    return {
      actions: canUseAi
        ? [
            {
              key: "rfp_extraction",
              label: "RFP extraction",
              description: "Placeholder entry point for future RFP/RFI requirement extraction."
            },
            {
              key: "compliance_matrix",
              label: "Compliance matrix",
              description: "Placeholder entry point for future automated compliance matrix generation."
            },
            {
              key: "demo_script",
              label: "Demo script",
              description: "Placeholder entry point for future tailored demo script generation."
            },
            {
              key: "proposal_response_draft",
              label: "Proposal response draft",
              description: "Placeholder entry point for future proposal and response drafting."
            },
            {
              key: "technical_risk_detection",
              label: "Technical risk detection",
              description: "Placeholder entry point for future technical and delivery risk detection."
            }
          ]
        : [],
      governanceHint: canManageAi
        ? "AI placeholders are visible and will later connect to the governed AI Gateway with presales-specific controls."
        : canUseAi
          ? "AI placeholders are visible for this role, but execution remains deferred until the AI Gateway phase."
          : "AI placeholders remain hidden until the role includes presales or global AI usage permissions."
    };
  }

  private async getPresalesState(client: PoolClient, tenantId: string, requestId: string) {
    const result = await client.query<{ id: string; owner_id: string | null; assignee_id: string | null }>(
      `
        SELECT id, owner_id, assignee_id
        FROM presales_requests
        WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
        LIMIT 1
      `,
      [requestId, tenantId]
    );

    const row = result.rows[0];

    if (!row) {
      throw new AppError(404, "Presales request not found.", undefined, "PRESALES_REQUEST_NOT_FOUND");
    }

    return row;
  }

  private assertPresalesMutation(actor: ActorContext, keys: string[]) {
    if (keys.length === 0) {
      throw new AppError(400, "At least one field must be updated.", undefined, "VALIDATION_ERROR");
    }

    const canEdit =
      actor.permissionCodes.includes("presales.edit") || actor.permissionCodes.includes("presales.configure");
    const canAssign =
      actor.permissionCodes.includes("presales.assign") || actor.permissionCodes.includes("presales.configure");
    const assignmentOnly = keys.every((key) => key === "ownerId" || key === "assigneeId");

    if (!canEdit && !(canAssign && assignmentOnly)) {
      throw new AppError(
        403,
        "You do not have permission to update this presales request.",
        undefined,
        "AUTHORIZATION_ERROR"
      );
    }

    if (!canAssign && (keys.includes("ownerId") || keys.includes("assigneeId"))) {
      throw new AppError(
        403,
        "You do not have permission to reassign presales requests.",
        undefined,
        "AUTHORIZATION_ERROR"
      );
    }
  }

  private mapPresalesSummary(row: PresalesRequestRow): PresalesRequestSummary {
    return {
      id: row.id,
      title: row.title,
      type: mapOptionValue({
        id: row.type_id,
        key: row.type_key,
        label: row.type_label,
        description: row.type_description,
        color: row.type_color,
        isDefault: row.type_is_default,
        isActive: row.type_is_active
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
      priority: normalizePriority(row.priority),
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
      account: row.account_id
        ? { id: row.account_id, name: row.account_name ?? "", website: row.account_website }
        : null,
      owner: mapUser({
        id: row.owner_id,
        displayName: row.owner_display_name,
        email: row.owner_email,
        teamName: row.owner_team_name,
        departmentName: row.owner_department_name
      }),
      assignee: mapUser({
        id: row.assignee_id,
        displayName: row.assignee_display_name,
        email: row.assignee_email,
        teamName: row.assignee_team_name,
        departmentName: row.assignee_department_name
      }),
      dueDate: row.due_date,
      summary: row.summary,
      requirementCount: row.requirement_count,
      metRequirementCount: row.met_requirement_count,
      gapRequirementCount: row.gap_requirement_count,
      metadata: getMetadata(row.metadata),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private presalesSelectColumns() {
    return `
      presales_requests.id,
      presales_requests.title,
      presales_requests.priority,
      presales_requests.due_date,
      presales_requests.summary,
      presales_requests.technical_requirements,
      presales_requests.proposal_content,
      presales_requests.metadata,
      presales_requests.created_at,
      presales_requests.updated_at,
      presales_requests.opportunity_id,
      linked_opportunities.name AS opportunity_name,
      opportunity_stage_values.id AS opportunity_stage_id,
      opportunity_stage_values.value_key AS opportunity_stage_key,
      opportunity_stage_values.label AS opportunity_stage_label,
      opportunity_stage_values.description AS opportunity_stage_description,
      opportunity_stage_values.color AS opportunity_stage_color,
      opportunity_stage_values.is_default AS opportunity_stage_is_default,
      opportunity_stage_values.is_active AS opportunity_stage_is_active,
      presales_requests.account_id,
      linked_accounts.name AS account_name,
      linked_accounts.website AS account_website,
      owner_users.id AS owner_id,
      owner_users.display_name AS owner_display_name,
      owner_users.email AS owner_email,
      owner_teams.name AS owner_team_name,
      owner_departments.name AS owner_department_name,
      assignee_users.id AS assignee_id,
      assignee_users.display_name AS assignee_display_name,
      assignee_users.email AS assignee_email,
      assignee_teams.name AS assignee_team_name,
      assignee_departments.name AS assignee_department_name,
      type_values.id AS type_id,
      type_values.value_key AS type_key,
      type_values.label AS type_label,
      type_values.description AS type_description,
      type_values.color AS type_color,
      type_values.is_default AS type_is_default,
      type_values.is_active AS type_is_active,
      status_values.id AS status_id,
      status_values.value_key AS status_key,
      status_values.label AS status_label,
      status_values.description AS status_description,
      status_values.color AS status_color,
      status_values.is_default AS status_is_default,
      status_values.is_active AS status_is_active,
      COALESCE(requirement_counts.count, 0)::int AS requirement_count,
      COALESCE(requirement_counts.met_count, 0)::int AS met_requirement_count,
      COALESCE(requirement_counts.gap_count, 0)::int AS gap_requirement_count
    `;
  }

  private presalesFromClause() {
    return `
      FROM presales_requests
      INNER JOIN tenant_option_values AS type_values
        ON type_values.id = presales_requests.request_type_option_id
       AND type_values.tenant_id = presales_requests.tenant_id
      INNER JOIN tenant_option_values AS status_values
        ON status_values.id = presales_requests.status_option_id
       AND status_values.tenant_id = presales_requests.tenant_id
      LEFT JOIN opportunities AS linked_opportunities
        ON linked_opportunities.id = presales_requests.opportunity_id
       AND linked_opportunities.tenant_id = presales_requests.tenant_id
       AND linked_opportunities.deleted_at IS NULL
      LEFT JOIN tenant_option_values AS opportunity_stage_values
        ON opportunity_stage_values.id = linked_opportunities.stage_option_id
       AND opportunity_stage_values.tenant_id = linked_opportunities.tenant_id
      LEFT JOIN accounts AS linked_accounts
        ON linked_accounts.id = presales_requests.account_id
       AND linked_accounts.tenant_id = presales_requests.tenant_id
       AND linked_accounts.deleted_at IS NULL
      LEFT JOIN users AS owner_users
        ON owner_users.id = presales_requests.owner_id
       AND owner_users.tenant_id = presales_requests.tenant_id
       AND owner_users.deleted_at IS NULL
      LEFT JOIN teams AS owner_teams
        ON owner_teams.id = owner_users.team_id
       AND owner_teams.tenant_id = owner_users.tenant_id
       AND owner_teams.deleted_at IS NULL
      LEFT JOIN departments AS owner_departments
        ON owner_departments.id = owner_users.department_id
       AND owner_departments.tenant_id = owner_users.tenant_id
       AND owner_departments.deleted_at IS NULL
      LEFT JOIN users AS assignee_users
        ON assignee_users.id = presales_requests.assignee_id
       AND assignee_users.tenant_id = presales_requests.tenant_id
       AND assignee_users.deleted_at IS NULL
      LEFT JOIN teams AS assignee_teams
        ON assignee_teams.id = assignee_users.team_id
       AND assignee_teams.tenant_id = assignee_users.tenant_id
       AND assignee_teams.deleted_at IS NULL
      LEFT JOIN departments AS assignee_departments
        ON assignee_departments.id = assignee_users.department_id
       AND assignee_departments.tenant_id = assignee_users.tenant_id
       AND assignee_departments.deleted_at IS NULL
      LEFT JOIN (
        SELECT tenant_id, request_id,
          COUNT(*) AS count,
          COUNT(*) FILTER (WHERE compliance_status = 'met') AS met_count,
          COUNT(*) FILTER (WHERE compliance_status = 'gap') AS gap_count
        FROM presales_requirements
        WHERE deleted_at IS NULL
        GROUP BY tenant_id, request_id
      ) AS requirement_counts
        ON requirement_counts.tenant_id = presales_requests.tenant_id
       AND requirement_counts.request_id = presales_requests.id
    `;
  }

  private async loadPresalesRequirements(
    client: PoolClient,
    tenantId: string,
    requestId: string
  ): Promise<PresalesRequirementSummary[]> {
    const result = await client.query<{
      id: string;
      label: string;
      category: string;
      requirement: string | null;
      response: string | null;
      compliance_status: string;
      priority: string;
      sort_order: number;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        SELECT id, label, category, requirement, response, compliance_status, priority, sort_order, created_at, updated_at
        FROM presales_requirements
        WHERE tenant_id = $1 AND request_id = $2 AND deleted_at IS NULL
        ORDER BY sort_order ASC, created_at ASC
      `,
      [tenantId, requestId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      label: row.label,
      category: normalizeRequirementCategory(row.category),
      requirement: row.requirement,
      response: row.response,
      complianceStatus: normalizeComplianceStatus(row.compliance_status),
      priority: normalizePriority(row.priority),
      sortOrder: row.sort_order,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    }));
  }

  private async syncPresalesRequirements(
    client: PoolClient,
    actor: ActorContext,
    requestId: string,
    requirements: PresalesRequirementInput[]
  ) {
    await client.query(
      `
        UPDATE presales_requirements
        SET deleted_at = NOW(), updated_by = $3
        WHERE tenant_id = $1 AND request_id = $2 AND deleted_at IS NULL
      `,
      [actor.tenantId, requestId, actor.userId]
    );

    let sortOrder = 0;

    for (const requirement of requirements) {
      const label = requirement.label.trim();

      if (label.length === 0) {
        continue;
      }

      await client.query(
        `
          INSERT INTO presales_requirements (
            tenant_id,
            request_id,
            label,
            category,
            requirement,
            response,
            compliance_status,
            priority,
            sort_order,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
        `,
        [
          actor.tenantId,
          requestId,
          label,
          normalizeRequirementCategory(requirement.category),
          getTrimmedNullableString(requirement.requirement),
          getTrimmedNullableString(requirement.response),
          normalizeComplianceStatus(requirement.complianceStatus),
          normalizePriority(requirement.priority),
          requirement.sortOrder ?? sortOrder,
          actor.userId
        ]
      );

      sortOrder += 1;
    }
  }

  async getPresalesOptions(actor: ActorContext): Promise<PresalesRequestOptionsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => ({
      owners: await this.loadOwners(client, actor.tenantId),
      accounts: await this.loadAccountsLookup(client, actor.tenantId),
      opportunities: await this.loadOpportunitiesLookup(client, actor.tenantId),
      requestTypes: await this.loadOptionSetValues(client, actor.tenantId, "presales-request-type"),
      statuses: await this.loadOptionSetValues(client, actor.tenantId, "presales-request-status"),
      priorities: [...PRESALES_PRIORITIES],
      availableScopes: await this.getAvailableScopes(client, actor, "presales")
    }));
  }

  async listPresalesRequests(
    actor: ActorContext,
    query: PresalesRequestListQuery
  ): Promise<PresalesRequestsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const scope = await this.resolveScope(client, actor, "presales", query.scope);
      const page = Math.max(1, query.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
      const conditions = ["presales_requests.tenant_id = $1", "presales_requests.deleted_at IS NULL"];
      const params: unknown[] = [actor.tenantId];

      if (scope === "mine") {
        params.push(actor.userId);
        conditions.push(
          `(presales_requests.owner_id = $${params.length} OR presales_requests.assignee_id = $${params.length})`
        );
      } else if (scope === "team") {
        const actorTeamId = await this.getActorTeamId(client, actor.tenantId, actor.userId);
        params.push(actorTeamId);
        conditions.push(`(owner_users.team_id = $${params.length} OR assignee_users.team_id = $${params.length})`);
      }

      if (query.search) {
        params.push(`%${query.search.trim()}%`);
        conditions.push(
          `(presales_requests.title ILIKE $${params.length} OR presales_requests.summary ILIKE $${params.length})`
        );
      }

      if (query.type) {
        params.push(query.type);
        conditions.push(`type_values.value_key = $${params.length}`);
      }

      if (query.status) {
        params.push(query.status);
        conditions.push(`status_values.value_key = $${params.length}`);
      }

      if (query.priority) {
        params.push(query.priority);
        conditions.push(`presales_requests.priority = $${params.length}`);
      }

      if (query.ownerId) {
        params.push(query.ownerId);
        conditions.push(`presales_requests.owner_id = $${params.length}`);
      }

      if (query.assigneeId) {
        params.push(query.assigneeId);
        conditions.push(`presales_requests.assignee_id = $${params.length}`);
      }

      if (query.opportunityId) {
        params.push(query.opportunityId);
        conditions.push(`presales_requests.opportunity_id = $${params.length}`);
      }

      if (query.accountId) {
        params.push(query.accountId);
        conditions.push(`presales_requests.account_id = $${params.length}`);
      }

      const whereClause = conditions.join(" AND ");
      const sortColumnMap: Record<string, string> = {
        title: "presales_requests.title",
        type: "type_values.sort_order",
        status: "status_values.sort_order",
        priority: "presales_requests.priority",
        dueDate: "presales_requests.due_date",
        updatedAt: "presales_requests.updated_at",
        createdAt: "presales_requests.created_at"
      };
      const sortColumn = sortColumnMap[query.sortBy ?? "updatedAt"] ?? "presales_requests.updated_at";
      const sortOrder = query.sortOrder === "asc" ? "ASC" : "DESC";

      const countResult = await client.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total ${this.presalesFromClause()} WHERE ${whereClause}`,
        params
      );
      const total = Number(countResult.rows[0]?.total ?? "0");

      const listParams = [...params, pageSize, (page - 1) * pageSize];
      const listResult = await client.query<PresalesRequestRow>(
        `
          SELECT ${this.presalesSelectColumns()}
          ${this.presalesFromClause()}
          WHERE ${whereClause}
          ORDER BY ${sortColumn} ${sortOrder} NULLS LAST, presales_requests.created_at DESC
          LIMIT $${listParams.length - 1} OFFSET $${listParams.length}
        `,
        listParams
      );

      return {
        requests: listResult.rows.map((row) => this.mapPresalesSummary(row)),
        pagination: buildPagination(page, pageSize, total)
      };
    });
  }

  private async loadPresalesDetail(
    client: PoolClient,
    actor: ActorContext,
    requestId: string
  ): Promise<PresalesRequestDetail> {
    const result = await client.query<PresalesRequestRow>(
      `
        SELECT ${this.presalesSelectColumns()}
        ${this.presalesFromClause()}
        WHERE presales_requests.tenant_id = $1
          AND presales_requests.id = $2
          AND presales_requests.deleted_at IS NULL
        LIMIT 1
      `,
      [actor.tenantId, requestId]
    );

    const row = result.rows[0];

    if (!row) {
      throw new AppError(404, "Presales request not found.", undefined, "PRESALES_REQUEST_NOT_FOUND");
    }

    const requirements = await this.loadPresalesRequirements(client, actor.tenantId, requestId);

    return {
      ...this.mapPresalesSummary(row),
      technicalRequirements: row.technical_requirements,
      proposalContent: row.proposal_content,
      requirements,
      demoCalendarPlaceholder: {
        available: false,
        message: "Demo calendar scheduling will connect once calendar sync and booking workflows are introduced."
      },
      solutionRepositoryPlaceholder: {
        available: false,
        message: "The solution repository will connect once reusable assets and content management are introduced."
      },
      aiPlaceholders: this.buildPresalesAiPlaceholders(actor)
    };
  }

  async getPresalesRequest(actor: ActorContext, requestId: string): Promise<PresalesRequestResponse> {
    this.assertEnabled();

    const request = await this.databaseService.withClient(async (client) =>
      this.loadPresalesDetail(client, actor, requestId)
    );

    return { request };
  }

  async createPresalesRequest(
    actor: ActorContext,
    audit: AuditMetadata,
    input: CreatePresalesRequestRequestBody
  ): Promise<PresalesRequestResponse> {
    this.assertEnabled();

    const requestId = await this.databaseService.withTransaction(async (client) => {
      const opportunityId = await this.ensureOpportunityId(client, actor.tenantId, input.opportunityId ?? null);
      const accountId = await this.ensureAccountId(client, actor.tenantId, input.accountId ?? null);
      const ownerId = await this.ensureOwnerId(client, actor.tenantId, input.ownerId ?? null);
      const assigneeId = await this.ensureOwnerId(client, actor.tenantId, input.assigneeId ?? null);
      const requestTypeOptionId = await this.resolveOptionValueId(
        client,
        actor.tenantId,
        "presales-request-type",
        input.typeKey,
        "Presales request type"
      );
      const statusOptionId = await this.resolveOptionValueId(
        client,
        actor.tenantId,
        "presales-request-status",
        input.statusKey ?? "new",
        "Presales request status"
      );

      const result = await client.query<{ id: string }>(
        `
          INSERT INTO presales_requests (
            tenant_id,
            opportunity_id,
            account_id,
            owner_id,
            assignee_id,
            title,
            request_type_option_id,
            status_option_id,
            priority,
            due_date,
            summary,
            technical_requirements,
            proposal_content,
            metadata,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date, $11, $12, $13, $14::jsonb, $15, $15)
          RETURNING id
        `,
        [
          actor.tenantId,
          opportunityId,
          accountId,
          ownerId,
          assigneeId,
          input.title.trim(),
          requestTypeOptionId,
          statusOptionId,
          normalizePriority(input.priority),
          input.dueDate ?? null,
          getTrimmedNullableString(input.summary),
          getTrimmedNullableString(input.technicalRequirements),
          getTrimmedNullableString(input.proposalContent),
          JSON.stringify(input.metadata ?? {}),
          actor.userId
        ]
      );

      const nextRequestId = result.rows[0]?.id;

      if (!nextRequestId) {
        throw new AppError(500, "Presales request creation failed.", undefined, "PRESALES_REQUEST_CREATE_FAILED");
      }

      if (input.requirements && input.requirements.length > 0) {
        await this.syncPresalesRequirements(client, actor, nextRequestId, input.requirements);
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "presales.request.create",
        resourceType: "presales_request",
        resourceId: nextRequestId,
        status: "success",
        metadata: { typeKey: input.typeKey, opportunityId, accountId, assigneeId }
      });

      return nextRequestId;
    });

    return this.getPresalesRequest(actor, requestId);
  }

  async updatePresalesRequest(
    actor: ActorContext,
    audit: AuditMetadata,
    requestId: string,
    input: UpdatePresalesRequestRequestBody
  ): Promise<PresalesRequestResponse> {
    this.assertEnabled();

    await this.databaseService.withTransaction(async (client) => {
      const keys = Object.keys(input).filter(
        (key) => input[key as keyof UpdatePresalesRequestRequestBody] !== undefined
      );
      this.assertPresalesMutation(actor, keys);
      await this.getPresalesState(client, actor.tenantId, requestId);

      const assignments: string[] = [];
      const params: unknown[] = [requestId, actor.tenantId, actor.userId];

      const pushAssignment = (column: string, value: unknown, cast = "") => {
        params.push(value);
        assignments.push(`${column} = $${params.length}${cast}`);
      };

      if (keys.includes("title") && input.title !== undefined) {
        pushAssignment("title", input.title.trim());
      }
      if (keys.includes("typeKey") && input.typeKey) {
        pushAssignment(
          "request_type_option_id",
          await this.resolveOptionValueId(
            client,
            actor.tenantId,
            "presales-request-type",
            input.typeKey,
            "Presales request type"
          )
        );
      }
      if (keys.includes("statusKey") && input.statusKey) {
        pushAssignment(
          "status_option_id",
          await this.resolveOptionValueId(
            client,
            actor.tenantId,
            "presales-request-status",
            input.statusKey,
            "Presales request status"
          )
        );
      }
      if (keys.includes("priority")) {
        pushAssignment("priority", normalizePriority(input.priority));
      }
      if (keys.includes("opportunityId")) {
        pushAssignment(
          "opportunity_id",
          await this.ensureOpportunityId(client, actor.tenantId, input.opportunityId ?? null)
        );
      }
      if (keys.includes("accountId")) {
        pushAssignment("account_id", await this.ensureAccountId(client, actor.tenantId, input.accountId ?? null));
      }
      if (keys.includes("ownerId")) {
        pushAssignment("owner_id", await this.ensureOwnerId(client, actor.tenantId, input.ownerId ?? null));
      }
      if (keys.includes("assigneeId")) {
        pushAssignment("assignee_id", await this.ensureOwnerId(client, actor.tenantId, input.assigneeId ?? null));
      }
      if (keys.includes("dueDate")) {
        pushAssignment("due_date", input.dueDate ?? null, "::date");
      }
      if (keys.includes("summary")) {
        pushAssignment("summary", getTrimmedNullableString(input.summary));
      }
      if (keys.includes("technicalRequirements")) {
        pushAssignment("technical_requirements", getTrimmedNullableString(input.technicalRequirements));
      }
      if (keys.includes("proposalContent")) {
        pushAssignment("proposal_content", getTrimmedNullableString(input.proposalContent));
      }
      if (keys.includes("metadata")) {
        pushAssignment("metadata", JSON.stringify(input.metadata ?? {}), "::jsonb");
      }

      if (assignments.length > 0) {
        await client.query(
          `
            UPDATE presales_requests
            SET ${assignments.join(", ")}, updated_by = $3
            WHERE id = $1
              AND tenant_id = $2
              AND deleted_at IS NULL
          `,
          params
        );
      } else {
        await client.query(
          `UPDATE presales_requests SET updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          params
        );
      }

      if (keys.includes("requirements") && input.requirements) {
        await this.syncPresalesRequirements(client, actor, requestId, input.requirements);
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "presales.request.update",
        resourceType: "presales_request",
        resourceId: requestId,
        status: "success",
        metadata: { updatedFields: keys }
      });
    });

    return this.getPresalesRequest(actor, requestId);
  }

  async deletePresalesRequest(
    actor: ActorContext,
    audit: AuditMetadata,
    requestId: string
  ): Promise<CrmMutationSuccessResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      await this.getPresalesState(client, actor.tenantId, requestId);

      await client.query(
        `
          UPDATE presales_requirements
          SET deleted_at = NOW(), updated_by = $3
          WHERE tenant_id = $1 AND request_id = $2 AND deleted_at IS NULL
        `,
        [actor.tenantId, requestId, actor.userId]
      );
      await client.query(
        `
          UPDATE presales_requests
          SET deleted_at = NOW(), updated_by = $3
          WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
        `,
        [actor.tenantId, requestId, actor.userId]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "presales.request.delete",
        resourceType: "presales_request",
        resourceId: requestId,
        status: "success"
      });

      return { success: true };
    });
  }
}

interface BdTargetAccountRow {
  id: string;
  name: string;
  industry: string | null;
  region: string | null;
  annual_revenue: string | number | null;
  employee_count: number | null;
  market_opportunity_notes: string | null;
  executive_sponsor: string | null;
  next_step: string | null;
  is_partnership: boolean;
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
  tier_id: string | null;
  tier_key: string | null;
  tier_label: string | null;
  tier_description: string | null;
  tier_color: string | null;
  tier_is_default: boolean | null;
  tier_is_active: boolean | null;
  stage_id: string | null;
  stage_key: string | null;
  stage_label: string | null;
  stage_description: string | null;
  stage_color: string | null;
  stage_is_default: boolean | null;
  stage_is_active: boolean | null;
  partnership_type_id: string | null;
  partnership_type_key: string | null;
  partnership_type_label: string | null;
  partnership_type_description: string | null;
  partnership_type_color: string | null;
  partnership_type_is_default: boolean | null;
  partnership_type_is_active: boolean | null;
  stakeholder_count: number;
  executive_stakeholder_count: number;
}

interface PresalesRequestRow {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  summary: string | null;
  technical_requirements: string | null;
  proposal_content: string | null;
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
  owner_id: string | null;
  owner_display_name: string | null;
  owner_email: string | null;
  owner_team_name: string | null;
  owner_department_name: string | null;
  assignee_id: string | null;
  assignee_display_name: string | null;
  assignee_email: string | null;
  assignee_team_name: string | null;
  assignee_department_name: string | null;
  type_id: string | null;
  type_key: string | null;
  type_label: string | null;
  type_description: string | null;
  type_color: string | null;
  type_is_default: boolean | null;
  type_is_active: boolean | null;
  status_id: string | null;
  status_key: string | null;
  status_label: string | null;
  status_description: string | null;
  status_color: string | null;
  status_is_default: boolean | null;
  status_is_active: boolean | null;
  requirement_count: number;
  met_requirement_count: number;
  gap_requirement_count: number;
}
