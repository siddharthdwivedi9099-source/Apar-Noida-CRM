// Persona 13 (Sales Head / Revenue Leader) pure resolvers.
// Deterministic, side-effect-free helpers shared by the API and unit-tested directly.

import type { CrmLookupUserSummary, CrmOptionValueSummary } from "./crm.js";

export const quotaPeriodTypes = ["month", "quarter", "year"] as const;
export type QuotaPeriodType = (typeof quotaPeriodTypes)[number];

export type QuotaAttainmentStatus = "met" | "on_track" | "at_risk" | "behind";
export type QuotaRiskLevel = "low" | "medium" | "high";

export interface QuotaAttainment {
  targetAmount: number;
  achievedAmount: number;
  attainmentPercent: number;
  gap: number;
  status: QuotaAttainmentStatus;
}

/**
 * Attainment of a quota target by closed-won revenue. `gap` is the remaining
 * amount to reach target (never negative). Status is percent-banded.
 */
export function computeQuotaAttainment(targetAmount: number, achievedAmount: number): QuotaAttainment {
  const target = Number.isFinite(targetAmount) && targetAmount > 0 ? targetAmount : 0;
  const achieved = Number.isFinite(achievedAmount) && achievedAmount > 0 ? achievedAmount : 0;
  const attainmentPercent = target > 0 ? Math.round((achieved / target) * 100) : 0;
  const gap = Math.max(0, Math.round(target - achieved));
  let status: QuotaAttainmentStatus;
  if (attainmentPercent >= 100) {
    status = "met";
  } else if (attainmentPercent >= 70) {
    status = "on_track";
  } else if (attainmentPercent >= 40) {
    status = "at_risk";
  } else {
    status = "behind";
  }
  return { targetAmount: target, achievedAmount: achieved, attainmentPercent, gap, status };
}

/**
 * Deterministic quota-risk projection: achieved-won plus weighted open pipeline
 * against target. This backs the SH-002 risk indicator; live AI prediction stays
 * a governed placeholder.
 */
export function projectQuotaRisk(targetAmount: number, achievedAmount: number, weightedPipeline: number): {
  projectedAmount: number;
  coverageRatio: number;
  risk: QuotaRiskLevel;
} {
  const target = Number.isFinite(targetAmount) && targetAmount > 0 ? targetAmount : 0;
  const achieved = Math.max(0, Number.isFinite(achievedAmount) ? achievedAmount : 0);
  const weighted = Math.max(0, Number.isFinite(weightedPipeline) ? weightedPipeline : 0);
  const projectedAmount = Math.round(achieved + weighted);
  const coverageRatio = target > 0 ? Number((projectedAmount / target).toFixed(2)) : projectedAmount > 0 ? 1 : 0;
  let risk: QuotaRiskLevel;
  if (target === 0 || coverageRatio >= 1) {
    risk = "low";
  } else if (coverageRatio >= 0.8) {
    risk = "medium";
  } else {
    risk = "high";
  }
  return { projectedAmount, coverageRatio, risk };
}

/** Win rate as a 0-100 integer from decided (won + lost) deals. */
export function computeWinRate(wonCount: number, lostCount: number): number {
  const won = Math.max(0, Math.trunc(wonCount));
  const decided = won + Math.max(0, Math.trunc(lostCount));
  return decided > 0 ? Math.round((won / decided) * 100) : 0;
}

// ---- SH-002 Quota management API ----------------------------------------------------------------

export interface SalesQuotaSummary {
  id: string;
  name: string;
  periodType: QuotaPeriodType;
  periodStart: string;
  periodEnd: string;
  owner: CrmLookupUserSummary | null;
  team: { id: string; name: string } | null;
  product: string | null;
  region: string | null;
  segment: string | null;
  targetAmount: number;
  parentQuotaId: string | null;
  attainment: QuotaAttainment;
  risk: { projectedAmount: number; coverageRatio: number; risk: QuotaRiskLevel };
  childCount: number;
}

export interface SalesQuotasResponse {
  quotas: SalesQuotaSummary[];
  aiPlaceholder: { available: false; message: string };
}

export interface CreateSalesQuotaRequestBody {
  name: string;
  periodType: QuotaPeriodType;
  periodStart: string;
  periodEnd: string;
  ownerId?: string | null;
  teamId?: string | null;
  product?: string | null;
  region?: string | null;
  segment?: string | null;
  targetAmount: number;
  parentQuotaId?: string | null;
}

export interface UpdateSalesQuotaRequestBody {
  name?: string;
  targetAmount?: number;
  ownerId?: string | null;
  teamId?: string | null;
  product?: string | null;
  region?: string | null;
  segment?: string | null;
  parentQuotaId?: string | null;
}

// ---- SH-001 Revenue dashboard API ---------------------------------------------------------------

export interface RevenueDashboardTeamRow {
  team: { id: string; name: string } | null;
  pipelineValue: number;
  weightedForecast: number;
  wonValue: number;
}

export interface RevenueDashboardResponse {
  targetAmount: number;
  achievedAmount: number;
  gap: number;
  pipelineValue: number;
  weightedForecast: number;
  winRate: number;
  avgDealSize: number;
  avgCycleDays: number;
  renewalPipelineValue: number;
  byTeam: RevenueDashboardTeamRow[];
  filters: { region: string | null; product: string | null; segment: string | null; teamId: string | null; from: string | null; to: string | null };
  aiPlaceholder: { available: false; message: string };
}

// ---- SH-003 Strategic deal review board API -----------------------------------------------------

export interface DealReviewBoardComment {
  id: string;
  author: CrmLookupUserSummary | null;
  comment: string;
  createdAt: string;
}

export interface DealReviewBoardEntry {
  opportunityId: string;
  name: string;
  account: { id: string; name: string } | null;
  owner: CrmLookupUserSummary | null;
  stage: CrmOptionValueSummary | null;
  amount: number | null;
  executiveSponsor: string | null;
  businessCase: string | null;
  competitiveRisk: string | null;
  commercials: string | null;
  deliveryRisk: string | null;
  legalStatus: string | null;
  nextAction: string | null;
  comments: DealReviewBoardComment[];
}

export interface DealReviewBoardResponse {
  thresholdAmount: number;
  entries: DealReviewBoardEntry[];
  aiPlaceholder: { available: false; message: string };
}

export interface SetDealReviewBoardRequestBody {
  executiveSponsor?: string | null;
  businessCase?: string | null;
  competitiveRisk?: string | null;
  commercials?: string | null;
  deliveryRisk?: string | null;
  legalStatus?: string | null;
  nextAction?: string | null;
}

export interface AddLeadershipCommentRequestBody {
  comment: string;
}

// ---- SH-004 Win/loss analytics API --------------------------------------------------------------

export interface WinLossDimensionEntry {
  label: string;
  wonCount: number;
  lostCount: number;
  wonValue: number;
  lostValue: number;
  winRate: number;
}

export interface WinLossAnalyticsResponse {
  totalWon: number;
  totalLost: number;
  wonValue: number;
  lostValue: number;
  winRate: number;
  byLossReason: WinLossDimensionEntry[];
  byCompetitor: WinLossDimensionEntry[];
  byRep: WinLossDimensionEntry[];
  byProduct: WinLossDimensionEntry[];
  bySegment: WinLossDimensionEntry[];
  byGeography: WinLossDimensionEntry[];
  aiPlaceholder: { available: false; message: string };
}

export interface ReviveLostDealRequestBody {
  ownerId: string;
  note?: string | null;
}

// ---- SH-005 Configuration governance API --------------------------------------------------------

export interface SubmitConfigurationReviewRequestBody {
  approverUserId?: string | null;
  changeSummary?: string | null;
}

export interface ConfigurationReviewDecisionRequestBody {
  decision: "approved" | "rejected";
  comment?: string | null;
}
