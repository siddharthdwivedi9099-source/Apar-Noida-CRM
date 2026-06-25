import type {
  BpfStage,
  BpfTransition,
  BusinessProcessFlowPayload,
  ConfigurationDefinition
} from "./configuration-definitions.js";

// ---------------------------------------------------------------------------
// CRM Business Process Flows — configured as governed configuration data.
//
// Every stage, order, required field, transition, SLA, aging threshold, and
// automation/notification/approval/AI trigger reference lives here as data, not
// hard-coded logic. These are seeded into `configuration_definitions` and are
// versioned, validated, published, and applied like any other configuration.
// Runtime enforcement/UI consumes these definitions in the following phase.
// ---------------------------------------------------------------------------

const BPF_PHASE = "phase-36-bpf-definitions";

function s(order: number, key: string, label: string, extra: Partial<BpfStage> = {}): BpfStage {
  return { key, order, label, ...extra };
}

function chain(keys: string[]): BpfTransition[] {
  const out: BpfTransition[] = [];
  for (let i = 0; i < keys.length - 1; i += 1) {
    out.push({ from: keys[i], to: keys[i + 1] });
  }
  return out;
}

function fanIn(froms: string[], to: string): BpfTransition[] {
  return froms.map((from) => ({ from, to }));
}

function bpf(
  definitionKey: string,
  name: string,
  description: string,
  payload: BusinessProcessFlowPayload
): ConfigurationDefinition {
  return {
    definitionType: "business_process_flow",
    definitionKey,
    name,
    description,
    isActive: true,
    definition: {
      ...payload,
      auditStageChanges: payload.auditStageChanges ?? true,
      managerOverrideAllowed: payload.managerOverrideAllowed ?? true,
      allowBackwardMovement: payload.allowBackwardMovement ?? true,
      backwardMovementRequiresReason: payload.backwardMovementRequiresReason ?? true,
      defaultDenyTransitions: payload.defaultDenyTransitions ?? true,
      metadata: { phase: BPF_PHASE }
    }
  };
}

// 1. Lead Lifecycle -----------------------------------------------------------
const leadStages: BpfStage[] = [
  s(1, "new-lead", "New Lead", { isEntry: true, requiredFields: ["leadSource"] }),
  s(2, "captured", "Captured", { requiredFields: ["leadSource"] }),
  s(3, "enriched", "Enriched", { aiTriggers: ["lead.ai-enrichment"] }),
  s(4, "duplicate-checked", "Duplicate Checked", { aiTriggers: ["lead.ai-duplicate-suggestion"] }),
  s(5, "scored", "Scored", { requiredFields: ["leadScore"], aiTriggers: ["lead.ai-scoring"] }),
  s(6, "marketing-qualified-lead", "Marketing Qualified Lead", {
    requiredFields: ["leadSource", "leadScore", "productInterest"],
    notifications: ["lead.mql-ready"]
  }),
  s(7, "assigned", "Assigned", { requiredFields: ["owner"], slaHours: 4, slaWarningHours: 2, notifications: ["lead.assigned"] }),
  s(8, "contact-attempted", "Contact Attempted", { slaHours: 24, slaWarningHours: 8, agingThresholdHours: 48 }),
  s(9, "connected", "Connected"),
  s(10, "qualified", "Qualified", {
    requiredFields: ["qualificationStatus", "nextFollowUp"],
    aiTriggers: ["lead.ai-qualification-suggestion"]
  }),
  s(11, "nurture", "Nurture", { agingThresholdHours: 720 }),
  s(12, "disqualified", "Disqualified", { isTerminal: true, requiredFields: ["disqualificationReason"] }),
  s(13, "converted", "Converted", { isTerminal: true, requiredFields: ["accountId", "contactId", "opportunityId"] })
];
const leadHappyPath = ["new-lead", "captured", "enriched", "duplicate-checked", "scored", "marketing-qualified-lead", "assigned", "contact-attempted", "connected", "qualified"];

// 2. Opportunity Lifecycle ----------------------------------------------------
const opportunityStages: BpfStage[] = [
  s(1, "created", "Created", { isEntry: true, requiredFields: ["accountId", "owner"] }),
  s(2, "discovery", "Discovery", { requiredFields: ["businessNeed"], aiTriggers: ["opportunity.ai-summary"] }),
  s(3, "need-analysis", "Need Analysis", { requiredFields: ["painPoints"] }),
  s(4, "demo-presentation", "Demo / Presentation", { requiredFields: ["productInterest", "decisionProcess"] }),
  s(5, "solution-fitment", "Solution Fitment"),
  s(6, "presales-validation", "Presales Validation", { tasks: ["opportunity.presales-request"] }),
  s(7, "proposal-preparation", "Proposal Preparation", { requiredFields: ["productScope", "stakeholders"] }),
  s(8, "proposal-submitted", "Proposal Submitted", { requiredFields: ["quoteId"] }),
  s(9, "commercial-review", "Commercial Review", { approvals: ["opportunity.discount-approval"], aiTriggers: ["opportunity.ai-risk-score"] }),
  s(10, "negotiation", "Negotiation", { requiredFields: ["commercialTerms"], slaHours: 120 }),
  s(11, "legal-contracting", "Legal / Contracting", { tasks: ["opportunity.legal-review"] }),
  s(12, "closed-won", "Closed Won", {
    isTerminal: true,
    requiredFields: ["finalValue", "contractStatus", "onboardingOwner", "handoverNote"]
  }),
  s(13, "closed-lost", "Closed Lost", { isTerminal: true, requiredFields: ["lossReason"] }),
  s(14, "deferred-on-hold", "Deferred / On Hold", { requiredFields: ["onHoldReason"], agingThresholdHours: 1440 })
];
const opportunityHappyPath = ["created", "discovery", "need-analysis", "demo-presentation", "solution-fitment", "presales-validation", "proposal-preparation", "proposal-submitted", "commercial-review", "negotiation", "legal-contracting"];

// 3. Campaign -----------------------------------------------------------------
const campaignStages: BpfStage[] = [
  s(1, "draft", "Draft", { isEntry: true, requiredFields: ["objective", "owner"] }),
  s(2, "audience-defined", "Audience Defined", { requiredFields: ["audience"] }),
  s(3, "content-prepared", "Content Prepared"),
  s(4, "approval-pending", "Approval Pending", { approvals: ["campaign.launch-approval"], notifications: ["campaign.approval-requested"] }),
  s(5, "approved", "Approved"),
  s(6, "scheduled", "Scheduled", { requiredFields: ["startDate"] }),
  s(7, "live", "Live", { notifications: ["campaign.went-live"] }),
  s(8, "paused", "Paused", { requiredFields: ["pauseReason"] }),
  s(9, "completed", "Completed"),
  s(10, "closed-with-report", "Closed with Report", { isTerminal: true, requiredFields: ["performanceSummary"] })
];
const campaignHappyPath = ["draft", "audience-defined", "content-prepared", "approval-pending", "approved", "scheduled", "live", "completed"];

// 4. Partner Lifecycle --------------------------------------------------------
const partnerStages: BpfStage[] = [
  s(1, "partner-lead-created", "Partner Lead Created", { isEntry: true }),
  s(2, "partner-evaluated", "Partner Evaluated", { requiredFields: ["evaluationNotes"] }),
  s(3, "partner-approved", "Partner Approved", { approvals: ["partner.onboarding-approval"] }),
  s(4, "agreement-signed", "Agreement Signed", { requiredFields: ["agreementId"] }),
  s(5, "portal-access-created", "Portal Access Created", { tasks: ["partner.create-portal-access"] }),
  s(6, "product-training-completed", "Product Training Completed"),
  s(7, "deal-registration-enabled", "Deal Registration Enabled"),
  s(8, "active-partner", "Active Partner", { notifications: ["partner.activated"] }),
  s(9, "performance-review", "Performance Review", { slaHours: 2160, aiTriggers: ["partner.ai-performance-summary"] }),
  s(10, "commission-processing", "Commission Processing", { tasks: ["partner.process-commission"] }),
  s(11, "renewal-termination", "Renewal / Termination", { isTerminal: true, requiredFields: ["renewalOutcome"] })
];
const partnerHappyPath = ["partner-lead-created", "partner-evaluated", "partner-approved", "agreement-signed", "portal-access-created", "product-training-completed", "deal-registration-enabled", "active-partner", "performance-review", "commission-processing"];

// 5. Support Ticket -----------------------------------------------------------
const supportStages: BpfStage[] = [
  s(1, "created", "Created", { isEntry: true, requiredFields: ["subject", "accountId"] }),
  s(2, "categorized", "Categorized", { requiredFields: ["category"], aiTriggers: ["support.ai-classification"] }),
  s(3, "prioritized", "Prioritized", { requiredFields: ["priority"] }),
  s(4, "assigned", "Assigned", { requiredFields: ["owner"], slaHours: 2, slaWarningHours: 1, notifications: ["support.assigned"] }),
  s(5, "acknowledged", "Acknowledged", { slaHours: 4 }),
  s(6, "investigation", "Investigation", { agingThresholdHours: 48 }),
  s(7, "waiting-on-customer", "Waiting on Customer", { agingThresholdHours: 72 }),
  s(8, "waiting-on-internal-team", "Waiting on Internal Team", { agingThresholdHours: 48 }),
  s(9, "escalated", "Escalated", { notifications: ["support.escalated"] }),
  s(10, "resolved", "Resolved", { requiredFields: ["resolutionSummary"] }),
  s(11, "customer-confirmation", "Customer Confirmation", { slaHours: 48 }),
  s(12, "closed", "Closed", { isTerminal: true }),
  s(13, "reopened", "Reopened", { requiredFields: ["reopenReason"] }),
  s(14, "rca-required", "RCA Required", { tasks: ["support.create-rca"] }),
  s(15, "knowledge-article-created", "Knowledge Article Created", { tasks: ["support.create-knowledge-article"] })
];
const supportHappyPath = ["created", "categorized", "prioritized", "assigned", "acknowledged", "investigation", "resolved", "customer-confirmation", "closed"];

// 6. Customer Success ---------------------------------------------------------
const customerSuccessStages: BpfStage[] = [
  s(1, "handover-received", "Handover Received", { isEntry: true, requiredFields: ["accountId", "csmOwner"] }),
  s(2, "kickoff-scheduled", "Kickoff Scheduled", { requiredFields: ["kickoffDate"] }),
  s(3, "onboarding-started", "Onboarding Started", { notifications: ["cs.onboarding-started"] }),
  s(4, "configuration-in-progress", "Configuration in Progress", { agingThresholdHours: 336 }),
  s(5, "training-in-progress", "Training in Progress"),
  s(6, "go-live-preparation", "Go-Live Preparation", { requiredFields: ["goLiveChecklist"] }),
  s(7, "go-live-completed", "Go-Live Completed", { notifications: ["cs.go-live"] }),
  s(8, "adoption-monitoring", "Adoption Monitoring", { aiTriggers: ["cs.ai-health-score"] }),
  s(9, "health-review", "Health Review", { slaHours: 720 }),
  s(10, "renewal-planning", "Renewal Planning", { requiredFields: ["renewalDate"], aiTriggers: ["cs.ai-renewal-strategy"] }),
  s(11, "expansion-identification", "Expansion Identification", { aiTriggers: ["cs.ai-expansion-recommendation"] }),
  s(12, "renewal-closed", "Renewal Closed", { isTerminal: true, requiredFields: ["renewalOutcome"] }),
  s(13, "churn-risk-recovery", "Churn Risk / Recovery", { requiredFields: ["churnRiskReason"], notifications: ["cs.churn-risk"] })
];
const customerSuccessHappyPath = ["handover-received", "kickoff-scheduled", "onboarding-started", "configuration-in-progress", "training-in-progress", "go-live-preparation", "go-live-completed", "adoption-monitoring", "health-review", "renewal-planning"];

export const defaultBpfConfigurationDefinitions: ConfigurationDefinition[] = [
  bpf("lead-lifecycle", "Lead Lifecycle", "Configurable lead lifecycle from capture to conversion.", {
    object: "lead",
    stages: leadStages,
    transitions: [
      ...chain(leadHappyPath),
      { from: "qualified", to: "converted" },
      { from: "connected", to: "nurture" },
      { from: "qualified", to: "nurture" },
      { from: "nurture", to: "assigned" },
      ...fanIn(["captured", "scored", "marketing-qualified-lead", "assigned", "contact-attempted", "connected", "qualified", "nurture"], "disqualified")
    ],
    blockedTransitions: [
      { from: "new-lead", to: "converted" },
      { from: "new-lead", to: "qualified" }
    ]
  }),
  bpf("opportunity-lifecycle", "Opportunity Lifecycle", "Configurable opportunity pipeline from creation to closure.", {
    object: "opportunity",
    stages: opportunityStages,
    transitions: [
      ...chain(opportunityHappyPath),
      { from: "legal-contracting", to: "closed-won" },
      ...fanIn(["discovery", "need-analysis", "demo-presentation", "solution-fitment", "presales-validation", "proposal-preparation", "proposal-submitted", "commercial-review", "negotiation", "legal-contracting"], "closed-lost"),
      ...fanIn(["discovery", "need-analysis", "demo-presentation", "solution-fitment", "proposal-preparation", "negotiation"], "deferred-on-hold"),
      { from: "deferred-on-hold", to: "discovery" },
      { from: "deferred-on-hold", to: "negotiation" }
    ],
    blockedTransitions: [
      { from: "created", to: "closed-won" },
      { from: "discovery", to: "proposal-submitted" }
    ]
  }),
  bpf("campaign-lifecycle", "Campaign Lifecycle", "Configurable campaign flow from draft to closure report.", {
    object: "campaign",
    stages: campaignStages,
    transitions: [
      ...chain(campaignHappyPath),
      { from: "completed", to: "closed-with-report" },
      { from: "live", to: "paused" },
      { from: "paused", to: "live" },
      { from: "paused", to: "completed" }
    ],
    blockedTransitions: [{ from: "draft", to: "live" }]
  }),
  bpf("partner-lifecycle", "Partner Lifecycle", "Configurable partner lifecycle from lead to renewal/termination.", {
    object: "partner",
    stages: partnerStages,
    transitions: [
      ...chain(partnerHappyPath),
      { from: "commission-processing", to: "renewal-termination" },
      { from: "active-partner", to: "renewal-termination" },
      { from: "performance-review", to: "active-partner" }
    ],
    blockedTransitions: [{ from: "partner-lead-created", to: "active-partner" }]
  }),
  bpf("support-ticket-lifecycle", "Support Ticket Lifecycle", "Configurable support ticket flow with escalation and RCA.", {
    object: "support_ticket",
    stages: supportStages,
    transitions: [
      ...chain(supportHappyPath),
      { from: "investigation", to: "waiting-on-customer" },
      { from: "investigation", to: "waiting-on-internal-team" },
      { from: "waiting-on-customer", to: "investigation" },
      { from: "waiting-on-internal-team", to: "investigation" },
      ...fanIn(["investigation", "waiting-on-customer", "waiting-on-internal-team"], "escalated"),
      { from: "escalated", to: "investigation" },
      { from: "resolved", to: "reopened" },
      { from: "reopened", to: "assigned" },
      { from: "resolved", to: "rca-required" },
      { from: "resolved", to: "knowledge-article-created" }
    ],
    blockedTransitions: [{ from: "created", to: "resolved" }]
  }),
  bpf("customer-success-lifecycle", "Customer Success Lifecycle", "Configurable customer success flow from handover to renewal/churn.", {
    object: "customer_success",
    stages: customerSuccessStages,
    transitions: [
      ...chain(customerSuccessHappyPath),
      { from: "renewal-planning", to: "renewal-closed" },
      { from: "renewal-planning", to: "expansion-identification" },
      { from: "expansion-identification", to: "renewal-closed" },
      ...fanIn(["adoption-monitoring", "health-review", "renewal-planning"], "churn-risk-recovery"),
      { from: "churn-risk-recovery", to: "health-review" }
    ],
    blockedTransitions: [{ from: "handover-received", to: "go-live-completed" }]
  })
];
