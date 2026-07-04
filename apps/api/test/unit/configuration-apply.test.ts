import { describe, expect, it } from "vitest";
import {
  CONFIGURATION_SNAPSHOT_SCHEMA_VERSION,
  defaultTenantCoreSettings,
  defaultTenantThemeSettings,
  planConfigurationApply,
  type ConfigurationDefinition,
  type ConfigurationSnapshot,
  type CustomFieldDefinition,
  type TenantOptionSet
} from "@crm/types";

function optionSet(overrides: Partial<TenantOptionSet> = {}): TenantOptionSet {
  return {
    id: "set-1",
    tenantId: "t1",
    setKey: "lead-status",
    moduleKey: "leads",
    kind: "dropdown",
    name: "Lead Status",
    description: null,
    isSystemSet: false,
    isActive: true,
    metadata: {},
    values: [
      { id: "v1", key: "new", label: "New", description: null, color: null, sortOrder: 0, isDefault: true, isActive: true, metadata: {} }
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function customField(overrides: Partial<CustomFieldDefinition> = {}): CustomFieldDefinition {
  return {
    id: "f1",
    tenantId: "t1",
    moduleKey: "leads",
    entityKey: "lead",
    fieldKey: "region",
    label: "Region",
    description: null,
    dataType: "text",
    placeholder: null,
    optionSetKey: null,
    isRequired: false,
    isActive: true,
    isSystemField: false,
    sortOrder: 0,
    settings: {},
    metadata: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function definition(overrides: Partial<ConfigurationDefinition> = {}): ConfigurationDefinition {
  return {
    definitionType: "dashboard",
    definitionKey: "sales-manager",
    name: "Sales Manager Dashboard",
    description: null,
    isActive: true,
    definition: {
      dashboardKey: "sales-manager",
      widgets: [{ key: "pipeline", label: "Pipeline", metricKey: "pipeline_value" }]
    },
    ...overrides
  };
}

function snapshot(overrides: Partial<ConfigurationSnapshot> = {}): ConfigurationSnapshot {
  return {
    schemaVersion: CONFIGURATION_SNAPSHOT_SCHEMA_VERSION,
    settings: defaultTenantCoreSettings,
    theme: defaultTenantThemeSettings,
    modules: [{ moduleKey: "leads", label: "Leads", description: "", defaultEnabled: true, locked: false, enabled: true }],
    terminology: [],
    optionSets: [optionSet()],
    customFields: [customField()],
    formLayouts: [],
    definitions: [],
    ...overrides
  };
}

describe("planConfigurationApply (upsert-only diff)", () => {
  it("is all no-ops when target equals current", () => {
    const base = snapshot();
    const plan = planConfigurationApply(base, base);
    expect(plan.createCount).toBe(0);
    expect(plan.updateCount).toBe(0);
    expect(plan.operations.every((op) => op.action === "noop")).toBe(true);
  });

  it("never emits delete operations (upsert-only)", () => {
    // current has an extra option set that target lacks — must not produce a delete
    const current = snapshot({ optionSets: [optionSet(), optionSet({ setKey: "extra", id: "set-2" })] });
    const target = snapshot();
    const plan = planConfigurationApply(current, target);
    expect(plan.operations.every((op) => ["create", "update", "noop"].includes(op.action))).toBe(true);
  });

  it("flags a brand-new option set as create", () => {
    const current = snapshot();
    const target = snapshot({ optionSets: [optionSet(), optionSet({ setKey: "lead-source", id: "set-2", name: "Lead Source" })] });
    const plan = planConfigurationApply(current, target);
    const op = plan.operations.find((o) => o.section === "optionSets" && o.key === "lead-source");
    expect(op?.action).toBe("create");
    expect(plan.createCount).toBe(1);
  });

  it("flags a changed theme as update and unchanged settings as noop", () => {
    const current = snapshot();
    const target = snapshot({ theme: { ...defaultTenantThemeSettings, primaryColor: "#123456" } });
    const plan = planConfigurationApply(current, target);
    expect(plan.operations.find((o) => o.section === "theme")?.action).toBe("update");
    expect(plan.operations.find((o) => o.section === "settings")?.action).toBe("noop");
  });

  it("flags a new custom field as create and a changed one as update", () => {
    const current = snapshot();
    const createTarget = snapshot({ customFields: [customField(), customField({ id: "f2", fieldKey: "tier", label: "Tier" })] });
    expect(planConfigurationApply(current, createTarget).operations.find((o) => o.key === "lead.tier")?.action).toBe("create");

    const updateTarget = snapshot({ customFields: [customField({ label: "Region (APAC)" })] });
    expect(planConfigurationApply(current, updateTarget).operations.find((o) => o.key === "lead.region")?.action).toBe("update");
  });

  it("flags a module enablement change as update", () => {
    const current = snapshot();
    const target = snapshot({
      modules: [{ moduleKey: "leads", label: "Leads", description: "", defaultEnabled: true, locked: false, enabled: false }]
    });
    expect(planConfigurationApply(current, target).operations.find((o) => o.section === "modules")?.action).toBe("update");
  });

  it("diffs configuration definitions by type and key", () => {
    const current = snapshot({ definitions: [definition()] });
    const createTarget = snapshot({
      definitions: [
        definition(),
        definition({
          definitionType: "business_process_flow",
          definitionKey: "lead-lifecycle",
          name: "Lead Lifecycle",
          definition: { object: "lead", stages: [{ key: "new", order: 1 }] }
        })
      ]
    });
    const updateTarget = snapshot({
      definitions: [definition({ name: "Sales Leader Dashboard" })]
    });

    expect(planConfigurationApply(current, createTarget).operations.find((o) => o.key === "business_process_flow:lead-lifecycle")?.action).toBe("create");
    expect(planConfigurationApply(current, updateTarget).operations.find((o) => o.key === "dashboard:sales-manager")?.action).toBe("update");
  });
});
