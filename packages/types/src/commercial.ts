// Persona 17 (Commercial / Finance Approver) pure resolvers + API contract.
// Finance governance is deterministic — these helpers are unit-tested directly.

import type { CrmLookupUserSummary, CrmOptionValueSummary } from "./crm.js";

export const quoteReviewStatuses = ["pending", "approved", "rejected", "changes_requested"] as const;
export type QuoteReviewStatus = (typeof quoteReviewStatuses)[number];

export const commercialApprovalStates = ["not_required", "required", "submitted", "approved", "rejected"] as const;
export type CommercialApprovalState = (typeof commercialApprovalStates)[number];

export interface CommercialQuoteLineInput {
  quantity: number;
  unitPrice: number;
  discountPct?: number;
  taxPct?: number;
}

export interface CommercialQuoteTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  feesTotal: number;
  total: number;
}

/** FIN-001: roll up line items + fees into quote totals. */
export function computeQuoteTotals(
  lines: CommercialQuoteLineInput[] | null | undefined,
  implementationFees = 0,
  recurringFees = 0
): CommercialQuoteTotals {
  const list = Array.isArray(lines) ? lines : [];
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  for (const line of list) {
    const quantity = Number.isFinite(line.quantity) ? line.quantity : 0;
    const unitPrice = Number.isFinite(line.unitPrice) ? line.unitPrice : 0;
    const gross = quantity * unitPrice;
    const discount = gross * (Math.max(0, Math.min(100, line.discountPct ?? 0)) / 100);
    const net = gross - discount;
    const tax = net * (Math.max(0, line.taxPct ?? 0) / 100);
    subtotal += gross;
    discountTotal += discount;
    taxTotal += tax;
  }
  const feesTotal = Math.max(0, implementationFees) + Math.max(0, recurringFees);
  const total = subtotal - discountTotal + taxTotal + feesTotal;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountTotal: Math.round(discountTotal * 100) / 100,
    taxTotal: Math.round(taxTotal * 100) / 100,
    feesTotal: Math.round(feesTotal * 100) / 100,
    total: Math.round(total * 100) / 100
  };
}

export interface DiscountTier {
  key: string;
  label: string;
  thresholdPct: number;
  requiresApproval: boolean;
  approverRole: string | null;
}

export interface DiscountApprovalRequirement {
  requiresApproval: boolean;
  tierKey: string | null;
  tierLabel: string | null;
  approverRole: string | null;
}

/**
 * FIN-002: evaluate a requested discount against the configurable approval matrix.
 * Returns the lowest tier whose threshold covers the requested discount.
 */
export function evaluateDiscountApprovalRequirement(discountPct: number, tiers: DiscountTier[] | null | undefined): DiscountApprovalRequirement {
  const requested = Math.max(0, Number.isFinite(discountPct) ? discountPct : 0);
  const sorted = [...(Array.isArray(tiers) ? tiers : [])].sort((a, b) => a.thresholdPct - b.thresholdPct);
  for (const tier of sorted) {
    if (requested <= tier.thresholdPct) {
      return { requiresApproval: tier.requiresApproval, tierKey: tier.key, tierLabel: tier.label, approverRole: tier.approverRole };
    }
  }
  const top = sorted[sorted.length - 1];
  if (top) {
    return { requiresApproval: true, tierKey: top.key, tierLabel: top.label, approverRole: top.approverRole };
  }
  // No matrix configured: anything above zero needs approval as a safe default.
  return { requiresApproval: requested > 0, tierKey: null, tierLabel: null, approverRole: null };
}

/** FIN-003: a payment term is non-standard when it is not in the configured standard set. */
export function isNonStandardPaymentTerm(standardKeys: string[] | null | undefined, termKey: string | null | undefined): boolean {
  if (!termKey) {
    return false;
  }
  return !(Array.isArray(standardKeys) ? standardKeys : []).includes(termKey);
}

/** FIN-004: commission = basis * rate, plus a finance adjustment (which may be negative). */
export function computePartnerCommission(basisAmount: number, ratePct: number, adjustmentAmount = 0): number {
  const basis = Math.max(0, Number.isFinite(basisAmount) ? basisAmount : 0);
  const rate = Math.max(0, Number.isFinite(ratePct) ? ratePct : 0);
  const adjustment = Number.isFinite(adjustmentAmount) ? adjustmentAmount : 0;
  return Math.round((basis * (rate / 100) + adjustment) * 100) / 100;
}

export interface DeviationInput {
  discountPct?: number;
  maxAutoDiscountPct?: number;
  marginPct?: number | null;
  minMarginPct?: number;
  nonStandardPaymentTerm?: boolean;
}

/** FIN-001: highlight commercial deviations on the quote. */
export function detectQuoteDeviations(input: DeviationInput): string[] {
  const deviations: string[] = [];
  if ((input.discountPct ?? 0) > (input.maxAutoDiscountPct ?? Infinity)) {
    deviations.push(`Discount ${input.discountPct}% exceeds the auto-approval ceiling of ${input.maxAutoDiscountPct}%`);
  }
  if (input.marginPct !== null && input.marginPct !== undefined && input.minMarginPct !== undefined && input.marginPct < input.minMarginPct) {
    deviations.push(`Margin ${input.marginPct}% is below the minimum of ${input.minMarginPct}%`);
  }
  if (input.nonStandardPaymentTerm) {
    deviations.push("Non-standard payment terms");
  }
  return deviations;
}

// ---- API contract ------------------------------------------------------------------------------

export interface CommercialQuoteLineItem {
  id: string;
  product: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  taxPct: number;
  lineTotal: number;
}

export interface CommercialQuote {
  lineItems: CommercialQuoteLineItem[];
  implementationFees: number;
  recurringFees: number;
  paymentTermsKey: string | null;
  marginPct: number | null;
  totals: CommercialQuoteTotals;
  deviations: string[];
  reviewStatus: QuoteReviewStatus;
  reviewedBy: CrmLookupUserSummary | null;
  reviewComments: string | null;
  updatedAt: string | null;
}

export interface CommercialDiscount {
  requestedDiscountPct: number;
  justification: string | null;
  marginImpactPct: number | null;
  requirement: DiscountApprovalRequirement;
  approvalId: string | null;
  approvalStatus: string | null;
  state: CommercialApprovalState;
}

export interface CommercialPaymentTerms {
  termsKey: string | null;
  nonStandard: boolean;
  approvedTermsText: string | null;
  approvalId: string | null;
  approvalStatus: string | null;
  state: CommercialApprovalState;
}

export interface CommercialCommission {
  partnerId: string | null;
  partnerName: string | null;
  basisAmount: number;
  ratePct: number;
  adjustmentAmount: number;
  adjustmentReason: string | null;
  computedAmount: number;
  linkedClosedWon: boolean;
  approvalId: string | null;
  approvalStatus: string | null;
  state: CommercialApprovalState;
}

export interface CommercialView {
  opportunityId: string;
  currency: string;
  quote: CommercialQuote;
  discount: CommercialDiscount;
  paymentTerms: CommercialPaymentTerms;
  commission: CommercialCommission;
}

export interface CommercialResponse {
  commercial: CommercialView;
}

export interface CommercialPartnerOption {
  id: string;
  name: string;
}

export interface CommercialOptionsResponse {
  paymentTerms: CrmOptionValueSummary[];
  standardPaymentTermKeys: string[];
  discountTiers: DiscountTier[];
  maxAutoDiscountPct: number | null;
  partners: CommercialPartnerOption[];
  approvers: CrmLookupUserSummary[];
}

export interface UpsertQuoteLineItemInput {
  id?: string;
  product: string;
  quantity: number;
  unitPrice: number;
  discountPct?: number;
  taxPct?: number;
}

export interface UpsertQuoteRequestBody {
  lineItems: UpsertQuoteLineItemInput[];
  implementationFees?: number;
  recurringFees?: number;
  paymentTermsKey?: string | null;
  marginPct?: number | null;
}

export interface ReviewQuoteRequestBody {
  decision: "approved" | "rejected" | "changes_requested";
  comments?: string | null;
}

export interface SubmitDiscountRequestBody {
  requestedDiscountPct: number;
  justification?: string | null;
  marginImpactPct?: number | null;
  approverUserId: string;
}

export interface SubmitPaymentTermsRequestBody {
  termsKey: string;
  approverUserId: string;
  note?: string | null;
}

export interface SetCommissionRequestBody {
  partnerId?: string | null;
  ratePct: number;
  basisAmount?: number | null;
  adjustmentAmount?: number | null;
  adjustmentReason?: string | null;
}

export interface SubmitCommissionRequestBody {
  approverUserId: string;
  note?: string | null;
}
