import { describe, expect, it } from "vitest";
import {
  defaultPersonaAccessConfigurationDefinitions,
  defaultPersonaAccessPolicyDefinitions,
  defaultPersonaDefinitions,
  defaultPersonaRolePageLayoutDefinitions,
  defaultRoleTemplateDefinitions,
  personaAccessRequiredPersonaKeys,
  personaAccessRequiredRoleTemplateSlugs,
  personaFieldPermissionStates,
  personaLayoutObjectKeys,
  personaObjectPermissionActions,
  personaRecordScopes,
  personaSpecialActionPermissions,
  validateConfigurationDefinitions
} from "@crm/types";

type PersonaPayload = {
  personaKey: string;
  roleTemplateSlug: string;
  label: string;
  objectPermissions: Record<string, string[]>;
  fieldPermissions: Record<string, Record<string, string>>;
  recordScopes: string[];
  specialActions: string[];
  securityNotes: string[];
};

type AccessPolicyPayload = {
  policyKey: string;
  personas: string[];
  objectPermissions: Record<string, string[]>;
  fieldPermissions: Record<string, Record<string, string>>;
  recordScopes: string[];
  specialActions: string[];
  sensitiveDataRules: string[];
};

const requestedPersonaLabels = [
  "Social Media Marketing Executive",
  "Digital Marketing Executive",
  "Marketing Manager",
  "Campaign Manager",
  "Marketing Operations / RevOps",
  "Inside Sales Representative",
  "Sales Development Representative",
  "Business Development Representative",
  "Account Executive / Sales Executive",
  "Enterprise Sales / Strategic Sales",
  "Business Development Manager",
  "Sales Manager",
  "Sales Head / Revenue Leader",
  "Presales Consultant",
  "Solution Architect",
  "Proposal / Bid Manager",
  "Commercial / Finance Approver",
  "Legal / Contract Reviewer",
  "Partner Manager",
  "Reseller / Partner Sales User",
  "Support Agent L1",
  "Support Agent L2",
  "Support Manager",
  "Customer Success Manager - Onboarding",
  "Customer Success Manager - Scaled",
  "Customer Success Manager - Enterprise",
  "Customer / Prospect Portal User",
  "CRM Administrator",
  "System Administrator",
  "AI Governance Manager",
  "Data Quality Manager",
  "Executive / CEO / CXO"
];

function persona(key: string) {
  const definition = defaultPersonaDefinitions.find((item) => item.definitionKey === key);
  if (!definition) {
    throw new Error(`Missing persona ${key}`);
  }
  return definition.definition as PersonaPayload;
}

function policyFor(personaKey: string) {
  const definition = defaultPersonaAccessPolicyDefinitions.find((item) => item.definitionKey === `${personaKey}.access-policy`);
  if (!definition) {
    throw new Error(`Missing access policy ${personaKey}`);
  }
  return definition.definition as AccessPolicyPayload;
}

describe("persona access metadata catalog", () => {
  it("registers the requested personas through configuration definitions", () => {
    expect(defaultPersonaDefinitions).toHaveLength(requestedPersonaLabels.length);
    expect(defaultPersonaDefinitions.map((definition) => definition.name)).toEqual(requestedPersonaLabels);
    expect(defaultPersonaDefinitions.every((definition) => definition.definitionType === "persona")).toBe(true);
    expect(personaAccessRequiredPersonaKeys).toHaveLength(32);
  });

  it("links every persona to a seeded role template", () => {
    const roleSlugs = new Set(defaultRoleTemplateDefinitions.map((template) => template.slug));
    expect(personaAccessRequiredRoleTemplateSlugs).toHaveLength(32);
    for (const roleTemplateSlug of personaAccessRequiredRoleTemplateSlugs) {
      expect(roleSlugs.has(roleTemplateSlug)).toBe(true);
    }
  });

  it("keeps persona access definitions valid for configuration-engine publish/apply", () => {
    const result = validateConfigurationDefinitions(defaultPersonaAccessConfigurationDefinitions);
    expect(result.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("configures the full permission model vocabulary", () => {
    expect(personaObjectPermissionActions).toEqual(["create", "read", "update", "delete", "export", "import", "assign", "approve"]);
    expect(personaFieldPermissionStates).toEqual(["visible", "hidden", "read_only", "editable", "masked"]);
    expect(personaRecordScopes).toEqual([
      "own_records",
      "team_records",
      "territory_records",
      "business_unit_records",
      "all_records",
      "partner_owned_records_only",
      "customer_portal_records_only"
    ]);
    expect(personaSpecialActionPermissions).toEqual([
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
    ]);
  });

  it("configures role-based page layouts for every requested persona and object surface", () => {
    expect(defaultPersonaRolePageLayoutDefinitions).toHaveLength(defaultPersonaDefinitions.length * personaLayoutObjectKeys.length);
    const layoutKeys = new Set(defaultPersonaRolePageLayoutDefinitions.map((definition) => definition.definitionKey));
    for (const personaKey of personaAccessRequiredPersonaKeys) {
      for (const objectKey of personaLayoutObjectKeys) {
        expect(layoutKeys.has(`${personaKey}.${objectKey}.layout`)).toBe(true);
      }
    }
  });

  it("limits partner users to partner-owned records and approved collaboration data", () => {
    const partner = policyFor("reseller-partner-sales-user");
    expect(partner.recordScopes).toEqual(["partner_owned_records_only"]);
    expect(Object.keys(partner.objectPermissions).sort()).toEqual([
      "account",
      "contact",
      "knowledge_article",
      "opportunity",
      "partner",
      "partner_deal_registration",
      "partner_user",
      "shared_document"
    ]);
    expect(partner.recordScopes.includes("all_records")).toBe(false);
    expect(partner.fieldPermissions.partner_commission?.payoutAmount).not.toBe("visible");
    expect(partner.fieldPermissions.opportunity.commercialMargin).toBe("hidden");
    expect(persona("reseller-partner-sales-user").securityNotes.join(" ")).toContain("own partner records");
  });

  it("limits customer portal users to their own portal-safe objects", () => {
    const customer = policyFor("customer-prospect-portal-user");
    expect(customer.recordScopes).toEqual(["customer_portal_records_only"]);
    expect(Object.keys(customer.objectPermissions).sort()).toEqual([
      "knowledge_article",
      "onboarding_task",
      "shared_document",
      "support_ticket"
    ]);
    expect(customer.fieldPermissions.support_ticket.internalNotes).toBe("hidden");
    expect(customer.fieldPermissions.support_ticket.slaBreachReason).toBe("hidden");
    expect(customer.recordScopes.includes("all_records")).toBe(false);
  });

  it("keeps support users away from sensitive commercial margin permissions", () => {
    for (const personaKey of ["support-agent-l1", "support-agent-l2", "support-manager"]) {
      const support = policyFor(personaKey);
      expect(support.specialActions).not.toContain("approve_discount");
      expect(support.specialActions).not.toContain("export_sensitive_data");
      expect(support.fieldPermissions.opportunity.commercialMargin).toBe("hidden");
      expect(support.fieldPermissions.quote.commercialMargin).toBe("hidden");
      expect(support.fieldPermissions.partner_commission.payoutAmount).toBe("hidden");
    }
  });

  it("separates finance, legal, AI governance, and executive access concerns", () => {
    const finance = policyFor("commercial-finance-approver");
    expect(finance.objectPermissions.quote).toContain("approve");
    expect(finance.specialActions).toContain("approve_discount");
    expect(finance.fieldPermissions.quote.commercialMargin).toBe("visible");
    expect(finance.fieldPermissions.support_ticket.internalNotes).toBe("hidden");
    expect(finance.objectPermissions.support_ticket).toBeUndefined();

    const legal = policyFor("legal-contract-reviewer");
    expect(legal.objectPermissions.contract).toContain("approve");
    expect(legal.specialActions).toContain("approve_legal");
    expect(legal.fieldPermissions.contract.legalTerms).toBe("editable");
    expect(legal.fieldPermissions.support_ticket.internalNotes).toBe("hidden");

    const aiGovernance = policyFor("ai-governance-manager");
    expect(aiGovernance.objectPermissions.ai_audit_log).toContain("approve");
    expect(aiGovernance.specialActions).toContain("approve_ai_action");
    expect(aiGovernance.fieldPermissions.ai_audit_log.prompt).toBe("visible");
    expect(aiGovernance.fieldPermissions.ai_audit_log.confidenceScore).toBe("visible");
    expect(aiGovernance.fieldPermissions.ai_audit_log.feedback).toBe("editable");

    const executive = policyFor("executive-ceo-cxo");
    const executiveActions = Object.values(executive.objectPermissions).flat();
    expect(executiveActions).not.toContain("create");
    expect(executiveActions).not.toContain("update");
    expect(executiveActions).not.toContain("delete");
    expect(executive.objectPermissions.dashboard_widget).toEqual(["read", "export"]);
  });
});
