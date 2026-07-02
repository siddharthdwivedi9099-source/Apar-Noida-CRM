// Persona 30 (AI Governance Manager) pure resolvers + API contract.
// AI use-case registry (AIG-001), AI explanation (AIG-003), and AI quality dashboard (AIG-005).
// AI action approval (AIG-002) and the AI audit trail (AIG-004) already exist in the ai-actions +
// ai-gateway modules; this module adds the governance registry, explanation, feedback, and quality
// layer. Deterministic helpers are unit-tested.

// ---- AIG-001: AI use-case registry -------------------------------------------------------------

export const aiRiskLevels = ["low", "medium", "high"] as const;
export type AiRiskLevel = (typeof aiRiskLevels)[number];

export const aiUseCaseActionTypes = ["assist", "score", "draft", "classify", "recommend", "automate"] as const;
export type AiUseCaseActionType = (typeof aiUseCaseActionTypes)[number];

export const aiUseCaseApprovalStatuses = ["draft", "pending_approval", "approved", "rejected"] as const;
export type AiUseCaseApprovalStatus = (typeof aiUseCaseApprovalStatuses)[number];

/** AIG-001: high-risk use cases require governance approval before they can go live. */
export function requiresUseCaseApproval(riskLevel: AiRiskLevel): boolean {
  return riskLevel === "high";
}

// ---- AIG-003: AI explanation -------------------------------------------------------------------

export interface ExplanationFactor {
  label: string;
  weight: number; // signed contribution; positive helps, negative hurts
}

export interface AiExplanation {
  topPositive: ExplanationFactor[];
  topNegative: ExplanationFactor[];
  confidence: number;
  lowConfidence: boolean;
}

// A score is flagged low-confidence below this threshold (0–100).
export const LOW_CONFIDENCE_THRESHOLD = 60;

/** AIG-003: surface the top positive and negative factors and flag low-confidence outputs. */
export function resolveAiExplanation(factors: ExplanationFactor[], confidence: number, topN = 3): AiExplanation {
  const positive = factors.filter((factor) => factor.weight > 0).sort((a, b) => b.weight - a.weight).slice(0, topN);
  const negative = factors.filter((factor) => factor.weight < 0).sort((a, b) => a.weight - b.weight).slice(0, topN);
  const clampedConfidence = Math.max(0, Math.min(100, Math.round(confidence)));
  return { topPositive: positive, topNegative: negative, confidence: clampedConfidence, lowConfidence: clampedConfidence < LOW_CONFIDENCE_THRESHOLD };
}

// ---- AIG-005: AI quality -----------------------------------------------------------------------

export const aiFeedbackRatings = ["helpful", "not_helpful", "neutral"] as const;
export type AiFeedbackRating = (typeof aiFeedbackRatings)[number];

export interface AiRunFact {
  reviewStatus: "not_required" | "pending_review" | "approved" | "rejected";
  requiresReview: boolean;
  confidence: number | null;
  responseMs: number | null;
}

export interface AiFeedbackFact {
  rating: AiFeedbackRating;
  isHallucination: boolean;
}

export interface AiQualitySummary {
  totalRuns: number;
  reviewedRuns: number;
  overrides: number;
  overrideRate: number;
  lowConfidenceCount: number;
  avgResponseMs: number | null;
  feedbackCount: number;
  helpfulRate: number;
  hallucinationReports: number;
  businessImpactScore: number;
}

/**
 * AIG-005: quality posture from AI runs + feedback. Override rate = rejected reviews / reviewed
 * runs; business impact is a simple composite of helpfulness minus hallucination/override drag.
 */
export function computeAiQuality(runs: AiRunFact[], feedback: AiFeedbackFact[]): AiQualitySummary {
  const totalRuns = runs.length;
  const reviewedRuns = runs.filter((run) => run.reviewStatus === "approved" || run.reviewStatus === "rejected").length;
  const overrides = runs.filter((run) => run.reviewStatus === "rejected").length;
  const overrideRate = reviewedRuns > 0 ? Math.round((overrides / reviewedRuns) * 100) : 0;
  const lowConfidenceCount = runs.filter((run) => typeof run.confidence === "number" && run.confidence < LOW_CONFIDENCE_THRESHOLD).length;
  const responseTimes = runs.map((run) => run.responseMs).filter((value): value is number => typeof value === "number");
  const avgResponseMs = responseTimes.length > 0 ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length) : null;
  const feedbackCount = feedback.length;
  const helpful = feedback.filter((entry) => entry.rating === "helpful").length;
  const helpfulRate = feedbackCount > 0 ? Math.round((helpful / feedbackCount) * 100) : 0;
  const hallucinationReports = feedback.filter((entry) => entry.isHallucination).length;
  const impactPenalty = overrideRate * 0.4 + (feedbackCount > 0 ? (hallucinationReports / feedbackCount) * 100 * 0.6 : 0);
  const businessImpactScore = Math.max(0, Math.min(100, Math.round(helpfulRate - impactPenalty)));
  return { totalRuns, reviewedRuns, overrides, overrideRate, lowConfidenceCount, avgResponseMs, feedbackCount, helpfulRate, hallucinationReports, businessImpactScore };
}

// ---- API contract ------------------------------------------------------------------------------

export interface AiUseCaseSummary {
  id: string;
  name: string;
  ownerId: string | null;
  objectType: string | null;
  persona: string | null;
  dataUsed: string | null;
  actionType: AiUseCaseActionType;
  riskLevel: AiRiskLevel;
  approvalStatus: AiUseCaseApprovalStatus;
  model: string | null;
  prompt: string | null;
  monitoringPlan: string | null;
  version: number;
  requiresApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiUseCaseVersionSummary {
  id: string;
  version: number;
  changeReason: string | null;
  createdAt: string;
}

export interface AiUseCasesResponse {
  useCases: AiUseCaseSummary[];
}

export interface AiUseCaseResponse {
  useCase: AiUseCaseSummary;
  versions: AiUseCaseVersionSummary[];
}

export interface AiFeedbackSummary {
  id: string;
  runId: string | null;
  rating: AiFeedbackRating;
  isHallucination: boolean;
  confidenceFlag: "normal" | "low";
  comment: string | null;
  createdAt: string;
}

export interface AiImprovementTaskSummary {
  id: string;
  source: "feedback" | "hallucination" | "quality" | "override";
  title: string;
  status: "open" | "in_progress" | "done";
  createdAt: string;
}

export interface AiQualityDashboardResponse {
  quality: AiQualitySummary;
  recentFeedback: AiFeedbackSummary[];
  improvementTasks: AiImprovementTaskSummary[];
}

// ---- Request bodies ----------------------------------------------------------------------------

export interface UpsertAiUseCaseRequestBody {
  name: string;
  ownerId?: string | null;
  objectType?: string | null;
  persona?: string | null;
  dataUsed?: string | null;
  actionType?: AiUseCaseActionType;
  riskLevel?: AiRiskLevel;
  model?: string | null;
  prompt?: string | null;
  monitoringPlan?: string | null;
  changeReason?: string | null;
}

export interface AiUseCaseDecisionRequestBody {
  decision: "submit" | "approve" | "reject";
  note?: string | null;
}

export interface RecordAiFeedbackRequestBody {
  runId?: string | null;
  useCaseId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  rating: AiFeedbackRating;
  isHallucination?: boolean;
  confidenceFlag?: "normal" | "low";
  comment?: string | null;
}

export interface CreateImprovementTaskRequestBody {
  title: string;
  description?: string | null;
  source?: "feedback" | "hallucination" | "quality" | "override";
  useCaseId?: string | null;
  feedbackId?: string | null;
  ownerId?: string | null;
}
