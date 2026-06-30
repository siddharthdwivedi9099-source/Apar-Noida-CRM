import { describe, expect, it } from "vitest";
import { canApproveContract, evaluateLegalClauses, evaluateLegalSla } from "@crm/types";

describe("evaluateLegalSla", () => {
  it("classifies on_track / due_soon / breached / none", () => {
    const now = "2026-01-10T00:00:00.000Z";
    expect(evaluateLegalSla(null, now)).toBe("none");
    expect(evaluateLegalSla("2026-01-09T00:00:00.000Z", now)).toBe("breached");
    expect(evaluateLegalSla("2026-01-10T12:00:00.000Z", now)).toBe("due_soon");
    expect(evaluateLegalSla("2026-01-20T00:00:00.000Z", now)).toBe("on_track");
  });
});

describe("evaluateLegalClauses", () => {
  it("counts tags and treats unapproved high-risk as unresolved", () => {
    const summary = evaluateLegalClauses([
      { status: "standard" },
      { status: "modified" },
      { status: "high_risk" },
      { status: "high_risk", approvalApproved: true }
    ]);
    expect(summary.total).toBe(4);
    expect(summary.highRisk).toBe(2);
    expect(summary.unresolvedHighRisk).toBe(1);
    expect(summary.hasUnresolvedHighRisk).toBe(true);
  });
});

describe("canApproveContract", () => {
  it("blocks while unresolved high-risk clauses exist, allows once resolved", () => {
    expect(canApproveContract([{ status: "high_risk" }])).toBe(false);
    expect(canApproveContract([{ status: "high_risk", approvalApproved: true }, { status: "accepted" }])).toBe(true);
    expect(canApproveContract([{ status: "standard" }, { status: "rejected" }])).toBe(true);
    expect(canApproveContract([])).toBe(true);
  });
});
