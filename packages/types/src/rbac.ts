export const permissionActionKeys = [
  "view",
  "create",
  "edit",
  "delete",
  "assign",
  "approve",
  "export",
  "import",
  "configure",
  "use_ai",
  "manage_ai",
  "view_dashboard",
  "manage_workflow"
] as const;

export type PermissionActionKey = (typeof permissionActionKeys)[number];

export const permissionModuleKeys = [
  "leads",
  "accounts",
  "contacts",
  "opportunities",
  "campaigns",
  "social",
  "marketing",
  "sales",
  "business_development",
  "presales",
  "partners",
  "resellers",
  "support",
  "customer_success",
  "training",
  "customer_query",
  "customer_portal",
  "dashboards",
  "notifications",
  "approvals",
  "workflows",
  "ai",
  "admin"
] as const;

export type PermissionModuleKey = (typeof permissionModuleKeys)[number];

export const permissionModuleLabels: Record<PermissionModuleKey, string> = {
  leads: "Leads",
  accounts: "Accounts",
  contacts: "Contacts",
  opportunities: "Opportunities",
  campaigns: "Campaigns",
  social: "Social",
  marketing: "Marketing",
  sales: "Sales",
  business_development: "Business Development",
  presales: "Presales",
  partners: "Partners",
  resellers: "Resellers",
  support: "Support",
  customer_success: "Customer Success",
  training: "Training",
  customer_query: "Customer Query",
  customer_portal: "Customer Portal",
  dashboards: "Dashboards",
  notifications: "Notifications",
  approvals: "Approvals",
  workflows: "Workflows",
  ai: "AI",
  admin: "Admin"
};

export const permissionActionLabels: Record<PermissionActionKey, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  assign: "Assign",
  approve: "Approve",
  export: "Export",
  import: "Import",
  configure: "Configure",
  use_ai: "Use AI",
  manage_ai: "Manage AI",
  view_dashboard: "View Dashboard",
  manage_workflow: "Manage Workflow"
};

export interface PermissionCatalogDefinition {
  code: string;
  moduleKey: PermissionModuleKey;
  moduleLabel: string;
  actionKey: PermissionActionKey;
  actionLabel: string;
  description: string;
}

export interface RoleTemplateDefinition {
  key: string;
  slug: string;
  name: string;
  description: string;
  permissionCodes: string[];
  metadata: Record<string, unknown>;
}

function titleCaseFromKebabOrSnake(value: string) {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function slugifyRoleName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function createPermissionDescription(moduleKey: PermissionModuleKey, actionKey: PermissionActionKey) {
  const moduleLabel = permissionModuleLabels[moduleKey];

  switch (actionKey) {
    case "view":
      return `View ${moduleLabel} records and workspace surfaces.`;
    case "create":
      return `Create new ${moduleLabel} records and entries.`;
    case "edit":
      return `Update ${moduleLabel} records and content.`;
    case "delete":
      return `Delete or archive ${moduleLabel} records.`;
    case "assign":
      return `Assign ${moduleLabel} ownership, queues, or linked responsibilities.`;
    case "approve":
      return `Approve ${moduleLabel} changes or stage transitions.`;
    case "export":
      return `Export ${moduleLabel} data and reports.`;
    case "import":
      return `Import ${moduleLabel} data through approved flows.`;
    case "configure":
      return `Configure ${moduleLabel} settings, policies, and defaults.`;
    case "use_ai":
      return `Use AI assistance within ${moduleLabel} workflows.`;
    case "manage_ai":
      return `Configure or govern AI behavior for ${moduleLabel}.`;
    case "view_dashboard":
      return `View ${moduleLabel} dashboards and reporting views.`;
    case "manage_workflow":
      return `Manage ${moduleLabel} workflow rules and automations.`;
    default:
      return `Access ${moduleLabel}.`;
  }
}

export function buildPermissionCode(
  moduleKey: PermissionModuleKey,
  actionKey: PermissionActionKey
) {
  return `${moduleKey}.${actionKey}`;
}

export const defaultPermissionCatalog: PermissionCatalogDefinition[] = permissionModuleKeys.flatMap(
  (moduleKey) =>
    permissionActionKeys.map((actionKey) => ({
      code: buildPermissionCode(moduleKey, actionKey),
      moduleKey,
      moduleLabel: permissionModuleLabels[moduleKey],
      actionKey,
      actionLabel: permissionActionLabels[actionKey],
      description: createPermissionDescription(moduleKey, actionKey)
    }))
);

function permissionsForModules(
  modules: PermissionModuleKey[],
  actions: PermissionActionKey[]
) {
  return modules.flatMap((moduleKey) => actions.map((actionKey) => buildPermissionCode(moduleKey, actionKey)));
}

function createRoleTemplateDefinition(input: {
  name: string;
  description: string;
  permissionCodes: string[];
  metadata?: Record<string, unknown>;
}) {
  const slug = slugifyRoleName(input.name);

  return {
    key: slug,
    slug,
    name: input.name,
    description: input.description,
    permissionCodes: unique(input.permissionCodes).sort((left, right) => left.localeCompare(right)),
    metadata: {
      seeded: true,
      displayLabel: titleCaseFromKebabOrSnake(slug),
      ...(input.metadata ?? {})
    }
  } satisfies RoleTemplateDefinition;
}

const contributorActions: PermissionActionKey[] = ["view", "create", "edit", "export"];
const managerActions: PermissionActionKey[] = [
  "view",
  "create",
  "edit",
  "delete",
  "assign",
  "approve",
  "export",
  "import",
  "configure"
];
const leadershipActions: PermissionActionKey[] = ["view", "approve", "export", "configure"];

const dashboardViewerPermissions = [buildPermissionCode("dashboards", "view_dashboard")];
const workflowManagerPermissions = [buildPermissionCode("workflows", "manage_workflow")];
const notificationParticipantPermissions = permissionsForModules(["notifications"], ["view", "edit"]);
const approvalViewerPermissions = permissionsForModules(["approvals"], ["view"]);
const approvalOperatorPermissions = permissionsForModules(
  ["approvals"],
  ["view", "create", "edit", "assign", "approve", "export"]
);
const approvalLeaderPermissions = permissionsForModules(
  ["approvals"],
  ["view", "approve", "export", "configure"]
);
const aiUserPermissions = [buildPermissionCode("ai", "view"), buildPermissionCode("ai", "use_ai")];
const customerPortalUserPermissions = [
  buildPermissionCode("customer_portal", "view"),
  buildPermissionCode("customer_portal", "create"),
  buildPermissionCode("customer_portal", "edit"),
  buildPermissionCode("customer_portal", "use_ai")
];
const aiManagerPermissions = [
  buildPermissionCode("ai", "view"),
  buildPermissionCode("ai", "use_ai"),
  buildPermissionCode("ai", "manage_ai"),
  buildPermissionCode("ai", "configure")
];
const adminViewerPermissions = [buildPermissionCode("admin", "view")];
const adminOperatorPermissions = permissionsForModules(
  ["admin"],
  ["view", "create", "edit", "delete", "assign", "approve", "export", "import", "configure"]
);

export const defaultRoleTemplateDefinitions: RoleTemplateDefinition[] = [
  createRoleTemplateDefinition({
    name: "Super Admin",
    description: "Full tenant-wide access across administration, AI governance, reporting, and business modules.",
    permissionCodes: defaultPermissionCatalog.map((permission) => permission.code),
    metadata: {
      profile: "tenant-super-admin"
    }
  }),
  createRoleTemplateDefinition({
    name: "CRM Admin",
    description: "Tenant administrator for role management, configuration, reporting, and operational modules.",
    permissionCodes: unique([
      ...permissionsForModules(
        permissionModuleKeys.filter((moduleKey) => moduleKey !== "ai"),
        [...managerActions, "view_dashboard", "manage_workflow"]
      ),
      ...adminOperatorPermissions,
      ...aiManagerPermissions
    ]),
    metadata: {
      profile: "tenant-admin"
    }
  }),
  createRoleTemplateDefinition({
    name: "Customer Portal User",
    description: "External customer access to their own account tickets, training, approved knowledge, and portal AI.",
    permissionCodes: customerPortalUserPermissions,
    metadata: {
      profile: "customer-portal-user",
      audience: "customer"
    }
  }),
  createRoleTemplateDefinition({
    name: "Social Media Marketing Executive",
    description: "Executes social campaigns, content workflows, and campaign reporting.",
    permissionCodes: unique([
      ...permissionsForModules(["social", "campaigns", "marketing"], contributorActions),
      ...notificationParticipantPermissions,
      ...approvalViewerPermissions,
      ...dashboardViewerPermissions,
      ...aiUserPermissions
    ]),
    metadata: {
      department: "marketing"
    }
  }),
  createRoleTemplateDefinition({
    name: "Social Media Marketing Manager",
    description: "Leads social campaign planning, approvals, workflow orchestration, and reporting.",
    permissionCodes: unique([
      ...permissionsForModules(["social", "campaigns", "marketing"], managerActions),
      ...notificationParticipantPermissions,
      ...approvalOperatorPermissions,
      ...dashboardViewerPermissions,
      ...workflowManagerPermissions,
      ...aiManagerPermissions
    ]),
    metadata: {
      department: "marketing"
    }
  }),
  createRoleTemplateDefinition({
    name: "Marketing Executive",
    description: "Runs marketing execution, campaign delivery, and supporting analysis.",
    permissionCodes: unique([
      ...permissionsForModules(["marketing", "campaigns"], contributorActions),
      ...notificationParticipantPermissions,
      ...approvalViewerPermissions,
      ...dashboardViewerPermissions,
      ...aiUserPermissions
    ]),
    metadata: {
      department: "marketing"
    }
  }),
  createRoleTemplateDefinition({
    name: "Marketing Manager",
    description: "Owns marketing strategy, approvals, and operational configuration.",
    permissionCodes: unique([
      ...permissionsForModules(["marketing", "campaigns"], managerActions),
      ...notificationParticipantPermissions,
      ...approvalOperatorPermissions,
      ...dashboardViewerPermissions,
      ...workflowManagerPermissions,
      ...aiManagerPermissions
    ]),
    metadata: {
      department: "marketing"
    }
  }),
  createRoleTemplateDefinition({
    name: "Inside Sales Executive",
    description: "Works leads, contacts, and opportunity qualification within the sales motion.",
    permissionCodes: unique([
      ...permissionsForModules(["leads", "contacts", "opportunities", "sales"], contributorActions),
      ...notificationParticipantPermissions,
      ...approvalViewerPermissions,
      ...dashboardViewerPermissions,
      ...aiUserPermissions
    ]),
    metadata: {
      department: "sales"
    }
  }),
  createRoleTemplateDefinition({
    name: "Inside Sales Manager",
    description: "Manages inside-sales execution, approvals, assignments, and workflow tuning.",
    permissionCodes: unique([
      ...permissionsForModules(["leads", "contacts", "opportunities", "sales"], managerActions),
      ...notificationParticipantPermissions,
      ...approvalOperatorPermissions,
      ...dashboardViewerPermissions,
      ...workflowManagerPermissions,
      ...aiManagerPermissions
    ]),
    metadata: {
      department: "sales"
    }
  }),
  createRoleTemplateDefinition({
    name: "Sales Development Representative",
    description: "Qualifies leads and progresses early-stage opportunities.",
    permissionCodes: unique([
      ...permissionsForModules(["leads", "contacts", "opportunities"], contributorActions),
      ...notificationParticipantPermissions,
      ...approvalViewerPermissions,
      ...dashboardViewerPermissions,
      ...aiUserPermissions
    ]),
    metadata: {
      department: "sales"
    }
  }),
  createRoleTemplateDefinition({
    name: "SDR Manager",
    description: "Coordinates SDR teams, queue assignment, approvals, and lead workflow management.",
    permissionCodes: unique([
      ...permissionsForModules(["leads", "contacts", "opportunities"], managerActions),
      ...notificationParticipantPermissions,
      ...approvalOperatorPermissions,
      ...dashboardViewerPermissions,
      ...workflowManagerPermissions,
      ...aiManagerPermissions
    ]),
    metadata: {
      department: "sales"
    }
  }),
  createRoleTemplateDefinition({
    name: "Business Development Executive",
    description: "Develops new pipeline across leads, accounts, contacts, and channel motions.",
    permissionCodes: unique([
      ...permissionsForModules(
        ["business_development", "leads", "accounts", "contacts", "opportunities", "partners", "resellers"],
        contributorActions
      ),
      ...notificationParticipantPermissions,
      ...approvalViewerPermissions,
      ...dashboardViewerPermissions,
      ...aiUserPermissions
    ]),
    metadata: {
      department: "sales"
    }
  }),
  createRoleTemplateDefinition({
    name: "Business Development Manager",
    description: "Leads business development planning, approvals, partner-facing execution, and workflows.",
    permissionCodes: unique([
      ...permissionsForModules(
        ["business_development", "leads", "accounts", "contacts", "opportunities", "partners", "resellers"],
        managerActions
      ),
      ...notificationParticipantPermissions,
      ...approvalOperatorPermissions,
      ...dashboardViewerPermissions,
      ...workflowManagerPermissions,
      ...aiManagerPermissions
    ]),
    metadata: {
      department: "sales"
    }
  }),
  createRoleTemplateDefinition({
    name: "Sales Executive",
    description: "Runs day-to-day account, contact, opportunity, and sales execution.",
    permissionCodes: unique([
      ...permissionsForModules(["sales", "accounts", "contacts", "opportunities"], contributorActions),
      ...notificationParticipantPermissions,
      ...approvalViewerPermissions,
      ...dashboardViewerPermissions,
      ...aiUserPermissions
    ]),
    metadata: {
      department: "sales"
    }
  }),
  createRoleTemplateDefinition({
    name: "Sales Manager",
    description: "Owns team-level revenue execution, approvals, assignments, and forecast operations.",
    permissionCodes: unique([
      ...permissionsForModules(["sales", "accounts", "contacts", "opportunities", "leads"], managerActions),
      ...notificationParticipantPermissions,
      ...approvalOperatorPermissions,
      ...dashboardViewerPermissions,
      ...workflowManagerPermissions,
      ...aiManagerPermissions
    ]),
    metadata: {
      department: "sales"
    }
  }),
  createRoleTemplateDefinition({
    name: "Sales Head",
    description: "Provides broad revenue governance, approval authority, and high-level reporting visibility.",
    permissionCodes: unique([
      ...permissionsForModules(["sales", "accounts", "contacts", "opportunities", "leads"], leadershipActions),
      ...permissionsForModules(["marketing"], ["view", "export"]),
      ...notificationParticipantPermissions,
      ...approvalLeaderPermissions,
      ...dashboardViewerPermissions,
      ...workflowManagerPermissions,
      ...aiManagerPermissions
    ]),
    metadata: {
      department: "sales"
    }
  }),
  createRoleTemplateDefinition({
    name: "Sales Leader",
    description: "Leads strategic sales oversight with broad reporting and workflow governance.",
    permissionCodes: unique([
      ...permissionsForModules(["sales", "accounts", "contacts", "opportunities"], leadershipActions),
      ...permissionsForModules(["leads"], ["view", "export", "approve"]),
      ...notificationParticipantPermissions,
      ...approvalLeaderPermissions,
      ...dashboardViewerPermissions,
      ...workflowManagerPermissions,
      ...aiManagerPermissions
    ]),
    metadata: {
      department: "sales"
    }
  }),
  createRoleTemplateDefinition({
    name: "Presales Executive",
    description: "Supports opportunities with technical discovery, account context, and presales delivery.",
    permissionCodes: unique([
      ...permissionsForModules(["presales", "accounts", "contacts", "opportunities"], contributorActions),
      ...notificationParticipantPermissions,
      ...approvalViewerPermissions,
      ...dashboardViewerPermissions,
      ...aiUserPermissions
    ]),
    metadata: {
      department: "presales"
    }
  }),
  createRoleTemplateDefinition({
    name: "Presales Manager",
    description: "Guides presales delivery, approvals, staffing, and reusable workflow setup.",
    permissionCodes: unique([
      ...permissionsForModules(["presales", "accounts", "contacts", "opportunities"], managerActions),
      ...notificationParticipantPermissions,
      ...approvalOperatorPermissions,
      ...dashboardViewerPermissions,
      ...workflowManagerPermissions,
      ...aiManagerPermissions
    ]),
    metadata: {
      department: "presales"
    }
  }),
  createRoleTemplateDefinition({
    name: "Support Executive",
    description: "Handles support requests, customer queries, and related customer context.",
    permissionCodes: unique([
      ...permissionsForModules(["support", "customer_query", "accounts", "contacts"], contributorActions),
      ...notificationParticipantPermissions,
      ...approvalViewerPermissions,
      ...dashboardViewerPermissions,
      ...aiUserPermissions
    ]),
    metadata: {
      department: "support"
    }
  }),
  createRoleTemplateDefinition({
    name: "Support Manager",
    description: "Oversees support operations, approvals, customer escalations, and service workflows.",
    permissionCodes: unique([
      ...permissionsForModules(["support", "customer_query", "accounts", "contacts"], managerActions),
      ...permissionsForModules(["customer_success"], ["view", "assign", "approve", "export"]),
      ...notificationParticipantPermissions,
      ...approvalOperatorPermissions,
      ...dashboardViewerPermissions,
      ...workflowManagerPermissions,
      ...aiManagerPermissions
    ]),
    metadata: {
      department: "support"
    }
  }),
  createRoleTemplateDefinition({
    name: "Partner Manager",
    description: "Manages partner-facing relationships, partner pipeline, and associated reporting.",
    permissionCodes: unique([
      ...permissionsForModules(["partners", "accounts", "opportunities"], managerActions),
      ...notificationParticipantPermissions,
      ...approvalOperatorPermissions,
      ...dashboardViewerPermissions,
      ...aiManagerPermissions
    ]),
    metadata: {
      department: "partnerships"
    }
  }),
  createRoleTemplateDefinition({
    name: "Reseller Manager",
    description: "Manages reseller operations, reseller-linked opportunities, and reporting.",
    permissionCodes: unique([
      ...permissionsForModules(["resellers", "accounts", "opportunities"], managerActions),
      ...notificationParticipantPermissions,
      ...approvalOperatorPermissions,
      ...dashboardViewerPermissions,
      ...aiManagerPermissions
    ]),
    metadata: {
      department: "partnerships"
    }
  }),
  createRoleTemplateDefinition({
    name: "Customer Success Manager - Onboarding",
    description: "Owns onboarding execution, enablement, and initial customer success workflows.",
    permissionCodes: unique([
      ...permissionsForModules(["customer_success", "training", "accounts", "contacts"], managerActions),
      ...permissionsForModules(["support"], ["view", "assign", "approve", "export"]),
      ...notificationParticipantPermissions,
      ...approvalOperatorPermissions,
      ...dashboardViewerPermissions,
      ...workflowManagerPermissions,
      ...aiManagerPermissions
    ]),
    metadata: {
      department: "customer-success",
      segment: "onboarding"
    }
  }),
  createRoleTemplateDefinition({
    name: "Customer Success Manager - Scaled",
    description: "Runs scaled customer success motions, health management, and retention operations.",
    permissionCodes: unique([
      ...permissionsForModules(["customer_success", "accounts"], managerActions),
      ...permissionsForModules(["training", "customer_query"], ["view", "edit", "export"]),
      ...notificationParticipantPermissions,
      ...approvalOperatorPermissions,
      ...dashboardViewerPermissions,
      ...workflowManagerPermissions,
      ...aiManagerPermissions
    ]),
    metadata: {
      department: "customer-success",
      segment: "scaled"
    }
  }),
  createRoleTemplateDefinition({
    name: "Customer Success Manager - Enterprise",
    description: "Leads enterprise success operations across health, escalations, and account coordination.",
    permissionCodes: unique([
      ...permissionsForModules(["customer_success", "support", "accounts", "contacts"], managerActions),
      ...permissionsForModules(["training"], ["view", "edit", "assign", "approve", "export"]),
      ...notificationParticipantPermissions,
      ...approvalOperatorPermissions,
      ...dashboardViewerPermissions,
      ...workflowManagerPermissions,
      ...aiManagerPermissions
    ]),
    metadata: {
      department: "customer-success",
      segment: "enterprise"
    }
  }),
  createRoleTemplateDefinition({
    name: "Customer Success Head",
    description: "Provides cross-segment success governance, approval authority, and operational oversight.",
    permissionCodes: unique([
      ...permissionsForModules(["customer_success", "support", "training", "accounts"], leadershipActions),
      ...permissionsForModules(["contacts", "customer_query"], ["view", "approve", "export"]),
      ...notificationParticipantPermissions,
      ...approvalLeaderPermissions,
      ...dashboardViewerPermissions,
      ...workflowManagerPermissions,
      ...aiManagerPermissions
    ]),
    metadata: {
      department: "customer-success"
    }
  }),
  createRoleTemplateDefinition({
    name: "Executive Leadership",
    description: "Leadership visibility into core business performance, AI adoption, and operational reporting.",
    permissionCodes: unique([
      ...permissionsForModules(
        ["dashboards", "sales", "marketing", "customer_success", "support", "accounts", "opportunities"],
        ["view", "export", "view_dashboard"]
      ),
      ...notificationParticipantPermissions,
      ...approvalLeaderPermissions,
      ...permissionsForModules(["ai"], ["view", "use_ai"]),
      ...adminViewerPermissions
    ]),
    metadata: {
      department: "leadership"
    }
  })
];
