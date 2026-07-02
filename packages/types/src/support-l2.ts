// Persona 22 (Support Agent L2 / Technical Support) pure resolvers + API contract.
// Extends the existing support module. Deterministic helpers are unit-tested; AI
// similar-issue summarization and article formatting stay governed placeholders.

import type { CrmLookupUserSummary, CrmOptionValueSummary } from "./crm.js";
import type { SlaStatus } from "./lead-assignment.js";

export const bugSeverities = ["low", "medium", "high", "critical"] as const;
export type BugSeverity = (typeof bugSeverities)[number];

export const bugSyncStatuses = ["open", "acknowledged", "in_progress", "fixed", "wont_fix", "released"] as const;
export type BugSyncStatus = (typeof bugSyncStatuses)[number];

/** L2-003: RCA is mandatory for critical incidents (urgent priority). */
export function isRcaRequired(priorityKey: string | null | undefined): boolean {
  return priorityKey === "urgent" || priorityKey === "critical";
}

// ---- API contract ------------------------------------------------------------------------------

export interface L2InvestigationNote {
  id: string;
  note: string;
  author: CrmLookupUserSummary | null;
  createdAt: string;
}

export interface L2PriorTicket {
  ticketId: string;
  subject: string;
  status: CrmOptionValueSummary | null;
  createdAt: string;
}

export interface L2BugEscalation {
  stepsToReproduce: string | null;
  expectedResult: string | null;
  actualResult: string | null;
  environment: string | null;
  logs: string | null;
  severity: BugSeverity;
  customerImpact: string | null;
  engineeringRef: string | null;
  syncStatus: BugSyncStatus;
  escalatedBy: CrmLookupUserSummary | null;
  escalatedAt: string;
  updatedAt: string | null;
}

export interface L2Rca {
  rootCause: string | null;
  impact: string | null;
  timeline: string | null;
  resolution: string | null;
  preventiveAction: string | null;
  owner: CrmLookupUserSummary | null;
  dueDate: string | null;
  shareApprovalId: string | null;
  shareApprovalStatus: string | null;
  shareable: boolean;
  updatedAt: string | null;
}

export interface L2InvestigationView {
  ticketId: string;
  subject: string;
  slaStatus: SlaStatus | null;
  slaDueAt: string | null;
  environment: string | null;
  configuration: string | null;
  logs: string | null;
  attachments: string[];
  notes: L2InvestigationNote[];
  priorTickets: L2PriorTicket[];
  bugEscalation: L2BugEscalation | null;
  rca: L2Rca | null;
  rcaRequired: boolean;
  aiPlaceholder: { available: false; message: string };
}

export interface L2InvestigationResponse {
  investigation: L2InvestigationView;
}

export interface UpdateInvestigationRequestBody {
  environment?: string | null;
  configuration?: string | null;
  logs?: string | null;
  note?: string | null;
}

export interface EscalateBugRequestBody {
  stepsToReproduce: string;
  expectedResult?: string | null;
  actualResult?: string | null;
  environment?: string | null;
  logs?: string | null;
  severity?: BugSeverity;
  customerImpact?: string | null;
  engineeringRef?: string | null;
}

export interface UpdateBugStatusRequestBody {
  syncStatus: BugSyncStatus;
  engineeringRef?: string | null;
  generateCustomerUpdate?: boolean;
}

export interface UpsertRcaRequestBody {
  rootCause?: string | null;
  impact?: string | null;
  timeline?: string | null;
  resolution?: string | null;
  preventiveAction?: string | null;
  ownerId?: string | null;
  dueDate?: string | null;
}

export interface RequestRcaShareRequestBody {
  approverUserId: string;
  note?: string | null;
}

export interface CreateArticleFromTicketRequestBody {
  title?: string | null;
  categoryKey?: string | null;
  summary?: string | null;
  body?: string | null;
}

export interface PublishKnowledgeArticleRequestBody {
  note?: string | null;
}
