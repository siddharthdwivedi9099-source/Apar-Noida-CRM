import { describe, expect, it } from "vitest";
import {
  validationRuleCatalog,
  findValidationRule,
  validationRulesForEntity,
  evaluateMqlReadiness,
  evaluateSqlReadiness,
  evaluateLeadConversion,
  evaluateStageTransition,
  evaluateCloseWon,
  evaluateCloseLost,
  evaluateProposalSubmission,
  evaluateStrategicClose,
  evaluateDemoRequest,
  evaluateTicketClosure,
  evaluatePartnerApproval,
  evaluateAiExternalComm,
  evaluateClosedRecordEdit,
  defaultValidationRuleConfigurationDefinitions
} from "@crm/types";

describe("Section 13: validation-rule catalogue", () => {
  it("defines all 15 required rules with unique keys", () => {
    expect(validationRuleCatalog.length).toBe(15);
    const keys = validationRuleCatalog.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const rule of validationRuleCatalog) {
      expect(rule.description.trim().length).toBeGreaterThan(0);
      expect(["error", "warning"]).toContain(rule.severity);
    }
  });

  it("documents an enforcement site for every rule and enforces all but the un-hookable MQL rule at a service gate", () => {
    for (const rule of validationRuleCatalog) {
      expect((rule.enforcedBy ?? "").trim().length).toBeGreaterThan(0);
    }
    const serviceEnforced = validationRuleCatalog.filter((rule) => rule.enforcement === "service");
    const catalogOnly = validationRuleCatalog.filter((rule) => rule.enforcement === "catalog");
    // 14 rules have a live service gate; only the become-MQL rule lacks a lifecycle
    // endpoint to hook (MQL is a computed classification, not a manual transition).
    expect(serviceEnforced.length).toBe(14);
    expect(catalogOnly.map((rule) => rule.key)).toEqual(["lead_mql_requires_score_consent"]);
  });

  it("looks rules up by key and entity", () => {
    expect(findValidationRule("opp_close_won_requires_completion")?.entity).toBe("opportunity");
    expect(findValidationRule("does-not-exist")).toBeUndefined();
    expect(validationRulesForEntity("support_ticket").length).toBe(2);
  });

  it("seeds the catalogue as one governed validation_rule definition", () => {
    const def = defaultValidationRuleConfigurationDefinitions[0];
    expect(def.definitionType).toBe("validation_rule");
    expect((def.definition.rules as unknown[]).length).toBe(15);
  });
});

describe("Section 13: lead resolvers", () => {
  it("R1 MQL requires score and consent", () => {
    expect(evaluateMqlReadiness({ score: 70, consentStatus: "opted_in" }).valid).toBe(true);
    expect(evaluateMqlReadiness({ score: null, consentStatus: "opted_in" }).valid).toBe(false);
    const r = evaluateMqlReadiness({ score: 70, consentStatus: "  " });
    expect(r.valid).toBe(false);
    expect(r.violations[0].field).toBe("consentStatus");
  });

  it("R2 SQL requires qualification fields", () => {
    expect(evaluateSqlReadiness({ budget: "50k", authority: "VP", need: "x", timeline: "Q3" }).valid).toBe(true);
    expect(evaluateSqlReadiness({ budget: "50k", authority: "", need: "x", timeline: "Q3" }).violations.map((v) => v.field)).toContain("authority");
  });

  it("R3 conversion requires account and contact", () => {
    expect(evaluateLeadConversion({ accountId: "a", contactId: "c" }).valid).toBe(true);
    expect(evaluateLeadConversion({ accountId: "a", contactId: null }).valid).toBe(false);
  });
});

describe("Section 13: opportunity resolvers", () => {
  it("R4/R5 stage transitions gate on discovery and proposal", () => {
    expect(evaluateStageTransition("proposal", { discoveryComplete: true }).valid).toBe(true);
    expect(evaluateStageTransition("proposal", { discoveryComplete: false }).valid).toBe(false);
    expect(evaluateStageTransition("negotiation", { proposalSubmitted: true }).valid).toBe(true);
    expect(evaluateStageTransition("negotiation", { proposalSubmitted: false }).valid).toBe(false);
    expect(evaluateStageTransition("discovery", {}).valid).toBe(true);
  });

  it("R6 close won requires final value, contract/PO, handover", () => {
    expect(evaluateCloseWon({ finalValue: 100, contractStatus: "signed", poStatus: "received", handoverNote: "ok" }).valid).toBe(true);
    const bad = evaluateCloseWon({ finalValue: 0, contractStatus: "", poStatus: null, handoverNote: "  " });
    expect(bad.valid).toBe(false);
    expect(bad.violations.map((v) => v.field).sort()).toEqual(["contractStatus", "finalValue", "handoverNote", "poStatus"]);
  });

  it("R7 close lost requires a reason", () => {
    expect(evaluateCloseLost({ lossReasonKey: "price" }).valid).toBe(true);
    expect(evaluateCloseLost({ lossReasonKey: "" }).valid).toBe(false);
  });

  it("R8 discounted proposal requires approval", () => {
    expect(evaluateProposalSubmission({ discountPercent: 0 }).valid).toBe(true);
    expect(evaluateProposalSubmission({ discountPercent: 20, discountApproved: true }).valid).toBe(true);
    expect(evaluateProposalSubmission({ discountPercent: 20, discountApproved: false }).valid).toBe(false);
  });

  it("R9 strategic close requires review only above threshold", () => {
    expect(evaluateStrategicClose(500000, { approved: false }).valid).toBe(true);
    expect(evaluateStrategicClose(2000000, { approved: true }).valid).toBe(true);
    expect(evaluateStrategicClose(2000000, { approved: false }).valid).toBe(false);
  });
});

describe("Section 13: support, demo, partner, AI, record resolvers", () => {
  it("R10 demo requires use case and audience", () => {
    expect(evaluateDemoRequest({ useCase: "reporting", audience: "CFO" }).valid).toBe(true);
    expect(evaluateDemoRequest({ useCase: "", audience: "CFO" }).valid).toBe(false);
  });

  it("R11/R12 ticket closure requires summary and conditional RCA", () => {
    expect(evaluateTicketClosure({ resolutionSummary: "fixed" }).valid).toBe(true);
    expect(evaluateTicketClosure({ resolutionSummary: "" }).valid).toBe(false);
    expect(evaluateTicketClosure({ resolutionSummary: "fixed", rcaRequired: true, rootCause: "" }).valid).toBe(false);
    expect(evaluateTicketClosure({ resolutionSummary: "fixed", rcaRequired: true, rootCause: "cabling" }).valid).toBe(true);
  });

  it("R13 partner approval blocks on unresolved conflict", () => {
    expect(evaluatePartnerApproval({ conflictUnresolved: false }).valid).toBe(true);
    expect(evaluatePartnerApproval({ conflictUnresolved: true }).valid).toBe(false);
  });

  it("R14 AI external comm requires approval under governance", () => {
    expect(evaluateAiExternalComm({ governanceRequiresApproval: false }).valid).toBe(true);
    expect(evaluateAiExternalComm({ governanceRequiresApproval: true, approved: true }).valid).toBe(true);
    expect(evaluateAiExternalComm({ governanceRequiresApproval: true, approved: false }).valid).toBe(false);
  });

  it("R15 closed record edit is limited to authorized roles", () => {
    expect(evaluateClosedRecordEdit({ isClosed: false }, []).valid).toBe(true);
    expect(evaluateClosedRecordEdit({ isClosed: true }, ["opportunities.configure"]).valid).toBe(true);
    expect(evaluateClosedRecordEdit({ isClosed: true }, ["opportunities.edit"]).valid).toBe(false);
  });
});
