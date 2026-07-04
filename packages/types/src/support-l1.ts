// Persona 21 (Support Agent L1) pure resolvers + API contract.
// Extends the existing support module. Deterministic helpers stand in for the AI
// classification / KB-recommendation placeholders and are unit-tested directly.

import type { CrmLookupUserSummary, CrmOptionValueSummary } from "./crm.js";
import type { SlaStatus } from "./lead-assignment.js";

export const supportUrgencyLevels = ["low", "medium", "high", "urgent"] as const;
export type SupportUrgencyLevel = (typeof supportUrgencyLevels)[number];

export interface TicketClassificationSuggestion {
  categoryKey: string | null;
  urgency: SupportUrgencyLevel;
}

const URGENT_TOKENS = ["down", "outage", "critical", "urgent", "data loss", "breach", "cannot access", "production"];
const HIGH_TOKENS = ["error", "fail", "failed", "crash", "broken", "not working", "bug"];
const LOW_TOKENS = ["how do", "how to", "question", "request", "clarification", "documentation"];

/** L1-001: deterministic category + urgency suggestion (stands in for AI classification). */
export function suggestTicketClassification(subject: string | null | undefined, description: string | null | undefined): TicketClassificationSuggestion {
  const text = `${subject ?? ""} ${description ?? ""}`.toLowerCase();
  let urgency: SupportUrgencyLevel = "medium";
  if (URGENT_TOKENS.some((token) => text.includes(token))) {
    urgency = "urgent";
  } else if (HIGH_TOKENS.some((token) => text.includes(token))) {
    urgency = "high";
  } else if (LOW_TOKENS.some((token) => text.includes(token))) {
    urgency = "low";
  }
  let categoryKey: string | null = null;
  if (/invoice|billing|payment|charge|refund/.test(text)) {
    categoryKey = "billing";
  } else if (/login|password|access|permission|locked/.test(text)) {
    categoryKey = "access";
  } else if (/error|bug|crash|fail|broken|integration|api|outage|down|server|production/.test(text)) {
    categoryKey = "technical";
  } else if (/how|question|request|documentation/.test(text)) {
    categoryKey = "general";
  }
  return { categoryKey, urgency };
}

export interface RankableArticle {
  id: string;
  title: string;
  body?: string | null;
}

export interface RankedArticle {
  id: string;
  score: number;
}

const STOPWORDS = new Set(["the", "a", "an", "is", "are", "to", "of", "and", "or", "in", "on", "for", "with", "my", "i", "it", "this", "that", "cannot", "can", "not"]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

/** L1-003: rank knowledge articles by token overlap with the ticket text (stands in for AI). */
export function rankKnowledgeArticles(text: string, articles: RankableArticle[] | null | undefined): RankedArticle[] {
  const ticketTokens = new Set(tokenize(text));
  if (ticketTokens.size === 0) {
    return [];
  }
  const ranked: RankedArticle[] = [];
  for (const article of Array.isArray(articles) ? articles : []) {
    const articleTokens = tokenize(`${article.title} ${article.body ?? ""}`);
    let overlap = 0;
    const seen = new Set<string>();
    for (const token of articleTokens) {
      if (ticketTokens.has(token) && !seen.has(token)) {
        overlap += 1;
        seen.add(token);
      }
    }
    if (overlap > 0) {
      ranked.push({ id: article.id, score: overlap });
    }
  }
  return ranked.sort((a, b) => b.score - a.score);
}

export const slaQueueRisks = ["on_track", "at_risk", "breached"] as const;
export type SlaQueueRisk = (typeof slaQueueRisks)[number];

/**
 * L1-002: lower weight = handle first. Breached → 0, at-risk → 1, on-track → 2; broken by
 * priority (urgent first).
 */
export function computeQueueWeight(risk: SlaQueueRisk, priorityKey: string | null | undefined): number {
  const riskWeight = risk === "breached" ? 0 : risk === "at_risk" ? 1 : 2;
  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  const priorityWeight = priorityOrder[priorityKey ?? "medium"] ?? 2;
  return riskWeight * 10 + priorityWeight;
}

// ---- API contract ------------------------------------------------------------------------------

export interface SupportQueueEntry {
  ticketId: string;
  subject: string;
  customerName: string | null;
  customerTier: CrmOptionValueSummary | null;
  category: CrmOptionValueSummary | null;
  priority: CrmOptionValueSummary | null;
  status: CrmOptionValueSummary | null;
  owner: CrmLookupUserSummary | null;
  slaDueAt: string | null;
  slaStatus: SlaStatus | null;
  slaRisk: SlaQueueRisk;
  breachAlert: boolean;
  queueWeight: number;
}

export interface SupportQueueResponse {
  entries: SupportQueueEntry[];
  breachedCount: number;
  atRiskCount: number;
}

export interface TicketDuplicate {
  ticketId: string;
  subject: string;
  status: CrmOptionValueSummary | null;
  createdAt: string;
}

export interface TicketIntakeAssistResponse {
  duplicates: TicketDuplicate[];
  classification: TicketClassificationSuggestion;
  aiPlaceholder: { available: false; message: string };
}

export interface SupportKbRecommendation {
  articleId: string;
  title: string;
  category: CrmOptionValueSummary | null;
  score: number;
}

export interface SupportKbRecommendationsResponse {
  recommendations: SupportKbRecommendation[];
  aiPlaceholder: { available: false; message: string };
}

export interface LogKbUsageRequestBody {
  articleId: string;
  helpful: boolean;
  note?: string | null;
}

export interface EscalateTicketRequestBody {
  reason: string;
  troubleshooting?: string | null;
  logs?: string | null;
  screenshots?: string | null;
  impact?: string | null;
  urgency?: SupportUrgencyLevel;
  l2OwnerId?: string | null;
  notifyCustomer?: boolean;
  // L1-004: optionally switch the SLA policy on escalation (recomputes the resolution due time).
  slaPolicyId?: string | null;
}

export interface CloseTicketRequestBody {
  resolutionSummary: string;
  rootCauseCategoryKey?: string | null;
  requestCustomerConfirmation?: boolean;
}
