import { describe, expect, it } from "vitest";
import {
  configurationDimensions,
  configurationDimensionKeys,
  matchConfigScope,
  scopeSpecificity,
  resolveScopedConfig,
  revenueJourneyCatalog,
  revenueMotions,
  findRevenueJourney,
  defaultJourneyConfigurationDefinitions,
  defaultWorkflowAutomationDefinitions,
  validationRuleCatalog,
  notificationRuleCatalog
} from "@crm/types";

describe("Section 16: configuration dimensions", () => {
  it("defines all 15 required dimensions", () => {
    expect(configurationDimensions.length).toBe(15);
    expect(configurationDimensionKeys.length).toBe(15);
    for (const d of configurationDimensions) {
      expect(d.label.trim().length).toBeGreaterThan(0);
      expect(d.examples.length).toBeGreaterThan(0);
    }
  });
});

describe("Section 16: dimension scope resolver", () => {
  const entries = [
    { scope: {}, value: "default" },
    { scope: { region: "emea" }, value: "emea" },
    { scope: { region: "emea", segment: "enterprise" }, value: "emea-ent" }
  ];

  it("matches a scope only when every specified dimension equals the context", () => {
    expect(matchConfigScope({ region: "emea" }, { region: "emea", segment: "smb" })).toBe(true);
    expect(matchConfigScope({ region: "emea" }, { region: "apac" })).toBe(false);
    expect(matchConfigScope({}, { region: "apac" })).toBe(true);
  });

  it("scores specificity by number of pinned dimensions", () => {
    expect(scopeSpecificity({})).toBe(0);
    expect(scopeSpecificity({ region: "emea", segment: "enterprise" })).toBe(2);
  });

  it("resolves the most specific matching entry (falling back to tenant default)", () => {
    expect(resolveScopedConfig({ region: "emea", segment: "enterprise" }, entries)).toBe("emea-ent");
    expect(resolveScopedConfig({ region: "emea", segment: "smb" }, entries)).toBe("emea");
    expect(resolveScopedConfig({ region: "apac" }, entries)).toBe("default");
  });
});

describe("Section 16: revenue journeys", () => {
  it("defines all 10 required journeys", () => {
    expect(revenueJourneyCatalog.length).toBe(10);
    expect(revenueMotions.length).toBe(10);
    const keys = revenueJourneyCatalog.map((j) => j.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("scopes each journey using only valid configuration dimensions", () => {
    for (const journey of revenueJourneyCatalog) {
      for (const key of Object.keys(journey.scope)) {
        expect(configurationDimensionKeys as readonly string[]).toContain(key);
      }
      expect(journey.stages.length).toBeGreaterThan(0);
    }
  });

  it("composes ONLY real primitives — every referenced workflow, validation and notification exists", () => {
    const workflowKeys = new Set(defaultWorkflowAutomationDefinitions.map((w) => w.seedKey));
    const validationKeys = new Set(validationRuleCatalog.map((r) => r.key));
    const notificationKeys = new Set(notificationRuleCatalog.map((n) => n.key));
    const problems: string[] = [];
    for (const journey of revenueJourneyCatalog) {
      for (const w of journey.composedOf.workflows) if (!workflowKeys.has(w)) problems.push(`${journey.key} -> workflow ${w}`);
      for (const v of journey.composedOf.validations) if (!validationKeys.has(v)) problems.push(`${journey.key} -> validation ${v}`);
      for (const n of journey.composedOf.notifications) if (!notificationKeys.has(n)) problems.push(`${journey.key} -> notification ${n}`);
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("seeds 10 governed journey configuration definitions", () => {
    expect(defaultJourneyConfigurationDefinitions.length).toBe(10);
    for (const def of defaultJourneyConfigurationDefinitions) {
      expect(def.definitionType).toBe("journey");
      expect(def.definition.motion).toBeDefined();
      expect(Array.isArray(def.definition.stages)).toBe(true);
    }
    expect(findRevenueJourney("enterprise_sales")?.name).toBe("Enterprise sales");
  });
});
