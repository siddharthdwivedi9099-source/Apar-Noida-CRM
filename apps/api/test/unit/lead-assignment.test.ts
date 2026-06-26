import { describe, expect, it } from "vitest";
import {
  computeSlaStatus,
  defaultLeadAssignmentConfigurationDefinitions,
  defaultLeadAssignmentRule,
  defaultLeadSlaPolicy,
  resolveAssignmentRule,
  validateConfigurationDefinitions
} from "@crm/types";

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

describe("lead assignment resolver", () => {
  it("routes a partner-sourced lead by the highest-priority matching rule", () => {
    const result = resolveAssignmentRule(defaultLeadAssignmentRule, { leadSource: "partner", segment: "enterprise" });
    expect(result.ruleKey).toBe("partner-sourced");
    expect(result.strategy).toBe("named_account");
    expect(result.target?.ref).toBe("partner-managers");
  });

  it("routes an enterprise lead to the load-balanced pool", () => {
    const result = resolveAssignmentRule(defaultLeadAssignmentRule, { segment: "enterprise", region: "noida" });
    expect(result.ruleKey).toBe("enterprise-segment");
    expect(result.strategy).toBe("load_balanced");
  });

  it("falls through to the catch-all round-robin rule", () => {
    const result = resolveAssignmentRule(defaultLeadAssignmentRule, { region: "mumbai" });
    expect(result.ruleKey).toBe("default-inside-sales");
    expect(result.pool).toContain("team:inside-sales");
  });

  it("uses the fallback when no rule matches", () => {
    const result = resolveAssignmentRule({ object: "lead", rules: [], fallback: { kind: "queue", ref: "unassigned-leads" } }, {});
    expect(result.ruleKey).toBeNull();
    expect(result.strategy).toBe("fallback");
    expect(result.target?.ref).toBe("unassigned-leads");
  });
});

describe("SLA computation", () => {
  const target = { key: "first_response", hours: 4, warningHours: 2 };

  it("is ok well before due, warning near due, breached after due", () => {
    const now = new Date().toISOString();
    expect(computeSlaStatus(target, hoursFromNow(0), null, now).status).toBe("ok"); // 4h remaining
    expect(computeSlaStatus(target, hoursFromNow(-3), null, now).status).toBe("warning"); // 1h remaining (<= 2)
    expect(computeSlaStatus(target, hoursFromNow(-5), null, now).status).toBe("breached"); // overdue
  });

  it("marks met when completed before due and breached when completed after due", () => {
    const start = new Date().toISOString();
    const now = new Date().toISOString();
    expect(computeSlaStatus(target, start, hoursFromNow(2), now).status).toBe("met"); // completed within 4h
    expect(computeSlaStatus(target, start, hoursFromNow(6), now).status).toBe("breached"); // completed after 4h
  });
});

describe("seeded assignment/SLA definitions", () => {
  it("validate cleanly and cover both lead rule types", () => {
    const issues = validateConfigurationDefinitions(defaultLeadAssignmentConfigurationDefinitions);
    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
    const types = defaultLeadAssignmentConfigurationDefinitions.map((def) => def.definitionType).sort();
    expect(types).toEqual(["assignment_rule", "sla_policy"]);
    expect(defaultLeadSlaPolicy.escalation?.afterHours).toBe(8);
  });
});
