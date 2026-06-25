import type { ConfigurationValidationIssue } from "./configuration.js";

// ---------------------------------------------------------------------------
// Configuration definitions registry
//
// A generic, extensible store for the configuration object *types* that are
// defined as data and governed by the configuration engine (versioning,
// validation, publish, apply). Each definition is a tenant-scoped, typed JSON
// document. This is how modules, objects, page layouts, business-process flows,
// approval matrices, notification rules, and dashboards become configurable
// without code changes.
//
// NOTE: this layer makes these types *definable and governed*. Runtime
// enforcement/rendering for the newer types (dynamic forms, BPF gating, live
// dashboards, notification dispatch) is layered on top in later phases.
// ---------------------------------------------------------------------------

export const configurationDefinitionTypes = [
  "module_meta",
  "object",
  "page_layout",
  "business_process_flow",
  "approval_matrix",
  "notification_rule",
  "dashboard",
  "persona",
  "access_policy"
] as const;
export type ConfigurationDefinitionType = (typeof configurationDefinitionTypes)[number];

export const ownershipModels = ["user", "team", "territory", "account", "system"] as const;
export type OwnershipModel = (typeof ownershipModels)[number];

export const notificationChannels = ["in_app", "email", "sms", "whatsapp", "webhook"] as const;
export type NotificationChannel = (typeof notificationChannels)[number];

export const notificationFrequencies = ["immediate", "hourly", "daily", "weekly"] as const;
export type NotificationFrequency = (typeof notificationFrequencies)[number];

export const approvalModes = ["sequential", "parallel"] as const;
export type ApprovalMode = (typeof approvalModes)[number];

// ---- Per-type payloads (the `definition` JSON body of each registry row) ----

export interface ModuleMetaPayload {
  moduleCode: string;
  icon?: string | null;
  navGroup?: string | null;
  displayOrder?: number;
  relatedObjects?: string[];
  defaultPermissions?: string[];
}

export interface ObjectDefinitionPayload {
  objectCode: string;
  singularLabel: string;
  pluralLabel: string;
  module: string;
  ownershipModel: OwnershipModel;
  auditEnabled: boolean;
  activityTimelineEnabled: boolean;
  softDeleteEnabled: boolean;
  importExportEnabled: boolean;
}

export interface PageLayoutSection {
  id: string;
  title: string;
  fields: string[];
}

export interface PageLayoutDefinitionPayload {
  object: string;
  role?: string | null;
  sections: PageLayoutSection[];
  readOnlyFields?: string[];
  hiddenFields?: string[];
  requiredFields?: string[];
  conditionalVisibility?: Array<{ field: string; when: string }>;
}

export interface BpfStage {
  key: string;
  order: number;
  label?: string;
  /** Marks the single entry stage of the flow. */
  isEntry?: boolean;
  /** Closed/terminal stage — records here are locked unless overridden. */
  isTerminal?: boolean;
  requiredFields?: string[];
  entryCriteria?: string[];
  exitCriteria?: string[];
  /** SLA + aging, all in hours; runtime computes warnings/breaches/aging. */
  slaHours?: number;
  slaWarningHours?: number;
  agingThresholdHours?: number;
  requiresApprovalToEnter?: boolean;
  /** Keys referencing notification_rule / approval_matrix definitions, etc. */
  notifications?: string[];
  tasks?: string[];
  approvals?: string[];
  aiTriggers?: string[];
  automations?: string[];
}

export interface BpfTransition {
  from: string;
  to: string;
}

export interface BusinessProcessFlowPayload {
  object: string;
  stages: BpfStage[];
  /** Allow-list of permitted transitions. */
  transitions?: BpfTransition[];
  /** Explicitly blocked transitions (override / documentation of denials). */
  blockedTransitions?: BpfTransition[];
  /** When true, any transition not in `transitions` is denied (default-deny). */
  defaultDenyTransitions?: boolean;
  auditStageChanges?: boolean;
  allowBackwardMovement?: boolean;
  backwardMovementRequiresReason?: boolean;
  managerOverrideAllowed?: boolean;
}

export interface ApprovalMatrixPayload {
  approvalType: string;
  object: string;
  mode: ApprovalMode;
  thresholdRules?: Array<{ field: string; operator: string; value: unknown }>;
  approvers: Array<{ kind: "role" | "user" | "team"; ref: string; order?: number }>;
  slaHours?: number;
  escalation?: { afterHours: number; to: string } | null;
}

export interface NotificationRulePayload {
  event: string;
  audience: string;
  channel: NotificationChannel;
  template: string;
  frequency: NotificationFrequency;
  escalation?: { afterHours: number; to: string } | null;
  suppressionRules?: string[];
}

export interface DashboardWidgetConfig {
  key: string;
  label: string;
  metricKey: string;
  type?: string;
}

export interface DashboardDefinitionPayload {
  dashboardKey: string;
  role?: string | null;
  widgets: DashboardWidgetConfig[];
  filters?: string[];
  drilldowns?: string[];
  aiSummaryEnabled?: boolean;
}

export interface PersonaPermissionModelPayload {
  objectPermissions: Record<string, string[]>;
  fieldPermissions: Record<string, Record<string, "visible" | "hidden" | "read_only" | "editable" | "masked">>;
  recordScopes: string[];
  specialActions: string[];
}

export interface PersonaDefinitionPayload extends PersonaPermissionModelPayload {
  personaKey: string;
  roleTemplateSlug: string;
  label: string;
  description: string;
  department: string;
  audience: "internal" | "partner" | "customer" | "executive";
  dashboards: string[];
  securityNotes: string[];
}

export interface AccessPolicyDefinitionPayload extends PersonaPermissionModelPayload {
  policyKey: string;
  personas: string[];
  sensitiveDataRules: string[];
}

// ---- Generic registry row + API contracts ----

export interface ConfigurationDefinition {
  definitionType: ConfigurationDefinitionType;
  definitionKey: string;
  name: string;
  description: string | null;
  isActive: boolean;
  definition: Record<string, unknown>;
}

export interface ConfigurationDefinitionRecord extends ConfigurationDefinition {
  id: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertConfigurationDefinitionRequestBody {
  name: string;
  description?: string | null;
  isActive?: boolean;
  definition: Record<string, unknown>;
}

export interface ConfigurationDefinitionResponse {
  definition: ConfigurationDefinitionRecord;
}

export interface ConfigurationDefinitionsResponse {
  definitions: ConfigurationDefinitionRecord[];
}

// ---- Pure validation (Category 13 for the new definition types) ----

const requiredPayloadKeys: Record<ConfigurationDefinitionType, string[]> = {
  module_meta: ["moduleCode"],
  object: ["objectCode", "singularLabel", "pluralLabel", "module", "ownershipModel"],
  page_layout: ["object", "sections"],
  business_process_flow: ["object", "stages"],
  approval_matrix: ["approvalType", "object", "mode", "approvers"],
  notification_rule: ["event", "audience", "channel", "template", "frequency"],
  dashboard: ["dashboardKey", "widgets"],
  persona: ["personaKey", "roleTemplateSlug", "objectPermissions", "fieldPermissions", "recordScopes", "specialActions"],
  access_policy: ["policyKey", "personas", "objectPermissions", "fieldPermissions", "recordScopes", "specialActions"]
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAllowedString<T extends string>(value: unknown, allowedValues: readonly T[]): value is T {
  return typeof value === "string" && (allowedValues as readonly string[]).includes(value);
}

function isConfigurationDefinitionType(value: unknown): value is ConfigurationDefinitionType {
  return isAllowedString(value, configurationDefinitionTypes);
}

function has(definition: Record<string, unknown>, key: string): boolean {
  const value = definition[key];
  return value !== undefined && value !== null && !(typeof value === "string" && value.trim() === "");
}

function pushIssue(
  issues: ConfigurationValidationIssue[],
  code: string,
  severity: ConfigurationValidationIssue["severity"],
  path: string,
  message: string
) {
  issues.push({ code, severity, path, message });
}

/**
 * Validate a single configuration definition for type-completeness and basic
 * internal integrity. Pure and unit-testable. Returns structured issues.
 */
export function validateConfigurationDefinition(def: ConfigurationDefinition): ConfigurationValidationIssue[] {
  const issues: ConfigurationValidationIssue[] = [];
  const path = `definitions.${String(def.definitionType)}.${String(def.definitionKey)}`;

  if (!isConfigurationDefinitionType(def.definitionType)) {
    pushIssue(issues, "UNKNOWN_DEFINITION_TYPE", "error", path, `Unknown definition type "${String(def.definitionType)}".`);
    return issues;
  }

  if (typeof def.definitionKey !== "string" || def.definitionKey.trim().length === 0) {
    pushIssue(issues, "DEFINITION_MISSING_KEY", "error", path, `${def.definitionType} definition is missing a definitionKey.`);
  }
  if (typeof def.name !== "string" || def.name.trim().length === 0) {
    pushIssue(issues, "DEFINITION_MISSING_NAME", "error", path, `${def.definitionType} "${def.definitionKey}" is missing a name.`);
  }
  if (!isRecord(def.definition)) {
    pushIssue(issues, "DEFINITION_INVALID_PAYLOAD", "error", path, `${def.definitionType} "${def.definitionKey}" must have an object definition payload.`);
    return issues;
  }

  for (const key of requiredPayloadKeys[def.definitionType]) {
    if (!has(def.definition, key)) {
      pushIssue(issues, "DEFINITION_MISSING_FIELD", "error", path, `${def.definitionType} "${def.definitionKey}" is missing required field "${key}".`);
    }
  }

  // Light per-type internal checks.
  if (def.definitionType === "object" && has(def.definition, "ownershipModel")) {
    if (!isAllowedString(def.definition.ownershipModel, ownershipModels)) {
      pushIssue(
        issues,
        "OBJECT_INVALID_OWNERSHIP_MODEL",
        "error",
        path,
        `Object "${def.definitionKey}" uses unsupported ownership model "${String(def.definition.ownershipModel)}".`
      );
    }
  }

  if (def.definitionType === "page_layout") {
    const sections = def.definition.sections;
    if (!Array.isArray(sections)) {
      pushIssue(issues, "PAGE_LAYOUT_INVALID_SECTIONS", "error", path, `Page layout "${def.definitionKey}" must define sections as an array.`);
    } else if (sections.length === 0) {
      pushIssue(issues, "PAGE_LAYOUT_NO_SECTIONS", "error", path, `Page layout "${def.definitionKey}" has no sections.`);
    }
  }

  if (def.definitionType === "business_process_flow") {
    const stages = def.definition.stages;
    if (!Array.isArray(stages)) {
      pushIssue(issues, "BPF_INVALID_STAGES", "error", path, `BPF "${def.definitionKey}" must define stages as an array.`);
    } else {
      if (stages.length === 0) {
        pushIssue(issues, "BPF_NO_STAGES", "error", path, `BPF "${def.definitionKey}" has no stages.`);
      }
      const typedStages = stages.filter(isRecord) as unknown as BpfStage[];
      const orders = typedStages.map((stage) => stage.order);
      if (new Set(orders).size !== orders.length) {
        pushIssue(issues, "BPF_DUPLICATE_STAGE_ORDER", "error", path, `BPF "${def.definitionKey}" has duplicate stage orders.`);
      }
      const stageKeys = new Set(typedStages.map((stage) => stage.key));
      const transitions = def.definition.transitions;
      if (transitions !== undefined && !Array.isArray(transitions)) {
        pushIssue(issues, "BPF_INVALID_TRANSITIONS", "error", path, `BPF "${def.definitionKey}" transitions must be an array.`);
      }
      for (const transition of Array.isArray(transitions) ? transitions : []) {
        if (!isRecord(transition)) {
          pushIssue(issues, "BPF_INVALID_TRANSITION", "error", path, `BPF "${def.definitionKey}" has a malformed transition.`);
          continue;
        }
        const from = transition.from;
        const to = transition.to;
        if (typeof from !== "string" || typeof to !== "string" || !stageKeys.has(from) || !stageKeys.has(to)) {
          pushIssue(
            issues,
            "BPF_INVALID_TRANSITION",
            "error",
            path,
            `BPF "${def.definitionKey}" has a transition referencing an unknown stage (${String(from)} -> ${String(to)}).`
          );
        }
      }

      // Unique stage keys.
      if (new Set(typedStages.map((stage) => stage.key)).size !== typedStages.length) {
        pushIssue(issues, "BPF_DUPLICATE_STAGE_KEY", "error", path, `BPF "${def.definitionKey}" has duplicate stage keys.`);
      }
      // At most one entry stage.
      if (typedStages.filter((stage) => stage.isEntry === true).length > 1) {
        pushIssue(issues, "BPF_MULTIPLE_ENTRY_STAGES", "error", path, `BPF "${def.definitionKey}" defines more than one entry stage.`);
      }
      // Per-stage: terminal stages cannot have outgoing transitions; SLA/aging non-negative.
      const allowedTransitions = (Array.isArray(transitions) ? transitions : []).filter(isRecord);
      for (const stage of typedStages) {
        if (stage.isTerminal === true && allowedTransitions.some((entry) => entry.from === stage.key)) {
          pushIssue(issues, "BPF_TERMINAL_STAGE_HAS_TRANSITION", "error", path, `BPF "${def.definitionKey}" terminal stage "${stage.key}" must not have outgoing transitions.`);
        }
        if (typeof stage.slaHours === "number" && stage.slaHours < 0) {
          pushIssue(issues, "BPF_NEGATIVE_SLA", "error", path, `BPF "${def.definitionKey}" stage "${stage.key}" has a negative SLA.`);
        }
        if (typeof stage.agingThresholdHours === "number" && stage.agingThresholdHours < 0) {
          pushIssue(issues, "BPF_NEGATIVE_AGING", "error", path, `BPF "${def.definitionKey}" stage "${stage.key}" has a negative aging threshold.`);
        }
      }
      // Blocked transitions must reference known stages.
      const blockedTransitions = def.definition.blockedTransitions;
      for (const transition of Array.isArray(blockedTransitions) ? blockedTransitions : []) {
        if (
          !isRecord(transition) ||
          typeof transition.from !== "string" ||
          typeof transition.to !== "string" ||
          !stageKeys.has(transition.from) ||
          !stageKeys.has(transition.to)
        ) {
          pushIssue(issues, "BPF_INVALID_BLOCKED_TRANSITION", "error", path, `BPF "${def.definitionKey}" has a blockedTransition referencing an unknown stage.`);
        }
      }
    }
  }

  if (def.definitionType === "approval_matrix") {
    if (has(def.definition, "mode") && !isAllowedString(def.definition.mode, approvalModes)) {
      pushIssue(issues, "APPROVAL_INVALID_MODE", "error", path, `Approval matrix "${def.definitionKey}" uses unsupported mode "${String(def.definition.mode)}".`);
    }
    const approvers = def.definition.approvers;
    if (!Array.isArray(approvers)) {
      pushIssue(issues, "APPROVAL_INVALID_APPROVERS", "error", path, `Approval matrix "${def.definitionKey}" must define approvers as an array.`);
    } else if (approvers.length === 0) {
      pushIssue(issues, "APPROVAL_NO_APPROVERS", "error", path, `Approval matrix "${def.definitionKey}" has no approvers.`);
    }
  }

  if (def.definitionType === "notification_rule") {
    if (has(def.definition, "channel") && !isAllowedString(def.definition.channel, notificationChannels)) {
      pushIssue(issues, "NOTIFICATION_INVALID_CHANNEL", "error", path, `Notification rule "${def.definitionKey}" uses unsupported channel "${String(def.definition.channel)}".`);
    }
    if (has(def.definition, "frequency") && !isAllowedString(def.definition.frequency, notificationFrequencies)) {
      pushIssue(
        issues,
        "NOTIFICATION_INVALID_FREQUENCY",
        "error",
        path,
        `Notification rule "${def.definitionKey}" uses unsupported frequency "${String(def.definition.frequency)}".`
      );
    }
  }

  if (def.definitionType === "dashboard") {
    const widgets = def.definition.widgets;
    if (!Array.isArray(widgets)) {
      pushIssue(issues, "DASHBOARD_INVALID_WIDGETS", "error", path, `Dashboard "${def.definitionKey}" must define widgets as an array.`);
    } else if (widgets.length === 0) {
      pushIssue(issues, "DASHBOARD_NO_WIDGETS", "warning", path, `Dashboard "${def.definitionKey}" has no widgets.`);
    }
  }

  if (def.definitionType === "persona") {
    const objectPermissions = def.definition.objectPermissions;
    const fieldPermissions = def.definition.fieldPermissions;
    const recordScopes = def.definition.recordScopes;
    const specialActions = def.definition.specialActions;
    if (!isRecord(objectPermissions)) {
      pushIssue(issues, "PERSONA_INVALID_OBJECT_PERMISSIONS", "error", path, `Persona "${def.definitionKey}" must define objectPermissions as an object.`);
    }
    if (!isRecord(fieldPermissions)) {
      pushIssue(issues, "PERSONA_INVALID_FIELD_PERMISSIONS", "error", path, `Persona "${def.definitionKey}" must define fieldPermissions as an object.`);
    }
    if (!Array.isArray(recordScopes) || recordScopes.length === 0) {
      pushIssue(issues, "PERSONA_INVALID_RECORD_SCOPES", "error", path, `Persona "${def.definitionKey}" must define at least one record scope.`);
    }
    if (!Array.isArray(specialActions)) {
      pushIssue(issues, "PERSONA_INVALID_SPECIAL_ACTIONS", "error", path, `Persona "${def.definitionKey}" specialActions must be an array.`);
    }
  }

  if (def.definitionType === "access_policy") {
    const personas = def.definition.personas;
    const objectPermissions = def.definition.objectPermissions;
    const fieldPermissions = def.definition.fieldPermissions;
    const recordScopes = def.definition.recordScopes;
    const specialActions = def.definition.specialActions;
    if (!Array.isArray(personas) || personas.length === 0) {
      pushIssue(issues, "ACCESS_POLICY_NO_PERSONAS", "error", path, `Access policy "${def.definitionKey}" must reference at least one persona.`);
    }
    if (!isRecord(objectPermissions)) {
      pushIssue(issues, "ACCESS_POLICY_INVALID_OBJECT_PERMISSIONS", "error", path, `Access policy "${def.definitionKey}" must define objectPermissions as an object.`);
    }
    if (!isRecord(fieldPermissions)) {
      pushIssue(issues, "ACCESS_POLICY_INVALID_FIELD_PERMISSIONS", "error", path, `Access policy "${def.definitionKey}" must define fieldPermissions as an object.`);
    }
    if (!Array.isArray(recordScopes) || recordScopes.length === 0) {
      pushIssue(issues, "ACCESS_POLICY_INVALID_RECORD_SCOPES", "error", path, `Access policy "${def.definitionKey}" must define record scopes.`);
    }
    if (!Array.isArray(specialActions)) {
      pushIssue(issues, "ACCESS_POLICY_INVALID_SPECIAL_ACTIONS", "error", path, `Access policy "${def.definitionKey}" specialActions must be an array.`);
    }
  }

  return issues;
}

/** Validate a list of definitions, including duplicate-key detection per type. */
export function validateConfigurationDefinitions(definitions: ConfigurationDefinition[]): ConfigurationValidationIssue[] {
  const issues: ConfigurationValidationIssue[] = [];
  const seen = new Set<string>();
  for (const def of definitions) {
    const composite = `${def.definitionType}:${def.definitionKey}`;
    if (seen.has(composite)) {
      issues.push({
        code: "DUPLICATE_DEFINITION_KEY",
        severity: "error",
        path: `definitions.${def.definitionType}.${def.definitionKey}`,
        message: `Duplicate ${def.definitionType} definition "${def.definitionKey}".`
      });
    }
    seen.add(composite);
    issues.push(...validateConfigurationDefinition(def));
  }
  return issues;
}
