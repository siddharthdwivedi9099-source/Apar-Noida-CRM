export const crmEntityTypes = [
  "lead",
  "account",
  "contact",
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
