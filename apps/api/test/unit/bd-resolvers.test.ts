import { describe, expect, it } from "vitest";
import {
  evaluateBdEngagement,
  evaluateBdSequence,
  evaluateBuyingCommitteeCompleteness,
  type BdSequenceStepDefinition,
  type CrmOptionValueSummary
} from "@crm/types";

function option(key: string, label: string): CrmOptionValueSummary {
  return { id: `opt-${key}`, key, label, description: null, color: null, isDefault: false, isActive: true };
}

const steps: BdSequenceStepDefinition[] = [
  { key: "email_1", label: "Day 0 email", channel: "email", offsetHours: 0, order: 0, persona: null, product: null, region: null },
  { key: "call_1", label: "Day 1 call", channel: "call", offsetHours: 24, order: 1, persona: null, product: null, region: null },
  { key: "exec_email", label: "Exec email", channel: "email", offsetHours: 48, order: 2, persona: "executive", product: null, region: null }
];

describe("evaluateBdSequence", () => {
  const startIso = "2026-06-28T00:00:00.000Z";

  it("only includes steps whose targeting matches the account context", () => {
    const view = evaluateBdSequence({
      steps,
      context: { persona: "user", product: null, region: null },
      state: { paused: false, pauseReason: null, completedStepKeys: [] },
      startIso,
      nowIso: "2026-06-28T12:00:00.000Z"
    });
    expect(view.totalCount).toBe(2);
    expect(view.steps.some((step) => step.key === "exec_email")).toBe(false);
  });

  it("includes persona-targeted steps when the persona matches", () => {
    const view = evaluateBdSequence({
      steps,
      context: { persona: "executive", product: null, region: null },
      state: { paused: false, pauseReason: null, completedStepKeys: ["email_1"] },
      startIso,
      nowIso: "2026-06-28T12:00:00.000Z"
    });
    expect(view.totalCount).toBe(3);
    expect(view.completedCount).toBe(1);
    expect(view.currentStep?.key).toBe("call_1");
  });

  it("flags an overdue current step", () => {
    const view = evaluateBdSequence({
      steps,
      context: { persona: null, product: null, region: null },
      state: { paused: false, pauseReason: null, completedStepKeys: [] },
      startIso,
      nowIso: "2026-06-30T00:00:00.000Z"
    });
    expect(view.steps[0].status).toBe("overdue");
  });
});

describe("evaluateBdEngagement", () => {
  it("returns cold for no signals", () => {
    const view = evaluateBdEngagement({});
    expect(view.score).toBe(0);
    expect(view.band).toBe("cold");
    expect(view.buyingSignal).toBe(false);
  });

  it("flags a buying signal once high-value signals accumulate", () => {
    const view = evaluateBdEngagement({ meetings: 3, replies: 3, stakeholderEngagement: 2 });
    expect(view.score).toBeGreaterThanOrEqual(60);
    expect(view.band).toBe("hot");
    expect(view.buyingSignal).toBe(true);
  });

  it("caps the score at 100", () => {
    const view = evaluateBdEngagement({ meetings: 100 });
    expect(view.score).toBe(100);
  });
});

describe("evaluateBuyingCommitteeCompleteness", () => {
  const roles = [option("decision_maker", "Decision maker"), option("technical", "Technical"), option("finance", "Finance")];

  it("scores coverage and lists missing roles", () => {
    const view = evaluateBuyingCommitteeCompleteness(roles, ["decision_maker", null, "technical"]);
    expect(view.total).toBe(3);
    expect(view.covered).toBe(2);
    expect(view.score).toBe(67);
    expect(view.missingRoles.map((role) => role.key)).toEqual(["finance"]);
  });

  it("returns zero coverage when nothing is mapped", () => {
    const view = evaluateBuyingCommitteeCompleteness(roles, []);
    expect(view.covered).toBe(0);
    expect(view.score).toBe(0);
  });
});
