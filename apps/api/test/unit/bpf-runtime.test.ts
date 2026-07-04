import { describe, expect, it } from "vitest";
import {
  computeBpfStageAging,
  getBpfAllowedNextStages,
  getBpfEntryStage,
  validateBpfTransition,
  type BpfStage,
  type BusinessProcessFlowPayload
} from "@crm/types";

const flow: BusinessProcessFlowPayload = {
  object: "lead",
  defaultDenyTransitions: true,
  allowBackwardMovement: true,
  backwardMovementRequiresReason: true,
  managerOverrideAllowed: true,
  stages: [
    { key: "a", order: 1, isEntry: true },
    { key: "b", order: 2, requiredFields: ["email"] },
    { key: "c", order: 3, isTerminal: true }
  ],
  transitions: [
    { from: "a", to: "b" },
    { from: "b", to: "c" },
    { from: "b", to: "a" }
  ],
  blockedTransitions: [{ from: "a", to: "c" }]
};

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

describe("validateBpfTransition", () => {
  it("allows entering at the entry stage and rejects entering elsewhere", () => {
    expect(validateBpfTransition(flow, { fromStage: null, toStage: "a" }).allowed).toBe(true);
    const wrong = validateBpfTransition(flow, { fromStage: null, toStage: "b" });
    expect(wrong.allowed).toBe(false);
    expect(wrong.issues.some((i) => i.code === "BPF_NOT_ENTRY_STAGE")).toBe(true);
  });

  it("allows a permitted transition and enforces required fields", () => {
    expect(validateBpfTransition(flow, { fromStage: "a", toStage: "b", record: { email: "x@y.com" } }).allowed).toBe(true);
    const missing = validateBpfTransition(flow, { fromStage: "a", toStage: "b", record: {} });
    expect(missing.allowed).toBe(false);
    expect(missing.issues.some((i) => i.code === "BPF_REQUIRED_FIELD_MISSING")).toBe(true);
  });

  it("denies non-allow-listed transitions under default-deny", () => {
    const denied = validateBpfTransition(flow, { fromStage: "b", toStage: "b" });
    expect(denied.allowed).toBe(false);
    expect(denied.issues.some((i) => i.code === "BPF_TRANSITION_NOT_ALLOWED")).toBe(true);
  });

  it("blocks explicitly-blocked transitions, but allows them via manager override with reason", () => {
    const blocked = validateBpfTransition(flow, { fromStage: "a", toStage: "c" });
    expect(blocked.issues.some((i) => i.code === "BPF_TRANSITION_BLOCKED")).toBe(true);

    const overrideNoReason = validateBpfTransition(flow, { fromStage: "a", toStage: "c", isManagerOverride: true });
    expect(overrideNoReason.issues.some((i) => i.code === "BPF_OVERRIDE_REASON_REQUIRED")).toBe(true);

    const override = validateBpfTransition(flow, { fromStage: "a", toStage: "c", isManagerOverride: true, overrideReason: "exec sign-off" });
    expect(override.allowed).toBe(true);
    expect(override.isOverride).toBe(true);
  });

  it("locks terminal stages unless overridden", () => {
    const locked = validateBpfTransition(flow, { fromStage: "c", toStage: "b" });
    expect(locked.allowed).toBe(false);
    expect(locked.issues.some((i) => i.code === "BPF_STAGE_LOCKED")).toBe(true);
  });

  it("requires a reason for backward movement", () => {
    const noReason = validateBpfTransition(flow, { fromStage: "b", toStage: "a" });
    expect(noReason.isBackward).toBe(true);
    expect(noReason.issues.some((i) => i.code === "BPF_BACKWARD_REASON_REQUIRED")).toBe(true);

    const withReason = validateBpfTransition(flow, { fromStage: "b", toStage: "a", reason: "re-qualify" });
    expect(withReason.allowed).toBe(true);
  });
});

describe("getBpfAllowedNextStages / getBpfEntryStage", () => {
  it("returns allow-listed next stages and the entry stage", () => {
    expect(getBpfAllowedNextStages(flow, "b").sort()).toEqual(["a", "c"]);
    expect(getBpfEntryStage(flow)?.key).toBe("a");
  });
});

describe("computeBpfStageAging", () => {
  const stage: BpfStage = { key: "s", order: 1, slaHours: 10, slaWarningHours: 5, agingThresholdHours: 20 };
  const now = new Date().toISOString();

  it("reports ok / warning / breached by SLA", () => {
    expect(computeBpfStageAging(stage, hoursAgo(2), now).slaStatus).toBe("ok");
    expect(computeBpfStageAging(stage, hoursAgo(6), now).slaStatus).toBe("warning");
    expect(computeBpfStageAging(stage, hoursAgo(12), now).slaStatus).toBe("breached");
  });

  it("flags aging past the aging threshold", () => {
    expect(computeBpfStageAging(stage, hoursAgo(21), now).aging).toBe(true);
    expect(computeBpfStageAging(stage, hoursAgo(2), now).aging).toBe(false);
  });
});
