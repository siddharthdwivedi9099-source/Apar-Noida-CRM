import type { SlaStatus } from "./lead-assignment.js";
import type {
  LeadCadenceStepDefinition,
  LeadCadenceStepView,
  LeadCadenceView,
  LeadContactScriptView,
  LeadQualificationChecklistItemDefinition,
  LeadQualificationItemState,
  LeadWorkspacePriority
} from "./crm.js";

/**
 * Pure, configuration-driven helpers for the Inside Sales Representative workspace (Persona 6).
 * These keep ISR-001 (queue priority), ISR-002 (first-contact scripts), and ISR-004 (qualification
 * checklist) logic free of database/runtime concerns so they can be unit tested in isolation.
 */

// --- ISR-002: first-contact script resolution -------------------------------------------------

export interface LeadContactScriptDefinition {
  key: string;
  label: string;
  body: string;
  // Optional targeting dimensions stored in the option value metadata.
  leadFor: string | null;
  campaignKey: string | null;
  sourceKey: string | null;
  personaKey: string | null;
}

export interface LeadContactScriptContext {
  leadFor: string | null;
  campaignKey: string | null;
  sourceKey: string | null;
  personaKey: string | null;
}

// Higher number = more specific match and therefore preferred.
const CONTACT_SCRIPT_MATCH_RANK = {
  lead_for_and_source: 5,
  campaign: 4,
  source: 3,
  lead_for: 2,
  persona: 1,
  default: 0
} as const;

function trimmedOrNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function matchContactScript(
  script: LeadContactScriptDefinition,
  context: LeadContactScriptContext
): LeadContactScriptView["matchedOn"] | null {
  const leadFor = trimmedOrNull(script.leadFor);
  const campaignKey = trimmedOrNull(script.campaignKey);
  const sourceKey = trimmedOrNull(script.sourceKey);
  const personaKey = trimmedOrNull(script.personaKey);

  if (leadFor && sourceKey && leadFor === context.leadFor && sourceKey === context.sourceKey) {
    return "lead_for_and_source";
  }
  if (campaignKey && campaignKey === context.campaignKey) {
    return "campaign";
  }
  if (sourceKey && !leadFor && sourceKey === context.sourceKey) {
    return "source";
  }
  if (leadFor && !sourceKey && leadFor === context.leadFor) {
    return "lead_for";
  }
  if (personaKey && personaKey === context.personaKey) {
    return "persona";
  }
  if (!leadFor && !campaignKey && !sourceKey && !personaKey) {
    return "default";
  }
  return null;
}

/** Pick the most specific first-contact script that matches the lead context. Pure. */
export function resolveContactScript(
  scripts: LeadContactScriptDefinition[],
  context: LeadContactScriptContext
): LeadContactScriptView | null {
  let best: LeadContactScriptView | null = null;
  let bestRank = -1;

  for (const script of scripts) {
    const body = trimmedOrNull(script.body);
    if (!body) {
      continue;
    }
    const matchedOn = matchContactScript(script, context);
    if (!matchedOn) {
      continue;
    }
    const rank = CONTACT_SCRIPT_MATCH_RANK[matchedOn];
    if (rank > bestRank) {
      bestRank = rank;
      best = { key: script.key, label: script.label, body, matchedOn };
    }
  }

  return best;
}

// --- ISR-004: configurable qualification checklist ----------------------------------------------

export interface QualificationChecklistEvaluation {
  items: LeadQualificationItemState[];
  completionCount: number;
  total: number;
  requiredCount: number;
  requiredComplete: boolean;
}

/** Merge configured checklist items with stored answers into a deterministic view. Pure. */
export function evaluateQualificationChecklist(
  definitions: LeadQualificationChecklistItemDefinition[],
  answers: Record<string, boolean> | null | undefined
): QualificationChecklistEvaluation {
  const safeAnswers = answers ?? {};
  const items = definitions.map((definition) => ({
    key: definition.key,
    label: definition.label,
    required: definition.required,
    completed: safeAnswers[definition.key] === true
  }));

  const requiredItems = items.filter((item) => item.required);

  return {
    items,
    completionCount: items.filter((item) => item.completed).length,
    total: items.length,
    requiredCount: requiredItems.length,
    requiredComplete: requiredItems.every((item) => item.completed)
  };
}

/**
 * Whether a lead may be marked qualified given the configured checklist + answers.
 * If no required items are configured the checklist does not block qualification.
 */
export function canMarkLeadQualified(
  definitions: LeadQualificationChecklistItemDefinition[],
  answers: Record<string, boolean> | null | undefined
): boolean {
  return evaluateQualificationChecklist(definitions, answers).requiredComplete;
}

// --- ISR-001: prioritized lead queue ------------------------------------------------------------

export interface LeadWorkspacePriorityInput {
  score: number | null;
  slaStatus: SlaStatus | null;
  // Score at or above this threshold (after SLA urgency) flags the lead as hot. Configurable.
  hotScoreThreshold?: number;
}

export interface LeadWorkspacePriorityResult {
  priority: LeadWorkspacePriority;
  isHot: boolean;
  priorityScore: number;
}

const DEFAULT_HOT_SCORE_THRESHOLD = 80;

/** Derive a queue priority + hot flag from lead score and SLA urgency. Pure. */
export function computeLeadWorkspacePriority(input: LeadWorkspacePriorityInput): LeadWorkspacePriorityResult {
  const baseScore = typeof input.score === "number" && Number.isFinite(input.score) ? input.score : 0;
  const slaBoost = input.slaStatus === "breached" ? 30 : input.slaStatus === "warning" ? 15 : 0;
  const priorityScore = Math.max(0, Math.min(100, baseScore + slaBoost));
  const threshold = input.hotScoreThreshold ?? DEFAULT_HOT_SCORE_THRESHOLD;

  let priority: LeadWorkspacePriority;
  if (input.slaStatus === "breached" || priorityScore >= threshold) {
    priority = "hot";
  } else if (priorityScore >= 60) {
    priority = "high";
  } else if (priorityScore >= 40) {
    priority = "medium";
  } else {
    priority = "low";
  }

  return {
    priority,
    isHot: priority === "hot",
    priorityScore
  };
}

// --- ISR-003: contact cadence -------------------------------------------------------------------

export interface LeadCadenceStateInput {
  paused: boolean;
  pauseReason: string | null;
  completedStepKeys: string[];
  failedAttemptCount: number;
  movedToNurture: boolean;
}

export const DEFAULT_FAILED_ATTEMPTS_BEFORE_NURTURE = 3;

/** Merge configured cadence steps with the lead's stored cadence state into a deterministic view. Pure. */
export function evaluateLeadCadence(input: {
  steps: LeadCadenceStepDefinition[];
  state: LeadCadenceStateInput;
  startIso: string;
  nowIso: string;
  failedAttemptsBeforeNurture?: number;
}): LeadCadenceView {
  const failedAttemptsBeforeNurture = input.failedAttemptsBeforeNurture ?? DEFAULT_FAILED_ATTEMPTS_BEFORE_NURTURE;
  const completed = new Set(input.state.completedStepKeys);
  const startMs = new Date(input.startIso).getTime();
  const nowMs = new Date(input.nowIso).getTime();
  const ordered = [...input.steps].sort((a, b) => a.order - b.order || a.offsetHours - b.offsetHours);

  let currentAssigned = false;
  const steps: LeadCadenceStepView[] = ordered.map((step) => {
    const isCompleted = completed.has(step.key);
    const dueMs = startMs + step.offsetHours * 3_600_000;
    const dueAt = new Date(dueMs).toISOString();
    let status: LeadCadenceStepView["status"];
    if (isCompleted) {
      status = "completed";
    } else if (!currentAssigned) {
      // The first uncompleted step is the current one: overdue if past due, otherwise due now.
      currentAssigned = true;
      status = nowMs >= dueMs ? "overdue" : "due";
    } else {
      status = "upcoming";
    }
    return { ...step, completed: isCompleted, dueAt, status };
  });

  const currentStep = steps.find((step) => !step.completed) ?? null;

  return {
    configured: steps.length > 0,
    paused: input.state.paused,
    pauseReason: input.state.pauseReason,
    steps,
    currentStep,
    nextDueAt: currentStep?.dueAt ?? null,
    completedCount: steps.filter((step) => step.completed).length,
    totalCount: steps.length,
    failedAttemptCount: input.state.failedAttemptCount,
    failedAttemptsBeforeNurture,
    movedToNurture: input.state.movedToNurture || input.state.failedAttemptCount >= failedAttemptsBeforeNurture
  };
}

const PRIORITY_SORT_RANK: Record<LeadWorkspacePriority, number> = {
  hot: 0,
  high: 1,
  medium: 2,
  low: 3
};

/** Stable comparator: hot first, then by earliest SLA due time, then by score desc. Pure. */
export function compareLeadQueueEntries(
  a: { priority: LeadWorkspacePriority; slaDueAt: string | null; score: number | null },
  b: { priority: LeadWorkspacePriority; slaDueAt: string | null; score: number | null }
): number {
  const rankDelta = PRIORITY_SORT_RANK[a.priority] - PRIORITY_SORT_RANK[b.priority];
  if (rankDelta !== 0) {
    return rankDelta;
  }

  const aDue = a.slaDueAt ? new Date(a.slaDueAt).getTime() : Number.POSITIVE_INFINITY;
  const bDue = b.slaDueAt ? new Date(b.slaDueAt).getTime() : Number.POSITIVE_INFINITY;
  if (aDue !== bDue) {
    return aDue - bDue;
  }

  return (b.score ?? 0) - (a.score ?? 0);
}
