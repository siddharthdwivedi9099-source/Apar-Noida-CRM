// ============================================================================
// Phase 22: AI Feature Integration Across CRM Modules
// ============================================================================

export const aiActionCategories = ["summary", "explanation", "draft", "recommendation", "generator"] as const;
export type AiActionCategory = (typeof aiActionCategories)[number];

export const aiActionRunStatuses = ["completed", "pending_review", "error"] as const;
export type AiActionRunStatus = (typeof aiActionRunStatuses)[number];

export const aiActionReviewStatuses = ["not_required", "pending_review", "approved", "rejected"] as const;
export type AiActionReviewStatus = (typeof aiActionReviewStatuses)[number];

export interface AiActionDefinition {
  key: string;
  module: string;
  label: string;
  description: string;
  templateKey: string;
  capability: string;
  category: AiActionCategory;
  sensitive: boolean;
  entityType: string | null;
  variables: string[];
  requiredPermissions: string[];
  reviewPermissions: string[];
}

// Per-module permission sets. Any module read/use/manage permission (or the
// cross-cutting ai.use_ai/ai.manage_ai) may run an action; review of sensitive
// output requires an approval-level permission.
function runPermissions(module: string): string[] {
  return [`${module}.view`, `${module}.use_ai`, `${module}.manage_ai`, `${module}.configure`, "ai.use_ai", "ai.manage_ai"];
}

function reviewPermissions(module: string): string[] {
  return [`${module}.approve`, `${module}.manage_ai`, `${module}.configure`, "ai.approve", "ai.manage_ai"];
}

interface ActionSeed {
  key: string;
  module: string;
  label: string;
  description: string;
  templateKey: string;
  capability: string;
  category: AiActionCategory;
  sensitive: boolean;
  entityType: string | null;
  variables: string[];
}

const actionSeeds: ActionSeed[] = [
  // Leads
  { key: "lead_summary", module: "leads", label: "Lead summary", description: "Summarize a lead.", templateKey: "lead_summary", capability: "lead_summary", category: "summary", sensitive: false, entityType: "lead", variables: ["name", "company", "status", "source"] },
  { key: "lead_score_explanation", module: "leads", label: "Lead score explanation", description: "Explain a lead score.", templateKey: "lead_score_explanation", capability: "lead_score_explanation", category: "explanation", sensitive: false, entityType: "lead", variables: ["name", "score", "signals"] },
  { key: "lead_followup_email", module: "leads", label: "Follow-up email draft", description: "Draft a follow-up email to a lead.", templateKey: "follow_up_email_generator", capability: "follow_up_email_generator", category: "draft", sensitive: true, entityType: "lead", variables: ["contact", "topic"] },
  { key: "lead_qualification_recommendation", module: "leads", label: "Lead qualification recommendation", description: "Recommend whether to qualify a lead.", templateKey: "lead_qualification_recommendation", capability: "lead_qualification_recommendation", category: "recommendation", sensitive: true, entityType: "lead", variables: ["name", "criteria"] },

  // Accounts
  { key: "account_brief", module: "accounts", label: "Account brief", description: "Create an account brief.", templateKey: "account_brief", capability: "account_brief", category: "summary", sensitive: false, entityType: "account", variables: ["account", "industry", "arr"] },
  { key: "account_relationship_summary", module: "accounts", label: "Relationship summary", description: "Summarize an account relationship.", templateKey: "relationship_summary", capability: "relationship_summary", category: "summary", sensitive: false, entityType: "account", variables: ["account", "contactCount", "openItems"] },
  { key: "account_health_explanation", module: "accounts", label: "Health indicator explanation", description: "Explain an account health indicator.", templateKey: "health_indicator_explanation", capability: "health_indicator_explanation", category: "explanation", sensitive: false, entityType: "account", variables: ["account", "healthScore", "status"] },

  // Opportunities
  { key: "opportunity_summary", module: "opportunities", label: "Opportunity summary", description: "Summarize an opportunity.", templateKey: "opportunity_summary", capability: "opportunity_summary", category: "summary", sensitive: false, entityType: "opportunity", variables: ["name", "account", "stage", "amount"] },
  { key: "deal_risk_analysis", module: "opportunities", label: "Deal risk analysis", description: "Assess deal risk.", templateKey: "deal_risk", capability: "deal_risk", category: "explanation", sensitive: false, entityType: "opportunity", variables: ["name", "stage", "nextStep"] },
  { key: "next_best_action", module: "opportunities", label: "Next-best-action", description: "Recommend the next best action.", templateKey: "next_best_action", capability: "next_best_action", category: "recommendation", sensitive: true, entityType: "opportunity", variables: ["name", "stage"] },
  { key: "proposal_draft_outline", module: "opportunities", label: "Proposal draft outline", description: "Outline a proposal.", templateKey: "proposal_outline", capability: "proposal_outline", category: "draft", sensitive: true, entityType: "opportunity", variables: ["account", "requirements"] },

  // Campaigns
  { key: "campaign_plan_generator", module: "campaigns", label: "Campaign plan generator", description: "Generate a campaign plan.", templateKey: "campaign_plan", capability: "campaign_plan", category: "generator", sensitive: true, entityType: "campaign", variables: ["objective", "audience", "channels"] },
  { key: "email_copy_generator", module: "campaigns", label: "Email copy generator", description: "Generate marketing email copy.", templateKey: "email_copy", capability: "email_copy", category: "generator", sensitive: true, entityType: "campaign", variables: ["campaign", "offer", "audience"] },
  { key: "audience_suggestion", module: "campaigns", label: "Audience suggestion", description: "Suggest target audiences.", templateKey: "audience_suggestion", capability: "audience_suggestion", category: "recommendation", sensitive: true, entityType: "campaign", variables: ["campaign", "goal"] },
  { key: "campaign_performance_summary", module: "campaigns", label: "Campaign performance summary", description: "Summarize campaign performance.", templateKey: "campaign_performance_summary", capability: "campaign_performance_summary", category: "summary", sensitive: false, entityType: "campaign", variables: ["campaign", "sent", "conversions"] },

  // Social
  { key: "caption_generator", module: "social", label: "Caption generator", description: "Generate a social caption.", templateKey: "social_caption", capability: "social_caption", category: "generator", sensitive: true, entityType: "social_post", variables: ["topic", "channel", "tone"] },
  { key: "hashtag_suggestion", module: "social", label: "Hashtag suggestion", description: "Suggest hashtags.", templateKey: "hashtag_suggestion", capability: "hashtag_suggestion", category: "recommendation", sensitive: false, entityType: "social_post", variables: ["channel", "topic"] },
  { key: "comment_sentiment_summary", module: "social", label: "Comment sentiment summary", description: "Summarize comment sentiment.", templateKey: "comment_sentiment_summary", capability: "comment_sentiment_summary", category: "summary", sensitive: false, entityType: "social_post", variables: ["post", "comments"] },

  // Support
  { key: "ticket_summary", module: "support", label: "Ticket summary", description: "Summarize a support ticket.", templateKey: "ticket_summary", capability: "ticket_summary", category: "summary", sensitive: false, entityType: "ticket", variables: ["subject", "status"] },
  { key: "suggested_response", module: "support", label: "Suggested response", description: "Suggest a customer response.", templateKey: "suggested_response", capability: "suggested_response", category: "draft", sensitive: true, entityType: "ticket", variables: ["subject"] },
  { key: "knowledge_article_recommendation", module: "support", label: "Knowledge article recommendation", description: "Recommend knowledge articles.", templateKey: "knowledge_article_recommendation", capability: "knowledge_article_recommendation", category: "recommendation", sensitive: false, entityType: "ticket", variables: ["subject", "issue"] },
  { key: "escalation_summary", module: "support", label: "Escalation summary", description: "Summarize an escalation.", templateKey: "escalation_summary", capability: "escalation_summary", category: "summary", sensitive: false, entityType: "ticket", variables: ["subject", "reason", "priority"] },

  // Customer Success
  { key: "onboarding_plan_generator", module: "customer_success", label: "Onboarding plan generator", description: "Generate an onboarding plan.", templateKey: "onboarding_plan", capability: "onboarding_plan", category: "generator", sensitive: true, entityType: "cs_account", variables: ["account", "goals", "timeframe"] },
  { key: "customer_health_summary", module: "customer_success", label: "Customer health summary", description: "Summarize customer health.", templateKey: "customer_health_summary", capability: "customer_health_summary", category: "summary", sensitive: false, entityType: "cs_account", variables: ["account", "healthScore", "riskStatus"] },
  { key: "churn_risk_explanation", module: "customer_success", label: "Churn risk explanation", description: "Explain churn risk.", templateKey: "churn_risk_explanation", capability: "churn_risk_explanation", category: "explanation", sensitive: false, entityType: "cs_account", variables: ["account", "healthScore", "usageTrend"] },
  { key: "adoption_recommendation", module: "customer_success", label: "Adoption recommendation", description: "Recommend adoption actions.", templateKey: "adoption_recommendation", capability: "adoption_recommendation", category: "recommendation", sensitive: true, entityType: "cs_account", variables: ["account", "features"] },
  { key: "qbr_ebr_outline", module: "customer_success", label: "QBR/EBR outline", description: "Outline a QBR/EBR.", templateKey: "qbr_outline", capability: "qbr_outline", category: "draft", sensitive: true, entityType: "cs_account", variables: ["account", "value", "goals"] },
  { key: "renewal_strategy_suggestion", module: "customer_success", label: "Renewal strategy suggestion", description: "Suggest a renewal strategy.", templateKey: "renewal_strategy_recommendation", capability: "renewal_strategy_recommendation", category: "recommendation", sensitive: true, entityType: "cs_account", variables: ["account", "renewalDate"] },

  // Training
  { key: "lesson_summary", module: "training", label: "Lesson summary", description: "Summarize a lesson.", templateKey: "lesson_summarizer", capability: "lesson_summarizer", category: "summary", sensitive: false, entityType: "lesson", variables: ["lessonTitle"] },
  { key: "quiz_generator", module: "training", label: "Quiz generator", description: "Generate a quiz.", templateKey: "quiz_generator", capability: "quiz_generator", category: "generator", sensitive: false, entityType: "lesson", variables: ["lesson", "topics"] },
  { key: "learning_path_suggestion", module: "training", label: "Learning path suggestion", description: "Suggest a learning path.", templateKey: "learning_path_suggestion", capability: "learning_path_suggestion", category: "recommendation", sensitive: false, entityType: "learner", variables: ["role", "goals"] },

  // Partners
  { key: "partner_performance_summary", module: "partners", label: "Partner performance summary", description: "Summarize partner performance.", templateKey: "partner_performance_summary", capability: "partner_performance_summary", category: "summary", sensitive: false, entityType: "partner", variables: ["partner", "dealCount"] },
  { key: "partner_action_plan", module: "partners", label: "Partner action plan", description: "Create a partner action plan.", templateKey: "partner_action_plan", capability: "partner_action_plan", category: "draft", sensitive: true, entityType: "partner", variables: ["partner", "metric"] },
  { key: "partner_inactivity_alert_explanation", module: "partners", label: "Inactivity alert explanation", description: "Explain a partner inactivity alert.", templateKey: "inactivity_alert_explanation", capability: "inactivity_alert_explanation", category: "explanation", sensitive: false, entityType: "partner", variables: ["partner", "days"] },

  // Resellers
  { key: "reseller_performance_summary", module: "resellers", label: "Performance summary", description: "Summarize reseller performance.", templateKey: "reseller_performance_summary", capability: "reseller_performance_summary", category: "summary", sensitive: false, entityType: "reseller", variables: ["reseller", "revenue", "deals"] },
  { key: "reseller_action_plan", module: "resellers", label: "Action plan", description: "Create a reseller action plan.", templateKey: "reseller_action_plan", capability: "reseller_action_plan", category: "draft", sensitive: true, entityType: "reseller", variables: ["reseller", "metric"] },
  { key: "reseller_inactivity_alert_explanation", module: "resellers", label: "Inactivity alert explanation", description: "Explain a reseller inactivity alert.", templateKey: "reseller_inactivity_alert_explanation", capability: "reseller_inactivity_alert_explanation", category: "explanation", sensitive: false, entityType: "reseller", variables: ["reseller", "days"] }
];

export const aiActionCatalog: AiActionDefinition[] = actionSeeds.map((seed) => ({
  ...seed,
  requiredPermissions: runPermissions(seed.module),
  reviewPermissions: reviewPermissions(seed.module)
}));

export function findAiAction(key: string): AiActionDefinition | undefined {
  return aiActionCatalog.find((action) => action.key === key);
}

// ----------------------------------------------------------------------------
// Requests / responses
// ----------------------------------------------------------------------------

export interface AiActionSummary {
  key: string;
  module: string;
  label: string;
  description: string;
  category: AiActionCategory;
  templateKey: string;
  capability: string;
  sensitive: boolean;
  entityType: string | null;
  variables: string[];
  permitted: boolean;
}

export interface AiActionCatalogResponse {
  actions: AiActionSummary[];
  modules: string[];
}

export interface ExecuteAiActionRequestBody {
  variables?: Record<string, string>;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export interface AiActionRun {
  id: string;
  actionKey: string;
  module: string;
  capability: string;
  templateKey: string;
  entityType: string | null;
  entityId: string | null;
  provider: string;
  model: string;
  status: AiActionRunStatus;
  requiresReview: boolean;
  reviewStatus: AiActionReviewStatus;
  output: string;
  resolvedPrompt: string;
  variables: Record<string, string>;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string;
  createdAt: string;
  createdBy: string | null;
}

export interface AiActionExecuteResponse {
  run: AiActionRun;
  requiresReview: boolean;
}

export interface AiActionRunResponse {
  run: AiActionRun;
}

export interface AiActionRunListQuery {
  module?: string;
  actionKey?: string;
  status?: string;
  reviewStatus?: string;
  page?: number;
  pageSize?: number;
}

export interface AiActionRunListResponse {
  runs: AiActionRun[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface ReviewAiActionRunRequestBody {
  decision: "approved" | "rejected";
  note?: string;
}
