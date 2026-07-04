// Persona 16 (Proposal / Bid Manager) pure resolvers + API contract.
// Deterministic helpers are unit-tested directly; live AI requirement-extraction and
// content recommendation stay governed placeholders behind the AI Gateway.

import type { CrmLookupUserSummary, CrmOptionValueSummary } from "./crm.js";

export const proposalResponseStatuses = ["pending", "in_progress", "complete"] as const;
export type ProposalResponseStatus = (typeof proposalResponseStatuses)[number];

export const proposalComplianceStatuses = ["pending", "compliant", "partial", "non_compliant", "not_applicable"] as const;
export type ProposalComplianceStatus = (typeof proposalComplianceStatuses)[number];

export interface ProposalComplianceSummary {
  total: number;
  respondedCount: number;
  missingResponseCount: number;
  compliantCount: number;
  gapCount: number;
  complete: boolean;
}

/** PB-002: roll up the compliance matrix and flag missing responses. */
export function evaluateProposalCompliance(
  items: Array<{ responseStatus?: ProposalResponseStatus; complianceStatus?: ProposalComplianceStatus }> | null | undefined
): ProposalComplianceSummary {
  const list = Array.isArray(items) ? items : [];
  let respondedCount = 0;
  let compliantCount = 0;
  let gapCount = 0;
  for (const item of list) {
    if (item.responseStatus === "complete") {
      respondedCount += 1;
    }
    if (item.complianceStatus === "compliant") {
      compliantCount += 1;
    } else if (item.complianceStatus === "non_compliant" || item.complianceStatus === "partial") {
      gapCount += 1;
    }
  }
  const total = list.length;
  const missingResponseCount = total - respondedCount;
  return { total, respondedCount, missingResponseCount, compliantCount, gapCount, complete: total > 0 && missingResponseCount === 0 };
}

/** PB-004: an approved content item is expired when its review/expiry date has passed. */
export function isProposalContentExpired(expiresAt: string | null | undefined, nowIso: string = new Date().toISOString()): boolean {
  if (!expiresAt) {
    return false;
  }
  const expiry = Date.parse(expiresAt);
  const now = Date.parse(nowIso);
  return Number.isFinite(expiry) && Number.isFinite(now) && expiry < now;
}

export interface ProposalVersionSummary {
  count: number;
  hasFinal: boolean;
  finalLocked: boolean;
}

/** PB-003: summarise version state (is there a locked final?). */
export function summarizeProposalVersions(
  versions: Array<{ isFinal?: boolean; locked?: boolean }> | null | undefined,
  finalVersionId: string | null | undefined,
  versionsWithIds?: Array<{ id: string; locked?: boolean }>
): ProposalVersionSummary {
  const list = Array.isArray(versions) ? versions : [];
  const hasFinal = Boolean(finalVersionId) || list.some((version) => version.isFinal === true);
  let finalLocked = false;
  if (finalVersionId && versionsWithIds) {
    finalLocked = versionsWithIds.some((version) => version.id === finalVersionId && version.locked === true);
  } else {
    finalLocked = list.some((version) => version.isFinal === true && version.locked === true);
  }
  return { count: list.length, hasFinal, finalLocked };
}

// ---- API contract ------------------------------------------------------------------------------

export interface ProposalComplianceItem {
  id: string;
  requirement: string;
  owner: string | null;
  responseStatus: ProposalResponseStatus;
  complianceStatus: ProposalComplianceStatus;
  comments: string | null;
  evidence: string | null;
  response: string | null;
}

export interface ProposalVersion {
  id: string;
  label: string;
  notes: string | null;
  fileRef: string | null;
  createdBy: CrmLookupUserSummary | null;
  createdAt: string;
  locked: boolean;
  isFinal: boolean;
}

export interface ProposalSubmission {
  submittedAt: string;
  mode: string;
  recipient: string | null;
  documents: string | null;
  acknowledgement: string | null;
  remarks: string | null;
  submittedBy: CrmLookupUserSummary | null;
}

export interface ProposalWorkspace {
  opportunityId: string;
  initialized: boolean;
  status: CrmOptionValueSummary | null;
  template: CrmOptionValueSummary | null;
  scope: string | null;
  dueDate: string | null;
  contributors: CrmLookupUserSummary[];
  complianceItems: ProposalComplianceItem[];
  complianceSummary: ProposalComplianceSummary;
  versions: ProposalVersion[];
  versionSummary: ProposalVersionSummary;
  finalVersionId: string | null;
  approvalId: string | null;
  approvalStatus: string | null;
  submission: ProposalSubmission | null;
  updatedAt: string | null;
  aiPlaceholders: { available: false; message: string };
}

export interface ProposalWorkspaceResponse {
  proposal: ProposalWorkspace;
}

export interface ProposalQueueEntry {
  opportunityId: string;
  opportunityName: string;
  accountName: string | null;
  status: CrmOptionValueSummary | null;
  dueDate: string | null;
  complianceComplete: boolean;
  missingResponseCount: number;
  versionCount: number;
  submitted: boolean;
}

export interface ProposalQueueResponse {
  requests: ProposalQueueEntry[];
}

export interface ProposalOptionsResponse {
  owners: CrmLookupUserSummary[];
  templates: CrmOptionValueSummary[];
  statuses: CrmOptionValueSummary[];
  contentCategories: CrmOptionValueSummary[];
  responseStatuses: ProposalResponseStatus[];
  complianceStatuses: ProposalComplianceStatus[];
}

export interface InitProposalRequestBody {
  templateKey?: string | null;
  statusKey?: string | null;
  scope?: string | null;
  dueDate?: string | null;
  contributorIds?: string[];
}

export interface AddProposalComplianceItemRequestBody {
  requirement: string;
  owner?: string | null;
  responseStatus?: ProposalResponseStatus;
  complianceStatus?: ProposalComplianceStatus;
  comments?: string | null;
  evidence?: string | null;
  response?: string | null;
}

export interface UpdateProposalComplianceItemRequestBody {
  requirement?: string;
  owner?: string | null;
  responseStatus?: ProposalResponseStatus;
  complianceStatus?: ProposalComplianceStatus;
  comments?: string | null;
  evidence?: string | null;
  response?: string | null;
}

export interface AddProposalVersionRequestBody {
  label: string;
  notes?: string | null;
  fileRef?: string | null;
}

export interface SubmitProposalForApprovalRequestBody {
  versionId: string;
  approverUserId: string;
  note?: string | null;
}

export interface RecordProposalSubmissionRequestBody {
  submittedAt: string;
  mode: string;
  recipient?: string | null;
  documents?: string | null;
  acknowledgement?: string | null;
  remarks?: string | null;
  advanceStage?: boolean;
}

// PB-004 content library (tenant-level, cross-opportunity).
export interface ProposalContentEntry {
  id: string;
  category: CrmOptionValueSummary | null;
  title: string;
  body: string;
  status: "draft" | "approved";
  tags: string[];
  expiresAt: string | null;
  expired: boolean;
  updatedBy: CrmLookupUserSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalContentLibraryResponse {
  entries: ProposalContentEntry[];
}

export interface CreateProposalContentRequestBody {
  categoryKey: string;
  title: string;
  body: string;
  status?: "draft" | "approved";
  tags?: string[];
  expiresAt?: string | null;
}

export interface UpdateProposalContentRequestBody {
  categoryKey?: string;
  title?: string;
  body?: string;
  status?: "draft" | "approved";
  tags?: string[];
  expiresAt?: string | null;
}

// Lightweight summary surfaced on the opportunity (PB visibility).
export interface OpportunityProposalSummary {
  initialized: boolean;
  status: CrmOptionValueSummary | null;
  dueDate: string | null;
  complianceComplete: boolean;
  missingResponseCount: number;
  versionCount: number;
  submitted: boolean;
}
