// ============================================================================
// Section 12: Required Workflow Automations (config-driven seed definitions)
//
// These are NOT hard-coded business rules. Each entry is a declarative
// configuration for the Phase 24 workflow engine (workflows + workflow_actions)
// that is seeded per tenant and is fully editable from the workflow builder.
// Every automation maps a required behaviour onto an existing trigger type and
// one or more existing action types, reusing the real executors (notifications,
// approvals, AI Gateway) where they exist and governed, logged placeholder
// actions elsewhere. Adding/removing an automation is a configuration change.
// ============================================================================

import type { WorkflowActionType, WorkflowCondition, WorkflowTriggerType } from "./workflows.js";

export interface WorkflowAutomationActionSeed {
  actionType: WorkflowActionType;
  actionConfig?: Record<string, unknown>;
  requiresPermission?: string | null;
}

export interface WorkflowAutomationSeed {
  seedKey: string;
  name: string;
  description: string;
  module: string;
  triggerType: WorkflowTriggerType;
  triggerConfig?: Record<string, unknown>;
  conditions?: WorkflowCondition[];
  actions: WorkflowAutomationActionSeed[];
}

// Helper builders keep each definition terse and consistent.
const notify = (config: Record<string, unknown>): WorkflowAutomationActionSeed => ({ actionType: "send_notification", actionConfig: config });
const aiAgent = (agentKey: string, instruction: string): WorkflowAutomationActionSeed => ({
  actionType: "run_ai_agent",
  actionConfig: { agentKey, templateKey: "generic_assistant", variables: { prompt: instruction } }
});
const aiPrompt = (instruction: string): WorkflowAutomationActionSeed => ({
  actionType: "run_ai_prompt",
  actionConfig: { templateKey: "generic_assistant", variables: { prompt: instruction } }
});
// Approvals need a resolvable approver. The seed targets the always-present
// "super-admin" role as a safe default; admins reconfigure to their approver role.
const approval = (approvalType: string, title: string): WorkflowAutomationActionSeed => ({
  actionType: "trigger_approval",
  actionConfig: { approvalType, title, approverRoleSlug: "super-admin" }
});
const field = (updates: Record<string, unknown>): WorkflowAutomationActionSeed => ({ actionType: "update_field", actionConfig: updates });
const task = (config: Record<string, unknown>): WorkflowAutomationActionSeed => ({ actionType: "create_task", actionConfig: config });

export const defaultWorkflowAutomationDefinitions: WorkflowAutomationSeed[] = [
  {
    seedKey: "auto-create-lead-from-form",
    name: "Auto-create lead from form submission",
    description: "When a campaign/web form is submitted, capture the lead and notify the routing owner.",
    module: "leads",
    triggerType: "campaign_response_received",
    triggerConfig: { source: "web_form" },
    actions: [
      { actionType: "assign_owner", actionConfig: { strategy: "round_robin", pool: "lead_routing" } },
      notify({ notificationType: "record_assignment", title: "New lead from form", message: "A new lead was captured from a form submission and assigned for follow-up." })
    ]
  },
  {
    seedKey: "auto-enrich-lead",
    name: "Auto-enrich lead after creation",
    description: "Enrich a newly created lead with firmographic data through the AI Gateway (human-reviewed).",
    module: "leads",
    triggerType: "record_created",
    triggerConfig: { entity: "lead" },
    actions: [aiAgent("lead-enrichment", "Enrich this lead with company, industry, size, website, role and talking points. Return with confidence and sources for human review.")]
  },
  {
    seedKey: "auto-detect-duplicate-lead",
    name: "Auto-detect duplicate lead",
    description: "Check a new lead against existing records and flag likely duplicates for review.",
    module: "leads",
    triggerType: "record_created",
    triggerConfig: { entity: "lead" },
    actions: [
      aiAgent("duplicate-detection", "Compare this lead against existing leads and accounts by email and name+company; report likely duplicates with confidence."),
      notify({ notificationType: "record_assignment", title: "Possible duplicate lead", message: "A newly created lead may be a duplicate. Review before proceeding.", deliverToActor: true })
    ]
  },
  {
    seedKey: "auto-score-lead",
    name: "Auto-score lead",
    description: "Score the lead from structured signals with an explanation, override and stored feedback.",
    module: "leads",
    triggerType: "record_created",
    triggerConfig: { entity: "lead" },
    actions: [aiAgent("lead-scoring", "Score this lead as hot/warm/cold from its structured signals, returning the weighted explanation and confidence.")]
  },
  {
    seedKey: "auto-mark-mql",
    name: "Auto-mark MQL when criteria are met",
    description: "Promote a lead to Marketing Qualified when its score crosses the configured threshold.",
    module: "leads",
    triggerType: "ai_score_changed",
    triggerConfig: { entity: "lead" },
    conditions: [{ field: "score", operator: "gte", value: 60 }],
    actions: [
      field({ lifecycleStage: "mql", mqlMarkedAt: "$now" }),
      notify({ notificationType: "record_assignment", title: "Lead qualified as MQL", message: "This lead met the MQL threshold and is ready for sales routing." })
    ]
  },
  {
    seedKey: "auto-route-mql",
    name: "Auto-route MQL to owner",
    description: "Assign a newly qualified MQL to the correct sales owner by routing rules.",
    module: "leads",
    triggerType: "record_updated",
    triggerConfig: { entity: "lead" },
    conditions: [{ field: "lifecycleStage", operator: "eq", value: "mql" }],
    actions: [
      { actionType: "assign_owner", actionConfig: { strategy: "territory", fallback: "round_robin" } },
      notify({ notificationType: "record_assignment", title: "MQL routed to you", message: "A marketing-qualified lead has been assigned to you for follow-up." })
    ]
  },
  {
    seedKey: "auto-start-lead-sla",
    name: "Auto-start lead SLA",
    description: "Start the first-response SLA clock when a lead is assigned to an owner.",
    module: "leads",
    triggerType: "assignment_changed",
    triggerConfig: { entity: "lead" },
    actions: [field({ slaStartedAt: "$now", slaPolicy: "lead_first_response" })]
  },
  {
    seedKey: "auto-create-followup-cadence",
    name: "Auto-create follow-up cadence",
    description: "Create the standard multi-touch follow-up cadence tasks for a newly assigned lead.",
    module: "leads",
    triggerType: "assignment_changed",
    triggerConfig: { entity: "lead" },
    actions: [task({ cadence: "lead_nurture", title: "Follow-up: first touch", offsets: [0, 2, 5, 10] })]
  },
  {
    seedKey: "auto-escalate-hot-lead",
    name: "Auto-escalate untouched hot lead",
    description: "Escalate to the manager when a hot lead is not actioned within the SLA window.",
    module: "leads",
    triggerType: "sla_breached",
    triggerConfig: { entity: "lead", policy: "lead_first_response" },
    conditions: [{ field: "score", operator: "gte", value: 80 }],
    actions: [notify({ notificationType: "customer_escalation", title: "Hot lead untouched", message: "A hot lead has breached the first-response SLA and needs manager attention.", intendedRecipientRole: "sales-manager" })]
  },
  {
    seedKey: "auto-recycle-cold-leads",
    name: "Auto-recycle cold leads",
    description: "Move inactive/cold leads back to nurture after a period of no engagement.",
    module: "leads",
    triggerType: "date_reached",
    triggerConfig: { entity: "lead", after: "no_activity_days:30" },
    actions: [
      { actionType: "change_status", actionConfig: { status: "recycled", reason: "no_engagement_30d" } },
      notify({ notificationType: "record_assignment", title: "Lead recycled to nurture", message: "A cold lead was recycled back into the nurture pool." })
    ]
  },
  {
    seedKey: "auto-create-opportunity-on-conversion",
    name: "Auto-create opportunity on conversion",
    description: "Create an opportunity when a lead is converted.",
    module: "opportunities",
    triggerType: "record_updated",
    triggerConfig: { entity: "lead" },
    conditions: [{ field: "status", operator: "eq", value: "converted" }],
    actions: [
      field({ createOpportunity: true, opportunityStage: "qualification" }),
      notify({ notificationType: "record_assignment", title: "Opportunity created", message: "A converted lead has generated a new opportunity." })
    ]
  },
  {
    seedKey: "auto-create-account-contact-on-conversion",
    name: "Auto-create account/contact during conversion",
    description: "Create the account and primary contact when a lead is converted.",
    module: "accounts",
    triggerType: "record_updated",
    triggerConfig: { entity: "lead" },
    conditions: [{ field: "status", operator: "eq", value: "converted" }],
    actions: [field({ createAccount: true, createPrimaryContact: true })]
  },
  {
    seedKey: "auto-create-demo-request",
    name: "Auto-create demo request",
    description: "Raise a demo request to presales when a prospect asks for a demo.",
    module: "presales",
    triggerType: "record_updated",
    triggerConfig: { entity: "opportunity" },
    conditions: [{ field: "demoRequested", operator: "eq", value: true }],
    actions: [
      task({ team: "presales", title: "Prepare product demo", type: "demo_request" }),
      notify({ notificationType: "record_assignment", title: "Demo requested", message: "A demo has been requested for this opportunity.", intendedRecipientRole: "presales-engineer" })
    ]
  },
  {
    seedKey: "auto-create-proposal-request",
    name: "Auto-create proposal request",
    description: "Request a proposal when an opportunity reaches the proposal stage.",
    module: "opportunities",
    triggerType: "stage_changed",
    triggerConfig: { entity: "opportunity", toStage: "proposal" },
    actions: [
      task({ team: "presales", title: "Draft proposal", type: "proposal_request" }),
      notify({ notificationType: "record_assignment", title: "Proposal requested", message: "This opportunity reached the proposal stage; a proposal draft is needed." })
    ]
  },
  {
    seedKey: "auto-trigger-discount-approval",
    name: "Auto-trigger discount approval",
    description: "Open a discount approval when the requested discount exceeds the policy threshold.",
    module: "opportunities",
    triggerType: "record_updated",
    triggerConfig: { entity: "opportunity" },
    conditions: [{ field: "discountPercent", operator: "gt", value: 15 }],
    actions: [approval("discount_approval", "Discount approval required")]
  },
  {
    seedKey: "auto-trigger-legal-review",
    name: "Auto-trigger legal review",
    description: "Open a legal review when a contract/redlined terms are attached to an opportunity.",
    module: "opportunities",
    triggerType: "stage_changed",
    triggerConfig: { entity: "opportunity", toStage: "contract" },
    actions: [approval("legal_clause_approval", "Legal review required")]
  },
  {
    seedKey: "auto-create-onboarding-after-won",
    name: "Auto-create onboarding project after closed won",
    description: "Kick off the customer onboarding project when an opportunity is won.",
    module: "customer_success",
    triggerType: "stage_changed",
    triggerConfig: { entity: "opportunity", toStage: "closed_won" },
    actions: [
      { actionType: "create_customer_success_task", actionConfig: { type: "onboarding_project", title: "Start customer onboarding" } },
      notify({ notificationType: "record_assignment", title: "Onboarding kicked off", message: "A closed-won deal has started the onboarding project.", intendedRecipientRole: "customer-success-manager" })
    ]
  },
  {
    seedKey: "auto-create-renewal-opportunity",
    name: "Auto-create renewal opportunity before renewal date",
    description: "Create the renewal opportunity and start the playbook ahead of the renewal date.",
    module: "customer_success",
    triggerType: "renewal_approaching",
    triggerConfig: { entity: "renewal", leadDays: 90 },
    actions: [
      { actionType: "trigger_renewal_playbook", actionConfig: { playbook: "standard_renewal" } },
      notify({ notificationType: "record_assignment", title: "Renewal opportunity created", message: "A renewal is approaching; the renewal opportunity and playbook have started.", intendedRecipientRole: "customer-success-manager" })
    ]
  },
  {
    seedKey: "auto-trigger-churn-playbook",
    name: "Auto-trigger churn risk playbook",
    description: "Launch the churn-risk playbook when a customer's health drops below threshold.",
    module: "customer_success",
    triggerType: "customer_health_changed",
    triggerConfig: { entity: "cs_account" },
    conditions: [{ field: "healthScore", operator: "lt", value: 50 }],
    actions: [
      { actionType: "create_customer_success_task", actionConfig: { type: "churn_playbook", title: "Run churn-risk playbook" } },
      notify({ notificationType: "customer_escalation", title: "Churn risk detected", message: "A customer's health dropped below threshold; the churn playbook has started.", intendedRecipientRole: "customer-success-manager" })
    ]
  },
  {
    seedKey: "auto-escalate-sla-breached-ticket",
    name: "Auto-escalate SLA-breached tickets",
    description: "Escalate support tickets to the manager when the SLA is breached.",
    module: "support",
    triggerType: "sla_breached",
    triggerConfig: { entity: "ticket" },
    actions: [
      { actionType: "change_status", actionConfig: { escalationStatus: "escalated" } },
      notify({ notificationType: "customer_escalation", title: "Ticket SLA breached", message: "A support ticket breached its SLA and has been escalated.", intendedRecipientRole: "support-manager" })
    ]
  },
  {
    seedKey: "auto-send-csat-after-closure",
    name: "Auto-send CSAT after ticket closure",
    description: "Send the CSAT survey when a support ticket is closed.",
    module: "support",
    triggerType: "record_updated",
    triggerConfig: { entity: "ticket" },
    conditions: [{ field: "status", operator: "eq", value: "closed" }],
    actions: [
      field({ "csat.requested": true, "csat.requestedAt": "$now" }),
      { actionType: "send_email", actionConfig: { template: "csat_survey", subject: "How did we do?" } }
    ]
  },
  {
    seedKey: "auto-suggest-knowledge-article",
    name: "Auto-suggest knowledge article",
    description: "Suggest relevant approved knowledge articles when a ticket is created.",
    module: "support",
    triggerType: "record_created",
    triggerConfig: { entity: "ticket" },
    actions: [aiAgent("knowledge-assistant", "Suggest the most relevant approved knowledge-base articles for this ticket, citing sources; flag if confidence is low.")]
  },
  {
    seedKey: "auto-generate-meeting-summary",
    name: "Auto-generate AI meeting summary",
    description: "Generate a structured AI summary when meeting notes are captured (human-editable).",
    module: "cross_functional",
    triggerType: "record_created",
    triggerConfig: { entity: "meeting" },
    actions: [aiAgent("call-summary", "Summarize these meeting notes into pain points, decisions, objections, next steps, stakeholders and sentiment for human review.")]
  },
  {
    seedKey: "auto-create-tasks-from-meeting",
    name: "Auto-create tasks from meeting notes",
    description: "Extract action items from a meeting summary and create follow-up tasks.",
    module: "cross_functional",
    triggerType: "record_created",
    triggerConfig: { entity: "meeting_summary" },
    actions: [
      aiPrompt("Extract the action items and owners from this meeting summary as a task list."),
      task({ source: "meeting_notes", title: "Meeting follow-up action items" })
    ]
  },
  {
    seedKey: "auto-alert-manager-stagnant-deal",
    name: "Auto-alert manager for stagnant deals",
    description: "Alert the sales manager when an open deal has no activity for the stagnation window.",
    module: "opportunities",
    triggerType: "date_reached",
    triggerConfig: { entity: "opportunity", after: "no_activity_days:14" },
    conditions: [{ field: "isOpen", operator: "eq", value: true }],
    actions: [notify({ notificationType: "customer_escalation", title: "Stagnant deal", message: "An open opportunity has had no activity for 14 days.", intendedRecipientRole: "sales-manager" })]
  },
  {
    seedKey: "auto-alert-sales-head-strategic-risk",
    name: "Auto-alert sales head for strategic deal risk",
    description: "Alert the sales head when a strategic (high-value) deal is flagged at risk.",
    module: "opportunities",
    triggerType: "record_updated",
    triggerConfig: { entity: "opportunity" },
    conditions: [
      { field: "amount", operator: "gte", value: 1000000 },
      { field: "riskLevel", operator: "in", value: ["high", "critical"] }
    ],
    actions: [notify({ notificationType: "customer_escalation", title: "Strategic deal at risk", message: "A strategic high-value opportunity has been flagged at risk.", intendedRecipientRole: "sales-head" })]
  },
  {
    seedKey: "auto-update-forecast-category",
    name: "Auto-update forecast category based on opportunity data",
    description: "Recompute the forecast category (commit/best-case/pipeline) from stage and probability.",
    module: "opportunities",
    triggerType: "stage_changed",
    triggerConfig: { entity: "opportunity" },
    actions: [field({ recomputeForecastCategory: true })]
  },
  {
    seedKey: "auto-detect-partner-conflict",
    name: "Auto-detect partner conflict",
    description: "Flag channel conflict when an account has both a direct owner and a partner registration.",
    module: "partners",
    triggerType: "record_updated",
    triggerConfig: { entity: "account" },
    conditions: [{ field: "hasPartnerAndDirect", operator: "eq", value: true }],
    actions: [notify({ notificationType: "customer_escalation", title: "Partner conflict detected", message: "An account has both a direct owner and a partner deal registration; resolve ownership.", intendedRecipientRole: "partner-manager" })]
  },
  {
    seedKey: "auto-calculate-partner-commission",
    name: "Auto-calculate commission on closed-won partner deal",
    description: "Calculate partner commission when a partner-sourced deal is won.",
    module: "partners",
    triggerType: "stage_changed",
    triggerConfig: { entity: "opportunity", toStage: "closed_won" },
    conditions: [{ field: "partnerSourced", operator: "eq", value: true }],
    actions: [
      field({ computeCommission: true, commissionStatus: "pending_calculation" }),
      notify({ notificationType: "record_assignment", title: "Partner commission calculated", message: "A partner-sourced deal closed won; commission has been calculated.", intendedRecipientRole: "partner-manager" })
    ]
  },
  {
    seedKey: "auto-log-ai-actions-audit",
    name: "Auto-log AI actions in AI audit trail",
    description: "Record every AI action to the AI audit trail with confidence, explanation and reviewer.",
    module: "ai_governance",
    triggerType: "ai_score_changed",
    triggerConfig: { entity: "ai_action", scope: "all" },
    actions: [
      { actionType: "update_field", actionConfig: { appendAiAuditTrail: true, capture: ["confidence", "explanation", "sources", "reviewer", "decision"] } }
    ]
  }
];
