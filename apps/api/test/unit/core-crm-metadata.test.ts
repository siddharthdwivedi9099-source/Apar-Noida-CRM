import { describe, expect, it } from "vitest";
import {
  coreCrmRequiredModuleKeys,
  coreCrmRequiredObjectKeys,
  coreCrmRequiredPicklistKeys,
  defaultCoreCrmConfigurationDefinitions,
  defaultCoreCrmModuleDefinitions,
  defaultCoreCrmObjectDefinitions,
  defaultCoreCrmStandardPicklistDefinitions,
  validateConfigurationDefinitions
} from "@crm/types";

const requestedModuleKeys = [
  "marketing",
  "campaign_management",
  "lead_management",
  "account_contact_management",
  "opportunity_sales_pipeline",
  "activity_management",
  "proposal_quote_contract_management",
  "approval_management",
  "partner_reseller_management",
  "support_ticketing",
  "customer_success",
  "renewal_expansion",
  "ai_assistant_governance",
  "dashboards_analytics",
  "admin_configuration",
  "audit_compliance"
];

const requestedObjectKeys = [
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

const requestedPicklistKeys = [
  "lead-source",
  "lead-status",
  "lead-capture-source",
  "lead-sub-source",
  "lead-grade",
  "qualification-status",
  "disqualification-reason",
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

describe("core CRM metadata catalog", () => {
  it("registers all requested modules through configuration definitions", () => {
    expect(coreCrmRequiredModuleKeys).toEqual(requestedModuleKeys);
    expect(defaultCoreCrmModuleDefinitions).toHaveLength(requestedModuleKeys.length);
    expect(defaultCoreCrmModuleDefinitions.map((definition) => definition.definitionKey)).toEqual(requestedModuleKeys);
    expect(defaultCoreCrmModuleDefinitions.every((definition) => definition.definitionType === "module_meta")).toBe(true);
  });

  it("registers all requested objects through configuration definitions", () => {
    expect(coreCrmRequiredObjectKeys).toEqual(requestedObjectKeys);
    expect(defaultCoreCrmObjectDefinitions).toHaveLength(requestedObjectKeys.length);
    expect(defaultCoreCrmObjectDefinitions.map((definition) => definition.definitionKey)).toEqual(requestedObjectKeys);
    expect(defaultCoreCrmObjectDefinitions.every((definition) => definition.definitionType === "object")).toBe(true);
  });

  it("keeps definitions valid for configuration-engine publish/apply", () => {
    const result = validateConfigurationDefinitions(defaultCoreCrmConfigurationDefinitions);
    expect(result.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("configures fields, relationships, flags, list views, detail views, and forms for each object", () => {
    for (const definition of defaultCoreCrmObjectDefinitions) {
      const payload = definition.definition;
      expect(payload.auditEnabled).toBe(true);
      expect(typeof payload.activityTimelineEnabled).toBe("boolean");
      expect(payload.searchEnabled).toBe(true);
      expect(payload.filterEnabled).toBe(true);
      expect(payload.reportEnabled).toBe(true);
      expect(Array.isArray(payload.keyFields)).toBe(true);
      expect((payload.keyFields as unknown[]).length).toBeGreaterThan(0);
      expect(Array.isArray(payload.relationships)).toBe(true);
      expect(payload.basicListView).toBeTruthy();
      expect(payload.basicDetailView).toBeTruthy();
      expect(payload.basicCreateEditForm).toBeTruthy();
    }
  });

  it("does not reference missing object relationships", () => {
    const knownObjects = new Set(coreCrmRequiredObjectKeys);
    for (const definition of defaultCoreCrmObjectDefinitions) {
      const relationships = definition.definition.relationships as Array<{ targetObject: string }>;
      for (const relationship of relationships) {
        const targets = relationship.targetObject.split("|");
        for (const target of targets) {
          expect(knownObjects.has(target)).toBe(true);
        }
      }
    }
  });

  it("registers all requested standard picklists as tenant option sets", () => {
    expect(coreCrmRequiredPicklistKeys).toEqual(requestedPicklistKeys);
    expect(defaultCoreCrmStandardPicklistDefinitions.map((definition) => definition.setKey)).toEqual(requestedPicklistKeys);
    for (const definition of defaultCoreCrmStandardPicklistDefinitions) {
      expect(definition.values.length).toBeGreaterThan(0);
      expect(definition.values.some((value) => value.isDefault)).toBe(true);
    }
  });
});
