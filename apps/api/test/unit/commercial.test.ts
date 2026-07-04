import { describe, expect, it } from "vitest";
import {
  computePartnerCommission,
  computeQuoteTotals,
  detectQuoteDeviations,
  evaluateDiscountApprovalRequirement,
  isNonStandardPaymentTerm,
  type DiscountTier
} from "@crm/types";

describe("computeQuoteTotals", () => {
  it("applies per-line discount and tax and adds fees", () => {
    const totals = computeQuoteTotals(
      [{ quantity: 2, unitPrice: 100, discountPct: 10, taxPct: 18 }],
      500,
      200
    );
    // gross 200, discount 20, net 180, tax 32.4
    expect(totals.subtotal).toBe(200);
    expect(totals.discountTotal).toBe(20);
    expect(totals.taxTotal).toBe(32.4);
    expect(totals.feesTotal).toBe(700);
    expect(totals.total).toBe(200 - 20 + 32.4 + 700);
  });
});

describe("evaluateDiscountApprovalRequirement", () => {
  const tiers: DiscountTier[] = [
    { key: "standard", label: "Standard", thresholdPct: 10, requiresApproval: false, approverRole: null },
    { key: "manager", label: "Manager", thresholdPct: 20, requiresApproval: true, approverRole: "sales-manager" },
    { key: "finance", label: "Finance", thresholdPct: 35, requiresApproval: true, approverRole: "finance" }
  ];

  it("auto-approves within the standard tier", () => {
    expect(evaluateDiscountApprovalRequirement(8, tiers)).toMatchObject({ requiresApproval: false, tierKey: "standard" });
  });
  it("requires approval in higher tiers", () => {
    expect(evaluateDiscountApprovalRequirement(18, tiers)).toMatchObject({ requiresApproval: true, tierKey: "manager" });
    expect(evaluateDiscountApprovalRequirement(30, tiers)).toMatchObject({ requiresApproval: true, tierKey: "finance" });
  });
  it("requires approval above the top tier", () => {
    expect(evaluateDiscountApprovalRequirement(60, tiers).requiresApproval).toBe(true);
  });
  it("defaults to requiring approval when no matrix is configured", () => {
    expect(evaluateDiscountApprovalRequirement(5, []).requiresApproval).toBe(true);
    expect(evaluateDiscountApprovalRequirement(0, []).requiresApproval).toBe(false);
  });
});

describe("isNonStandardPaymentTerm", () => {
  it("flags terms outside the standard set", () => {
    expect(isNonStandardPaymentTerm(["net_30", "net_45"], "net_30")).toBe(false);
    expect(isNonStandardPaymentTerm(["net_30", "net_45"], "milestone")).toBe(true);
    expect(isNonStandardPaymentTerm(["net_30"], null)).toBe(false);
  });
});

describe("computePartnerCommission", () => {
  it("applies rate then adjustment", () => {
    expect(computePartnerCommission(100000, 10)).toBe(10000);
    expect(computePartnerCommission(100000, 10, -1500)).toBe(8500);
  });
});

describe("detectQuoteDeviations", () => {
  it("highlights discount, margin, and payment deviations", () => {
    const deviations = detectQuoteDeviations({ discountPct: 25, maxAutoDiscountPct: 10, marginPct: 12, minMarginPct: 20, nonStandardPaymentTerm: true });
    expect(deviations).toHaveLength(3);
    expect(detectQuoteDeviations({ discountPct: 5, maxAutoDiscountPct: 10 })).toHaveLength(0);
  });
});
