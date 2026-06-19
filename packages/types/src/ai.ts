// ============================================================================
// Phase 18: AI Gateway Foundation
// ============================================================================

export const aiProviderKeys = ["openai", "anthropic", "azure_openai", "local"] as const;
export type AiProviderKey = (typeof aiProviderKeys)[number];

export const aiProviderLabels: Record<AiProviderKey, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  azure_openai: "Azure OpenAI",
  local: "Local Model"
};

export const aiUsageStatuses = ["placeholder", "success", "error", "rate_limited", "denied"] as const;
export type AiUsageStatus = (typeof aiUsageStatuses)[number];

export const aiRequestTypes = ["completion", "summary", "draft", "classification", "extraction", "recommendation"] as const;
export type AiRequestType = (typeof aiRequestTypes)[number];

// Prompt template registry — prompts live here, never hardcoded in business logic.
export interface AiPromptTemplateDefinition {
  key: string;
  name: string;
  description: string;
  capability: string;
  category: "sales" | "presales" | "partners" | "support" | "customer_success" | "training" | "marketing" | "general";
  requestType: AiRequestType;
  template: string;
  variables: string[];
}

export const defaultAiPromptTemplates: AiPromptTemplateDefinition[] = [
  { key: "opportunity_summary", name: "Opportunity summary", description: "Summarize an opportunity for sales review.", capability: "opportunity_summary", category: "sales", requestType: "summary", template: "Summarize the opportunity {{name}} for {{account}} at stage {{stage}} with amount {{amount}}.", variables: ["name", "account", "stage", "amount"] },
  { key: "deal_risk", name: "Deal risk", description: "Assess deal risk for an opportunity.", capability: "deal_risk", category: "sales", requestType: "classification", template: "Assess the risk for opportunity {{name}} considering stage {{stage}} and next step {{nextStep}}.", variables: ["name", "stage", "nextStep"] },
  { key: "follow_up_email_generator", name: "Follow-up email", description: "Draft a follow-up email.", capability: "follow_up_email_generator", category: "sales", requestType: "draft", template: "Draft a follow-up email to {{contact}} about {{topic}}.", variables: ["contact", "topic"] },
  { key: "rfp_extraction", name: "RFP extraction", description: "Extract requirements from an RFP.", capability: "rfp_extraction", category: "presales", requestType: "extraction", template: "Extract requirements from the following RFP text: {{rfpText}}.", variables: ["rfpText"] },
  { key: "proposal_response_draft", name: "Proposal response draft", description: "Draft a proposal response.", capability: "proposal_response_draft", category: "presales", requestType: "draft", template: "Draft a proposal response for requirement {{requirement}}.", variables: ["requirement"] },
  { key: "partner_performance_summary", name: "Partner performance summary", description: "Summarize partner performance.", capability: "partner_performance_summary", category: "partners", requestType: "summary", template: "Summarize performance for partner {{partner}} with {{dealCount}} registered deals.", variables: ["partner", "dealCount"] },
  { key: "ticket_summary", name: "Ticket summary", description: "Summarize a support ticket thread.", capability: "ticket_summary", category: "support", requestType: "summary", template: "Summarize support ticket {{subject}} with status {{status}}.", variables: ["subject", "status"] },
  { key: "suggested_response", name: "Suggested response", description: "Suggest a support reply.", capability: "suggested_response", category: "support", requestType: "draft", template: "Suggest a reply to the customer for ticket {{subject}}.", variables: ["subject"] },
  { key: "customer_health_summary", name: "Customer health summary", description: "Summarize customer health.", capability: "customer_health_summary", category: "customer_success", requestType: "summary", template: "Summarize health for account {{account}} with score {{healthScore}} and risk {{riskStatus}}.", variables: ["account", "healthScore", "riskStatus"] },
  { key: "renewal_strategy_recommendation", name: "Renewal strategy", description: "Recommend a renewal strategy.", capability: "renewal_strategy_recommendation", category: "customer_success", requestType: "recommendation", template: "Recommend a renewal strategy for account {{account}} renewing on {{renewalDate}}.", variables: ["account", "renewalDate"] },
  { key: "lesson_summarizer", name: "Lesson summarizer", description: "Summarize a training lesson.", capability: "lesson_summarizer", category: "training", requestType: "summary", template: "Summarize the training lesson {{lessonTitle}}.", variables: ["lessonTitle"] },
  { key: "generic_assistant", name: "Generic assistant", description: "General-purpose assistant prompt.", capability: "generic_assistant", category: "general", requestType: "completion", template: "{{prompt}}", variables: ["prompt"] },

  // Phase 22: module-specific AI action templates (Prompt Registry, never hardcoded in UI).
  { key: "lead_summary", name: "Lead summary", description: "Summarize a lead.", capability: "lead_summary", category: "sales", requestType: "summary", template: "Summarize the lead {{name}} from {{company}} with status {{status}} and source {{source}}.", variables: ["name", "company", "status", "source"] },
  { key: "lead_score_explanation", name: "Lead score explanation", description: "Explain a lead score.", capability: "lead_score_explanation", category: "sales", requestType: "classification", template: "Explain the lead score for {{name}} given score {{score}} and signals {{signals}}.", variables: ["name", "score", "signals"] },
  { key: "lead_qualification_recommendation", name: "Lead qualification recommendation", description: "Recommend a qualification decision.", capability: "lead_qualification_recommendation", category: "sales", requestType: "recommendation", template: "Recommend whether to qualify lead {{name}} considering {{criteria}}.", variables: ["name", "criteria"] },
  { key: "account_brief", name: "Account brief", description: "Create an account brief.", capability: "account_brief", category: "sales", requestType: "summary", template: "Create an account brief for {{account}} in industry {{industry}} with ARR {{arr}}.", variables: ["account", "industry", "arr"] },
  { key: "relationship_summary", name: "Relationship summary", description: "Summarize an account relationship.", capability: "relationship_summary", category: "sales", requestType: "summary", template: "Summarize the relationship with {{account}} across {{contactCount}} contacts and {{openItems}} open items.", variables: ["account", "contactCount", "openItems"] },
  { key: "health_indicator_explanation", name: "Health indicator explanation", description: "Explain an account health indicator.", capability: "health_indicator_explanation", category: "sales", requestType: "classification", template: "Explain the health indicator for {{account}} with score {{healthScore}} and status {{status}}.", variables: ["account", "healthScore", "status"] },
  { key: "next_best_action", name: "Next best action", description: "Recommend the next best action.", capability: "next_best_action", category: "sales", requestType: "recommendation", template: "Recommend the next best action for opportunity {{name}} at stage {{stage}}.", variables: ["name", "stage"] },
  { key: "proposal_outline", name: "Proposal draft outline", description: "Outline a proposal.", capability: "proposal_outline", category: "presales", requestType: "draft", template: "Outline a proposal for {{account}} covering {{requirements}}.", variables: ["account", "requirements"] },
  { key: "campaign_plan", name: "Campaign plan generator", description: "Generate a campaign plan.", capability: "campaign_plan", category: "marketing", requestType: "draft", template: "Generate a campaign plan for {{objective}} targeting {{audience}} on {{channels}}.", variables: ["objective", "audience", "channels"] },
  { key: "email_copy", name: "Email copy generator", description: "Write marketing email copy.", capability: "email_copy", category: "marketing", requestType: "draft", template: "Write marketing email copy for {{campaign}} with offer {{offer}} to {{audience}}.", variables: ["campaign", "offer", "audience"] },
  { key: "audience_suggestion", name: "Audience suggestion", description: "Suggest target audiences.", capability: "audience_suggestion", category: "marketing", requestType: "recommendation", template: "Suggest target audience segments for {{campaign}} with goal {{goal}}.", variables: ["campaign", "goal"] },
  { key: "campaign_performance_summary", name: "Campaign performance summary", description: "Summarize campaign performance.", capability: "campaign_performance_summary", category: "marketing", requestType: "summary", template: "Summarize performance for campaign {{campaign}} with {{sent}} sent and {{conversions}} conversions.", variables: ["campaign", "sent", "conversions"] },
  { key: "social_caption", name: "Caption generator", description: "Write a social caption.", capability: "social_caption", category: "marketing", requestType: "draft", template: "Write a social caption for {{topic}} on {{channel}} in a {{tone}} tone.", variables: ["topic", "channel", "tone"] },
  { key: "hashtag_suggestion", name: "Hashtag suggestion", description: "Suggest hashtags.", capability: "hashtag_suggestion", category: "marketing", requestType: "recommendation", template: "Suggest hashtags for a {{channel}} post about {{topic}}.", variables: ["channel", "topic"] },
  { key: "comment_sentiment_summary", name: "Comment sentiment summary", description: "Summarize comment sentiment.", capability: "comment_sentiment_summary", category: "marketing", requestType: "summary", template: "Summarize sentiment of comments for post {{post}}: {{comments}}.", variables: ["post", "comments"] },
  { key: "knowledge_article_recommendation", name: "Knowledge article recommendation", description: "Recommend knowledge articles.", capability: "knowledge_article_recommendation", category: "support", requestType: "recommendation", template: "Recommend knowledge articles for ticket {{subject}} about {{issue}}.", variables: ["subject", "issue"] },
  { key: "escalation_summary", name: "Escalation summary", description: "Summarize a ticket escalation.", capability: "escalation_summary", category: "support", requestType: "summary", template: "Summarize the escalation for ticket {{subject}} with reason {{reason}} and priority {{priority}}.", variables: ["subject", "reason", "priority"] },
  { key: "onboarding_plan", name: "Onboarding plan generator", description: "Generate an onboarding plan.", capability: "onboarding_plan", category: "customer_success", requestType: "draft", template: "Generate an onboarding plan for {{account}} with goals {{goals}} over {{timeframe}}.", variables: ["account", "goals", "timeframe"] },
  { key: "churn_risk_explanation", name: "Churn risk explanation", description: "Explain churn risk.", capability: "churn_risk_explanation", category: "customer_success", requestType: "classification", template: "Explain churn risk for {{account}} given health {{healthScore}} and usage {{usageTrend}}.", variables: ["account", "healthScore", "usageTrend"] },
  { key: "adoption_recommendation", name: "Adoption recommendation", description: "Recommend adoption actions.", capability: "adoption_recommendation", category: "customer_success", requestType: "recommendation", template: "Recommend adoption actions for {{account}} using {{features}}.", variables: ["account", "features"] },
  { key: "qbr_outline", name: "QBR/EBR outline", description: "Outline a QBR/EBR.", capability: "qbr_outline", category: "customer_success", requestType: "draft", template: "Outline a QBR/EBR for {{account}} covering value {{value}} and goals {{goals}}.", variables: ["account", "value", "goals"] },
  { key: "quiz_generator", name: "Quiz generator", description: "Generate a training quiz.", capability: "quiz_generator", category: "training", requestType: "draft", template: "Generate a quiz for lesson {{lesson}} covering {{topics}}.", variables: ["lesson", "topics"] },
  { key: "learning_path_suggestion", name: "Learning path suggestion", description: "Suggest a learning path.", capability: "learning_path_suggestion", category: "training", requestType: "recommendation", template: "Suggest a learning path for {{role}} with goals {{goals}}.", variables: ["role", "goals"] },
  { key: "partner_action_plan", name: "Partner action plan", description: "Create a partner action plan.", capability: "partner_action_plan", category: "partners", requestType: "draft", template: "Create an action plan for partner {{partner}} to improve {{metric}}.", variables: ["partner", "metric"] },
  { key: "inactivity_alert_explanation", name: "Inactivity alert explanation", description: "Explain a partner inactivity alert.", capability: "inactivity_alert_explanation", category: "partners", requestType: "classification", template: "Explain the inactivity alert for partner {{partner}} inactive for {{days}} days.", variables: ["partner", "days"] },
  { key: "reseller_performance_summary", name: "Reseller performance summary", description: "Summarize reseller performance.", capability: "reseller_performance_summary", category: "partners", requestType: "summary", template: "Summarize performance for reseller {{reseller}} with {{revenue}} revenue and {{deals}} deals.", variables: ["reseller", "revenue", "deals"] },
  { key: "reseller_action_plan", name: "Reseller action plan", description: "Create a reseller action plan.", capability: "reseller_action_plan", category: "partners", requestType: "draft", template: "Create an action plan for reseller {{reseller}} to grow {{metric}}.", variables: ["reseller", "metric"] },
  { key: "reseller_inactivity_alert_explanation", name: "Reseller inactivity alert explanation", description: "Explain a reseller inactivity alert.", capability: "reseller_inactivity_alert_explanation", category: "partners", requestType: "classification", template: "Explain the inactivity alert for reseller {{reseller}} inactive for {{days}} days.", variables: ["reseller", "days"] }
];

export interface AiPromptTemplateSummary {
  key: string;
  name: string;
  description: string;
  capability: string;
  category: string;
  requestType: AiRequestType;
  variables: string[];
}

export interface AiTemplatesResponse {
  templates: AiPromptTemplateSummary[];
}

export interface AiSettings {
  isEnabled: boolean;
  defaultProvider: AiProviderKey;
  defaultModel: string;
  rateLimitPerMinute: number;
  allowUserOverrides: boolean;
  redactionEnabled: boolean;
  loggingEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateAiSettingsRequestBody {
  isEnabled?: boolean;
  defaultProvider?: AiProviderKey;
  defaultModel?: string;
  rateLimitPerMinute?: number;
  allowUserOverrides?: boolean;
  redactionEnabled?: boolean;
  loggingEnabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AiSettingsResponse {
  settings: AiSettings;
}

export interface AiProviderInfo {
  key: AiProviderKey;
  label: string;
  configured: boolean;
  isDefault: boolean;
  description: string;
}

export interface AiProvidersResponse {
  gatewayEnabled: boolean;
  defaultProvider: AiProviderKey;
  providers: AiProviderInfo[];
}

export interface AiUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

export interface AiRateLimitInfo {
  limitPerMinute: number;
  remaining: number;
  enforced: boolean;
}

export interface AiGovernanceInfo {
  redactionEnabled: boolean;
  loggingEnabled: boolean;
  deferred: boolean;
}

export interface AiGatewayRequestBody {
  templateKey: string;
  variables?: Record<string, string>;
  providerKey?: AiProviderKey;
  model?: string;
  requestType?: AiRequestType;
  metadata?: Record<string, unknown>;
}

export interface AiGatewayResponse {
  requestId: string;
  provider: AiProviderKey;
  model: string;
  templateKey: string;
  capability: string;
  status: AiUsageStatus;
  placeholder: boolean;
  output: string;
  resolvedPrompt: string;
  usage: AiUsage;
  latencyMs: number;
  rateLimit: AiRateLimitInfo;
  governance: AiGovernanceInfo;
  createdAt: string;
}

export interface AiUsageLogSummary {
  id: string;
  provider: AiProviderKey;
  model: string;
  templateKey: string | null;
  capability: string | null;
  requestType: string;
  status: AiUsageStatus;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  latencyMs: number | null;
  errorCode: string | null;
  actorUserId: string | null;
  createdAt: string;
}

export interface AiUsageLogListQuery {
  page?: number;
  pageSize?: number;
  provider?: string;
  status?: string;
  templateKey?: string;
}

export interface AiUsageLogsResponse {
  logs: AiUsageLogSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface AiUsageSummaryResponse {
  totalRequests: number;
  placeholderRequests: number;
  errorRequests: number;
  deniedRequests: number;
  rateLimitedRequests: number;
  totalTokens: number;
  providerDistribution: Array<{ provider: AiProviderKey; requestCount: number }>;
  statusDistribution: Array<{ status: AiUsageStatus; requestCount: number }>;
}
