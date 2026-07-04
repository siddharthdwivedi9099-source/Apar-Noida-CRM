import type {
  AssignmentRulePayload,
  MqlRulePayload,
  ScoringModelPayload,
  SlaPolicyPayload,
  SlaTarget
} from "./configuration-definitions.js";
import { computeSlaStatus, resolveAssignmentRule, type AssignmentResolution, type SlaComputation } from "./lead-assignment.js";
import { evaluateLeadScore, evaluateMql, type LeadScoreResult, type MqlEvaluation } from "./lead-scoring.js";

export interface LeadRuntimeDefinition<TPayload> {
  definitionKey: string;
  name: string;
  payload: TPayload;
}

export interface LeadRuntimeConfiguration {
  scoringModel?: LeadRuntimeDefinition<ScoringModelPayload> | null;
  mqlRule?: LeadRuntimeDefinition<MqlRulePayload> | null;
  assignmentRule?: LeadRuntimeDefinition<AssignmentRulePayload> | null;
  slaPolicy?: LeadRuntimeDefinition<SlaPolicyPayload> | null;
}

export interface LeadRuntimeRecordInput {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  companyName: string;
  email: string | null;
  phone: string | null;
  statusKey: string | null;
  sourceKey: string | null;
  score: number | null;
  ownerId: string | null;
  customFields: Record<string, unknown>;
  activityCount: number;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface LeadRuntimeSlaTargetView extends SlaComputation {
  label: string;
  dispatchRecommended: boolean;
}

export interface LeadRuntimeResponse {
  leadId: string;
  generatedAt: string;
  scoring: {
    modelKey: string;
    modelName: string;
    result: LeadScoreResult;
  } | null;
  mql: {
    ruleKey: string;
    ruleName: string;
    result: MqlEvaluation;
  } | null;
  assignment: {
    ruleKey: string;
    ruleName: string;
    resolution: AssignmentResolution;
    requiresRuntimeSelection: boolean;
    runtimeSelectionReason: string | null;
  } | null;
  sla: {
    policyKey: string;
    policyName: string;
    targets: LeadRuntimeSlaTargetView[];
    escalation: SlaPolicyPayload["escalation"];
    breachDispatchRecommended: boolean;
  } | null;
  configGaps: string[];
  deferredRuntimeActions: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function firstArray(...values: unknown[]): unknown[] | null {
  for (const value of values) {
    if (Array.isArray(value)) {
      return value;
    }
  }
  return null;
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function completionForTarget(targetKey: string, record: Record<string, unknown>): string | null {
  const completions = isRecord(record.slaCompletions) ? record.slaCompletions : {};
  const configuredCompletion = isoOrNull(completions[targetKey]);
  if (configuredCompletion) {
    return configuredCompletion;
  }
  const directCompletion = isoOrNull(record[`${targetKey}CompletedAt`]);
  if (directCompletion) {
    return directCompletion;
  }
  if (targetKey === "first_response") {
    return isoOrNull(record.firstActivityAt);
  }
  if (targetKey === "follow_up") {
    return isoOrNull(record.followUpCompletedAt);
  }
  return null;
}

function startForTarget(target: SlaTarget, record: Record<string, unknown>, fallbackStartIso: string): string {
  return isoOrNull(record[`${target.key}StartedAt`]) ?? fallbackStartIso;
}

export function buildLeadRuntimeRecord(input: LeadRuntimeRecordInput): Record<string, unknown> {
  const metadata = input.metadata ?? {};
  const customFields = input.customFields ?? {};
  const productInterest = firstArray(metadata.productInterest, metadata.productInterests, metadata.products);

  return {
    ...metadata,
    ...customFields,
    id: input.id,
    firstName: input.firstName,
    lastName: input.lastName,
    fullName: input.fullName,
    companyName: input.companyName,
    email: input.email,
    phone: input.phone,
    leadStatus: input.statusKey,
    status: input.statusKey,
    leadSource: input.sourceKey,
    source: input.sourceKey,
    score: input.score,
    aiScore: typeof metadata.aiScore === "number" ? metadata.aiScore : input.score,
    ownerId: input.ownerId,
    activityCount: input.activityCount,
    attemptCount: typeof metadata.attemptCount === "number" ? metadata.attemptCount : input.activityCount,
    firstActivityAt: input.firstActivityAt,
    lastActivityAt: input.lastActivityAt,
    lastActivity: input.lastActivityAt,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    industry: firstString(metadata.industry, metadata.industryKey),
    segment: firstString(metadata.segment, metadata.segmentKey),
    region: firstString(metadata.region, metadata.regionKey),
    designation: firstString(metadata.designation, metadata.title),
    subSource: firstString(metadata.subSource, metadata.subSourceKey),
    consentStatus: firstString(metadata.consentStatus, metadata.consentStatusKey),
    productInterest
  };
}

export function evaluateLeadRuntime(input: {
  leadId: string;
  record: Record<string, unknown>;
  config: LeadRuntimeConfiguration;
  nowIso?: string;
}): LeadRuntimeResponse {
  const nowIso = isoOrNull(input.nowIso) ?? new Date().toISOString();
  const configGaps: string[] = [];
  const deferredRuntimeActions = [
    "Round-robin/load-balanced owner selection still requires runtime state.",
    "SLA warning/breach notification dispatch still belongs to the worker slice.",
    "Persisting score/MQL history is deferred to the lead runtime history slice."
  ];

  let scoring: LeadRuntimeResponse["scoring"] = null;
  if (input.config.scoringModel) {
    scoring = {
      modelKey: input.config.scoringModel.definitionKey,
      modelName: input.config.scoringModel.name,
      result: evaluateLeadScore(input.config.scoringModel.payload, input.record)
    };
  } else {
    configGaps.push("No active lead scoring_model definition is configured.");
  }

  let mql: LeadRuntimeResponse["mql"] = null;
  if (input.config.mqlRule && scoring) {
    mql = {
      ruleKey: input.config.mqlRule.definitionKey,
      ruleName: input.config.mqlRule.name,
      result: evaluateMql(input.config.mqlRule.payload, scoring.result, input.record)
    };
  } else if (!input.config.mqlRule) {
    configGaps.push("No active lead mql_rule definition is configured.");
  } else {
    configGaps.push("MQL evaluation skipped because no scoring result is available.");
  }

  let assignment: LeadRuntimeResponse["assignment"] = null;
  if (input.config.assignmentRule) {
    const resolution = resolveAssignmentRule(input.config.assignmentRule.payload, input.record);
    const requiresRuntimeSelection =
      (resolution.strategy === "round_robin" || resolution.strategy === "load_balanced") && Array.isArray(resolution.pool);
    assignment = {
      ruleKey: input.config.assignmentRule.definitionKey,
      ruleName: input.config.assignmentRule.name,
      resolution,
      requiresRuntimeSelection,
      runtimeSelectionReason: requiresRuntimeSelection
        ? `${resolution.strategy} requires runtime state to pick a concrete assignee from the resolved pool.`
        : null
    };
  } else {
    configGaps.push("No active lead assignment_rule definition is configured.");
  }

  let sla: LeadRuntimeResponse["sla"] = null;
  if (input.config.slaPolicy) {
    const fallbackStartIso = isoOrNull(input.record.createdAt) ?? nowIso;
    const targets = input.config.slaPolicy.payload.targets.map((target) => {
      const completionIso = completionForTarget(target.key, input.record);
      const computation = computeSlaStatus(target, startForTarget(target, input.record, fallbackStartIso), completionIso, nowIso);
      return {
        ...computation,
        label: target.label ?? target.key,
        dispatchRecommended: computation.status === "breached"
      };
    });
    sla = {
      policyKey: input.config.slaPolicy.definitionKey,
      policyName: input.config.slaPolicy.name,
      targets,
      escalation: input.config.slaPolicy.payload.escalation ?? null,
      breachDispatchRecommended: targets.some((target) => target.dispatchRecommended)
    };
  } else {
    configGaps.push("No active lead sla_policy definition is configured.");
  }

  return {
    leadId: input.leadId,
    generatedAt: nowIso,
    scoring,
    mql,
    assignment,
    sla,
    configGaps,
    deferredRuntimeActions
  };
}
