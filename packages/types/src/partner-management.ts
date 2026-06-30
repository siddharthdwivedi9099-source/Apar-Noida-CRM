// Persona 19 (Partner Manager) pure resolvers + API contract.
// Extends the existing partners module. Deterministic helpers are unit-tested; the live
// "AI partner fit score" / "AI high-performer detection" remain governed placeholders, with
// the deterministic heuristics below standing in until the AI Gateway phase.

import type { CrmLookupUserSummary, CrmOptionValueSummary } from "./crm.js";

export const partnerApplicationStatuses = ["applied", "under_review", "approved", "rejected"] as const;
export type PartnerApplicationStatus = (typeof partnerApplicationStatuses)[number];

export const partnerDealDecisions = ["approved", "rejected", "clarification"] as const;
export type PartnerDealDecision = (typeof partnerDealDecisions)[number];

export const partnerFitBands = ["low", "medium", "high"] as const;
export type PartnerFitBand = (typeof partnerFitBands)[number];

export interface PartnerFitScoreInput {
  salesCapacityRating?: number | null;
  technicalCapabilityRating?: number | null;
  hasCertifications?: boolean;
  hasReferences?: boolean;
  customerBaseSize?: number | null;
}

export interface PartnerFitScore {
  score: number;
  band: PartnerFitBand;
}

/** PM-001: deterministic partner fit score (stands in for AI scoring). */
export function computePartnerFitScore(input: PartnerFitScoreInput): PartnerFitScore {
  const sales = Math.max(0, Math.min(5, Number(input.salesCapacityRating ?? 0)));
  const tech = Math.max(0, Math.min(5, Number(input.technicalCapabilityRating ?? 0)));
  let score = sales * 9 + tech * 9; // up to 90
  if (input.hasCertifications) score += 5;
  if (input.hasReferences) score += 5;
  const customerBase = Math.max(0, Number(input.customerBaseSize ?? 0));
  if (customerBase >= 100) score += 5;
  else if (customerBase >= 20) score += 2;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const band: PartnerFitBand = score >= 70 ? "high" : score >= 40 ? "medium" : "low";
  return { score, band };
}

export interface ChannelConflictRegistration {
  dealId: string;
  partnerId: string;
  conflictKey: string | null;
  submittedAt: string;
}

export interface ChannelConflictGroup {
  conflictKey: string;
  registrations: ChannelConflictRegistration[];
}

/**
 * PM-004: group active registrations that overlap on the same customer/account across
 * different partners. Only groups with two or more distinct partners are conflicts.
 */
export function detectChannelConflicts(registrations: ChannelConflictRegistration[] | null | undefined): ChannelConflictGroup[] {
  const byKey = new Map<string, ChannelConflictRegistration[]>();
  for (const registration of Array.isArray(registrations) ? registrations : []) {
    const key = registration.conflictKey?.trim().toLowerCase();
    if (!key) {
      continue;
    }
    const list = byKey.get(key) ?? [];
    list.push(registration);
    byKey.set(key, list);
  }
  const groups: ChannelConflictGroup[] = [];
  for (const [conflictKey, list] of byKey) {
    const distinctPartners = new Set(list.map((entry) => entry.partnerId));
    if (distinctPartners.size >= 2) {
      groups.push({ conflictKey, registrations: [...list].sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt)) });
    }
  }
  return groups;
}

/** Partner win rate over decided (won + lost) registrations. */
export function computePartnerWinRate(wonCount: number, lostCount: number): number {
  const won = Math.max(0, Math.trunc(wonCount));
  const decided = won + Math.max(0, Math.trunc(lostCount));
  return decided > 0 ? Math.round((won / decided) * 100) : 0;
}

// ---- API contract ------------------------------------------------------------------------------

export interface PartnerApplication {
  companyDetails: string | null;
  geography: string | null;
  industryFocus: string | null;
  salesCapacity: string | null;
  salesCapacityRating: number | null;
  technicalCapability: string | null;
  technicalCapabilityRating: number | null;
  customerBase: string | null;
  customerBaseSize: number | null;
  certifications: string | null;
  references: string | null;
  status: PartnerApplicationStatus;
  decisionNote: string | null;
  decidedBy: CrmLookupUserSummary | null;
  decidedAt: string | null;
  updatedAt: string | null;
}

export interface PartnerOnboardingChecklistItem {
  id: string;
  label: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
  dueDate: string | null;
}

export interface PartnerOnboardingProgress {
  items: PartnerOnboardingChecklistItem[];
  totalCount: number;
  completedCount: number;
  percentComplete: number;
}

export interface PartnerManagementView {
  partnerId: string;
  partnerName: string;
  application: PartnerApplication;
  fitScore: PartnerFitScore;
  onboarding: PartnerOnboardingProgress;
  aiPlaceholders: { available: false; message: string };
}

export interface PartnerManagementResponse {
  management: PartnerManagementView;
}

export interface SubmitPartnerApplicationRequestBody {
  companyDetails?: string | null;
  geography?: string | null;
  industryFocus?: string | null;
  salesCapacity?: string | null;
  salesCapacityRating?: number | null;
  technicalCapability?: string | null;
  technicalCapabilityRating?: number | null;
  customerBase?: string | null;
  customerBaseSize?: number | null;
  certifications?: string | null;
  references?: string | null;
}

export interface DecidePartnerApplicationRequestBody {
  decision: "approved" | "rejected" | "under_review";
  note?: string | null;
}

export interface DecidePartnerDealRequestBody {
  decision: PartnerDealDecision;
  note?: string | null;
  protectionDays?: number | null;
}

export interface PartnerConflictPartner {
  dealId: string;
  partner: { id: string; name: string } | null;
  customerName: string | null;
  amount: number | null;
  submittedAt: string;
  stage: CrmOptionValueSummary | null;
}

export interface PartnerConflict {
  conflictKey: string;
  registrations: PartnerConflictPartner[];
}

export interface PartnerConflictsResponse {
  conflicts: PartnerConflict[];
}

export interface ResolvePartnerConflictRequestBody {
  conflictKey: string;
  winningDealId: string;
  resolution: string;
}

export interface PartnerPerformanceRow {
  partner: { id: string; name: string };
  registrations: number;
  approvals: number;
  rejections: number;
  pipelineValue: number;
  revenue: number;
  winRate: number;
  avgCycleDays: number;
  onboardingPercent: number;
  inactive: boolean;
}

export interface PartnerPerformanceResponse {
  rows: PartnerPerformanceRow[];
  aiPlaceholders: { available: false; message: string };
}
