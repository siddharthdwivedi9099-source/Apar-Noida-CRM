// Persona 25 (Customer Success Manager — Scaled) pure resolvers + API contract.
// Extends the existing customer-success module: automated health scoring, adoption campaigns,
// low-usage alerts, renewal playbooks, and expansion-signal detection. Deterministic helpers are
// unit-tested; AI driver-explanation / content-recommendation stay governed placeholders.

import type { CrmLookupUserSummary } from "./crm.js";

// ---- CSMS-001: automated health score ----------------------------------------------------------

export const healthFactorKeys = [
  "usage",
  "loginActivity",
  "supportTickets",
  "slaBreaches",
  "csat",
  "nps",
  "trainingCompletion",
  "renewalProximity",
  "paymentStatus",
  "engagement"
] as const;
export type HealthFactorKey = (typeof healthFactorKeys)[number];

export const healthFactorLabels: Record<HealthFactorKey, string> = {
  usage: "Product usage",
  loginActivity: "Login activity",
  supportTickets: "Support tickets",
  slaBreaches: "SLA breaches",
  csat: "CSAT",
  nps: "NPS",
  trainingCompletion: "Training completion",
  renewalProximity: "Renewal proximity",
  paymentStatus: "Payment status",
  engagement: "Engagement"
};

// Weights sum to 1.0. Each factor is supplied as a 0–100 health sub-score (higher = healthier).
export const healthFactorWeights: Record<HealthFactorKey, number> = {
  usage: 0.18,
  loginActivity: 0.12,
  supportTickets: 0.1,
  slaBreaches: 0.08,
  csat: 0.12,
  nps: 0.08,
  trainingCompletion: 0.08,
  renewalProximity: 0.06,
  paymentStatus: 0.08,
  engagement: 0.1
};

export const healthBands = ["green", "amber", "red"] as const;
export type HealthBand = (typeof healthBands)[number];

/** CSMS-001: green ≥ 75, amber ≥ 50, else red. */
export function resolveHealthBand(score: number): HealthBand {
  if (score >= 75) {
    return "green";
  }
  if (score >= 50) {
    return "amber";
  }
  return "red";
}

export interface HealthDriver {
  factor: HealthFactorKey;
  label: string;
  subScore: number;
  impact: "positive" | "negative";
}

export interface HealthScoreResult {
  score: number;
  band: HealthBand;
  drivers: HealthDriver[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * CSMS-001: weighted health score from the supplied factor sub-scores. Partial inputs are
 * supported (weights are renormalized over provided factors). Drivers list the factors furthest
 * from the mean so the AI explanation and the CSM can see what moves the score.
 */
export function computeHealthScore(factors: Partial<Record<HealthFactorKey, number>> | null | undefined): HealthScoreResult {
  const data = factors ?? {};
  const provided = healthFactorKeys.filter((key) => typeof data[key] === "number");
  if (provided.length === 0) {
    return { score: 0, band: "red", drivers: [] };
  }
  const totalWeight = provided.reduce((sum, key) => sum + healthFactorWeights[key], 0);
  const weighted = provided.reduce((sum, key) => sum + clamp(data[key] as number, 0, 100) * healthFactorWeights[key], 0);
  const score = Math.round(weighted / totalWeight);

  const drivers: HealthDriver[] = provided
    .map((factor) => ({ factor, label: healthFactorLabels[factor], subScore: clamp(data[factor] as number, 0, 100), impact: (clamp(data[factor] as number, 0, 100) >= score ? "positive" : "negative") as "positive" | "negative" }))
    // Worst (lowest) sub-scores first so the risk drivers surface at the top of the explanation.
    .sort((a, b) => a.subScore - b.subScore)
    .slice(0, 5);

  return { score, band: resolveHealthBand(score), drivers };
}

// ---- CSMS-003: low-usage alert -----------------------------------------------------------------

export interface LowUsageResult {
  low: boolean;
  deficit: number;
  severity: "low" | "medium" | "high" | "critical";
}

/** CSMS-003: usage below the threshold raises an alert; severity scales with the shortfall. */
export function detectLowUsage(current: number, threshold: number): LowUsageResult {
  const deficit = Math.max(0, threshold - current);
  const low = current < threshold;
  const ratio = threshold > 0 ? deficit / threshold : 0;
  const severity = !low ? "low" : ratio >= 0.75 ? "critical" : ratio >= 0.5 ? "high" : ratio >= 0.25 ? "medium" : "low";
  return { low, deficit, severity };
}

// ---- CSMS-005: expansion signals ---------------------------------------------------------------

export const expansionSignalKeys = [
  "high_usage",
  "additional_departments",
  "feature_requests",
  "user_growth",
  "support_queries",
  "engagement"
] as const;
export type ExpansionSignalKey = (typeof expansionSignalKeys)[number];

export interface ExpansionSignalInput {
  usageRatio?: number | null; // current usage vs. entitlement (1.0 = at plan limit)
  additionalDepartments?: number | null;
  featureRequests?: number | null;
  userGrowthRate?: number | null; // fractional growth over the period (0.2 = +20%)
  productSupportQueries?: number | null; // pre-sales / how-do-I queries on other modules
  engagementScore?: number | null; // 0–100
}

export interface ExpansionSignal {
  key: ExpansionSignalKey;
  label: string;
  detected: boolean;
  detail: string;
}

export interface ExpansionAssessment {
  signals: ExpansionSignal[];
  detectedCount: number;
  recommended: boolean;
}

/** CSMS-005: deterministic expansion-signal detection (stands in for the AI recommender). */
export function detectExpansionSignals(input: ExpansionSignalInput | null | undefined): ExpansionAssessment {
  const data = input ?? {};
  const signals: ExpansionSignal[] = [
    { key: "high_usage", label: "High usage vs. plan", detected: (data.usageRatio ?? 0) >= 0.8, detail: `${Math.round((data.usageRatio ?? 0) * 100)}% of entitlement` },
    { key: "additional_departments", label: "Additional departments", detected: (data.additionalDepartments ?? 0) >= 1, detail: `${data.additionalDepartments ?? 0} new department(s)` },
    { key: "feature_requests", label: "Feature requests", detected: (data.featureRequests ?? 0) >= 2, detail: `${data.featureRequests ?? 0} request(s)` },
    { key: "user_growth", label: "User growth", detected: (data.userGrowthRate ?? 0) >= 0.15, detail: `${Math.round((data.userGrowthRate ?? 0) * 100)}% growth` },
    { key: "support_queries", label: "Cross-module queries", detected: (data.productSupportQueries ?? 0) >= 3, detail: `${data.productSupportQueries ?? 0} query(ies)` },
    { key: "engagement", label: "Strong engagement", detected: (data.engagementScore ?? 0) >= 70, detail: `engagement ${data.engagementScore ?? 0}` }
  ];
  const detectedCount = signals.filter((signal) => signal.detected).length;
  return { signals, detectedCount, recommended: detectedCount >= 2 };
}

// ---- CSMS-002: adoption campaign targeting -----------------------------------------------------

export interface AdoptionCampaignCriteria {
  minUsage?: number | null;
  module?: string | null;
  role?: string | null;
  segmentKey?: string | null;
  healthBand?: HealthBand | null;
}

export interface CampaignTargetCandidate {
  usage?: number | null;
  modules?: string[] | null;
  role?: string | null;
  segmentKey?: string | null;
  healthBand?: HealthBand | null;
}

/** CSMS-002: does a customer match the campaign's targeting criteria? */
export function matchesCampaignTarget(candidate: CampaignTargetCandidate, criteria: AdoptionCampaignCriteria): boolean {
  if (typeof criteria.minUsage === "number" && (candidate.usage ?? 0) < criteria.minUsage) {
    return false;
  }
  if (criteria.module && !(candidate.modules ?? []).includes(criteria.module)) {
    return false;
  }
  if (criteria.role && candidate.role !== criteria.role) {
    return false;
  }
  if (criteria.segmentKey && candidate.segmentKey !== criteria.segmentKey) {
    return false;
  }
  if (criteria.healthBand && candidate.healthBand !== criteria.healthBand) {
    return false;
  }
  return true;
}

// ---- API contract ------------------------------------------------------------------------------

export const adoptionCampaignStatuses = ["draft", "active", "completed", "archived"] as const;
export type AdoptionCampaignStatus = (typeof adoptionCampaignStatuses)[number];

export interface AdoptionCampaignSummary {
  id: string;
  name: string;
  status: AdoptionCampaignStatus;
  criteria: AdoptionCampaignCriteria;
  contentTemplate: string | null;
  targetCount: number;
  engagementRate: number | null;
  adoptionImprovement: number | null;
  aiRecommendation: { available: false; message: string };
  createdAt: string;
  updatedAt: string;
}

export interface AdoptionCampaignsResponse {
  campaigns: AdoptionCampaignSummary[];
}

export interface AdoptionCampaignResponse {
  campaign: AdoptionCampaignSummary;
}

export interface CsHealthComputeResponse {
  score: number;
  band: HealthBand;
  drivers: HealthDriver[];
  aiExplanation: { available: false; message: string };
}

export interface CsRenewalPlaybookResponse {
  renewalId: string;
  taskIds: string[];
  healthScore: number | null;
  openEscalationCount: number;
}

export interface CsExpansionSignalsResponse {
  assessment: ExpansionAssessment;
  aiRecommendation: { available: false; message: string };
}

// ---- Request bodies ----------------------------------------------------------------------------

export interface ComputeHealthScoreRequestBody {
  factors: Partial<Record<HealthFactorKey, number>>;
  notes?: string | null;
}

export interface CreateAdoptionCampaignRequestBody {
  name: string;
  criteria: AdoptionCampaignCriteria;
  contentTemplate?: string | null;
  status?: AdoptionCampaignStatus;
}

export interface LowUsageCheckRequestBody {
  metricLabel: string;
  current: number;
  threshold: number;
}

export interface RenewalPlaybookRequestBody {
  renewalDate: string;
  forecastValue?: number | null;
  salesOwnerId?: string | null;
  financeOwnerId?: string | null;
  customerContact?: string | null;
}

export interface CreateExpansionOpportunityRequestBody {
  name: string;
  amount?: number | null;
  salesOwnerId?: string | null;
  signals?: ExpansionSignalInput;
}
