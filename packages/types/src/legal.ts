// Persona 18 (Legal / Contract Reviewer) pure resolvers + API contract.
// Legal gating is deterministic and unit-tested directly.

import type { CrmLookupUserSummary, CrmOptionValueSummary } from "./crm.js";

export const legalRiskLevels = ["low", "medium", "high"] as const;
export type LegalRiskLevel = (typeof legalRiskLevels)[number];

export const legalClauseStatuses = ["standard", "modified", "rejected", "high_risk", "accepted"] as const;
export type LegalClauseStatus = (typeof legalClauseStatuses)[number];

export const legalSlaStatuses = ["none", "on_track", "due_soon", "breached"] as const;
export type LegalSlaStatus = (typeof legalSlaStatuses)[number];

/** LEG-001: SLA status from the due date. due_soon when within 24h. */
export function evaluateLegalSla(slaDueAt: string | null | undefined, nowIso: string = new Date().toISOString()): LegalSlaStatus {
  if (!slaDueAt) {
    return "none";
  }
  const due = Date.parse(slaDueAt);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(due) || !Number.isFinite(now)) {
    return "none";
  }
  if (now > due) {
    return "breached";
  }
  if (due - now <= 24 * 60 * 60 * 1000) {
    return "due_soon";
  }
  return "on_track";
}

export interface LegalClauseEvalInput {
  status: LegalClauseStatus;
  approvalApproved?: boolean;
}

export interface LegalClauseSummary {
  total: number;
  standard: number;
  modified: number;
  rejected: number;
  accepted: number;
  highRisk: number;
  unresolvedHighRisk: number;
  hasUnresolvedHighRisk: boolean;
}

/**
 * LEG-002/003: roll up clause tags. A high-risk clause is "unresolved" until leadership
 * approval is granted (which accepts the risk) — re-tagging it away from high_risk also
 * resolves it.
 */
export function evaluateLegalClauses(clauses: LegalClauseEvalInput[] | null | undefined): LegalClauseSummary {
  const list = Array.isArray(clauses) ? clauses : [];
  let standard = 0;
  let modified = 0;
  let rejected = 0;
  let accepted = 0;
  let highRisk = 0;
  let unresolvedHighRisk = 0;
  for (const clause of list) {
    switch (clause.status) {
      case "standard":
        standard += 1;
        break;
      case "modified":
        modified += 1;
        break;
      case "rejected":
        rejected += 1;
        break;
      case "accepted":
        accepted += 1;
        break;
      case "high_risk":
        highRisk += 1;
        if (!clause.approvalApproved) {
          unresolvedHighRisk += 1;
        }
        break;
    }
  }
  return { total: list.length, standard, modified, rejected, accepted, highRisk, unresolvedHighRisk, hasUnresolvedHighRisk: unresolvedHighRisk > 0 };
}

/** LEG-003: a contract may only be approved when no unresolved high-risk clauses remain. */
export function canApproveContract(clauses: LegalClauseEvalInput[] | null | undefined): boolean {
  return !evaluateLegalClauses(clauses).hasUnresolvedHighRisk;
}

// ---- API contract ------------------------------------------------------------------------------

export interface LegalClause {
  id: string;
  title: string;
  category: string | null;
  status: LegalClauseStatus;
  riskNote: string | null;
  approvalId: string | null;
  approvalStatus: string | null;
  resolved: boolean;
  createdBy: CrmLookupUserSummary | null;
  createdAt: string;
}

export interface LegalReview {
  opportunityId: string;
  initialized: boolean;
  contractType: CrmOptionValueSummary | null;
  dueDate: string | null;
  redlines: string | null;
  riskLevel: LegalRiskLevel | null;
  legalOwner: CrmLookupUserSummary | null;
  slaStartedAt: string | null;
  slaDueAt: string | null;
  slaStatus: LegalSlaStatus;
  clauses: LegalClause[];
  clauseSummary: LegalClauseSummary;
  contractApproved: boolean;
  approvedBy: CrmLookupUserSummary | null;
  approvedAt: string | null;
  signedFileRef: string | null;
  signedAt: string | null;
  closureReady: boolean;
  updatedAt: string | null;
}

export interface LegalReviewResponse {
  legal: LegalReview;
}

export interface LegalOptionsResponse {
  contractTypes: CrmOptionValueSummary[];
  riskLevels: LegalRiskLevel[];
  clauseStatuses: LegalClauseStatus[];
  owners: CrmLookupUserSummary[];
}

export interface InitLegalRequestBody {
  contractTypeKey?: string | null;
  dueDate?: string | null;
  redlines?: string | null;
  riskLevel?: LegalRiskLevel | null;
  legalOwnerId?: string | null;
}

export interface AddLegalClauseRequestBody {
  title: string;
  category?: string | null;
  status?: LegalClauseStatus;
  riskNote?: string | null;
}

export interface UpdateLegalClauseRequestBody {
  title?: string;
  category?: string | null;
  status?: LegalClauseStatus;
  riskNote?: string | null;
}

export interface SubmitClauseApprovalRequestBody {
  approverUserId: string;
  note?: string | null;
}

export interface UploadSignedContractRequestBody {
  signedFileRef: string;
  signedAt?: string | null;
}

// Lightweight summary surfaced on the opportunity (closure readiness / risk visibility).
export interface OpportunityLegalSummary {
  initialized: boolean;
  riskLevel: LegalRiskLevel | null;
  slaStatus: LegalSlaStatus;
  hasUnresolvedHighRisk: boolean;
  contractApproved: boolean;
  closureReady: boolean;
}
