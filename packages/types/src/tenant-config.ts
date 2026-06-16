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
  }
];
