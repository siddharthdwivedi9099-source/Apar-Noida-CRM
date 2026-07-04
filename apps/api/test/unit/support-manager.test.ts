import { describe, expect, it } from "vitest";
import {
  computeAgentPerformance,
  computeSlaCompliance,
  computeWorkload,
  csatBands,
  detectOverload,
  escalationReviewDecisions,
  resolveCsatBand,
  type AgentTicketFact,
  type WorkloadTicketFact
} from "@crm/types";

describe("resolveCsatBand", () => {
  it("maps 1–5 scores to detractor / passive / promoter", () => {
    expect(resolveCsatBand(1)).toBe("detractor");
    expect(resolveCsatBand(2)).toBe("detractor");
    expect(resolveCsatBand(3)).toBe("passive");
    expect(resolveCsatBand(4)).toBe("promoter");
    expect(resolveCsatBand(5)).toBe("promoter");
  });

  it("returns null for missing/invalid scores", () => {
    expect(resolveCsatBand(null)).toBeNull();
    expect(resolveCsatBand(undefined)).toBeNull();
    expect(resolveCsatBand(Number.NaN)).toBeNull();
  });

  it("exposes the band vocabulary", () => {
    expect(csatBands).toEqual(["detractor", "passive", "promoter"]);
  });
});

describe("computeSlaCompliance", () => {
  it("returns a rounded percentage of non-breached tickets", () => {
    expect(computeSlaCompliance(10, 2)).toBe(80);
    expect(computeSlaCompliance(3, 1)).toBe(67);
  });

  it("treats an empty sample as fully compliant and clamps over-breach", () => {
    expect(computeSlaCompliance(0, 0)).toBe(100);
    expect(computeSlaCompliance(5, 9)).toBe(0);
  });
});

describe("detectOverload", () => {
  it("flags open load above capacity only", () => {
    expect(detectOverload(16, 15)).toBe(true);
    expect(detectOverload(15, 15)).toBe(false);
    expect(detectOverload(20, 0)).toBe(false);
  });
});

describe("computeWorkload", () => {
  it("counts open / at-risk / breached load and utilization", () => {
    const facts: WorkloadTicketFact[] = [
      { open: true, atRisk: true, breached: false },
      { open: true, atRisk: false, breached: true },
      { open: true, atRisk: false, breached: false }
    ];
    const workload = computeWorkload(facts, 2);
    expect(workload.openCount).toBe(3);
    expect(workload.atRiskCount).toBe(1);
    expect(workload.breachedCount).toBe(1);
    expect(workload.utilizationPct).toBe(150);
    expect(workload.overloaded).toBe(true);
  });
});

describe("computeAgentPerformance", () => {
  const minutes = (n: number) => n * 60000;
  const facts: AgentTicketFact[] = [
    // resolved, on time, 30m first response, 120m resolution, csat 5
    { resolved: true, firstResponseBreached: false, resolutionBreached: false, reopened: false, createdAtMs: 0, firstResponseAtMs: minutes(30), resolvedAtMs: minutes(120), csatScore: 5 },
    // resolved but breached resolution, reopened false, csat 3
    { resolved: true, firstResponseBreached: false, resolutionBreached: true, reopened: false, createdAtMs: 0, firstResponseAtMs: minutes(10), resolvedAtMs: minutes(240), csatScore: 3 },
    // still open, reopened, no csat
    { resolved: false, firstResponseBreached: true, resolutionBreached: false, reopened: true, createdAtMs: 0, firstResponseAtMs: null, resolvedAtMs: null, csatScore: null }
  ];

  it("aggregates counts, SLA compliance, averages and CSAT", () => {
    const metrics = computeAgentPerformance(facts);
    expect(metrics.assigned).toBe(3);
    expect(metrics.resolved).toBe(2);
    expect(metrics.open).toBe(1);
    expect(metrics.slaBreaches).toBe(2); // one resolution breach + one first-response breach
    expect(metrics.slaCompliancePct).toBe(33);
    expect(metrics.reopened).toBe(1);
    expect(metrics.avgFirstResponseMinutes).toBe(20); // mean of 30 and 10
    expect(metrics.avgResolutionMinutes).toBe(180); // mean of 120 and 240
    expect(metrics.csatResponses).toBe(2);
    expect(metrics.csatAverage).toBe(4); // mean of 5 and 3
  });

  it("returns null averages for an empty sample", () => {
    const metrics = computeAgentPerformance([]);
    expect(metrics.assigned).toBe(0);
    expect(metrics.slaCompliancePct).toBe(100);
    expect(metrics.avgFirstResponseMinutes).toBeNull();
    expect(metrics.avgResolutionMinutes).toBeNull();
    expect(metrics.csatAverage).toBeNull();
  });
});

describe("escalationReviewDecisions", () => {
  it("exposes the decision vocabulary", () => {
    expect(escalationReviewDecisions).toEqual(["reassign", "return_to_l1"]);
  });
});
