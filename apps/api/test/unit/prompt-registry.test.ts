import { describe, expect, it } from "vitest";
import { aiRequestTypes, defaultAiAgents, defaultAiPromptTemplates } from "@crm/types";

describe("Prompt Registry: default templates", () => {
  it("registers templates with unique keys", () => {
    expect(defaultAiPromptTemplates.length).toBeGreaterThan(0);
    const keys = defaultAiPromptTemplates.map((template) => template.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("uses only known request types", () => {
    for (const template of defaultAiPromptTemplates) {
      expect(aiRequestTypes).toContain(template.requestType);
    }
  });

  it("declares every templated variable so prompts are never hardcoded with stray tokens", () => {
    for (const template of defaultAiPromptTemplates) {
      for (const variable of template.variables) {
        expect(template.template).toContain(`{{${variable}}}`);
      }
    }
  });

  it("includes core sales/support/customer-success capabilities", () => {
    const capabilities = new Set(defaultAiPromptTemplates.map((template) => template.capability));
    expect(capabilities.has("opportunity_summary")).toBe(true);
    expect(capabilities.has("ticket_summary")).toBe(true);
    expect(capabilities.has("customer_health_summary")).toBe(true);
  });
});

describe("Agent Registry: default agents", () => {
  it("registers seed agents with unique keys", () => {
    expect(defaultAiAgents.length).toBeGreaterThan(0);
    const keys = defaultAiAgents.map((agent) => agent.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
