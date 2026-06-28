import type {
  LeadDiscoveryFieldDefinition,
  LeadDiscoveryView,
  LeadIcpAttributes,
  LeadIcpCriterionDefinition,
  LeadIcpFitBand,
  LeadIcpFitView
} from "./crm.js";

/**
 * Pure, configuration-driven helpers for the Sales Development Representative workspace (Persona 7).
 * ICP fit (SDR-002) and discovery completeness (SDR-003) stay free of database concerns so they can
 * be unit tested in isolation.
 */

// --- SDR-002: ICP fit assessment ----------------------------------------------------------------

// Criterion key -> the ICP attribute it scores. Strategic value is graded, the rest are presence-based.
const ICP_CRITERION_KEYS = [
  "industry",
  "segment",
  "size",
  "geography",
  "use_case",
  "budget",
  "strategic_value"
] as const;

export const DEFAULT_ICP_CRITERIA: LeadIcpCriterionDefinition[] = [
  { key: "industry", label: "Industry", weight: 1 },
  { key: "segment", label: "Segment", weight: 1 },
  { key: "size", label: "Company size", weight: 1 },
  { key: "geography", label: "Geography", weight: 1 },
  { key: "use_case", label: "Use case", weight: 1 },
  { key: "budget", label: "Budget", weight: 1 },
  { key: "strategic_value", label: "Strategic value", weight: 2 }
];

function attributeForCriterion(key: string, attributes: LeadIcpAttributes): string | null {
  switch (key) {
    case "industry":
      return attributes.industry;
    case "segment":
      return attributes.segment;
    case "size":
      return attributes.size;
    case "geography":
      return attributes.geography;
    case "use_case":
      return attributes.useCase;
    case "budget":
      return attributes.budget;
    case "strategic_value":
      return attributes.strategicValue;
    default:
      return null;
  }
}

// 0..1 — how strongly the criterion is satisfied. Strategic value is graded; others are present/absent.
function satisfactionFactor(key: string, value: string | null): number {
  if (typeof value !== "string" || value.trim().length === 0) {
    return 0;
  }
  if (key === "strategic_value") {
    if (value === "high") return 1;
    if (value === "medium") return 0.6;
    if (value === "low") return 0.3;
    return 0;
  }
  return 1;
}

function bandForScore(score: number): LeadIcpFitBand {
  if (score >= 70) {
    return "high";
  }
  if (score >= 40) {
    return "medium";
  }
  return "low";
}

/** Compute ICP fit (high/medium/low) from captured attributes + configurable criterion weights. Pure. */
export function evaluateIcpFit(
  attributes: LeadIcpAttributes,
  criteria: LeadIcpCriterionDefinition[] = DEFAULT_ICP_CRITERIA
): LeadIcpFitView {
  const activeCriteria = criteria.filter((criterion) => ICP_CRITERION_KEYS.includes(criterion.key as never));
  const effectiveCriteria = activeCriteria.length > 0 ? activeCriteria : DEFAULT_ICP_CRITERIA;
  const totalWeight = effectiveCriteria.reduce((sum, criterion) => sum + Math.max(0, criterion.weight), 0);

  const explanation = effectiveCriteria.map((criterion) => {
    const value = attributeForCriterion(criterion.key, attributes);
    const weight = Math.max(0, criterion.weight);
    const factor = satisfactionFactor(criterion.key, value);
    return {
      key: criterion.key,
      label: criterion.label,
      satisfied: factor > 0,
      weight,
      contribution: weight * factor
    };
  });

  const earned = explanation.reduce((sum, entry) => sum + entry.contribution, 0);
  const score = totalWeight > 0 ? Math.round((earned / totalWeight) * 100) : 0;

  return {
    configured: true,
    band: bandForScore(score),
    score,
    explanation,
    attributes
  };
}

// --- SDR-003: discovery call completeness -------------------------------------------------------

/** Merge configured discovery fields with captured answers into a deterministic view. Pure. */
export function evaluateDiscovery(
  definitions: LeadDiscoveryFieldDefinition[],
  answers: Record<string, string> | null | undefined
): LeadDiscoveryView {
  const safeAnswers = answers ?? {};
  const items = definitions.map((definition) => {
    const raw = safeAnswers[definition.key];
    const value = typeof raw === "string" ? raw.trim() : "";
    return {
      key: definition.key,
      label: definition.label,
      required: definition.required,
      value,
      completed: value.length > 0
    };
  });

  const requiredItems = items.filter((item) => item.required);

  return {
    items,
    completionCount: items.filter((item) => item.completed).length,
    total: items.length,
    requiredCount: requiredItems.length,
    requiredComplete: requiredItems.every((item) => item.completed)
  };
}

/** Whether the discovery form is complete enough to convert (all required fields captured). */
export function isDiscoveryReadyForConversion(
  definitions: LeadDiscoveryFieldDefinition[],
  answers: Record<string, string> | null | undefined
): boolean {
  return evaluateDiscovery(definitions, answers).requiredComplete;
}
