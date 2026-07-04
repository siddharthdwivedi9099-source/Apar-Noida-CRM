// Persona 23 (Support Manager) pure resolvers + API contract.
// Extends the existing support module — team performance, workload balancing, SLA breach
// governance, escalation oversight, and CSAT capture. Deterministic helpers are unit-tested;
// AI performance-insight / high-performer detection stays a governed placeholder.

import type { CrmLookupUserSummary, CrmOptionValueSummary } from "./crm.js";

/** SPM-005: CSAT band from a 1–5 survey score. */
export const csatBands = ["detractor", "passive", "promoter"] as const;
export type CsatBand = (typeof csatBands)[number];

export function resolveCsatBand(score: number | null | undefined): CsatBand | null {
  if (typeof score !== "number" || Number.isNaN(score)) {
    return null;
  }
  if (score <= 2) {
    return "detractor";
  }
  if (score >= 4) {
    return "promoter";
  }
  return "passive";
}

/** SPM-001: SLA compliance percentage (0–100). Empty sample is treated as fully compliant. */
export function computeSlaCompliance(total: number, breached: number): number {
  if (total <= 0) {
    return 100;
  }
  const met = Math.max(0, total - breached);
  return Math.round((met / total) * 100);
}

// ---- SPM-001: agent / team performance ---------------------------------------------------------

export interface AgentTicketFact {
  resolved: boolean;
  firstResponseBreached: boolean;
  resolutionBreached: boolean;
  reopened: boolean;
  createdAtMs: number;
  firstResponseAtMs: number | null;
  resolvedAtMs: number | null;
  csatScore: number | null;
}

export interface AgentPerformanceMetrics {
  assigned: number;
  open: number;
  resolved: number;
  slaBreaches: number;
  slaCompliancePct: number;
  avgFirstResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
  reopened: number;
  csatResponses: number;
  csatAverage: number | null;
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sum = values.reduce((total, value) => total + value, 0);
  return sum / values.length;
}

/** SPM-001: aggregate one agent's (or team's) ticket facts into performance metrics. */
export function computeAgentPerformance(facts: AgentTicketFact[]): AgentPerformanceMetrics {
  const assigned = facts.length;
  const resolved = facts.filter((fact) => fact.resolved).length;
  const slaBreaches = facts.filter((fact) => fact.firstResponseBreached || fact.resolutionBreached).length;
  const firstResponseMinutes = facts
    .filter((fact) => fact.firstResponseAtMs !== null)
    .map((fact) => (fact.firstResponseAtMs! - fact.createdAtMs) / 60000);
  const resolutionMinutes = facts
    .filter((fact) => fact.resolved && fact.resolvedAtMs !== null)
    .map((fact) => (fact.resolvedAtMs! - fact.createdAtMs) / 60000);
  const csatScores = facts.map((fact) => fact.csatScore).filter((score): score is number => typeof score === "number");
  const avgFirst = average(firstResponseMinutes);
  const avgResolution = average(resolutionMinutes);
  const avgCsat = average(csatScores);

  return {
    assigned,
    open: assigned - resolved,
    resolved,
    slaBreaches,
    slaCompliancePct: computeSlaCompliance(assigned, slaBreaches),
    avgFirstResponseMinutes: avgFirst === null ? null : Math.round(avgFirst),
    avgResolutionMinutes: avgResolution === null ? null : Math.round(avgResolution),
    reopened: facts.filter((fact) => fact.reopened).length,
    csatResponses: csatScores.length,
    csatAverage: avgCsat === null ? null : Math.round(avgCsat * 10) / 10
  };
}

export interface SupportAgentPerformance extends AgentPerformanceMetrics {
  agent: CrmLookupUserSummary | null;
}

export interface SupportCsatSummary {
  responseCount: number;
  averageScore: number | null;
  detractors: number;
  passives: number;
  promoters: number;
}

export interface SupportTeamPerformanceResponse {
  scope: "mine" | "team" | "all";
  generatedAt: string;
  team: AgentPerformanceMetrics;
  agents: SupportAgentPerformance[];
  csat: SupportCsatSummary;
  aiPlaceholder: { available: false; message: string };
}

// ---- SPM-002: workload balancing ---------------------------------------------------------------

export interface WorkloadTicketFact {
  open: boolean;
  atRisk: boolean;
  breached: boolean;
}

export interface AgentWorkload {
  openCount: number;
  atRiskCount: number;
  breachedCount: number;
  capacity: number;
  utilizationPct: number;
  overloaded: boolean;
}

/** SPM-002: an agent is overloaded when their open load exceeds the configured capacity. */
export function detectOverload(openCount: number, capacity: number): boolean {
  return capacity > 0 && openCount > capacity;
}

export function computeWorkload(facts: WorkloadTicketFact[], capacity: number): AgentWorkload {
  const openCount = facts.filter((fact) => fact.open).length;
  const atRiskCount = facts.filter((fact) => fact.open && fact.atRisk).length;
  const breachedCount = facts.filter((fact) => fact.open && fact.breached).length;
  const utilizationPct = capacity > 0 ? Math.round((openCount / capacity) * 100) : 0;
  return {
    openCount,
    atRiskCount,
    breachedCount,
    capacity,
    utilizationPct,
    overloaded: detectOverload(openCount, capacity)
  };
}

export interface SupportAgentWorkload extends AgentWorkload {
  agent: CrmLookupUserSummary | null;
}

export interface SupportWorkloadResponse {
  scope: "mine" | "team" | "all";
  capacity: number;
  unassignedOpen: number;
  agents: SupportAgentWorkload[];
}

export interface ReassignTicketsRequestBody {
  ticketIds: string[];
  assigneeId: string;
  note?: string | null;
}

export interface ReassignTicketsResponse {
  reassigned: number;
  assigneeId: string;
}

// ---- SPM-003: SLA breach governance ------------------------------------------------------------

export interface RecordBreachReviewRequestBody {
  reasonKey: string;
  correctiveAction?: string | null;
}

// ---- SPM-004: escalation oversight -------------------------------------------------------------

export interface SupportEscalationOversightEntry {
  ticketId: string;
  subject: string;
  priority: CrmOptionValueSummary | null;
  owner: CrmLookupUserSummary | null;
  reason: string | null;
  escalatedAt: string | null;
  ageHours: number | null;
}

export interface SupportEscalationOversightResponse {
  entries: SupportEscalationOversightEntry[];
  count: number;
}

export const escalationReviewDecisions = ["reassign", "return_to_l1"] as const;
export type EscalationReviewDecision = (typeof escalationReviewDecisions)[number];

export interface ReviewEscalationRequestBody {
  decision: EscalationReviewDecision;
  ownerId?: string | null;
  note?: string | null;
}

// ---- SPM-005: CSAT capture ---------------------------------------------------------------------

export interface RecordCsatRequestBody {
  score: number;
  comment?: string | null;
}
