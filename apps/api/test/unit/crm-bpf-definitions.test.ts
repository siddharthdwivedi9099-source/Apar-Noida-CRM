import { describe, expect, it } from "vitest";
import {
  defaultBpfConfigurationDefinitions,
  validateConfigurationDefinition,
  validateConfigurationDefinitions,
  type BusinessProcessFlowPayload,
  type ConfigurationDefinition
} from "@crm/types";

function payload(def: ConfigurationDefinition): BusinessProcessFlowPayload {
  return def.definition as unknown as BusinessProcessFlowPayload;
}

const expectedStageCounts: Record<string, number> = {
  "lead-lifecycle": 13,
  "opportunity-lifecycle": 14,
  "campaign-lifecycle": 10,
  "partner-lifecycle": 11,
  "support-ticket-lifecycle": 15,
  "customer-success-lifecycle": 13
};

describe("CRM BPF configuration definitions", () => {
  it("defines all six business process flows", () => {
    expect(defaultBpfConfigurationDefinitions).toHaveLength(6);
    for (const def of defaultBpfConfigurationDefinitions) {
      expect(def.definitionType).toBe("business_process_flow");
    }
    const keys = defaultBpfConfigurationDefinitions.map((def) => def.definitionKey).sort();
    expect(keys).toEqual(Object.keys(expectedStageCounts).sort());
  });

  it("every BPF passes validation with no errors", () => {
    const issues = validateConfigurationDefinitions(defaultBpfConfigurationDefinitions);
    const errors = issues.filter((issue) => issue.severity === "error");
    expect(errors).toEqual([]);
  });

  it("each BPF has the expected stage count, exactly one entry, and at least one terminal stage", () => {
    for (const def of defaultBpfConfigurationDefinitions) {
      const stages = payload(def).stages;
      expect(stages).toHaveLength(expectedStageCounts[def.definitionKey]);
      expect(stages.filter((stage) => stage.isEntry).length).toBe(1);
      expect(stages.some((stage) => stage.isTerminal)).toBe(true);
      // Stage orders are unique.
      const orders = stages.map((stage) => stage.order);
      expect(new Set(orders).size).toBe(orders.length);
    }
  });

  it("all transitions reference real stages and terminal stages have no outgoing transitions", () => {
    for (const def of defaultBpfConfigurationDefinitions) {
      const { stages, transitions = [] } = payload(def);
      const stageKeys = new Set(stages.map((stage) => stage.key));
      const terminalKeys = new Set(stages.filter((stage) => stage.isTerminal).map((stage) => stage.key));
      for (const transition of transitions) {
        expect(stageKeys.has(transition.from)).toBe(true);
        expect(stageKeys.has(transition.to)).toBe(true);
        expect(terminalKeys.has(transition.from)).toBe(false);
      }
    }
  });

  it("the lead BPF includes its required configured stages and required fields", () => {
    const lead = defaultBpfConfigurationDefinitions.find((def) => def.definitionKey === "lead-lifecycle");
    expect(lead).toBeDefined();
    const stages = payload(lead!).stages;
    const mql = stages.find((stage) => stage.key === "marketing-qualified-lead");
    expect(mql?.requiredFields).toContain("leadScore");
    const disqualified = stages.find((stage) => stage.key === "disqualified");
    expect(disqualified?.isTerminal).toBe(true);
    expect(disqualified?.requiredFields).toContain("disqualificationReason");
  });

  it("rejects a terminal stage that has an outgoing transition", () => {
    const broken: ConfigurationDefinition = {
      definitionType: "business_process_flow",
      definitionKey: "broken",
      name: "Broken",
      description: null,
      isActive: true,
      definition: {
        object: "lead",
        stages: [
          { key: "start", order: 1, isEntry: true },
          { key: "done", order: 2, isTerminal: true }
        ],
        transitions: [
          { from: "start", to: "done" },
          { from: "done", to: "start" }
        ]
      }
    };
    const issues = validateConfigurationDefinition(broken);
    expect(issues.some((issue) => issue.code === "BPF_TERMINAL_STAGE_HAS_TRANSITION")).toBe(true);
  });

  it("rejects a transition to an unknown stage and multiple entry stages", () => {
    const broken: ConfigurationDefinition = {
      definitionType: "business_process_flow",
      definitionKey: "broken-2",
      name: "Broken 2",
      description: null,
      isActive: true,
      definition: {
        object: "lead",
        stages: [
          { key: "a", order: 1, isEntry: true },
          { key: "b", order: 2, isEntry: true }
        ],
        transitions: [{ from: "a", to: "ghost" }]
      }
    };
    const issues = validateConfigurationDefinition(broken);
    expect(issues.some((issue) => issue.code === "BPF_INVALID_TRANSITION")).toBe(true);
    expect(issues.some((issue) => issue.code === "BPF_MULTIPLE_ENTRY_STAGES")).toBe(true);
  });
});
