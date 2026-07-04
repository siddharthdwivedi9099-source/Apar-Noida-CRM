import { describe, expect, it } from "vitest";
import { evaluateLeadConversionReadiness, mapLeadSourceToOpportunitySource } from "@crm/types";

describe("lead conversion helpers", () => {
  it("maps lead sources onto opportunity sources with safe defaults", () => {
    expect(mapLeadSourceToOpportunitySource("website")).toBe("inbound");
    expect(mapLeadSourceToOpportunitySource("campaign")).toBe("campaign");
    expect(mapLeadSourceToOpportunitySource("partner")).toBe("partner");
    expect(mapLeadSourceToOpportunitySource("referral")).toBe("referral");
    expect(mapLeadSourceToOpportunitySource("outbound")).toBe("outbound");
    expect(mapLeadSourceToOpportunitySource("unknown")).toBe("inbound");
  });

  it("blocks conversion when qualification and handoff requirements are incomplete", () => {
    const result = evaluateLeadConversionReadiness({
      qualificationChecklist: {
        budget: true,
        authority: false,
        need: true,
        timeline: false
      },
      duplicateCheckCompleted: false,
      hasOwner: false,
      hasNextStep: false,
      hasExpectedCloseDate: false,
      hasAmount: false,
      hasProductContext: false
    });

    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual([
      "Qualification checklist is incomplete.",
      "Account/contact duplicate check has not been completed.",
      "Estimated opportunity value is required.",
      "Expected close date is required.",
      "A lead or opportunity owner must be assigned.",
      "A next step is required before conversion.",
      "Lead product or solution context is required before conversion."
    ]);
  });

  it("allows conversion when the lead is qualification-complete and handoff-ready", () => {
    const result = evaluateLeadConversionReadiness({
      qualificationChecklist: {
        budget: true,
        authority: true,
        need: true,
        timeline: true
      },
      duplicateCheckCompleted: true,
      hasOwner: true,
      hasNextStep: true,
      hasExpectedCloseDate: true,
      hasAmount: true,
      hasProductContext: true
    });

    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
  });
});
