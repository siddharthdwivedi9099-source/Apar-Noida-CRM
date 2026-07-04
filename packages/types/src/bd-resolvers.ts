import type {
  BdBuyingCommitteeView,
  BdEngagementBand,
  BdEngagementSignals,
  BdEngagementView,
  BdSequenceStepDefinition,
  BdSequenceStepView,
  BdSequenceView,
  CrmOptionValueSummary
} from "./crm.js";

/**
 * Pure, configuration-driven helpers for the Business Development Representative workspace (Persona 8).
 * Outbound-sequence progress (BDR-003), account engagement scoring (BDR-004), and buying-committee
 * completeness (BDR-002) are kept free of database concerns so they can be unit tested in isolation.
 */

// --- BDR-003: outbound sequence -----------------------------------------------------------------

export interface BdSequenceStateInput {
  paused: boolean;
  pauseReason: string | null;
  completedStepKeys: string[];
}

export interface BdSequenceContext {
  persona: string | null;
  product: string | null;
  region: string | null;
}

function trimmedOrNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// A step applies when each of its set targeting dimensions matches the account context.
function stepApplies(step: BdSequenceStepDefinition, context: BdSequenceContext): boolean {
  const persona = trimmedOrNull(step.persona);
  const product = trimmedOrNull(step.product);
  const region = trimmedOrNull(step.region);
  if (persona && persona !== context.persona) {
    return false;
  }
  if (product && product !== context.product) {
    return false;
  }
  if (region && region !== context.region) {
    return false;
  }
  return true;
}

/** Resolve the applicable sequence steps for an account and compute progress + due times. Pure. */
export function evaluateBdSequence(input: {
  steps: BdSequenceStepDefinition[];
  context: BdSequenceContext;
  state: BdSequenceStateInput;
  startIso: string;
  nowIso: string;
}): BdSequenceView {
  const applicable = input.steps
    .filter((step) => stepApplies(step, input.context))
    .sort((a, b) => a.order - b.order || a.offsetHours - b.offsetHours);
  const completed = new Set(input.state.completedStepKeys);
  const startMs = new Date(input.startIso).getTime();
  const nowMs = new Date(input.nowIso).getTime();

  let currentAssigned = false;
  const steps: BdSequenceStepView[] = applicable.map((step) => {
    const isCompleted = completed.has(step.key);
    const dueMs = startMs + step.offsetHours * 3_600_000;
    const dueAt = new Date(dueMs).toISOString();
    let status: BdSequenceStepView["status"];
    if (isCompleted) {
      status = "completed";
    } else if (!currentAssigned) {
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
    totalCount: steps.length
  };
}

// --- BDR-004: account engagement score ----------------------------------------------------------

export const DEFAULT_BD_ENGAGEMENT_WEIGHTS: BdEngagementSignals = {
  opens: 1,
  clicks: 3,
  websiteVisits: 2,
  eventAttendance: 6,
  replies: 8,
  meetings: 12,
  stakeholderEngagement: 5
};

// Score at or above this is treated as a buying signal.
export const BD_BUYING_SIGNAL_THRESHOLD = 60;

function safeCount(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function bandForEngagement(score: number): BdEngagementBand {
  if (score >= BD_BUYING_SIGNAL_THRESHOLD) {
    return "hot";
  }
  if (score >= 25) {
    return "warming";
  }
  return "cold";
}

/** Aggregate engagement signals into a 0..100 score + band + buying-signal flag. Pure. */
export function evaluateBdEngagement(
  signals: Partial<BdEngagementSignals> | null | undefined,
  weights: BdEngagementSignals = DEFAULT_BD_ENGAGEMENT_WEIGHTS
): BdEngagementView {
  const normalized: BdEngagementSignals = {
    opens: safeCount(signals?.opens),
    clicks: safeCount(signals?.clicks),
    websiteVisits: safeCount(signals?.websiteVisits),
    eventAttendance: safeCount(signals?.eventAttendance),
    replies: safeCount(signals?.replies),
    meetings: safeCount(signals?.meetings),
    stakeholderEngagement: safeCount(signals?.stakeholderEngagement)
  };

  const weighted =
    normalized.opens * weights.opens +
    normalized.clicks * weights.clicks +
    normalized.websiteVisits * weights.websiteVisits +
    normalized.eventAttendance * weights.eventAttendance +
    normalized.replies * weights.replies +
    normalized.meetings * weights.meetings +
    normalized.stakeholderEngagement * weights.stakeholderEngagement;

  // Saturating curve keeps the score in 0..100 without a hard cap feeling arbitrary.
  const score = Math.min(100, Math.round(weighted));

  return {
    score,
    band: bandForEngagement(score),
    buyingSignal: score >= BD_BUYING_SIGNAL_THRESHOLD,
    signals: normalized
  };
}

// --- BDR-002: buying-committee completeness -----------------------------------------------------

/** Score how completely the buying committee is mapped against the configured roles. Pure. */
export function evaluateBuyingCommitteeCompleteness(
  roleDefinitions: CrmOptionValueSummary[],
  coveredRoleKeys: Array<string | null | undefined>
): BdBuyingCommitteeView {
  const covered = new Set(coveredRoleKeys.filter((key): key is string => typeof key === "string" && key.length > 0));
  const roles = roleDefinitions.map((definition) => ({
    key: definition.key,
    label: definition.label,
    covered: covered.has(definition.key)
  }));
  const coveredCount = roles.filter((role) => role.covered).length;

  return {
    score: roles.length > 0 ? Math.round((coveredCount / roles.length) * 100) : 0,
    total: roles.length,
    covered: coveredCount,
    roles,
    missingRoles: roles.filter((role) => !role.covered)
  };
}
