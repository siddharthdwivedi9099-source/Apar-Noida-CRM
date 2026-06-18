import type {
  AccountLookupSummary,
  ContactRelationshipSummary,
  CreateSupportKnowledgeArticleRequestBody,
  CreateSupportSlaPolicyRequestBody,
  CreateSupportTicketMessageRequestBody,
  CreateSupportTicketRequestBody,
  CrmLookupUserSummary,
  CrmMutationSuccessResponse,
  CrmOptionValueSummary,
  CrmPagination,
  SupportAiPlaceholderSummary,
  SupportDashboardResponse,
  SupportEscalationStatus,
  SupportKnowledgeArticleResponse,
  SupportKnowledgeArticleStatus,
  SupportKnowledgeArticleSummary,
  SupportKnowledgeArticlesResponse,
  SupportSlaPoliciesResponse,
  SupportSlaPolicyResponse,
  SupportSlaPolicySummary,
  SupportSlaStatus,
  SupportTicketDetail,
  SupportTicketListQuery,
  SupportTicketMessageSummary,
  SupportTicketMessageType,
  SupportTicketOptionsResponse,
  SupportTicketResponse,
  SupportTicketScope,
  SupportTicketSummary,
  SupportTicketsResponse,
  RoleSummary,
  UpdateSupportTicketRequestBody
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

const ESCALATION_STATUSES: SupportEscalationStatus[] = ["none", "pending", "escalated", "resolved"];
const MESSAGE_TYPES: SupportTicketMessageType[] = ["internal_note", "customer_reply"];
const ARTICLE_STATUSES: SupportKnowledgeArticleStatus[] = ["draft", "published", "archived"];
const RESOLVED_STATUS_KEYS = new Set(["resolved", "closed"]);

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

function normalizeEscalationStatus(value: unknown): SupportEscalationStatus {
  return ESCALATION_STATUSES.includes(value as SupportEscalationStatus) ? (value as SupportEscalationStatus) : "none";
}

function normalizeArticleStatus(value: unknown): SupportKnowledgeArticleStatus {
  return ARTICLE_STATUSES.includes(value as SupportKnowledgeArticleStatus) ? (value as SupportKnowledgeArticleStatus) : "draft";
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

function computeSlaStatus(row: SupportTicketRow): SupportSlaStatus {
  const policy: SupportSlaPolicySummary | null = row.sla_policy_id
    ? {
        id: row.sla_policy_id,
        name: row.sla_policy_name ?? "",
        priority: mapOptionValue({
          id: row.sla_priority_id,
          key: row.sla_priority_key,
          label: row.sla_priority_label,
          description: row.sla_priority_description,
          color: row.sla_priority_color,
          isDefault: row.sla_priority_is_default,
          isActive: row.sla_priority_is_active
        }),
        firstResponseMinutes: row.sla_first_response_minutes ?? 0,
        resolutionMinutes: row.sla_resolution_minutes ?? 0,
        isActive: Boolean(row.sla_is_active),
        createdAt: row.sla_created_at ? row.sla_created_at.toISOString() : "",
        updatedAt: row.sla_updated_at ? row.sla_updated_at.toISOString() : ""
      }
    : null;

  const now = Date.now();
  const firstResponseDueAt = row.first_response_due_at;
  const resolutionDueAt = row.resolution_due_at;
  const firstResponseAt = row.first_response_at;
  const resolvedAt = row.resolved_at;

  const firstResponseBreached = firstResponseDueAt
    ? (firstResponseAt ? firstResponseAt.getTime() : now) > firstResponseDueAt.getTime()
    : false;
  const resolutionBreached = resolutionDueAt
    ? (resolvedAt ? resolvedAt.getTime() : now) > resolutionDueAt.getTime()
    : false;

  return {
    policy,
    firstResponseDueAt: toIsoString(firstResponseDueAt),
    resolutionDueAt: toIsoString(resolutionDueAt),
    firstResponseAt: toIsoString(firstResponseAt),
    resolvedAt: toIsoString(resolvedAt),
    firstResponseBreached,
    resolutionBreached
  };
}

export class SupportService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {}

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "Support ticketing is unavailable until the database connection is enabled.", undefined, "SUPPORT_UNAVAILABLE");
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
          tenant_option_values.id, tenant_option_values.value_key AS key, tenant_option_values.label,
          tenant_option_values.description, tenant_option_values.color, tenant_option_values.is_default, tenant_option_values.is_active
        FROM tenant_option_sets
        INNER JOIN tenant_option_values
          ON tenant_option_values.option_set_id = tenant_option_sets.id AND tenant_option_values.tenant_id = tenant_option_sets.tenant_id
        WHERE tenant_option_sets.tenant_id = $1 AND tenant_option_sets.set_key = $2 AND tenant_option_sets.deleted_at IS NULL AND tenant_option_values.deleted_at IS NULL
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

  private async resolveOptionValueId(client: PoolClient, tenantId: string, setKey: string, valueKey: string, label: string) {
    const result = await client.query<{ id: string }>(
      `
        SELECT tenant_option_values.id
        FROM tenant_option_sets
        INNER JOIN tenant_option_values
          ON tenant_option_values.option_set_id = tenant_option_sets.id AND tenant_option_values.tenant_id = tenant_option_sets.tenant_id
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

  private async ensureReference(
    client: PoolClient,
    tenantId: string,
    table: "users" | "accounts" | "contacts",
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

  private async ensureSlaPolicyId(client: PoolClient, tenantId: string, id: string | null | undefined) {
    if (!id) {
      return null;
    }

    const result = await client.query<{ id: string }>(
      `SELECT id FROM support_sla_policies WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [id, tenantId]
    );

    const resolvedId = result.rows[0]?.id ?? null;

    if (!resolvedId) {
      throw new AppError(400, "The selected SLA policy is invalid for this tenant.", undefined, "INVALID_SLA_POLICY");
    }

    return resolvedId;
  }

  private getSharedScopePermissions(actor: ActorContext) {
    return (
      actor.permissionCodes.includes("support.assign") ||
      actor.permissionCodes.includes("support.configure") ||
      actor.permissionCodes.includes("support.view_dashboard") ||
      actor.permissionCodes.includes("support.manage_workflow") ||
      actor.permissionCodes.includes("dashboards.view_dashboard")
    );
  }

  private async getAvailableScopes(client: PoolClient, actor: ActorContext): Promise<SupportTicketScope[]> {
    if (!this.getSharedScopePermissions(actor)) {
      return ["mine"];
    }

    const actorTeamId = await this.getActorTeamId(client, actor.tenantId, actor.userId);
    return actorTeamId ? ["mine", "team", "all"] : ["mine", "all"];
  }

  private async resolveScope(client: PoolClient, actor: ActorContext, requestedScope: SupportTicketScope | undefined): Promise<SupportTicketScope> {
    const availableScopes = await this.getAvailableScopes(client, actor);
    const effectiveScope = requestedScope ?? (availableScopes.includes("all") ? "all" : "mine");

    if (!availableScopes.includes(effectiveScope)) {
      throw new AppError(403, "You do not have permission to inspect this scope.", undefined, "AUTHORIZATION_ERROR");
    }

    return effectiveScope;
  }

  private buildAiPlaceholders(actor: ActorContext): SupportAiPlaceholderSummary {
    const permissionCodes = new Set(actor.permissionCodes);
    const canUseAi =
      permissionCodes.has("support.use_ai") || permissionCodes.has("support.manage_ai") || permissionCodes.has("ai.use_ai") || permissionCodes.has("ai.manage_ai");
    const canManageAi = permissionCodes.has("support.manage_ai") || permissionCodes.has("ai.manage_ai");

    return {
      actions: canUseAi
        ? [
            { key: "ticket_classification", label: "Ticket classification", description: "Placeholder entry point for future automatic ticket categorization and routing." },
            { key: "suggested_response", label: "Suggested response", description: "Placeholder entry point for future AI-drafted customer replies." },
            { key: "similar_tickets", label: "Similar tickets", description: "Placeholder entry point for future similar-ticket retrieval." },
            { key: "knowledge_recommendation", label: "Knowledge recommendation", description: "Placeholder entry point for future knowledge article recommendations." },
            { key: "ticket_summary", label: "Ticket summary", description: "Placeholder entry point for future ticket thread summarization." },
            { key: "escalation_recommendation", label: "Escalation recommendation", description: "Placeholder entry point for future escalation risk detection." }
          ]
        : [],
      governanceHint: canManageAi
        ? "AI placeholders are visible and will later connect to the governed AI Gateway with support-specific controls."
        : canUseAi
          ? "AI placeholders are visible for this role, but execution remains deferred until the AI Gateway phase."
          : "AI placeholders remain hidden until the role includes support or global AI usage permissions."
    };
  }

  private async getTicketState(client: PoolClient, tenantId: string, ticketId: string) {
    const result = await client.query<{
      id: string;
      assignee_id: string | null;
      owner_id: string | null;
      first_response_at: Date | null;
      resolved_at: Date | null;
      status_key: string;
    }>(
      `
        SELECT support_tickets.id, support_tickets.assignee_id, support_tickets.owner_id,
          support_tickets.first_response_at, support_tickets.resolved_at, status_values.value_key AS status_key
        FROM support_tickets
        INNER JOIN tenant_option_values AS status_values
          ON status_values.id = support_tickets.status_option_id AND status_values.tenant_id = support_tickets.tenant_id
        WHERE support_tickets.id = $1 AND support_tickets.tenant_id = $2 AND support_tickets.deleted_at IS NULL
        LIMIT 1
      `,
      [ticketId, tenantId]
    );

    const row = result.rows[0];

    if (!row) {
      throw new AppError(404, "Support ticket not found.", undefined, "TICKET_NOT_FOUND");
    }

    return row;
  }

  private assertTicketMutation(actor: ActorContext, keys: string[]) {
    if (keys.length === 0) {
      throw new AppError(400, "At least one field must be updated.", undefined, "VALIDATION_ERROR");
    }

    const canEdit = actor.permissionCodes.includes("support.edit") || actor.permissionCodes.includes("support.configure");
    const canAssign = actor.permissionCodes.includes("support.assign") || actor.permissionCodes.includes("support.configure");
    const assignmentOnly = keys.every((key) => key === "assigneeId" || key === "ownerId");

    if (!canEdit && !(canAssign && assignmentOnly)) {
      throw new AppError(403, "You do not have permission to update this ticket.", undefined, "AUTHORIZATION_ERROR");
    }

    if (!canAssign && (keys.includes("assigneeId") || keys.includes("ownerId"))) {
      throw new AppError(403, "You do not have permission to reassign tickets.", undefined, "AUTHORIZATION_ERROR");
    }
  }

  private mapSlaPolicy(row: SlaPolicyRow): SupportSlaPolicySummary {
    return {
      id: row.id,
      name: row.name,
      priority: mapOptionValue({
        id: row.priority_id,
        key: row.priority_key,
        label: row.priority_label,
        description: row.priority_description,
        color: row.priority_color,
        isDefault: row.priority_is_default,
        isActive: row.priority_is_active
      }),
      firstResponseMinutes: row.first_response_minutes,
      resolutionMinutes: row.resolution_minutes,
      isActive: row.is_active,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private ticketSelectColumns() {
    return `
      support_tickets.id,
      support_tickets.subject,
      support_tickets.description,
      support_tickets.escalation_status,
      support_tickets.root_cause,
      support_tickets.resolution_notes,
      support_tickets.first_response_due_at,
      support_tickets.resolution_due_at,
      support_tickets.first_response_at,
      support_tickets.resolved_at,
      support_tickets.metadata,
      support_tickets.created_at,
      support_tickets.updated_at,
      support_tickets.account_id,
      ticket_accounts.name AS account_name,
      ticket_accounts.website AS account_website,
      support_tickets.customer_success_account_id AS cs_account_id,
      cs_accounts.name AS cs_account_name,
      cs_accounts.website AS cs_account_website,
      support_tickets.contact_id,
      contacts.first_name AS contact_first_name,
      contacts.last_name AS contact_last_name,
      contacts.email AS contact_email,
      contact_role_values.id AS contact_role_id, contact_role_values.value_key AS contact_role_key, contact_role_values.label AS contact_role_label,
      contact_role_values.description AS contact_role_description, contact_role_values.color AS contact_role_color,
      contact_role_values.is_default AS contact_role_is_default, contact_role_values.is_active AS contact_role_is_active,
      owner_users.id AS owner_id, owner_users.display_name AS owner_display_name, owner_users.email AS owner_email,
      owner_teams.name AS owner_team_name, owner_departments.name AS owner_department_name,
      assignee_users.id AS assignee_id, assignee_users.display_name AS assignee_display_name, assignee_users.email AS assignee_email,
      assignee_teams.name AS assignee_team_name, assignee_departments.name AS assignee_department_name,
      status_values.id AS status_id, status_values.value_key AS status_key, status_values.label AS status_label,
      status_values.description AS status_description, status_values.color AS status_color, status_values.is_default AS status_is_default, status_values.is_active AS status_is_active,
      priority_values.id AS priority_id, priority_values.value_key AS priority_key, priority_values.label AS priority_label,
      priority_values.description AS priority_description, priority_values.color AS priority_color, priority_values.is_default AS priority_is_default, priority_values.is_active AS priority_is_active,
      category_values.id AS category_id, category_values.value_key AS category_key, category_values.label AS category_label,
      category_values.description AS category_description, category_values.color AS category_color, category_values.is_default AS category_is_default, category_values.is_active AS category_is_active,
      source_values.id AS source_id, source_values.value_key AS source_key, source_values.label AS source_label,
      source_values.description AS source_description, source_values.color AS source_color, source_values.is_default AS source_is_default, source_values.is_active AS source_is_active,
      sla_policies.id AS sla_policy_id, sla_policies.name AS sla_policy_name, sla_policies.first_response_minutes AS sla_first_response_minutes,
      sla_policies.resolution_minutes AS sla_resolution_minutes, sla_policies.is_active AS sla_is_active,
      sla_policies.created_at AS sla_created_at, sla_policies.updated_at AS sla_updated_at,
      sla_priority_values.id AS sla_priority_id, sla_priority_values.value_key AS sla_priority_key, sla_priority_values.label AS sla_priority_label,
      sla_priority_values.description AS sla_priority_description, sla_priority_values.color AS sla_priority_color,
      sla_priority_values.is_default AS sla_priority_is_default, sla_priority_values.is_active AS sla_priority_is_active,
      COALESCE(message_counts.count, 0)::int AS message_count,
      COALESCE(article_counts.count, 0)::int AS article_count
    `;
  }

  private ticketFromClause() {
    return `
      FROM support_tickets
      INNER JOIN tenant_option_values AS status_values
        ON status_values.id = support_tickets.status_option_id AND status_values.tenant_id = support_tickets.tenant_id
      INNER JOIN tenant_option_values AS priority_values
        ON priority_values.id = support_tickets.priority_option_id AND priority_values.tenant_id = support_tickets.tenant_id
      INNER JOIN tenant_option_values AS category_values
        ON category_values.id = support_tickets.category_option_id AND category_values.tenant_id = support_tickets.tenant_id
      INNER JOIN tenant_option_values AS source_values
        ON source_values.id = support_tickets.source_option_id AND source_values.tenant_id = support_tickets.tenant_id
      LEFT JOIN accounts AS ticket_accounts
        ON ticket_accounts.id = support_tickets.account_id AND ticket_accounts.tenant_id = support_tickets.tenant_id AND ticket_accounts.deleted_at IS NULL
      LEFT JOIN accounts AS cs_accounts
        ON cs_accounts.id = support_tickets.customer_success_account_id AND cs_accounts.tenant_id = support_tickets.tenant_id AND cs_accounts.deleted_at IS NULL
      LEFT JOIN contacts
        ON contacts.id = support_tickets.contact_id AND contacts.tenant_id = support_tickets.tenant_id AND contacts.deleted_at IS NULL
      LEFT JOIN tenant_option_values AS contact_role_values
        ON contact_role_values.id = contacts.role_option_id AND contact_role_values.tenant_id = contacts.tenant_id
      LEFT JOIN users AS owner_users
        ON owner_users.id = support_tickets.owner_id AND owner_users.tenant_id = support_tickets.tenant_id AND owner_users.deleted_at IS NULL
      LEFT JOIN teams AS owner_teams ON owner_teams.id = owner_users.team_id AND owner_teams.tenant_id = owner_users.tenant_id AND owner_teams.deleted_at IS NULL
      LEFT JOIN departments AS owner_departments ON owner_departments.id = owner_users.department_id AND owner_departments.tenant_id = owner_users.tenant_id AND owner_departments.deleted_at IS NULL
      LEFT JOIN users AS assignee_users
        ON assignee_users.id = support_tickets.assignee_id AND assignee_users.tenant_id = support_tickets.tenant_id AND assignee_users.deleted_at IS NULL
      LEFT JOIN teams AS assignee_teams ON assignee_teams.id = assignee_users.team_id AND assignee_teams.tenant_id = assignee_users.tenant_id AND assignee_teams.deleted_at IS NULL
      LEFT JOIN departments AS assignee_departments ON assignee_departments.id = assignee_users.department_id AND assignee_departments.tenant_id = assignee_users.tenant_id AND assignee_departments.deleted_at IS NULL
      LEFT JOIN support_sla_policies AS sla_policies
        ON sla_policies.id = support_tickets.sla_policy_id AND sla_policies.tenant_id = support_tickets.tenant_id AND sla_policies.deleted_at IS NULL
      LEFT JOIN tenant_option_values AS sla_priority_values
        ON sla_priority_values.id = sla_policies.priority_option_id AND sla_priority_values.tenant_id = sla_policies.tenant_id
      LEFT JOIN (
        SELECT tenant_id, ticket_id, COUNT(*) AS count FROM support_ticket_messages WHERE deleted_at IS NULL GROUP BY tenant_id, ticket_id
      ) AS message_counts ON message_counts.tenant_id = support_tickets.tenant_id AND message_counts.ticket_id = support_tickets.id
      LEFT JOIN (
        SELECT tenant_id, ticket_id, COUNT(*) AS count FROM support_ticket_articles WHERE deleted_at IS NULL GROUP BY tenant_id, ticket_id
      ) AS article_counts ON article_counts.tenant_id = support_tickets.tenant_id AND article_counts.ticket_id = support_tickets.id
    `;
  }

  private mapTicketSummary(row: SupportTicketRow): SupportTicketSummary {
    return {
      id: row.id,
      subject: row.subject,
      status: mapOptionValue({
        id: row.status_id, key: row.status_key, label: row.status_label, description: row.status_description,
        color: row.status_color, isDefault: row.status_is_default, isActive: row.status_is_active
      }),
      priority: mapOptionValue({
        id: row.priority_id, key: row.priority_key, label: row.priority_label, description: row.priority_description,
        color: row.priority_color, isDefault: row.priority_is_default, isActive: row.priority_is_active
      }),
      category: mapOptionValue({
        id: row.category_id, key: row.category_key, label: row.category_label, description: row.category_description,
        color: row.category_color, isDefault: row.category_is_default, isActive: row.category_is_active
      }),
      source: mapOptionValue({
        id: row.source_id, key: row.source_key, label: row.source_label, description: row.source_description,
        color: row.source_color, isDefault: row.source_is_default, isActive: row.source_is_active
      }),
      account: row.account_id ? { id: row.account_id, name: row.account_name ?? "", website: row.account_website } : null,
      contact: row.contact_id
        ? mapContact({
            id: row.contact_id, first_name: row.contact_first_name ?? "", last_name: row.contact_last_name ?? "", email: row.contact_email,
            role_id: row.contact_role_id, role_key: row.contact_role_key, role_label: row.contact_role_label, role_description: row.contact_role_description,
            role_color: row.contact_role_color, role_is_default: row.contact_role_is_default, role_is_active: row.contact_role_is_active
          })
        : null,
      customerSuccessAccount: row.cs_account_id ? { id: row.cs_account_id, name: row.cs_account_name ?? "", website: row.cs_account_website } : null,
      owner: mapUser({
        id: row.owner_id, displayName: row.owner_display_name, email: row.owner_email, teamName: row.owner_team_name, departmentName: row.owner_department_name
      }),
      assignee: mapUser({
        id: row.assignee_id, displayName: row.assignee_display_name, email: row.assignee_email, teamName: row.assignee_team_name, departmentName: row.assignee_department_name
      }),
      escalationStatus: normalizeEscalationStatus(row.escalation_status),
      sla: computeSlaStatus(row),
      messageCount: row.message_count,
      articleCount: row.article_count,
      metadata: getMetadata(row.metadata),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private async loadTicketMessages(client: PoolClient, tenantId: string, ticketId: string): Promise<SupportTicketMessageSummary[]> {
    const result = await client.query<{
      id: string; message_type: string; body: string; created_at: Date; updated_at: Date;
      author_id: string | null; author_display_name: string | null; author_email: string | null; author_team_name: string | null; author_department_name: string | null;
    }>(
      `
        SELECT
          support_ticket_messages.id, support_ticket_messages.message_type, support_ticket_messages.body,
          support_ticket_messages.created_at, support_ticket_messages.updated_at,
          author_users.id AS author_id, author_users.display_name AS author_display_name, author_users.email AS author_email,
          author_teams.name AS author_team_name, author_departments.name AS author_department_name
        FROM support_ticket_messages
        LEFT JOIN users AS author_users ON author_users.id = support_ticket_messages.author_id AND author_users.tenant_id = support_ticket_messages.tenant_id AND author_users.deleted_at IS NULL
        LEFT JOIN teams AS author_teams ON author_teams.id = author_users.team_id AND author_teams.tenant_id = author_users.tenant_id AND author_teams.deleted_at IS NULL
        LEFT JOIN departments AS author_departments ON author_departments.id = author_users.department_id AND author_departments.tenant_id = author_users.tenant_id AND author_departments.deleted_at IS NULL
        WHERE support_ticket_messages.tenant_id = $1 AND support_ticket_messages.ticket_id = $2 AND support_ticket_messages.deleted_at IS NULL
        ORDER BY support_ticket_messages.created_at ASC
      `,
      [tenantId, ticketId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      messageType: (MESSAGE_TYPES.includes(row.message_type as SupportTicketMessageType) ? row.message_type : "internal_note") as SupportTicketMessageType,
      body: row.body,
      author: mapUser({
        id: row.author_id, displayName: row.author_display_name, email: row.author_email, teamName: row.author_team_name, departmentName: row.author_department_name
      }),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    }));
  }

  private mapArticle(row: KnowledgeArticleRow): SupportKnowledgeArticleSummary {
    return {
      id: row.id,
      title: row.title,
      category: mapOptionValue({
        id: row.category_id, key: row.category_key, label: row.category_label, description: row.category_description,
        color: row.category_color, isDefault: row.category_is_default, isActive: row.category_is_active
      }),
      summary: row.summary,
      body: row.body,
      status: normalizeArticleStatus(row.status),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private knowledgeSelectColumns() {
    return `
      support_knowledge_articles.id, support_knowledge_articles.title, support_knowledge_articles.summary,
      support_knowledge_articles.body, support_knowledge_articles.status, support_knowledge_articles.created_at, support_knowledge_articles.updated_at,
      category_values.id AS category_id, category_values.value_key AS category_key, category_values.label AS category_label,
      category_values.description AS category_description, category_values.color AS category_color,
      category_values.is_default AS category_is_default, category_values.is_active AS category_is_active
    `;
  }

  private knowledgeFromClause() {
    return `
      FROM support_knowledge_articles
      LEFT JOIN tenant_option_values AS category_values
        ON category_values.id = support_knowledge_articles.category_option_id AND category_values.tenant_id = support_knowledge_articles.tenant_id
    `;
  }

  private async loadLinkedArticles(client: PoolClient, tenantId: string, ticketId: string): Promise<SupportKnowledgeArticleSummary[]> {
    const result = await client.query<KnowledgeArticleRow>(
      `
        SELECT ${this.knowledgeSelectColumns()}
        ${this.knowledgeFromClause()}
        INNER JOIN support_ticket_articles
          ON support_ticket_articles.article_id = support_knowledge_articles.id AND support_ticket_articles.tenant_id = support_knowledge_articles.tenant_id
        WHERE support_ticket_articles.tenant_id = $1 AND support_ticket_articles.ticket_id = $2
          AND support_ticket_articles.deleted_at IS NULL AND support_knowledge_articles.deleted_at IS NULL
        ORDER BY support_ticket_articles.created_at DESC
      `,
      [tenantId, ticketId]
    );

    return result.rows.map((row) => this.mapArticle(row));
  }

  async getSupportOptions(actor: ActorContext): Promise<SupportTicketOptionsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => ({
      owners: await this.loadOwners(client, actor.tenantId),
      accounts: await this.loadAccountsLookup(client, actor.tenantId),
      contacts: await this.loadContactsLookup(client, actor.tenantId),
      statuses: await this.loadOptionSetValues(client, actor.tenantId, "support-ticket-status"),
      priorities: await this.loadOptionSetValues(client, actor.tenantId, "support-ticket-priority"),
      categories: await this.loadOptionSetValues(client, actor.tenantId, "support-ticket-category"),
      sources: await this.loadOptionSetValues(client, actor.tenantId, "support-ticket-source"),
      knowledgeCategories: await this.loadOptionSetValues(client, actor.tenantId, "support-knowledge-category"),
      slaPolicies: (await this.loadSlaPolicies(client, actor.tenantId)).policies,
      availableScopes: await this.getAvailableScopes(client, actor)
    }));
  }

  private async buildScopedWhere(client: PoolClient, actor: ActorContext, scope: SupportTicketScope) {
    const conditions = ["support_tickets.tenant_id = $1", "support_tickets.deleted_at IS NULL"];
    const params: unknown[] = [actor.tenantId];

    if (scope === "mine") {
      params.push(actor.userId);
      conditions.push(`(support_tickets.assignee_id = $${params.length} OR support_tickets.owner_id = $${params.length})`);
    } else if (scope === "team") {
      const actorTeamId = await this.getActorTeamId(client, actor.tenantId, actor.userId);
      params.push(actorTeamId);
      conditions.push(`(owner_users.team_id = $${params.length} OR assignee_users.team_id = $${params.length})`);
    }

    return { conditions, params };
  }

  async listTickets(actor: ActorContext, query: SupportTicketListQuery): Promise<SupportTicketsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const scope = await this.resolveScope(client, actor, query.scope);
      const page = Math.max(1, query.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
      const { conditions, params } = await this.buildScopedWhere(client, actor, scope);

      if (query.search) {
        params.push(`%${query.search.trim()}%`);
        conditions.push(`(support_tickets.subject ILIKE $${params.length} OR support_tickets.description ILIKE $${params.length})`);
      }
      if (query.status) {
        params.push(query.status);
        conditions.push(`status_values.value_key = $${params.length}`);
      }
      if (query.priority) {
        params.push(query.priority);
        conditions.push(`priority_values.value_key = $${params.length}`);
      }
      if (query.category) {
        params.push(query.category);
        conditions.push(`category_values.value_key = $${params.length}`);
      }
      if (query.source) {
        params.push(query.source);
        conditions.push(`source_values.value_key = $${params.length}`);
      }
      if (query.assigneeId) {
        params.push(query.assigneeId);
        conditions.push(`support_tickets.assignee_id = $${params.length}`);
      }
      if (query.accountId) {
        params.push(query.accountId);
        conditions.push(`support_tickets.account_id = $${params.length}`);
      }
      if (query.escalationStatus) {
        params.push(query.escalationStatus);
        conditions.push(`support_tickets.escalation_status = $${params.length}`);
      }
      if (query.breachedOnly) {
        conditions.push(
          `((support_tickets.first_response_due_at IS NOT NULL AND COALESCE(support_tickets.first_response_at, NOW()) > support_tickets.first_response_due_at)` +
            ` OR (support_tickets.resolution_due_at IS NOT NULL AND COALESCE(support_tickets.resolved_at, NOW()) > support_tickets.resolution_due_at))`
        );
      }

      const whereClause = conditions.join(" AND ");
      const sortColumnMap: Record<string, string> = {
        subject: "support_tickets.subject",
        priority: "priority_values.sort_order",
        status: "status_values.sort_order",
        createdAt: "support_tickets.created_at",
        updatedAt: "support_tickets.updated_at",
        resolutionDueAt: "support_tickets.resolution_due_at"
      };
      const sortColumn = sortColumnMap[query.sortBy ?? "updatedAt"] ?? "support_tickets.updated_at";
      const sortOrder = query.sortOrder === "asc" ? "ASC" : "DESC";

      const countResult = await client.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total ${this.ticketFromClause()} WHERE ${whereClause}`,
        params
      );
      const total = Number(countResult.rows[0]?.total ?? "0");

      const listParams = [...params, pageSize, (page - 1) * pageSize];
      const listResult = await client.query<SupportTicketRow>(
        `
          SELECT ${this.ticketSelectColumns()}
          ${this.ticketFromClause()}
          WHERE ${whereClause}
          ORDER BY ${sortColumn} ${sortOrder} NULLS LAST, support_tickets.created_at DESC
          LIMIT $${listParams.length - 1} OFFSET $${listParams.length}
        `,
        listParams
      );

      return {
        tickets: listResult.rows.map((row) => this.mapTicketSummary(row)),
        pagination: buildPagination(page, pageSize, total)
      };
    });
  }

  async getSupportDashboard(actor: ActorContext, query: SupportTicketListQuery): Promise<SupportDashboardResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const scope = await this.resolveScope(client, actor, query.scope);
      const { conditions, params } = await this.buildScopedWhere(client, actor, scope);
      const whereClause = conditions.join(" AND ");

      const result = await client.query<SupportTicketRow>(
        `SELECT ${this.ticketSelectColumns()} ${this.ticketFromClause()} WHERE ${whereClause}`,
        params
      );
      const tickets = result.rows.map((row) => this.mapTicketSummary(row));

      const statusMap = new Map<string, { status: CrmOptionValueSummary | null; ticketCount: number }>();
      const priorityMap = new Map<string, { priority: CrmOptionValueSummary | null; ticketCount: number }>();
      for (const ticket of tickets) {
        const statusKey = ticket.status?.key ?? "__none__";
        const statusEntry = statusMap.get(statusKey) ?? { status: ticket.status, ticketCount: 0 };
        statusEntry.ticketCount += 1;
        statusMap.set(statusKey, statusEntry);

        const priorityKey = ticket.priority?.key ?? "__none__";
        const priorityEntry = priorityMap.get(priorityKey) ?? { priority: ticket.priority, ticketCount: 0 };
        priorityEntry.ticketCount += 1;
        priorityMap.set(priorityKey, priorityEntry);
      }

      const articleCountResult = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM support_knowledge_articles WHERE tenant_id = $1 AND deleted_at IS NULL`,
        [actor.tenantId]
      );

      return {
        scope,
        totalTickets: tickets.length,
        openTickets: tickets.filter((ticket) => !RESOLVED_STATUS_KEYS.has(ticket.status?.key ?? "")).length,
        resolvedTickets: tickets.filter((ticket) => RESOLVED_STATUS_KEYS.has(ticket.status?.key ?? "")).length,
        unassignedTickets: tickets.filter((ticket) => !ticket.assignee).length,
        escalatedTickets: tickets.filter((ticket) => ticket.escalationStatus === "escalated").length,
        slaBreachedTickets: tickets.filter((ticket) => ticket.sla.firstResponseBreached || ticket.sla.resolutionBreached).length,
        statusDistribution: Array.from(statusMap.values()),
        priorityDistribution: Array.from(priorityMap.values()),
        knowledgeArticleCount: Number(articleCountResult.rows[0]?.count ?? "0"),
        csatPlaceholder: {
          available: false,
          message: "CSAT analytics will connect once the survey and feedback pipeline is introduced."
        }
      };
    });
  }

  private async loadTicketDetail(client: PoolClient, actor: ActorContext, ticketId: string): Promise<SupportTicketDetail> {
    const result = await client.query<SupportTicketRow>(
      `
        SELECT ${this.ticketSelectColumns()}
        ${this.ticketFromClause()}
        WHERE support_tickets.tenant_id = $1 AND support_tickets.id = $2 AND support_tickets.deleted_at IS NULL
        LIMIT 1
      `,
      [actor.tenantId, ticketId]
    );

    const row = result.rows[0];

    if (!row) {
      throw new AppError(404, "Support ticket not found.", undefined, "TICKET_NOT_FOUND");
    }

    const summary = this.mapTicketSummary(row);
    const messages = await this.loadTicketMessages(client, actor.tenantId, ticketId);
    const articles = await this.loadLinkedArticles(client, actor.tenantId, ticketId);

    return {
      ...summary,
      description: row.description,
      rootCause: row.root_cause,
      resolutionNotes: row.resolution_notes,
      messages,
      articles,
      attachmentsPlaceholder: { available: false, message: "Ticket attachments will connect once the file storage runtime is introduced." },
      csatPlaceholder: { available: false, message: "CSAT capture will connect once the survey and feedback pipeline is introduced." },
      escalationPlaceholder: { available: false, message: "Automated escalation workflows will connect once the escalation runtime is introduced." },
      aiPlaceholders: this.buildAiPlaceholders(actor)
    };
  }

  async getTicket(actor: ActorContext, ticketId: string): Promise<SupportTicketResponse> {
    this.assertEnabled();

    const ticket = await this.databaseService.withClient(async (client) => this.loadTicketDetail(client, actor, ticketId));
    return { ticket };
  }

  async createTicket(actor: ActorContext, audit: AuditMetadata, input: CreateSupportTicketRequestBody): Promise<SupportTicketResponse> {
    this.assertEnabled();

    const ticketId = await this.databaseService.withTransaction(async (client) => {
      const accountId = await this.ensureReference(client, actor.tenantId, "accounts", input.accountId ?? null, "INVALID_ACCOUNT", "account");
      const contactId = await this.ensureReference(client, actor.tenantId, "contacts", input.contactId ?? null, "INVALID_CONTACT", "contact");
      const csAccountId = await this.ensureReference(client, actor.tenantId, "accounts", input.customerSuccessAccountId ?? null, "INVALID_ACCOUNT", "customer success account");
      const ownerId = await this.ensureReference(client, actor.tenantId, "users", input.ownerId ?? null, "INVALID_OWNER", "owner");
      const assigneeId = await this.ensureReference(client, actor.tenantId, "users", input.assigneeId ?? null, "INVALID_ASSIGNEE", "assignee");
      const slaPolicyId = await this.ensureSlaPolicyId(client, actor.tenantId, input.slaPolicyId ?? null);
      const statusOptionId = await this.resolveOptionValueId(client, actor.tenantId, "support-ticket-status", input.statusKey ?? "new", "Ticket status");
      const priorityOptionId = await this.resolveOptionValueId(client, actor.tenantId, "support-ticket-priority", input.priorityKey ?? "medium", "Ticket priority");
      const categoryOptionId = await this.resolveOptionValueId(client, actor.tenantId, "support-ticket-category", input.categoryKey ?? "technical", "Ticket category");
      const sourceOptionId = await this.resolveOptionValueId(client, actor.tenantId, "support-ticket-source", input.sourceKey ?? "email", "Ticket source");

      let firstResponseMinutes: number | null = null;
      let resolutionMinutes: number | null = null;
      if (slaPolicyId) {
        const policyResult = await client.query<{ first_response_minutes: number; resolution_minutes: number }>(
          `SELECT first_response_minutes, resolution_minutes FROM support_sla_policies WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
          [slaPolicyId, actor.tenantId]
        );
        firstResponseMinutes = policyResult.rows[0]?.first_response_minutes ?? null;
        resolutionMinutes = policyResult.rows[0]?.resolution_minutes ?? null;
      }

      const result = await client.query<{ id: string }>(
        `
          INSERT INTO support_tickets (
            tenant_id, account_id, contact_id, customer_success_account_id, owner_id, assignee_id, sla_policy_id,
            subject, description, status_option_id, priority_option_id, category_option_id, source_option_id,
            escalation_status, root_cause, resolution_notes, first_response_due_at, resolution_due_at, metadata, created_by, updated_by
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
            CASE WHEN $17::int IS NULL THEN NULL ELSE NOW() + ($17::int * INTERVAL '1 minute') END,
            CASE WHEN $18::int IS NULL THEN NULL ELSE NOW() + ($18::int * INTERVAL '1 minute') END,
            $19::jsonb, $20, $20
          )
          RETURNING id
        `,
        [
          actor.tenantId,
          accountId,
          contactId,
          csAccountId,
          ownerId,
          assigneeId,
          slaPolicyId,
          input.subject.trim(),
          getTrimmedNullableString(input.description),
          statusOptionId,
          priorityOptionId,
          categoryOptionId,
          sourceOptionId,
          normalizeEscalationStatus(input.escalationStatus),
          getTrimmedNullableString(input.rootCause),
          getTrimmedNullableString(input.resolutionNotes),
          firstResponseMinutes,
          resolutionMinutes,
          JSON.stringify(input.metadata ?? {}),
          actor.userId
        ]
      );

      const nextTicketId = result.rows[0]?.id;

      if (!nextTicketId) {
        throw new AppError(500, "Support ticket creation failed.", undefined, "TICKET_CREATE_FAILED");
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "support.ticket.create",
        resourceType: "support_ticket",
        resourceId: nextTicketId,
        status: "success",
        metadata: { priorityKey: input.priorityKey ?? "medium", assigneeId, slaPolicyId }
      });

      return nextTicketId;
    });

    return this.getTicket(actor, ticketId);
  }

  async updateTicket(actor: ActorContext, audit: AuditMetadata, ticketId: string, input: UpdateSupportTicketRequestBody): Promise<SupportTicketResponse> {
    this.assertEnabled();

    await this.databaseService.withTransaction(async (client) => {
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateSupportTicketRequestBody] !== undefined);
      this.assertTicketMutation(actor, keys);
      const state = await this.getTicketState(client, actor.tenantId, ticketId);

      const assignments: string[] = [];
      const params: unknown[] = [ticketId, actor.tenantId, actor.userId];

      const pushAssignment = (column: string, value: unknown, cast = "") => {
        params.push(value);
        assignments.push(`${column} = $${params.length}${cast}`);
      };

      if (keys.includes("subject") && input.subject !== undefined) {
        pushAssignment("subject", input.subject.trim());
      }
      if (keys.includes("description")) {
        pushAssignment("description", getTrimmedNullableString(input.description));
      }
      let nextStatusKey = state.status_key;
      if (keys.includes("statusKey") && input.statusKey) {
        pushAssignment("status_option_id", await this.resolveOptionValueId(client, actor.tenantId, "support-ticket-status", input.statusKey, "Ticket status"));
        nextStatusKey = input.statusKey;
      }
      if (keys.includes("priorityKey") && input.priorityKey) {
        pushAssignment("priority_option_id", await this.resolveOptionValueId(client, actor.tenantId, "support-ticket-priority", input.priorityKey, "Ticket priority"));
      }
      if (keys.includes("categoryKey") && input.categoryKey) {
        pushAssignment("category_option_id", await this.resolveOptionValueId(client, actor.tenantId, "support-ticket-category", input.categoryKey, "Ticket category"));
      }
      if (keys.includes("sourceKey") && input.sourceKey) {
        pushAssignment("source_option_id", await this.resolveOptionValueId(client, actor.tenantId, "support-ticket-source", input.sourceKey, "Ticket source"));
      }
      if (keys.includes("accountId")) {
        pushAssignment("account_id", await this.ensureReference(client, actor.tenantId, "accounts", input.accountId ?? null, "INVALID_ACCOUNT", "account"));
      }
      if (keys.includes("contactId")) {
        pushAssignment("contact_id", await this.ensureReference(client, actor.tenantId, "contacts", input.contactId ?? null, "INVALID_CONTACT", "contact"));
      }
      if (keys.includes("customerSuccessAccountId")) {
        pushAssignment("customer_success_account_id", await this.ensureReference(client, actor.tenantId, "accounts", input.customerSuccessAccountId ?? null, "INVALID_ACCOUNT", "customer success account"));
      }
      if (keys.includes("ownerId")) {
        pushAssignment("owner_id", await this.ensureReference(client, actor.tenantId, "users", input.ownerId ?? null, "INVALID_OWNER", "owner"));
      }
      if (keys.includes("assigneeId")) {
        pushAssignment("assignee_id", await this.ensureReference(client, actor.tenantId, "users", input.assigneeId ?? null, "INVALID_ASSIGNEE", "assignee"));
      }
      if (keys.includes("slaPolicyId")) {
        pushAssignment("sla_policy_id", await this.ensureSlaPolicyId(client, actor.tenantId, input.slaPolicyId ?? null));
      }
      if (keys.includes("escalationStatus")) {
        pushAssignment("escalation_status", normalizeEscalationStatus(input.escalationStatus));
      }
      if (keys.includes("rootCause")) {
        pushAssignment("root_cause", getTrimmedNullableString(input.rootCause));
      }
      if (keys.includes("resolutionNotes")) {
        pushAssignment("resolution_notes", getTrimmedNullableString(input.resolutionNotes));
      }
      if (keys.includes("metadata")) {
        pushAssignment("metadata", JSON.stringify(input.metadata ?? {}), "::jsonb");
      }

      // Maintain resolved_at based on status transitions.
      if (keys.includes("statusKey")) {
        const wasResolved = RESOLVED_STATUS_KEYS.has(state.status_key);
        const isResolved = RESOLVED_STATUS_KEYS.has(nextStatusKey);
        if (isResolved && !wasResolved && !state.resolved_at) {
          assignments.push("resolved_at = NOW()");
        } else if (!isResolved && wasResolved) {
          assignments.push("resolved_at = NULL");
        }
      }

      if (assignments.length > 0) {
        await client.query(
          `UPDATE support_tickets SET ${assignments.join(", ")}, updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          params
        );
      } else {
        await client.query(`UPDATE support_tickets SET updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, params);
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "support.ticket.update",
        resourceType: "support_ticket",
        resourceId: ticketId,
        status: "success",
        metadata: { updatedFields: keys }
      });
    });

    return this.getTicket(actor, ticketId);
  }

  async deleteTicket(actor: ActorContext, audit: AuditMetadata, ticketId: string): Promise<CrmMutationSuccessResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      await this.getTicketState(client, actor.tenantId, ticketId);

      for (const table of ["support_ticket_messages", "support_ticket_articles"]) {
        await client.query(
          `UPDATE ${table} SET deleted_at = NOW(), updated_by = $3 WHERE tenant_id = $1 AND ticket_id = $2 AND deleted_at IS NULL`,
          [actor.tenantId, ticketId, actor.userId]
        );
      }
      await client.query(
        `UPDATE support_tickets SET deleted_at = NOW(), updated_by = $3 WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [actor.tenantId, ticketId, actor.userId]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "support.ticket.delete",
        resourceType: "support_ticket",
        resourceId: ticketId,
        status: "success"
      });

      return { success: true };
    });
  }

  async addTicketMessage(actor: ActorContext, audit: AuditMetadata, ticketId: string, input: CreateSupportTicketMessageRequestBody): Promise<SupportTicketResponse> {
    this.assertEnabled();

    await this.databaseService.withTransaction(async (client) => {
      const state = await this.getTicketState(client, actor.tenantId, ticketId);
      const body = input.body.trim();

      if (body.length === 0) {
        throw new AppError(400, "Message body is required.", undefined, "VALIDATION_ERROR");
      }

      const messageType: SupportTicketMessageType = MESSAGE_TYPES.includes(input.messageType) ? input.messageType : "internal_note";

      await client.query(
        `
          INSERT INTO support_ticket_messages (tenant_id, ticket_id, author_id, message_type, body, metadata, created_by, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $3, $3)
        `,
        [actor.tenantId, ticketId, actor.userId, messageType, body, JSON.stringify(input.metadata ?? {})]
      );

      // The first customer-visible reply records the first response time for SLA tracking.
      if (messageType === "customer_reply" && !state.first_response_at) {
        await client.query(
          `UPDATE support_tickets SET first_response_at = NOW(), updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          [ticketId, actor.tenantId, actor.userId]
        );
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "support.ticket.message.create",
        resourceType: "support_ticket",
        resourceId: ticketId,
        status: "success",
        metadata: { messageType }
      });
    });

    return this.getTicket(actor, ticketId);
  }

  // ==========================================================================
  // SLA policies
  // ==========================================================================

  private async loadSlaPolicies(client: PoolClient, tenantId: string): Promise<SupportSlaPoliciesResponse> {
    const result = await client.query<SlaPolicyRow>(
      `
        SELECT
          support_sla_policies.id, support_sla_policies.name, support_sla_policies.first_response_minutes,
          support_sla_policies.resolution_minutes, support_sla_policies.is_active, support_sla_policies.created_at, support_sla_policies.updated_at,
          priority_values.id AS priority_id, priority_values.value_key AS priority_key, priority_values.label AS priority_label,
          priority_values.description AS priority_description, priority_values.color AS priority_color,
          priority_values.is_default AS priority_is_default, priority_values.is_active AS priority_is_active
        FROM support_sla_policies
        LEFT JOIN tenant_option_values AS priority_values
          ON priority_values.id = support_sla_policies.priority_option_id AND priority_values.tenant_id = support_sla_policies.tenant_id
        WHERE support_sla_policies.tenant_id = $1 AND support_sla_policies.deleted_at IS NULL
        ORDER BY support_sla_policies.created_at ASC
      `,
      [tenantId]
    );

    return { policies: result.rows.map((row) => this.mapSlaPolicy(row)) };
  }

  async listSlaPolicies(actor: ActorContext): Promise<SupportSlaPoliciesResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => this.loadSlaPolicies(client, actor.tenantId));
  }

  async createSlaPolicy(actor: ActorContext, audit: AuditMetadata, input: CreateSupportSlaPolicyRequestBody): Promise<SupportSlaPolicyResponse> {
    this.assertEnabled();

    const canConfigure = actor.permissionCodes.includes("support.configure") || actor.permissionCodes.includes("support.manage_workflow");

    if (!canConfigure) {
      throw new AppError(403, "You do not have permission to configure SLA policies.", undefined, "AUTHORIZATION_ERROR");
    }

    const policyId = await this.databaseService.withTransaction(async (client) => {
      const priorityOptionId = input.priorityKey
        ? await this.resolveOptionValueId(client, actor.tenantId, "support-ticket-priority", input.priorityKey, "Ticket priority")
        : null;

      const result = await client.query<{ id: string }>(
        `
          INSERT INTO support_sla_policies (tenant_id, name, priority_option_id, first_response_minutes, resolution_minutes, is_active, metadata, created_by, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $8)
          RETURNING id
        `,
        [
          actor.tenantId,
          input.name.trim(),
          priorityOptionId,
          input.firstResponseMinutes,
          input.resolutionMinutes,
          input.isActive ?? true,
          JSON.stringify(input.metadata ?? {}),
          actor.userId
        ]
      );

      const nextPolicyId = result.rows[0]?.id;

      if (!nextPolicyId) {
        throw new AppError(500, "SLA policy creation failed.", undefined, "SLA_POLICY_CREATE_FAILED");
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "support.sla_policy.create",
        resourceType: "support_sla_policy",
        resourceId: nextPolicyId,
        status: "success"
      });

      return nextPolicyId;
    });

    const policies = await this.databaseService.withClient(async (client) => this.loadSlaPolicies(client, actor.tenantId));
    const policy = policies.policies.find((entry) => entry.id === policyId);

    if (!policy) {
      throw new AppError(500, "SLA policy creation failed.", undefined, "SLA_POLICY_CREATE_FAILED");
    }

    return { policy };
  }

  // ==========================================================================
  // Knowledge base
  // ==========================================================================

  async listKnowledgeArticles(actor: ActorContext): Promise<SupportKnowledgeArticlesResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const result = await client.query<KnowledgeArticleRow>(
        `
          SELECT ${this.knowledgeSelectColumns()}
          ${this.knowledgeFromClause()}
          WHERE support_knowledge_articles.tenant_id = $1 AND support_knowledge_articles.deleted_at IS NULL
          ORDER BY support_knowledge_articles.updated_at DESC
        `,
        [actor.tenantId]
      );

      return { articles: result.rows.map((row) => this.mapArticle(row)) };
    });
  }

  async createKnowledgeArticle(actor: ActorContext, audit: AuditMetadata, input: CreateSupportKnowledgeArticleRequestBody): Promise<SupportKnowledgeArticleResponse> {
    this.assertEnabled();

    const articleId = await this.databaseService.withTransaction(async (client) => {
      const categoryOptionId = input.categoryKey
        ? await this.resolveOptionValueId(client, actor.tenantId, "support-knowledge-category", input.categoryKey, "Knowledge category")
        : null;

      const result = await client.query<{ id: string }>(
        `
          INSERT INTO support_knowledge_articles (tenant_id, title, category_option_id, summary, body, status, metadata, created_by, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $8)
          RETURNING id
        `,
        [
          actor.tenantId,
          input.title.trim(),
          categoryOptionId,
          getTrimmedNullableString(input.summary),
          getTrimmedNullableString(input.body),
          normalizeArticleStatus(input.status),
          JSON.stringify(input.metadata ?? {}),
          actor.userId
        ]
      );

      const nextArticleId = result.rows[0]?.id;

      if (!nextArticleId) {
        throw new AppError(500, "Knowledge article creation failed.", undefined, "ARTICLE_CREATE_FAILED");
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "support.article.create",
        resourceType: "support_knowledge_article",
        resourceId: nextArticleId,
        status: "success"
      });

      return nextArticleId;
    });

    const articles = await this.listKnowledgeArticles(actor);
    const article = articles.articles.find((entry) => entry.id === articleId);

    if (!article) {
      throw new AppError(500, "Knowledge article creation failed.", undefined, "ARTICLE_CREATE_FAILED");
    }

    return { article };
  }

  async linkArticleToTicket(actor: ActorContext, audit: AuditMetadata, ticketId: string, articleId: string): Promise<SupportTicketResponse> {
    this.assertEnabled();

    await this.databaseService.withTransaction(async (client) => {
      await this.getTicketState(client, actor.tenantId, ticketId);

      const articleResult = await client.query<{ id: string }>(
        `SELECT id FROM support_knowledge_articles WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
        [articleId, actor.tenantId]
      );

      if (!articleResult.rows[0]) {
        throw new AppError(400, "The selected knowledge article is invalid for this tenant.", undefined, "INVALID_ARTICLE");
      }

      const existing = await client.query<{ id: string }>(
        `SELECT id FROM support_ticket_articles WHERE tenant_id = $1 AND ticket_id = $2 AND article_id = $3 AND deleted_at IS NULL LIMIT 1`,
        [actor.tenantId, ticketId, articleId]
      );

      if (!existing.rows[0]) {
        await client.query(
          `INSERT INTO support_ticket_articles (tenant_id, ticket_id, article_id, created_by, updated_by) VALUES ($1, $2, $3, $4, $4)`,
          [actor.tenantId, ticketId, articleId, actor.userId]
        );

        await this.recordAuditLog(client, actor, audit, {
          action: "support.ticket.article.link",
          resourceType: "support_ticket",
          resourceId: ticketId,
          status: "success",
          metadata: { articleId }
        });
      }
    });

    return this.getTicket(actor, ticketId);
  }
}

interface SupportTicketRow {
  id: string;
  subject: string;
  description: string | null;
  escalation_status: string;
  root_cause: string | null;
  resolution_notes: string | null;
  first_response_due_at: Date | null;
  resolution_due_at: Date | null;
  first_response_at: Date | null;
  resolved_at: Date | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  account_id: string | null;
  account_name: string | null;
  account_website: string | null;
  cs_account_id: string | null;
  cs_account_name: string | null;
  cs_account_website: string | null;
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
  status_id: string | null;
  status_key: string | null;
  status_label: string | null;
  status_description: string | null;
  status_color: string | null;
  status_is_default: boolean | null;
  status_is_active: boolean | null;
  priority_id: string | null;
  priority_key: string | null;
  priority_label: string | null;
  priority_description: string | null;
  priority_color: string | null;
  priority_is_default: boolean | null;
  priority_is_active: boolean | null;
  category_id: string | null;
  category_key: string | null;
  category_label: string | null;
  category_description: string | null;
  category_color: string | null;
  category_is_default: boolean | null;
  category_is_active: boolean | null;
  source_id: string | null;
  source_key: string | null;
  source_label: string | null;
  source_description: string | null;
  source_color: string | null;
  source_is_default: boolean | null;
  source_is_active: boolean | null;
  sla_policy_id: string | null;
  sla_policy_name: string | null;
  sla_first_response_minutes: number | null;
  sla_resolution_minutes: number | null;
  sla_is_active: boolean | null;
  sla_created_at: Date | null;
  sla_updated_at: Date | null;
  sla_priority_id: string | null;
  sla_priority_key: string | null;
  sla_priority_label: string | null;
  sla_priority_description: string | null;
  sla_priority_color: string | null;
  sla_priority_is_default: boolean | null;
  sla_priority_is_active: boolean | null;
  message_count: number;
  article_count: number;
}

interface SlaPolicyRow {
  id: string;
  name: string;
  first_response_minutes: number;
  resolution_minutes: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  priority_id: string | null;
  priority_key: string | null;
  priority_label: string | null;
  priority_description: string | null;
  priority_color: string | null;
  priority_is_default: boolean | null;
  priority_is_active: boolean | null;
}

interface KnowledgeArticleRow {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
  category_id: string | null;
  category_key: string | null;
  category_label: string | null;
  category_description: string | null;
  category_color: string | null;
  category_is_default: boolean | null;
  category_is_active: boolean | null;
}
