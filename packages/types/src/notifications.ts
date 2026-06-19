import type { CrmLookupUserSummary, CrmPagination } from "./crm.js";
import type { RoleSummary } from "./index.js";

export const notificationTypes = [
  "approval_requested",
  "approval_decided",
  "approval_completed",
  "workflow_signal",
  "record_assignment",
  "campaign_update",
  "customer_escalation",
  "sensitive_ai_action",
  "system_announcement"
] as const;

export type NotificationType = (typeof notificationTypes)[number];

export const notificationStatusFilters = ["all", "read", "unread"] as const;
export type NotificationStatusFilter = (typeof notificationStatusFilters)[number];

export interface NotificationTypeDefinition {
  key: NotificationType;
  label: string;
  description: string;
  defaultEnabled: boolean;
}

export const notificationTypeCatalog: NotificationTypeDefinition[] = [
  {
    key: "approval_requested",
    label: "Approval requested",
    description: "A new approval request needs action from the recipient.",
    defaultEnabled: true
  },
  {
    key: "approval_decided",
    label: "Approval decided",
    description: "An approval request was approved or rejected.",
    defaultEnabled: true
  },
  {
    key: "approval_completed",
    label: "Approval completed",
    description: "An approval workflow reached its final state.",
    defaultEnabled: true
  },
  {
    key: "workflow_signal",
    label: "Workflow signal",
    description: "A workflow generated an in-app notification.",
    defaultEnabled: true
  },
  {
    key: "record_assignment",
    label: "Record assignment",
    description: "A record or queue item was assigned to the recipient.",
    defaultEnabled: true
  },
  {
    key: "campaign_update",
    label: "Campaign update",
    description: "A campaign-linked activity created a new notification.",
    defaultEnabled: true
  },
  {
    key: "customer_escalation",
    label: "Customer escalation",
    description: "A customer escalation requires awareness or follow-up.",
    defaultEnabled: true
  },
  {
    key: "sensitive_ai_action",
    label: "Sensitive AI action",
    description: "A governed AI action needs human review or awareness.",
    defaultEnabled: true
  },
  {
    key: "system_announcement",
    label: "System announcement",
    description: "A tenant-wide or role-scoped platform announcement.",
    defaultEnabled: true
  }
];

export interface NotificationLinkedRecord {
  entityType: string;
  entityId: string;
}

export interface NotificationSummary {
  id: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  actor: CrmLookupUserSummary | null;
  recipientRole: RoleSummary | null;
  linkedRecord: NotificationLinkedRecord | null;
  metadata: Record<string, unknown>;
}

export interface NotificationPreferenceSummary {
  notificationType: NotificationType;
  label: string;
  description: string;
  enabled: boolean;
  updatedAt: string | null;
}

export interface NotificationListQuery {
  page?: number;
  pageSize?: number;
  status?: NotificationStatusFilter;
  notificationType?: NotificationType;
}

export interface CreateNotificationRequestBody {
  notificationType: NotificationType;
  title: string;
  message: string;
  recipientUserId?: string | null;
  recipientRoleId?: string | null;
  recipientRoleSlug?: string | null;
  linkedRecord?: NotificationLinkedRecord | null;
  metadata?: Record<string, unknown>;
}

export interface ReplaceNotificationPreferencesRequestBody {
  preferences: Array<{
    notificationType: NotificationType;
    enabled: boolean;
  }>;
}

export interface NotificationResponse {
  notification: NotificationSummary;
}

export interface NotificationsResponse {
  notifications: NotificationSummary[];
  pagination: CrmPagination;
  unreadCount: number;
  availableTypes: NotificationTypeDefinition[];
}

export interface NotificationPreferencesResponse {
  preferences: NotificationPreferenceSummary[];
}

export interface NotificationMutationResponse {
  success: true;
  unreadCount: number;
}

export const approvalTypes = [
  "discount_approval",
  "campaign_approval",
  "proposal_approval",
  "partner_approval",
  "reseller_approval",
  "sensitive_ai_action_approval",
  "customer_escalation_approval"
] as const;

export type ApprovalType = (typeof approvalTypes)[number];

export const approvalStatuses = ["pending", "approved", "rejected", "cancelled"] as const;
export type ApprovalStatus = (typeof approvalStatuses)[number];

export const approvalScopes = ["assigned", "requested", "all"] as const;
export type ApprovalScope = (typeof approvalScopes)[number];

export const approvalHistoryActions = [
  "created",
  "commented",
  "approved",
  "rejected",
  "cancelled",
  "reassigned"
] as const;

export type ApprovalHistoryAction = (typeof approvalHistoryActions)[number];

export interface ApprovalTypeDefinition {
  key: ApprovalType;
  label: string;
  description: string;
}

export const approvalTypeCatalog: ApprovalTypeDefinition[] = [
  {
    key: "discount_approval",
    label: "Discount approval",
    description: "Commercial discount approval before the record proceeds."
  },
  {
    key: "campaign_approval",
    label: "Campaign approval",
    description: "Marketing campaign approval before activation or launch."
  },
  {
    key: "proposal_approval",
    label: "Proposal approval",
    description: "Proposal review and sign-off workflow."
  },
  {
    key: "partner_approval",
    label: "Partner approval",
    description: "Partner-facing approval and governance workflow."
  },
  {
    key: "reseller_approval",
    label: "Reseller approval",
    description: "Reseller-facing approval and governance workflow."
  },
  {
    key: "sensitive_ai_action_approval",
    label: "Sensitive AI action approval",
    description: "Human approval for governed AI actions with elevated risk."
  },
  {
    key: "customer_escalation_approval",
    label: "Customer escalation approval",
    description: "Approval routing for escalations affecting customer delivery or risk."
  }
];

export interface ApprovalHistoryEntry {
  id: string;
  action: ApprovalHistoryAction;
  actor: CrmLookupUserSummary | null;
  fromStatus: ApprovalStatus | null;
  toStatus: ApprovalStatus | null;
  comment: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface ApprovalRequestSummary {
  id: string;
  approvalType: ApprovalType;
  title: string;
  description: string | null;
  status: ApprovalStatus;
  requestedBy: CrmLookupUserSummary | null;
  approverUser: CrmLookupUserSummary | null;
  approverRole: RoleSummary | null;
  decidedBy: CrmLookupUserSummary | null;
  linkedRecord: NotificationLinkedRecord | null;
  latestComment: string | null;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  metadata: Record<string, unknown>;
}

export interface ApprovalRequestDetail extends ApprovalRequestSummary {
  history: ApprovalHistoryEntry[];
}

export interface ApprovalListQuery {
  page?: number;
  pageSize?: number;
  status?: ApprovalStatus | "all";
  scope?: ApprovalScope;
  approvalType?: ApprovalType;
  search?: string;
}

export interface CreateApprovalRequestBody {
  approvalType: ApprovalType;
  title: string;
  description?: string | null;
  approverUserId?: string | null;
  approverRoleId?: string | null;
  approverRoleSlug?: string | null;
  linkedRecord?: NotificationLinkedRecord | null;
  initialComment?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ApprovalDecisionRequestBody {
  decision: "approved" | "rejected";
  comment?: string | null;
}

export interface AddApprovalCommentRequestBody {
  comment: string;
  metadata?: Record<string, unknown>;
}

export interface ApprovalResponse {
  approval: ApprovalRequestDetail;
}

export interface ApprovalsResponse {
  approvals: ApprovalRequestSummary[];
  pagination: CrmPagination;
  pendingCount: number;
  availableTypes: ApprovalTypeDefinition[];
}
