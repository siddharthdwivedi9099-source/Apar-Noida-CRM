import type {
  AcceptOpportunityRequestBody,
  AccountLookupSummary,
  ContactRelationshipSummary,
  CreateOpportunityRequestBody,
  CrmLookupUserSummary,
  CrmMutationSuccessResponse,
  CrmOptionValueSummary,
  CrmPagination,
  AddOpportunityDealReviewRequestBody,
  CreateCoachingTaskRequestBody,
  LeadDiscoveryFieldDefinition,
  ManagerForecastResponse,
  ManagerPerformanceResponse,
  ManagerPipelineResponse,
  OpportunityAcceptanceState,
  OpportunityArchitectureSummary,
  OpportunityDealReviewEntry,
  SetOpportunityForecastRequestBody,
  OpportunityAiPlaceholderSummary,
  OpportunityCloseLostRequestBody,
  OpportunityCloseWonRequestBody,
  OpportunityDashboardResponse,
  OpportunityDemoFeedbackBody,
  OpportunityDemoRequestBody,
  OpportunityDemoState,
  OpportunityDetail,
  OpportunityDiscountRequestBody,
  OpportunityDiscountState,
  OpportunityDiscoveryUpdateBody,
  OpportunityExecWorkspace,
  OpportunityListQuery,
  OpportunityDealReviewState,
  OpportunityEnterpriseView,
  OpportunityNegotiationState,
  OpportunityNegotiationUpdateBody,
  OpportunityOptionsResponse,
  OpportunityPipelineScope,
  OpportunityRollupChild,
  OpportunityTenderChecklistItemDefinition,
  OpportunityTenderChecklistUpdateBody,
  OpportunityTenderState,
  OpportunityTenderView,
  SetOpportunityParentRequestBody,
  UpsertOpportunityDealReviewRequestBody,
  UpsertOpportunityTenderRequestBody,
  OpportunityProposalRequestBody,
  OpportunityProposalState,
  OpportunityReactivateRequestBody,
  OpportunityResponse,
  OpportunityStageDistributionItem,
  OpportunityStakeholderProfilesUpdateBody,
  OpportunityStakeholderSummary,
  OpportunitySummary,
  OpportunitiesResponse,
  RejectOpportunityRequestBody,
  RoleSummary,
  UpdateOpportunityRequestBody
} from "@crm/types";
import { evaluateBuyingCommitteeCompleteness, evaluateDiscovery } from "@crm/types";
import { deliveryRiskDimensions, evaluateTechnicalDiscovery, summarizeDeliveryRisk, technicalDiscoveryFieldKeys } from "@crm/types";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import { getPositiveNumber } from "../../common/pagination.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { CrmService } from "../crm/crm.service.js";
import { NotificationService } from "../notifications/notifications.service.js";
import { ApprovalService } from "../approvals/approvals.service.js";

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
  account_id: string | null;
  role_id: string | null;
  role_key: string | null;
  role_label: string | null;
  role_description: string | null;
  role_color: string | null;
  role_is_default: boolean | null;
  role_is_active: boolean | null;
}

interface OpportunityRecordRow {
  id: string;
  name: string;
  amount: string | number | null;
  probability: number | null;
  expected_close_date: string | null;
  competitor: string | null;
  next_step: string | null;
  win_loss_reason: string | null;
  custom_fields: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  last_stage_changed_at: Date;
  stakeholder_count: number;
  note_count: number;
  activity_count: number;
  last_activity_at: Date | null;
  account_id: string | null;
  account_name: string | null;
  account_website: string | null;
  primary_contact_id: string | null;
  primary_contact_first_name: string | null;
  primary_contact_last_name: string | null;
  primary_contact_email: string | null;
  primary_contact_role_id: string | null;
  primary_contact_role_key: string | null;
  primary_contact_role_label: string | null;
  primary_contact_role_description: string | null;
  primary_contact_role_color: string | null;
  primary_contact_role_is_default: boolean | null;
  primary_contact_role_is_active: boolean | null;
  owner_id: string | null;
  owner_display_name: string | null;
  owner_email: string | null;
  owner_team_name: string | null;
  owner_department_name: string | null;
  stage_id: string | null;
  stage_key: string | null;
  stage_label: string | null;
  stage_description: string | null;
  stage_color: string | null;
  stage_is_default: boolean | null;
  stage_is_active: boolean | null;
  source_id: string | null;
  source_key: string | null;
  source_label: string | null;
  source_description: string | null;
  source_color: string | null;
  source_is_default: boolean | null;
  source_is_active: boolean | null;
  outcome_status_id: string | null;
  outcome_status_key: string | null;
  outcome_status_label: string | null;
  outcome_status_description: string | null;
  outcome_status_color: string | null;
  outcome_status_is_default: boolean | null;
  outcome_status_is_active: boolean | null;
}

interface OpportunityStateRow {
  id: string;
  name: string;
  account_id: string | null;
  primary_contact_id: string | null;
  owner_id: string | null;
  stage_option_id: string;
  stage_key: string;
  stage_label: string;
  source_option_id: string;
  source_key: string;
  outcome_status_option_id: string;
  outcome_status_key: string;
  outcome_status_label: string;
  amount: string | number | null;
  probability: number | null;
  expected_close_date: string | null;
  competitor: string | null;
  next_step: string | null;
  win_loss_reason: string | null;
  custom_fields: Record<string, unknown> | null;
  last_stage_changed_at: Date;
  metadata: Record<string, unknown> | null;
}

interface StakeholderRow {
  opportunity_id: string;
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

interface ActorTeamRow {
  team_id: string | null;
}

interface OpportunityCountRow {
  total: number;
}

interface OpportunityMetricRow {
  visible_count: number;
  pipeline_value: string | number;
  closing_this_month_count: number;
  closing_this_month_value: string | number;
  stalled_deals_count: number;
  stalled_deals_value: string | number;
}

interface StageDistributionRow {
  stage_id: string | null;
  stage_key: string | null;
  stage_label: string | null;
  stage_description: string | null;
  stage_color: string | null;
  stage_is_default: boolean | null;
  stage_is_active: boolean | null;
  opportunity_count: number;
  total_amount: string | number;
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

// ---- Persona 9 (AE) metadata helpers -----------------------------------------------------------

function metaString(value: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

function metaNumber(value: Record<string, unknown> | null | undefined, key: string): number | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

// Root for all AE workspace state stored under opportunity metadata.
function getSalesExecRoot(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return getRecord(getMetadata(metadata).salesExec);
}

function readAcceptance(root: Record<string, unknown>): OpportunityAcceptanceState {
  const source = getRecord(root.acceptance);
  const status = source.status === "accepted" ? "accepted" : source.status === "rejected" ? "rejected" : "pending";
  return {
    status,
    acceptedAt: metaString(source, "acceptedAt"),
    rejectedReason: metaString(source, "rejectedReason"),
    slaStartedAt: metaString(source, "slaStartedAt")
  };
}

function readNegotiation(root: Record<string, unknown>): OpportunityNegotiationState {
  const source = getRecord(root.negotiation);
  return {
    commercialAsks: metaString(source, "commercialAsks"),
    legalAsks: metaString(source, "legalAsks"),
    procurementBlockers: metaString(source, "procurementBlockers"),
    competitorOffers: metaString(source, "competitorOffers"),
    finalPrice: metaNumber(source, "finalPrice"),
    nextAction: metaString(source, "nextAction"),
    updatedAt: metaString(source, "updatedAt")
  };
}

// ---- Persona 10 (Enterprise Sales) metadata helpers --------------------------------------------

// Deals at or above this value require a governance review before final negotiation (ES-005).
const DEFAULT_DEAL_REVIEW_THRESHOLD = 100_000;

function getEnterpriseRoot(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return getRecord(getMetadata(metadata).enterprise);
}

function readTenderState(root: Record<string, unknown>): OpportunityTenderState | null {
  const source = getRecord(root.tender);
  if (Object.keys(source).length === 0) {
    return null;
  }
  const checklistRaw = getRecord(source.checklist);
  const checklist: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(checklistRaw)) {
    checklist[key] = value === true;
  }
  return {
    tenderNumber: metaString(source, "tenderNumber"),
    issuingAuthority: metaString(source, "issuingAuthority"),
    deadline: metaString(source, "deadline"),
    eligibility: metaString(source, "eligibility"),
    scope: metaString(source, "scope"),
    preBidDate: metaString(source, "preBidDate"),
    emd: metaString(source, "emd"),
    commercialFormat: metaString(source, "commercialFormat"),
    checklist,
    tasksGenerated: source.tasksGenerated === true,
    updatedAt: metaString(source, "updatedAt")
  };
}

function readDealReview(root: Record<string, unknown>): OpportunityDealReviewState {
  const source = getRecord(root.dealReview);
  return {
    solutionFit: metaString(source, "solutionFit"),
    pricing: metaString(source, "pricing"),
    legal: metaString(source, "legal"),
    risk: metaString(source, "risk"),
    deliveryReadiness: metaString(source, "deliveryReadiness"),
    leadershipSupport: metaString(source, "leadershipSupport"),
    status: (["draft", "pending_approval", "approved"].includes(String(source.status))
      ? source.status
      : "draft") as OpportunityDealReviewState["status"],
    approvalId: metaString(source, "approvalId"),
    updatedAt: metaString(source, "updatedAt")
  };
}

// A deal review is "complete" once every scorecard dimension is captured.
function isDealReviewComplete(review: OpportunityDealReviewState): boolean {
  return Boolean(
    review.solutionFit &&
      review.pricing &&
      review.legal &&
      review.risk &&
      review.deliveryReadiness &&
      review.leadershipSupport
  );
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

function toNullableNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const parsedValue = Number.parseFloat(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
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

function mapAccount(input: {
  id: string | null;
  name: string | null;
  website: string | null;
}): AccountLookupSummary | null {
  if (!input.id || !input.name) {
    return null;
  }

  return {
    id: input.id,
    name: input.name,
    website: input.website
  };
}

function mapContact(input: {
  id: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  roleId: string | null;
  roleKey: string | null;
  roleLabel: string | null;
  roleDescription: string | null;
  roleColor: string | null;
  roleIsDefault: boolean | null;
  roleIsActive: boolean | null;
}): ContactRelationshipSummary | null {
  if (!input.id || !input.firstName || !input.lastName) {
    return null;
  }

  return {
    id: input.id,
    fullName: `${input.firstName} ${input.lastName}`.trim(),
    email: input.email,
    role: mapOptionValue({
      id: input.roleId,
      key: input.roleKey,
      label: input.roleLabel,
      description: input.roleDescription,
      color: input.roleColor,
      isDefault: input.roleIsDefault,
      isActive: input.roleIsActive
    })
  };
}

function normalizeUniqueIds(values: string[] | null | undefined) {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    )
  );
}

function resolveOutcomeStatusKey(stageKey: string, requestedOutcomeStatusKey: string | null | undefined) {
  if (stageKey === "closed_won") {
    return requestedOutcomeStatusKey === null ? "won" : requestedOutcomeStatusKey ?? "won";
  }

  if (stageKey === "closed_lost") {
    return requestedOutcomeStatusKey === null ? "lost" : requestedOutcomeStatusKey ?? "lost";
  }

  return requestedOutcomeStatusKey ?? "open";
}

function assertStageAndOutcomeConsistency(stageKey: string, outcomeStatusKey: string) {
  if (stageKey === "closed_won" && outcomeStatusKey !== "won") {
    throw new AppError(
      400,
      "Closed Won opportunities must use a won outcome status.",
      undefined,
      "INVALID_OUTCOME_STATUS"
    );
  }

  if (stageKey === "closed_lost" && outcomeStatusKey !== "lost") {
    throw new AppError(
      400,
      "Closed Lost opportunities must use a lost outcome status.",
      undefined,
      "INVALID_OUTCOME_STATUS"
    );
  }

  if (stageKey !== "closed_won" && stageKey !== "closed_lost" && outcomeStatusKey !== "open") {
    throw new AppError(
      400,
      "Open pipeline stages must use the open outcome status.",
      undefined,
      "INVALID_OUTCOME_STATUS"
    );
  }
}

function getDateOnlyString(value: string | null) {
  return value ?? null;
}

export class OpportunityService {
  private readonly crmService: CrmService;
  private readonly notificationService: NotificationService;
  private readonly approvalService: ApprovalService;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {
    this.crmService = new CrmService(databaseService, config);
    this.notificationService = new NotificationService(databaseService, config);
    this.approvalService = new ApprovalService(databaseService, config);
  }

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(
        503,
        "Opportunity management is unavailable until the database connection is enabled.",
        undefined,
        "OPPORTUNITY_UNAVAILABLE"
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

  private async loadAccountsLookup(client: PoolClient, tenantId: string) {
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

  private async loadContactsLookup(client: PoolClient, tenantId: string) {
    const result = await client.query<ContactLookupRow>(
      `
        SELECT
          contacts.id,
          contacts.first_name,
          contacts.last_name,
          contacts.email,
          contacts.account_id,
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

    return result.rows
      .map((row) =>
        mapContact({
          id: row.id,
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email,
          roleId: row.role_id,
          roleKey: row.role_key,
          roleLabel: row.role_label,
          roleDescription: row.role_description,
          roleColor: row.role_color,
          roleIsDefault: row.role_is_default,
          roleIsActive: row.role_is_active
        })
      )
      .filter((contact): contact is ContactRelationshipSummary => Boolean(contact));
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
    const result = await client.query<ActorTeamRow>(
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

  private getSharedScopePermissions(actor: ActorContext) {
    return (
      actor.permissionCodes.includes("opportunities.assign") ||
      actor.permissionCodes.includes("opportunities.configure") ||
      actor.permissionCodes.includes("opportunities.view_dashboard") ||
      actor.permissionCodes.includes("opportunities.manage_workflow") ||
      actor.permissionCodes.includes("sales.view_dashboard") ||
      actor.permissionCodes.includes("dashboards.view_dashboard")
    );
  }

  private async getAvailableScopes(client: PoolClient, actor: ActorContext): Promise<OpportunityPipelineScope[]> {
    const canInspectSharedPipeline = this.getSharedScopePermissions(actor);

    if (!canInspectSharedPipeline) {
      return ["mine"];
    }

    const actorTeamId = await this.getActorTeamId(client, actor.tenantId, actor.userId);

    return actorTeamId ? ["mine", "team", "all"] : ["mine", "all"];
  }

  private async assertScopeAllowed(
    client: PoolClient,
    actor: ActorContext,
    requestedScope: OpportunityPipelineScope | undefined
  ) {
    const availableScopes = await this.getAvailableScopes(client, actor);
    const effectiveScope = requestedScope ?? (availableScopes.includes("all") ? "all" : "mine");

    if (!availableScopes.includes(effectiveScope)) {
      throw new AppError(
        403,
        "You do not have permission to inspect this pipeline scope.",
        undefined,
        "AUTHORIZATION_ERROR"
      );
    }

    return effectiveScope;
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

  private async ensureContactId(
    client: PoolClient,
    tenantId: string,
    contactId: string | null | undefined,
    accountId: string | null
  ) {
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

  private async ensureStakeholderContactIds(
    client: PoolClient,
    tenantId: string,
    stakeholderContactIds: string[] | null | undefined,
    accountId: string | null
  ) {
    const normalizedStakeholderIds = normalizeUniqueIds(stakeholderContactIds);

    if (normalizedStakeholderIds.length === 0) {
      return [];
    }

    const result = await client.query<{ id: string; account_id: string | null }>(
      `
        SELECT id, account_id
        FROM contacts
        WHERE tenant_id = $1
          AND id = ANY($2::uuid[])
          AND deleted_at IS NULL
      `,
      [tenantId, normalizedStakeholderIds]
    );

    if (result.rows.length !== normalizedStakeholderIds.length) {
      throw new AppError(400, "One or more stakeholders are invalid for this tenant.", undefined, "INVALID_CONTACT");
    }

    for (const row of result.rows) {
      if (accountId && row.account_id && row.account_id !== accountId) {
        throw new AppError(
          400,
          "Every stakeholder must belong to the chosen account when the account is set.",
          undefined,
          "INVALID_CONTACT_ACCOUNT_RELATION"
        );
      }
    }

    return normalizedStakeholderIds;
  }

  private assertOpportunityMutation(actor: ActorContext, keys: string[]) {
    if (keys.length === 0) {
      throw new AppError(400, "At least one field must be updated.", undefined, "VALIDATION_ERROR");
    }

    const canEdit = actor.permissionCodes.includes("opportunities.edit");
    const canConfigure = actor.permissionCodes.includes("opportunities.configure");
    const canAssign = actor.permissionCodes.includes("opportunities.assign");
    const canApprove = actor.permissionCodes.includes("opportunities.approve");
    const canManageWorkflow = actor.permissionCodes.includes("opportunities.manage_workflow");
    const assignOnlyKeys = new Set(["ownerId"]);
    const stageOnlyKeys = new Set(["stageKey", "outcomeStatusKey", "outcomeReason", "probability", "expectedCloseDate", "nextStep"]);
    const isAssignOnlyMutation = keys.every((key) => assignOnlyKeys.has(key));
    const isStageOnlyMutation = keys.every((key) => stageOnlyKeys.has(key));

    if (
      !canEdit &&
      !canConfigure &&
      !(canAssign && isAssignOnlyMutation) &&
      !((canApprove || canManageWorkflow) && isStageOnlyMutation)
    ) {
      throw new AppError(
        403,
        "You do not have permission to update these opportunity fields.",
        undefined,
        "AUTHORIZATION_ERROR"
      );
    }
  }

  private async getOpportunityState(client: PoolClient, tenantId: string, opportunityId: string) {
    const result = await client.query<OpportunityStateRow>(
      `
        SELECT
          opportunities.id,
          opportunities.name,
          opportunities.account_id,
          opportunities.primary_contact_id,
          opportunities.owner_id,
          opportunities.stage_option_id,
          stage_values.value_key AS stage_key,
          stage_values.label AS stage_label,
          opportunities.source_option_id,
          source_values.value_key AS source_key,
          opportunities.outcome_status_option_id,
          outcome_values.value_key AS outcome_status_key,
          outcome_values.label AS outcome_status_label,
          opportunities.amount,
          opportunities.probability,
          opportunities.expected_close_date,
          opportunities.competitor,
          opportunities.next_step,
          opportunities.win_loss_reason,
          opportunities.custom_fields,
          opportunities.last_stage_changed_at,
          opportunities.metadata
        FROM opportunities
        INNER JOIN tenant_option_values AS stage_values
          ON stage_values.id = opportunities.stage_option_id
         AND stage_values.tenant_id = opportunities.tenant_id
        INNER JOIN tenant_option_values AS source_values
          ON source_values.id = opportunities.source_option_id
         AND source_values.tenant_id = opportunities.tenant_id
        INNER JOIN tenant_option_values AS outcome_values
          ON outcome_values.id = opportunities.outcome_status_option_id
         AND outcome_values.tenant_id = opportunities.tenant_id
        WHERE opportunities.id = $1
          AND opportunities.tenant_id = $2
          AND opportunities.deleted_at IS NULL
        LIMIT 1
      `,
      [opportunityId, tenantId]
    );

    const opportunity = result.rows[0] ?? null;

    if (!opportunity) {
      throw new AppError(404, "Opportunity not found.", undefined, "OPPORTUNITY_NOT_FOUND");
    }

    return opportunity;
  }

  private async loadStakeholderContactIds(client: PoolClient, tenantId: string, opportunityId: string) {
    const result = await client.query<{ contact_id: string }>(
      `
        SELECT contact_id
        FROM opportunity_stakeholders
        WHERE tenant_id = $1
          AND opportunity_id = $2
          AND deleted_at IS NULL
        ORDER BY created_at ASC
      `,
      [tenantId, opportunityId]
    );

    return result.rows.map((row) => row.contact_id);
  }

  private async loadStakeholdersForOpportunities(client: PoolClient, tenantId: string, opportunityIds: string[]) {
    const stakeholdersByOpportunityId = new Map<string, ContactRelationshipSummary[]>();

    if (opportunityIds.length === 0) {
      return stakeholdersByOpportunityId;
    }

    const result = await client.query<StakeholderRow>(
      `
        SELECT
          opportunity_stakeholders.opportunity_id,
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
        FROM opportunity_stakeholders
        INNER JOIN contacts
          ON contacts.id = opportunity_stakeholders.contact_id
         AND contacts.tenant_id = opportunity_stakeholders.tenant_id
         AND contacts.deleted_at IS NULL
        LEFT JOIN tenant_option_values AS role_values
          ON role_values.id = contacts.role_option_id
         AND role_values.tenant_id = contacts.tenant_id
        WHERE opportunity_stakeholders.tenant_id = $1
          AND opportunity_stakeholders.opportunity_id = ANY($2::uuid[])
          AND opportunity_stakeholders.deleted_at IS NULL
        ORDER BY contacts.first_name ASC, contacts.last_name ASC
      `,
      [tenantId, opportunityIds]
    );

    for (const row of result.rows) {
      const existing = stakeholdersByOpportunityId.get(row.opportunity_id) ?? [];
      const contact = mapContact({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        roleId: row.role_id,
        roleKey: row.role_key,
        roleLabel: row.role_label,
        roleDescription: row.role_description,
        roleColor: row.role_color,
        roleIsDefault: row.role_is_default,
        roleIsActive: row.role_is_active
      });

      if (contact) {
        existing.push(contact);
        stakeholdersByOpportunityId.set(row.opportunity_id, existing);
      }
    }

    return stakeholdersByOpportunityId;
  }

  private async syncStakeholders(
    client: PoolClient,
    actor: ActorContext,
    opportunityId: string,
    stakeholderContactIds: string[]
  ) {
    if (stakeholderContactIds.length === 0) {
      await client.query(
        `
          UPDATE opportunity_stakeholders
          SET
            deleted_at = NOW(),
            updated_by = $3
          WHERE tenant_id = $1
            AND opportunity_id = $2
            AND deleted_at IS NULL
        `,
        [actor.tenantId, opportunityId, actor.userId]
      );
      return;
    }

    await client.query(
      `
        UPDATE opportunity_stakeholders
        SET
          deleted_at = NOW(),
          updated_by = $4
        WHERE tenant_id = $1
          AND opportunity_id = $2
          AND deleted_at IS NULL
          AND contact_id <> ALL($3::uuid[])
      `,
      [actor.tenantId, opportunityId, stakeholderContactIds, actor.userId]
    );

    await client.query(
      `
        UPDATE opportunity_stakeholders
        SET
          deleted_at = NULL,
          updated_by = $4
        WHERE id IN (
          SELECT DISTINCT ON (contact_id) id
          FROM opportunity_stakeholders
          WHERE tenant_id = $1
            AND opportunity_id = $2
            AND contact_id = ANY($3::uuid[])
            AND deleted_at IS NOT NULL
          ORDER BY contact_id, updated_at DESC
        )
      `,
      [actor.tenantId, opportunityId, stakeholderContactIds, actor.userId]
    );

    await client.query(
      `
        INSERT INTO opportunity_stakeholders (
          tenant_id,
          opportunity_id,
          contact_id,
          metadata,
          created_by,
          updated_by
        )
        SELECT
          $1,
          $2,
          stakeholder_contact_id,
          '{}'::jsonb,
          $4,
          $4
        FROM unnest($3::uuid[]) AS stakeholder_contact_id
        WHERE NOT EXISTS (
          SELECT 1
          FROM opportunity_stakeholders
          WHERE tenant_id = $1
            AND opportunity_id = $2
            AND contact_id = stakeholder_contact_id
        )
      `,
      [actor.tenantId, opportunityId, stakeholderContactIds, actor.userId]
    );
  }

  private async recordStageChangeActivity(
    client: PoolClient,
    actor: ActorContext,
    opportunityId: string,
    fromStageLabel: string | null,
    toStageLabel: string | null,
    input: {
      outcomeStatusLabel: string | null;
      nextStep: string | null;
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
        VALUES ($1, 'opportunity', $2, 'status_change', $3, $4, NOW(), $5, $6, $5, $7::jsonb, $5, $5)
      `,
      [
        actor.tenantId,
        opportunityId,
        `Stage moved to ${toStageLabel ?? "Updated stage"}`,
        getTrimmedNullableString(
          [fromStageLabel ? `From ${fromStageLabel}` : null, input.nextStep ? `Next step: ${input.nextStep}` : null]
            .filter(Boolean)
            .join(" | ")
        ),
        actor.userId,
        input.outcomeStatusLabel,
        JSON.stringify({
          fromStageLabel,
          toStageLabel,
          outcomeStatusLabel: input.outcomeStatusLabel,
          nextStep: input.nextStep
        })
      ]
    );
  }

  private buildAiPlaceholders(actor: ActorContext): OpportunityAiPlaceholderSummary {
    const permissionCodes = new Set(actor.permissionCodes);
    const canUseAi =
      permissionCodes.has("opportunities.use_ai") ||
      permissionCodes.has("opportunities.manage_ai") ||
      permissionCodes.has("ai.use_ai") ||
      permissionCodes.has("ai.manage_ai");
    const canManageAi = permissionCodes.has("opportunities.manage_ai") || permissionCodes.has("ai.manage_ai");

    return {
      actions: canUseAi
        ? [
            {
              key: "opportunity_summary",
              label: "Opportunity summary",
              description: "Placeholder entry point for future deal briefs generated from stage, value, and stakeholder context."
            },
            {
              key: "deal_risk",
              label: "Deal risk",
              description: "Placeholder entry point for future risk scoring using stage movement, activity gaps, and relationship coverage."
            },
            {
              key: "next_best_action",
              label: "Next best action",
              description: "Placeholder entry point for future stage-aware follow-up recommendations."
            },
            {
              key: "proposal_draft",
              label: "Proposal draft",
              description: "Placeholder entry point for future commercial draft generation using opportunity context."
            },
            {
              key: "win_probability",
              label: "Win probability",
              description: "Placeholder entry point for future AI-assisted win likelihood projections."
            },
            {
              key: "discovery_summary",
              label: "Discovery summary",
              description: "Placeholder entry point for future AI summaries of captured discovery."
            },
            {
              key: "engagement_strategy",
              label: "Engagement strategy",
              description: "Placeholder entry point for future AI stakeholder engagement recommendations."
            },
            {
              key: "negotiation_risk",
              label: "Negotiation risk",
              description: "Placeholder entry point for future AI risk detection across negotiation points."
            },
            {
              key: "lessons_learned",
              label: "Lessons learned",
              description: "Placeholder entry point for future AI loss-analysis summaries."
            }
          ]
        : [],
      governanceHint: canManageAi
        ? "AI placeholders are visible and will later connect to the governed AI Gateway with sales-specific controls."
        : canUseAi
          ? "AI placeholders are visible for this role, but execution remains deferred until the AI Gateway phase."
          : "AI placeholders remain hidden until the role includes opportunity or global AI usage permissions."
    };
  }

  private mapOpportunity(row: OpportunityRecordRow): OpportunitySummary {
    return {
      id: row.id,
      name: row.name,
      account: mapAccount({
        id: row.account_id,
        name: row.account_name,
        website: row.account_website
      }),
      primaryContact: mapContact({
        id: row.primary_contact_id,
        firstName: row.primary_contact_first_name,
        lastName: row.primary_contact_last_name,
        email: row.primary_contact_email,
        roleId: row.primary_contact_role_id,
        roleKey: row.primary_contact_role_key,
        roleLabel: row.primary_contact_role_label,
        roleDescription: row.primary_contact_role_description,
        roleColor: row.primary_contact_role_color,
        roleIsDefault: row.primary_contact_role_is_default,
        roleIsActive: row.primary_contact_role_is_active
      }),
      owner: mapUser({
        id: row.owner_id,
        displayName: row.owner_display_name,
        email: row.owner_email,
        teamName: row.owner_team_name,
        departmentName: row.owner_department_name
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
      source: mapOptionValue({
        id: row.source_id,
        key: row.source_key,
        label: row.source_label,
        description: row.source_description,
        color: row.source_color,
        isDefault: row.source_is_default,
        isActive: row.source_is_active
      }),
      outcomeStatus: mapOptionValue({
        id: row.outcome_status_id,
        key: row.outcome_status_key,
        label: row.outcome_status_label,
        description: row.outcome_status_description,
        color: row.outcome_status_color,
        isDefault: row.outcome_status_is_default,
        isActive: row.outcome_status_is_active
      }),
      amount: toNullableNumber(row.amount),
      probability: row.probability,
      expectedCloseDate: getDateOnlyString(row.expected_close_date),
      competitor: row.competitor,
      nextStep: row.next_step,
      winLossReason: row.win_loss_reason,
      stakeholderCount: row.stakeholder_count,
      noteCount: row.note_count,
      activityCount: row.activity_count,
      lastActivityAt: toIsoString(row.last_activity_at),
      lastStageChangedAt: toIsoString(row.last_stage_changed_at),
      metadata: getMetadata(row.metadata),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private async buildOpportunityWhereContext(
    client: PoolClient,
    actor: ActorContext,
    query: OpportunityListQuery
  ) {
    const effectiveScope = await this.assertScopeAllowed(client, actor, query.scope);
    const conditions = ["opportunities.tenant_id = $1", "opportunities.deleted_at IS NULL"];
    const params: unknown[] = [actor.tenantId];

    if (effectiveScope === "mine") {
      params.push(actor.userId);
      conditions.push(`opportunities.owner_id = $${params.length}`);
    } else if (effectiveScope === "team") {
      const actorTeamId = await this.getActorTeamId(client, actor.tenantId, actor.userId);

      if (!actorTeamId) {
        throw new AppError(
          403,
          "Team pipeline access requires the current user to belong to a team.",
          undefined,
          "AUTHORIZATION_ERROR"
        );
      }

      params.push(actorTeamId);
      conditions.push(`owner_users.team_id = $${params.length}`);
    }

    if (query.search?.trim()) {
      params.push(`%${query.search.trim()}%`);
      const searchIndex = params.length;
      conditions.push(
        `(opportunities.name ILIKE $${searchIndex} OR COALESCE(accounts.name, '') ILIKE $${searchIndex} OR COALESCE(primary_contacts.first_name || ' ' || primary_contacts.last_name, '') ILIKE $${searchIndex} OR COALESCE(opportunities.competitor, '') ILIKE $${searchIndex} OR COALESCE(opportunities.next_step, '') ILIKE $${searchIndex})`
      );
    }

    if (query.stage) {
      params.push(query.stage.trim());
      conditions.push(`stage_values.value_key = $${params.length}`);
    }

    if (query.source) {
      params.push(query.source.trim());
      conditions.push(`source_values.value_key = $${params.length}`);
    }

    if (query.outcomeStatus) {
      params.push(query.outcomeStatus.trim());
      conditions.push(`outcome_values.value_key = $${params.length}`);
    }

    if (query.ownerId) {
      params.push(query.ownerId);
      conditions.push(`opportunities.owner_id = $${params.length}`);
    }

    if (query.accountId) {
      params.push(query.accountId);
      conditions.push(`opportunities.account_id = $${params.length}`);
    }

    if (query.contactId) {
      params.push(query.contactId);
      conditions.push(
        `(
          opportunities.primary_contact_id = $${params.length}
          OR EXISTS (
            SELECT 1
            FROM opportunity_stakeholders AS stakeholder_filters
            WHERE stakeholder_filters.tenant_id = opportunities.tenant_id
              AND stakeholder_filters.opportunity_id = opportunities.id
              AND stakeholder_filters.contact_id = $${params.length}
              AND stakeholder_filters.deleted_at IS NULL
          )
        )`
      );
    }

    if (query.expectedCloseFrom) {
      params.push(query.expectedCloseFrom);
      conditions.push(`opportunities.expected_close_date >= $${params.length}::date`);
    }

    if (query.expectedCloseTo) {
      params.push(query.expectedCloseTo);
      conditions.push(`opportunities.expected_close_date <= $${params.length}::date`);
    }

    return {
      whereClause: conditions.join(" AND "),
      params,
      effectiveScope
    };
  }

  private async loadOpportunityDetailCore(client: PoolClient, actor: ActorContext, opportunityId: string) {
    const result = await client.query<OpportunityRecordRow>(
      `
        SELECT
          opportunities.id,
          opportunities.name,
          opportunities.amount,
          opportunities.probability,
          opportunities.expected_close_date,
          opportunities.competitor,
          opportunities.next_step,
          opportunities.win_loss_reason,
          opportunities.custom_fields,
          opportunities.metadata,
          opportunities.created_at,
          opportunities.updated_at,
          opportunities.last_stage_changed_at,
          COALESCE(stakeholder_counts.stakeholder_count, 0)::int AS stakeholder_count,
          COALESCE(note_counts.note_count, 0)::int AS note_count,
          COALESCE(activity_counts.activity_count, 0)::int AS activity_count,
          activity_counts.last_activity_at,
          accounts.id AS account_id,
          accounts.name AS account_name,
          accounts.website AS account_website,
          primary_contacts.id AS primary_contact_id,
          primary_contacts.first_name AS primary_contact_first_name,
          primary_contacts.last_name AS primary_contact_last_name,
          primary_contacts.email AS primary_contact_email,
          primary_contact_role_values.id AS primary_contact_role_id,
          primary_contact_role_values.value_key AS primary_contact_role_key,
          primary_contact_role_values.label AS primary_contact_role_label,
          primary_contact_role_values.description AS primary_contact_role_description,
          primary_contact_role_values.color AS primary_contact_role_color,
          primary_contact_role_values.is_default AS primary_contact_role_is_default,
          primary_contact_role_values.is_active AS primary_contact_role_is_active,
          owner_users.id AS owner_id,
          owner_users.display_name AS owner_display_name,
          owner_users.email AS owner_email,
          owner_teams.name AS owner_team_name,
          owner_departments.name AS owner_department_name,
          stage_values.id AS stage_id,
          stage_values.value_key AS stage_key,
          stage_values.label AS stage_label,
          stage_values.description AS stage_description,
          stage_values.color AS stage_color,
          stage_values.is_default AS stage_is_default,
          stage_values.is_active AS stage_is_active,
          source_values.id AS source_id,
          source_values.value_key AS source_key,
          source_values.label AS source_label,
          source_values.description AS source_description,
          source_values.color AS source_color,
          source_values.is_default AS source_is_default,
          source_values.is_active AS source_is_active,
          outcome_values.id AS outcome_status_id,
          outcome_values.value_key AS outcome_status_key,
          outcome_values.label AS outcome_status_label,
          outcome_values.description AS outcome_status_description,
          outcome_values.color AS outcome_status_color,
          outcome_values.is_default AS outcome_status_is_default,
          outcome_values.is_active AS outcome_status_is_active
        FROM opportunities
        INNER JOIN tenant_option_values AS stage_values
          ON stage_values.id = opportunities.stage_option_id
         AND stage_values.tenant_id = opportunities.tenant_id
        INNER JOIN tenant_option_values AS source_values
          ON source_values.id = opportunities.source_option_id
         AND source_values.tenant_id = opportunities.tenant_id
        INNER JOIN tenant_option_values AS outcome_values
          ON outcome_values.id = opportunities.outcome_status_option_id
         AND outcome_values.tenant_id = opportunities.tenant_id
        LEFT JOIN accounts
          ON accounts.id = opportunities.account_id
         AND accounts.tenant_id = opportunities.tenant_id
         AND accounts.deleted_at IS NULL
        LEFT JOIN contacts AS primary_contacts
          ON primary_contacts.id = opportunities.primary_contact_id
         AND primary_contacts.tenant_id = opportunities.tenant_id
         AND primary_contacts.deleted_at IS NULL
        LEFT JOIN tenant_option_values AS primary_contact_role_values
          ON primary_contact_role_values.id = primary_contacts.role_option_id
         AND primary_contact_role_values.tenant_id = primary_contacts.tenant_id
        LEFT JOIN users AS owner_users
          ON owner_users.id = opportunities.owner_id
         AND owner_users.tenant_id = opportunities.tenant_id
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
          SELECT opportunity_id, COUNT(*)::int AS stakeholder_count
          FROM opportunity_stakeholders
          WHERE tenant_id = $1
            AND deleted_at IS NULL
          GROUP BY opportunity_id
        ) AS stakeholder_counts
          ON stakeholder_counts.opportunity_id = opportunities.id
        LEFT JOIN (
          SELECT entity_id, COUNT(*)::int AS note_count
          FROM crm_notes
          WHERE tenant_id = $1
            AND entity_type = 'opportunity'
            AND deleted_at IS NULL
          GROUP BY entity_id
        ) AS note_counts
          ON note_counts.entity_id = opportunities.id
        LEFT JOIN (
          SELECT
            entity_id,
            COUNT(*)::int AS activity_count,
            MAX(occurred_at) AS last_activity_at
          FROM crm_activities
          WHERE tenant_id = $1
            AND entity_type = 'opportunity'
            AND deleted_at IS NULL
          GROUP BY entity_id
        ) AS activity_counts
          ON activity_counts.entity_id = opportunities.id
        WHERE opportunities.tenant_id = $1
          AND opportunities.id = $2
          AND opportunities.deleted_at IS NULL
        LIMIT 1
      `,
      [actor.tenantId, opportunityId]
    );

    const row = result.rows[0] ?? null;

    if (!row) {
      throw new AppError(404, "Opportunity not found.", undefined, "OPPORTUNITY_NOT_FOUND");
    }

    return row;
  }

  // ---- Persona 9 (AE) helpers ------------------------------------------------------------------

  private async loadOptionValueMetaRows(client: PoolClient, tenantId: string, setKey: string) {
    const result = await client.query<{ key: string; label: string; description: string | null; sort_order: number; metadata: Record<string, unknown> | null }>(
      `
        SELECT
          tenant_option_values.value_key AS key,
          tenant_option_values.label,
          tenant_option_values.description,
          tenant_option_values.sort_order,
          tenant_option_values.metadata
        FROM tenant_option_sets
        INNER JOIN tenant_option_values
          ON tenant_option_values.option_set_id = tenant_option_sets.id
         AND tenant_option_values.tenant_id = tenant_option_sets.tenant_id
        WHERE tenant_option_sets.tenant_id = $1
          AND tenant_option_sets.set_key = $2
          AND tenant_option_sets.deleted_at IS NULL
          AND tenant_option_values.deleted_at IS NULL
          AND tenant_option_values.is_active = true
        ORDER BY tenant_option_values.sort_order ASC, tenant_option_values.label ASC
      `,
      [tenantId, setKey]
    );
    return result.rows;
  }

  private async loadAeConfig(client: PoolClient, tenantId: string) {
    const discoveryRows = await this.loadOptionValueMetaRows(client, tenantId, "opportunity-discovery-field");
    const discoveryFields: LeadDiscoveryFieldDefinition[] = discoveryRows.map((row) => ({
      key: row.key,
      label: row.label,
      description: row.description,
      required: (row.metadata as Record<string, unknown> | null)?.required === true,
      sortOrder: row.sort_order
    }));
    const criticalDiscoveryKeys = discoveryRows
      .filter((row) => (row.metadata as Record<string, unknown> | null)?.critical === true)
      .map((row) => row.key);
    const stakeholderRoles = await this.loadOptionSetValues(client, tenantId, "opportunity-stakeholder-role");
    const proposalTemplates = await this.loadOptionSetValues(client, tenantId, "opportunity-proposal-template");
    const lossReasons = await this.loadOptionSetValues(client, tenantId, "loss-reason");
    // Stage -> required field tokens (configurable via opportunity-pipeline option metadata).
    const stageRows = await this.loadOptionValueMetaRows(client, tenantId, "opportunity-pipeline");
    const stageRequirements = new Map<string, string[]>();
    for (const row of stageRows) {
      const raw = (row.metadata as Record<string, unknown> | null)?.requiredFields;
      if (Array.isArray(raw)) {
        stageRequirements.set(row.key, raw.filter((value): value is string => typeof value === "string"));
      }
    }
    return { discoveryFields, criticalDiscoveryKeys, stakeholderRoles, proposalTemplates, lossReasons, stageRequirements };
  }

  private computeMissingStageFields(
    requiredFields: string[],
    context: {
      amount: number | null;
      expectedCloseDate: string | null;
      primaryContactId: string | null;
      stakeholderCount: number;
      criticalDiscoverySatisfied: boolean;
    }
  ): string[] {
    const missing: string[] = [];
    for (const field of requiredFields) {
      if (field === "amount" && (context.amount === null || context.amount <= 0)) missing.push("amount");
      else if (field === "expectedCloseDate" && !context.expectedCloseDate) missing.push("expectedCloseDate");
      else if (field === "primaryContact" && !context.primaryContactId) missing.push("primaryContact");
      else if (field === "stakeholders" && context.stakeholderCount <= 0) missing.push("stakeholders");
      else if (field === "criticalDiscovery" && !context.criticalDiscoverySatisfied) missing.push("criticalDiscovery");
    }
    return missing;
  }

  private mapStakeholdersWithProfiles(
    contacts: ContactRelationshipSummary[],
    root: Record<string, unknown>,
    stakeholderRoles: CrmOptionValueSummary[]
  ): OpportunityStakeholderSummary[] {
    const profiles = getRecord(root.stakeholderProfiles);
    const roleMap = new Map(stakeholderRoles.map((role) => [role.key, role.label]));
    return contacts.map((contact) => {
      const profile = getRecord(profiles[contact.id]);
      const roleKey = metaString(profile, "roleKey");
      const influence = profile.influence;
      const sentiment = profile.sentiment;
      const relationship = profile.relationship;
      return {
        ...contact,
        roleKey,
        roleLabel: roleKey ? roleMap.get(roleKey) ?? null : null,
        influence:
          influence === "low" || influence === "medium" || influence === "high" || influence === "champion" || influence === "blocker"
            ? influence
            : null,
        sentiment: sentiment === "positive" || sentiment === "neutral" || sentiment === "negative" ? sentiment : null,
        relationship:
          relationship === "none" || relationship === "developing" || relationship === "engaged" || relationship === "strong"
            ? relationship
            : null
      } satisfies OpportunityStakeholderSummary;
    });
  }

  private buildExecWorkspace(
    row: OpportunityRecordRow,
    stakeholders: OpportunityStakeholderSummary[],
    config: Awaited<ReturnType<OpportunityService["loadAeConfig"]>>
  ): OpportunityExecWorkspace {
    const root = getSalesExecRoot(row.metadata);
    const discovery = evaluateDiscovery(config.discoveryFields, getRecord(root.discovery) as Record<string, string>);
    const buyingCommittee = evaluateBuyingCommitteeCompleteness(
      config.stakeholderRoles,
      stakeholders.map((stakeholder) => stakeholder.roleKey)
    );
    const criticalDiscoverySatisfied = config.criticalDiscoveryKeys.every((key) =>
      discovery.items.some((item) => item.key === key && item.completed)
    );
    const stageKey = row.stage_key ?? "";
    const requiredFields = config.stageRequirements.get(stageKey) ?? [];
    const missingFields = this.computeMissingStageFields(requiredFields, {
      amount: toNullableNumber(row.amount),
      expectedCloseDate: row.expected_close_date ?? null,
      primaryContactId: row.primary_contact_id ?? null,
      stakeholderCount: stakeholders.length,
      criticalDiscoverySatisfied
    });

    const proposalRoot = root.proposal ? getRecord(root.proposal) : null;
    const proposal: OpportunityProposalState | null = proposalRoot
      ? {
          templateKey: metaString(proposalRoot, "templateKey"),
          scope: metaString(proposalRoot, "scope"),
          pricing: metaString(proposalRoot, "pricing"),
          timeline: metaString(proposalRoot, "timeline"),
          terms: metaString(proposalRoot, "terms"),
          assumptions: metaString(proposalRoot, "assumptions"),
          exclusions: metaString(proposalRoot, "exclusions"),
          executiveSummary: metaString(proposalRoot, "executiveSummary"),
          status: (["draft", "pending_approval", "approved", "sent"].includes(String(proposalRoot.status))
            ? proposalRoot.status
            : "draft") as OpportunityProposalState["status"],
          approvalId: metaString(proposalRoot, "approvalId"),
          updatedAt: metaString(proposalRoot, "updatedAt")
        }
      : null;

    const discountRoot = getRecord(root.discount);
    const discount: OpportunityDiscountState = {
      percent: metaNumber(discountRoot, "percent"),
      justification: metaString(discountRoot, "justification"),
      competitorContext: metaString(discountRoot, "competitorContext"),
      marginImpact: metaString(discountRoot, "marginImpact"),
      value: metaNumber(discountRoot, "value"),
      closeProbability: metaNumber(discountRoot, "closeProbability"),
      status: (["none", "pending_approval", "approved", "rejected"].includes(String(discountRoot.status))
        ? discountRoot.status
        : "none") as OpportunityDiscountState["status"],
      approvalId: metaString(discountRoot, "approvalId"),
      requestedAt: metaString(discountRoot, "requestedAt")
    };

    const demoRoot = root.demo ? getRecord(root.demo) : null;
    const demo: OpportunityDemoState | null = demoRoot
      ? {
          useCase: metaString(demoRoot, "useCase"),
          audience: metaString(demoRoot, "audience"),
          painPoints: metaString(demoRoot, "painPoints"),
          modules: metaString(demoRoot, "modules"),
          desiredOutcome: metaString(demoRoot, "desiredOutcome"),
          requestedDate: metaString(demoRoot, "requestedDate"),
          presalesOwnerId: metaString(demoRoot, "presalesOwnerId"),
          presalesOwnerName: metaString(demoRoot, "presalesOwnerName"),
          status: (["requested", "scheduled", "delivered", "cancelled"].includes(String(demoRoot.status))
            ? demoRoot.status
            : "requested") as OpportunityDemoState["status"],
          feedback: metaString(demoRoot, "feedback"),
          requestedAt: metaString(demoRoot, "requestedAt")
        }
      : null;

    const closeWonRoot = root.closeWon ? getRecord(root.closeWon) : null;
    const closeWon = closeWonRoot
      ? {
          finalValue: metaNumber(closeWonRoot, "finalValue"),
          contractStatus: metaString(closeWonRoot, "contractStatus"),
          poStatus: metaString(closeWonRoot, "poStatus"),
          billingTerms: metaString(closeWonRoot, "billingTerms"),
          startDate: metaString(closeWonRoot, "startDate"),
          implementationScope: metaString(closeWonRoot, "implementationScope"),
          onboardingOwnerId: metaString(closeWonRoot, "onboardingOwnerId"),
          onboardingOwnerName: metaString(closeWonRoot, "onboardingOwnerName"),
          handoverNote: metaString(closeWonRoot, "handoverNote")
        }
      : null;

    const closeLostRoot = root.closeLost ? getRecord(root.closeLost) : null;
    const closeLost = closeLostRoot
      ? {
          lossReasonKey: metaString(closeLostRoot, "lossReasonKey"),
          lossReasonLabel: metaString(closeLostRoot, "lossReasonLabel"),
          competitor: metaString(closeLostRoot, "competitor"),
          revisitDate: metaString(closeLostRoot, "revisitDate"),
          reactivationStatus: (["none", "pending_approval", "reactivated"].includes(String(closeLostRoot.reactivationStatus))
            ? closeLostRoot.reactivationStatus
            : "none") as "none" | "pending_approval" | "reactivated",
          reactivationApprovalId: metaString(closeLostRoot, "reactivationApprovalId")
        }
      : null;

    return {
      acceptance: readAcceptance(root),
      discovery,
      buyingCommittee,
      negotiation: readNegotiation(root),
      proposal,
      discount,
      demo,
      closeWon,
      closeLost,
      stageRequirement: {
        stageKey,
        requiredFields,
        missingFields,
        satisfied: missingFields.length === 0
      }
    };
  }

  // Persist a partial AE state patch into opportunity metadata.salesExec within a transaction.
  private async patchSalesExec(
    client: PoolClient,
    actor: ActorContext,
    opportunityId: string,
    currentMetadata: Record<string, unknown> | null | undefined,
    patch: Record<string, unknown>
  ) {
    const metadata = getMetadata(currentMetadata);
    const nextMetadata = { ...metadata, salesExec: { ...getSalesExecRoot(metadata), ...patch } };
    await client.query(
      `UPDATE opportunities SET metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [opportunityId, actor.tenantId, JSON.stringify(nextMetadata), actor.userId]
    );
    return nextMetadata;
  }

  // ---- Persona 10 (Enterprise Sales) helpers ---------------------------------------------------

  private async loadTenderChecklistDefs(client: PoolClient, tenantId: string): Promise<OpportunityTenderChecklistItemDefinition[]> {
    const rows = await this.loadOptionValueMetaRows(client, tenantId, "opportunity-tender-checklist");
    return rows.map((row) => ({
      key: row.key,
      label: row.label,
      required: (row.metadata as Record<string, unknown> | null)?.required === true,
      sortOrder: row.sort_order
    }));
  }

  private async patchEnterprise(
    client: PoolClient,
    actor: ActorContext,
    opportunityId: string,
    currentMetadata: Record<string, unknown> | null | undefined,
    patch: Record<string, unknown>
  ) {
    const metadata = getMetadata(currentMetadata);
    const nextMetadata = { ...metadata, enterprise: { ...getEnterpriseRoot(metadata), ...patch } };
    await client.query(
      `UPDATE opportunities SET metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [opportunityId, actor.tenantId, JSON.stringify(nextMetadata), actor.userId]
    );
    return nextMetadata;
  }

  private buildTenderView(
    tender: OpportunityTenderState | null,
    defs: OpportunityTenderChecklistItemDefinition[]
  ): OpportunityTenderView | null {
    if (!tender) {
      return null;
    }
    const checklistItems = defs.map((def) => ({
      key: def.key,
      label: def.label,
      required: def.required,
      completed: tender.checklist[def.key] === true
    }));
    const requiredItems = checklistItems.filter((item) => item.required);
    return {
      ...tender,
      checklistItems,
      completionCount: checklistItems.filter((item) => item.completed).length,
      total: checklistItems.length,
      requiredComplete: requiredItems.every((item) => item.completed),
      missingDocuments: checklistItems.filter((item) => item.required && !item.completed).map((item) => item.label)
    };
  }

  private async buildEnterpriseView(
    client: PoolClient,
    actor: ActorContext,
    row: OpportunityRecordRow,
    tenderDefs: OpportunityTenderChecklistItemDefinition[]
  ): Promise<OpportunityEnterpriseView> {
    const root = getEnterpriseRoot(row.metadata);
    const parentOpportunityId = metaString(root, "parentOpportunityId");

    let parent: { id: string; name: string; stage: CrmOptionValueSummary | null } | null = null;
    if (parentOpportunityId) {
      const parentResult = await client.query<{ id: string; name: string; stage_key: string | null; stage_label: string | null }>(
        `
          SELECT o.id, o.name, sv.value_key AS stage_key, sv.label AS stage_label
          FROM opportunities o
          INNER JOIN tenant_option_values sv ON sv.id = o.stage_option_id AND sv.tenant_id = o.tenant_id
          WHERE o.id = $1 AND o.tenant_id = $2 AND o.deleted_at IS NULL LIMIT 1
        `,
        [parentOpportunityId, actor.tenantId]
      );
      const pr = parentResult.rows[0];
      if (pr) {
        parent = {
          id: pr.id,
          name: pr.name,
          stage: pr.stage_key ? { id: "", key: pr.stage_key, label: pr.stage_label ?? pr.stage_key, description: null, color: null, isDefault: false, isActive: true } : null
        };
      }
    }

    const childRows = await client.query<{
      id: string;
      name: string;
      amount: string | number | null;
      probability: number | null;
      expected_close_date: string | null;
      stage_key: string | null;
      stage_label: string | null;
    }>(
      `
        SELECT o.id, o.name, o.amount, o.probability, o.expected_close_date,
          sv.value_key AS stage_key, sv.label AS stage_label
        FROM opportunities o
        INNER JOIN tenant_option_values sv ON sv.id = o.stage_option_id AND sv.tenant_id = o.tenant_id
        WHERE o.tenant_id = $1
          AND o.deleted_at IS NULL
          AND o.metadata -> 'enterprise' ->> 'parentOpportunityId' = $2
        ORDER BY o.created_at ASC
      `,
      [actor.tenantId, row.id]
    );

    const children: OpportunityRollupChild[] = childRows.rows.map((child) => ({
      id: child.id,
      name: child.name,
      stageKey: child.stage_key,
      stageLabel: child.stage_label,
      amount: toNullableNumber(child.amount),
      probability: child.probability,
      expectedCloseDate: child.expected_close_date
    }));

    const byStageMap = new Map<string, { stageKey: string; stageLabel: string; count: number; value: number }>();
    let totalValue = 0;
    let weightedValue = 0;
    for (const child of children) {
      const amount = child.amount ?? 0;
      totalValue += amount;
      weightedValue += amount * ((child.probability ?? 0) / 100);
      const key = child.stageKey ?? "unknown";
      const entry = byStageMap.get(key) ?? { stageKey: key, stageLabel: child.stageLabel ?? key, count: 0, value: 0 };
      entry.count += 1;
      entry.value += amount;
      byStageMap.set(key, entry);
    }

    const dealReview = readDealReview(root);
    const amount = toNullableNumber(row.amount) ?? 0;
    const dealReviewRequired = amount >= DEFAULT_DEAL_REVIEW_THRESHOLD;

    return {
      parentOpportunityId,
      parent,
      children,
      rollup: {
        childCount: children.length,
        totalValue,
        weightedValue: Math.round(weightedValue),
        byStage: Array.from(byStageMap.values())
      },
      tender: this.buildTenderView(readTenderState(root), tenderDefs),
      dealReview,
      dealReviewThreshold: DEFAULT_DEAL_REVIEW_THRESHOLD,
      dealReviewRequired,
      dealReviewComplete: dealReview.status === "approved" || isDealReviewComplete(dealReview)
    };
  }

  async getOpportunityOptions(actor: ActorContext): Promise<OpportunityOptionsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const fieldDefinitions = await this.crmService.loadFieldDefinitions(client, actor.tenantId, "opportunity");
      const customFieldOptionsPromise = this.crmService.loadCustomFieldOptions(client, actor.tenantId, fieldDefinitions);
      const [owners, accounts, contacts, stages, sources, outcomeStatuses, availableScopes, customFieldOptions] = await Promise.all([
        this.loadOwners(client, actor.tenantId),
        this.loadAccountsLookup(client, actor.tenantId),
        this.loadContactsLookup(client, actor.tenantId),
        this.loadOptionSetValues(client, actor.tenantId, "opportunity-pipeline"),
        this.loadOptionSetValues(client, actor.tenantId, "opportunity-source"),
        this.loadOptionSetValues(client, actor.tenantId, "opportunity-outcome-status"),
        this.getAvailableScopes(client, actor),
        customFieldOptionsPromise
      ]);
      const aeConfig = await this.loadAeConfig(client, actor.tenantId);

      return {
        owners,
        accounts,
        contacts,
        stages,
        sources,
        outcomeStatuses,
        availableScopes,
        fieldDefinitions,
        customFieldOptions,
        discoveryFields: aeConfig.discoveryFields,
        stakeholderRoles: aeConfig.stakeholderRoles,
        proposalTemplates: aeConfig.proposalTemplates,
        lossReasons: aeConfig.lossReasons,
        tenderChecklistItems: await this.loadTenderChecklistDefs(client, actor.tenantId),
        forecastCategories: await this.loadOptionSetValues(client, actor.tenantId, "forecast-category")
      };
    });
  }

  async listOpportunities(actor: ActorContext, query: OpportunityListQuery): Promise<OpportunitiesResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const page = getPositiveNumber(query.page, 1, 10_000);
      const pageSize = getPositiveNumber(query.pageSize, 12, 100);
      const offset = (page - 1) * pageSize;
      const { whereClause, params } = await this.buildOpportunityWhereContext(client, actor, query);

      const countResult = await client.query<OpportunityCountRow>(
        `
          SELECT COUNT(*)::int AS total
          FROM opportunities
          INNER JOIN tenant_option_values AS stage_values
            ON stage_values.id = opportunities.stage_option_id
           AND stage_values.tenant_id = opportunities.tenant_id
          INNER JOIN tenant_option_values AS source_values
            ON source_values.id = opportunities.source_option_id
           AND source_values.tenant_id = opportunities.tenant_id
          INNER JOIN tenant_option_values AS outcome_values
            ON outcome_values.id = opportunities.outcome_status_option_id
           AND outcome_values.tenant_id = opportunities.tenant_id
          LEFT JOIN accounts
            ON accounts.id = opportunities.account_id
           AND accounts.tenant_id = opportunities.tenant_id
           AND accounts.deleted_at IS NULL
          LEFT JOIN contacts AS primary_contacts
            ON primary_contacts.id = opportunities.primary_contact_id
           AND primary_contacts.tenant_id = opportunities.tenant_id
           AND primary_contacts.deleted_at IS NULL
          LEFT JOIN users AS owner_users
            ON owner_users.id = opportunities.owner_id
           AND owner_users.tenant_id = opportunities.tenant_id
           AND owner_users.deleted_at IS NULL
          WHERE ${whereClause}
        `,
        params
      );

      const total = countResult.rows[0]?.total ?? 0;
      const sortColumnByKey = {
        createdAt: "opportunities.created_at",
        updatedAt: "opportunities.updated_at",
        name: "opportunities.name",
        stage: "stage_values.label",
        amount: "COALESCE(opportunities.amount, 0)",
        probability: "COALESCE(opportunities.probability, 0)",
        expectedCloseDate: "opportunities.expected_close_date",
        owner: "COALESCE(owner_users.display_name, '')",
        account: "COALESCE(accounts.name, '')",
        outcomeStatus: "outcome_values.label"
      } as const;
      const sortKey = (query.sortBy ?? "expectedCloseDate") as keyof typeof sortColumnByKey;
      const sortColumn = sortColumnByKey[sortKey];
      const sortOrder = query.sortOrder === "desc" ? "DESC" : "ASC";
      const listParams = [...params, pageSize, offset];

      const result = await client.query<OpportunityRecordRow>(
        `
          SELECT
            opportunities.id,
            opportunities.name,
            opportunities.amount,
            opportunities.probability,
            opportunities.expected_close_date,
            opportunities.competitor,
            opportunities.next_step,
            opportunities.win_loss_reason,
            opportunities.metadata,
            opportunities.created_at,
            opportunities.updated_at,
            opportunities.last_stage_changed_at,
            COALESCE(stakeholder_counts.stakeholder_count, 0)::int AS stakeholder_count,
            COALESCE(note_counts.note_count, 0)::int AS note_count,
            COALESCE(activity_counts.activity_count, 0)::int AS activity_count,
            activity_counts.last_activity_at,
            accounts.id AS account_id,
            accounts.name AS account_name,
            accounts.website AS account_website,
            primary_contacts.id AS primary_contact_id,
            primary_contacts.first_name AS primary_contact_first_name,
            primary_contacts.last_name AS primary_contact_last_name,
            primary_contacts.email AS primary_contact_email,
            primary_contact_role_values.id AS primary_contact_role_id,
            primary_contact_role_values.value_key AS primary_contact_role_key,
            primary_contact_role_values.label AS primary_contact_role_label,
            primary_contact_role_values.description AS primary_contact_role_description,
            primary_contact_role_values.color AS primary_contact_role_color,
            primary_contact_role_values.is_default AS primary_contact_role_is_default,
            primary_contact_role_values.is_active AS primary_contact_role_is_active,
            owner_users.id AS owner_id,
            owner_users.display_name AS owner_display_name,
            owner_users.email AS owner_email,
            owner_teams.name AS owner_team_name,
            owner_departments.name AS owner_department_name,
            stage_values.id AS stage_id,
            stage_values.value_key AS stage_key,
            stage_values.label AS stage_label,
            stage_values.description AS stage_description,
            stage_values.color AS stage_color,
            stage_values.is_default AS stage_is_default,
            stage_values.is_active AS stage_is_active,
            source_values.id AS source_id,
            source_values.value_key AS source_key,
            source_values.label AS source_label,
            source_values.description AS source_description,
            source_values.color AS source_color,
            source_values.is_default AS source_is_default,
            source_values.is_active AS source_is_active,
            outcome_values.id AS outcome_status_id,
            outcome_values.value_key AS outcome_status_key,
            outcome_values.label AS outcome_status_label,
            outcome_values.description AS outcome_status_description,
            outcome_values.color AS outcome_status_color,
            outcome_values.is_default AS outcome_status_is_default,
            outcome_values.is_active AS outcome_status_is_active
          FROM opportunities
          INNER JOIN tenant_option_values AS stage_values
            ON stage_values.id = opportunities.stage_option_id
           AND stage_values.tenant_id = opportunities.tenant_id
          INNER JOIN tenant_option_values AS source_values
            ON source_values.id = opportunities.source_option_id
           AND source_values.tenant_id = opportunities.tenant_id
          INNER JOIN tenant_option_values AS outcome_values
            ON outcome_values.id = opportunities.outcome_status_option_id
           AND outcome_values.tenant_id = opportunities.tenant_id
          LEFT JOIN accounts
            ON accounts.id = opportunities.account_id
           AND accounts.tenant_id = opportunities.tenant_id
           AND accounts.deleted_at IS NULL
          LEFT JOIN contacts AS primary_contacts
            ON primary_contacts.id = opportunities.primary_contact_id
           AND primary_contacts.tenant_id = opportunities.tenant_id
           AND primary_contacts.deleted_at IS NULL
          LEFT JOIN tenant_option_values AS primary_contact_role_values
            ON primary_contact_role_values.id = primary_contacts.role_option_id
           AND primary_contact_role_values.tenant_id = primary_contacts.tenant_id
          LEFT JOIN users AS owner_users
            ON owner_users.id = opportunities.owner_id
           AND owner_users.tenant_id = opportunities.tenant_id
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
            SELECT opportunity_id, COUNT(*)::int AS stakeholder_count
            FROM opportunity_stakeholders
            WHERE tenant_id = $1
              AND deleted_at IS NULL
            GROUP BY opportunity_id
          ) AS stakeholder_counts
            ON stakeholder_counts.opportunity_id = opportunities.id
          LEFT JOIN (
            SELECT entity_id, COUNT(*)::int AS note_count
            FROM crm_notes
            WHERE tenant_id = $1
              AND entity_type = 'opportunity'
              AND deleted_at IS NULL
            GROUP BY entity_id
          ) AS note_counts
            ON note_counts.entity_id = opportunities.id
          LEFT JOIN (
            SELECT
              entity_id,
              COUNT(*)::int AS activity_count,
              MAX(occurred_at) AS last_activity_at
            FROM crm_activities
            WHERE tenant_id = $1
              AND entity_type = 'opportunity'
              AND deleted_at IS NULL
            GROUP BY entity_id
          ) AS activity_counts
            ON activity_counts.entity_id = opportunities.id
          WHERE ${whereClause}
          ORDER BY ${sortColumn} ${sortOrder} NULLS LAST, opportunities.created_at DESC
          LIMIT $${listParams.length - 1}
          OFFSET $${listParams.length}
        `,
        listParams
      );

      return {
        opportunities: result.rows.map((row) => this.mapOpportunity(row)),
        pagination: getPagination(total, page, pageSize)
      };
    });
  }

  async getOpportunity(actor: ActorContext, opportunityId: string): Promise<OpportunityResponse> {
    this.assertEnabled();

    const opportunity = await this.databaseService.withClient(async (client) => {
      const row = await this.loadOpportunityDetailCore(client, actor, opportunityId);
      const stakeholdersByOpportunityId = await this.loadStakeholdersForOpportunities(client, actor.tenantId, [opportunityId]);
      const aeConfig = await this.loadAeConfig(client, actor.tenantId);
      const stakeholders = this.mapStakeholdersWithProfiles(
        stakeholdersByOpportunityId.get(opportunityId) ?? [],
        getSalesExecRoot(row.metadata),
        aeConfig.stakeholderRoles
      );

      const tenderDefs = await this.loadTenderChecklistDefs(client, actor.tenantId);
      return {
        ...this.mapOpportunity(row),
        customFields: getMetadata(row.custom_fields),
        stakeholders,
        execWorkspace: this.buildExecWorkspace(row, stakeholders, aeConfig),
        enterprise: await this.buildEnterpriseView(client, actor, row, tenderDefs),
        managerDealReviews: this.readManagerDealReviews(row.metadata),
        architectureSummary: this.readArchitectureSummary(row.metadata),
        productsServicesPlaceholder: {
          available: false as const,
          message: "Products and services will connect to a governed catalog in a later commercial configuration phase."
        },
        forecastPlaceholder: {
          available: false as const,
          message: "Forecast rollups will connect once quota, category weighting, and commit modeling are implemented."
        },
        dealRiskPlaceholder: {
          available: false as const,
          message: "Deal risk scoring will connect in a later analytics phase using stage velocity, activity gaps, and stakeholder coverage."
        },
        aiPlaceholders: this.buildAiPlaceholders(actor)
      };
    });

    const [notesResponse, activitiesResponse, tasksResponse, timelineResponse] = await Promise.all([
      this.crmService.getEntityNotes(actor, "opportunity", opportunityId),
      this.crmService.getEntityActivities(actor, "opportunity", opportunityId),
      this.crmService.listEntityTasks(actor, "opportunity", opportunityId),
      this.crmService.getEntityTimeline(actor, "opportunity", opportunityId)
    ]);

    return {
      opportunity: {
        ...opportunity,
        notes: notesResponse.notes,
        activities: activitiesResponse.activities,
        tasks: tasksResponse.tasks,
        timeline: timelineResponse.items
      } satisfies OpportunityDetail
    };
  }

  async getOpportunityDashboard(actor: ActorContext, query: OpportunityListQuery): Promise<OpportunityDashboardResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const { whereClause, params, effectiveScope } = await this.buildOpportunityWhereContext(client, actor, query);
      const stalledDays = getPositiveNumber(query.stalledDays, 30, 365);
      const metricParams = [...params, stalledDays];

      const metricsResult = await client.query<OpportunityMetricRow>(
        `
          SELECT
            COUNT(*)::int AS visible_count,
            COALESCE(SUM(CASE WHEN outcome_values.value_key = 'open' THEN COALESCE(opportunities.amount, 0) ELSE 0 END), 0) AS pipeline_value,
            COUNT(*) FILTER (
              WHERE outcome_values.value_key = 'open'
                AND opportunities.expected_close_date >= date_trunc('month', CURRENT_DATE)::date
                AND opportunities.expected_close_date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date
            )::int AS closing_this_month_count,
            COALESCE(
              SUM(
                CASE
                  WHEN outcome_values.value_key = 'open'
                   AND opportunities.expected_close_date >= date_trunc('month', CURRENT_DATE)::date
                   AND opportunities.expected_close_date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date
                  THEN COALESCE(opportunities.amount, 0)
                  ELSE 0
                END
              ),
              0
            ) AS closing_this_month_value,
            COUNT(*) FILTER (
              WHERE outcome_values.value_key = 'open'
                AND opportunities.last_stage_changed_at <= NOW() - ($${metricParams.length}::int * interval '1 day')
            )::int AS stalled_deals_count,
            COALESCE(
              SUM(
                CASE
                  WHEN outcome_values.value_key = 'open'
                   AND opportunities.last_stage_changed_at <= NOW() - ($${metricParams.length}::int * interval '1 day')
                  THEN COALESCE(opportunities.amount, 0)
                  ELSE 0
                END
              ),
              0
            ) AS stalled_deals_value
          FROM opportunities
          INNER JOIN tenant_option_values AS stage_values
            ON stage_values.id = opportunities.stage_option_id
           AND stage_values.tenant_id = opportunities.tenant_id
          INNER JOIN tenant_option_values AS source_values
            ON source_values.id = opportunities.source_option_id
           AND source_values.tenant_id = opportunities.tenant_id
          INNER JOIN tenant_option_values AS outcome_values
            ON outcome_values.id = opportunities.outcome_status_option_id
           AND outcome_values.tenant_id = opportunities.tenant_id
          LEFT JOIN accounts
            ON accounts.id = opportunities.account_id
           AND accounts.tenant_id = opportunities.tenant_id
           AND accounts.deleted_at IS NULL
          LEFT JOIN contacts AS primary_contacts
            ON primary_contacts.id = opportunities.primary_contact_id
           AND primary_contacts.tenant_id = opportunities.tenant_id
           AND primary_contacts.deleted_at IS NULL
          LEFT JOIN users AS owner_users
            ON owner_users.id = opportunities.owner_id
           AND owner_users.tenant_id = opportunities.tenant_id
           AND owner_users.deleted_at IS NULL
          WHERE ${whereClause}
        `,
        metricParams
      );

      const stageDistributionResult = await client.query<StageDistributionRow>(
        `
          SELECT
            stage_values.id AS stage_id,
            stage_values.value_key AS stage_key,
            stage_values.label AS stage_label,
            stage_values.description AS stage_description,
            stage_values.color AS stage_color,
            stage_values.is_default AS stage_is_default,
            stage_values.is_active AS stage_is_active,
            COUNT(*)::int AS opportunity_count,
            COALESCE(SUM(COALESCE(opportunities.amount, 0)), 0) AS total_amount
          FROM opportunities
          INNER JOIN tenant_option_values AS stage_values
            ON stage_values.id = opportunities.stage_option_id
           AND stage_values.tenant_id = opportunities.tenant_id
          INNER JOIN tenant_option_values AS source_values
            ON source_values.id = opportunities.source_option_id
           AND source_values.tenant_id = opportunities.tenant_id
          INNER JOIN tenant_option_values AS outcome_values
            ON outcome_values.id = opportunities.outcome_status_option_id
           AND outcome_values.tenant_id = opportunities.tenant_id
          LEFT JOIN accounts
            ON accounts.id = opportunities.account_id
           AND accounts.tenant_id = opportunities.tenant_id
           AND accounts.deleted_at IS NULL
          LEFT JOIN contacts AS primary_contacts
            ON primary_contacts.id = opportunities.primary_contact_id
           AND primary_contacts.tenant_id = opportunities.tenant_id
           AND primary_contacts.deleted_at IS NULL
          LEFT JOIN users AS owner_users
            ON owner_users.id = opportunities.owner_id
           AND owner_users.tenant_id = opportunities.tenant_id
           AND owner_users.deleted_at IS NULL
          WHERE ${whereClause}
          GROUP BY
            stage_values.id,
            stage_values.value_key,
            stage_values.label,
            stage_values.description,
            stage_values.color,
            stage_values.is_default,
            stage_values.is_active,
            stage_values.sort_order
          ORDER BY stage_values.sort_order ASC, stage_values.label ASC
        `,
        params
      );

      const metrics = metricsResult.rows[0];

      return {
        scope: effectiveScope,
        visibleCount: metrics?.visible_count ?? 0,
        pipelineValue: toNullableNumber(metrics?.pipeline_value) ?? 0,
        closingThisMonthCount: metrics?.closing_this_month_count ?? 0,
        closingThisMonthValue: toNullableNumber(metrics?.closing_this_month_value) ?? 0,
        stalledDealsCount: metrics?.stalled_deals_count ?? 0,
        stalledDealsValue: toNullableNumber(metrics?.stalled_deals_value) ?? 0,
        stageDistribution: stageDistributionResult.rows.map((row) => ({
          stage: mapOptionValue({
            id: row.stage_id,
            key: row.stage_key,
            label: row.stage_label,
            description: row.stage_description,
            color: row.stage_color,
            isDefault: row.stage_is_default,
            isActive: row.stage_is_active
          }),
          opportunityCount: row.opportunity_count,
          totalAmount: toNullableNumber(row.total_amount) ?? 0
        }) satisfies OpportunityStageDistributionItem),
        forecastPlaceholder: {
          available: false,
          message: "Forecast modeling will connect later with commit categories, manager overrides, and quota alignment."
        },
        dealRiskPlaceholder: {
          available: false,
          message: "Deal risk analytics will connect later with velocity scoring, activity trends, and stakeholder sentiment signals."
        }
      };
    });
  }

  async createOpportunity(
    actor: ActorContext,
    audit: AuditMetadata,
    input: CreateOpportunityRequestBody
  ): Promise<OpportunityResponse> {
    this.assertEnabled();

    const opportunityId = await this.databaseService.withTransaction(async (client) => {
      const accountId = await this.ensureAccountId(client, actor.tenantId, input.accountId ?? null);
      const primaryContactId = await this.ensureContactId(client, actor.tenantId, input.primaryContactId ?? null, accountId);
      const stakeholderContactIds = await this.ensureStakeholderContactIds(
        client,
        actor.tenantId,
        input.stakeholderContactIds,
        accountId
      );
      const ownerId = await this.ensureOwnerId(client, actor.tenantId, input.ownerId ?? null);
      const resolvedStageKey = input.stageKey.trim();
      const resolvedOutcomeStatusKey = resolveOutcomeStatusKey(resolvedStageKey, input.outcomeStatusKey ?? undefined);
      assertStageAndOutcomeConsistency(resolvedStageKey, resolvedOutcomeStatusKey);
      const stageOptionId = await this.resolveOptionValueId(
        client,
        actor.tenantId,
        "opportunity-pipeline",
        resolvedStageKey,
        "Opportunity stage"
      );
      const sourceOptionId = await this.resolveOptionValueId(
        client,
        actor.tenantId,
        "opportunity-source",
        input.sourceKey,
        "Opportunity source"
      );
      const outcomeStatusOptionId = await this.resolveOptionValueId(
        client,
        actor.tenantId,
        "opportunity-outcome-status",
        resolvedOutcomeStatusKey,
        "Opportunity outcome status"
      );
      const customFields = await this.crmService.sanitizeCustomFields(
        client,
        actor.tenantId,
        "opportunity",
        input.customFields
      );

      const result = await client.query<{ id: string }>(
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
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::date, $12, $13, $14, $15::jsonb, $16::jsonb, $17, $17)
          RETURNING id
        `,
        [
          actor.tenantId,
          accountId,
          primaryContactId,
          ownerId,
          input.name.trim(),
          stageOptionId,
          sourceOptionId,
          outcomeStatusOptionId,
          input.amount ?? null,
          input.probability ?? null,
          input.expectedCloseDate ?? null,
          getTrimmedNullableString(input.competitor),
          getTrimmedNullableString(input.nextStep),
          getTrimmedNullableString(input.outcomeReason),
          JSON.stringify(customFields),
          JSON.stringify(input.metadata ?? {}),
          actor.userId
        ]
      );

      const nextOpportunityId = result.rows[0]?.id;

      if (!nextOpportunityId) {
        throw new AppError(500, "Opportunity creation failed.", undefined, "OPPORTUNITY_CREATE_FAILED");
      }

      await this.syncStakeholders(client, actor, nextOpportunityId, stakeholderContactIds);

      await this.recordAuditLog(client, actor, audit, {
        action: "opportunity.create",
        resourceType: "opportunity",
        resourceId: nextOpportunityId,
        status: "success",
        metadata: {
          stageKey: resolvedStageKey,
          sourceKey: input.sourceKey,
          outcomeStatusKey: resolvedOutcomeStatusKey,
          ownerId,
          accountId,
          primaryContactId,
          stakeholderContactIds
        }
      });

      return nextOpportunityId;
    });

    return this.getOpportunity(actor, opportunityId);
  }

  async updateOpportunity(
    actor: ActorContext,
    audit: AuditMetadata,
    opportunityId: string,
    input: UpdateOpportunityRequestBody
  ): Promise<OpportunityResponse> {
    this.assertEnabled();

    await this.databaseService.withTransaction(async (client) => {
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateOpportunityRequestBody] !== undefined);
      this.assertOpportunityMutation(actor, keys);

      const currentOpportunity = await this.getOpportunityState(client, actor.tenantId, opportunityId);
      const currentStakeholderContactIds = await this.loadStakeholderContactIds(client, actor.tenantId, opportunityId);
      const accountId = keys.includes("accountId")
        ? await this.ensureAccountId(client, actor.tenantId, input.accountId ?? null)
        : currentOpportunity.account_id;
      const primaryContactId = await this.ensureContactId(
        client,
        actor.tenantId,
        input.primaryContactId !== undefined ? input.primaryContactId : currentOpportunity.primary_contact_id,
        accountId
      );
      const stakeholderContactIds = input.stakeholderContactIds !== undefined
        ? await this.ensureStakeholderContactIds(client, actor.tenantId, input.stakeholderContactIds, accountId)
        : await this.ensureStakeholderContactIds(client, actor.tenantId, currentStakeholderContactIds, accountId);
      const ownerId = keys.includes("ownerId")
        ? await this.ensureOwnerId(client, actor.tenantId, input.ownerId ?? null)
        : currentOpportunity.owner_id;
      const resolvedStageKey = input.stageKey?.trim() ?? currentOpportunity.stage_key;
      const resolvedOutcomeStatusKey = resolveOutcomeStatusKey(
        resolvedStageKey,
        input.outcomeStatusKey === undefined ? currentOpportunity.outcome_status_key : input.outcomeStatusKey
      );
      assertStageAndOutcomeConsistency(resolvedStageKey, resolvedOutcomeStatusKey);

      // ES-005: large deals cannot move into final negotiation until the governance review is complete.
      const movingToNegotiation = resolvedStageKey === "negotiation" && currentOpportunity.stage_key !== "negotiation";
      if (movingToNegotiation) {
        const nextAmount = input.amount !== undefined ? toNullableNumber(input.amount) : toNullableNumber(currentOpportunity.amount);
        if ((nextAmount ?? 0) >= DEFAULT_DEAL_REVIEW_THRESHOLD) {
          const review = readDealReview(getEnterpriseRoot(currentOpportunity.metadata));
          if (review.status !== "approved" && !isDealReviewComplete(review)) {
            throw new AppError(
              400,
              "A strategic deal review is required before final negotiation for deals above the review threshold.",
              undefined,
              "DEAL_REVIEW_REQUIRED"
            );
          }
        }
      }

      const stageOptionId = resolvedStageKey === currentOpportunity.stage_key
        ? currentOpportunity.stage_option_id
        : await this.resolveOptionValueId(client, actor.tenantId, "opportunity-pipeline", resolvedStageKey, "Opportunity stage");
      const sourceKey = input.sourceKey ?? currentOpportunity.source_key;
      const sourceOptionId = sourceKey === currentOpportunity.source_key
        ? currentOpportunity.source_option_id
        : await this.resolveOptionValueId(client, actor.tenantId, "opportunity-source", sourceKey, "Opportunity source");
      const outcomeStatusOptionId = resolvedOutcomeStatusKey === currentOpportunity.outcome_status_key
        ? currentOpportunity.outcome_status_option_id
        : await this.resolveOptionValueId(
            client,
            actor.tenantId,
            "opportunity-outcome-status",
            resolvedOutcomeStatusKey,
            "Opportunity outcome status"
          );
      const metadata = input.metadata
        ? { ...getMetadata(currentOpportunity.metadata), ...input.metadata }
        : getMetadata(currentOpportunity.metadata);
      const customFields =
        input.customFields !== undefined
          ? await this.crmService.sanitizeCustomFields(
              client,
              actor.tenantId,
              "opportunity",
              input.customFields,
              getMetadata(currentOpportunity.custom_fields)
            )
          : getMetadata(currentOpportunity.custom_fields);
      const stageChanged = stageOptionId !== currentOpportunity.stage_option_id;

      await client.query(
        `
          UPDATE opportunities
          SET
            account_id = $3,
            primary_contact_id = $4,
            owner_id = $5,
            name = $6,
            stage_option_id = $7,
            source_option_id = $8,
            outcome_status_option_id = $9,
            amount = $10,
            probability = $11,
            expected_close_date = $12::date,
            competitor = $13,
            next_step = $14,
            win_loss_reason = $15,
            last_stage_changed_at = CASE WHEN $16 THEN NOW() ELSE last_stage_changed_at END,
            custom_fields = $17::jsonb,
            metadata = $18::jsonb,
            updated_by = $19
          WHERE id = $1
            AND tenant_id = $2
            AND deleted_at IS NULL
        `,
        [
          opportunityId,
          actor.tenantId,
          accountId,
          primaryContactId,
          ownerId,
          input.name?.trim() ?? currentOpportunity.name,
          stageOptionId,
          sourceOptionId,
          outcomeStatusOptionId,
          input.amount !== undefined ? input.amount : toNullableNumber(currentOpportunity.amount),
          input.probability !== undefined ? input.probability : currentOpportunity.probability,
          input.expectedCloseDate !== undefined ? input.expectedCloseDate : currentOpportunity.expected_close_date,
          input.competitor !== undefined ? getTrimmedNullableString(input.competitor) : currentOpportunity.competitor,
          input.nextStep !== undefined ? getTrimmedNullableString(input.nextStep) : currentOpportunity.next_step,
          input.outcomeReason !== undefined ? getTrimmedNullableString(input.outcomeReason) : currentOpportunity.win_loss_reason,
          stageChanged,
          JSON.stringify(customFields),
          JSON.stringify(metadata),
          actor.userId
        ]
      );

      if (input.stakeholderContactIds !== undefined || keys.includes("accountId")) {
        await this.syncStakeholders(client, actor, opportunityId, stakeholderContactIds);
      }

      if (stageChanged) {
        const nextStageResult = await client.query<Pick<OpportunityRecordRow, "stage_label" | "outcome_status_label">>(
          `
            SELECT
              stage_values.label AS stage_label,
              outcome_values.label AS outcome_status_label
            FROM opportunities
            INNER JOIN tenant_option_values AS stage_values
              ON stage_values.id = opportunities.stage_option_id
             AND stage_values.tenant_id = opportunities.tenant_id
            INNER JOIN tenant_option_values AS outcome_values
              ON outcome_values.id = opportunities.outcome_status_option_id
             AND outcome_values.tenant_id = opportunities.tenant_id
            WHERE opportunities.id = $1
              AND opportunities.tenant_id = $2
              AND opportunities.deleted_at IS NULL
            LIMIT 1
          `,
          [opportunityId, actor.tenantId]
        );

        const nextStageRow = nextStageResult.rows[0] ?? null;

        await this.recordStageChangeActivity(client, actor, opportunityId, currentOpportunity.stage_label, nextStageRow?.stage_label ?? null, {
          outcomeStatusLabel: nextStageRow?.outcome_status_label ?? null,
          nextStep:
            input.nextStep !== undefined
              ? getTrimmedNullableString(input.nextStep)
              : currentOpportunity.next_step
        });

        await this.recordAuditLog(client, actor, audit, {
          action: "opportunity.stage_change",
          resourceType: "opportunity",
          resourceId: opportunityId,
          status: "success",
          metadata: {
            fromStageKey: currentOpportunity.stage_key,
            toStageKey: resolvedStageKey,
            fromOutcomeStatusKey: currentOpportunity.outcome_status_key,
            toOutcomeStatusKey: resolvedOutcomeStatusKey
          }
        });
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "opportunity.update",
        resourceType: "opportunity",
        resourceId: opportunityId,
        status: "success",
        metadata: {
          updatedFields: keys
        }
      });
    });

    return this.getOpportunity(actor, opportunityId);
  }

  async deleteOpportunity(
    actor: ActorContext,
    audit: AuditMetadata,
    opportunityId: string
  ): Promise<CrmMutationSuccessResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      await this.getOpportunityState(client, actor.tenantId, opportunityId);

      await client.query(
        `
          UPDATE opportunities
          SET
            deleted_at = NOW(),
            updated_by = $3
          WHERE id = $1
            AND tenant_id = $2
            AND deleted_at IS NULL
        `,
        [opportunityId, actor.tenantId, actor.userId]
      );

      await client.query(
        `
          UPDATE opportunity_stakeholders
          SET
            deleted_at = NOW(),
            updated_by = $3
          WHERE tenant_id = $1
            AND opportunity_id = $2
            AND deleted_at IS NULL
        `,
        [actor.tenantId, opportunityId, actor.userId]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "opportunity.delete",
        resourceType: "opportunity",
        resourceId: opportunityId,
        status: "success"
      });

      return { success: true };
    });
  }

  // ---- Persona 9 (AE) actions ------------------------------------------------------------------

  private async createOpportunityTask(
    client: PoolClient,
    actor: ActorContext,
    opportunityId: string,
    input: { title: string; description: string | null; assigneeUserId: string | null; dueAt: Date | null; metadata: Record<string, unknown> }
  ) {
    const ownerId = input.assigneeUserId ?? actor.userId;
    await client.query(
      `
        INSERT INTO crm_tasks (
          tenant_id, entity_type, entity_id, owner_user_id, assignee_user_id, title, description,
          due_at, priority, status, reminder_at, metadata, created_by, updated_by
        )
        VALUES ($1, 'opportunity', $2, $3, $3, $4, $5, $6, 'high', 'open', NULL, $7::jsonb, $8, $8)
      `,
      [actor.tenantId, opportunityId, ownerId, input.title, input.description, input.dueAt, JSON.stringify(input.metadata), actor.userId]
    );
  }

  async acceptOpportunity(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: AcceptOpportunityRequestBody): Promise<OpportunityResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertOpportunityMutation(actor, ["execWorkspace"]);
      const current = await this.getOpportunityState(client, actor.tenantId, opportunityId);
      const acceptance: OpportunityAcceptanceState = {
        status: "accepted",
        acceptedAt: new Date().toISOString(),
        rejectedReason: null,
        slaStartedAt: new Date().toISOString()
      };
      await this.patchSalesExec(client, actor, opportunityId, current.metadata, { acceptance, slaHours: input.slaHours ?? null });
      await this.recordAuditLog(client, actor, audit, {
        action: "opportunity.accept",
        resourceType: "opportunity",
        resourceId: opportunityId,
        status: "success",
        metadata: { slaHours: input.slaHours ?? null }
      });
    });
    return this.getOpportunity(actor, opportunityId);
  }

  async rejectOpportunity(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: RejectOpportunityRequestBody): Promise<OpportunityResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertOpportunityMutation(actor, ["ownerId"]);
      const reason = getTrimmedNullableString(input.reason);
      if (!reason) {
        throw new AppError(400, "A rejection reason is required.", undefined, "VALIDATION_ERROR");
      }
      const current = await this.getOpportunityState(client, actor.tenantId, opportunityId);
      const reassignToUserId = await this.ensureOwnerId(client, actor.tenantId, input.reassignToUserId ?? null);
      const acceptance: OpportunityAcceptanceState = { status: "rejected", acceptedAt: null, rejectedReason: reason, slaStartedAt: null };
      const nextMetadata = await this.patchSalesExec(client, actor, opportunityId, current.metadata, { acceptance });
      // Return the opportunity to the queue: reassign owner (or unassign back to SDR/manager queue).
      await client.query(
        `UPDATE opportunities SET owner_id = $3, metadata = $4::jsonb, updated_by = $5 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [opportunityId, actor.tenantId, reassignToUserId, JSON.stringify(nextMetadata), actor.userId]
      );
      if (reassignToUserId) {
        await this.notificationService.createNotificationWithClient(client, actor, audit, {
          notificationType: "record_assignment",
          recipientUserId: reassignToUserId,
          title: `Opportunity returned to queue: ${current.name}`,
          message: reason,
          linkedRecord: { entityType: "opportunity", entityId: opportunityId }
        });
      }
      await this.recordAuditLog(client, actor, audit, {
        action: "opportunity.reject",
        resourceType: "opportunity",
        resourceId: opportunityId,
        status: "success",
        metadata: { reason, reassignToUserId }
      });
    });
    return this.getOpportunity(actor, opportunityId);
  }

  async updateOpportunityDiscovery(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: OpportunityDiscoveryUpdateBody): Promise<OpportunityResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertOpportunityMutation(actor, ["execWorkspace"]);
      const current = await this.getOpportunityState(client, actor.tenantId, opportunityId);
      const root = getSalesExecRoot(current.metadata);
      const merged = { ...getRecord(root.discovery) };
      for (const [key, value] of Object.entries(input.discovery)) {
        merged[key] = typeof value === "string" ? value.trim() : "";
      }
      await this.patchSalesExec(client, actor, opportunityId, current.metadata, { discovery: merged });
      await this.recordAuditLog(client, actor, audit, { action: "opportunity.discovery.update", resourceType: "opportunity", resourceId: opportunityId, status: "success" });
    });
    return this.getOpportunity(actor, opportunityId);
  }

  async updateOpportunityStakeholderProfiles(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: OpportunityStakeholderProfilesUpdateBody): Promise<OpportunityResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertOpportunityMutation(actor, ["execWorkspace"]);
      const current = await this.getOpportunityState(client, actor.tenantId, opportunityId);
      const root = getSalesExecRoot(current.metadata);
      const profiles = { ...getRecord(root.stakeholderProfiles) };
      for (const profile of input.profiles) {
        if (!profile.contactId) {
          continue;
        }
        profiles[profile.contactId] = {
          roleKey: getTrimmedNullableString(profile.roleKey),
          influence: profile.influence ?? null,
          sentiment: profile.sentiment ?? null,
          relationship: profile.relationship ?? null
        };
      }
      await this.patchSalesExec(client, actor, opportunityId, current.metadata, { stakeholderProfiles: profiles });
      await this.recordAuditLog(client, actor, audit, { action: "opportunity.stakeholders.update", resourceType: "opportunity", resourceId: opportunityId, status: "success" });
    });
    return this.getOpportunity(actor, opportunityId);
  }

  async updateOpportunityNegotiation(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: OpportunityNegotiationUpdateBody): Promise<OpportunityResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertOpportunityMutation(actor, ["execWorkspace"]);
      const current = await this.getOpportunityState(client, actor.tenantId, opportunityId);
      const existing = readNegotiation(getSalesExecRoot(current.metadata));
      const negotiation: OpportunityNegotiationState = {
        commercialAsks: input.commercialAsks !== undefined ? getTrimmedNullableString(input.commercialAsks) : existing.commercialAsks,
        legalAsks: input.legalAsks !== undefined ? getTrimmedNullableString(input.legalAsks) : existing.legalAsks,
        procurementBlockers: input.procurementBlockers !== undefined ? getTrimmedNullableString(input.procurementBlockers) : existing.procurementBlockers,
        competitorOffers: input.competitorOffers !== undefined ? getTrimmedNullableString(input.competitorOffers) : existing.competitorOffers,
        finalPrice: input.finalPrice !== undefined ? toNullableNumber(input.finalPrice) : existing.finalPrice,
        nextAction: input.nextAction !== undefined ? getTrimmedNullableString(input.nextAction) : existing.nextAction,
        updatedAt: new Date().toISOString()
      };
      await this.patchSalesExec(client, actor, opportunityId, current.metadata, { negotiation });
      await this.recordAuditLog(client, actor, audit, { action: "opportunity.negotiation.update", resourceType: "opportunity", resourceId: opportunityId, status: "success" });
    });
    return this.getOpportunity(actor, opportunityId);
  }

  async requestOpportunityDemo(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: OpportunityDemoRequestBody): Promise<OpportunityResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertOpportunityMutation(actor, ["execWorkspace"]);
      const useCase = getTrimmedNullableString(input.useCase);
      if (!useCase) {
        throw new AppError(400, "A demo use case is required.", undefined, "VALIDATION_ERROR");
      }
      const current = await this.getOpportunityState(client, actor.tenantId, opportunityId);
      const presalesOwnerId = await this.ensureOwnerId(client, actor.tenantId, input.presalesOwnerId);
      if (!presalesOwnerId) {
        throw new AppError(400, "A presales owner is required.", undefined, "VALIDATION_ERROR");
      }
      const demo: OpportunityDemoState = {
        useCase,
        audience: getTrimmedNullableString(input.audience),
        painPoints: getTrimmedNullableString(input.painPoints),
        modules: getTrimmedNullableString(input.modules),
        desiredOutcome: getTrimmedNullableString(input.desiredOutcome),
        requestedDate: getTrimmedNullableString(input.requestedDate),
        presalesOwnerId,
        presalesOwnerName: null,
        status: "requested",
        feedback: null,
        requestedAt: new Date().toISOString()
      };
      await this.patchSalesExec(client, actor, opportunityId, current.metadata, { demo });
      await this.createOpportunityTask(client, actor, opportunityId, {
        title: `Demo request: ${current.name}`,
        description: useCase,
        assigneeUserId: presalesOwnerId,
        dueAt: input.requestedDate ? new Date(input.requestedDate) : null,
        metadata: { phase11TaskType: "follow_up", demoRequest: true }
      });
      await this.notificationService.createNotificationWithClient(client, actor, audit, {
        notificationType: "record_assignment",
        recipientUserId: presalesOwnerId,
        title: `Demo requested: ${current.name}`,
        message: useCase,
        linkedRecord: { entityType: "opportunity", entityId: opportunityId }
      });
      await this.recordAuditLog(client, actor, audit, { action: "opportunity.demo.request", resourceType: "opportunity", resourceId: opportunityId, status: "success", metadata: { presalesOwnerId } });
    });
    return this.getOpportunity(actor, opportunityId);
  }

  async updateOpportunityDemoFeedback(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: OpportunityDemoFeedbackBody): Promise<OpportunityResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertOpportunityMutation(actor, ["execWorkspace"]);
      const current = await this.getOpportunityState(client, actor.tenantId, opportunityId);
      const root = getSalesExecRoot(current.metadata);
      const demo = getRecord(root.demo);
      if (Object.keys(demo).length === 0) {
        throw new AppError(400, "No demo request exists to update.", undefined, "VALIDATION_ERROR");
      }
      const nextDemo = {
        ...demo,
        status: input.status ?? demo.status ?? "requested",
        feedback: input.feedback !== undefined ? getTrimmedNullableString(input.feedback) : demo.feedback ?? null
      };
      await this.patchSalesExec(client, actor, opportunityId, current.metadata, { demo: nextDemo });
      await this.recordAuditLog(client, actor, audit, { action: "opportunity.demo.feedback", resourceType: "opportunity", resourceId: opportunityId, status: "success" });
    });
    return this.getOpportunity(actor, opportunityId);
  }

  async upsertOpportunityProposal(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: OpportunityProposalRequestBody): Promise<OpportunityResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertOpportunityMutation(actor, ["execWorkspace"]);
      const current = await this.getOpportunityState(client, actor.tenantId, opportunityId);
      const root = getSalesExecRoot(current.metadata);
      const existing = getRecord(root.proposal);
      const requireApproval = Boolean(input.requireApproval);
      let approvalId = metaString(existing, "approvalId");
      let status: OpportunityProposalState["status"] = "draft";

      if (requireApproval) {
        const approverUserId = await this.ensureOwnerId(client, actor.tenantId, input.approverUserId ?? null);
        if (!approverUserId) {
          throw new AppError(400, "An approver is required to submit the proposal for approval.", undefined, "VALIDATION_ERROR");
        }
        const approval = await this.approvalService.createApprovalWithClient(client, actor, audit, {
          approvalType: "proposal_approval",
          title: `Proposal approval: ${current.name}`,
          description: getTrimmedNullableString(input.executiveSummary) ?? "Proposal review requested.",
          approverUserId,
          linkedRecord: { entityType: "opportunity", entityId: opportunityId }
        });
        approvalId = approval.id;
        status = "pending_approval";
      }

      const proposal = {
        templateKey: input.templateKey !== undefined ? getTrimmedNullableString(input.templateKey) : metaString(existing, "templateKey"),
        scope: input.scope !== undefined ? getTrimmedNullableString(input.scope) : metaString(existing, "scope"),
        pricing: input.pricing !== undefined ? getTrimmedNullableString(input.pricing) : metaString(existing, "pricing"),
        timeline: input.timeline !== undefined ? getTrimmedNullableString(input.timeline) : metaString(existing, "timeline"),
        terms: input.terms !== undefined ? getTrimmedNullableString(input.terms) : metaString(existing, "terms"),
        assumptions: input.assumptions !== undefined ? getTrimmedNullableString(input.assumptions) : metaString(existing, "assumptions"),
        exclusions: input.exclusions !== undefined ? getTrimmedNullableString(input.exclusions) : metaString(existing, "exclusions"),
        executiveSummary: input.executiveSummary !== undefined ? getTrimmedNullableString(input.executiveSummary) : metaString(existing, "executiveSummary"),
        status,
        approvalId,
        updatedAt: new Date().toISOString()
      };
      await this.patchSalesExec(client, actor, opportunityId, current.metadata, { proposal });
      await this.recordAuditLog(client, actor, audit, { action: "opportunity.proposal.upsert", resourceType: "opportunity", resourceId: opportunityId, status: "success", metadata: { requireApproval, approvalId } });
    });
    return this.getOpportunity(actor, opportunityId);
  }

  async requestOpportunityDiscount(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: OpportunityDiscountRequestBody): Promise<OpportunityResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertOpportunityMutation(actor, ["execWorkspace"]);
      const justification = getTrimmedNullableString(input.justification);
      if (!justification) {
        throw new AppError(400, "A discount justification is required.", undefined, "VALIDATION_ERROR");
      }
      const current = await this.getOpportunityState(client, actor.tenantId, opportunityId);
      const approverUserId = await this.ensureOwnerId(client, actor.tenantId, input.approverUserId);
      if (!approverUserId) {
        throw new AppError(400, "An approver is required for the discount request.", undefined, "VALIDATION_ERROR");
      }
      const approval = await this.approvalService.createApprovalWithClient(client, actor, audit, {
        approvalType: "discount_approval",
        title: `Discount approval (${input.percent}%): ${current.name}`,
        description: justification,
        approverUserId,
        linkedRecord: { entityType: "opportunity", entityId: opportunityId },
        metadata: { percent: input.percent }
      });
      const discount: OpportunityDiscountState = {
        percent: input.percent,
        justification,
        competitorContext: getTrimmedNullableString(input.competitorContext),
        marginImpact: getTrimmedNullableString(input.marginImpact),
        value: toNullableNumber(input.value),
        closeProbability: toNullableNumber(input.closeProbability),
        status: "pending_approval",
        approvalId: approval.id,
        requestedAt: new Date().toISOString()
      };
      await this.patchSalesExec(client, actor, opportunityId, current.metadata, { discount });
      await this.recordAuditLog(client, actor, audit, { action: "opportunity.discount.request", resourceType: "opportunity", resourceId: opportunityId, status: "success", metadata: { percent: input.percent, approvalId: approval.id } });
    });
    return this.getOpportunity(actor, opportunityId);
  }

  async closeOpportunityWon(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: OpportunityCloseWonRequestBody): Promise<OpportunityResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertOpportunityMutation(actor, ["execWorkspace"]);
      const current = await this.getOpportunityState(client, actor.tenantId, opportunityId);
      const root = getSalesExecRoot(current.metadata);
      // AE-007: cannot close won with an unapproved discount.
      const discountStatus = getRecord(root.discount).status;
      if (discountStatus === "pending_approval") {
        throw new AppError(400, "Resolve the pending discount approval before closing won.", undefined, "DISCOUNT_PENDING");
      }
      const onboardingOwnerId = await this.ensureOwnerId(client, actor.tenantId, input.onboardingOwnerId);
      if (!onboardingOwnerId) {
        throw new AppError(400, "An onboarding owner (CSM) is required to close won.", undefined, "VALIDATION_ERROR");
      }
      const stageOptionId = await this.resolveOptionValueId(client, actor.tenantId, "opportunity-pipeline", "closed_won", "Opportunity stage");
      const outcomeOptionId = await this.resolveOptionValueId(client, actor.tenantId, "opportunity-outcome-status", "won", "Opportunity outcome status");
      const closeWon = {
        finalValue: input.finalValue,
        contractStatus: getTrimmedNullableString(input.contractStatus),
        poStatus: getTrimmedNullableString(input.poStatus),
        billingTerms: getTrimmedNullableString(input.billingTerms),
        startDate: getTrimmedNullableString(input.startDate),
        implementationScope: getTrimmedNullableString(input.implementationScope),
        onboardingOwnerId,
        onboardingOwnerName: null,
        handoverNote: getTrimmedNullableString(input.handoverNote)
      };
      const nextMetadata = await this.patchSalesExec(client, actor, opportunityId, current.metadata, { closeWon });
      await client.query(
        `UPDATE opportunities SET stage_option_id = $3, outcome_status_option_id = $4, amount = $5, metadata = $6::jsonb, last_stage_changed_at = NOW(), updated_by = $7 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [opportunityId, actor.tenantId, stageOptionId, outcomeOptionId, input.finalValue, JSON.stringify(nextMetadata), actor.userId]
      );
      // AE-009: kick off onboarding via a CSM-owned task + notification (forecast reflects the won amount).
      await this.createOpportunityTask(client, actor, opportunityId, {
        title: `Onboarding handover: ${current.name}`,
        description: getTrimmedNullableString(input.handoverNote),
        assigneeUserId: onboardingOwnerId,
        dueAt: input.startDate ? new Date(input.startDate) : null,
        metadata: { phase11TaskType: "follow_up", onboardingHandover: true }
      });
      await this.notificationService.createNotificationWithClient(client, actor, audit, {
        notificationType: "record_assignment",
        recipientUserId: onboardingOwnerId,
        title: `New won deal to onboard: ${current.name}`,
        message: getTrimmedNullableString(input.handoverNote) ?? "Closed won — begin onboarding.",
        linkedRecord: { entityType: "opportunity", entityId: opportunityId }
      });
      await this.recordAuditLog(client, actor, audit, { action: "opportunity.close_won", resourceType: "opportunity", resourceId: opportunityId, status: "success", metadata: { finalValue: input.finalValue, onboardingOwnerId } });
    });
    return this.getOpportunity(actor, opportunityId);
  }

  async closeOpportunityLost(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: OpportunityCloseLostRequestBody): Promise<OpportunityResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertOpportunityMutation(actor, ["execWorkspace"]);
      const current = await this.getOpportunityState(client, actor.tenantId, opportunityId);
      await this.resolveOptionValueId(client, actor.tenantId, "loss-reason", input.lossReasonKey, "Loss reason");
      const lossReasons = await this.loadOptionSetValues(client, actor.tenantId, "loss-reason");
      const lossReasonLabel = lossReasons.find((reason) => reason.key === input.lossReasonKey)?.label ?? input.lossReasonKey;
      const stageOptionId = await this.resolveOptionValueId(client, actor.tenantId, "opportunity-pipeline", "closed_lost", "Opportunity stage");
      const outcomeOptionId = await this.resolveOptionValueId(client, actor.tenantId, "opportunity-outcome-status", "lost", "Opportunity outcome status");
      const competitor = getTrimmedNullableString(input.competitor);
      const closeLost = {
        lossReasonKey: input.lossReasonKey,
        lossReasonLabel,
        competitor,
        revisitDate: getTrimmedNullableString(input.revisitDate),
        reactivationStatus: "none" as const,
        reactivationApprovalId: null
      };
      const nextMetadata = await this.patchSalesExec(client, actor, opportunityId, current.metadata, { closeLost });
      await client.query(
        `UPDATE opportunities SET stage_option_id = $3, outcome_status_option_id = $4, competitor = COALESCE($5, competitor), win_loss_reason = $6, metadata = $7::jsonb, last_stage_changed_at = NOW(), updated_by = $8 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [opportunityId, actor.tenantId, stageOptionId, outcomeOptionId, competitor, lossReasonLabel, JSON.stringify(nextMetadata), actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "opportunity.close_lost", resourceType: "opportunity", resourceId: opportunityId, status: "success", metadata: { lossReasonKey: input.lossReasonKey } });
    });
    return this.getOpportunity(actor, opportunityId);
  }

  async reactivateOpportunity(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: OpportunityReactivateRequestBody): Promise<OpportunityResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertOpportunityMutation(actor, ["execWorkspace"]);
      const reason = getTrimmedNullableString(input.reason);
      if (!reason) {
        throw new AppError(400, "A reactivation reason is required.", undefined, "VALIDATION_ERROR");
      }
      const current = await this.getOpportunityState(client, actor.tenantId, opportunityId);
      const root = getSalesExecRoot(current.metadata);
      const closeLost = getRecord(root.closeLost);
      if (Object.keys(closeLost).length === 0) {
        throw new AppError(400, "Only closed-lost opportunities can be reactivated.", undefined, "VALIDATION_ERROR");
      }
      const approverUserId = await this.ensureOwnerId(client, actor.tenantId, input.approverUserId);
      if (!approverUserId) {
        throw new AppError(400, "An approver is required to reactivate.", undefined, "VALIDATION_ERROR");
      }
      const approval = await this.approvalService.createApprovalWithClient(client, actor, audit, {
        approvalType: "opportunity_reactivation_approval",
        title: `Reactivate lost opportunity: ${current.name}`,
        description: reason,
        approverUserId,
        linkedRecord: { entityType: "opportunity", entityId: opportunityId }
      });
      await this.patchSalesExec(client, actor, opportunityId, current.metadata, {
        closeLost: { ...closeLost, reactivationStatus: "pending_approval", reactivationApprovalId: approval.id }
      });
      await this.recordAuditLog(client, actor, audit, { action: "opportunity.reactivate.request", resourceType: "opportunity", resourceId: opportunityId, status: "success", metadata: { approvalId: approval.id } });
    });
    return this.getOpportunity(actor, opportunityId);
  }

  // ---- Persona 10 (Enterprise Sales) actions ---------------------------------------------------

  async setOpportunityParent(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: SetOpportunityParentRequestBody): Promise<OpportunityResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertOpportunityMutation(actor, ["enterprise"]);
      const current = await this.getOpportunityState(client, actor.tenantId, opportunityId);
      const parentId = input.parentOpportunityId ?? null;
      if (parentId) {
        if (parentId === opportunityId) {
          throw new AppError(400, "An opportunity cannot be its own parent.", undefined, "VALIDATION_ERROR");
        }
        // Parent must exist; and the parent must not itself be a child of this opportunity (one level guard).
        await this.getOpportunityState(client, actor.tenantId, parentId);
      }
      await this.patchEnterprise(client, actor, opportunityId, current.metadata, { parentOpportunityId: parentId });
      await this.recordAuditLog(client, actor, audit, { action: "opportunity.parent.set", resourceType: "opportunity", resourceId: opportunityId, status: "success", metadata: { parentOpportunityId: parentId } });
    });
    return this.getOpportunity(actor, opportunityId);
  }

  async upsertOpportunityTender(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: UpsertOpportunityTenderRequestBody): Promise<OpportunityResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertOpportunityMutation(actor, ["enterprise"]);
      const current = await this.getOpportunityState(client, actor.tenantId, opportunityId);
      const existing = readTenderState(getEnterpriseRoot(current.metadata));
      const tender: OpportunityTenderState = {
        tenderNumber: input.tenderNumber !== undefined ? getTrimmedNullableString(input.tenderNumber) : existing?.tenderNumber ?? null,
        issuingAuthority: input.issuingAuthority !== undefined ? getTrimmedNullableString(input.issuingAuthority) : existing?.issuingAuthority ?? null,
        deadline: input.deadline !== undefined ? getTrimmedNullableString(input.deadline) : existing?.deadline ?? null,
        eligibility: input.eligibility !== undefined ? getTrimmedNullableString(input.eligibility) : existing?.eligibility ?? null,
        scope: input.scope !== undefined ? getTrimmedNullableString(input.scope) : existing?.scope ?? null,
        preBidDate: input.preBidDate !== undefined ? getTrimmedNullableString(input.preBidDate) : existing?.preBidDate ?? null,
        emd: input.emd !== undefined ? getTrimmedNullableString(input.emd) : existing?.emd ?? null,
        commercialFormat: input.commercialFormat !== undefined ? getTrimmedNullableString(input.commercialFormat) : existing?.commercialFormat ?? null,
        checklist: existing?.checklist ?? {},
        tasksGenerated: existing?.tasksGenerated ?? false,
        updatedAt: new Date().toISOString()
      };

      // ES-003: generate a task per function (sales/bid/presales/legal/finance/leadership) once.
      if (input.generateTasks && !tender.tasksGenerated) {
        const deadline = tender.deadline ? new Date(tender.deadline) : null;
        for (const role of ["sales", "bid", "presales", "legal", "finance", "leadership"]) {
          await this.createOpportunityTask(client, actor, opportunityId, {
            title: `Tender (${role}): ${current.name}`,
            description: `Tender ${tender.tenderNumber ?? ""} — ${role} workstream.`,
            assigneeUserId: current.owner_id ?? null,
            dueAt: Number.isNaN(deadline?.getTime() ?? NaN) ? null : deadline,
            metadata: { phase11TaskType: "follow_up", tenderRole: role }
          });
        }
        tender.tasksGenerated = true;
      }

      await this.patchEnterprise(client, actor, opportunityId, current.metadata, { tender });
      await this.recordAuditLog(client, actor, audit, { action: "opportunity.tender.upsert", resourceType: "opportunity", resourceId: opportunityId, status: "success", metadata: { tasksGenerated: tender.tasksGenerated } });
    });
    return this.getOpportunity(actor, opportunityId);
  }

  async updateOpportunityTenderChecklist(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: OpportunityTenderChecklistUpdateBody): Promise<OpportunityResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertOpportunityMutation(actor, ["enterprise"]);
      const current = await this.getOpportunityState(client, actor.tenantId, opportunityId);
      const existing = readTenderState(getEnterpriseRoot(current.metadata));
      if (!existing) {
        throw new AppError(400, "Create the tender before updating its checklist.", undefined, "VALIDATION_ERROR");
      }
      const checklist = { ...existing.checklist };
      for (const [key, value] of Object.entries(input.checklist)) {
        checklist[key] = value === true;
      }
      await this.patchEnterprise(client, actor, opportunityId, current.metadata, {
        tender: { ...existing, checklist, updatedAt: new Date().toISOString() }
      });
      await this.recordAuditLog(client, actor, audit, { action: "opportunity.tender.checklist", resourceType: "opportunity", resourceId: opportunityId, status: "success" });
    });
    return this.getOpportunity(actor, opportunityId);
  }

  async upsertOpportunityDealReview(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: UpsertOpportunityDealReviewRequestBody): Promise<OpportunityResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertOpportunityMutation(actor, ["enterprise"]);
      const current = await this.getOpportunityState(client, actor.tenantId, opportunityId);
      const existing = readDealReview(getEnterpriseRoot(current.metadata));
      const review: OpportunityDealReviewState = {
        solutionFit: input.solutionFit !== undefined ? getTrimmedNullableString(input.solutionFit) : existing.solutionFit,
        pricing: input.pricing !== undefined ? getTrimmedNullableString(input.pricing) : existing.pricing,
        legal: input.legal !== undefined ? getTrimmedNullableString(input.legal) : existing.legal,
        risk: input.risk !== undefined ? getTrimmedNullableString(input.risk) : existing.risk,
        deliveryReadiness: input.deliveryReadiness !== undefined ? getTrimmedNullableString(input.deliveryReadiness) : existing.deliveryReadiness,
        leadershipSupport: input.leadershipSupport !== undefined ? getTrimmedNullableString(input.leadershipSupport) : existing.leadershipSupport,
        status: existing.status,
        approvalId: existing.approvalId,
        updatedAt: new Date().toISOString()
      };

      if (input.submitForApproval) {
        if (!isDealReviewComplete(review)) {
          throw new AppError(400, "Complete every review dimension before submitting for approval.", undefined, "VALIDATION_ERROR");
        }
        const approverUserId = await this.ensureOwnerId(client, actor.tenantId, input.approverUserId ?? null);
        if (!approverUserId) {
          throw new AppError(400, "An approver is required to submit the deal review.", undefined, "VALIDATION_ERROR");
        }
        const approval = await this.approvalService.createApprovalWithClient(client, actor, audit, {
          approvalType: "deal_review_approval",
          title: `Deal review: ${current.name}`,
          description: review.solutionFit ?? "Strategic deal governance review.",
          approverUserId,
          linkedRecord: { entityType: "opportunity", entityId: opportunityId }
        });
        review.status = "pending_approval";
        review.approvalId = approval.id;
      }

      await this.patchEnterprise(client, actor, opportunityId, current.metadata, { dealReview: review });
      await this.recordAuditLog(client, actor, audit, { action: "opportunity.deal_review.upsert", resourceType: "opportunity", resourceId: opportunityId, status: "success", metadata: { submitForApproval: Boolean(input.submitForApproval) } });
    });
    return this.getOpportunity(actor, opportunityId);
  }

  // ---- Persona 12 (Sales Manager) --------------------------------------------------------------

  private readArchitectureSummary(metadata: Record<string, unknown> | null | undefined): OpportunityArchitectureSummary {
    const architecture = getRecord(getMetadata(metadata).architecture);
    const archRecord = getRecord(architecture.architecture);
    const hasArchitecture = Object.keys(archRecord).length > 0;
    const integrations = Array.isArray(architecture.integrations) ? architecture.integrations : [];
    const discovery = getRecord(architecture.technicalDiscovery);
    const discoveryValues: Record<string, string | null> = {};
    for (const key of technicalDiscoveryFieldKeys) {
      const value = discovery[key];
      discoveryValues[key] = typeof value === "string" ? value : null;
    }
    const riskRecord = getRecord(architecture.deliveryRisk);
    const dimensions = getRecord(riskRecord.dimensions);
    const levels: Record<string, "low" | "medium" | "high"> = {};
    for (const dimension of deliveryRiskDimensions) {
      const level = getRecord(dimensions[dimension]).level;
      levels[dimension] = level === "medium" || level === "high" ? level : "low";
    }
    const hasRisk = Object.keys(dimensions).length > 0;
    const statusValue = riskRecord.status;
    return {
      hasArchitecture,
      architectureStatus: hasArchitecture ? (archRecord.status === "approved" ? "approved" : "draft") : null,
      integrationCount: integrations.length,
      deliveryRiskLevel: hasRisk ? summarizeDeliveryRisk(levels).overall : null,
      deliveryRiskStatus: statusValue === "submitted" || statusValue === "approved" || statusValue === "flagged" ? statusValue : hasRisk ? "open" : null,
      technicalDiscoveryComplete: evaluateTechnicalDiscovery(discoveryValues).complete
    };
  }

  private readManagerDealReviews(metadata: Record<string, unknown> | null | undefined): OpportunityDealReviewEntry[] {
    const raw = getMetadata(metadata).managerDealReviews;
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
      .map((entry) => ({
        id: metaString(entry, "id") ?? randomUUID(),
        stage: metaString(entry, "stage"),
        closeDate: metaString(entry, "closeDate"),
        nextStep: metaString(entry, "nextStep"),
        stakeholders: metaString(entry, "stakeholders"),
        competitor: metaString(entry, "competitor"),
        risks: metaString(entry, "risks"),
        blockers: metaString(entry, "blockers"),
        probability: metaNumber(entry, "probability"),
        comments: metaString(entry, "comments"),
        reviewedBy: (() => {
          const rb = getRecord(entry.reviewedBy);
          const id = metaString(rb, "id");
          const displayName = metaString(rb, "displayName");
          const email = metaString(rb, "email");
          return id && displayName && email ? { id, displayName, email, teamName: null, departmentName: null } : null;
        })(),
        createdAt: metaString(entry, "createdAt") ?? new Date().toISOString()
      }));
  }

  private managerFromClause() {
    return `
      FROM opportunities
      INNER JOIN tenant_option_values AS stage_values ON stage_values.id = opportunities.stage_option_id AND stage_values.tenant_id = opportunities.tenant_id
      INNER JOIN tenant_option_values AS source_values ON source_values.id = opportunities.source_option_id AND source_values.tenant_id = opportunities.tenant_id
      INNER JOIN tenant_option_values AS outcome_values ON outcome_values.id = opportunities.outcome_status_option_id AND outcome_values.tenant_id = opportunities.tenant_id
      LEFT JOIN accounts ON accounts.id = opportunities.account_id AND accounts.tenant_id = opportunities.tenant_id AND accounts.deleted_at IS NULL
      LEFT JOIN contacts AS primary_contacts ON primary_contacts.id = opportunities.primary_contact_id AND primary_contacts.tenant_id = opportunities.tenant_id AND primary_contacts.deleted_at IS NULL
      LEFT JOIN users AS owner_users ON owner_users.id = opportunities.owner_id AND owner_users.tenant_id = opportunities.tenant_id AND owner_users.deleted_at IS NULL
      LEFT JOIN teams AS owner_teams ON owner_teams.id = owner_users.team_id AND owner_teams.tenant_id = owner_users.tenant_id AND owner_teams.deleted_at IS NULL
      LEFT JOIN departments AS owner_departments ON owner_departments.id = owner_users.department_id AND owner_departments.tenant_id = owner_users.tenant_id AND owner_departments.deleted_at IS NULL
    `;
  }

  async getManagerPipeline(actor: ActorContext, query: OpportunityListQuery): Promise<ManagerPipelineResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const { whereClause, params } = await this.buildOpportunityWhereContext(client, actor, query);

      const byOwnerResult = await client.query<{ owner_id: string | null; owner_display_name: string | null; owner_email: string | null; owner_team_name: string | null; owner_department_name: string | null; open_count: number; pipeline_value: string; weighted_value: string }>(
        `
          SELECT owner_users.id AS owner_id, owner_users.display_name AS owner_display_name, owner_users.email AS owner_email,
            owner_teams.name AS owner_team_name, owner_departments.name AS owner_department_name,
            COUNT(*) FILTER (WHERE outcome_values.value_key = 'open')::int AS open_count,
            COALESCE(SUM(CASE WHEN outcome_values.value_key = 'open' THEN COALESCE(opportunities.amount, 0) ELSE 0 END), 0) AS pipeline_value,
            COALESCE(SUM(CASE WHEN outcome_values.value_key = 'open' THEN COALESCE(opportunities.amount, 0) * COALESCE(opportunities.probability, 0) / 100.0 ELSE 0 END), 0) AS weighted_value
          ${this.managerFromClause()}
          WHERE ${whereClause}
          GROUP BY owner_users.id, owner_users.display_name, owner_users.email, owner_teams.name, owner_departments.name
          ORDER BY pipeline_value DESC
        `,
        params
      );

      const dealsResult = await client.query<{
        id: string; name: string; amount: string | number | null; probability: number | null; expected_close_date: string | null;
        age_days: number; owner_id: string | null; owner_display_name: string | null; owner_email: string | null; owner_team_name: string | null; owner_department_name: string | null;
        stage_id: string | null; stage_key: string | null; stage_label: string | null; stage_description: string | null; stage_color: string | null; stage_is_default: boolean | null; stage_is_active: boolean | null;
      }>(
        `
          SELECT opportunities.id, opportunities.name, opportunities.amount, opportunities.probability, opportunities.expected_close_date,
            GREATEST(0, EXTRACT(DAY FROM (NOW() - opportunities.last_stage_changed_at)))::int AS age_days,
            owner_users.id AS owner_id, owner_users.display_name AS owner_display_name, owner_users.email AS owner_email,
            owner_teams.name AS owner_team_name, owner_departments.name AS owner_department_name,
            stage_values.id AS stage_id, stage_values.value_key AS stage_key, stage_values.label AS stage_label, stage_values.description AS stage_description, stage_values.color AS stage_color, stage_values.is_default AS stage_is_default, stage_values.is_active AS stage_is_active
          ${this.managerFromClause()}
          WHERE ${whereClause} AND outcome_values.value_key = 'open'
          ORDER BY opportunities.amount DESC NULLS LAST
          LIMIT 300
        `,
        params
      );

      let totalOpen = 0;
      let pipelineValue = 0;
      let weightedValue = 0;
      const aging = [
        { bucket: "0-30 days", count: 0, value: 0 },
        { bucket: "31-60 days", count: 0, value: 0 },
        { bucket: "61-90 days", count: 0, value: 0 },
        { bucket: "90+ days", count: 0, value: 0 }
      ];
      const stageMap = new Map<string, OpportunityStageDistributionItem>();
      const highRiskDeals: ManagerPipelineResponse["highRiskDeals"] = [];

      for (const row of dealsResult.rows) {
        const amount = toNullableNumber(row.amount) ?? 0;
        totalOpen += 1;
        pipelineValue += amount;
        weightedValue += amount * ((row.probability ?? 0) / 100);
        const bucket = row.age_days <= 30 ? aging[0] : row.age_days <= 60 ? aging[1] : row.age_days <= 90 ? aging[2] : aging[3];
        bucket.count += 1;
        bucket.value += amount;
        const stage = mapOptionValue({ id: row.stage_id, key: row.stage_key, label: row.stage_label, description: row.stage_description, color: row.stage_color, isDefault: row.stage_is_default, isActive: row.stage_is_active });
        const stageKey = stage?.key ?? "unknown";
        const existing = stageMap.get(stageKey) ?? { stage, opportunityCount: 0, totalAmount: 0 };
        existing.opportunityCount += 1;
        existing.totalAmount += amount;
        stageMap.set(stageKey, existing);

        const riskReasons: string[] = [];
        if (row.expected_close_date && new Date(row.expected_close_date).getTime() < Date.now()) riskReasons.push("Past close date");
        if (row.age_days > 60) riskReasons.push("Stalled in stage");
        if ((row.probability ?? 0) < 20) riskReasons.push("Low probability");
        const risk = riskReasons.length >= 2 ? "high" : riskReasons.length === 1 ? "medium" : "low";
        if (risk !== "low") {
          highRiskDeals.push({
            id: row.id,
            name: row.name,
            owner: mapUser({ id: row.owner_id, displayName: row.owner_display_name, email: row.owner_email, teamName: row.owner_team_name, departmentName: row.owner_department_name }),
            stage,
            amount: toNullableNumber(row.amount),
            probability: row.probability,
            expectedCloseDate: row.expected_close_date,
            ageDays: row.age_days,
            risk,
            riskReasons
          });
        }
      }

      return {
        totalOpen,
        pipelineValue,
        weightedValue: Math.round(weightedValue),
        byOwner: byOwnerResult.rows.map((row) => ({
          owner: mapUser({ id: row.owner_id, displayName: row.owner_display_name, email: row.owner_email, teamName: row.owner_team_name, departmentName: row.owner_department_name }),
          openCount: row.open_count,
          pipelineValue: toNullableNumber(row.pipeline_value) ?? 0,
          weightedValue: Math.round(toNullableNumber(row.weighted_value) ?? 0)
        })),
        byStage: Array.from(stageMap.values()),
        aging,
        highRiskDeals: highRiskDeals.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0)).slice(0, 25),
        aiPlaceholder: { available: false, message: "AI high-risk deal detection will connect with the AI Gateway phase." }
      };
    });
  }

  async getManagerPerformance(actor: ActorContext, query: OpportunityListQuery): Promise<ManagerPerformanceResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const { whereClause, params } = await this.buildOpportunityWhereContext(client, actor, query);
      const result = await client.query<{
        owner_id: string | null; owner_display_name: string | null; owner_email: string | null; owner_team_name: string | null; owner_department_name: string | null;
        open_count: number; won_count: number; lost_count: number; total_count: number; avg_deal: string | null; avg_cycle: string | null;
      }>(
        `
          SELECT owner_users.id AS owner_id, owner_users.display_name AS owner_display_name, owner_users.email AS owner_email,
            owner_teams.name AS owner_team_name, owner_departments.name AS owner_department_name,
            COUNT(*) FILTER (WHERE outcome_values.value_key = 'open')::int AS open_count,
            COUNT(*) FILTER (WHERE outcome_values.value_key = 'won')::int AS won_count,
            COUNT(*) FILTER (WHERE outcome_values.value_key = 'lost')::int AS lost_count,
            COUNT(*)::int AS total_count,
            COALESCE(AVG(opportunities.amount) FILTER (WHERE outcome_values.value_key = 'won'), 0) AS avg_deal,
            COALESCE(AVG(EXTRACT(EPOCH FROM (opportunities.last_stage_changed_at - opportunities.created_at)) / 86400.0) FILTER (WHERE outcome_values.value_key = 'won'), 0) AS avg_cycle
          ${this.managerFromClause()}
          WHERE ${whereClause} AND owner_users.id IS NOT NULL
          GROUP BY owner_users.id, owner_users.display_name, owner_users.email, owner_teams.name, owner_departments.name
          ORDER BY won_count DESC
        `,
        params
      );

      return {
        reps: result.rows.map((row) => {
          const decided = row.won_count + row.lost_count;
          return {
            owner: mapUser({ id: row.owner_id, displayName: row.owner_display_name, email: row.owner_email, teamName: row.owner_team_name, departmentName: row.owner_department_name }),
            openCount: row.open_count,
            wonCount: row.won_count,
            lostCount: row.lost_count,
            winRate: decided > 0 ? Math.round((row.won_count / decided) * 100) : 0,
            conversionRate: row.total_count > 0 ? Math.round((row.won_count / row.total_count) * 100) : 0,
            avgDealSize: Math.round(toNullableNumber(row.avg_deal) ?? 0),
            avgCycleDays: Math.round(toNullableNumber(row.avg_cycle) ?? 0)
          };
        }),
        aiPlaceholder: { available: false, message: "AI coaching-focus recommendations will connect with the AI Gateway phase." }
      };
    });
  }

  async getManagerForecast(actor: ActorContext, query: OpportunityListQuery): Promise<ManagerForecastResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const { whereClause, params } = await this.buildOpportunityWhereContext(client, actor, query);
      const categories = await this.loadOptionSetValues(client, actor.tenantId, "forecast-category");
      const rows = await client.query<{ amount: string | number | null; probability: number | null; outcome_key: string | null; metadata: Record<string, unknown> | null }>(
        `
          SELECT opportunities.amount, opportunities.probability, outcome_values.value_key AS outcome_key, opportunities.metadata
          ${this.managerFromClause()}
          WHERE ${whereClause}
        `,
        params
      );

      const counts = new Map<string, { count: number; value: number }>();
      let wonValue = 0;
      let openWeighted = 0;
      for (const row of rows.rows) {
        const amount = toNullableNumber(row.amount) ?? 0;
        if (row.outcome_key === "won") {
          wonValue += amount;
        }
        if (row.outcome_key === "open") {
          openWeighted += amount * ((row.probability ?? 0) / 100);
          const forecast = getRecord(getMetadata(row.metadata).forecast);
          const key = metaString(forecast, "managerOverrideCategoryKey") ?? metaString(forecast, "forecastCategoryKey") ?? "__uncategorized";
          const entry = counts.get(key) ?? { count: 0, value: 0 };
          entry.count += 1;
          entry.value += amount;
          counts.set(key, entry);
        }
      }

      const categoryEntries: ManagerForecastResponse["categories"] = [];
      for (const category of categories) {
        const entry = counts.get(category.key);
        if (entry) {
          categoryEntries.push({ category, count: entry.count, value: entry.value });
        }
      }
      const uncategorized = counts.get("__uncategorized");
      if (uncategorized) {
        categoryEntries.push({ category: null, count: uncategorized.count, value: uncategorized.value });
      }

      return {
        categories: categoryEntries,
        wonValue,
        openWeightedValue: Math.round(openWeighted),
        aiPlaceholder: { available: false, message: "AI flagging of unrealistic close dates/probabilities will connect with the AI Gateway phase." }
      };
    });
  }

  async setOpportunityForecast(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: SetOpportunityForecastRequestBody): Promise<OpportunityResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertOpportunityMutation(actor, ["execWorkspace"]);
      const current = await this.getOpportunityState(client, actor.tenantId, opportunityId);
      if (input.forecastCategoryKey) {
        await this.resolveOptionValueId(client, actor.tenantId, "forecast-category", input.forecastCategoryKey, "Forecast category");
      }
      if (input.managerOverrideCategoryKey) {
        await this.resolveOptionValueId(client, actor.tenantId, "forecast-category", input.managerOverrideCategoryKey, "Forecast category");
      }
      const metadata = getMetadata(current.metadata);
      const forecast = getRecord(metadata.forecast);
      const nextForecast = {
        ...forecast,
        forecastCategoryKey: input.forecastCategoryKey !== undefined ? getTrimmedNullableString(input.forecastCategoryKey) : forecast.forecastCategoryKey ?? null,
        managerOverrideCategoryKey: input.managerOverrideCategoryKey !== undefined ? getTrimmedNullableString(input.managerOverrideCategoryKey) : forecast.managerOverrideCategoryKey ?? null,
        overrideReason: input.overrideReason !== undefined ? getTrimmedNullableString(input.overrideReason) : forecast.overrideReason ?? null,
        updatedAt: new Date().toISOString()
      };
      await client.query(
        `UPDATE opportunities SET metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [opportunityId, actor.tenantId, JSON.stringify({ ...metadata, forecast: nextForecast }), actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "opportunity.forecast.set", resourceType: "opportunity", resourceId: opportunityId, status: "success" });
    });
    return this.getOpportunity(actor, opportunityId);
  }

  async addOpportunityDealReview(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: AddOpportunityDealReviewRequestBody): Promise<OpportunityResponse> {
    this.assertEnabled();
    const comments = getTrimmedNullableString(input.comments);
    if (!comments) {
      throw new AppError(400, "Deal review comments are required.", undefined, "VALIDATION_ERROR");
    }
    await this.databaseService.withTransaction(async (client) => {
      this.assertOpportunityMutation(actor, ["execWorkspace"]);
      const current = await this.getOpportunityState(client, actor.tenantId, opportunityId);
      const metadata = getMetadata(current.metadata);
      const reviews = Array.isArray(metadata.managerDealReviews) ? metadata.managerDealReviews : [];
      const entry = {
        id: randomUUID(),
        stage: current.stage_key,
        closeDate: input.closeDate !== undefined ? getTrimmedNullableString(input.closeDate) : current.expected_close_date,
        nextStep: input.nextStep !== undefined ? getTrimmedNullableString(input.nextStep) : current.next_step,
        stakeholders: getTrimmedNullableString(input.stakeholders),
        competitor: input.competitor !== undefined ? getTrimmedNullableString(input.competitor) : current.competitor,
        risks: getTrimmedNullableString(input.risks),
        blockers: getTrimmedNullableString(input.blockers),
        probability: input.probability !== undefined ? toNullableNumber(input.probability) : current.probability,
        comments,
        reviewedBy: { id: actor.userId, displayName: actor.displayName, email: actor.email },
        createdAt: new Date().toISOString()
      };
      await client.query(
        `UPDATE opportunities SET metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [opportunityId, actor.tenantId, JSON.stringify({ ...metadata, managerDealReviews: [...reviews, entry] }), actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "opportunity.deal_review.add", resourceType: "opportunity", resourceId: opportunityId, status: "success" });
    });
    return this.getOpportunity(actor, opportunityId);
  }

  async createCoachingTask(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: CreateCoachingTaskRequestBody): Promise<OpportunityResponse> {
    this.assertEnabled();
    const title = getTrimmedNullableString(input.title);
    if (!title) {
      throw new AppError(400, "A coaching task title is required.", undefined, "VALIDATION_ERROR");
    }
    await this.databaseService.withTransaction(async (client) => {
      this.assertOpportunityMutation(actor, ["execWorkspace"]);
      await this.getOpportunityState(client, actor.tenantId, opportunityId);
      const assigneeUserId = await this.ensureOwnerId(client, actor.tenantId, input.assigneeUserId);
      if (!assigneeUserId) {
        throw new AppError(400, "A valid rep is required for the coaching task.", undefined, "VALIDATION_ERROR");
      }
      await this.createOpportunityTask(client, actor, opportunityId, {
        title,
        description: getTrimmedNullableString(input.description),
        assigneeUserId,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        metadata: { phase11TaskType: "follow_up", coaching: true }
      });
      await this.recordAuditLog(client, actor, audit, { action: "opportunity.coaching_task.create", resourceType: "opportunity", resourceId: opportunityId, status: "success", metadata: { assigneeUserId } });
    });
    return this.getOpportunity(actor, opportunityId);
  }
}
