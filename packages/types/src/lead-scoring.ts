import type {
  ConfigurationDefinition,
  MqlRulePayload,
  ScoringModelPayload,
  ScoringOperator
} from "./configuration-definitions.js";

// ---------------------------------------------------------------------------
// Lead scoring + MQL — pure, configurable evaluators.
//
// Rules, weights, grades, and the MQL threshold all come from the configured
// scoring_model / mql_rule definitions; nothing is hard-coded. Unit-testable
// without a database.
// ---------------------------------------------------------------------------

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

/** Evaluate one scoring/criteria condition against a record. Pure. */
export function evaluateScoringCondition(
  record: Record<string, unknown>,
  field: string,
  operator: ScoringOperator,
  value: unknown
): boolean {
  const actual = record[field];
  switch (operator) {
    case "exists":
      return !isBlank(actual);
    case "eq":
      return actual === value;
    case "ne":
      return actual !== value;
    case "contains":
      if (Array.isArray(actual)) {
        return actual.includes(value);
      }
      return typeof actual === "string" && typeof value === "string" && actual.toLowerCase().includes(value.toLowerCase());
    case "in":
      return Array.isArray(value) && value.includes(actual);
    case "gt":
    case "lt":
    case "gte":
    case "lte": {
      const a = toNumber(actual);
      const b = toNumber(value);
      if (a === null || b === null) {
        return false;
      }
      return operator === "gt" ? a > b : operator === "lt" ? a < b : operator === "gte" ? a >= b : a <= b;
    }
    default:
      return false;
  }
}

export interface ScoreBreakdownEntry {
  dimension: string;
  field: string;
  operator: ScoringOperator;
  points: number;
  matched: boolean;
}

export interface LeadScoreResult {
  dimensionScores: Record<string, number>;
  finalScore: number;
  grade: string | null;
  breakdown: ScoreBreakdownEntry[];
}

/** Compute a lead's scores + grade from a configured scoring model. Pure. */
export function evaluateLeadScore(model: ScoringModelPayload, record: Record<string, unknown>): LeadScoreResult {
  const dimensionScores: Record<string, number> = {};
  const breakdown: ScoreBreakdownEntry[] = [];
  let weightedTotal = 0;

  for (const dimension of model.dimensions ?? []) {
    let dimensionScore = 0;
    for (const rule of dimension.rules ?? []) {
      const matched = evaluateScoringCondition(record, rule.field, rule.operator, rule.value);
      if (matched) {
        dimensionScore += rule.points;
      }
      breakdown.push({ dimension: dimension.key, field: rule.field, operator: rule.operator, points: rule.points, matched });
    }
    dimensionScores[dimension.key] = dimensionScore;
    weightedTotal += dimensionScore * (typeof dimension.weight === "number" ? dimension.weight : 1);
  }

  const finalScore = Math.round(weightedTotal);
  let grade: string | null = null;
  for (const candidate of [...(model.grades ?? [])].sort((a, b) => b.minScore - a.minScore)) {
    if (finalScore >= candidate.minScore) {
      grade = candidate.grade;
      break;
    }
  }

  return { dimensionScores, finalScore, grade, breakdown };
}

export interface MqlEvaluation {
  isMql: boolean;
  reasons: string[];
}

/** Decide whether a scored lead is an MQL from a configured rule. Pure. */
export function evaluateMql(rule: MqlRulePayload, score: LeadScoreResult, record: Record<string, unknown>): MqlEvaluation {
  const reasons: string[] = [];
  let isMql = true;

  if (score.finalScore < rule.threshold) {
    isMql = false;
    reasons.push(`Score ${score.finalScore} is below the MQL threshold ${rule.threshold}.`);
  } else {
    reasons.push(`Score ${score.finalScore} meets the MQL threshold ${rule.threshold}.`);
  }

  for (const field of rule.requiredFields ?? []) {
    if (isBlank(record[field])) {
      isMql = false;
      reasons.push(`Required field "${field}" is missing.`);
    }
  }

  for (const criterion of rule.criteria ?? []) {
    if (!evaluateScoringCondition(record, criterion.field, criterion.operator, criterion.value)) {
      isMql = false;
      reasons.push(`Criterion on "${criterion.field}" is not met.`);
    }
  }

  return { isMql, reasons };
}

// ---- Default configured lead scoring model + MQL rule (seeded) ----

const SCORING_PHASE = "phase-38-lead-scoring";

export const defaultLeadScoringModel: ScoringModelPayload = {
  object: "lead",
  dimensions: [
    {
      key: "fit",
      label: "Fit",
      weight: 1,
      rules: [
        { field: "industry", operator: "exists", points: 10 },
        { field: "segment", operator: "exists", points: 10 },
        { field: "region", operator: "exists", points: 5 },
        { field: "designation", operator: "exists", points: 5 }
      ]
    },
    {
      key: "engagement",
      label: "Engagement",
      weight: 1,
      rules: [
        { field: "attemptCount", operator: "gte", value: 1, points: 10 },
        { field: "lastActivity", operator: "exists", points: 10 }
      ]
    },
    {
      key: "intent",
      label: "Intent",
      weight: 1,
      rules: [
        { field: "productInterest", operator: "exists", points: 15 },
        { field: "subSource", operator: "in", value: ["demo_request", "pricing_request"], points: 15 }
      ]
    },
    {
      key: "ai",
      label: "AI",
      weight: 1,
      rules: [{ field: "aiScore", operator: "gte", value: 50, points: 20 }]
    }
  ],
  grades: [
    { grade: "a", minScore: 80 },
    { grade: "b", minScore: 60 },
    { grade: "c", minScore: 40 },
    { grade: "d", minScore: 0 }
  ]
};

export const defaultLeadMqlRule: MqlRulePayload = {
  object: "lead",
  threshold: 50,
  requiredFields: ["leadSource", "productInterest"],
  criteria: [{ field: "consentStatus", operator: "ne", value: "opted_out" }]
};

export const defaultLeadScoringConfigurationDefinitions: ConfigurationDefinition[] = [
  {
    definitionType: "scoring_model",
    definitionKey: "lead-default",
    name: "Lead Scoring Model",
    description: "Default configurable lead scoring model across fit, engagement, intent, and AI dimensions.",
    isActive: true,
    definition: { ...defaultLeadScoringModel, metadata: { phase: SCORING_PHASE } }
  },
  {
    definitionType: "mql_rule",
    definitionKey: "lead-default",
    name: "Lead MQL Rule",
    description: "Default MQL qualification rule (score threshold + required fields + consent criterion).",
    isActive: true,
    definition: { ...defaultLeadMqlRule, metadata: { phase: SCORING_PHASE } }
  }
];
