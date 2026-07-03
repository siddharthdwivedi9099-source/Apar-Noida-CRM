// ============================================================================
// Section 15: Role-Based Access Expectations (machine-checkable RBAC contract)
//
// The 14 canonical role groups already exist as governed role templates
// (configuration, not code). This module encodes Section 15's access
// EXPECTATIONS as data: for each role, the permissions its template MUST grant
// (mustAllow) and MUST NOT grant (mustDeny — e.g. "Marketing cannot close
// opportunities"). A pure resolver evaluates a template's permission codes
// against its expectation so drift is caught by tests. This turns the prose
// access matrix into an enforceable, config-driven contract.
// ============================================================================

import { buildPermissionCode, type PermissionActionKey, type PermissionModuleKey } from "./rbac.js";

export interface ModuleActionGrant {
  module: PermissionModuleKey;
  actions: PermissionActionKey[];
}

export interface RoleAccessExpectation {
  role: string;
  // Canonical role template (by slug) that fulfils this Section-15 role group.
  templateSlug: string;
  summary: string;
  mustAllow: ModuleActionGrant[];
  mustDeny: ModuleActionGrant[];
  // Record-visibility scope enforced at query time (persona-access metadata), where relevant.
  recordScope?: "own" | "team" | "all";
}

export interface RoleAccessEvaluation {
  role: string;
  templateSlug: string;
  satisfied: boolean;
  // Required permissions the template is missing.
  missing: string[];
  // Forbidden permissions the template wrongly grants.
  violations: string[];
}

function expand(grants: ModuleActionGrant[]): string[] {
  return grants.flatMap((grant) => grant.actions.map((action) => buildPermissionCode(grant.module, action)));
}

export function evaluateRoleAccessExpectation(
  permissionCodes: string[],
  expectation: RoleAccessExpectation
): RoleAccessEvaluation {
  const granted = new Set(permissionCodes);
  const missing = expand(expectation.mustAllow).filter((code) => !granted.has(code));
  const violations = expand(expectation.mustDeny).filter((code) => granted.has(code));
  return {
    role: expectation.role,
    templateSlug: expectation.templateSlug,
    satisfied: missing.length === 0 && violations.length === 0,
    missing,
    violations
  };
}

const a = (module: PermissionModuleKey, actions: PermissionActionKey[]): ModuleActionGrant => ({ module, actions });

export const roleAccessExpectations: RoleAccessExpectation[] = [
  {
    role: "Marketing",
    templateSlug: "marketing-executive",
    summary: "Create campaigns, view campaign leads, view campaign ROI, manage nurture; cannot close opportunities.",
    mustAllow: [a("campaigns", ["create", "view"]), a("marketing", ["view", "edit"]), a("leads", ["view"]), a("dashboards", ["view_dashboard"])],
    mustDeny: [a("opportunities", ["create", "edit", "approve", "delete"])]
  },
  {
    role: "Inside Sales / SDR / BDR",
    templateSlug: "inside-sales-executive",
    summary: "Work assigned leads, qualify leads, create opportunities, log activities, schedule meetings.",
    mustAllow: [a("leads", ["view", "edit", "create"]), a("opportunities", ["view", "create"]), a("contacts", ["view", "edit"])],
    mustDeny: [a("opportunities", ["approve", "delete", "configure"]), a("admin", ["configure"])]
  },
  {
    role: "Sales",
    templateSlug: "account-executive-sales-executive",
    summary: "Manage assigned opportunities, proposals, activities, contacts, accounts, and closures.",
    mustAllow: [a("opportunities", ["view", "create", "edit"]), a("accounts", ["view", "edit"]), a("contacts", ["view", "edit"]), a("sales", ["view"])],
    mustDeny: [a("opportunities", ["configure"]), a("admin", ["configure"])]
  },
  {
    role: "Sales Manager",
    templateSlug: "sales-manager",
    summary: "View team records, reassign leads/opportunities, approve limited discounts, conduct deal reviews.",
    mustAllow: [a("leads", ["view", "assign"]), a("opportunities", ["view", "assign"]), a("approvals", ["approve"]), a("dashboards", ["view_dashboard"])],
    mustDeny: [a("admin", ["configure"])],
    recordScope: "team"
  },
  {
    role: "Sales Head",
    templateSlug: "sales-head",
    summary: "View all sales data, approve strategic deals, approve high discounts, configure revenue governance.",
    mustAllow: [a("opportunities", ["view", "approve", "configure"]), a("approvals", ["approve", "configure"]), a("sales", ["view"])],
    mustDeny: [a("admin", ["configure"])],
    recordScope: "all"
  },
  {
    role: "Presales",
    templateSlug: "presales-executive",
    summary: "View assigned opportunities, demo requests, solution data, and proposal inputs.",
    mustAllow: [a("presales", ["view"]), a("opportunities", ["view"])],
    mustDeny: [a("opportunities", ["approve", "delete", "configure"])]
  },
  {
    role: "Finance",
    templateSlug: "commercial-finance-approver",
    summary: "View commercial fields, quotes, discounts, payment terms, and commissions.",
    mustAllow: [a("opportunities", ["view"]), a("approvals", ["view", "approve"])],
    mustDeny: [a("opportunities", ["create", "delete", "configure"]), a("admin", ["configure"])]
  },
  {
    role: "Legal",
    templateSlug: "legal-contract-reviewer",
    summary: "View contracts, legal review requests, clause deviations, and approval status.",
    mustAllow: [a("approvals", ["view", "approve"]), a("opportunities", ["view"])],
    mustDeny: [a("opportunities", ["create", "delete", "configure"]), a("admin", ["configure"])]
  },
  {
    role: "Support",
    templateSlug: "support-executive",
    summary: "View customer accounts, tickets, knowledge base, and support history.",
    mustAllow: [a("support", ["view"]), a("accounts", ["view"])],
    mustDeny: [a("opportunities", ["view", "edit"]), a("leads", ["edit"])]
  },
  {
    role: "Customer Success",
    templateSlug: "customer-success-manager-scaled",
    summary: "View customers, onboarding, usage, support history, renewal, health, and expansion signals.",
    mustAllow: [a("customer_success", ["view"]), a("accounts", ["view"]), a("support", ["view"])],
    mustDeny: [a("opportunities", ["edit", "approve"]), a("admin", ["configure"])]
  },
  {
    role: "Partner",
    templateSlug: "reseller-partner-sales-user",
    summary: "View only own partner records, registered deals, approved opportunities, resources, and commission status.",
    mustAllow: [a("partners", ["view"]), a("opportunities", ["view"])],
    mustDeny: [a("partners", ["configure", "delete"]), a("leads", ["view", "edit"]), a("admin", ["view", "configure"])],
    recordScope: "own"
  },
  {
    role: "Customer Portal User",
    templateSlug: "customer-portal-user",
    summary: "View own tickets, onboarding tasks, shared documents, knowledge articles, and permitted account records.",
    mustAllow: [a("customer_portal", ["view"])],
    mustDeny: [a("leads", ["view"]), a("opportunities", ["view"]), a("sales", ["view"]), a("admin", ["view"])],
    recordScope: "own"
  },
  {
    role: "Admin",
    templateSlug: "crm-admin",
    summary: "Configure modules, objects, roles, workflows, fields, automations, approvals, and dashboards.",
    mustAllow: [a("admin", ["configure"]), a("workflows", ["manage_workflow"]), a("approvals", ["configure"]), a("dashboards", ["view_dashboard"])],
    mustDeny: []
  },
  {
    role: "AI Governance",
    templateSlug: "ai-governance-manager",
    summary: "View AI logs, prompts, use cases, approvals, feedback, confidence scores, and AI risk incidents.",
    mustAllow: [a("ai", ["view"]), a("approvals", ["view"])],
    mustDeny: [a("admin", ["configure"]), a("leads", ["edit"]), a("opportunities", ["edit"])]
  }
];

export function findRoleAccessExpectation(role: string): RoleAccessExpectation | undefined {
  return roleAccessExpectations.find((entry) => entry.role === role);
}
