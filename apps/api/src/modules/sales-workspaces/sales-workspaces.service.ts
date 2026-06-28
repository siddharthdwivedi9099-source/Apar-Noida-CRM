import { randomUUID } from "node:crypto";
import type {
  CrmLookupUserSummary,
  CrmOptionValueSummary,
  CrmTaskStatus,
  LeadAccountResearch,
  LeadAccountResearchInput,
  LeadBantChecklist,
  LeadCadenceStepDefinition,
  LeadCadenceStateInput,
  LeadContactScriptDefinition,
  LeadCustomQualificationField,
  LeadCustomQualificationFieldInput,
  LeadDiscoveryFieldDefinition,
  LeadIcpAttributes,
  LeadIcpCriterionDefinition,
  LeadMeetingTypeDefinition,
  LeadObjection,
  LeadObjectionTrendEntry,
  LeadObjectionTypeDefinition,
  LeadQualificationChecklistItemDefinition,
  LeadQualificationFramework,
  LeadQualificationOutcome,
  LeadResearchConfidence,
  LeadStrategicValue,
  MarkLeadNoShowRequestBody,
  MarkLeadNoShowResponse,
  RoleSummary,
  SalesWorkspaceAiPlaceholderSummary,
  SalesWorkspaceLeadResponse,
  SalesWorkspaceLeadSummary,
  SalesWorkspaceOptionsResponse,
  SalesWorkspaceTaskSummary,
  ScheduleLeadMeetingRequestBody,
  ScheduleLeadMeetingResponse,
  ScoreGrade,
  SdrWorkspaceResponse,
  SlaPolicyPayload,
  SlaStatus,
  InsideSalesWorkspaceResponse,
  UpdateLeadWorkspaceRequestBody
} from "@crm/types";
import {
  canMarkLeadQualified,
  compareLeadQueueEntries,
  computeLeadWorkspacePriority,
  computeSlaStatus,
  DEFAULT_FAILED_ATTEMPTS_BEFORE_NURTURE,
  evaluateDiscovery,
  evaluateIcpFit,
  evaluateLeadCadence,
  evaluateQualificationChecklist,
  resolveContactScript
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
  first_activity_at: Date | null;
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

interface OptionValueMetaRow {
  key: string;
  label: string;
  description: string | null;
  sort_order: number;
  metadata: Record<string, unknown> | null;
}

interface WorkspaceOptionCatalog {
  outreachStatuses: CrmOptionValueSummary[];
  handoffStatuses: CrmOptionValueSummary[];
  callDispositions: CrmOptionValueSummary[];
  disqualificationReasons: CrmOptionValueSummary[];
  qualificationChecklistItems: LeadQualificationChecklistItemDefinition[];
  contactScripts: LeadContactScriptDefinition[];
  cadenceSteps: LeadCadenceStepDefinition[];
  discoveryFields: LeadDiscoveryFieldDefinition[];
  objectionTypes: LeadObjectionTypeDefinition[];
  icpCriteria: LeadIcpCriterionDefinition[];
  slaPolicy: SlaPolicyPayload | null;
  scoringGrades: ScoreGrade[];
  nowIso: string;
}

// Auto next-step hint stored on a call-disposition option value's metadata (ISR-002).
interface DispositionNextStep {
  taskType: "call" | "follow_up";
  offsetHours: number;
  title: string;
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

// SDR-002: ICP fit distribution across the visible pipeline.
function getIcpFitDistribution(leads: SalesWorkspaceLeadSummary[]) {
  const distribution = { high: 0, medium: 0, low: 0 };
  for (const lead of leads) {
    distribution[lead.workspace.icpFit.band] += 1;
  }
  return distribution;
}

// SDR-006: objection trends (count by type) across the visible pipeline.
function getObjectionTrends(leads: SalesWorkspaceLeadSummary[]): LeadObjectionTrendEntry[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const lead of leads) {
    for (const objection of lead.workspace.objections) {
      const existing = counts.get(objection.typeKey) ?? { label: objection.typeLabel ?? objection.typeKey, count: 0 };
      existing.count += 1;
      if (objection.typeLabel) {
        existing.label = objection.typeLabel;
      }
      counts.set(objection.typeKey, existing);
    }
  }
  return Array.from(counts.entries())
    .map(([typeKey, value]) => ({ typeKey, label: value.label, count: value.count }))
    .sort((a, b) => b.count - a.count);
}

function metaString(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function metaBool(metadata: Record<string, unknown> | null | undefined, key: string): boolean {
  if (!metadata || typeof metadata !== "object") {
    return false;
  }
  return (metadata as Record<string, unknown>)[key] === true;
}

function getDispositionNextStep(metadata: Record<string, unknown> | null | undefined): DispositionNextStep | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }
  const raw = (metadata as Record<string, unknown>).nextStep;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const candidate = raw as Partial<Record<keyof DispositionNextStep, unknown>>;
  const taskType = candidate.taskType === "call" ? "call" : candidate.taskType === "follow_up" ? "follow_up" : null;
  const title = typeof candidate.title === "string" && candidate.title.trim().length > 0 ? candidate.title.trim() : null;
  if (!taskType || !title) {
    return null;
  }
  const offsetHours =
    typeof candidate.offsetHours === "number" && Number.isFinite(candidate.offsetHours) && candidate.offsetHours >= 0
      ? candidate.offsetHours
      : 24;
  return { taskType, offsetHours, title };
}

// Map a stored lead score to a configured grade band (highest band the score meets). Pure.
function scoreToGrade(score: number | null, grades: ScoreGrade[]): string | null {
  if (typeof score !== "number" || !Number.isFinite(score) || grades.length === 0) {
    return null;
  }
  const ordered = [...grades].sort((a, b) => b.minScore - a.minScore);
  for (const grade of ordered) {
    if (score >= grade.minScore) {
      return grade.grade;
    }
  }
  return null;
}

// Derive a human-readable product/solution summary from the lead classification metadata (ISR-001).
function getProductSummary(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }
  const classification = (metadata as Record<string, unknown>).leadClassification;
  const source =
    classification && typeof classification === "object" && !Array.isArray(classification)
      ? (classification as Record<string, unknown>)
      : (metadata as Record<string, unknown>);

  const collected: string[] = [];
  for (const key of ["products", "technologies", "productInterest", "productInterests"]) {
    const value = source[key];
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string" && entry.trim().length > 0) {
          collected.push(entry.trim());
        }
      }
    }
  }
  if (collected.length > 0) {
    return Array.from(new Set(collected)).join(", ");
  }
  return metaString(source, "leadFor");
}

function getStoredQualificationAnswers(root: Record<string, unknown>): Record<string, boolean> {
  const raw = root.qualificationItems;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const answers: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    answers[key] = value === true;
  }
  return answers;
}

function normalizeQualificationOutcome(value: unknown): LeadQualificationOutcome {
  if (value === "qualified" || value === "not_qualified") {
    return value;
  }
  return "pending";
}

function getStoredCadenceState(root: Record<string, unknown>): LeadCadenceStateInput {
  const raw = root.cadence;
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const completedStepKeys = Array.isArray(source.completedStepKeys)
    ? source.completedStepKeys.filter((value): value is string => typeof value === "string")
    : [];
  return {
    paused: source.paused === true,
    pauseReason:
      typeof source.pauseReason === "string" && source.pauseReason.trim().length > 0 ? source.pauseReason.trim() : null,
    completedStepKeys,
    failedAttemptCount:
      typeof source.failedAttemptCount === "number" && Number.isFinite(source.failedAttemptCount)
        ? source.failedAttemptCount
        : 0,
    movedToNurture: source.movedToNurture === true
  };
}

function normalizeResearchConfidence(value: unknown): LeadResearchConfidence | null {
  return value === "high" || value === "medium" || value === "low" ? value : null;
}

function normalizeStrategicValue(value: unknown): LeadStrategicValue | null {
  return value === "high" || value === "medium" || value === "low" ? value : null;
}

function getStoredResearch(root: Record<string, unknown>): LeadAccountResearch {
  const raw = root.research;
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const sources = Array.isArray(source.sources)
    ? source.sources.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  return {
    companyProfile: metaString(source, "companyProfile"),
    industry: metaString(source, "industry"),
    size: metaString(source, "size"),
    leadership: metaString(source, "leadership"),
    locations: metaString(source, "locations"),
    likelyNeeds: metaString(source, "likelyNeeds"),
    recentSignals: metaString(source, "recentSignals"),
    talkingPoints: metaString(source, "talkingPoints"),
    sources,
    confidence: normalizeResearchConfidence(source.confidence),
    savedAt: metaString(source, "savedAt")
  };
}

function getStoredIcpAttributes(root: Record<string, unknown>): LeadIcpAttributes {
  const raw = root.icpAttributes;
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    industry: metaString(source, "industry"),
    segment: metaString(source, "segment"),
    size: metaString(source, "size"),
    geography: metaString(source, "geography"),
    useCase: metaString(source, "useCase"),
    budget: metaString(source, "budget"),
    strategicValue: normalizeStrategicValue(source.strategicValue)
  };
}

function getStoredDiscoveryAnswers(root: Record<string, unknown>): Record<string, string> {
  const raw = root.discovery;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const answers: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string") {
      answers[key] = value;
    }
  }
  return answers;
}

function getStoredObjections(root: Record<string, unknown>): LeadObjection[] {
  const raw = root.objections;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }
      const item = entry as Record<string, unknown>;
      const typeKey = metaString(item, "typeKey");
      if (!typeKey) {
        return null;
      }
      return {
        id: metaString(item, "id") ?? randomUUID(),
        typeKey,
        typeLabel: metaString(item, "typeLabel"),
        note: metaString(item, "note"),
        capturedAt: metaString(item, "capturedAt") ?? new Date().toISOString()
      } satisfies LeadObjection;
    })
    .filter((entry): entry is LeadObjection => Boolean(entry));
}

function getStoredNoShowCount(root: Record<string, unknown>): number {
  const raw = root.noShow;
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return typeof source.count === "number" && Number.isFinite(source.count) && source.count > 0 ? source.count : 0;
}

// SDR-005: after this many no-shows, the lead is routed to nurture.
const DEFAULT_NO_SHOWS_BEFORE_NURTURE = 2;

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

  private async loadOptionValueMetaRows(client: PoolClient, tenantId: string, setKey: string) {
    const result = await client.query<OptionValueMetaRow>(
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

  private async loadQualificationChecklistItems(
    client: PoolClient,
    tenantId: string
  ): Promise<LeadQualificationChecklistItemDefinition[]> {
    const rows = await this.loadOptionValueMetaRows(client, tenantId, "lead-qualification-checklist");
    return rows.map((row) => ({
      key: row.key,
      label: row.label,
      description: row.description,
      required: metaBool(row.metadata, "required"),
      sortOrder: row.sort_order
    }));
  }

  private async loadContactScripts(client: PoolClient, tenantId: string): Promise<LeadContactScriptDefinition[]> {
    const rows = await this.loadOptionValueMetaRows(client, tenantId, "lead-contact-script");
    return rows.map((row) => ({
      key: row.key,
      label: row.label,
      body: metaString(row.metadata, "body") ?? row.description ?? "",
      leadFor: metaString(row.metadata, "leadFor"),
      campaignKey: metaString(row.metadata, "campaignKey"),
      sourceKey: metaString(row.metadata, "sourceKey"),
      personaKey: metaString(row.metadata, "personaKey")
    }));
  }

  private async loadCadenceSteps(client: PoolClient, tenantId: string): Promise<LeadCadenceStepDefinition[]> {
    const rows = await this.loadOptionValueMetaRows(client, tenantId, "lead-cadence-step");
    const validChannels = ["call", "email", "sms", "whatsapp", "linkedin", "follow_up"];
    return rows.map((row, index) => {
      const channelRaw = metaString(row.metadata, "channel");
      const offsetRaw = row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>).offsetHours : null;
      return {
        key: row.key,
        label: row.label,
        channel: (channelRaw && validChannels.includes(channelRaw)
          ? channelRaw
          : "follow_up") as LeadCadenceStepDefinition["channel"],
        offsetHours: typeof offsetRaw === "number" && Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : index * 24,
        order: row.sort_order
      };
    });
  }

  private async loadDiscoveryFields(client: PoolClient, tenantId: string): Promise<LeadDiscoveryFieldDefinition[]> {
    const rows = await this.loadOptionValueMetaRows(client, tenantId, "lead-discovery-field");
    return rows.map((row) => ({
      key: row.key,
      label: row.label,
      description: row.description,
      required: metaBool(row.metadata, "required"),
      sortOrder: row.sort_order
    }));
  }

  private async loadIcpCriteria(client: PoolClient, tenantId: string): Promise<LeadIcpCriterionDefinition[]> {
    const rows = await this.loadOptionValueMetaRows(client, tenantId, "lead-icp-criterion");
    return rows.map((row) => {
      const weightRaw = row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>).weight : null;
      return {
        key: row.key,
        label: row.label,
        weight: typeof weightRaw === "number" && Number.isFinite(weightRaw) && weightRaw >= 0 ? weightRaw : 1
      };
    });
  }

  private async loadInsideSalesRuntimeConfig(
    client: PoolClient,
    tenantId: string
  ): Promise<{ slaPolicy: SlaPolicyPayload | null; scoringGrades: ScoreGrade[] }> {
    const result = await client.query<{ definition_type: string; definition: Record<string, unknown> }>(
      `
        SELECT definition_type, definition
        FROM configuration_definitions
        WHERE tenant_id = $1
          AND deleted_at IS NULL
          AND is_active = true
          AND definition_type IN ('scoring_model', 'sla_policy')
          AND definition->>'object' = 'lead'
        ORDER BY definition_type ASC, updated_at DESC
      `,
      [tenantId]
    );

    let slaPolicy: SlaPolicyPayload | null = null;
    let scoringGrades: ScoreGrade[] = [];
    for (const row of result.rows) {
      if (row.definition_type === "sla_policy" && !slaPolicy) {
        slaPolicy = row.definition as unknown as SlaPolicyPayload;
      }
      if (row.definition_type === "scoring_model" && scoringGrades.length === 0) {
        const payload = row.definition as unknown as { grades?: ScoreGrade[] };
        scoringGrades = Array.isArray(payload.grades) ? payload.grades : [];
      }
    }

    return { slaPolicy, scoringGrades };
  }

  private async buildOptionCatalog(
    client: PoolClient,
    actor: ActorContext,
    options: SalesWorkspaceOptionsResponse
  ): Promise<WorkspaceOptionCatalog> {
    const runtime = await this.loadInsideSalesRuntimeConfig(client, actor.tenantId);
    const contactScripts = await this.loadContactScripts(client, actor.tenantId);
    return {
      outreachStatuses: options.outreachStatuses,
      handoffStatuses: options.handoffStatuses,
      callDispositions: options.callDispositions,
      disqualificationReasons: options.disqualificationReasons,
      qualificationChecklistItems: options.qualificationChecklistItems,
      contactScripts,
      cadenceSteps: options.cadenceSteps,
      discoveryFields: options.discoveryFields,
      objectionTypes: options.objectionTypes,
      icpCriteria: options.icpCriteria,
      slaPolicy: runtime.slaPolicy,
      scoringGrades: runtime.scoringGrades,
      nowIso: new Date().toISOString()
    };
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
            },
            {
              key: "best_contact_recommendation",
              label: "Best contact time & channel",
              description: "Placeholder entry point for future AI recommendations on when and how to reach the lead."
            },
            {
              key: "lead_summary",
              label: "AI lead summary",
              description: "Placeholder entry point for future AI lead summaries surfaced from the queue."
            },
            {
              key: "call_note_summary",
              label: "Summarize call notes",
              description: "Placeholder entry point for future AI summarization of logged call notes."
            },
            {
              key: "qualification_outcome_suggestion",
              label: "Suggest qualification outcome",
              description: "Placeholder entry point for future AI qualification-outcome suggestions with human override."
            },
            {
              key: "account_research",
              label: "AI account research",
              description: "Placeholder entry point for future AI company/account research summaries with confidence + sources."
            },
            {
              key: "discovery_summary",
              label: "Summarize discovery",
              description: "Placeholder entry point for future AI discovery-call summaries and follow-up email drafting."
            },
            {
              key: "icp_explanation",
              label: "Explain ICP fit",
              description: "Placeholder entry point for future AI explanations of the ICP fit score."
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
      callDispositions: new Map(optionCatalog.callDispositions.map((option) => [option.key, option])),
      disqualificationReasons: new Map(optionCatalog.disqualificationReasons.map((option) => [option.key, option]))
    };
  }

  private mapLeadWorkspaceState(
    metadata: Record<string, unknown> | null | undefined,
    optionCatalog: WorkspaceOptionCatalog,
    createdAtIso: string
  ) {
    const root = getSalesWorkspaceRoot(metadata);
    const optionMaps = this.buildOptionMaps(optionCatalog);
    const qualificationChecklist = getBantChecklist(root.qualificationChecklist);
    const qualificationChecklistCompletionCount = Object.values(qualificationChecklist).filter(Boolean).length;
    const customQualificationFields = normalizeCustomQualificationFields(root.customQualificationFields);
    const checklistEvaluation = evaluateQualificationChecklist(
      optionCatalog.qualificationChecklistItems,
      getStoredQualificationAnswers(root)
    );
    const cadence = evaluateLeadCadence({
      steps: optionCatalog.cadenceSteps,
      state: getStoredCadenceState(root),
      startIso: createdAtIso,
      nowIso: optionCatalog.nowIso,
      failedAttemptsBeforeNurture: DEFAULT_FAILED_ATTEMPTS_BEFORE_NURTURE
    });
    const research = getStoredResearch(root);
    const icpFit = evaluateIcpFit(getStoredIcpAttributes(root), optionCatalog.icpCriteria);
    const discovery = evaluateDiscovery(optionCatalog.discoveryFields, getStoredDiscoveryAnswers(root));
    const objections = getStoredObjections(root);
    const noShowCount = getStoredNoShowCount(root);

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
      qualificationItems: checklistEvaluation.items,
      qualificationItemsCompletionCount: checklistEvaluation.completionCount,
      qualificationItemsTotal: checklistEvaluation.total,
      qualificationItemsRequiredCount: checklistEvaluation.requiredCount,
      qualificationItemsRequiredComplete: checklistEvaluation.requiredComplete,
      qualificationOutcome: normalizeQualificationOutcome(root.qualificationOutcome),
      qualificationOverrideReason:
        typeof root.qualificationOverrideReason === "string"
          ? getTrimmedNullableString(root.qualificationOverrideReason)
          : null,
      disqualificationReason:
        typeof root.disqualificationReasonKey === "string"
          ? optionMaps.disqualificationReasons.get(root.disqualificationReasonKey.trim()) ?? null
          : null,
      cadence,
      research,
      icpFit,
      discovery,
      objections,
      noShowCount,
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

  private computeLeadSla(row: LeadWorkspaceRow, optionCatalog: WorkspaceOptionCatalog) {
    const policy = optionCatalog.slaPolicy;
    if (!policy || policy.targets.length === 0) {
      return { slaDueAt: null, slaStatus: null as SlaStatus | null, slaLabel: null, slaRemainingHours: null };
    }
    const target = policy.targets.find((entry) => entry.key === "first_response") ?? policy.targets[0];
    const startIso = row.created_at.toISOString();
    // First response is "completed" once the lead has its first logged activity.
    const completionIso = target.key === "first_response" ? toIsoString(row.first_activity_at) : null;
    const computation = computeSlaStatus(target, startIso, completionIso, optionCatalog.nowIso);
    return {
      slaDueAt: computation.dueAt,
      slaStatus: computation.status,
      slaLabel: target.label ?? target.key,
      slaRemainingHours: computation.remainingHours
    };
  }

  private mapLeadSummary(row: LeadWorkspaceRow, optionCatalog: WorkspaceOptionCatalog): SalesWorkspaceLeadSummary {
    const metadata = getMetadata(row.metadata);
    const classification =
      metadata.leadClassification && typeof metadata.leadClassification === "object"
        ? (metadata.leadClassification as Record<string, unknown>)
        : null;
    const leadFor = metaString(classification, "leadFor") ?? metaString(metadata, "leadFor");
    const personaKey = metaString(metadata, "personaKey") ?? metaString(metadata, "persona");
    const campaignKey =
      metaString(classification, "campaignKey") ??
      metaString(metadata, "campaignKey") ??
      metaString(metadata, "campaignType") ??
      metaString(metadata, "campaignTypeKey");
    const sla = this.computeLeadSla(row, optionCatalog);
    // Disqualified leads are excluded from active SLA pressure (ISR-006).
    const slaStatusForPriority = row.status_key === "disqualified" ? null : sla.slaStatus;
    const priority = computeLeadWorkspacePriority({ score: row.score, slaStatus: slaStatusForPriority });
    const firstContactScript = resolveContactScript(optionCatalog.contactScripts, {
      leadFor,
      campaignKey,
      sourceKey: row.source_key,
      personaKey
    });

    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      fullName: `${row.first_name} ${row.last_name}`.trim(),
      companyName: row.company_name,
      email: row.email,
      phone: row.phone,
      priority: priority.priority,
      isHot: priority.isHot,
      scoreGrade: scoreToGrade(row.score, optionCatalog.scoringGrades),
      productSummary: getProductSummary(row.metadata),
      slaDueAt: row.status_key === "disqualified" ? null : sla.slaDueAt,
      slaStatus: slaStatusForPriority,
      slaLabel: row.status_key === "disqualified" ? null : sla.slaLabel,
      slaRemainingHours: row.status_key === "disqualified" ? null : sla.slaRemainingHours,
      slaBreachAlert: slaStatusForPriority === "breached",
      firstContactScript,
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
      workspace: this.mapLeadWorkspaceState(row.metadata, optionCatalog, row.created_at.toISOString()),
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
      qualificationFrameworks: [...this.getQualificationFrameworkDefinitions()],
      disqualificationReasons: await this.loadOptionSetValues(client, actor.tenantId, "disqualification-reason"),
      qualificationChecklistItems: await this.loadQualificationChecklistItems(client, actor.tenantId),
      qualificationOutcomes: await this.loadOptionSetValues(client, actor.tenantId, "qualification-status"),
      cadenceSteps: await this.loadCadenceSteps(client, actor.tenantId),
      meetingTypes: (await this.loadOptionSetValues(client, actor.tenantId, "lead-meeting-type")).map((option) => ({
        key: option.key,
        label: option.label
      })),
      discoveryFields: await this.loadDiscoveryFields(client, actor.tenantId),
      objectionTypes: (await this.loadOptionSetValues(client, actor.tenantId, "lead-objection-type")).map((option) => ({
        key: option.key,
        label: option.label
      })),
      icpCriteria: await this.loadIcpCriteria(client, actor.tenantId),
      opportunityStages: await this.loadOptionSetValues(client, actor.tenantId, "opportunity-stage")
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
          activity_counts.first_activity_at,
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
          SELECT tenant_id, entity_id, COUNT(*) AS count, MAX(occurred_at) AS last_activity_at, MIN(occurred_at) AS first_activity_at
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
    return leads
      .filter((lead) => {
        const statusKey = lead.status?.key ?? "";
        const handoffKey = lead.workspace.handoffStatus?.key ?? "";

        return statusKey !== "disqualified" && handoffKey !== "accepted_by_sales";
      })
      .sort((a, b) =>
        compareLeadQueueEntries(
          { priority: a.priority, slaDueAt: a.slaDueAt, score: a.score },
          { priority: b.priority, slaDueAt: b.slaDueAt, score: b.score }
        )
      );
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

  private researchField(
    input: LeadAccountResearchInput,
    key: "companyProfile" | "industry" | "size" | "leadership" | "locations" | "likelyNeeds" | "recentSignals" | "talkingPoints",
    current: string | null
  ): string | null {
    const value = input[key];
    return value !== undefined ? getTrimmedNullableString(value) : current;
  }

  private icpField(
    input: Partial<LeadIcpAttributes>,
    key: "industry" | "segment" | "size" | "geography" | "useCase" | "budget",
    current: string | null
  ): string | null {
    const value = input[key];
    return value !== undefined ? getTrimmedNullableString(value) : current;
  }

  private async createAutoNextStepTask(
    client: PoolClient,
    actor: ActorContext,
    leadId: string,
    ownerId: string | null,
    dispositionKey: string,
    dispositionLabel: string,
    nextStep: DispositionNextStep
  ) {
    const dueAt = new Date(Date.now() + nextStep.offsetHours * 3_600_000);
    const taskOwnerId = ownerId ?? actor.userId;

    await client.query(
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
        VALUES ($1, 'lead', $2, $3, $3, $4, $5, $6, $7, 'open', NULL, $8::jsonb, $9, $9)
      `,
      [
        actor.tenantId,
        leadId,
        taskOwnerId,
        nextStep.title,
        `Auto-created from the "${dispositionLabel}" call disposition.`,
        dueAt,
        nextStep.taskType === "call" ? "high" : "medium",
        JSON.stringify({
          phase11TaskType: nextStep.taskType,
          workspace: "inside_sales_workspace",
          autoGenerated: true,
          sourceCallDisposition: dispositionKey
        }),
        actor.userId
      ]
    );
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
      const optionCatalog = await this.buildOptionCatalog(client, actor, options);
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
        icpFitDistribution: getIcpFitDistribution(hydratedLeads),
        objectionTrends: getObjectionTrends(hydratedLeads),
        aiPlaceholders: this.buildAiPlaceholders(actor)
      };
    });
  }

  async getInsideSalesWorkspace(actor: ActorContext): Promise<InsideSalesWorkspaceResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const options = await this.loadWorkspaceOptions(client, actor);
      const optionCatalog = await this.buildOptionCatalog(client, actor, options);
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
      const optionCatalog = await this.buildOptionCatalog(client, actor, options);
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

      // ISR-006: a structured disqualification reason is mandatory when moving a lead to disqualified.
      const movingToDisqualified = input.statusKey === "disqualified";
      const nextDisqualificationReasonKey =
        input.disqualificationReasonKey !== undefined
          ? getTrimmedNullableString(input.disqualificationReasonKey)
          : typeof currentWorkspace.disqualificationReasonKey === "string"
            ? getTrimmedNullableString(currentWorkspace.disqualificationReasonKey)
            : null;

      if (input.disqualificationReasonKey) {
        await this.resolveOptionValueId(
          client,
          actor.tenantId,
          "disqualification-reason",
          input.disqualificationReasonKey,
          "Disqualification reason"
        );
      }

      if (movingToDisqualified && !nextDisqualificationReasonKey) {
        throw new AppError(
          400,
          "A disqualification reason is required when disqualifying a lead.",
          undefined,
          "VALIDATION_ERROR"
        );
      }

      // Future-fit leads are routed to nurture rather than fully discarded (ISR-006).
      const routedToNurture = movingToDisqualified && nextDisqualificationReasonKey === "future_need";

      // ISR-004: required checklist items must be complete before a lead can be marked qualified,
      // unless an explicit override reason is supplied.
      const mergedQualificationAnswers = {
        ...getStoredQualificationAnswers(currentWorkspace),
        ...(input.qualificationItems ?? {})
      };
      const nextQualificationOutcome =
        input.qualificationOutcome ?? normalizeQualificationOutcome(currentWorkspace.qualificationOutcome);
      const nextQualificationOverrideReason =
        input.qualificationOverrideReason !== undefined
          ? getTrimmedNullableString(input.qualificationOverrideReason)
          : typeof currentWorkspace.qualificationOverrideReason === "string"
            ? getTrimmedNullableString(currentWorkspace.qualificationOverrideReason)
            : null;
      const markingQualified = nextQualificationOutcome === "qualified" || input.statusKey === "qualified";

      if (
        markingQualified &&
        !canMarkLeadQualified(optionCatalog.qualificationChecklistItems, mergedQualificationAnswers) &&
        !nextQualificationOverrideReason
      ) {
        throw new AppError(
          400,
          "Complete all required qualification checklist items before marking this lead qualified, or provide an override reason.",
          undefined,
          "VALIDATION_ERROR"
        );
      }

      // ISR-003: cadence controls (advance a step, pause with reason, log a failed attempt → nurture).
      const nextCadence = getStoredCadenceState(currentWorkspace);
      if (input.cadence) {
        const cadenceInput = input.cadence;
        if (cadenceInput.completeStepKey) {
          const stepKey = cadenceInput.completeStepKey.trim();
          if (stepKey && !nextCadence.completedStepKeys.includes(stepKey)) {
            nextCadence.completedStepKeys = [...nextCadence.completedStepKeys, stepKey];
          }
        }
        if (cadenceInput.logFailedAttempt) {
          nextCadence.failedAttemptCount += 1;
        }
        if (cadenceInput.paused !== undefined) {
          nextCadence.paused = cadenceInput.paused;
          if (cadenceInput.paused) {
            const reason = getTrimmedNullableString(cadenceInput.pauseReason ?? null);
            if (!reason) {
              throw new AppError(400, "A reason is required to pause the cadence.", undefined, "VALIDATION_ERROR");
            }
            nextCadence.pauseReason = reason;
          } else {
            nextCadence.pauseReason = null;
          }
        } else if (cadenceInput.pauseReason !== undefined) {
          nextCadence.pauseReason = getTrimmedNullableString(cadenceInput.pauseReason);
        }
      }
      const cadenceRoutedToNurture =
        !nextCadence.movedToNurture && nextCadence.failedAttemptCount >= DEFAULT_FAILED_ATTEMPTS_BEFORE_NURTURE;
      if (cadenceRoutedToNurture) {
        nextCadence.movedToNurture = true;
      }

      // Persona 7 (SDR) capture: account research (SDR-001), ICP attributes (SDR-002),
      // discovery answers (SDR-003), objections (SDR-006).
      const currentResearch = getStoredResearch(currentWorkspace);
      const nextResearch: LeadAccountResearch = input.research
        ? {
            companyProfile: this.researchField(input.research, "companyProfile", currentResearch.companyProfile),
            industry: this.researchField(input.research, "industry", currentResearch.industry),
            size: this.researchField(input.research, "size", currentResearch.size),
            leadership: this.researchField(input.research, "leadership", currentResearch.leadership),
            locations: this.researchField(input.research, "locations", currentResearch.locations),
            likelyNeeds: this.researchField(input.research, "likelyNeeds", currentResearch.likelyNeeds),
            recentSignals: this.researchField(input.research, "recentSignals", currentResearch.recentSignals),
            talkingPoints: this.researchField(input.research, "talkingPoints", currentResearch.talkingPoints),
            sources:
              input.research.sources !== undefined
                ? input.research.sources.map((value) => value.trim()).filter((value) => value.length > 0)
                : currentResearch.sources,
            confidence:
              input.research.confidence !== undefined
                ? (["high", "medium", "low"].includes(input.research.confidence ?? "")
                    ? (input.research.confidence as LeadResearchConfidence)
                    : null)
                : currentResearch.confidence,
            savedAt: new Date().toISOString()
          }
        : currentResearch;

      const currentIcpAttributes = getStoredIcpAttributes(currentWorkspace);
      const nextIcpAttributes: LeadIcpAttributes = input.icpAttributes
        ? {
            industry: this.icpField(input.icpAttributes, "industry", currentIcpAttributes.industry),
            segment: this.icpField(input.icpAttributes, "segment", currentIcpAttributes.segment),
            size: this.icpField(input.icpAttributes, "size", currentIcpAttributes.size),
            geography: this.icpField(input.icpAttributes, "geography", currentIcpAttributes.geography),
            useCase: this.icpField(input.icpAttributes, "useCase", currentIcpAttributes.useCase),
            budget: this.icpField(input.icpAttributes, "budget", currentIcpAttributes.budget),
            strategicValue:
              input.icpAttributes.strategicValue !== undefined
                ? (["high", "medium", "low"].includes(input.icpAttributes.strategicValue ?? "")
                    ? (input.icpAttributes.strategicValue as LeadStrategicValue)
                    : null)
                : currentIcpAttributes.strategicValue
          }
        : currentIcpAttributes;

      const nextDiscovery = input.discovery
        ? (() => {
            const merged = { ...getStoredDiscoveryAnswers(currentWorkspace) };
            for (const [key, value] of Object.entries(input.discovery)) {
              merged[key] = typeof value === "string" ? value.trim() : "";
            }
            return merged;
          })()
        : getStoredDiscoveryAnswers(currentWorkspace);

      let nextObjections = getStoredObjections(currentWorkspace);
      if (input.addObjection) {
        await this.resolveOptionValueId(
          client,
          actor.tenantId,
          "lead-objection-type",
          input.addObjection.typeKey,
          "Objection type"
        );
        const typeLabel =
          optionCatalog.objectionTypes.find((type) => type.key === input.addObjection?.typeKey)?.label ?? null;
        nextObjections = [
          ...nextObjections,
          {
            id: randomUUID(),
            typeKey: input.addObjection.typeKey,
            typeLabel,
            note: getTrimmedNullableString(input.addObjection.note ?? null),
            capturedAt: new Date().toISOString()
          }
        ];
      }
      if (input.removeObjectionId) {
        nextObjections = nextObjections.filter((objection) => objection.id !== input.removeObjectionId);
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
      const baseOutreachStatusKey =
        input.outreachStatusKey !== undefined
          ? getTrimmedNullableString(input.outreachStatusKey)
          : typeof currentWorkspace.outreachStatusKey === "string"
            ? getTrimmedNullableString(currentWorkspace.outreachStatusKey)
            : null;
      const nextOutreachStatusKey =
        (routedToNurture || cadenceRoutedToNurture) && input.outreachStatusKey === undefined
          ? "nurture"
          : baseOutreachStatusKey;
      const nextWorkspace = {
        ...currentWorkspace,
        outreachStatusKey: nextOutreachStatusKey,
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
        qualificationItems: mergedQualificationAnswers,
        qualificationOutcome: nextQualificationOutcome,
        qualificationOverrideReason: nextQualificationOverrideReason,
        disqualificationReasonKey: nextDisqualificationReasonKey,
        cadence: input.cadence
          ? { ...nextCadence, updatedAt: new Date().toISOString() }
          : currentWorkspace.cadence,
        research: nextResearch,
        icpAttributes: nextIcpAttributes,
        discovery: nextDiscovery,
        objections: nextObjections,
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

      // ISR-002: log call disposition + auto-create the configured next step when the outcome changes.
      const previousDispositionKey =
        typeof currentWorkspace.callDispositionKey === "string"
          ? getTrimmedNullableString(currentWorkspace.callDispositionKey)
          : null;
      const nextDispositionKey = nextWorkspace.callDispositionKey;
      if (input.callDispositionKey !== undefined && nextDispositionKey && nextDispositionKey !== previousDispositionKey) {
        const dispositionMetaRows = await this.loadOptionValueMetaRows(client, actor.tenantId, "lead-call-disposition");
        const dispositionRow = dispositionMetaRows.find((entry) => entry.key === nextDispositionKey);
        const dispositionLabel = dispositionRow?.label ?? nextDispositionKey;

        await this.insertLeadWorkflowActivity(client, actor, leadId, {
          subject: `Call disposition logged: ${dispositionLabel}`,
          description: getTrimmedNullableString(
            typeof nextWorkspace.qualificationNotes === "string" ? `Notes: ${nextWorkspace.qualificationNotes}` : null
          ),
          outcome: dispositionLabel,
          metadata: {
            fromCallDispositionKey: previousDispositionKey,
            toCallDispositionKey: nextDispositionKey
          },
          ownerId
        });

        const nextStep = getDispositionNextStep(dispositionRow?.metadata);
        if (nextStep) {
          await this.createAutoNextStepTask(client, actor, leadId, ownerId, nextDispositionKey, dispositionLabel, nextStep);
        }
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

      return {
        lead: await this.reloadWorkspaceLead(client, actor, leadId, optionCatalog)
      };
    });
  }

  private async reloadWorkspaceLead(
    client: PoolClient,
    actor: ActorContext,
    leadId: string,
    optionCatalog: WorkspaceOptionCatalog
  ): Promise<SalesWorkspaceLeadSummary> {
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
          activity_counts.first_activity_at,
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
          SELECT tenant_id, entity_id, COUNT(*) AS count, MAX(occurred_at) AS last_activity_at, MIN(occurred_at) AS first_activity_at
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
    return this.hydrateLeadMetrics([this.mapLeadSummary(row, optionCatalog)], tasks)[0];
  }

  async scheduleLeadMeeting(
    actor: ActorContext,
    audit: AuditMetadata,
    leadId: string,
    input: ScheduleLeadMeetingRequestBody
  ): Promise<ScheduleLeadMeetingResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      // Booking a meeting both changes lead status and creates tasks, so require edit rights.
      this.assertWorkflowMutation(actor, ["statusKey"]);

      const scheduledDate = new Date(input.scheduledAt);
      if (Number.isNaN(scheduledDate.getTime())) {
        throw new AppError(400, "A valid meeting date/time is required.", undefined, "VALIDATION_ERROR");
      }

      const title = input.title.trim();
      if (title.length < 2) {
        throw new AppError(400, "A meeting title is required.", undefined, "VALIDATION_ERROR");
      }

      const options = await this.loadWorkspaceOptions(client, actor);
      const optionCatalog = await this.buildOptionCatalog(client, actor, options);
      const currentLead = await this.getLeadState(client, actor.tenantId, leadId);
      this.assertLeadVisibility(actor, currentLead.owner_id);

      // Validate the (configurable) meeting type + resolve the meeting-scheduled status.
      await this.resolveOptionValueId(client, actor.tenantId, "lead-meeting-type", input.meetingTypeKey, "Meeting type");
      const meetingStatusOptionId = await this.resolveOptionValueId(
        client,
        actor.tenantId,
        "lead-status",
        "meeting_scheduled",
        "Lead status"
      );
      const meetingTypeLabel =
        options.meetingTypes.find((type) => type.key === input.meetingTypeKey)?.label ?? input.meetingTypeKey;

      // Validate participants belong to the tenant.
      const participantIds = Array.from(new Set(input.participantUserIds ?? []));
      for (const participantId of participantIds) {
        await this.ensureOwnerId(client, actor.tenantId, participantId);
      }

      const ownerId = currentLead.owner_id ?? actor.userId;
      const durationMinutes =
        typeof input.durationMinutes === "number" && input.durationMinutes > 0 ? input.durationMinutes : 30;
      const reminderMinutesBefore =
        typeof input.reminderMinutesBefore === "number" && input.reminderMinutesBefore > 0
          ? input.reminderMinutesBefore
          : 60;
      const agenda = getTrimmedNullableString(input.agenda ?? null);
      const crmRecordUrl = `/leads/${leadId}`;

      // 1. Meeting activity carrying agenda, participants, and CRM record link.
      const activityResult = await client.query<{ id: string }>(
        `
          INSERT INTO crm_activities (
            tenant_id, entity_type, entity_id, activity_type, subject, description, occurred_at,
            owner_user_id, outcome, author_user_id, metadata, created_by, updated_by
          )
          VALUES ($1, 'lead', $2, 'meeting', $3, $4, $5, $6, $7, $8, $9::jsonb, $8, $8)
          RETURNING id
        `,
        [
          actor.tenantId,
          leadId,
          `${meetingTypeLabel} booked: ${title}`,
          agenda,
          scheduledDate,
          ownerId,
          `Meeting scheduled (${meetingTypeLabel})`,
          actor.userId,
          JSON.stringify({
            meetingTypeKey: input.meetingTypeKey,
            agenda,
            participantUserIds: participantIds,
            crmRecordUrl,
            scheduledAt: scheduledDate.toISOString(),
            durationMinutes
          })
        ]
      );
      const activityId = activityResult.rows[0].id;

      // 2. Meeting task at the scheduled time + a reminder task ahead of it.
      const meetingTaskId = await this.createLeadTask(client, actor, leadId, ownerId, {
        title: `${meetingTypeLabel}: ${title}`,
        description: agenda ? `Agenda: ${agenda}\nCRM record: ${crmRecordUrl}` : `CRM record: ${crmRecordUrl}`,
        dueAt: scheduledDate,
        reminderAt: null,
        priority: "high",
        taskType: "meeting",
        metadata: { meetingActivityId: activityId, meetingTypeKey: input.meetingTypeKey, participantUserIds: participantIds }
      });
      const reminderAt = new Date(scheduledDate.getTime() - reminderMinutesBefore * 60 * 1000);
      const reminderTaskId = await this.createLeadTask(client, actor, leadId, ownerId, {
        title: `Reminder: ${meetingTypeLabel} with lead`,
        description: `Prepare for the upcoming ${meetingTypeLabel.toLowerCase()}. CRM record: ${crmRecordUrl}`,
        dueAt: reminderAt,
        reminderAt,
        priority: "medium",
        taskType: "follow_up",
        metadata: { meetingActivityId: activityId, reminder: true }
      });

      // 3. Move the lead into the meeting-scheduled status.
      await client.query(
        `
          UPDATE leads
          SET status_option_id = $3, updated_by = $4
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
        `,
        [leadId, actor.tenantId, meetingStatusOptionId, actor.userId]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "lead.meeting.schedule",
        resourceType: "lead",
        resourceId: leadId,
        status: "success",
        metadata: {
          meetingTypeKey: input.meetingTypeKey,
          scheduledAt: scheduledDate.toISOString(),
          activityId,
          participantCount: participantIds.length
        }
      });

      return {
        lead: await this.reloadWorkspaceLead(client, actor, leadId, optionCatalog),
        meeting: {
          activityId,
          meetingTaskId,
          reminderTaskId,
          deliveryPlaceholder: {
            available: false as const,
            message:
              "The CRM meeting record, status change, and reminder tasks are live. Calendar invite + email delivery connect once the scheduling/outbound runtime is introduced."
          }
        }
      };
    });
  }

  async markLeadNoShow(
    actor: ActorContext,
    audit: AuditMetadata,
    leadId: string,
    input: MarkLeadNoShowRequestBody
  ): Promise<MarkLeadNoShowResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      this.assertWorkflowMutation(actor, ["statusKey"]);

      const options = await this.loadWorkspaceOptions(client, actor);
      const optionCatalog = await this.buildOptionCatalog(client, actor, options);
      const currentLead = await this.getLeadState(client, actor.tenantId, leadId);
      this.assertLeadVisibility(actor, currentLead.owner_id);
      const currentWorkspace = getSalesWorkspaceRoot(currentLead.metadata);
      const ownerId = currentLead.owner_id ?? actor.userId;
      const noShowCount = getStoredNoShowCount(currentWorkspace) + 1;
      const routedTo: "nurture" | null = noShowCount >= DEFAULT_NO_SHOWS_BEFORE_NURTURE ? "nurture" : null;
      const note = getTrimmedNullableString(input.note ?? null);

      // SDR-005: create a reschedule task unless explicitly suppressed.
      if (input.reschedule !== false) {
        await this.createLeadTask(client, actor, leadId, ownerId, {
          title: "Reschedule meeting after no-show",
          description: note ?? `Lead missed the scheduled meeting. Reschedule and confirm attendance. CRM record: /leads/${leadId}`,
          dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          reminderAt: null,
          priority: "high",
          taskType: "follow_up",
          metadata: { noShow: true, noShowCount }
        });
      }

      await this.insertLeadWorkflowActivity(client, actor, leadId, {
        subject: "Meeting marked as no-show",
        description: note,
        outcome: "no_show",
        metadata: { noShowCount, routedTo },
        ownerId
      });

      const nextWorkspace = {
        ...currentWorkspace,
        outreachStatusKey:
          routedTo === "nurture"
            ? "nurture"
            : typeof currentWorkspace.outreachStatusKey === "string"
              ? getTrimmedNullableString(currentWorkspace.outreachStatusKey)
              : null,
        noShow: { count: noShowCount, lastAt: new Date().toISOString() }
      };
      const metadata = {
        ...getMetadata(currentLead.metadata),
        salesWorkspace: nextWorkspace
      };

      // After the configured number of no-shows, route the lead to nurture.
      const statusOptionId =
        routedTo === "nurture"
          ? await this.resolveOptionValueId(client, actor.tenantId, "lead-status", "nurturing", "Lead status")
          : currentLead.status_option_id;

      await client.query(
        `
          UPDATE leads
          SET status_option_id = $3, metadata = $4::jsonb, updated_by = $5
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
        `,
        [leadId, actor.tenantId, statusOptionId, JSON.stringify(metadata), actor.userId]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "lead.meeting.no_show",
        resourceType: "lead",
        resourceId: leadId,
        status: "success",
        metadata: { noShowCount, routedTo }
      });

      return {
        lead: await this.reloadWorkspaceLead(client, actor, leadId, optionCatalog),
        noShowCount,
        routedTo
      };
    });
  }

  private async createLeadTask(
    client: PoolClient,
    actor: ActorContext,
    leadId: string,
    ownerId: string | null,
    input: {
      title: string;
      description: string | null;
      dueAt: Date | null;
      reminderAt: Date | null;
      priority: "low" | "medium" | "high" | "urgent";
      taskType: "call" | "follow_up" | "meeting";
      metadata: Record<string, unknown>;
    }
  ): Promise<string> {
    const taskOwnerId = ownerId ?? actor.userId;
    const result = await client.query<{ id: string }>(
      `
        INSERT INTO crm_tasks (
          tenant_id, entity_type, entity_id, owner_user_id, assignee_user_id,
          title, description, due_at, priority, status, reminder_at, metadata, created_by, updated_by
        )
        VALUES ($1, 'lead', $2, $3, $3, $4, $5, $6, $7, 'open', $8, $9::jsonb, $10, $10)
        RETURNING id
      `,
      [
        actor.tenantId,
        leadId,
        taskOwnerId,
        input.title,
        input.description,
        input.dueAt,
        input.priority,
        input.reminderAt,
        JSON.stringify({ workspace: "inside_sales_workspace", phase11TaskType: input.taskType, ...input.metadata }),
        actor.userId
      ]
    );
    return result.rows[0].id;
  }
}
