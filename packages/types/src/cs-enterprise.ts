// Persona 26 (Customer Success Manager — Enterprise) pure resolvers + API contract.
// Extends the existing customer-success module: strategic success plans, executive business
// reviews, strategic-risk management, renewal strategy, and advocacy. Deterministic helpers are
// unit-tested; AI plan-suggestion / review-summary / renewal-prediction stay governed placeholders.

import type { CrmLookupUserSummary } from "./crm.js";

// ---- CSME-001: strategic success plan ----------------------------------------------------------

export const successPlanSections = [
  "objectives",
  "stakeholders",
  "successMetrics",
  "adoptionRoadmap",
  "milestones",
  "risks",
  "renewalDate",
  "expansionOpportunities"
] as const;
export type SuccessPlanSection = (typeof successPlanSections)[number];

export const mandatorySuccessPlanSections: readonly SuccessPlanSection[] = ["objectives", "successMetrics", "adoptionRoadmap", "renewalDate"];

export type SuccessPlanInput = Partial<Record<SuccessPlanSection, string | null>>;

export interface SuccessPlanValidation {
  missingSections: SuccessPlanSection[];
  missingMandatory: SuccessPlanSection[];
  complete: boolean;
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** CSME-001: flag empty sections; the plan is "complete" once mandatory sections have content. */
export function validateSuccessPlan(plan: SuccessPlanInput | null | undefined): SuccessPlanValidation {
  const data = plan ?? {};
  const missingSections = successPlanSections.filter((section) => !hasText(data[section]));
  const missingMandatory = mandatorySuccessPlanSections.filter((section) => !hasText(data[section]));
  return { missingSections, missingMandatory, complete: missingMandatory.length === 0 };
}

// ---- CSME-002: executive business review -------------------------------------------------------

export const reviewSections = ["adoption", "outcomes", "supportPerformance", "roi", "roadmap", "risks", "nextSteps"] as const;
export type ReviewSection = (typeof reviewSections)[number];

// ---- CSME-003: strategic risk ------------------------------------------------------------------

export const strategicRiskTypes = [
  "low_adoption",
  "sponsor_change",
  "unresolved_support",
  "payment_delay",
  "competitor",
  "poor_satisfaction",
  "renewal_uncertainty"
] as const;
export type StrategicRiskType = (typeof strategicRiskTypes)[number];

export const riskSeverities = ["low", "medium", "high", "critical"] as const;
export type RiskSeverity = (typeof riskSeverities)[number];

/** CSME-003: high and critical strategic risks escalate to leadership. */
export function requiresLeadershipEscalation(severity: RiskSeverity): boolean {
  return severity === "high" || severity === "critical";
}

// ---- CSME-004: renewal strategy / probability --------------------------------------------------

export const renewalProbabilityBands = ["likely", "at_risk", "unlikely"] as const;
export type RenewalProbabilityBand = (typeof renewalProbabilityBands)[number];

export interface RenewalPredictionFactors {
  healthScore?: number | null; // 0–100
  usageScore?: number | null; // 0–100
  valueDelivered?: number | null; // 0–100
  stakeholderStrength?: number | null; // 0–100
  expansionPotential?: number | null; // 0–100
  openRiskCount?: number | null; // count (penalty)
}

export interface RenewalPrediction {
  probability: number;
  band: RenewalProbabilityBand;
}

const RENEWAL_WEIGHTS = { healthScore: 0.3, usageScore: 0.2, valueDelivered: 0.25, stakeholderStrength: 0.15, expansionPotential: 0.1 } as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** CSME-004: weighted renewal-probability prediction (stands in for the AI predictor). */
export function predictRenewalProbability(factors: RenewalPredictionFactors | null | undefined): RenewalPrediction {
  const data = factors ?? {};
  const keys = Object.keys(RENEWAL_WEIGHTS) as (keyof typeof RENEWAL_WEIGHTS)[];
  const provided = keys.filter((key) => typeof data[key] === "number");
  let base: number;
  if (provided.length === 0) {
    base = 50;
  } else {
    const totalWeight = provided.reduce((sum, key) => sum + RENEWAL_WEIGHTS[key], 0);
    base = provided.reduce((sum, key) => sum + clamp(data[key] as number, 0, 100) * RENEWAL_WEIGHTS[key], 0) / totalWeight;
  }
  const penalty = Math.min(30, Math.max(0, data.openRiskCount ?? 0) * 8);
  const probability = Math.round(clamp(base - penalty, 0, 100));
  const band: RenewalProbabilityBand = probability >= 70 ? "likely" : probability >= 40 ? "at_risk" : "unlikely";
  return { probability, band };
}

// ---- CSME-005: advocacy readiness --------------------------------------------------------------

export interface AdvocacyFactors {
  healthScore?: number | null; // 0–100
  nps?: number | null; // -100..100
  adoptionScore?: number | null; // 0–100
  renewalSecured?: boolean | null;
  executiveRelationship?: number | null; // 0–100
}

export interface AdvocacyDriver {
  factor: string;
  label: string;
  value: number;
}

export interface AdvocacyReadiness {
  score: number;
  ready: boolean;
  drivers: AdvocacyDriver[];
}

/** CSME-005: advocacy readiness from health, NPS, adoption, renewal status and exec relationship. */
export function computeAdvocacyReadiness(factors: AdvocacyFactors | null | undefined): AdvocacyReadiness {
  const data = factors ?? {};
  const npsNormalized = typeof data.nps === "number" ? clamp((data.nps + 100) / 2, 0, 100) : null;
  const parts: AdvocacyDriver[] = [];
  const push = (factor: string, label: string, value: number | null | undefined) => {
    if (typeof value === "number") {
      parts.push({ factor, label, value: clamp(value, 0, 100) });
    }
  };
  push("healthScore", "Health score", data.healthScore);
  push("nps", "NPS", npsNormalized);
  push("adoptionScore", "Adoption", data.adoptionScore);
  push("executiveRelationship", "Executive relationship", data.executiveRelationship);
  if (typeof data.renewalSecured === "boolean") {
    parts.push({ factor: "renewalSecured", label: "Renewal secured", value: data.renewalSecured ? 100 : 40 });
  }
  const score = parts.length > 0 ? Math.round(parts.reduce((sum, part) => sum + part.value, 0) / parts.length) : 0;
  return { score, ready: score >= 70, drivers: parts.sort((a, b) => b.value - a.value) };
}

// ---- API contract ------------------------------------------------------------------------------

export interface CsSuccessPlanView {
  sections: SuccessPlanInput;
  validation: SuccessPlanValidation;
  reviewedWithCustomerAt: string | null;
  aiSuggestion: { available: false; message: string };
  updatedAt: string | null;
}

export interface CsQbrReviewView {
  qbrId: string;
  sections: Partial<Record<ReviewSection, string>>;
  actionItems: Array<{ id: string; description: string; owner: CrmLookupUserSummary | null; dueDate: string | null; done: boolean }>;
  aiSummary: { available: false; message: string };
  completedAt: string | null;
}

export interface CsAdvocacyView {
  readiness: AdvocacyReadiness | null;
  requested: boolean;
  requestType: string | null;
  consentStatus: "not_requested" | "pending" | "granted" | "declined";
  requestedAt: string | null;
}

// ---- Request bodies ----------------------------------------------------------------------------

export interface UpsertSuccessPlanEnterpriseRequestBody {
  name?: string | null;
  sections: SuccessPlanInput;
  reviewWithCustomer?: boolean;
}

export interface ScheduleQbrRequestBody {
  title: string;
  qbrType?: string;
  scheduledDate: string;
}

export interface RecordQbrReviewRequestBody {
  sections: Partial<Record<ReviewSection, string>>;
  actionItems?: Array<{ description: string; ownerId?: string | null; dueDate?: string | null }>;
  markCompleted?: boolean;
}

export interface RecordStrategicRiskRequestBody {
  riskType: StrategicRiskType;
  severity: RiskSeverity;
  ownerId: string;
  mitigationPlan: string;
  description?: string | null;
}

export interface RenewalStrategyRequestBody {
  renewalDate: string;
  commercialTerms?: string | null;
  valueDelivered?: string | null;
  stakeholders?: string | null;
  risks?: string | null;
  expansionPotential?: string | null;
  salesOwnerId?: string | null;
  factors?: RenewalPredictionFactors;
}

export interface AssessAdvocacyRequestBody {
  factors: AdvocacyFactors;
}

export interface CreateAdvocacyRequestBody {
  requestType: string;
  factors?: AdvocacyFactors;
  notes?: string | null;
}

export interface CsRenewalStrategyResponse {
  renewalId: string;
  prediction: RenewalPrediction;
  aiPrediction: { available: false; message: string };
}
