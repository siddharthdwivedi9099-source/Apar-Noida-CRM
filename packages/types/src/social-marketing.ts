// Personas 1–5 (marketing cluster) gap-closure contracts + pure resolvers.
// SM-002 social lead capture, SM-004 social response templates, CM-004 campaign
// approval gating, CM-005 campaign closure reports, and MM-003/MM-005 sales
// handoff rejection. AI recommendations stay governed placeholders.

export const socialInteractionTypes = ["comment", "dm", "mention", "social_form"] as const;
export type SocialInteractionType = (typeof socialInteractionTypes)[number];

/**
 * SM-002: the lead source is automatically marked as the relevant social
 * channel when the channel key exists in the tenant's lead-source option set;
 * otherwise the configurable fallback source is used.
 */
export function mapSocialChannelToLeadSource(
  channelKey: string | null | undefined,
  availableSourceKeys: readonly string[],
  fallbackSourceKey = "social_other"
): string {
  if (channelKey && availableSourceKeys.includes(channelKey)) {
    return channelKey;
  }
  return availableSourceKeys.includes(fallbackSourceKey) ? fallbackSourceKey : "website";
}

export interface CaptureSocialLeadRequestBody {
  interactionType: SocialInteractionType;
  firstName: string;
  lastName: string;
  companyName: string;
  email?: string | null;
  phone?: string | null;
  consentCaptured?: boolean;
  note?: string | null;
  /** Duplicate matches block creation unless explicitly allowed. */
  allowDuplicate?: boolean;
}

export interface SocialLeadDuplicateMatch {
  leadId: string;
  fullName: string;
  companyName: string;
  email: string | null;
  phone: string | null;
}

export interface CaptureSocialLeadResponse {
  leadId: string;
  sourceKey: string;
  campaignId: string | null;
  duplicates: SocialLeadDuplicateMatch[];
}

// ---- SM-004: social response templates ---------------------------------------------------------

export interface SocialResponseEntry {
  id: string;
  templateKey: string | null;
  response: string;
  interactionRef: string | null;
  escalated: boolean;
  respondedBy: string | null;
  respondedAt: string;
}

export interface SocialResponseTemplateSummary {
  key: string;
  label: string;
  body: string | null;
  sensitive: boolean;
}

export interface RecordSocialResponseRequestBody {
  templateKey?: string | null;
  responseText?: string | null;
  interactionRef?: string | null;
  /** Sensitive complaints can be escalated to the support-manager role. */
  escalate?: boolean;
}

export interface SocialResponsesResponse {
  responses: SocialResponseEntry[];
}

// ---- CM-004: campaign approval gate ------------------------------------------------------------

export interface CampaignApprovalPolicy {
  /** Campaigns with budget at or above this amount require approval before going live. */
  budgetThreshold: number;
  /** Campaign type keys that always require approval regardless of budget. */
  requiredForTypeKeys: string[];
}

export const defaultCampaignApprovalPolicy: CampaignApprovalPolicy = {
  budgetThreshold: 100000,
  requiredForTypeKeys: []
};

/** CM-004: approval requirement depends on spend and campaign type — both configurable. */
export function isCampaignApprovalRequired(
  budgetAmount: number | null | undefined,
  typeKey: string | null | undefined,
  policy: CampaignApprovalPolicy
): boolean {
  if (typeKey && policy.requiredForTypeKeys.includes(typeKey)) {
    return true;
  }
  return typeof budgetAmount === "number" && policy.budgetThreshold > 0 && budgetAmount >= policy.budgetThreshold;
}

export interface RequestCampaignApprovalBody {
  approverUserId: string;
  note?: string | null;
}

export interface CampaignApprovalState {
  approvalId: string;
  status: string;
  requestedBy: string;
  requestedAt: string;
}

// ---- CM-005: campaign closure report -----------------------------------------------------------

export const campaignOutcomes = ["successful", "partially_successful", "unsuccessful"] as const;
export type CampaignOutcome = (typeof campaignOutcomes)[number];

export interface CloseCampaignRequestBody {
  outcome: CampaignOutcome;
  learnings?: string | null;
  recommendations?: string | null;
}

export interface CampaignClosureMetrics {
  memberCount: number;
  leadCount: number;
  contactCount: number;
  accountCount: number;
  mqlCount: number;
  convertedLeadCount: number;
  budgetAmount: number | null;
}

export interface CampaignClosureReport {
  outcome: CampaignOutcome;
  metrics: CampaignClosureMetrics;
  learnings: string | null;
  recommendations: string | null;
  closedBy: string;
  closedAt: string;
  aiSummaryPlaceholder: { available: false; message: string };
}
