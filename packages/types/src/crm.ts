import type { SlaStatus } from "./lead-assignment.js";
import type { OpportunityArchitectureSummary } from "./solution-architecture.js";
import type { OpportunityLegalSummary } from "./legal.js";

export const crmEntityTypes = [
  "lead",
  "account",
  "contact",
  "campaign",
  "opportunity",
  "ticket",
  "customer_success_account"
] as const;
export type CrmEntityType = (typeof crmEntityTypes)[number];

export const crmSortOrders = ["asc", "desc"] as const;
export type CrmSortOrder = (typeof crmSortOrders)[number];

export const crmActivityTypes = [
  "call",
  "email",
  "meeting",
  "chat",
  "social",
  "demo",
  "training",
  "support",
  "renewal",
  "task",
  "status_change",
  "note"
] as const;
export type CrmActivityType = (typeof crmActivityTypes)[number];

export const crmTaskPriorities = ["low", "medium", "high", "urgent"] as const;
export type CrmTaskPriority = (typeof crmTaskPriorities)[number];

export const crmTaskStatuses = ["open", "in_progress", "blocked", "completed", "cancelled"] as const;
export type CrmTaskStatus = (typeof crmTaskStatuses)[number];

export const crmTimelineItemKinds = [
  "note",
  "activity",
  "task",
  "ticket",
  "campaign",
  "training",
  "onboarding_milestone"
] as const;
export type CrmTimelineItemKind = (typeof crmTimelineItemKinds)[number];

export const crmTimelineFilterKinds = ["all", ...crmTimelineItemKinds] as const;
export type CrmTimelineFilterKind = (typeof crmTimelineFilterKinds)[number];

export interface CrmPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface CrmLookupUserSummary {
  id: string;
  displayName: string;
  email: string;
  teamName: string | null;
  departmentName: string | null;
}

export interface CrmOptionValueSummary {
  id: string;
  key: string;
  label: string;
  description: string | null;
  color: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export const crmFieldDataTypes = [
  "text",
  "textarea",
  "number",
  "currency",
  "percent",
  "date",
  "datetime",
  "email",
  "phone",
  "url",
  "select",
  "multiselect",
  "boolean",
  "lookup",
  "json"
] as const;
export type CrmFieldDataType = (typeof crmFieldDataTypes)[number];

export interface CrmFieldDefinition {
  fieldKey: string;
  label: string;
  description: string | null;
  dataType: CrmFieldDataType;
  placeholder: string | null;
  optionSetKey: string | null;
  targetObject: string | null;
  isRequired: boolean;
  isActive: boolean;
  isSystemField: boolean;
  sortOrder: number;
  settings: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface CrmRecordLinkSummary {
  entityType: CrmEntityType;
  entityId: string;
}

export interface CrmNoteSummary {
  id: string;
  body: string;
  isCustomerFacing: boolean;
  isInternal: boolean;
  author: CrmLookupUserSummary | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface CrmActivitySummary {
  id: string;
  relatedRecord: CrmRecordLinkSummary;
  activityType: CrmActivityType;
  subject: string;
  outcome: string | null;
  notes: string | null;
  occurredAt: string;
  owner: CrmLookupUserSummary | null;
  author: CrmLookupUserSummary | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface CrmTaskSummary {
  id: string;
  relatedRecord: CrmRecordLinkSummary;
  title: string;
  description: string | null;
  dueAt: string | null;
  reminderAt: string | null;
  priority: CrmTaskPriority;
  status: CrmTaskStatus;
  owner: CrmLookupUserSummary | null;
  assignee: CrmLookupUserSummary | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface CrmTimelineItem {
  id: string;
  kind: CrmTimelineItemKind;
  touchpointType: CrmTimelineItemKind;
  title: string;
  description: string | null;
  occurredAt: string;
  actor: CrmLookupUserSummary | null;
  owner: CrmLookupUserSummary | null;
  relatedRecord: CrmRecordLinkSummary;
  isCustomerFacing: boolean;
  activityType: CrmActivityType | null;
  taskStatus: CrmTaskStatus | null;
  taskPriority: CrmTaskPriority | null;
  dueAt: string | null;
  metadata: Record<string, unknown>;
}

export interface CreateCrmNoteRequestBody {
  body: string;
  isCustomerFacing?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateCrmNoteRequestBody {
  body?: string;
  isCustomerFacing?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CreateCrmActivityRequestBody {
  activityType: CrmActivityType;
  subject: string;
  outcome?: string | null;
  notes?: string | null;
  ownerId?: string | null;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateCrmTaskRequestBody {
  title: string;
  description?: string | null;
  dueAt?: string | null;
  reminderAt?: string | null;
  priority?: CrmTaskPriority;
  status?: CrmTaskStatus;
  ownerId?: string | null;
  assigneeId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateCrmTaskRequestBody {
  title?: string;
  description?: string | null;
  dueAt?: string | null;
  reminderAt?: string | null;
  priority?: CrmTaskPriority;
  status?: CrmTaskStatus;
  ownerId?: string | null;
  assigneeId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CrmTimelineQuery {
  kind?: CrmTimelineFilterKind;
}

export interface CrmMutationSuccessResponse {
  success: true;
}

export interface CrmNoteResponse {
  note: CrmNoteSummary;
}

export interface CrmActivityResponse {
  activity: CrmActivitySummary;
}

export interface CrmNotesResponse {
  notes: CrmNoteSummary[];
}

export interface CrmActivitiesResponse {
  activities: CrmActivitySummary[];
}

export interface CrmTaskResponse {
  task: CrmTaskSummary;
}

export interface CrmTasksResponse {
  tasks: CrmTaskSummary[];
}

export interface CrmTimelineResponse {
  items: CrmTimelineItem[];
  availableTouchpointTypes: CrmTimelineItemKind[];
  activeTouchpointType: CrmTimelineFilterKind;
}

export const leadSortFields = [
  "createdAt",
  "updatedAt",
  "companyName",
  "status",
  "source",
  "score",
  "owner"
] as const;
export type LeadSortField = (typeof leadSortFields)[number];

export interface LeadListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  source?: string;
  ownerId?: string;
  leadFor?: string;
  product?: string;
  technology?: string;
  sortBy?: LeadSortField;
  sortOrder?: CrmSortOrder;
}

export interface LeadSummary {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  companyName: string;
  email: string | null;
  phone: string | null;
  status: CrmOptionValueSummary | null;
  source: CrmOptionValueSummary | null;
  score: number | null;
  owner: CrmLookupUserSummary | null;
  noteCount: number;
  activityCount: number;
  lastActivityAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export const leadDuplicateMatchReasons = ["company_name", "email_domain", "email", "phone", "full_name"] as const;
export type LeadDuplicateMatchReason = (typeof leadDuplicateMatchReasons)[number];

export interface LeadDuplicateMatchSummary {
  id: string;
  label: string;
  secondaryLabel: string | null;
  reasons: LeadDuplicateMatchReason[];
}

export interface LeadConversionSummary {
  convertedAt: string;
  convertedByUserId: string;
  account: AccountLookupSummary | null;
  accountLinkMode: "created" | "existing";
  contact: ContactRelationshipSummary | null;
  contactLinkMode: "created" | "existing";
  opportunity: OpportunityLookupSummary | null;
  handoffTask: CrmTaskSummary | null;
  duplicateCheckCompletedAt: string;
  duplicateMatches: {
    accountMatches: LeadDuplicateMatchSummary[];
    contactMatches: LeadDuplicateMatchSummary[];
  };
  qualificationSummary: string | null;
}

export interface LeadDetail extends LeadSummary {
  customFields: Record<string, unknown>;
  notes: CrmNoteSummary[];
  activities: CrmActivitySummary[];
  tasks: CrmTaskSummary[];
  timeline: CrmTimelineItem[];
  conversion: LeadConversionSummary | null;
  conversionPlaceholder: {
    available: false;
    message: string;
  };
}

export interface CreateLeadRequestBody {
  firstName: string;
  lastName: string;
  companyName: string;
  email?: string | null;
  phone?: string | null;
  statusKey: string;
  sourceKey: string;
  score?: number | null;
  ownerId?: string | null;
  metadata?: Record<string, unknown>;
  customFields?: Record<string, unknown>;
}

export interface UpdateLeadRequestBody {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string | null;
  phone?: string | null;
  statusKey?: string;
  sourceKey?: string;
  score?: number | null;
  ownerId?: string | null;
  metadata?: Record<string, unknown>;
  customFields?: Record<string, unknown>;
}

export interface LeadResponse {
  lead: LeadDetail;
}

export interface ConvertLeadRequestBody {
  accountId?: string | null;
  contactId?: string | null;
  opportunityName?: string | null;
  ownerId?: string | null;
  stageKey: string;
  amount: number;
  probability?: number | null;
  expectedCloseDate: string;
  sourceKey?: string | null;
  nextStep: string;
  competitor?: string | null;
  handoverNotes?: string | null;
  taskDueAt?: string | null;
}

export interface LeadConversionResponse {
  lead: LeadDetail;
  account: AccountLookupSummary | null;
  contact: ContactRelationshipSummary | null;
  opportunity: OpportunityLookupSummary | null;
  handoffTask: CrmTaskSummary | null;
  duplicateMatches: {
    accountMatches: LeadDuplicateMatchSummary[];
    contactMatches: LeadDuplicateMatchSummary[];
  };
}

export interface LeadsResponse {
  leads: LeadSummary[];
  pagination: CrmPagination;
}

export interface LeadOptionsResponse {
  owners: CrmLookupUserSummary[];
  statuses: CrmOptionValueSummary[];
  sources: CrmOptionValueSummary[];
  fieldDefinitions: CrmFieldDefinition[];
  customFieldOptions: Record<string, CrmOptionValueSummary[]>;
  // Lead classification: "IT Service Project" vs "Product" (single-select),
  // plus the multi-select technology / product catalogs that apply to each.
  leadForOptions: CrmOptionValueSummary[];
  technologyOptions: CrmOptionValueSummary[];
  productOptions: CrmOptionValueSummary[];
}

// Shape stored under a lead's `metadata` for lead classification.
export interface LeadClassificationMetadata {
  // "service_project" | "product" (option value key from the "lead-for" set).
  leadFor?: string | null;
  // Selected "service-technology" value keys (when leadFor = service_project).
  technologies?: string[];
  // Selected "education-product" value keys (when leadFor = product).
  products?: string[];
}

export const leadQualificationFrameworks = ["bant", "meddic", "custom"] as const;
export type LeadQualificationFramework = (typeof leadQualificationFrameworks)[number];

export interface LeadBantChecklist {
  budget: boolean;
  authority: boolean;
  need: boolean;
  timeline: boolean;
}

export interface LeadCustomQualificationField {
  id: string;
  label: string;
  value: string;
}

export interface LeadCustomQualificationFieldInput {
  id?: string;
  label: string;
  value: string;
}

export interface LeadQualificationFrameworkDefinition {
  key: LeadQualificationFramework;
  label: string;
  description: string;
  available: boolean;
}

export interface LeadWorkspaceState {
  outreachStatus: CrmOptionValueSummary | null;
  handoffStatus: CrmOptionValueSummary | null;
  callDisposition: CrmOptionValueSummary | null;
  qualificationFramework: LeadQualificationFramework;
  qualificationChecklist: LeadBantChecklist;
  qualificationChecklistCompletionCount: number;
  qualificationChecklistTotal: number;
  customQualificationFields: LeadCustomQualificationField[];
  qualificationNotes: string | null;
  // ISR-004 configurable qualification checklist (alongside the legacy BANT checklist above).
  qualificationItems: LeadQualificationItemState[];
  qualificationItemsCompletionCount: number;
  qualificationItemsTotal: number;
  qualificationItemsRequiredCount: number;
  qualificationItemsRequiredComplete: boolean;
  qualificationOutcome: LeadQualificationOutcome;
  qualificationOverrideReason: string | null;
  // ISR-006 structured disqualification reason.
  disqualificationReason: CrmOptionValueSummary | null;
  // ISR-003 configurable contact cadence state + computed view.
  cadence: LeadCadenceView;
  // Persona 7 (SDR) state.
  research: LeadAccountResearch;
  icpFit: LeadIcpFitView;
  discovery: LeadDiscoveryView;
  objections: LeadObjection[];
  noShowCount: number;
  handoffUpdatedAt: string | null;
  meddicPlaceholder: {
    available: false;
    message: string;
  };
  emailSequencePlaceholder: {
    available: false;
    message: string;
  };
  meetingBookingPlaceholder: {
    available: false;
    message: string;
  };
}

// First-contact script (ISR-002) resolved from the configurable `lead-contact-script` option set.
export const leadContactScriptMatchReasons = [
  "lead_for_and_source",
  "campaign",
  "source",
  "lead_for",
  "persona",
  "default"
] as const;
export type LeadContactScriptMatchReason = (typeof leadContactScriptMatchReasons)[number];

export interface LeadContactScriptView {
  key: string;
  label: string;
  body: string;
  matchedOn: LeadContactScriptMatchReason;
}

// Configurable qualification checklist item (ISR-004) from the `lead-qualification-checklist` option set.
export interface LeadQualificationChecklistItemDefinition {
  key: string;
  label: string;
  description: string | null;
  required: boolean;
  sortOrder: number;
}

export interface LeadQualificationItemState {
  key: string;
  label: string;
  required: boolean;
  completed: boolean;
}

export const leadQualificationOutcomes = ["pending", "qualified", "not_qualified"] as const;
export type LeadQualificationOutcome = (typeof leadQualificationOutcomes)[number];

export const leadWorkspacePriorities = ["hot", "high", "medium", "low"] as const;
export type LeadWorkspacePriority = (typeof leadWorkspacePriorities)[number];

// ISR-003: configurable contact cadence from the `lead-cadence-step` option set.
export const leadCadenceChannels = ["call", "email", "sms", "whatsapp", "linkedin", "follow_up"] as const;
export type LeadCadenceChannel = (typeof leadCadenceChannels)[number];

export interface LeadCadenceStepDefinition {
  key: string;
  label: string;
  channel: LeadCadenceChannel;
  offsetHours: number;
  order: number;
}

export const leadCadenceStepStatuses = ["completed", "overdue", "due", "upcoming"] as const;
export type LeadCadenceStepStatus = (typeof leadCadenceStepStatuses)[number];

export interface LeadCadenceStepView extends LeadCadenceStepDefinition {
  completed: boolean;
  dueAt: string | null;
  status: LeadCadenceStepStatus;
}

export interface LeadCadenceView {
  configured: boolean;
  paused: boolean;
  pauseReason: string | null;
  steps: LeadCadenceStepView[];
  currentStep: LeadCadenceStepView | null;
  nextDueAt: string | null;
  completedCount: number;
  totalCount: number;
  failedAttemptCount: number;
  failedAttemptsBeforeNurture: number;
  movedToNurture: boolean;
}

export interface UpdateLeadCadenceInput {
  paused?: boolean;
  pauseReason?: string | null;
  completeStepKey?: string;
  logFailedAttempt?: boolean;
}

// ISR-005: meeting booking.
export interface LeadMeetingTypeDefinition {
  key: string;
  label: string;
}

export interface ScheduleLeadMeetingRequestBody {
  meetingTypeKey: string;
  title: string;
  agenda?: string | null;
  scheduledAt: string;
  durationMinutes?: number;
  participantUserIds?: string[];
  reminderMinutesBefore?: number;
}

// ---- Persona 7 (SDR) ----------------------------------------------------------------------------

// SDR-001: AI-assisted account research (capture + sources + confidence; generation is a placeholder).
export const leadResearchConfidences = ["high", "medium", "low"] as const;
export type LeadResearchConfidence = (typeof leadResearchConfidences)[number];

export interface LeadAccountResearch {
  companyProfile: string | null;
  industry: string | null;
  size: string | null;
  leadership: string | null;
  locations: string | null;
  likelyNeeds: string | null;
  recentSignals: string | null;
  talkingPoints: string | null;
  sources: string[];
  confidence: LeadResearchConfidence | null;
  savedAt: string | null;
}

export interface LeadAccountResearchInput {
  companyProfile?: string | null;
  industry?: string | null;
  size?: string | null;
  leadership?: string | null;
  locations?: string | null;
  likelyNeeds?: string | null;
  recentSignals?: string | null;
  talkingPoints?: string | null;
  sources?: string[];
  confidence?: LeadResearchConfidence | null;
}

// SDR-002: ICP fit assessment.
export const leadIcpFitBands = ["high", "medium", "low"] as const;
export type LeadIcpFitBand = (typeof leadIcpFitBands)[number];

export const leadStrategicValues = ["high", "medium", "low"] as const;
export type LeadStrategicValue = (typeof leadStrategicValues)[number];

export interface LeadIcpCriterionDefinition {
  key: string;
  label: string;
  weight: number;
}

export interface LeadIcpAttributes {
  industry: string | null;
  segment: string | null;
  size: string | null;
  geography: string | null;
  useCase: string | null;
  budget: string | null;
  strategicValue: LeadStrategicValue | null;
}

export interface LeadIcpExplanationEntry {
  key: string;
  label: string;
  satisfied: boolean;
  weight: number;
  contribution: number;
}

export interface LeadIcpFitView {
  configured: boolean;
  band: LeadIcpFitBand;
  score: number;
  explanation: LeadIcpExplanationEntry[];
  attributes: LeadIcpAttributes;
}

// SDR-003: structured discovery call form (configurable fields).
export interface LeadDiscoveryFieldDefinition {
  key: string;
  label: string;
  description: string | null;
  required: boolean;
  sortOrder: number;
}

export interface LeadDiscoveryItemState {
  key: string;
  label: string;
  required: boolean;
  value: string;
  completed: boolean;
}

export interface LeadDiscoveryView {
  items: LeadDiscoveryItemState[];
  completionCount: number;
  total: number;
  requiredCount: number;
  requiredComplete: boolean;
}

// SDR-006: objection capture.
export interface LeadObjectionTypeDefinition {
  key: string;
  label: string;
}

export interface LeadObjection {
  id: string;
  typeKey: string;
  typeLabel: string | null;
  note: string | null;
  capturedAt: string;
}

export interface LeadObjectionInput {
  typeKey: string;
  note?: string | null;
}

export interface LeadObjectionTrendEntry {
  typeKey: string;
  label: string;
  count: number;
}

// SDR-005: no-show workflow.
export interface MarkLeadNoShowRequestBody {
  reschedule?: boolean;
  note?: string | null;
}

export interface MarkLeadNoShowResponse {
  lead: SalesWorkspaceLeadSummary;
  noShowCount: number;
  routedTo: "nurture" | "disqualified" | null;
}

export interface SalesWorkspaceAiPlaceholderAction {
  key:
    | "call_script_generator"
    | "objection_handling"
    | "lead_research_summary"
    | "follow_up_email_generator"
    | "qualification_score"
    | "best_contact_recommendation"
    | "lead_summary"
    | "call_note_summary"
    | "qualification_outcome_suggestion"
    | "account_research"
    | "discovery_summary"
    | "icp_explanation";
  label: string;
  description: string;
}

export interface SalesWorkspaceAiPlaceholderSummary {
  actions: SalesWorkspaceAiPlaceholderAction[];
  governanceHint: string;
}

export interface SalesWorkspaceLeadSummary extends LeadSummary {
  workspace: LeadWorkspaceState;
  openTaskCount: number;
  openCallTaskCount: number;
  overdueTaskCount: number;
  nextOpenTaskDueAt: string | null;
  // ISR-001 prioritized lead queue enrichment.
  priority: LeadWorkspacePriority;
  isHot: boolean;
  scoreGrade: string | null;
  productSummary: string | null;
  slaDueAt: string | null;
  slaStatus: SlaStatus | null;
  slaLabel: string | null;
  slaRemainingHours: number | null;
  slaBreachAlert: boolean;
  firstContactScript: LeadContactScriptView | null;
}

export interface SalesWorkspaceTaskSummary extends CrmTaskSummary {
  lead: {
    id: string;
    fullName: string;
    companyName: string;
    owner: CrmLookupUserSummary | null;
    status: CrmOptionValueSummary | null;
  };
}

export interface SalesWorkspaceOptionsResponse {
  owners: CrmLookupUserSummary[];
  leadStatuses: CrmOptionValueSummary[];
  leadSources: CrmOptionValueSummary[];
  outreachStatuses: CrmOptionValueSummary[];
  handoffStatuses: CrmOptionValueSummary[];
  callDispositions: CrmOptionValueSummary[];
  qualificationFrameworks: LeadQualificationFrameworkDefinition[];
  disqualificationReasons: CrmOptionValueSummary[];
  qualificationChecklistItems: LeadQualificationChecklistItemDefinition[];
  qualificationOutcomes: CrmOptionValueSummary[];
  cadenceSteps: LeadCadenceStepDefinition[];
  meetingTypes: LeadMeetingTypeDefinition[];
  discoveryFields: LeadDiscoveryFieldDefinition[];
  objectionTypes: LeadObjectionTypeDefinition[];
  icpCriteria: LeadIcpCriterionDefinition[];
  opportunityStages: CrmOptionValueSummary[];
}

export interface SdrWorkspaceResponse {
  dashboard: {
    assignedLeadCount: number;
    prospectingLeadCount: number;
    activeOutreachCount: number;
    callTaskCount: number;
    meetingBookedCount: number;
    readyForHandoffCount: number;
  };
  assignedLeads: SalesWorkspaceLeadSummary[];
  prospectingQueue: SalesWorkspaceLeadSummary[];
  callTaskList: SalesWorkspaceTaskSummary[];
  // SDR-002 ICP fit distribution + SDR-006 objection trends across the visible pipeline.
  icpFitDistribution: { high: number; medium: number; low: number };
  objectionTrends: LeadObjectionTrendEntry[];
  aiPlaceholders: SalesWorkspaceAiPlaceholderSummary;
}

export interface InsideSalesWorkspaceResponse {
  dashboard: {
    leadQueueCount: number;
    callQueueCount: number;
    followUpTaskCount: number;
    qualifiedLeadCount: number;
    handedOffLeadCount: number;
    completedCallCount: number;
  };
  leadQueue: SalesWorkspaceLeadSummary[];
  callQueue: SalesWorkspaceTaskSummary[];
  followUpTasks: SalesWorkspaceTaskSummary[];
  aiPlaceholders: SalesWorkspaceAiPlaceholderSummary;
}

export interface UpdateLeadWorkspaceRequestBody {
  statusKey?: string;
  ownerId?: string | null;
  outreachStatusKey?: string | null;
  handoffStatusKey?: string | null;
  callDispositionKey?: string | null;
  qualificationFramework?: LeadQualificationFramework;
  qualificationChecklist?: Partial<LeadBantChecklist>;
  customQualificationFields?: LeadCustomQualificationFieldInput[];
  qualificationNotes?: string | null;
  // ISR-004 configurable qualification checklist answers keyed by item value_key.
  qualificationItems?: Record<string, boolean>;
  qualificationOutcome?: LeadQualificationOutcome;
  qualificationOverrideReason?: string | null;
  // ISR-006 structured disqualification reason (mandatory when moving a lead to disqualified).
  disqualificationReasonKey?: string | null;
  // ISR-003 cadence controls (advance a step, pause with reason, log a failed attempt).
  cadence?: UpdateLeadCadenceInput;
  // Persona 7 (SDR) capture: account research, ICP attributes, discovery answers, objections.
  research?: LeadAccountResearchInput;
  icpAttributes?: Partial<LeadIcpAttributes>;
  discovery?: Record<string, string>;
  addObjection?: LeadObjectionInput;
  removeObjectionId?: string;
  metadata?: Record<string, unknown>;
}

export interface SalesWorkspaceLeadResponse {
  lead: SalesWorkspaceLeadSummary;
}

export interface ScheduleLeadMeetingResponse {
  lead: SalesWorkspaceLeadSummary;
  meeting: {
    activityId: string;
    meetingTaskId: string;
    reminderTaskId: string;
    deliveryPlaceholder: {
      available: false;
      message: string;
    };
  };
}

export const accountSortFields = ["createdAt", "updatedAt", "name", "accountType", "industry", "owner"] as const;
export type AccountSortField = (typeof accountSortFields)[number];

export interface AccountListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  accountType?: string;
  industry?: string;
  ownerId?: string;
  sortBy?: AccountSortField;
  sortOrder?: CrmSortOrder;
}

export interface AccountLookupSummary {
  id: string;
  name: string;
  website: string | null;
}

export interface ContactRelationshipSummary {
  id: string;
  fullName: string;
  email: string | null;
  role: CrmOptionValueSummary | null;
}

export interface AccountSummary {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  accountType: CrmOptionValueSummary | null;
  healthStatus: CrmOptionValueSummary | null;
  owner: CrmLookupUserSummary | null;
  contactCount: number;
  noteCount: number;
  activityCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AccountDetail extends AccountSummary {
  customFields: Record<string, unknown>;
  notes: CrmNoteSummary[];
  activities: CrmActivitySummary[];
  tasks: CrmTaskSummary[];
  timeline: CrmTimelineItem[];
  relatedContacts: ContactRelationshipSummary[];
  relatedOpportunitiesPlaceholder: {
    available: false;
    message: string;
  };
}

export interface CreateAccountRequestBody {
  name: string;
  website?: string | null;
  industry?: string | null;
  accountTypeKey?: string | null;
  healthStatusKey?: string | null;
  ownerId?: string | null;
  metadata?: Record<string, unknown>;
  customFields?: Record<string, unknown>;
}

export interface UpdateAccountRequestBody {
  name?: string;
  website?: string | null;
  industry?: string | null;
  accountTypeKey?: string | null;
  healthStatusKey?: string | null;
  ownerId?: string | null;
  metadata?: Record<string, unknown>;
  customFields?: Record<string, unknown>;
}

export interface AccountResponse {
  account: AccountDetail;
}

export interface AccountsResponse {
  accounts: AccountSummary[];
  pagination: CrmPagination;
}

export interface AccountOptionsResponse {
  owners: CrmLookupUserSummary[];
  accountTypes: CrmOptionValueSummary[];
  healthStatuses: CrmOptionValueSummary[];
  fieldDefinitions: CrmFieldDefinition[];
  customFieldOptions: Record<string, CrmOptionValueSummary[]>;
}

// ---- Persona 10 (Enterprise Sales) — account level ---------------------------------------------

// ES-001: strategic account plan (stored in account metadata.strategicPlan).
export const strategicPlanReviewStatuses = ["draft", "in_review", "reviewed"] as const;
export type StrategicPlanReviewStatus = (typeof strategicPlanReviewStatuses)[number];

export interface StrategicAccountPlanState {
  accountOverview: string | null;
  businessUnits: string | null;
  stakeholders: string | null;
  systems: string | null;
  painPoints: string | null;
  opportunities: string | null;
  competitors: string | null;
  revenuePotential: number | null;
  risks: string | null;
  actionPlan: string | null;
  reviewStatus: StrategicPlanReviewStatus;
  reviewerUserId: string | null;
  reviewRequestedAt: string | null;
  updatedAt: string | null;
}

// ES-004: executive engagement (stored in account metadata.executiveEngagement.meetings).
export interface ExecutiveMeeting {
  id: string;
  contactId: string | null;
  contactName: string | null;
  notes: string | null;
  commitments: string | null;
  followUps: string | null;
  meetingDate: string | null;
  createdAt: string;
}

export const executiveEngagementBands = ["low", "medium", "high"] as const;
export type ExecutiveEngagementBand = (typeof executiveEngagementBands)[number];

export interface ExecutiveEngagementView {
  score: number;
  band: ExecutiveEngagementBand;
  meetingCount: number;
  commitmentCount: number;
  followUpCount: number;
  meetings: ExecutiveMeeting[];
}

export interface AccountEnterpriseView {
  strategicPlan: StrategicAccountPlanState;
  executiveEngagement: ExecutiveEngagementView;
  whitespacePlaceholder: { available: false; message: string };
}

export interface AccountEnterpriseResponse {
  accountId: string;
  enterprise: AccountEnterpriseView;
}

export interface UpsertStrategicAccountPlanRequestBody {
  accountOverview?: string | null;
  businessUnits?: string | null;
  stakeholders?: string | null;
  systems?: string | null;
  painPoints?: string | null;
  opportunities?: string | null;
  competitors?: string | null;
  revenuePotential?: number | null;
  risks?: string | null;
  actionPlan?: string | null;
}

export interface SubmitAccountPlanReviewRequestBody {
  reviewerUserId: string;
  note?: string | null;
}

export interface AddExecutiveMeetingRequestBody {
  contactId?: string | null;
  contactName: string;
  notes?: string | null;
  commitments?: string | null;
  followUps?: string | null;
  meetingDate?: string | null;
}

export const contactSortFields = [
  "createdAt",
  "updatedAt",
  "name",
  "email",
  "account",
  "role",
  "owner"
] as const;
export type ContactSortField = (typeof contactSortFields)[number];

export interface ContactListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  accountId?: string;
  role?: string;
  ownerId?: string;
  sortBy?: ContactSortField;
  sortOrder?: CrmSortOrder;
}

export interface ContactSummary {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  role: CrmOptionValueSummary | null;
  owner: CrmLookupUserSummary | null;
  account: AccountLookupSummary | null;
  noteCount: number;
  activityCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ContactDetail extends ContactSummary {
  customFields: Record<string, unknown>;
  notes: CrmNoteSummary[];
  activities: CrmActivitySummary[];
  tasks: CrmTaskSummary[];
  timeline: CrmTimelineItem[];
}

export interface CreateContactRequestBody {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  roleKey?: string | null;
  ownerId?: string | null;
  accountId?: string | null;
  metadata?: Record<string, unknown>;
  customFields?: Record<string, unknown>;
}

export interface UpdateContactRequestBody {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  roleKey?: string | null;
  ownerId?: string | null;
  accountId?: string | null;
  metadata?: Record<string, unknown>;
  customFields?: Record<string, unknown>;
}

export interface ContactResponse {
  contact: ContactDetail;
}

export interface ContactsResponse {
  contacts: ContactSummary[];
  pagination: CrmPagination;
}

export interface ContactOptionsResponse {
  owners: CrmLookupUserSummary[];
  roles: CrmOptionValueSummary[];
  accounts: AccountLookupSummary[];
  fieldDefinitions: CrmFieldDefinition[];
  customFieldOptions: Record<string, CrmOptionValueSummary[]>;
}

export const opportunitySortFields = [
  "createdAt",
  "updatedAt",
  "name",
  "stage",
  "amount",
  "probability",
  "expectedCloseDate",
  "owner",
  "account",
  "outcomeStatus"
] as const;
export type OpportunitySortField = (typeof opportunitySortFields)[number];

export const opportunityPipelineScopes = ["mine", "team", "all"] as const;
export type OpportunityPipelineScope = (typeof opportunityPipelineScopes)[number];

export interface OpportunityListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  stage?: string;
  source?: string;
  ownerId?: string;
  accountId?: string;
  contactId?: string;
  outcomeStatus?: string;
  expectedCloseFrom?: string;
  expectedCloseTo?: string;
  stalledDays?: number;
  scope?: OpportunityPipelineScope;
  sortBy?: OpportunitySortField;
  sortOrder?: CrmSortOrder;
}

export const opportunityStakeholderSentiments = ["positive", "neutral", "negative"] as const;
export type OpportunityStakeholderSentiment = (typeof opportunityStakeholderSentiments)[number];
export const opportunityInfluenceLevels = ["low", "medium", "high", "champion", "blocker"] as const;
export type OpportunityInfluenceLevel = (typeof opportunityInfluenceLevels)[number];
export const opportunityRelationshipStrengths = ["none", "developing", "engaged", "strong"] as const;
export type OpportunityRelationshipStrength = (typeof opportunityRelationshipStrengths)[number];

// AE-003: stakeholder mapping enrichment (stored in opportunity metadata keyed by contact id).
export interface OpportunityStakeholderSummary extends ContactRelationshipSummary {
  roleKey: string | null;
  roleLabel: string | null;
  influence: OpportunityInfluenceLevel | null;
  sentiment: OpportunityStakeholderSentiment | null;
  relationship: OpportunityRelationshipStrength | null;
}

export interface OpportunityStakeholderProfileInput {
  contactId: string;
  roleKey?: string | null;
  influence?: OpportunityInfluenceLevel | null;
  sentiment?: OpportunityStakeholderSentiment | null;
  relationship?: OpportunityRelationshipStrength | null;
}

export interface OpportunityPlaceholderSurface {
  available: false;
  message: string;
}

export interface OpportunityAiPlaceholderAction {
  key:
    | "opportunity_summary"
    | "deal_risk"
    | "next_best_action"
    | "proposal_draft"
    | "win_probability"
    | "discovery_summary"
    | "engagement_strategy"
    | "negotiation_risk"
    | "lessons_learned";
  label: string;
  description: string;
}

export interface OpportunityAiPlaceholderSummary {
  actions: OpportunityAiPlaceholderAction[];
  governanceHint: string;
}

export interface OpportunityStageDistributionItem {
  stage: CrmOptionValueSummary | null;
  opportunityCount: number;
  totalAmount: number;
}

export interface OpportunitySummary {
  id: string;
  name: string;
  account: AccountLookupSummary | null;
  primaryContact: ContactRelationshipSummary | null;
  owner: CrmLookupUserSummary | null;
  stage: CrmOptionValueSummary | null;
  source: CrmOptionValueSummary | null;
  outcomeStatus: CrmOptionValueSummary | null;
  amount: number | null;
  probability: number | null;
  expectedCloseDate: string | null;
  competitor: string | null;
  nextStep: string | null;
  winLossReason: string | null;
  stakeholderCount: number;
  noteCount: number;
  activityCount: number;
  lastActivityAt: string | null;
  lastStageChangedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityDetail extends OpportunitySummary {
  customFields: Record<string, unknown>;
  stakeholders: OpportunityStakeholderSummary[];
  notes: CrmNoteSummary[];
  activities: CrmActivitySummary[];
  tasks: CrmTaskSummary[];
  timeline: CrmTimelineItem[];
  productsServicesPlaceholder: OpportunityPlaceholderSurface;
  forecastPlaceholder: OpportunityPlaceholderSurface;
  dealRiskPlaceholder: OpportunityPlaceholderSurface;
  // Persona 9 (AE) workspace state.
  execWorkspace: OpportunityExecWorkspace;
  // Persona 10 (Enterprise Sales) state.
  enterprise: OpportunityEnterpriseView;
  // Persona 12 (Sales Manager) deal-review history.
  managerDealReviews: OpportunityDealReviewEntry[];
  // Persona 15 (Solution Architect) summary (full detail via /solution-architecture).
  architectureSummary: OpportunityArchitectureSummary;
  // Persona 18 (Legal / Contract Reviewer) summary (full detail via /legal).
  legalSummary: OpportunityLegalSummary;
  aiPlaceholders: OpportunityAiPlaceholderSummary;
}

export interface CreateOpportunityRequestBody {
  name: string;
  accountId?: string | null;
  primaryContactId?: string | null;
  ownerId?: string | null;
  stageKey: string;
  amount?: number | null;
  probability?: number | null;
  expectedCloseDate?: string | null;
  sourceKey: string;
  competitor?: string | null;
  stakeholderContactIds?: string[];
  nextStep?: string | null;
  outcomeStatusKey?: string | null;
  outcomeReason?: string | null;
  metadata?: Record<string, unknown>;
  customFields?: Record<string, unknown>;
}

export interface UpdateOpportunityRequestBody {
  name?: string;
  accountId?: string | null;
  primaryContactId?: string | null;
  ownerId?: string | null;
  stageKey?: string;
  amount?: number | null;
  probability?: number | null;
  expectedCloseDate?: string | null;
  sourceKey?: string;
  competitor?: string | null;
  stakeholderContactIds?: string[];
  nextStep?: string | null;
  outcomeStatusKey?: string | null;
  outcomeReason?: string | null;
  metadata?: Record<string, unknown>;
  customFields?: Record<string, unknown>;
}

export interface OpportunityResponse {
  opportunity: OpportunityDetail;
}

export interface OpportunitiesResponse {
  opportunities: OpportunitySummary[];
  pagination: CrmPagination;
}

export interface OpportunityOptionsResponse {
  owners: CrmLookupUserSummary[];
  accounts: AccountLookupSummary[];
  contacts: ContactRelationshipSummary[];
  stages: CrmOptionValueSummary[];
  sources: CrmOptionValueSummary[];
  outcomeStatuses: CrmOptionValueSummary[];
  availableScopes: OpportunityPipelineScope[];
  fieldDefinitions: CrmFieldDefinition[];
  customFieldOptions: Record<string, CrmOptionValueSummary[]>;
  // Persona 9 (AE) configuration.
  discoveryFields: LeadDiscoveryFieldDefinition[];
  stakeholderRoles: CrmOptionValueSummary[];
  proposalTemplates: CrmOptionValueSummary[];
  lossReasons: CrmOptionValueSummary[];
  tenderChecklistItems: OpportunityTenderChecklistItemDefinition[];
  forecastCategories: CrmOptionValueSummary[];
}

// ---- Persona 9 (Account Executive) --------------------------------------------------------------

export const opportunityAcceptanceStatuses = ["pending", "accepted", "rejected"] as const;
export type OpportunityAcceptanceStatus = (typeof opportunityAcceptanceStatuses)[number];

export interface OpportunityAcceptanceState {
  status: OpportunityAcceptanceStatus;
  acceptedAt: string | null;
  rejectedReason: string | null;
  slaStartedAt: string | null;
}

export const opportunityProposalStatuses = ["draft", "pending_approval", "approved", "sent"] as const;
export type OpportunityProposalStatus = (typeof opportunityProposalStatuses)[number];

export interface OpportunityProposalState {
  templateKey: string | null;
  scope: string | null;
  pricing: string | null;
  timeline: string | null;
  terms: string | null;
  assumptions: string | null;
  exclusions: string | null;
  executiveSummary: string | null;
  status: OpportunityProposalStatus;
  approvalId: string | null;
  updatedAt: string | null;
}

export const opportunityDiscountStatuses = ["none", "pending_approval", "approved", "rejected"] as const;
export type OpportunityDiscountStatus = (typeof opportunityDiscountStatuses)[number];

export interface OpportunityDiscountState {
  percent: number | null;
  justification: string | null;
  competitorContext: string | null;
  marginImpact: string | null;
  value: number | null;
  closeProbability: number | null;
  status: OpportunityDiscountStatus;
  approvalId: string | null;
  requestedAt: string | null;
}

export interface OpportunityNegotiationState {
  commercialAsks: string | null;
  legalAsks: string | null;
  procurementBlockers: string | null;
  competitorOffers: string | null;
  finalPrice: number | null;
  nextAction: string | null;
  updatedAt: string | null;
}

export interface OpportunityDemoState {
  useCase: string | null;
  audience: string | null;
  painPoints: string | null;
  modules: string | null;
  desiredOutcome: string | null;
  requestedDate: string | null;
  presalesOwnerId: string | null;
  presalesOwnerName: string | null;
  status: "requested" | "scheduled" | "delivered" | "cancelled";
  feedback: string | null;
  requestedAt: string | null;
}

export interface OpportunityCloseWonState {
  finalValue: number | null;
  contractStatus: string | null;
  poStatus: string | null;
  billingTerms: string | null;
  startDate: string | null;
  implementationScope: string | null;
  onboardingOwnerId: string | null;
  onboardingOwnerName: string | null;
  handoverNote: string | null;
}

export interface OpportunityCloseLostState {
  lossReasonKey: string | null;
  lossReasonLabel: string | null;
  competitor: string | null;
  revisitDate: string | null;
  reactivationStatus: "none" | "pending_approval" | "reactivated";
  reactivationApprovalId: string | null;
}

export interface OpportunityStageRequirementView {
  stageKey: string;
  requiredFields: string[];
  missingFields: string[];
  satisfied: boolean;
}

// AE workspace state assembled on the opportunity detail.
export interface OpportunityExecWorkspace {
  acceptance: OpportunityAcceptanceState;
  discovery: LeadDiscoveryView;
  buyingCommittee: BdBuyingCommitteeView;
  negotiation: OpportunityNegotiationState;
  proposal: OpportunityProposalState | null;
  discount: OpportunityDiscountState;
  demo: OpportunityDemoState | null;
  closeWon: OpportunityCloseWonState | null;
  closeLost: OpportunityCloseLostState | null;
  stageRequirement: OpportunityStageRequirementView;
}

export interface AcceptOpportunityRequestBody {
  slaHours?: number | null;
}

export interface RejectOpportunityRequestBody {
  reason: string;
  reassignToUserId?: string | null;
}

export interface OpportunityDiscoveryUpdateBody {
  discovery: Record<string, string>;
}

export interface OpportunityStakeholderProfilesUpdateBody {
  profiles: OpportunityStakeholderProfileInput[];
}

export interface OpportunityNegotiationUpdateBody {
  commercialAsks?: string | null;
  legalAsks?: string | null;
  procurementBlockers?: string | null;
  competitorOffers?: string | null;
  finalPrice?: number | null;
  nextAction?: string | null;
}

export interface OpportunityDemoRequestBody {
  useCase: string;
  audience?: string | null;
  painPoints?: string | null;
  modules?: string | null;
  desiredOutcome?: string | null;
  requestedDate?: string | null;
  presalesOwnerId: string;
}

export interface OpportunityDemoFeedbackBody {
  status?: OpportunityDemoState["status"];
  feedback?: string | null;
}

export interface OpportunityProposalRequestBody {
  templateKey?: string | null;
  scope?: string | null;
  pricing?: string | null;
  timeline?: string | null;
  terms?: string | null;
  assumptions?: string | null;
  exclusions?: string | null;
  executiveSummary?: string | null;
  requireApproval?: boolean;
  approverUserId?: string | null;
}

export interface OpportunityDiscountRequestBody {
  percent: number;
  justification: string;
  competitorContext?: string | null;
  marginImpact?: string | null;
  value?: number | null;
  closeProbability?: number | null;
  approverUserId: string;
}

export interface OpportunityCloseWonRequestBody {
  finalValue: number;
  contractStatus: string;
  poStatus: string;
  billingTerms: string;
  startDate: string;
  implementationScope: string;
  onboardingOwnerId: string;
  handoverNote: string;
}

export interface OpportunityCloseLostRequestBody {
  lossReasonKey: string;
  competitor?: string | null;
  revisitDate?: string | null;
}

export interface OpportunityReactivateRequestBody {
  reason: string;
  approverUserId: string;
}

// ---- Persona 10 (Enterprise Sales) — opportunity level -----------------------------------------

// ES-003: RFP / tender tracking.
export interface OpportunityTenderChecklistItemDefinition {
  key: string;
  label: string;
  required: boolean;
  sortOrder: number;
}

export interface OpportunityTenderChecklistItemState {
  key: string;
  label: string;
  required: boolean;
  completed: boolean;
}

export interface OpportunityTenderState {
  tenderNumber: string | null;
  issuingAuthority: string | null;
  deadline: string | null;
  eligibility: string | null;
  scope: string | null;
  preBidDate: string | null;
  emd: string | null;
  commercialFormat: string | null;
  checklist: Record<string, boolean>;
  tasksGenerated: boolean;
  updatedAt: string | null;
}

export interface OpportunityTenderView extends OpportunityTenderState {
  checklistItems: OpportunityTenderChecklistItemState[];
  completionCount: number;
  total: number;
  requiredComplete: boolean;
  missingDocuments: string[];
}

// ES-005: strategic deal governance.
export const opportunityDealReviewStatuses = ["draft", "pending_approval", "approved"] as const;
export type OpportunityDealReviewStatus = (typeof opportunityDealReviewStatuses)[number];

export interface OpportunityDealReviewState {
  solutionFit: string | null;
  pricing: string | null;
  legal: string | null;
  risk: string | null;
  deliveryReadiness: string | null;
  leadershipSupport: string | null;
  status: OpportunityDealReviewStatus;
  approvalId: string | null;
  updatedAt: string | null;
}

// ES-002: multi-opportunity roll-up.
export interface OpportunityRollupStageEntry {
  stageKey: string;
  stageLabel: string;
  count: number;
  value: number;
}

export interface OpportunityRollup {
  childCount: number;
  totalValue: number;
  weightedValue: number;
  byStage: OpportunityRollupStageEntry[];
}

export interface OpportunityRollupChild {
  id: string;
  name: string;
  stageKey: string | null;
  stageLabel: string | null;
  amount: number | null;
  probability: number | null;
  expectedCloseDate: string | null;
}

export interface OpportunityEnterpriseView {
  parentOpportunityId: string | null;
  parent: OpportunityLookupSummary | null;
  children: OpportunityRollupChild[];
  rollup: OpportunityRollup;
  tender: OpportunityTenderView | null;
  dealReview: OpportunityDealReviewState;
  dealReviewThreshold: number;
  dealReviewRequired: boolean;
  dealReviewComplete: boolean;
}

export interface SetOpportunityParentRequestBody {
  parentOpportunityId: string | null;
}

export interface UpsertOpportunityTenderRequestBody {
  tenderNumber?: string | null;
  issuingAuthority?: string | null;
  deadline?: string | null;
  eligibility?: string | null;
  scope?: string | null;
  preBidDate?: string | null;
  emd?: string | null;
  commercialFormat?: string | null;
  generateTasks?: boolean;
}

export interface OpportunityTenderChecklistUpdateBody {
  checklist: Record<string, boolean>;
}

export interface UpsertOpportunityDealReviewRequestBody {
  solutionFit?: string | null;
  pricing?: string | null;
  legal?: string | null;
  risk?: string | null;
  deliveryReadiness?: string | null;
  leadershipSupport?: string | null;
  submitForApproval?: boolean;
  approverUserId?: string | null;
}

export interface OpportunityDashboardResponse {
  scope: OpportunityPipelineScope;
  visibleCount: number;
  pipelineValue: number;
  closingThisMonthCount: number;
  closingThisMonthValue: number;
  stalledDealsCount: number;
  stalledDealsValue: number;
  stageDistribution: OpportunityStageDistributionItem[];
  forecastPlaceholder: OpportunityPlaceholderSurface;
  dealRiskPlaceholder: OpportunityPlaceholderSurface;
}

// ---- Persona 12 (Sales Manager) ----------------------------------------------------------------

export const managerDealRisks = ["low", "medium", "high"] as const;
export type ManagerDealRisk = (typeof managerDealRisks)[number];

export interface ManagerOwnerPipeline {
  owner: CrmLookupUserSummary | null;
  openCount: number;
  pipelineValue: number;
  weightedValue: number;
}

export interface ManagerAgingBucket {
  bucket: string;
  count: number;
  value: number;
}

export interface ManagerPipelineDeal {
  id: string;
  name: string;
  owner: CrmLookupUserSummary | null;
  stage: CrmOptionValueSummary | null;
  amount: number | null;
  probability: number | null;
  expectedCloseDate: string | null;
  ageDays: number;
  risk: ManagerDealRisk;
  riskReasons: string[];
}

export interface ManagerPipelineResponse {
  totalOpen: number;
  pipelineValue: number;
  weightedValue: number;
  byOwner: ManagerOwnerPipeline[];
  byStage: OpportunityStageDistributionItem[];
  aging: ManagerAgingBucket[];
  highRiskDeals: ManagerPipelineDeal[];
  aiPlaceholder: { available: false; message: string };
}

export interface ManagerPerformanceRep {
  owner: CrmLookupUserSummary | null;
  openCount: number;
  wonCount: number;
  lostCount: number;
  winRate: number;
  conversionRate: number;
  avgDealSize: number;
  avgCycleDays: number;
}

export interface ManagerPerformanceResponse {
  reps: ManagerPerformanceRep[];
  aiPlaceholder: { available: false; message: string };
}

export interface ManagerForecastCategoryEntry {
  category: CrmOptionValueSummary | null;
  count: number;
  value: number;
}

export interface ManagerForecastResponse {
  categories: ManagerForecastCategoryEntry[];
  wonValue: number;
  openWeightedValue: number;
  aiPlaceholder: { available: false; message: string };
}

export interface OpportunityDealReviewEntry {
  id: string;
  stage: string | null;
  closeDate: string | null;
  nextStep: string | null;
  stakeholders: string | null;
  competitor: string | null;
  risks: string | null;
  blockers: string | null;
  probability: number | null;
  comments: string | null;
  reviewedBy: CrmLookupUserSummary | null;
  createdAt: string;
}

export interface AddOpportunityDealReviewRequestBody {
  closeDate?: string | null;
  nextStep?: string | null;
  stakeholders?: string | null;
  competitor?: string | null;
  risks?: string | null;
  blockers?: string | null;
  probability?: number | null;
  comments: string;
}

export interface SetOpportunityForecastRequestBody {
  forecastCategoryKey?: string | null;
  managerOverrideCategoryKey?: string | null;
  overrideReason?: string | null;
}

export interface CreateCoachingTaskRequestBody {
  assigneeUserId: string;
  title: string;
  description?: string | null;
  dueAt?: string | null;
}

export interface ManagerLeadSlaLead {
  id: string;
  fullName: string;
  companyName: string;
  owner: CrmLookupUserSummary | null;
  status: CrmOptionValueSummary | null;
  slaStatus: SlaStatus | null;
  slaDueAt: string | null;
  untouched: boolean;
  accepted: boolean;
}

export interface ManagerLeadSlaResponse {
  assignedCount: number;
  acceptedCount: number;
  overdueFirstContactCount: number;
  untouchedCount: number;
  breachedCount: number;
  leads: ManagerLeadSlaLead[];
}

export interface ReassignLeadRequestBody {
  ownerId: string;
  reason: string;
}

export const campaignSortFields = [
  "createdAt",
  "updatedAt",
  "name",
  "status",
  "startDate",
  "endDate",
  "budget",
  "owner"
] as const;
export type CampaignSortField = (typeof campaignSortFields)[number];

export const campaignMemberEntityTypes = ["lead", "contact", "account"] as const;
export type CampaignMemberEntityType = (typeof campaignMemberEntityTypes)[number];

export interface CampaignListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  type?: string;
  channel?: string;
  ownerId?: string;
  sortBy?: CampaignSortField;
  sortOrder?: CrmSortOrder;
}

export interface CampaignAssetReference {
  label: string;
  url: string;
  assetType: string | null;
}

export interface CampaignMemberRecordSummary {
  entityType: CampaignMemberEntityType;
  id: string;
  label: string;
  secondaryLabel: string | null;
}

export interface CampaignMemberSummary {
  id: string;
  record: CampaignMemberRecordSummary;
  status: CrmOptionValueSummary | null;
  response: string | null;
  conversionPlaceholder: {
    available: false;
    message: string;
  };
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignPerformancePlaceholder {
  impressions: null;
  responses: null;
  conversions: null;
  roi: null;
  message: string;
}

export interface CampaignAiPlaceholderAction {
  key: "campaign_plan_generator" | "content_generator" | "audience_suggestion";
  label: string;
  description: string;
}

export interface CampaignAiPlaceholderSummary {
  actions: CampaignAiPlaceholderAction[];
  governanceHint: string;
}

export interface CampaignSummary {
  id: string;
  name: string;
  description: string | null;
  type: CrmOptionValueSummary | null;
  objective: CrmOptionValueSummary | null;
  status: CrmOptionValueSummary | null;
  channel: CrmOptionValueSummary | null;
  targetAudience: string | null;
  budgetAmount: number | null;
  owner: CrmLookupUserSummary | null;
  memberCount: number;
  taskCount: number;
  noteCount: number;
  activityCount: number;
  lastActivityAt: string | null;
  startDate: string | null;
  endDate: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignDetail extends CampaignSummary {
  relatedAssets: CampaignAssetReference[];
  members: CampaignMemberSummary[];
  performancePlaceholder: CampaignPerformancePlaceholder;
  calendarPlaceholder: {
    available: false;
    message: string;
  };
  aiPlaceholders: CampaignAiPlaceholderSummary;
}

export interface CreateCampaignRequestBody {
  name: string;
  description?: string | null;
  typeKey: string;
  objectiveKey: string;
  targetAudience?: string | null;
  budgetAmount?: number | null;
  ownerId?: string | null;
  statusKey: string;
  startDate?: string | null;
  endDate?: string | null;
  channelKey: string;
  relatedAssets?: CampaignAssetReference[];
  metadata?: Record<string, unknown>;
}

export interface UpdateCampaignRequestBody {
  name?: string;
  description?: string | null;
  typeKey?: string;
  objectiveKey?: string;
  targetAudience?: string | null;
  budgetAmount?: number | null;
  ownerId?: string | null;
  statusKey?: string;
  startDate?: string | null;
  endDate?: string | null;
  channelKey?: string;
  relatedAssets?: CampaignAssetReference[];
  metadata?: Record<string, unknown>;
}

export interface CreateCampaignMemberRequestBody {
  memberEntityType: CampaignMemberEntityType;
  memberEntityId: string;
  statusKey?: string | null;
  response?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateCampaignMemberRequestBody {
  statusKey?: string | null;
  response?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CampaignResponse {
  campaign: CampaignDetail;
}

export interface CampaignsResponse {
  campaigns: CampaignSummary[];
  pagination: CrmPagination;
}

export interface CampaignMemberResponse {
  member: CampaignMemberSummary;
}

export interface CampaignMembersResponse {
  members: CampaignMemberSummary[];
}

export interface CampaignOptionsResponse {
  owners: CrmLookupUserSummary[];
  types: CrmOptionValueSummary[];
  objectives: CrmOptionValueSummary[];
  statuses: CrmOptionValueSummary[];
  channels: CrmOptionValueSummary[];
  memberStatuses: CrmOptionValueSummary[];
  leadCandidates: CampaignMemberRecordSummary[];
  contactCandidates: CampaignMemberRecordSummary[];
  accountCandidates: CampaignMemberRecordSummary[];
}

export const socialPostSortFields = [
  "createdAt",
  "updatedAt",
  "title",
  "scheduledAt",
  "status",
  "approvalStatus",
  "campaign",
  "owner"
] as const;
export type SocialPostSortField = (typeof socialPostSortFields)[number];

export interface SocialPostListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  approvalStatus?: string;
  channel?: string;
  ownerId?: string;
  campaignId?: string;
  scheduledFrom?: string;
  scheduledTo?: string;
  sortBy?: SocialPostSortField;
  sortOrder?: CrmSortOrder;
}

export interface SocialLinkedCampaignSummary {
  id: string;
  name: string;
  status: CrmOptionValueSummary | null;
}

export interface SocialEngagementPlaceholder {
  impressions: null;
  reactions: null;
  comments: null;
  shares: null;
  clicks: null;
  message: string;
}

export interface SocialPlaceholderSurface {
  available: false;
  message: string;
}

export interface SocialAiPlaceholderAction {
  key:
    | "generate_caption"
    | "suggest_hashtags"
    | "generate_creative_brief"
    | "summarize_engagement"
    | "detect_lead_intent";
  label: string;
  description: string;
}

export interface SocialAiPlaceholderSummary {
  actions: SocialAiPlaceholderAction[];
  governanceHint: string;
}

export interface SocialPostSummary {
  id: string;
  title: string;
  caption: string | null;
  creativeBrief: string | null;
  hashtags: string[];
  scheduledAt: string | null;
  status: CrmOptionValueSummary | null;
  approvalStatus: CrmOptionValueSummary | null;
  channels: CrmOptionValueSummary[];
  owner: CrmLookupUserSummary | null;
  campaign: SocialLinkedCampaignSummary | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SocialPostDetail extends SocialPostSummary {
  engagementPlaceholder: SocialEngagementPlaceholder;
  leadCapturePlaceholder: SocialPlaceholderSurface;
  listeningPlaceholder: SocialPlaceholderSurface;
  competitorTrackingPlaceholder: SocialPlaceholderSurface;
  aiPlaceholders: SocialAiPlaceholderSummary;
}

export interface CreateSocialPostRequestBody {
  title: string;
  caption?: string | null;
  creativeBrief?: string | null;
  hashtags?: string[];
  scheduledAt?: string | null;
  ownerId?: string | null;
  campaignId?: string | null;
  statusKey: string;
  approvalStatusKey: string;
  channelKeys: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateSocialPostRequestBody {
  title?: string;
  caption?: string | null;
  creativeBrief?: string | null;
  hashtags?: string[];
  scheduledAt?: string | null;
  ownerId?: string | null;
  campaignId?: string | null;
  statusKey?: string;
  approvalStatusKey?: string;
  channelKeys?: string[];
  metadata?: Record<string, unknown>;
}

export interface SocialPostResponse {
  post: SocialPostDetail;
}

export interface SocialPostsResponse {
  posts: SocialPostSummary[];
  pagination: CrmPagination;
}

export interface SocialChannelsResponse {
  channels: CrmOptionValueSummary[];
}

export interface SocialOptionsResponse {
  owners: CrmLookupUserSummary[];
  campaigns: SocialLinkedCampaignSummary[];
  statuses: CrmOptionValueSummary[];
  approvalStatuses: CrmOptionValueSummary[];
  channels: CrmOptionValueSummary[];
}

// ============================================================================
// Phase 12: Business Development and Presales
// ============================================================================

export const bdPipelineScopes = ["mine", "team", "all"] as const;
export type BdPipelineScope = (typeof bdPipelineScopes)[number];

export const bdTargetAccountSortFields = [
  "name",
  "tier",
  "stage",
  "owner",
  "annualRevenue",
  "updatedAt",
  "createdAt"
] as const;
export type BdTargetAccountSortField = (typeof bdTargetAccountSortFields)[number];

export const bdInfluenceLevels = ["low", "medium", "high", "champion", "blocker"] as const;
export type BdInfluenceLevel = (typeof bdInfluenceLevels)[number];

export const bdRelationshipStrengths = ["none", "developing", "engaged", "strong"] as const;
export type BdRelationshipStrength = (typeof bdRelationshipStrengths)[number];

export interface BdTargetAccountListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  tier?: string;
  stage?: string;
  partnershipType?: string;
  ownerId?: string;
  isPartnership?: boolean;
  scope?: BdPipelineScope;
  sortBy?: BdTargetAccountSortField;
  sortOrder?: CrmSortOrder;
}

export interface BdPlaceholderSurface {
  available: false;
  message: string;
}

export interface BdAiPlaceholderAction {
  key:
    | "account_research_brief"
    | "stakeholder_map"
    | "high_potential_accounts"
    | "buying_committee_gap"
    | "sequence_message"
    | "buying_signal_accounts";
  label: string;
  description: string;
}

export interface BdAiPlaceholderSummary {
  actions: BdAiPlaceholderAction[];
  governanceHint: string;
}

export interface BdAccountStakeholderSummary {
  id: string;
  name: string;
  title: string | null;
  contact: ContactRelationshipSummary | null;
  influenceLevel: BdInfluenceLevel;
  relationshipStrength: BdRelationshipStrength;
  isExecutive: boolean;
  // BDR-002 buying-committee role.
  buyerRole: CrmOptionValueSummary | null;
  lastEngagementAt: string | null;
  engagementNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BdAccountStakeholderInput {
  id?: string;
  contactId?: string | null;
  name: string;
  title?: string | null;
  influenceLevel?: BdInfluenceLevel;
  relationshipStrength?: BdRelationshipStrength;
  isExecutive?: boolean;
  buyerRoleKey?: string | null;
  lastEngagementAt?: string | null;
  engagementNotes?: string | null;
}

export interface BdTargetAccountSummary {
  id: string;
  name: string;
  account: AccountLookupSummary | null;
  owner: CrmLookupUserSummary | null;
  tier: CrmOptionValueSummary | null;
  stage: CrmOptionValueSummary | null;
  partnershipType: CrmOptionValueSummary | null;
  industry: string | null;
  region: string | null;
  annualRevenue: number | null;
  employeeCount: number | null;
  marketOpportunityNotes: string | null;
  executiveSponsor: string | null;
  nextStep: string | null;
  isPartnership: boolean;
  stakeholderCount: number;
  executiveStakeholderCount: number;
  // BDR-001 segmentation + BDR-004 engagement.
  priority: CrmOptionValueSummary | null;
  technologies: CrmOptionValueSummary[];
  engagement: BdEngagementView;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BdTargetAccountDetail extends BdTargetAccountSummary {
  stakeholders: BdAccountStakeholderSummary[];
  // BDR-002 buying-committee completeness + BDR-003 sequence + BDR-005 handoff.
  buyingCommittee: BdBuyingCommitteeView;
  sequence: BdSequenceView;
  handoff: BdHandoffRecord | null;
  territoryPlaceholder: BdPlaceholderSurface;
  aiPlaceholders: BdAiPlaceholderSummary;
}

export interface CreateBdTargetAccountRequestBody {
  name: string;
  accountId?: string | null;
  ownerId?: string | null;
  tierKey: string;
  stageKey: string;
  partnershipTypeKey?: string | null;
  industry?: string | null;
  region?: string | null;
  annualRevenue?: number | null;
  employeeCount?: number | null;
  marketOpportunityNotes?: string | null;
  executiveSponsor?: string | null;
  nextStep?: string | null;
  isPartnership?: boolean;
  stakeholders?: BdAccountStakeholderInput[];
  priorityKey?: string | null;
  technologies?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateBdTargetAccountRequestBody {
  name?: string;
  accountId?: string | null;
  ownerId?: string | null;
  tierKey?: string;
  stageKey?: string;
  partnershipTypeKey?: string | null;
  industry?: string | null;
  region?: string | null;
  annualRevenue?: number | null;
  employeeCount?: number | null;
  marketOpportunityNotes?: string | null;
  executiveSponsor?: string | null;
  nextStep?: string | null;
  isPartnership?: boolean;
  stakeholders?: BdAccountStakeholderInput[];
  priorityKey?: string | null;
  technologies?: string[];
  // BDR-003 sequence controls + BDR-004 engagement-signal capture.
  sequence?: UpdateBdSequenceInput;
  engagementSignals?: Partial<BdEngagementSignals>;
  metadata?: Record<string, unknown>;
}

export interface BdTargetAccountResponse {
  targetAccount: BdTargetAccountDetail;
}

export interface BdTargetAccountsResponse {
  targetAccounts: BdTargetAccountSummary[];
  pagination: CrmPagination;
}

export interface BdTargetAccountOptionsResponse {
  owners: CrmLookupUserSummary[];
  accounts: AccountLookupSummary[];
  contacts: ContactRelationshipSummary[];
  tiers: CrmOptionValueSummary[];
  stages: CrmOptionValueSummary[];
  partnershipTypes: CrmOptionValueSummary[];
  availableScopes: BdPipelineScope[];
  // Persona 8 (BDR) configuration.
  priorities: CrmOptionValueSummary[];
  technologies: CrmOptionValueSummary[];
  buyerRoles: CrmOptionValueSummary[];
  sequenceSteps: BdSequenceStepDefinition[];
  opportunityStages: CrmOptionValueSummary[];
  marketSignalTypes: CrmOptionValueSummary[];
}

// ---- Persona 8 (BDR) enhancements ---------------------------------------------------------------

// BDR-003: outbound sequence.
export const bdSequenceChannels = ["email", "call", "linkedin", "whatsapp", "sms", "task"] as const;
export type BdSequenceChannel = (typeof bdSequenceChannels)[number];

export interface BdSequenceStepDefinition {
  key: string;
  label: string;
  channel: BdSequenceChannel;
  offsetHours: number;
  order: number;
  // Optional targeting; the step only applies when it matches the account's persona/product/region.
  persona: string | null;
  product: string | null;
  region: string | null;
}

export const bdSequenceStepStatuses = ["completed", "overdue", "due", "upcoming"] as const;
export type BdSequenceStepStatus = (typeof bdSequenceStepStatuses)[number];

export interface BdSequenceStepView extends BdSequenceStepDefinition {
  completed: boolean;
  dueAt: string | null;
  status: BdSequenceStepStatus;
}

export interface BdSequenceView {
  configured: boolean;
  paused: boolean;
  pauseReason: string | null;
  steps: BdSequenceStepView[];
  currentStep: BdSequenceStepView | null;
  nextDueAt: string | null;
  completedCount: number;
  totalCount: number;
}

export interface UpdateBdSequenceInput {
  paused?: boolean;
  pauseReason?: string | null;
  completeStepKey?: string;
  // A logged reply pauses the sequence (BDR-003).
  logReply?: boolean;
}

// BDR-004: account engagement score.
export interface BdEngagementSignals {
  opens: number;
  clicks: number;
  websiteVisits: number;
  eventAttendance: number;
  replies: number;
  meetings: number;
  stakeholderEngagement: number;
}

export const bdEngagementBands = ["cold", "warming", "hot"] as const;
export type BdEngagementBand = (typeof bdEngagementBands)[number];

export interface BdEngagementView {
  score: number;
  band: BdEngagementBand;
  buyingSignal: boolean;
  signals: BdEngagementSignals;
}

// BDR-002: buying-committee completeness.
export interface BdBuyingCommitteeRole {
  key: string;
  label: string;
  covered: boolean;
}

export interface BdBuyingCommitteeView {
  score: number;
  total: number;
  covered: number;
  roles: BdBuyingCommitteeRole[];
  missingRoles: BdBuyingCommitteeRole[];
}

// BDR-005: strategic handoff record.
export interface BdHandoffRecord {
  salesOwnerId: string | null;
  salesOwnerName: string | null;
  recommendedApproach: string | null;
  painPoints: string | null;
  nextMeetingAt: string | null;
  status: "pending_approval" | "handed_off";
  requestedAt: string;
  approvalId: string | null;
}

export interface BdImportAccountInput {
  name: string;
  accountId?: string | null;
  industry?: string | null;
  region?: string | null;
  tierKey?: string | null;
  stageKey?: string | null;
  priorityKey?: string | null;
  technologies?: string[];
  annualRevenue?: number | null;
  employeeCount?: number | null;
}

export interface BdImportRequestBody {
  accounts: BdImportAccountInput[];
}

export interface BdImportSkippedEntry {
  name: string;
  reason: string;
}

export interface BdImportResponse {
  createdCount: number;
  skipped: BdImportSkippedEntry[];
  targetAccounts: BdTargetAccountSummary[];
}

export interface BdConvertRequestBody {
  opportunityName?: string | null;
  stageKey: string;
  amount: number;
  expectedCloseDate: string;
  nextStep: string;
  ownerId?: string | null;
  // BDM-004 strategic opportunity attribution + context.
  sourceKey?: string | null;
  useCase?: string | null;
  product?: string | null;
  priorityKey?: string | null;
}

export interface BdConvertResponse {
  opportunityId: string;
  targetAccount: BdTargetAccountDetail;
}

export interface BdHandoffRequestBody {
  salesOwnerId: string;
  recommendedApproach: string;
  painPoints?: string | null;
  nextMeetingAt?: string | null;
  requireApproval?: boolean;
  // Manager who approves the reassignment when requireApproval is true.
  approverUserId?: string | null;
}

export interface BdHandoffResponse {
  targetAccount: BdTargetAccountDetail;
  notificationId: string | null;
  approvalId: string | null;
}

// ---- Persona 11 (Business Development Manager) -------------------------------------------------

export const bdTerritoryPlanReviewStatuses = ["draft", "in_review", "reviewed"] as const;
export type BdTerritoryPlanReviewStatus = (typeof bdTerritoryPlanReviewStatuses)[number];

export interface BdTerritoryPlanSummary {
  id: string;
  name: string;
  owner: CrmLookupUserSummary | null;
  geography: string | null;
  targetSegments: string | null;
  namedAccounts: string | null;
  partnerCoverage: string | null;
  campaigns: string | null;
  pipelineTarget: number | null;
  revenueTarget: number | null;
  reviewStatus: BdTerritoryPlanReviewStatus;
  reviewer: CrmLookupUserSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBdTerritoryPlanRequestBody {
  name: string;
  ownerId?: string | null;
  geography?: string | null;
  targetSegments?: string | null;
  namedAccounts?: string | null;
  partnerCoverage?: string | null;
  campaigns?: string | null;
  pipelineTarget?: number | null;
  revenueTarget?: number | null;
}

export interface SubmitBdTerritoryPlanReviewRequestBody {
  reviewerUserId: string;
  note?: string | null;
}

export interface BdTerritoryPlanResponse {
  territoryPlan: BdTerritoryPlanSummary;
}

export interface BdTerritoryPlansResponse {
  territoryPlans: BdTerritoryPlanSummary[];
}

export const bdMarketSignalLinkTypes = ["account", "opportunity", "campaign"] as const;
export type BdMarketSignalLinkType = (typeof bdMarketSignalLinkTypes)[number];

export interface BdMarketSignalSummary {
  id: string;
  signalType: CrmOptionValueSummary | null;
  content: string;
  linkedEntityType: BdMarketSignalLinkType | null;
  linkedEntityId: string | null;
  owner: CrmLookupUserSummary | null;
  createdAt: string;
}

export interface CreateBdMarketSignalRequestBody {
  signalTypeKey: string;
  content: string;
  linkedEntityType?: BdMarketSignalLinkType | null;
  linkedEntityId?: string | null;
}

export interface BdMarketSignalResponse {
  marketSignal: BdMarketSignalSummary;
}

export interface BdMarketSignalsResponse {
  marketSignals: BdMarketSignalSummary[];
}

export interface BdPartnerReferralSummary {
  id: string;
  partnerAccount: AccountLookupSummary | null;
  referralSource: string | null;
  customerName: string;
  opportunity: OpportunityLookupSummary | null;
  referredValue: number | null;
  converted: boolean;
  commissionEligible: boolean;
  notes: string | null;
  owner: CrmLookupUserSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBdPartnerReferralRequestBody {
  customerName: string;
  partnerAccountId?: string | null;
  referralSource?: string | null;
  referredValue?: number | null;
  notes?: string | null;
}

export interface UpdateBdPartnerReferralRequestBody {
  converted?: boolean;
  commissionEligible?: boolean;
  referredValue?: number | null;
  opportunityId?: string | null;
  notes?: string | null;
}

export interface BdPartnerReferralResponse {
  referral: BdPartnerReferralSummary;
}

export interface BdPartnerReferralsResponse {
  referrals: BdPartnerReferralSummary[];
}

export const presalesPipelineScopes = ["mine", "team", "all"] as const;
export type PresalesPipelineScope = (typeof presalesPipelineScopes)[number];

export const presalesRequestSortFields = [
  "title",
  "type",
  "status",
  "priority",
  "dueDate",
  "updatedAt",
  "createdAt"
] as const;
export type PresalesRequestSortField = (typeof presalesRequestSortFields)[number];

export const presalesPriorities = ["low", "medium", "high", "urgent"] as const;
export type PresalesPriority = (typeof presalesPriorities)[number];

export const presalesRequirementCategories = [
  "functional",
  "technical",
  "security",
  "commercial",
  "integration",
  "other"
] as const;
export type PresalesRequirementCategory = (typeof presalesRequirementCategories)[number];

export const presalesComplianceStatuses = ["pending", "met", "partial", "gap", "not_applicable"] as const;
export type PresalesComplianceStatus = (typeof presalesComplianceStatuses)[number];

export interface PresalesRequestListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: string;
  status?: string;
  priority?: PresalesPriority;
  ownerId?: string;
  assigneeId?: string;
  opportunityId?: string;
  accountId?: string;
  scope?: PresalesPipelineScope;
  sortBy?: PresalesRequestSortField;
  sortOrder?: CrmSortOrder;
}

export interface PresalesPlaceholderSurface {
  available: false;
  message: string;
}

export interface PresalesAiPlaceholderAction {
  key:
    | "rfp_extraction"
    | "compliance_matrix"
    | "demo_script"
    | "proposal_response_draft"
    | "technical_risk_detection";
  label: string;
  description: string;
}

export interface PresalesAiPlaceholderSummary {
  actions: PresalesAiPlaceholderAction[];
  governanceHint: string;
}

export interface OpportunityLookupSummary {
  id: string;
  name: string;
  stage: CrmOptionValueSummary | null;
}

export interface PresalesRequirementSummary {
  id: string;
  label: string;
  category: PresalesRequirementCategory;
  requirement: string | null;
  response: string | null;
  complianceStatus: PresalesComplianceStatus;
  priority: PresalesPriority;
  sortOrder: number;
  // PS-004 solution fitment detail (stored in requirement metadata).
  customization: string | null;
  integration: string | null;
  dependency: string | null;
  risk: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PresalesRequirementInput {
  id?: string;
  label: string;
  category?: PresalesRequirementCategory;
  requirement?: string | null;
  response?: string | null;
  complianceStatus?: PresalesComplianceStatus;
  priority?: PresalesPriority;
  sortOrder?: number;
  customization?: string | null;
  integration?: string | null;
  dependency?: string | null;
  risk?: string | null;
}

export interface PresalesRequestSummary {
  id: string;
  title: string;
  type: CrmOptionValueSummary | null;
  status: CrmOptionValueSummary | null;
  priority: PresalesPriority;
  opportunity: OpportunityLookupSummary | null;
  account: AccountLookupSummary | null;
  owner: CrmLookupUserSummary | null;
  assignee: CrmLookupUserSummary | null;
  dueDate: string | null;
  summary: string | null;
  product: string | null;
  triageStatus: PresalesTriageStatus | null;
  requirementCount: number;
  metRequirementCount: number;
  gapRequirementCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ---- Persona 14 (Presales Consultant) delivery state -------------------------------------------

export const presalesTriageStatuses = ["accepted", "rejected", "info_requested"] as const;
export type PresalesTriageStatus = (typeof presalesTriageStatuses)[number];

export interface PresalesTriageState {
  status: PresalesTriageStatus;
  note: string | null;
  decidedBy: CrmLookupUserSummary | null;
  decidedAt: string;
}

export interface PresalesDemoWorkspace {
  painPoints: string | null;
  useCases: string | null;
  audience: string | null;
  modules: string | null;
  competitors: string | null;
  objections: string | null;
  expectedOutcome: string | null;
  demoFlowNotes: string | null;
  checklist: string[];
  updatedAt: string | null;
}

export interface PresalesDemoFeedback {
  attendees: string | null;
  modulesShown: string | null;
  questions: string | null;
  objections: string | null;
  positiveSignals: string | null;
  gaps: string | null;
  nextSteps: string | null;
  capturedBy: CrmLookupUserSummary | null;
  capturedAt: string | null;
}

export interface PresalesFitmentReview {
  reviewer: CrmLookupUserSummary | null;
  note: string | null;
  requestedBy: CrmLookupUserSummary | null;
  requestedAt: string;
}

export interface PresalesPocSignOff {
  outcome: "success" | "fail";
  customerFeedback: string | null;
  signedOffBy: CrmLookupUserSummary | null;
  signedOffAt: string;
}

export interface PresalesPocPlan {
  objective: string | null;
  scope: string | null;
  successCriteria: string | null;
  timeline: string | null;
  responsibilities: string | null;
  demoData: string | null;
  signOff: PresalesPocSignOff | null;
  updatedAt: string | null;
}

export interface PresalesTriageRequestBody {
  action: PresalesTriageStatus;
  note?: string | null;
}

export interface PresalesDemoWorkspaceRequestBody {
  painPoints?: string | null;
  useCases?: string | null;
  audience?: string | null;
  modules?: string | null;
  competitors?: string | null;
  objections?: string | null;
  expectedOutcome?: string | null;
  demoFlowNotes?: string | null;
  checklist?: string[];
}

export interface PresalesDemoFeedbackRequestBody {
  attendees?: string | null;
  modulesShown?: string | null;
  questions?: string | null;
  objections?: string | null;
  positiveSignals?: string | null;
  gaps?: string | null;
  nextSteps?: string | null;
  opportunityStageKey?: string | null;
}

export interface PresalesGapTaskRequestBody {
  requirementId: string;
  assigneeId?: string | null;
  dueAt?: string | null;
  asChangeRequest?: boolean;
}

export interface PresalesFitmentReviewRequestBody {
  reviewerId: string;
  note?: string | null;
}

export interface PresalesPocPlanRequestBody {
  objective?: string | null;
  scope?: string | null;
  successCriteria?: string | null;
  timeline?: string | null;
  responsibilities?: string | null;
  demoData?: string | null;
}

export interface PresalesPocSignOffRequestBody {
  outcome: "success" | "fail";
  customerFeedback?: string | null;
  probability?: number | null;
}

export interface PresalesRequestDetail extends PresalesRequestSummary {
  technicalRequirements: string | null;
  proposalContent: string | null;
  triage: PresalesTriageState | null;
  demoWorkspace: PresalesDemoWorkspace | null;
  demoFeedback: PresalesDemoFeedback | null;
  fitmentReview: PresalesFitmentReview | null;
  poc: PresalesPocPlan | null;
  requirements: PresalesRequirementSummary[];
  demoCalendarPlaceholder: PresalesPlaceholderSurface;
  solutionRepositoryPlaceholder: PresalesPlaceholderSurface;
  aiPlaceholders: PresalesAiPlaceholderSummary;
}

export interface CreatePresalesRequestRequestBody {
  title: string;
  typeKey: string;
  statusKey?: string;
  priority?: PresalesPriority;
  opportunityId?: string | null;
  accountId?: string | null;
  ownerId?: string | null;
  assigneeId?: string | null;
  dueDate?: string | null;
  summary?: string | null;
  technicalRequirements?: string | null;
  proposalContent?: string | null;
  requirements?: PresalesRequirementInput[];
  metadata?: Record<string, unknown>;
}

export interface UpdatePresalesRequestRequestBody {
  title?: string;
  typeKey?: string;
  statusKey?: string;
  priority?: PresalesPriority;
  opportunityId?: string | null;
  accountId?: string | null;
  ownerId?: string | null;
  assigneeId?: string | null;
  dueDate?: string | null;
  summary?: string | null;
  technicalRequirements?: string | null;
  proposalContent?: string | null;
  requirements?: PresalesRequirementInput[];
  metadata?: Record<string, unknown>;
}

export interface PresalesRequestResponse {
  request: PresalesRequestDetail;
}

export interface PresalesRequestsResponse {
  requests: PresalesRequestSummary[];
  pagination: CrmPagination;
}

export interface PresalesRequestOptionsResponse {
  owners: CrmLookupUserSummary[];
  accounts: AccountLookupSummary[];
  opportunities: OpportunityLookupSummary[];
  requestTypes: CrmOptionValueSummary[];
  statuses: CrmOptionValueSummary[];
  priorities: PresalesPriority[];
  demoChecklistItems: CrmOptionValueSummary[];
  availableScopes: PresalesPipelineScope[];
}

// ============================================================================
// Phase 13: Partner Channel Management
// ============================================================================

export const partnerPipelineScopes = ["mine", "team", "all"] as const;
export type PartnerPipelineScope = (typeof partnerPipelineScopes)[number];

export const partnerSortFields = ["name", "type", "tier", "status", "updatedAt", "createdAt"] as const;
export type PartnerSortField = (typeof partnerSortFields)[number];

export const partnerOnboardingTaskStatuses = ["pending", "in_progress", "completed", "blocked"] as const;
export type PartnerOnboardingTaskStatus = (typeof partnerOnboardingTaskStatuses)[number];

export interface PartnerListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  type?: string;
  tier?: string;
  status?: string;
  onboardingStatus?: string;
  ownerId?: string;
  scope?: PartnerPipelineScope;
  sortBy?: PartnerSortField;
  sortOrder?: CrmSortOrder;
}

export interface PartnerPlaceholderSurface {
  available: false;
  message: string;
}

export interface PartnerAiPlaceholderAction {
  key:
    | "partner_fit_score"
    | "partner_performance_summary"
    | "partner_action_plan"
    | "partner_churn_risk"
    | "partner_conflict_detection";
  label: string;
  description: string;
}

export interface PartnerAiPlaceholderSummary {
  actions: PartnerAiPlaceholderAction[];
  governanceHint: string;
}

export interface PartnerContactSummary {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  contact: ContactRelationshipSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerContactInput {
  id?: string;
  contactId?: string | null;
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary?: boolean;
}

export interface PartnerOnboardingTaskSummary {
  id: string;
  label: string;
  status: PartnerOnboardingTaskStatus;
  sortOrder: number;
  dueDate: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerOnboardingTaskInput {
  id?: string;
  label: string;
  status?: PartnerOnboardingTaskStatus;
  sortOrder?: number;
  dueDate?: string | null;
  notes?: string | null;
}

export interface PartnerDealRegistrationSummary {
  id: string;
  partnerId: string;
  name: string;
  customerName: string | null;
  stage: CrmOptionValueSummary | null;
  amount: number | null;
  expectedCloseDate: string | null;
  notes: string | null;
  opportunity: OpportunityLookupSummary | null;
  account: AccountLookupSummary | null;
  leadId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePartnerDealRegistrationRequestBody {
  name: string;
  stageKey?: string;
  customerName?: string | null;
  amount?: number | null;
  expectedCloseDate?: string | null;
  notes?: string | null;
  opportunityId?: string | null;
  accountId?: string | null;
  leadId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdatePartnerDealRegistrationRequestBody {
  name?: string;
  stageKey?: string;
  customerName?: string | null;
  amount?: number | null;
  expectedCloseDate?: string | null;
  notes?: string | null;
  opportunityId?: string | null;
  accountId?: string | null;
  leadId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PartnerPerformanceSummary {
  onboardingTaskCount: number;
  completedOnboardingTaskCount: number;
  onboardingCompletionRate: number;
  dealCount: number;
  registeredDealValue: number;
  wonDealCount: number;
  contactCount: number;
}

export interface PartnerSummary {
  id: string;
  name: string;
  account: AccountLookupSummary | null;
  owner: CrmLookupUserSummary | null;
  type: CrmOptionValueSummary | null;
  tier: CrmOptionValueSummary | null;
  status: CrmOptionValueSummary | null;
  onboardingStatus: CrmOptionValueSummary | null;
  region: string | null;
  territory: string | null;
  agreementReference: string | null;
  agreementStartDate: string | null;
  agreementEndDate: string | null;
  agreementNotes: string | null;
  contactCount: number;
  dealCount: number;
  onboardingTaskCount: number;
  completedOnboardingTaskCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerDetail extends PartnerSummary {
  customFields: Record<string, unknown>;
  contacts: PartnerContactSummary[];
  onboardingTasks: PartnerOnboardingTaskSummary[];
  deals: PartnerDealRegistrationSummary[];
  performance: PartnerPerformanceSummary;
  enablementAssetsPlaceholder: PartnerPlaceholderSurface;
  trainingPlaceholder: PartnerPlaceholderSurface;
  supportTicketsPlaceholder: PartnerPlaceholderSurface;
  aiPlaceholders: PartnerAiPlaceholderSummary;
}

export interface CreatePartnerRequestBody {
  name: string;
  accountId?: string | null;
  ownerId?: string | null;
  typeKey: string;
  tierKey: string;
  statusKey?: string;
  onboardingStatusKey?: string;
  region?: string | null;
  territory?: string | null;
  agreementReference?: string | null;
  agreementStartDate?: string | null;
  agreementEndDate?: string | null;
  agreementNotes?: string | null;
  contacts?: PartnerContactInput[];
  onboardingTasks?: PartnerOnboardingTaskInput[];
  metadata?: Record<string, unknown>;
  customFields?: Record<string, unknown>;
}

export interface UpdatePartnerRequestBody {
  name?: string;
  accountId?: string | null;
  ownerId?: string | null;
  typeKey?: string;
  tierKey?: string;
  statusKey?: string;
  onboardingStatusKey?: string;
  region?: string | null;
  territory?: string | null;
  agreementReference?: string | null;
  agreementStartDate?: string | null;
  agreementEndDate?: string | null;
  agreementNotes?: string | null;
  contacts?: PartnerContactInput[];
  onboardingTasks?: PartnerOnboardingTaskInput[];
  metadata?: Record<string, unknown>;
  customFields?: Record<string, unknown>;
}

export interface PartnerResponse {
  partner: PartnerDetail;
}

export interface PartnersResponse {
  partners: PartnerSummary[];
  pagination: CrmPagination;
}

export interface PartnerOptionsResponse {
  owners: CrmLookupUserSummary[];
  accounts: AccountLookupSummary[];
  contacts: ContactRelationshipSummary[];
  opportunities: OpportunityLookupSummary[];
  types: CrmOptionValueSummary[];
  tiers: CrmOptionValueSummary[];
  statuses: CrmOptionValueSummary[];
  onboardingStatuses: CrmOptionValueSummary[];
  dealStages: CrmOptionValueSummary[];
  availableScopes: PartnerPipelineScope[];
  fieldDefinitions: CrmFieldDefinition[];
  customFieldOptions: Record<string, CrmOptionValueSummary[]>;
}

export interface PartnerDealRegistrationResponse {
  deal: PartnerDealRegistrationSummary;
}

export interface PartnerDealRegistrationsResponse {
  deals: PartnerDealRegistrationSummary[];
}

export interface PartnerDashboardResponse {
  scope: PartnerPipelineScope;
  totalPartners: number;
  activePartners: number;
  onboardingInProgress: number;
  registeredDealCount: number;
  registeredDealValue: number;
  wonDealCount: number;
  tierDistribution: Array<{ tier: CrmOptionValueSummary | null; partnerCount: number }>;
  performancePlaceholder: PartnerPlaceholderSurface;
}

// ============================================================================
// Phase 14: Reseller Management
// ============================================================================

export const resellerPipelineScopes = ["mine", "team", "all"] as const;
export type ResellerPipelineScope = (typeof resellerPipelineScopes)[number];

export const resellerSortFields = ["name", "status", "pricingTier", "updatedAt", "createdAt"] as const;
export type ResellerSortField = (typeof resellerSortFields)[number];

export const resellerOnboardingTaskStatuses = ["pending", "in_progress", "completed", "blocked"] as const;
export type ResellerOnboardingTaskStatus = (typeof resellerOnboardingTaskStatuses)[number];

export interface ResellerListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  pricingTier?: string;
  marginProfile?: string;
  onboardingStatus?: string;
  ownerId?: string;
  scope?: ResellerPipelineScope;
  sortBy?: ResellerSortField;
  sortOrder?: CrmSortOrder;
}

export interface ResellerPlaceholderSurface {
  available: false;
  message: string;
}

export interface ResellerAiPlaceholderAction {
  key:
    | "reseller_performance_insight"
    | "reseller_sales_prediction"
    | "margin_optimization"
    | "reseller_opportunity_recommendation"
    | "inactivity_alert"
    | "reseller_coaching_recommendation";
  label: string;
  description: string;
}

export interface ResellerAiPlaceholderSummary {
  actions: ResellerAiPlaceholderAction[];
  governanceHint: string;
}

export interface ResellerContactSummary {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  contact: ContactRelationshipSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResellerContactInput {
  id?: string;
  contactId?: string | null;
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary?: boolean;
}

export interface ResellerOnboardingTaskSummary {
  id: string;
  label: string;
  status: ResellerOnboardingTaskStatus;
  sortOrder: number;
  dueDate: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResellerOnboardingTaskInput {
  id?: string;
  label: string;
  status?: ResellerOnboardingTaskStatus;
  sortOrder?: number;
  dueDate?: string | null;
  notes?: string | null;
}

export interface ResellerDealRegistrationSummary {
  id: string;
  resellerId: string;
  name: string;
  customerName: string | null;
  stage: CrmOptionValueSummary | null;
  amount: number | null;
  marginPercent: number | null;
  expectedCloseDate: string | null;
  notes: string | null;
  opportunity: OpportunityLookupSummary | null;
  account: AccountLookupSummary | null;
  leadId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateResellerDealRegistrationRequestBody {
  name: string;
  stageKey?: string;
  customerName?: string | null;
  amount?: number | null;
  marginPercent?: number | null;
  expectedCloseDate?: string | null;
  notes?: string | null;
  opportunityId?: string | null;
  accountId?: string | null;
  leadId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateResellerDealRegistrationRequestBody {
  name?: string;
  stageKey?: string;
  customerName?: string | null;
  amount?: number | null;
  marginPercent?: number | null;
  expectedCloseDate?: string | null;
  notes?: string | null;
  opportunityId?: string | null;
  accountId?: string | null;
  leadId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ResellerPerformanceSummary {
  onboardingTaskCount: number;
  completedOnboardingTaskCount: number;
  onboardingCompletionRate: number;
  dealCount: number;
  registeredDealValue: number;
  wonDealCount: number;
  averageMarginPercent: number | null;
  contactCount: number;
}

export interface ResellerSummary {
  id: string;
  name: string;
  account: AccountLookupSummary | null;
  owner: CrmLookupUserSummary | null;
  status: CrmOptionValueSummary | null;
  pricingTier: CrmOptionValueSummary | null;
  marginProfile: CrmOptionValueSummary | null;
  onboardingStatus: CrmOptionValueSummary | null;
  region: string | null;
  territory: string | null;
  marginPercent: number | null;
  agreementReference: string | null;
  agreementStartDate: string | null;
  agreementEndDate: string | null;
  agreementNotes: string | null;
  contactCount: number;
  dealCount: number;
  onboardingTaskCount: number;
  completedOnboardingTaskCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ResellerDetail extends ResellerSummary {
  contacts: ResellerContactSummary[];
  onboardingTasks: ResellerOnboardingTaskSummary[];
  deals: ResellerDealRegistrationSummary[];
  performance: ResellerPerformanceSummary;
  catalogPlaceholder: ResellerPlaceholderSurface;
  orderTrackingPlaceholder: ResellerPlaceholderSurface;
  trainingPlaceholder: ResellerPlaceholderSurface;
  certificationPlaceholder: ResellerPlaceholderSurface;
  supportTicketsPlaceholder: ResellerPlaceholderSurface;
  aiPlaceholders: ResellerAiPlaceholderSummary;
}

export interface CreateResellerRequestBody {
  name: string;
  accountId?: string | null;
  ownerId?: string | null;
  statusKey?: string;
  pricingTierKey: string;
  marginProfileKey: string;
  onboardingStatusKey?: string;
  region?: string | null;
  territory?: string | null;
  marginPercent?: number | null;
  agreementReference?: string | null;
  agreementStartDate?: string | null;
  agreementEndDate?: string | null;
  agreementNotes?: string | null;
  contacts?: ResellerContactInput[];
  onboardingTasks?: ResellerOnboardingTaskInput[];
  metadata?: Record<string, unknown>;
}

export interface UpdateResellerRequestBody {
  name?: string;
  accountId?: string | null;
  ownerId?: string | null;
  statusKey?: string;
  pricingTierKey?: string;
  marginProfileKey?: string;
  onboardingStatusKey?: string;
  region?: string | null;
  territory?: string | null;
  marginPercent?: number | null;
  agreementReference?: string | null;
  agreementStartDate?: string | null;
  agreementEndDate?: string | null;
  agreementNotes?: string | null;
  contacts?: ResellerContactInput[];
  onboardingTasks?: ResellerOnboardingTaskInput[];
  metadata?: Record<string, unknown>;
}

export interface ResellerResponse {
  reseller: ResellerDetail;
}

export interface ResellersResponse {
  resellers: ResellerSummary[];
  pagination: CrmPagination;
}

export interface ResellerOptionsResponse {
  owners: CrmLookupUserSummary[];
  accounts: AccountLookupSummary[];
  contacts: ContactRelationshipSummary[];
  opportunities: OpportunityLookupSummary[];
  statuses: CrmOptionValueSummary[];
  pricingTiers: CrmOptionValueSummary[];
  marginProfiles: CrmOptionValueSummary[];
  onboardingStatuses: CrmOptionValueSummary[];
  dealStages: CrmOptionValueSummary[];
  availableScopes: ResellerPipelineScope[];
}

export interface ResellerDealRegistrationResponse {
  deal: ResellerDealRegistrationSummary;
}

export interface ResellerDealRegistrationsResponse {
  deals: ResellerDealRegistrationSummary[];
}

export interface ResellerDashboardResponse {
  scope: ResellerPipelineScope;
  totalResellers: number;
  activeResellers: number;
  onboardingInProgress: number;
  registeredDealCount: number;
  registeredDealValue: number;
  wonDealCount: number;
  averageMarginPercent: number | null;
  pricingTierDistribution: Array<{ pricingTier: CrmOptionValueSummary | null; resellerCount: number }>;
  performancePlaceholder: ResellerPlaceholderSurface;
}

// ============================================================================
// Phase 15: Support Ticketing Management
// ============================================================================

export const supportTicketScopes = ["mine", "team", "all"] as const;
export type SupportTicketScope = (typeof supportTicketScopes)[number];

export const supportTicketSortFields = ["subject", "priority", "status", "createdAt", "updatedAt", "resolutionDueAt"] as const;
export type SupportTicketSortField = (typeof supportTicketSortFields)[number];

export const supportEscalationStatuses = ["none", "pending", "escalated", "resolved"] as const;
export type SupportEscalationStatus = (typeof supportEscalationStatuses)[number];

export const supportTicketMessageTypes = ["internal_note", "customer_reply"] as const;
export type SupportTicketMessageType = (typeof supportTicketMessageTypes)[number];

export const supportKnowledgeArticleStatuses = ["draft", "published", "archived"] as const;
export type SupportKnowledgeArticleStatus = (typeof supportKnowledgeArticleStatuses)[number];

export interface SupportPlaceholderSurface {
  available: false;
  message: string;
}

export interface SupportAiPlaceholderAction {
  key:
    | "ticket_classification"
    | "suggested_response"
    | "similar_tickets"
    | "knowledge_recommendation"
    | "ticket_summary"
    | "escalation_recommendation";
  label: string;
  description: string;
}

export interface SupportAiPlaceholderSummary {
  actions: SupportAiPlaceholderAction[];
  governanceHint: string;
}

export interface SupportSlaPolicySummary {
  id: string;
  name: string;
  priority: CrmOptionValueSummary | null;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupportSlaPolicyRequestBody {
  name: string;
  priorityKey?: string | null;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface SupportSlaPoliciesResponse {
  policies: SupportSlaPolicySummary[];
}

export interface SupportSlaPolicyResponse {
  policy: SupportSlaPolicySummary;
}

export interface SupportSlaStatus {
  policy: SupportSlaPolicySummary | null;
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  firstResponseBreached: boolean;
  resolutionBreached: boolean;
}

export interface SupportTicketMessageSummary {
  id: string;
  messageType: SupportTicketMessageType;
  body: string;
  author: CrmLookupUserSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupportTicketMessageRequestBody {
  messageType: SupportTicketMessageType;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface SupportKnowledgeArticleSummary {
  id: string;
  title: string;
  category: CrmOptionValueSummary | null;
  summary: string | null;
  body: string | null;
  status: SupportKnowledgeArticleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupportKnowledgeArticleRequestBody {
  title: string;
  categoryKey?: string | null;
  summary?: string | null;
  body?: string | null;
  status?: SupportKnowledgeArticleStatus;
  metadata?: Record<string, unknown>;
}

export interface SupportKnowledgeArticlesResponse {
  articles: SupportKnowledgeArticleSummary[];
}

export interface SupportKnowledgeArticleResponse {
  article: SupportKnowledgeArticleSummary;
}

export interface LinkSupportArticleRequestBody {
  articleId: string;
}

export interface SupportTicketListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  priority?: string;
  category?: string;
  source?: string;
  assigneeId?: string;
  accountId?: string;
  escalationStatus?: SupportEscalationStatus;
  breachedOnly?: boolean;
  scope?: SupportTicketScope;
  sortBy?: SupportTicketSortField;
  sortOrder?: CrmSortOrder;
}

export interface SupportTicketSummary {
  id: string;
  subject: string;
  status: CrmOptionValueSummary | null;
  priority: CrmOptionValueSummary | null;
  category: CrmOptionValueSummary | null;
  source: CrmOptionValueSummary | null;
  account: AccountLookupSummary | null;
  contact: ContactRelationshipSummary | null;
  customerSuccessAccount: AccountLookupSummary | null;
  owner: CrmLookupUserSummary | null;
  assignee: CrmLookupUserSummary | null;
  escalationStatus: SupportEscalationStatus;
  sla: SupportSlaStatus;
  messageCount: number;
  articleCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketDetail extends SupportTicketSummary {
  customFields: Record<string, unknown>;
  description: string | null;
  rootCause: string | null;
  resolutionNotes: string | null;
  messages: SupportTicketMessageSummary[];
  articles: SupportKnowledgeArticleSummary[];
  attachmentsPlaceholder: SupportPlaceholderSurface;
  csatPlaceholder: SupportPlaceholderSurface;
  escalationPlaceholder: SupportPlaceholderSurface;
  aiPlaceholders: SupportAiPlaceholderSummary;
}

export interface CreateSupportTicketRequestBody {
  subject: string;
  description?: string | null;
  statusKey?: string;
  priorityKey?: string;
  categoryKey?: string;
  sourceKey?: string;
  accountId?: string | null;
  contactId?: string | null;
  customerSuccessAccountId?: string | null;
  ownerId?: string | null;
  assigneeId?: string | null;
  slaPolicyId?: string | null;
  escalationStatus?: SupportEscalationStatus;
  rootCause?: string | null;
  resolutionNotes?: string | null;
  metadata?: Record<string, unknown>;
  customFields?: Record<string, unknown>;
}

export interface UpdateSupportTicketRequestBody {
  subject?: string;
  description?: string | null;
  statusKey?: string;
  priorityKey?: string;
  categoryKey?: string;
  sourceKey?: string;
  accountId?: string | null;
  contactId?: string | null;
  customerSuccessAccountId?: string | null;
  ownerId?: string | null;
  assigneeId?: string | null;
  slaPolicyId?: string | null;
  escalationStatus?: SupportEscalationStatus;
  rootCause?: string | null;
  resolutionNotes?: string | null;
  metadata?: Record<string, unknown>;
  customFields?: Record<string, unknown>;
}

export interface SupportTicketResponse {
  ticket: SupportTicketDetail;
}

export interface SupportTicketsResponse {
  tickets: SupportTicketSummary[];
  pagination: CrmPagination;
}

export interface SupportTicketOptionsResponse {
  owners: CrmLookupUserSummary[];
  accounts: AccountLookupSummary[];
  contacts: ContactRelationshipSummary[];
  statuses: CrmOptionValueSummary[];
  priorities: CrmOptionValueSummary[];
  categories: CrmOptionValueSummary[];
  sources: CrmOptionValueSummary[];
  knowledgeCategories: CrmOptionValueSummary[];
  rootCauses: CrmOptionValueSummary[];
  slaPolicies: SupportSlaPolicySummary[];
  availableScopes: SupportTicketScope[];
  fieldDefinitions: CrmFieldDefinition[];
  customFieldOptions: Record<string, CrmOptionValueSummary[]>;
}

export interface SupportDashboardResponse {
  scope: SupportTicketScope;
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  unassignedTickets: number;
  escalatedTickets: number;
  slaBreachedTickets: number;
  statusDistribution: Array<{ status: CrmOptionValueSummary | null; ticketCount: number }>;
  priorityDistribution: Array<{ priority: CrmOptionValueSummary | null; ticketCount: number }>;
  knowledgeArticleCount: number;
  csatPlaceholder: SupportPlaceholderSurface;
}

// ============================================================================
// Phase 16: Customer Success Core Module
// ============================================================================

export const customerSuccessScopes = ["mine", "team", "all"] as const;
export type CustomerSuccessScope = (typeof customerSuccessScopes)[number];

export const customerSuccessAccountSortFields = ["account", "healthScore", "adoptionScore", "renewalDate", "updatedAt", "createdAt"] as const;
export type CustomerSuccessAccountSortField = (typeof customerSuccessAccountSortFields)[number];

export const csSupportTrends = ["improving", "stable", "declining"] as const;
export type CsSupportTrend = (typeof csSupportTrends)[number];

export const csTrainingStatuses = ["not_started", "in_progress", "completed"] as const;
export type CsTrainingStatus = (typeof csTrainingStatuses)[number];

export const onboardingPlanStatuses = ["not_started", "in_progress", "completed", "blocked"] as const;
export type OnboardingPlanStatus = (typeof onboardingPlanStatuses)[number];

export const productActivationStatuses = ["not_started", "in_progress", "activated"] as const;
export type ProductActivationStatus = (typeof productActivationStatuses)[number];

export const onboardingMilestoneStatuses = ["pending", "in_progress", "completed", "blocked"] as const;
export type OnboardingMilestoneStatus = (typeof onboardingMilestoneStatuses)[number];

export const successPlanStatuses = ["draft", "active", "completed"] as const;
export type SuccessPlanStatus = (typeof successPlanStatuses)[number];

export const adoptionMetricTrends = ["up", "flat", "down"] as const;
export type AdoptionMetricTrend = (typeof adoptionMetricTrends)[number];

export const qbrTypes = ["qbr", "ebr"] as const;
export type QbrType = (typeof qbrTypes)[number];

export const qbrStatuses = ["scheduled", "completed", "cancelled"] as const;
export type QbrStatus = (typeof qbrStatuses)[number];

export const escalationSeverities = ["low", "medium", "high", "critical"] as const;
export type EscalationSeverity = (typeof escalationSeverities)[number];

export const escalationStatuses = ["open", "in_progress", "resolved", "closed"] as const;
export type EscalationStatus = (typeof escalationStatuses)[number];

export interface CsPlaceholderSurface {
  available: false;
  message: string;
}

export interface CsAiPlaceholderAction {
  key:
    | "onboarding_plan_generator"
    | "customer_health_summary"
    | "churn_risk_prediction"
    | "adoption_recommendation"
    | "qbr_ebr_summary"
    | "executive_account_brief"
    | "renewal_strategy_recommendation"
    | "customer_success_email_draft";
  label: string;
  description: string;
}

export interface CsAiPlaceholderSummary {
  actions: CsAiPlaceholderAction[];
  governanceHint: string;
}

export interface OnboardingMilestoneSummary {
  id: string;
  label: string;
  status: OnboardingMilestoneStatus;
  sortOrder: number;
  dueDate: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingMilestoneInput {
  id?: string;
  label: string;
  status?: OnboardingMilestoneStatus;
  sortOrder?: number;
  dueDate?: string | null;
  notes?: string | null;
}

export interface OnboardingPlanSummary {
  id: string;
  name: string;
  status: OnboardingPlanStatus;
  startDate: string | null;
  targetGoLiveDate: string | null;
  productActivationStatus: ProductActivationStatus;
  firstValueAt: string | null;
  trainingCompletion: number | null;
  riskNotes: string | null;
  handoverNotes: string | null;
  milestones: OnboardingMilestoneSummary[];
  milestoneCount: number;
  completedMilestoneCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertOnboardingPlanRequestBody {
  name: string;
  status?: OnboardingPlanStatus;
  startDate?: string | null;
  targetGoLiveDate?: string | null;
  productActivationStatus?: ProductActivationStatus;
  firstValueAt?: string | null;
  trainingCompletion?: number | null;
  riskNotes?: string | null;
  handoverNotes?: string | null;
  milestones?: OnboardingMilestoneInput[];
  metadata?: Record<string, unknown>;
}

export interface CsStakeholder {
  name: string;
  title?: string | null;
  role?: string | null;
  sentiment?: string | null;
}

export interface SuccessPlanSummary {
  id: string;
  name: string;
  status: SuccessPlanStatus;
  objective: string | null;
  valueRealization: string | null;
  executiveSponsor: string | null;
  stakeholders: CsStakeholder[];
  expansionOpportunities: string | null;
  renewalStrategy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertSuccessPlanRequestBody {
  name: string;
  status?: SuccessPlanStatus;
  objective?: string | null;
  valueRealization?: string | null;
  executiveSponsor?: string | null;
  stakeholders?: CsStakeholder[];
  expansionOpportunities?: string | null;
  renewalStrategy?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CustomerHealthScoreSummary {
  id: string;
  score: number;
  riskStatus: CrmOptionValueSummary | null;
  drivers: string | null;
  notes: string | null;
  recordedAt: string;
  createdAt: string;
}

export interface RecordHealthScoreRequestBody {
  score: number;
  riskStatusKey?: string | null;
  drivers?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AdoptionMetricSummary {
  id: string;
  metricKey: string;
  label: string;
  value: number;
  target: number | null;
  unit: string | null;
  trend: AdoptionMetricTrend;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdoptionMetricRequestBody {
  metricKey: string;
  label: string;
  value: number;
  target?: number | null;
  unit?: string | null;
  trend?: AdoptionMetricTrend;
  periodStart?: string | null;
  periodEnd?: string | null;
  metadata?: Record<string, unknown>;
}

export interface QbrSummary {
  id: string;
  title: string;
  qbrType: QbrType;
  status: QbrStatus;
  scheduledAt: string | null;
  summary: string | null;
  outcomes: string | null;
  nextSteps: string | null;
  owner: CrmLookupUserSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQbrRequestBody {
  title: string;
  qbrType?: QbrType;
  status?: QbrStatus;
  scheduledAt?: string | null;
  summary?: string | null;
  outcomes?: string | null;
  nextSteps?: string | null;
  ownerId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateQbrRequestBody {
  title?: string;
  qbrType?: QbrType;
  status?: QbrStatus;
  scheduledAt?: string | null;
  summary?: string | null;
  outcomes?: string | null;
  nextSteps?: string | null;
  ownerId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RenewalSummary {
  id: string;
  renewalDate: string;
  status: CrmOptionValueSummary | null;
  contractValue: number | null;
  forecastValue: number | null;
  probability: number | null;
  riskNotes: string | null;
  strategy: string | null;
  owner: CrmLookupUserSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRenewalRequestBody {
  renewalDate: string;
  statusKey?: string;
  contractValue?: number | null;
  forecastValue?: number | null;
  probability?: number | null;
  riskNotes?: string | null;
  strategy?: string | null;
  ownerId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateRenewalRequestBody {
  renewalDate?: string;
  statusKey?: string;
  contractValue?: number | null;
  forecastValue?: number | null;
  probability?: number | null;
  riskNotes?: string | null;
  strategy?: string | null;
  ownerId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface EscalationSummary {
  id: string;
  title: string;
  severity: EscalationSeverity;
  status: EscalationStatus;
  description: string | null;
  resolution: string | null;
  owner: CrmLookupUserSummary | null;
  openedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEscalationRequestBody {
  title: string;
  severity?: EscalationSeverity;
  status?: EscalationStatus;
  description?: string | null;
  resolution?: string | null;
  ownerId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateEscalationRequestBody {
  title?: string;
  severity?: EscalationSeverity;
  status?: EscalationStatus;
  description?: string | null;
  resolution?: string | null;
  ownerId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CustomerSuccessAccountSummary {
  id: string;
  account: AccountLookupSummary | null;
  csmOwner: CrmLookupUserSummary | null;
  segment: CrmOptionValueSummary | null;
  lifecycleStage: CrmOptionValueSummary | null;
  riskStatus: CrmOptionValueSummary | null;
  expansionPotential: CrmOptionValueSummary | null;
  healthScore: number | null;
  adoptionScore: number | null;
  renewalDate: string | null;
  contractValue: number | null;
  supportTrend: CsSupportTrend;
  trainingStatus: CsTrainingStatus;
  lastTouchpointAt: string | null;
  nextAction: string | null;
  onboardingPlanCount: number;
  healthScoreCount: number;
  qbrCount: number;
  renewalCount: number;
  openEscalationCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSuccessAccountDetail extends CustomerSuccessAccountSummary {
  onboardingPlans: OnboardingPlanSummary[];
  successPlans: SuccessPlanSummary[];
  healthScores: CustomerHealthScoreSummary[];
  adoptionMetrics: AdoptionMetricSummary[];
  qbrs: QbrSummary[];
  renewals: RenewalSummary[];
  escalations: EscalationSummary[];
  lowTouchCampaignsPlaceholder: CsPlaceholderSurface;
  automatedCheckInPlaceholder: CsPlaceholderSurface;
  aiPlaceholders: CsAiPlaceholderSummary;
}

export interface CreateCustomerSuccessAccountRequestBody {
  accountId: string;
  csmOwnerId?: string | null;
  segmentKey?: string;
  lifecycleStageKey?: string;
  riskStatusKey?: string;
  expansionPotentialKey?: string;
  healthScore?: number | null;
  adoptionScore?: number | null;
  renewalDate?: string | null;
  contractValue?: number | null;
  supportTrend?: CsSupportTrend;
  trainingStatus?: CsTrainingStatus;
  lastTouchpointAt?: string | null;
  nextAction?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateCustomerSuccessAccountRequestBody {
  csmOwnerId?: string | null;
  segmentKey?: string;
  lifecycleStageKey?: string;
  riskStatusKey?: string;
  expansionPotentialKey?: string;
  healthScore?: number | null;
  adoptionScore?: number | null;
  renewalDate?: string | null;
  contractValue?: number | null;
  supportTrend?: CsSupportTrend;
  trainingStatus?: CsTrainingStatus;
  lastTouchpointAt?: string | null;
  nextAction?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CustomerSuccessAccountListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  segment?: string;
  lifecycleStage?: string;
  riskStatus?: string;
  csmOwnerId?: string;
  scope?: CustomerSuccessScope;
  sortBy?: CustomerSuccessAccountSortField;
  sortOrder?: CrmSortOrder;
}

export interface CustomerSuccessAccountResponse {
  customerSuccessAccount: CustomerSuccessAccountDetail;
}

export interface CustomerSuccessAccountsResponse {
  customerSuccessAccounts: CustomerSuccessAccountSummary[];
  pagination: CrmPagination;
}

export interface CustomerSuccessOptionsResponse {
  owners: CrmLookupUserSummary[];
  accounts: AccountLookupSummary[];
  segments: CrmOptionValueSummary[];
  lifecycleStages: CrmOptionValueSummary[];
  riskStatuses: CrmOptionValueSummary[];
  expansionPotentials: CrmOptionValueSummary[];
  renewalStatuses: CrmOptionValueSummary[];
  availableScopes: CustomerSuccessScope[];
}

export interface CsOnboardingWorkspaceResponse {
  scope: CustomerSuccessScope;
  newCustomerCount: number;
  inOnboardingCount: number;
  completedOnboardingCount: number;
  atRiskCount: number;
  accounts: CustomerSuccessAccountSummary[];
  aiPlaceholders: CsAiPlaceholderSummary;
}

export interface CsScaledWorkspaceResponse {
  scope: CustomerSuccessScope;
  portfolioCount: number;
  healthyCount: number;
  atRiskCount: number;
  renewalsDueCount: number;
  averageHealthScore: number | null;
  segmentDistribution: Array<{ segment: CrmOptionValueSummary | null; accountCount: number }>;
  accounts: CustomerSuccessAccountSummary[];
  lowTouchCampaignsPlaceholder: CsPlaceholderSurface;
  automatedCheckInPlaceholder: CsPlaceholderSurface;
  aiPlaceholders: CsAiPlaceholderSummary;
}

export interface CsEnterpriseWorkspaceResponse {
  scope: CustomerSuccessScope;
  accountCount: number;
  openEscalationCount: number;
  upcomingQbrCount: number;
  expansionOpportunityCount: number;
  totalContractValue: number;
  accounts: CustomerSuccessAccountSummary[];
  aiPlaceholders: CsAiPlaceholderSummary;
}

export interface CustomerSuccessDashboardResponse {
  scope: CustomerSuccessScope;
  totalAccounts: number;
  averageHealthScore: number | null;
  averageAdoptionScore: number | null;
  atRiskCount: number;
  openEscalationCount: number;
  renewalsDueCount: number;
  totalContractValue: number;
  segmentDistribution: Array<{ segment: CrmOptionValueSummary | null; accountCount: number }>;
  riskDistribution: Array<{ riskStatus: CrmOptionValueSummary | null; accountCount: number }>;
  lifecycleDistribution: Array<{ lifecycleStage: CrmOptionValueSummary | null; accountCount: number }>;
}

export interface CustomerHealthDashboardResponse {
  scope: CustomerSuccessScope;
  averageHealthScore: number | null;
  averageAdoptionScore: number | null;
  healthyCount: number;
  watchCount: number;
  atRiskCount: number;
  criticalCount: number;
  decliningSupportCount: number;
  riskDistribution: Array<{ riskStatus: CrmOptionValueSummary | null; accountCount: number }>;
}

export interface RenewalDashboardResponse {
  scope: CustomerSuccessScope;
  totalRenewals: number;
  renewalsDueSoonCount: number;
  totalContractValue: number;
  forecastValue: number;
  renewedCount: number;
  churnedCount: number;
  statusDistribution: Array<{ status: CrmOptionValueSummary | null; renewalCount: number; forecastValue: number }>;
}

// ============================================================================
// Phase 17: Customer Training Module
// ============================================================================

export const trainingProgramStatuses = ["draft", "published", "archived"] as const;
export type TrainingProgramStatus = (typeof trainingProgramStatuses)[number];

export const trainingLessonTypes = ["article", "video", "quiz", "interactive"] as const;
export type TrainingLessonType = (typeof trainingLessonTypes)[number];

export const trainingAssetTypes = ["link", "video", "document", "scorm"] as const;
export type TrainingAssetType = (typeof trainingAssetTypes)[number];

export const trainingAssigneeTypes = ["user", "contact", "account"] as const;
export type TrainingAssigneeType = (typeof trainingAssigneeTypes)[number];

export const trainingAssignmentStatuses = ["assigned", "in_progress", "completed", "expired"] as const;
export type TrainingAssignmentStatus = (typeof trainingAssignmentStatuses)[number];

export const trainingProgressStatuses = ["not_started", "in_progress", "completed"] as const;
export type TrainingProgressStatus = (typeof trainingProgressStatuses)[number];

export const trainingLearnerTypes = ["user", "contact"] as const;
export type TrainingLearnerType = (typeof trainingLearnerTypes)[number];

export const trainingProgramSortFields = ["title", "status", "category", "updatedAt", "createdAt"] as const;
export type TrainingProgramSortField = (typeof trainingProgramSortFields)[number];

export interface TrainingPlaceholderSurface {
  available: false;
  message: string;
}

export interface TrainingAiPlaceholderAction {
  key: "ai_product_trainer" | "learning_path_recommender" | "lesson_summarizer" | "quiz_generator" | "knowledge_gap_detection";
  label: string;
  description: string;
}

export interface TrainingAiPlaceholderSummary {
  actions: TrainingAiPlaceholderAction[];
  governanceHint: string;
}

export interface TrainingAssetSummary {
  id: string;
  name: string;
  assetType: TrainingAssetType;
  url: string | null;
  externalReference: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTrainingAssetRequestBody {
  name: string;
  assetType?: TrainingAssetType;
  url?: string | null;
  externalReference?: string | null;
  metadata?: Record<string, unknown>;
}

export interface TrainingLessonSummary {
  id: string;
  moduleId: string;
  title: string;
  content: string | null;
  lessonType: TrainingLessonType;
  durationMinutes: number | null;
  sortOrder: number;
  assets: TrainingAssetSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTrainingLessonRequestBody {
  title: string;
  content?: string | null;
  lessonType?: TrainingLessonType;
  durationMinutes?: number | null;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateTrainingLessonRequestBody {
  title?: string;
  content?: string | null;
  lessonType?: TrainingLessonType;
  durationMinutes?: number | null;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}

export interface TrainingModuleSummary {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  lessons: TrainingLessonSummary[];
  lessonCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTrainingModuleRequestBody {
  title: string;
  description?: string | null;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateTrainingModuleRequestBody {
  title?: string;
  description?: string | null;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}

export interface TrainingProgramSummary {
  id: string;
  title: string;
  description: string | null;
  status: TrainingProgramStatus;
  category: CrmOptionValueSummary | null;
  level: CrmOptionValueSummary | null;
  owner: CrmLookupUserSummary | null;
  estimatedMinutes: number | null;
  isRoleBased: boolean;
  targetRole: string | null;
  moduleCount: number;
  lessonCount: number;
  assignmentCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingProgramDetail extends TrainingProgramSummary {
  modules: TrainingModuleSummary[];
  averageRating: number | null;
  feedbackCount: number;
  roleBasedPathPlaceholder: TrainingPlaceholderSurface;
  certificationPlaceholder: TrainingPlaceholderSurface;
  aiPlaceholders: TrainingAiPlaceholderSummary;
}

export interface CreateTrainingProgramRequestBody {
  title: string;
  description?: string | null;
  status?: TrainingProgramStatus;
  categoryKey?: string;
  levelKey?: string;
  ownerId?: string | null;
  estimatedMinutes?: number | null;
  isRoleBased?: boolean;
  targetRole?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateTrainingProgramRequestBody {
  title?: string;
  description?: string | null;
  status?: TrainingProgramStatus;
  categoryKey?: string;
  levelKey?: string;
  ownerId?: string | null;
  estimatedMinutes?: number | null;
  isRoleBased?: boolean;
  targetRole?: string | null;
  metadata?: Record<string, unknown>;
}

export interface TrainingProgramListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  category?: string;
  ownerId?: string;
  sortBy?: TrainingProgramSortField;
  sortOrder?: CrmSortOrder;
}

export interface TrainingProgramResponse {
  program: TrainingProgramDetail;
}

export interface TrainingProgramsResponse {
  programs: TrainingProgramSummary[];
  pagination: CrmPagination;
}

export interface CustomerLearnerSummary {
  id: string;
  learnerType: TrainingLearnerType;
  displayName: string;
  email: string | null;
  user: CrmLookupUserSummary | null;
  contact: ContactRelationshipSummary | null;
  account: AccountLookupSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerLearnerRequestBody {
  learnerType?: TrainingLearnerType;
  userId?: string | null;
  contactId?: string | null;
  accountId?: string | null;
  displayName: string;
  email?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CustomerLearnersResponse {
  learners: CustomerLearnerSummary[];
}

export interface TrainingProgressItem {
  id: string;
  lessonId: string;
  lessonTitle: string;
  status: TrainingProgressStatus;
  progressPercent: number;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface TrainingAssignmentSummary {
  id: string;
  program: { id: string; title: string; status: TrainingProgramStatus } | null;
  assigneeType: TrainingAssigneeType;
  user: CrmLookupUserSummary | null;
  contact: ContactRelationshipSummary | null;
  account: AccountLookupSummary | null;
  learner: CustomerLearnerSummary | null;
  csAccountId: string | null;
  onboardingPlanId: string | null;
  status: TrainingAssignmentStatus;
  completionPercent: number;
  dueDate: string | null;
  completedAt: string | null;
  lessonCount: number;
  completedLessonCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingAssignmentDetail extends TrainingAssignmentSummary {
  progress: TrainingProgressItem[];
  aiPlaceholders: TrainingAiPlaceholderSummary;
}

export interface CreateTrainingAssignmentRequestBody {
  programId: string;
  assigneeType?: TrainingAssigneeType;
  userId?: string | null;
  contactId?: string | null;
  accountId?: string | null;
  csAccountId?: string | null;
  onboardingPlanId?: string | null;
  learnerId?: string | null;
  dueDate?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateTrainingAssignmentRequestBody {
  status?: TrainingAssignmentStatus;
  dueDate?: string | null;
  csAccountId?: string | null;
  onboardingPlanId?: string | null;
  learnerId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateTrainingProgressRequestBody {
  lessonId: string;
  status?: TrainingProgressStatus;
  progressPercent?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateTrainingFeedbackRequestBody {
  rating: number;
  comments?: string | null;
  lessonId?: string | null;
  learnerId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface TrainingFeedbackSummary {
  id: string;
  rating: number;
  comments: string | null;
  programId: string | null;
  lessonId: string | null;
  assignmentId: string | null;
  createdAt: string;
}

export interface TrainingAssignmentListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  programId?: string;
  userId?: string;
  accountId?: string;
  csAccountId?: string;
  sortBy?: "status" | "dueDate" | "updatedAt" | "createdAt";
  sortOrder?: CrmSortOrder;
}

export interface TrainingAssignmentResponse {
  assignment: TrainingAssignmentDetail;
}

export interface TrainingAssignmentsResponse {
  assignments: TrainingAssignmentSummary[];
  pagination: CrmPagination;
}

export interface TrainingOptionsResponse {
  owners: CrmLookupUserSummary[];
  accounts: AccountLookupSummary[];
  contacts: ContactRelationshipSummary[];
  categories: CrmOptionValueSummary[];
  levels: CrmOptionValueSummary[];
  customerSuccessAccounts: Array<{ id: string; accountName: string }>;
  programs: Array<{ id: string; title: string; status: TrainingProgramStatus }>;
}

export interface MyTrainingResponse {
  assignedCount: number;
  inProgressCount: number;
  completedCount: number;
  assignments: TrainingAssignmentSummary[];
  recommendedTrainingPlaceholder: TrainingPlaceholderSurface;
  aiPlaceholders: TrainingAiPlaceholderSummary;
}

export interface TrainingDashboardResponse {
  totalPrograms: number;
  publishedPrograms: number;
  totalAssignments: number;
  completedAssignments: number;
  inProgressAssignments: number;
  averageCompletionPercent: number | null;
  averageRating: number | null;
  categoryDistribution: Array<{ category: CrmOptionValueSummary | null; programCount: number }>;
  statusDistribution: Array<{ status: TrainingAssignmentStatus; assignmentCount: number }>;
}
