import { describe, expect, it } from "vitest";
import { computePartnerFitScore, computePartnerWinRate, detectChannelConflicts } from "@crm/types";

describe("computePartnerFitScore", () => {
  it("bands a strong applicant as high", () => {
    const fit = computePartnerFitScore({ salesCapacityRating: 5, technicalCapabilityRating: 5, hasCertifications: true, hasReferences: true, customerBaseSize: 150 });
    expect(fit.score).toBe(100);
    expect(fit.band).toBe("high");
  });
  it("bands a weak applicant as low", () => {
    const fit = computePartnerFitScore({ salesCapacityRating: 1, technicalCapabilityRating: 1 });
    expect(fit.score).toBe(18);
    expect(fit.band).toBe("low");
  });
  it("clamps ratings and handles empty input", () => {
    expect(computePartnerFitScore({ salesCapacityRating: 99 }).score).toBeLessThanOrEqual(100);
    expect(computePartnerFitScore({}).band).toBe("low");
  });
});

describe("detectChannelConflicts", () => {
  it("flags overlapping registrations across different partners", () => {
    const groups = detectChannelConflicts([
      { dealId: "d1", partnerId: "p1", conflictKey: "Globex", submittedAt: "2026-01-01T00:00:00Z" },
      { dealId: "d2", partnerId: "p2", conflictKey: "globex", submittedAt: "2026-01-03T00:00:00Z" },
      { dealId: "d3", partnerId: "p1", conflictKey: "Initech", submittedAt: "2026-01-02T00:00:00Z" }
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].conflictKey).toBe("globex");
    expect(groups[0].registrations[0].dealId).toBe("d1"); // earliest first
  });
  it("does not flag a single partner's own duplicates", () => {
    expect(detectChannelConflicts([
      { dealId: "d1", partnerId: "p1", conflictKey: "Acme", submittedAt: "2026-01-01T00:00:00Z" },
      { dealId: "d2", partnerId: "p1", conflictKey: "Acme", submittedAt: "2026-01-02T00:00:00Z" }
    ])).toHaveLength(0);
  });
});

describe("computePartnerWinRate", () => {
  it("computes over decided deals only", () => {
    expect(computePartnerWinRate(3, 1)).toBe(75);
    expect(computePartnerWinRate(0, 0)).toBe(0);
  });
});
