import { describe, expect, it } from "vitest";
import {
  defaultLeadMqlRule,
  defaultLeadScoringConfigurationDefinitions,
  defaultLeadScoringModel,
  evaluateLeadScore,
  evaluateMql,
  validateConfigurationDefinitions
} from "@crm/types";

describe("lead scoring evaluator", () => {
  it("scores a strong lead high with grade A and full breakdown", () => {
    const record = {
      industry: "saas",
      segment: "enterprise",
      region: "noida",
      designation: "VP",
      attemptCount: 2,
      lastActivity: "2026-06-01T00:00:00.000Z",
      productInterest: ["elite_sis_k12"],
      subSource: "demo_request",
      aiScore: 70
    };
    const result = evaluateLeadScore(defaultLeadScoringModel, record);
    expect(result.finalScore).toBe(100);
    expect(result.grade).toBe("a");
    expect(result.dimensionScores.intent).toBe(30);
    expect(result.breakdown.length).toBeGreaterThan(0);
  });

  it("scores an empty lead at zero with the lowest grade", () => {
    const result = evaluateLeadScore(defaultLeadScoringModel, {});
    expect(result.finalScore).toBe(0);
    expect(result.grade).toBe("d");
  });

  it("weights dimensions when computing the final score", () => {
    const model = {
      object: "lead",
      dimensions: [
        { key: "fit", weight: 2, rules: [{ field: "industry", operator: "exists" as const, points: 10 }] },
        { key: "intent", weight: 0.5, rules: [{ field: "productInterest", operator: "exists" as const, points: 10 }] }
      ]
    };
    const result = evaluateLeadScore(model, { industry: "x", productInterest: ["y"] });
    expect(result.finalScore).toBe(25); // 10*2 + 10*0.5
  });
});

describe("MQL evaluator", () => {
  it("marks a qualifying lead as MQL", () => {
    const score = { dimensionScores: {}, finalScore: 80, grade: "a", breakdown: [] };
    const record = { leadSource: "website", productInterest: ["x"], consentStatus: "opted_in" };
    const result = evaluateMql(defaultLeadMqlRule, score, record);
    expect(result.isMql).toBe(true);
  });

  it("rejects below-threshold, missing-required-field, and opted-out leads", () => {
    const lowScore = { dimensionScores: {}, finalScore: 10, grade: "d", breakdown: [] };
    expect(evaluateMql(defaultLeadMqlRule, lowScore, { leadSource: "website", productInterest: ["x"], consentStatus: "opted_in" }).isMql).toBe(false);

    const score = { dimensionScores: {}, finalScore: 80, grade: "a", breakdown: [] };
    expect(evaluateMql(defaultLeadMqlRule, score, { leadSource: "website", consentStatus: "opted_in" }).isMql).toBe(false); // missing productInterest
    expect(evaluateMql(defaultLeadMqlRule, score, { leadSource: "website", productInterest: ["x"], consentStatus: "opted_out" }).isMql).toBe(false);
  });
});

describe("seeded scoring/MQL definitions", () => {
  it("validate cleanly as governed configuration", () => {
    const issues = validateConfigurationDefinitions(defaultLeadScoringConfigurationDefinitions);
    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("includes a scoring_model and an mql_rule for leads", () => {
    const types = defaultLeadScoringConfigurationDefinitions.map((def) => def.definitionType).sort();
    expect(types).toEqual(["mql_rule", "scoring_model"]);
  });
});
