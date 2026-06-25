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
      field({ key: "companyName", label: "Company", type: "text", required: true }),
      field({ key: "email", label: "Email", type: "email", required: true }),
      field({ key: "phone", label: "Phone", type: "phone" }),
      field({ key: "leadSource", label: "Lead Source", type: "select", optionSetKey: "lead-source" }),
      field({ key: "leadStatus", label: "Lead Status", type: "select", optionSetKey: "lead-status" }),
      field({ key: "lifecycleStage", label: "Lifecycle Stage", type: "select", optionSetKey: "lifecycle-stage" }),
      field({ key: "productInterest", label: "Product Interest", type: "multiselect", optionSetKey: "product-interest" }),
      field({ key: "region", label: "Region", type: "select", optionSetKey: "region" })
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
    description: "Standard lead intake source values.",
    values: [
      { key: "website", label: "Website", color: "#0ea5e9", sortOrder: 0, isDefault: true },
      { key: "campaign", label: "Campaign", color: "#14b8a6", sortOrder: 1 },
      { key: "partner", label: "Partner", color: "#f59e0b", sortOrder: 2 },
      { key: "referral", label: "Referral", color: "#8b5cf6", sortOrder: 3 },
      { key: "outbound", label: "Outbound", color: "#ef4444", sortOrder: 4 }
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
      { key: "disqualified", label: "Disqualified", color: "#ef4444", sortOrder: 4 }
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
  "lifecycle-stage",
  "industry",
  "segment",
  "region",
  "product-interest",
  "opportunity-stage",
  "opportunity-type",
  "forecast-category",
  "loss-reason",
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
