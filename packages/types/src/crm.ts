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
