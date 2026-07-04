import { describe, expect, it } from "vitest";
import {
  computeAttribution,
  extractMentions,
  nextBestActionTypes,
  recommendNextBestAction,
  type AttributionTouch,
  type NbaSignals
} from "@crm/types";

describe("computeAttribution", () => {
  const at = (min: number): number => 1_000_000 + min * 60_000;
  const touches: AttributionTouch[] = [
    { source: "webinar", occurredAtMs: at(0) },
    { source: "email", occurredAtMs: at(10) },
    { source: "webinar", occurredAtMs: at(20) },
    { source: "referral", occurredAtMs: at(30) }
  ];

  it("computes first/last touch and linear weights that sum to ~100", () => {
    const m = computeAttribution(touches);
    expect(m.firstTouch).toBe("webinar");
    expect(m.lastTouch).toBe("referral");
    expect(m.touchCount).toBe(4);
    const totalWeight = m.linear.reduce((s, l) => s + l.weight, 0);
    expect(Math.round(totalWeight)).toBe(100);
    // webinar appears twice -> gets double the per-touch weight
    expect(m.linear.find((l) => l.source === "webinar")?.weight).toBe(50);
  });

  it("handles empty touches", () => {
    expect(computeAttribution([])).toEqual({ firstTouch: null, lastTouch: null, linear: [], touchCount: 0 });
  });
});

describe("recommendNextBestAction", () => {
  const base: NbaSignals = { entityType: "opportunity", daysSinceLastActivity: 1 };

  it("escalates on SLA breach above everything", () => {
    expect(recommendNextBestAction({ ...base, slaBreached: true }).actionType).toBe("escalation");
  });
  it("routes to manager on pending approval", () => {
    expect(recommendNextBestAction({ ...base, discountPendingApproval: true }).actionType).toBe("manager_review");
  });
  it("drives closure in negotiation and proposal follow-up in proposal stage", () => {
    expect(recommendNextBestAction({ ...base, stageKey: "negotiation" }).actionType).toBe("closure");
    expect(recommendNextBestAction({ ...base, stageKey: "proposal" }).actionType).toBe("proposal");
  });
  it("escalates red CS health", () => {
    expect(recommendNextBestAction({ entityType: "customer_success_account", daysSinceLastActivity: 2, healthBand: "red" }).actionType).toBe("escalation");
  });
  it("nurtures/emails on inactivity and includes a reason", () => {
    expect(recommendNextBestAction({ entityType: "lead", daysSinceLastActivity: 40 }).actionType).toBe("nurture");
    const rec = recommendNextBestAction({ entityType: "lead", daysSinceLastActivity: 20 });
    expect(rec.actionType).toBe("email");
    expect(rec.reason.length).toBeGreaterThan(0);
    expect(nextBestActionTypes).toContain(rec.actionType);
  });
});

describe("extractMentions", () => {
  it("extracts unique @handles", () => {
    expect(extractMentions("hey @jane.doe and @bob_smith, cc @jane.doe")).toEqual(["jane.doe", "bob_smith"]);
    expect(extractMentions("no mentions here")).toEqual([]);
    expect(extractMentions("email me at a@b.com")).toEqual(["b.com"]);
  });
});
