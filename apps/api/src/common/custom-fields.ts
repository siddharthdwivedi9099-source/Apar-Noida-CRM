import type { PoolClient } from "pg";
import {
  crmFieldDataTypes,
  type CrmFieldDataType,
  type CrmFieldDefinition,
  type CrmOptionValueSummary
} from "@crm/types";
import { AppError } from "./errors/app-error.js";

/**
 * Shared, entity-agnostic custom-field engine.
 *
 * Mirrors the proven custom-field logic that lives on CrmService (leads, accounts,
 * contacts, opportunities) so modules outside the CRM service (e.g. support tickets)
 * can persist tenant-defined `custom_fields` against the same `custom_field_definitions`
 * registry without duplicating validation rules. These functions are pure with respect
 * to module state: they only need a PoolClient, the tenant id, and the entity key.
 *
 * Only **custom** (non-system) field definitions are loaded here. System fields are part
 * of the object-definition layer and are intentionally out of scope for value storage.
 */

interface CustomFieldDefinitionRow {
  field_key: string;
  label: string;
  description: string | null;
  data_type: string;
  placeholder: string | null;
  option_set_key: string | null;
  is_required: boolean;
  is_active: boolean;
  is_system_field: boolean;
  sort_order: number;
  settings: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

interface OptionValueRow {
  id: string;
  key: string;
  label: string;
  description: string | null;
  color: string | null;
  is_default: boolean;
  is_active: boolean;
}

function getTrimmedNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function isCrmFieldDataType(value: unknown): value is CrmFieldDataType {
  return typeof value === "string" && (crmFieldDataTypes as readonly string[]).includes(value);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function isValidDateTime(value: string) {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && value.includes("T");
}

export async function loadCustomFieldDefinitions(
  client: PoolClient,
  tenantId: string,
  entityKey: string
): Promise<CrmFieldDefinition[]> {
  const result = await client.query<CustomFieldDefinitionRow>(
    `
      SELECT
        custom_field_definitions.field_key,
        custom_field_definitions.label,
        custom_field_definitions.description,
        custom_field_definitions.data_type,
        custom_field_definitions.placeholder,
        tenant_option_sets.set_key AS option_set_key,
        custom_field_definitions.is_required,
        custom_field_definitions.is_active,
        custom_field_definitions.is_system_field,
        custom_field_definitions.sort_order,
        custom_field_definitions.settings,
        custom_field_definitions.metadata
      FROM custom_field_definitions
      LEFT JOIN tenant_option_sets
        ON tenant_option_sets.id = custom_field_definitions.option_set_id
       AND tenant_option_sets.deleted_at IS NULL
      WHERE custom_field_definitions.tenant_id = $1
        AND custom_field_definitions.entity_key = $2
        AND custom_field_definitions.deleted_at IS NULL
        AND custom_field_definitions.is_active = true
      ORDER BY custom_field_definitions.sort_order ASC, custom_field_definitions.label ASC
    `,
    [tenantId, entityKey]
  );

  return result.rows
    .filter((row) => isCrmFieldDataType(row.data_type))
    .map((row) => ({
      fieldKey: row.field_key,
      label: row.label,
      description: row.description,
      dataType: row.data_type as CrmFieldDataType,
      placeholder: row.placeholder,
      optionSetKey: row.option_set_key,
      targetObject: null,
      isRequired: row.is_required,
      isActive: row.is_active,
      isSystemField: row.is_system_field,
      sortOrder: row.sort_order,
      settings: row.settings ?? {},
      metadata: row.metadata ?? {}
    }));
}

export async function loadOptionSetValues(
  client: PoolClient,
  tenantId: string,
  setKey: string
): Promise<CrmOptionValueSummary[]> {
  const result = await client.query<OptionValueRow>(
    `
      SELECT
        tenant_option_values.id,
        tenant_option_values.value_key AS key,
        tenant_option_values.label,
        tenant_option_values.description,
        tenant_option_values.color,
        tenant_option_values.is_default,
        tenant_option_values.is_active
      FROM tenant_option_sets
      INNER JOIN tenant_option_values
        ON tenant_option_values.option_set_id = tenant_option_sets.id
       AND tenant_option_values.tenant_id = tenant_option_sets.tenant_id
      WHERE tenant_option_sets.tenant_id = $1
        AND tenant_option_sets.set_key = $2
        AND tenant_option_sets.deleted_at IS NULL
        AND tenant_option_values.deleted_at IS NULL
      ORDER BY tenant_option_values.sort_order ASC, tenant_option_values.label ASC
    `,
    [tenantId, setKey]
  );

  return result.rows.map((row) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    description: row.description,
    color: row.color,
    isDefault: row.is_default,
    isActive: row.is_active
  }));
}

export async function loadCustomFieldOptions(
  client: PoolClient,
  tenantId: string,
  fieldDefinitions: CrmFieldDefinition[]
): Promise<Record<string, CrmOptionValueSummary[]>> {
  const optionSetKeys = [
    ...new Set(
      fieldDefinitions
        .filter(
          (field) =>
            !field.isSystemField &&
            (field.dataType === "select" || field.dataType === "multiselect") &&
            typeof field.optionSetKey === "string" &&
            field.optionSetKey.length > 0
        )
        .map((field) => field.optionSetKey as string)
    )
  ];

  if (optionSetKeys.length === 0) {
    return {};
  }

  const entries = await Promise.all(
    optionSetKeys.map(async (setKey) => [setKey, await loadOptionSetValues(client, tenantId, setKey)] as const)
  );

  return Object.fromEntries(entries);
}

async function loadAllowedOptionKeys(
  client: PoolClient,
  tenantId: string,
  setKey: string,
  cache: Map<string, Set<string>>
): Promise<Set<string>> {
  const cached = cache.get(setKey);
  if (cached) {
    return cached;
  }

  const keys = new Set(
    (await loadOptionSetValues(client, tenantId, setKey)).filter((value) => value.isActive).map((value) => value.key)
  );
  cache.set(setKey, keys);
  return keys;
}

async function sanitizeCustomFieldValue(
  client: PoolClient,
  tenantId: string,
  field: CrmFieldDefinition,
  rawValue: unknown,
  optionSetCache: Map<string, Set<string>>
): Promise<{ action: "set"; value: unknown } | { action: "clear" }> {
  if (rawValue === null || rawValue === undefined) {
    return { action: "clear" };
  }

  switch (field.dataType) {
    case "text":
    case "textarea":
    case "phone": {
      if (typeof rawValue !== "string") {
        throw new AppError(400, `${field.label} must be a string.`, undefined, "VALIDATION_ERROR");
      }
      const value = getTrimmedNullableString(rawValue);
      return value === null ? { action: "clear" } : { action: "set", value };
    }
    case "email": {
      if (typeof rawValue !== "string") {
        throw new AppError(400, `${field.label} must be a valid email address.`, undefined, "VALIDATION_ERROR");
      }
      const value = getTrimmedNullableString(rawValue);
      if (value === null) {
        return { action: "clear" };
      }
      if (!isValidEmail(value)) {
        throw new AppError(400, `${field.label} must be a valid email address.`, undefined, "VALIDATION_ERROR");
      }
      return { action: "set", value };
    }
    case "url": {
      if (typeof rawValue !== "string") {
        throw new AppError(400, `${field.label} must be a valid URL.`, undefined, "VALIDATION_ERROR");
      }
      const value = getTrimmedNullableString(rawValue);
      if (value === null) {
        return { action: "clear" };
      }
      try {
        new URL(value);
      } catch {
        throw new AppError(400, `${field.label} must be a valid URL.`, undefined, "VALIDATION_ERROR");
      }
      return { action: "set", value };
    }
    case "date": {
      if (typeof rawValue !== "string") {
        throw new AppError(400, `${field.label} must be a valid date.`, undefined, "VALIDATION_ERROR");
      }
      const value = getTrimmedNullableString(rawValue);
      if (value === null) {
        return { action: "clear" };
      }
      if (!isValidDate(value)) {
        throw new AppError(400, `${field.label} must be a valid date.`, undefined, "VALIDATION_ERROR");
      }
      return { action: "set", value };
    }
    case "datetime": {
      if (typeof rawValue !== "string") {
        throw new AppError(400, `${field.label} must be a valid datetime.`, undefined, "VALIDATION_ERROR");
      }
      const value = getTrimmedNullableString(rawValue);
      if (value === null) {
        return { action: "clear" };
      }
      if (!isValidDateTime(value)) {
        throw new AppError(400, `${field.label} must be a valid datetime.`, undefined, "VALIDATION_ERROR");
      }
      return { action: "set", value };
    }
    case "number": {
      const value =
        typeof rawValue === "number"
          ? rawValue
          : typeof rawValue === "string" && rawValue.trim().length > 0
            ? Number(rawValue)
            : null;
      if (value === null) {
        return { action: "clear" };
      }
      if (!Number.isFinite(value)) {
        throw new AppError(400, `${field.label} must be a valid number.`, undefined, "VALIDATION_ERROR");
      }
      return { action: "set", value };
    }
    case "boolean": {
      if (typeof rawValue !== "boolean") {
        throw new AppError(400, `${field.label} must be true or false.`, undefined, "VALIDATION_ERROR");
      }
      return { action: "set", value: rawValue };
    }
    case "select": {
      if (typeof rawValue !== "string") {
        throw new AppError(400, `${field.label} must be a valid option key.`, undefined, "VALIDATION_ERROR");
      }
      const value = getTrimmedNullableString(rawValue);
      if (value === null) {
        return { action: "clear" };
      }
      if (!field.optionSetKey) {
        throw new AppError(500, `${field.label} is misconfigured.`, undefined, "INVALID_CONFIG");
      }
      const allowedKeys = await loadAllowedOptionKeys(client, tenantId, field.optionSetKey, optionSetCache);
      if (!allowedKeys.has(value)) {
        throw new AppError(400, `${field.label} must reference an active option.`, undefined, "VALIDATION_ERROR");
      }
      return { action: "set", value };
    }
    case "multiselect": {
      if (!Array.isArray(rawValue)) {
        throw new AppError(400, `${field.label} must be an array of option keys.`, undefined, "VALIDATION_ERROR");
      }
      if (!field.optionSetKey) {
        throw new AppError(500, `${field.label} is misconfigured.`, undefined, "INVALID_CONFIG");
      }
      const values = [...new Set(rawValue.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean))];
      if (values.length === 0) {
        return { action: "clear" };
      }
      const allowedKeys = await loadAllowedOptionKeys(client, tenantId, field.optionSetKey, optionSetCache);
      if (values.some((value) => !allowedKeys.has(value))) {
        throw new AppError(400, `${field.label} must reference active options only.`, undefined, "VALIDATION_ERROR");
      }
      return { action: "set", value: values };
    }
    default:
      throw new AppError(400, `${field.label} uses an unsupported custom-field type.`, undefined, "VALIDATION_ERROR");
  }
}

/**
 * Validate and merge tenant-defined custom-field values for an entity.
 *
 * - Unknown keys (no active definition) are ignored.
 * - Null/empty values clear the stored key.
 * - Select/multiselect values are validated against active option keys.
 * - `currentCustomFields` is the existing stored map, so PATCH-style merges keep
 *   untouched keys intact.
 */
export async function sanitizeCustomFields(
  client: PoolClient,
  tenantId: string,
  entityKey: string,
  input: Record<string, unknown> | undefined,
  currentCustomFields: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  if (!input) {
    return currentCustomFields;
  }

  const fieldDefinitions = await loadCustomFieldDefinitions(client, tenantId, entityKey);
  const fieldByKey = new Map(fieldDefinitions.map((field) => [field.fieldKey, field]));
  const optionSetCache = new Map<string, Set<string>>();
  const nextCustomFields = { ...currentCustomFields };

  for (const [fieldKey, rawValue] of Object.entries(input)) {
    const fieldDefinition = fieldByKey.get(fieldKey);
    if (!fieldDefinition) {
      continue;
    }

    const result = await sanitizeCustomFieldValue(client, tenantId, fieldDefinition, rawValue, optionSetCache);
    if (result.action === "clear") {
      delete nextCustomFields[fieldKey];
    } else {
      nextCustomFields[fieldKey] = result.value;
    }
  }

  return nextCustomFields;
}
