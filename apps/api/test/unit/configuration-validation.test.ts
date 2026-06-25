import { describe, expect, it } from "vitest";
import {
  CONFIGURATION_SNAPSHOT_SCHEMA_VERSION,
  defaultTenantCoreSettings,
  defaultTenantThemeSettings,
  normalizeCustomFieldSettings,
  validateConfigurationSnapshot,
  type ConfigurationSnapshot,
  type CustomFieldDefinition,
  type CustomFormLayoutDefinition,
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

function layout(overrides: Partial<CustomFormLayoutDefinition> = {}): CustomFormLayoutDefinition {
  return {
    id: "l1",
    tenantId: "t1",
    moduleKey: "leads",
    entityKey: "lead",
    layoutKey: "default",
    name: "Default",
    description: null,
    isActive: true,
    isSystemLayout: false,
    layoutSchema: { sections: [{ id: "s1", title: "Main", fields: [] }] },
    metadata: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function snapshot(overrides: Partial<ConfigurationSnapshot> = {}): ConfigurationSnapshot {
  return {
    schemaVersion: CONFIGURATION_SNAPSHOT_SCHEMA_VERSION,
    settings: defaultTenantCoreSettings,
    theme: defaultTenantThemeSettings,
    modules: [],
    terminology: [],
    optionSets: [],
    customFields: [],
    formLayouts: [],
    ...overrides
  };
}

describe("configuration validation", () => {
  it("accepts a clean snapshot", () => {
    const result = validateConfigurationSnapshot(snapshot({ optionSets: [optionSet()], customFields: [customField()] }));
    expect(result.valid).toBe(true);
    expect(result.errorCount).toBe(0);
  });

  it("flags a select field with no option set", () => {
    const result = validateConfigurationSnapshot(
      snapshot({ customFields: [customField({ dataType: "select", optionSetKey: null })] })
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "SELECT_WITHOUT_OPTION_SET")).toBe(true);
  });

  it("flags a custom field referencing an unknown option set", () => {
    const result = validateConfigurationSnapshot(
      snapshot({ customFields: [customField({ dataType: "select", optionSetKey: "does-not-exist" })] })
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "MISSING_OPTION_SET_REFERENCE")).toBe(true);
  });

  it("resolves a select field when its option set is present", () => {
    const result = validateConfigurationSnapshot(
      snapshot({
        optionSets: [optionSet({ setKey: "lead-status" })],
        customFields: [customField({ dataType: "select", optionSetKey: "lead-status" })]
      })
    );
    expect(result.valid).toBe(true);
  });

  it("flags duplicate field keys on the same entity", () => {
    const result = validateConfigurationSnapshot(
      snapshot({ customFields: [customField(), customField({ id: "f2" })] })
    );
    expect(result.issues.some((i) => i.code === "DUPLICATE_FIELD_KEY")).toBe(true);
  });

  it("flags a pipeline option set with no active values as an error", () => {
    const result = validateConfigurationSnapshot(
      snapshot({ optionSets: [optionSet({ kind: "pipeline", values: [] })] })
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "OPTION_SET_NO_ACTIVE_VALUES")).toBe(true);
  });

  it("flags more than one default value in an option set", () => {
    const result = validateConfigurationSnapshot(
      snapshot({
        optionSets: [
          optionSet({
            values: [
              { id: "a", key: "a", label: "A", description: null, color: null, sortOrder: 0, isDefault: true, isActive: true, metadata: {} },
              { id: "b", key: "b", label: "B", description: null, color: null, sortOrder: 1, isDefault: true, isActive: true, metadata: {} }
            ]
          })
        ]
      })
    );
    expect(result.issues.some((i) => i.code === "MULTIPLE_DEFAULT_VALUES")).toBe(true);
  });

  it("flags a layout referencing an unknown custom field", () => {
    const result = validateConfigurationSnapshot(
      snapshot({
        customFields: [customField({ fieldKey: "region" })],
        formLayouts: [layout({ layoutSchema: { sections: [{ id: "s1", title: "Main", fields: ["custom.unknown"] }] } })]
      })
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "LAYOUT_UNKNOWN_FIELD")).toBe(true);
  });

  it("accepts a layout referencing a known custom field", () => {
    const result = validateConfigurationSnapshot(
      snapshot({
        customFields: [customField({ fieldKey: "region" })],
        formLayouts: [layout({ layoutSchema: { sections: [{ id: "s1", title: "Main", fields: ["custom.region"] }] } })]
      })
    );
    expect(result.valid).toBe(true);
  });

  it("rejects a snapshot with an unsupported (future) schema version", () => {
    const result = validateConfigurationSnapshot(snapshot({ schemaVersion: CONFIGURATION_SNAPSHOT_SCHEMA_VERSION + 1 }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "UNSUPPORTED_SCHEMA_VERSION")).toBe(true);
  });
});

describe("custom field settings contract", () => {
  it("applies safe defaults for an empty settings blob", () => {
    const settings = normalizeCustomFieldSettings({});
    expect(settings.isSearchable).toBe(false);
    expect(settings.isSensitive).toBe(false);
    expect(settings.maskingRule).toBe("none");
    expect(settings.helpText).toBeNull();
  });

  it("coerces known attributes and rejects an invalid masking rule", () => {
    const settings = normalizeCustomFieldSettings({
      isSearchable: true,
      isSensitive: true,
      maskingRule: "not-a-rule",
      helpText: "  ",
      defaultValue: "x"
    });
    expect(settings.isSearchable).toBe(true);
    expect(settings.isSensitive).toBe(true);
    expect(settings.maskingRule).toBe("none");
    expect(settings.helpText).toBeNull();
    expect(settings.defaultValue).toBe("x");
  });

  it("warns when masking is set on a non-sensitive field", () => {
    const result = validateConfigurationSnapshot(
      snapshot({ customFields: [customField({ settings: { maskingRule: "partial", isSensitive: false } })] })
    );
    expect(result.valid).toBe(true); // warning, not error
    expect(result.issues.some((i) => i.code === "MASKING_WITHOUT_SENSITIVE" && i.severity === "warning")).toBe(true);
  });
});
