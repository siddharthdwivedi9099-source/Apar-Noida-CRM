import { describe, expect, it } from "vitest";
import { evaluateProposalCompliance, isProposalContentExpired, summarizeProposalVersions } from "@crm/types";

describe("evaluateProposalCompliance", () => {
  it("counts responses, compliance, gaps and flags missing responses", () => {
    const summary = evaluateProposalCompliance([
      { responseStatus: "complete", complianceStatus: "compliant" },
      { responseStatus: "complete", complianceStatus: "partial" },
      { responseStatus: "pending", complianceStatus: "pending" }
    ]);
    expect(summary.total).toBe(3);
    expect(summary.respondedCount).toBe(2);
    expect(summary.missingResponseCount).toBe(1);
    expect(summary.compliantCount).toBe(1);
    expect(summary.gapCount).toBe(1);
    expect(summary.complete).toBe(false);
  });

  it("is complete only when all items are responded and never complete when empty", () => {
    expect(evaluateProposalCompliance([{ responseStatus: "complete", complianceStatus: "compliant" }]).complete).toBe(true);
    expect(evaluateProposalCompliance([]).complete).toBe(false);
  });
});

describe("isProposalContentExpired", () => {
  it("flags past expiry dates only", () => {
    expect(isProposalContentExpired("2020-01-01", "2026-01-01T00:00:00.000Z")).toBe(true);
    expect(isProposalContentExpired("2030-01-01", "2026-01-01T00:00:00.000Z")).toBe(false);
    expect(isProposalContentExpired(null)).toBe(false);
  });
});

describe("summarizeProposalVersions", () => {
  it("detects a locked final version by id", () => {
    const versions = [{ id: "v1", locked: false }, { id: "v2", locked: true }];
    const summary = summarizeProposalVersions(versions, "v2", versions);
    expect(summary.count).toBe(2);
    expect(summary.hasFinal).toBe(true);
    expect(summary.finalLocked).toBe(true);
  });

  it("reports no final when none is set", () => {
    const summary = summarizeProposalVersions([{ id: "v1", locked: false }], null, [{ id: "v1", locked: false }]);
    expect(summary.hasFinal).toBe(false);
    expect(summary.finalLocked).toBe(false);
  });
});
