// Cross-functional user stories: lead source attribution + multi-touch (CF-001), meeting
// intelligence (CF-004), next best action (CF-005), record ownership history (CF-006), document
// management (CF-009), and internal comments + mentions (CF-010). Deterministic helpers are
// unit-tested; AI meeting summarization / next-best-action narration stay governed placeholders.

export const cfEntityTypes = ["lead", "account", "contact", "opportunity", "ticket", "customer_success_account"] as const;
export type CfEntityType = (typeof cfEntityTypes)[number];

export const ownableEntityTypes = ["lead", "account", "opportunity", "ticket", "customer_success_account"] as const;
export type OwnableEntityType = (typeof ownableEntityTypes)[number];

// ---- CF-001: multi-touch attribution -----------------------------------------------------------

export interface AttributionTouch {
  source: string;
  subSource?: string | null;
  campaign?: string | null;
  partner?: string | null;
  event?: string | null;
  referral?: string | null;
  occurredAtMs: number;
}

export interface AttributionModel {
  firstTouch: string | null;
  lastTouch: string | null;
  linear: Array<{ source: string; weight: number }>;
  touchCount: number;
}

/** CF-001: first-touch, last-touch, and evenly-weighted linear multi-touch attribution. */
export function computeAttribution(touches: AttributionTouch[]): AttributionModel {
  if (touches.length === 0) {
    return { firstTouch: null, lastTouch: null, linear: [], touchCount: 0 };
  }
  const ordered = [...touches].sort((a, b) => a.occurredAtMs - b.occurredAtMs);
  const weightPer = Math.round((100 / ordered.length) * 100) / 100;
  const bySource = new Map<string, number>();
  for (const touch of ordered) {
    bySource.set(touch.source, (bySource.get(touch.source) ?? 0) + weightPer);
  }
  return {
    firstTouch: ordered[0].source,
    lastTouch: ordered[ordered.length - 1].source,
    linear: Array.from(bySource.entries()).map(([source, weight]) => ({ source, weight: Math.round(weight * 100) / 100 })),
    touchCount: ordered.length
  };
}

// ---- CF-004: meeting intelligence --------------------------------------------------------------

export const meetingSentiments = ["positive", "neutral", "negative"] as const;
export type MeetingSentiment = (typeof meetingSentiments)[number];

// ---- CF-005: next best action ------------------------------------------------------------------

export const nextBestActionTypes = ["call", "email", "meeting", "proposal", "manager_review", "nurture", "escalation", "closure"] as const;
export type NextBestActionType = (typeof nextBestActionTypes)[number];

export const nbaStatuses = ["pending", "accepted", "dismissed", "snoozed"] as const;
export type NbaStatus = (typeof nbaStatuses)[number];

export interface NbaSignals {
  entityType: CfEntityType;
  daysSinceLastActivity: number;
  stageKey?: string | null;
  hasOpenApproval?: boolean;
  discountPendingApproval?: boolean;
  slaBreached?: boolean;
  healthBand?: "green" | "amber" | "red" | null;
  isStale?: boolean;
}

export interface NextBestActionRecommendation {
  actionType: NextBestActionType;
  reason: string;
}

/** CF-005: deterministic next-best-action recommender (stands in for the AI recommender). */
export function recommendNextBestAction(signals: NbaSignals): NextBestActionRecommendation {
  if (signals.slaBreached) {
    return { actionType: "escalation", reason: "An SLA has breached — escalate to protect the commitment." };
  }
  if (signals.discountPendingApproval || signals.hasOpenApproval) {
    return { actionType: "manager_review", reason: "An approval is pending — route to a manager for a decision." };
  }
  if (signals.entityType === "opportunity") {
    if (signals.stageKey === "negotiation") {
      return { actionType: "closure", reason: "Deal is in negotiation — drive to close with terms confirmation." };
    }
    if (signals.stageKey === "proposal") {
      return { actionType: "proposal", reason: "Follow up on the outstanding proposal to keep momentum." };
    }
  }
  if (signals.entityType === "customer_success_account" && signals.healthBand === "red") {
    return { actionType: "escalation", reason: "Customer health is red — trigger a save-play and escalate." };
  }
  if (signals.isStale || signals.daysSinceLastActivity >= 14) {
    return { actionType: signals.daysSinceLastActivity >= 30 ? "nurture" : "email", reason: `No activity for ${signals.daysSinceLastActivity} days — re-engage.` };
  }
  if (signals.daysSinceLastActivity >= 5) {
    return { actionType: "call", reason: "It has been a few days — a call will advance the relationship." };
  }
  return { actionType: "meeting", reason: "Recent engagement is strong — book a working session to progress." };
}

// ---- CF-010: mentions --------------------------------------------------------------------------

/** CF-010: extract @mentions (handles) from a comment body. */
export function extractMentions(body: string): string[] {
  const matches = body.match(/@([a-zA-Z0-9._-]{2,60})/g) ?? [];
  return Array.from(new Set(matches.map((m) => m.slice(1))));
}

// ---- API contract ------------------------------------------------------------------------------

export interface AttributionTouchSummary {
  id: string;
  source: string;
  subSource: string | null;
  campaign: string | null;
  partner: string | null;
  event: string | null;
  referral: string | null;
  utm: Record<string, string>;
  occurredAt: string;
}

export interface LeadAttributionResponse {
  touches: AttributionTouchSummary[];
  model: AttributionModel;
}

export interface MeetingSummarySummary {
  id: string;
  entityType: CfEntityType;
  entityId: string;
  title: string;
  summary: string | null;
  decisions: string | null;
  objections: string | null;
  nextSteps: string | null;
  stakeholders: string | null;
  sentiment: MeetingSentiment;
  status: "draft" | "saved";
  createdAt: string;
  updatedAt: string;
}

export interface MeetingSummariesResponse {
  meetings: MeetingSummarySummary[];
}

export interface NextBestActionSummary {
  id: string;
  actionType: NextBestActionType;
  reason: string;
  status: NbaStatus;
  snoozedUntil: string | null;
  createdAt: string;
}

export interface NextBestActionResponse {
  recommendation: NextBestActionRecommendation;
  pending: NextBestActionSummary[];
  aiPlaceholder: { available: false; message: string };
}

export interface OwnershipChangeSummary {
  id: string;
  fromOwnerId: string | null;
  toOwnerId: string | null;
  reason: string;
  changedBy: string | null;
  createdAt: string;
}

export interface OwnershipHistoryResponse {
  history: OwnershipChangeSummary[];
}

export interface DocumentSummary {
  id: string;
  name: string;
  tags: string[];
  currentVersion: number;
  locked: boolean;
  versions: Array<{ version: number; fileRef: string; notes: string | null; createdAt: string }>;
  updatedAt: string;
}

export interface DocumentsResponse {
  documents: DocumentSummary[];
}

export interface RecordCommentSummary {
  id: string;
  body: string;
  mentions: string[];
  isInternal: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface RecordCommentsResponse {
  comments: RecordCommentSummary[];
}

// ---- Request bodies ----------------------------------------------------------------------------

export interface RecordAttributionTouchRequestBody {
  source: string;
  subSource?: string | null;
  campaign?: string | null;
  partner?: string | null;
  event?: string | null;
  referral?: string | null;
  utm?: Record<string, string>;
  occurredAt?: string | null;
}

export interface UpsertMeetingSummaryRequestBody {
  title: string;
  summary?: string | null;
  decisions?: string | null;
  objections?: string | null;
  nextSteps?: string | null;
  stakeholders?: string | null;
  sentiment?: MeetingSentiment;
  save?: boolean;
}

export interface DecideNbaRequestBody {
  decision: "accept" | "dismiss" | "snooze";
  snoozeUntil?: string | null;
}

export interface ReassignOwnerRequestBody {
  toOwnerId: string;
  reason: string;
}

export interface CreateDocumentRequestBody {
  name: string;
  fileRef: string;
  tags?: string[];
  notes?: string | null;
}

export interface AddDocumentVersionRequestBody {
  fileRef: string;
  notes?: string | null;
}

export interface CreateRecordCommentRequestBody {
  body: string;
  isInternal?: boolean;
}
