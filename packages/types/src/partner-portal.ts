// Persona 20 (Reseller / Partner Sales User) pure resolver + API contract.
// A partner-scoped portal surface over the existing partner deal-registration data.

import type { CrmLookupUserSummary, CrmOptionValueSummary } from "./crm.js";

export const partnerCollaborationTypes = ["note", "task", "meeting_request", "demo_request"] as const;
export type PartnerCollaborationType = (typeof partnerCollaborationTypes)[number];

export const partnerCommissionStatuses = ["pending", "eligible", "payout_pending", "payout_approved", "not_eligible"] as const;
export type PartnerCommissionStatus = (typeof partnerCommissionStatuses)[number];

export interface PartnerCommissionState {
  status: PartnerCommissionStatus;
  eligible: boolean;
  closed: boolean;
}

/**
 * RS-004: derive reseller-visible commission status from the deal stage and whether the
 * linked opportunity's finance commission has been approved. Eligibility appears after the
 * deal is approved; payout status appears after closure (won).
 */
export function resolveCommissionStatus(dealStageKey: string | null | undefined, financeApproved: boolean): PartnerCommissionState {
  if (dealStageKey === "rejected" || dealStageKey === "lost") {
    return { status: "not_eligible", eligible: false, closed: true };
  }
  if (dealStageKey === "won") {
    return { status: financeApproved ? "payout_approved" : "payout_pending", eligible: true, closed: true };
  }
  if (dealStageKey === "approved") {
    return { status: "eligible", eligible: true, closed: false };
  }
  return { status: "pending", eligible: false, closed: false };
}

// ---- API contract ------------------------------------------------------------------------------

export interface PartnerPortalPartner {
  id: string;
  name: string;
  status: CrmOptionValueSummary | null;
  tier: CrmOptionValueSummary | null;
}

export interface PartnerPortalSession {
  user: CrmLookupUserSummary | null;
  partners: PartnerPortalPartner[];
  dealCount: number;
}

export interface PartnerPortalSessionResponse {
  session: PartnerPortalSession;
}

export interface PartnerPortalCollaborationItem {
  id: string;
  type: PartnerCollaborationType | "response";
  content: string;
  role: "partner" | "internal";
  author: CrmLookupUserSummary | null;
  createdAt: string;
}

export interface PartnerPortalDeal {
  id: string;
  partnerId: string;
  partnerName: string;
  name: string;
  customerName: string | null;
  contact: string | null;
  product: string | null;
  amount: number | null;
  stage: CrmOptionValueSummary | null;
  expectedCloseDate: string | null;
  notes: string | null;
  documents: string[];
  submissionStatus: string;
  decisionNote: string | null;
  protectionUntil: string | null;
  collaboration: PartnerPortalCollaborationItem[];
  commission: { status: PartnerCommissionStatus; amount: number | null; payoutApproved: boolean };
  createdAt: string;
  updatedAt: string;
}

export interface PartnerPortalDealsResponse {
  deals: PartnerPortalDeal[];
}

export interface PartnerPortalDealResponse {
  deal: PartnerPortalDeal;
}

export interface RegisterPortalDealRequestBody {
  partnerId: string;
  name: string;
  customerName?: string | null;
  contact?: string | null;
  product?: string | null;
  amount?: number | null;
  expectedCloseDate?: string | null;
  notes?: string | null;
  documents?: string[];
}

export interface PortalDuplicateMatch {
  dealId: string;
  partnerName: string | null;
  customerName: string | null;
  amount: number | null;
}

export interface RegisterPortalDealResponse {
  deal: PartnerPortalDeal;
  duplicates: PortalDuplicateMatch[];
}

export interface AddPortalCollaborationRequestBody {
  type: PartnerCollaborationType;
  content: string;
}

export interface RespondPortalCollaborationRequestBody {
  content: string;
}

export interface PortalCommissionRow {
  dealId: string;
  name: string;
  customerName: string | null;
  amount: number | null;
  commissionStatus: PartnerCommissionStatus;
  commissionAmount: number | null;
  payoutApproved: boolean;
  closed: boolean;
  query: string | null;
}

export interface PortalCommissionResponse {
  rows: PortalCommissionRow[];
}

export interface RaiseCommissionQueryRequestBody {
  message: string;
}
