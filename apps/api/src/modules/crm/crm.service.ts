import {
  buildLeadRuntimeRecord,
  crmFieldDataTypes,
  defaultCoreCrmObjectDefinitions,
  evaluateLeadConversionReadiness,
  evaluateLeadRuntime,
  mapLeadSourceToOpportunitySource,
  normalizeCustomFieldSettings
} from "@crm/types";
import type {
  AssignmentRulePayload,
  AccountDetail,
  AccountListQuery,
  AccountLookupSummary,
  AccountOptionsResponse,
  AccountResponse,
  AccountSummary,
  ContactDetail,
  ContactListQuery,
  ContactOptionsResponse,
  ContactRelationshipSummary,
  ContactResponse,
  ContactSummary,
  ConvertLeadRequestBody,
  CreateAccountRequestBody,
  CreateContactRequestBody,
  CreateCrmActivityRequestBody,
  CreateCrmNoteRequestBody,
  CreateCrmTaskRequestBody,
  CreateLeadRequestBody,
  CrmActivitiesResponse,
  CrmActivityResponse,
  CrmActivitySummary,
  CrmEntityType,
  CrmFieldDataType,
  CrmFieldDefinition,
  CrmLookupUserSummary,
  CrmMutationSuccessResponse,
  CrmNotesResponse,
  CrmNoteResponse,
  CrmNoteSummary,
  CrmOptionValueSummary,
  CrmPagination,
  CrmTaskResponse,
  CrmTaskStatus,
  CrmTaskSummary,
  CrmTimelineFilterKind,
  CrmTimelineItem,
  CrmTimelineResponse,
  CrmTasksResponse,
  LeadDetail,
  LeadDuplicateMatchReason,
  LeadDuplicateMatchSummary,
  LeadListQuery,
  LeadConversionResponse,
  LeadOptionsResponse,
  LeadResponse,
  LeadRuntimeConfiguration,
  LeadRuntimeResponse,
  LeadSummary,
  MqlRulePayload,
  OpportunityLookupSummary,
  RoleSummary,
  ScoringModelPayload,
  SlaPolicyPayload,
  UpdateAccountRequestBody,
  UpdateContactRequestBody,
  UpdateCrmNoteRequestBody,
  UpdateCrmTaskRequestBody,
  UpdateLeadRequestBody
} from "@crm/types";
import type { PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import { getPositiveNumber } from "../../common/pagination.js";
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

interface NoteRow {
  id: string;
  body: string;
  entity_type: CrmEntityType;
  entity_id: string;
  is_customer_facing: boolean;
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
  entity_type: CrmEntityType;
  entity_id: string;
  activity_type: string;
  subject: string;
  description: string | null;
  outcome: string | null;
  occurred_at: Date;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  author_id: string | null;
  author_display_name: string | null;
  author_email: string | null;
  author_team_name: string | null;
  author_department_name: string | null;
  owner_id: string | null;
  owner_display_name: string | null;
  owner_email: string | null;
  owner_team_name: string | null;
  owner_department_name: string | null;
}

interface TaskRow {
  id: string;
  entity_type: CrmEntityType;
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
}

interface NoteStateRow {
  id: string;
  entity_type: CrmEntityType;
  entity_id: string;
  body: string;
  is_customer_facing: boolean;
  metadata: Record<string, unknown> | null;
}

interface TaskStateRow {
  id: string;
  entity_type: CrmEntityType;
  entity_id: string;
  title: string;
  description: string | null;
  due_at: Date | null;
  reminder_at: Date | null;
  priority: string;
  status: string;
  owner_user_id: string | null;
  assignee_user_id: string | null;
  metadata: Record<string, unknown> | null;
}

interface TimelineEventRow {
  id: string;
  entity_type: CrmEntityType;
  entity_id: string;
  touchpoint_type: string;
  title: string;
  description: string | null;
  occurred_at: Date;
  metadata: Record<string, unknown> | null;
  owner_id: string | null;
  owner_display_name: string | null;
  owner_email: string | null;
  owner_team_name: string | null;
  owner_department_name: string | null;
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
  status_key: string | null;
  source_key: string | null;
  owner_id: string | null;
  custom_fields: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

interface LeadDuplicateAccountRow {
  id: string;
  name: string;
  website: string | null;
}

interface LeadDuplicateContactRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  account_id: string | null;
  account_name: string | null;
  role_id: string | null;
  role_key: string | null;
  role_label: string | null;
  role_description: string | null;
  role_color: string | null;
  role_is_default: boolean | null;
  role_is_active: boolean | null;
}

interface AccountStateRow {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  account_type_option_id: string | null;
  health_status_option_id: string | null;
  owner_id: string | null;
  custom_fields: Record<string, unknown> | null;
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
  custom_fields: Record<string, unknown> | null;
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

interface LeadRuntimeDefinitionRow {
  definition_type: string;
  definition_key: string;
  name: string;
  definition: Record<string, unknown>;
}

interface ObjectDefinitionRow {
  definition: Record<string, unknown>;
}

interface CustomFieldDefinitionRow {
  field_key: string;
  label: string;
  description: string | null;
  data_type: string;
  placeholder: string | null;
  option_set_key: string | null;
  is_required: boolean;
  is_active: boolean;
  is_system_field: boolean;
  sort_order: number;
  settings: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

interface ConfiguredObjectFieldInput {
  key: string;
  label: string;
  type: CrmFieldDataType;
  required?: boolean;
  optionSetKey?: string | null;
  targetObject?: string | null;
  searchable?: boolean;
  filterable?: boolean;
  reportable?: boolean;
  aiUsable?: boolean;
  sensitive?: boolean;
  masking?: "none" | "partial" | "full" | "email";
}

interface AccountRecordRow {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  custom_fields: Record<string, unknown> | null;
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

function normalizeEmailDomain(email: string | null | undefined) {
  const normalizedEmail = getTrimmedNullableString(email)?.toLowerCase();

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return null;
  }

  return normalizedEmail.split("@").pop() ?? null;
}

function normalizeWebsiteDomain(website: string | null | undefined) {
  const normalizedWebsite = getTrimmedNullableString(website);

  if (!normalizedWebsite) {
    return null;
  }

  try {
    const parsed = new URL(normalizedWebsite.includes("://") ? normalizedWebsite : `https://${normalizedWebsite}`);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return normalizedWebsite.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]?.toLowerCase() ?? null;
  }
}

function getSalesWorkspaceRoot(metadata: Record<string, unknown> | null | undefined) {
  const root = getMetadata(metadata).salesWorkspace;
  return root && typeof root === "object" && !Array.isArray(root) ? (root as Record<string, unknown>) : {};
}

function getBantChecklist(input: unknown) {
  const source =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Partial<Record<"budget" | "authority" | "need" | "timeline", unknown>>)
      : {};

  return {
    budget: Boolean(source.budget),
    authority: Boolean(source.authority),
    need: Boolean(source.need),
    timeline: Boolean(source.timeline)
  };
}

function getLeadConversionRoot(metadata: Record<string, unknown> | null | undefined) {
  const root = getMetadata(metadata).conversion;
  return root && typeof root === "object" && !Array.isArray(root) ? (root as Record<string, unknown>) : {};
}

function getLeadConversionSummary(metadata: Record<string, unknown> | null | undefined): LeadDetail["conversion"] {
  const root = getLeadConversionRoot(metadata);
  return Object.keys(root).length > 0 ? (root as unknown as LeadDetail["conversion"]) : null;
}

function firstArray(...values: unknown[]) {
  for (const value of values) {
    if (Array.isArray(value)) {
      return value;
    }
  }

  return null;
}

const defaultObjectDefinitionByKey = new Map(
  defaultCoreCrmObjectDefinitions.map((definition) => [definition.definitionKey, definition.definition] as const)
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCrmFieldDataType(value: unknown): value is CrmFieldDataType {
  return typeof value === "string" && (crmFieldDataTypes as readonly string[]).includes(value);
}

function isConfiguredObjectFieldInput(value: unknown): value is ConfiguredObjectFieldInput {
  return isRecord(value) && typeof value.key === "string" && typeof value.label === "string" && isCrmFieldDataType(value.type);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function isValidDateTime(value: string) {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && value.includes("T");
}

function mapConfiguredObjectField(field: ConfiguredObjectFieldInput, sortOrder: number): CrmFieldDefinition {
  return {
    fieldKey: field.key,
    label: field.label,
    description: null,
    dataType: field.type,
    placeholder: null,
    optionSetKey: field.optionSetKey ?? null,
    targetObject: field.targetObject ?? null,
    isRequired: Boolean(field.required),
    isActive: true,
    isSystemField: true,
    sortOrder,
    settings: {
      ...normalizeCustomFieldSettings({
        isSearchable: Boolean(field.searchable),
        isFilterable: Boolean(field.filterable),
        isReportable: field.reportable ?? true,
        isAiUsable: Boolean(field.aiUsable),
        isSensitive: Boolean(field.sensitive),
        maskingRule: field.masking ?? "none"
      })
    },
    metadata: {}
  };
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

const crmEntityConfig = {
  lead: {
    actionPrefix: "lead",
    label: "Lead",
    tableName: "leads"
  },
  account: {
    actionPrefix: "account",
    label: "Account",
    tableName: "accounts"
  },
  contact: {
    actionPrefix: "contact",
    label: "Contact",
    tableName: "contacts"
  },
  campaign: {
    actionPrefix: "campaign",
    label: "Campaign",
    tableName: "campaigns"
  },
  opportunity: {
    actionPrefix: "opportunity",
    label: "Opportunity",
    tableName: "opportunities"
  },
  ticket: {
    actionPrefix: "ticket",
    label: "Ticket",
    tableName: null
  },
  customer_success_account: {
    actionPrefix: "customer_success_account",
    label: "Customer success account",
    tableName: null
  }
} as const satisfies Record<
  CrmEntityType,
  {
    actionPrefix: string;
    label: string;
    tableName: string | null;
  }
>;

function getEntityConfig(entityType: CrmEntityType) {
  return crmEntityConfig[entityType];
}

function toRecordLink(entityType: CrmEntityType, entityId: string) {
  return {
    entityType,
    entityId
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

  private getDefaultFieldDefinitions(objectKey: string): CrmFieldDefinition[] {
    const defaultObjectDefinition = defaultObjectDefinitionByKey.get(objectKey) ?? null;
    const keyFields = Array.isArray(defaultObjectDefinition?.keyFields) ? defaultObjectDefinition.keyFields : [];
    return keyFields.filter(isConfiguredObjectFieldInput).map((field, index) => mapConfiguredObjectField(field, index));
  }

  private async loadSystemFieldDefinitions(client: PoolClient, tenantId: string, objectKey: string): Promise<CrmFieldDefinition[]> {
    const result = await client.query<ObjectDefinitionRow>(
      `
        SELECT definition
        FROM configuration_definitions
        WHERE tenant_id = $1
          AND deleted_at IS NULL
          AND is_active = true
          AND definition_type = 'object'
          AND (definition_key = $2 OR definition->>'objectCode' = $2)
        ORDER BY updated_at DESC
        LIMIT 1
      `,
      [tenantId, objectKey]
    );

    const definition = result.rows[0]?.definition;
    const keyFields = Array.isArray(definition?.keyFields) ? definition.keyFields : [];
    const mappedFields = keyFields.filter(isConfiguredObjectFieldInput).map((field, index) => mapConfiguredObjectField(field, index));
    return mappedFields.length > 0 ? mappedFields : this.getDefaultFieldDefinitions(objectKey);
  }

  private async loadCustomFieldDefinitions(client: PoolClient, tenantId: string, entityKey: string): Promise<CrmFieldDefinition[]> {
    const result = await client.query<CustomFieldDefinitionRow>(
      `
        SELECT
          custom_field_definitions.field_key,
          custom_field_definitions.label,
          custom_field_definitions.description,
          custom_field_definitions.data_type,
          custom_field_definitions.placeholder,
          tenant_option_sets.set_key AS option_set_key,
          custom_field_definitions.is_required,
          custom_field_definitions.is_active,
          custom_field_definitions.is_system_field,
          custom_field_definitions.sort_order,
          custom_field_definitions.settings,
          custom_field_definitions.metadata
        FROM custom_field_definitions
        LEFT JOIN tenant_option_sets
          ON tenant_option_sets.id = custom_field_definitions.option_set_id
         AND tenant_option_sets.deleted_at IS NULL
        WHERE custom_field_definitions.tenant_id = $1
          AND custom_field_definitions.entity_key = $2
          AND custom_field_definitions.deleted_at IS NULL
          AND custom_field_definitions.is_active = true
        ORDER BY custom_field_definitions.sort_order ASC, custom_field_definitions.label ASC
      `,
      [tenantId, entityKey]
    );

    return result.rows
      .filter((row) => isCrmFieldDataType(row.data_type))
      .map((row) => ({
        fieldKey: row.field_key,
        label: row.label,
        description: row.description,
        dataType: row.data_type as CrmFieldDataType,
        placeholder: row.placeholder,
        optionSetKey: row.option_set_key,
        targetObject: null,
        isRequired: row.is_required,
        isActive: row.is_active,
        isSystemField: row.is_system_field,
        sortOrder: row.sort_order,
        settings: row.settings ?? {},
        metadata: row.metadata ?? {}
      }));
  }

  async loadFieldDefinitions(client: PoolClient, tenantId: string, objectKey: string): Promise<CrmFieldDefinition[]> {
    const [systemFields, customFields] = await Promise.all([
      this.loadSystemFieldDefinitions(client, tenantId, objectKey),
      this.loadCustomFieldDefinitions(client, tenantId, objectKey)
    ]);

    return [...systemFields, ...customFields].sort((left, right) => {
      if (left.isSystemField !== right.isSystemField) {
        return left.isSystemField ? -1 : 1;
      }
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }
      return left.label.localeCompare(right.label);
    });
  }

  async loadCustomFieldOptions(
    client: PoolClient,
    tenantId: string,
    fieldDefinitions: CrmFieldDefinition[]
  ): Promise<Record<string, CrmOptionValueSummary[]>> {
    const optionSetKeys = [...new Set(
      fieldDefinitions
        .filter(
          (field) =>
            !field.isSystemField &&
            (field.dataType === "select" || field.dataType === "multiselect") &&
            typeof field.optionSetKey === "string" &&
            field.optionSetKey.length > 0
        )
        .map((field) => field.optionSetKey as string)
    )];

    if (optionSetKeys.length === 0) {
      return {};
    }

    const entries = await Promise.all(
      optionSetKeys.map(async (setKey) => [setKey, await this.loadOptionSetValues(client, tenantId, setKey)] as const)
    );

    return Object.fromEntries(entries);
  }

  private async loadAllowedOptionKeys(
    client: PoolClient,
    tenantId: string,
    setKey: string,
    cache: Map<string, Set<string>>
  ): Promise<Set<string>> {
    const cached = cache.get(setKey);
    if (cached) {
      return cached;
    }

    const keys = new Set((await this.loadOptionSetValues(client, tenantId, setKey)).filter((value) => value.isActive).map((value) => value.key));
    cache.set(setKey, keys);
    return keys;
  }

  private async sanitizeCustomFieldValue(
    client: PoolClient,
    tenantId: string,
    field: CrmFieldDefinition,
    rawValue: unknown,
    optionSetCache: Map<string, Set<string>>
  ): Promise<{ action: "set"; value: unknown } | { action: "clear" }> {
    if (rawValue === null || rawValue === undefined) {
      return { action: "clear" };
    }

    switch (field.dataType) {
      case "text":
      case "textarea":
      case "phone": {
        if (typeof rawValue !== "string") {
          throw new AppError(400, `${field.label} must be a string.`, undefined, "VALIDATION_ERROR");
        }
        const value = getTrimmedNullableString(rawValue);
        return value === null ? { action: "clear" } : { action: "set", value };
      }
      case "email": {
        if (typeof rawValue !== "string") {
          throw new AppError(400, `${field.label} must be a valid email address.`, undefined, "VALIDATION_ERROR");
        }
        const value = getTrimmedNullableString(rawValue);
        if (value === null) {
          return { action: "clear" };
        }
        if (!isValidEmail(value)) {
          throw new AppError(400, `${field.label} must be a valid email address.`, undefined, "VALIDATION_ERROR");
        }
        return { action: "set", value };
      }
      case "url": {
        if (typeof rawValue !== "string") {
          throw new AppError(400, `${field.label} must be a valid URL.`, undefined, "VALIDATION_ERROR");
        }
        const value = getTrimmedNullableString(rawValue);
        if (value === null) {
          return { action: "clear" };
        }
        try {
          new URL(value);
        } catch {
          throw new AppError(400, `${field.label} must be a valid URL.`, undefined, "VALIDATION_ERROR");
        }
        return { action: "set", value };
      }
      case "date": {
        if (typeof rawValue !== "string") {
          throw new AppError(400, `${field.label} must be a valid date.`, undefined, "VALIDATION_ERROR");
        }
        const value = getTrimmedNullableString(rawValue);
        if (value === null) {
          return { action: "clear" };
        }
        if (!isValidDate(value)) {
          throw new AppError(400, `${field.label} must be a valid date.`, undefined, "VALIDATION_ERROR");
        }
        return { action: "set", value };
      }
      case "datetime": {
        if (typeof rawValue !== "string") {
          throw new AppError(400, `${field.label} must be a valid datetime.`, undefined, "VALIDATION_ERROR");
        }
        const value = getTrimmedNullableString(rawValue);
        if (value === null) {
          return { action: "clear" };
        }
        if (!isValidDateTime(value)) {
          throw new AppError(400, `${field.label} must be a valid datetime.`, undefined, "VALIDATION_ERROR");
        }
        return { action: "set", value };
      }
      case "number": {
        const value =
          typeof rawValue === "number"
            ? rawValue
            : typeof rawValue === "string" && rawValue.trim().length > 0
              ? Number(rawValue)
              : null;
        if (value === null) {
          return { action: "clear" };
        }
        if (!Number.isFinite(value)) {
          throw new AppError(400, `${field.label} must be a valid number.`, undefined, "VALIDATION_ERROR");
        }
        return { action: "set", value };
      }
      case "boolean": {
        if (typeof rawValue !== "boolean") {
          throw new AppError(400, `${field.label} must be true or false.`, undefined, "VALIDATION_ERROR");
        }
        return { action: "set", value: rawValue };
      }
      case "select": {
        if (typeof rawValue !== "string") {
          throw new AppError(400, `${field.label} must be a valid option key.`, undefined, "VALIDATION_ERROR");
        }
        const value = getTrimmedNullableString(rawValue);
        if (value === null) {
          return { action: "clear" };
        }
        if (!field.optionSetKey) {
          throw new AppError(500, `${field.label} is misconfigured.`, undefined, "INVALID_CONFIG");
        }
        const allowedKeys = await this.loadAllowedOptionKeys(client, tenantId, field.optionSetKey, optionSetCache);
        if (!allowedKeys.has(value)) {
          throw new AppError(400, `${field.label} must reference an active option.`, undefined, "VALIDATION_ERROR");
        }
        return { action: "set", value };
      }
      case "multiselect": {
        if (!Array.isArray(rawValue)) {
          throw new AppError(400, `${field.label} must be an array of option keys.`, undefined, "VALIDATION_ERROR");
        }
        if (!field.optionSetKey) {
          throw new AppError(500, `${field.label} is misconfigured.`, undefined, "INVALID_CONFIG");
        }
        const values = [...new Set(rawValue.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean))];
        if (values.length === 0) {
          return { action: "clear" };
        }
        const allowedKeys = await this.loadAllowedOptionKeys(client, tenantId, field.optionSetKey, optionSetCache);
        if (values.some((value) => !allowedKeys.has(value))) {
          throw new AppError(400, `${field.label} must reference active options only.`, undefined, "VALIDATION_ERROR");
        }
        return { action: "set", value: values };
      }
      default:
        throw new AppError(400, `${field.label} uses an unsupported custom-field type.`, undefined, "VALIDATION_ERROR");
    }
  }

  async sanitizeCustomFields(
    client: PoolClient,
    tenantId: string,
    entityKey: string,
    input: Record<string, unknown> | undefined,
    currentCustomFields: Record<string, unknown> = {}
  ): Promise<Record<string, unknown>> {
    if (!input) {
      return currentCustomFields;
    }

    const fieldDefinitions = await this.loadCustomFieldDefinitions(client, tenantId, entityKey);
    const fieldByKey = new Map(fieldDefinitions.map((field) => [field.fieldKey, field]));
    const optionSetCache = new Map<string, Set<string>>();
    const nextCustomFields = { ...currentCustomFields };

    for (const [fieldKey, rawValue] of Object.entries(input)) {
      const fieldDefinition = fieldByKey.get(fieldKey);
      if (!fieldDefinition) {
        continue;
      }

      const result = await this.sanitizeCustomFieldValue(client, tenantId, fieldDefinition, rawValue, optionSetCache);
      if (result.action === "clear") {
        delete nextCustomFields[fieldKey];
      } else {
        nextCustomFields[fieldKey] = result.value;
      }
    }

    return nextCustomFields;
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

  private async ensureContactId(client: PoolClient, tenantId: string, contactId: string | null | undefined, accountId: string | null) {
    if (!contactId) {
      return null;
    }

    const result = await client.query<{ id: string; account_id: string | null }>(
      `
        SELECT id, account_id
        FROM contacts
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [contactId, tenantId]
    );

    const row = result.rows[0] ?? null;

    if (!row?.id) {
      throw new AppError(400, "The selected contact is invalid for this tenant.", undefined, "INVALID_CONTACT");
    }

    if (accountId && row.account_id && row.account_id !== accountId) {
      throw new AppError(
        400,
        "The selected contact does not belong to the chosen account.",
        undefined,
        "INVALID_CONTACT_ACCOUNT_RELATION"
      );
    }

    return row.id;
  }

  private async loadAccountLookupById(client: PoolClient, tenantId: string, accountId: string): Promise<AccountLookupSummary> {
    const result = await client.query<AccountLookupRow>(
      `
        SELECT id, name, website
        FROM accounts
        WHERE tenant_id = $1
          AND id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [tenantId, accountId]
    );

    const row = result.rows[0] ?? null;

    if (!row) {
      throw new AppError(404, "Account not found.", undefined, "ACCOUNT_NOT_FOUND");
    }

    return {
      id: row.id,
      name: row.name,
      website: row.website
    };
  }

  private async loadContactRelationshipById(client: PoolClient, tenantId: string, contactId: string): Promise<ContactRelationshipSummary> {
    const result = await client.query<LeadDuplicateContactRow>(
      `
        SELECT
          contacts.id,
          contacts.first_name,
          contacts.last_name,
          contacts.email,
          contacts.phone,
          contacts.account_id,
          accounts.name AS account_name,
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

  private async loadOpportunityLookupById(client: PoolClient, tenantId: string, opportunityId: string): Promise<OpportunityLookupSummary> {
    const result = await client.query<{
      id: string;
      name: string;
      stage_id: string | null;
      stage_key: string | null;
      stage_label: string | null;
      stage_description: string | null;
      stage_color: string | null;
      stage_is_default: boolean | null;
      stage_is_active: boolean | null;
    }>(
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
          AND opportunities.id = $2
          AND opportunities.deleted_at IS NULL
        LIMIT 1
      `,
      [tenantId, opportunityId]
    );

    const row = result.rows[0] ?? null;

    if (!row) {
      throw new AppError(404, "Opportunity not found.", undefined, "OPPORTUNITY_NOT_FOUND");
    }

    return {
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
    };
  }

  private buildLeadDuplicateAccountMatch(
    row: LeadDuplicateAccountRow,
    companyName: string,
    emailDomain: string | null
  ): LeadDuplicateMatchSummary | null {
    const reasons: LeadDuplicateMatchReason[] = [];

    if (row.name.trim().toLowerCase() === companyName.trim().toLowerCase()) {
      reasons.push("company_name");
    }

    const websiteDomain = normalizeWebsiteDomain(row.website);
    if (emailDomain && websiteDomain && websiteDomain === emailDomain) {
      reasons.push("email_domain");
    }

    if (reasons.length === 0) {
      return null;
    }

    return {
      id: row.id,
      label: row.name,
      secondaryLabel: row.website,
      reasons
    };
  }

  private buildLeadDuplicateContactMatch(
    row: LeadDuplicateContactRow,
    lead: { firstName: string; lastName: string; email: string | null; phone: string | null }
  ): LeadDuplicateMatchSummary | null {
    const reasons: LeadDuplicateMatchReason[] = [];
    const fullName = `${row.first_name} ${row.last_name}`.trim();

    if (lead.email && row.email && lead.email.trim().toLowerCase() === row.email.trim().toLowerCase()) {
      reasons.push("email");
    }
    if (lead.phone && row.phone && lead.phone.trim() === row.phone.trim()) {
      reasons.push("phone");
    }
    if (
      fullName.length > 0 &&
      fullName.toLowerCase() === `${lead.firstName} ${lead.lastName}`.trim().toLowerCase()
    ) {
      reasons.push("full_name");
    }

    if (reasons.length === 0) {
      return null;
    }

    return {
      id: row.id,
      label: fullName,
      secondaryLabel: row.account_name ?? row.email ?? row.phone,
      reasons
    };
  }

  private async loadLeadDuplicateAccounts(
    client: PoolClient,
    tenantId: string,
    lead: { companyName: string; email: string | null }
  ): Promise<LeadDuplicateMatchSummary[]> {
    const emailDomain = normalizeEmailDomain(lead.email);
    const result = await client.query<LeadDuplicateAccountRow>(
      `
        SELECT id, name, website
        FROM accounts
        WHERE tenant_id = $1
          AND deleted_at IS NULL
          AND (
            lower(name) = lower($2)
            OR ($3::text IS NOT NULL AND lower(COALESCE(website, '')) LIKE '%' || lower($3::text) || '%')
          )
        ORDER BY name ASC
      `,
      [tenantId, lead.companyName.trim(), emailDomain]
    );

    return result.rows
      .map((row) => this.buildLeadDuplicateAccountMatch(row, lead.companyName, emailDomain))
      .filter((match): match is LeadDuplicateMatchSummary => match !== null);
  }

  private async loadLeadDuplicateContacts(
    client: PoolClient,
    tenantId: string,
    lead: { firstName: string; lastName: string; email: string | null; phone: string | null }
  ): Promise<LeadDuplicateMatchSummary[]> {
    const result = await client.query<LeadDuplicateContactRow>(
      `
        SELECT
          contacts.id,
          contacts.first_name,
          contacts.last_name,
          contacts.email,
          contacts.phone,
          contacts.account_id,
          accounts.name AS account_name,
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
        WHERE contacts.tenant_id = $1
          AND contacts.deleted_at IS NULL
          AND (
            ($2::text IS NOT NULL AND lower(COALESCE(contacts.email, '')) = lower($2::text))
            OR ($3::text IS NOT NULL AND COALESCE(contacts.phone, '') = $3::text)
            OR (lower(contacts.first_name) = lower($4) AND lower(contacts.last_name) = lower($5))
          )
        ORDER BY contacts.updated_at DESC
      `,
      [tenantId, getTrimmedNullableString(lead.email), getTrimmedNullableString(lead.phone), lead.firstName.trim(), lead.lastName.trim()]
    );

    return result.rows
      .map((row) => this.buildLeadDuplicateContactMatch(row, lead))
      .filter((match): match is LeadDuplicateMatchSummary => match !== null);
  }

  private assertLeadConversionPermissions(actor: ActorContext, needsAccountCreate: boolean, needsContactCreate: boolean) {
    const canCreateOpportunity =
      actor.permissionCodes.includes("opportunities.create") || actor.permissionCodes.includes("opportunities.configure");
    if (!canCreateOpportunity) {
      throw new AppError(403, "You do not have permission to create opportunities.", undefined, "AUTHORIZATION_ERROR");
    }

    if (needsAccountCreate) {
      const canCreateAccount =
        actor.permissionCodes.includes("accounts.create") || actor.permissionCodes.includes("accounts.configure");
      if (!canCreateAccount) {
        throw new AppError(403, "You do not have permission to create accounts during lead conversion.", undefined, "AUTHORIZATION_ERROR");
      }
    }

    if (needsContactCreate) {
      const canCreateContact =
        actor.permissionCodes.includes("contacts.create") || actor.permissionCodes.includes("contacts.configure");
      if (!canCreateContact) {
        throw new AppError(403, "You do not have permission to create contacts during lead conversion.", undefined, "AUTHORIZATION_ERROR");
      }
    }
  }

  private async getLeadState(client: PoolClient, tenantId: string, leadId: string) {
    const result = await client.query<LeadStateRow>(
      `
        SELECT
          leads.id,
          leads.first_name,
          leads.last_name,
          leads.company_name,
          leads.email,
          leads.phone,
          leads.status_option_id,
          leads.source_option_id,
          leads.score,
          status_values.value_key AS status_key,
          source_values.value_key AS source_key,
          leads.owner_id,
          leads.custom_fields,
          leads.metadata
        FROM leads
        INNER JOIN tenant_option_values AS status_values
          ON status_values.id = leads.status_option_id
         AND status_values.tenant_id = leads.tenant_id
        INNER JOIN tenant_option_values AS source_values
          ON source_values.id = leads.source_option_id
         AND source_values.tenant_id = leads.tenant_id
        WHERE leads.id = $1
          AND leads.tenant_id = $2
          AND leads.deleted_at IS NULL
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
          custom_fields,
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

  private getPermissionPrefixForEntity(entityType: CrmEntityType) {
    switch (entityType) {
      case "lead":
        return "leads";
      case "account":
        return "accounts";
      case "contact":
        return "contacts";
      case "campaign":
        return "campaigns";
      case "opportunity":
        return "opportunities";
      case "ticket":
        return "support";
      case "customer_success_account":
        return "customer_success";
    }
  }

  private assertTaskAssignOnlyMutation(actor: ActorContext, entityType: CrmEntityType, keys: string[]) {
    if (keys.length === 0) {
      throw new AppError(400, "At least one field must be updated.", undefined, "VALIDATION_ERROR");
    }

    const permissionPrefix = this.getPermissionPrefixForEntity(entityType);
    const canEdit = actor.permissionCodes.includes(`${permissionPrefix}.edit`);
    const canConfigure = actor.permissionCodes.includes(`${permissionPrefix}.configure`);
    const canAssign = actor.permissionCodes.includes(`${permissionPrefix}.assign`);
    const assignOnlyKeys = new Set(["ownerId", "assigneeId", "status"]);
    const isAssignOnlyMutation = keys.every((key) => assignOnlyKeys.has(key));

    if (!canEdit && !canConfigure && !(canAssign && isAssignOnlyMutation)) {
      throw new AppError(
        403,
        "You do not have permission to update these task fields.",
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
    const entityConfig = getEntityConfig(entityType);

    if (!entityConfig.tableName) {
      return;
    }

    const result = await client.query<{ id: string }>(
      `SELECT id FROM ${entityConfig.tableName} WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [entityId, tenantId]
    );

    if (!result.rows[0]?.id) {
      throw new AppError(
        404,
        `${entityConfig.label} not found.`,
        undefined,
        `${entityType.toUpperCase()}_NOT_FOUND`
      );
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
          crm_notes.entity_type,
          crm_notes.entity_id,
          crm_notes.body,
          crm_notes.is_customer_facing,
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

    return result.rows.map((row) => this.mapNote(row));
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
          crm_activities.entity_type,
          crm_activities.entity_id,
          crm_activities.activity_type,
          crm_activities.subject,
          crm_activities.description,
          crm_activities.outcome,
          crm_activities.occurred_at,
          crm_activities.metadata,
          crm_activities.created_at,
          crm_activities.updated_at,
          users.id AS author_id,
          users.display_name AS author_display_name,
          users.email AS author_email,
          teams.name AS author_team_name,
          departments.name AS author_department_name,
          owner_users.id AS owner_id,
          owner_users.display_name AS owner_display_name,
          owner_users.email AS owner_email,
          owner_teams.name AS owner_team_name,
          owner_departments.name AS owner_department_name
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
        LEFT JOIN users AS owner_users
          ON owner_users.id = crm_activities.owner_user_id
         AND owner_users.tenant_id = crm_activities.tenant_id
         AND owner_users.deleted_at IS NULL
        LEFT JOIN teams AS owner_teams
          ON owner_teams.id = owner_users.team_id
         AND owner_teams.tenant_id = owner_users.tenant_id
         AND owner_teams.deleted_at IS NULL
        LEFT JOIN departments AS owner_departments
          ON owner_departments.id = owner_users.department_id
         AND owner_departments.tenant_id = owner_users.tenant_id
         AND owner_departments.deleted_at IS NULL
        WHERE crm_activities.tenant_id = $1
          AND crm_activities.entity_type = $2
          AND crm_activities.entity_id = $3
          AND crm_activities.deleted_at IS NULL
        ORDER BY crm_activities.occurred_at DESC, crm_activities.created_at DESC
      `,
      [tenantId, entityType, entityId]
    );

    return result.rows.map((row) => this.mapActivity(row));
  }

  private async loadEntityTasks(
    client: PoolClient,
    tenantId: string,
    entityType: CrmEntityType,
    entityId: string
  ): Promise<CrmTaskSummary[]> {
    const result = await client.query<TaskRow>(
      `
        SELECT
          crm_tasks.id,
          crm_tasks.entity_type,
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
          assignee_departments.name AS assignee_department_name
        FROM crm_tasks
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
        WHERE crm_tasks.tenant_id = $1
          AND crm_tasks.entity_type = $2
          AND crm_tasks.entity_id = $3
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
      [tenantId, entityType, entityId]
    );

    return result.rows.map((row) => this.mapTask(row));
  }

  private async loadTimelineEventItems(
    client: PoolClient,
    tenantId: string,
    entityType: CrmEntityType,
    entityId: string
  ): Promise<CrmTimelineItem[]> {
    const result = await client.query<TimelineEventRow>(
      `
        SELECT
          crm_timeline_events.id,
          crm_timeline_events.entity_type,
          crm_timeline_events.entity_id,
          crm_timeline_events.touchpoint_type,
          crm_timeline_events.title,
          crm_timeline_events.description,
          crm_timeline_events.occurred_at,
          crm_timeline_events.metadata,
          owner_users.id AS owner_id,
          owner_users.display_name AS owner_display_name,
          owner_users.email AS owner_email,
          owner_teams.name AS owner_team_name,
          owner_departments.name AS owner_department_name
        FROM crm_timeline_events
        LEFT JOIN users AS owner_users
          ON owner_users.id = crm_timeline_events.owner_user_id
         AND owner_users.tenant_id = crm_timeline_events.tenant_id
         AND owner_users.deleted_at IS NULL
        LEFT JOIN teams AS owner_teams
          ON owner_teams.id = owner_users.team_id
         AND owner_teams.tenant_id = owner_users.tenant_id
         AND owner_teams.deleted_at IS NULL
        LEFT JOIN departments AS owner_departments
          ON owner_departments.id = owner_users.department_id
         AND owner_departments.tenant_id = owner_users.tenant_id
         AND owner_departments.deleted_at IS NULL
        WHERE crm_timeline_events.tenant_id = $1
          AND crm_timeline_events.entity_type = $2
          AND crm_timeline_events.entity_id = $3
          AND crm_timeline_events.deleted_at IS NULL
        ORDER BY crm_timeline_events.occurred_at DESC, crm_timeline_events.created_at DESC
      `,
      [tenantId, entityType, entityId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      kind: row.touchpoint_type as CrmTimelineItem["kind"],
      touchpointType: row.touchpoint_type as CrmTimelineItem["touchpointType"],
      title: row.title,
      description: row.description,
      occurredAt: row.occurred_at.toISOString(),
      actor: null,
      owner: mapUser({
        id: row.owner_id,
        displayName: row.owner_display_name,
        email: row.owner_email,
        teamName: row.owner_team_name,
        departmentName: row.owner_department_name
      }),
      relatedRecord: toRecordLink(row.entity_type, row.entity_id),
      isCustomerFacing: false,
      activityType: null,
      taskStatus: null,
      taskPriority: null,
      dueAt: null,
      metadata: getMetadata(row.metadata)
    }));
  }

  private async loadEntityTimeline(
    client: PoolClient,
    tenantId: string,
    entityType: CrmEntityType,
    entityId: string,
    activeKind: CrmTimelineFilterKind = "all"
  ): Promise<CrmTimelineItem[]> {
    const notes = await this.loadEntityNotes(client, tenantId, entityType, entityId);
    const activities = await this.loadEntityActivities(client, tenantId, entityType, entityId);
    const tasks = await this.loadEntityTasks(client, tenantId, entityType, entityId);
    const externalItems = await this.loadTimelineEventItems(client, tenantId, entityType, entityId);

    const items: CrmTimelineItem[] = [
      ...notes.map((note) => ({
        id: note.id,
        kind: "note" as const,
        touchpointType: "note" as const,
        title: note.isCustomerFacing ? "Customer-facing note" : "Internal note",
        description: note.body,
        occurredAt: note.updatedAt,
        actor: note.author,
        owner: note.author,
        relatedRecord: toRecordLink(entityType, entityId),
        isCustomerFacing: note.isCustomerFacing,
        activityType: null,
        taskStatus: null,
        taskPriority: null,
        dueAt: null,
        metadata: note.metadata
      })),
      ...activities.map((activity) => ({
        id: activity.id,
        kind: "activity" as const,
        touchpointType: "activity" as const,
        title: activity.subject,
        description: activity.notes,
        occurredAt: activity.occurredAt,
        actor: activity.author,
        owner: activity.owner,
        relatedRecord: activity.relatedRecord,
        isCustomerFacing: false,
        activityType: activity.activityType,
        taskStatus: null,
        taskPriority: null,
        dueAt: null,
        metadata: activity.metadata
      })),
      ...tasks.map((task) => ({
        id: task.id,
        kind: "task" as const,
        touchpointType: "task" as const,
        title: task.title,
        description: task.description,
        occurredAt: task.updatedAt,
        actor: task.owner,
        owner: task.assignee ?? task.owner,
        relatedRecord: task.relatedRecord,
        isCustomerFacing: false,
        activityType: null,
        taskStatus: task.status,
        taskPriority: task.priority,
        dueAt: task.dueAt,
        metadata: task.metadata
      })),
      ...externalItems
    ];

    return items
      .filter((item) => activeKind === "all" || item.kind === activeKind)
      .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
  }

  private async loadNoteById(client: PoolClient, tenantId: string, noteId: string) {
    const result = await client.query<NoteRow>(
      `
        SELECT
          crm_notes.id,
          crm_notes.entity_type,
          crm_notes.entity_id,
          crm_notes.body,
          crm_notes.is_customer_facing,
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

    return this.mapNote(note);
  }

  private async loadActivityById(client: PoolClient, tenantId: string, activityId: string) {
    const result = await client.query<ActivityRow>(
      `
        SELECT
          crm_activities.id,
          crm_activities.entity_type,
          crm_activities.entity_id,
          crm_activities.activity_type,
          crm_activities.subject,
          crm_activities.description,
          crm_activities.outcome,
          crm_activities.occurred_at,
          crm_activities.metadata,
          crm_activities.created_at,
          crm_activities.updated_at,
          users.id AS author_id,
          users.display_name AS author_display_name,
          users.email AS author_email,
          teams.name AS author_team_name,
          departments.name AS author_department_name,
          owner_users.id AS owner_id,
          owner_users.display_name AS owner_display_name,
          owner_users.email AS owner_email,
          owner_teams.name AS owner_team_name,
          owner_departments.name AS owner_department_name
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
        LEFT JOIN users AS owner_users
          ON owner_users.id = crm_activities.owner_user_id
         AND owner_users.tenant_id = crm_activities.tenant_id
         AND owner_users.deleted_at IS NULL
        LEFT JOIN teams AS owner_teams
          ON owner_teams.id = owner_users.team_id
         AND owner_teams.tenant_id = owner_users.tenant_id
         AND owner_teams.deleted_at IS NULL
        LEFT JOIN departments AS owner_departments
          ON owner_departments.id = owner_users.department_id
         AND owner_departments.tenant_id = owner_users.tenant_id
         AND owner_departments.deleted_at IS NULL
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

    return this.mapActivity(activity);
  }

  private async loadTaskById(client: PoolClient, tenantId: string, taskId: string) {
    const result = await client.query<TaskRow>(
      `
        SELECT
          crm_tasks.id,
          crm_tasks.entity_type,
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
          assignee_departments.name AS assignee_department_name
        FROM crm_tasks
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
        WHERE crm_tasks.tenant_id = $1
          AND crm_tasks.id = $2
          AND crm_tasks.deleted_at IS NULL
        LIMIT 1
      `,
      [tenantId, taskId]
    );

    const task = result.rows[0] ?? null;

    if (!task) {
      throw new AppError(404, "Task not found.", undefined, "TASK_NOT_FOUND");
    }

    return this.mapTask(task);
  }

  private mapNote(row: NoteRow): CrmNoteSummary {
    return {
      id: row.id,
      body: row.body,
      isCustomerFacing: row.is_customer_facing,
      isInternal: !row.is_customer_facing,
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
    };
  }

  private mapActivity(row: ActivityRow): CrmActivitySummary {
    return {
      id: row.id,
      relatedRecord: toRecordLink(row.entity_type, row.entity_id),
      activityType: row.activity_type as CrmActivitySummary["activityType"],
      subject: row.subject,
      outcome: row.outcome,
      notes: row.description,
      occurredAt: row.occurred_at.toISOString(),
      owner: mapUser({
        id: row.owner_id,
        displayName: row.owner_display_name,
        email: row.owner_email,
        teamName: row.owner_team_name,
        departmentName: row.owner_department_name
      }),
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
    };
  }

  private mapTask(row: TaskRow): CrmTaskSummary {
    return {
      id: row.id,
      relatedRecord: toRecordLink(row.entity_type, row.entity_id),
      title: row.title,
      description: row.description,
      dueAt: toIsoString(row.due_at),
      reminderAt: toIsoString(row.reminder_at),
      priority: row.priority as CrmTaskSummary["priority"],
      status: row.status as CrmTaskStatus,
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
      metadata: getMetadata(row.metadata)
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
      // Lead classification filters (stored in leads.metadata).
      if (query.leadFor) {
        params.push(query.leadFor.trim());
        conditions.push(`leads.metadata->>'leadFor' = $${params.length}`);
      }
      if (query.product) {
        params.push(query.product.trim());
        conditions.push(`leads.metadata->'products' ? $${params.length}`);
      }
      if (query.technology) {
        params.push(query.technology.trim());
        conditions.push(`leads.metadata->'technologies' ? $${params.length}`);
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
            leads.custom_fields,
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

  async getLeadRuntime(actor: ActorContext, leadId: string): Promise<LeadRuntimeResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const lead = await this.loadLeadDetail(client, actor.tenantId, leadId);
      const firstActivityAt = await this.loadLeadFirstActivityAt(client, actor.tenantId, leadId);
      const config = await this.loadLeadRuntimeConfiguration(client, actor.tenantId);
      const record = buildLeadRuntimeRecord({
        id: lead.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        fullName: lead.fullName,
        companyName: lead.companyName,
        email: lead.email,
        phone: lead.phone,
        statusKey: lead.status?.key ?? null,
        sourceKey: lead.source?.key ?? null,
        score: lead.score,
        ownerId: lead.owner?.id ?? null,
        customFields: lead.customFields,
        activityCount: lead.activityCount,
        firstActivityAt,
        lastActivityAt: lead.lastActivityAt,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
        metadata: lead.metadata
      });

      return evaluateLeadRuntime({
        leadId,
        record,
        config,
        nowIso: new Date().toISOString()
      });
    });
  }

  private async loadLeadFirstActivityAt(client: PoolClient, tenantId: string, leadId: string): Promise<string | null> {
    const result = await client.query<{ first_activity_at: Date | null }>(
      `
        SELECT MIN(occurred_at) AS first_activity_at
        FROM crm_activities
        WHERE tenant_id = $1
          AND entity_type = 'lead'
          AND entity_id = $2
          AND deleted_at IS NULL
      `,
      [tenantId, leadId]
    );
    return toIsoString(result.rows[0]?.first_activity_at ?? null);
  }

  private async loadLeadRuntimeConfiguration(client: PoolClient, tenantId: string): Promise<LeadRuntimeConfiguration> {
    const result = await client.query<LeadRuntimeDefinitionRow>(
      `
        SELECT definition_type, definition_key, name, definition
        FROM configuration_definitions
        WHERE tenant_id = $1
          AND deleted_at IS NULL
          AND is_active = true
          AND definition_type IN ('scoring_model', 'mql_rule', 'assignment_rule', 'sla_policy')
          AND definition->>'object' = 'lead'
        ORDER BY definition_type ASC, updated_at DESC
      `,
      [tenantId]
    );

    const config: LeadRuntimeConfiguration = {};
    for (const row of result.rows) {
      if (row.definition_type === "scoring_model" && !config.scoringModel) {
        config.scoringModel = {
          definitionKey: row.definition_key,
          name: row.name,
          payload: row.definition as unknown as ScoringModelPayload
        };
      }
      if (row.definition_type === "mql_rule" && !config.mqlRule) {
        config.mqlRule = {
          definitionKey: row.definition_key,
          name: row.name,
          payload: row.definition as unknown as MqlRulePayload
        };
      }
      if (row.definition_type === "assignment_rule" && !config.assignmentRule) {
        config.assignmentRule = {
          definitionKey: row.definition_key,
          name: row.name,
          payload: row.definition as unknown as AssignmentRulePayload
        };
      }
      if (row.definition_type === "sla_policy" && !config.slaPolicy) {
        config.slaPolicy = {
          definitionKey: row.definition_key,
          name: row.name,
          payload: row.definition as unknown as SlaPolicyPayload
        };
      }
    }
    return config;
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
          leads.custom_fields,
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

    const conversion = getLeadConversionSummary(row.metadata);

    return {
      ...this.mapLead(row),
      customFields: getMetadata(row.custom_fields),
      notes: await this.loadEntityNotes(client, tenantId, "lead", leadId),
      activities: await this.loadEntityActivities(client, tenantId, "lead", leadId),
      tasks: await this.loadEntityTasks(client, tenantId, "lead", leadId),
      timeline: await this.loadEntityTimeline(client, tenantId, "lead", leadId),
      conversion,
      conversionPlaceholder: {
        available: false,
        message: conversion ? "Lead conversion has been completed for this record." : "Lead conversion is reserved for a later opportunity-management phase."
      }
    };
  }

  async createLead(actor: ActorContext, audit: AuditMetadata, input: CreateLeadRequestBody): Promise<LeadResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const ownerId = await this.ensureOwnerId(client, actor.tenantId, input.ownerId ?? null);
      const statusOptionId = await this.resolveOptionValueId(client, actor.tenantId, "lead-status", input.statusKey, "Lead status");
      const sourceOptionId = await this.resolveOptionValueId(client, actor.tenantId, "lead-source", input.sourceKey, "Lead source");
      const customFields = await this.sanitizeCustomFields(client, actor.tenantId, "lead", input.customFields);
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
            custom_fields,
            metadata,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13, $13)
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
          JSON.stringify(customFields),
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

  async convertLead(
    actor: ActorContext,
    audit: AuditMetadata,
    leadId: string,
    input: ConvertLeadRequestBody
  ): Promise<LeadConversionResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const currentLead = await this.getLeadState(client, actor.tenantId, leadId);
      const existingConversion = getLeadConversionSummary(currentLead.metadata);

      if (existingConversion?.opportunity?.id) {
        throw new AppError(409, "This lead has already been converted.", existingConversion, "LEAD_ALREADY_CONVERTED");
      }

      const nowIso = new Date().toISOString();
      const workspace = getSalesWorkspaceRoot(currentLead.metadata);
      const qualificationChecklist = getBantChecklist(workspace.qualificationChecklist);
      const qualificationSummary =
        getTrimmedNullableString(input.handoverNotes) ||
        (typeof workspace.qualificationNotes === "string" ? getTrimmedNullableString(workspace.qualificationNotes) : null);
      const productContext =
        firstArray(
          getMetadata(currentLead.metadata).productInterest,
          getMetadata(currentLead.metadata).products,
          getMetadata(currentLead.metadata).technologies,
          getMetadata(currentLead.custom_fields).productInterest
        ) ?? [];
      const duplicateMatches = {
        accountMatches: await this.loadLeadDuplicateAccounts(client, actor.tenantId, {
          companyName: currentLead.company_name,
          email: currentLead.email
        }),
        contactMatches: await this.loadLeadDuplicateContacts(client, actor.tenantId, {
          firstName: currentLead.first_name,
          lastName: currentLead.last_name,
          email: currentLead.email,
          phone: currentLead.phone
        })
      };

      const ownerId = await this.ensureOwnerId(client, actor.tenantId, input.ownerId ?? currentLead.owner_id);
      const readiness = evaluateLeadConversionReadiness({
        qualificationChecklist,
        duplicateCheckCompleted: true,
        hasOwner: Boolean(ownerId),
        hasNextStep: Boolean(getTrimmedNullableString(input.nextStep)),
        hasExpectedCloseDate: Boolean(getTrimmedNullableString(input.expectedCloseDate)),
        hasAmount: Number.isFinite(input.amount),
        hasProductContext: productContext.length > 0
      });

      if (!readiness.ready) {
        throw new AppError(400, "Lead conversion requirements are not met.", { blockers: readiness.blockers }, "LEAD_CONVERSION_BLOCKED");
      }

      const strongAccountMatches = duplicateMatches.accountMatches.filter((match) => match.reasons.includes("company_name"));
      const strongContactMatches = duplicateMatches.contactMatches.filter(
        (match) => match.reasons.includes("email") || match.reasons.includes("phone")
      );

      let accountId = await this.ensureAccountId(client, actor.tenantId, input.accountId ?? null);
      let accountLinkMode: "created" | "existing" = "existing";

      if (!accountId) {
        if (strongAccountMatches.length > 1) {
          throw new AppError(
            409,
            "Multiple matching accounts were found. Choose the account explicitly before converting this lead.",
            { accountMatches: duplicateMatches.accountMatches },
            "LEAD_CONVERSION_DUPLICATE_ACCOUNT"
          );
        }

        if (strongAccountMatches.length === 1) {
          accountId = strongAccountMatches[0].id;
        }
      }

      let contactId = await this.ensureContactId(client, actor.tenantId, input.contactId ?? null, accountId);
      let contactLinkMode: "created" | "existing" = "existing";

      if (!contactId) {
        if (strongContactMatches.length > 1) {
          throw new AppError(
            409,
            "Multiple matching contacts were found. Choose the contact explicitly before converting this lead.",
            { contactMatches: duplicateMatches.contactMatches },
            "LEAD_CONVERSION_DUPLICATE_CONTACT"
          );
        }

        if (strongContactMatches.length === 1) {
          contactId = await this.ensureContactId(client, actor.tenantId, strongContactMatches[0].id, accountId);
        }
      }

      this.assertLeadConversionPermissions(actor, !accountId, !contactId);

      if (!accountId) {
        accountLinkMode = "created";
        const defaultAccountTypeId = await this.resolveOptionValueId(client, actor.tenantId, "account-type", "prospect", "Account type");
        const accountResult = await client.query<{ id: string }>(
          `
            INSERT INTO accounts (
              tenant_id,
              owner_id,
              name,
              website,
              industry,
              account_type_option_id,
              health_status_option_id,
              custom_fields,
              metadata,
              created_by,
              updated_by
            )
            VALUES ($1, $2, $3, NULL, $4, $5, NULL, '{}'::jsonb, $6::jsonb, $7, $7)
            RETURNING id
          `,
          [
            actor.tenantId,
            ownerId,
            currentLead.company_name.trim(),
            getTrimmedNullableString(String(getMetadata(currentLead.metadata).industry ?? "")),
            defaultAccountTypeId,
            JSON.stringify({
              createdFromLeadId: leadId,
              createdFromLeadEmail: currentLead.email,
              conversionSource: "lead.convert"
            }),
            actor.userId
          ]
        );
        accountId = accountResult.rows[0]?.id ?? null;

        if (!accountId) {
          throw new AppError(500, "Account creation during lead conversion failed.", undefined, "ACCOUNT_CREATE_FAILED");
        }
      }

      if (!contactId) {
        contactLinkMode = "created";
        const contactResult = await client.query<{ id: string }>(
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
            VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NULL, $8::jsonb, $9, $9)
            RETURNING id
          `,
          [
            actor.tenantId,
            ownerId,
            accountId,
            currentLead.first_name.trim(),
            currentLead.last_name.trim(),
            getTrimmedNullableString(currentLead.email),
            getTrimmedNullableString(currentLead.phone),
            JSON.stringify({
              createdFromLeadId: leadId,
              conversionSource: "lead.convert"
            }),
            actor.userId
          ]
        );
        contactId = contactResult.rows[0]?.id ?? null;

        if (!contactId) {
          throw new AppError(500, "Contact creation during lead conversion failed.", undefined, "CONTACT_CREATE_FAILED");
        }
      } else if (accountId) {
        await client.query(
          `
            UPDATE contacts
            SET
              account_id = COALESCE(account_id, $3),
              updated_by = $4
            WHERE tenant_id = $1
              AND id = $2
              AND deleted_at IS NULL
          `,
          [actor.tenantId, contactId, accountId, actor.userId]
        );
      }

      const stageOptionId = await this.resolveOptionValueId(client, actor.tenantId, "opportunity-pipeline", input.stageKey, "Opportunity stage");
      const opportunitySourceKey = getTrimmedNullableString(input.sourceKey) ?? mapLeadSourceToOpportunitySource(currentLead.source_key);
      const sourceOptionId = await this.resolveOptionValueId(
        client,
        actor.tenantId,
        "opportunity-source",
        opportunitySourceKey,
        "Opportunity source"
      );
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
            tenant_id,
            account_id,
            primary_contact_id,
            owner_id,
            name,
            stage_option_id,
            source_option_id,
            outcome_status_option_id,
            amount,
            probability,
            expected_close_date,
            competitor,
            next_step,
            win_loss_reason,
            custom_fields,
            metadata,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::date, $12, $13, NULL, '{}'::jsonb, $14::jsonb, $15, $15)
          RETURNING id
        `,
        [
          actor.tenantId,
          accountId,
          contactId,
          ownerId,
          getTrimmedNullableString(input.opportunityName) ?? `${currentLead.company_name.trim()} Opportunity`,
          stageOptionId,
          sourceOptionId,
          outcomeStatusOptionId,
          input.amount,
          input.probability ?? null,
          input.expectedCloseDate,
          getTrimmedNullableString(input.competitor),
          getTrimmedNullableString(input.nextStep),
          JSON.stringify({
            convertedFromLeadId: leadId,
            leadSourceKey: currentLead.source_key,
            qualificationSummary,
            productContext,
            duplicateMatches
          }),
          actor.userId
        ]
      );

      const opportunityId = opportunityResult.rows[0]?.id;

      if (!opportunityId) {
        throw new AppError(500, "Opportunity creation during lead conversion failed.", undefined, "OPPORTUNITY_CREATE_FAILED");
      }

      const taskResult = await client.query<{ id: string }>(
        `
          INSERT INTO crm_tasks (
            tenant_id,
            entity_type,
            entity_id,
            owner_user_id,
            assignee_user_id,
            title,
            description,
            due_at,
            priority,
            status,
            reminder_at,
            metadata,
            created_by,
            updated_by
          )
          VALUES ($1, 'opportunity', $2, $3, $3, $4, $5, $6, 'medium', 'open', NULL, $7::jsonb, $8, $8)
          RETURNING id
        `,
        [
          actor.tenantId,
          opportunityId,
          ownerId,
          `Review lead handoff for ${currentLead.company_name.trim()}`,
          qualificationSummary ??
            `${currentLead.first_name} ${currentLead.last_name}`.trim() +
              " was converted from lead to opportunity. Review qualification context and next-step commitments.",
          input.taskDueAt ? new Date(input.taskDueAt) : new Date(Date.now() + 24 * 60 * 60 * 1000),
          JSON.stringify({
            convertedFromLeadId: leadId,
            handoffTask: true
          }),
          actor.userId
        ]
      );

      const taskId = taskResult.rows[0]?.id;

      if (!taskId) {
        throw new AppError(500, "Handoff task creation failed during lead conversion.", undefined, "TASK_CREATE_FAILED");
      }

      const account = await this.loadAccountLookupById(client, actor.tenantId, accountId);
      const contact = await this.loadContactRelationshipById(client, actor.tenantId, contactId);
      const opportunity = await this.loadOpportunityLookupById(client, actor.tenantId, opportunityId);
      const handoffTask = await this.loadTaskById(client, actor.tenantId, taskId);
      const convertedStatusOptionId = await this.resolveOptionValueId(client, actor.tenantId, "lead-status", "converted", "Lead status");
      const metadata = {
        ...getMetadata(currentLead.metadata),
        salesWorkspace: {
          ...workspace,
          handoffStatusKey: "handed_to_sales",
          handoffUpdatedAt: nowIso
        },
        conversion: {
          convertedAt: nowIso,
          convertedByUserId: actor.userId,
          account,
          accountLinkMode,
          contact,
          contactLinkMode,
          opportunity,
          handoffTask,
          duplicateCheckCompletedAt: nowIso,
          duplicateMatches,
          qualificationSummary
        }
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
        [leadId, actor.tenantId, ownerId, convertedStatusOptionId, JSON.stringify(metadata), actor.userId]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "lead.convert",
        resourceType: "lead",
        resourceId: leadId,
        status: "success",
        metadata: {
          accountId,
          contactId,
          opportunityId,
          handoffTaskId: taskId,
          duplicateMatches
        }
      });

      return {
        lead: await this.loadLeadDetail(client, actor.tenantId, leadId),
        account,
        contact,
        opportunity,
        handoffTask,
        duplicateMatches
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
      const customFields =
        input.customFields !== undefined
          ? await this.sanitizeCustomFields(client, actor.tenantId, "lead", input.customFields, getMetadata(currentLead.custom_fields))
          : getMetadata(currentLead.custom_fields);

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
            custom_fields = $12::jsonb,
            metadata = $13::jsonb,
            updated_by = $14
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
          JSON.stringify(customFields),
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

    return this.databaseService.withClient(async (client) => {
      const fieldDefinitions = await this.loadFieldDefinitions(client, actor.tenantId, "lead");
      const customFieldOptionsPromise = this.loadCustomFieldOptions(client, actor.tenantId, fieldDefinitions);
      const [owners, statuses, sources, customFieldOptions, leadForOptions, technologyOptions, productOptions] = await Promise.all([
        this.loadOwners(client, actor.tenantId),
        this.loadOptionSetValues(client, actor.tenantId, "lead-status"),
        this.loadOptionSetValues(client, actor.tenantId, "lead-source"),
        customFieldOptionsPromise,
        this.loadOptionSetValues(client, actor.tenantId, "lead-for"),
        this.loadOptionSetValues(client, actor.tenantId, "service-technology"),
        this.loadOptionSetValues(client, actor.tenantId, "education-product")
      ]);

      return {
        owners,
        statuses,
        sources,
        fieldDefinitions,
        customFieldOptions,
        leadForOptions,
        technologyOptions,
        productOptions
      };
    });
  }

  private async createNote(
    actor: ActorContext,
    audit: AuditMetadata,
    entityType: CrmEntityType,
    entityId: string,
    input: CreateCrmNoteRequestBody
  ): Promise<CrmNoteResponse> {
    return this.databaseService.withTransaction(async (client) => {
      const entityConfig = getEntityConfig(entityType);
      await this.assertEntityExists(client, actor.tenantId, entityType, entityId);
      const result = await client.query<{ id: string }>(
        `
          INSERT INTO crm_notes (
            tenant_id,
            entity_type,
            entity_id,
            author_user_id,
            body,
            is_customer_facing,
            metadata,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $4, $4)
          RETURNING id
        `,
        [
          actor.tenantId,
          entityType,
          entityId,
          actor.userId,
          input.body.trim(),
          input.isCustomerFacing ?? false,
          JSON.stringify(input.metadata ?? {})
        ]
      );

      const noteId = result.rows[0]?.id;

      if (!noteId) {
        throw new AppError(500, `${entityConfig.label} note creation failed.`, undefined, "NOTE_CREATE_FAILED");
      }

      await this.recordAuditLog(client, actor, audit, {
        action: `${entityConfig.actionPrefix}.note.create`,
        resourceType: entityConfig.actionPrefix,
        resourceId: entityId,
        status: "success",
        metadata: {
          noteId,
          isCustomerFacing: input.isCustomerFacing ?? false
        }
      });

      return {
        note: await this.loadNoteById(client, actor.tenantId, noteId)
      };
    });
  }

  async createEntityNote(
    actor: ActorContext,
    audit: AuditMetadata,
    entityType: CrmEntityType,
    entityId: string,
    input: CreateCrmNoteRequestBody
  ): Promise<CrmNoteResponse> {
    this.assertEnabled();
    return this.createNote(actor, audit, entityType, entityId, input);
  }

  async updateEntityNote(
    actor: ActorContext,
    audit: AuditMetadata,
    entityType: CrmEntityType,
    entityId: string,
    noteId: string,
    input: UpdateCrmNoteRequestBody
  ): Promise<CrmNoteResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const entityConfig = getEntityConfig(entityType);
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateCrmNoteRequestBody] !== undefined);

      if (keys.length === 0) {
        throw new AppError(400, "At least one note field must be updated.", undefined, "VALIDATION_ERROR");
      }

      const result = await client.query<NoteStateRow>(
        `
          SELECT id, entity_type, entity_id, body, is_customer_facing, metadata
          FROM crm_notes
          WHERE tenant_id = $1
            AND entity_type = $2
            AND entity_id = $3
            AND id = $4
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [actor.tenantId, entityType, entityId, noteId]
      );

      const currentNote = result.rows[0] ?? null;

      if (!currentNote) {
        throw new AppError(404, "Note not found.", undefined, "NOTE_NOT_FOUND");
      }

      const metadata = input.metadata
        ? { ...getMetadata(currentNote.metadata), ...input.metadata }
        : getMetadata(currentNote.metadata);

      await client.query(
        `
          UPDATE crm_notes
          SET
            body = $5,
            is_customer_facing = $6,
            metadata = $7::jsonb,
            updated_by = $8
          WHERE tenant_id = $1
            AND entity_type = $2
            AND entity_id = $3
            AND id = $4
            AND deleted_at IS NULL
        `,
        [
          actor.tenantId,
          entityType,
          entityId,
          noteId,
          input.body?.trim() ?? currentNote.body,
          input.isCustomerFacing ?? currentNote.is_customer_facing,
          JSON.stringify(metadata),
          actor.userId
        ]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: `${entityConfig.actionPrefix}.note.edit`,
        resourceType: entityConfig.actionPrefix,
        resourceId: entityId,
        status: "success",
        metadata: {
          noteId,
          updatedFields: keys
        }
      });

      return {
        note: await this.loadNoteById(client, actor.tenantId, noteId)
      };
    });
  }

  private async createActivity(
    actor: ActorContext,
    audit: AuditMetadata,
    entityType: CrmEntityType,
    entityId: string,
    input: CreateCrmActivityRequestBody
  ): Promise<CrmActivityResponse> {
    return this.databaseService.withTransaction(async (client) => {
      const entityConfig = getEntityConfig(entityType);
      await this.assertEntityExists(client, actor.tenantId, entityType, entityId);
      const ownerId = await this.ensureOwnerId(client, actor.tenantId, input.ownerId ?? actor.userId);
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
            owner_user_id,
            outcome,
            author_user_id,
            metadata,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $10, $10)
          RETURNING id
        `,
        [
          actor.tenantId,
          entityType,
          entityId,
          input.activityType,
          input.subject.trim(),
          getTrimmedNullableString(input.notes),
          input.occurredAt ? new Date(input.occurredAt) : new Date(),
          ownerId,
          getTrimmedNullableString(input.outcome),
          actor.userId,
          JSON.stringify(input.metadata ?? {})
        ]
      );

      const activityId = result.rows[0]?.id;

      if (!activityId) {
        throw new AppError(500, `${entityConfig.label} activity creation failed.`, undefined, "ACTIVITY_CREATE_FAILED");
      }

      await this.recordAuditLog(client, actor, audit, {
        action: `${entityConfig.actionPrefix}.activity.create`,
        resourceType: entityConfig.actionPrefix,
        resourceId: entityId,
        status: "success",
        metadata: {
          activityId,
          activityType: input.activityType,
          ownerId
        }
      });

      return {
        activity: await this.loadActivityById(client, actor.tenantId, activityId)
      };
    });
  }

  async createEntityActivity(
    actor: ActorContext,
    audit: AuditMetadata,
    entityType: CrmEntityType,
    entityId: string,
    input: CreateCrmActivityRequestBody
  ): Promise<CrmActivityResponse> {
    this.assertEnabled();
    return this.createActivity(actor, audit, entityType, entityId, input);
  }

  async getEntityNotes(
    actor: ActorContext,
    entityType: CrmEntityType,
    entityId: string
  ): Promise<CrmNotesResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      await this.assertEntityExists(client, actor.tenantId, entityType, entityId);

      return {
        notes: await this.loadEntityNotes(client, actor.tenantId, entityType, entityId)
      };
    });
  }

  async getEntityActivities(
    actor: ActorContext,
    entityType: CrmEntityType,
    entityId: string
  ): Promise<CrmActivitiesResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      await this.assertEntityExists(client, actor.tenantId, entityType, entityId);

      return {
        activities: await this.loadEntityActivities(client, actor.tenantId, entityType, entityId)
      };
    });
  }

  async getEntityTimeline(
    actor: ActorContext,
    entityType: CrmEntityType,
    entityId: string,
    activeKind: CrmTimelineFilterKind = "all"
  ): Promise<CrmTimelineResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      await this.assertEntityExists(client, actor.tenantId, entityType, entityId);

      return {
        items: await this.loadEntityTimeline(client, actor.tenantId, entityType, entityId, activeKind),
        availableTouchpointTypes: [
          "note",
          "activity",
          "task",
          "ticket",
          "campaign",
          "training",
          "onboarding_milestone"
        ],
        activeTouchpointType: activeKind
      };
    });
  }

  async listEntityTasks(
    actor: ActorContext,
    entityType: CrmEntityType,
    entityId: string
  ): Promise<CrmTasksResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      await this.assertEntityExists(client, actor.tenantId, entityType, entityId);

      return {
        tasks: await this.loadEntityTasks(client, actor.tenantId, entityType, entityId)
      };
    });
  }

  async createEntityTask(
    actor: ActorContext,
    audit: AuditMetadata,
    entityType: CrmEntityType,
    entityId: string,
    input: CreateCrmTaskRequestBody
  ): Promise<CrmTaskResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const entityConfig = getEntityConfig(entityType);
      await this.assertEntityExists(client, actor.tenantId, entityType, entityId);
      const ownerId = await this.ensureOwnerId(client, actor.tenantId, input.ownerId ?? actor.userId);
      const assigneeId = await this.ensureOwnerId(client, actor.tenantId, input.assigneeId ?? ownerId);
      const result = await client.query<{ id: string }>(
        `
          INSERT INTO crm_tasks (
            tenant_id,
            entity_type,
            entity_id,
            owner_user_id,
            assignee_user_id,
            title,
            description,
            due_at,
            priority,
            status,
            reminder_at,
            metadata,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $13)
          RETURNING id
        `,
        [
          actor.tenantId,
          entityType,
          entityId,
          ownerId,
          assigneeId,
          input.title.trim(),
          getTrimmedNullableString(input.description),
          input.dueAt ? new Date(input.dueAt) : null,
          input.priority ?? "medium",
          input.status ?? "open",
          input.reminderAt ? new Date(input.reminderAt) : null,
          JSON.stringify(input.metadata ?? {}),
          actor.userId
        ]
      );

      const taskId = result.rows[0]?.id;

      if (!taskId) {
        throw new AppError(500, `${entityConfig.label} task creation failed.`, undefined, "TASK_CREATE_FAILED");
      }

      await this.recordAuditLog(client, actor, audit, {
        action: `${entityConfig.actionPrefix}.task.create`,
        resourceType: entityConfig.actionPrefix,
        resourceId: entityId,
        status: "success",
        metadata: {
          taskId,
          assigneeId,
          status: input.status ?? "open",
          priority: input.priority ?? "medium"
        }
      });

      return {
        task: await this.loadTaskById(client, actor.tenantId, taskId)
      };
    });
  }

  async updateEntityTask(
    actor: ActorContext,
    audit: AuditMetadata,
    entityType: CrmEntityType,
    entityId: string,
    taskId: string,
    input: UpdateCrmTaskRequestBody
  ): Promise<CrmTaskResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const entityConfig = getEntityConfig(entityType);
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateCrmTaskRequestBody] !== undefined);
      this.assertTaskAssignOnlyMutation(actor, entityType, keys);

      const result = await client.query<TaskStateRow>(
        `
          SELECT
            id,
            entity_type,
            entity_id,
            title,
            description,
            due_at,
            reminder_at,
            priority,
            status,
            owner_user_id,
            assignee_user_id,
            metadata
          FROM crm_tasks
          WHERE tenant_id = $1
            AND entity_type = $2
            AND entity_id = $3
            AND id = $4
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [actor.tenantId, entityType, entityId, taskId]
      );

      const currentTask = result.rows[0] ?? null;

      if (!currentTask) {
        throw new AppError(404, "Task not found.", undefined, "TASK_NOT_FOUND");
      }

      const ownerId = keys.includes("ownerId")
        ? await this.ensureOwnerId(client, actor.tenantId, input.ownerId ?? null)
        : currentTask.owner_user_id;
      const assigneeId = keys.includes("assigneeId")
        ? await this.ensureOwnerId(client, actor.tenantId, input.assigneeId ?? null)
        : currentTask.assignee_user_id;
      const metadata = input.metadata
        ? { ...getMetadata(currentTask.metadata), ...input.metadata }
        : getMetadata(currentTask.metadata);

      await client.query(
        `
          UPDATE crm_tasks
          SET
            owner_user_id = $5,
            assignee_user_id = $6,
            title = $7,
            description = $8,
            due_at = $9,
            priority = $10,
            status = $11,
            reminder_at = $12,
            metadata = $13::jsonb,
            updated_by = $14
          WHERE tenant_id = $1
            AND entity_type = $2
            AND entity_id = $3
            AND id = $4
            AND deleted_at IS NULL
        `,
        [
          actor.tenantId,
          entityType,
          entityId,
          taskId,
          ownerId,
          assigneeId,
          input.title?.trim() ?? currentTask.title,
          input.description !== undefined ? getTrimmedNullableString(input.description) : currentTask.description,
          input.dueAt !== undefined ? (input.dueAt ? new Date(input.dueAt) : null) : currentTask.due_at,
          input.priority ?? currentTask.priority,
          input.status ?? currentTask.status,
          input.reminderAt !== undefined ? (input.reminderAt ? new Date(input.reminderAt) : null) : currentTask.reminder_at,
          JSON.stringify(metadata),
          actor.userId
        ]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: `${entityConfig.actionPrefix}.task.update`,
        resourceType: entityConfig.actionPrefix,
        resourceId: entityId,
        status: "success",
        metadata: {
          taskId,
          updatedFields: keys
        }
      });

      return {
        task: await this.loadTaskById(client, actor.tenantId, taskId)
      };
    });
  }

  async addLeadNote(
    actor: ActorContext,
    audit: AuditMetadata,
    leadId: string,
    input: CreateCrmNoteRequestBody
  ): Promise<CrmNoteResponse> {
    this.assertEnabled();
    return this.createNote(actor, audit, "lead", leadId, input);
  }

  async addLeadActivity(
    actor: ActorContext,
    audit: AuditMetadata,
    leadId: string,
    input: CreateCrmActivityRequestBody
  ): Promise<CrmActivityResponse> {
    this.assertEnabled();
    return this.createActivity(actor, audit, "lead", leadId, input);
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
          accounts.custom_fields,
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
      customFields: getMetadata(row.custom_fields),
      notes: await this.loadEntityNotes(client, tenantId, "account", accountId),
      activities: await this.loadEntityActivities(client, tenantId, "account", accountId),
      tasks: await this.loadEntityTasks(client, tenantId, "account", accountId),
      timeline: await this.loadEntityTimeline(client, tenantId, "account", accountId),
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
        message: "Linked opportunities now live in the Opportunities workspace and can be filtered by account."
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
      const customFields = await this.sanitizeCustomFields(client, actor.tenantId, "account", input.customFields);
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
            custom_fields,
            metadata,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $10)
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
          JSON.stringify(customFields),
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
      const customFields =
        input.customFields !== undefined
          ? await this.sanitizeCustomFields(client, actor.tenantId, "account", input.customFields, getMetadata(currentAccount.custom_fields))
          : getMetadata(currentAccount.custom_fields);

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
            custom_fields = $9::jsonb,
            metadata = $10::jsonb,
            updated_by = $11
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
          JSON.stringify(customFields),
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

    return this.databaseService.withClient(async (client) => {
      const fieldDefinitions = await this.loadFieldDefinitions(client, actor.tenantId, "account");
      const customFieldOptionsPromise = this.loadCustomFieldOptions(client, actor.tenantId, fieldDefinitions);
      const [owners, accountTypes, healthStatuses, customFieldOptions] = await Promise.all([
        this.loadOwners(client, actor.tenantId),
        this.loadOptionSetValues(client, actor.tenantId, "account-type"),
        this.loadOptionSetValues(client, actor.tenantId, "account-health"),
        customFieldOptionsPromise
      ]);

      return {
        owners,
        accountTypes,
        healthStatuses,
        fieldDefinitions,
        customFieldOptions
      };
    });
  }

  async addAccountNote(
    actor: ActorContext,
    audit: AuditMetadata,
    accountId: string,
    input: CreateCrmNoteRequestBody
  ): Promise<CrmNoteResponse> {
    this.assertEnabled();
    return this.createNote(actor, audit, "account", accountId, input);
  }

  async addAccountActivity(
    actor: ActorContext,
    audit: AuditMetadata,
    accountId: string,
    input: CreateCrmActivityRequestBody
  ): Promise<CrmActivityResponse> {
    this.assertEnabled();
    return this.createActivity(actor, audit, "account", accountId, input);
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
      activities: await this.loadEntityActivities(client, tenantId, "contact", contactId),
      tasks: await this.loadEntityTasks(client, tenantId, "contact", contactId),
      timeline: await this.loadEntityTimeline(client, tenantId, "contact", contactId)
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
    return this.createNote(actor, audit, "contact", contactId, input);
  }

  async addContactActivity(
    actor: ActorContext,
    audit: AuditMetadata,
    contactId: string,
    input: CreateCrmActivityRequestBody
  ): Promise<CrmActivityResponse> {
    this.assertEnabled();
    return this.createActivity(actor, audit, "contact", contactId, input);
  }
}
