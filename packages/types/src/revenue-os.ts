// ============================================================================
// Section 16: AI-Native Revenue Operating System (final principle)
//
// Two governed, config-first artefacts realise the principle that every process
// must be configurable and no business behaviour should be hard-coded where the
// configuration engine can support it:
//
//  1. configurationDimensions — the 15 canonical dimensions any config rule can
//     be scoped by (persona, role, team, region, product, segment, customer
//     type, lead source, opportunity type, deal value, partner involvement,
//     priority, SLA, approval threshold, AI governance level), plus a pure
//     scope resolver that selects the most specific rule for a given context.
//
//  2. revenueJourneyCatalog — the 10 required revenue journeys, each defined as
//     data that COMPOSES the primitives already delivered by the config engine
//     (BPF stages, Section 12 workflow automations, Section 13 validation rules,
//     Section 14 notification rules). Journeys are assembled from configuration,
//     never hard-coded, and are unit-tested to reference only real primitives.
// ============================================================================

import type { ConfigurationDefinition } from "./configuration-definitions.js";

// ---------------------------------------------------------------------------
// Configuration dimensions
// ---------------------------------------------------------------------------

export const configurationDimensionKeys = [
  "persona",
  "role",
  "team",
  "region",
  "product",
  "segment",
  "customer_type",
  "lead_source",
  "opportunity_type",
  "deal_value",
  "partner_involvement",
  "priority",
  "sla",
  "approval_threshold",
  "ai_governance_level"
] as const;
export type ConfigurationDimensionKey = (typeof configurationDimensionKeys)[number];

export interface ConfigurationDimension {
  key: ConfigurationDimensionKey;
  label: string;
  description: string;
  source: string;
  examples: string[];
}

export const configurationDimensions: ConfigurationDimension[] = [
  { key: "persona", label: "Persona", description: "The acting persona driving the process.", source: "persona-access-metadata", examples: ["sdr", "account-executive", "csm-enterprise"] },
  { key: "role", label: "Role", description: "The user's RBAC role.", source: "rbac role templates", examples: ["sales-manager", "sales-head", "ai-governance-manager"] },
  { key: "team", label: "Team", description: "The owning team.", source: "teams", examples: ["inside-sales", "enterprise", "support-l2"] },
  { key: "region", label: "Region", description: "Territory / geography.", source: "territory metadata", examples: ["north", "emea", "apac"] },
  { key: "product", label: "Product", description: "Product or product line.", source: "product catalog", examples: ["core", "platform", "add-on"] },
  { key: "segment", label: "Segment", description: "Market segment.", source: "account segment", examples: ["smb", "mid_market", "enterprise"] },
  { key: "customer_type", label: "Customer type", description: "Relationship type.", source: "account metadata", examples: ["new", "existing", "strategic"] },
  { key: "lead_source", label: "Lead source", description: "Origin of the lead / opportunity.", source: "lead-source option set", examples: ["inbound", "outbound", "campaign", "partner", "referral"] },
  { key: "opportunity_type", label: "Opportunity type", description: "Deal motion type.", source: "opportunity metadata", examples: ["new_business", "renewal", "expansion"] },
  { key: "deal_value", label: "Deal value", description: "Amount band used for thresholds.", source: "opportunity.amount band", examples: ["standard", "strategic", "enterprise"] },
  { key: "partner_involvement", label: "Partner involvement", description: "Channel involvement.", source: "partner deal registration", examples: ["direct", "partner_sourced", "partner_fulfilled"] },
  { key: "priority", label: "Priority", description: "Record priority.", source: "priority option set", examples: ["low", "medium", "high", "critical"] },
  { key: "sla", label: "SLA", description: "Applicable SLA tier.", source: "sla_policy definitions", examples: ["standard", "priority", "premium"] },
  { key: "approval_threshold", label: "Approval threshold", description: "Approval band (discount / value).", source: "approval_matrix definitions", examples: ["auto", "manager", "sales_head", "finance"] },
  { key: "ai_governance_level", label: "AI governance level", description: "AI autonomy / oversight level.", source: "ai-governance risk tiers", examples: ["assisted", "reviewed", "autonomous"] }
];

// A scope is a partial selector over the dimensions. An empty scope is the
// tenant-wide default; more specified dimensions => more specific rule.
export type ConfigScope = Partial<Record<ConfigurationDimensionKey, string>>;
export type ConfigContext = Partial<Record<ConfigurationDimensionKey, string>>;

export interface ScopedConfigEntry<T> {
  scope: ConfigScope;
  value: T;
}

// A scope matches a context when every specified dimension equals the context's.
export function matchConfigScope(scope: ConfigScope, context: ConfigContext): boolean {
  return configurationDimensionKeys.every((key) => scope[key] === undefined || scope[key] === context[key]);
}

export function scopeSpecificity(scope: ConfigScope): number {
  return configurationDimensionKeys.reduce((count, key) => (scope[key] === undefined ? count : count + 1), 0);
}

// Resolve the most specific matching entry for a context (tenant-wide default
// wins only when nothing more specific matches). Deterministic + unit-tested.
export function resolveScopedConfig<T>(context: ConfigContext, entries: ScopedConfigEntry<T>[]): T | undefined {
  let best: ScopedConfigEntry<T> | undefined;
  let bestScore = -1;
  for (const entry of entries) {
    if (!matchConfigScope(entry.scope, context)) continue;
    const score = scopeSpecificity(entry.scope);
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return best?.value;
}

// ---------------------------------------------------------------------------
// Revenue journeys
// ---------------------------------------------------------------------------

export const revenueMotions = [
  "inbound_sales",
  "outbound_sales",
  "partner_sales",
  "enterprise_sales",
  "renewal_sales",
  "expansion_sales",
  "support_led_expansion",
  "campaign_led_opportunities",
  "customer_success_led_retention",
  "ai_assisted_workflows"
] as const;
export type RevenueMotion = (typeof revenueMotions)[number];

export interface RevenueJourney {
  key: RevenueMotion;
  name: string;
  description: string;
  entryTrigger: string;
  // The dimension scope that selects this journey for a record.
  scope: ConfigScope;
  stages: string[];
  // Primitives (already delivered by the config engine) this journey composes.
  composedOf: {
    bpf: string;
    workflows: string[]; // Section 12 workflow automation seedKeys
    validations: string[]; // Section 13 validation rule keys
    notifications: string[]; // Section 14 notification rule keys
  };
}

export const revenueJourneyCatalog: RevenueJourney[] = [
  {
    key: "inbound_sales",
    name: "Inbound sales",
    description: "Inbound leads captured, enriched, scored, qualified and converted to opportunities.",
    entryTrigger: "lead.created (inbound source)",
    scope: { lead_source: "inbound" },
    stages: ["capture", "enrich", "score", "qualify", "convert", "close"],
    composedOf: {
      bpf: "lead-lifecycle",
      workflows: ["auto-enrich-lead", "auto-score-lead", "auto-mark-mql", "auto-route-mql", "auto-start-lead-sla", "auto-create-opportunity-on-conversion"],
      validations: ["lead_mql_requires_score_consent", "lead_convert_requires_account_contact"],
      notifications: ["new_lead_assigned", "mql_ready_for_sales"]
    }
  },
  {
    key: "outbound_sales",
    name: "Outbound sales",
    description: "SDR/BDR outbound prospecting, cadences and opportunity creation.",
    entryTrigger: "lead.created (outbound source)",
    scope: { lead_source: "outbound" },
    stages: ["target", "sequence", "qualify", "create_opportunity", "close"],
    composedOf: {
      bpf: "lead-lifecycle",
      workflows: ["auto-create-followup-cadence", "auto-score-lead", "auto-escalate-hot-lead", "auto-create-opportunity-on-conversion"],
      validations: ["lead_sql_requires_qualification", "lead_convert_requires_account_contact"],
      notifications: ["hot_lead_created", "new_lead_assigned"]
    }
  },
  {
    key: "partner_sales",
    name: "Partner sales",
    description: "Partner-registered deals with conflict checks and commission calculation.",
    entryTrigger: "partner.deal_registered",
    scope: { partner_involvement: "partner_sourced" },
    stages: ["register", "conflict_check", "approve", "co_sell", "close", "commission"],
    composedOf: {
      bpf: "partner-lifecycle",
      workflows: ["auto-detect-partner-conflict", "auto-calculate-partner-commission"],
      validations: ["partner_deal_blocks_on_conflict"],
      notifications: ["partner_deal_registered", "partner_conflict_detected"]
    }
  },
  {
    key: "enterprise_sales",
    name: "Enterprise sales",
    description: "Strategic high-value deals with discovery, deal review and multi-approval governance.",
    entryTrigger: "opportunity.created (strategic / high value)",
    scope: { segment: "enterprise", deal_value: "strategic" },
    stages: ["discovery", "solution", "proposal", "negotiation", "deal_review", "close"],
    composedOf: {
      bpf: "opportunity-pipeline",
      workflows: ["auto-create-proposal-request", "auto-trigger-discount-approval", "auto-trigger-legal-review", "auto-alert-sales-head-strategic-risk"],
      validations: ["opp_proposal_requires_discovery", "opp_negotiation_requires_proposal", "opp_strategic_close_requires_review", "opp_close_won_requires_completion"],
      notifications: ["strategic_deal_risk", "discount_approval_needed", "contract_review_needed"]
    }
  },
  {
    key: "renewal_sales",
    name: "Renewal sales",
    description: "Renewal opportunities created ahead of the renewal date and driven to closure.",
    entryTrigger: "renewal_approaching",
    scope: { opportunity_type: "renewal" },
    stages: ["identify", "engage", "quote", "close"],
    composedOf: {
      bpf: "customer-success-lifecycle",
      workflows: ["auto-create-renewal-opportunity", "auto-update-forecast-category"],
      validations: ["opp_close_won_requires_completion", "opp_close_lost_requires_reason"],
      notifications: ["renewal_due", "opportunity_closed_won"]
    }
  },
  {
    key: "expansion_sales",
    name: "Expansion sales",
    description: "Upsell/cross-sell opportunities from expansion signals in the installed base.",
    entryTrigger: "cs.expansion_signal",
    scope: { opportunity_type: "expansion" },
    stages: ["signal", "qualify", "propose", "close"],
    composedOf: {
      bpf: "opportunity-pipeline",
      workflows: ["auto-create-opportunity-on-conversion", "auto-create-proposal-request"],
      validations: ["opp_proposal_requires_discovery", "opp_close_won_requires_completion"],
      notifications: ["expansion_signal_detected", "proposal_decided"]
    }
  },
  {
    key: "support_led_expansion",
    name: "Support-led expansion",
    description: "Support interactions surface expansion opportunities routed to sales/CS.",
    entryTrigger: "ticket.resolved with expansion signal",
    scope: { customer_type: "existing" },
    stages: ["support_signal", "route", "qualify", "propose"],
    composedOf: {
      bpf: "support-lifecycle",
      workflows: ["auto-suggest-knowledge-article", "auto-send-csat-after-closure"],
      validations: ["ticket_close_requires_summary"],
      notifications: ["ticket_closed", "expansion_signal_detected"]
    }
  },
  {
    key: "campaign_led_opportunities",
    name: "Campaign-led opportunities",
    description: "Campaign responses captured as leads and progressed into opportunities.",
    entryTrigger: "campaign_response_received",
    scope: { lead_source: "campaign" },
    stages: ["respond", "capture", "score", "qualify", "convert"],
    composedOf: {
      bpf: "campaign-lifecycle",
      workflows: ["auto-create-lead-from-form", "auto-score-lead", "auto-mark-mql", "auto-create-opportunity-on-conversion"],
      validations: ["lead_mql_requires_score_consent", "lead_convert_requires_account_contact"],
      notifications: ["new_lead_assigned", "mql_ready_for_sales"]
    }
  },
  {
    key: "customer_success_led_retention",
    name: "Customer success-led retention",
    description: "CS-driven health monitoring, churn playbooks and retention.",
    entryTrigger: "customer_health_changed",
    scope: { customer_type: "existing" },
    stages: ["onboard", "adopt", "monitor_health", "intervene", "retain"],
    composedOf: {
      bpf: "customer-success-lifecycle",
      workflows: ["auto-create-onboarding-after-won", "auto-trigger-churn-playbook", "auto-create-renewal-opportunity"],
      validations: ["closed_record_edit_authorized_only"],
      notifications: ["customer_health_red", "onboarding_project_created", "renewal_due"]
    }
  },
  {
    key: "ai_assisted_workflows",
    name: "AI-assisted workflows",
    description: "Governed AI augmentation across enrichment, scoring, drafting and triage with human review.",
    entryTrigger: "any (AI governance applies)",
    scope: { ai_governance_level: "assisted" },
    stages: ["suggest", "review", "apply", "audit"],
    composedOf: {
      bpf: "opportunity-pipeline",
      workflows: ["auto-enrich-lead", "auto-score-lead", "auto-generate-meeting-summary", "auto-suggest-knowledge-article", "auto-log-ai-actions-audit"],
      validations: ["ai_external_requires_approval"],
      notifications: ["ai_low_confidence_alert"]
    }
  }
];

export function findRevenueJourney(key: string): RevenueJourney | undefined {
  return revenueJourneyCatalog.find((journey) => journey.key === key);
}

// ---------------------------------------------------------------------------
// Seed — journeys as governed `journey` configuration definitions.
// ---------------------------------------------------------------------------

const JOURNEY_PHASE = "section-16-revenue-os";

export const defaultJourneyConfigurationDefinitions: ConfigurationDefinition[] = revenueJourneyCatalog.map((journey) => ({
  definitionType: "journey",
  definitionKey: journey.key,
  name: journey.name,
  description: journey.description,
  isActive: true,
  definition: {
    motion: journey.key,
    entryTrigger: journey.entryTrigger,
    scope: journey.scope,
    stages: journey.stages,
    composedOf: journey.composedOf,
    metadata: { phase: JOURNEY_PHASE }
  }
}));

// The dimension registry, seeded as a governed tenant setting value.
export function buildConfigurationDimensionsSettingValue() {
  return {
    dimensions: configurationDimensions,
    principle: "Every process is configurable by dimension; journeys are composed from configuration, not hard-coded."
  };
}
