import type { BpfStage, BusinessProcessFlowPayload } from "./configuration-definitions.js";

// ---------------------------------------------------------------------------
// BPF runtime — pure transition validation + SLA/aging computation.
//
// All rules come from the configured business_process_flow definition; nothing
// here is hard-coded per object. Used by the runtime service and is fully
// unit-testable without a database.
// ---------------------------------------------------------------------------

export interface BpfTransitionContext {
  /** Current stage key, or null when entering the flow for the first time. */
  fromStage: string | null;
  toStage: string;
  /** Record field values, used to enforce required-fields-by-stage. */
  record?: Record<string, unknown>;
  /** Reason for backward movement (when required). */
  reason?: string | null;
  /** Manager override (bypasses lock/blocked/not-allowed) — requires a reason. */
  isManagerOverride?: boolean;
  overrideReason?: string | null;
}

export interface BpfTransitionIssue {
  code: string;
  message: string;
}

export interface BpfTransitionValidation {
  allowed: boolean;
  isBackward: boolean;
  isOverride: boolean;
  issues: BpfTransitionIssue[];
}

export function getBpfStage(payload: BusinessProcessFlowPayload, key: string): BpfStage | undefined {
  return (payload.stages ?? []).find((stage) => stage.key === key);
}

export function getBpfEntryStage(payload: BusinessProcessFlowPayload): BpfStage | undefined {
  const stages = payload.stages ?? [];
  return stages.find((stage) => stage.isEntry) ?? [...stages].sort((a, b) => a.order - b.order)[0];
}

/** Stages reachable from `fromStage` via the configured allow-list (minus blocked). */
export function getBpfAllowedNextStages(payload: BusinessProcessFlowPayload, fromStage: string): string[] {
  const blocked = new Set((payload.blockedTransitions ?? []).map((t) => `${t.from}->${t.to}`));
  return (payload.transitions ?? [])
    .filter((t) => t.from === fromStage && !blocked.has(`${t.from}->${t.to}`))
    .map((t) => t.to);
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function checkRequiredFields(stage: BpfStage, record: Record<string, unknown> | undefined, issues: BpfTransitionIssue[]) {
  if (!record) {
    return;
  }
  for (const field of stage.requiredFields ?? []) {
    if (isBlank(record[field])) {
      issues.push({ code: "BPF_REQUIRED_FIELD_MISSING", message: `Field "${field}" is required to enter stage "${stage.key}".` });
    }
  }
}

/** Validate a stage transition against the configured BPF. Pure. */
export function validateBpfTransition(
  payload: BusinessProcessFlowPayload,
  ctx: BpfTransitionContext
): BpfTransitionValidation {
  const issues: BpfTransitionIssue[] = [];
  const override = ctx.isManagerOverride === true;
  const toStage = getBpfStage(payload, ctx.toStage);

  if (!toStage) {
    return { allowed: false, isBackward: false, isOverride: override, issues: [{ code: "BPF_UNKNOWN_TARGET_STAGE", message: `Unknown target stage "${ctx.toStage}".` }] };
  }

  // First entry into the flow.
  if (ctx.fromStage === null) {
    const entry = getBpfEntryStage(payload);
    if (entry && entry.key !== ctx.toStage) {
      issues.push({ code: "BPF_NOT_ENTRY_STAGE", message: `The flow must start at entry stage "${entry.key}".` });
    }
    checkRequiredFields(toStage, ctx.record, issues);
    return { allowed: issues.length === 0, isBackward: false, isOverride: override, issues };
  }

  const fromStage = getBpfStage(payload, ctx.fromStage);
  if (!fromStage) {
    issues.push({ code: "BPF_UNKNOWN_SOURCE_STAGE", message: `Unknown source stage "${ctx.fromStage}".` });
  }

  const isBackward = fromStage !== undefined && toStage.order < fromStage.order;

  if (override && !(payload.managerOverrideAllowed ?? false)) {
    issues.push({ code: "BPF_OVERRIDE_NOT_ALLOWED", message: "Manager override is not allowed for this flow." });
  }
  if (override && isBlank(ctx.overrideReason)) {
    issues.push({ code: "BPF_OVERRIDE_REASON_REQUIRED", message: "A reason is required for a manager override." });
  }

  // Closed/terminal stages are locked unless overridden.
  if (fromStage?.isTerminal && !override) {
    issues.push({ code: "BPF_STAGE_LOCKED", message: `Stage "${fromStage.key}" is closed and locked. Use manager override to move it.` });
  }

  // Explicitly blocked transition.
  if ((payload.blockedTransitions ?? []).some((t) => t.from === ctx.fromStage && t.to === ctx.toStage) && !override) {
    issues.push({ code: "BPF_TRANSITION_BLOCKED", message: `Transition ${ctx.fromStage} -> ${ctx.toStage} is blocked.` });
  }

  // Default-deny: not in the allow-list.
  const isAllowed = (payload.transitions ?? []).some((t) => t.from === ctx.fromStage && t.to === ctx.toStage);
  if (!isAllowed && (payload.defaultDenyTransitions ?? false) && !override) {
    issues.push({ code: "BPF_TRANSITION_NOT_ALLOWED", message: `Transition ${ctx.fromStage} -> ${ctx.toStage} is not permitted.` });
  }

  // Backward movement rules.
  if (isBackward) {
    if (!(payload.allowBackwardMovement ?? true) && !override) {
      issues.push({ code: "BPF_BACKWARD_NOT_ALLOWED", message: "Backward movement is not allowed for this flow." });
    } else if ((payload.backwardMovementRequiresReason ?? false) && isBlank(ctx.reason) && !override) {
      issues.push({ code: "BPF_BACKWARD_REASON_REQUIRED", message: "A reason is required to move backward." });
    }
  }

  checkRequiredFields(toStage, ctx.record, issues);

  return { allowed: issues.length === 0, isBackward, isOverride: override, issues };
}

// ---- SLA / aging (pure) ----

export type BpfSlaStatus = "none" | "ok" | "warning" | "breached";

export interface BpfStageAging {
  ageHours: number;
  slaStatus: BpfSlaStatus;
  aging: boolean;
}

export function computeBpfStageAging(stage: BpfStage, enteredAtIso: string, nowIso: string): BpfStageAging {
  const enteredAt = new Date(enteredAtIso).getTime();
  const now = new Date(nowIso).getTime();
  const ageHours = Number.isFinite(enteredAt) && Number.isFinite(now) ? Math.max(0, (now - enteredAt) / 3_600_000) : 0;

  let slaStatus: BpfSlaStatus = "none";
  if (typeof stage.slaHours === "number") {
    if (ageHours >= stage.slaHours) {
      slaStatus = "breached";
    } else if (typeof stage.slaWarningHours === "number" && ageHours >= stage.slaWarningHours) {
      slaStatus = "warning";
    } else {
      slaStatus = "ok";
    }
  }

  const aging = typeof stage.agingThresholdHours === "number" && ageHours >= stage.agingThresholdHours;
  return { ageHours, slaStatus, aging };
}

// ---- API view contracts (shared by the runtime service and the frontend) ----

export interface BpfStageView {
  key: string;
  label: string;
  order: number;
  isEntry: boolean;
  isTerminal: boolean;
  requiredFields: string[];
  status: "done" | "current" | "upcoming";
}

export interface BpfStateView {
  object: string;
  recordId: string;
  bpfKey: string;
  bpfName: string;
  currentStage: string;
  enteredAt: string | null;
  initialized: boolean;
  stages: BpfStageView[];
  allowedNextStages: string[];
  aging: BpfStageAging;
}

export interface BpfHistoryEntry {
  fromStage: string | null;
  toStage: string;
  reason: string | null;
  overrideReason: string | null;
  isBackward: boolean;
  isOverride: boolean;
  changedBy: string | null;
  createdAt: string;
}

export interface BpfHistoryResponse {
  bpfKey: string;
  history: BpfHistoryEntry[];
}
