import type {
  AccountDetail,
  AccountListQuery,
  AccountLookupSummary,
  AccountOptionsResponse,
  AccountResponse,
  AccountSummary,
  ContactDetail,
  ContactListQuery,
  ContactOptionsResponse,
  ContactResponse,
  ContactSummary,
  CreateAccountRequestBody,
  CreateContactRequestBody,
  CreateCrmActivityRequestBody,
  CreateCrmNoteRequestBody,
  CreateLeadRequestBody,
  CrmActivityResponse,
  CrmActivitySummary,
  CrmLookupUserSummary,
  CrmMutationSuccessResponse,
  CrmNoteResponse,
  CrmNoteSummary,
  CrmOptionValueSummary,
  CrmPagination,
  LeadDetail,
  LeadListQuery,
  LeadOptionsResponse,
  LeadResponse,
  LeadSummary,
  RoleSummary,
  UpdateAccountRequestBody,
  UpdateContactRequestBody,
  UpdateLeadRequestBody
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

type CrmEntityType = "lead" | "account" | "contact";

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

interface NoteRow {
  id: string;
  body: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  author_id: string | null;
  author_display_name: string | null;
  author_email: string | null;
  author_team_name: string | null;
  author_department_name: string | null;
}

interface ActivityRow {
  id: string;
  activity_type: string;
  subject: string;
  description: string | null;
  occurred_at: Date;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  author_id: string | null;
  author_display_name: string | null;
  author_email: string | null;
  author_team_name: string | null;
  author_department_name: string | null;
}

interface LeadStateRow {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string;
  email: string | null;
  phone: string | null;
  status_option_id: string;
  source_option_id: string;
  score: number | null;
  owner_id: string | null;
  metadata: Record<string, unknown> | null;
}

interface AccountStateRow {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  account_type_option_id: string | null;
  health_status_option_id: string | null;
  owner_id: string | null;
  metadata: Record<string, unknown> | null;
}

interface ContactStateRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  role_option_id: string | null;
  owner_id: string | null;
  account_id: string | null;
  metadata: Record<string, unknown> | null;
}

interface LeadRecordRow {
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

interface AccountRecordRow {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  contact_count: number;
  note_count: number;
  activity_count: number;
  owner_id: string | null;
  owner_display_name: string | null;
  owner_email: string | null;
  owner_team_name: string | null;
  owner_department_name: string | null;
  account_type_id: string | null;
  account_type_key: string | null;
  account_type_label: string | null;
  account_type_description: string | null;
  account_type_color: string | null;
  account_type_is_default: boolean | null;
  account_type_is_active: boolean | null;
  health_status_id: string | null;
  health_status_key: string | null;
  health_status_label: string | null;
  health_status_description: string | null;
  health_status_color: string | null;
  health_status_is_default: boolean | null;
  health_status_is_active: boolean | null;
}

interface ContactRecordRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  note_count: number;
  activity_count: number;
  owner_id: string | null;
  owner_display_name: string | null;
  owner_email: string | null;
  owner_team_name: string | null;
  owner_department_name: string | null;
  account_id: string | null;
  account_name: string | null;
  account_website: string | null;
  role_id: string | null;
  role_key: string | null;
  role_label: string | null;
  role_description: string | null;
  role_color: string | null;
  role_is_default: boolean | null;
  role_is_active: boolean | null;
}

interface ContactRelationshipRow {
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

interface AccountLookupRow {
  id: string;
  name: string;
  website: string | null;
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

export class CrmService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {}

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(
        503,
        "CRM modules are unavailable until the database connection is enabled.",
        undefined,
        "CRM_UNAVAILABLE"
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

  private async getLeadState(client: PoolClient, tenantId: string, leadId: string) {
    const result = await client.query<LeadStateRow>(
      `
        SELECT
          id,
          first_name,
          last_name,
          company_name,
          email,
          phone,
          status_option_id,
          source_option_id,
          score,
          owner_id,
          metadata
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

  private async getAccountState(client: PoolClient, tenantId: string, accountId: string) {
    const result = await client.query<AccountStateRow>(
      `
        SELECT
          id,
          name,
          website,
          industry,
          account_type_option_id,
          health_status_option_id,
          owner_id,
          metadata
        FROM accounts
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [accountId, tenantId]
    );

    const account = result.rows[0] ?? null;

    if (!account) {
      throw new AppError(404, "Account not found.", undefined, "ACCOUNT_NOT_FOUND");
    }

    return account;
  }

  private async getContactState(client: PoolClient, tenantId: string, contactId: string) {
    const result = await client.query<ContactStateRow>(
      `
        SELECT
          id,
          first_name,
          last_name,
          email,
          phone,
          linkedin_url,
          role_option_id,
          owner_id,
          account_id,
          metadata
        FROM contacts
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [contactId, tenantId]
    );

    const contact = result.rows[0] ?? null;

    if (!contact) {
      throw new AppError(404, "Contact not found.", undefined, "CONTACT_NOT_FOUND");
    }

    return contact;
  }

  private assertAssignOnlyMutation(
    actor: ActorContext,
    permissionPrefix: "leads" | "accounts" | "contacts",
    keys: string[]
  ) {
    if (keys.length === 0) {
      throw new AppError(400, "At least one field must be updated.", undefined, "VALIDATION_ERROR");
    }

    const canEdit = actor.permissionCodes.includes(`${permissionPrefix}.edit`);
    const canAssign = actor.permissionCodes.includes(`${permissionPrefix}.assign`);
    const isOwnerOnlyMutation = keys.every((key) => key === "ownerId");

    if (!canEdit && !(canAssign && isOwnerOnlyMutation)) {
      throw new AppError(
        403,
        "You do not have permission to update these fields.",
        undefined,
        "AUTHORIZATION_ERROR"
      );
    }
  }

  private async assertEntityExists(
    client: PoolClient,
    tenantId: string,
    entityType: CrmEntityType,
    entityId: string
  ) {
    const tableNameByEntityType: Record<CrmEntityType, string> = {
      lead: "leads",
      account: "accounts",
      contact: "contacts"
    };

    const tableName = tableNameByEntityType[entityType];
    const result = await client.query<{ id: string }>(
      `SELECT id FROM ${tableName} WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [entityId, tenantId]
    );

    if (!result.rows[0]?.id) {
      throw new AppError(404, `${entityType.charAt(0).toUpperCase()}${entityType.slice(1)} not found.`, undefined, `${entityType.toUpperCase()}_NOT_FOUND`);
    }
  }

  private async loadEntityNotes(
    client: PoolClient,
    tenantId: string,
    entityType: CrmEntityType,
    entityId: string
  ): Promise<CrmNoteSummary[]> {
    const result = await client.query<NoteRow>(
      `
        SELECT
          crm_notes.id,
          crm_notes.body,
          crm_notes.metadata,
          crm_notes.created_at,
          crm_notes.updated_at,
          users.id AS author_id,
          users.display_name AS author_display_name,
          users.email AS author_email,
          teams.name AS author_team_name,
          departments.name AS author_department_name
        FROM crm_notes
        LEFT JOIN users
          ON users.id = crm_notes.author_user_id
         AND users.tenant_id = crm_notes.tenant_id
         AND users.deleted_at IS NULL
        LEFT JOIN teams
          ON teams.id = users.team_id
         AND teams.tenant_id = users.tenant_id
         AND teams.deleted_at IS NULL
        LEFT JOIN departments
          ON departments.id = users.department_id
         AND departments.tenant_id = users.tenant_id
         AND departments.deleted_at IS NULL
        WHERE crm_notes.tenant_id = $1
          AND crm_notes.entity_type = $2
          AND crm_notes.entity_id = $3
          AND crm_notes.deleted_at IS NULL
        ORDER BY crm_notes.created_at DESC
      `,
      [tenantId, entityType, entityId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      body: row.body,
      author: mapUser({
        id: row.author_id,
        displayName: row.author_display_name,
        email: row.author_email,
        teamName: row.author_team_name,
        departmentName: row.author_department_name
      }),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      metadata: getMetadata(row.metadata)
    }));
  }

  private async loadEntityActivities(
    client: PoolClient,
    tenantId: string,
    entityType: CrmEntityType,
    entityId: string
  ): Promise<CrmActivitySummary[]> {
    const result = await client.query<ActivityRow>(
      `
        SELECT
          crm_activities.id,
          crm_activities.activity_type,
          crm_activities.subject,
          crm_activities.description,
          crm_activities.occurred_at,
          crm_activities.metadata,
          crm_activities.created_at,
          users.id AS author_id,
          users.display_name AS author_display_name,
          users.email AS author_email,
          teams.name AS author_team_name,
          departments.name AS author_department_name
        FROM crm_activities
        LEFT JOIN users
          ON users.id = crm_activities.author_user_id
         AND users.tenant_id = crm_activities.tenant_id
         AND users.deleted_at IS NULL
        LEFT JOIN teams
          ON teams.id = users.team_id
         AND teams.tenant_id = users.tenant_id
         AND teams.deleted_at IS NULL
        LEFT JOIN departments
          ON departments.id = users.department_id
         AND departments.tenant_id = users.tenant_id
         AND departments.deleted_at IS NULL
        WHERE crm_activities.tenant_id = $1
          AND crm_activities.entity_type = $2
          AND crm_activities.entity_id = $3
          AND crm_activities.deleted_at IS NULL
        ORDER BY crm_activities.occurred_at DESC, crm_activities.created_at DESC
      `,
      [tenantId, entityType, entityId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      activityType: row.activity_type as CrmActivitySummary["activityType"],
      subject: row.subject,
      description: row.description,
      occurredAt: row.occurred_at.toISOString(),
      author: mapUser({
        id: row.author_id,
        displayName: row.author_display_name,
        email: row.author_email,
        teamName: row.author_team_name,
        departmentName: row.author_department_name
      }),
      createdAt: row.created_at.toISOString(),
      metadata: getMetadata(row.metadata)
    }));
  }

  private async loadNoteById(client: PoolClient, tenantId: string, noteId: string) {
    const result = await client.query<NoteRow>(
      `
        SELECT
          crm_notes.id,
          crm_notes.body,
          crm_notes.metadata,
          crm_notes.created_at,
          crm_notes.updated_at,
          users.id AS author_id,
          users.display_name AS author_display_name,
          users.email AS author_email,
          teams.name AS author_team_name,
          departments.name AS author_department_name
        FROM crm_notes
        LEFT JOIN users
          ON users.id = crm_notes.author_user_id
         AND users.tenant_id = crm_notes.tenant_id
         AND users.deleted_at IS NULL
        LEFT JOIN teams
          ON teams.id = users.team_id
         AND teams.tenant_id = users.tenant_id
         AND teams.deleted_at IS NULL
        LEFT JOIN departments
          ON departments.id = users.department_id
         AND departments.tenant_id = users.tenant_id
         AND departments.deleted_at IS NULL
        WHERE crm_notes.tenant_id = $1
          AND crm_notes.id = $2
          AND crm_notes.deleted_at IS NULL
        LIMIT 1
      `,
      [tenantId, noteId]
    );

    const note = result.rows[0] ?? null;

    if (!note) {
      throw new AppError(404, "Note not found.", undefined, "NOTE_NOT_FOUND");
    }

    return {
      id: note.id,
      body: note.body,
      author: mapUser({
        id: note.author_id,
        displayName: note.author_display_name,
        email: note.author_email,
        teamName: note.author_team_name,
        departmentName: note.author_department_name
      }),
      createdAt: note.created_at.toISOString(),
      updatedAt: note.updated_at.toISOString(),
      metadata: getMetadata(note.metadata)
    };
  }

  private async loadActivityById(client: PoolClient, tenantId: string, activityId: string) {
    const result = await client.query<ActivityRow>(
      `
        SELECT
          crm_activities.id,
          crm_activities.activity_type,
          crm_activities.subject,
          crm_activities.description,
          crm_activities.occurred_at,
          crm_activities.metadata,
          crm_activities.created_at,
          users.id AS author_id,
          users.display_name AS author_display_name,
          users.email AS author_email,
          teams.name AS author_team_name,
          departments.name AS author_department_name
        FROM crm_activities
        LEFT JOIN users
          ON users.id = crm_activities.author_user_id
         AND users.tenant_id = crm_activities.tenant_id
         AND users.deleted_at IS NULL
        LEFT JOIN teams
          ON teams.id = users.team_id
         AND teams.tenant_id = users.tenant_id
         AND teams.deleted_at IS NULL
        LEFT JOIN departments
          ON departments.id = users.department_id
         AND departments.tenant_id = users.tenant_id
         AND departments.deleted_at IS NULL
        WHERE crm_activities.tenant_id = $1
          AND crm_activities.id = $2
          AND crm_activities.deleted_at IS NULL
        LIMIT 1
      `,
      [tenantId, activityId]
    );

    const activity = result.rows[0] ?? null;

    if (!activity) {
      throw new AppError(404, "Activity not found.", undefined, "ACTIVITY_NOT_FOUND");
    }

    return {
      id: activity.id,
      activityType: activity.activity_type as CrmActivitySummary["activityType"],
      subject: activity.subject,
      description: activity.description,
      occurredAt: activity.occurred_at.toISOString(),
      author: mapUser({
        id: activity.author_id,
        displayName: activity.author_display_name,
        email: activity.author_email,
        teamName: activity.author_team_name,
        departmentName: activity.author_department_name
      }),
      createdAt: activity.created_at.toISOString(),
      metadata: getMetadata(activity.metadata)
    };
  }

  private mapLead(row: LeadRecordRow): LeadSummary {
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
      updatedAt: row.updated_at.toISOString()
    };
  }

  private mapAccount(row: AccountRecordRow): AccountSummary {
    return {
      id: row.id,
      name: row.name,
      website: row.website,
      industry: row.industry,
      accountType: mapOptionValue({
        id: row.account_type_id,
        key: row.account_type_key,
        label: row.account_type_label,
        description: row.account_type_description,
        color: row.account_type_color,
        isDefault: row.account_type_is_default,
        isActive: row.account_type_is_active
      }),
      healthStatus: mapOptionValue({
        id: row.health_status_id,
        key: row.health_status_key,
        label: row.health_status_label,
        description: row.health_status_description,
        color: row.health_status_color,
        isDefault: row.health_status_is_default,
        isActive: row.health_status_is_active
      }),
      owner: mapUser({
        id: row.owner_id,
        displayName: row.owner_display_name,
        email: row.owner_email,
        teamName: row.owner_team_name,
        departmentName: row.owner_department_name
      }),
      contactCount: row.contact_count,
      noteCount: row.note_count,
      activityCount: row.activity_count,
      metadata: getMetadata(row.metadata),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private mapContact(row: ContactRecordRow): ContactSummary {
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      fullName: `${row.first_name} ${row.last_name}`.trim(),
      email: row.email,
      phone: row.phone,
      linkedinUrl: row.linkedin_url,
      role: mapOptionValue({
        id: row.role_id,
        key: row.role_key,
        label: row.role_label,
        description: row.role_description,
        color: row.role_color,
        isDefault: row.role_is_default,
        isActive: row.role_is_active
      }),
      owner: mapUser({
        id: row.owner_id,
        displayName: row.owner_display_name,
        email: row.owner_email,
        teamName: row.owner_team_name,
        departmentName: row.owner_department_name
      }),
      account: row.account_id && row.account_name
        ? {
            id: row.account_id,
            name: row.account_name,
            website: row.account_website
          }
        : null,
      noteCount: row.note_count,
      activityCount: row.activity_count,
      metadata: getMetadata(row.metadata),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  async listLeads(actor: ActorContext, query: LeadListQuery) {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const page = getPositiveNumber(query.page, 1, 10_000);
      const pageSize = getPositiveNumber(query.pageSize, 12, 100);
      const offset = (page - 1) * pageSize;
      const conditions = ["leads.tenant_id = $1", "leads.deleted_at IS NULL"];
      const params: unknown[] = [actor.tenantId];

      if (query.search) {
        params.push(`%${query.search.trim()}%`);
        const searchIndex = params.length;
        conditions.push(
          `(CONCAT_WS(' ', leads.first_name, leads.last_name) ILIKE $${searchIndex} OR leads.company_name ILIKE $${searchIndex} OR COALESCE(leads.email, '') ILIKE $${searchIndex} OR COALESCE(leads.phone, '') ILIKE $${searchIndex})`
        );
      }

      if (query.status) {
        params.push(query.status.trim());
        conditions.push(`status_values.value_key = $${params.length}`);
      }

      if (query.source) {
        params.push(query.source.trim());
        conditions.push(`source_values.value_key = $${params.length}`);
      }

      if (query.ownerId) {
        params.push(query.ownerId);
        conditions.push(`leads.owner_id = $${params.length}`);
      }

      const whereClause = conditions.join(" AND ");
      const countResult = await client.query<{ total: number }>(
        `
          SELECT COUNT(*)::int AS total
          FROM leads
          INNER JOIN tenant_option_values AS status_values
            ON status_values.id = leads.status_option_id
           AND status_values.tenant_id = leads.tenant_id
          INNER JOIN tenant_option_values AS source_values
            ON source_values.id = leads.source_option_id
           AND source_values.tenant_id = leads.tenant_id
          WHERE ${whereClause}
        `,
        params
      );

      const total = countResult.rows[0]?.total ?? 0;
      const sortColumnByKey = {
        createdAt: "leads.created_at",
        updatedAt: "leads.updated_at",
        companyName: "leads.company_name",
        status: "status_values.label",
        source: "source_values.label",
        score: "COALESCE(leads.score, -1)",
        owner: "COALESCE(owner_users.display_name, '')"
      } as const;
      const sortKey = (query.sortBy ?? "updatedAt") as keyof typeof sortColumnByKey;
      const sortColumn = sortColumnByKey[sortKey];
      const sortOrder = query.sortOrder === "asc" ? "ASC" : "DESC";

      params.push(pageSize, offset);

      const result = await client.query<LeadRecordRow>(
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
          ORDER BY ${sortColumn} ${sortOrder}, leads.created_at DESC
          LIMIT $${params.length - 1}
          OFFSET $${params.length}
        `,
        params
      );

      return {
        leads: result.rows.map((row) => this.mapLead(row)),
        pagination: getPagination(total, page, pageSize)
      };
    });
  }

  async getLead(actor: ActorContext, leadId: string): Promise<LeadResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => ({
      lead: await this.loadLeadDetail(client, actor.tenantId, leadId)
    }));
  }

  private async loadLeadDetail(client: PoolClient, tenantId: string, leadId: string): Promise<LeadDetail> {
    const result = await client.query<LeadRecordRow>(
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
      [tenantId, leadId]
    );

    const row = result.rows[0] ?? null;

    if (!row) {
      throw new AppError(404, "Lead not found.", undefined, "LEAD_NOT_FOUND");
    }

    return {
      ...this.mapLead(row),
      notes: await this.loadEntityNotes(client, tenantId, "lead", leadId),
      activities: await this.loadEntityActivities(client, tenantId, "lead", leadId),
      conversionPlaceholder: {
        available: false,
        message: "Lead conversion is reserved for a later opportunity-management phase."
      }
    };
  }

  async createLead(actor: ActorContext, audit: AuditMetadata, input: CreateLeadRequestBody): Promise<LeadResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const ownerId = await this.ensureOwnerId(client, actor.tenantId, input.ownerId ?? null);
      const statusOptionId = await this.resolveOptionValueId(client, actor.tenantId, "lead-status", input.statusKey, "Lead status");
      const sourceOptionId = await this.resolveOptionValueId(client, actor.tenantId, "lead-source", input.sourceKey, "Lead source");
      const result = await client.query<{ id: string }>(
        `
          INSERT INTO leads (
            tenant_id,
            owner_id,
            first_name,
            last_name,
            company_name,
            email,
            phone,
            status_option_id,
            source_option_id,
            score,
            metadata,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $12)
          RETURNING id
        `,
        [
          actor.tenantId,
          ownerId,
          input.firstName.trim(),
          input.lastName.trim(),
          input.companyName.trim(),
          getTrimmedNullableString(input.email),
          getTrimmedNullableString(input.phone),
          statusOptionId,
          sourceOptionId,
          input.score ?? null,
          JSON.stringify(input.metadata ?? {}),
          actor.userId
        ]
      );

      const leadId = result.rows[0]?.id;

      if (!leadId) {
        throw new AppError(500, "Lead creation failed.", undefined, "LEAD_CREATE_FAILED");
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "lead.create",
        resourceType: "lead",
        resourceId: leadId,
        status: "success",
        metadata: {
          ownerId,
          statusKey: input.statusKey,
          sourceKey: input.sourceKey
        }
      });

      return {
        lead: await this.loadLeadDetail(client, actor.tenantId, leadId)
      };
    });
  }

  async updateLead(
    actor: ActorContext,
    audit: AuditMetadata,
    leadId: string,
    input: UpdateLeadRequestBody
  ): Promise<LeadResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateLeadRequestBody] !== undefined);
      this.assertAssignOnlyMutation(actor, "leads", keys);

      const currentLead = await this.getLeadState(client, actor.tenantId, leadId);
      const ownerId = keys.includes("ownerId")
        ? await this.ensureOwnerId(client, actor.tenantId, input.ownerId ?? null)
        : currentLead.owner_id;
      const statusOptionId = input.statusKey
        ? await this.resolveOptionValueId(client, actor.tenantId, "lead-status", input.statusKey, "Lead status")
        : currentLead.status_option_id;
      const sourceOptionId = input.sourceKey
        ? await this.resolveOptionValueId(client, actor.tenantId, "lead-source", input.sourceKey, "Lead source")
        : currentLead.source_option_id;
      const metadata = input.metadata ? { ...getMetadata(currentLead.metadata), ...input.metadata } : getMetadata(currentLead.metadata);

      await client.query(
        `
          UPDATE leads
          SET
            owner_id = $3,
            first_name = $4,
            last_name = $5,
            company_name = $6,
            email = $7,
            phone = $8,
            status_option_id = $9,
            source_option_id = $10,
            score = $11,
            metadata = $12::jsonb,
            updated_by = $13
          WHERE id = $1
            AND tenant_id = $2
            AND deleted_at IS NULL
        `,
        [
          leadId,
          actor.tenantId,
          ownerId,
          input.firstName?.trim() ?? currentLead.first_name,
          input.lastName?.trim() ?? currentLead.last_name,
          input.companyName?.trim() ?? currentLead.company_name,
          input.email !== undefined ? getTrimmedNullableString(input.email) : currentLead.email,
          input.phone !== undefined ? getTrimmedNullableString(input.phone) : currentLead.phone,
          statusOptionId,
          sourceOptionId,
          input.score !== undefined ? input.score : currentLead.score,
          JSON.stringify(metadata),
          actor.userId
        ]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "lead.update",
        resourceType: "lead",
        resourceId: leadId,
        status: "success",
        metadata: {
          updatedFields: keys
        }
      });

      return {
        lead: await this.loadLeadDetail(client, actor.tenantId, leadId)
      };
    });
  }

  async deleteLead(actor: ActorContext, audit: AuditMetadata, leadId: string): Promise<CrmMutationSuccessResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      await this.getLeadState(client, actor.tenantId, leadId);
      await client.query(
        `
          UPDATE leads
          SET
            deleted_at = NOW(),
            updated_by = $3
          WHERE id = $1
            AND tenant_id = $2
            AND deleted_at IS NULL
        `,
        [leadId, actor.tenantId, actor.userId]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "lead.delete",
        resourceType: "lead",
        resourceId: leadId,
        status: "success"
      });

      return { success: true };
    });
  }

  async getLeadOptions(actor: ActorContext): Promise<LeadOptionsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => ({
      owners: await this.loadOwners(client, actor.tenantId),
      statuses: await this.loadOptionSetValues(client, actor.tenantId, "lead-status"),
      sources: await this.loadOptionSetValues(client, actor.tenantId, "lead-source")
    }));
  }

  async addLeadNote(
    actor: ActorContext,
    audit: AuditMetadata,
    leadId: string,
    input: CreateCrmNoteRequestBody
  ): Promise<CrmNoteResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      await this.assertEntityExists(client, actor.tenantId, "lead", leadId);
      const result = await client.query<{ id: string }>(
        `
          INSERT INTO crm_notes (
            tenant_id,
            entity_type,
            entity_id,
            author_user_id,
            body,
            metadata,
            created_by,
            updated_by
          )
          VALUES ($1, 'lead', $2, $3, $4, '{}'::jsonb, $3, $3)
          RETURNING id
        `,
        [actor.tenantId, leadId, actor.userId, input.body.trim()]
      );

      const noteId = result.rows[0]?.id;

      if (!noteId) {
        throw new AppError(500, "Lead note creation failed.", undefined, "NOTE_CREATE_FAILED");
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "lead.note.create",
        resourceType: "lead",
        resourceId: leadId,
        status: "success",
        metadata: {
          noteId
        }
      });

      return {
        note: await this.loadNoteById(client, actor.tenantId, noteId)
      };
    });
  }

  async addLeadActivity(
    actor: ActorContext,
    audit: AuditMetadata,
    leadId: string,
    input: CreateCrmActivityRequestBody
  ): Promise<CrmActivityResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      await this.assertEntityExists(client, actor.tenantId, "lead", leadId);
      const result = await client.query<{ id: string }>(
        `
          INSERT INTO crm_activities (
            tenant_id,
            entity_type,
            entity_id,
            activity_type,
            subject,
            description,
            occurred_at,
            author_user_id,
            metadata,
            created_by,
            updated_by
          )
          VALUES ($1, 'lead', $2, $3, $4, $5, $6, $7, '{}'::jsonb, $7, $7)
          RETURNING id
        `,
        [
          actor.tenantId,
          leadId,
          input.activityType,
          input.subject.trim(),
          getTrimmedNullableString(input.description),
          input.occurredAt ? new Date(input.occurredAt) : new Date(),
          actor.userId
        ]
      );

      const activityId = result.rows[0]?.id;

      if (!activityId) {
        throw new AppError(500, "Lead activity creation failed.", undefined, "ACTIVITY_CREATE_FAILED");
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "lead.activity.create",
        resourceType: "lead",
        resourceId: leadId,
        status: "success",
        metadata: {
          activityId,
          activityType: input.activityType
        }
      });

      return {
        activity: await this.loadActivityById(client, actor.tenantId, activityId)
      };
    });
  }

  async listAccounts(actor: ActorContext, query: AccountListQuery) {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const page = getPositiveNumber(query.page, 1, 10_000);
      const pageSize = getPositiveNumber(query.pageSize, 12, 100);
      const offset = (page - 1) * pageSize;
      const conditions = ["accounts.tenant_id = $1", "accounts.deleted_at IS NULL"];
      const params: unknown[] = [actor.tenantId];

      if (query.search) {
        params.push(`%${query.search.trim()}%`);
        const searchIndex = params.length;
        conditions.push(
          `(accounts.name ILIKE $${searchIndex} OR COALESCE(accounts.website, '') ILIKE $${searchIndex} OR COALESCE(accounts.industry, '') ILIKE $${searchIndex})`
        );
      }

      if (query.accountType) {
        params.push(query.accountType.trim());
        conditions.push(`account_type_values.value_key = $${params.length}`);
      }

      if (query.industry) {
        params.push(`%${query.industry.trim()}%`);
        conditions.push(`accounts.industry ILIKE $${params.length}`);
      }

      if (query.ownerId) {
        params.push(query.ownerId);
        conditions.push(`accounts.owner_id = $${params.length}`);
      }

      const whereClause = conditions.join(" AND ");
      const countResult = await client.query<{ total: number }>(
        `
          SELECT COUNT(*)::int AS total
          FROM accounts
          LEFT JOIN tenant_option_values AS account_type_values
            ON account_type_values.id = accounts.account_type_option_id
           AND account_type_values.tenant_id = accounts.tenant_id
          WHERE ${whereClause}
        `,
        params
      );

      const total = countResult.rows[0]?.total ?? 0;
      const sortColumnByKey = {
        createdAt: "accounts.created_at",
        updatedAt: "accounts.updated_at",
        name: "accounts.name",
        accountType: "COALESCE(account_type_values.label, '')",
        industry: "COALESCE(accounts.industry, '')",
        owner: "COALESCE(owner_users.display_name, '')"
      } as const;
      const sortKey = (query.sortBy ?? "updatedAt") as keyof typeof sortColumnByKey;
      const sortColumn = sortColumnByKey[sortKey];
      const sortOrder = query.sortOrder === "asc" ? "ASC" : "DESC";

      params.push(pageSize, offset);

      const result = await client.query<AccountRecordRow>(
        `
          SELECT
            accounts.id,
            accounts.name,
            accounts.website,
            accounts.industry,
            accounts.metadata,
            accounts.created_at,
            accounts.updated_at,
            COALESCE(contact_counts.count, 0)::int AS contact_count,
            COALESCE(note_counts.count, 0)::int AS note_count,
            COALESCE(activity_counts.count, 0)::int AS activity_count,
            owner_users.id AS owner_id,
            owner_users.display_name AS owner_display_name,
            owner_users.email AS owner_email,
            owner_teams.name AS owner_team_name,
            owner_departments.name AS owner_department_name,
            account_type_values.id AS account_type_id,
            account_type_values.value_key AS account_type_key,
            account_type_values.label AS account_type_label,
            account_type_values.description AS account_type_description,
            account_type_values.color AS account_type_color,
            account_type_values.is_default AS account_type_is_default,
            account_type_values.is_active AS account_type_is_active,
            health_values.id AS health_status_id,
            health_values.value_key AS health_status_key,
            health_values.label AS health_status_label,
            health_values.description AS health_status_description,
            health_values.color AS health_status_color,
            health_values.is_default AS health_status_is_default,
            health_values.is_active AS health_status_is_active
          FROM accounts
          LEFT JOIN tenant_option_values AS account_type_values
            ON account_type_values.id = accounts.account_type_option_id
           AND account_type_values.tenant_id = accounts.tenant_id
          LEFT JOIN tenant_option_values AS health_values
            ON health_values.id = accounts.health_status_option_id
           AND health_values.tenant_id = accounts.tenant_id
          LEFT JOIN users AS owner_users
            ON owner_users.id = accounts.owner_id
           AND owner_users.tenant_id = accounts.tenant_id
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
            SELECT tenant_id, account_id, COUNT(*) AS count
            FROM contacts
            WHERE deleted_at IS NULL
            GROUP BY tenant_id, account_id
          ) AS contact_counts
            ON contact_counts.tenant_id = accounts.tenant_id
           AND contact_counts.account_id = accounts.id
          LEFT JOIN (
            SELECT tenant_id, entity_id, COUNT(*) AS count
            FROM crm_notes
            WHERE entity_type = 'account'
              AND deleted_at IS NULL
            GROUP BY tenant_id, entity_id
          ) AS note_counts
            ON note_counts.tenant_id = accounts.tenant_id
           AND note_counts.entity_id = accounts.id
          LEFT JOIN (
            SELECT tenant_id, entity_id, COUNT(*) AS count
            FROM crm_activities
            WHERE entity_type = 'account'
              AND deleted_at IS NULL
            GROUP BY tenant_id, entity_id
          ) AS activity_counts
            ON activity_counts.tenant_id = accounts.tenant_id
           AND activity_counts.entity_id = accounts.id
          WHERE ${whereClause}
          ORDER BY ${sortColumn} ${sortOrder}, accounts.created_at DESC
          LIMIT $${params.length - 1}
          OFFSET $${params.length}
        `,
        params
      );

      return {
        accounts: result.rows.map((row) => this.mapAccount(row)),
        pagination: getPagination(total, page, pageSize)
      };
    });
  }

  async getAccount(actor: ActorContext, accountId: string): Promise<AccountResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => ({
      account: await this.loadAccountDetail(client, actor.tenantId, accountId)
    }));
  }

  private async loadAccountDetail(client: PoolClient, tenantId: string, accountId: string): Promise<AccountDetail> {
    const result = await client.query<AccountRecordRow>(
      `
        SELECT
          accounts.id,
          accounts.name,
          accounts.website,
          accounts.industry,
          accounts.metadata,
          accounts.created_at,
          accounts.updated_at,
          COALESCE(contact_counts.count, 0)::int AS contact_count,
          COALESCE(note_counts.count, 0)::int AS note_count,
          COALESCE(activity_counts.count, 0)::int AS activity_count,
          owner_users.id AS owner_id,
          owner_users.display_name AS owner_display_name,
          owner_users.email AS owner_email,
          owner_teams.name AS owner_team_name,
          owner_departments.name AS owner_department_name,
          account_type_values.id AS account_type_id,
          account_type_values.value_key AS account_type_key,
          account_type_values.label AS account_type_label,
          account_type_values.description AS account_type_description,
          account_type_values.color AS account_type_color,
          account_type_values.is_default AS account_type_is_default,
          account_type_values.is_active AS account_type_is_active,
          health_values.id AS health_status_id,
          health_values.value_key AS health_status_key,
          health_values.label AS health_status_label,
          health_values.description AS health_status_description,
          health_values.color AS health_status_color,
          health_values.is_default AS health_status_is_default,
          health_values.is_active AS health_status_is_active
        FROM accounts
        LEFT JOIN tenant_option_values AS account_type_values
          ON account_type_values.id = accounts.account_type_option_id
         AND account_type_values.tenant_id = accounts.tenant_id
        LEFT JOIN tenant_option_values AS health_values
          ON health_values.id = accounts.health_status_option_id
         AND health_values.tenant_id = accounts.tenant_id
        LEFT JOIN users AS owner_users
          ON owner_users.id = accounts.owner_id
         AND owner_users.tenant_id = accounts.tenant_id
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
          SELECT tenant_id, account_id, COUNT(*) AS count
          FROM contacts
          WHERE deleted_at IS NULL
          GROUP BY tenant_id, account_id
        ) AS contact_counts
          ON contact_counts.tenant_id = accounts.tenant_id
         AND contact_counts.account_id = accounts.id
        LEFT JOIN (
          SELECT tenant_id, entity_id, COUNT(*) AS count
          FROM crm_notes
          WHERE entity_type = 'account'
            AND deleted_at IS NULL
          GROUP BY tenant_id, entity_id
        ) AS note_counts
          ON note_counts.tenant_id = accounts.tenant_id
         AND note_counts.entity_id = accounts.id
        LEFT JOIN (
          SELECT tenant_id, entity_id, COUNT(*) AS count
          FROM crm_activities
          WHERE entity_type = 'account'
            AND deleted_at IS NULL
          GROUP BY tenant_id, entity_id
        ) AS activity_counts
          ON activity_counts.tenant_id = accounts.tenant_id
         AND activity_counts.entity_id = accounts.id
        WHERE accounts.tenant_id = $1
          AND accounts.id = $2
          AND accounts.deleted_at IS NULL
        LIMIT 1
      `,
      [tenantId, accountId]
    );

    const row = result.rows[0] ?? null;

    if (!row) {
      throw new AppError(404, "Account not found.", undefined, "ACCOUNT_NOT_FOUND");
    }

    const relatedContactsResult = await client.query<ContactRelationshipRow>(
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
          AND contacts.account_id = $2
          AND contacts.deleted_at IS NULL
        ORDER BY contacts.last_name ASC, contacts.first_name ASC
        LIMIT 10
      `,
      [tenantId, accountId]
    );

    return {
      ...this.mapAccount(row),
      notes: await this.loadEntityNotes(client, tenantId, "account", accountId),
      activities: await this.loadEntityActivities(client, tenantId, "account", accountId),
      relatedContacts: relatedContactsResult.rows.map((contact) => ({
        id: contact.id,
        fullName: `${contact.first_name} ${contact.last_name}`.trim(),
        email: contact.email,
        role: mapOptionValue({
          id: contact.role_id,
          key: contact.role_key,
          label: contact.role_label,
          description: contact.role_description,
          color: contact.role_color,
          isDefault: contact.role_is_default,
          isActive: contact.role_is_active
        })
      })),
      relatedOpportunitiesPlaceholder: {
        available: false,
        message: "Opportunity relationships will attach to accounts in a later revenue phase."
      }
    };
  }

  async createAccount(
    actor: ActorContext,
    audit: AuditMetadata,
    input: CreateAccountRequestBody
  ): Promise<AccountResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const ownerId = await this.ensureOwnerId(client, actor.tenantId, input.ownerId ?? null);
      const accountTypeOptionId = input.accountTypeKey
        ? await this.resolveOptionValueId(client, actor.tenantId, "account-type", input.accountTypeKey, "Account type")
        : null;
      const healthStatusOptionId = input.healthStatusKey
        ? await this.resolveOptionValueId(client, actor.tenantId, "account-health", input.healthStatusKey, "Account health")
        : null;
      const result = await client.query<{ id: string }>(
        `
          INSERT INTO accounts (
            tenant_id,
            owner_id,
            name,
            website,
            industry,
            account_type_option_id,
            health_status_option_id,
            metadata,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $9)
          RETURNING id
        `,
        [
          actor.tenantId,
          ownerId,
          input.name.trim(),
          getTrimmedNullableString(input.website),
          getTrimmedNullableString(input.industry),
          accountTypeOptionId,
          healthStatusOptionId,
          JSON.stringify(input.metadata ?? {}),
          actor.userId
        ]
      );

      const accountId = result.rows[0]?.id;

      if (!accountId) {
        throw new AppError(500, "Account creation failed.", undefined, "ACCOUNT_CREATE_FAILED");
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "account.create",
        resourceType: "account",
        resourceId: accountId,
        status: "success",
        metadata: {
          ownerId,
          accountTypeKey: input.accountTypeKey ?? null,
          healthStatusKey: input.healthStatusKey ?? null
        }
      });

      return {
        account: await this.loadAccountDetail(client, actor.tenantId, accountId)
      };
    });
  }

  async updateAccount(
    actor: ActorContext,
    audit: AuditMetadata,
    accountId: string,
    input: UpdateAccountRequestBody
  ): Promise<AccountResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateAccountRequestBody] !== undefined);
      this.assertAssignOnlyMutation(actor, "accounts", keys);

      const currentAccount = await this.getAccountState(client, actor.tenantId, accountId);
      const ownerId = keys.includes("ownerId")
        ? await this.ensureOwnerId(client, actor.tenantId, input.ownerId ?? null)
        : currentAccount.owner_id;
      const accountTypeOptionId = input.accountTypeKey !== undefined
        ? (input.accountTypeKey
            ? await this.resolveOptionValueId(client, actor.tenantId, "account-type", input.accountTypeKey, "Account type")
            : null)
        : currentAccount.account_type_option_id;
      const healthStatusOptionId = input.healthStatusKey !== undefined
        ? (input.healthStatusKey
            ? await this.resolveOptionValueId(client, actor.tenantId, "account-health", input.healthStatusKey, "Account health")
            : null)
        : currentAccount.health_status_option_id;
      const metadata = input.metadata ? { ...getMetadata(currentAccount.metadata), ...input.metadata } : getMetadata(currentAccount.metadata);

      await client.query(
        `
          UPDATE accounts
          SET
            owner_id = $3,
            name = $4,
            website = $5,
            industry = $6,
            account_type_option_id = $7,
            health_status_option_id = $8,
            metadata = $9::jsonb,
            updated_by = $10
          WHERE id = $1
            AND tenant_id = $2
            AND deleted_at IS NULL
        `,
        [
          accountId,
          actor.tenantId,
          ownerId,
          input.name?.trim() ?? currentAccount.name,
          input.website !== undefined ? getTrimmedNullableString(input.website) : currentAccount.website,
          input.industry !== undefined ? getTrimmedNullableString(input.industry) : currentAccount.industry,
          accountTypeOptionId,
          healthStatusOptionId,
          JSON.stringify(metadata),
          actor.userId
        ]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "account.update",
        resourceType: "account",
        resourceId: accountId,
        status: "success",
        metadata: {
          updatedFields: keys
        }
      });

      return {
        account: await this.loadAccountDetail(client, actor.tenantId, accountId)
      };
    });
  }

  async deleteAccount(
    actor: ActorContext,
    audit: AuditMetadata,
    accountId: string
  ): Promise<CrmMutationSuccessResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      await this.getAccountState(client, actor.tenantId, accountId);
      await client.query(
        `
          UPDATE accounts
          SET
            deleted_at = NOW(),
            updated_by = $3
          WHERE id = $1
            AND tenant_id = $2
            AND deleted_at IS NULL
        `,
        [accountId, actor.tenantId, actor.userId]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "account.delete",
        resourceType: "account",
        resourceId: accountId,
        status: "success"
      });

      return { success: true };
    });
  }

  async getAccountOptions(actor: ActorContext): Promise<AccountOptionsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => ({
      owners: await this.loadOwners(client, actor.tenantId),
      accountTypes: await this.loadOptionSetValues(client, actor.tenantId, "account-type"),
      healthStatuses: await this.loadOptionSetValues(client, actor.tenantId, "account-health")
    }));
  }

  async addAccountNote(
    actor: ActorContext,
    audit: AuditMetadata,
    accountId: string,
    input: CreateCrmNoteRequestBody
  ): Promise<CrmNoteResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      await this.assertEntityExists(client, actor.tenantId, "account", accountId);
      const result = await client.query<{ id: string }>(
        `
          INSERT INTO crm_notes (
            tenant_id,
            entity_type,
            entity_id,
            author_user_id,
            body,
            metadata,
            created_by,
            updated_by
          )
          VALUES ($1, 'account', $2, $3, $4, '{}'::jsonb, $3, $3)
          RETURNING id
        `,
        [actor.tenantId, accountId, actor.userId, input.body.trim()]
      );

      const noteId = result.rows[0]?.id;

      if (!noteId) {
        throw new AppError(500, "Account note creation failed.", undefined, "NOTE_CREATE_FAILED");
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "account.note.create",
        resourceType: "account",
        resourceId: accountId,
        status: "success",
        metadata: {
          noteId
        }
      });

      return {
        note: await this.loadNoteById(client, actor.tenantId, noteId)
      };
    });
  }

  async addAccountActivity(
    actor: ActorContext,
    audit: AuditMetadata,
    accountId: string,
    input: CreateCrmActivityRequestBody
  ): Promise<CrmActivityResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      await this.assertEntityExists(client, actor.tenantId, "account", accountId);
      const result = await client.query<{ id: string }>(
        `
          INSERT INTO crm_activities (
            tenant_id,
            entity_type,
            entity_id,
            activity_type,
            subject,
            description,
            occurred_at,
            author_user_id,
            metadata,
            created_by,
            updated_by
          )
          VALUES ($1, 'account', $2, $3, $4, $5, $6, $7, '{}'::jsonb, $7, $7)
          RETURNING id
        `,
        [
          actor.tenantId,
          accountId,
          input.activityType,
          input.subject.trim(),
          getTrimmedNullableString(input.description),
          input.occurredAt ? new Date(input.occurredAt) : new Date(),
          actor.userId
        ]
      );

      const activityId = result.rows[0]?.id;

      if (!activityId) {
        throw new AppError(500, "Account activity creation failed.", undefined, "ACTIVITY_CREATE_FAILED");
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "account.activity.create",
        resourceType: "account",
        resourceId: accountId,
        status: "success",
        metadata: {
          activityId,
          activityType: input.activityType
        }
      });

      return {
        activity: await this.loadActivityById(client, actor.tenantId, activityId)
      };
    });
  }

  async listContacts(actor: ActorContext, query: ContactListQuery) {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const page = getPositiveNumber(query.page, 1, 10_000);
      const pageSize = getPositiveNumber(query.pageSize, 12, 100);
      const offset = (page - 1) * pageSize;
      const conditions = ["contacts.tenant_id = $1", "contacts.deleted_at IS NULL"];
      const params: unknown[] = [actor.tenantId];

      if (query.search) {
        params.push(`%${query.search.trim()}%`);
        const searchIndex = params.length;
        conditions.push(
          `(CONCAT_WS(' ', contacts.first_name, contacts.last_name) ILIKE $${searchIndex} OR COALESCE(contacts.email, '') ILIKE $${searchIndex} OR COALESCE(contacts.phone, '') ILIKE $${searchIndex} OR COALESCE(accounts.name, '') ILIKE $${searchIndex})`
        );
      }

      if (query.accountId) {
        params.push(query.accountId);
        conditions.push(`contacts.account_id = $${params.length}`);
      }

      if (query.role) {
        params.push(query.role.trim());
        conditions.push(`role_values.value_key = $${params.length}`);
      }

      if (query.ownerId) {
        params.push(query.ownerId);
        conditions.push(`contacts.owner_id = $${params.length}`);
      }

      const whereClause = conditions.join(" AND ");
      const countResult = await client.query<{ total: number }>(
        `
          SELECT COUNT(*)::int AS total
          FROM contacts
          LEFT JOIN accounts
            ON accounts.id = contacts.account_id
           AND accounts.tenant_id = contacts.tenant_id
           AND accounts.deleted_at IS NULL
          LEFT JOIN tenant_option_values AS role_values
            ON role_values.id = contacts.role_option_id
           AND role_values.tenant_id = contacts.tenant_id
          WHERE ${whereClause}
        `,
        params
      );

      const total = countResult.rows[0]?.total ?? 0;
      const sortColumnByKey = {
        createdAt: "contacts.created_at",
        updatedAt: "contacts.updated_at",
        name: "contacts.last_name",
        email: "COALESCE(contacts.email, '')",
        account: "COALESCE(accounts.name, '')",
        role: "COALESCE(role_values.label, '')",
        owner: "COALESCE(owner_users.display_name, '')"
      } as const;
      const sortKey = (query.sortBy ?? "updatedAt") as keyof typeof sortColumnByKey;
      const sortColumn = sortColumnByKey[sortKey];
      const sortOrder = query.sortOrder === "asc" ? "ASC" : "DESC";

      params.push(pageSize, offset);

      const result = await client.query<ContactRecordRow>(
        `
          SELECT
            contacts.id,
            contacts.first_name,
            contacts.last_name,
            contacts.email,
            contacts.phone,
            contacts.linkedin_url,
            contacts.metadata,
            contacts.created_at,
            contacts.updated_at,
            COALESCE(note_counts.count, 0)::int AS note_count,
            COALESCE(activity_counts.count, 0)::int AS activity_count,
            owner_users.id AS owner_id,
            owner_users.display_name AS owner_display_name,
            owner_users.email AS owner_email,
            owner_teams.name AS owner_team_name,
            owner_departments.name AS owner_department_name,
            accounts.id AS account_id,
            accounts.name AS account_name,
            accounts.website AS account_website,
            role_values.id AS role_id,
            role_values.value_key AS role_key,
            role_values.label AS role_label,
            role_values.description AS role_description,
            role_values.color AS role_color,
            role_values.is_default AS role_is_default,
            role_values.is_active AS role_is_active
          FROM contacts
          LEFT JOIN accounts
            ON accounts.id = contacts.account_id
           AND accounts.tenant_id = contacts.tenant_id
           AND accounts.deleted_at IS NULL
          LEFT JOIN tenant_option_values AS role_values
            ON role_values.id = contacts.role_option_id
           AND role_values.tenant_id = contacts.tenant_id
          LEFT JOIN users AS owner_users
            ON owner_users.id = contacts.owner_id
           AND owner_users.tenant_id = contacts.tenant_id
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
            WHERE entity_type = 'contact'
              AND deleted_at IS NULL
            GROUP BY tenant_id, entity_id
          ) AS note_counts
            ON note_counts.tenant_id = contacts.tenant_id
           AND note_counts.entity_id = contacts.id
          LEFT JOIN (
            SELECT tenant_id, entity_id, COUNT(*) AS count
            FROM crm_activities
            WHERE entity_type = 'contact'
              AND deleted_at IS NULL
            GROUP BY tenant_id, entity_id
          ) AS activity_counts
            ON activity_counts.tenant_id = contacts.tenant_id
           AND activity_counts.entity_id = contacts.id
          WHERE ${whereClause}
          ORDER BY ${sortColumn} ${sortOrder}, contacts.created_at DESC
          LIMIT $${params.length - 1}
          OFFSET $${params.length}
        `,
        params
      );

      return {
        contacts: result.rows.map((row) => this.mapContact(row)),
        pagination: getPagination(total, page, pageSize)
      };
    });
  }

  async getContact(actor: ActorContext, contactId: string): Promise<ContactResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => ({
      contact: await this.loadContactDetail(client, actor.tenantId, contactId)
    }));
  }

  private async loadContactDetail(client: PoolClient, tenantId: string, contactId: string): Promise<ContactDetail> {
    const result = await client.query<ContactRecordRow>(
      `
        SELECT
          contacts.id,
          contacts.first_name,
          contacts.last_name,
          contacts.email,
          contacts.phone,
          contacts.linkedin_url,
          contacts.metadata,
          contacts.created_at,
          contacts.updated_at,
          COALESCE(note_counts.count, 0)::int AS note_count,
          COALESCE(activity_counts.count, 0)::int AS activity_count,
          owner_users.id AS owner_id,
          owner_users.display_name AS owner_display_name,
          owner_users.email AS owner_email,
          owner_teams.name AS owner_team_name,
          owner_departments.name AS owner_department_name,
          accounts.id AS account_id,
          accounts.name AS account_name,
          accounts.website AS account_website,
          role_values.id AS role_id,
          role_values.value_key AS role_key,
          role_values.label AS role_label,
          role_values.description AS role_description,
          role_values.color AS role_color,
          role_values.is_default AS role_is_default,
          role_values.is_active AS role_is_active
        FROM contacts
        LEFT JOIN accounts
          ON accounts.id = contacts.account_id
         AND accounts.tenant_id = contacts.tenant_id
         AND accounts.deleted_at IS NULL
        LEFT JOIN tenant_option_values AS role_values
          ON role_values.id = contacts.role_option_id
         AND role_values.tenant_id = contacts.tenant_id
        LEFT JOIN users AS owner_users
          ON owner_users.id = contacts.owner_id
         AND owner_users.tenant_id = contacts.tenant_id
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
          WHERE entity_type = 'contact'
            AND deleted_at IS NULL
          GROUP BY tenant_id, entity_id
        ) AS note_counts
          ON note_counts.tenant_id = contacts.tenant_id
         AND note_counts.entity_id = contacts.id
        LEFT JOIN (
          SELECT tenant_id, entity_id, COUNT(*) AS count
          FROM crm_activities
          WHERE entity_type = 'contact'
            AND deleted_at IS NULL
          GROUP BY tenant_id, entity_id
        ) AS activity_counts
          ON activity_counts.tenant_id = contacts.tenant_id
         AND activity_counts.entity_id = contacts.id
        WHERE contacts.tenant_id = $1
          AND contacts.id = $2
          AND contacts.deleted_at IS NULL
        LIMIT 1
      `,
      [tenantId, contactId]
    );

    const row = result.rows[0] ?? null;

    if (!row) {
      throw new AppError(404, "Contact not found.", undefined, "CONTACT_NOT_FOUND");
    }

    return {
      ...this.mapContact(row),
      notes: await this.loadEntityNotes(client, tenantId, "contact", contactId),
      activities: await this.loadEntityActivities(client, tenantId, "contact", contactId)
    };
  }

  async createContact(
    actor: ActorContext,
    audit: AuditMetadata,
    input: CreateContactRequestBody
  ): Promise<ContactResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const ownerId = await this.ensureOwnerId(client, actor.tenantId, input.ownerId ?? null);
      const accountId = await this.ensureAccountId(client, actor.tenantId, input.accountId ?? null);
      const roleOptionId = input.roleKey
        ? await this.resolveOptionValueId(client, actor.tenantId, "contact-role", input.roleKey, "Contact role")
        : null;
      const result = await client.query<{ id: string }>(
        `
          INSERT INTO contacts (
            tenant_id,
            owner_id,
            account_id,
            first_name,
            last_name,
            email,
            phone,
            linkedin_url,
            role_option_id,
            metadata,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $11)
          RETURNING id
        `,
        [
          actor.tenantId,
          ownerId,
          accountId,
          input.firstName.trim(),
          input.lastName.trim(),
          getTrimmedNullableString(input.email),
          getTrimmedNullableString(input.phone),
          getTrimmedNullableString(input.linkedinUrl),
          roleOptionId,
          JSON.stringify(input.metadata ?? {}),
          actor.userId
        ]
      );

      const contactId = result.rows[0]?.id;

      if (!contactId) {
        throw new AppError(500, "Contact creation failed.", undefined, "CONTACT_CREATE_FAILED");
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "contact.create",
        resourceType: "contact",
        resourceId: contactId,
        status: "success",
        metadata: {
          ownerId,
          accountId,
          roleKey: input.roleKey ?? null
        }
      });

      return {
        contact: await this.loadContactDetail(client, actor.tenantId, contactId)
      };
    });
  }

  async updateContact(
    actor: ActorContext,
    audit: AuditMetadata,
    contactId: string,
    input: UpdateContactRequestBody
  ): Promise<ContactResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateContactRequestBody] !== undefined);
      this.assertAssignOnlyMutation(actor, "contacts", keys);

      const currentContact = await this.getContactState(client, actor.tenantId, contactId);
      const ownerId = keys.includes("ownerId")
        ? await this.ensureOwnerId(client, actor.tenantId, input.ownerId ?? null)
        : currentContact.owner_id;
      const accountId = input.accountId !== undefined
        ? await this.ensureAccountId(client, actor.tenantId, input.accountId ?? null)
        : currentContact.account_id;
      const roleOptionId = input.roleKey !== undefined
        ? (input.roleKey
            ? await this.resolveOptionValueId(client, actor.tenantId, "contact-role", input.roleKey, "Contact role")
            : null)
        : currentContact.role_option_id;
      const metadata = input.metadata ? { ...getMetadata(currentContact.metadata), ...input.metadata } : getMetadata(currentContact.metadata);

      await client.query(
        `
          UPDATE contacts
          SET
            owner_id = $3,
            account_id = $4,
            first_name = $5,
            last_name = $6,
            email = $7,
            phone = $8,
            linkedin_url = $9,
            role_option_id = $10,
            metadata = $11::jsonb,
            updated_by = $12
          WHERE id = $1
            AND tenant_id = $2
            AND deleted_at IS NULL
        `,
        [
          contactId,
          actor.tenantId,
          ownerId,
          accountId,
          input.firstName?.trim() ?? currentContact.first_name,
          input.lastName?.trim() ?? currentContact.last_name,
          input.email !== undefined ? getTrimmedNullableString(input.email) : currentContact.email,
          input.phone !== undefined ? getTrimmedNullableString(input.phone) : currentContact.phone,
          input.linkedinUrl !== undefined ? getTrimmedNullableString(input.linkedinUrl) : currentContact.linkedin_url,
          roleOptionId,
          JSON.stringify(metadata),
          actor.userId
        ]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "contact.update",
        resourceType: "contact",
        resourceId: contactId,
        status: "success",
        metadata: {
          updatedFields: keys
        }
      });

      return {
        contact: await this.loadContactDetail(client, actor.tenantId, contactId)
      };
    });
  }

  async deleteContact(
    actor: ActorContext,
    audit: AuditMetadata,
    contactId: string
  ): Promise<CrmMutationSuccessResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      await this.getContactState(client, actor.tenantId, contactId);
      await client.query(
        `
          UPDATE contacts
          SET
            deleted_at = NOW(),
            updated_by = $3
          WHERE id = $1
            AND tenant_id = $2
            AND deleted_at IS NULL
        `,
        [contactId, actor.tenantId, actor.userId]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "contact.delete",
        resourceType: "contact",
        resourceId: contactId,
        status: "success"
      });

      return { success: true };
    });
  }

  async getContactOptions(actor: ActorContext): Promise<ContactOptionsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => ({
      owners: await this.loadOwners(client, actor.tenantId),
      roles: await this.loadOptionSetValues(client, actor.tenantId, "contact-role"),
      accounts: await this.loadAccountsLookup(client, actor.tenantId)
    }));
  }

  async addContactNote(
    actor: ActorContext,
    audit: AuditMetadata,
    contactId: string,
    input: CreateCrmNoteRequestBody
  ): Promise<CrmNoteResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      await this.assertEntityExists(client, actor.tenantId, "contact", contactId);
      const result = await client.query<{ id: string }>(
        `
          INSERT INTO crm_notes (
            tenant_id,
            entity_type,
            entity_id,
            author_user_id,
            body,
            metadata,
            created_by,
            updated_by
          )
          VALUES ($1, 'contact', $2, $3, $4, '{}'::jsonb, $3, $3)
          RETURNING id
        `,
        [actor.tenantId, contactId, actor.userId, input.body.trim()]
      );

      const noteId = result.rows[0]?.id;

      if (!noteId) {
        throw new AppError(500, "Contact note creation failed.", undefined, "NOTE_CREATE_FAILED");
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "contact.note.create",
        resourceType: "contact",
        resourceId: contactId,
        status: "success",
        metadata: {
          noteId
        }
      });

      return {
        note: await this.loadNoteById(client, actor.tenantId, noteId)
      };
    });
  }

  async addContactActivity(
    actor: ActorContext,
    audit: AuditMetadata,
    contactId: string,
    input: CreateCrmActivityRequestBody
  ): Promise<CrmActivityResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      await this.assertEntityExists(client, actor.tenantId, "contact", contactId);
      const result = await client.query<{ id: string }>(
        `
          INSERT INTO crm_activities (
            tenant_id,
            entity_type,
            entity_id,
            activity_type,
            subject,
            description,
            occurred_at,
            author_user_id,
            metadata,
            created_by,
            updated_by
          )
          VALUES ($1, 'contact', $2, $3, $4, $5, $6, $7, '{}'::jsonb, $7, $7)
          RETURNING id
        `,
        [
          actor.tenantId,
          contactId,
          input.activityType,
          input.subject.trim(),
          getTrimmedNullableString(input.description),
          input.occurredAt ? new Date(input.occurredAt) : new Date(),
          actor.userId
        ]
      );

      const activityId = result.rows[0]?.id;

      if (!activityId) {
        throw new AppError(500, "Contact activity creation failed.", undefined, "ACTIVITY_CREATE_FAILED");
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "contact.activity.create",
        resourceType: "contact",
        resourceId: contactId,
        status: "success",
        metadata: {
          activityId,
          activityType: input.activityType
        }
      });

      return {
        activity: await this.loadActivityById(client, actor.tenantId, activityId)
      };
    });
  }
}
