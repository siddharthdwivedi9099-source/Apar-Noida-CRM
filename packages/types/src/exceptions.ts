// Exception & edge-case user stories (EXC-001..010). Pure detection/decision resolvers are
// unit-tested; the workflows reuse existing tables (leads, accounts, opportunities, support
// tickets, attribution touches, approvals) rather than adding new storage. EXC-010 (low-confidence
// AI) is served by the ai-agents / ai-governance layer.

// ---- EXC-001: duplicate campaign lead ----------------------------------------------------------

export interface DuplicateLeadCandidate {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
}

export interface DuplicateLeadMatch {
  id: string;
  reason: "email" | "name_company";
}

/** EXC-001: find likely duplicates of a candidate lead among existing leads. */
export function detectDuplicateCampaignLead(candidate: DuplicateLeadCandidate, existing: DuplicateLeadCandidate[]): DuplicateLeadMatch[] {
  const email = candidate.email?.trim().toLowerCase() || null;
  const nameKey = `${(candidate.firstName ?? "").trim().toLowerCase()}|${(candidate.lastName ?? "").trim().toLowerCase()}|${(candidate.companyName ?? "").trim().toLowerCase()}`;
  const matches: DuplicateLeadMatch[] = [];
  for (const other of existing) {
    if (other.id === candidate.id) continue;
    if (email && other.email && other.email.trim().toLowerCase() === email) {
      matches.push({ id: other.id, reason: "email" });
      continue;
    }
    const otherName = `${(other.firstName ?? "").trim().toLowerCase()}|${(other.lastName ?? "").trim().toLowerCase()}|${(other.companyName ?? "").trim().toLowerCase()}`;
    if (nameKey.replace(/\|/g, "").length > 0 && otherName === nameKey) {
      matches.push({ id: other.id, reason: "name_company" });
    }
  }
  return matches;
}

// ---- EXC-002: lead from existing customer ------------------------------------------------------

export function emailDomain(email: string | null | undefined): string | null {
  if (typeof email !== "string" || !email.includes("@")) {
    return null;
  }
  return email.split("@")[1].trim().toLowerCase() || null;
}

export interface AccountDomainRow {
  accountId: string;
  ownerId: string | null;
  domain: string | null;
}

export interface ExistingCustomerMatch {
  accountId: string;
  ownerId: string | null;
  matchedDomain: string;
}

/** EXC-002: match a lead's email domain to an existing customer account. */
export function matchExistingCustomer(leadEmail: string | null | undefined, accounts: AccountDomainRow[]): ExistingCustomerMatch | null {
  const domain = emailDomain(leadEmail);
  if (!domain) {
    return null;
  }
  const match = accounts.find((account) => account.domain && account.domain.trim().toLowerCase() === domain);
  return match ? { accountId: match.accountId, ownerId: match.ownerId, matchedDomain: domain } : null;
}

// ---- EXC-003: multiple stakeholders from same account ------------------------------------------

export interface StakeholderLead {
  id: string;
  companyName: string;
  ownerId?: string | null;
  engagement?: number | null;
}

export interface StakeholderGroup {
  organization: string;
  leadIds: string[];
  stakeholderCount: number;
  totalEngagement: number;
  averageEngagement: number;
  ownerId: string | null;
}

/** EXC-003: group leads by organization and aggregate engagement across stakeholders. */
export function aggregateStakeholderEngagement(leads: StakeholderLead[]): StakeholderGroup[] {
  const byOrg = new Map<string, StakeholderLead[]>();
  for (const lead of leads) {
    const key = lead.companyName.trim().toLowerCase();
    if (!key) continue;
    byOrg.set(key, [...(byOrg.get(key) ?? []), lead]);
  }
  const groups: StakeholderGroup[] = [];
  for (const [, group] of byOrg) {
    if (group.length < 2) continue;
    const totalEngagement = group.reduce((sum, l) => sum + (typeof l.engagement === "number" ? l.engagement : 0), 0);
    groups.push({
      organization: group[0].companyName,
      leadIds: group.map((l) => l.id),
      stakeholderCount: group.length,
      totalEngagement,
      averageEngagement: Math.round(totalEngagement / group.length),
      ownerId: group.find((l) => l.ownerId)?.ownerId ?? null
    });
  }
  return groups.sort((a, b) => b.stakeholderCount - a.stakeholderCount);
}

// ---- EXC-004: inactive lead recycling ----------------------------------------------------------

export const leadRecycleActions = ["extend", "nurture", "disqualify", "reassign"] as const;
export type LeadRecycleAction = (typeof leadRecycleActions)[number];

// ---- EXC-005: opportunity stage regression -----------------------------------------------------

export const opportunityStageOrder: Record<string, number> = {
  discovery: 1,
  qualification: 2,
  proposal: 3,
  negotiation: 4,
  closed_won: 5,
  closed_lost: 5
};

export interface RegressionCheck {
  isRegression: boolean;
  requiresApproval: boolean;
}

/** EXC-005: backward stage moves are regressions; late-stage regressions require manager approval. */
export function checkStageRegression(fromStage: string, toStage: string, lateStageThreshold = 3): RegressionCheck {
  const from = opportunityStageOrder[fromStage] ?? 0;
  const to = opportunityStageOrder[toStage] ?? 0;
  const isRegression = to < from;
  return { isRegression, requiresApproval: isRegression && from >= lateStageThreshold };
}

// ---- EXC-009: high discount / low margin -------------------------------------------------------

export const marginRiskLevels = ["healthy", "watch", "high_risk"] as const;
export type MarginRiskLevel = (typeof marginRiskLevels)[number];

export interface MarginAssessment {
  netPrice: number;
  marginAmount: number;
  marginPct: number;
  riskLevel: MarginRiskLevel;
  requiresSeniorApproval: boolean;
}

/** EXC-009: compute margin after discount and flag deals that need senior approval. */
export function computeMarginRisk(listPrice: number, cost: number, discountPct: number): MarginAssessment {
  const discount = Math.max(0, Math.min(100, discountPct));
  const netPrice = Math.round(listPrice * (1 - discount / 100) * 100) / 100;
  const marginAmount = Math.round((netPrice - cost) * 100) / 100;
  const marginPct = netPrice > 0 ? Math.round((marginAmount / netPrice) * 100) : -100;
  const riskLevel: MarginRiskLevel = marginPct < 15 ? "high_risk" : marginPct < 30 ? "watch" : "healthy";
  return { netPrice, marginAmount, marginPct, riskLevel, requiresSeniorApproval: riskLevel === "high_risk" };
}

// ---- API contract ------------------------------------------------------------------------------

export interface DuplicateWarningResponse {
  candidateLeadId: string;
  duplicates: Array<DuplicateLeadMatch & { companyName: string | null; email: string | null }>;
}

export interface StakeholderEngagementResponse {
  groups: StakeholderGroup[];
}

export interface MarginAssessmentResponse {
  assessment: MarginAssessment;
  approvalRequested: boolean;
  message: string;
}

export interface ConflictCheckResponse {
  hasConflict: boolean;
  directOwnerId: string | null;
  partnerRegistrations: Array<{ registrationId: string; partnerId: string }>;
}

// ---- Request bodies ----------------------------------------------------------------------------

export interface LinkDuplicateLeadRequestBody {
  existingLeadId: string;
  campaign?: string | null;
  source?: string | null;
}

export interface RecycleLeadRequestBody {
  action: LeadRecycleAction;
  reason: string;
  toOwnerId?: string | null;
}

export interface RegressStageRequestBody {
  toStageKey: string;
  reason: string;
}

export interface LogComplaintRequestBody {
  entityType: "lead" | "opportunity";
  entityId: string;
  subject: string;
  description?: string | null;
  severity?: "low" | "medium" | "high" | "critical";
}

export interface AssessMarginRequestBody {
  listPrice: number;
  cost: number;
  discountPct: number;
}

export interface ResolveConflictRequestBody {
  decision: "direct" | "partner";
  note?: string | null;
}
