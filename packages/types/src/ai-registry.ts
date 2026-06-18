// ============================================================================
// Phase 19: Prompt Registry and AI Agent Registry
// ============================================================================

export interface AiRegistryPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ----------------------------------------------------------------------------
// Prompt Registry
// ----------------------------------------------------------------------------

export const aiPromptRoles = ["system", "user", "assistant", "tool"] as const;
export type AiPromptRole = (typeof aiPromptRoles)[number];

export const aiApprovalStatuses = ["draft", "pending_review", "approved", "rejected"] as const;
export type AiApprovalStatus = (typeof aiApprovalStatuses)[number];

export interface AiPromptVersion {
  id: string;
  version: number;
  content: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  guardrails: string[];
  changeSummary: string;
  approvalStatus: AiApprovalStatus;
  isActive: boolean;
  createdAt: string;
  createdBy: string | null;
}

export interface AiPromptSummary {
  id: string;
  promptKey: string;
  name: string;
  description: string;
  module: string;
  promptRole: AiPromptRole;
  approvalStatus: AiApprovalStatus;
  isActive: boolean;
  currentVersion: number;
  latestVersion: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface AiPromptDetail extends AiPromptSummary {
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  guardrails: string[];
  activeContent: string;
  versions: AiPromptVersion[];
}

export interface CreateAiPromptRequestBody {
  promptKey: string;
  name: string;
  description?: string;
  module?: string;
  promptRole?: AiPromptRole;
  content: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  guardrails?: string[];
  changeSummary?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateAiPromptRequestBody {
  name?: string;
  description?: string;
  module?: string;
  promptRole?: AiPromptRole;
  metadata?: Record<string, unknown>;
}

export interface CreateAiPromptVersionRequestBody {
  content: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  guardrails?: string[];
  changeSummary?: string;
  activate?: boolean;
}

export interface UpdateAiPromptApprovalRequestBody {
  approvalStatus: AiApprovalStatus;
}

export interface SetAiPromptActiveRequestBody {
  isActive: boolean;
}

export interface AiPromptListQuery {
  page?: number;
  pageSize?: number;
  module?: string;
  approvalStatus?: string;
  isActive?: string;
  search?: string;
}

export interface AiPromptListResponse {
  prompts: AiPromptSummary[];
  pagination: AiRegistryPagination;
}

export interface AiPromptResponse {
  prompt: AiPromptDetail;
}

export interface AiPromptVersionResponse {
  promptId: string;
  version: AiPromptVersion;
}

export interface AiPromptVersionsResponse {
  promptId: string;
  versions: AiPromptVersion[];
}

// ----------------------------------------------------------------------------
// AI Agent Registry
// ----------------------------------------------------------------------------

export const aiAgentStatuses = ["draft", "active", "inactive"] as const;
export type AiAgentStatus = (typeof aiAgentStatuses)[number];

export const aiAgentDataScopes = ["own", "team", "module", "tenant"] as const;
export type AiAgentDataScope = (typeof aiAgentDataScopes)[number];

export interface AiAgentEscalationRule {
  trigger: string;
  action: string;
  escalateTo: string;
}

export interface AiAgent {
  id: string;
  agentKey: string;
  name: string;
  purpose: string;
  module: string;
  allowedTools: string[];
  allowedRoles: string[];
  dataAccessScope: AiAgentDataScope;
  requiresHumanApproval: boolean;
  status: AiAgentStatus;
  loggingEnabled: boolean;
  escalationRules: AiAgentEscalationRule[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface AiAgentDefinition {
  key: string;
  name: string;
  purpose: string;
  module: string;
  allowedTools: string[];
  allowedRoles: string[];
  dataAccessScope: AiAgentDataScope;
  requiresHumanApproval: boolean;
  loggingEnabled: boolean;
  escalationRules: AiAgentEscalationRule[];
}

// The seeded baseline of AI agents. These are synced per-tenant on first access
// and marked as system agents. Operators reconfigure them; they are not deleted.
export const defaultAiAgents: AiAgentDefinition[] = [
  {
    key: "sales_copilot",
    name: "Sales Copilot Agent",
    purpose: "Assist account executives with opportunity summaries, deal-risk assessment, and next-step guidance.",
    module: "sales",
    allowedTools: ["opportunity_summary", "deal_risk", "follow_up_email_generator"],
    allowedRoles: ["account-executive", "sales-manager"],
    dataAccessScope: "module",
    requiresHumanApproval: true,
    loggingEnabled: true,
    escalationRules: [{ trigger: "low_confidence", action: "route_to_human", escalateTo: "sales-manager" }]
  },
  {
    key: "marketing_copilot",
    name: "Marketing Copilot Agent",
    purpose: "Help marketers draft campaign briefs, segment audiences, and propose messaging.",
    module: "marketing",
    allowedTools: ["campaign_brief", "audience_segmenter"],
    allowedRoles: ["marketing-manager", "marketing-specialist"],
    dataAccessScope: "module",
    requiresHumanApproval: true,
    loggingEnabled: true,
    escalationRules: [{ trigger: "brand_policy_violation", action: "route_to_human", escalateTo: "marketing-manager" }]
  },
  {
    key: "social_media",
    name: "Social Media Agent",
    purpose: "Draft and schedule social posts and suggest hashtags within approved brand guidelines.",
    module: "social",
    allowedTools: ["social_post_draft", "hashtag_suggester"],
    allowedRoles: ["social-manager", "marketing-specialist"],
    dataAccessScope: "module",
    requiresHumanApproval: true,
    loggingEnabled: true,
    escalationRules: [{ trigger: "publish_request", action: "require_approval", escalateTo: "social-manager" }]
  },
  {
    key: "sdr_assistant",
    name: "SDR Assistant Agent",
    purpose: "Support SDRs with prospect research, qualification prompts, and outreach drafting.",
    module: "sales",
    allowedTools: ["lead_research", "follow_up_email_generator"],
    allowedRoles: ["sdr", "inside-sales"],
    dataAccessScope: "own",
    requiresHumanApproval: true,
    loggingEnabled: true,
    escalationRules: [{ trigger: "qualified_lead", action: "notify", escalateTo: "sales-manager" }]
  },
  {
    key: "presales_proposal",
    name: "Presales Proposal Agent",
    purpose: "Extract RFP requirements and draft proposal responses for presales engineers.",
    module: "presales",
    allowedTools: ["rfp_extraction", "proposal_response_draft"],
    allowedRoles: ["presales-engineer", "solutions-architect"],
    dataAccessScope: "module",
    requiresHumanApproval: true,
    loggingEnabled: true,
    escalationRules: [{ trigger: "commercial_commitment", action: "require_approval", escalateTo: "presales-lead" }]
  },
  {
    key: "support_resolution",
    name: "Support Resolution Agent",
    purpose: "Triage support tickets and suggest responses grounded in the knowledge base.",
    module: "support",
    allowedTools: ["ticket_summary", "suggested_response"],
    allowedRoles: ["support-agent", "support-lead"],
    dataAccessScope: "module",
    requiresHumanApproval: true,
    loggingEnabled: true,
    escalationRules: [{ trigger: "negative_sentiment", action: "route_to_human", escalateTo: "support-lead" }]
  },
  {
    key: "cs_onboarding",
    name: "Customer Success Onboarding Agent",
    purpose: "Guide onboarding playbooks and summarize early customer health for CSMs.",
    module: "customer_success",
    allowedTools: ["onboarding_plan", "customer_health_summary"],
    allowedRoles: ["csm", "onboarding-specialist"],
    dataAccessScope: "module",
    requiresHumanApproval: true,
    loggingEnabled: true,
    escalationRules: [{ trigger: "stalled_onboarding", action: "notify", escalateTo: "cs-manager" }]
  },
  {
    key: "cs_scaled",
    name: "Customer Success Scaled Agent",
    purpose: "Deliver scaled, digital-led success motions across the long-tail customer base.",
    module: "customer_success",
    allowedTools: ["customer_health_summary", "renewal_strategy_recommendation"],
    allowedRoles: ["csm", "scaled-cs"],
    dataAccessScope: "module",
    requiresHumanApproval: true,
    loggingEnabled: true,
    escalationRules: [{ trigger: "churn_risk", action: "route_to_human", escalateTo: "cs-manager" }]
  },
  {
    key: "cs_enterprise",
    name: "Customer Success Enterprise Agent",
    purpose: "Prepare enterprise QBRs and renewal strategies for high-touch accounts.",
    module: "customer_success",
    allowedTools: ["renewal_strategy_recommendation", "executive_summary"],
    allowedRoles: ["enterprise-csm", "cs-manager"],
    dataAccessScope: "team",
    requiresHumanApproval: true,
    loggingEnabled: true,
    escalationRules: [{ trigger: "renewal_at_risk", action: "require_approval", escalateTo: "cs-director" }]
  },
  {
    key: "customer_training",
    name: "Customer Training Agent",
    purpose: "Summarize lessons and guide learners through training programs.",
    module: "training",
    allowedTools: ["lesson_summarizer", "quiz_generator"],
    allowedRoles: ["trainer", "enablement-specialist"],
    dataAccessScope: "module",
    requiresHumanApproval: false,
    loggingEnabled: true,
    escalationRules: [{ trigger: "failed_assessment", action: "notify", escalateTo: "trainer" }]
  },
  {
    key: "customer_query_resolution",
    name: "Customer Query Resolution Agent",
    purpose: "Answer customer queries using approved knowledge sources and suggested replies.",
    module: "customer_query",
    allowedTools: ["knowledge_lookup", "suggested_response"],
    allowedRoles: ["support-agent", "customer-query-agent"],
    dataAccessScope: "module",
    requiresHumanApproval: true,
    loggingEnabled: true,
    escalationRules: [{ trigger: "unanswered_query", action: "route_to_human", escalateTo: "support-lead" }]
  },
  {
    key: "partner_manager",
    name: "Partner Manager Agent",
    purpose: "Summarize partner performance and recommend enablement actions.",
    module: "partners",
    allowedTools: ["partner_performance_summary", "enablement_recommendation"],
    allowedRoles: ["partner-manager", "channel-manager"],
    dataAccessScope: "module",
    requiresHumanApproval: true,
    loggingEnabled: true,
    escalationRules: [{ trigger: "partner_underperformance", action: "notify", escalateTo: "channel-director" }]
  },
  {
    key: "reseller_growth",
    name: "Reseller Growth Agent",
    purpose: "Recommend growth plays and pricing guidance for reseller accounts.",
    module: "resellers",
    allowedTools: ["reseller_growth_plan", "pricing_guidance"],
    allowedRoles: ["channel-manager", "reseller-manager"],
    dataAccessScope: "module",
    requiresHumanApproval: true,
    loggingEnabled: true,
    escalationRules: [{ trigger: "discount_exception", action: "require_approval", escalateTo: "channel-director" }]
  },
  {
    key: "executive_insight",
    name: "Executive Insight Agent",
    purpose: "Produce executive rollups, pipeline insights, and cross-module summaries.",
    module: "dashboards",
    allowedTools: ["executive_summary", "pipeline_insights"],
    allowedRoles: ["executive", "operations-leader"],
    dataAccessScope: "tenant",
    requiresHumanApproval: true,
    loggingEnabled: true,
    escalationRules: [{ trigger: "anomaly_detected", action: "notify", escalateTo: "operations-leader" }]
  },
  {
    key: "data_quality",
    name: "Data Quality Agent",
    purpose: "Detect and flag duplicate, stale, or incomplete records across the CRM.",
    module: "ai",
    allowedTools: ["data_quality_scan", "dedupe_suggester"],
    allowedRoles: ["data-steward", "operations-admin"],
    dataAccessScope: "tenant",
    requiresHumanApproval: true,
    loggingEnabled: true,
    escalationRules: [{ trigger: "bulk_change_proposed", action: "require_approval", escalateTo: "operations-admin" }]
  },
  {
    key: "workflow_automation",
    name: "Workflow Automation Agent",
    purpose: "Propose and orchestrate workflow automations under human approval.",
    module: "workflows",
    allowedTools: ["workflow_suggester", "trigger_builder"],
    allowedRoles: ["operations-admin", "workflow-admin"],
    dataAccessScope: "tenant",
    requiresHumanApproval: true,
    loggingEnabled: true,
    escalationRules: [{ trigger: "automation_activation", action: "require_approval", escalateTo: "operations-admin" }]
  }
];

export interface CreateAiAgentRequestBody {
  agentKey: string;
  name: string;
  purpose?: string;
  module?: string;
  allowedTools?: string[];
  allowedRoles?: string[];
  dataAccessScope?: AiAgentDataScope;
  requiresHumanApproval?: boolean;
  status?: AiAgentStatus;
  loggingEnabled?: boolean;
  escalationRules?: AiAgentEscalationRule[];
  metadata?: Record<string, unknown>;
}

export interface UpdateAiAgentRequestBody {
  name?: string;
  purpose?: string;
  module?: string;
  allowedTools?: string[];
  allowedRoles?: string[];
  dataAccessScope?: AiAgentDataScope;
  requiresHumanApproval?: boolean;
  status?: AiAgentStatus;
  loggingEnabled?: boolean;
  escalationRules?: AiAgentEscalationRule[];
  metadata?: Record<string, unknown>;
}

export interface AiAgentListQuery {
  module?: string;
  status?: string;
  search?: string;
}

export interface AiAgentListResponse {
  agents: AiAgent[];
}

export interface AiAgentResponse {
  agent: AiAgent;
}
