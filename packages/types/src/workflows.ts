// ============================================================================
// Phase 24: Workflow Automation Engine
// ============================================================================

export const workflowTriggerTypes = [
  "record_created",
  "record_updated",
  "stage_changed",
  "assignment_changed",
  "date_reached",
  "sla_breached",
  "campaign_response_received",
  "ticket_escalated",
  "ai_score_changed",
  "customer_health_changed",
  "onboarding_delayed",
  "training_incomplete",
  "renewal_approaching",
  "usage_dropped"
] as const;
export type WorkflowTriggerType = (typeof workflowTriggerTypes)[number];

export const workflowActionTypes = [
  "assign_owner",
  "create_task",
  "send_notification",
  "send_email",
  "update_field",
  "change_status",
  "trigger_approval",
  "call_webhook",
  "run_ai_prompt",
  "run_ai_agent",
  "create_support_ticket",
  "assign_training",
  "create_customer_success_task",
  "trigger_renewal_playbook"
] as const;
export type WorkflowActionType = (typeof workflowActionTypes)[number];

export const workflowStatuses = ["draft", "active", "inactive"] as const;
export type WorkflowStatus = (typeof workflowStatuses)[number];

export const workflowRunStatuses = ["running", "succeeded", "failed", "skipped"] as const;
export type WorkflowRunStatus = (typeof workflowRunStatuses)[number];

export const workflowLogStatuses = ["succeeded", "failed", "skipped"] as const;
export type WorkflowLogStatus = (typeof workflowLogStatuses)[number];

export const workflowConditionOperators = ["eq", "ne", "gt", "lt", "gte", "lte", "contains", "exists", "in"] as const;
export type WorkflowConditionOperator = (typeof workflowConditionOperators)[number];

export interface WorkflowCondition {
  field: string;
  operator: WorkflowConditionOperator;
  value?: unknown;
}

// ----------------------------------------------------------------------------
// Catalogs (for the builder UI; never hardcoded in business logic)
// ----------------------------------------------------------------------------

export interface WorkflowTriggerDefinition {
  type: WorkflowTriggerType;
  label: string;
  description: string;
  entity: string;
}

export interface WorkflowActionDefinition {
  type: WorkflowActionType;
  label: string;
  description: string;
  category: "assignment" | "task" | "communication" | "record" | "approval" | "integration" | "ai" | "support" | "customer_success";
  isAi: boolean;
  placeholder: boolean;
  defaultRequiredPermission: string | null;
}

export const workflowTriggerCatalog: WorkflowTriggerDefinition[] = [
  { type: "record_created", label: "Record created", description: "A record is created.", entity: "record" },
  { type: "record_updated", label: "Record updated", description: "A record is updated.", entity: "record" },
  { type: "stage_changed", label: "Stage changed", description: "An opportunity stage changes.", entity: "opportunity" },
  { type: "assignment_changed", label: "Assignment changed", description: "A record owner/assignee changes.", entity: "record" },
  { type: "date_reached", label: "Date reached", description: "A scheduled date is reached.", entity: "record" },
  { type: "sla_breached", label: "SLA breached", description: "A support SLA is breached.", entity: "ticket" },
  { type: "campaign_response_received", label: "Campaign response received", description: "A campaign member responds.", entity: "campaign" },
  { type: "ticket_escalated", label: "Ticket escalated", description: "A support ticket is escalated.", entity: "ticket" },
  { type: "ai_score_changed", label: "AI score changed", description: "An AI-derived score changes.", entity: "record" },
  { type: "customer_health_changed", label: "Customer health changed", description: "A customer health score changes.", entity: "cs_account" },
  { type: "onboarding_delayed", label: "Onboarding delayed", description: "Onboarding falls behind schedule.", entity: "cs_account" },
  { type: "training_incomplete", label: "Training incomplete", description: "Assigned training is overdue.", entity: "training_assignment" },
  { type: "renewal_approaching", label: "Renewal approaching", description: "A renewal date is near.", entity: "renewal" },
  { type: "usage_dropped", label: "Usage dropped", description: "Product usage declines.", entity: "cs_account" }
];

export const workflowActionCatalog: WorkflowActionDefinition[] = [
  { type: "assign_owner", label: "Assign owner", description: "Assign a record owner.", category: "assignment", isAi: false, placeholder: false, defaultRequiredPermission: "workflows.manage_workflow" },
  { type: "create_task", label: "Create task", description: "Create a follow-up task.", category: "task", isAi: false, placeholder: false, defaultRequiredPermission: "workflows.manage_workflow" },
  { type: "send_notification", label: "Send notification", description: "Send an in-app notification.", category: "communication", isAi: false, placeholder: false, defaultRequiredPermission: "workflows.manage_workflow" },
  { type: "send_email", label: "Send email", description: "Send an email (deferred).", category: "communication", isAi: false, placeholder: true, defaultRequiredPermission: "workflows.manage_workflow" },
  { type: "update_field", label: "Update field", description: "Update a record field.", category: "record", isAi: false, placeholder: false, defaultRequiredPermission: "workflows.manage_workflow" },
  { type: "change_status", label: "Change status", description: "Change a record status.", category: "record", isAi: false, placeholder: false, defaultRequiredPermission: "workflows.manage_workflow" },
  { type: "trigger_approval", label: "Trigger approval", description: "Start an approval flow.", category: "approval", isAi: false, placeholder: false, defaultRequiredPermission: "workflows.approve" },
  { type: "call_webhook", label: "Call webhook", description: "Call an external webhook (deferred).", category: "integration", isAi: false, placeholder: true, defaultRequiredPermission: "workflows.manage_workflow" },
  { type: "run_ai_prompt", label: "Run AI prompt", description: "Run a prompt through the AI Gateway.", category: "ai", isAi: true, placeholder: false, defaultRequiredPermission: "ai.use_ai" },
  { type: "run_ai_agent", label: "Run AI agent", description: "Dispatch an AI agent through the AI Gateway.", category: "ai", isAi: true, placeholder: false, defaultRequiredPermission: "ai.use_ai" },
  { type: "create_support_ticket", label: "Create support ticket", description: "Open a support ticket.", category: "support", isAi: false, placeholder: false, defaultRequiredPermission: "support.create" },
  { type: "assign_training", label: "Assign training", description: "Assign a training program.", category: "customer_success", isAi: false, placeholder: false, defaultRequiredPermission: "training.assign" },
  { type: "create_customer_success_task", label: "Create customer success task", description: "Create a CS task.", category: "customer_success", isAi: false, placeholder: false, defaultRequiredPermission: "customer_success.create" },
  { type: "trigger_renewal_playbook", label: "Trigger renewal playbook", description: "Start a renewal playbook.", category: "customer_success", isAi: false, placeholder: false, defaultRequiredPermission: "customer_success.manage_workflow" }
];

export function findWorkflowAction(type: string): WorkflowActionDefinition | undefined {
  return workflowActionCatalog.find((action) => action.type === type);
}

export interface WorkflowCatalogResponse {
  triggers: WorkflowTriggerDefinition[];
  actions: WorkflowActionDefinition[];
}

// ----------------------------------------------------------------------------
// Entities
// ----------------------------------------------------------------------------

export interface WorkflowAction {
  id: string;
  workflowId: string;
  actionType: WorkflowActionType;
  actionConfig: Record<string, unknown>;
  requiresPermission: string | null;
  sequence: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string;
  module: string;
  triggerType: WorkflowTriggerType;
  status: WorkflowStatus;
  isEnabled: boolean;
  conditionCount: number;
  actionCount: number;
  runCount: number;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface WorkflowDetail extends WorkflowSummary {
  triggerConfig: Record<string, unknown>;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
}

export interface WorkflowLog {
  id: string;
  runId: string;
  workflowId: string;
  actionId: string | null;
  actionType: string | null;
  sequence: number;
  status: WorkflowLogStatus;
  message: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  triggerType: string;
  status: WorkflowRunStatus;
  actionsTotal: number;
  actionsSucceeded: number;
  actionsFailed: number;
  errorMessage: string;
  startedAt: string;
  finishedAt: string | null;
  triggeredBy: string | null;
  createdAt: string;
}

export interface WorkflowRunDetail extends WorkflowRun {
  triggerContext: Record<string, unknown>;
  logs: WorkflowLog[];
}

// ----------------------------------------------------------------------------
// Requests / responses
// ----------------------------------------------------------------------------

export interface CreateWorkflowRequestBody {
  name: string;
  description?: string;
  module?: string;
  triggerType: WorkflowTriggerType;
  triggerConfig?: Record<string, unknown>;
  conditions?: WorkflowCondition[];
  metadata?: Record<string, unknown>;
}

export interface UpdateWorkflowRequestBody {
  name?: string;
  description?: string;
  module?: string;
  triggerType?: WorkflowTriggerType;
  triggerConfig?: Record<string, unknown>;
  conditions?: WorkflowCondition[];
  status?: WorkflowStatus;
  isEnabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CreateWorkflowActionRequestBody {
  actionType: WorkflowActionType;
  actionConfig?: Record<string, unknown>;
  requiresPermission?: string | null;
  sequence?: number;
  isEnabled?: boolean;
}

export interface UpdateWorkflowActionRequestBody {
  actionConfig?: Record<string, unknown>;
  requiresPermission?: string | null;
  sequence?: number;
  isEnabled?: boolean;
}

export interface RunWorkflowRequestBody {
  context?: Record<string, unknown>;
}

export interface WorkflowListQuery {
  triggerType?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface WorkflowListResponse {
  workflows: WorkflowSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface WorkflowResponse {
  workflow: WorkflowDetail;
}

export interface WorkflowActionResponse {
  action: WorkflowAction;
}

export interface WorkflowRunResponse {
  run: WorkflowRunDetail;
}

export interface WorkflowRunListResponse {
  runs: WorkflowRun[];
}
