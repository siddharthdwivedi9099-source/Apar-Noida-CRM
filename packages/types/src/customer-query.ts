// ============================================================================
// Phase 21: Customer AI Query Bot
// ============================================================================

import type { RagCitation } from "./rag.js";

export const customerQueryChannels = ["customer_portal", "in_app", "support_console"] as const;
export type CustomerQueryChannel = (typeof customerQueryChannels)[number];

export const customerQuerySessionStatuses = ["active", "escalated", "resolved", "closed"] as const;
export type CustomerQuerySessionStatus = (typeof customerQuerySessionStatuses)[number];

export const customerQueryMessageRoles = ["customer", "assistant", "agent", "system"] as const;
export type CustomerQueryMessageRole = (typeof customerQueryMessageRoles)[number];

export const customerQueryFeedbackValues = ["pending", "helpful", "not_helpful"] as const;
export type CustomerQueryFeedback = (typeof customerQueryFeedbackValues)[number];

export const customerQueryEscalationReasons = ["low_confidence", "level_3", "no_answer", "customer_request"] as const;
export type CustomerQueryEscalationReason = (typeof customerQueryEscalationReasons)[number];

export const customerQueryEscalationStatuses = ["open", "acknowledged", "resolved"] as const;
export type CustomerQueryEscalationStatus = (typeof customerQueryEscalationStatuses)[number];

// Query levels (1 = simple how-to, 2 = troubleshooting, 3 = critical/always-escalate).
export const customerQueryLevels = [1, 2, 3] as const;
export type CustomerQueryLevel = (typeof customerQueryLevels)[number];

export const customerQueryLevelDescriptions: Record<CustomerQueryLevel, string> = {
  1: "Simple how-to, product usage, password reset, navigation, and basic configuration questions.",
  2: "Workflow, permission, dashboard, assignment, and configuration troubleshooting.",
  3: "Outage, data corruption, security, billing, contract, integration failure, or custom development — always escalated."
};

export interface CustomerQuerySession {
  id: string;
  subject: string;
  channel: CustomerQueryChannel;
  status: CustomerQuerySessionStatus;
  escalationLevel: number;
  lastConfidence: number | null;
  messageCount: number;
  customerUserId: string | null;
  assignedAgentId: string | null;
  relatedTicketId: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface CustomerQueryMessage {
  id: string;
  sessionId: string;
  role: CustomerQueryMessageRole;
  content: string;
  queryLevel: CustomerQueryLevel | null;
  confidenceScore: number | null;
  isGrounded: boolean;
  escalated: boolean;
  citations: RagCitation[];
  feedback: CustomerQueryFeedback;
  feedbackNote: string;
  createdAt: string;
  createdBy: string | null;
}

export interface CustomerQueryEscalation {
  id: string;
  sessionId: string;
  messageId: string | null;
  reason: CustomerQueryEscalationReason;
  level: number;
  status: CustomerQueryEscalationStatus;
  notes: string;
  relatedTicketId: string | null;
  assignedAgentId: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface CustomerQuerySessionDetail extends CustomerQuerySession {
  messages: CustomerQueryMessage[];
  escalations: CustomerQueryEscalation[];
}

// ----------------------------------------------------------------------------
// Requests / responses
// ----------------------------------------------------------------------------

export interface AskCustomerQueryRequestBody {
  query: string;
  sessionId?: string;
  subject?: string;
  channel?: CustomerQueryChannel;
  topK?: number;
}

export interface CustomerQueryAnswer {
  sessionId: string;
  questionMessageId: string;
  answerMessageId: string;
  answer: string;
  queryLevel: CustomerQueryLevel;
  confidenceScore: number;
  isGrounded: boolean;
  escalated: boolean;
  escalationReason: CustomerQueryEscalationReason | null;
  citations: RagCitation[];
  relatedTicketId: string | null;
  gapLogged: boolean;
  retrieval: {
    accessibleSourceCount: number;
    restrictedSourceCount: number;
    strategy: string;
    deferred: boolean;
  };
}

export interface CustomerQueryAnswerResponse {
  result: CustomerQueryAnswer;
  session: CustomerQuerySession;
}

export interface SubmitCustomerQueryFeedbackRequestBody {
  feedback: Exclude<CustomerQueryFeedback, "pending">;
  note?: string;
  messageId?: string;
}

export interface CreateCustomerQueryTicketRequestBody {
  note?: string;
}

export interface EscalateCustomerQueryRequestBody {
  reason?: CustomerQueryEscalationReason;
  note?: string;
}

export interface ResolveCustomerQuerySessionRequestBody {
  note?: string;
}

export interface CustomerQuerySessionListQuery {
  status?: string;
  channel?: string;
  escalated?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CustomerQuerySessionListResponse {
  sessions: CustomerQuerySession[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface CustomerQuerySessionResponse {
  session: CustomerQuerySessionDetail;
}

export interface CustomerQueryEscalationResponse {
  escalation: CustomerQueryEscalation;
  session: CustomerQuerySession;
}

export interface CustomerQueryDashboardResponse {
  totalSessions: number;
  activeSessions: number;
  escalatedSessions: number;
  resolvedSessions: number;
  totalQuestions: number;
  groundedAnswers: number;
  averageConfidence: number;
  helpfulCount: number;
  notHelpfulCount: number;
  openEscalations: number;
  ticketsCreated: number;
  levelDistribution: Array<{ level: CustomerQueryLevel; count: number }>;
  escalationReasonDistribution: Array<{ reason: CustomerQueryEscalationReason; count: number }>;
}

export interface CustomerQueryKnowledgeGap {
  id: string;
  queryText: string;
  detectedSource: string;
  status: string;
  resolutionNote: string;
  occurrenceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerQueryKnowledgeGapListResponse {
  gaps: CustomerQueryKnowledgeGap[];
}
