import type {
  CampaignAssetReference,
  CampaignDetail,
  CampaignListQuery,
  CampaignMemberEntityType,
  CampaignMemberResponse,
  CampaignMemberSummary,
  CampaignMembersResponse,
  CampaignMemberRecordSummary,
  CampaignOptionsResponse,
  CampaignResponse,
  CampaignSummary,
  CampaignsResponse,
  CreateCampaignMemberRequestBody,
  CreateCampaignRequestBody,
  CrmLookupUserSummary,
  CrmMutationSuccessResponse,
  CrmOptionValueSummary,
  CrmPagination,
  RoleSummary,
  UpdateCampaignMemberRequestBody,
  UpdateCampaignRequestBody
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

interface CampaignRecordRow {
  id: string;
  name: string;
  description: string | null;
  target_audience: string | null;
  budget_amount: string | number | null;
  start_date: string | null;
  end_date: string | null;
  related_assets: CampaignAssetReference[] | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  member_count: number;
  task_count: number;
  note_count: number;
  activity_count: number;
  last_activity_at: Date | null;
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
  objective_id: string | null;
  objective_key: string | null;
  objective_label: string | null;
  objective_description: string | null;
  objective_color: string | null;
  objective_is_default: boolean | null;
  objective_is_active: boolean | null;
  status_id: string | null;
  status_key: string | null;
  status_label: string | null;
  status_description: string | null;
  status_color: string | null;
  status_is_default: boolean | null;
  status_is_active: boolean | null;
  channel_id: string | null;
  channel_key: string | null;
  channel_label: string | null;
  channel_description: string | null;
  channel_color: string | null;
  channel_is_default: boolean | null;
  channel_is_active: boolean | null;
}

interface CampaignStateRow {
  id: string;
  name: string;
  description: string | null;
  type_option_id: string;
  objective_option_id: string;
  status_option_id: string;
  channel_option_id: string;
  target_audience: string | null;
  budget_amount: string | number | null;
  owner_id: string | null;
  start_date: string | null;
  end_date: string | null;
  related_assets: CampaignAssetReference[] | null;
  metadata: Record<string, unknown> | null;
}

interface CampaignMemberStateRow {
  id: string;
  member_entity_type: CampaignMemberEntityType;
  member_entity_id: string;
  status_option_id: string | null;
  response_text: string | null;
  metadata: Record<string, unknown> | null;
}

interface CampaignMemberRow {
  id: string;
  member_entity_type: CampaignMemberEntityType;
  member_entity_id: string;
  response_text: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  status_id: string | null;
  status_key: string | null;
  status_label: string | null;
  status_description: string | null;
  status_color: string | null;
  status_is_default: boolean | null;
  status_is_active: boolean | null;
  lead_first_name: string | null;
  lead_last_name: string | null;
  lead_company_name: string | null;
  lead_email: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_email: string | null;
  account_name: string | null;
  account_website: string | null;
}

interface LeadCandidateRow {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string;
  email: string | null;
}

interface ContactCandidateRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

interface AccountCandidateRow {
  id: string;
  name: string;
  website: string | null;
}

function toIsoString(value: Date | null) {
  return value ? value.toISOString() : null;
}

function toNullableNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return value;
  }

  const parsedValue = Number.parseFloat(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function getMetadata(value: Record<string, unknown> | null | undefined) {
  return value ?? {};
}

function getTrimmedNullableString(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function getPositiveNumber(value: number | undefined, fallback: number, maximum: number) {
  if (!value || value < 1) {
    return fallback;
  }

  return Math.min(value, maximum);
}

function getPagination(total: number, page: number, pageSize: number): CrmPagination {
  const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
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

function normalizeRelatedAssets(value: CampaignAssetReference[] | null | undefined): CampaignAssetReference[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((asset) => ({
    label: asset.label.trim(),
    url: asset.url.trim(),
    assetType: getTrimmedNullableString(asset.assetType)
  }));
}

function buildLeadRecordSummary(row: LeadCandidateRow): CampaignMemberRecordSummary {
  return {
    entityType: "lead",
    id: row.id,
    label: `${row.first_name} ${row.last_name}`.trim(),
    secondaryLabel: row.company_name || row.email
  };
}

function buildContactRecordSummary(row: ContactCandidateRow): CampaignMemberRecordSummary {
  return {
    entityType: "contact",
    id: row.id,
    label: `${row.first_name} ${row.last_name}`.trim(),
    secondaryLabel: row.email
  };
}

function buildAccountRecordSummary(row: AccountCandidateRow): CampaignMemberRecordSummary {
  return {
    entityType: "account",
    id: row.id,
    label: row.name,
    secondaryLabel: row.website
  };
}

export class CampaignService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {}

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(
        503,
        "Campaign management is unavailable until the database connection is enabled.",
        undefined,
        "CAMPAIGNS_UNAVAILABLE"
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

  private async loadOwners(client: PoolClient, tenantId: string) {
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

  private async loadOptionSetValues(client: PoolClient, tenantId: string, setKey: string) {
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

  private async resolveDefaultOptionValueId(client: PoolClient, tenantId: string, setKey: string, label: string) {
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

    const optionValueId = result.rows[0]?.id;

    if (!optionValueId) {
      throw new AppError(400, `${label} is not configured for this tenant.`, undefined, "MISSING_OPTION_SET");
    }

    return optionValueId;
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
      throw new AppError(400, "The selected owner is invalid for this tenant.", undefined, "INVALID_OWNER");
    }

    return resolvedOwnerId;
  }

  private async validateDateWindow(startDate: string | null | undefined, endDate: string | null | undefined) {
    if (!startDate || !endDate) {
      return;
    }

    if (new Date(`${endDate}T00:00:00.000Z`).getTime() < new Date(`${startDate}T00:00:00.000Z`).getTime()) {
      throw new AppError(400, "Campaign end date cannot be earlier than the start date.", undefined, "INVALID_DATE_RANGE");
    }
  }

  private assertCampaignAssignOnlyMutation(actor: ActorContext, keys: string[]) {
    if (keys.length === 0) {
      throw new AppError(400, "At least one field must be updated.", undefined, "VALIDATION_ERROR");
    }

    const canEdit = actor.permissionCodes.includes("campaigns.edit");
    const canConfigure = actor.permissionCodes.includes("campaigns.configure");
    const canAssign = actor.permissionCodes.includes("campaigns.assign");
    const isOwnerOnlyMutation = keys.every((key) => key === "ownerId");

    if (!canEdit && !canConfigure && !(canAssign && isOwnerOnlyMutation)) {
      throw new AppError(
        403,
        "You do not have permission to update these campaign fields.",
        undefined,
        "AUTHORIZATION_ERROR"
      );
    }
  }

  private assertCampaignMemberMutation(actor: ActorContext, keys: string[]) {
    const canEdit = actor.permissionCodes.includes("campaigns.edit");
    const canConfigure = actor.permissionCodes.includes("campaigns.configure");
    const canAssign = actor.permissionCodes.includes("campaigns.assign");
    const assignOnlyKeys = new Set(["statusKey", "response"]);
    const isAssignOnlyMutation = keys.every((key) => assignOnlyKeys.has(key));

    if (!canEdit && !canConfigure && !(canAssign && isAssignOnlyMutation)) {
      throw new AppError(
        403,
        "You do not have permission to update these campaign member fields.",
        undefined,
        "AUTHORIZATION_ERROR"
      );
    }
  }

  private async getCampaignState(client: PoolClient, tenantId: string, campaignId: string) {
    const result = await client.query<CampaignStateRow>(
      `
        SELECT
          id,
          name,
          description,
          type_option_id,
          objective_option_id,
          status_option_id,
          channel_option_id,
          target_audience,
          budget_amount,
          owner_id,
          start_date::text AS start_date,
          end_date::text AS end_date,
          related_assets,
          metadata
        FROM campaigns
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [campaignId, tenantId]
    );

    const campaign = result.rows[0] ?? null;

    if (!campaign) {
      throw new AppError(404, "Campaign not found.", undefined, "CAMPAIGN_NOT_FOUND");
    }

    return campaign;
  }

  private async getCampaignMemberState(
    client: PoolClient,
    tenantId: string,
    campaignId: string,
    memberId: string
  ) {
    const result = await client.query<CampaignMemberStateRow>(
      `
        SELECT
          id,
          member_entity_type,
          member_entity_id,
          status_option_id,
          response_text,
          metadata
        FROM campaign_members
        WHERE id = $1
          AND campaign_id = $2
          AND tenant_id = $3
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [memberId, campaignId, tenantId]
    );

    const member = result.rows[0] ?? null;

    if (!member) {
      throw new AppError(404, "Campaign member not found.", undefined, "CAMPAIGN_MEMBER_NOT_FOUND");
    }

    return member;
  }

  private async ensureUniqueActiveMember(
    client: PoolClient,
    tenantId: string,
    campaignId: string,
    memberEntityType: CampaignMemberEntityType,
    memberEntityId: string
  ) {
    const result = await client.query<{ id: string }>(
      `
        SELECT id
        FROM campaign_members
        WHERE tenant_id = $1
          AND campaign_id = $2
          AND member_entity_type = $3
          AND member_entity_id = $4
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [tenantId, campaignId, memberEntityType, memberEntityId]
    );

    if (result.rows[0]?.id) {
      throw new AppError(
        409,
        "This record is already attached to the campaign.",
        undefined,
        "CAMPAIGN_MEMBER_EXISTS"
      );
    }
  }

  private async ensureMemberRecord(
    client: PoolClient,
    tenantId: string,
    memberEntityType: CampaignMemberEntityType,
    memberEntityId: string
  ): Promise<CampaignMemberRecordSummary> {
    switch (memberEntityType) {
      case "lead": {
        const result = await client.query<LeadCandidateRow>(
          `
            SELECT id, first_name, last_name, company_name, email
            FROM leads
            WHERE id = $1
              AND tenant_id = $2
              AND deleted_at IS NULL
            LIMIT 1
          `,
          [memberEntityId, tenantId]
        );

        const lead = result.rows[0] ?? null;

        if (!lead) {
          throw new AppError(400, "The selected lead is invalid for this tenant.", undefined, "INVALID_MEMBER_RECORD");
        }

        return buildLeadRecordSummary(lead);
      }
      case "contact": {
        const result = await client.query<ContactCandidateRow>(
          `
            SELECT id, first_name, last_name, email
            FROM contacts
            WHERE id = $1
              AND tenant_id = $2
              AND deleted_at IS NULL
            LIMIT 1
          `,
          [memberEntityId, tenantId]
        );

        const contact = result.rows[0] ?? null;

        if (!contact) {
          throw new AppError(400, "The selected contact is invalid for this tenant.", undefined, "INVALID_MEMBER_RECORD");
        }

        return buildContactRecordSummary(contact);
      }
      case "account": {
        const result = await client.query<AccountCandidateRow>(
          `
            SELECT id, name, website
            FROM accounts
            WHERE id = $1
              AND tenant_id = $2
              AND deleted_at IS NULL
            LIMIT 1
          `,
          [memberEntityId, tenantId]
        );

        const account = result.rows[0] ?? null;

        if (!account) {
          throw new AppError(400, "The selected account is invalid for this tenant.", undefined, "INVALID_MEMBER_RECORD");
        }

        return buildAccountRecordSummary(account);
      }
      default:
        throw new AppError(400, "Unsupported campaign member type.", undefined, "VALIDATION_ERROR");
    }
  }

  private async loadLeadCandidates(client: PoolClient, tenantId: string) {
    const result = await client.query<LeadCandidateRow>(
      `
        SELECT id, first_name, last_name, company_name, email
        FROM leads
        WHERE tenant_id = $1
          AND deleted_at IS NULL
        ORDER BY last_name ASC, first_name ASC
      `,
      [tenantId]
    );

    return result.rows.map((row) => buildLeadRecordSummary(row));
  }

  private async loadContactCandidates(client: PoolClient, tenantId: string) {
    const result = await client.query<ContactCandidateRow>(
      `
        SELECT id, first_name, last_name, email
        FROM contacts
        WHERE tenant_id = $1
          AND deleted_at IS NULL
        ORDER BY last_name ASC, first_name ASC
      `,
      [tenantId]
    );

    return result.rows.map((row) => buildContactRecordSummary(row));
  }

  private async loadAccountCandidates(client: PoolClient, tenantId: string) {
    const result = await client.query<AccountCandidateRow>(
      `
        SELECT id, name, website
        FROM accounts
        WHERE tenant_id = $1
          AND deleted_at IS NULL
        ORDER BY name ASC
      `,
      [tenantId]
    );

    return result.rows.map((row) => buildAccountRecordSummary(row));
  }

  private mapCampaign(row: CampaignRecordRow): CampaignSummary {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: mapOptionValue({
        id: row.type_id,
        key: row.type_key,
        label: row.type_label,
        description: row.type_description,
        color: row.type_color,
        isDefault: row.type_is_default,
        isActive: row.type_is_active
      }),
      objective: mapOptionValue({
        id: row.objective_id,
        key: row.objective_key,
        label: row.objective_label,
        description: row.objective_description,
        color: row.objective_color,
        isDefault: row.objective_is_default,
        isActive: row.objective_is_active
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
      channel: mapOptionValue({
        id: row.channel_id,
        key: row.channel_key,
        label: row.channel_label,
        description: row.channel_description,
        color: row.channel_color,
        isDefault: row.channel_is_default,
        isActive: row.channel_is_active
      }),
      targetAudience: row.target_audience,
      budgetAmount: toNullableNumber(row.budget_amount),
      owner: mapUser({
        id: row.owner_id,
        displayName: row.owner_display_name,
        email: row.owner_email,
        teamName: row.owner_team_name,
        departmentName: row.owner_department_name
      }),
      memberCount: row.member_count,
      taskCount: row.task_count,
      noteCount: row.note_count,
      activityCount: row.activity_count,
      lastActivityAt: toIsoString(row.last_activity_at),
      startDate: row.start_date,
      endDate: row.end_date,
      metadata: getMetadata(row.metadata),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private buildAiPlaceholders(actor: ActorContext) {
    const permissionCodes = new Set(actor.permissionCodes);
    const canUseAi =
      permissionCodes.has("campaigns.use_ai") ||
      permissionCodes.has("campaigns.manage_ai") ||
      permissionCodes.has("ai.use_ai") ||
      permissionCodes.has("ai.manage_ai");
    const canManageAi = permissionCodes.has("campaigns.manage_ai") || permissionCodes.has("ai.manage_ai");

    return {
      actions: canUseAi
        ? [
            {
              key: "campaign_plan_generator" as const,
              label: "AI campaign plan generator",
              description: "Placeholder entry point for future channel mix, cadence, and milestone planning."
            },
            {
              key: "content_generator" as const,
              label: "AI content generator",
              description: "Placeholder entry point for future campaign copy, asset prompts, and draft messaging."
            },
            {
              key: "audience_suggestion" as const,
              label: "AI audience suggestion",
              description: "Placeholder entry point for future audience expansion and segment recommendations."
            }
          ]
        : [],
      governanceHint: canManageAi
        ? "AI placeholders are visible and will later connect to the governed AI Gateway with campaign-level controls."
        : canUseAi
          ? "AI placeholders are visible for this role, but execution is intentionally deferred until the AI Gateway phase."
          : "AI placeholders remain hidden until the role includes campaign or global AI usage permissions."
    };
  }

  private mapCampaignMember(row: CampaignMemberRow): CampaignMemberSummary {
    let record: CampaignMemberRecordSummary;

    if (row.member_entity_type === "lead") {
      record = {
        entityType: "lead",
        id: row.member_entity_id,
        label: `${row.lead_first_name ?? ""} ${row.lead_last_name ?? ""}`.trim() || "Archived lead",
        secondaryLabel: row.lead_company_name ?? row.lead_email
      };
    } else if (row.member_entity_type === "contact") {
      record = {
        entityType: "contact",
        id: row.member_entity_id,
        label: `${row.contact_first_name ?? ""} ${row.contact_last_name ?? ""}`.trim() || "Archived contact",
        secondaryLabel: row.contact_email
      };
    } else {
      record = {
        entityType: "account",
        id: row.member_entity_id,
        label: row.account_name ?? "Archived account",
        secondaryLabel: row.account_website
      };
    }

    return {
      id: row.id,
      record,
      status: mapOptionValue({
        id: row.status_id,
        key: row.status_key,
        label: row.status_label,
        description: row.status_description,
        color: row.status_color,
        isDefault: row.status_is_default,
        isActive: row.status_is_active
      }),
      response: row.response_text,
      conversionPlaceholder: {
        available: false,
        message: "Member conversion tracking is reserved for a later attribution and opportunity phase."
      },
      metadata: getMetadata(row.metadata),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private async loadCampaignMembers(client: PoolClient, tenantId: string, campaignId: string): Promise<CampaignMemberSummary[]> {
    const result = await client.query<CampaignMemberRow>(
      `
        SELECT
          campaign_members.id,
          campaign_members.member_entity_type,
          campaign_members.member_entity_id,
          campaign_members.response_text,
          campaign_members.metadata,
          campaign_members.created_at,
          campaign_members.updated_at,
          status_values.id AS status_id,
          status_values.value_key AS status_key,
          status_values.label AS status_label,
          status_values.description AS status_description,
          status_values.color AS status_color,
          status_values.is_default AS status_is_default,
          status_values.is_active AS status_is_active,
          leads.first_name AS lead_first_name,
          leads.last_name AS lead_last_name,
          leads.company_name AS lead_company_name,
          leads.email AS lead_email,
          contacts.first_name AS contact_first_name,
          contacts.last_name AS contact_last_name,
          contacts.email AS contact_email,
          accounts.name AS account_name,
          accounts.website AS account_website
        FROM campaign_members
        LEFT JOIN tenant_option_values AS status_values
          ON status_values.id = campaign_members.status_option_id
         AND status_values.tenant_id = campaign_members.tenant_id
        LEFT JOIN leads
          ON campaign_members.member_entity_type = 'lead'
         AND leads.id = campaign_members.member_entity_id
         AND leads.tenant_id = campaign_members.tenant_id
         AND leads.deleted_at IS NULL
        LEFT JOIN contacts
          ON campaign_members.member_entity_type = 'contact'
         AND contacts.id = campaign_members.member_entity_id
         AND contacts.tenant_id = campaign_members.tenant_id
         AND contacts.deleted_at IS NULL
        LEFT JOIN accounts
          ON campaign_members.member_entity_type = 'account'
         AND accounts.id = campaign_members.member_entity_id
         AND accounts.tenant_id = campaign_members.tenant_id
         AND accounts.deleted_at IS NULL
        WHERE campaign_members.tenant_id = $1
          AND campaign_members.campaign_id = $2
          AND campaign_members.deleted_at IS NULL
        ORDER BY campaign_members.created_at DESC
      `,
      [tenantId, campaignId]
    );

    return result.rows.map((row) => this.mapCampaignMember(row));
  }

  private async loadCampaignDetail(client: PoolClient, actor: ActorContext, campaignId: string): Promise<CampaignDetail> {
    const result = await client.query<CampaignRecordRow>(
      `
        SELECT
          campaigns.id,
          campaigns.name,
          campaigns.description,
          campaigns.target_audience,
          campaigns.budget_amount,
          campaigns.start_date::text AS start_date,
          campaigns.end_date::text AS end_date,
          campaigns.related_assets,
          campaigns.metadata,
          campaigns.created_at,
          campaigns.updated_at,
          COALESCE(member_counts.count, 0)::int AS member_count,
          COALESCE(task_counts.count, 0)::int AS task_count,
          COALESCE(note_counts.count, 0)::int AS note_count,
          COALESCE(activity_counts.count, 0)::int AS activity_count,
          activity_counts.last_activity_at,
          owner_users.id AS owner_id,
          owner_users.display_name AS owner_display_name,
          owner_users.email AS owner_email,
          owner_teams.name AS owner_team_name,
          owner_departments.name AS owner_department_name,
          type_values.id AS type_id,
          type_values.value_key AS type_key,
          type_values.label AS type_label,
          type_values.description AS type_description,
          type_values.color AS type_color,
          type_values.is_default AS type_is_default,
          type_values.is_active AS type_is_active,
          objective_values.id AS objective_id,
          objective_values.value_key AS objective_key,
          objective_values.label AS objective_label,
          objective_values.description AS objective_description,
          objective_values.color AS objective_color,
          objective_values.is_default AS objective_is_default,
          objective_values.is_active AS objective_is_active,
          status_values.id AS status_id,
          status_values.value_key AS status_key,
          status_values.label AS status_label,
          status_values.description AS status_description,
          status_values.color AS status_color,
          status_values.is_default AS status_is_default,
          status_values.is_active AS status_is_active,
          channel_values.id AS channel_id,
          channel_values.value_key AS channel_key,
          channel_values.label AS channel_label,
          channel_values.description AS channel_description,
          channel_values.color AS channel_color,
          channel_values.is_default AS channel_is_default,
          channel_values.is_active AS channel_is_active
        FROM campaigns
        INNER JOIN tenant_option_values AS type_values
          ON type_values.id = campaigns.type_option_id
         AND type_values.tenant_id = campaigns.tenant_id
        INNER JOIN tenant_option_values AS objective_values
          ON objective_values.id = campaigns.objective_option_id
         AND objective_values.tenant_id = campaigns.tenant_id
        INNER JOIN tenant_option_values AS status_values
          ON status_values.id = campaigns.status_option_id
         AND status_values.tenant_id = campaigns.tenant_id
        INNER JOIN tenant_option_values AS channel_values
          ON channel_values.id = campaigns.channel_option_id
         AND channel_values.tenant_id = campaigns.tenant_id
        LEFT JOIN users AS owner_users
          ON owner_users.id = campaigns.owner_id
         AND owner_users.tenant_id = campaigns.tenant_id
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
          SELECT tenant_id, campaign_id, COUNT(*) AS count
          FROM campaign_members
          WHERE deleted_at IS NULL
          GROUP BY tenant_id, campaign_id
        ) AS member_counts
          ON member_counts.tenant_id = campaigns.tenant_id
         AND member_counts.campaign_id = campaigns.id
        LEFT JOIN (
          SELECT tenant_id, entity_id, COUNT(*) AS count
          FROM crm_tasks
          WHERE entity_type = 'campaign'
            AND deleted_at IS NULL
          GROUP BY tenant_id, entity_id
        ) AS task_counts
          ON task_counts.tenant_id = campaigns.tenant_id
         AND task_counts.entity_id = campaigns.id
        LEFT JOIN (
          SELECT tenant_id, entity_id, COUNT(*) AS count
          FROM crm_notes
          WHERE entity_type = 'campaign'
            AND deleted_at IS NULL
          GROUP BY tenant_id, entity_id
        ) AS note_counts
          ON note_counts.tenant_id = campaigns.tenant_id
         AND note_counts.entity_id = campaigns.id
        LEFT JOIN (
          SELECT tenant_id, entity_id, COUNT(*) AS count, MAX(occurred_at) AS last_activity_at
          FROM crm_activities
          WHERE entity_type = 'campaign'
            AND deleted_at IS NULL
          GROUP BY tenant_id, entity_id
        ) AS activity_counts
          ON activity_counts.tenant_id = campaigns.tenant_id
         AND activity_counts.entity_id = campaigns.id
        WHERE campaigns.tenant_id = $1
          AND campaigns.id = $2
          AND campaigns.deleted_at IS NULL
        LIMIT 1
      `,
      [actor.tenantId, campaignId]
    );

    const row = result.rows[0] ?? null;

    if (!row) {
      throw new AppError(404, "Campaign not found.", undefined, "CAMPAIGN_NOT_FOUND");
    }

    return {
      ...this.mapCampaign(row),
      relatedAssets: normalizeRelatedAssets(row.related_assets),
      members: await this.loadCampaignMembers(client, actor.tenantId, campaignId),
      performancePlaceholder: {
        impressions: null,
        responses: null,
        conversions: null,
        roi: null,
        message: "Live campaign performance metrics will connect in a later attribution and analytics phase."
      },
      calendarPlaceholder: {
        available: false,
        message: "Calendar visualization is intentionally a placeholder until cross-channel scheduling lands."
      },
      aiPlaceholders: this.buildAiPlaceholders(actor)
    };
  }

  async listCampaigns(actor: ActorContext, query: CampaignListQuery): Promise<CampaignsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const page = getPositiveNumber(query.page, 1, 10_000);
      const pageSize = getPositiveNumber(query.pageSize, 12, 100);
      const offset = (page - 1) * pageSize;
      const conditions = ["campaigns.tenant_id = $1", "campaigns.deleted_at IS NULL"];
      const params: unknown[] = [actor.tenantId];

      if (query.search) {
        params.push(`%${query.search.trim()}%`);
        const searchIndex = params.length;
        conditions.push(
          `(campaigns.name ILIKE $${searchIndex} OR COALESCE(campaigns.description, '') ILIKE $${searchIndex} OR COALESCE(campaigns.target_audience, '') ILIKE $${searchIndex})`
        );
      }

      if (query.status) {
        params.push(query.status.trim());
        conditions.push(`status_values.value_key = $${params.length}`);
      }

      if (query.type) {
        params.push(query.type.trim());
        conditions.push(`type_values.value_key = $${params.length}`);
      }

      if (query.channel) {
        params.push(query.channel.trim());
        conditions.push(`channel_values.value_key = $${params.length}`);
      }

      if (query.ownerId) {
        params.push(query.ownerId);
        conditions.push(`campaigns.owner_id = $${params.length}`);
      }

      const whereClause = conditions.join(" AND ");
      const countResult = await client.query<{ total: number }>(
        `
          SELECT COUNT(*)::int AS total
          FROM campaigns
          INNER JOIN tenant_option_values AS type_values
            ON type_values.id = campaigns.type_option_id
           AND type_values.tenant_id = campaigns.tenant_id
          INNER JOIN tenant_option_values AS status_values
            ON status_values.id = campaigns.status_option_id
           AND status_values.tenant_id = campaigns.tenant_id
          INNER JOIN tenant_option_values AS channel_values
            ON channel_values.id = campaigns.channel_option_id
           AND channel_values.tenant_id = campaigns.tenant_id
          WHERE ${whereClause}
        `,
        params
      );

      const total = countResult.rows[0]?.total ?? 0;
      const sortColumnByKey = {
        createdAt: "campaigns.created_at",
        updatedAt: "campaigns.updated_at",
        name: "campaigns.name",
        status: "status_values.label",
        startDate: "campaigns.start_date",
        endDate: "campaigns.end_date",
        budget: "COALESCE(campaigns.budget_amount, 0)",
        owner: "COALESCE(owner_users.display_name, '')"
      } as const;
      const sortKey = (query.sortBy ?? "updatedAt") as keyof typeof sortColumnByKey;
      const sortColumn = sortColumnByKey[sortKey];
      const sortOrder = query.sortOrder === "asc" ? "ASC" : "DESC";

      params.push(pageSize, offset);

      const result = await client.query<CampaignRecordRow>(
        `
          SELECT
            campaigns.id,
            campaigns.name,
            campaigns.description,
            campaigns.target_audience,
            campaigns.budget_amount,
            campaigns.start_date::text AS start_date,
            campaigns.end_date::text AS end_date,
            campaigns.related_assets,
            campaigns.metadata,
            campaigns.created_at,
            campaigns.updated_at,
            COALESCE(member_counts.count, 0)::int AS member_count,
            COALESCE(task_counts.count, 0)::int AS task_count,
            COALESCE(note_counts.count, 0)::int AS note_count,
            COALESCE(activity_counts.count, 0)::int AS activity_count,
            activity_counts.last_activity_at,
            owner_users.id AS owner_id,
            owner_users.display_name AS owner_display_name,
            owner_users.email AS owner_email,
            owner_teams.name AS owner_team_name,
            owner_departments.name AS owner_department_name,
            type_values.id AS type_id,
            type_values.value_key AS type_key,
            type_values.label AS type_label,
            type_values.description AS type_description,
            type_values.color AS type_color,
            type_values.is_default AS type_is_default,
            type_values.is_active AS type_is_active,
            objective_values.id AS objective_id,
            objective_values.value_key AS objective_key,
            objective_values.label AS objective_label,
            objective_values.description AS objective_description,
            objective_values.color AS objective_color,
            objective_values.is_default AS objective_is_default,
            objective_values.is_active AS objective_is_active,
            status_values.id AS status_id,
            status_values.value_key AS status_key,
            status_values.label AS status_label,
            status_values.description AS status_description,
            status_values.color AS status_color,
            status_values.is_default AS status_is_default,
            status_values.is_active AS status_is_active,
            channel_values.id AS channel_id,
            channel_values.value_key AS channel_key,
            channel_values.label AS channel_label,
            channel_values.description AS channel_description,
            channel_values.color AS channel_color,
            channel_values.is_default AS channel_is_default,
            channel_values.is_active AS channel_is_active
          FROM campaigns
          INNER JOIN tenant_option_values AS type_values
            ON type_values.id = campaigns.type_option_id
           AND type_values.tenant_id = campaigns.tenant_id
          INNER JOIN tenant_option_values AS objective_values
            ON objective_values.id = campaigns.objective_option_id
           AND objective_values.tenant_id = campaigns.tenant_id
          INNER JOIN tenant_option_values AS status_values
            ON status_values.id = campaigns.status_option_id
           AND status_values.tenant_id = campaigns.tenant_id
          INNER JOIN tenant_option_values AS channel_values
            ON channel_values.id = campaigns.channel_option_id
           AND channel_values.tenant_id = campaigns.tenant_id
          LEFT JOIN users AS owner_users
            ON owner_users.id = campaigns.owner_id
           AND owner_users.tenant_id = campaigns.tenant_id
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
            SELECT tenant_id, campaign_id, COUNT(*) AS count
            FROM campaign_members
            WHERE deleted_at IS NULL
            GROUP BY tenant_id, campaign_id
          ) AS member_counts
            ON member_counts.tenant_id = campaigns.tenant_id
           AND member_counts.campaign_id = campaigns.id
          LEFT JOIN (
            SELECT tenant_id, entity_id, COUNT(*) AS count
            FROM crm_tasks
            WHERE entity_type = 'campaign'
              AND deleted_at IS NULL
            GROUP BY tenant_id, entity_id
          ) AS task_counts
            ON task_counts.tenant_id = campaigns.tenant_id
           AND task_counts.entity_id = campaigns.id
          LEFT JOIN (
            SELECT tenant_id, entity_id, COUNT(*) AS count
            FROM crm_notes
            WHERE entity_type = 'campaign'
              AND deleted_at IS NULL
            GROUP BY tenant_id, entity_id
          ) AS note_counts
            ON note_counts.tenant_id = campaigns.tenant_id
           AND note_counts.entity_id = campaigns.id
          LEFT JOIN (
            SELECT tenant_id, entity_id, COUNT(*) AS count, MAX(occurred_at) AS last_activity_at
            FROM crm_activities
            WHERE entity_type = 'campaign'
              AND deleted_at IS NULL
            GROUP BY tenant_id, entity_id
          ) AS activity_counts
            ON activity_counts.tenant_id = campaigns.tenant_id
           AND activity_counts.entity_id = campaigns.id
          WHERE ${whereClause}
          ORDER BY ${sortColumn} ${sortOrder} NULLS LAST, campaigns.created_at DESC
          LIMIT $${params.length - 1}
          OFFSET $${params.length}
        `,
        params
      );

      return {
        campaigns: result.rows.map((row) => this.mapCampaign(row)),
        pagination: getPagination(total, page, pageSize)
      };
    });
  }

  async getCampaign(actor: ActorContext, campaignId: string): Promise<CampaignResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => ({
      campaign: await this.loadCampaignDetail(client, actor, campaignId)
    }));
  }

  async createCampaign(actor: ActorContext, audit: AuditMetadata, input: CreateCampaignRequestBody): Promise<CampaignResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const ownerId = await this.ensureOwnerId(client, actor.tenantId, input.ownerId ?? null);
      await this.validateDateWindow(input.startDate ?? null, input.endDate ?? null);
      const typeOptionId = await this.resolveOptionValueId(client, actor.tenantId, "campaign-type", input.typeKey, "Campaign type");
      const objectiveOptionId = await this.resolveOptionValueId(
        client,
        actor.tenantId,
        "campaign-objective",
        input.objectiveKey,
        "Campaign objective"
      );
      const statusOptionId = await this.resolveOptionValueId(client, actor.tenantId, "campaign-status", input.statusKey, "Campaign status");
      const channelOptionId = await this.resolveOptionValueId(client, actor.tenantId, "campaign-channel", input.channelKey, "Campaign channel");

      const result = await client.query<{ id: string }>(
        `
          INSERT INTO campaigns (
            tenant_id,
            owner_id,
            name,
            description,
            type_option_id,
            objective_option_id,
            status_option_id,
            channel_option_id,
            target_audience,
            budget_amount,
            start_date,
            end_date,
            related_assets,
            metadata,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15, $15)
          RETURNING id
        `,
        [
          actor.tenantId,
          ownerId,
          input.name.trim(),
          getTrimmedNullableString(input.description),
          typeOptionId,
          objectiveOptionId,
          statusOptionId,
          channelOptionId,
          getTrimmedNullableString(input.targetAudience),
          input.budgetAmount ?? null,
          input.startDate ?? null,
          input.endDate ?? null,
          JSON.stringify(normalizeRelatedAssets(input.relatedAssets)),
          JSON.stringify(input.metadata ?? {}),
          actor.userId
        ]
      );

      const campaignId = result.rows[0]?.id;

      if (!campaignId) {
        throw new AppError(500, "Campaign creation failed.", undefined, "CAMPAIGN_CREATE_FAILED");
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "campaign.create",
        resourceType: "campaign",
        resourceId: campaignId,
        status: "success",
        metadata: {
          typeKey: input.typeKey,
          objectiveKey: input.objectiveKey,
          statusKey: input.statusKey,
          channelKey: input.channelKey,
          ownerId
        }
      });

      return {
        campaign: await this.loadCampaignDetail(client, actor, campaignId)
      };
    });
  }

  async updateCampaign(
    actor: ActorContext,
    audit: AuditMetadata,
    campaignId: string,
    input: UpdateCampaignRequestBody
  ): Promise<CampaignResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateCampaignRequestBody] !== undefined);
      this.assertCampaignAssignOnlyMutation(actor, keys);

      const currentCampaign = await this.getCampaignState(client, actor.tenantId, campaignId);
      const ownerId = keys.includes("ownerId")
        ? await this.ensureOwnerId(client, actor.tenantId, input.ownerId ?? null)
        : currentCampaign.owner_id;
      const typeOptionId = input.typeKey
        ? await this.resolveOptionValueId(client, actor.tenantId, "campaign-type", input.typeKey, "Campaign type")
        : currentCampaign.type_option_id;
      const objectiveOptionId = input.objectiveKey
        ? await this.resolveOptionValueId(client, actor.tenantId, "campaign-objective", input.objectiveKey, "Campaign objective")
        : currentCampaign.objective_option_id;
      const statusOptionId = input.statusKey
        ? await this.resolveOptionValueId(client, actor.tenantId, "campaign-status", input.statusKey, "Campaign status")
        : currentCampaign.status_option_id;
      const channelOptionId = input.channelKey
        ? await this.resolveOptionValueId(client, actor.tenantId, "campaign-channel", input.channelKey, "Campaign channel")
        : currentCampaign.channel_option_id;
      const startDate = input.startDate !== undefined ? input.startDate : currentCampaign.start_date;
      const endDate = input.endDate !== undefined ? input.endDate : currentCampaign.end_date;
      await this.validateDateWindow(startDate ?? null, endDate ?? null);
      const metadata = input.metadata
        ? { ...getMetadata(currentCampaign.metadata), ...input.metadata }
        : getMetadata(currentCampaign.metadata);
      const relatedAssets = input.relatedAssets !== undefined
        ? normalizeRelatedAssets(input.relatedAssets)
        : normalizeRelatedAssets(currentCampaign.related_assets);

      await client.query(
        `
          UPDATE campaigns
          SET
            owner_id = $3,
            name = $4,
            description = $5,
            type_option_id = $6,
            objective_option_id = $7,
            status_option_id = $8,
            channel_option_id = $9,
            target_audience = $10,
            budget_amount = $11,
            start_date = $12,
            end_date = $13,
            related_assets = $14::jsonb,
            metadata = $15::jsonb,
            updated_by = $16
          WHERE id = $1
            AND tenant_id = $2
            AND deleted_at IS NULL
        `,
        [
          campaignId,
          actor.tenantId,
          ownerId,
          input.name?.trim() ?? currentCampaign.name,
          input.description !== undefined ? getTrimmedNullableString(input.description) : currentCampaign.description,
          typeOptionId,
          objectiveOptionId,
          statusOptionId,
          channelOptionId,
          input.targetAudience !== undefined
            ? getTrimmedNullableString(input.targetAudience)
            : currentCampaign.target_audience,
          input.budgetAmount !== undefined ? input.budgetAmount : toNullableNumber(currentCampaign.budget_amount),
          startDate ?? null,
          endDate ?? null,
          JSON.stringify(relatedAssets),
          JSON.stringify(metadata),
          actor.userId
        ]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "campaign.update",
        resourceType: "campaign",
        resourceId: campaignId,
        status: "success",
        metadata: {
          updatedFields: keys
        }
      });

      return {
        campaign: await this.loadCampaignDetail(client, actor, campaignId)
      };
    });
  }

  async deleteCampaign(actor: ActorContext, audit: AuditMetadata, campaignId: string): Promise<CrmMutationSuccessResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      await this.getCampaignState(client, actor.tenantId, campaignId);

      await client.query(
        `
          UPDATE campaigns
          SET
            deleted_at = NOW(),
            updated_by = $3
          WHERE id = $1
            AND tenant_id = $2
            AND deleted_at IS NULL
        `,
        [campaignId, actor.tenantId, actor.userId]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "campaign.delete",
        resourceType: "campaign",
        resourceId: campaignId,
        status: "success"
      });

      return { success: true };
    });
  }

  async getCampaignOptions(actor: ActorContext): Promise<CampaignOptionsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => ({
      owners: await this.loadOwners(client, actor.tenantId),
      types: await this.loadOptionSetValues(client, actor.tenantId, "campaign-type"),
      objectives: await this.loadOptionSetValues(client, actor.tenantId, "campaign-objective"),
      statuses: await this.loadOptionSetValues(client, actor.tenantId, "campaign-status"),
      channels: await this.loadOptionSetValues(client, actor.tenantId, "campaign-channel"),
      memberStatuses: await this.loadOptionSetValues(client, actor.tenantId, "campaign-member-status"),
      leadCandidates: await this.loadLeadCandidates(client, actor.tenantId),
      contactCandidates: await this.loadContactCandidates(client, actor.tenantId),
      accountCandidates: await this.loadAccountCandidates(client, actor.tenantId)
    }));
  }

  async listCampaignMembers(actor: ActorContext, campaignId: string): Promise<CampaignMembersResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      await this.getCampaignState(client, actor.tenantId, campaignId);

      return {
        members: await this.loadCampaignMembers(client, actor.tenantId, campaignId)
      };
    });
  }

  async createCampaignMember(
    actor: ActorContext,
    audit: AuditMetadata,
    campaignId: string,
    input: CreateCampaignMemberRequestBody
  ): Promise<CampaignMemberResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      await this.getCampaignState(client, actor.tenantId, campaignId);
      await this.ensureMemberRecord(client, actor.tenantId, input.memberEntityType, input.memberEntityId);
      await this.ensureUniqueActiveMember(client, actor.tenantId, campaignId, input.memberEntityType, input.memberEntityId);

      const statusOptionId = input.statusKey
        ? await this.resolveOptionValueId(client, actor.tenantId, "campaign-member-status", input.statusKey, "Campaign member status")
        : await this.resolveDefaultOptionValueId(client, actor.tenantId, "campaign-member-status", "Campaign member status");

      const result = await client.query<{ id: string }>(
        `
          INSERT INTO campaign_members (
            tenant_id,
            campaign_id,
            member_entity_type,
            member_entity_id,
            status_option_id,
            response_text,
            metadata,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $8)
          RETURNING id
        `,
        [
          actor.tenantId,
          campaignId,
          input.memberEntityType,
          input.memberEntityId,
          statusOptionId,
          getTrimmedNullableString(input.response),
          JSON.stringify(input.metadata ?? {}),
          actor.userId
        ]
      );

      const memberId = result.rows[0]?.id;

      if (!memberId) {
        throw new AppError(500, "Campaign member creation failed.", undefined, "CAMPAIGN_MEMBER_CREATE_FAILED");
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "campaign.member.create",
        resourceType: "campaign",
        resourceId: campaignId,
        status: "success",
        metadata: {
          memberId,
          memberEntityType: input.memberEntityType,
          memberEntityId: input.memberEntityId,
          statusKey: input.statusKey ?? "default"
        }
      });

      const members = await this.loadCampaignMembers(client, actor.tenantId, campaignId);
      const member = members.find((item) => item.id === memberId);

      if (!member) {
        throw new AppError(500, "Campaign member load failed.", undefined, "CAMPAIGN_MEMBER_LOAD_FAILED");
      }

      return { member };
    });
  }

  async updateCampaignMember(
    actor: ActorContext,
    audit: AuditMetadata,
    campaignId: string,
    memberId: string,
    input: UpdateCampaignMemberRequestBody
  ): Promise<CampaignMemberResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateCampaignMemberRequestBody] !== undefined);

      if (keys.length === 0) {
        throw new AppError(400, "At least one campaign member field must be updated.", undefined, "VALIDATION_ERROR");
      }

      this.assertCampaignMemberMutation(actor, keys);
      const currentMember = await this.getCampaignMemberState(client, actor.tenantId, campaignId, memberId);
      const statusOptionId = input.statusKey === undefined
        ? currentMember.status_option_id
        : input.statusKey === null
          ? null
          : await this.resolveOptionValueId(client, actor.tenantId, "campaign-member-status", input.statusKey, "Campaign member status");
      const metadata = input.metadata
        ? { ...getMetadata(currentMember.metadata), ...input.metadata }
        : getMetadata(currentMember.metadata);

      await client.query(
        `
          UPDATE campaign_members
          SET
            status_option_id = $4,
            response_text = $5,
            metadata = $6::jsonb,
            updated_by = $7
          WHERE id = $1
            AND campaign_id = $2
            AND tenant_id = $3
            AND deleted_at IS NULL
        `,
        [
          memberId,
          campaignId,
          actor.tenantId,
          statusOptionId,
          input.response !== undefined ? getTrimmedNullableString(input.response) : currentMember.response_text,
          JSON.stringify(metadata),
          actor.userId
        ]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "campaign.member.update",
        resourceType: "campaign",
        resourceId: campaignId,
        status: "success",
        metadata: {
          memberId,
          updatedFields: keys
        }
      });

      const members = await this.loadCampaignMembers(client, actor.tenantId, campaignId);
      const member = members.find((item) => item.id === memberId);

      if (!member) {
        throw new AppError(500, "Campaign member load failed.", undefined, "CAMPAIGN_MEMBER_LOAD_FAILED");
      }

      return { member };
    });
  }

  async deleteCampaignMember(
    actor: ActorContext,
    audit: AuditMetadata,
    campaignId: string,
    memberId: string
  ): Promise<CrmMutationSuccessResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      await this.getCampaignMemberState(client, actor.tenantId, campaignId, memberId);

      await client.query(
        `
          UPDATE campaign_members
          SET
            deleted_at = NOW(),
            updated_by = $4
          WHERE id = $1
            AND campaign_id = $2
            AND tenant_id = $3
            AND deleted_at IS NULL
        `,
        [memberId, campaignId, actor.tenantId, actor.userId]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "campaign.member.delete",
        resourceType: "campaign",
        resourceId: campaignId,
        status: "success",
        metadata: {
          memberId
        }
      });

      return { success: true };
    });
  }
}
