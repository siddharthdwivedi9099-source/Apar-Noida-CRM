import type {
  AccountLookupSummary,
  BdAccountStakeholderInput,
  BdAccountStakeholderSummary,
  BdAiPlaceholderSummary,
  BdConvertRequestBody,
  BdConvertResponse,
  BdEngagementSignals,
  BdHandoffRecord,
  BdHandoffRequestBody,
  BdHandoffResponse,
  BdImportRequestBody,
  BdImportResponse,
  BdImportSkippedEntry,
  BdInfluenceLevel,
  BdMarketSignalSummary,
  BdPartnerReferralSummary,
  BdPipelineScope,
  BdRelationshipStrength,
  BdSequenceStepDefinition,
  BdTerritoryPlanSummary,
  CreateBdMarketSignalRequestBody,
  CreateBdPartnerReferralRequestBody,
  CreateBdTerritoryPlanRequestBody,
  BdMarketSignalResponse,
  BdMarketSignalsResponse,
  BdPartnerReferralResponse,
  BdPartnerReferralsResponse,
  BdTerritoryPlanResponse,
  BdTerritoryPlansResponse,
  SubmitBdTerritoryPlanReviewRequestBody,
  UpdateBdPartnerReferralRequestBody,
  BdTargetAccountDetail,
  BdTargetAccountListQuery,
  BdTargetAccountOptionsResponse,
  BdTargetAccountResponse,
  BdTargetAccountSummary,
  BdTargetAccountsResponse,
  ContactRelationshipSummary,
  CreateBdTargetAccountRequestBody,
  CreatePresalesRequestRequestBody,
  PresalesDemoFeedback,
  PresalesDemoFeedbackRequestBody,
  PresalesDemoWorkspace,
  PresalesDemoWorkspaceRequestBody,
  PresalesFitmentReview,
  PresalesFitmentReviewRequestBody,
  PresalesGapTaskRequestBody,
  PresalesPocPlan,
  PresalesPocPlanRequestBody,
  PresalesPocSignOffRequestBody,
  PresalesTriageRequestBody,
  PresalesTriageState,
  CrmLookupUserSummary,
  CrmMutationSuccessResponse,
  CrmOptionValueSummary,
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
import {
  evaluateBdEngagement,
  evaluateBdSequence,
  evaluateBuyingCommitteeCompleteness
} from "@crm/types";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import { buildPagination } from "../../common/pagination.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { NotificationService } from "../notifications/notifications.service.js";
import { ApprovalService } from "../approvals/approvals.service.js";
import { OpportunityService } from "../opportunities/opportunities.service.js";

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

function metaString(value: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

function metaStringArray(value: Record<string, unknown> | null | undefined, key: string): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }
  const raw = (value as Record<string, unknown>)[key];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim());
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

export class BusinessDevelopmentService {
  private readonly notificationService: NotificationService;
  private readonly approvalService: ApprovalService;
  private readonly opportunityService: OpportunityService;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {
    this.notificationService = new NotificationService(databaseService, config);
    this.approvalService = new ApprovalService(databaseService, config);
    this.opportunityService = new OpportunityService(databaseService, config);
  }

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

  // BDR-003: load outbound sequence step definitions (channel + offset + targeting from metadata).
  private async loadBdSequenceSteps(client: PoolClient, tenantId: string): Promise<BdSequenceStepDefinition[]> {
    const result = await client.query<{ key: string; label: string; sort_order: number; metadata: Record<string, unknown> | null }>(
      `
        SELECT
          tenant_option_values.value_key AS key,
          tenant_option_values.label,
          tenant_option_values.sort_order,
          tenant_option_values.metadata
        FROM tenant_option_sets
        INNER JOIN tenant_option_values
          ON tenant_option_values.option_set_id = tenant_option_sets.id
         AND tenant_option_values.tenant_id = tenant_option_sets.tenant_id
        WHERE tenant_option_sets.tenant_id = $1
          AND tenant_option_sets.set_key = 'bd-sequence-step'
          AND tenant_option_sets.deleted_at IS NULL
          AND tenant_option_values.deleted_at IS NULL
          AND tenant_option_values.is_active = true
        ORDER BY tenant_option_values.sort_order ASC, tenant_option_values.label ASC
      `,
      [tenantId]
    );

    const validChannels = ["email", "call", "linkedin", "whatsapp", "sms", "task"];
    return result.rows.map((row, index) => {
      const metadata = row.metadata ?? {};
      const channelRaw = metaString(metadata, "channel");
      const offsetRaw = (metadata as Record<string, unknown>).offsetHours;
      return {
        key: row.key,
        label: row.label,
        channel: (channelRaw && validChannels.includes(channelRaw) ? channelRaw : "task") as BdSequenceStepDefinition["channel"],
        offsetHours: typeof offsetRaw === "number" && Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : index * 24,
        order: row.sort_order,
        persona: metaString(metadata, "persona"),
        product: metaString(metadata, "product"),
        region: metaString(metadata, "region")
      };
    });
  }

  // Catalogs needed to map BDR-computed views (priority, technologies, buyer roles, sequence, engagement).
  private async loadBdComputeCatalog(client: PoolClient, tenantId: string): Promise<BdComputeCatalog> {
    return {
      priorities: await this.loadOptionSetValues(client, tenantId, "bd-account-priority"),
      technologies: await this.loadOptionSetValues(client, tenantId, "bd-technology"),
      buyerRoles: await this.loadOptionSetValues(client, tenantId, "bd-buyer-role"),
      sequenceSteps: await this.loadBdSequenceSteps(client, tenantId),
      nowIso: new Date().toISOString()
    };
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
            },
            {
              key: "high_potential_accounts",
              label: "High-potential accounts",
              description: "Placeholder entry point for future AI recommendations of high-potential target accounts."
            },
            {
              key: "buying_committee_gap",
              label: "Buying-committee gaps",
              description: "Placeholder entry point for future AI suggestions of missing buying-committee roles."
            },
            {
              key: "sequence_message",
              label: "Personalized sequence message",
              description: "Placeholder entry point for future AI-personalized outbound sequence messages."
            },
            {
              key: "buying_signal_accounts",
              label: "Buying-signal accounts",
              description: "Placeholder entry point for future AI highlighting of accounts showing buying signals."
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
    targetAccountIds: string[],
    buyerRoles: CrmOptionValueSummary[] = []
  ): Promise<Map<string, BdAccountStakeholderSummary[]>> {
    const map = new Map<string, BdAccountStakeholderSummary[]>();

    if (targetAccountIds.length === 0) {
      return map;
    }

    const buyerRoleMap = new Map(buyerRoles.map((option) => [option.key, option]));
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
      metadata: Record<string, unknown> | null;
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
          bd_account_stakeholders.metadata,
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
        buyerRole: (() => {
          const buyerRoleKey = metaString(row.metadata, "buyerRoleKey");
          return buyerRoleKey ? buyerRoleMap.get(buyerRoleKey) ?? null : null;
        })(),
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

  private mapBdSummary(row: BdTargetAccountRow, catalog: BdComputeCatalog): BdTargetAccountSummary {
    const metadata = getMetadata(row.metadata);
    const priorityKey = metaString(metadata, "priorityKey");
    const technologyKeys = metaStringArray(metadata, "technologies");
    const priorityMap = new Map(catalog.priorities.map((option) => [option.key, option]));
    const technologyMap = new Map(catalog.technologies.map((option) => [option.key, option]));
    const engagementSignals =
      metadata.engagementSignals && typeof metadata.engagementSignals === "object"
        ? (metadata.engagementSignals as Partial<BdEngagementSignals>)
        : {};

    return {
      id: row.id,
      name: row.name,
      priority: priorityKey ? priorityMap.get(priorityKey) ?? null : null,
      technologies: technologyKeys.map((key) => technologyMap.get(key)).filter((value): value is CrmOptionValueSummary => Boolean(value)),
      engagement: evaluateBdEngagement(engagementSignals),
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

      const buyerRoleKey = getTrimmedNullableString(stakeholder.buyerRoleKey);

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
            metadata,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10, $11::jsonb, $12, $12)
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
          JSON.stringify(buyerRoleKey ? { buyerRoleKey } : {}),
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
      availableScopes: await this.getAvailableScopes(client, actor, "business_development"),
      priorities: await this.loadOptionSetValues(client, actor.tenantId, "bd-account-priority"),
      technologies: await this.loadOptionSetValues(client, actor.tenantId, "bd-technology"),
      buyerRoles: await this.loadOptionSetValues(client, actor.tenantId, "bd-buyer-role"),
      sequenceSteps: await this.loadBdSequenceSteps(client, actor.tenantId),
      opportunityStages: await this.loadOptionSetValues(client, actor.tenantId, "opportunity-pipeline"),
      marketSignalTypes: await this.loadOptionSetValues(client, actor.tenantId, "bd-market-signal-type")
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

      const catalog = await this.loadBdComputeCatalog(client, actor.tenantId);
      return {
        targetAccounts: listResult.rows.map((row) => this.mapBdSummary(row, catalog)),
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

    const catalog = await this.loadBdComputeCatalog(client, actor.tenantId);
    const stakeholdersMap = await this.loadBdStakeholders(client, actor.tenantId, [targetAccountId], catalog.buyerRoles);
    const stakeholders = stakeholdersMap.get(targetAccountId) ?? [];
    const metadata = getMetadata(row.metadata);
    const sequenceStateRaw =
      metadata.sequence && typeof metadata.sequence === "object" ? (metadata.sequence as Record<string, unknown>) : {};

    const sequence = evaluateBdSequence({
      steps: catalog.sequenceSteps,
      context: {
        persona: metaString(metadata, "persona"),
        product: metaStringArray(metadata, "technologies")[0] ?? metaString(metadata, "product"),
        region: row.region
      },
      state: {
        paused: sequenceStateRaw.paused === true,
        pauseReason: metaString(sequenceStateRaw, "pauseReason"),
        completedStepKeys: metaStringArray(sequenceStateRaw, "completedStepKeys")
      },
      startIso: row.created_at.toISOString(),
      nowIso: catalog.nowIso
    });

    const buyingCommittee = evaluateBuyingCommitteeCompleteness(
      catalog.buyerRoles,
      stakeholders.map((stakeholder) => stakeholder.buyerRole?.key)
    );

    return {
      ...this.mapBdSummary(row, catalog),
      stakeholders,
      buyingCommittee,
      sequence,
      handoff: this.readHandoffRecord(metadata),
      territoryPlaceholder: {
        available: false,
        message: "Territory mapping will connect once geographic and account-coverage planning is introduced."
      },
      aiPlaceholders: this.buildBdAiPlaceholders(actor)
    };
  }

  private readHandoffRecord(metadata: Record<string, unknown>): BdHandoffRecord | null {
    const raw = metadata.handoff;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return null;
    }
    const source = raw as Record<string, unknown>;
    const status = source.status === "handed_off" ? "handed_off" : "pending_approval";
    return {
      salesOwnerId: metaString(source, "salesOwnerId"),
      salesOwnerName: metaString(source, "salesOwnerName"),
      recommendedApproach: metaString(source, "recommendedApproach"),
      painPoints: metaString(source, "painPoints"),
      nextMeetingAt: metaString(source, "nextMeetingAt"),
      status,
      requestedAt: metaString(source, "requestedAt") ?? new Date().toISOString(),
      approvalId: metaString(source, "approvalId")
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
          JSON.stringify({
            ...(input.metadata ?? {}),
            ...(input.priorityKey !== undefined ? { priorityKey: getTrimmedNullableString(input.priorityKey) } : {}),
            ...(input.technologies !== undefined
              ? { technologies: input.technologies.map((value) => value.trim()).filter((value) => value.length > 0) }
              : {})
          }),
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

      // Load current metadata so BDR fields stored in JSONB (priority/technologies/sequence/engagement) merge.
      const currentMetadataResult = await client.query<{ metadata: Record<string, unknown> | null }>(
        `SELECT metadata FROM bd_target_accounts WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
        [targetAccountId, actor.tenantId]
      );
      const currentMetadata = getMetadata(currentMetadataResult.rows[0]?.metadata);
      const nextMetadata: Record<string, unknown> = { ...currentMetadata, ...(input.metadata ?? {}) };
      let metadataChanged = keys.includes("metadata");

      if (keys.includes("priorityKey")) {
        nextMetadata.priorityKey = getTrimmedNullableString(input.priorityKey);
        metadataChanged = true;
      }
      if (keys.includes("technologies") && input.technologies) {
        nextMetadata.technologies = input.technologies.map((value) => value.trim()).filter((value) => value.length > 0);
        metadataChanged = true;
      }
      if (keys.includes("engagementSignals") && input.engagementSignals) {
        const currentSignals =
          currentMetadata.engagementSignals && typeof currentMetadata.engagementSignals === "object"
            ? (currentMetadata.engagementSignals as Record<string, unknown>)
            : {};
        nextMetadata.engagementSignals = { ...currentSignals, ...input.engagementSignals };
        metadataChanged = true;
      }
      if (keys.includes("sequence") && input.sequence) {
        const currentSequence =
          currentMetadata.sequence && typeof currentMetadata.sequence === "object"
            ? (currentMetadata.sequence as Record<string, unknown>)
            : {};
        const completedStepKeys = metaStringArray(currentSequence, "completedStepKeys");
        if (input.sequence.completeStepKey && !completedStepKeys.includes(input.sequence.completeStepKey.trim())) {
          completedStepKeys.push(input.sequence.completeStepKey.trim());
        }
        // A logged reply pauses the sequence (BDR-003).
        const paused = input.sequence.logReply ? true : input.sequence.paused ?? currentSequence.paused === true;
        const pauseReason = input.sequence.logReply
          ? getTrimmedNullableString(input.sequence.pauseReason) ?? "Reply received"
          : input.sequence.paused === false
            ? null
            : getTrimmedNullableString(input.sequence.pauseReason) ?? metaString(currentSequence, "pauseReason");
        nextMetadata.sequence = { paused, pauseReason, completedStepKeys };
        metadataChanged = true;
      }

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
      if (metadataChanged) {
        pushAssignment("metadata", JSON.stringify(nextMetadata), "::jsonb");
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

  private async resolveDefaultOptionValueId(client: PoolClient, tenantId: string, setKey: string): Promise<string> {
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
        ORDER BY tenant_option_values.is_default DESC, tenant_option_values.sort_order ASC
        LIMIT 1
      `,
      [tenantId, setKey]
    );
    const id = result.rows[0]?.id;
    if (!id) {
      throw new AppError(400, `No options are configured for ${setKey}.`, undefined, "OPTION_SET_EMPTY");
    }
    return id;
  }

  // BDR-001: bulk import target accounts with duplicate detection.
  async importBdTargetAccounts(
    actor: ActorContext,
    audit: AuditMetadata,
    input: BdImportRequestBody
  ): Promise<BdImportResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      this.assertBdMutation(actor, ["name"]);

      const existing = await client.query<{ name: string }>(
        `SELECT LOWER(name) AS name FROM bd_target_accounts WHERE tenant_id = $1 AND deleted_at IS NULL`,
        [actor.tenantId]
      );
      const seen = new Set(existing.rows.map((row) => row.name));
      const defaultTierId = await this.resolveDefaultOptionValueId(client, actor.tenantId, "bd-account-tier");
      const defaultStageId = await this.resolveDefaultOptionValueId(client, actor.tenantId, "bd-pipeline-stage");

      const skipped: BdImportSkippedEntry[] = [];
      let createdCount = 0;

      for (const entry of input.accounts) {
        const name = entry.name?.trim() ?? "";
        if (name.length === 0) {
          skipped.push({ name: entry.name ?? "", reason: "Missing name" });
          continue;
        }
        if (seen.has(name.toLowerCase())) {
          skipped.push({ name, reason: "Duplicate name" });
          continue;
        }
        seen.add(name.toLowerCase());

        const accountId = await this.ensureAccountId(client, actor.tenantId, entry.accountId ?? null);
        const tierOptionId = entry.tierKey
          ? await this.resolveOptionValueId(client, actor.tenantId, "bd-account-tier", entry.tierKey, "BD account tier")
          : defaultTierId;
        const stageOptionId = entry.stageKey
          ? await this.resolveOptionValueId(client, actor.tenantId, "bd-pipeline-stage", entry.stageKey, "BD pipeline stage")
          : defaultStageId;

        await client.query(
          `
            INSERT INTO bd_target_accounts (
              tenant_id, account_id, owner_id, name, industry, region,
              tier_option_id, stage_option_id, annual_revenue, employee_count, metadata, created_by, updated_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $12)
          `,
          [
            actor.tenantId,
            accountId,
            actor.userId,
            name,
            getTrimmedNullableString(entry.industry),
            getTrimmedNullableString(entry.region),
            tierOptionId,
            stageOptionId,
            entry.annualRevenue ?? null,
            entry.employeeCount ?? null,
            JSON.stringify({
              ...(entry.priorityKey ? { priorityKey: entry.priorityKey.trim() } : {}),
              ...(entry.technologies
                ? { technologies: entry.technologies.map((value) => value.trim()).filter((value) => value.length > 0) }
                : {}),
              importedAt: new Date().toISOString()
            }),
            actor.userId
          ]
        );
        createdCount += 1;
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "bd.target_account.import",
        resourceType: "bd_target_account",
        resourceId: null,
        status: "success",
        metadata: { createdCount, skippedCount: skipped.length }
      });

      const catalog = await this.loadBdComputeCatalog(client, actor.tenantId);
      const listResult = await client.query<BdTargetAccountRow>(
        `
          SELECT ${this.bdSelectColumns()}
          ${this.bdFromClause()}
          WHERE bd_target_accounts.tenant_id = $1 AND bd_target_accounts.deleted_at IS NULL
          ORDER BY bd_target_accounts.created_at DESC
          LIMIT 50
        `,
        [actor.tenantId]
      );

      return {
        createdCount,
        skipped,
        targetAccounts: listResult.rows.map((row) => this.mapBdSummary(row, catalog))
      };
    });
  }

  // BDR-004: convert an engaged target account into an opportunity.
  async convertBdTargetAccount(
    actor: ActorContext,
    audit: AuditMetadata,
    targetAccountId: string,
    input: BdConvertRequestBody
  ): Promise<BdConvertResponse> {
    this.assertEnabled();

    const opportunityId = await this.databaseService.withTransaction(async (client) => {
      this.assertBdMutation(actor, ["name"]);
      const accountResult = await client.query<{
        account_id: string | null;
        owner_id: string | null;
        name: string;
        metadata: Record<string, unknown> | null;
      }>(
        `SELECT account_id, owner_id, name, metadata FROM bd_target_accounts WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
        [targetAccountId, actor.tenantId]
      );
      const targetAccount = accountResult.rows[0];
      if (!targetAccount) {
        throw new AppError(404, "Target account not found.", undefined, "TARGET_ACCOUNT_NOT_FOUND");
      }
      if (!targetAccount.account_id) {
        throw new AppError(400, "Link a CRM account to this target before converting.", undefined, "BD_ACCOUNT_REQUIRED");
      }

      const ownerId = await this.ensureOwnerId(client, actor.tenantId, input.ownerId ?? targetAccount.owner_id ?? actor.userId);
      const stageOptionId = await this.resolveOptionValueId(
        client,
        actor.tenantId,
        "opportunity-pipeline",
        input.stageKey,
        "Opportunity stage"
      );
      // BDM-004: strategic opportunities are attributed to business development by default.
      const sourceOptionId = input.sourceKey
        ? await this.resolveOptionValueId(client, actor.tenantId, "opportunity-source", input.sourceKey, "Opportunity source")
        : await this.resolveOptionValueId(client, actor.tenantId, "opportunity-source", "business_development", "Opportunity source");
      const outcomeStatusOptionId = await this.resolveOptionValueId(
        client,
        actor.tenantId,
        "opportunity-outcome-status",
        "open",
        "Opportunity outcome status"
      );

      const opportunityResult = await client.query<{ id: string }>(
        `
          INSERT INTO opportunities (
            tenant_id, account_id, primary_contact_id, owner_id, name, stage_option_id, source_option_id,
            outcome_status_option_id, amount, probability, expected_close_date, competitor, next_step,
            win_loss_reason, custom_fields, metadata, created_by, updated_by
          )
          VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, NULL, $9::date, NULL, $10, NULL, '{}'::jsonb, $11::jsonb, $12, $12)
          RETURNING id
        `,
        [
          actor.tenantId,
          targetAccount.account_id,
          ownerId,
          getTrimmedNullableString(input.opportunityName) ?? `${targetAccount.name.trim()} Opportunity`,
          stageOptionId,
          sourceOptionId,
          outcomeStatusOptionId,
          input.amount,
          getTrimmedNullableString(input.expectedCloseDate),
          getTrimmedNullableString(input.nextStep),
          JSON.stringify({
            convertedFromBdTargetAccountId: targetAccountId,
            ...(getTrimmedNullableString(input.useCase) ? { useCase: getTrimmedNullableString(input.useCase) } : {}),
            ...(getTrimmedNullableString(input.product) ? { product: getTrimmedNullableString(input.product) } : {}),
            ...(getTrimmedNullableString(input.priorityKey) ? { priorityKey: getTrimmedNullableString(input.priorityKey) } : {})
          }),
          actor.userId
        ]
      );
      const nextOpportunityId = opportunityResult.rows[0]?.id;
      if (!nextOpportunityId) {
        throw new AppError(500, "Opportunity creation failed.", undefined, "OPPORTUNITY_CREATE_FAILED");
      }

      const nextMetadata = {
        ...getMetadata(targetAccount.metadata),
        convertedOpportunityId: nextOpportunityId,
        convertedAt: new Date().toISOString()
      };
      await client.query(
        `UPDATE bd_target_accounts SET metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [targetAccountId, actor.tenantId, JSON.stringify(nextMetadata), actor.userId]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "bd.target_account.convert",
        resourceType: "bd_target_account",
        resourceId: targetAccountId,
        status: "success",
        metadata: { opportunityId: nextOpportunityId }
      });

      return nextOpportunityId;
    });

    const detail = await this.databaseService.withClient(async (client) => this.loadBdDetail(client, actor, targetAccountId));
    return { opportunityId, targetAccount: detail };
  }

  // BDR-005: strategic account handoff to enterprise sales (notification + optional manager approval).
  async handoffBdTargetAccount(
    actor: ActorContext,
    audit: AuditMetadata,
    targetAccountId: string,
    input: BdHandoffRequestBody
  ): Promise<BdHandoffResponse> {
    this.assertEnabled();

    const result = await this.databaseService.withTransaction(async (client) => {
      this.assertBdMutation(actor, ["name"]);
      const accountResult = await client.query<{ name: string; metadata: Record<string, unknown> | null }>(
        `SELECT name, metadata FROM bd_target_accounts WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
        [targetAccountId, actor.tenantId]
      );
      const targetAccount = accountResult.rows[0];
      if (!targetAccount) {
        throw new AppError(404, "Target account not found.", undefined, "TARGET_ACCOUNT_NOT_FOUND");
      }

      const salesOwnerId = await this.ensureOwnerId(client, actor.tenantId, input.salesOwnerId);
      if (!salesOwnerId) {
        throw new AppError(400, "A sales owner is required for handoff.", undefined, "VALIDATION_ERROR");
      }
      const recommendedApproach = getTrimmedNullableString(input.recommendedApproach);
      if (!recommendedApproach) {
        throw new AppError(400, "A recommended approach is required for handoff.", undefined, "VALIDATION_ERROR");
      }
      const requireApproval = Boolean(input.requireApproval);
      const linkedRecord = { entityType: "bd_target_account", entityId: targetAccountId };

      // Notify the receiving sales owner (BDR-005).
      const notification = await this.notificationService.createNotificationWithClient(client, actor, audit, {
        notificationType: "record_assignment",
        recipientUserId: salesOwnerId,
        title: `Strategic account handoff: ${targetAccount.name}`,
        message: recommendedApproach,
        linkedRecord,
        metadata: { painPoints: getTrimmedNullableString(input.painPoints), nextMeetingAt: input.nextMeetingAt ?? null }
      });

      let approvalId: string | null = null;
      if (requireApproval) {
        const approverUserId = await this.ensureOwnerId(client, actor.tenantId, input.approverUserId ?? null);
        if (!approverUserId) {
          throw new AppError(400, "A manager approver is required when approval is requested.", undefined, "VALIDATION_ERROR");
        }
        const approval = await this.approvalService.createApprovalWithClient(client, actor, audit, {
          approvalType: "strategic_handoff_approval",
          title: `Reassign strategic account: ${targetAccount.name}`,
          description: recommendedApproach,
          approverUserId,
          linkedRecord,
          metadata: { salesOwnerId }
        });
        approvalId = approval.id;
      }

      const handoffRecord: BdHandoffRecord = {
        salesOwnerId,
        salesOwnerName: null,
        recommendedApproach,
        painPoints: getTrimmedNullableString(input.painPoints),
        nextMeetingAt: input.nextMeetingAt ?? null,
        status: requireApproval ? "pending_approval" : "handed_off",
        requestedAt: new Date().toISOString(),
        approvalId
      };
      const nextMetadata = { ...getMetadata(targetAccount.metadata), handoff: handoffRecord };

      // Without approval the reassignment takes effect immediately; otherwise it waits for approval.
      if (requireApproval) {
        await client.query(
          `UPDATE bd_target_accounts SET metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          [targetAccountId, actor.tenantId, JSON.stringify(nextMetadata), actor.userId]
        );
      } else {
        await client.query(
          `UPDATE bd_target_accounts SET owner_id = $3, metadata = $4::jsonb, updated_by = $5 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          [targetAccountId, actor.tenantId, salesOwnerId, JSON.stringify(nextMetadata), actor.userId]
        );
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "bd.target_account.handoff",
        resourceType: "bd_target_account",
        resourceId: targetAccountId,
        status: "success",
        metadata: { salesOwnerId, requireApproval, approvalId }
      });

      return { notificationId: notification.id, approvalId };
    });

    const detail = await this.databaseService.withClient(async (client) => this.loadBdDetail(client, actor, targetAccountId));
    return { targetAccount: detail, notificationId: result.notificationId, approvalId: result.approvalId };
  }

  // ==========================================================================
  // Persona 11 (BDM): territory plans, market intelligence, partner referrals
  // ==========================================================================

  private mapTerritoryPlan(row: BdTerritoryPlanRow): BdTerritoryPlanSummary {
    return {
      id: row.id,
      name: row.name,
      owner: mapUser({ id: row.owner_id, displayName: row.owner_display_name, email: row.owner_email, teamName: null, departmentName: null }),
      geography: row.geography,
      targetSegments: row.target_segments,
      namedAccounts: row.named_accounts,
      partnerCoverage: row.partner_coverage,
      campaigns: row.campaigns,
      pipelineTarget: parseNumeric(row.pipeline_target),
      revenueTarget: parseNumeric(row.revenue_target),
      reviewStatus: (["draft", "in_review", "reviewed"].includes(row.review_status) ? row.review_status : "draft") as BdTerritoryPlanSummary["reviewStatus"],
      reviewer: mapUser({ id: row.reviewer_id, displayName: row.reviewer_display_name, email: row.reviewer_email, teamName: null, departmentName: null }),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private territoryPlanSelect() {
    return `
      bd_territory_plans.id, bd_territory_plans.name, bd_territory_plans.geography, bd_territory_plans.target_segments,
      bd_territory_plans.named_accounts, bd_territory_plans.partner_coverage, bd_territory_plans.campaigns,
      bd_territory_plans.pipeline_target, bd_territory_plans.revenue_target, bd_territory_plans.review_status,
      bd_territory_plans.created_at, bd_territory_plans.updated_at,
      owner_users.id AS owner_id, owner_users.display_name AS owner_display_name, owner_users.email AS owner_email,
      reviewer_users.id AS reviewer_id, reviewer_users.display_name AS reviewer_display_name, reviewer_users.email AS reviewer_email
      FROM bd_territory_plans
      LEFT JOIN users AS owner_users ON owner_users.id = bd_territory_plans.owner_id AND owner_users.tenant_id = bd_territory_plans.tenant_id AND owner_users.deleted_at IS NULL
      LEFT JOIN users AS reviewer_users ON reviewer_users.id = bd_territory_plans.reviewer_id AND reviewer_users.tenant_id = bd_territory_plans.tenant_id AND reviewer_users.deleted_at IS NULL
    `;
  }

  async listTerritoryPlans(actor: ActorContext): Promise<BdTerritoryPlansResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const result = await client.query<BdTerritoryPlanRow>(
        `SELECT ${this.territoryPlanSelect()} WHERE bd_territory_plans.tenant_id = $1 AND bd_territory_plans.deleted_at IS NULL ORDER BY bd_territory_plans.created_at DESC LIMIT 200`,
        [actor.tenantId]
      );
      return { territoryPlans: result.rows.map((row) => this.mapTerritoryPlan(row)) };
    });
  }

  async createTerritoryPlan(actor: ActorContext, audit: AuditMetadata, input: CreateBdTerritoryPlanRequestBody): Promise<BdTerritoryPlanResponse> {
    this.assertEnabled();
    const planId = await this.databaseService.withTransaction(async (client) => {
      this.assertBdMutation(actor, ["name"]);
      const ownerId = await this.ensureOwnerId(client, actor.tenantId, input.ownerId ?? actor.userId);
      const result = await client.query<{ id: string }>(
        `
          INSERT INTO bd_territory_plans (tenant_id, owner_id, name, geography, target_segments, named_accounts, partner_coverage, campaigns, pipeline_target, revenue_target, created_by, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11) RETURNING id
        `,
        [
          actor.tenantId,
          ownerId,
          input.name.trim(),
          getTrimmedNullableString(input.geography),
          getTrimmedNullableString(input.targetSegments),
          getTrimmedNullableString(input.namedAccounts),
          getTrimmedNullableString(input.partnerCoverage),
          getTrimmedNullableString(input.campaigns),
          input.pipelineTarget ?? null,
          input.revenueTarget ?? null,
          actor.userId
        ]
      );
      const id = result.rows[0]?.id;
      if (!id) {
        throw new AppError(500, "Territory plan creation failed.", undefined, "TERRITORY_PLAN_CREATE_FAILED");
      }
      await this.recordAuditLog(client, actor, audit, { action: "bd.territory_plan.create", resourceType: "bd_territory_plan", resourceId: id, status: "success" });
      return id;
    });
    return this.databaseService.withClient(async (client) => {
      const result = await client.query<BdTerritoryPlanRow>(`SELECT ${this.territoryPlanSelect()} WHERE bd_territory_plans.id = $1 AND bd_territory_plans.tenant_id = $2 LIMIT 1`, [planId, actor.tenantId]);
      return { territoryPlan: this.mapTerritoryPlan(result.rows[0]) };
    });
  }

  async submitTerritoryPlanReview(actor: ActorContext, audit: AuditMetadata, planId: string, input: SubmitBdTerritoryPlanReviewRequestBody): Promise<BdTerritoryPlanResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertBdMutation(actor, ["name"]);
      const existing = await client.query<{ name: string }>(`SELECT name FROM bd_territory_plans WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [planId, actor.tenantId]);
      if (!existing.rows[0]) {
        throw new AppError(404, "Territory plan not found.", undefined, "TERRITORY_PLAN_NOT_FOUND");
      }
      const reviewerUserId = await this.ensureOwnerId(client, actor.tenantId, input.reviewerUserId);
      if (!reviewerUserId) {
        throw new AppError(400, "A reviewer is required.", undefined, "VALIDATION_ERROR");
      }
      await client.query(
        `UPDATE bd_territory_plans SET review_status = 'in_review', reviewer_id = $3, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [planId, actor.tenantId, reviewerUserId, actor.userId]
      );
      await this.notificationService.createNotificationWithClient(client, actor, audit, {
        notificationType: "record_assignment",
        recipientUserId: reviewerUserId,
        title: `Territory plan review: ${existing.rows[0].name}`,
        message: getTrimmedNullableString(input.note) ?? "Territory plan submitted for your review.",
        linkedRecord: { entityType: "bd_territory_plan", entityId: planId }
      });
      await this.recordAuditLog(client, actor, audit, { action: "bd.territory_plan.review", resourceType: "bd_territory_plan", resourceId: planId, status: "success", metadata: { reviewerUserId } });
    });
    return this.databaseService.withClient(async (client) => {
      const result = await client.query<BdTerritoryPlanRow>(`SELECT ${this.territoryPlanSelect()} WHERE bd_territory_plans.id = $1 AND bd_territory_plans.tenant_id = $2 LIMIT 1`, [planId, actor.tenantId]);
      return { territoryPlan: this.mapTerritoryPlan(result.rows[0]) };
    });
  }

  async listMarketSignals(actor: ActorContext): Promise<BdMarketSignalsResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const result = await client.query<BdMarketSignalRow>(
        `
          SELECT bd_market_signals.id, bd_market_signals.signal_type, bd_market_signals.content,
            bd_market_signals.linked_entity_type, bd_market_signals.linked_entity_id, bd_market_signals.created_at,
            owner_users.id AS owner_id, owner_users.display_name AS owner_display_name, owner_users.email AS owner_email,
            sv.id AS type_id, sv.value_key AS type_key, sv.label AS type_label, sv.description AS type_description, sv.color AS type_color, sv.is_default AS type_is_default, sv.is_active AS type_is_active
          FROM bd_market_signals
          LEFT JOIN users AS owner_users ON owner_users.id = bd_market_signals.owner_id AND owner_users.tenant_id = bd_market_signals.tenant_id AND owner_users.deleted_at IS NULL
          LEFT JOIN tenant_option_sets os ON os.tenant_id = bd_market_signals.tenant_id AND os.set_key = 'bd-market-signal-type' AND os.deleted_at IS NULL
          LEFT JOIN tenant_option_values sv ON sv.option_set_id = os.id AND sv.tenant_id = os.tenant_id AND sv.value_key = bd_market_signals.signal_type AND sv.deleted_at IS NULL
          WHERE bd_market_signals.tenant_id = $1 AND bd_market_signals.deleted_at IS NULL
          ORDER BY bd_market_signals.created_at DESC LIMIT 200
        `,
        [actor.tenantId]
      );
      return {
        marketSignals: result.rows.map((row) => ({
          id: row.id,
          signalType: mapOptionValue({ id: row.type_id, key: row.type_key, label: row.type_label, description: row.type_description, color: row.type_color, isDefault: row.type_is_default, isActive: row.type_is_active }),
          content: row.content,
          linkedEntityType: (row.linked_entity_type as BdMarketSignalSummary["linkedEntityType"]) ?? null,
          linkedEntityId: row.linked_entity_id,
          owner: mapUser({ id: row.owner_id, displayName: row.owner_display_name, email: row.owner_email, teamName: null, departmentName: null }),
          createdAt: row.created_at.toISOString()
        }))
      };
    });
  }

  async createMarketSignal(actor: ActorContext, audit: AuditMetadata, input: CreateBdMarketSignalRequestBody): Promise<BdMarketSignalResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertBdMutation(actor, ["content"]);
      await this.resolveOptionValueId(client, actor.tenantId, "bd-market-signal-type", input.signalTypeKey, "Market signal type");
      const content = getTrimmedNullableString(input.content);
      if (!content) {
        throw new AppError(400, "Market signal content is required.", undefined, "VALIDATION_ERROR");
      }
      const linkedType = input.linkedEntityType && ["account", "opportunity", "campaign"].includes(input.linkedEntityType) ? input.linkedEntityType : null;
      await client.query(
        `INSERT INTO bd_market_signals (tenant_id, owner_id, signal_type, content, linked_entity_type, linked_entity_id, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
        [actor.tenantId, actor.userId, input.signalTypeKey.trim(), content, linkedType, linkedType ? input.linkedEntityId ?? null : null, actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "bd.market_signal.create", resourceType: "bd_market_signal", resourceId: null, status: "success", metadata: { signalTypeKey: input.signalTypeKey } });
    });
    const response = await this.listMarketSignals(actor);
    return { marketSignal: response.marketSignals[0] };
  }

  private mapPartnerReferral(row: BdPartnerReferralRow): BdPartnerReferralSummary {
    return {
      id: row.id,
      partnerAccount: row.account_id ? { id: row.account_id, name: row.account_name ?? "", website: row.account_website } : null,
      referralSource: row.referral_source,
      customerName: row.customer_name,
      opportunity: row.opportunity_id ? { id: row.opportunity_id, name: row.opportunity_name ?? "", stage: null } : null,
      referredValue: parseNumeric(row.referred_value),
      converted: row.converted,
      commissionEligible: row.commission_eligible,
      notes: row.notes,
      owner: mapUser({ id: row.owner_id, displayName: row.owner_display_name, email: row.owner_email, teamName: null, departmentName: null }),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private partnerReferralSelect() {
    return `
      bd_partner_referrals.id, bd_partner_referrals.referral_source, bd_partner_referrals.customer_name,
      bd_partner_referrals.referred_value, bd_partner_referrals.converted, bd_partner_referrals.commission_eligible,
      bd_partner_referrals.notes, bd_partner_referrals.created_at, bd_partner_referrals.updated_at,
      bd_partner_referrals.partner_account_id AS account_id, accounts.name AS account_name, accounts.website AS account_website,
      bd_partner_referrals.opportunity_id, opportunities.name AS opportunity_name,
      owner_users.id AS owner_id, owner_users.display_name AS owner_display_name, owner_users.email AS owner_email
      FROM bd_partner_referrals
      LEFT JOIN accounts ON accounts.id = bd_partner_referrals.partner_account_id AND accounts.tenant_id = bd_partner_referrals.tenant_id AND accounts.deleted_at IS NULL
      LEFT JOIN opportunities ON opportunities.id = bd_partner_referrals.opportunity_id AND opportunities.tenant_id = bd_partner_referrals.tenant_id AND opportunities.deleted_at IS NULL
      LEFT JOIN users AS owner_users ON owner_users.id = bd_partner_referrals.owner_id AND owner_users.tenant_id = bd_partner_referrals.tenant_id AND owner_users.deleted_at IS NULL
    `;
  }

  async listPartnerReferrals(actor: ActorContext): Promise<BdPartnerReferralsResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const result = await client.query<BdPartnerReferralRow>(
        `SELECT ${this.partnerReferralSelect()} WHERE bd_partner_referrals.tenant_id = $1 AND bd_partner_referrals.deleted_at IS NULL ORDER BY bd_partner_referrals.created_at DESC LIMIT 200`,
        [actor.tenantId]
      );
      return { referrals: result.rows.map((row) => this.mapPartnerReferral(row)) };
    });
  }

  async createPartnerReferral(actor: ActorContext, audit: AuditMetadata, input: CreateBdPartnerReferralRequestBody): Promise<BdPartnerReferralResponse> {
    this.assertEnabled();
    const referralId = await this.databaseService.withTransaction(async (client) => {
      this.assertBdMutation(actor, ["customerName"]);
      const customerName = getTrimmedNullableString(input.customerName);
      if (!customerName) {
        throw new AppError(400, "A customer name is required for the referral.", undefined, "VALIDATION_ERROR");
      }
      const partnerAccountId = await this.ensureAccountId(client, actor.tenantId, input.partnerAccountId ?? null);
      const result = await client.query<{ id: string }>(
        `INSERT INTO bd_partner_referrals (tenant_id, owner_id, partner_account_id, referral_source, customer_name, referred_value, notes, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8) RETURNING id`,
        [actor.tenantId, actor.userId, partnerAccountId, getTrimmedNullableString(input.referralSource), customerName, input.referredValue ?? null, getTrimmedNullableString(input.notes), actor.userId]
      );
      const id = result.rows[0]?.id;
      if (!id) {
        throw new AppError(500, "Referral creation failed.", undefined, "REFERRAL_CREATE_FAILED");
      }
      await this.recordAuditLog(client, actor, audit, { action: "bd.partner_referral.create", resourceType: "bd_partner_referral", resourceId: id, status: "success" });
      return id;
    });
    return this.databaseService.withClient(async (client) => {
      const result = await client.query<BdPartnerReferralRow>(`SELECT ${this.partnerReferralSelect()} WHERE bd_partner_referrals.id = $1 AND bd_partner_referrals.tenant_id = $2 LIMIT 1`, [referralId, actor.tenantId]);
      return { referral: this.mapPartnerReferral(result.rows[0]) };
    });
  }

  async updatePartnerReferral(actor: ActorContext, audit: AuditMetadata, referralId: string, input: UpdateBdPartnerReferralRequestBody): Promise<BdPartnerReferralResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertBdMutation(actor, ["customerName"]);
      const existing = await client.query<{ id: string }>(`SELECT id FROM bd_partner_referrals WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [referralId, actor.tenantId]);
      if (!existing.rows[0]) {
        throw new AppError(404, "Referral not found.", undefined, "REFERRAL_NOT_FOUND");
      }
      const assignments: string[] = [];
      const params: unknown[] = [referralId, actor.tenantId, actor.userId];
      const push = (column: string, value: unknown) => {
        params.push(value);
        assignments.push(`${column} = $${params.length}`);
      };
      if (input.converted !== undefined) push("converted", Boolean(input.converted));
      if (input.commissionEligible !== undefined) push("commission_eligible", Boolean(input.commissionEligible));
      if (input.referredValue !== undefined) push("referred_value", input.referredValue ?? null);
      if (input.notes !== undefined) push("notes", getTrimmedNullableString(input.notes));
      if (input.opportunityId !== undefined) {
        push("opportunity_id", await this.ensureOpportunityId(client, actor.tenantId, input.opportunityId ?? null));
      }
      if (assignments.length > 0) {
        await client.query(`UPDATE bd_partner_referrals SET ${assignments.join(", ")}, updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, params);
      }
      await this.recordAuditLog(client, actor, audit, { action: "bd.partner_referral.update", resourceType: "bd_partner_referral", resourceId: referralId, status: "success" });
    });
    return this.databaseService.withClient(async (client) => {
      const result = await client.query<BdPartnerReferralRow>(`SELECT ${this.partnerReferralSelect()} WHERE bd_partner_referrals.id = $1 AND bd_partner_referrals.tenant_id = $2 LIMIT 1`, [referralId, actor.tenantId]);
      return { referral: this.mapPartnerReferral(result.rows[0]) };
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
      product: typeof getMetadata(row.metadata).product === "string" ? (getMetadata(row.metadata).product as string) : null,
      triageStatus: this.readPresalesTriage(row.metadata)?.status ?? null,
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
      metadata: Record<string, unknown> | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `
        SELECT id, label, category, requirement, response, compliance_status, priority, sort_order, metadata, created_at, updated_at
        FROM presales_requirements
        WHERE tenant_id = $1 AND request_id = $2 AND deleted_at IS NULL
        ORDER BY sort_order ASC, created_at ASC
      `,
      [tenantId, requestId]
    );

    return result.rows.map((row) => {
      const meta = getMetadata(row.metadata);
      return {
        id: row.id,
        label: row.label,
        category: normalizeRequirementCategory(row.category),
        requirement: row.requirement,
        response: row.response,
        complianceStatus: normalizeComplianceStatus(row.compliance_status),
        priority: normalizePriority(row.priority),
        sortOrder: row.sort_order,
        customization: typeof meta.customization === "string" ? meta.customization : null,
        integration: typeof meta.integration === "string" ? meta.integration : null,
        dependency: typeof meta.dependency === "string" ? meta.dependency : null,
        risk: typeof meta.risk === "string" ? meta.risk : null,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString()
      };
    });
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

      const requirementMetadata = {
        customization: getTrimmedNullableString(requirement.customization),
        integration: getTrimmedNullableString(requirement.integration),
        dependency: getTrimmedNullableString(requirement.dependency),
        risk: getTrimmedNullableString(requirement.risk)
      };

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
            metadata,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $11)
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
          JSON.stringify(requirementMetadata),
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
      demoChecklistItems: await this.loadOptionSetValues(client, actor.tenantId, "presales-demo-checklist"),
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

    const metadata = getMetadata(row.metadata);

    return {
      ...this.mapPresalesSummary(row),
      technicalRequirements: row.technical_requirements,
      proposalContent: row.proposal_content,
      triage: this.readPresalesTriage(row.metadata),
      demoWorkspace: this.readPresalesDemoWorkspace(metadata),
      demoFeedback: this.readPresalesDemoFeedback(metadata),
      fitmentReview: this.readPresalesFitmentReview(metadata),
      poc: this.readPresalesPoc(metadata),
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

  // ---- Persona 14 (Presales Consultant) delivery -----------------------------------------------

  private mapStoredUser(value: unknown): CrmLookupUserSummary | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const record = value as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : null;
    if (!id) {
      return null;
    }
    return {
      id,
      displayName: typeof record.displayName === "string" ? record.displayName : "",
      email: typeof record.email === "string" ? record.email : "",
      teamName: null,
      departmentName: null
    };
  }

  private readPresalesTriage(metadata: Record<string, unknown> | null | undefined): PresalesTriageState | null {
    const triage = getMetadata(getMetadata(metadata).triage as Record<string, unknown> | undefined);
    const status = triage.status;
    if (status !== "accepted" && status !== "rejected" && status !== "info_requested") {
      return null;
    }
    return {
      status,
      note: typeof triage.note === "string" ? triage.note : null,
      decidedBy: this.mapStoredUser(triage.decidedBy),
      decidedAt: typeof triage.decidedAt === "string" ? triage.decidedAt : new Date(0).toISOString()
    };
  }

  private readPresalesDemoWorkspace(metadata: Record<string, unknown>): PresalesDemoWorkspace | null {
    const raw = metadata.demoWorkspace;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return null;
    }
    const ws = raw as Record<string, unknown>;
    const str = (key: string) => (typeof ws[key] === "string" ? (ws[key] as string) : null);
    return {
      painPoints: str("painPoints"),
      useCases: str("useCases"),
      audience: str("audience"),
      modules: str("modules"),
      competitors: str("competitors"),
      objections: str("objections"),
      expectedOutcome: str("expectedOutcome"),
      demoFlowNotes: str("demoFlowNotes"),
      checklist: Array.isArray(ws.checklist) ? ws.checklist.filter((item): item is string => typeof item === "string") : [],
      updatedAt: str("updatedAt")
    };
  }

  private readPresalesDemoFeedback(metadata: Record<string, unknown>): PresalesDemoFeedback | null {
    const raw = metadata.demoFeedback;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return null;
    }
    const fb = raw as Record<string, unknown>;
    const str = (key: string) => (typeof fb[key] === "string" ? (fb[key] as string) : null);
    return {
      attendees: str("attendees"),
      modulesShown: str("modulesShown"),
      questions: str("questions"),
      objections: str("objections"),
      positiveSignals: str("positiveSignals"),
      gaps: str("gaps"),
      nextSteps: str("nextSteps"),
      capturedBy: this.mapStoredUser(fb.capturedBy),
      capturedAt: str("capturedAt")
    };
  }

  private readPresalesFitmentReview(metadata: Record<string, unknown>): PresalesFitmentReview | null {
    const raw = metadata.fitmentReview;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return null;
    }
    const review = raw as Record<string, unknown>;
    return {
      reviewer: this.mapStoredUser(review.reviewer),
      note: typeof review.note === "string" ? review.note : null,
      requestedBy: this.mapStoredUser(review.requestedBy),
      requestedAt: typeof review.requestedAt === "string" ? review.requestedAt : new Date(0).toISOString()
    };
  }

  private readPresalesPoc(metadata: Record<string, unknown>): PresalesPocPlan | null {
    const raw = metadata.poc;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return null;
    }
    const poc = raw as Record<string, unknown>;
    const str = (key: string) => (typeof poc[key] === "string" ? (poc[key] as string) : null);
    const signOffRaw = poc.signOff;
    let signOff: PresalesPocPlan["signOff"] = null;
    if (signOffRaw && typeof signOffRaw === "object" && !Array.isArray(signOffRaw)) {
      const so = signOffRaw as Record<string, unknown>;
      if (so.outcome === "success" || so.outcome === "fail") {
        signOff = {
          outcome: so.outcome,
          customerFeedback: typeof so.customerFeedback === "string" ? so.customerFeedback : null,
          signedOffBy: this.mapStoredUser(so.signedOffBy),
          signedOffAt: typeof so.signedOffAt === "string" ? so.signedOffAt : new Date(0).toISOString()
        };
      }
    }
    return {
      objective: str("objective"),
      scope: str("scope"),
      successCriteria: str("successCriteria"),
      timeline: str("timeline"),
      responsibilities: str("responsibilities"),
      demoData: str("demoData"),
      signOff,
      updatedAt: str("updatedAt")
    };
  }

  private async loadPresalesFull(client: PoolClient, tenantId: string, requestId: string) {
    const result = await client.query<{ id: string; owner_id: string | null; assignee_id: string | null; opportunity_id: string | null; account_id: string | null; metadata: Record<string, unknown> | null }>(
      `SELECT id, owner_id, assignee_id, opportunity_id, account_id, metadata FROM presales_requests WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [requestId, tenantId]
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, "Presales request not found.", undefined, "PRESALES_REQUEST_NOT_FOUND");
    }
    return row;
  }

  private async writePresalesMetadata(client: PoolClient, actor: ActorContext, requestId: string, metadata: Record<string, unknown>) {
    await client.query(
      `UPDATE presales_requests SET metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [requestId, actor.tenantId, JSON.stringify(metadata), actor.userId]
    );
  }

  // PS-001: accept / reject / request more information.
  async triagePresalesRequest(actor: ActorContext, audit: AuditMetadata, requestId: string, input: PresalesTriageRequestBody): Promise<PresalesRequestResponse> {
    this.assertEnabled();
    if (input.action !== "accepted" && input.action !== "rejected" && input.action !== "info_requested") {
      throw new AppError(400, "Invalid triage action.", undefined, "VALIDATION_ERROR");
    }
    await this.databaseService.withTransaction(async (client) => {
      this.assertPresalesMutation(actor, ["triage"]);
      const row = await this.loadPresalesFull(client, actor.tenantId, requestId);
      const metadata = getMetadata(row.metadata);
      const triage = { status: input.action, note: getTrimmedNullableString(input.note), decidedBy: { id: actor.userId, displayName: actor.displayName, email: actor.email }, decidedAt: new Date().toISOString() };
      await this.writePresalesMetadata(client, actor, requestId, { ...metadata, triage });
      if (row.owner_id && row.owner_id !== actor.userId) {
        await this.notificationService.createNotificationWithClient(client, actor, audit, {
          notificationType: "record_assignment",
          recipientUserId: row.owner_id,
          title: `Presales request ${input.action === "info_requested" ? "needs more info" : input.action}`,
          message: triage.note ?? `Presales has marked this request as ${input.action}.`,
          ...(row.opportunity_id ? { linkedRecord: { entityType: "opportunity", entityId: row.opportunity_id } } : {})
        });
      }
      await this.recordAuditLog(client, actor, audit, { action: "presales.request.triage", resourceType: "presales_request", resourceId: requestId, status: "success", metadata: { action: input.action } });
    });
    return this.getPresalesRequest(actor, requestId);
  }

  // PS-002: tailored demo workspace.
  async upsertPresalesDemoWorkspace(actor: ActorContext, audit: AuditMetadata, requestId: string, input: PresalesDemoWorkspaceRequestBody): Promise<PresalesRequestResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertPresalesMutation(actor, ["demoWorkspace"]);
      const row = await this.loadPresalesFull(client, actor.tenantId, requestId);
      const metadata = getMetadata(row.metadata);
      const current = this.readPresalesDemoWorkspace(metadata);
      const pick = (next: string | null | undefined, prev: string | null) => (next !== undefined ? getTrimmedNullableString(next) : prev);
      const workspace = {
        painPoints: pick(input.painPoints, current?.painPoints ?? null),
        useCases: pick(input.useCases, current?.useCases ?? null),
        audience: pick(input.audience, current?.audience ?? null),
        modules: pick(input.modules, current?.modules ?? null),
        competitors: pick(input.competitors, current?.competitors ?? null),
        objections: pick(input.objections, current?.objections ?? null),
        expectedOutcome: pick(input.expectedOutcome, current?.expectedOutcome ?? null),
        demoFlowNotes: pick(input.demoFlowNotes, current?.demoFlowNotes ?? null),
        checklist: Array.isArray(input.checklist) ? input.checklist.filter((item) => typeof item === "string") : current?.checklist ?? [],
        updatedAt: new Date().toISOString()
      };
      await this.writePresalesMetadata(client, actor, requestId, { ...metadata, demoWorkspace: workspace });
      await this.recordAuditLog(client, actor, audit, { action: "presales.demo_workspace.upsert", resourceType: "presales_request", resourceId: requestId, status: "success" });
    });
    return this.getPresalesRequest(actor, requestId);
  }

  // PS-003: demo feedback + optional opportunity stage update.
  async capturePresalesDemoFeedback(actor: ActorContext, audit: AuditMetadata, requestId: string, input: PresalesDemoFeedbackRequestBody): Promise<PresalesRequestResponse> {
    this.assertEnabled();
    const stageKey = getTrimmedNullableString(input.opportunityStageKey);
    let opportunityId: string | null = null;
    await this.databaseService.withTransaction(async (client) => {
      this.assertPresalesMutation(actor, ["demoFeedback"]);
      const row = await this.loadPresalesFull(client, actor.tenantId, requestId);
      opportunityId = row.opportunity_id;
      const metadata = getMetadata(row.metadata);
      const feedback = {
        attendees: getTrimmedNullableString(input.attendees),
        modulesShown: getTrimmedNullableString(input.modulesShown),
        questions: getTrimmedNullableString(input.questions),
        objections: getTrimmedNullableString(input.objections),
        positiveSignals: getTrimmedNullableString(input.positiveSignals),
        gaps: getTrimmedNullableString(input.gaps),
        nextSteps: getTrimmedNullableString(input.nextSteps),
        capturedBy: { id: actor.userId, displayName: actor.displayName, email: actor.email },
        capturedAt: new Date().toISOString()
      };
      await this.writePresalesMetadata(client, actor, requestId, { ...metadata, demoFeedback: feedback });
      await this.recordAuditLog(client, actor, audit, { action: "presales.demo_feedback.capture", resourceType: "presales_request", resourceId: requestId, status: "success" });
    });
    if (stageKey && opportunityId) {
      await this.opportunityService.updateOpportunity(actor, audit, opportunityId, { stageKey });
    }
    return this.getPresalesRequest(actor, requestId);
  }

  // PS-004: turn a gap requirement into a task / change request.
  async createPresalesGapTask(actor: ActorContext, audit: AuditMetadata, requestId: string, input: PresalesGapTaskRequestBody): Promise<PresalesRequestResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertPresalesMutation(actor, ["fitment"]);
      const row = await this.loadPresalesFull(client, actor.tenantId, requestId);
      const requirement = await client.query<{ id: string; label: string; compliance_status: string }>(
        `SELECT id, label, compliance_status FROM presales_requirements WHERE id = $1 AND request_id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
        [input.requirementId, requestId, actor.tenantId]
      );
      if (requirement.rowCount === 0) {
        throw new AppError(404, "Requirement not found for this presales request.", undefined, "NOT_FOUND");
      }
      const entityType = row.opportunity_id ? "opportunity" : row.account_id ? "account" : null;
      const entityId = row.opportunity_id ?? row.account_id;
      if (!entityType || !entityId) {
        throw new AppError(409, "Link an opportunity or account before creating a gap task.", undefined, "INVALID_STATE");
      }
      const assigneeId = (await this.ensureOwnerId(client, actor.tenantId, input.assigneeId)) ?? row.assignee_id ?? row.owner_id;
      const asChangeRequest = Boolean(input.asChangeRequest);
      await client.query(
        `
          INSERT INTO crm_tasks (tenant_id, entity_type, entity_id, owner_user_id, assignee_user_id, title, description, due_at, priority, status, metadata, created_by, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'high', 'open', $9::jsonb, $4, $4)
        `,
        [
          actor.tenantId,
          entityType,
          entityId,
          actor.userId,
          assigneeId,
          `${asChangeRequest ? "Change request" : "Resolve gap"}: ${requirement.rows[0].label}`,
          `Raised from presales solution fitment for requirement "${requirement.rows[0].label}".`,
          input.dueAt ? new Date(input.dueAt) : null,
          JSON.stringify({ presalesRequestId: requestId, requirementId: input.requirementId, changeRequest: asChangeRequest })
        ]
      );
      if (assigneeId) {
        await this.notificationService.createNotificationWithClient(client, actor, audit, {
          notificationType: "record_assignment",
          recipientUserId: assigneeId,
          title: asChangeRequest ? "Change request assigned" : "Solution gap task assigned",
          message: `${requirement.rows[0].label}`,
          linkedRecord: { entityType, entityId }
        });
      }
      await this.recordAuditLog(client, actor, audit, { action: "presales.fitment.gap_task", resourceType: "presales_request", resourceId: requestId, status: "success", metadata: { requirementId: input.requirementId, changeRequest: asChangeRequest } });
    });
    return this.getPresalesRequest(actor, requestId);
  }

  // PS-004: request sales/architect review of the fitment.
  async requestPresalesFitmentReview(actor: ActorContext, audit: AuditMetadata, requestId: string, input: PresalesFitmentReviewRequestBody): Promise<PresalesRequestResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertPresalesMutation(actor, ["fitment"]);
      const row = await this.loadPresalesFull(client, actor.tenantId, requestId);
      const reviewerId = await this.ensureOwnerId(client, actor.tenantId, input.reviewerId);
      if (!reviewerId) {
        throw new AppError(400, "A valid reviewer is required.", undefined, "VALIDATION_ERROR");
      }
      const metadata = getMetadata(row.metadata);
      const review = { reviewer: { id: reviewerId, displayName: "", email: "" }, note: getTrimmedNullableString(input.note), requestedBy: { id: actor.userId, displayName: actor.displayName, email: actor.email }, requestedAt: new Date().toISOString() };
      await this.writePresalesMetadata(client, actor, requestId, { ...metadata, fitmentReview: review });
      await this.notificationService.createNotificationWithClient(client, actor, audit, {
        notificationType: "record_assignment",
        recipientUserId: reviewerId,
        title: "Solution fitment review requested",
        message: review.note ?? "Please review the presales solution fitment.",
        ...(row.opportunity_id ? { linkedRecord: { entityType: "opportunity", entityId: row.opportunity_id } } : {})
      });
      await this.recordAuditLog(client, actor, audit, { action: "presales.fitment.review_requested", resourceType: "presales_request", resourceId: requestId, status: "success" });
    });
    return this.getPresalesRequest(actor, requestId);
  }

  // PS-005: POC plan.
  async upsertPresalesPocPlan(actor: ActorContext, audit: AuditMetadata, requestId: string, input: PresalesPocPlanRequestBody): Promise<PresalesRequestResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertPresalesMutation(actor, ["poc"]);
      const row = await this.loadPresalesFull(client, actor.tenantId, requestId);
      const metadata = getMetadata(row.metadata);
      const current = this.readPresalesPoc(metadata);
      const pick = (next: string | null | undefined, prev: string | null) => (next !== undefined ? getTrimmedNullableString(next) : prev);
      const poc = {
        objective: pick(input.objective, current?.objective ?? null),
        scope: pick(input.scope, current?.scope ?? null),
        successCriteria: pick(input.successCriteria, current?.successCriteria ?? null),
        timeline: pick(input.timeline, current?.timeline ?? null),
        responsibilities: pick(input.responsibilities, current?.responsibilities ?? null),
        demoData: pick(input.demoData, current?.demoData ?? null),
        signOff: current?.signOff
          ? { ...current.signOff, signedOffBy: current.signOff.signedOffBy ? { id: current.signOff.signedOffBy.id, displayName: current.signOff.signedOffBy.displayName, email: current.signOff.signedOffBy.email } : null }
          : null,
        updatedAt: new Date().toISOString()
      };
      await this.writePresalesMetadata(client, actor, requestId, { ...metadata, poc });
      await this.recordAuditLog(client, actor, audit, { action: "presales.poc.upsert", resourceType: "presales_request", resourceId: requestId, status: "success" });
    });
    return this.getPresalesRequest(actor, requestId);
  }

  // PS-005: POC sign-off + optional opportunity probability update.
  async signOffPresalesPoc(actor: ActorContext, audit: AuditMetadata, requestId: string, input: PresalesPocSignOffRequestBody): Promise<PresalesRequestResponse> {
    this.assertEnabled();
    if (input.outcome !== "success" && input.outcome !== "fail") {
      throw new AppError(400, "POC outcome must be success or fail.", undefined, "VALIDATION_ERROR");
    }
    const probability = typeof input.probability === "number" ? Math.max(0, Math.min(100, Math.round(input.probability))) : null;
    let opportunityId: string | null = null;
    await this.databaseService.withTransaction(async (client) => {
      this.assertPresalesMutation(actor, ["poc"]);
      const row = await this.loadPresalesFull(client, actor.tenantId, requestId);
      opportunityId = row.opportunity_id;
      const metadata = getMetadata(row.metadata);
      const current = this.readPresalesPoc(metadata) ?? { objective: null, scope: null, successCriteria: null, timeline: null, responsibilities: null, demoData: null, signOff: null, updatedAt: null };
      const signOff = { outcome: input.outcome, customerFeedback: getTrimmedNullableString(input.customerFeedback), signedOffBy: { id: actor.userId, displayName: actor.displayName, email: actor.email }, signedOffAt: new Date().toISOString() };
      const poc = { objective: current.objective, scope: current.scope, successCriteria: current.successCriteria, timeline: current.timeline, responsibilities: current.responsibilities, demoData: current.demoData, signOff, updatedAt: new Date().toISOString() };
      await this.writePresalesMetadata(client, actor, requestId, { ...metadata, poc });
      await this.recordAuditLog(client, actor, audit, { action: "presales.poc.sign_off", resourceType: "presales_request", resourceId: requestId, status: "success", metadata: { outcome: input.outcome, probability } });
    });
    if (probability !== null && opportunityId) {
      await this.opportunityService.updateOpportunity(actor, audit, opportunityId, { probability });
    }
    return this.getPresalesRequest(actor, requestId);
  }
}

interface BdComputeCatalog {
  priorities: CrmOptionValueSummary[];
  technologies: CrmOptionValueSummary[];
  buyerRoles: CrmOptionValueSummary[];
  sequenceSteps: BdSequenceStepDefinition[];
  nowIso: string;
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

interface BdTerritoryPlanRow {
  id: string;
  name: string;
  geography: string | null;
  target_segments: string | null;
  named_accounts: string | null;
  partner_coverage: string | null;
  campaigns: string | null;
  pipeline_target: string | number | null;
  revenue_target: string | number | null;
  review_status: string;
  created_at: Date;
  updated_at: Date;
  owner_id: string | null;
  owner_display_name: string | null;
  owner_email: string | null;
  reviewer_id: string | null;
  reviewer_display_name: string | null;
  reviewer_email: string | null;
}

interface BdMarketSignalRow {
  id: string;
  signal_type: string;
  content: string;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  created_at: Date;
  owner_id: string | null;
  owner_display_name: string | null;
  owner_email: string | null;
  type_id: string | null;
  type_key: string | null;
  type_label: string | null;
  type_description: string | null;
  type_color: string | null;
  type_is_default: boolean | null;
  type_is_active: boolean | null;
}

interface BdPartnerReferralRow {
  id: string;
  referral_source: string | null;
  customer_name: string;
  referred_value: string | number | null;
  converted: boolean;
  commission_eligible: boolean;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  account_id: string | null;
  account_name: string | null;
  account_website: string | null;
  opportunity_id: string | null;
  opportunity_name: string | null;
  owner_id: string | null;
  owner_display_name: string | null;
  owner_email: string | null;
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
