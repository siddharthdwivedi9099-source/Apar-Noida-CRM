import { describe, expect, it } from "vitest";
import {
  computeExecWinRate,
  computeRoi,
  computeWeightedForecast,
  detectExecutiveInsights,
  executiveInsightKeys,
  type ExecutiveInsightInput
} from "@crm/types";

describe("computeExecWinRate", () => {
  it("computes won / (won+lost)", () => {
    expect(computeExecWinRate(30, 10)).toBe(75);
    expect(computeExecWinRate(0, 0)).toBe(0);
    expect(computeExecWinRate(5, 0)).toBe(100);
  });
});

describe("computeWeightedForecast", () => {
  it("probability-weights the pipeline", () => {
    expect(computeWeightedForecast([{ amount: 100000, probability: 50 }, { amount: 40000, probability: 25 }])).toBe(60000);
    expect(computeWeightedForecast([])).toBe(0);
    expect(computeWeightedForecast([{ amount: 100, probability: 150 }])).toBe(100); // clamped
  });
});

describe("computeRoi", () => {
  it("returns ROI percent, null when there is no spend", () => {
    expect(computeRoi(150, 100)).toBe(50);
    expect(computeRoi(50, 100)).toBe(-50);
    expect(computeRoi(100, 0)).toBeNull();
  });
});

describe("detectExecutiveInsights", () => {
  const healthy: ExecutiveInsightInput = {
    pipelineCoverage: 3.5, forecastAttainment: 1.0, atRiskCustomers: 1, totalCustomers: 100, quotaAttainment: 1.0, campaignRoi: 120, inactivePartners: 0
  };

  it("returns no insights when everything is healthy", () => {
    expect(detectExecutiveInsights(healthy)).toEqual([]);
  });

  it("flags each category when signals breach thresholds", () => {
    const insights = detectExecutiveInsights({
      pipelineCoverage: 1.5, forecastAttainment: 0.7, atRiskCustomers: 30, totalCustomers: 100, quotaAttainment: 0.5, campaignRoi: -60, inactivePartners: 6
    });
    const keys = insights.map((i) => i.key);
    for (const key of executiveInsightKeys) {
      expect(keys).toContain(key);
    }
    // Every insight carries a recommended action and a suggested owner.
    expect(insights.every((i) => i.recommendedAction.length > 0 && i.suggestedOwnerRole.length > 0)).toBe(true);
    // Deep breaches escalate to critical.
    expect(insights.find((i) => i.key === "pipeline_gap")?.severity).toBe("critical");
    expect(insights.find((i) => i.key === "churn_risk")?.severity).toBe("critical");
  });

  it("does not flag partner inactivity or campaigns when clean", () => {
    const insights = detectExecutiveInsights({ ...healthy, pipelineCoverage: 2.5 });
    expect(insights.map((i) => i.key)).toEqual(["pipeline_gap"]);
  });
});
