import type { CrmFieldDefinition, CrmOptionValueSummary } from "@crm/types";
import { formatDateTimeInputValue } from "@/lib/crm";

export interface CrmCustomFieldOptionsCarrier {
  fieldDefinitions: CrmFieldDefinition[];
  customFieldOptions: Record<string, CrmOptionValueSummary[]>;
}

export type CrmCustomFieldFormValue = string | string[];

export function getActiveCustomFieldDefinitions(options: CrmCustomFieldOptionsCarrier | null): CrmFieldDefinition[] {
  return options?.fieldDefinitions.filter((field) => !field.isSystemField && field.isActive) ?? [];
}

export function getCustomFieldOptions(
  options: CrmCustomFieldOptionsCarrier | null,
  field: Pick<CrmFieldDefinition, "optionSetKey">
): CrmOptionValueSummary[] {
  if (!field.optionSetKey) {
    return [];
  }

  return options?.customFieldOptions[field.optionSetKey] ?? [];
}

export function normalizeCustomFieldFormValue(
  field: Pick<CrmFieldDefinition, "dataType">,
  rawValue: unknown
): CrmCustomFieldFormValue {
  if (field.dataType === "multiselect") {
    return Array.isArray(rawValue) ? rawValue.filter((value): value is string => typeof value === "string" && value.length > 0) : [];
  }

  if (field.dataType === "boolean") {
    if (rawValue === true) {
      return "true";
    }
    if (rawValue === false) {
      return "false";
    }
    return "";
  }

  if (field.dataType === "datetime") {
    return typeof rawValue === "string" ? formatDateTimeInputValue(rawValue) : "";
  }

  if (typeof rawValue === "number") {
    return String(rawValue);
  }

  return typeof rawValue === "string" ? rawValue : "";
}

export function serializeCustomFieldFormValue(
  field: Pick<CrmFieldDefinition, "dataType">,
  rawValue: CrmCustomFieldFormValue
): unknown {
  if (field.dataType === "multiselect") {
    return Array.isArray(rawValue) ? rawValue : [];
  }

  if (Array.isArray(rawValue)) {
    return null;
  }

  if (field.dataType === "boolean") {
    if (rawValue === "true") {
      return true;
    }
    if (rawValue === "false") {
      return false;
    }
    return null;
  }

  const trimmedValue = rawValue.trim();
  if (trimmedValue.length === 0) {
    return null;
  }

  if (field.dataType === "datetime") {
    const normalizedDate = new Date(trimmedValue);
    return Number.isNaN(normalizedDate.getTime()) ? null : normalizedDate.toISOString();
  }

  return trimmedValue;
}

export function getCustomFieldOptionLabels(
  options: CrmCustomFieldOptionsCarrier | null,
  field: Pick<CrmFieldDefinition, "dataType" | "optionSetKey">,
  rawValue: unknown
): string[] {
  const optionLabelByKey = new Map(getCustomFieldOptions(options, field).map((option) => [option.key, option.label]));

  if (field.dataType === "multiselect") {
    return Array.isArray(rawValue)
      ? rawValue
          .filter((value): value is string => typeof value === "string" && value.length > 0)
          .map((value) => optionLabelByKey.get(value) ?? value)
      : [];
  }

  if (typeof rawValue !== "string" || rawValue.length === 0) {
    return [];
  }

  return [optionLabelByKey.get(rawValue) ?? rawValue];
}

export function hasCustomFieldValue(value: unknown) {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

export function formatFallbackCustomFieldLabel(fieldKey: string) {
  return fieldKey
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
