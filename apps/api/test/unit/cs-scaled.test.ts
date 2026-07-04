import { describe, expect, it } from "vitest";
import {
  computeHealthScore,
  detectExpansionSignals,
  detectLowUsage,
  healthBands,
  healthFactorWeights,
  matchesCampaignTarget,
  resolveHealthBand
} from "@crm/types";

describe("resolveHealthBand", () => {
  it("bands score into green / amber / red", () => {
    expect(resolveHealthBand(90)).toBe("green");
    expect(resolveHealthBand(75)).toBe("green");
    expect(resolveHealthBand(60)).toBe("amber");
    expect(resolveHealthBand(49)).toBe("red");
    expect(healthBands).toEqual(["green", "amber", "red"]);
  });
});

describe("computeHealthScore", () => {
  it("weights are a probability distribution", () => {
    const total = Object.values(healthFactorWeights).reduce((sum, w) => sum + w, 0);
    expect(Math.round(total * 100) / 100).toBe(1);
  });

  it("all-100 factors score 100 (green)", () => {
    const factors = { usage: 100, loginActivity: 100, supportTickets: 100, slaBreaches: 100, csat: 100, nps: 100, trainingCompletion: 100, renewalProximity: 100, paymentStatus: 100, engagement: 100 };
    const result = computeHealthScore(factors);
    expect(result.score).toBe(100);
    expect(result.band).toBe("green");
  });

  it("renormalizes partial inputs and surfaces the worst driver", () => {
    const result = computeHealthScore({ usage: 20, csat: 90 });
    // weighted over usage(0.18)+csat(0.12): (20*0.18 + 90*0.12) / 0.30 = (3.6+10.8)/0.30 = 48
    expect(result.score).toBe(48);
    expect(result.band).toBe("red");
    expect(result.drivers[0].factor).toBe("usage");
    expect(result.drivers[0].impact).toBe("negative");
  });

  it("empty input is red 0", () => {
    const result = computeHealthScore({});
    expect(result.score).toBe(0);
    expect(result.band).toBe("red");
    expect(result.drivers).toEqual([]);
  });
});

describe("detectLowUsage", () => {
  it("flags usage under threshold with scaled severity", () => {
    expect(detectLowUsage(80, 100)).toMatchObject({ low: true, deficit: 20, severity: "low" });
    expect(detectLowUsage(40, 100).severity).toBe("high");
    expect(detectLowUsage(10, 100).severity).toBe("critical");
    expect(detectLowUsage(120, 100)).toMatchObject({ low: false, deficit: 0 });
  });
});

describe("detectExpansionSignals", () => {
  it("detects listed signals and recommends when 2+ fire", () => {
    const assessment = detectExpansionSignals({ usageRatio: 0.9, userGrowthRate: 0.3, featureRequests: 0 });
    const detected = assessment.signals.filter((s) => s.detected).map((s) => s.key);
    expect(detected).toContain("high_usage");
    expect(detected).toContain("user_growth");
    expect(assessment.recommended).toBe(true);
  });

  it("does not recommend on a single weak signal", () => {
    const assessment = detectExpansionSignals({ usageRatio: 0.85 });
    expect(assessment.detectedCount).toBe(1);
    expect(assessment.recommended).toBe(false);
  });
});

describe("matchesCampaignTarget", () => {
  it("matches on usage, module, segment and health band", () => {
    const candidate = { usage: 80, modules: ["reports"], segmentKey: "scaled", healthBand: "amber" as const };
    expect(matchesCampaignTarget(candidate, { minUsage: 50, module: "reports" })).toBe(true);
    expect(matchesCampaignTarget(candidate, { minUsage: 90 })).toBe(false);
    expect(matchesCampaignTarget(candidate, { module: "billing" })).toBe(false);
    expect(matchesCampaignTarget(candidate, { segmentKey: "scaled", healthBand: "amber" })).toBe(true);
    expect(matchesCampaignTarget(candidate, { healthBand: "red" })).toBe(false);
  });
});
