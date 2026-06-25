import type {
  CustomFieldDefinition,
  CustomFormLayoutDefinition,
  TenantCoreSettings,
  TenantModuleState,
  TenantOptionSet,
  TenantTerminologyEntry,
  TenantThemeSettings
} from "./tenant-config.js";

// ---------------------------------------------------------------------------
// Configuration snapshot
//
// A self-contained, portable picture of a tenant's configuration. It is the
// unit of export/import and of every saved configuration version. The schema
// version lets future imports detect and migrate older snapshots.
// ---------------------------------------------------------------------------

export const CONFIGURATION_SNAPSHOT_SCHEMA_VERSION = 1;

export interface ConfigurationSnapshot {
  schemaVersion: number;
  exportedAt?: string;
  settings: TenantCoreSettings;
  theme: TenantThemeSettings;
  modules: TenantModuleState[];
  terminology: TenantTerminologyEntry[];
  optionSets: TenantOptionSet[];
  customFields: CustomFieldDefinition[];
  formLayouts: CustomFormLayoutDefinition[];
}

export interface ConfigurationSnapshotSummary {
  moduleCount: number;
  enabledModuleCount: number;
  optionSetCount: number;
  customFieldCount: number;
  formLayoutCount: number;
}

export function summarizeConfigurationSnapshot(snapshot: ConfigurationSnapshot): ConfigurationSnapshotSummary {
  const modules = snapshot.modules ?? [];
  return {
    moduleCount: modules.length,
    enabledModuleCount: modules.filter((module) => module.enabled).length,
    optionSetCount: (snapshot.optionSets ?? []).length,
    customFieldCount: (snapshot.customFields ?? []).length,
    formLayoutCount: (snapshot.formLayouts ?? []).length
  };
}

// ---------------------------------------------------------------------------
// Configurable field attributes (Category 3)
//
// The richer, future-configurable field behaviour is modelled as a typed
// contract that lives inside the existing custom_field_definitions.settings
// JSONB column, so no destructive schema change is required to support it.
// ---------------------------------------------------------------------------

export const customFieldMaskingRules = ["none", "partial", "full", "email"] as const;
export type CustomFieldMaskingRule = (typeof customFieldMaskingRules)[number];

export interface CustomFieldSettings {
  helpText: string | null;
  defaultValue: string | null;
  isSearchable: boolean;
  isFilterable: boolean;
  isReportable: boolean;
  isAiUsable: boolean;
  isSensitive: boolean;
  maskingRule: CustomFieldMaskingRule;
  /** Optional declarative rules; intentionally open-ended for future engines. */
  visibilityRule: Record<string, unknown> | null;
  editabilityRule: Record<string, unknown> | null;
}

export const defaultCustomFieldSettings: CustomFieldSettings = {
  helpText: null,
  defaultValue: null,
  isSearchable: false,
  isFilterable: false,
  isReportable: false,
  isAiUsable: false,
  isSensitive: false,
  maskingRule: "none",
  visibilityRule: null,
  editabilityRule: null
};

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asNullableRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** Coerce an untyped settings blob into the typed field-settings contract. */
export function normalizeCustomFieldSettings(raw: Record<string, unknown> | null | undefined): CustomFieldSettings {
  const value = raw ?? {};
  const maskingCandidate = value.maskingRule;
  const maskingRule = customFieldMaskingRules.includes(maskingCandidate as CustomFieldMaskingRule)
    ? (maskingCandidate as CustomFieldMaskingRule)
    : defaultCustomFieldSettings.maskingRule;

  return {
    helpText: asNullableString(value.helpText),
    defaultValue: asNullableString(value.defaultValue),
    isSearchable: asBoolean(value.isSearchable, defaultCustomFieldSettings.isSearchable),
    isFilterable: asBoolean(value.isFilterable, defaultCustomFieldSettings.isFilterable),
    isReportable: asBoolean(value.isReportable, defaultCustomFieldSettings.isReportable),
    isAiUsable: asBoolean(value.isAiUsable, defaultCustomFieldSettings.isAiUsable),
    isSensitive: asBoolean(value.isSensitive, defaultCustomFieldSettings.isSensitive),
    maskingRule,
    visibilityRule: asNullableRecord(value.visibilityRule),
    editabilityRule: asNullableRecord(value.editabilityRule)
  };
}

// ---------------------------------------------------------------------------
// Configuration versioning (Category 11)
// ---------------------------------------------------------------------------

export const configurationVersionStatuses = ["draft", "published", "archived"] as const;
export type ConfigurationVersionStatus = (typeof configurationVersionStatuses)[number];

export interface ConfigurationVersion {
  id: string;
  tenantId: string;
  versionNumber: number;
  status: ConfigurationVersionStatus;
  changeReason: string | null;
  snapshot: ConfigurationSnapshot;
  validationIssues: ConfigurationValidationIssue[];
  effectiveDate: string | null;
  createdBy: string | null;
  publishedBy: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface ConfigurationVersionSummary {
  id: string;
  versionNumber: number;
  status: ConfigurationVersionStatus;
  changeReason: string | null;
  effectiveDate: string | null;
  createdBy: string | null;
  publishedBy: string | null;
  createdAt: string;
  publishedAt: string | null;
}

const allowedVersionTransitions: Record<ConfigurationVersionStatus, ConfigurationVersionStatus[]> = {
  draft: ["published", "archived"],
  published: ["archived"],
  archived: []
};

/** Pure state machine guarding configuration version lifecycle transitions. */
export function canTransitionConfigurationVersion(
  from: ConfigurationVersionStatus,
  to: ConfigurationVersionStatus
): boolean {
  return allowedVersionTransitions[from].includes(to);
}

/** Next monotonic version number given the existing version numbers. */
export function nextConfigurationVersionNumber(existing: number[]): number {
  return existing.reduce((max, value) => (value > max ? value : max), 0) + 1;
}

// ---------------------------------------------------------------------------
// Configuration safety / validation (Category 13)
// ---------------------------------------------------------------------------

export type ConfigurationValidationSeverity = "error" | "warning";

export interface ConfigurationValidationIssue {
  code: string;
  severity: ConfigurationValidationSeverity;
  path: string;
  message: string;
}

export interface ConfigurationValidationResult {
  valid: boolean;
  errorCount: number;
  warningCount: number;
  issues: ConfigurationValidationIssue[];
}

const optionBackedFieldTypes = new Set(["select", "multiselect"]);

/**
 * Validate a configuration snapshot for referential integrity and
 * completeness. Pure and side-effect free so it can be unit-tested and reused
 * for export, import (dependency errors), and publish gating.
 */
export function validateConfigurationSnapshot(snapshot: ConfigurationSnapshot): ConfigurationValidationResult {
  const issues: ConfigurationValidationIssue[] = [];
  const optionSets = snapshot.optionSets ?? [];
  const customFields = snapshot.customFields ?? [];
  const formLayouts = snapshot.formLayouts ?? [];
  const modules = snapshot.modules ?? [];

  if (typeof snapshot.schemaVersion !== "number") {
    issues.push({
      code: "MISSING_SCHEMA_VERSION",
      severity: "error",
      path: "schemaVersion",
      message: "Snapshot is missing a numeric schemaVersion."
    });
  } else if (snapshot.schemaVersion > CONFIGURATION_SNAPSHOT_SCHEMA_VERSION) {
    issues.push({
      code: "UNSUPPORTED_SCHEMA_VERSION",
      severity: "error",
      path: "schemaVersion",
      message: `Snapshot schemaVersion ${snapshot.schemaVersion} is newer than supported (${CONFIGURATION_SNAPSHOT_SCHEMA_VERSION}).`
    });
  }

  const optionSetKeys = new Set(optionSets.map((set) => set.setKey));
  const moduleKeys = new Set(modules.map((module) => module.moduleKey));

  // Option sets: default uniqueness and non-empty active values.
  for (const set of optionSets) {
    const values = set.values ?? [];
    const activeValues = values.filter((value) => value.isActive);
    if (activeValues.length === 0) {
      issues.push({
        code: "OPTION_SET_NO_ACTIVE_VALUES",
        severity: set.kind === "pipeline" ? "error" : "warning",
        path: `optionSets.${set.setKey}`,
        message: `Option set "${set.setKey}" has no active values.`
      });
    }
    if (values.filter((value) => value.isDefault).length > 1) {
      issues.push({
        code: "MULTIPLE_DEFAULT_VALUES",
        severity: "error",
        path: `optionSets.${set.setKey}`,
        message: `Option set "${set.setKey}" defines more than one default value.`
      });
    }
  }

  // Custom fields: unique keys per entity, option-set references, masking sanity.
  const seenFieldKeys = new Set<string>();
  for (const field of customFields) {
    const composite = `${field.entityKey}.${field.fieldKey}`;
    if (seenFieldKeys.has(composite)) {
      issues.push({
        code: "DUPLICATE_FIELD_KEY",
        severity: "error",
        path: `customFields.${composite}`,
        message: `Duplicate field "${field.fieldKey}" on entity "${field.entityKey}".`
      });
    }
    seenFieldKeys.add(composite);

    if (optionBackedFieldTypes.has(field.dataType)) {
      if (!field.optionSetKey) {
        issues.push({
          code: "SELECT_WITHOUT_OPTION_SET",
          severity: "error",
          path: `customFields.${composite}`,
          message: `Field "${field.fieldKey}" is a ${field.dataType} but has no option set.`
        });
      } else if (!optionSetKeys.has(field.optionSetKey)) {
        issues.push({
          code: "MISSING_OPTION_SET_REFERENCE",
          severity: "error",
          path: `customFields.${composite}`,
          message: `Field "${field.fieldKey}" references unknown option set "${field.optionSetKey}".`
        });
      }
    }

    const settings = normalizeCustomFieldSettings(field.settings);
    if (settings.maskingRule !== "none" && !settings.isSensitive) {
      issues.push({
        code: "MASKING_WITHOUT_SENSITIVE",
        severity: "warning",
        path: `customFields.${composite}`,
        message: `Field "${field.fieldKey}" defines a masking rule but is not marked sensitive.`
      });
    }
  }

  // Form layouts: every referenced custom field must exist on the same entity.
  const fieldKeysByEntity = new Map<string, Set<string>>();
  for (const field of customFields) {
    const set = fieldKeysByEntity.get(field.entityKey) ?? new Set<string>();
    set.add(field.fieldKey);
    fieldKeysByEntity.set(field.entityKey, set);
  }
  for (const layout of formLayouts) {
    const entityCustomFields = fieldKeysByEntity.get(layout.entityKey) ?? new Set<string>();
    for (const section of layout.layoutSchema?.sections ?? []) {
      for (const fieldKey of section.fields ?? []) {
        // Only custom-field references (prefixed "custom.") are validated here;
        // system fields are owned by code and always present.
        if (fieldKey.startsWith("custom.")) {
          const bareKey = fieldKey.slice("custom.".length);
          if (!entityCustomFields.has(bareKey)) {
            issues.push({
              code: "LAYOUT_UNKNOWN_FIELD",
              severity: "error",
              path: `formLayouts.${layout.layoutKey}.${section.id}`,
              message: `Layout "${layout.layoutKey}" references unknown custom field "${bareKey}" on entity "${layout.entityKey}".`
            });
          }
        }
      }
    }
  }

  // Terminology pointing at modules that are not present.
  for (const entry of snapshot.terminology ?? []) {
    if (!moduleKeys.has(entry.moduleKey)) {
      issues.push({
        code: "UNKNOWN_TERMINOLOGY_MODULE",
        severity: "warning",
        path: `terminology.${entry.moduleKey}`,
        message: `Terminology references module "${entry.moduleKey}" which is not in the snapshot.`
      });
    }
  }

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.length - errorCount;
  return { valid: errorCount === 0, errorCount, warningCount, issues };
}

// ---------------------------------------------------------------------------
// API request/response contracts
// ---------------------------------------------------------------------------

export interface SaveConfigurationDraftRequestBody {
  changeReason?: string;
  snapshot?: ConfigurationSnapshot;
}

export interface ImportConfigurationRequestBody {
  snapshot: ConfigurationSnapshot;
  changeReason?: string;
  dryRun?: boolean;
}

export interface ConfigurationExportResponse {
  snapshot: ConfigurationSnapshot;
  summary: ConfigurationSnapshotSummary;
  validation: ConfigurationValidationResult;
}

export interface ConfigurationVersionResponse {
  version: ConfigurationVersion;
}

export interface ConfigurationVersionsResponse {
  versions: ConfigurationVersionSummary[];
}

export interface ConfigurationValidationResponse {
  validation: ConfigurationValidationResult;
  summary: ConfigurationSnapshotSummary;
}

// ---------------------------------------------------------------------------
// Applying a published snapshot onto live configuration tables
//
// `planConfigurationApply` is a pure diff of a target snapshot against the
// current live snapshot. It powers the dry-run preview and is unit-testable.
// Apply is upsert-only: it never emits delete operations, so live config is
// only ever created or updated, never removed.
// ---------------------------------------------------------------------------

export const configurationApplySections = [
  "settings",
  "theme",
  "modules",
  "terminology",
  "optionSets",
  "customFields"
] as const;
export type ConfigurationApplySection = (typeof configurationApplySections)[number];

export type ConfigurationApplyAction = "create" | "update" | "noop";

export interface ConfigurationApplyOperation {
  section: ConfigurationApplySection;
  key: string;
  action: ConfigurationApplyAction;
}

export interface ConfigurationApplyPlan {
  operations: ConfigurationApplyOperation[];
  createCount: number;
  updateCount: number;
  noopCount: number;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function diffAction(existing: unknown, next: unknown): ConfigurationApplyAction {
  if (existing === undefined) {
    return "create";
  }
  return sameJson(existing, next) ? "noop" : "update";
}

/** Pure, upsert-only diff of `target` against `current` (no deletes emitted). */
export function planConfigurationApply(
  current: ConfigurationSnapshot,
  target: ConfigurationSnapshot
): ConfigurationApplyPlan {
  const operations: ConfigurationApplyOperation[] = [];

  operations.push({ section: "settings", key: "settings", action: diffAction(current.settings, target.settings) });
  operations.push({ section: "theme", key: "theme", action: diffAction(current.theme, target.theme) });

  const currentModules = new Map((current.modules ?? []).map((module) => [module.moduleKey, module.enabled]));
  for (const module of target.modules ?? []) {
    operations.push({
      section: "modules",
      key: module.moduleKey,
      action: diffAction(currentModules.get(module.moduleKey), module.enabled)
    });
  }

  const currentTerminology = new Map((current.terminology ?? []).map((entry) => [entry.moduleKey, entry]));
  for (const entry of target.terminology ?? []) {
    operations.push({
      section: "terminology",
      key: entry.moduleKey,
      action: diffAction(currentTerminology.get(entry.moduleKey), entry)
    });
  }

  const currentSets = new Map((current.optionSets ?? []).map((set) => [set.setKey, set]));
  for (const set of target.optionSets ?? []) {
    const existing = currentSets.get(set.setKey);
    operations.push({
      section: "optionSets",
      key: set.setKey,
      action: existing === undefined ? "create" : sameJson(existing.values, set.values) && sameJson(existing.name, set.name) ? "noop" : "update"
    });
  }

  const currentFields = new Map((current.customFields ?? []).map((field) => [`${field.entityKey}.${field.fieldKey}`, field]));
  for (const field of target.customFields ?? []) {
    const compositeKey = `${field.entityKey}.${field.fieldKey}`;
    operations.push({
      section: "customFields",
      key: compositeKey,
      action: diffAction(currentFields.get(compositeKey), field)
    });
  }

  return {
    operations,
    createCount: operations.filter((operation) => operation.action === "create").length,
    updateCount: operations.filter((operation) => operation.action === "update").length,
    noopCount: operations.filter((operation) => operation.action === "noop").length
  };
}

export interface ConfigurationApplyResult {
  versionId: string;
  versionNumber: number;
  backupVersionId: string;
  appliedAt: string;
  plan: ConfigurationApplyPlan;
}

export interface ConfigurationApplyPlanResponse {
  plan: ConfigurationApplyPlan;
}
