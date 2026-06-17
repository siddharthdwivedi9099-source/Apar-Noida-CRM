import { randomUUID } from "node:crypto";
import type {
  CrmLookupUserSummary,
  CrmOptionValueSummary,
  CrmTaskStatus,
  LeadBantChecklist,
  LeadCustomQualificationField,
  LeadCustomQualificationFieldInput,
  LeadQualificationFramework,
  RoleSummary,
  SalesWorkspaceAiPlaceholderSummary,
  SalesWorkspaceLeadResponse,
  SalesWorkspaceLeadSummary,
  SalesWorkspaceOptionsResponse,
  SalesWorkspaceTaskSummary,
  SdrWorkspaceResponse,
  InsideSalesWorkspaceResponse,
  UpdateLeadWorkspaceRequestBody
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

interface LeadWorkspaceRow {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string;
  email: string | null;
  phone: string | null;
  score: number | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  note_count: number;
  activity_count: number;
  last_activity_at: Date | null;
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
  source_id: string | null;
  source_key: string | null;
  source_label: string | null;
  source_description: string | null;
  source_color: string | null;
  source_is_default: boolean | null;
  source_is_active: boolean | null;
}

interface LeadTaskRow {
  id: string;
  entity_id: string;
  title: string;
  description: string | null;
  due_at: Date | null;
  reminder_at: Date | null;
  priority: string;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
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
  lead_first_name: string;
  lead_last_name: string;
  lead_company_name: string;
  lead_owner_id: string | null;
  lead_owner_display_name: string | null;
  lead_owner_email: string | null;
  lead_owner_team_name: string | null;
  lead_owner_department_name: string | null;
  lead_status_id: string | null;
  lead_status_key: string | null;
  lead_status_label: string | null;
  lead_status_description: string | null;
  lead_status_color: string | null;
  lead_status_is_default: boolean | null;
  lead_status_is_active: boolean | null;
}

interface LeadStateRow {
  id: string;
  owner_id: string | null;
  status_option_id: string;
  metadata: Record<string, unknown> | null;
}

interface WorkspaceOptionCatalog {
  outreachStatuses: CrmOptionValueSummary[];
  handoffStatuses: CrmOptionValueSummary[];
  callDispositions: CrmOptionValueSummary[];
}

function toIsoString(value: Date | null) {
  return value ? value.toISOString() : null;
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

function getSalesWorkspaceRoot(metadata: Record<string, unknown> | null | undefined) {
  const root = getMetadata(metadata).salesWorkspace;

  if (!root || typeof root !== "object" || Array.isArray(root)) {
    return {};
  }

  return root as Record<string, unknown>;
}

function getBantChecklist(input: unknown): LeadBantChecklist {
  const source =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Partial<Record<keyof LeadBantChecklist, unknown>>)
      : {};

  return {
    budget: Boolean(source.budget),
    authority: Boolean(source.authority),
    need: Boolean(source.need),
    timeline: Boolean(source.timeline)
  };
}

function normalizeQualificationFramework(value: unknown): LeadQualificationFramework {
  if (value === "meddic" || value === "custom") {
    return value;
  }

  return "bant";
}

function normalizeCustomQualificationFields(input: unknown): LeadCustomQualificationField[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const item = entry as Partial<Record<keyof LeadCustomQualificationField, unknown>>;
      const label = typeof item.label === "string" ? item.label.trim() : "";
      const value = typeof item.value === "string" ? item.value.trim() : "";

      if (!label && !value) {
        return null;
      }

      return {
        id: typeof item.id === "string" && item.id.trim().length > 0 ? item.id.trim() : randomUUID(),
        label,
        value
      } satisfies LeadCustomQualificationField;
    })
    .filter((entry): entry is LeadCustomQualificationField => Boolean(entry));
}

function isTaskOpen(status: CrmTaskStatus) {
  return status !== "completed" && status !== "cancelled";
}

function isCallTask(metadata: Record<string, unknown>) {
  return metadata.phase11TaskType === "call";
}

function getActiveOutreachCount(leads: SalesWorkspaceLeadSummary[]) {
  return leads.filter((lead) => {
    const outreachKey = lead.workspace.outreachStatus?.key;
    return typeof outreachKey === "string" && !["not_started", "nurture"].includes(outreachKey);
  }).length;
}

function getMeetingBookedCount(leads: SalesWorkspaceLeadSummary[]) {
  return leads.filter(
    (lead) =>
      lead.workspace.outreachStatus?.key === "meeting_booked" ||
      lead.workspace.callDisposition?.key === "meeting_booked"
  ).length;
}

function getReadyForHandoffCount(leads: SalesWorkspaceLeadSummary[]) {
  return leads.filter((lead) =>
    ["sales_ready", "handed_to_sales", "accepted_by_sales"].includes(lead.workspace.handoffStatus?.key ?? "")
  ).length;
}

function getQualifiedLeadCount(leads: SalesWorkspaceLeadSummary[]) {
  return leads.filter(
    (lead) =>
      lead.status?.key === "qualified" ||
      lead.workspace.qualificationChecklistCompletionCount === lead.workspace.qualificationChecklistTotal
  ).length;
}

function getHandedOffLeadCount(leads: SalesWorkspaceLeadSummary[]) {
  return leads.filter((lead) =>
    ["handed_to_sales", "accepted_by_sales"].includes(lead.workspace.handoffStatus?.key ?? "")
  ).length;
}

function getCompletedCallCount(leads: SalesWorkspaceLeadSummary[]) {
  return leads.filter((lead) => {
    const dispositionKey = lead.workspace.callDisposition?.key;
    return Boolean(dispositionKey) && dispositionKey !== "pending";
  }).length;
}

export class SalesWorkspacesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {}

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(
        503,
        "Sales workspaces are unavailable until the database connection is enabled.",
        undefined,
        "SALES_WORKSPACE_UNAVAILABLE"
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

  private async getLeadState(client: PoolClient, tenantId: string, leadId: string) {
    const result = await client.query<LeadStateRow>(
      `
        SELECT id, owner_id, status_option_id, metadata
        FROM leads
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [leadId, tenantId]
    );

    const lead = result.rows[0] ?? null;

    if (!lead) {
      throw new AppError(404, "Lead not found.", undefined, "LEAD_NOT_FOUND");
    }

    return lead;
  }

  private shouldConstrainLeadVisibility(actor: ActorContext) {
    return !(
      actor.permissionCodes.includes("leads.assign") ||
      actor.permissionCodes.includes("leads.configure") ||
      actor.permissionCodes.includes("sales.assign") ||
      actor.permissionCodes.includes("sales.configure") ||
      actor.permissionCodes.includes("admin.configure")
    );
  }

  private assertLeadVisibility(actor: ActorContext, ownerId: string | null) {
    if (!this.shouldConstrainLeadVisibility(actor)) {
      return;
    }

    if (!ownerId || ownerId !== actor.userId) {
      throw new AppError(404, "Lead not found.", undefined, "LEAD_NOT_FOUND");
    }
  }

  private getQualificationFrameworkDefinitions() {
    return [
      {
        key: "bant",
        label: "BANT",
        description: "Budget, authority, need, and timeline checklist is live in this phase.",
        available: true
      },
      {
        key: "meddic",
        label: "MEDDIC",
        description: "MEDDIC stays as a placeholder in this phase, ready for deeper enrichment later.",
        available: false
      },
      {
        key: "custom",
        label: "Custom",
        description: "Store rep-defined qualification prompts and answers directly on the lead record.",
        available: true
      }
    ] as const;
  }

  private buildAiPlaceholders(actor: ActorContext): SalesWorkspaceAiPlaceholderSummary {
    const permissionCodes = new Set(actor.permissionCodes);
    const canUseAi =
      permissionCodes.has("leads.use_ai") ||
      permissionCodes.has("leads.manage_ai") ||
      permissionCodes.has("sales.use_ai") ||
      permissionCodes.has("sales.manage_ai") ||
      permissionCodes.has("ai.use_ai") ||
      permissionCodes.has("ai.manage_ai");
    const canManageAi =
      permissionCodes.has("leads.manage_ai") ||
      permissionCodes.has("sales.manage_ai") ||
      permissionCodes.has("ai.manage_ai");

    return {
      actions: canUseAi
        ? [
            {
              key: "call_script_generator",
              label: "Call script generator",
              description: "Placeholder entry point for future stage-aware discovery and outreach scripts."
            },
            {
              key: "objection_handling",
              label: "Objection handling",
              description: "Placeholder entry point for future rebuttal and talk-track guidance."
            },
            {
              key: "lead_research_summary",
              label: "Lead research summary",
              description: "Placeholder entry point for future account, persona, and context summarization."
            },
            {
              key: "follow_up_email_generator",
              label: "Follow-up email generator",
              description: "Placeholder entry point for future outreach recap and follow-up drafting."
            },
            {
              key: "qualification_score",
              label: "Qualification score",
              description: "Placeholder entry point for future AI-assisted qualification scoring."
            }
          ]
        : [],
      governanceHint: canManageAi
        ? "AI placeholders are visible and will later connect to the governed AI Gateway with workspace-specific controls."
        : canUseAi
          ? "AI placeholders are visible for this role, but execution remains deferred until the AI Gateway phase."
          : "AI placeholders remain hidden until the role includes sales, lead, or global AI usage permissions."
    };
  }

  private buildOptionMaps(optionCatalog: WorkspaceOptionCatalog) {
    return {
      outreachStatuses: new Map(optionCatalog.outreachStatuses.map((option) => [option.key, option])),
      handoffStatuses: new Map(optionCatalog.handoffStatuses.map((option) => [option.key, option])),
      callDispositions: new Map(optionCatalog.callDispositions.map((option) => [option.key, option]))
    };
  }

  private mapLeadWorkspaceState(
    metadata: Record<string, unknown> | null | undefined,
    optionCatalog: WorkspaceOptionCatalog
  ) {
    const root = getSalesWorkspaceRoot(metadata);
    const optionMaps = this.buildOptionMaps(optionCatalog);
    const qualificationChecklist = getBantChecklist(root.qualificationChecklist);
    const qualificationChecklistCompletionCount = Object.values(qualificationChecklist).filter(Boolean).length;
    const customQualificationFields = normalizeCustomQualificationFields(root.customQualificationFields);

    return {
      outreachStatus:
        typeof root.outreachStatusKey === "string"
          ? optionMaps.outreachStatuses.get(root.outreachStatusKey.trim()) ?? null
          : null,
      handoffStatus:
        typeof root.handoffStatusKey === "string"
          ? optionMaps.handoffStatuses.get(root.handoffStatusKey.trim()) ?? null
          : null,
      callDisposition:
        typeof root.callDispositionKey === "string"
          ? optionMaps.callDispositions.get(root.callDispositionKey.trim()) ?? null
          : null,
      qualificationFramework: normalizeQualificationFramework(root.qualificationFramework),
      qualificationChecklist,
      qualificationChecklistCompletionCount,
      qualificationChecklistTotal: 4,
      customQualificationFields,
      qualificationNotes:
        typeof root.qualificationNotes === "string" ? getTrimmedNullableString(root.qualificationNotes) : null,
      handoffUpdatedAt:
        typeof root.handoffUpdatedAt === "string" && root.handoffUpdatedAt.trim().length > 0
          ? root.handoffUpdatedAt.trim()
          : null,
      meddicPlaceholder: {
        available: false as const,
        message: "MEDDIC guidance is reserved for a later enrichment phase. Use BANT and custom fields in this release."
      },
      emailSequencePlaceholder: {
        available: false as const,
        message: "Email sequence automation will connect once the outbound orchestration runtime is introduced."
      },
      meetingBookingPlaceholder: {
        available: false as const,
        message: "Meeting booking will connect once calendar sync and scheduling workflows are introduced."
      }
    };
  }

  private mapLeadSummary(row: LeadWorkspaceRow, optionCatalog: WorkspaceOptionCatalog): SalesWorkspaceLeadSummary {
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      fullName: `${row.first_name} ${row.last_name}`.trim(),
      companyName: row.company_name,
      email: row.email,
      phone: row.phone,
      status: mapOptionValue({
        id: row.status_id,
        key: row.status_key,
        label: row.status_label,
        description: row.status_description,
        color: row.status_color,
        isDefault: row.status_is_default,
        isActive: row.status_is_active
      }),
      source: mapOptionValue({
        id: row.source_id,
        key: row.source_key,
        label: row.source_label,
        description: row.source_description,
        color: row.source_color,
        isDefault: row.source_is_default,
        isActive: row.source_is_active
      }),
      score: row.score,
      owner: mapUser({
        id: row.owner_id,
        displayName: row.owner_display_name,
        email: row.owner_email,
        teamName: row.owner_team_name,
        departmentName: row.owner_department_name
      }),
      noteCount: row.note_count,
      activityCount: row.activity_count,
      lastActivityAt: toIsoString(row.last_activity_at),
      metadata: getMetadata(row.metadata),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      workspace: this.mapLeadWorkspaceState(row.metadata, optionCatalog),
      openTaskCount: 0,
      openCallTaskCount: 0,
      overdueTaskCount: 0,
      nextOpenTaskDueAt: null
    };
  }

  private mapTask(row: LeadTaskRow): SalesWorkspaceTaskSummary {
    return {
      id: row.id,
      relatedRecord: {
        entityType: "lead",
        entityId: row.entity_id
      },
      title: row.title,
      description: row.description,
      dueAt: toIsoString(row.due_at),
      reminderAt: toIsoString(row.reminder_at),
      priority: row.priority as SalesWorkspaceTaskSummary["priority"],
      status: row.status as SalesWorkspaceTaskSummary["status"],
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
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      metadata: getMetadata(row.metadata),
      lead: {
        id: row.entity_id,
        fullName: `${row.lead_first_name} ${row.lead_last_name}`.trim(),
        companyName: row.lead_company_name,
        owner: mapUser({
          id: row.lead_owner_id,
          displayName: row.lead_owner_display_name,
          email: row.lead_owner_email,
          teamName: row.lead_owner_team_name,
          departmentName: row.lead_owner_department_name
        }),
        status: mapOptionValue({
          id: row.lead_status_id,
          key: row.lead_status_key,
          label: row.lead_status_label,
          description: row.lead_status_description,
          color: row.lead_status_color,
          isDefault: row.lead_status_is_default,
          isActive: row.lead_status_is_active
        })
      }
    };
  }

  private async loadWorkspaceOptions(client: PoolClient, actor: ActorContext): Promise<SalesWorkspaceOptionsResponse> {
    return {
      owners: await this.loadOwners(client, actor.tenantId),
      leadStatuses: await this.loadOptionSetValues(client, actor.tenantId, "lead-status"),
      leadSources: await this.loadOptionSetValues(client, actor.tenantId, "lead-source"),
      outreachStatuses: await this.loadOptionSetValues(client, actor.tenantId, "lead-outreach-status"),
      handoffStatuses: await this.loadOptionSetValues(client, actor.tenantId, "lead-handoff-status"),
      callDispositions: await this.loadOptionSetValues(client, actor.tenantId, "lead-call-disposition"),
      qualificationFrameworks: [...this.getQualificationFrameworkDefinitions()]
    };
  }

  private async loadVisibleLeadRows(client: PoolClient, actor: ActorContext) {
    const conditions = ["leads.tenant_id = $1", "leads.deleted_at IS NULL"];
    const params: unknown[] = [actor.tenantId];

    if (this.shouldConstrainLeadVisibility(actor)) {
      params.push(actor.userId);
      conditions.push("leads.owner_id = $2");
    }

    const whereClause = conditions.join(" AND ");
    const result = await client.query<LeadWorkspaceRow>(
      `
        SELECT
          leads.id,
          leads.first_name,
          leads.last_name,
          leads.company_name,
          leads.email,
          leads.phone,
          leads.score,
          leads.metadata,
          leads.created_at,
          leads.updated_at,
          COALESCE(note_counts.count, 0)::int AS note_count,
          COALESCE(activity_counts.count, 0)::int AS activity_count,
          activity_counts.last_activity_at,
          owner_users.id AS owner_id,
          owner_users.display_name AS owner_display_name,
          owner_users.email AS owner_email,
          owner_teams.name AS owner_team_name,
          owner_departments.name AS owner_department_name,
          status_values.id AS status_id,
          status_values.value_key AS status_key,
          status_values.label AS status_label,
          status_values.description AS status_description,
          status_values.color AS status_color,
          status_values.is_default AS status_is_default,
          status_values.is_active AS status_is_active,
          source_values.id AS source_id,
          source_values.value_key AS source_key,
          source_values.label AS source_label,
          source_values.description AS source_description,
          source_values.color AS source_color,
          source_values.is_default AS source_is_default,
          source_values.is_active AS source_is_active
        FROM leads
        INNER JOIN tenant_option_values AS status_values
          ON status_values.id = leads.status_option_id
         AND status_values.tenant_id = leads.tenant_id
        INNER JOIN tenant_option_values AS source_values
          ON source_values.id = leads.source_option_id
         AND source_values.tenant_id = leads.tenant_id
        LEFT JOIN users AS owner_users
          ON owner_users.id = leads.owner_id
         AND owner_users.tenant_id = leads.tenant_id
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
          SELECT tenant_id, entity_id, COUNT(*) AS count
          FROM crm_notes
          WHERE entity_type = 'lead'
            AND deleted_at IS NULL
          GROUP BY tenant_id, entity_id
        ) AS note_counts
          ON note_counts.tenant_id = leads.tenant_id
         AND note_counts.entity_id = leads.id
        LEFT JOIN (
          SELECT tenant_id, entity_id, COUNT(*) AS count, MAX(occurred_at) AS last_activity_at
          FROM crm_activities
          WHERE entity_type = 'lead'
            AND deleted_at IS NULL
          GROUP BY tenant_id, entity_id
        ) AS activity_counts
          ON activity_counts.tenant_id = leads.tenant_id
         AND activity_counts.entity_id = leads.id
        WHERE ${whereClause}
        ORDER BY leads.updated_at DESC, leads.created_at DESC
        LIMIT 250
      `,
      params
    );

    return result.rows;
  }

  private async loadLeadTasks(client: PoolClient, actor: ActorContext, leadIds: string[]) {
    if (leadIds.length === 0) {
      return [];
    }

    const result = await client.query<LeadTaskRow>(
      `
        SELECT
          crm_tasks.id,
          crm_tasks.entity_id,
          crm_tasks.title,
          crm_tasks.description,
          crm_tasks.due_at,
          crm_tasks.reminder_at,
          crm_tasks.priority,
          crm_tasks.status,
          crm_tasks.metadata,
          crm_tasks.created_at,
          crm_tasks.updated_at,
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
          leads.first_name AS lead_first_name,
          leads.last_name AS lead_last_name,
          leads.company_name AS lead_company_name,
          lead_owner_users.id AS lead_owner_id,
          lead_owner_users.display_name AS lead_owner_display_name,
          lead_owner_users.email AS lead_owner_email,
          lead_owner_teams.name AS lead_owner_team_name,
          lead_owner_departments.name AS lead_owner_department_name,
          status_values.id AS lead_status_id,
          status_values.value_key AS lead_status_key,
          status_values.label AS lead_status_label,
          status_values.description AS lead_status_description,
          status_values.color AS lead_status_color,
          status_values.is_default AS lead_status_is_default,
          status_values.is_active AS lead_status_is_active
        FROM crm_tasks
        INNER JOIN leads
          ON leads.id = crm_tasks.entity_id
         AND leads.tenant_id = crm_tasks.tenant_id
         AND leads.deleted_at IS NULL
        INNER JOIN tenant_option_values AS status_values
          ON status_values.id = leads.status_option_id
         AND status_values.tenant_id = leads.tenant_id
        LEFT JOIN users AS owner_users
          ON owner_users.id = crm_tasks.owner_user_id
         AND owner_users.tenant_id = crm_tasks.tenant_id
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
          ON assignee_users.id = crm_tasks.assignee_user_id
         AND assignee_users.tenant_id = crm_tasks.tenant_id
         AND assignee_users.deleted_at IS NULL
        LEFT JOIN teams AS assignee_teams
          ON assignee_teams.id = assignee_users.team_id
         AND assignee_teams.tenant_id = assignee_users.tenant_id
         AND assignee_teams.deleted_at IS NULL
        LEFT JOIN departments AS assignee_departments
          ON assignee_departments.id = assignee_users.department_id
         AND assignee_departments.tenant_id = assignee_users.tenant_id
         AND assignee_departments.deleted_at IS NULL
        LEFT JOIN users AS lead_owner_users
          ON lead_owner_users.id = leads.owner_id
         AND lead_owner_users.tenant_id = leads.tenant_id
         AND lead_owner_users.deleted_at IS NULL
        LEFT JOIN teams AS lead_owner_teams
          ON lead_owner_teams.id = lead_owner_users.team_id
         AND lead_owner_teams.tenant_id = lead_owner_users.tenant_id
         AND lead_owner_teams.deleted_at IS NULL
        LEFT JOIN departments AS lead_owner_departments
          ON lead_owner_departments.id = lead_owner_users.department_id
         AND lead_owner_departments.tenant_id = lead_owner_users.tenant_id
         AND lead_owner_departments.deleted_at IS NULL
        WHERE crm_tasks.tenant_id = $1
          AND crm_tasks.entity_type = 'lead'
          AND crm_tasks.entity_id = ANY($2::uuid[])
          AND crm_tasks.deleted_at IS NULL
        ORDER BY
          CASE crm_tasks.status
            WHEN 'open' THEN 0
            WHEN 'in_progress' THEN 1
            WHEN 'blocked' THEN 2
            WHEN 'completed' THEN 3
            ELSE 4
          END,
          crm_tasks.due_at ASC NULLS LAST,
          crm_tasks.created_at DESC
      `,
      [actor.tenantId, leadIds]
    );

    return result.rows.map((row) => this.mapTask(row));
  }

  private hydrateLeadMetrics(leads: SalesWorkspaceLeadSummary[], tasks: SalesWorkspaceTaskSummary[]) {
    const taskMap = new Map<string, SalesWorkspaceTaskSummary[]>();

    for (const task of tasks) {
      const existing = taskMap.get(task.lead.id) ?? [];
      existing.push(task);
      taskMap.set(task.lead.id, existing);
    }

    return leads.map((lead) => {
      const leadTasks = taskMap.get(lead.id) ?? [];
      const openTasks = leadTasks.filter((task) => isTaskOpen(task.status));
      const openCallTasks = openTasks.filter((task) => isCallTask(task.metadata));
      const overdueTaskCount = openTasks.filter(
        (task) => task.dueAt && new Date(task.dueAt).getTime() < Date.now()
      ).length;

      return {
        ...lead,
        openTaskCount: openTasks.length,
        openCallTaskCount: openCallTasks.length,
        overdueTaskCount,
        nextOpenTaskDueAt: openTasks.find((task) => Boolean(task.dueAt))?.dueAt ?? null
      };
    });
  }

  private getProspectingQueue(leads: SalesWorkspaceLeadSummary[]) {
    return leads.filter((lead) => {
      const isActiveLead = lead.status?.key !== "disqualified";
      const handoffKey = lead.workspace.handoffStatus?.key ?? "";
      const outreachKey = lead.workspace.outreachStatus?.key ?? "not_started";

      return (
        isActiveLead &&
        !["handed_to_sales", "accepted_by_sales", "disqualified"].includes(handoffKey) &&
        (lead.source?.key === "outbound" || !["meeting_booked", "responded"].includes(outreachKey))
      );
    });
  }

  private getInsideSalesLeadQueue(leads: SalesWorkspaceLeadSummary[]) {
    return leads.filter((lead) => {
      const statusKey = lead.status?.key ?? "";
      const handoffKey = lead.workspace.handoffStatus?.key ?? "";

      return statusKey !== "disqualified" && handoffKey !== "accepted_by_sales";
    });
  }

  private assertWorkflowMutation(actor: ActorContext, keys: string[]) {
    if (keys.length === 0) {
      throw new AppError(400, "At least one workflow field must be updated.", undefined, "VALIDATION_ERROR");
    }

    const canEdit = actor.permissionCodes.includes("leads.edit") || actor.permissionCodes.includes("leads.configure");
    const canAssign = actor.permissionCodes.includes("leads.assign") || actor.permissionCodes.includes("leads.configure");
    const ownerOnlyMutation = keys.every((key) => key === "ownerId");

    if (!canEdit && !(canAssign && ownerOnlyMutation)) {
      throw new AppError(
        403,
        "You do not have permission to update this lead workflow.",
        undefined,
        "AUTHORIZATION_ERROR"
      );
    }

    if (!canAssign && keys.includes("ownerId")) {
      throw new AppError(
        403,
        "You do not have permission to reassign lead ownership.",
        undefined,
        "AUTHORIZATION_ERROR"
      );
    }
  }

  private sanitizeCustomQualificationFields(fields: LeadCustomQualificationFieldInput[] | undefined) {
    if (!fields) {
      return undefined;
    }

    return fields
      .map((field) => ({
        id: field.id?.trim() || randomUUID(),
        label: field.label.trim(),
        value: field.value.trim()
      }))
      .filter((field) => field.label.length > 0 || field.value.length > 0);
  }

  private async insertLeadWorkflowActivity(
    client: PoolClient,
    actor: ActorContext,
    leadId: string,
    input: {
      subject: string;
      description: string | null;
      outcome: string | null;
      metadata: Record<string, unknown>;
      ownerId: string | null;
    }
  ) {
    await client.query(
      `
        INSERT INTO crm_activities (
          tenant_id,
          entity_type,
          entity_id,
          activity_type,
          subject,
          description,
          occurred_at,
          owner_user_id,
          outcome,
          author_user_id,
          metadata,
          created_by,
          updated_by
        )
        VALUES ($1, 'lead', $2, 'status_change', $3, $4, NOW(), $5, $6, $7, $8::jsonb, $7, $7)
      `,
      [
        actor.tenantId,
        leadId,
        input.subject,
        input.description,
        input.ownerId ?? actor.userId,
        input.outcome,
        actor.userId,
        JSON.stringify(input.metadata)
      ]
    );
  }

  async getWorkspaceOptions(actor: ActorContext): Promise<SalesWorkspaceOptionsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => this.loadWorkspaceOptions(client, actor));
  }

  async getSdrWorkspace(actor: ActorContext): Promise<SdrWorkspaceResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const options = await this.loadWorkspaceOptions(client, actor);
      const optionCatalog: WorkspaceOptionCatalog = {
        outreachStatuses: options.outreachStatuses,
        handoffStatuses: options.handoffStatuses,
        callDispositions: options.callDispositions
      };
      const leadRows = await this.loadVisibleLeadRows(client, actor);
      const tasks = await this.loadLeadTasks(
        client,
        actor,
        leadRows.map((lead) => lead.id)
      );
      const hydratedLeads = this.hydrateLeadMetrics(
        leadRows.map((row) => this.mapLeadSummary(row, optionCatalog)),
        tasks
      );
      const assignedLeads = hydratedLeads.filter((lead) => Boolean(lead.owner));
      const prospectingQueue = this.getProspectingQueue(hydratedLeads);
      const callTaskList = tasks.filter((task) => isTaskOpen(task.status) && isCallTask(task.metadata));

      return {
        dashboard: {
          assignedLeadCount: assignedLeads.length,
          prospectingLeadCount: prospectingQueue.length,
          activeOutreachCount: getActiveOutreachCount(hydratedLeads),
          callTaskCount: callTaskList.length,
          meetingBookedCount: getMeetingBookedCount(hydratedLeads),
          readyForHandoffCount: getReadyForHandoffCount(hydratedLeads)
        },
        assignedLeads,
        prospectingQueue,
        callTaskList,
        aiPlaceholders: this.buildAiPlaceholders(actor)
      };
    });
  }

  async getInsideSalesWorkspace(actor: ActorContext): Promise<InsideSalesWorkspaceResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const options = await this.loadWorkspaceOptions(client, actor);
      const optionCatalog: WorkspaceOptionCatalog = {
        outreachStatuses: options.outreachStatuses,
        handoffStatuses: options.handoffStatuses,
        callDispositions: options.callDispositions
      };
      const leadRows = await this.loadVisibleLeadRows(client, actor);
      const tasks = await this.loadLeadTasks(
        client,
        actor,
        leadRows.map((lead) => lead.id)
      );
      const hydratedLeads = this.hydrateLeadMetrics(
        leadRows.map((row) => this.mapLeadSummary(row, optionCatalog)),
        tasks
      );
      const leadQueue = this.getInsideSalesLeadQueue(hydratedLeads);
      const activeTasks = tasks.filter((task) => isTaskOpen(task.status));
      const callQueue = activeTasks.filter((task) => isCallTask(task.metadata));
      const followUpTasks = activeTasks.filter((task) => !isCallTask(task.metadata));

      return {
        dashboard: {
          leadQueueCount: leadQueue.length,
          callQueueCount: callQueue.length,
          followUpTaskCount: followUpTasks.length,
          qualifiedLeadCount: getQualifiedLeadCount(hydratedLeads),
          handedOffLeadCount: getHandedOffLeadCount(hydratedLeads),
          completedCallCount: getCompletedCallCount(hydratedLeads)
        },
        leadQueue,
        callQueue,
        followUpTasks,
        aiPlaceholders: this.buildAiPlaceholders(actor)
      };
    });
  }

  async updateLeadWorkflow(
    actor: ActorContext,
    audit: AuditMetadata,
    leadId: string,
    input: UpdateLeadWorkspaceRequestBody
  ): Promise<SalesWorkspaceLeadResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateLeadWorkspaceRequestBody] !== undefined);
      this.assertWorkflowMutation(actor, keys);

      const options = await this.loadWorkspaceOptions(client, actor);
      const optionCatalog: WorkspaceOptionCatalog = {
        outreachStatuses: options.outreachStatuses,
        handoffStatuses: options.handoffStatuses,
        callDispositions: options.callDispositions
      };
      const currentLead = await this.getLeadState(client, actor.tenantId, leadId);
      this.assertLeadVisibility(actor, currentLead.owner_id);
      const currentWorkspace = getSalesWorkspaceRoot(currentLead.metadata);
      const ownerId = keys.includes("ownerId")
        ? await this.ensureOwnerId(client, actor.tenantId, input.ownerId ?? null)
        : currentLead.owner_id;
      const statusOptionId = input.statusKey
        ? await this.resolveOptionValueId(client, actor.tenantId, "lead-status", input.statusKey, "Lead status")
        : currentLead.status_option_id;

      if (input.outreachStatusKey) {
        await this.resolveOptionValueId(
          client,
          actor.tenantId,
          "lead-outreach-status",
          input.outreachStatusKey,
          "Lead outreach status"
        );
      }

      if (input.handoffStatusKey) {
        await this.resolveOptionValueId(
          client,
          actor.tenantId,
          "lead-handoff-status",
          input.handoffStatusKey,
          "Lead handoff status"
        );
      }

      if (input.callDispositionKey) {
        await this.resolveOptionValueId(
          client,
          actor.tenantId,
          "lead-call-disposition",
          input.callDispositionKey,
          "Lead call disposition"
        );
      }

      const qualificationChecklist = input.qualificationChecklist
        ? {
            ...getBantChecklist(currentWorkspace.qualificationChecklist),
            ...input.qualificationChecklist
          }
        : getBantChecklist(currentWorkspace.qualificationChecklist);
      const customQualificationFields = this.sanitizeCustomQualificationFields(input.customQualificationFields);
      const nextHandoffStatusKey =
        input.handoffStatusKey !== undefined
          ? getTrimmedNullableString(input.handoffStatusKey)
          : (typeof currentWorkspace.handoffStatusKey === "string"
              ? getTrimmedNullableString(currentWorkspace.handoffStatusKey)
              : null);
      const previousHandoffStatusKey =
        typeof currentWorkspace.handoffStatusKey === "string"
          ? getTrimmedNullableString(currentWorkspace.handoffStatusKey)
          : null;
      const nextWorkspace = {
        ...currentWorkspace,
        outreachStatusKey:
          input.outreachStatusKey !== undefined
            ? getTrimmedNullableString(input.outreachStatusKey)
            : (typeof currentWorkspace.outreachStatusKey === "string"
                ? getTrimmedNullableString(currentWorkspace.outreachStatusKey)
                : null),
        handoffStatusKey: nextHandoffStatusKey,
        callDispositionKey:
          input.callDispositionKey !== undefined
            ? getTrimmedNullableString(input.callDispositionKey)
            : (typeof currentWorkspace.callDispositionKey === "string"
                ? getTrimmedNullableString(currentWorkspace.callDispositionKey)
                : null),
        qualificationFramework:
          input.qualificationFramework !== undefined
            ? input.qualificationFramework
            : normalizeQualificationFramework(currentWorkspace.qualificationFramework),
        qualificationChecklist,
        customQualificationFields:
          customQualificationFields !== undefined
            ? customQualificationFields
            : normalizeCustomQualificationFields(currentWorkspace.customQualificationFields),
        qualificationNotes:
          input.qualificationNotes !== undefined
            ? getTrimmedNullableString(input.qualificationNotes)
            : (typeof currentWorkspace.qualificationNotes === "string"
                ? getTrimmedNullableString(currentWorkspace.qualificationNotes)
                : null),
        handoffUpdatedAt:
          nextHandoffStatusKey !== previousHandoffStatusKey
            ? new Date().toISOString()
            : (typeof currentWorkspace.handoffUpdatedAt === "string"
                ? currentWorkspace.handoffUpdatedAt
                : null)
      };
      const metadata = {
        ...getMetadata(currentLead.metadata),
        ...(input.metadata ?? {}),
        salesWorkspace: nextWorkspace
      };

      await client.query(
        `
          UPDATE leads
          SET
            owner_id = $3,
            status_option_id = $4,
            metadata = $5::jsonb,
            updated_by = $6
          WHERE id = $1
            AND tenant_id = $2
            AND deleted_at IS NULL
        `,
        [leadId, actor.tenantId, ownerId, statusOptionId, JSON.stringify(metadata), actor.userId]
      );

      if (nextHandoffStatusKey !== previousHandoffStatusKey && nextHandoffStatusKey) {
        const handoffLabel =
          optionCatalog.handoffStatuses.find((status) => status.key === nextHandoffStatusKey)?.label ??
          nextHandoffStatusKey;

        await this.insertLeadWorkflowActivity(client, actor, leadId, {
          subject: `Lead handoff moved to ${handoffLabel}`,
          description: getTrimmedNullableString(
            typeof nextWorkspace.qualificationNotes === "string"
              ? `Qualification notes: ${nextWorkspace.qualificationNotes}`
              : null
          ),
          outcome: handoffLabel,
          metadata: {
            fromHandoffStatusKey: previousHandoffStatusKey,
            toHandoffStatusKey: nextHandoffStatusKey
          },
          ownerId
        });

        await this.recordAuditLog(client, actor, audit, {
          action: "lead.handoff.update",
          resourceType: "lead",
          resourceId: leadId,
          status: "success",
          metadata: {
            fromHandoffStatusKey: previousHandoffStatusKey,
            toHandoffStatusKey: nextHandoffStatusKey
          }
        });
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "lead.workspace.update",
        resourceType: "lead",
        resourceId: leadId,
        status: "success",
        metadata: {
          updatedFields: keys
        }
      });

      const leadRowResult = await client.query<LeadWorkspaceRow>(
        `
          SELECT
            leads.id,
            leads.first_name,
            leads.last_name,
            leads.company_name,
            leads.email,
            leads.phone,
            leads.score,
            leads.metadata,
            leads.created_at,
            leads.updated_at,
            COALESCE(note_counts.count, 0)::int AS note_count,
            COALESCE(activity_counts.count, 0)::int AS activity_count,
            activity_counts.last_activity_at,
            owner_users.id AS owner_id,
            owner_users.display_name AS owner_display_name,
            owner_users.email AS owner_email,
            owner_teams.name AS owner_team_name,
            owner_departments.name AS owner_department_name,
            status_values.id AS status_id,
            status_values.value_key AS status_key,
            status_values.label AS status_label,
            status_values.description AS status_description,
            status_values.color AS status_color,
            status_values.is_default AS status_is_default,
            status_values.is_active AS status_is_active,
            source_values.id AS source_id,
            source_values.value_key AS source_key,
            source_values.label AS source_label,
            source_values.description AS source_description,
            source_values.color AS source_color,
            source_values.is_default AS source_is_default,
            source_values.is_active AS source_is_active
          FROM leads
          INNER JOIN tenant_option_values AS status_values
            ON status_values.id = leads.status_option_id
           AND status_values.tenant_id = leads.tenant_id
          INNER JOIN tenant_option_values AS source_values
            ON source_values.id = leads.source_option_id
           AND source_values.tenant_id = leads.tenant_id
          LEFT JOIN users AS owner_users
            ON owner_users.id = leads.owner_id
           AND owner_users.tenant_id = leads.tenant_id
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
            SELECT tenant_id, entity_id, COUNT(*) AS count
            FROM crm_notes
            WHERE entity_type = 'lead'
              AND deleted_at IS NULL
            GROUP BY tenant_id, entity_id
          ) AS note_counts
            ON note_counts.tenant_id = leads.tenant_id
           AND note_counts.entity_id = leads.id
          LEFT JOIN (
            SELECT tenant_id, entity_id, COUNT(*) AS count, MAX(occurred_at) AS last_activity_at
            FROM crm_activities
            WHERE entity_type = 'lead'
              AND deleted_at IS NULL
            GROUP BY tenant_id, entity_id
          ) AS activity_counts
            ON activity_counts.tenant_id = leads.tenant_id
           AND activity_counts.entity_id = leads.id
          WHERE leads.tenant_id = $1
            AND leads.id = $2
            AND leads.deleted_at IS NULL
          LIMIT 1
        `,
        [actor.tenantId, leadId]
      );

      const row = leadRowResult.rows[0];
      const tasks = await this.loadLeadTasks(client, actor, [leadId]);
      const hydratedLead = this.hydrateLeadMetrics([this.mapLeadSummary(row, optionCatalog)], tasks)[0];

      return {
        lead: hydratedLead
      };
    });
  }
}
