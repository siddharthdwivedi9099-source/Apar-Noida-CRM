// Persona 15 (Solution Architect) pure resolvers + API contract.
// Deterministic helpers are unit-tested directly; live AI extraction/drafting stays a
// governed placeholder behind the AI Gateway.

import type { CrmLookupUserSummary } from "./crm.js";

export const technicalDiscoveryFieldKeys = [
  "systems",
  "integrations",
  "apis",
  "authentication",
  "dataMigration",
  "hosting",
  "security",
  "compliance",
  "users",
  "concurrency",
  "reporting",
  "customWorkflows"
] as const;
export type TechnicalDiscoveryFieldKey = (typeof technicalDiscoveryFieldKeys)[number];

export type TechnicalDiscovery = Record<TechnicalDiscoveryFieldKey, string | null> & { updatedAt: string | null };

export interface TechnicalDiscoveryStatus {
  missingFields: TechnicalDiscoveryFieldKey[];
  capturedCount: number;
  totalCount: number;
  complete: boolean;
}

/** SA-001: flag missing technical discovery fields. */
export function evaluateTechnicalDiscovery(discovery: Partial<Record<TechnicalDiscoveryFieldKey, string | null>> | null | undefined): TechnicalDiscoveryStatus {
  const missingFields: TechnicalDiscoveryFieldKey[] = [];
  for (const key of technicalDiscoveryFieldKeys) {
    const value = discovery?.[key];
    if (typeof value !== "string" || value.trim().length === 0) {
      missingFields.push(key);
    }
  }
  const totalCount = technicalDiscoveryFieldKeys.length;
  const capturedCount = totalCount - missingFields.length;
  return { missingFields, capturedCount, totalCount, complete: missingFields.length === 0 };
}

export const riskLevels = ["low", "medium", "high"] as const;
export type RiskLevel = (typeof riskLevels)[number];

export const deliveryRiskDimensions = [
  "scopeAmbiguity",
  "integrationComplexity",
  "timelineRisk",
  "customization",
  "dataMigration",
  "security",
  "compliance",
  "resourceAvailability"
] as const;
export type DeliveryRiskDimension = (typeof deliveryRiskDimensions)[number];

export interface DeliveryRiskSummary {
  overall: RiskLevel;
  highCount: number;
  mediumCount: number;
  requiresLeadershipApproval: boolean;
}

/**
 * SA-005: roll up the eight delivery-risk dimensions into an overall level. Any high
 * dimension (or two-or-more medium) makes the deal high-risk and requires leadership
 * approval before closure.
 */
export function summarizeDeliveryRisk(values: Partial<Record<DeliveryRiskDimension, RiskLevel>> | null | undefined): DeliveryRiskSummary {
  let highCount = 0;
  let mediumCount = 0;
  for (const dimension of deliveryRiskDimensions) {
    const level = values?.[dimension];
    if (level === "high") {
      highCount += 1;
    } else if (level === "medium") {
      mediumCount += 1;
    }
  }
  const overall: RiskLevel = highCount > 0 || mediumCount >= 2 ? "high" : mediumCount > 0 ? "medium" : "low";
  return { overall, highCount, mediumCount, requiresLeadershipApproval: overall === "high" };
}

export const integrationComplexities = ["low", "medium", "high"] as const;
export type IntegrationComplexity = (typeof integrationComplexities)[number];

/** SA-003: rough effort estimate (person-days) from integration complexity. */
export function estimateIntegrationEffortDays(complexity: IntegrationComplexity): number {
  switch (complexity) {
    case "high":
      return 20;
    case "medium":
      return 8;
    default:
      return 3;
  }
}

// ---- API contract ------------------------------------------------------------------------------

export interface ArchitectureRecommendation {
  frontend: string | null;
  backend: string | null;
  database: string | null;
  integrations: string | null;
  aiLayer: string | null;
  analytics: string | null;
  security: string | null;
  deployment: string | null;
  support: string | null;
  status: "draft" | "approved";
  approvedBy: CrmLookupUserSummary | null;
  approvedAt: string | null;
  linkedToProposal: boolean;
  updatedAt: string | null;
}

export interface SolutionIntegrationAssessment {
  id: string;
  system: string;
  method: string | null;
  apiAvailability: string | null;
  authentication: string | null;
  frequency: string | null;
  dataDirection: string | null;
  complexity: IntegrationComplexity;
  owner: string | null;
  risk: RiskLevel;
  effortDays: number;
}

export interface SecurityQuestionnaireItem {
  question: string;
  answer: string | null;
}

export interface SecurityQuestionnaireVersion {
  id: string;
  version: number;
  note: string | null;
  items: SecurityQuestionnaireItem[];
  createdBy: CrmLookupUserSummary | null;
  createdAt: string;
  approved: boolean;
  approvedBy: CrmLookupUserSummary | null;
  approvedAt: string | null;
}

export interface DeliveryRiskDimensionState {
  level: RiskLevel;
  note: string | null;
}

export interface DeliveryRiskAssessment {
  dimensions: Record<DeliveryRiskDimension, DeliveryRiskDimensionState>;
  summary: DeliveryRiskSummary;
  status: "open" | "submitted" | "approved" | "flagged";
  approvalId: string | null;
  updatedAt: string | null;
}

export interface SolutionArchitectureView {
  opportunityId: string;
  technicalDiscovery: TechnicalDiscovery;
  technicalDiscoveryStatus: TechnicalDiscoveryStatus;
  architecture: ArchitectureRecommendation;
  integrations: SolutionIntegrationAssessment[];
  securityVersions: SecurityQuestionnaireVersion[];
  deliveryRisk: DeliveryRiskAssessment;
  aiPlaceholders: { available: false; message: string };
}

export interface SolutionArchitectureResponse {
  architecture: SolutionArchitectureView;
}

export type UpdateTechnicalDiscoveryRequestBody = Partial<Record<TechnicalDiscoveryFieldKey, string | null>>;

export interface UpsertArchitectureRequestBody {
  frontend?: string | null;
  backend?: string | null;
  database?: string | null;
  integrations?: string | null;
  aiLayer?: string | null;
  analytics?: string | null;
  security?: string | null;
  deployment?: string | null;
  support?: string | null;
  linkedToProposal?: boolean;
}

export interface AddIntegrationAssessmentRequestBody {
  system: string;
  method?: string | null;
  apiAvailability?: string | null;
  authentication?: string | null;
  frequency?: string | null;
  dataDirection?: string | null;
  complexity?: IntegrationComplexity;
  owner?: string | null;
  risk?: RiskLevel;
}

export interface AddSecurityQuestionnaireVersionRequestBody {
  note?: string | null;
  items: SecurityQuestionnaireItem[];
}

export interface UpdateDeliveryRiskRequestBody {
  dimensions: Partial<Record<DeliveryRiskDimension, { level: RiskLevel; note?: string | null }>>;
}

export interface SubmitDeliveryRiskRequestBody {
  approverUserId?: string | null;
  note?: string | null;
}

// Lightweight architecture summary surfaced on the opportunity (SA-003/SA-005 visibility).
export interface OpportunityArchitectureSummary {
  hasArchitecture: boolean;
  architectureStatus: "draft" | "approved" | null;
  integrationCount: number;
  deliveryRiskLevel: RiskLevel | null;
  deliveryRiskStatus: "open" | "submitted" | "approved" | "flagged" | null;
  technicalDiscoveryComplete: boolean;
}
