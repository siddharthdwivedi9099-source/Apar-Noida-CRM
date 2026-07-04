import type { ConfigurationDefinition } from "./configuration-definitions.js";

export const personaObjectPermissionActions = [
  "create",
  "read",
  "update",
  "delete",
  "export",
  "import",
  "assign",
  "approve"
] as const;
export type PersonaObjectPermissionAction = (typeof personaObjectPermissionActions)[number];

export const personaFieldPermissionStates = ["visible", "hidden", "read_only", "editable", "masked"] as const;
export type PersonaFieldPermissionState = (typeof personaFieldPermissionStates)[number];

export const personaRecordScopes = [
  "own_records",
  "team_records",
  "territory_records",
  "business_unit_records",
  "all_records",
  "partner_owned_records_only",
  "customer_portal_records_only"
] as const;
export type PersonaRecordScope = (typeof personaRecordScopes)[number];

export const personaSpecialActionPermissions = [
  "convert_lead",
  "close_opportunity",
  "reopen_opportunity",
  "approve_discount",
  "approve_legal",
  "publish_campaign",
  "merge_records",
  "publish_configuration",
  "run_ai_assistant",
  "approve_ai_action",
  "export_sensitive_data"
] as const;
export type PersonaSpecialActionPermission = (typeof personaSpecialActionPermissions)[number];

export const personaLayoutObjectKeys = [
  "lead",
  "account",
  "contact",
  "opportunity",
  "campaign",
  "support_ticket",
  "customer_success_plan",
  "partner",
  "approval_request",
  "dashboard"
] as const;
export type PersonaLayoutObjectKey = (typeof personaLayoutObjectKeys)[number];

type PersonaAudience = "internal" | "partner" | "customer" | "executive";
type PersonaObjectPermissionMap = Record<string, PersonaObjectPermissionAction[]>;
type PersonaFieldPermissionMap = Record<string, Record<string, PersonaFieldPermissionState>>;

interface PersonaAccessInput {
  personaKey: string;
  label: string;
  roleTemplateSlug: string;
  description: string;
  department: string;
  audience: PersonaAudience;
  objectPermissions: PersonaObjectPermissionMap;
  fieldPermissions: PersonaFieldPermissionMap;
  recordScopes: PersonaRecordScope[];
  specialActions: PersonaSpecialActionPermission[];
  dashboards: string[];
  securityNotes: string[];
  sensitiveDataRules: string[];
}

const personaAccessPhaseMetadata = {
  seeded: true,
  phase: "phase-35-persona-access-metadata",
  configurable: true,
  enforcement: "configuration-engine"
} as const;

const allObjectActions = [...personaObjectPermissionActions];
const contributorActions: PersonaObjectPermissionAction[] = ["create", "read", "update", "export"];
const collaboratorActions: PersonaObjectPermissionAction[] = ["create", "read", "update"];
const readActions: PersonaObjectPermissionAction[] = ["read"];
const readExportActions: PersonaObjectPermissionAction[] = ["read", "export"];
const approveActions: PersonaObjectPermissionAction[] = ["read", "update", "export", "approve"];
const managerActions: PersonaObjectPermissionAction[] = [
  "create",
  "read",
  "update",
  "delete",
  "export",
  "import",
  "assign",
  "approve"
];

const customerPortalActions: PersonaObjectPermissionAction[] = ["create", "read", "update"];
const partnerSalesActions: PersonaObjectPermissionAction[] = ["create", "read", "update", "export"];

const layoutFieldSets: Record<PersonaLayoutObjectKey, readonly string[]> = {
  lead: ["fullName", "companyName", "email", "phone", "leadSource", "leadStatus", "lifecycleStage", "productInterest", "region"],
  account: ["name", "industry", "segment", "region", "website", "lifecycleStage"],
  contact: ["fullName", "email", "phone", "title", "accountId", "lifecycleStage"],
  opportunity: [
    "name",
    "accountId",
    "stage",
    "type",
    "forecastCategory",
    "amount",
    "closeDate",
    "lossReason",
    "discountPercent",
    "commercialMargin"
  ],
  campaign: ["name", "campaignType", "status", "startDate", "endDate", "budget"],
  support_ticket: [
    "subject",
    "accountId",
    "contactId",
    "ticketPriority",
    "ticketStatus",
    "ticketCategory",
    "internalNotes",
    "slaBreachReason"
  ],
  customer_success_plan: ["name", "accountId", "healthStatus", "lifecycleStage", "ownerId"],
  partner: ["name", "partnerTier", "partnerStatus", "region", "accountId", "commissionVisibility"],
  approval_request: [
    "title",
    "targetObject",
    "targetRecordId",
    "approvalStatus",
    "requestedById",
    "approverId",
    "approvalReason"
  ],
  dashboard: ["dashboardKey", "metricKey", "widgetType", "targetObject", "active", "drilldownPolicy"]
};

const fieldPermissionFieldSets: Record<string, readonly string[]> = {
  ...layoutFieldSets,
  activity: ["subject", "activityType", "dueDate", "ownerId", "relatedRecordId"],
  task: ["subject", "taskStatus", "dueDate", "ownerId", "relatedRecordId"],
  meeting: ["subject", "startDateTime", "endDateTime", "attendeeSummary", "relatedRecordId"],
  call: ["subject", "callOutcome", "callTime", "phone", "relatedRecordId"],
  email_log: ["subject", "fromAddress", "toAddress", "sentAt", "relatedRecordId"],
  note: ["title", "body", "visibility", "relatedRecordId"],
  quote: ["quoteNumber", "opportunityId", "amount", "discountPercent", "commercialMargin", "quoteStatus"],
  proposal: ["proposalNumber", "opportunityId", "proposalStatus", "technicalSolution", "legalTerms"],
  contract: ["contractNumber", "accountId", "opportunityId", "contractStatus", "startDate", "endDate", "legalTerms"],
  partner_deal_registration: ["partnerId", "accountName", "opportunityName", "approvalStatus"],
  partner_commission: ["partnerId", "dealRegistrationId", "commissionRate", "payoutAmount", "approvalStatus"],
  knowledge_article: ["title", "category", "lifecycleStage", "ownerId", "customerVisible"],
  onboarding_task: ["name", "status", "dueDate", "assignedToId", "customerVisible"],
  ai_recommendation: ["recommendationType", "confidenceScore", "explanation", "feedbackStatus"],
  ai_audit_log: ["prompt", "response", "confidenceScore", "approvalStatus", "feedback"],
  workflow_rule: ["name", "active", "trigger", "actionSummary"],
  dashboard_widget: layoutFieldSets.dashboard,
  shared_document: ["name", "documentType", "visibility", "sharedAt"]
};

const layoutObjectLabels: Record<PersonaLayoutObjectKey, string> = {
  lead: "Lead",
  account: "Account",
  contact: "Contact",
  opportunity: "Opportunity",
  campaign: "Campaign",
  support_ticket: "Ticket",
  customer_success_plan: "Customer Success Plan",
  partner: "Partner",
  approval_request: "Approval Request",
  dashboard: "Dashboard"
};

function unique<T extends string>(values: T[]) {
  return Array.from(new Set(values));
}

function objectPermissionsFor(
  objects: readonly string[],
  actions: readonly PersonaObjectPermissionAction[]
): PersonaObjectPermissionMap {
  return Object.fromEntries(objects.map((objectKey) => [objectKey, [...actions]]));
}

function mergeObjectPermissions(...maps: PersonaObjectPermissionMap[]): PersonaObjectPermissionMap {
  const merged: PersonaObjectPermissionMap = {};
  for (const map of maps) {
    for (const [objectKey, actions] of Object.entries(map)) {
      merged[objectKey] = unique([...(merged[objectKey] ?? []), ...actions]);
    }
  }
  return merged;
}

function fieldStates(fields: readonly string[], state: PersonaFieldPermissionState) {
  return Object.fromEntries(fields.map((field) => [field, state])) as Record<string, PersonaFieldPermissionState>;
}

function mergeFieldPermissions(...maps: PersonaFieldPermissionMap[]): PersonaFieldPermissionMap {
  const merged: PersonaFieldPermissionMap = {};
  for (const map of maps) {
    for (const [objectKey, permissions] of Object.entries(map)) {
      merged[objectKey] = {
        ...(merged[objectKey] ?? {}),
        ...permissions
      };
    }
  }
  return merged;
}

function fieldPermissionsFor(
  objects: readonly string[],
  state: PersonaFieldPermissionState
): PersonaFieldPermissionMap {
  const permissions: PersonaFieldPermissionMap = {};
  for (const objectKey of objects) {
    permissions[objectKey] = fieldStates(fieldPermissionFieldSets[objectKey] ?? ["accessSummary"], state);
  }
  return permissions;
}

function buildFieldPermissions(input: {
  editable?: readonly string[];
  readOnly?: readonly string[];
  visible?: readonly string[];
  masked?: PersonaFieldPermissionMap;
  hidden?: PersonaFieldPermissionMap;
  extra?: PersonaFieldPermissionMap;
}) {
  return mergeFieldPermissions(
    fieldPermissionsFor(input.visible ?? [], "visible"),
    fieldPermissionsFor(input.readOnly ?? [], "read_only"),
    fieldPermissionsFor(input.editable ?? [], "editable"),
    input.masked ?? {},
    input.hidden ?? {},
    input.extra ?? {}
  );
}

const commercialSensitiveFields: PersonaFieldPermissionMap = {
  opportunity: {
    discountPercent: "hidden",
    commercialMargin: "hidden"
  },
  quote: {
    discountPercent: "hidden",
    commercialMargin: "hidden"
  },
  partner: {
    commissionVisibility: "hidden"
  },
  partner_commission: {
    commissionRate: "hidden",
    payoutAmount: "hidden"
  }
};

const supportInternalFields: PersonaFieldPermissionMap = {
  support_ticket: {
    internalNotes: "hidden",
    slaBreachReason: "hidden"
  }
};

const contactMaskedFields: PersonaFieldPermissionMap = {
  contact: {
    email: "masked",
    phone: "masked"
  },
  lead: {
    email: "masked",
    phone: "masked"
  }
};

const partnerMaskedFields: PersonaFieldPermissionMap = {
  contact: {
    email: "masked",
    phone: "masked"
  },
  account: {
    website: "visible"
  }
};

const aiGovernanceFields: PersonaFieldPermissionMap = {
  ai_recommendation: {
    recommendationType: "visible",
    confidenceScore: "visible",
    explanation: "visible",
    feedbackStatus: "editable"
  },
  ai_audit_log: {
    prompt: "visible",
    response: "visible",
    confidenceScore: "visible",
    approvalStatus: "editable",
    feedback: "editable"
  },
  workflow_rule: {
    name: "visible",
    active: "editable",
    trigger: "visible",
    actionSummary: "visible"
  }
};

const marketingObjects = ["lead", "campaign", "campaign_member", "activity", "task", "email_log", "note"];
const salesObjects = ["lead", "account", "contact", "opportunity", "activity", "task", "meeting", "call", "email_log", "note"];
const commercialObjects = ["opportunity", "quote", "proposal", "contract", "approval_request"];
const partnerObjects = ["partner", "partner_user", "partner_deal_registration", "partner_commission", "account", "contact", "opportunity"];
const supportObjects = ["support_ticket", "sla", "escalation", "knowledge_article", "account", "contact", "activity", "task", "note"];
const customerSuccessObjects = [
  "customer_success_plan",
  "onboarding_project",
  "onboarding_task",
  "customer_health_score",
  "renewal_opportunity",
  "expansion_opportunity",
  "account",
  "contact",
  "support_ticket",
  "knowledge_article"
];
const adminObjects = [
  "lead",
  "account",
  "contact",
  "opportunity",
  "campaign",
  "campaign_member",
  "activity",
  "task",
  "meeting",
  "call",
  "email_log",
  "note",
  "product",
  "product_bundle",
  "price_book",
  "quote",
  "proposal",
  "approval_request",
  "contract",
  "partner",
  "partner_user",
  "partner_deal_registration",
  "partner_commission",
  "support_ticket",
  "sla",
  "escalation",
  "knowledge_article",
  "customer_success_plan",
  "onboarding_project",
  "onboarding_task",
  "customer_health_score",
  "renewal_opportunity",
  "expansion_opportunity",
  "ai_recommendation",
  "ai_audit_log",
  "workflow_rule",
  "dashboard_widget"
];

const customerPortalObjectPermissions = objectPermissionsFor(
  ["support_ticket", "onboarding_task", "knowledge_article", "shared_document"],
  customerPortalActions
);

const allLayoutObjects = [...personaLayoutObjectKeys];

const defaultPersonaAccessInputs: PersonaAccessInput[] = [
  {
    personaKey: "social-media-marketing-executive",
    label: "Social Media Marketing Executive",
    roleTemplateSlug: "social-media-marketing-executive",
    description: "Creates social demand activity, captures leads, and reviews campaign performance.",
    department: "marketing",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(["campaign", "campaign_member", "activity", "task", "email_log", "note"], contributorActions),
      objectPermissionsFor(["lead"], ["create", "read", "update", "export"])
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["lead", "campaign"],
      readOnly: ["account", "contact", "opportunity", "approval_request", "dashboard"],
      hidden: commercialSensitiveFields
    }),
    recordScopes: ["own_records", "team_records"],
    specialActions: ["run_ai_assistant"],
    dashboards: ["marketing-performance", "campaign-engagement"],
    securityNotes: ["Limited to owned or team marketing records and non-sensitive commercial context."],
    sensitiveDataRules: ["Commercial margin, discount, and partner commission fields remain hidden."]
  },
  {
    personaKey: "digital-marketing-executive",
    label: "Digital Marketing Executive",
    roleTemplateSlug: "digital-marketing-executive",
    description: "Runs digital campaigns, lead-source hygiene, and conversion reporting.",
    department: "marketing",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(marketingObjects, contributorActions),
      objectPermissionsFor(["dashboard_widget"], readActions)
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["lead", "campaign"],
      readOnly: ["account", "contact", "opportunity", "dashboard"],
      hidden: commercialSensitiveFields
    }),
    recordScopes: ["own_records", "team_records"],
    specialActions: ["run_ai_assistant"],
    dashboards: ["lead-source-performance", "campaign-attribution"],
    securityNotes: ["Can work marketing records but cannot publish campaigns or view sensitive deal economics."],
    sensitiveDataRules: ["Lead/contact PII follows standard marketing visibility; deal economics are hidden."]
  },
  {
    personaKey: "marketing-manager",
    label: "Marketing Manager",
    roleTemplateSlug: "marketing-manager",
    description: "Owns marketing execution, campaign approvals, segmentation, and team reporting.",
    department: "marketing",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(marketingObjects, managerActions),
      objectPermissionsFor(["dashboard_widget"], readExportActions),
      objectPermissionsFor(["opportunity", "account", "contact"], readExportActions)
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["lead", "campaign"],
      readOnly: ["account", "contact", "opportunity", "approval_request", "dashboard"],
      hidden: commercialSensitiveFields
    }),
    recordScopes: ["team_records", "business_unit_records"],
    specialActions: ["publish_campaign", "run_ai_assistant"],
    dashboards: ["marketing-performance", "pipeline-influence", "campaign-roi"],
    securityNotes: ["Can publish approved campaign metadata but not approve discounts or view margins."],
    sensitiveDataRules: ["Commercial margin, quote discount, and partner commission fields remain hidden."]
  },
  {
    personaKey: "campaign-manager",
    label: "Campaign Manager",
    roleTemplateSlug: "campaign-manager",
    description: "Plans, launches, and reports on campaigns with member and attribution visibility.",
    department: "marketing",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(["campaign", "campaign_member", "lead", "activity", "task", "email_log", "note"], managerActions),
      objectPermissionsFor(["account", "contact", "opportunity", "dashboard_widget"], readExportActions)
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["campaign", "lead"],
      readOnly: ["account", "contact", "opportunity", "approval_request", "dashboard"],
      hidden: commercialSensitiveFields
    }),
    recordScopes: ["team_records", "business_unit_records"],
    specialActions: ["publish_campaign", "run_ai_assistant"],
    dashboards: ["campaign-performance", "campaign-members", "pipeline-influence"],
    securityNotes: ["Can publish campaigns after approval but cannot approve commercial or legal terms."],
    sensitiveDataRules: ["Opportunity amount is visible for influence reporting; margin and discount fields are hidden."]
  },
  {
    personaKey: "marketing-operations-revops",
    label: "Marketing Operations / RevOps",
    roleTemplateSlug: "marketing-operations-revops",
    description: "Configures lifecycle metadata, routing inputs, imports, exports, and revenue operations reporting.",
    department: "revenue-operations",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(["lead", "campaign", "campaign_member", "workflow_rule", "dashboard_widget"], managerActions),
      objectPermissionsFor(["account", "contact", "opportunity"], ["read", "update", "export", "import", "assign"])
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["lead", "campaign", "dashboard"],
      readOnly: ["account", "contact", "opportunity", "approval_request"],
      hidden: commercialSensitiveFields
    }),
    recordScopes: ["business_unit_records", "all_records"],
    specialActions: ["publish_campaign", "merge_records", "publish_configuration", "run_ai_assistant"],
    dashboards: ["revops-data-quality", "campaign-attribution", "lifecycle-funnel"],
    securityNotes: ["Can publish governed configuration metadata but cannot approve discounts or legal terms."],
    sensitiveDataRules: ["Commercial margin is hidden unless a separate finance approval policy is assigned."]
  },
  {
    personaKey: "inside-sales-representative",
    label: "Inside Sales Representative",
    roleTemplateSlug: "inside-sales-representative",
    description: "Works assigned leads, contacts, and early-stage opportunities.",
    department: "sales",
    audience: "internal",
    objectPermissions: objectPermissionsFor(salesObjects, contributorActions),
    fieldPermissions: buildFieldPermissions({
      editable: ["lead", "account", "contact", "opportunity"],
      readOnly: ["campaign", "support_ticket", "customer_success_plan", "approval_request", "dashboard"],
      hidden: commercialSensitiveFields
    }),
    recordScopes: ["own_records", "team_records"],
    specialActions: ["convert_lead", "run_ai_assistant"],
    dashboards: ["inside-sales-activity", "lead-queue"],
    securityNotes: ["Can convert assigned leads but cannot close opportunities or approve discounts."],
    sensitiveDataRules: ["Sensitive quote, margin, and commission fields remain hidden."]
  },
  {
    personaKey: "sales-development-representative",
    label: "Sales Development Representative",
    roleTemplateSlug: "sales-development-representative",
    description: "Qualifies inbound and outbound leads and prepares handoff-ready opportunities.",
    department: "sales",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(["lead", "contact", "activity", "task", "call", "email_log", "note"], contributorActions),
      objectPermissionsFor(["account", "opportunity", "campaign"], readExportActions)
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["lead", "contact"],
      readOnly: ["account", "opportunity", "campaign", "approval_request", "dashboard"],
      hidden: commercialSensitiveFields
    }),
    recordScopes: ["own_records", "team_records"],
    specialActions: ["convert_lead", "run_ai_assistant"],
    dashboards: ["sdr-activity", "qualification-funnel"],
    securityNotes: ["Can convert qualified leads but has read-only opportunity economics with sensitive fields hidden."],
    sensitiveDataRules: ["Commercial fields are hidden; contact PII visibility is limited to assigned/team records."]
  },
  {
    personaKey: "business-development-representative",
    label: "Business Development Representative",
    roleTemplateSlug: "business-development-representative",
    description: "Develops target account pipeline and partner-sourced lead motions.",
    department: "sales",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(["lead", "account", "contact", "opportunity", "partner", "partner_deal_registration"], contributorActions),
      objectPermissionsFor(["campaign", "dashboard_widget"], readExportActions)
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["lead", "account", "contact", "opportunity", "partner"],
      readOnly: ["campaign", "approval_request", "dashboard"],
      hidden: commercialSensitiveFields
    }),
    recordScopes: ["own_records", "team_records", "territory_records"],
    specialActions: ["convert_lead", "run_ai_assistant"],
    dashboards: ["business-development-pipeline", "target-account-coverage"],
    securityNotes: ["Can create partner-sourced pipeline but cannot see partner commissions or deal margins."],
    sensitiveDataRules: ["Partner commission and commercial margin fields remain hidden."]
  },
  {
    personaKey: "account-executive-sales-executive",
    label: "Account Executive / Sales Executive",
    roleTemplateSlug: "account-executive-sales-executive",
    description: "Owns account opportunity execution, close plans, quotes, and customer-facing sales activity.",
    department: "sales",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(["account", "contact", "opportunity", "activity", "task", "meeting", "call", "email_log", "note"], contributorActions),
      objectPermissionsFor(["lead"], ["read", "update", "export"]),
      objectPermissionsFor(["quote", "proposal", "approval_request"], ["create", "read", "update", "export"])
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["account", "contact", "opportunity", "approval_request"],
      readOnly: ["lead", "campaign", "support_ticket", "customer_success_plan", "partner", "dashboard"],
      hidden: commercialSensitiveFields
    }),
    recordScopes: ["own_records", "team_records", "territory_records"],
    specialActions: ["convert_lead", "close_opportunity", "reopen_opportunity", "run_ai_assistant"],
    dashboards: ["sales-pipeline", "forecast-commit", "account-plan"],
    securityNotes: ["Can close owned opportunities but cannot approve discounts or view hidden margin fields."],
    sensitiveDataRules: ["Discount approval thresholds and margins are hidden until finance approval is granted."]
  },
  {
    personaKey: "enterprise-sales-strategic-sales",
    label: "Enterprise Sales / Strategic Sales",
    roleTemplateSlug: "enterprise-sales-strategic-sales",
    description: "Owns strategic accounts, complex opportunities, executive engagement, and multi-team collaboration.",
    department: "sales",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(salesObjects, managerActions),
      objectPermissionsFor(["quote", "proposal", "contract", "approval_request"], ["create", "read", "update", "export", "assign"]),
      objectPermissionsFor(["partner", "partner_deal_registration", "customer_success_plan", "support_ticket"], readExportActions)
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["lead", "account", "contact", "opportunity", "approval_request"],
      readOnly: ["campaign", "support_ticket", "customer_success_plan", "partner", "dashboard"],
      hidden: commercialSensitiveFields
    }),
    recordScopes: ["own_records", "team_records", "territory_records", "business_unit_records"],
    specialActions: ["convert_lead", "close_opportunity", "reopen_opportunity", "run_ai_assistant"],
    dashboards: ["strategic-accounts", "enterprise-forecast", "deal-risk"],
    securityNotes: ["Broad strategic deal collaboration without independent discount or legal approval authority."],
    sensitiveDataRules: ["Margin and partner commission visibility requires finance-specific permission."]
  },
  {
    personaKey: "business-development-manager",
    label: "Business Development Manager",
    roleTemplateSlug: "business-development-manager",
    description: "Leads business development planning, partner-sourced pipeline, and target account coverage.",
    department: "sales",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(["lead", "account", "contact", "opportunity", "partner", "partner_deal_registration"], managerActions),
      objectPermissionsFor(["campaign", "dashboard_widget"], readExportActions)
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["lead", "account", "contact", "opportunity", "partner"],
      readOnly: ["campaign", "approval_request", "dashboard"],
      hidden: commercialSensitiveFields
    }),
    recordScopes: ["team_records", "territory_records", "business_unit_records"],
    specialActions: ["convert_lead", "merge_records", "run_ai_assistant"],
    dashboards: ["bd-pipeline", "partner-source", "territory-coverage"],
    securityNotes: ["Can manage BD assignments and data quality without commission or margin access."],
    sensitiveDataRules: ["Partner commission and commercial margin fields remain hidden."]
  },
  {
    personaKey: "sales-manager",
    label: "Sales Manager",
    roleTemplateSlug: "sales-manager",
    description: "Owns team pipeline, assignments, forecasting, and sales approval preparation.",
    department: "sales",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(["lead", "account", "contact", "opportunity", "activity", "task", "meeting", "call", "email_log", "note"], managerActions),
      objectPermissionsFor(["quote", "proposal", "approval_request"], ["create", "read", "update", "export", "assign", "approve"]),
      objectPermissionsFor(["campaign", "support_ticket", "customer_success_plan", "partner"], readExportActions)
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["lead", "account", "contact", "opportunity", "approval_request"],
      readOnly: ["campaign", "support_ticket", "customer_success_plan", "partner", "dashboard"],
      hidden: commercialSensitiveFields
    }),
    recordScopes: ["team_records", "territory_records", "business_unit_records"],
    specialActions: ["convert_lead", "close_opportunity", "reopen_opportunity", "run_ai_assistant"],
    dashboards: ["team-pipeline", "forecast", "activity-coaching"],
    securityNotes: ["Can approve operational sales changes but finance/legal approvals remain separate."],
    sensitiveDataRules: ["Hidden margins and commission fields require explicit finance permission."]
  },
  {
    personaKey: "sales-head-revenue-leader",
    label: "Sales Head / Revenue Leader",
    roleTemplateSlug: "sales-head-revenue-leader",
    description: "Governs revenue performance, forecasts, approvals, and executive sales drilldowns.",
    department: "revenue",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(["lead", "account", "contact", "opportunity", "quote", "proposal", "approval_request"], approveActions),
      objectPermissionsFor(["campaign", "support_ticket", "customer_success_plan", "partner", "dashboard_widget"], readExportActions)
    ),
    fieldPermissions: buildFieldPermissions({
      readOnly: ["lead", "account", "contact", "opportunity", "campaign", "support_ticket", "customer_success_plan", "partner", "approval_request", "dashboard"],
      hidden: commercialSensitiveFields
    }),
    recordScopes: ["business_unit_records", "all_records"],
    specialActions: ["close_opportunity", "reopen_opportunity", "run_ai_assistant"],
    dashboards: ["revenue-leadership", "forecast-rollup", "pipeline-risk"],
    securityNotes: ["Executive sales visibility is broad, but commercial approval is still delegated to finance."],
    sensitiveDataRules: ["Margin and discount approval fields remain hidden without finance approver policy."]
  },
  {
    personaKey: "presales-consultant",
    label: "Presales Consultant",
    roleTemplateSlug: "presales-consultant",
    description: "Supports discovery, demos, technical validation, and proposal inputs.",
    department: "presales",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(["account", "contact", "opportunity", "activity", "task", "meeting", "note"], contributorActions),
      objectPermissionsFor(["proposal", "quote", "approval_request"], ["create", "read", "update", "export"])
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["account", "contact", "opportunity", "approval_request"],
      readOnly: ["lead", "campaign", "support_ticket", "customer_success_plan", "partner", "dashboard"],
      hidden: commercialSensitiveFields
    }),
    recordScopes: ["team_records", "territory_records"],
    specialActions: ["run_ai_assistant"],
    dashboards: ["presales-workload", "solution-readiness"],
    securityNotes: ["Can update technical context but cannot approve commercial discounts or legal terms."],
    sensitiveDataRules: ["Commercial margin and partner commission fields are hidden."]
  },
  {
    personaKey: "solution-architect",
    label: "Solution Architect",
    roleTemplateSlug: "solution-architect",
    description: "Owns solution architecture validation, technical risk, and proposal support.",
    department: "presales",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(["account", "contact", "opportunity", "proposal", "approval_request"], managerActions),
      objectPermissionsFor(["quote", "contract"], readExportActions),
      objectPermissionsFor(["support_ticket", "customer_success_plan"], readActions)
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["account", "contact", "opportunity", "approval_request"],
      readOnly: ["lead", "campaign", "support_ticket", "customer_success_plan", "partner", "dashboard"],
      hidden: commercialSensitiveFields
    }),
    recordScopes: ["team_records", "territory_records", "business_unit_records"],
    specialActions: ["run_ai_assistant"],
    dashboards: ["solution-risk", "proposal-readiness"],
    securityNotes: ["Technical approval inputs are allowed; discount and legal approvals are not."],
    sensitiveDataRules: ["Financially sensitive quote and margin fields are hidden."]
  },
  {
    personaKey: "proposal-bid-manager",
    label: "Proposal / Bid Manager",
    roleTemplateSlug: "proposal-bid-manager",
    description: "Coordinates proposals, bid packages, quote readiness, and approval routing.",
    department: "presales",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(["proposal", "quote", "approval_request", "opportunity", "account", "contact"], managerActions),
      objectPermissionsFor(["contract"], readExportActions)
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["account", "contact", "opportunity", "approval_request"],
      readOnly: ["lead", "campaign", "support_ticket", "customer_success_plan", "partner", "dashboard"],
      hidden: commercialSensitiveFields
    }),
    recordScopes: ["team_records", "business_unit_records"],
    specialActions: ["run_ai_assistant"],
    dashboards: ["proposal-queue", "bid-readiness"],
    securityNotes: ["Can route approvals and coordinate packages but cannot approve discounts or legal terms."],
    sensitiveDataRules: ["Margin fields and final legal terms are read-restricted until approvers act."]
  },
  {
    personaKey: "commercial-finance-approver",
    label: "Commercial / Finance Approver",
    roleTemplateSlug: "commercial-finance-approver",
    description: "Reviews commercial terms, discounts, margins, quote approvals, and finance exceptions.",
    department: "finance",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(["opportunity", "quote", "proposal", "approval_request"], approveActions),
      objectPermissionsFor(["account", "contact", "contract", "dashboard_widget"], readExportActions)
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["opportunity", "approval_request"],
      readOnly: ["account", "contact", "campaign", "customer_success_plan", "partner", "dashboard"],
      hidden: supportInternalFields,
      extra: {
        quote: {
          quoteNumber: "visible",
          opportunityId: "visible",
          amount: "visible",
          discountPercent: "editable",
          commercialMargin: "visible",
          quoteStatus: "editable"
        },
        opportunity: {
          discountPercent: "editable",
          commercialMargin: "visible"
        }
      }
    }),
    recordScopes: ["business_unit_records", "all_records"],
    specialActions: ["approve_discount", "run_ai_assistant", "export_sensitive_data"],
    dashboards: ["commercial-approvals", "discount-exceptions", "revenue-risk"],
    securityNotes: ["Finance can see commercial data but support internal notes are hidden as unnecessary support internals."],
    sensitiveDataRules: ["Commercial export is allowed; support internal investigation fields remain hidden."]
  },
  {
    personaKey: "legal-contract-reviewer",
    label: "Legal / Contract Reviewer",
    roleTemplateSlug: "legal-contract-reviewer",
    description: "Reviews legal terms, contract status, approval requests, and related deal context.",
    department: "legal",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(["contract", "proposal", "approval_request"], approveActions),
      objectPermissionsFor(["account", "contact", "opportunity", "quote", "dashboard_widget"], readExportActions)
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["approval_request"],
      readOnly: ["account", "contact", "opportunity", "campaign", "customer_success_plan", "partner", "dashboard"],
      hidden: supportInternalFields,
      extra: {
        contract: {
          contractNumber: "visible",
          accountId: "visible",
          opportunityId: "visible",
          contractStatus: "editable",
          startDate: "visible",
          endDate: "visible",
          legalTerms: "editable"
        },
        proposal: {
          proposalNumber: "visible",
          opportunityId: "visible",
          proposalStatus: "editable",
          technicalSolution: "visible",
          legalTerms: "editable"
        }
      }
    }),
    recordScopes: ["business_unit_records", "all_records"],
    specialActions: ["approve_legal", "run_ai_assistant", "export_sensitive_data"],
    dashboards: ["legal-review-queue", "contract-risk"],
    securityNotes: ["Legal sees contracts and legal review data; support internals and finance-only margin decisions are not exposed."],
    sensitiveDataRules: ["Legal terms export is allowed; support internal notes are hidden."]
  },
  {
    personaKey: "partner-manager",
    label: "Partner Manager",
    roleTemplateSlug: "partner-manager",
    description: "Manages partners, reseller relationships, deal registrations, and channel performance.",
    department: "partnerships",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(partnerObjects, managerActions),
      objectPermissionsFor(["dashboard_widget"], readExportActions)
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["partner", "account", "contact", "opportunity"],
      readOnly: ["lead", "campaign", "support_ticket", "customer_success_plan", "approval_request", "dashboard"],
      extra: {
        partner_commission: {
          partnerId: "visible",
          dealRegistrationId: "visible",
          commissionRate: "read_only",
          payoutAmount: "read_only",
          approvalStatus: "read_only"
        }
      }
    }),
    recordScopes: ["team_records", "business_unit_records", "partner_owned_records_only"],
    specialActions: ["run_ai_assistant"],
    dashboards: ["partner-pipeline", "partner-performance"],
    securityNotes: ["Internal partner managers can see partner performance while external partner users remain isolated."],
    sensitiveDataRules: ["Commission fields are read-only unless a separate finance approval policy is assigned."]
  },
  {
    personaKey: "reseller-partner-sales-user",
    label: "Reseller / Partner Sales User",
    roleTemplateSlug: "reseller-partner-sales-user",
    description: "External partner sales access limited to partner-owned records and approved collaboration data.",
    department: "partnerships",
    audience: "partner",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(["partner", "partner_user", "partner_deal_registration", "opportunity"], partnerSalesActions),
      objectPermissionsFor(["account", "contact", "knowledge_article", "shared_document"], readActions)
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["partner", "opportunity"],
      readOnly: ["account", "contact", "dashboard"],
      masked: partnerMaskedFields,
      hidden: commercialSensitiveFields
    }),
    recordScopes: ["partner_owned_records_only"],
    specialActions: ["run_ai_assistant"],
    dashboards: ["partner-portal-pipeline"],
    securityNotes: ["Partner users must only see their own partner records and approved collaboration data."],
    sensitiveDataRules: ["Customer PII is masked unless explicitly shared; commissions and margins are hidden."]
  },
  {
    personaKey: "support-agent-l1",
    label: "Support Agent L1",
    roleTemplateSlug: "support-agent-l1",
    description: "Handles first-line tickets, knowledge lookup, and basic customer support context.",
    department: "support",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(["support_ticket", "knowledge_article", "activity", "task", "note"], contributorActions),
      objectPermissionsFor(["account", "contact", "customer_success_plan"], readActions)
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["support_ticket"],
      readOnly: ["account", "contact", "customer_success_plan", "dashboard"],
      hidden: commercialSensitiveFields,
      masked: contactMaskedFields
    }),
    recordScopes: ["own_records", "team_records"],
    specialActions: ["run_ai_assistant"],
    dashboards: ["support-queue", "sla-watch"],
    securityNotes: ["Support L1 sees support context but not sensitive commercial margins."],
    sensitiveDataRules: ["Commercial margin, discount, and partner commission fields are hidden; contact PII may be masked."]
  },
  {
    personaKey: "support-agent-l2",
    label: "Support Agent L2",
    roleTemplateSlug: "support-agent-l2",
    description: "Handles escalated support, SLA context, knowledge maintenance, and advanced investigation.",
    department: "support",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(["support_ticket", "sla", "escalation", "knowledge_article", "activity", "task", "note"], ["create", "read", "update", "assign", "export"]),
      objectPermissionsFor(["account", "contact", "customer_success_plan"], readExportActions)
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["support_ticket"],
      readOnly: ["account", "contact", "customer_success_plan", "dashboard"],
      hidden: commercialSensitiveFields,
      masked: contactMaskedFields
    }),
    recordScopes: ["own_records", "team_records", "business_unit_records"],
    specialActions: ["run_ai_assistant"],
    dashboards: ["support-escalations", "knowledge-gaps"],
    securityNotes: ["Support L2 gets deeper support context but no discount approval or sensitive commercial export."],
    sensitiveDataRules: ["Commercial margin, discount, and partner commission fields are hidden."]
  },
  {
    personaKey: "support-manager",
    label: "Support Manager",
    roleTemplateSlug: "support-manager",
    description: "Oversees support operations, SLA performance, escalations, and support team reporting.",
    department: "support",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(supportObjects, managerActions),
      objectPermissionsFor(["customer_success_plan"], readExportActions),
      objectPermissionsFor(["dashboard_widget"], readExportActions)
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["support_ticket"],
      readOnly: ["account", "contact", "customer_success_plan", "dashboard"],
      hidden: commercialSensitiveFields
    }),
    recordScopes: ["team_records", "business_unit_records"],
    specialActions: ["run_ai_assistant"],
    dashboards: ["support-manager", "sla-performance", "ticket-trends"],
    securityNotes: ["Support managers can report and assign support work but cannot approve discounts or legal terms."],
    sensitiveDataRules: ["Commercial margin, discount, and partner commission fields remain hidden."]
  },
  {
    personaKey: "customer-success-manager-onboarding",
    label: "Customer Success Manager - Onboarding",
    roleTemplateSlug: "customer-success-manager-onboarding",
    description: "Owns onboarding plans, projects, tasks, health context, and initial customer outcomes.",
    department: "customer-success",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(customerSuccessObjects, managerActions),
      objectPermissionsFor(["dashboard_widget"], readExportActions)
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["customer_success_plan", "support_ticket"],
      readOnly: ["account", "contact", "opportunity", "campaign", "partner", "approval_request", "dashboard"],
      hidden: commercialSensitiveFields
    }),
    recordScopes: ["own_records", "team_records", "business_unit_records"],
    specialActions: ["run_ai_assistant"],
    dashboards: ["onboarding-progress", "health-risks"],
    securityNotes: ["Onboarding CSMs see customer success and support context without sensitive commercial margins."],
    sensitiveDataRules: ["Commercial margin, quote discount, and partner commission fields remain hidden."]
  },
  {
    personaKey: "customer-success-manager-scaled",
    label: "Customer Success Manager - Scaled",
    roleTemplateSlug: "customer-success-manager-scaled",
    description: "Runs scaled success motions, health segmentation, renewal readiness, and customer engagement.",
    department: "customer-success",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(customerSuccessObjects, ["create", "read", "update", "export", "assign"]),
      objectPermissionsFor(["dashboard_widget"], readExportActions)
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["customer_success_plan"],
      readOnly: ["account", "contact", "opportunity", "support_ticket", "campaign", "partner", "approval_request", "dashboard"],
      hidden: commercialSensitiveFields
    }),
    recordScopes: ["team_records", "business_unit_records"],
    specialActions: ["run_ai_assistant"],
    dashboards: ["scaled-health", "renewal-readiness"],
    securityNotes: ["Scaled CSMs can work success motions but cannot approve discounts or see margin details."],
    sensitiveDataRules: ["Commercial margin, quote discount, and partner commission fields remain hidden."]
  },
  {
    personaKey: "customer-success-manager-enterprise",
    label: "Customer Success Manager - Enterprise",
    roleTemplateSlug: "customer-success-manager-enterprise",
    description: "Leads enterprise success operations, escalations, health, and expansion coordination.",
    department: "customer-success",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(customerSuccessObjects, managerActions),
      objectPermissionsFor(["opportunity", "quote", "approval_request"], readExportActions),
      objectPermissionsFor(["dashboard_widget"], readExportActions)
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["customer_success_plan", "support_ticket"],
      readOnly: ["account", "contact", "opportunity", "campaign", "partner", "approval_request", "dashboard"],
      hidden: commercialSensitiveFields
    }),
    recordScopes: ["team_records", "business_unit_records"],
    specialActions: ["run_ai_assistant"],
    dashboards: ["enterprise-health", "expansion-readiness", "executive-success"],
    securityNotes: ["Enterprise CSMs coordinate expansion but finance/legal approvals remain separate."],
    sensitiveDataRules: ["Commercial margin, quote discount, and partner commission fields remain hidden."]
  },
  {
    personaKey: "customer-prospect-portal-user",
    label: "Customer / Prospect Portal User",
    roleTemplateSlug: "customer-portal-user",
    description: "External customer/prospect access to own tickets, onboarding tasks, knowledge, and shared documents.",
    department: "customer-portal",
    audience: "customer",
    objectPermissions: customerPortalObjectPermissions,
    fieldPermissions: buildFieldPermissions({
      editable: ["support_ticket", "onboarding_task"],
      visible: ["knowledge_article", "shared_document"],
      hidden: mergeFieldPermissions(commercialSensitiveFields, supportInternalFields),
      masked: contactMaskedFields
    }),
    recordScopes: ["customer_portal_records_only"],
    specialActions: ["run_ai_assistant"],
    dashboards: ["customer-portal-home"],
    securityNotes: ["Customer portal users must only see their own tickets, onboarding tasks, knowledge articles, and shared documents."],
    sensitiveDataRules: ["Internal notes, support internals, commercial fields, and other customer records are hidden."]
  },
  {
    personaKey: "crm-administrator",
    label: "CRM Administrator",
    roleTemplateSlug: "crm-administrator",
    description: "Administers CRM metadata, roles, layouts, workflow rules, imports, and governed configuration.",
    department: "operations",
    audience: "internal",
    objectPermissions: objectPermissionsFor(adminObjects, managerActions),
    fieldPermissions: buildFieldPermissions({
      editable: allLayoutObjects,
      extra: fieldPermissionsFor(adminObjects, "editable")
    }),
    recordScopes: ["all_records"],
    specialActions: ["merge_records", "publish_configuration", "run_ai_assistant", "approve_ai_action", "export_sensitive_data"],
    dashboards: ["admin-configuration", "data-quality", "usage-health"],
    securityNotes: ["CRM administrators can publish governed configuration but system-level controls remain with system administrators."],
    sensitiveDataRules: ["Sensitive export is explicitly granted for administrative recovery and compliance use."]
  },
  {
    personaKey: "system-administrator",
    label: "System Administrator",
    roleTemplateSlug: "system-administrator",
    description: "Owns tenant-wide platform, security, integration, configuration, and administrative controls.",
    department: "it",
    audience: "internal",
    objectPermissions: objectPermissionsFor(adminObjects, allObjectActions),
    fieldPermissions: buildFieldPermissions({
      editable: allLayoutObjects,
      extra: fieldPermissionsFor(adminObjects, "editable")
    }),
    recordScopes: ["all_records"],
    specialActions: [
      "convert_lead",
      "close_opportunity",
      "reopen_opportunity",
      "approve_discount",
      "approve_legal",
      "publish_campaign",
      "merge_records",
      "publish_configuration",
      "run_ai_assistant",
      "approve_ai_action",
      "export_sensitive_data"
    ],
    dashboards: ["system-admin", "security-governance", "configuration-health"],
    securityNotes: ["System administrator is the break-glass platform role and should be tightly assigned."],
    sensitiveDataRules: ["All sensitive actions are granted for system administration and audited use only."]
  },
  {
    personaKey: "ai-governance-manager",
    label: "AI Governance Manager",
    roleTemplateSlug: "ai-governance-manager",
    description: "Governs AI recommendations, prompts, audit logs, approvals, confidence scores, and feedback.",
    department: "governance",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(["ai_recommendation", "ai_audit_log", "workflow_rule", "approval_request", "dashboard_widget"], managerActions),
      objectPermissionsFor(["lead", "account", "contact", "opportunity", "support_ticket", "customer_success_plan"], readActions)
    ),
    fieldPermissions: buildFieldPermissions({
      readOnly: ["lead", "account", "contact", "opportunity", "support_ticket", "customer_success_plan", "dashboard"],
      hidden: commercialSensitiveFields,
      extra: aiGovernanceFields
    }),
    recordScopes: ["business_unit_records", "all_records"],
    specialActions: ["run_ai_assistant", "approve_ai_action", "publish_configuration"],
    dashboards: ["ai-governance", "ai-risk", "ai-feedback"],
    securityNotes: ["AI Governance users see AI logs, prompts, approvals, confidence scores, and feedback."],
    sensitiveDataRules: ["Business data is context-only; commercial fields remain hidden unless separately approved."]
  },
  {
    personaKey: "data-quality-manager",
    label: "Data Quality Manager",
    roleTemplateSlug: "data-quality-manager",
    description: "Manages duplicate resolution, imports, exports, field hygiene, and data stewardship.",
    department: "operations",
    audience: "internal",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(["lead", "account", "contact", "opportunity", "campaign", "partner"], ["create", "read", "update", "delete", "export", "import", "assign"]),
      objectPermissionsFor(["workflow_rule", "dashboard_widget"], ["read", "update", "export"])
    ),
    fieldPermissions: buildFieldPermissions({
      editable: ["lead", "account", "contact", "opportunity", "campaign", "partner"],
      readOnly: ["support_ticket", "customer_success_plan", "approval_request", "dashboard"],
      hidden: commercialSensitiveFields
    }),
    recordScopes: ["all_records"],
    specialActions: ["merge_records", "publish_configuration", "run_ai_assistant"],
    dashboards: ["data-quality", "duplicate-risk", "import-health"],
    securityNotes: ["Can merge records and steward data but not approve discounts, legal terms, or AI actions."],
    sensitiveDataRules: ["Sensitive commercial fields are hidden during data-quality work."]
  },
  {
    personaKey: "executive-ceo-cxo",
    label: "Executive / CEO / CXO",
    roleTemplateSlug: "executive-ceo-cxo",
    description: "Consumes executive dashboards, summaries, drilldowns, and AI-assisted strategic insights.",
    department: "leadership",
    audience: "executive",
    objectPermissions: mergeObjectPermissions(
      objectPermissionsFor(["dashboard_widget"], readExportActions),
      objectPermissionsFor(["lead", "account", "contact", "opportunity", "campaign", "support_ticket", "customer_success_plan", "partner", "approval_request"], readExportActions)
    ),
    fieldPermissions: buildFieldPermissions({
      readOnly: ["lead", "account", "contact", "opportunity", "campaign", "support_ticket", "customer_success_plan", "partner", "approval_request"],
      visible: ["dashboard"],
      hidden: commercialSensitiveFields,
      masked: contactMaskedFields
    }),
    recordScopes: ["all_records"],
    specialActions: ["run_ai_assistant"],
    dashboards: ["executive-command-center", "revenue-summary", "customer-health-summary"],
    securityNotes: ["Executives see dashboards, summaries, and drilldowns based on configured permission scope."],
    sensitiveDataRules: ["No create/update/delete actions; sensitive commercial field export remains separate."]
  }
];

export const personaAccessRequiredPersonaKeys = defaultPersonaAccessInputs.map((input) => input.personaKey);
export const personaAccessRequiredRoleTemplateSlugs = defaultPersonaAccessInputs.map((input) => input.roleTemplateSlug);

function createPersonaDefinition(input: PersonaAccessInput): ConfigurationDefinition {
  return {
    definitionType: "persona",
    definitionKey: input.personaKey,
    name: input.label,
    description: input.description,
    isActive: true,
    definition: {
      personaKey: input.personaKey,
      roleTemplateSlug: input.roleTemplateSlug,
      label: input.label,
      description: input.description,
      department: input.department,
      audience: input.audience,
      objectPermissions: input.objectPermissions,
      fieldPermissions: input.fieldPermissions,
      recordScopes: input.recordScopes,
      specialActions: input.specialActions,
      dashboards: input.dashboards,
      securityNotes: input.securityNotes,
      metadata: personaAccessPhaseMetadata
    }
  };
}

function createAccessPolicyDefinition(input: PersonaAccessInput): ConfigurationDefinition {
  return {
    definitionType: "access_policy",
    definitionKey: `${input.personaKey}.access-policy`,
    name: `${input.label} Access Policy`,
    description: `Object, field, record-scope, and special-action permissions for ${input.label}.`,
    isActive: true,
    definition: {
      policyKey: `${input.personaKey}.access-policy`,
      personas: [input.personaKey],
      roleTemplateSlug: input.roleTemplateSlug,
      objectPermissions: input.objectPermissions,
      fieldPermissions: input.fieldPermissions,
      recordScopes: input.recordScopes,
      specialActions: input.specialActions,
      sensitiveDataRules: input.sensitiveDataRules,
      metadata: personaAccessPhaseMetadata
    }
  };
}

function objectPermissionActionsForLayout(input: PersonaAccessInput, objectKey: PersonaLayoutObjectKey) {
  return input.objectPermissions[objectKey] ?? (objectKey === "dashboard" ? input.objectPermissions.dashboard_widget : undefined);
}

function createRolePageLayoutDefinition(input: PersonaAccessInput, objectKey: PersonaLayoutObjectKey): ConfigurationDefinition {
  const objectActions = objectPermissionActionsForLayout(input, objectKey);
  const canRead = objectActions?.includes("read") ?? false;
  const baseFields = layoutFieldSets[objectKey];
  const configuredFieldPermissions = input.fieldPermissions[objectKey] ?? {};
  const hiddenFields = canRead
    ? Object.entries(configuredFieldPermissions)
        .filter(([, state]) => state === "hidden")
        .map(([field]) => field)
    : [...baseFields];
  const readOnlyFields = Object.entries(configuredFieldPermissions)
    .filter(([, state]) => state === "read_only" || state === "visible" || state === "masked")
    .map(([field]) => field);
  const visibleFields = canRead ? baseFields.filter((field) => !hiddenFields.includes(field)) : ["accessRestricted"];
  const summaryFields = visibleFields.slice(0, Math.max(1, Math.ceil(visibleFields.length / 2)));
  const contextFields = visibleFields.slice(summaryFields.length);

  return {
    definitionType: "page_layout",
    definitionKey: `${input.personaKey}.${objectKey}.layout`,
    name: `${input.label} ${layoutObjectLabels[objectKey]} Layout`,
    description: `Role-based ${layoutObjectLabels[objectKey]} page layout for ${input.label}.`,
    isActive: true,
    definition: {
      object: objectKey,
      role: input.roleTemplateSlug,
      sections: [
        {
          id: canRead ? "summary" : "restricted",
          title: canRead ? `${layoutObjectLabels[objectKey]} Summary` : "Restricted",
          fields: summaryFields
        },
        ...(canRead && contextFields.length > 0
          ? [
              {
                id: "context",
                title: `${layoutObjectLabels[objectKey]} Context`,
                fields: contextFields
              }
            ]
          : [])
      ],
      readOnlyFields,
      hiddenFields,
      requiredFields: canRead ? summaryFields.slice(0, 2) : [],
      metadata: {
        ...personaAccessPhaseMetadata,
        personaKey: input.personaKey,
        accessPolicyKey: `${input.personaKey}.access-policy`,
        layoutPurpose: "persona_role_based_page_layout",
        recordScopes: input.recordScopes,
        access: canRead ? "configured" : "restricted"
      }
    }
  };
}

export const defaultPersonaDefinitions: ConfigurationDefinition[] = defaultPersonaAccessInputs.map(createPersonaDefinition);

export const defaultPersonaAccessPolicyDefinitions: ConfigurationDefinition[] =
  defaultPersonaAccessInputs.map(createAccessPolicyDefinition);

export const defaultPersonaRolePageLayoutDefinitions: ConfigurationDefinition[] = defaultPersonaAccessInputs.flatMap(
  (input) => personaLayoutObjectKeys.map((objectKey) => createRolePageLayoutDefinition(input, objectKey))
);

export const defaultPersonaAccessConfigurationDefinitions: ConfigurationDefinition[] = [
  ...defaultPersonaDefinitions,
  ...defaultPersonaAccessPolicyDefinitions,
  ...defaultPersonaRolePageLayoutDefinitions
];
