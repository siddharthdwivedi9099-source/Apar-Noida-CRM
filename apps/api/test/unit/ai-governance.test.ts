import { describe, expect, it } from "vitest";
import {
  aiRiskLevels,
  computeAiQuality,
  LOW_CONFIDENCE_THRESHOLD,
  requiresUseCaseApproval,
  resolveAiExplanation,
  type AiFeedbackFact,
  type AiRunFact,
  type ExplanationFactor
} from "@crm/types";

describe("requiresUseCaseApproval", () => {
  it("only high-risk use cases require approval", () => {
    expect(requiresUseCaseApproval("high")).toBe(true);
    expect(requiresUseCaseApproval("medium")).toBe(false);
    expect(requiresUseCaseApproval("low")).toBe(false);
    expect(aiRiskLevels).toEqual(["low", "medium", "high"]);
  });
});

describe("resolveAiExplanation", () => {
  const factors: ExplanationFactor[] = [
    { label: "Recent engagement", weight: 30 },
    { label: "High usage", weight: 20 },
    { label: "Open support tickets", weight: -25 },
    { label: "Payment delay", weight: -15 },
    { label: "Champion left", weight: -5 }
  ];

  it("returns top positive and negative factors, ranked", () => {
    const e = resolveAiExplanation(factors, 82, 2);
    expect(e.topPositive.map((f) => f.label)).toEqual(["Recent engagement", "High usage"]);
    expect(e.topNegative.map((f) => f.label)).toEqual(["Open support tickets", "Payment delay"]);
    expect(e.lowConfidence).toBe(false);
  });

  it("flags low-confidence outputs and clamps confidence", () => {
    expect(resolveAiExplanation(factors, 40).lowConfidence).toBe(true);
    expect(resolveAiExplanation(factors, LOW_CONFIDENCE_THRESHOLD).lowConfidence).toBe(false);
    expect(resolveAiExplanation(factors, 150).confidence).toBe(100);
  });
});

describe("computeAiQuality", () => {
  const runs: AiRunFact[] = [
    { reviewStatus: "approved", requiresReview: true, confidence: 90, responseMs: 800 },
    { reviewStatus: "rejected", requiresReview: true, confidence: 40, responseMs: 1200 },
    { reviewStatus: "not_required", requiresReview: false, confidence: 70, responseMs: 400 },
    { reviewStatus: "approved", requiresReview: true, confidence: 55, responseMs: null }
  ];
  const feedback: AiFeedbackFact[] = [
    { rating: "helpful", isHallucination: false },
    { rating: "not_helpful", isHallucination: true },
    { rating: "helpful", isHallucination: false }
  ];

  it("computes override rate, low-confidence, feedback and hallucinations", () => {
    const q = computeAiQuality(runs, feedback);
    expect(q.totalRuns).toBe(4);
    expect(q.reviewedRuns).toBe(3); // approved + rejected + approved
    expect(q.overrides).toBe(1);
    expect(q.overrideRate).toBe(33);
    expect(q.lowConfidenceCount).toBe(2); // 40 and 55 are < 60
    expect(q.avgResponseMs).toBe(800); // (800+1200+400)/3
    expect(q.feedbackCount).toBe(3);
    expect(q.helpfulRate).toBe(67);
    expect(q.hallucinationReports).toBe(1);
    expect(q.businessImpactScore).toBeGreaterThanOrEqual(0);
    expect(q.businessImpactScore).toBeLessThanOrEqual(100);
  });

  it("handles empty inputs safely", () => {
    const q = computeAiQuality([], []);
    expect(q.overrideRate).toBe(0);
    expect(q.avgResponseMs).toBeNull();
    expect(q.helpfulRate).toBe(0);
  });
});
