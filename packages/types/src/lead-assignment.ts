import { evaluateScoringCondition } from "./lead-scoring.js";
import type {
  AssignmentRulePayload,
  AssignmentStrategy,
  AssignmentTarget,
  ConfigurationDefinition,
  SlaPolicyPayload,
  SlaTarget
} from "./configuration-definitions.js";

// ---------------------------------------------------------------------------
// Lead assignment + SLA — pure, configurable resolvers.
//
// Routing rules (priority, conditions, strategy, pool/target) and SLA targets
// come from configured assignment_rule / sla_policy definitions. Round-robin /
// load-balanced *selection* among a pool is runtime state and is intentionally
// left to the runtime service; this layer resolves which rule + strategy + pool
// applies. Pure and unit-testable.
// ---------------------------------------------------------------------------

export interface AssignmentResolution {
  ruleKey: string | null;
  strategy: AssignmentStrategy | "fallback";
  target?: AssignmentTarget;
  pool?: string[];
  reason: string;
}

/** Resolve the first matching assignment rule by priority, else the fallback. */
export function resolveAssignmentRule(payload: AssignmentRulePayload, record: Record<string, unknown>): AssignmentResolution {
  const rules = [...(payload.rules ?? [])].sort((a, b) => a.priority - b.priority);
  for (const rule of rules) {
    const conditions = rule.conditions ?? [];
    const matched = conditions.every((condition) => evaluateScoringCondition(record, condition.field, condition.operator, condition.value));
    if (matched) {
      return {
        ruleKey: rule.key,
        strategy: rule.strategy,
        target: rule.assignTo,
        pool: rule.pool,
        reason: `Matched assignment rule "${rule.key}".`
      };
    }
  }
  if (payload.fallback) {
    return { ruleKey: null, strategy: "fallback", target: payload.fallback, reason: "No assignment rule matched; used fallback." };
  }
  return { ruleKey: null, strategy: "fallback", reason: "No assignment rule matched and no fallback configured." };
}

export type SlaStatus = "met" | "ok" | "warning" | "breached";

export interface SlaComputation {
  key: string;
  dueAt: string;
  status: SlaStatus;
  remainingHours: number;
}

/** Compute a single SLA target's due time + status. Pure. */
export function computeSlaStatus(target: SlaTarget, startIso: string, completedIso: string | null, nowIso: string): SlaComputation {
  const start = new Date(startIso).getTime();
  const dueMs = start + target.hours * 3_600_000;
  const dueAt = new Date(dueMs).toISOString();

  if (completedIso) {
    const completed = new Date(completedIso).getTime();
    return { key: target.key, dueAt, status: completed <= dueMs ? "met" : "breached", remainingHours: (dueMs - completed) / 3_600_000 };
  }

  const now = new Date(nowIso).getTime();
  const remainingHours = (dueMs - now) / 3_600_000;
  let status: SlaStatus;
  if (now >= dueMs) {
    status = "breached";
  } else if (typeof target.warningHours === "number" && remainingHours <= target.warningHours) {
    status = "warning";
  } else {
    status = "ok";
  }
  return { key: target.key, dueAt, status, remainingHours };
}

// ---- Default configured lead assignment rules + SLA policy (seeded) ----

const ASSIGNMENT_PHASE = "phase-39-lead-assignment";

export const defaultLeadAssignmentRule: AssignmentRulePayload = {
  object: "lead",
  rules: [
    {
      key: "partner-sourced",
      priority: 1,
      conditions: [{ field: "leadSource", operator: "eq", value: "partner" }],
      strategy: "named_account",
      assignTo: { kind: "team", ref: "partner-managers" }
    },
    {
      key: "enterprise-segment",
      priority: 2,
      conditions: [{ field: "segment", operator: "eq", value: "enterprise" }],
      strategy: "load_balanced",
      pool: ["team:enterprise-sales"]
    },
    {
      key: "north-region",
      priority: 3,
      conditions: [{ field: "region", operator: "eq", value: "noida" }],
      strategy: "round_robin",
      pool: ["user:sales.executive", "user:inside.sales.executive"]
    },
    {
      key: "default-inside-sales",
      priority: 99,
      strategy: "round_robin",
      pool: ["team:inside-sales"]
    }
  ],
  fallback: { kind: "queue", ref: "unassigned-leads" }
};

export const defaultLeadSlaPolicy: SlaPolicyPayload = {
  object: "lead",
  targets: [
    { key: "first_response", label: "First Response", hours: 4, warningHours: 2 },
    { key: "follow_up", label: "Follow-up", hours: 24, warningHours: 8 }
  ],
  escalation: { afterHours: 8, to: "role:sales-manager" }
};

export const defaultLeadAssignmentConfigurationDefinitions: ConfigurationDefinition[] = [
  {
    definitionType: "assignment_rule",
    definitionKey: "lead-default",
    name: "Lead Assignment Rules",
    description: "Default configurable lead routing by partner source, segment, region, round-robin, and fallback queue.",
    isActive: true,
    definition: { ...defaultLeadAssignmentRule, metadata: { phase: ASSIGNMENT_PHASE } }
  },
  {
    definitionType: "sla_policy",
    definitionKey: "lead-default",
    name: "Lead SLA Policy",
    description: "Default lead SLA targets (first response + follow-up) with warning thresholds and manager escalation.",
    isActive: true,
    definition: { ...defaultLeadSlaPolicy, metadata: { phase: ASSIGNMENT_PHASE } }
  }
];
