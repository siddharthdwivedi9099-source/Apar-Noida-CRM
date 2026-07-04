import { describe, expect, it } from "vitest";
import { computeQuotaAttainment, computeWinRate, projectQuotaRisk } from "@crm/types";

describe("computeQuotaAttainment", () => {
  it("computes percent, gap, and status bands", () => {
    expect(computeQuotaAttainment(100000, 120000)).toMatchObject({ attainmentPercent: 120, gap: 0, status: "met" });
    expect(computeQuotaAttainment(100000, 80000)).toMatchObject({ attainmentPercent: 80, gap: 20000, status: "on_track" });
    expect(computeQuotaAttainment(100000, 50000)).toMatchObject({ attainmentPercent: 50, gap: 50000, status: "at_risk" });
    expect(computeQuotaAttainment(100000, 10000)).toMatchObject({ attainmentPercent: 10, gap: 90000, status: "behind" });
  });

  it("handles a zero/invalid target without dividing by zero", () => {
    expect(computeQuotaAttainment(0, 5000)).toMatchObject({ attainmentPercent: 0, gap: 0, status: "behind" });
    expect(computeQuotaAttainment(Number.NaN, Number.NaN)).toMatchObject({ targetAmount: 0, achievedAmount: 0 });
  });
});

describe("projectQuotaRisk", () => {
  it("projects achieved + weighted pipeline against target", () => {
    expect(projectQuotaRisk(100000, 60000, 50000)).toMatchObject({ projectedAmount: 110000, coverageRatio: 1.1, risk: "low" });
    expect(projectQuotaRisk(100000, 50000, 35000)).toMatchObject({ projectedAmount: 85000, coverageRatio: 0.85, risk: "medium" });
    expect(projectQuotaRisk(100000, 20000, 30000)).toMatchObject({ projectedAmount: 50000, coverageRatio: 0.5, risk: "high" });
  });

  it("treats a zero target as low risk", () => {
    expect(projectQuotaRisk(0, 0, 0).risk).toBe("low");
  });
});

describe("computeWinRate", () => {
  it("is a 0-100 integer over decided deals only", () => {
    expect(computeWinRate(3, 1)).toBe(75);
    expect(computeWinRate(0, 0)).toBe(0);
    expect(computeWinRate(5, 0)).toBe(100);
  });
});
