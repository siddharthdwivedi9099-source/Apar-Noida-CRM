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
  UpdateSupportTicketRequestBody,
  CloseTicketRequestBody,
  EscalateTicketRequestBody,
  LogKbUsageRequestBody,
  SupportKbRecommendationsResponse,
  SupportQueueResponse,
  TicketIntakeAssistResponse,
  CreateArticleFromTicketRequestBody,
  EscalateBugRequestBody,
  L2InvestigationResponse,
  PublishKnowledgeArticleRequestBody,
  RequestRcaShareRequestBody,
  UpdateBugStatusRequestBody,
  UpdateInvestigationRequestBody,
  UpsertRcaRequestBody
} from "@crm/types";
import { computeQueueWeight, rankKnowledgeArticles, suggestTicketClassification } from "@crm/types";
import { bugSeverities, bugSyncStatuses, isRcaRequired } from "@crm/types";
import type {
  AgentTicketFact,
  ReassignTicketsRequestBody,
  ReassignTicketsResponse,
  RecordBreachReviewRequestBody,
  RecordCsatRequestBody,
  ReviewEscalationRequestBody,
  SupportAgentPerformance,
  SupportAgentWorkload,
  SupportEscalationOversightResponse,
  SupportTeamPerformanceResponse,
  SupportWorkloadResponse,
  WorkloadTicketFact
} from "@crm/types";
import { computeAgentPerformance, computeWorkload, escalationReviewDecisions, resolveCsatBand } from "@crm/types";
import type { PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import {
  loadCustomFieldDefinitions,
  loadCustomFieldOptions,
  sanitizeCustomFields
} from "../../common/custom-fields.js";
import { buildPagination } from "../../common/pagination.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { NotificationService } from "../notifications/notifications.service.js";
import { ApprovalService } from "../approvals/approvals.service.js";
import { randomUUID } from "node:crypto";

const SUPPORT_TICKET_ENTITY_KEY = "support_ticket";

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
  private readonly notificationService: NotificationService;
  private readonly approvalService: ApprovalService;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {
    this.notificationService = new NotificationService(databaseService, config);
    this.approvalService = new ApprovalService(databaseService, config);
  }

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
      custom_fields: Record<string, unknown> | null;
    }>(
      `
        SELECT support_tickets.id, support_tickets.assignee_id, support_tickets.owner_id,
          support_tickets.first_response_at, support_tickets.resolved_at, support_tickets.custom_fields, status_values.value_key AS status_key
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
      support_tickets.custom_fields,
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

    return this.databaseService.withClient(async (client) => {
      const fieldDefinitions = await loadCustomFieldDefinitions(client, actor.tenantId, SUPPORT_TICKET_ENTITY_KEY);
      const customFieldOptions = await loadCustomFieldOptions(client, actor.tenantId, fieldDefinitions);

      return {
        owners: await this.loadOwners(client, actor.tenantId),
        accounts: await this.loadAccountsLookup(client, actor.tenantId),
        contacts: await this.loadContactsLookup(client, actor.tenantId),
        statuses: await this.loadOptionSetValues(client, actor.tenantId, "support-ticket-status"),
        priorities: await this.loadOptionSetValues(client, actor.tenantId, "support-ticket-priority"),
        categories: await this.loadOptionSetValues(client, actor.tenantId, "support-ticket-category"),
        sources: await this.loadOptionSetValues(client, actor.tenantId, "support-ticket-source"),
        knowledgeCategories: await this.loadOptionSetValues(client, actor.tenantId, "support-knowledge-category"),
        rootCauses: await this.loadOptionSetValues(client, actor.tenantId, "support-root-cause"),
        breachReasons: await this.loadOptionSetValues(client, actor.tenantId, "support-breach-reason"),
        slaPolicies: (await this.loadSlaPolicies(client, actor.tenantId)).policies,
        availableScopes: await this.getAvailableScopes(client, actor),
        fieldDefinitions,
        customFieldOptions
      };
    });
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

      // Persona 23 (Support Manager) SPM-005: surface the real CSAT aggregate from captured surveys.
      const csat = this.summarizeCsat(tickets);

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
        },
        csat: {
          responseCount: csat.responseCount,
          averageScore: csat.averageScore,
          detractors: csat.detractors,
          passives: csat.passives,
          promoters: csat.promoters
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
      customFields: getMetadata(row.custom_fields),
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
      const customFields = await sanitizeCustomFields(client, actor.tenantId, SUPPORT_TICKET_ENTITY_KEY, input.customFields);

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
            escalation_status, root_cause, resolution_notes, first_response_due_at, resolution_due_at, custom_fields, metadata, created_by, updated_by
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
            CASE WHEN $17::int IS NULL THEN NULL ELSE NOW() + ($17::int * INTERVAL '1 minute') END,
            CASE WHEN $18::int IS NULL THEN NULL ELSE NOW() + ($18::int * INTERVAL '1 minute') END,
            $19::jsonb, $20::jsonb, $21, $21
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
          JSON.stringify(customFields),
          JSON.stringify({ ...(input.metadata ?? {}), ...(Array.isArray(input.attachments) && input.attachments.length > 0 ? { attachments: input.attachments.filter((ref) => typeof ref === "string") } : {}) }),
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

    // L1-001: auto-acknowledgement on intake (opt-in so portal/API callers are unaffected).
    if (input.autoAcknowledge) {
      await this.acknowledgeTicket(actor, audit, ticketId);
    }

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
      if (keys.includes("customFields")) {
        const nextCustomFields = await sanitizeCustomFields(
          client,
          actor.tenantId,
          SUPPORT_TICKET_ENTITY_KEY,
          input.customFields,
          getMetadata(state.custom_fields)
        );
        pushAssignment("custom_fields", JSON.stringify(nextCustomFields), "::jsonb");
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

  // ---- Persona 21 (Support Agent L1) -----------------------------------------------------------

  private async loadTicketBasics(client: PoolClient, tenantId: string, ticketId: string) {
    const result = await client.query<{ id: string; subject: string; description: string | null; account_id: string | null; owner_id: string | null; priority_key: string | null; metadata: Record<string, unknown> | null }>(
      `
        SELECT t.id, t.subject, t.description, t.account_id, t.owner_id, pv.value_key AS priority_key, t.metadata
        FROM support_tickets t
        LEFT JOIN tenant_option_values pv ON pv.id = t.priority_option_id AND pv.tenant_id = t.tenant_id
        WHERE t.id = $1 AND t.tenant_id = $2 AND t.deleted_at IS NULL
      `,
      [ticketId, tenantId]
    );
    if (result.rowCount === 0) {
      throw new AppError(404, "Support ticket not found.", undefined, "SUPPORT_TICKET_NOT_FOUND");
    }
    return { ...result.rows[0], metadata: getMetadata(result.rows[0].metadata) };
  }

  // L1-002
  async getSupportQueue(actor: ActorContext, query: SupportTicketListQuery): Promise<SupportQueueResponse> {
    this.assertEnabled();
    const list = await this.listTickets(actor, { ...query, page: 1, pageSize: 200 });
    const open = list.tickets.filter((ticket) => ticket.status?.key !== "closed" && ticket.status?.key !== "resolved");
    // L1-002: customer tier = the customer-success account segment (accounts have no native tier).
    const csAccountIds = [...new Set(open.map((ticket) => ticket.customerSuccessAccount?.id).filter((id): id is string => Boolean(id)))];
    const tierByAccount = new Map<string, CrmOptionValueSummary>();
    if (csAccountIds.length > 0) {
      await this.databaseService.withClient(async (client) => {
        const result = await client.query<{ account_id: string; seg_id: string; seg_key: string; seg_label: string; seg_color: string | null; seg_is_default: boolean; seg_is_active: boolean }>(
          `
            SELECT csa.account_id, sv.id AS seg_id, sv.value_key AS seg_key, sv.label AS seg_label, sv.color AS seg_color, sv.is_default AS seg_is_default, sv.is_active AS seg_is_active
            FROM customer_success_accounts csa
            INNER JOIN tenant_option_values sv ON sv.id = csa.segment_option_id AND sv.tenant_id = csa.tenant_id
            WHERE csa.tenant_id = $1 AND csa.deleted_at IS NULL AND csa.account_id = ANY($2::uuid[])
          `,
          [actor.tenantId, csAccountIds]
        );
        for (const row of result.rows) {
          tierByAccount.set(row.account_id, { id: row.seg_id, key: row.seg_key, label: row.seg_label, description: null, color: row.seg_color, isDefault: row.seg_is_default, isActive: row.seg_is_active });
        }
      });
    }
    let breachedCount = 0;
    let atRiskCount = 0;
    const entries = open.map((ticket) => {
      const due = ticket.sla.resolutionDueAt ? Date.parse(ticket.sla.resolutionDueAt) : null;
      const risk = ticket.sla.resolutionBreached ? "breached" : due !== null && due - Date.now() <= 60 * 60 * 1000 ? "at_risk" : "on_track";
      if (risk === "breached") breachedCount += 1;
      else if (risk === "at_risk") atRiskCount += 1;
      return {
        ticketId: ticket.id,
        subject: ticket.subject,
        customerName: ticket.account?.name ?? null,
        customerTier: (ticket.customerSuccessAccount?.id ? tierByAccount.get(ticket.customerSuccessAccount.id) : undefined) ?? null,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        owner: ticket.owner,
        slaDueAt: ticket.sla.resolutionDueAt,
        slaStatus: null,
        slaRisk: risk as "on_track" | "at_risk" | "breached",
        breachAlert: ticket.sla.resolutionBreached || ticket.sla.firstResponseBreached,
        queueWeight: computeQueueWeight(risk as "on_track" | "at_risk" | "breached", ticket.priority?.key ?? null)
      };
    });
    entries.sort((a, b) => a.queueWeight - b.queueWeight || (a.slaDueAt ?? "9999").localeCompare(b.slaDueAt ?? "9999"));
    return { entries, breachedCount, atRiskCount };
  }

  // L1-001
  async getIntakeAssist(actor: ActorContext, ticketId: string): Promise<TicketIntakeAssistResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const ticket = await this.loadTicketBasics(client, actor.tenantId, ticketId);
      const firstWords = ticket.subject.split(/\s+/).filter((word) => word.length > 3).slice(0, 2).join(" ");
      const duplicates = ticket.account_id
        ? await client.query<{ id: string; subject: string; created_at: Date; status_id: string; status_key: string; status_label: string; status_color: string | null; status_is_default: boolean; status_is_active: boolean }>(
            `
              SELECT t.id, t.subject, t.created_at, sv.id AS status_id, sv.value_key AS status_key, sv.label AS status_label, sv.color AS status_color, sv.is_default AS status_is_default, sv.is_active AS status_is_active
              FROM support_tickets t
              INNER JOIN tenant_option_values sv ON sv.id = t.status_option_id AND sv.tenant_id = t.tenant_id
              WHERE t.tenant_id = $1 AND t.deleted_at IS NULL AND t.account_id = $2 AND t.id <> $3
                AND sv.value_key NOT IN ('closed', 'resolved')
                AND ($4 = '' OR t.subject ILIKE '%' || $4 || '%')
              ORDER BY t.created_at DESC LIMIT 5
            `,
            [actor.tenantId, ticket.account_id, ticketId, firstWords]
          )
        : { rows: [] as never[] };
      return {
        duplicates: duplicates.rows.map((row) => ({
          ticketId: row.id,
          subject: row.subject,
          status: { id: row.status_id, key: row.status_key, label: row.status_label, description: null, color: row.status_color, isDefault: row.status_is_default, isActive: row.status_is_active },
          createdAt: row.created_at.toISOString()
        })),
        classification: suggestTicketClassification(ticket.subject, ticket.description),
        aiPlaceholder: { available: false, message: "AI ticket classification will connect with the governed AI Gateway." }
      };
    });
  }

  async acknowledgeTicket(actor: ActorContext, audit: AuditMetadata, ticketId: string): Promise<SupportTicketResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      const ticket = await this.loadTicketBasics(client, actor.tenantId, ticketId);
      await client.query(`UPDATE support_tickets SET metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [ticketId, actor.tenantId, JSON.stringify({ ...ticket.metadata, acknowledgedAt: new Date().toISOString() }), actor.userId]);
    });
    return this.addTicketMessage(actor, audit, ticketId, { body: "Thank you for contacting support. Your ticket has been received and an agent will respond shortly.", messageType: "customer_reply" });
  }

  // L1-003
  async getKbRecommendations(actor: ActorContext, ticketId: string): Promise<SupportKbRecommendationsResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const ticket = await this.loadTicketBasics(client, actor.tenantId, ticketId);
      const articles = await this.listKnowledgeArticles(actor);
      const ranked = rankKnowledgeArticles(`${ticket.subject} ${ticket.description ?? ""}`, articles.articles.map((article) => ({ id: article.id, title: article.title, body: article.body })));
      const byId = new Map(articles.articles.map((article) => [article.id, article]));
      return {
        recommendations: ranked.slice(0, 5).map((entry) => {
          const article = byId.get(entry.id)!;
          return { articleId: article.id, title: article.title, category: article.category, score: entry.score };
        }),
        aiPlaceholder: { available: false, message: "AI knowledge-base recommendation will connect with the governed AI Gateway." }
      };
    });
  }

  // L1-003: insert an approved knowledge article as a customer reply (response template).
  async insertKbTemplate(actor: ActorContext, audit: AuditMetadata, ticketId: string, articleId: string): Promise<SupportTicketResponse> {
    this.assertEnabled();
    const article = await this.databaseService.withClient((client) =>
      client.query<{ title: string; summary: string | null; body: string | null }>(
        `SELECT title, summary, body FROM support_knowledge_articles WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [articleId, actor.tenantId]
      )
    );
    if (article.rowCount === 0) {
      throw new AppError(404, "Knowledge article not found.", undefined, "NOT_FOUND");
    }
    const template = article.rows[0].summary?.trim() || article.rows[0].body?.trim() || article.rows[0].title;
    await this.addTicketMessage(actor, audit, ticketId, { body: template, messageType: "customer_reply" });
    return this.logKbUsage(actor, audit, ticketId, { articleId, helpful: true, note: "inserted as response template" });
  }

  async logKbUsage(actor: ActorContext, audit: AuditMetadata, ticketId: string, input: LogKbUsageRequestBody): Promise<SupportTicketResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      const ticket = await this.loadTicketBasics(client, actor.tenantId, ticketId);
      const usage = Array.isArray(ticket.metadata.kbUsage) ? ticket.metadata.kbUsage : [];
      const entry = { articleId: input.articleId, helpful: Boolean(input.helpful), note: input.note?.trim() || null, by: actor.userId, at: new Date().toISOString() };
      await client.query(`UPDATE support_tickets SET metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [ticketId, actor.tenantId, JSON.stringify({ ...ticket.metadata, kbUsage: [...usage, entry] }), actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "support.kb.usage", resourceType: "support_ticket", resourceId: ticketId, status: "success", metadata: { articleId: input.articleId, helpful: entry.helpful } });
    });
    return this.linkArticleToTicket(actor, audit, ticketId, input.articleId);
  }

  // L1-004
  async escalateTicket(actor: ActorContext, audit: AuditMetadata, ticketId: string, input: EscalateTicketRequestBody): Promise<SupportTicketResponse> {
    this.assertEnabled();
    const reason = input.reason?.trim();
    if (!reason) {
      throw new AppError(400, "An escalation reason is required.", undefined, "VALIDATION_ERROR");
    }
    await this.databaseService.withTransaction(async (client) => {
      const ticket = await this.loadTicketBasics(client, actor.tenantId, ticketId);
      let l2OwnerId = ticket.owner_id;
      if (input.l2OwnerId) {
        const owner = await client.query<{ id: string }>(`SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [input.l2OwnerId, actor.tenantId]);
        if (owner.rowCount === 0) {
          throw new AppError(400, "The L2 owner was not found.", undefined, "VALIDATION_ERROR");
        }
        l2OwnerId = owner.rows[0].id;
      }
      const escalation = { reason, troubleshooting: input.troubleshooting?.trim() || null, logs: input.logs?.trim() || null, screenshots: input.screenshots?.trim() || null, impact: input.impact?.trim() || null, urgency: input.urgency ?? null, escalatedBy: { id: actor.userId, displayName: actor.displayName, email: actor.email }, escalatedAt: new Date().toISOString() };
      // L1-004: optionally switch SLA policy on escalation (recomputes the resolution due time).
      let slaPolicyId: string | null = null;
      let resolutionMinutes: number | null = null;
      if (input.slaPolicyId) {
        slaPolicyId = await this.ensureSlaPolicyId(client, actor.tenantId, input.slaPolicyId);
        if (slaPolicyId) {
          const policy = await client.query<{ resolution_minutes: number }>(`SELECT resolution_minutes FROM support_sla_policies WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [slaPolicyId, actor.tenantId]);
          resolutionMinutes = policy.rows[0]?.resolution_minutes ?? null;
        }
      }
      if (slaPolicyId && resolutionMinutes !== null) {
        (escalation as Record<string, unknown>).slaChangedTo = slaPolicyId;
        await client.query(
          `UPDATE support_tickets SET escalation_status = 'escalated', owner_id = $3, sla_policy_id = $6, resolution_due_at = NOW() + ($7::int * interval '1 minute'), metadata = $4::jsonb, updated_by = $5 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          [ticketId, actor.tenantId, l2OwnerId, JSON.stringify({ ...ticket.metadata, escalation }), actor.userId, slaPolicyId, resolutionMinutes]
        );
      } else {
        await client.query(
          `UPDATE support_tickets SET escalation_status = 'escalated', owner_id = $3, metadata = $4::jsonb, updated_by = $5 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          [ticketId, actor.tenantId, l2OwnerId, JSON.stringify({ ...ticket.metadata, escalation }), actor.userId]
        );
      }
      if (l2OwnerId && l2OwnerId !== actor.userId) {
        await this.notificationService.createNotificationWithClient(client, actor, audit, { notificationType: "record_assignment", recipientUserId: l2OwnerId, title: "Ticket escalated to you (L2)", message: reason, linkedRecord: { entityType: "ticket", entityId: ticketId } });
      }
      await this.recordAuditLog(client, actor, audit, { action: "support.ticket.escalate", resourceType: "support_ticket", resourceId: ticketId, status: "success", metadata: { l2OwnerId } });
    });
    if (input.notifyCustomer) {
      await this.addTicketMessage(actor, audit, ticketId, { body: "Your ticket has been escalated to our specialist team for further investigation.", messageType: "customer_reply" });
    }
    return this.getTicket(actor, ticketId);
  }

  // L1-005
  async closeTicket(actor: ActorContext, audit: AuditMetadata, ticketId: string, input: CloseTicketRequestBody): Promise<SupportTicketResponse> {
    this.assertEnabled();
    const summary = input.resolutionSummary?.trim();
    if (!summary) {
      throw new AppError(400, "A resolution summary is required.", undefined, "VALIDATION_ERROR");
    }
    const requestConfirmation = Boolean(input.requestCustomerConfirmation);
    await this.databaseService.withTransaction(async (client) => {
      const ticket = await this.loadTicketBasics(client, actor.tenantId, ticketId);
      // L2-003: RCA is mandatory for critical incidents before closure.
      if (isRcaRequired(ticket.priority_key) && !getMetadata(ticket.metadata.rca as Record<string, unknown> | undefined).rootCause) {
        throw new AppError(409, "A root-cause analysis (RCA) is required before closing a critical incident.", undefined, "RCA_REQUIRED");
      }
      let rootCauseLabel: string | null = null;
      if (input.rootCauseCategoryKey) {
        const rootCauses = await this.loadOptionSetValues(client, actor.tenantId, "support-root-cause");
        rootCauseLabel = rootCauses.find((value) => value.key === input.rootCauseCategoryKey)?.label ?? null;
        if (!rootCauseLabel) {
          throw new AppError(400, "Unknown root cause category.", undefined, "VALIDATION_ERROR");
        }
      }
      const statusId = await this.resolveOptionValueId(client, actor.tenantId, "support-ticket-status", requestConfirmation ? "resolved" : "closed", "Support ticket status");
      const csat = { requested: true, requestedAt: new Date().toISOString(), awaitingConfirmation: requestConfirmation };
      await client.query(
        `UPDATE support_tickets SET status_option_id = $3, resolution_notes = $4, root_cause = $5, resolved_at = NOW(), metadata = $6::jsonb, updated_by = $7 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [ticketId, actor.tenantId, statusId, summary, rootCauseLabel, JSON.stringify({ ...ticket.metadata, csat }), actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "support.ticket.close", resourceType: "support_ticket", resourceId: ticketId, status: "success", metadata: { requestConfirmation, rootCause: rootCauseLabel } });
    });
    await this.addTicketMessage(actor, audit, ticketId, { body: `Resolution: ${summary}${requestConfirmation ? "\n\nPlease confirm this resolves your issue. We'd also appreciate your feedback via the CSAT survey." : ""}`, messageType: "customer_reply" });
    return this.getTicket(actor, ticketId);
  }

  // ---- Persona 22 (Support Agent L2 / Technical Support) ---------------------------------------

  private mapL2StoredUser(value: unknown): CrmLookupUserSummary | null {
    const record = getMetadata(value as Record<string, unknown> | undefined);
    const id = typeof record.id === "string" ? record.id : null;
    if (!id) {
      return null;
    }
    return { id, displayName: typeof record.displayName === "string" ? record.displayName : "", email: typeof record.email === "string" ? record.email : "", teamName: null, departmentName: null };
  }

  // L2-001
  async getInvestigation(actor: ActorContext, ticketId: string): Promise<L2InvestigationResponse> {
    this.assertEnabled();
    const { ticket } = await this.getTicket(actor, ticketId);
    return this.databaseService.withClient(async (client) => {
      const metadata = getMetadata(ticket.metadata);
      const investigation = getMetadata(metadata.investigation as Record<string, unknown> | undefined);
      const str = (record: Record<string, unknown>, key: string) => (typeof record[key] === "string" && (record[key] as string).length > 0 ? (record[key] as string) : null);

      const priorTickets = ticket.account?.id
        ? await client.query<{ id: string; subject: string; created_at: Date; status_id: string; status_key: string; status_label: string; status_color: string | null; status_is_default: boolean; status_is_active: boolean }>(
            `
              SELECT t.id, t.subject, t.created_at, sv.id AS status_id, sv.value_key AS status_key, sv.label AS status_label, sv.color AS status_color, sv.is_default AS status_is_default, sv.is_active AS status_is_active
              FROM support_tickets t
              INNER JOIN tenant_option_values sv ON sv.id = t.status_option_id AND sv.tenant_id = t.tenant_id
              WHERE t.tenant_id = $1 AND t.deleted_at IS NULL AND t.account_id = $2 AND t.id <> $3
              ORDER BY t.created_at DESC LIMIT 10
            `,
            [actor.tenantId, ticket.account.id, ticketId]
          )
        : { rows: [] as never[] };

      const bugRaw = getMetadata(metadata.bugEscalation as Record<string, unknown> | undefined);
      const bugEscalation = bugRaw.escalatedAt
        ? {
            stepsToReproduce: str(bugRaw, "stepsToReproduce"),
            expectedResult: str(bugRaw, "expectedResult"),
            actualResult: str(bugRaw, "actualResult"),
            environment: str(bugRaw, "environment"),
            logs: str(bugRaw, "logs"),
            severity: (bugSeverities.includes(bugRaw.severity as never) ? bugRaw.severity : "medium") as (typeof bugSeverities)[number],
            customerImpact: str(bugRaw, "customerImpact"),
            engineeringRef: str(bugRaw, "engineeringRef"),
            syncStatus: (bugSyncStatuses.includes(bugRaw.syncStatus as never) ? bugRaw.syncStatus : "open") as (typeof bugSyncStatuses)[number],
            escalatedBy: this.mapL2StoredUser(bugRaw.escalatedBy),
            escalatedAt: str(bugRaw, "escalatedAt") ?? new Date(0).toISOString(),
            updatedAt: str(bugRaw, "updatedAt")
          }
        : null;

      const rcaRaw = getMetadata(metadata.rca as Record<string, unknown> | undefined);
      let rca = null;
      if (Object.keys(rcaRaw).length > 0) {
        const shareApprovalId = str(rcaRaw, "shareApprovalId");
        let shareApprovalStatus: string | null = null;
        if (shareApprovalId) {
          const approval = await client.query<{ status: string }>(`SELECT status FROM approval_requests WHERE id = $1 AND tenant_id = $2`, [shareApprovalId, actor.tenantId]);
          shareApprovalStatus = approval.rows[0]?.status ?? null;
        }
        rca = {
          rootCause: str(rcaRaw, "rootCause"),
          impact: str(rcaRaw, "impact"),
          timeline: str(rcaRaw, "timeline"),
          resolution: str(rcaRaw, "resolution"),
          preventiveAction: str(rcaRaw, "preventiveAction"),
          owner: this.mapL2StoredUser(rcaRaw.owner),
          dueDate: str(rcaRaw, "dueDate"),
          shareApprovalId,
          shareApprovalStatus,
          shareable: shareApprovalStatus === "approved",
          updatedAt: str(rcaRaw, "updatedAt")
        };
      }

      const notesRaw = Array.isArray(investigation.notes) ? investigation.notes : [];
      return {
        investigation: {
          ticketId,
          subject: ticket.subject,
          slaStatus: null,
          slaDueAt: ticket.sla?.resolutionDueAt ?? null,
          environment: str(investigation, "environment"),
          configuration: str(investigation, "configuration"),
          logs: str(investigation, "logs"),
          attachments: Array.isArray(metadata.attachments) ? metadata.attachments.filter((ref): ref is string => typeof ref === "string") : [],
          notes: notesRaw
            .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
            .map((entry) => ({ id: typeof entry.id === "string" ? entry.id : randomUUID(), note: typeof entry.note === "string" ? entry.note : "", author: this.mapL2StoredUser(entry.author), createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date(0).toISOString() })),
          priorTickets: priorTickets.rows.map((row) => ({ ticketId: row.id, subject: row.subject, status: { id: row.status_id, key: row.status_key, label: row.status_label, description: null, color: row.status_color, isDefault: row.status_is_default, isActive: row.status_is_active }, createdAt: row.created_at.toISOString() })),
          bugEscalation,
          rca,
          rcaRequired: isRcaRequired(ticket.priority?.key ?? null),
          aiPlaceholder: { available: false, message: "AI similar-issue summarization and article formatting will connect with the governed AI Gateway." }
        }
      };
    });
  }

  async updateInvestigation(actor: ActorContext, audit: AuditMetadata, ticketId: string, input: UpdateInvestigationRequestBody): Promise<L2InvestigationResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      const ticket = await this.loadTicketBasics(client, actor.tenantId, ticketId);
      const investigation = getMetadata(ticket.metadata.investigation as Record<string, unknown> | undefined);
      const trimmedOrKeep = (next: string | null | undefined, key: string) => (next !== undefined ? (next?.trim() || null) : investigation[key] ?? null);
      const notes = Array.isArray(investigation.notes) ? investigation.notes : [];
      if (input.note && input.note.trim()) {
        notes.push({ id: randomUUID(), note: input.note.trim(), author: { id: actor.userId, displayName: actor.displayName, email: actor.email }, createdAt: new Date().toISOString() });
      }
      const next = { ...investigation, environment: trimmedOrKeep(input.environment, "environment"), configuration: trimmedOrKeep(input.configuration, "configuration"), logs: trimmedOrKeep(input.logs, "logs"), notes, updatedAt: new Date().toISOString() };
      await client.query(`UPDATE support_tickets SET metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [ticketId, actor.tenantId, JSON.stringify({ ...ticket.metadata, investigation: next }), actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "support.l2.investigation.update", resourceType: "support_ticket", resourceId: ticketId, status: "success" });
    });
    return this.getInvestigation(actor, ticketId);
  }

  // L2-002
  async escalateBug(actor: ActorContext, audit: AuditMetadata, ticketId: string, input: EscalateBugRequestBody): Promise<L2InvestigationResponse> {
    this.assertEnabled();
    const steps = input.stepsToReproduce?.trim();
    if (!steps) {
      throw new AppError(400, "Steps to reproduce are required to escalate a bug.", undefined, "VALIDATION_ERROR");
    }
    await this.databaseService.withTransaction(async (client) => {
      const ticket = await this.loadTicketBasics(client, actor.tenantId, ticketId);
      const existing = getMetadata(ticket.metadata.bugEscalation as Record<string, unknown> | undefined);
      const bugEscalation = {
        ...existing,
        stepsToReproduce: steps,
        expectedResult: input.expectedResult?.trim() || null,
        actualResult: input.actualResult?.trim() || null,
        environment: input.environment?.trim() || null,
        logs: input.logs?.trim() || null,
        severity: bugSeverities.includes(input.severity as never) ? input.severity : "medium",
        customerImpact: input.customerImpact?.trim() || null,
        engineeringRef: input.engineeringRef?.trim() || existing.engineeringRef || null,
        syncStatus: existing.syncStatus ?? "open",
        escalatedBy: existing.escalatedBy ?? { id: actor.userId, displayName: actor.displayName, email: actor.email },
        escalatedAt: existing.escalatedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await client.query(`UPDATE support_tickets SET metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [ticketId, actor.tenantId, JSON.stringify({ ...ticket.metadata, bugEscalation }), actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "support.l2.bug.escalate", resourceType: "support_ticket", resourceId: ticketId, status: "success", metadata: { severity: bugEscalation.severity } });
    });
    return this.getInvestigation(actor, ticketId);
  }

  async updateBugStatus(actor: ActorContext, audit: AuditMetadata, ticketId: string, input: UpdateBugStatusRequestBody): Promise<L2InvestigationResponse> {
    this.assertEnabled();
    if (!bugSyncStatuses.includes(input.syncStatus)) {
      throw new AppError(400, "Invalid bug sync status.", undefined, "VALIDATION_ERROR");
    }
    await this.databaseService.withTransaction(async (client) => {
      const ticket = await this.loadTicketBasics(client, actor.tenantId, ticketId);
      const existing = getMetadata(ticket.metadata.bugEscalation as Record<string, unknown> | undefined);
      if (!existing.escalatedAt) {
        throw new AppError(409, "No engineering escalation exists for this ticket.", undefined, "INVALID_STATE");
      }
      const bugEscalation = { ...existing, syncStatus: input.syncStatus, engineeringRef: input.engineeringRef?.trim() || existing.engineeringRef || null, updatedAt: new Date().toISOString() };
      await client.query(`UPDATE support_tickets SET metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [ticketId, actor.tenantId, JSON.stringify({ ...ticket.metadata, bugEscalation }), actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "support.l2.bug.status", resourceType: "support_ticket", resourceId: ticketId, status: "success", metadata: { syncStatus: input.syncStatus } });
    });
    if (input.generateCustomerUpdate) {
      await this.addTicketMessage(actor, audit, ticketId, { body: `Engineering update: the reported issue is now "${input.syncStatus.replace(/_/g, " ")}".`, messageType: "customer_reply" });
    }
    return this.getInvestigation(actor, ticketId);
  }

  // L2-003
  async upsertRca(actor: ActorContext, audit: AuditMetadata, ticketId: string, input: UpsertRcaRequestBody): Promise<L2InvestigationResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      const ticket = await this.loadTicketBasics(client, actor.tenantId, ticketId);
      const existing = getMetadata(ticket.metadata.rca as Record<string, unknown> | undefined);
      let owner = existing.owner;
      if (input.ownerId !== undefined) {
        if (input.ownerId) {
          const ownerRow = await client.query<{ id: string; display_name: string; email: string }>(`SELECT id, display_name, email FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [input.ownerId, actor.tenantId]);
          if (ownerRow.rowCount === 0) {
            throw new AppError(400, "RCA owner was not found.", undefined, "VALIDATION_ERROR");
          }
          owner = { id: ownerRow.rows[0].id, displayName: ownerRow.rows[0].display_name, email: ownerRow.rows[0].email };
        } else {
          owner = null;
        }
      }
      const pick = (next: string | null | undefined, key: string) => (next !== undefined ? (next?.trim() || null) : existing[key] ?? null);
      const rca = {
        ...existing,
        rootCause: pick(input.rootCause, "rootCause"),
        impact: pick(input.impact, "impact"),
        timeline: pick(input.timeline, "timeline"),
        resolution: pick(input.resolution, "resolution"),
        preventiveAction: pick(input.preventiveAction, "preventiveAction"),
        owner,
        dueDate: pick(input.dueDate, "dueDate"),
        updatedAt: new Date().toISOString()
      };
      await client.query(`UPDATE support_tickets SET root_cause = COALESCE($3, root_cause), metadata = $4::jsonb, updated_by = $5 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [ticketId, actor.tenantId, rca.rootCause, JSON.stringify({ ...ticket.metadata, rca }), actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "support.l2.rca.upsert", resourceType: "support_ticket", resourceId: ticketId, status: "success" });
    });
    return this.getInvestigation(actor, ticketId);
  }

  async requestRcaShare(actor: ActorContext, audit: AuditMetadata, ticketId: string, input: RequestRcaShareRequestBody): Promise<L2InvestigationResponse> {
    this.assertEnabled();
    let subject = "";
    await this.databaseService.withTransaction(async (client) => {
      const ticket = await this.loadTicketBasics(client, actor.tenantId, ticketId);
      subject = ticket.subject;
      if (!getMetadata(ticket.metadata.rca as Record<string, unknown> | undefined).rootCause) {
        throw new AppError(409, "Capture the RCA before requesting a share approval.", undefined, "INVALID_STATE");
      }
    });
    const approval = await this.approvalService.createApproval(actor, audit, {
      approvalType: "rca_share_approval",
      title: `Share RCA with customer: ${subject}`,
      description: input.note?.trim() || "Approval to share the root-cause analysis with the customer (L2-003).",
      approverUserId: input.approverUserId,
      linkedRecord: { entityType: "ticket", entityId: ticketId },
      metadata: { ticketId }
    });
    await this.databaseService.withTransaction(async (client) => {
      const ticket = await this.loadTicketBasics(client, actor.tenantId, ticketId);
      const rca = getMetadata(ticket.metadata.rca as Record<string, unknown> | undefined);
      await client.query(`UPDATE support_tickets SET metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [ticketId, actor.tenantId, JSON.stringify({ ...ticket.metadata, rca: { ...rca, shareApprovalId: approval.approval.id } }), actor.userId]);
    });
    return this.getInvestigation(actor, ticketId);
  }

  // L2-004
  async createArticleFromTicket(actor: ActorContext, audit: AuditMetadata, ticketId: string, input: CreateArticleFromTicketRequestBody): Promise<SupportKnowledgeArticleResponse> {
    this.assertEnabled();
    const ticket = await this.loadTicketBasicsWithClient(actor.tenantId, ticketId);
    const title = input.title?.trim() || `KB: ${ticket.subject}`;
    const body = input.body?.trim() || (typeof ticket.metadata.rca === "object" ? (getMetadata(ticket.metadata.rca as Record<string, unknown>).resolution as string) : null) || ticket.description || "";
    const article = await this.createKnowledgeArticle(actor, audit, {
      title,
      categoryKey: input.categoryKey ?? null,
      summary: input.summary?.trim() || ticket.subject,
      body,
      status: "draft",
      metadata: { sourceTicketId: ticketId, createdFromTicket: true }
    });
    await this.linkArticleToTicket(actor, audit, ticketId, article.article.id);
    return article;
  }

  async publishKnowledgeArticle(actor: ActorContext, audit: AuditMetadata, articleId: string, input: PublishKnowledgeArticleRequestBody): Promise<SupportKnowledgeArticleResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      const existing = await client.query<{ id: string; metadata: Record<string, unknown> | null }>(`SELECT id, metadata FROM support_knowledge_articles WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [articleId, actor.tenantId]);
      if (existing.rowCount === 0) {
        throw new AppError(404, "Knowledge article not found.", undefined, "NOT_FOUND");
      }
      const metadata = { ...getMetadata(existing.rows[0].metadata), reviewedBy: { id: actor.userId, displayName: actor.displayName, email: actor.email }, reviewedAt: new Date().toISOString(), reviewNote: input.note?.trim() || null };
      await client.query(`UPDATE support_knowledge_articles SET status = 'published', metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [articleId, actor.tenantId, JSON.stringify(metadata), actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "support.kb.publish", resourceType: "support_knowledge_article", resourceId: articleId, status: "success" });
    });
    const articles = await this.listKnowledgeArticles(actor);
    const published = articles.articles.find((article) => article.id === articleId);
    if (!published) {
      throw new AppError(404, "Knowledge article not found.", undefined, "NOT_FOUND");
    }
    return { article: published };
  }

  // ---- Persona 23 (Support Manager) ------------------------------------------------------------

  private readCsatScore(metadata: Record<string, unknown>): number | null {
    const csat = getMetadata(metadata.csat as Record<string, unknown> | undefined);
    return typeof csat.score === "number" ? csat.score : null;
  }

  private summarizeCsat(tickets: SupportTicketSummary[]) {
    const scores = tickets.map((ticket) => this.readCsatScore(ticket.metadata)).filter((score): score is number => typeof score === "number");
    let detractors = 0;
    let passives = 0;
    let promoters = 0;
    for (const score of scores) {
      const band = resolveCsatBand(score);
      if (band === "detractor") detractors += 1;
      else if (band === "promoter") promoters += 1;
      else passives += 1;
    }
    const averageScore = scores.length > 0 ? Math.round((scores.reduce((total, score) => total + score, 0) / scores.length) * 10) / 10 : null;
    return { responseCount: scores.length, averageScore, detractors, passives, promoters };
  }

  private buildAgentFact(ticket: SupportTicketSummary): AgentTicketFact {
    const resolved = RESOLVED_STATUS_KEYS.has(ticket.status?.key ?? "");
    const createdAtMs = Date.parse(ticket.createdAt);
    const firstResponseAtMs = ticket.sla.firstResponseAt ? Date.parse(ticket.sla.firstResponseAt) : null;
    const resolvedAtMs = ticket.sla.resolvedAt ? Date.parse(ticket.sla.resolvedAt) : null;
    return {
      resolved,
      firstResponseBreached: ticket.sla.firstResponseBreached,
      resolutionBreached: ticket.sla.resolutionBreached,
      // A ticket that carries a resolved timestamp but is open again was reopened.
      reopened: resolvedAtMs !== null && !Number.isNaN(resolvedAtMs) && !resolved,
      createdAtMs: Number.isNaN(createdAtMs) ? Date.now() : createdAtMs,
      firstResponseAtMs: firstResponseAtMs !== null && !Number.isNaN(firstResponseAtMs) ? firstResponseAtMs : null,
      resolvedAtMs: resolvedAtMs !== null && !Number.isNaN(resolvedAtMs) ? resolvedAtMs : null,
      csatScore: this.readCsatScore(ticket.metadata)
    };
  }

  private async loadScopedTicketSummaries(client: PoolClient, actor: ActorContext, scope: SupportTicketScope): Promise<SupportTicketSummary[]> {
    const { conditions, params } = await this.buildScopedWhere(client, actor, scope);
    const result = await client.query<SupportTicketRow>(
      `SELECT ${this.ticketSelectColumns()} ${this.ticketFromClause()} WHERE ${conditions.join(" AND ")}`,
      params
    );
    return result.rows.map((row) => this.mapTicketSummary(row));
  }

  // SPM-001: per-agent + team performance and SLA compliance.
  async getTeamPerformance(actor: ActorContext, query: SupportTicketListQuery): Promise<SupportTeamPerformanceResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const scope = await this.resolveScope(client, actor, query.scope);
      const tickets = await this.loadScopedTicketSummaries(client, actor, scope);

      const byAgent = new Map<string, { agent: SupportTicketSummary["assignee"]; facts: AgentTicketFact[] }>();
      for (const ticket of tickets) {
        if (!ticket.assignee) {
          continue;
        }
        const entry = byAgent.get(ticket.assignee.id) ?? { agent: ticket.assignee, facts: [] };
        entry.facts.push(this.buildAgentFact(ticket));
        byAgent.set(ticket.assignee.id, entry);
      }

      const agents: SupportAgentPerformance[] = Array.from(byAgent.values())
        .map((entry) => ({ agent: entry.agent, ...computeAgentPerformance(entry.facts) }))
        .sort((a, b) => b.assigned - a.assigned);

      return {
        scope,
        generatedAt: new Date().toISOString(),
        team: computeAgentPerformance(tickets.map((ticket) => this.buildAgentFact(ticket))),
        agents,
        csat: this.summarizeCsat(tickets),
        aiPlaceholder: { available: false, message: "AI performance insights and high-performer detection will connect with the governed AI Gateway." }
      };
    });
  }

  // SPM-002: per-agent open workload and overload detection.
  async getWorkload(actor: ActorContext, query: SupportTicketListQuery, capacity: number): Promise<SupportWorkloadResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const scope = await this.resolveScope(client, actor, query.scope);
      const tickets = await this.loadScopedTicketSummaries(client, actor, scope);
      const open = tickets.filter((ticket) => !RESOLVED_STATUS_KEYS.has(ticket.status?.key ?? ""));

      const toFact = (ticket: SupportTicketSummary): WorkloadTicketFact => {
        const due = ticket.sla.resolutionDueAt ? Date.parse(ticket.sla.resolutionDueAt) : null;
        const breached = ticket.sla.resolutionBreached || ticket.sla.firstResponseBreached;
        return { open: true, breached, atRisk: !breached && due !== null && !Number.isNaN(due) && due - Date.now() <= 3600000 };
      };

      const byAgent = new Map<string, { agent: SupportTicketSummary["assignee"]; facts: WorkloadTicketFact[] }>();
      let unassignedOpen = 0;
      for (const ticket of open) {
        if (!ticket.assignee) {
          unassignedOpen += 1;
          continue;
        }
        const entry = byAgent.get(ticket.assignee.id) ?? { agent: ticket.assignee, facts: [] };
        entry.facts.push(toFact(ticket));
        byAgent.set(ticket.assignee.id, entry);
      }

      const agents: SupportAgentWorkload[] = Array.from(byAgent.values())
        .map((entry) => ({ agent: entry.agent, ...computeWorkload(entry.facts, capacity) }))
        .sort((a, b) => b.openCount - a.openCount);

      return { scope, capacity, unassignedOpen, agents };
    });
  }

  // SPM-002: bulk-reassign tickets to balance load. Reuses the ticket assignment gate at the router.
  async reassignTickets(actor: ActorContext, audit: AuditMetadata, input: ReassignTicketsRequestBody): Promise<ReassignTicketsResponse> {
    this.assertEnabled();
    const ticketIds = [...new Set((input.ticketIds ?? []).filter((id) => typeof id === "string" && id.length > 0))];
    if (ticketIds.length === 0) {
      throw new AppError(400, "At least one ticket is required.", undefined, "VALIDATION_ERROR");
    }
    let reassigned = 0;
    await this.databaseService.withTransaction(async (client) => {
      const assigneeId = await this.ensureReference(client, actor.tenantId, "users", input.assigneeId, "INVALID_ASSIGNEE", "assignee");
      for (const ticketId of ticketIds) {
        await this.loadTicketBasics(client, actor.tenantId, ticketId);
        await client.query(
          `UPDATE support_tickets SET assignee_id = $3, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          [ticketId, actor.tenantId, assigneeId, actor.userId]
        );
        await this.recordAuditLog(client, actor, audit, { action: "support.manager.reassign", resourceType: "support_ticket", resourceId: ticketId, status: "success", metadata: { assigneeId } });
        reassigned += 1;
      }
      if (assigneeId && assigneeId !== actor.userId) {
        await this.notificationService.createNotificationWithClient(client, actor, audit, {
          notificationType: "record_assignment",
          recipientUserId: assigneeId,
          title: `${reassigned} ticket(s) assigned to you`,
          message: input.note?.trim() || "Your support manager has balanced these tickets to your queue.",
          linkedRecord: { entityType: "ticket", entityId: ticketIds[0] }
        });
      }
    });
    return { reassigned, assigneeId: input.assigneeId };
  }

  // SPM-003: record why an SLA breach happened + the corrective action.
  async recordBreachReview(actor: ActorContext, audit: AuditMetadata, ticketId: string, input: RecordBreachReviewRequestBody): Promise<SupportTicketResponse> {
    this.assertEnabled();
    const reasonKey = input.reasonKey?.trim();
    if (!reasonKey) {
      throw new AppError(400, "A breach reason is required.", undefined, "VALIDATION_ERROR");
    }
    await this.databaseService.withTransaction(async (client) => {
      const ticket = await this.loadTicketBasics(client, actor.tenantId, ticketId);
      const reasons = await this.loadOptionSetValues(client, actor.tenantId, "support-breach-reason");
      const reasonLabel = reasons.find((value) => value.key === reasonKey)?.label ?? null;
      if (!reasonLabel) {
        throw new AppError(400, "Unknown breach reason.", undefined, "VALIDATION_ERROR");
      }
      const breachReview = {
        reasonKey,
        reasonLabel,
        correctiveAction: input.correctiveAction?.trim() || null,
        reviewedBy: { id: actor.userId, displayName: actor.displayName, email: actor.email },
        reviewedAt: new Date().toISOString()
      };
      await client.query(`UPDATE support_tickets SET metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [ticketId, actor.tenantId, JSON.stringify({ ...ticket.metadata, breachReview }), actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "support.manager.breach_review", resourceType: "support_ticket", resourceId: ticketId, status: "success", metadata: { reasonKey } });
    });
    return this.getTicket(actor, ticketId);
  }

  // SPM-004: escalated-ticket oversight with aging.
  async getEscalationOversight(actor: ActorContext, query: SupportTicketListQuery): Promise<SupportEscalationOversightResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const scope = await this.resolveScope(client, actor, query.scope);
      const tickets = await this.loadScopedTicketSummaries(client, actor, scope);
      const escalated = tickets.filter((ticket) => ticket.escalationStatus === "escalated");
      const entries = escalated.map((ticket) => {
        const escalation = getMetadata(ticket.metadata.escalation as Record<string, unknown> | undefined);
        const escalatedAt = typeof escalation.escalatedAt === "string" ? escalation.escalatedAt : null;
        const escalatedMs = escalatedAt ? Date.parse(escalatedAt) : NaN;
        return {
          ticketId: ticket.id,
          subject: ticket.subject,
          priority: ticket.priority,
          owner: ticket.owner,
          reason: typeof escalation.reason === "string" ? escalation.reason : null,
          escalatedAt,
          ageHours: Number.isNaN(escalatedMs) ? null : Math.round(((Date.now() - escalatedMs) / 3600000) * 10) / 10
        };
      });
      entries.sort((a, b) => (b.ageHours ?? -1) - (a.ageHours ?? -1));
      return { entries, count: entries.length };
    });
  }

  // SPM-004: reassign an escalation owner or return the ticket to L1.
  async reviewEscalation(actor: ActorContext, audit: AuditMetadata, ticketId: string, input: ReviewEscalationRequestBody): Promise<SupportTicketResponse> {
    this.assertEnabled();
    if (!escalationReviewDecisions.includes(input.decision)) {
      throw new AppError(400, "Invalid escalation decision.", undefined, "VALIDATION_ERROR");
    }
    await this.databaseService.withTransaction(async (client) => {
      const ticket = await this.loadTicketBasics(client, actor.tenantId, ticketId);
      const escalationReview = { decision: input.decision, note: input.note?.trim() || null, reviewedBy: { id: actor.userId, displayName: actor.displayName, email: actor.email }, reviewedAt: new Date().toISOString() };
      const nextMetadata = JSON.stringify({ ...ticket.metadata, escalationReview });
      if (input.decision === "reassign") {
        const ownerId = await this.ensureReference(client, actor.tenantId, "users", input.ownerId, "INVALID_OWNER", "owner");
        if (!ownerId) {
          throw new AppError(400, "An owner is required to reassign an escalation.", undefined, "VALIDATION_ERROR");
        }
        await client.query(`UPDATE support_tickets SET owner_id = $3, escalation_status = 'escalated', metadata = $4::jsonb, updated_by = $5 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [ticketId, actor.tenantId, ownerId, nextMetadata, actor.userId]);
        if (ownerId !== actor.userId) {
          await this.notificationService.createNotificationWithClient(client, actor, audit, { notificationType: "record_assignment", recipientUserId: ownerId, title: "Escalation reassigned to you", message: escalationReview.note || "A support manager reassigned this escalation to you.", linkedRecord: { entityType: "ticket", entityId: ticketId } });
        }
      } else {
        await client.query(`UPDATE support_tickets SET escalation_status = 'none', metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [ticketId, actor.tenantId, nextMetadata, actor.userId]);
      }
      await this.recordAuditLog(client, actor, audit, { action: "support.manager.escalation_review", resourceType: "support_ticket", resourceId: ticketId, status: "success", metadata: { decision: input.decision } });
    });
    return this.getTicket(actor, ticketId);
  }

  // SPM-005: capture a CSAT survey response, completing the L1-triggered survey.
  async recordCsat(actor: ActorContext, audit: AuditMetadata, ticketId: string, input: RecordCsatRequestBody): Promise<SupportTicketResponse> {
    this.assertEnabled();
    if (typeof input.score !== "number" || input.score < 1 || input.score > 5) {
      throw new AppError(400, "CSAT score must be between 1 and 5.", undefined, "VALIDATION_ERROR");
    }
    await this.databaseService.withTransaction(async (client) => {
      const ticket = await this.loadTicketBasics(client, actor.tenantId, ticketId);
      const existing = getMetadata(ticket.metadata.csat as Record<string, unknown> | undefined);
      const csat = {
        ...existing,
        score: input.score,
        comment: input.comment?.trim() || null,
        band: resolveCsatBand(input.score),
        recordedBy: { id: actor.userId, displayName: actor.displayName, email: actor.email },
        recordedAt: new Date().toISOString(),
        awaitingConfirmation: false
      };
      await client.query(`UPDATE support_tickets SET metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [ticketId, actor.tenantId, JSON.stringify({ ...ticket.metadata, csat }), actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "support.manager.csat", resourceType: "support_ticket", resourceId: ticketId, status: "success", metadata: { score: input.score, band: csat.band } });
    });
    return this.getTicket(actor, ticketId);
  }

  private async loadTicketBasicsWithClient(tenantId: string, ticketId: string) {
    return this.databaseService.withClient((client) => this.loadTicketBasics(client, tenantId, ticketId));
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
  custom_fields: Record<string, unknown> | null;
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
