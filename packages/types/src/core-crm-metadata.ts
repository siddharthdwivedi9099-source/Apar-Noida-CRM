import type { ConfigurationDefinition } from "./configuration-definitions.js";
import type { PermissionModuleKey } from "./rbac.js";
import type { TenantOptionSetSeedDefinition } from "./tenant-config.js";

type CoreCrmOwnershipModel = "user" | "team" | "territory" | "account" | "system";
type CoreCrmFieldType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "percent"
  | "date"
  | "datetime"
  | "email"
  | "phone"
  | "url"
  | "select"
  | "multiselect"
  | "boolean"
  | "lookup"
  | "json";

interface CoreCrmFieldInput {
  key: string;
  label: string;
  type: CoreCrmFieldType;
  required?: boolean;
  optionSetKey?: string;
  targetObject?: string;
  searchable?: boolean;
  filterable?: boolean;
  reportable?: boolean;
  aiUsable?: boolean;
  sensitive?: boolean;
  masking?: "none" | "partial" | "full" | "email";
}

interface CoreCrmRelationshipInput {
  key: string;
  label: string;
  type: "lookup" | "one_to_many" | "many_to_many" | "polymorphic";
  targetObject: string;
  sourceField?: string;
  required?: boolean;
}

interface CoreCrmObjectInput {
  objectCode: string;
  singularLabel: string;
  pluralLabel: string;
  module: string;
  ownershipModel: CoreCrmOwnershipModel;
  fields: CoreCrmFieldInput[];
  relationships: CoreCrmRelationshipInput[];
  listColumns?: string[];
  filterFields?: string[];
  searchFields?: string[];
  reportFields?: string[];
  activityTimelineEnabled?: boolean;
}

interface CoreCrmModuleInput {
  definitionKey: string;
  moduleCode: string;
  name: string;
  description: string;
  navGroup: string;
  displayOrder: number;
  permissionModuleKeys: PermissionModuleKey[];
  relatedObjects: string[];
}

const coreCrmPhaseMetadata = {
  seeded: true,
  phase: "phase-34-core-crm-metadata",
  configurable: true
} as const;

function field(input: CoreCrmFieldInput): CoreCrmFieldInput {
  return {
    searchable: input.type === "text" || input.type === "email" || input.type === "phone",
    filterable: input.type === "select" || input.type === "lookup" || input.type === "boolean",
    reportable: true,
    ...input
  };
}

function relationship(input: CoreCrmRelationshipInput): CoreCrmRelationshipInput {
  return input;
}

function columnsFor(input: CoreCrmObjectInput) {
  return input.listColumns ?? input.fields.slice(0, 6).map((item) => item.key);
}

function filterFieldsFor(input: CoreCrmObjectInput) {
  return input.filterFields ?? input.fields.filter((item) => item.filterable).map((item) => item.key).slice(0, 6);
}

function searchFieldsFor(input: CoreCrmObjectInput) {
  return input.searchFields ?? input.fields.filter((item) => item.searchable).map((item) => item.key).slice(0, 6);
}

function reportFieldsFor(input: CoreCrmObjectInput) {
  return input.reportFields ?? input.fields.filter((item) => item.reportable).map((item) => item.key);
}

function createObjectDefinition(input: CoreCrmObjectInput): ConfigurationDefinition {
  const listColumns = columnsFor(input);
  const filterFields = filterFieldsFor(input);
  const searchFields = searchFieldsFor(input);
  const reportFields = reportFieldsFor(input);

  return {
    definitionType: "object",
    definitionKey: input.objectCode,
    name: input.pluralLabel,
    description: `${input.singularLabel} configurable metadata, fields, relationships, and baseline views.`,
    isActive: true,
    definition: {
      objectCode: input.objectCode,
      singularLabel: input.singularLabel,
      pluralLabel: input.pluralLabel,
      module: input.module,
      ownershipModel: input.ownershipModel,
      auditEnabled: true,
      activityTimelineEnabled: input.activityTimelineEnabled ?? true,
      softDeleteEnabled: true,
      importExportEnabled: true,
      searchEnabled: true,
      filterEnabled: true,
      reportEnabled: true,
      keyFields: input.fields,
      relationships: input.relationships,
      searchFields,
      filterFields,
      reportFields,
      basicListView: {
        key: `${input.objectCode}.all`,
        label: `All ${input.pluralLabel}`,
        columns: listColumns,
        filters: filterFields,
        sort: [{ field: "updatedAt", direction: "desc" }]
      },
      basicDetailView: {
        key: `${input.objectCode}.detail`,
        label: `${input.singularLabel} Detail`,
        sections: [
          {
            id: "summary",
            title: "Summary",
            fields: input.fields.slice(0, 6).map((item) => item.key)
          },
          {
            id: "relationships",
            title: "Relationships",
            fields: input.relationships.map((item) => item.sourceField ?? item.key)
          }
        ]
      },
      basicCreateEditForm: {
        key: `${input.objectCode}.form`,
        label: `${input.singularLabel} Create/Edit`,
        sections: [
          {
            id: "main",
            title: "Main Information",
            fields: input.fields.filter((item) => item.required).map((item) => item.key)
          },
          {
            id: "additional",
            title: "Additional Information",
            fields: input.fields.filter((item) => !item.required).map((item) => item.key)
          }
        ]
      },
      metadata: coreCrmPhaseMetadata
    }
  };
}

function createModuleDefinition(input: CoreCrmModuleInput): ConfigurationDefinition {
  return {
    definitionType: "module_meta",
    definitionKey: input.definitionKey,
    name: input.name,
    description: input.description,
    isActive: true,
    definition: {
      moduleCode: input.moduleCode,
      navGroup: input.navGroup,
      displayOrder: input.displayOrder,
      permissionModuleKeys: input.permissionModuleKeys,
      relatedObjects: input.relatedObjects,
      defaultPermissions: input.permissionModuleKeys.flatMap((moduleKey) => [
        `${moduleKey}.view`,
        `${moduleKey}.create`,
        `${moduleKey}.edit`,
        `${moduleKey}.view_dashboard`
      ]),
      metadata: coreCrmPhaseMetadata
    }
  };
}

const coreCrmModuleInputs: CoreCrmModuleInput[] = [
  {
    definitionKey: "marketing",
    moduleCode: "marketing",
    name: "Marketing",
    description: "Segmentation, demand generation, product interest, lifecycle, and lead-source metadata.",
    navGroup: "Growth",
    displayOrder: 10,
    permissionModuleKeys: ["marketing"],
    relatedObjects: ["lead", "campaign", "campaign_member"]
  },
  {
    definitionKey: "campaign_management",
    moduleCode: "campaign_management",
    name: "Campaign Management",
    description: "Campaign planning, execution, members, attribution, and campaign reporting metadata.",
    navGroup: "Growth",
    displayOrder: 20,
    permissionModuleKeys: ["campaigns"],
    relatedObjects: ["campaign", "campaign_member", "lead", "contact"]
  },
  {
    definitionKey: "lead_management",
    moduleCode: "lead_management",
    name: "Lead Management",
    description: "Lead capture, qualification, source tracking, lifecycle stage, and conversion metadata.",
    navGroup: "Growth",
    displayOrder: 30,
    permissionModuleKeys: ["leads"],
    relatedObjects: ["lead", "campaign_member", "activity", "task"]
  },
  {
    definitionKey: "account_contact_management",
    moduleCode: "account_contact_management",
    name: "Account and Contact Management",
    description: "Customer and stakeholder records, account hierarchy, contact roles, and relationship metadata.",
    navGroup: "CRM",
    displayOrder: 40,
    permissionModuleKeys: ["accounts", "contacts"],
    relatedObjects: ["account", "contact", "opportunity", "support_ticket"]
  },
  {
    definitionKey: "opportunity_sales_pipeline",
    moduleCode: "opportunity_sales_pipeline",
    name: "Opportunity and Sales Pipeline",
    description: "Pipeline, forecasting, deal type, loss reason, renewal, and expansion opportunity metadata.",
    navGroup: "Revenue",
    displayOrder: 50,
    permissionModuleKeys: ["opportunities", "sales"],
    relatedObjects: ["opportunity", "renewal_opportunity", "expansion_opportunity", "quote"]
  },
  {
    definitionKey: "activity_management",
    moduleCode: "activity_management",
    name: "Activity Management",
    description: "Tasks, meetings, calls, email logs, notes, and polymorphic CRM activity metadata.",
    navGroup: "Productivity",
    displayOrder: 60,
    permissionModuleKeys: ["workflows", "notifications"],
    relatedObjects: ["activity", "task", "meeting", "call", "email_log", "note"]
  },
  {
    definitionKey: "proposal_quote_contract_management",
    moduleCode: "proposal_quote_contract_management",
    name: "Proposal, Quote, and Contract Management",
    description: "Product catalog, price books, quotes, proposals, contracts, and commercial document metadata.",
    navGroup: "Revenue",
    displayOrder: 70,
    permissionModuleKeys: ["opportunities", "presales"],
    relatedObjects: ["product", "product_bundle", "price_book", "quote", "proposal", "contract"]
  },
  {
    definitionKey: "approval_management",
    moduleCode: "approval_management",
    name: "Approval Management",
    description: "Approval requests, approval status, and approval target metadata without workflow execution.",
    navGroup: "Governance",
    displayOrder: 80,
    permissionModuleKeys: ["approvals"],
    relatedObjects: ["approval_request", "quote", "proposal", "contract"]
  },
  {
    definitionKey: "partner_reseller_management",
    moduleCode: "partner_reseller_management",
    name: "Partner and Reseller Management",
    description: "Partner lifecycle, partner users, deal registration, commission, and reseller metadata.",
    navGroup: "Channel",
    displayOrder: 90,
    permissionModuleKeys: ["partners", "resellers"],
    relatedObjects: ["partner", "partner_user", "partner_deal_registration", "partner_commission"]
  },
  {
    definitionKey: "support_ticketing",
    moduleCode: "support_ticketing",
    name: "Support Ticketing",
    description: "Ticket queues, priority, category, SLA, escalation, and knowledge article metadata.",
    navGroup: "Service",
    displayOrder: 100,
    permissionModuleKeys: ["support"],
    relatedObjects: ["support_ticket", "sla", "escalation", "knowledge_article"]
  },
  {
    definitionKey: "customer_success",
    moduleCode: "customer_success",
    name: "Customer Success",
    description: "Success plans, onboarding projects, onboarding tasks, and customer health metadata.",
    navGroup: "Service",
    displayOrder: 110,
    permissionModuleKeys: ["customer_success", "training"],
    relatedObjects: ["customer_success_plan", "onboarding_project", "onboarding_task", "customer_health_score"]
  },
  {
    definitionKey: "renewal_expansion",
    moduleCode: "renewal_expansion",
    name: "Renewal and Expansion",
    description: "Renewal opportunity, expansion opportunity, contract linkage, and customer-growth metadata.",
    navGroup: "Revenue",
    displayOrder: 120,
    permissionModuleKeys: ["opportunities", "customer_success"],
    relatedObjects: ["renewal_opportunity", "expansion_opportunity", "contract", "customer_health_score"]
  },
  {
    definitionKey: "ai_assistant_governance",
    moduleCode: "ai_assistant_governance",
    name: "AI Assistant and AI Governance",
    description: "AI recommendations, review metadata, audit logs, and governed AI usage metadata.",
    navGroup: "AI",
    displayOrder: 130,
    permissionModuleKeys: ["ai"],
    relatedObjects: ["ai_recommendation", "ai_audit_log"]
  },
  {
    definitionKey: "dashboards_analytics",
    moduleCode: "dashboards_analytics",
    name: "Dashboards and Analytics",
    description: "Dashboard widget composition, reporting flags, and analytics metadata.",
    navGroup: "Insights",
    displayOrder: 140,
    permissionModuleKeys: ["dashboards"],
    relatedObjects: ["dashboard_widget"]
  },
  {
    definitionKey: "admin_configuration",
    moduleCode: "admin_configuration",
    name: "Admin Configuration",
    description: "Admin configuration surfaces, workflow rules, configurable metadata, and tenant governance.",
    navGroup: "Governance",
    displayOrder: 150,
    permissionModuleKeys: ["admin", "workflows"],
    relatedObjects: ["workflow_rule", "dashboard_widget"]
  },
  {
    definitionKey: "audit_compliance",
    moduleCode: "audit_compliance",
    name: "Audit and Compliance",
    description: "Auditability, compliance review, AI audit, approval history, and governance metadata.",
    navGroup: "Governance",
    displayOrder: 160,
    permissionModuleKeys: ["admin", "ai", "approvals"],
    relatedObjects: ["ai_audit_log", "approval_request", "workflow_rule"]
  }
];

const coreCrmObjectInputs: CoreCrmObjectInput[] = [
  {
    objectCode: "lead",
    singularLabel: "Lead",
    pluralLabel: "Leads",
    module: "lead_management",
    ownershipModel: "user",
    fields: [
      field({ key: "fullName", label: "Full Name", type: "text", required: true }),
      field({ key: "firstName", label: "First Name", type: "text" }),
      field({ key: "lastName", label: "Last Name", type: "text" }),
      field({ key: "companyName", label: "Company", type: "text", required: true, aiUsable: true }),
      field({ key: "email", label: "Email", type: "email", required: true, sensitive: true, masking: "email" }),
      field({ key: "phone", label: "Phone", type: "phone", sensitive: true, masking: "partial" }),
      field({ key: "designation", label: "Designation", type: "text", aiUsable: true }),
      field({ key: "department", label: "Department", type: "text" }),
      field({ key: "website", label: "Website", type: "url" }),
      field({ key: "industry", label: "Industry", type: "select", optionSetKey: "industry", aiUsable: true }),
      field({ key: "region", label: "Region", type: "select", optionSetKey: "region", aiUsable: true }),
      field({ key: "segment", label: "Segment", type: "select", optionSetKey: "segment", aiUsable: true }),
      field({ key: "productInterest", label: "Product Interest", type: "multiselect", optionSetKey: "product-interest", aiUsable: true }),
      field({ key: "captureSource", label: "Capture Source", type: "select", optionSetKey: "lead-capture-source" }),
      field({ key: "leadSource", label: "Lead Source", type: "select", optionSetKey: "lead-source" }),
      field({ key: "subSource", label: "Sub-source", type: "select", optionSetKey: "lead-sub-source" }),
      field({ key: "campaign", label: "Campaign", type: "lookup", targetObject: "campaign" }),
      field({ key: "utmSource", label: "UTM Source", type: "text" }),
      field({ key: "utmMedium", label: "UTM Medium", type: "text" }),
      field({ key: "utmCampaign", label: "UTM Campaign", type: "text" }),
      field({ key: "firstTouchSource", label: "First-touch Source", type: "select", optionSetKey: "lead-source" }),
      field({ key: "latestTouchSource", label: "Latest-touch Source", type: "select", optionSetKey: "lead-source" }),
      field({ key: "consentStatus", label: "Consent Status", type: "select", optionSetKey: "consent-status", sensitive: true }),
      field({ key: "leadScore", label: "Lead Score", type: "number", aiUsable: true }),
      field({ key: "fitScore", label: "Fit Score", type: "number", aiUsable: true }),
      field({ key: "engagementScore", label: "Engagement Score", type: "number", aiUsable: true }),
      field({ key: "intentScore", label: "Intent Score", type: "number", aiUsable: true }),
      field({ key: "aiScore", label: "AI Score", type: "number", aiUsable: true }),
      field({ key: "leadGrade", label: "Lead Grade", type: "select", optionSetKey: "lead-grade" }),
      field({ key: "leadStatus", label: "Lead Status", type: "select", optionSetKey: "lead-status" }),
      field({ key: "lifecycleStage", label: "Lifecycle Stage", type: "select", optionSetKey: "lifecycle-stage" }),
      field({ key: "owner", label: "Owner", type: "lookup", targetObject: "user" }),
      field({ key: "assignmentDate", label: "Assignment Date", type: "datetime" }),
      field({ key: "slaDueDate", label: "SLA Due Date", type: "datetime" }),
      field({ key: "attemptCount", label: "Attempt Count", type: "number" }),
      field({ key: "lastActivity", label: "Last Activity", type: "datetime" }),
      field({ key: "nextFollowUp", label: "Next Follow-up", type: "datetime" }),
      field({ key: "qualificationStatus", label: "Qualification Status", type: "select", optionSetKey: "qualification-status" }),
      field({ key: "disqualificationReason", label: "Disqualification Reason", type: "select", optionSetKey: "disqualification-reason" }),
      field({ key: "revisitDate", label: "Revisit Date", type: "date" })
    ],
    relationships: [
      relationship({ key: "convertedAccount", label: "Converted Account", type: "lookup", targetObject: "account", sourceField: "convertedAccountId" }),
      relationship({ key: "convertedContact", label: "Converted Contact", type: "lookup", targetObject: "contact", sourceField: "convertedContactId" }),
      relationship({ key: "campaignMembers", label: "Campaign Members", type: "one_to_many", targetObject: "campaign_member" })
    ]
  },
  {
    objectCode: "account",
    singularLabel: "Account",
    pluralLabel: "Accounts",
    module: "account_contact_management",
    ownershipModel: "user",
    fields: [
      field({ key: "name", label: "Account Name", type: "text", required: true }),
      field({ key: "industry", label: "Industry", type: "select", optionSetKey: "industry" }),
      field({ key: "segment", label: "Segment", type: "select", optionSetKey: "segment" }),
      field({ key: "region", label: "Region", type: "select", optionSetKey: "region" }),
      field({ key: "website", label: "Website", type: "url" }),
      field({ key: "lifecycleStage", label: "Lifecycle Stage", type: "select", optionSetKey: "lifecycle-stage" })
    ],
    relationships: [
      relationship({ key: "contacts", label: "Contacts", type: "one_to_many", targetObject: "contact" }),
      relationship({ key: "opportunities", label: "Opportunities", type: "one_to_many", targetObject: "opportunity" }),
      relationship({ key: "supportTickets", label: "Support Tickets", type: "one_to_many", targetObject: "support_ticket" }),
      relationship({ key: "successPlans", label: "Success Plans", type: "one_to_many", targetObject: "customer_success_plan" })
    ]
  },
  {
    objectCode: "contact",
    singularLabel: "Contact",
    pluralLabel: "Contacts",
    module: "account_contact_management",
    ownershipModel: "account",
    fields: [
      field({ key: "fullName", label: "Full Name", type: "text", required: true }),
      field({ key: "email", label: "Email", type: "email", required: true }),
      field({ key: "phone", label: "Phone", type: "phone" }),
      field({ key: "title", label: "Title", type: "text" }),
      field({ key: "accountId", label: "Account", type: "lookup", targetObject: "account", required: true }),
      field({ key: "lifecycleStage", label: "Lifecycle Stage", type: "select", optionSetKey: "lifecycle-stage" })
    ],
    relationships: [
      relationship({ key: "account", label: "Account", type: "lookup", targetObject: "account", sourceField: "accountId", required: true }),
      relationship({ key: "campaignMembers", label: "Campaign Memberships", type: "one_to_many", targetObject: "campaign_member" }),
      relationship({ key: "supportTickets", label: "Support Tickets", type: "one_to_many", targetObject: "support_ticket" })
    ]
  },
  {
    objectCode: "opportunity",
    singularLabel: "Opportunity",
    pluralLabel: "Opportunities",
    module: "opportunity_sales_pipeline",
    ownershipModel: "user",
    fields: [
      field({ key: "name", label: "Opportunity Name", type: "text", required: true }),
      field({ key: "accountId", label: "Account", type: "lookup", targetObject: "account", required: true }),
      field({ key: "stage", label: "Opportunity Stage", type: "select", optionSetKey: "opportunity-stage" }),
      field({ key: "type", label: "Opportunity Type", type: "select", optionSetKey: "opportunity-type" }),
      field({ key: "forecastCategory", label: "Forecast Category", type: "select", optionSetKey: "forecast-category" }),
      field({ key: "amount", label: "Amount", type: "currency" }),
      field({ key: "closeDate", label: "Close Date", type: "date" }),
      field({ key: "lossReason", label: "Loss Reason", type: "select", optionSetKey: "loss-reason" })
    ],
    relationships: [
      relationship({ key: "account", label: "Account", type: "lookup", targetObject: "account", sourceField: "accountId", required: true }),
      relationship({ key: "primaryContact", label: "Primary Contact", type: "lookup", targetObject: "contact", sourceField: "primaryContactId" }),
      relationship({ key: "quotes", label: "Quotes", type: "one_to_many", targetObject: "quote" }),
      relationship({ key: "approvalRequests", label: "Approval Requests", type: "one_to_many", targetObject: "approval_request" })
    ]
  },
  {
    objectCode: "campaign",
    singularLabel: "Campaign",
    pluralLabel: "Campaigns",
    module: "campaign_management",
    ownershipModel: "team",
    fields: [
      field({ key: "name", label: "Campaign Name", type: "text", required: true }),
      field({ key: "campaignType", label: "Campaign Type", type: "select", optionSetKey: "campaign-type" }),
      field({ key: "status", label: "Lifecycle Stage", type: "select", optionSetKey: "lifecycle-stage" }),
      field({ key: "startDate", label: "Start Date", type: "date" }),
      field({ key: "endDate", label: "End Date", type: "date" }),
      field({ key: "budget", label: "Budget", type: "currency" })
    ],
    relationships: [
      relationship({ key: "members", label: "Campaign Members", type: "one_to_many", targetObject: "campaign_member" }),
      relationship({ key: "leads", label: "Generated Leads", type: "one_to_many", targetObject: "lead" }),
      relationship({ key: "opportunities", label: "Influenced Opportunities", type: "many_to_many", targetObject: "opportunity" })
    ]
  },
  {
    objectCode: "campaign_member",
    singularLabel: "Campaign Member",
    pluralLabel: "Campaign Members",
    module: "campaign_management",
    ownershipModel: "team",
    fields: [
      field({ key: "campaignId", label: "Campaign", type: "lookup", targetObject: "campaign", required: true }),
      field({ key: "memberType", label: "Member Type", type: "select", optionSetKey: "lifecycle-stage" }),
      field({ key: "leadId", label: "Lead", type: "lookup", targetObject: "lead" }),
      field({ key: "contactId", label: "Contact", type: "lookup", targetObject: "contact" }),
      field({ key: "status", label: "Status", type: "select", optionSetKey: "lead-status" }),
      field({ key: "respondedAt", label: "Responded At", type: "datetime" })
    ],
    relationships: [
      relationship({ key: "campaign", label: "Campaign", type: "lookup", targetObject: "campaign", sourceField: "campaignId", required: true }),
      relationship({ key: "lead", label: "Lead", type: "lookup", targetObject: "lead", sourceField: "leadId" }),
      relationship({ key: "contact", label: "Contact", type: "lookup", targetObject: "contact", sourceField: "contactId" })
    ]
  },
  {
    objectCode: "activity",
    singularLabel: "Activity",
    pluralLabel: "Activities",
    module: "activity_management",
    ownershipModel: "user",
    fields: [
      field({ key: "subject", label: "Subject", type: "text", required: true }),
      field({ key: "activityType", label: "Activity Type", type: "select", optionSetKey: "activity-type" }),
      field({ key: "relatedObject", label: "Related Object", type: "text" }),
      field({ key: "relatedRecordId", label: "Related Record", type: "text" }),
      field({ key: "dueAt", label: "Due At", type: "datetime" }),
      field({ key: "status", label: "Task Status", type: "select", optionSetKey: "task-status" })
    ],
    relationships: [
      relationship({ key: "relatedRecord", label: "Related Record", type: "polymorphic", targetObject: "lead|account|contact|opportunity|support_ticket" }),
      relationship({ key: "tasks", label: "Tasks", type: "one_to_many", targetObject: "task" }),
      relationship({ key: "notes", label: "Notes", type: "one_to_many", targetObject: "note" })
    ]
  },
  {
    objectCode: "task",
    singularLabel: "Task",
    pluralLabel: "Tasks",
    module: "activity_management",
    ownershipModel: "user",
    fields: [
      field({ key: "subject", label: "Subject", type: "text", required: true }),
      field({ key: "taskStatus", label: "Task Status", type: "select", optionSetKey: "task-status" }),
      field({ key: "priority", label: "Priority", type: "select", optionSetKey: "ticket-priority" }),
      field({ key: "activityId", label: "Activity", type: "lookup", targetObject: "activity" }),
      field({ key: "assigneeId", label: "Assignee", type: "text" }),
      field({ key: "dueDate", label: "Due Date", type: "date" })
    ],
    relationships: [
      relationship({ key: "activity", label: "Activity", type: "lookup", targetObject: "activity", sourceField: "activityId" }),
      relationship({ key: "relatedRecord", label: "Related Record", type: "polymorphic", targetObject: "lead|account|contact|opportunity|support_ticket" })
    ]
  },
  {
    objectCode: "meeting",
    singularLabel: "Meeting",
    pluralLabel: "Meetings",
    module: "activity_management",
    ownershipModel: "user",
    fields: [
      field({ key: "subject", label: "Subject", type: "text", required: true }),
      field({ key: "startAt", label: "Start At", type: "datetime", required: true }),
      field({ key: "endAt", label: "End At", type: "datetime" }),
      field({ key: "attendees", label: "Attendees", type: "json" }),
      field({ key: "relatedRecordId", label: "Related Record", type: "text" })
    ],
    relationships: [
      relationship({ key: "activity", label: "Activity", type: "lookup", targetObject: "activity", sourceField: "activityId" }),
      relationship({ key: "relatedRecord", label: "Related Record", type: "polymorphic", targetObject: "lead|account|contact|opportunity" })
    ]
  },
  {
    objectCode: "call",
    singularLabel: "Call",
    pluralLabel: "Calls",
    module: "activity_management",
    ownershipModel: "user",
    fields: [
      field({ key: "subject", label: "Subject", type: "text", required: true }),
      field({ key: "callTime", label: "Call Time", type: "datetime" }),
      field({ key: "direction", label: "Direction", type: "select", optionSetKey: "activity-type" }),
      field({ key: "outcome", label: "Outcome", type: "text" }),
      field({ key: "relatedRecordId", label: "Related Record", type: "text" })
    ],
    relationships: [
      relationship({ key: "activity", label: "Activity", type: "lookup", targetObject: "activity", sourceField: "activityId" }),
      relationship({ key: "relatedRecord", label: "Related Record", type: "polymorphic", targetObject: "lead|account|contact|opportunity|support_ticket" })
    ]
  },
  {
    objectCode: "email_log",
    singularLabel: "Email Log",
    pluralLabel: "Email Logs",
    module: "activity_management",
    ownershipModel: "user",
    fields: [
      field({ key: "subject", label: "Subject", type: "text", required: true }),
      field({ key: "fromAddress", label: "From", type: "email" }),
      field({ key: "toAddress", label: "To", type: "email" }),
      field({ key: "sentAt", label: "Sent At", type: "datetime" }),
      field({ key: "relatedRecordId", label: "Related Record", type: "text" })
    ],
    relationships: [
      relationship({ key: "activity", label: "Activity", type: "lookup", targetObject: "activity", sourceField: "activityId" }),
      relationship({ key: "relatedRecord", label: "Related Record", type: "polymorphic", targetObject: "lead|account|contact|opportunity|support_ticket" })
    ]
  },
  {
    objectCode: "note",
    singularLabel: "Note",
    pluralLabel: "Notes",
    module: "activity_management",
    ownershipModel: "user",
    fields: [
      field({ key: "title", label: "Title", type: "text", required: true }),
      field({ key: "body", label: "Body", type: "textarea" }),
      field({ key: "relatedRecordId", label: "Related Record", type: "text" }),
      field({ key: "authorId", label: "Author", type: "text" })
    ],
    relationships: [
      relationship({ key: "activity", label: "Activity", type: "lookup", targetObject: "activity", sourceField: "activityId" }),
      relationship({ key: "relatedRecord", label: "Related Record", type: "polymorphic", targetObject: "lead|account|contact|opportunity|support_ticket|knowledge_article" })
    ]
  },
  {
    objectCode: "product",
    singularLabel: "Product",
    pluralLabel: "Products",
    module: "proposal_quote_contract_management",
    ownershipModel: "team",
    fields: [
      field({ key: "name", label: "Product Name", type: "text", required: true }),
      field({ key: "sku", label: "SKU", type: "text", required: true }),
      field({ key: "productInterest", label: "Product Interest", type: "select", optionSetKey: "product-interest" }),
      field({ key: "listPrice", label: "List Price", type: "currency" }),
      field({ key: "active", label: "Active", type: "boolean" })
    ],
    relationships: [
      relationship({ key: "bundles", label: "Product Bundles", type: "many_to_many", targetObject: "product_bundle" }),
      relationship({ key: "priceBooks", label: "Price Books", type: "many_to_many", targetObject: "price_book" })
    ]
  },
  {
    objectCode: "product_bundle",
    singularLabel: "Product Bundle",
    pluralLabel: "Product Bundles",
    module: "proposal_quote_contract_management",
    ownershipModel: "team",
    fields: [
      field({ key: "name", label: "Bundle Name", type: "text", required: true }),
      field({ key: "products", label: "Products", type: "json" }),
      field({ key: "bundlePrice", label: "Bundle Price", type: "currency" }),
      field({ key: "active", label: "Active", type: "boolean" })
    ],
    relationships: [
      relationship({ key: "products", label: "Products", type: "many_to_many", targetObject: "product" }),
      relationship({ key: "quotes", label: "Quotes", type: "many_to_many", targetObject: "quote" })
    ]
  },
  {
    objectCode: "price_book",
    singularLabel: "Price Book",
    pluralLabel: "Price Books",
    module: "proposal_quote_contract_management",
    ownershipModel: "team",
    fields: [
      field({ key: "name", label: "Price Book Name", type: "text", required: true }),
      field({ key: "currency", label: "Currency", type: "text" }),
      field({ key: "effectiveDate", label: "Effective Date", type: "date" }),
      field({ key: "active", label: "Active", type: "boolean" })
    ],
    relationships: [
      relationship({ key: "products", label: "Products", type: "many_to_many", targetObject: "product" }),
      relationship({ key: "quotes", label: "Quotes", type: "one_to_many", targetObject: "quote" })
    ]
  },
  {
    objectCode: "quote",
    singularLabel: "Quote",
    pluralLabel: "Quotes",
    module: "proposal_quote_contract_management",
    ownershipModel: "user",
    fields: [
      field({ key: "quoteNumber", label: "Quote Number", type: "text", required: true }),
      field({ key: "opportunityId", label: "Opportunity", type: "lookup", targetObject: "opportunity", required: true }),
      field({ key: "accountId", label: "Account", type: "lookup", targetObject: "account", required: true }),
      field({ key: "status", label: "Approval Status", type: "select", optionSetKey: "approval-status" }),
      field({ key: "totalAmount", label: "Total Amount", type: "currency" })
    ],
    relationships: [
      relationship({ key: "opportunity", label: "Opportunity", type: "lookup", targetObject: "opportunity", sourceField: "opportunityId", required: true }),
      relationship({ key: "account", label: "Account", type: "lookup", targetObject: "account", sourceField: "accountId", required: true }),
      relationship({ key: "proposal", label: "Proposal", type: "one_to_many", targetObject: "proposal" })
    ]
  },
  {
    objectCode: "proposal",
    singularLabel: "Proposal",
    pluralLabel: "Proposals",
    module: "proposal_quote_contract_management",
    ownershipModel: "user",
    fields: [
      field({ key: "proposalNumber", label: "Proposal Number", type: "text", required: true }),
      field({ key: "opportunityId", label: "Opportunity", type: "lookup", targetObject: "opportunity" }),
      field({ key: "quoteId", label: "Quote", type: "lookup", targetObject: "quote" }),
      field({ key: "approvalStatus", label: "Approval Status", type: "select", optionSetKey: "approval-status" }),
      field({ key: "validUntil", label: "Valid Until", type: "date" })
    ],
    relationships: [
      relationship({ key: "opportunity", label: "Opportunity", type: "lookup", targetObject: "opportunity", sourceField: "opportunityId" }),
      relationship({ key: "quote", label: "Quote", type: "lookup", targetObject: "quote", sourceField: "quoteId" }),
      relationship({ key: "approvalRequests", label: "Approval Requests", type: "one_to_many", targetObject: "approval_request" })
    ]
  },
  {
    objectCode: "approval_request",
    singularLabel: "Approval Request",
    pluralLabel: "Approval Requests",
    module: "approval_management",
    ownershipModel: "user",
    fields: [
      field({ key: "title", label: "Title", type: "text", required: true }),
      field({ key: "targetObject", label: "Target Object", type: "text", required: true }),
      field({ key: "targetRecordId", label: "Target Record", type: "text", required: true }),
      field({ key: "approvalStatus", label: "Approval Status", type: "select", optionSetKey: "approval-status" }),
      field({ key: "requestedById", label: "Requested By", type: "text" }),
      field({ key: "approverId", label: "Approver", type: "text" })
    ],
    relationships: [
      relationship({ key: "targetRecord", label: "Target Record", type: "polymorphic", targetObject: "quote|proposal|contract|opportunity" }),
      relationship({ key: "aiAuditLogs", label: "AI Audit Logs", type: "one_to_many", targetObject: "ai_audit_log" })
    ]
  },
  {
    objectCode: "contract",
    singularLabel: "Contract",
    pluralLabel: "Contracts",
    module: "proposal_quote_contract_management",
    ownershipModel: "user",
    fields: [
      field({ key: "contractNumber", label: "Contract Number", type: "text", required: true }),
      field({ key: "accountId", label: "Account", type: "lookup", targetObject: "account", required: true }),
      field({ key: "opportunityId", label: "Opportunity", type: "lookup", targetObject: "opportunity" }),
      field({ key: "contractStatus", label: "Contract Status", type: "select", optionSetKey: "contract-status" }),
      field({ key: "startDate", label: "Start Date", type: "date" }),
      field({ key: "endDate", label: "End Date", type: "date" })
    ],
    relationships: [
      relationship({ key: "account", label: "Account", type: "lookup", targetObject: "account", sourceField: "accountId", required: true }),
      relationship({ key: "opportunity", label: "Opportunity", type: "lookup", targetObject: "opportunity", sourceField: "opportunityId" }),
      relationship({ key: "renewalOpportunities", label: "Renewal Opportunities", type: "one_to_many", targetObject: "renewal_opportunity" })
    ]
  },
  {
    objectCode: "partner",
    singularLabel: "Partner",
    pluralLabel: "Partners",
    module: "partner_reseller_management",
    ownershipModel: "team",
    fields: [
      field({ key: "name", label: "Partner Name", type: "text", required: true }),
      field({ key: "partnerTier", label: "Partner Tier", type: "select", optionSetKey: "partner-tier" }),
      field({ key: "partnerStatus", label: "Partner Status", type: "select", optionSetKey: "partner-status" }),
      field({ key: "region", label: "Region", type: "select", optionSetKey: "region" }),
      field({ key: "accountId", label: "Account", type: "lookup", targetObject: "account" })
    ],
    relationships: [
      relationship({ key: "account", label: "Account", type: "lookup", targetObject: "account", sourceField: "accountId" }),
      relationship({ key: "partnerUsers", label: "Partner Users", type: "one_to_many", targetObject: "partner_user" }),
      relationship({ key: "dealRegistrations", label: "Deal Registrations", type: "one_to_many", targetObject: "partner_deal_registration" })
    ]
  },
  {
    objectCode: "partner_user",
    singularLabel: "Partner User",
    pluralLabel: "Partner Users",
    module: "partner_reseller_management",
    ownershipModel: "team",
    fields: [
      field({ key: "partnerId", label: "Partner", type: "lookup", targetObject: "partner", required: true }),
      field({ key: "fullName", label: "Full Name", type: "text", required: true }),
      field({ key: "email", label: "Email", type: "email", required: true }),
      field({ key: "status", label: "Partner Status", type: "select", optionSetKey: "partner-status" }),
      field({ key: "contactId", label: "Contact", type: "lookup", targetObject: "contact" })
    ],
    relationships: [
      relationship({ key: "partner", label: "Partner", type: "lookup", targetObject: "partner", sourceField: "partnerId", required: true }),
      relationship({ key: "contact", label: "Contact", type: "lookup", targetObject: "contact", sourceField: "contactId" })
    ]
  },
  {
    objectCode: "partner_deal_registration",
    singularLabel: "Partner Deal Registration",
    pluralLabel: "Partner Deal Registrations",
    module: "partner_reseller_management",
    ownershipModel: "team",
    fields: [
      field({ key: "partnerId", label: "Partner", type: "lookup", targetObject: "partner", required: true }),
      field({ key: "accountId", label: "Account", type: "lookup", targetObject: "account" }),
      field({ key: "opportunityId", label: "Opportunity", type: "lookup", targetObject: "opportunity" }),
      field({ key: "stage", label: "Opportunity Stage", type: "select", optionSetKey: "opportunity-stage" }),
      field({ key: "approvalStatus", label: "Approval Status", type: "select", optionSetKey: "approval-status" })
    ],
    relationships: [
      relationship({ key: "partner", label: "Partner", type: "lookup", targetObject: "partner", sourceField: "partnerId", required: true }),
      relationship({ key: "opportunity", label: "Opportunity", type: "lookup", targetObject: "opportunity", sourceField: "opportunityId" }),
      relationship({ key: "commissions", label: "Commissions", type: "one_to_many", targetObject: "partner_commission" })
    ]
  },
  {
    objectCode: "partner_commission",
    singularLabel: "Partner Commission",
    pluralLabel: "Partner Commissions",
    module: "partner_reseller_management",
    ownershipModel: "team",
    fields: [
      field({ key: "partnerId", label: "Partner", type: "lookup", targetObject: "partner", required: true }),
      field({ key: "dealRegistrationId", label: "Deal Registration", type: "lookup", targetObject: "partner_deal_registration" }),
      field({ key: "commissionAmount", label: "Commission Amount", type: "currency" }),
      field({ key: "approvalStatus", label: "Approval Status", type: "select", optionSetKey: "approval-status" })
    ],
    relationships: [
      relationship({ key: "partner", label: "Partner", type: "lookup", targetObject: "partner", sourceField: "partnerId", required: true }),
      relationship({ key: "dealRegistration", label: "Deal Registration", type: "lookup", targetObject: "partner_deal_registration", sourceField: "dealRegistrationId" })
    ]
  },
  {
    objectCode: "support_ticket",
    singularLabel: "Support Ticket",
    pluralLabel: "Support Tickets",
    module: "support_ticketing",
    ownershipModel: "team",
    fields: [
      field({ key: "subject", label: "Subject", type: "text", required: true }),
      field({ key: "accountId", label: "Account", type: "lookup", targetObject: "account" }),
      field({ key: "contactId", label: "Contact", type: "lookup", targetObject: "contact" }),
      field({ key: "ticketPriority", label: "Ticket Priority", type: "select", optionSetKey: "ticket-priority" }),
      field({ key: "ticketStatus", label: "Ticket Status", type: "select", optionSetKey: "ticket-status" }),
      field({ key: "ticketCategory", label: "Ticket Category", type: "select", optionSetKey: "ticket-category" })
    ],
    relationships: [
      relationship({ key: "account", label: "Account", type: "lookup", targetObject: "account", sourceField: "accountId" }),
      relationship({ key: "contact", label: "Contact", type: "lookup", targetObject: "contact", sourceField: "contactId" }),
      relationship({ key: "sla", label: "SLA", type: "lookup", targetObject: "sla", sourceField: "slaId" }),
      relationship({ key: "escalations", label: "Escalations", type: "one_to_many", targetObject: "escalation" })
    ]
  },
  {
    objectCode: "sla",
    singularLabel: "SLA",
    pluralLabel: "SLAs",
    module: "support_ticketing",
    ownershipModel: "team",
    fields: [
      field({ key: "name", label: "SLA Name", type: "text", required: true }),
      field({ key: "ticketPriority", label: "Ticket Priority", type: "select", optionSetKey: "ticket-priority" }),
      field({ key: "responseHours", label: "Response Hours", type: "number" }),
      field({ key: "resolutionHours", label: "Resolution Hours", type: "number" }),
      field({ key: "active", label: "Active", type: "boolean" })
    ],
    relationships: [
      relationship({ key: "supportTickets", label: "Support Tickets", type: "one_to_many", targetObject: "support_ticket" }),
      relationship({ key: "escalations", label: "Escalations", type: "one_to_many", targetObject: "escalation" })
    ]
  },
  {
    objectCode: "escalation",
    singularLabel: "Escalation",
    pluralLabel: "Escalations",
    module: "support_ticketing",
    ownershipModel: "team",
    fields: [
      field({ key: "ticketId", label: "Support Ticket", type: "lookup", targetObject: "support_ticket", required: true }),
      field({ key: "slaId", label: "SLA", type: "lookup", targetObject: "sla" }),
      field({ key: "level", label: "Escalation Level", type: "number" }),
      field({ key: "status", label: "Ticket Status", type: "select", optionSetKey: "ticket-status" }),
      field({ key: "escalatedTo", label: "Escalated To", type: "text" })
    ],
    relationships: [
      relationship({ key: "ticket", label: "Support Ticket", type: "lookup", targetObject: "support_ticket", sourceField: "ticketId", required: true }),
      relationship({ key: "sla", label: "SLA", type: "lookup", targetObject: "sla", sourceField: "slaId" })
    ]
  },
  {
    objectCode: "knowledge_article",
    singularLabel: "Knowledge Article",
    pluralLabel: "Knowledge Articles",
    module: "support_ticketing",
    ownershipModel: "team",
    fields: [
      field({ key: "title", label: "Title", type: "text", required: true }),
      field({ key: "category", label: "Ticket Category", type: "select", optionSetKey: "ticket-category" }),
      field({ key: "lifecycleStage", label: "Lifecycle Stage", type: "select", optionSetKey: "lifecycle-stage" }),
      field({ key: "ownerId", label: "Owner", type: "text" })
    ],
    relationships: [
      relationship({ key: "relatedTickets", label: "Related Tickets", type: "many_to_many", targetObject: "support_ticket" }),
      relationship({ key: "notes", label: "Notes", type: "one_to_many", targetObject: "note" })
    ]
  },
  {
    objectCode: "customer_success_plan",
    singularLabel: "Customer Success Plan",
    pluralLabel: "Customer Success Plans",
    module: "customer_success",
    ownershipModel: "user",
    fields: [
      field({ key: "name", label: "Plan Name", type: "text", required: true }),
      field({ key: "accountId", label: "Account", type: "lookup", targetObject: "account", required: true }),
      field({ key: "healthStatus", label: "Customer Health Status", type: "select", optionSetKey: "customer-health-status" }),
      field({ key: "lifecycleStage", label: "Lifecycle Stage", type: "select", optionSetKey: "lifecycle-stage" }),
      field({ key: "ownerId", label: "Owner", type: "text" })
    ],
    relationships: [
      relationship({ key: "account", label: "Account", type: "lookup", targetObject: "account", sourceField: "accountId", required: true }),
      relationship({ key: "onboardingProjects", label: "Onboarding Projects", type: "one_to_many", targetObject: "onboarding_project" }),
      relationship({ key: "healthScores", label: "Health Scores", type: "one_to_many", targetObject: "customer_health_score" })
    ]
  },
  {
    objectCode: "onboarding_project",
    singularLabel: "Onboarding Project",
    pluralLabel: "Onboarding Projects",
    module: "customer_success",
    ownershipModel: "user",
    fields: [
      field({ key: "name", label: "Project Name", type: "text", required: true }),
      field({ key: "accountId", label: "Account", type: "lookup", targetObject: "account", required: true }),
      field({ key: "successPlanId", label: "Success Plan", type: "lookup", targetObject: "customer_success_plan" }),
      field({ key: "status", label: "Task Status", type: "select", optionSetKey: "task-status" }),
      field({ key: "startDate", label: "Start Date", type: "date" }),
      field({ key: "dueDate", label: "Due Date", type: "date" })
    ],
    relationships: [
      relationship({ key: "account", label: "Account", type: "lookup", targetObject: "account", sourceField: "accountId", required: true }),
      relationship({ key: "successPlan", label: "Success Plan", type: "lookup", targetObject: "customer_success_plan", sourceField: "successPlanId" }),
      relationship({ key: "tasks", label: "Onboarding Tasks", type: "one_to_many", targetObject: "onboarding_task" })
    ]
  },
  {
    objectCode: "onboarding_task",
    singularLabel: "Onboarding Task",
    pluralLabel: "Onboarding Tasks",
    module: "customer_success",
    ownershipModel: "user",
    fields: [
      field({ key: "projectId", label: "Onboarding Project", type: "lookup", targetObject: "onboarding_project", required: true }),
      field({ key: "subject", label: "Subject", type: "text", required: true }),
      field({ key: "taskStatus", label: "Task Status", type: "select", optionSetKey: "task-status" }),
      field({ key: "assigneeId", label: "Assignee", type: "text" }),
      field({ key: "dueDate", label: "Due Date", type: "date" })
    ],
    relationships: [
      relationship({ key: "project", label: "Onboarding Project", type: "lookup", targetObject: "onboarding_project", sourceField: "projectId", required: true }),
      relationship({ key: "successPlan", label: "Success Plan", type: "lookup", targetObject: "customer_success_plan", sourceField: "successPlanId" })
    ]
  },
  {
    objectCode: "customer_health_score",
    singularLabel: "Customer Health Score",
    pluralLabel: "Customer Health Scores",
    module: "customer_success",
    ownershipModel: "account",
    fields: [
      field({ key: "accountId", label: "Account", type: "lookup", targetObject: "account", required: true }),
      field({ key: "score", label: "Score", type: "number", required: true }),
      field({ key: "healthStatus", label: "Customer Health Status", type: "select", optionSetKey: "customer-health-status" }),
      field({ key: "periodStart", label: "Period Start", type: "date" }),
      field({ key: "periodEnd", label: "Period End", type: "date" })
    ],
    relationships: [
      relationship({ key: "account", label: "Account", type: "lookup", targetObject: "account", sourceField: "accountId", required: true }),
      relationship({ key: "successPlan", label: "Success Plan", type: "lookup", targetObject: "customer_success_plan", sourceField: "successPlanId" })
    ]
  },
  {
    objectCode: "renewal_opportunity",
    singularLabel: "Renewal Opportunity",
    pluralLabel: "Renewal Opportunities",
    module: "renewal_expansion",
    ownershipModel: "user",
    fields: [
      field({ key: "name", label: "Renewal Name", type: "text", required: true }),
      field({ key: "accountId", label: "Account", type: "lookup", targetObject: "account", required: true }),
      field({ key: "contractId", label: "Contract", type: "lookup", targetObject: "contract" }),
      field({ key: "renewalStatus", label: "Renewal Status", type: "select", optionSetKey: "renewal-status" }),
      field({ key: "amount", label: "Renewal Amount", type: "currency" }),
      field({ key: "closeDate", label: "Renewal Date", type: "date" })
    ],
    relationships: [
      relationship({ key: "account", label: "Account", type: "lookup", targetObject: "account", sourceField: "accountId", required: true }),
      relationship({ key: "contract", label: "Contract", type: "lookup", targetObject: "contract", sourceField: "contractId" }),
      relationship({ key: "sourceOpportunity", label: "Source Opportunity", type: "lookup", targetObject: "opportunity", sourceField: "sourceOpportunityId" })
    ]
  },
  {
    objectCode: "expansion_opportunity",
    singularLabel: "Expansion Opportunity",
    pluralLabel: "Expansion Opportunities",
    module: "renewal_expansion",
    ownershipModel: "user",
    fields: [
      field({ key: "name", label: "Expansion Name", type: "text", required: true }),
      field({ key: "accountId", label: "Account", type: "lookup", targetObject: "account", required: true }),
      field({ key: "sourceOpportunityId", label: "Source Opportunity", type: "lookup", targetObject: "opportunity" }),
      field({ key: "opportunityType", label: "Opportunity Type", type: "select", optionSetKey: "opportunity-type" }),
      field({ key: "stage", label: "Opportunity Stage", type: "select", optionSetKey: "opportunity-stage" }),
      field({ key: "amount", label: "Expansion Amount", type: "currency" })
    ],
    relationships: [
      relationship({ key: "account", label: "Account", type: "lookup", targetObject: "account", sourceField: "accountId", required: true }),
      relationship({ key: "sourceOpportunity", label: "Source Opportunity", type: "lookup", targetObject: "opportunity", sourceField: "sourceOpportunityId" }),
      relationship({ key: "quotes", label: "Quotes", type: "one_to_many", targetObject: "quote" })
    ]
  },
  {
    objectCode: "ai_recommendation",
    singularLabel: "AI Recommendation",
    pluralLabel: "AI Recommendations",
    module: "ai_assistant_governance",
    ownershipModel: "system",
    fields: [
      field({ key: "title", label: "Title", type: "text", required: true }),
      field({ key: "targetObject", label: "Target Object", type: "text", required: true }),
      field({ key: "targetRecordId", label: "Target Record", type: "text" }),
      field({ key: "recommendation", label: "Recommendation", type: "textarea" }),
      field({ key: "confidence", label: "Confidence", type: "percent" }),
      field({ key: "reviewStatus", label: "Approval Status", type: "select", optionSetKey: "approval-status" })
    ],
    relationships: [
      relationship({ key: "targetRecord", label: "Target Record", type: "polymorphic", targetObject: "lead|account|opportunity|support_ticket|customer_success_plan" }),
      relationship({ key: "auditLogs", label: "AI Audit Logs", type: "one_to_many", targetObject: "ai_audit_log" })
    ],
    activityTimelineEnabled: false
  },
  {
    objectCode: "ai_audit_log",
    singularLabel: "AI Audit Log",
    pluralLabel: "AI Audit Logs",
    module: "audit_compliance",
    ownershipModel: "system",
    fields: [
      field({ key: "recommendationId", label: "AI Recommendation", type: "lookup", targetObject: "ai_recommendation" }),
      field({ key: "action", label: "Action", type: "text", required: true }),
      field({ key: "actorId", label: "Actor", type: "text" }),
      field({ key: "confidence", label: "Confidence", type: "percent" }),
      field({ key: "reviewStatus", label: "Approval Status", type: "select", optionSetKey: "approval-status" })
    ],
    relationships: [
      relationship({ key: "recommendation", label: "AI Recommendation", type: "lookup", targetObject: "ai_recommendation", sourceField: "recommendationId" }),
      relationship({ key: "approvalRequest", label: "Approval Request", type: "lookup", targetObject: "approval_request", sourceField: "approvalRequestId" })
    ],
    activityTimelineEnabled: false
  },
  {
    objectCode: "workflow_rule",
    singularLabel: "Workflow Rule",
    pluralLabel: "Workflow Rules",
    module: "admin_configuration",
    ownershipModel: "team",
    fields: [
      field({ key: "name", label: "Rule Name", type: "text", required: true }),
      field({ key: "targetObject", label: "Target Object", type: "text", required: true }),
      field({ key: "triggerType", label: "Trigger Type", type: "text" }),
      field({ key: "status", label: "Lifecycle Stage", type: "select", optionSetKey: "lifecycle-stage" }),
      field({ key: "conditions", label: "Conditions", type: "json" })
    ],
    relationships: [
      relationship({ key: "targetObject", label: "Target Object", type: "polymorphic", targetObject: "lead|account|opportunity|support_ticket|customer_success_plan" }),
      relationship({ key: "approvalRequests", label: "Approval Requests", type: "one_to_many", targetObject: "approval_request" })
    ],
    activityTimelineEnabled: false
  },
  {
    objectCode: "dashboard_widget",
    singularLabel: "Dashboard Widget",
    pluralLabel: "Dashboard Widgets",
    module: "dashboards_analytics",
    ownershipModel: "team",
    fields: [
      field({ key: "dashboardKey", label: "Dashboard Key", type: "text", required: true }),
      field({ key: "metricKey", label: "Metric Key", type: "text", required: true }),
      field({ key: "widgetType", label: "Widget Type", type: "text" }),
      field({ key: "targetObject", label: "Target Object", type: "text" }),
      field({ key: "active", label: "Active", type: "boolean" })
    ],
    relationships: [
      relationship({ key: "targetObject", label: "Target Object", type: "polymorphic", targetObject: "lead|account|opportunity|support_ticket|customer_success_plan" }),
      relationship({ key: "workflowRules", label: "Workflow Rules", type: "many_to_many", targetObject: "workflow_rule" })
    ],
    activityTimelineEnabled: false
  }
];

function optionSet(input: TenantOptionSetSeedDefinition): TenantOptionSetSeedDefinition {
  return {
    ...input,
    metadata: {
      ...coreCrmPhaseMetadata,
      ...(input.metadata ?? {})
    }
  };
}

export const defaultCoreCrmStandardPicklistDefinitions: TenantOptionSetSeedDefinition[] = [
  optionSet({
    setKey: "lead-source",
    moduleKey: "leads",
    kind: "dropdown",
    name: "Lead Source",
    description: "Standard lead intake source values, including social channels (SM-002).",
    values: [
      { key: "website", label: "Website", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "campaign", label: "Campaign", color: "#14b8a6", sortOrder: 1 },
      { key: "partner", label: "Partner", color: "#f59e0b", sortOrder: 2 },
      { key: "referral", label: "Referral", color: "#8b5cf6", sortOrder: 3 },
      { key: "outbound", label: "Outbound", color: "#ef4444", sortOrder: 4 },
      { key: "linkedin", label: "LinkedIn", color: "#0a66c2", sortOrder: 5 },
      { key: "instagram", label: "Instagram", color: "#e1306c", sortOrder: 6 },
      { key: "facebook", label: "Facebook", color: "#1877f2", sortOrder: 7 },
      { key: "youtube", label: "YouTube", color: "#ff0033", sortOrder: 8 },
      { key: "whatsapp", label: "WhatsApp", color: "#22c55e", sortOrder: 9 },
      { key: "social_other", label: "Social (Other)", color: "#64748b", sortOrder: 10 }
    ]
  }),
  optionSet({
    setKey: "lead-status",
    moduleKey: "leads",
    kind: "dropdown",
    name: "Lead Status",
    description: "Standard lead qualification states.",
    values: [
      { key: "new", label: "New", color: "#f97316", sortOrder: 0, isDefault: true },
      { key: "working", label: "Working", color: "#0ea5e9", sortOrder: 1 },
      { key: "qualified", label: "Qualified", color: "#14b8a6", sortOrder: 2 },
      { key: "nurturing", label: "Nurturing", color: "#a855f7", sortOrder: 3 },
      { key: "meeting_scheduled", label: "Meeting Scheduled", color: "#0ea5e9", sortOrder: 4 },
      { key: "disqualified", label: "Disqualified", color: "#ef4444", sortOrder: 5 },
      { key: "converted", label: "Converted", color: "#22c55e", sortOrder: 6 }
    ]
  }),
  optionSet({
    setKey: "lead-capture-source",
    moduleKey: "leads",
    kind: "dropdown",
    name: "Lead Capture Source",
    description: "How a lead was captured into the CRM.",
    values: [
      { key: "manual", label: "Manual", sortOrder: 0, isDefault: true },
      { key: "website", label: "Website / Form", sortOrder: 1 },
      { key: "social", label: "Social", sortOrder: 2 },
      { key: "webinar", label: "Webinar / Event", sortOrder: 3 },
      { key: "campaign", label: "Campaign", sortOrder: 4 },
      { key: "partner_referral", label: "Partner Referral", sortOrder: 5 },
      { key: "imported", label: "Imported", sortOrder: 6 },
      { key: "inbound_call", label: "Inbound Call", sortOrder: 7 },
      { key: "outbound_prospect", label: "Outbound Prospect", sortOrder: 8 }
    ]
  }),
  optionSet({
    setKey: "lead-sub-source",
    moduleKey: "leads",
    kind: "dropdown",
    name: "Lead Sub-source",
    description: "Finer-grained lead intake sub-source.",
    values: [
      { key: "web_form", label: "Web Form", sortOrder: 0, isDefault: true },
      { key: "content_download", label: "Content Download", sortOrder: 1 },
      { key: "demo_request", label: "Demo Request", sortOrder: 2 },
      { key: "pricing_request", label: "Pricing Request", sortOrder: 3 },
      { key: "webinar", label: "Webinar", sortOrder: 4 },
      { key: "event", label: "Event", sortOrder: 5 },
      { key: "social_dm", label: "Social DM", sortOrder: 6 },
      { key: "cold_call", label: "Cold Call", sortOrder: 7 },
      { key: "email_reply", label: "Email Reply", sortOrder: 8 }
    ]
  }),
  optionSet({
    setKey: "lead-grade",
    moduleKey: "leads",
    kind: "dropdown",
    name: "Lead Grade",
    description: "A/B/C/D lead grade derived from fit and engagement.",
    values: [
      { key: "a", label: "A", color: "#16a34a", sortOrder: 0 },
      { key: "b", label: "B", color: "#0ea5e9", sortOrder: 1 },
      { key: "c", label: "C", color: "#f59e0b", sortOrder: 2 },
      { key: "d", label: "D", color: "#ef4444", sortOrder: 3, isDefault: true }
    ]
  }),
  optionSet({
    setKey: "qualification-status",
    moduleKey: "leads",
    kind: "dropdown",
    name: "Qualification Status",
    description: "Lead qualification progress.",
    values: [
      { key: "not_started", label: "Not Started", sortOrder: 0, isDefault: true },
      { key: "in_progress", label: "In Progress", sortOrder: 1 },
      { key: "qualified", label: "Qualified", color: "#16a34a", sortOrder: 2 },
      { key: "not_qualified", label: "Not Qualified", color: "#ef4444", sortOrder: 3 }
    ]
  }),
  optionSet({
    setKey: "disqualification-reason",
    moduleKey: "leads",
    kind: "dropdown",
    name: "Disqualification Reason",
    description: "Reason a lead was disqualified.",
    values: [
      { key: "no_budget", label: "No Budget", sortOrder: 0 },
      { key: "no_authority", label: "No Authority", sortOrder: 1 },
      { key: "invalid_contact", label: "Invalid Contact", sortOrder: 2 },
      { key: "wrong_geography", label: "Wrong Geography", sortOrder: 3 },
      { key: "duplicate", label: "Duplicate", sortOrder: 4 },
      { key: "spam", label: "Spam", sortOrder: 5 },
      { key: "not_interested", label: "Not Interested", sortOrder: 6 },
      { key: "future_need", label: "Future Need", sortOrder: 7 },
      { key: "competitor", label: "Competitor", sortOrder: 8 },
      { key: "irrelevant", label: "Irrelevant", sortOrder: 9, isDefault: true }
    ]
  }),
  optionSet({
    setKey: "lead-rejection-reason",
    moduleKey: "leads",
    kind: "dropdown",
    name: "Lead Rejection Reason",
    description:
      "Reason sales rejected a marketing handoff (MM-003/MM-005). Mandatory when handoff status becomes rejected_by_sales; marketing analyses these to improve targeting.",
    values: [
      { key: "poor_fit", label: "Poor Fit", sortOrder: 0, isDefault: true },
      { key: "no_budget", label: "No Budget", sortOrder: 1 },
      { key: "wrong_contact", label: "Wrong Contact", sortOrder: 2 },
      { key: "bad_timing", label: "Bad Timing", sortOrder: 3 },
      { key: "duplicate", label: "Duplicate", sortOrder: 4 },
      { key: "insufficient_context", label: "Insufficient Context", sortOrder: 5 }
    ]
  }),
  optionSet({
    setKey: "social-response-template",
    moduleKey: "social",
    kind: "dropdown",
    name: "Social Response Template",
    description:
      "Brand-approved social response templates (SM-004). `metadata.body` holds the response text; `metadata.sensitive` marks templates that suggest escalation.",
    values: [
      {
        key: "thanks_interest",
        label: "Thanks for the interest",
        sortOrder: 0,
        isDefault: true,
        metadata: { body: "Thank you for your interest! A member of our team will reach out shortly with the details you asked for." }
      },
      {
        key: "demo_offer",
        label: "Offer a demo",
        sortOrder: 1,
        metadata: { body: "We'd love to show you how it works — can we set up a quick personalized demo this week?" }
      },
      {
        key: "pricing_followup",
        label: "Pricing follow-up",
        sortOrder: 2,
        metadata: { body: "Great question on pricing — plans depend on team size and modules. Sharing a summary by DM now." }
      },
      {
        key: "complaint_ack",
        label: "Complaint acknowledgement",
        sortOrder: 3,
        metadata: { body: "We're sorry about the experience. Our support team is looking into this right away and will follow up directly.", sensitive: true }
      },
      {
        key: "support_redirect",
        label: "Redirect to support",
        sortOrder: 4,
        metadata: { body: "So we can resolve this quickly, our support team will take this up — expect a reply within the hour.", sensitive: true }
      }
    ]
  }),
  optionSet({
    setKey: "lead-qualification-checklist",
    moduleKey: "leads",
    kind: "dropdown",
    name: "Lead Qualification Checklist",
    description:
      "Configurable inside-sales qualification checklist items (ISR-004). `metadata.required` items must be completed before a lead can be marked qualified.",
    values: [
      { key: "need", label: "Need identified", sortOrder: 0, isDefault: true, metadata: { required: true } },
      { key: "product_interest", label: "Product interest", sortOrder: 1, metadata: { required: true } },
      { key: "organization_type", label: "Organization type", sortOrder: 2, metadata: { required: false } },
      { key: "location", label: "Location", sortOrder: 3, metadata: { required: false } },
      { key: "decision_authority", label: "Decision authority", sortOrder: 4, metadata: { required: true } },
      { key: "budget_range", label: "Budget range", sortOrder: 5, metadata: { required: true } },
      { key: "timeline", label: "Timeline", sortOrder: 6, metadata: { required: true } },
      { key: "current_solution", label: "Current solution", sortOrder: 7, metadata: { required: false } },
      { key: "meeting_interest", label: "Meeting interest", sortOrder: 8, metadata: { required: true } }
    ]
  }),
  optionSet({
    setKey: "lead-contact-script",
    moduleKey: "leads",
    kind: "dropdown",
    name: "Lead First-Contact Script",
    description:
      "Configurable guided first-contact scripts (ISR-002). `metadata.body` holds the script; optional `metadata.leadFor`/`metadata.sourceKey`/`metadata.personaKey` target it. The most specific match wins.",
    values: [
      {
        key: "default",
        label: "General first-contact script",
        sortOrder: 0,
        isDefault: true,
        metadata: {
          body: "Introduce yourself and the company, confirm you are speaking with the right person, ask what prompted their interest, and confirm need, timeline, and decision process before proposing a next step.",
          required: false
        }
      },
      {
        key: "service_project",
        label: "IT service project discovery",
        sortOrder: 1,
        metadata: {
          leadFor: "service_project",
          body: "Confirm the project scope and current technology stack, identify the business outcome they need, ask about budget range and timeline, and qualify decision authority before booking a technical discovery call.",
          required: false
        }
      },
      {
        key: "product",
        label: "Product interest discovery",
        sortOrder: 2,
        metadata: {
          leadFor: "product",
          body: "Confirm which product caught their attention, ask about team size and current tooling, surface the problem they want to solve, and qualify budget and timeline before booking a product demo.",
          required: false
        }
      },
      {
        key: "inbound_website",
        label: "Inbound website lead",
        sortOrder: 3,
        metadata: {
          sourceKey: "website",
          body: "Thank them for reaching out through the website, reference the page or content they engaged with, confirm what they are evaluating, and qualify need, timeline, and authority before proposing a meeting.",
          required: false
        }
      },
      {
        key: "webinar_followup",
        label: "Webinar follow-up",
        sortOrder: 4,
        metadata: {
          campaignKey: "webinar",
          body: "Reference the webinar they attended, ask which topics were most relevant, confirm the problem they want to solve, and qualify timeline and authority before proposing a tailored demo.",
          required: false
        }
      }
    ]
  }),
  optionSet({
    setKey: "lead-cadence-step",
    moduleKey: "leads",
    kind: "dropdown",
    name: "Lead Contact Cadence",
    description:
      "Configurable inside-sales contact cadence (ISR-003). Each value is a step; `metadata.channel` is the touch type and `metadata.offsetHours` is the offset from cadence start. Sort order defines step order.",
    values: [
      { key: "call_day0", label: "Day 0 — Call", sortOrder: 0, isDefault: true, metadata: { channel: "call", offsetHours: 0 } },
      { key: "email_day1", label: "Day 1 — Email", sortOrder: 1, metadata: { channel: "email", offsetHours: 24 } },
      { key: "whatsapp_day2", label: "Day 2 — WhatsApp", sortOrder: 2, metadata: { channel: "whatsapp", offsetHours: 48 } },
      { key: "linkedin_day4", label: "Day 4 — LinkedIn touch", sortOrder: 3, metadata: { channel: "linkedin", offsetHours: 96 } },
      { key: "call_day6", label: "Day 6 — Call", sortOrder: 4, metadata: { channel: "call", offsetHours: 144 } },
      { key: "follow_up_day8", label: "Day 8 — Follow-up", sortOrder: 5, metadata: { channel: "follow_up", offsetHours: 192 } }
    ]
  }),
  optionSet({
    setKey: "lead-meeting-type",
    moduleKey: "leads",
    kind: "dropdown",
    name: "Lead Meeting Type",
    description: "Configurable meeting types an inside-sales rep can book from a lead (ISR-005).",
    values: [
      { key: "sales", label: "Sales meeting", sortOrder: 0, isDefault: true },
      { key: "presales", label: "Presales / technical", sortOrder: 1 },
      { key: "manager", label: "Manager review", sortOrder: 2 }
    ]
  }),
  optionSet({
    setKey: "lead-discovery-field",
    moduleKey: "leads",
    kind: "dropdown",
    name: "Lead Discovery Field",
    description:
      "Configurable SDR discovery-call fields (SDR-003). `metadata.required` fields must be captured before a lead can be converted.",
    values: [
      { key: "pain", label: "Pain / problem", sortOrder: 0, isDefault: true, metadata: { required: true } },
      { key: "current_process", label: "Current process", sortOrder: 1, metadata: { required: false } },
      { key: "current_vendor", label: "Current vendor", sortOrder: 2, metadata: { required: false } },
      { key: "urgency", label: "Urgency", sortOrder: 3, metadata: { required: true } },
      { key: "budget", label: "Budget", sortOrder: 4, metadata: { required: true } },
      { key: "authority", label: "Authority", sortOrder: 5, metadata: { required: true } },
      { key: "timeline", label: "Timeline", sortOrder: 6, metadata: { required: true } },
      { key: "decision_process", label: "Decision process", sortOrder: 7, metadata: { required: false } },
      { key: "stakeholders", label: "Stakeholders", sortOrder: 8, metadata: { required: false } },
      { key: "success_criteria", label: "Success criteria", sortOrder: 9, metadata: { required: false } },
      { key: "risks", label: "Risks", sortOrder: 10, metadata: { required: false } }
    ]
  }),
  optionSet({
    setKey: "lead-objection-type",
    moduleKey: "leads",
    kind: "dropdown",
    name: "Lead Objection Type",
    description: "Configurable objection categories captured during SDR conversations (SDR-006).",
    values: [
      { key: "price", label: "Price", sortOrder: 0, isDefault: true },
      { key: "timing", label: "Timing", sortOrder: 1 },
      { key: "competitor", label: "Competitor", sortOrder: 2 },
      { key: "authority", label: "Authority", sortOrder: 3 },
      { key: "feature_gap", label: "Feature gap", sortOrder: 4 },
      { key: "integration", label: "Integration", sortOrder: 5 },
      { key: "security", label: "Security", sortOrder: 6 },
      { key: "implementation", label: "Implementation", sortOrder: 7 },
      { key: "unclear_need", label: "Unclear need", sortOrder: 8 }
    ]
  }),
  optionSet({
    setKey: "lead-icp-criterion",
    moduleKey: "leads",
    kind: "dropdown",
    name: "Lead ICP Criterion",
    description:
      "Configurable ICP fit criteria + weights (SDR-002). `metadata.weight` scales each criterion's contribution to the ICP fit score.",
    values: [
      { key: "industry", label: "Industry", sortOrder: 0, isDefault: true, metadata: { weight: 1 } },
      { key: "segment", label: "Segment", sortOrder: 1, metadata: { weight: 1 } },
      { key: "size", label: "Company size", sortOrder: 2, metadata: { weight: 1 } },
      { key: "geography", label: "Geography", sortOrder: 3, metadata: { weight: 1 } },
      { key: "use_case", label: "Use case", sortOrder: 4, metadata: { weight: 1 } },
      { key: "budget", label: "Budget", sortOrder: 5, metadata: { weight: 1 } },
      { key: "strategic_value", label: "Strategic value", sortOrder: 6, metadata: { weight: 2 } }
    ]
  }),
  optionSet({
    setKey: "consent-status",
    moduleKey: "leads",
    kind: "dropdown",
    name: "Consent Status",
    description: "Marketing/communication consent state.",
    values: [
      { key: "unknown", label: "Unknown", sortOrder: 0, isDefault: true },
      { key: "opted_in", label: "Opted In", color: "#16a34a", sortOrder: 1 },
      { key: "opted_out", label: "Opted Out", color: "#ef4444", sortOrder: 2 }
    ]
  }),
  optionSet({
    setKey: "lifecycle-stage",
    moduleKey: "marketing",
    kind: "dropdown",
    name: "Lifecycle Stage",
    description: "Standard lifecycle stages across CRM objects.",
    values: [
      { key: "subscriber", label: "Subscriber", color: "#64748b", sortOrder: 0 },
      { key: "lead", label: "Lead", color: "#f97316", sortOrder: 1, isDefault: true },
      { key: "mql", label: "MQL", color: "#0ea5e9", sortOrder: 2 },
      { key: "sql", label: "SQL", color: "#14b8a6", sortOrder: 3 },
      { key: "opportunity", label: "Opportunity", color: "#8b5cf6", sortOrder: 4 },
      { key: "customer", label: "Customer", color: "#22c55e", sortOrder: 5 },
      { key: "churned", label: "Churned", color: "#ef4444", sortOrder: 6 }
    ]
  }),
  optionSet({
    setKey: "industry",
    moduleKey: "accounts",
    kind: "dropdown",
    name: "Industry",
    description: "Standard account and lead industry values.",
    values: [
      { key: "education", label: "Education", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "technology", label: "Technology", color: "#14b8a6", sortOrder: 1 },
      { key: "healthcare", label: "Healthcare", color: "#22c55e", sortOrder: 2 },
      { key: "financial_services", label: "Financial Services", color: "#8b5cf6", sortOrder: 3 },
      { key: "manufacturing", label: "Manufacturing", color: "#f59e0b", sortOrder: 4 },
      { key: "retail", label: "Retail", color: "#ec4899", sortOrder: 5 },
      { key: "public_sector", label: "Public Sector", color: "#64748b", sortOrder: 6 },
      { key: "other", label: "Other", color: "#475569", sortOrder: 7 }
    ]
  }),
  optionSet({
    setKey: "segment",
    moduleKey: "accounts",
    kind: "dropdown",
    name: "Segment",
    description: "Standard market and customer segments.",
    values: [
      { key: "smb", label: "SMB", color: "#0ea5e9", sortOrder: 0 },
      { key: "mid_market", label: "Mid-Market", color: "#14b8a6", sortOrder: 1, isDefault: true },
      { key: "enterprise", label: "Enterprise", color: "#8b5cf6", sortOrder: 2 },
      { key: "strategic", label: "Strategic", color: "#6366f1", sortOrder: 3 },
      { key: "partner", label: "Partner", color: "#f59e0b", sortOrder: 4 },
      { key: "reseller", label: "Reseller", color: "#64748b", sortOrder: 5 }
    ]
  }),
  optionSet({
    setKey: "region",
    moduleKey: "accounts",
    kind: "dropdown",
    name: "Region",
    description: "Standard territory and region values.",
    values: [
      { key: "north_india", label: "North India", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "south_india", label: "South India", color: "#14b8a6", sortOrder: 1 },
      { key: "west_india", label: "West India", color: "#8b5cf6", sortOrder: 2 },
      { key: "east_india", label: "East India", color: "#f59e0b", sortOrder: 3 },
      { key: "international", label: "International", color: "#64748b", sortOrder: 4 }
    ]
  }),
  optionSet({
    setKey: "product-interest",
    moduleKey: "marketing",
    kind: "dropdown",
    name: "Product Interest",
    description: "Standard product-interest values for leads, campaigns, and products.",
    values: [
      { key: "custom_development", label: "Custom Development", color: "#6366f1", sortOrder: 0, isDefault: true },
      { key: "elite_sis_k12", label: "eLite SIS K12", color: "#0ea5e9", sortOrder: 1 },
      { key: "elite_sis_learn", label: "eLite SIS Learn", color: "#22c55e", sortOrder: 2 },
      { key: "elite_sis_higher_ed", label: "eLite SIS Higher Ed", color: "#8b5cf6", sortOrder: 3 },
      { key: "elite_sis_ci", label: "eLite SIS CI", color: "#f59e0b", sortOrder: 4 },
      { key: "elite_sis_pi", label: "eLite SIS PI", color: "#a855f7", sortOrder: 5 }
    ]
  }),
  optionSet({
    setKey: "opportunity-stage",
    moduleKey: "opportunities",
    kind: "pipeline",
    name: "Opportunity Stage",
    description: "Standard opportunity sales stages.",
    values: [
      { key: "discovery", label: "Discovery", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "qualification", label: "Qualification", color: "#06b6d4", sortOrder: 1 },
      { key: "proposal", label: "Proposal", color: "#f59e0b", sortOrder: 2 },
      { key: "negotiation", label: "Negotiation", color: "#8b5cf6", sortOrder: 3 },
      { key: "closed_won", label: "Closed Won", color: "#22c55e", sortOrder: 4 },
      { key: "closed_lost", label: "Closed Lost", color: "#ef4444", sortOrder: 5 }
    ]
  }),
  optionSet({
    setKey: "opportunity-type",
    moduleKey: "opportunities",
    kind: "dropdown",
    name: "Opportunity Type",
    description: "Standard opportunity type values.",
    values: [
      { key: "new_business", label: "New Business", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "renewal", label: "Renewal", color: "#b45309", sortOrder: 1 },
      { key: "expansion", label: "Expansion", color: "#f97316", sortOrder: 2 },
      { key: "partner_sourced", label: "Partner Sourced", color: "#6366f1", sortOrder: 3 },
      { key: "reseller_sourced", label: "Reseller Sourced", color: "#64748b", sortOrder: 4 }
    ]
  }),
  optionSet({
    setKey: "forecast-category",
    moduleKey: "opportunities",
    kind: "dropdown",
    name: "Forecast Category",
    description: "Standard sales forecast categories.",
    values: [
      { key: "pipeline", label: "Pipeline", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "best_case", label: "Best Case", color: "#8b5cf6", sortOrder: 1 },
      { key: "commit", label: "Commit", color: "#22c55e", sortOrder: 2 },
      { key: "closed", label: "Closed", color: "#14b8a6", sortOrder: 3 },
      { key: "omitted", label: "Omitted", color: "#64748b", sortOrder: 4 }
    ]
  }),
  optionSet({
    setKey: "loss-reason",
    moduleKey: "opportunities",
    kind: "dropdown",
    name: "Loss Reason",
    description: "Standard opportunity loss reasons.",
    values: [
      { key: "budget", label: "Budget", color: "#f59e0b", sortOrder: 0 },
      { key: "no_decision", label: "No Decision", color: "#64748b", sortOrder: 1, isDefault: true },
      { key: "competitor", label: "Competitor", color: "#ef4444", sortOrder: 2 },
      { key: "no_fit", label: "No Fit", color: "#b91c1c", sortOrder: 3 },
      { key: "timing", label: "Timing", color: "#0ea5e9", sortOrder: 4 },
      { key: "other", label: "Other", color: "#475569", sortOrder: 5 }
    ]
  }),
  optionSet({
    setKey: "opportunity-discovery-field",
    moduleKey: "opportunities",
    kind: "dropdown",
    name: "Opportunity Discovery Field",
    description:
      "Configurable AE discovery-call fields (AE-004). `metadata.required` count toward completeness; `metadata.critical` fields block the opportunity from moving forward.",
    values: [
      { key: "business_problem", label: "Business problem", sortOrder: 0, isDefault: true, metadata: { required: true, critical: true } },
      { key: "current_process", label: "Current process", sortOrder: 1, metadata: { required: false, critical: false } },
      { key: "urgency", label: "Urgency", sortOrder: 2, metadata: { required: true, critical: false } },
      { key: "success_metrics", label: "Success metrics", sortOrder: 3, metadata: { required: true, critical: false } },
      { key: "budget", label: "Budget", sortOrder: 4, metadata: { required: true, critical: true } },
      { key: "timeline", label: "Timeline", sortOrder: 5, metadata: { required: true, critical: false } },
      { key: "decision_criteria", label: "Decision criteria", sortOrder: 6, metadata: { required: true, critical: true } },
      { key: "procurement_process", label: "Procurement process", sortOrder: 7, metadata: { required: false, critical: false } },
      { key: "risks", label: "Risks", sortOrder: 8, metadata: { required: false, critical: false } }
    ]
  }),
  optionSet({
    setKey: "opportunity-stakeholder-role",
    moduleKey: "opportunities",
    kind: "dropdown",
    name: "Opportunity Stakeholder Role",
    description: "Buying-committee roles for opportunity stakeholder mapping (AE-003).",
    values: [
      { key: "decision_maker", label: "Decision Maker", sortOrder: 0, isDefault: true },
      { key: "influencer", label: "Influencer", sortOrder: 1 },
      { key: "evaluator", label: "Evaluator", sortOrder: 2 },
      { key: "procurement", label: "Procurement", sortOrder: 3 },
      { key: "finance", label: "Finance", sortOrder: 4 },
      { key: "technical", label: "Technical", sortOrder: 5 },
      { key: "user", label: "User", sortOrder: 6 },
      { key: "executive", label: "Executive", sortOrder: 7 }
    ]
  }),
  optionSet({
    setKey: "opportunity-proposal-template",
    moduleKey: "opportunities",
    kind: "dropdown",
    name: "Opportunity Proposal Template",
    description: "Configurable proposal templates pulled into AE proposal generation (AE-006).",
    values: [
      { key: "standard", label: "Standard proposal", sortOrder: 0, isDefault: true },
      { key: "enterprise", label: "Enterprise proposal", sortOrder: 1 },
      { key: "services", label: "Services / SOW", sortOrder: 2 }
    ]
  }),
  optionSet({
    setKey: "opportunity-tender-checklist",
    moduleKey: "opportunities",
    kind: "dropdown",
    name: "Opportunity Tender Checklist",
    description:
      "Configurable RFP/tender document checklist (ES-003). `metadata.required` items are flagged as missing documents until completed.",
    values: [
      { key: "eligibility_certificate", label: "Eligibility certificate", sortOrder: 0, isDefault: true, metadata: { required: true } },
      { key: "technical_bid", label: "Technical bid", sortOrder: 1, metadata: { required: true } },
      { key: "commercial_bid", label: "Commercial bid", sortOrder: 2, metadata: { required: true } },
      { key: "emd_proof", label: "EMD proof", sortOrder: 3, metadata: { required: true } },
      { key: "compliance_sheet", label: "Compliance sheet", sortOrder: 4, metadata: { required: true } },
      { key: "authorization_letter", label: "Authorization letter", sortOrder: 5, metadata: { required: false } },
      { key: "financial_statements", label: "Financial statements", sortOrder: 6, metadata: { required: false } },
      { key: "experience_certificates", label: "Experience certificates", sortOrder: 7, metadata: { required: false } }
    ]
  }),
  optionSet({
    setKey: "campaign-type",
    moduleKey: "campaigns",
    kind: "dropdown",
    name: "Campaign Type",
    description: "Standard campaign type values.",
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
    ]
  }),
  optionSet({
    setKey: "activity-type",
    moduleKey: "workflows",
    kind: "dropdown",
    name: "Activity Type",
    description: "Standard activity types.",
    values: [
      { key: "task", label: "Task", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "meeting", label: "Meeting", color: "#8b5cf6", sortOrder: 1 },
      { key: "call", label: "Call", color: "#22c55e", sortOrder: 2 },
      { key: "email", label: "Email", color: "#f59e0b", sortOrder: 3 },
      { key: "note", label: "Note", color: "#64748b", sortOrder: 4 }
    ]
  }),
  optionSet({
    setKey: "task-status",
    moduleKey: "workflows",
    kind: "dropdown",
    name: "Task Status",
    description: "Standard task and onboarding-task statuses.",
    values: [
      { key: "not_started", label: "Not Started", color: "#64748b", sortOrder: 0, isDefault: true },
      { key: "in_progress", label: "In Progress", color: "#0ea5e9", sortOrder: 1 },
      { key: "waiting", label: "Waiting", color: "#f59e0b", sortOrder: 2 },
      { key: "completed", label: "Completed", color: "#22c55e", sortOrder: 3 },
      { key: "cancelled", label: "Cancelled", color: "#ef4444", sortOrder: 4 }
    ]
  }),
  optionSet({
    setKey: "ticket-priority",
    moduleKey: "support",
    kind: "dropdown",
    name: "Ticket Priority",
    description: "Standard ticket priority values.",
    values: [
      { key: "low", label: "Low", color: "#64748b", sortOrder: 0 },
      { key: "medium", label: "Medium", color: "#0ea5e9", sortOrder: 1, isDefault: true },
      { key: "high", label: "High", color: "#f59e0b", sortOrder: 2 },
      { key: "urgent", label: "Urgent", color: "#ef4444", sortOrder: 3 }
    ]
  }),
  optionSet({
    setKey: "ticket-status",
    moduleKey: "support",
    kind: "ticket_status",
    name: "Ticket Status",
    description: "Standard ticket lifecycle statuses.",
    values: [
      { key: "new", label: "New", color: "#f97316", sortOrder: 0, isDefault: true },
      { key: "in_progress", label: "In Progress", color: "#0ea5e9", sortOrder: 1 },
      { key: "waiting_on_customer", label: "Waiting on Customer", color: "#f59e0b", sortOrder: 2 },
      { key: "resolved", label: "Resolved", color: "#22c55e", sortOrder: 3 },
      { key: "closed", label: "Closed", color: "#64748b", sortOrder: 4 }
    ]
  }),
  optionSet({
    setKey: "ticket-category",
    moduleKey: "support",
    kind: "dropdown",
    name: "Ticket Category",
    description: "Standard ticket category values.",
    values: [
      { key: "technical", label: "Technical", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "billing", label: "Billing", color: "#8b5cf6", sortOrder: 1 },
      { key: "how_to", label: "How To", color: "#14b8a6", sortOrder: 2 },
      { key: "bug", label: "Bug", color: "#ef4444", sortOrder: 3 },
      { key: "feature_request", label: "Feature Request", color: "#f59e0b", sortOrder: 4 },
      { key: "other", label: "Other", color: "#64748b", sortOrder: 5 }
    ]
  }),
  optionSet({
    setKey: "customer-health-status",
    moduleKey: "customer_success",
    kind: "dropdown",
    name: "Customer Health Status",
    description: "Standard customer health statuses.",
    values: [
      { key: "healthy", label: "Healthy", color: "#22c55e", sortOrder: 0, isDefault: true },
      { key: "watch", label: "Watch", color: "#f59e0b", sortOrder: 1 },
      { key: "at_risk", label: "At Risk", color: "#ef4444", sortOrder: 2 },
      { key: "critical", label: "Critical", color: "#b91c1c", sortOrder: 3 }
    ]
  }),
  optionSet({
    setKey: "partner-tier",
    moduleKey: "partners",
    kind: "dropdown",
    name: "Partner Tier",
    description: "Standard partner tier values.",
    values: [
      { key: "registered", label: "Registered", color: "#64748b", sortOrder: 0, isDefault: true },
      { key: "silver", label: "Silver", color: "#94a3b8", sortOrder: 1 },
      { key: "gold", label: "Gold", color: "#f59e0b", sortOrder: 2 },
      { key: "platinum", label: "Platinum", color: "#8b5cf6", sortOrder: 3 }
    ]
  }),
  optionSet({
    setKey: "partner-status",
    moduleKey: "partners",
    kind: "dropdown",
    name: "Partner Status",
    description: "Standard partner status values.",
    values: [
      { key: "prospect", label: "Prospect", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "active", label: "Active", color: "#22c55e", sortOrder: 1 },
      { key: "suspended", label: "Suspended", color: "#f59e0b", sortOrder: 2 },
      { key: "terminated", label: "Terminated", color: "#ef4444", sortOrder: 3 }
    ]
  }),
  optionSet({
    setKey: "approval-status",
    moduleKey: "approvals",
    kind: "dropdown",
    name: "Approval Status",
    description: "Standard approval status values.",
    values: [
      { key: "draft", label: "Draft", color: "#64748b", sortOrder: 0 },
      { key: "pending", label: "Pending", color: "#0ea5e9", sortOrder: 1, isDefault: true },
      { key: "approved", label: "Approved", color: "#22c55e", sortOrder: 2 },
      { key: "changes_requested", label: "Changes Requested", color: "#f59e0b", sortOrder: 3 },
      { key: "rejected", label: "Rejected", color: "#ef4444", sortOrder: 4 },
      { key: "cancelled", label: "Cancelled", color: "#475569", sortOrder: 5 }
    ]
  }),
  optionSet({
    setKey: "contract-status",
    moduleKey: "opportunities",
    kind: "dropdown",
    name: "Contract Status",
    description: "Standard contract status values.",
    values: [
      { key: "draft", label: "Draft", color: "#64748b", sortOrder: 0, isDefault: true },
      { key: "in_review", label: "In Review", color: "#0ea5e9", sortOrder: 1 },
      { key: "active", label: "Active", color: "#22c55e", sortOrder: 2 },
      { key: "expired", label: "Expired", color: "#f59e0b", sortOrder: 3 },
      { key: "terminated", label: "Terminated", color: "#ef4444", sortOrder: 4 },
      { key: "renewed", label: "Renewed", color: "#14b8a6", sortOrder: 5 }
    ]
  }),
  optionSet({
    setKey: "renewal-status",
    moduleKey: "customer_success",
    kind: "dropdown",
    name: "Renewal Status",
    description: "Standard renewal status values.",
    values: [
      { key: "not_started", label: "Not Started", color: "#64748b", sortOrder: 0, isDefault: true },
      { key: "in_progress", label: "In Progress", color: "#0ea5e9", sortOrder: 1 },
      { key: "forecasted", label: "Forecasted", color: "#06b6d4", sortOrder: 2 },
      { key: "committed", label: "Committed", color: "#8b5cf6", sortOrder: 3 },
      { key: "renewed", label: "Renewed", color: "#22c55e", sortOrder: 4 },
      { key: "churned", label: "Churned", color: "#ef4444", sortOrder: 5 }
    ]
  })
];

export const coreCrmRequiredModuleKeys = coreCrmModuleInputs.map((module) => module.definitionKey);

export const coreCrmRequiredObjectKeys = coreCrmObjectInputs.map((object) => object.objectCode);

export const coreCrmRequiredPicklistKeys = [
  "lead-source",
  "lead-status",
  "lead-capture-source",
  "lead-sub-source",
  "lead-grade",
  "qualification-status",
  "disqualification-reason",
  "lead-rejection-reason",
  "social-response-template",
  "lead-qualification-checklist",
  "lead-contact-script",
  "lead-cadence-step",
  "lead-meeting-type",
  "lead-discovery-field",
  "lead-objection-type",
  "lead-icp-criterion",
  "consent-status",
  "lifecycle-stage",
  "industry",
  "segment",
  "region",
  "product-interest",
  "opportunity-stage",
  "opportunity-type",
  "forecast-category",
  "loss-reason",
  "opportunity-discovery-field",
  "opportunity-stakeholder-role",
  "opportunity-proposal-template",
  "opportunity-tender-checklist",
  "campaign-type",
  "activity-type",
  "task-status",
  "ticket-priority",
  "ticket-status",
  "ticket-category",
  "customer-health-status",
  "partner-tier",
  "partner-status",
  "approval-status",
  "contract-status",
  "renewal-status"
];

export const defaultCoreCrmModuleDefinitions: ConfigurationDefinition[] = coreCrmModuleInputs.map(createModuleDefinition);

export const defaultCoreCrmObjectDefinitions: ConfigurationDefinition[] = coreCrmObjectInputs.map(createObjectDefinition);

export const defaultCoreCrmConfigurationDefinitions: ConfigurationDefinition[] = [
  ...defaultCoreCrmModuleDefinitions,
  ...defaultCoreCrmObjectDefinitions
];
