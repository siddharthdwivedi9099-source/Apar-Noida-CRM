import { describe, expect, it } from "vitest";
import {
  canMarkLeadQualified,
  compareLeadQueueEntries,
  computeLeadWorkspacePriority,
  evaluateLeadCadence,
  evaluateQualificationChecklist,
  resolveContactScript,
  type LeadCadenceStepDefinition,
  type LeadContactScriptDefinition,
  type LeadQualificationChecklistItemDefinition
} from "@crm/types";

const scripts: LeadContactScriptDefinition[] = [
  { key: "default", label: "General", body: "general body", leadFor: null, campaignKey: null, sourceKey: null, personaKey: null },
  { key: "service", label: "Service", body: "service body", leadFor: "service_project", campaignKey: null, sourceKey: null, personaKey: null },
  { key: "website", label: "Website", body: "website body", leadFor: null, campaignKey: null, sourceKey: "website", personaKey: null },
  { key: "webinar", label: "Webinar", body: "webinar body", leadFor: null, campaignKey: "webinar", sourceKey: null, personaKey: null },
  {
    key: "service_website",
    label: "Service + Website",
    body: "service website body",
    leadFor: "service_project",
    campaignKey: null,
    sourceKey: "website",
    personaKey: null
  }
];

describe("resolveContactScript", () => {
  it("prefers the most specific lead_for + source match", () => {
    const result = resolveContactScript(scripts, {
      leadFor: "service_project",
      campaignKey: null,
      sourceKey: "website",
      personaKey: null
    });
    expect(result?.key).toBe("service_website");
    expect(result?.matchedOn).toBe("lead_for_and_source");
  });

  it("matches a campaign-targeted script over a source-only one", () => {
    const result = resolveContactScript(scripts, {
      leadFor: "product",
      campaignKey: "webinar",
      sourceKey: "website",
      personaKey: null
    });
    expect(result?.key).toBe("webinar");
    expect(result?.matchedOn).toBe("campaign");
  });

  it("falls back to a source-only match", () => {
    const result = resolveContactScript(scripts, {
      leadFor: "product",
      campaignKey: null,
      sourceKey: "website",
      personaKey: null
    });
    expect(result?.key).toBe("website");
    expect(result?.matchedOn).toBe("source");
  });

  it("falls back to a lead_for-only match", () => {
    const result = resolveContactScript(scripts, {
      leadFor: "service_project",
      campaignKey: null,
      sourceKey: "campaign",
      personaKey: null
    });
    expect(result?.key).toBe("service");
    expect(result?.matchedOn).toBe("lead_for");
  });

  it("uses the default catch-all when nothing else matches", () => {
    const result = resolveContactScript(scripts, {
      leadFor: "product",
      campaignKey: null,
      sourceKey: "campaign",
      personaKey: null
    });
    expect(result?.key).toBe("default");
    expect(result?.matchedOn).toBe("default");
  });

  it("ignores scripts with an empty body", () => {
    const result = resolveContactScript(
      [{ key: "empty", label: "Empty", body: "   ", leadFor: null, campaignKey: null, sourceKey: null, personaKey: null }],
      { leadFor: null, campaignKey: null, sourceKey: null, personaKey: null }
    );
    expect(result).toBeNull();
  });
});

const checklist: LeadQualificationChecklistItemDefinition[] = [
  { key: "need", label: "Need", description: null, required: true, sortOrder: 0 },
  { key: "budget_range", label: "Budget range", description: null, required: true, sortOrder: 1 },
  { key: "location", label: "Location", description: null, required: false, sortOrder: 2 }
];

describe("evaluateQualificationChecklist", () => {
  it("merges answers with the configured items", () => {
    const result = evaluateQualificationChecklist(checklist, { need: true, location: true });
    expect(result.total).toBe(3);
    expect(result.completionCount).toBe(2);
    expect(result.requiredCount).toBe(2);
    expect(result.requiredComplete).toBe(false);
  });

  it("reports required completeness once all required items are checked", () => {
    const result = evaluateQualificationChecklist(checklist, { need: true, budget_range: true });
    expect(result.requiredComplete).toBe(true);
    expect(canMarkLeadQualified(checklist, { need: true, budget_range: true })).toBe(true);
  });

  it("does not block qualification when no required items are configured", () => {
    const optionalOnly = checklist.map((item) => ({ ...item, required: false }));
    expect(canMarkLeadQualified(optionalOnly, {})).toBe(true);
  });
});

describe("computeLeadWorkspacePriority", () => {
  it("flags breached-SLA leads as hot regardless of score", () => {
    const result = computeLeadWorkspacePriority({ score: 10, slaStatus: "breached" });
    expect(result.priority).toBe("hot");
    expect(result.isHot).toBe(true);
  });

  it("flags high-score leads as hot", () => {
    expect(computeLeadWorkspacePriority({ score: 85, slaStatus: "ok" }).priority).toBe("hot");
  });

  it("maps mid scores to high/medium/low", () => {
    expect(computeLeadWorkspacePriority({ score: 65, slaStatus: "ok" }).priority).toBe("high");
    expect(computeLeadWorkspacePriority({ score: 45, slaStatus: "ok" }).priority).toBe("medium");
    expect(computeLeadWorkspacePriority({ score: 10, slaStatus: "ok" }).priority).toBe("low");
  });
});

describe("compareLeadQueueEntries", () => {
  it("orders hot leads before lower-priority leads, then by earliest SLA due", () => {
    const entries = [
      { id: "low", priority: "low" as const, slaDueAt: null, score: 10 },
      { id: "hot-late", priority: "hot" as const, slaDueAt: "2026-06-29T00:00:00.000Z", score: 90 },
      { id: "hot-soon", priority: "hot" as const, slaDueAt: "2026-06-28T00:00:00.000Z", score: 80 }
    ];
    const ordered = [...entries].sort(compareLeadQueueEntries).map((entry) => entry.id);
    expect(ordered).toEqual(["hot-soon", "hot-late", "low"]);
  });
});

const cadenceSteps: LeadCadenceStepDefinition[] = [
  { key: "call_1", label: "Day 0 call", channel: "call", offsetHours: 0, order: 0 },
  { key: "email_1", label: "Day 1 email", channel: "email", offsetHours: 24, order: 1 },
  { key: "whatsapp_1", label: "Day 2 WhatsApp", channel: "whatsapp", offsetHours: 48, order: 2 }
];

describe("evaluateLeadCadence", () => {
  const startIso = "2026-06-28T00:00:00.000Z";

  it("marks the first uncompleted step current and computes due times", () => {
    const view = evaluateLeadCadence({
      steps: cadenceSteps,
      state: { paused: false, pauseReason: null, completedStepKeys: ["call_1"], failedAttemptCount: 0, movedToNurture: false },
      startIso,
      nowIso: "2026-06-28T12:00:00.000Z"
    });
    expect(view.completedCount).toBe(1);
    expect(view.totalCount).toBe(3);
    expect(view.currentStep?.key).toBe("email_1");
    expect(view.nextDueAt).toBe("2026-06-29T00:00:00.000Z");
    expect(view.steps.find((step) => step.key === "call_1")?.status).toBe("completed");
  });

  it("flags an overdue current step", () => {
    const view = evaluateLeadCadence({
      steps: cadenceSteps,
      state: { paused: false, pauseReason: null, completedStepKeys: [], failedAttemptCount: 0, movedToNurture: false },
      startIso,
      nowIso: "2026-06-30T00:00:00.000Z"
    });
    expect(view.currentStep?.key).toBe("call_1");
    expect(view.steps[0].status).toBe("overdue");
  });

  it("derives nurture routing once failed attempts cross the threshold", () => {
    const view = evaluateLeadCadence({
      steps: cadenceSteps,
      state: { paused: true, pauseReason: "Holiday", completedStepKeys: [], failedAttemptCount: 3, movedToNurture: false },
      startIso,
      nowIso: "2026-06-28T12:00:00.000Z",
      failedAttemptsBeforeNurture: 3
    });
    expect(view.paused).toBe(true);
    expect(view.pauseReason).toBe("Holiday");
    expect(view.movedToNurture).toBe(true);
  });

  it("reports an unconfigured cadence when there are no steps", () => {
    const view = evaluateLeadCadence({
      steps: [],
      state: { paused: false, pauseReason: null, completedStepKeys: [], failedAttemptCount: 0, movedToNurture: false },
      startIso,
      nowIso: "2026-06-28T12:00:00.000Z"
    });
    expect(view.configured).toBe(false);
    expect(view.currentStep).toBeNull();
  });
});
