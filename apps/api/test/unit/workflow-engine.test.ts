import { describe, expect, it } from "vitest";
import { workflowActionTypes, workflowConditionOperators, workflowTriggerTypes } from "@crm/types";
import { evaluateCondition } from "../../src/modules/workflows/workflow.service";

const context = {
  lead: { score: 80, status: "qualified", tags: ["enterprise", "priority"] },
  owner: "user-1"
};

describe("Workflow engine: catalogs", () => {
  it("exposes trigger, action, and operator catalogs", () => {
    expect(workflowTriggerTypes.length).toBeGreaterThan(0);
    expect(workflowActionTypes.length).toBeGreaterThan(0);
    expect(workflowConditionOperators).toContain("eq");
    expect(workflowConditionOperators).toContain("exists");
    expect(workflowConditionOperators).toContain("in");
  });
});

describe("Workflow engine: condition evaluation", () => {
  it("evaluates equality and inequality on nested fields", () => {
    expect(evaluateCondition({ field: "lead.status", operator: "eq", value: "qualified" }, context)).toBe(true);
    expect(evaluateCondition({ field: "lead.status", operator: "ne", value: "qualified" }, context)).toBe(false);
  });

  it("evaluates numeric comparisons", () => {
    expect(evaluateCondition({ field: "lead.score", operator: "gt", value: 50 }, context)).toBe(true);
    expect(evaluateCondition({ field: "lead.score", operator: "lt", value: 50 }, context)).toBe(false);
    expect(evaluateCondition({ field: "lead.score", operator: "gte", value: 80 }, context)).toBe(true);
    expect(evaluateCondition({ field: "lead.score", operator: "lte", value: 80 }, context)).toBe(true);
  });

  it("evaluates contains, exists, and in", () => {
    expect(evaluateCondition({ field: "lead.status", operator: "contains", value: "QUALI" }, context)).toBe(true);
    expect(evaluateCondition({ field: "owner", operator: "exists" }, context)).toBe(true);
    expect(evaluateCondition({ field: "missing.field", operator: "exists" }, context)).toBe(false);
    expect(evaluateCondition({ field: "lead.status", operator: "in", value: ["new", "qualified"] }, context)).toBe(true);
    expect(evaluateCondition({ field: "lead.status", operator: "in", value: ["new", "lost"] }, context)).toBe(false);
  });

  it("returns false for an unknown field on a comparison", () => {
    expect(evaluateCondition({ field: "lead.unknown", operator: "eq", value: "x" }, context)).toBe(false);
  });
});
