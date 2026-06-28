import { describe, expect, it } from "vitest";
import {
  buildLeadRuntimeRecord,
  defaultLeadAssignmentRule,
  defaultLeadMqlRule,
  defaultLeadScoringModel,
  defaultLeadSlaPolicy,
  evaluateLeadRuntime
} from "@crm/types";

const nowIso = "2026-06-26T10:00:00.000Z";

function hoursAgo(hours: number) {
  return new Date(new Date(nowIso).getTime() - hours * 3_600_000).toISOString();
}

function baseRecord(overrides: Partial<Parameters<typeof buildLeadRuntimeRecord>[0]> = {}) {
  return buildLeadRuntimeRecord({
    id: "lead-1",
    firstName: "Asha",
    lastName: "Singh",
    fullName: "Asha Singh",
    companyName: "Apar Demo School",
    email: "asha@example.com",
    phone: "+91 99999 00000",
    statusKey: "new",
    sourceKey: "partner",
    score: 70,
    ownerId: null,
    customFields: {},
    activityCount: 2,
    firstActivityAt: hoursAgo(1),
    lastActivityAt: hoursAgo(1),
    createdAt: hoursAgo(3),
    updatedAt: hoursAgo(1),
    metadata: {
      industry: "education",
      segment: "enterprise",
      region: "noida",
      designation: "Director",
      productInterest: ["elite_sis_k12"],
      subSource: "demo_request",
      consentStatus: "opted_in"
    },
    ...overrides
  });
}

const config = {
  scoringModel: { definitionKey: "lead-default", name: "Lead Scoring Model", payload: defaultLeadScoringModel },
  mqlRule: { definitionKey: "lead-default", name: "Lead MQL Rule", payload: defaultLeadMqlRule },
  assignmentRule: { definitionKey: "lead-default", name: "Lead Assignment Rules", payload: defaultLeadAssignmentRule },
  slaPolicy: { definitionKey: "lead-default", name: "Lead SLA Policy", payload: defaultLeadSlaPolicy }
};

describe("lead runtime evaluator", () => {
  it("composes scoring, MQL, assignment, and SLA guidance from configuration", () => {
    const result = evaluateLeadRuntime({ leadId: "lead-1", record: baseRecord(), config, nowIso });

    expect(result.configGaps).toEqual([]);
    expect(result.scoring?.modelKey).toBe("lead-default");
    expect(result.scoring?.result.finalScore).toBe(100);
    expect(result.scoring?.result.grade).toBe("a");
    expect(result.mql?.result.isMql).toBe(true);
    expect(result.assignment?.resolution.ruleKey).toBe("partner-sourced");
    expect(result.assignment?.requiresRuntimeSelection).toBe(false);
    expect(result.sla?.targets.find((target) => target.key === "first_response")?.status).toBe("met");
  });

  it("marks round-robin assignment as requiring runtime state", () => {
    const record = baseRecord({
      sourceKey: "website",
      metadata: {
        region: "mumbai",
        productInterest: ["elite_sis_k12"],
        consentStatus: "opted_in"
      }
    });
    const result = evaluateLeadRuntime({ leadId: "lead-1", record, config, nowIso });

    expect(result.assignment?.resolution.ruleKey).toBe("default-inside-sales");
    expect(result.assignment?.resolution.strategy).toBe("round_robin");
    expect(result.assignment?.requiresRuntimeSelection).toBe(true);
    expect(result.assignment?.runtimeSelectionReason).toContain("runtime state");
  });

  it("merges persisted custom fields into runtime evaluation without overriding system fields", () => {
    const record = baseRecord({
      sourceKey: "website",
      customFields: {
        region: "mumbai",
        source: "partner"
      },
      metadata: {
        productInterest: ["elite_sis_k12"],
        consentStatus: "opted_in"
      }
    });
    const result = evaluateLeadRuntime({ leadId: "lead-1", record, config, nowIso });

    expect(result.assignment?.resolution.ruleKey).toBe("default-inside-sales");
    expect(result.assignment?.resolution.strategy).toBe("round_robin");
  });

  it("flags SLA breach dispatch recommendations without dispatching them", () => {
    const result = evaluateLeadRuntime({
      leadId: "lead-1",
      record: baseRecord({ firstActivityAt: null, lastActivityAt: null, activityCount: 0, createdAt: hoursAgo(6) }),
      config,
      nowIso
    });

    expect(result.sla?.targets.find((target) => target.key === "first_response")?.status).toBe("breached");
    expect(result.sla?.breachDispatchRecommended).toBe(true);
    expect(result.deferredRuntimeActions).toContain("SLA warning/breach notification dispatch still belongs to the worker slice.");
  });

  it("reports configuration gaps instead of falling back to hard-coded runtime rules", () => {
    const result = evaluateLeadRuntime({ leadId: "lead-1", record: baseRecord(), config: {}, nowIso });

    expect(result.scoring).toBeNull();
    expect(result.mql).toBeNull();
    expect(result.assignment).toBeNull();
    expect(result.sla).toBeNull();
    expect(result.configGaps).toEqual([
      "No active lead scoring_model definition is configured.",
      "No active lead mql_rule definition is configured.",
      "No active lead assignment_rule definition is configured.",
      "No active lead sla_policy definition is configured."
    ]);
  });
});
