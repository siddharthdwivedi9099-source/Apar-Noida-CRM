import { describe, expect, it } from "vitest";
import {
  computeAdvocacyReadiness,
  mandatorySuccessPlanSections,
  predictRenewalProbability,
  renewalProbabilityBands,
  requiresLeadershipEscalation,
  strategicRiskTypes,
  validateSuccessPlan
} from "@crm/types";

describe("validateSuccessPlan", () => {
  it("flags empty sections and gates on mandatory ones", () => {
    const result = validateSuccessPlan({ objectives: "Grow adoption" });
    expect(result.complete).toBe(false);
    expect(result.missingSections).toContain("stakeholders");
    expect(result.missingMandatory).toContain("renewalDate");
    expect(result.missingMandatory).not.toContain("objectives");
  });

  it("is complete once mandatory sections have content", () => {
    const plan: Record<string, string> = {};
    for (const section of mandatorySuccessPlanSections) plan[section] = "provided";
    expect(validateSuccessPlan(plan).complete).toBe(true);
  });
});

describe("requiresLeadershipEscalation", () => {
  it("escalates high and critical risks only", () => {
    expect(requiresLeadershipEscalation("critical")).toBe(true);
    expect(requiresLeadershipEscalation("high")).toBe(true);
    expect(requiresLeadershipEscalation("medium")).toBe(false);
    expect(requiresLeadershipEscalation("low")).toBe(false);
  });

  it("exposes the strategic risk vocabulary", () => {
    expect(strategicRiskTypes).toContain("sponsor_change");
    expect(strategicRiskTypes).toContain("renewal_uncertainty");
  });
});

describe("predictRenewalProbability", () => {
  it("high factors predict a likely renewal", () => {
    const p = predictRenewalProbability({ healthScore: 90, usageScore: 85, valueDelivered: 90, stakeholderStrength: 80, expansionPotential: 70 });
    expect(p.probability).toBeGreaterThanOrEqual(80);
    expect(p.band).toBe("likely");
  });

  it("open risks penalize the probability", () => {
    const base = predictRenewalProbability({ healthScore: 80, usageScore: 80, valueDelivered: 80, stakeholderStrength: 80, expansionPotential: 80 });
    const penalized = predictRenewalProbability({ healthScore: 80, usageScore: 80, valueDelivered: 80, stakeholderStrength: 80, expansionPotential: 80, openRiskCount: 3 });
    expect(penalized.probability).toBe(base.probability - 24);
  });

  it("defaults to a neutral 50 with no factors and exposes bands", () => {
    expect(predictRenewalProbability({}).probability).toBe(50);
    expect(renewalProbabilityBands).toEqual(["likely", "at_risk", "unlikely"]);
  });
});

describe("computeAdvocacyReadiness", () => {
  it("high signals are advocacy-ready", () => {
    const r = computeAdvocacyReadiness({ healthScore: 90, nps: 80, adoptionScore: 85, renewalSecured: true, executiveRelationship: 80 });
    expect(r.ready).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.drivers[0].value).toBeGreaterThanOrEqual(r.drivers[r.drivers.length - 1].value);
  });

  it("normalizes NPS from -100..100 and blocks low readiness", () => {
    const r = computeAdvocacyReadiness({ nps: -100, healthScore: 20 });
    expect(r.ready).toBe(false);
    // nps -100 -> 0, health 20 -> mean 10
    expect(r.score).toBe(10);
  });
});
