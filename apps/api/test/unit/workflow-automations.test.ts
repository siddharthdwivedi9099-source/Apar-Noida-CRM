import { describe, expect, it } from "vitest";
import {
  approvalTypes,
  defaultWorkflowAutomationDefinitions,
  findWorkflowAction,
  notificationTypes,
  workflowActionTypes,
  workflowConditionOperators,
  workflowTriggerTypes
} from "@crm/types";

describe("Section 12: required workflow automations (seed definitions)", () => {
  it("defines the full set of required automations", () => {
    // 30 required automations in the master list.
    expect(defaultWorkflowAutomationDefinitions.length).toBe(30);
  });

  it("uses unique, stable seed keys", () => {
    const keys = defaultWorkflowAutomationDefinitions.map((d) => d.seedKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(key).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("only references trigger and action types the engine supports", () => {
    for (const def of defaultWorkflowAutomationDefinitions) {
      expect(workflowTriggerTypes).toContain(def.triggerType);
      expect(def.actions.length).toBeGreaterThan(0);
      for (const action of def.actions) {
        expect(workflowActionTypes).toContain(action.actionType);
        // Every action type resolves to a catalog definition (with a default permission).
        expect(findWorkflowAction(action.actionType)).toBeDefined();
      }
    }
  });

  it("uses only supported operators in conditions", () => {
    for (const def of defaultWorkflowAutomationDefinitions) {
      for (const condition of def.conditions ?? []) {
        expect(workflowConditionOperators).toContain(condition.operator);
        expect(condition.field.length).toBeGreaterThan(0);
      }
    }
  });

  it("has a name, description and module for every automation", () => {
    for (const def of defaultWorkflowAutomationDefinitions) {
      expect(def.name.trim().length).toBeGreaterThan(0);
      expect(def.description.trim().length).toBeGreaterThan(0);
      expect(def.module.trim().length).toBeGreaterThan(0);
    }
  });

  it("only uses approval and notification types the executors/DB accept", () => {
    for (const def of defaultWorkflowAutomationDefinitions) {
      for (const action of def.actions) {
        if (action.actionType === "trigger_approval") {
          expect(approvalTypes as readonly string[]).toContain(String(action.actionConfig?.approvalType));
        }
        if (action.actionType === "send_notification") {
          expect(notificationTypes as readonly string[]).toContain(String(action.actionConfig?.notificationType));
        }
      }
    }
  });

  it("routes discount and legal automations through the approval executor", () => {
    const discount = defaultWorkflowAutomationDefinitions.find((d) => d.seedKey === "auto-trigger-discount-approval");
    const legal = defaultWorkflowAutomationDefinitions.find((d) => d.seedKey === "auto-trigger-legal-review");
    expect(discount?.actions[0].actionType).toBe("trigger_approval");
    expect(legal?.actions[0].actionType).toBe("trigger_approval");
  });
});
