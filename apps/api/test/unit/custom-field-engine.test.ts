import { describe, expect, it } from "vitest";
import type { PoolClient } from "pg";
import {
  loadCustomFieldDefinitions,
  loadCustomFieldOptions,
  sanitizeCustomFields
} from "../../src/common/custom-fields.js";

interface FakeRows {
  definitions: Record<string, unknown>[];
  optionValues: Record<string, Record<string, unknown>[]>;
}

/**
 * Minimal PoolClient stub that answers the two queries the engine issues:
 * one against custom_field_definitions and one against tenant_option_sets/values.
 */
function createFakeClient(rows: FakeRows): PoolClient {
  return {
    query: async (text: string, params: unknown[]) => {
      if (text.includes("FROM custom_field_definitions")) {
        return { rows: rows.definitions };
      }
      if (text.includes("FROM tenant_option_sets")) {
        const setKey = params[1] as string;
        return { rows: rows.optionValues[setKey] ?? [] };
      }
      throw new Error(`Unexpected query: ${text}`);
    }
  } as unknown as PoolClient;
}

function definition(overrides: Record<string, unknown>) {
  return {
    field_key: "territory",
    label: "Territory",
    description: null,
    data_type: "text",
    placeholder: null,
    option_set_key: null,
    is_required: false,
    is_active: true,
    is_system_field: false,
    sort_order: 10,
    settings: {},
    metadata: {},
    ...overrides
  };
}

function optionValue(key: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `opt-${key}`,
    key,
    label: key.toUpperCase(),
    description: null,
    color: null,
    is_default: false,
    is_active: true,
    ...overrides
  };
}

const TENANT = "tenant-1";
const ENTITY = "support_ticket";

describe("custom-field engine", () => {
  it("loads active custom field definitions and ignores unsupported data types", async () => {
    const client = createFakeClient({
      definitions: [
        definition({ field_key: "territory", data_type: "text" }),
        definition({ field_key: "bogus", data_type: "not-a-real-type" })
      ],
      optionValues: {}
    });

    const fields = await loadCustomFieldDefinitions(client, TENANT, ENTITY);

    expect(fields.map((field) => field.fieldKey)).toEqual(["territory"]);
    expect(fields[0]?.isSystemField).toBe(false);
  });

  it("builds option catalogs only for select/multiselect custom fields", async () => {
    const client = createFakeClient({
      definitions: [],
      optionValues: {
        "ticket-tier": [optionValue("gold"), optionValue("silver")]
      }
    });

    const options = await loadCustomFieldOptions(client, TENANT, [
      {
        fieldKey: "tier",
        label: "Tier",
        description: null,
        dataType: "select",
        placeholder: null,
        optionSetKey: "ticket-tier",
        targetObject: null,
        isRequired: false,
        isActive: true,
        isSystemField: false,
        sortOrder: 10,
        settings: {},
        metadata: {}
      },
      {
        fieldKey: "note",
        label: "Note",
        description: null,
        dataType: "text",
        placeholder: null,
        optionSetKey: null,
        targetObject: null,
        isRequired: false,
        isActive: true,
        isSystemField: false,
        sortOrder: 20,
        settings: {},
        metadata: {}
      }
    ]);

    expect(Object.keys(options)).toEqual(["ticket-tier"]);
    expect(options["ticket-tier"].map((value) => value.key)).toEqual(["gold", "silver"]);
  });

  it("sanitizes values, ignores unknown keys, and clears nulls while merging current values", async () => {
    const client = createFakeClient({
      definitions: [
        definition({ field_key: "territory", data_type: "text" }),
        definition({ field_key: "tier", data_type: "select", option_set_key: "ticket-tier" }),
        definition({ field_key: "stale", data_type: "text" })
      ],
      optionValues: {
        "ticket-tier": [optionValue("gold"), optionValue("silver")]
      }
    });

    const result = await sanitizeCustomFields(
      client,
      TENANT,
      ENTITY,
      { territory: "  North  ", tier: "gold", stale: null, unknownField: "x" },
      { stale: "previous", keepMe: "kept" }
    );

    expect(result).toEqual({ territory: "North", tier: "gold", keepMe: "kept" });
    expect(result).not.toHaveProperty("unknownField");
  });

  it("rejects select values that are not active option keys", async () => {
    const client = createFakeClient({
      definitions: [definition({ field_key: "tier", data_type: "select", option_set_key: "ticket-tier" })],
      optionValues: {
        "ticket-tier": [optionValue("gold")]
      }
    });

    await expect(
      sanitizeCustomFields(client, TENANT, ENTITY, { tier: "bronze" })
    ).rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" });
  });

  it("returns the current values unchanged when no input is provided", async () => {
    const client = createFakeClient({ definitions: [], optionValues: {} });
    const current = { territory: "North" };

    const result = await sanitizeCustomFields(client, TENANT, ENTITY, undefined, current);

    expect(result).toBe(current);
  });
});
