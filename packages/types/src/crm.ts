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

export interface LeadDetail extends LeadSummary {
  notes: CrmNoteSummary[];
  activities: CrmActivitySummary[];
  tasks: CrmTaskSummary[];
  timeline: CrmTimelineItem[];
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
}

export interface LeadResponse {
  lead: LeadDetail;
}

export interface LeadsResponse {
  leads: LeadSummary[];
  pagination: CrmPagination;
}

export interface LeadOptionsResponse {
  owners: CrmLookupUserSummary[];
  statuses: CrmOptionValueSummary[];
  sources: CrmOptionValueSummary[];
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

export interface SalesWorkspaceAiPlaceholderAction {
  key:
    | "call_script_generator"
    | "objection_handling"
    | "lead_research_summary"
    | "follow_up_email_generator"
    | "qualification_score";
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
  metadata?: Record<string, unknown>;
}

export interface SalesWorkspaceLeadResponse {
  lead: SalesWorkspaceLeadSummary;
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
}

export interface UpdateAccountRequestBody {
  name?: string;
  website?: string | null;
  industry?: string | null;
  accountTypeKey?: string | null;
  healthStatusKey?: string | null;
  ownerId?: string | null;
  metadata?: Record<string, unknown>;
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

export interface OpportunityStakeholderSummary extends ContactRelationshipSummary {}

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
    | "win_probability";
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
  stakeholders: OpportunityStakeholderSummary[];
  notes: CrmNoteSummary[];
  activities: CrmActivitySummary[];
  tasks: CrmTaskSummary[];
  timeline: CrmTimelineItem[];
  productsServicesPlaceholder: OpportunityPlaceholderSurface;
  forecastPlaceholder: OpportunityPlaceholderSurface;
  dealRiskPlaceholder: OpportunityPlaceholderSurface;
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
  key: "account_research_brief" | "stakeholder_map";
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
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BdTargetAccountDetail extends BdTargetAccountSummary {
  stakeholders: BdAccountStakeholderSummary[];
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
  requirementCount: number;
  metRequirementCount: number;
  gapRequirementCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PresalesRequestDetail extends PresalesRequestSummary {
  technicalRequirements: string | null;
  proposalContent: string | null;
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
  slaPolicies: SupportSlaPolicySummary[];
  availableScopes: SupportTicketScope[];
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
