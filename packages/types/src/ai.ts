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
  { key: "generic_assistant", name: "Generic assistant", description: "General-purpose assistant prompt.", capability: "generic_assistant", category: "general", requestType: "completion", template: "{{prompt}}", variables: ["prompt"] }
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
