import type { PermissionModuleKey } from "./rbac.js";
import { permissionModuleLabels } from "./rbac.js";

export const tenantThemeModes = ["light", "dark"] as const;
export type TenantThemeMode = (typeof tenantThemeModes)[number];

export const tenantSidebarStyles = ["glass", "solid", "contrast"] as const;
export type TenantSidebarStyle = (typeof tenantSidebarStyles)[number];

export const tenantCardStyles = ["glass", "solid", "outline"] as const;
export type TenantCardStyle = (typeof tenantCardStyles)[number];

export const tenantFontPreferences = ["modern", "classic", "system"] as const;
export type TenantFontPreference = (typeof tenantFontPreferences)[number];

export const tenantDensityPreferences = ["comfortable", "compact"] as const;
export type TenantDensityPreference = (typeof tenantDensityPreferences)[number];

export interface TenantSummary {
  id: string;
  slug: string;
  name: string;
}

export interface TenantCoreSettings {
  workspaceName: string;
  timezone: string;
  locale: string;
  currency: string;
  dateFormat: string;
  timeFormat: "12h" | "24h";
}

export interface TenantThemeSettings {
  logo: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  mode: TenantThemeMode;
  sidebarStyle: TenantSidebarStyle;
  cardStyle: TenantCardStyle;
  fontPreference: TenantFontPreference;
  density: TenantDensityPreference;
}

export interface TenantModuleDefinition {
  moduleKey: PermissionModuleKey;
  label: string;
  description: string;
  defaultEnabled: boolean;
  locked: boolean;
}

export interface TenantModuleState extends TenantModuleDefinition {
  enabled: boolean;
}

export interface TenantTerminologyEntry {
  moduleKey: PermissionModuleKey;
  singular: string;
  plural: string;
  description: string | null;
}

export const customFieldDataTypes = [
  "text",
  "textarea",
  "number",
  "date",
  "datetime",
  "email",
  "phone",
  "url",
  "select",
  "multiselect",
  "boolean"
] as const;
export type CustomFieldDataType = (typeof customFieldDataTypes)[number];

export interface CustomFieldDefinition {
  id: string;
  tenantId: string;
  moduleKey: PermissionModuleKey;
  entityKey: string;
  fieldKey: string;
  label: string;
  description: string | null;
  dataType: CustomFieldDataType;
  placeholder: string | null;
  optionSetKey: string | null;
  isRequired: boolean;
  isActive: boolean;
  isSystemField: boolean;
  sortOrder: number;
  settings: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomFieldRequestBody {
  moduleKey: PermissionModuleKey;
  entityKey: string;
  fieldKey?: string;
  label: string;
  description?: string;
  dataType: CustomFieldDataType;
  placeholder?: string;
  optionSetKey?: string | null;
  isRequired?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  settings?: Record<string, unknown>;
}

export interface UpdateCustomFieldRequestBody {
  label?: string;
  description?: string | null;
  placeholder?: string | null;
  optionSetKey?: string | null;
  isRequired?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  settings?: Record<string, unknown>;
}

export interface CustomFieldResponse {
  field: CustomFieldDefinition;
}

export interface CustomFieldsResponse {
  fields: CustomFieldDefinition[];
}

export interface FormLayoutSectionDefinition {
  id: string;
  title: string;
  fields: string[];
}

export interface CustomFormLayoutDefinition {
  id: string;
  tenantId: string;
  moduleKey: PermissionModuleKey;
  entityKey: string;
  layoutKey: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isSystemLayout: boolean;
  layoutSchema: {
    sections: FormLayoutSectionDefinition[];
    [key: string]: unknown;
  };
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CustomFormLayoutsResponse {
  layouts: CustomFormLayoutDefinition[];
}

export const tenantOptionSetKinds = [
  "dropdown",
  "pipeline",
  "ticket_status",
  "customer_success_stage"
] as const;
export type TenantOptionSetKind = (typeof tenantOptionSetKinds)[number];

export interface TenantOptionValue {
  id: string;
  key: string;
  label: string;
  description: string | null;
  color: string | null;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
  metadata: Record<string, unknown>;
}

export interface TenantOptionSet {
  id: string;
  tenantId: string;
  setKey: string;
  moduleKey: PermissionModuleKey | null;
  kind: TenantOptionSetKind;
  name: string;
  description: string | null;
  isSystemSet: boolean;
  isActive: boolean;
  metadata: Record<string, unknown>;
  values: TenantOptionValue[];
  createdAt: string;
  updatedAt: string;
}

export interface ReplaceTenantOptionSetRequestBody {
  name: string;
  description?: string | null;
  moduleKey?: PermissionModuleKey | null;
  kind: TenantOptionSetKind;
  options: Array<{
    key: string;
    label: string;
    description?: string | null;
    color?: string | null;
    sortOrder?: number;
    isDefault?: boolean;
    isActive?: boolean;
    metadata?: Record<string, unknown>;
  }>;
}

export interface TenantOptionSetResponse {
  optionSet: TenantOptionSet;
}

export interface TenantOptionSetsResponse {
  optionSets: TenantOptionSet[];
}

export interface TenantConfigurationSummary {
  optionSetCount: number;
  pipelineCount: number;
  ticketStatusCount: number;
  customerSuccessStageCount: number;
  customFieldCount: number;
  formLayoutCount: number;
}

export interface TenantConfigurationBootstrapResponse {
  tenant: TenantSummary;
  settings: TenantCoreSettings;
  theme: TenantThemeSettings;
  modules: TenantModuleState[];
  terminology: TenantTerminologyEntry[];
  summary: TenantConfigurationSummary;
}

export interface TenantCoreSettingsResponse {
  settings: TenantCoreSettings;
}

export interface TenantThemeResponse {
  theme: TenantThemeSettings;
}

export interface TenantModulesResponse {
  modules: TenantModuleState[];
}

export interface TenantTerminologyResponse {
  terminology: TenantTerminologyEntry[];
}

export const defaultTenantCoreSettings: TenantCoreSettings = {
  workspaceName: "Sample Tenant Workspace",
  timezone: "UTC",
  locale: "en-US",
  currency: "USD",
  dateFormat: "MMM d, yyyy",
  timeFormat: "12h"
};

export const defaultTenantThemeSettings: TenantThemeSettings = {
  logo: null,
  primaryColor: "#f97316",
  secondaryColor: "#bae6fd",
  accentColor: "#14b8a6",
  mode: "light",
  sidebarStyle: "glass",
  cardStyle: "glass",
  fontPreference: "modern",
  density: "comfortable"
};

export const tenantModuleDefinitions: TenantModuleDefinition[] = [
  {
    moduleKey: "dashboards",
    label: permissionModuleLabels.dashboards,
    description: "Operational scorecards, readiness highlights, and tenant-level reporting.",
    defaultEnabled: true,
    locked: false
  },
  {
    moduleKey: "admin",
    label: permissionModuleLabels.admin,
    description: "Tenant governance, security controls, roles, and configuration surfaces.",
    defaultEnabled: true,
    locked: true
  },
  {
    moduleKey: "leads",
    label: permissionModuleLabels.leads,
    description: "Lead intake, qualification, ownership, and SDR handoff readiness.",
    defaultEnabled: true,
    locked: false
  },
  {
    moduleKey: "accounts",
    label: permissionModuleLabels.accounts,
    description: "Shared customer records, account context, and lifecycle views.",
    defaultEnabled: true,
    locked: false
  },
  {
    moduleKey: "contacts",
    label: permissionModuleLabels.contacts,
    description: "Stakeholder records, contact roles, and relationship context.",
    defaultEnabled: true,
    locked: false
  },
  {
    moduleKey: "opportunities",
    label: permissionModuleLabels.opportunities,
    description: "Revenue pipeline stages, deal collaboration, and forecasting foundations.",
    defaultEnabled: true,
    locked: false
  },
  {
    moduleKey: "campaigns",
    label: permissionModuleLabels.campaigns,
    description: "Campaign planning, execution, and attribution readiness.",
    defaultEnabled: true,
    locked: false
  },
  {
    moduleKey: "social",
    label: permissionModuleLabels.social,
    description: "Social media calendars, publishing workflows, and channel operations.",
    defaultEnabled: true,
    locked: false
  },
  {
    moduleKey: "marketing",
    label: permissionModuleLabels.marketing,
    description: "Marketing operations, segmentation, and campaign governance.",
    defaultEnabled: true,
    locked: false
  },
  {
    moduleKey: "sales",
    label: permissionModuleLabels.sales,
    description: "Sales execution views, quota-facing workflows, and manager reporting.",
    defaultEnabled: true,
    locked: false
  },
  {
    moduleKey: "business_development",
    label: permissionModuleLabels.business_development,
    description: "Strategic account targeting, relationship mapping, and BD pipeline development.",
    defaultEnabled: true,
    locked: false
  },
  {
    moduleKey: "presales",
    label: permissionModuleLabels.presales,
    description: "Technical discovery, solution validation, and presales collaboration.",
    defaultEnabled: true,
    locked: false
  },
  {
    moduleKey: "partners",
    label: permissionModuleLabels.partners,
    description: "Partner lifecycle, collaboration, and sourced-revenue support.",
    defaultEnabled: true,
    locked: false
  },
  {
    moduleKey: "resellers",
    label: permissionModuleLabels.resellers,
    description: "Reseller programs, enablement, and co-sell support.",
    defaultEnabled: true,
    locked: false
  },
  {
    moduleKey: "support",
    label: permissionModuleLabels.support,
    description: "Ticket queues, SLAs, escalation, and service response foundations.",
    defaultEnabled: true,
    locked: false
  },
  {
    moduleKey: "customer_success",
    label: permissionModuleLabels.customer_success,
    description: "Onboarding, health reviews, renewals, and retention planning.",
    defaultEnabled: true,
    locked: false
  },
  {
    moduleKey: "training",
    label: permissionModuleLabels.training,
    description: "Customer enablement, training programs, and completion tracking.",
    defaultEnabled: true,
    locked: false
  },
  {
    moduleKey: "customer_query",
    label: permissionModuleLabels.customer_query,
    description: "Customer question intake, guided responses, and AI-assist routing.",
    defaultEnabled: true,
    locked: false
  },
  {
    moduleKey: "notifications",
    label: permissionModuleLabels.notifications,
    description: "In-app alerts, notification preferences, and role-aware delivery routing.",
    defaultEnabled: true,
    locked: false
  },
  {
    moduleKey: "approvals",
    label: permissionModuleLabels.approvals,
    description: "Approval inboxes, decision history, and linked approval workflows.",
    defaultEnabled: true,
    locked: false
  },
  {
    moduleKey: "workflows",
    label: permissionModuleLabels.workflows,
    description: "Automation policies, workflow stages, and approval routing.",
    defaultEnabled: true,
    locked: false
  },
  {
    moduleKey: "ai",
    label: permissionModuleLabels.ai,
    description: "Governed AI usage, prompt orchestration, and tenant AI controls.",
    defaultEnabled: true,
    locked: false
  }
];

export const defaultTenantTerminologyEntries: TenantTerminologyEntry[] = [
  {
    moduleKey: "leads",
    singular: "Lead",
    plural: "Leads",
    description: "Inbound or outbound prospect records."
  },
  {
    moduleKey: "accounts",
    singular: "Account",
    plural: "Accounts",
    description: "Customer or company-level records."
  },
  {
    moduleKey: "contacts",
    singular: "Contact",
    plural: "Contacts",
    description: "Individual stakeholders connected to accounts."
  },
  {
    moduleKey: "opportunities",
    singular: "Opportunity",
    plural: "Opportunities",
    description: "Revenue pipeline records."
  },
  {
    moduleKey: "campaigns",
    singular: "Campaign",
    plural: "Campaigns",
    description: "Marketing initiatives and coordinated outreach."
  },
  {
    moduleKey: "social",
    singular: "Social Post",
    plural: "Social",
    description: "Social media planning, scheduling, and approval workflows."
  },
  {
    moduleKey: "support",
    singular: "Ticket",
    plural: "Support",
    description: "Customer service cases and support work."
  },
  {
    moduleKey: "customer_success",
    singular: "Success Stage",
    plural: "Customer Success",
    description: "Post-sales lifecycle programs and retention work."
  },
  {
    moduleKey: "dashboards",
    singular: "Dashboard",
    plural: "Dashboards",
    description: "Reporting and operational scorecards."
  },
  {
    moduleKey: "notifications",
    singular: "Notification",
    plural: "Notifications",
    description: "In-app alerts, reminders, and approval signals."
  },
  {
    moduleKey: "approvals",
    singular: "Approval Request",
    plural: "Approvals",
    description: "Approval inbox records, decisions, and approval history."
  },
  {
    moduleKey: "admin",
    singular: "Admin Setting",
    plural: "Admin",
    description: "Tenant governance and configuration controls."
  },
  {
    moduleKey: "ai",
    singular: "AI Assistant",
    plural: "AI Assistant",
    description: "AI-guided workflows and governance surfaces."
  }
];

export interface TenantOptionSetSeedDefinition {
  setKey: string;
  moduleKey: PermissionModuleKey;
  kind: TenantOptionSetKind;
  name: string;
  description: string;
  values: Array<{
    key: string;
    label: string;
    description?: string;
    color?: string;
    sortOrder: number;
    isDefault?: boolean;
    isActive?: boolean;
    metadata?: Record<string, unknown>;
  }>;
  metadata?: Record<string, unknown>;
}

export const defaultTenantOptionSetDefinitions: TenantOptionSetSeedDefinition[] = [
  {
    setKey: "lead-status",
    moduleKey: "leads",
    kind: "dropdown",
    name: "Lead Status",
    description: "Default lead lifecycle states for qualification and handoff.",
    values: [
      { key: "new", label: "New", color: "#f97316", sortOrder: 0, isDefault: true },
      { key: "working", label: "Working", color: "#0ea5e9", sortOrder: 1 },
      { key: "qualified", label: "Qualified", color: "#14b8a6", sortOrder: 2 },
      { key: "nurturing", label: "Nurturing", color: "#a855f7", sortOrder: 3 },
      { key: "disqualified", label: "Disqualified", color: "#ef4444", sortOrder: 4 }
    ],
    metadata: {
      seeded: true,
      category: "lead-config"
    }
  },
  {
    setKey: "lead-source",
    moduleKey: "leads",
    kind: "dropdown",
    name: "Lead Source",
    description: "Default intake channels for early CRM rollout.",
    values: [
      { key: "website", label: "Website", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "campaign", label: "Campaign", color: "#14b8a6", sortOrder: 1 },
      { key: "partner", label: "Partner", color: "#f59e0b", sortOrder: 2 },
      { key: "referral", label: "Referral", color: "#8b5cf6", sortOrder: 3 },
      { key: "outbound", label: "Outbound", color: "#ef4444", sortOrder: 4 }
    ],
    metadata: {
      seeded: true,
      category: "lead-config"
    }
  },
  {
    setKey: "lead-outreach-status",
    moduleKey: "leads",
    kind: "dropdown",
    name: "Lead Outreach Status",
    description: "Default outreach states for SDR and inside-sales execution.",
    values: [
      { key: "not_started", label: "Not Started", color: "#64748b", sortOrder: 0, isDefault: true },
      { key: "researching", label: "Researching", color: "#0ea5e9", sortOrder: 1 },
      { key: "attempting_contact", label: "Attempting Contact", color: "#06b6d4", sortOrder: 2 },
      { key: "in_sequence", label: "In Sequence", color: "#8b5cf6", sortOrder: 3 },
      { key: "responded", label: "Responded", color: "#22c55e", sortOrder: 4 },
      { key: "meeting_booked", label: "Meeting Booked", color: "#14b8a6", sortOrder: 5 },
      { key: "nurture", label: "Nurture", color: "#f59e0b", sortOrder: 6 }
    ],
    metadata: {
      seeded: true,
      category: "lead-workspace"
    }
  },
  {
    setKey: "lead-handoff-status",
    moduleKey: "leads",
    kind: "dropdown",
    name: "Lead Handoff Status",
    description: "Default handoff workflow states between SDR, inside sales, and sales.",
    values: [
      { key: "not_ready", label: "Not Ready", color: "#64748b", sortOrder: 0, isDefault: true },
      { key: "qualifying", label: "Qualifying", color: "#0ea5e9", sortOrder: 1 },
      { key: "sales_ready", label: "Sales Ready", color: "#22c55e", sortOrder: 2 },
      { key: "handed_to_sales", label: "Handed to Sales", color: "#14b8a6", sortOrder: 3 },
      { key: "accepted_by_sales", label: "Accepted by Sales", color: "#8b5cf6", sortOrder: 4 },
      { key: "disqualified", label: "Disqualified", color: "#ef4444", sortOrder: 5 }
    ],
    metadata: {
      seeded: true,
      category: "lead-workflow"
    }
  },
  {
    setKey: "lead-call-disposition",
    moduleKey: "leads",
    kind: "dropdown",
    name: "Lead Call Disposition",
    description: "Default call outcomes for SDR and inside-sales call logging.",
    values: [
      { key: "pending", label: "Pending", color: "#64748b", sortOrder: 0, isDefault: true },
      { key: "connected", label: "Connected", color: "#22c55e", sortOrder: 1 },
      { key: "voicemail", label: "Voicemail", color: "#0ea5e9", sortOrder: 2 },
      { key: "no_answer", label: "No Answer", color: "#f59e0b", sortOrder: 3 },
      { key: "follow_up_needed", label: "Follow-up Needed", color: "#8b5cf6", sortOrder: 4 },
      { key: "meeting_booked", label: "Meeting Booked", color: "#14b8a6", sortOrder: 5 },
      { key: "not_interested", label: "Not Interested", color: "#ef4444", sortOrder: 6 },
      { key: "disqualified", label: "Disqualified", color: "#b91c1c", sortOrder: 7 }
    ],
    metadata: {
      seeded: true,
      category: "lead-workflow"
    }
  },
  {
    setKey: "account-type",
    moduleKey: "accounts",
    kind: "dropdown",
    name: "Account Type",
    description: "Default account classifications for the CRM foundation.",
    values: [
      { key: "prospect", label: "Prospect", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "customer", label: "Customer", color: "#14b8a6", sortOrder: 1 },
      { key: "partner", label: "Partner", color: "#8b5cf6", sortOrder: 2 },
      { key: "vendor", label: "Vendor", color: "#f59e0b", sortOrder: 3 }
    ],
    metadata: {
      seeded: true,
      category: "account-config"
    }
  },
  {
    setKey: "account-health",
    moduleKey: "accounts",
    kind: "dropdown",
    name: "Account Health",
    description: "Placeholder health classifications for future customer signals.",
    values: [
      { key: "healthy", label: "Healthy", color: "#22c55e", sortOrder: 0, isDefault: true },
      { key: "monitor", label: "Monitor", color: "#f59e0b", sortOrder: 1 },
      { key: "at_risk", label: "At Risk", color: "#ef4444", sortOrder: 2 }
    ],
    metadata: {
      seeded: true,
      category: "account-config"
    }
  },
  {
    setKey: "contact-role",
    moduleKey: "contacts",
    kind: "dropdown",
    name: "Contact Role",
    description: "Default contact relationship roles for account mapping.",
    values: [
      { key: "decision_maker", label: "Decision Maker", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "champion", label: "Champion", color: "#14b8a6", sortOrder: 1 },
      { key: "influencer", label: "Influencer", color: "#8b5cf6", sortOrder: 2 },
      { key: "evaluator", label: "Evaluator", color: "#f59e0b", sortOrder: 3 },
      { key: "billing", label: "Billing", color: "#64748b", sortOrder: 4 }
    ],
    metadata: {
      seeded: true,
      category: "contact-config"
    }
  },
  {
    setKey: "campaign-type",
    moduleKey: "campaigns",
    kind: "dropdown",
    name: "Campaign Type",
    description: "Default campaign program types for the marketing foundation.",
    values: [
      { key: "email", label: "Email Campaign", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "social", label: "Social Campaign", color: "#14b8a6", sortOrder: 1 },
      { key: "whatsapp", label: "WhatsApp Campaign", color: "#22c55e", sortOrder: 2 },
      { key: "sms", label: "SMS Campaign", color: "#f59e0b", sortOrder: 3 },
      { key: "event", label: "Event Campaign", color: "#8b5cf6", sortOrder: 4 },
      { key: "webinar", label: "Webinar Campaign", color: "#06b6d4", sortOrder: 5 },
      { key: "lead_generation", label: "Lead Generation Campaign", color: "#ef4444", sortOrder: 6 },
      { key: "product_launch", label: "Product Launch Campaign", color: "#f97316", sortOrder: 7 },
      { key: "partner", label: "Partner Campaign", color: "#6366f1", sortOrder: 8 },
      { key: "reseller", label: "Reseller Campaign", color: "#64748b", sortOrder: 9 },
      { key: "customer_retention", label: "Customer Retention Campaign", color: "#84cc16", sortOrder: 10 },
      { key: "adoption", label: "Adoption Campaign", color: "#0f766e", sortOrder: 11 },
      { key: "renewal", label: "Renewal Campaign", color: "#b45309", sortOrder: 12 }
    ],
    metadata: {
      seeded: true,
      category: "campaign-config"
    }
  },
  {
    setKey: "campaign-objective",
    moduleKey: "campaigns",
    kind: "dropdown",
    name: "Campaign Objective",
    description: "Default objectives used to frame campaign planning and reporting.",
    values: [
      { key: "awareness", label: "Brand Awareness", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "lead_generation", label: "Lead Generation", color: "#14b8a6", sortOrder: 1 },
      { key: "pipeline_acceleration", label: "Pipeline Acceleration", color: "#8b5cf6", sortOrder: 2 },
      { key: "product_launch", label: "Product Launch", color: "#f97316", sortOrder: 3 },
      { key: "event_attendance", label: "Event Attendance", color: "#f59e0b", sortOrder: 4 },
      { key: "customer_adoption", label: "Customer Adoption", color: "#0f766e", sortOrder: 5 },
      { key: "retention", label: "Customer Retention", color: "#84cc16", sortOrder: 6 },
      { key: "renewal", label: "Renewal Support", color: "#b45309", sortOrder: 7 },
      { key: "partner_enablement", label: "Partner Enablement", color: "#6366f1", sortOrder: 8 },
      { key: "reseller_enablement", label: "Reseller Enablement", color: "#64748b", sortOrder: 9 }
    ],
    metadata: {
      seeded: true,
      category: "campaign-config"
    }
  },
  {
    setKey: "campaign-status",
    moduleKey: "campaigns",
    kind: "dropdown",
    name: "Campaign Status",
    description: "Default operating states for campaign planning and execution.",
    values: [
      { key: "draft", label: "Draft", color: "#64748b", sortOrder: 0, isDefault: true },
      { key: "planned", label: "Planned", color: "#0ea5e9", sortOrder: 1 },
      { key: "active", label: "Active", color: "#22c55e", sortOrder: 2 },
      { key: "paused", label: "Paused", color: "#f59e0b", sortOrder: 3 },
      { key: "completed", label: "Completed", color: "#14b8a6", sortOrder: 4 },
      { key: "archived", label: "Archived", color: "#475569", sortOrder: 5 }
    ],
    metadata: {
      seeded: true,
      category: "campaign-config"
    }
  },
  {
    setKey: "campaign-channel",
    moduleKey: "campaigns",
    kind: "dropdown",
    name: "Campaign Channel",
    description: "Default delivery channels for campaign execution and reporting.",
    values: [
      { key: "email", label: "Email", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "social", label: "Social", color: "#14b8a6", sortOrder: 1 },
      { key: "whatsapp", label: "WhatsApp", color: "#22c55e", sortOrder: 2 },
      { key: "sms", label: "SMS", color: "#f59e0b", sortOrder: 3 },
      { key: "event", label: "Event", color: "#8b5cf6", sortOrder: 4 },
      { key: "webinar", label: "Webinar", color: "#06b6d4", sortOrder: 5 },
      { key: "partner", label: "Partner", color: "#6366f1", sortOrder: 6 },
      { key: "reseller", label: "Reseller", color: "#64748b", sortOrder: 7 },
      { key: "multi_channel", label: "Multi-channel", color: "#f97316", sortOrder: 8 }
    ],
    metadata: {
      seeded: true,
      category: "campaign-config"
    }
  },
  {
    setKey: "campaign-member-status",
    moduleKey: "campaigns",
    kind: "dropdown",
    name: "Campaign Member Status",
    description: "Default outreach states for leads, contacts, and accounts added to campaigns.",
    values: [
      { key: "planned", label: "Planned", color: "#64748b", sortOrder: 0, isDefault: true },
      { key: "queued", label: "Queued", color: "#0ea5e9", sortOrder: 1 },
      { key: "contacted", label: "Contacted", color: "#14b8a6", sortOrder: 2 },
      { key: "engaged", label: "Engaged", color: "#22c55e", sortOrder: 3 },
      { key: "responded", label: "Responded", color: "#8b5cf6", sortOrder: 4 },
      { key: "opted_out", label: "Opted Out", color: "#ef4444", sortOrder: 5 }
    ],
    metadata: {
      seeded: true,
      category: "campaign-config"
    }
  },
  {
    setKey: "social-channel",
    moduleKey: "social",
    kind: "dropdown",
    name: "Social Channel",
    description: "Default publishing channels for social content planning and scheduling.",
    values: [
      { key: "linkedin", label: "LinkedIn", color: "#0a66c2", sortOrder: 0, isDefault: true },
      { key: "instagram", label: "Instagram", color: "#e1306c", sortOrder: 1 },
      { key: "facebook", label: "Facebook", color: "#1877f2", sortOrder: 2 },
      { key: "x", label: "X", color: "#0f172a", sortOrder: 3 },
      { key: "youtube", label: "YouTube", color: "#ff0033", sortOrder: 4 },
      { key: "threads", label: "Threads", color: "#111827", sortOrder: 5 },
      { key: "tiktok", label: "TikTok", color: "#14b8a6", sortOrder: 6 }
    ],
    metadata: {
      seeded: true,
      category: "social-config"
    }
  },
  {
    setKey: "social-post-status",
    moduleKey: "social",
    kind: "dropdown",
    name: "Social Post Status",
    description: "Default lifecycle states for social post planning and publishing readiness.",
    values: [
      { key: "draft", label: "Draft", color: "#64748b", sortOrder: 0, isDefault: true },
      { key: "planned", label: "Planned", color: "#0ea5e9", sortOrder: 1 },
      { key: "scheduled", label: "Scheduled", color: "#14b8a6", sortOrder: 2 },
      { key: "published", label: "Published", color: "#22c55e", sortOrder: 3 },
      { key: "paused", label: "Paused", color: "#f59e0b", sortOrder: 4 },
      { key: "archived", label: "Archived", color: "#475569", sortOrder: 5 }
    ],
    metadata: {
      seeded: true,
      category: "social-config"
    }
  },
  {
    setKey: "social-approval-status",
    moduleKey: "social",
    kind: "dropdown",
    name: "Social Approval Status",
    description: "Default approval workflow states for social content review and publishing controls.",
    values: [
      { key: "not_submitted", label: "Not Submitted", color: "#64748b", sortOrder: 0, isDefault: true },
      { key: "pending_review", label: "Pending Review", color: "#0ea5e9", sortOrder: 1 },
      { key: "approved", label: "Approved", color: "#22c55e", sortOrder: 2 },
      { key: "changes_requested", label: "Changes Requested", color: "#f59e0b", sortOrder: 3 },
      { key: "rejected", label: "Rejected", color: "#ef4444", sortOrder: 4 }
    ],
    metadata: {
      seeded: true,
      category: "social-config"
    }
  },
  {
    setKey: "opportunity-source",
    moduleKey: "opportunities",
    kind: "dropdown",
    name: "Opportunity Source",
    description: "Default source attribution values for opportunity creation and pipeline reporting.",
    values: [
      { key: "inbound", label: "Inbound", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "outbound", label: "Outbound", color: "#14b8a6", sortOrder: 1 },
      { key: "referral", label: "Referral", color: "#22c55e", sortOrder: 2 },
      { key: "campaign", label: "Campaign", color: "#8b5cf6", sortOrder: 3 },
      { key: "partner", label: "Partner", color: "#6366f1", sortOrder: 4 },
      { key: "reseller", label: "Reseller", color: "#64748b", sortOrder: 5 },
      { key: "renewal", label: "Renewal", color: "#b45309", sortOrder: 6 },
      { key: "expansion", label: "Expansion", color: "#f97316", sortOrder: 7 }
    ],
    metadata: {
      seeded: true,
      category: "pipeline"
    }
  },
  {
    setKey: "opportunity-outcome-status",
    moduleKey: "opportunities",
    kind: "dropdown",
    name: "Opportunity Outcome Status",
    description: "Default commercial outcome states for open, won, and lost opportunities.",
    values: [
      { key: "open", label: "Open", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "won", label: "Won", color: "#22c55e", sortOrder: 1 },
      { key: "lost", label: "Lost", color: "#ef4444", sortOrder: 2 }
    ],
    metadata: {
      seeded: true,
      category: "pipeline"
    }
  },
  {
    setKey: "opportunity-pipeline",
    moduleKey: "opportunities",
    kind: "pipeline",
    name: "Opportunity Pipeline",
    description: "Default sales pipeline stages for opportunity progression.",
    values: [
      { key: "discovery", label: "Discovery", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "qualification", label: "Qualification", color: "#06b6d4", sortOrder: 1 },
      { key: "proposal", label: "Proposal", color: "#f59e0b", sortOrder: 2 },
      { key: "negotiation", label: "Negotiation", color: "#8b5cf6", sortOrder: 3 },
      { key: "closed_won", label: "Closed Won", color: "#22c55e", sortOrder: 4 },
      { key: "closed_lost", label: "Closed Lost", color: "#ef4444", sortOrder: 5 }
    ],
    metadata: {
      seeded: true,
      category: "pipeline"
    }
  },
  {
    setKey: "support-ticket-status",
    moduleKey: "support",
    kind: "ticket_status",
    name: "Support Ticket Status",
    description: "Default ticket states for service operations.",
    values: [
      { key: "new", label: "New", color: "#f97316", sortOrder: 0, isDefault: true },
      { key: "in_progress", label: "In Progress", color: "#0ea5e9", sortOrder: 1 },
      { key: "waiting_on_customer", label: "Waiting on Customer", color: "#f59e0b", sortOrder: 2 },
      { key: "resolved", label: "Resolved", color: "#22c55e", sortOrder: 3 },
      { key: "closed", label: "Closed", color: "#64748b", sortOrder: 4 }
    ],
    metadata: {
      seeded: true,
      category: "support"
    }
  },
  {
    setKey: "support-ticket-priority",
    moduleKey: "support",
    kind: "dropdown",
    name: "Support Ticket Priority",
    description: "Priority levels for support tickets and SLA targeting.",
    values: [
      { key: "low", label: "Low", color: "#64748b", sortOrder: 0 },
      { key: "medium", label: "Medium", color: "#0ea5e9", sortOrder: 1, isDefault: true },
      { key: "high", label: "High", color: "#f59e0b", sortOrder: 2 },
      { key: "urgent", label: "Urgent", color: "#ef4444", sortOrder: 3 }
    ],
    metadata: {
      seeded: true,
      category: "support"
    }
  },
  {
    setKey: "support-ticket-category",
    moduleKey: "support",
    kind: "dropdown",
    name: "Support Ticket Category",
    description: "Categories for triaging support tickets.",
    values: [
      { key: "technical", label: "Technical", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "billing", label: "Billing", color: "#8b5cf6", sortOrder: 1 },
      { key: "how_to", label: "How To", color: "#14b8a6", sortOrder: 2 },
      { key: "bug", label: "Bug", color: "#ef4444", sortOrder: 3 },
      { key: "feature_request", label: "Feature Request", color: "#f59e0b", sortOrder: 4 },
      { key: "other", label: "Other", color: "#64748b", sortOrder: 5 }
    ],
    metadata: {
      seeded: true,
      category: "support"
    }
  },
  {
    setKey: "support-ticket-source",
    moduleKey: "support",
    kind: "dropdown",
    name: "Support Ticket Source",
    description: "Intake channels for support tickets.",
    values: [
      { key: "email", label: "Email", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "portal", label: "Portal", color: "#14b8a6", sortOrder: 1 },
      { key: "phone", label: "Phone", color: "#f59e0b", sortOrder: 2 },
      { key: "chat", label: "Chat", color: "#8b5cf6", sortOrder: 3 },
      { key: "api", label: "API", color: "#64748b", sortOrder: 4 }
    ],
    metadata: {
      seeded: true,
      category: "support"
    }
  },
  {
    setKey: "support-knowledge-category",
    moduleKey: "support",
    kind: "dropdown",
    name: "Support Knowledge Category",
    description: "Categories for knowledge base articles.",
    values: [
      { key: "getting_started", label: "Getting Started", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "troubleshooting", label: "Troubleshooting", color: "#ef4444", sortOrder: 1 },
      { key: "billing", label: "Billing", color: "#8b5cf6", sortOrder: 2 },
      { key: "integrations", label: "Integrations", color: "#14b8a6", sortOrder: 3 },
      { key: "faq", label: "FAQ", color: "#64748b", sortOrder: 4 }
    ],
    metadata: {
      seeded: true,
      category: "support"
    }
  },
  {
    setKey: "customer-success-stage",
    moduleKey: "customer_success",
    kind: "customer_success_stage",
    name: "Customer Success Stage",
    description: "Default stages for onboarding, adoption, and renewal management.",
    values: [
      { key: "onboarding", label: "Onboarding", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "adoption", label: "Adoption", color: "#14b8a6", sortOrder: 1 },
      { key: "value_realization", label: "Value Realization", color: "#22c55e", sortOrder: 2 },
      { key: "renewal", label: "Renewal", color: "#f59e0b", sortOrder: 3 },
      { key: "advocacy", label: "Advocacy", color: "#8b5cf6", sortOrder: 4 }
    ],
    metadata: {
      seeded: true,
      category: "customer-success"
    }
  },
  {
    setKey: "cs-segment",
    moduleKey: "customer_success",
    kind: "dropdown",
    name: "Customer Success Segment",
    description: "Customer success segmentation for onboarding, scaled, and enterprise motions.",
    values: [
      { key: "onboarding", label: "Onboarding", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "scaled", label: "Scaled", color: "#14b8a6", sortOrder: 1 },
      { key: "enterprise", label: "Enterprise", color: "#8b5cf6", sortOrder: 2 }
    ],
    metadata: {
      seeded: true,
      category: "customer-success"
    }
  },
  {
    setKey: "cs-risk-status",
    moduleKey: "customer_success",
    kind: "dropdown",
    name: "Customer Success Risk Status",
    description: "Risk classification for customer success accounts.",
    values: [
      { key: "healthy", label: "Healthy", color: "#22c55e", sortOrder: 0, isDefault: true },
      { key: "watch", label: "Watch", color: "#f59e0b", sortOrder: 1 },
      { key: "at_risk", label: "At Risk", color: "#ef4444", sortOrder: 2 },
      { key: "critical", label: "Critical", color: "#b91c1c", sortOrder: 3 }
    ],
    metadata: {
      seeded: true,
      category: "customer-success"
    }
  },
  {
    setKey: "cs-expansion-potential",
    moduleKey: "customer_success",
    kind: "dropdown",
    name: "Customer Success Expansion Potential",
    description: "Expansion potential for customer success accounts.",
    values: [
      { key: "none", label: "None", color: "#64748b", sortOrder: 0 },
      { key: "low", label: "Low", color: "#0ea5e9", sortOrder: 1, isDefault: true },
      { key: "medium", label: "Medium", color: "#f59e0b", sortOrder: 2 },
      { key: "high", label: "High", color: "#22c55e", sortOrder: 3 }
    ],
    metadata: {
      seeded: true,
      category: "customer-success"
    }
  },
  {
    setKey: "cs-renewal-status",
    moduleKey: "customer_success",
    kind: "dropdown",
    name: "Customer Success Renewal Status",
    description: "Renewal lifecycle states for customer success accounts.",
    values: [
      { key: "not_started", label: "Not Started", color: "#64748b", sortOrder: 0, isDefault: true },
      { key: "in_progress", label: "In Progress", color: "#0ea5e9", sortOrder: 1 },
      { key: "forecasted", label: "Forecasted", color: "#06b6d4", sortOrder: 2 },
      { key: "committed", label: "Committed", color: "#8b5cf6", sortOrder: 3 },
      { key: "renewed", label: "Renewed", color: "#22c55e", sortOrder: 4 },
      { key: "churned", label: "Churned", color: "#ef4444", sortOrder: 5 }
    ],
    metadata: {
      seeded: true,
      category: "customer-success"
    }
  },
  {
    setKey: "training-category",
    moduleKey: "training",
    kind: "dropdown",
    name: "Training Category",
    description: "Categories for training programs.",
    values: [
      { key: "product", label: "Product", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "onboarding", label: "Onboarding", color: "#14b8a6", sortOrder: 1 },
      { key: "certification", label: "Certification", color: "#8b5cf6", sortOrder: 2 },
      { key: "compliance", label: "Compliance", color: "#f59e0b", sortOrder: 3 },
      { key: "role_based", label: "Role Based", color: "#6366f1", sortOrder: 4 }
    ],
    metadata: {
      seeded: true,
      category: "training"
    }
  },
  {
    setKey: "training-level",
    moduleKey: "training",
    kind: "dropdown",
    name: "Training Level",
    description: "Difficulty levels for training programs.",
    values: [
      { key: "beginner", label: "Beginner", color: "#22c55e", sortOrder: 0, isDefault: true },
      { key: "intermediate", label: "Intermediate", color: "#f59e0b", sortOrder: 1 },
      { key: "advanced", label: "Advanced", color: "#ef4444", sortOrder: 2 }
    ],
    metadata: {
      seeded: true,
      category: "training"
    }
  },
  {
    setKey: "bd-account-tier",
    moduleKey: "business_development",
    kind: "dropdown",
    name: "BD Account Tier",
    description: "Strategic tiering for business development target accounts.",
    values: [
      { key: "strategic", label: "Strategic", color: "#6366f1", sortOrder: 0, isDefault: true },
      { key: "growth", label: "Growth", color: "#0ea5e9", sortOrder: 1 },
      { key: "expansion", label: "Expansion", color: "#22c55e", sortOrder: 2 },
      { key: "watch", label: "Watch", color: "#f59e0b", sortOrder: 3 }
    ],
    metadata: {
      seeded: true,
      category: "business-development"
    }
  },
  {
    setKey: "bd-pipeline-stage",
    moduleKey: "business_development",
    kind: "pipeline",
    name: "BD Pipeline Stage",
    description: "Business development pipeline stages for target account progression.",
    values: [
      { key: "identified", label: "Identified", color: "#64748b", sortOrder: 0, isDefault: true },
      { key: "researching", label: "Researching", color: "#0ea5e9", sortOrder: 1 },
      { key: "engaged", label: "Engaged", color: "#06b6d4", sortOrder: 2 },
      { key: "qualified", label: "Qualified", color: "#8b5cf6", sortOrder: 3 },
      { key: "committed", label: "Committed", color: "#22c55e", sortOrder: 4 },
      { key: "on_hold", label: "On Hold", color: "#f59e0b", sortOrder: 5 }
    ],
    metadata: {
      seeded: true,
      category: "business-development"
    }
  },
  {
    setKey: "bd-partnership-type",
    moduleKey: "business_development",
    kind: "dropdown",
    name: "BD Partnership Type",
    description: "Partnership classifications for business development opportunity tracking.",
    values: [
      { key: "technology", label: "Technology", color: "#6366f1", sortOrder: 0, isDefault: true },
      { key: "channel", label: "Channel", color: "#0ea5e9", sortOrder: 1 },
      { key: "reseller", label: "Reseller", color: "#14b8a6", sortOrder: 2 },
      { key: "strategic_alliance", label: "Strategic Alliance", color: "#8b5cf6", sortOrder: 3 },
      { key: "oem", label: "OEM", color: "#f59e0b", sortOrder: 4 }
    ],
    metadata: {
      seeded: true,
      category: "business-development"
    }
  },
  {
    setKey: "presales-request-type",
    moduleKey: "presales",
    kind: "dropdown",
    name: "Presales Request Type",
    description: "Presales intake request types for demos, RFP/RFI, proposals, and validation.",
    values: [
      { key: "demo", label: "Demo", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "rfp", label: "RFP", color: "#8b5cf6", sortOrder: 1 },
      { key: "rfi", label: "RFI", color: "#6366f1", sortOrder: 2 },
      { key: "proposal", label: "Proposal", color: "#f59e0b", sortOrder: 3 },
      { key: "technical_validation", label: "Technical Validation", color: "#14b8a6", sortOrder: 4 },
      { key: "poc", label: "Proof of Concept", color: "#22c55e", sortOrder: 5 }
    ],
    metadata: {
      seeded: true,
      category: "presales"
    }
  },
  {
    setKey: "presales-request-status",
    moduleKey: "presales",
    kind: "dropdown",
    name: "Presales Request Status",
    description: "Lifecycle states for presales request intake and delivery.",
    values: [
      { key: "new", label: "New", color: "#f97316", sortOrder: 0, isDefault: true },
      { key: "in_review", label: "In Review", color: "#0ea5e9", sortOrder: 1 },
      { key: "in_progress", label: "In Progress", color: "#06b6d4", sortOrder: 2 },
      { key: "submitted", label: "Submitted", color: "#8b5cf6", sortOrder: 3 },
      { key: "won", label: "Won", color: "#22c55e", sortOrder: 4 },
      { key: "lost", label: "Lost", color: "#ef4444", sortOrder: 5 },
      { key: "cancelled", label: "Cancelled", color: "#64748b", sortOrder: 6 }
    ],
    metadata: {
      seeded: true,
      category: "presales"
    }
  },
  {
    setKey: "partner-type",
    moduleKey: "partners",
    kind: "dropdown",
    name: "Partner Type",
    description: "Partner classifications for channel partner management.",
    values: [
      { key: "reseller", label: "Reseller", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "referral", label: "Referral", color: "#14b8a6", sortOrder: 1 },
      { key: "system_integrator", label: "System Integrator", color: "#8b5cf6", sortOrder: 2 },
      { key: "technology", label: "Technology", color: "#6366f1", sortOrder: 3 },
      { key: "distributor", label: "Distributor", color: "#f59e0b", sortOrder: 4 }
    ],
    metadata: {
      seeded: true,
      category: "partners"
    }
  },
  {
    setKey: "partner-tier",
    moduleKey: "partners",
    kind: "dropdown",
    name: "Partner Tier",
    description: "Partner tiering for channel program levels.",
    values: [
      { key: "registered", label: "Registered", color: "#64748b", sortOrder: 0, isDefault: true },
      { key: "silver", label: "Silver", color: "#94a3b8", sortOrder: 1 },
      { key: "gold", label: "Gold", color: "#f59e0b", sortOrder: 2 },
      { key: "platinum", label: "Platinum", color: "#8b5cf6", sortOrder: 3 }
    ],
    metadata: {
      seeded: true,
      category: "partners"
    }
  },
  {
    setKey: "partner-status",
    moduleKey: "partners",
    kind: "dropdown",
    name: "Partner Status",
    description: "Lifecycle status for channel partners.",
    values: [
      { key: "prospect", label: "Prospect", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "active", label: "Active", color: "#22c55e", sortOrder: 1 },
      { key: "suspended", label: "Suspended", color: "#f59e0b", sortOrder: 2 },
      { key: "terminated", label: "Terminated", color: "#ef4444", sortOrder: 3 }
    ],
    metadata: {
      seeded: true,
      category: "partners"
    }
  },
  {
    setKey: "partner-onboarding-status",
    moduleKey: "partners",
    kind: "dropdown",
    name: "Partner Onboarding Status",
    description: "Onboarding progression states for channel partners.",
    values: [
      { key: "not_started", label: "Not Started", color: "#64748b", sortOrder: 0, isDefault: true },
      { key: "in_progress", label: "In Progress", color: "#0ea5e9", sortOrder: 1 },
      { key: "completed", label: "Completed", color: "#22c55e", sortOrder: 2 }
    ],
    metadata: {
      seeded: true,
      category: "partners"
    }
  },
  {
    setKey: "partner-deal-stage",
    moduleKey: "partners",
    kind: "pipeline",
    name: "Partner Deal Stage",
    description: "Deal registration stages for partner-sourced opportunities.",
    values: [
      { key: "registered", label: "Registered", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "approved", label: "Approved", color: "#06b6d4", sortOrder: 1 },
      { key: "in_progress", label: "In Progress", color: "#8b5cf6", sortOrder: 2 },
      { key: "won", label: "Won", color: "#22c55e", sortOrder: 3 },
      { key: "lost", label: "Lost", color: "#ef4444", sortOrder: 4 },
      { key: "rejected", label: "Rejected", color: "#b91c1c", sortOrder: 5 }
    ],
    metadata: {
      seeded: true,
      category: "partners"
    }
  },
  {
    setKey: "reseller-status",
    moduleKey: "resellers",
    kind: "dropdown",
    name: "Reseller Status",
    description: "Lifecycle status for resellers.",
    values: [
      { key: "prospect", label: "Prospect", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "active", label: "Active", color: "#22c55e", sortOrder: 1 },
      { key: "suspended", label: "Suspended", color: "#f59e0b", sortOrder: 2 },
      { key: "terminated", label: "Terminated", color: "#ef4444", sortOrder: 3 }
    ],
    metadata: {
      seeded: true,
      category: "resellers"
    }
  },
  {
    setKey: "reseller-pricing-tier",
    moduleKey: "resellers",
    kind: "dropdown",
    name: "Reseller Pricing Tier",
    description: "Pricing tiers governing reseller discount levels.",
    values: [
      { key: "standard", label: "Standard", color: "#64748b", sortOrder: 0, isDefault: true },
      { key: "preferred", label: "Preferred", color: "#0ea5e9", sortOrder: 1 },
      { key: "premier", label: "Premier", color: "#8b5cf6", sortOrder: 2 },
      { key: "strategic", label: "Strategic", color: "#22c55e", sortOrder: 3 }
    ],
    metadata: {
      seeded: true,
      category: "resellers"
    }
  },
  {
    setKey: "reseller-margin-profile",
    moduleKey: "resellers",
    kind: "dropdown",
    name: "Reseller Margin Profile",
    description: "Margin profiles describing reseller commercial arrangements.",
    values: [
      { key: "standard", label: "Standard", color: "#64748b", sortOrder: 0, isDefault: true },
      { key: "volume", label: "Volume", color: "#0ea5e9", sortOrder: 1 },
      { key: "strategic", label: "Strategic", color: "#8b5cf6", sortOrder: 2 },
      { key: "custom", label: "Custom", color: "#f59e0b", sortOrder: 3 }
    ],
    metadata: {
      seeded: true,
      category: "resellers"
    }
  },
  {
    setKey: "reseller-onboarding-status",
    moduleKey: "resellers",
    kind: "dropdown",
    name: "Reseller Onboarding Status",
    description: "Onboarding progression states for resellers.",
    values: [
      { key: "not_started", label: "Not Started", color: "#64748b", sortOrder: 0, isDefault: true },
      { key: "in_progress", label: "In Progress", color: "#0ea5e9", sortOrder: 1 },
      { key: "completed", label: "Completed", color: "#22c55e", sortOrder: 2 }
    ],
    metadata: {
      seeded: true,
      category: "resellers"
    }
  },
  {
    setKey: "reseller-deal-stage",
    moduleKey: "resellers",
    kind: "pipeline",
    name: "Reseller Deal Stage",
    description: "Deal registration stages for reseller-sourced opportunities.",
    values: [
      { key: "registered", label: "Registered", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "approved", label: "Approved", color: "#06b6d4", sortOrder: 1 },
      { key: "ordered", label: "Ordered", color: "#8b5cf6", sortOrder: 2 },
      { key: "won", label: "Won", color: "#22c55e", sortOrder: 3 },
      { key: "lost", label: "Lost", color: "#ef4444", sortOrder: 4 },
      { key: "rejected", label: "Rejected", color: "#b91c1c", sortOrder: 5 }
    ],
    metadata: {
      seeded: true,
      category: "resellers"
    }
  }
];

export interface CustomFormLayoutSeedDefinition {
  moduleKey: PermissionModuleKey;
  entityKey: string;
  layoutKey: string;
  name: string;
  description: string;
  layoutSchema: {
    sections: FormLayoutSectionDefinition[];
    [key: string]: unknown;
  };
  metadata?: Record<string, unknown>;
}

export const defaultCustomFormLayoutDefinitions: CustomFormLayoutSeedDefinition[] = [
  {
    moduleKey: "leads",
    entityKey: "lead",
    layoutKey: "default-lead-layout",
    name: "Default Lead Layout",
    description: "Primary layout scaffold for future lead create and detail forms.",
    layoutSchema: {
      sections: [
        {
          id: "lead-profile",
          title: "Lead Profile",
          fields: ["first_name", "last_name", "company_name", "email", "phone", "owner_id"]
        },
        {
          id: "lead-qualification",
          title: "Qualification",
          fields: ["status", "source", "score", "notes"]
        }
      ]
    },
    metadata: {
      seeded: true
    }
  },
  {
    moduleKey: "accounts",
    entityKey: "account",
    layoutKey: "default-account-layout",
    name: "Default Account Layout",
    description: "Primary layout scaffold for future account create and detail forms.",
    layoutSchema: {
      sections: [
        {
          id: "account-profile",
          title: "Account Profile",
          fields: ["name", "website", "industry", "owner_id", "account_type"]
        },
        {
          id: "account-relationships",
          title: "Relationships",
          fields: ["primary_contact_id", "health_status", "notes"]
        }
      ]
    },
    metadata: {
      seeded: true
    }
  },
  {
    moduleKey: "contacts",
    entityKey: "contact",
    layoutKey: "default-contact-layout",
    name: "Default Contact Layout",
    description: "Primary layout scaffold for future contact create and detail forms.",
    layoutSchema: {
      sections: [
        {
          id: "contact-profile",
          title: "Contact Profile",
          fields: ["first_name", "last_name", "email", "phone", "linkedin"]
        },
        {
          id: "contact-context",
          title: "Context",
          fields: ["account_id", "role", "owner_id", "notes"]
        }
      ]
    },
    metadata: {
      seeded: true
    }
  },
  {
    moduleKey: "opportunities",
    entityKey: "opportunity",
    layoutKey: "default-opportunity-layout",
    name: "Default Opportunity Layout",
    description: "Primary layout scaffold for opportunity creation, progression, and close management.",
    layoutSchema: {
      sections: [
        {
          id: "opportunity-commercial",
          title: "Commercial Context",
          fields: ["name", "account_id", "primary_contact_id", "owner_id", "source", "stage"]
        },
        {
          id: "opportunity-forecasting",
          title: "Pipeline and Forecasting",
          fields: ["amount", "probability", "expected_close_date", "next_step", "stakeholders"]
        },
        {
          id: "opportunity-closeout",
          title: "Competition and Closeout",
          fields: ["competitor", "outcome_status", "outcome_reason", "products_services_placeholder"]
        }
      ]
    },
    metadata: {
      seeded: true
    }
  },
  {
    moduleKey: "campaigns",
    entityKey: "campaign",
    layoutKey: "default-campaign-layout",
    name: "Default Campaign Layout",
    description: "Primary layout scaffold for future campaign create and detail forms.",
    layoutSchema: {
      sections: [
        {
          id: "campaign-strategy",
          title: "Campaign Strategy",
          fields: ["name", "type", "objective", "status", "owner_id"]
        },
        {
          id: "campaign-execution",
          title: "Execution",
          fields: ["channel", "target_audience", "budget_amount", "start_date", "end_date"]
        },
        {
          id: "campaign-assets",
          title: "Assets and Members",
          fields: ["related_assets", "member_status", "notes"]
        }
      ]
    },
    metadata: {
      seeded: true
    }
  },
  {
    moduleKey: "social",
    entityKey: "social_post",
    layoutKey: "default-social-post-layout",
    name: "Default Social Post Layout",
    description: "Primary layout scaffold for social post create, review, and scheduling flows.",
    layoutSchema: {
      sections: [
        {
          id: "social-post-planning",
          title: "Post Planning",
          fields: ["title", "caption", "creative_brief", "hashtags"]
        },
        {
          id: "social-post-scheduling",
          title: "Scheduling and Ownership",
          fields: ["scheduled_at", "owner_id", "campaign_id", "status", "approval_status"]
        },
        {
          id: "social-post-distribution",
          title: "Distribution and AI",
          fields: ["channels", "engagement_placeholder", "lead_capture_placeholder", "ai_placeholders"]
        }
      ]
    },
    metadata: {
      seeded: true
    }
  }
];
