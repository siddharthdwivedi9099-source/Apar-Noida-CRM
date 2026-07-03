import { describe, expect, it } from "vitest";
import {
  aiAgentKinds,
  assessOpportunityRisk,
  draftEmail,
  enrichLead,
  flagLowConfidence,
  forecastOpportunity,
  humanReviewAgents,
  scoreLead,
  summarizeCall
} from "@crm/types";

describe("agent envelopes are governed", () => {
  it("exposes 10 agent kinds and human-review agents", () => {
    expect(aiAgentKinds).toHaveLength(10);
    expect(humanReviewAgents).toContain("email_drafting");
    expect(humanReviewAgents).toContain("proposal_drafting");
    expect(humanReviewAgents).toContain("knowledge_assistant");
  });
  it("flags low confidence below threshold", () => {
    expect(flagLowConfidence(40)).toBe(true);
    expect(flagLowConfidence(80)).toBe(false);
  });
});

describe("enrichLead (AI-001)", () => {
  it("suggests details with source + confidence and requires review", () => {
    const e = enrichLead({ companyName: "Acme", firstName: "Jane", email: "jane@acme.io" });
    expect(e.output.website).toContain("acme.io");
    expect(e.output.painPoints.length).toBeGreaterThan(0);
    expect(e.reviewRequired).toBe(true);
    expect(e.sources.length).toBeGreaterThan(0);
    expect(e.confidence).toBeGreaterThan(enrichLead({ companyName: "Acme" }).confidence); // email boosts confidence
  });
});

describe("scoreLead (AI-002)", () => {
  it("weights signals and bands + explains, penalizes negatives", () => {
    const hot = scoreLead({ icpFit: 90, engagement: 85, seniority: 80, budgetSignal: 80, recency: 80 });
    expect(hot.output.band).toBe("hot");
    expect(hot.output.drivers.length).toBeGreaterThan(0);
    const penalized = scoreLead({ icpFit: 90, engagement: 85, seniority: 80, budgetSignal: 80, recency: 80, negativeSignals: 2 });
    expect(penalized.output.score).toBe(hot.output.score - 20);
  });
});

describe("draftEmail (AI-003)", () => {
  it("drafts subject/body and requires review before sending", () => {
    const d = draftEmail({ recipientName: "Sam", companyName: "Beta", purpose: "Intro", tone: "formal" });
    expect(d.output.subject).toContain("Beta");
    expect(d.output.body).toContain("Dear Sam,");
    expect(d.reviewRequired).toBe(true);
  });
});

describe("summarizeCall (AI-004)", () => {
  it("captures objections, sentiment and a follow-up date", () => {
    const s = summarizeCall({ notes: "Customer worried the price is too expensive but keen overall" }, 1_000_000_000_000);
    expect(s.output.objections).toMatch(/budget|Pricing/i);
    expect(["positive", "negative", "neutral"]).toContain(s.output.sentiment);
    expect(s.output.followUpDate).not.toBeNull();
  });
});

describe("assessOpportunityRisk (AI-006)", () => {
  it("collects risk factors, level, and a recommended action", () => {
    const r = assessOpportunityRisk({ daysSinceActivity: 20, hasDecisionMaker: false, competitorPresent: true, demoCompleted: false, engagementScore: 30 });
    expect(r.output.riskLevel).toBe("high");
    expect(r.output.factors).toContain("inactivity");
    expect(r.output.factors).toContain("missing_decision_maker");
    expect(r.output.recommendedAction.length).toBeGreaterThan(0);
    expect(assessOpportunityRisk({ daysSinceActivity: 1, hasDecisionMaker: true, demoCompleted: true, engagementScore: 80 }).output.riskLevel).toBe("low");
  });
});

describe("forecastOpportunity (AI-007)", () => {
  it("predicts probability, expected revenue and compares to rep forecast", () => {
    const f = forecastOpportunity({ stageWeight: 60, engagement: 80, amount: 100000, repProbability: 90, riskLevel: "medium" });
    expect(f.output.closeProbability).toBeGreaterThan(0);
    expect(f.output.expectedRevenue).toBe(Math.round(100000 * (f.output.closeProbability / 100)));
    expect(f.output.repProbability).toBe(90);
    expect(f.output.variance).toBe(f.output.closeProbability - 90);
  });
});
