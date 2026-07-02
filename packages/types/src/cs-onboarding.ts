// Persona 24 (Customer Success Manager — Onboarding) pure resolvers + API contract.
// Extends the existing customer-success module: structured sales handover, auto-provisioned
// onboarding project, kickoff management, go-live readiness, and onboarding completion.
// Deterministic helpers are unit-tested; AI kickoff summarization stays a governed placeholder.

import type { CrmLookupUserSummary } from "./crm.js";

// ---- CSMO-001: sales-to-CS handover ------------------------------------------------------------

export const handoverFields = [
  "contract",
  "scope",
  "products",
  "commitments",
  "stakeholders",
  "timeline",
  "risks",
  "specialTerms",
  "integrations",
  "successCriteria"
] as const;
export type HandoverField = (typeof handoverFields)[number];

/** Mandatory fields gate the start of onboarding (kickoff). The rest are flagged if missing. */
export const mandatoryHandoverFields: readonly HandoverField[] = [
  "contract",
  "scope",
  "products",
  "stakeholders",
  "timeline",
  "successCriteria"
];

export type HandoverInput = Partial<Record<HandoverField, string | null>>;

export interface HandoverValidation {
  missingFields: HandoverField[];
  missingMandatory: HandoverField[];
  complete: boolean;
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** CSMO-001: flag missing fields; onboarding cannot start until mandatory fields are complete. */
export function validateHandover(handover: HandoverInput | null | undefined): HandoverValidation {
  const data = handover ?? {};
  const missingFields = handoverFields.filter((field) => !hasText(data[field]));
  const missingMandatory = mandatoryHandoverFields.filter((field) => !hasText(data[field]));
  return { missingFields, missingMandatory, complete: missingMandatory.length === 0 };
}

// ---- CSMO-002: onboarding project template -----------------------------------------------------

export const onboardingImplementationTypes = ["quick_start", "standard", "enterprise"] as const;
export type OnboardingImplementationType = (typeof onboardingImplementationTypes)[number];

export interface OnboardingTemplate {
  implementationType: OnboardingImplementationType;
  milestones: string[];
}

const BASE_MILESTONES = ["Kickoff", "Data collection", "Configuration", "Training", "Go-live readiness", "Go-live"];

/**
 * CSMO-002: choose the onboarding milestone template from implementation type (primary), with
 * segment/product refinements. Deterministic; a later phase can move this into config metadata.
 */
export function resolveOnboardingTemplate(
  implementationType: OnboardingImplementationType | null | undefined,
  segment?: string | null,
  product?: string | null
): OnboardingTemplate {
  const type: OnboardingImplementationType = onboardingImplementationTypes.includes(implementationType as OnboardingImplementationType)
    ? (implementationType as OnboardingImplementationType)
    : "standard";

  const milestones = [...BASE_MILESTONES];
  if (type === "quick_start") {
    // Lean path: drop the dedicated data-collection/config split into a single setup step.
    milestones.splice(1, 2, "Setup & configuration");
  }
  if (type === "enterprise" || (segment ?? "").toLowerCase() === "enterprise") {
    milestones.splice(milestones.length - 1, 0, "Integration build", "UAT / testing", "Executive sign-off");
  }
  if (hasText(product) && /integration|api|platform/i.test(product ?? "") && !milestones.includes("Integration build")) {
    milestones.splice(milestones.length - 1, 0, "Integration build");
  }
  // De-duplicate while preserving order.
  return { implementationType: type, milestones: milestones.filter((label, index) => milestones.indexOf(label) === index) };
}

// ---- CSMO-003: kickoff -------------------------------------------------------------------------

/** CSMO-003: generate a standard kickoff agenda (deterministic; not the AI summary placeholder). */
export function generateKickoffAgenda(customerName: string | null | undefined): string[] {
  const who = hasText(customerName) ? customerName!.trim() : "the customer";
  return [
    `Introductions & roles (vendor + ${who})`,
    "Recap of goals and success criteria",
    "Implementation plan & timeline walkthrough",
    "Data collection & configuration requirements",
    "Training plan and enablement",
    "Risks, dependencies, and open questions",
    "Next steps and action items"
  ];
}

export interface KickoffActionItem {
  id: string;
  description: string;
  owner: CrmLookupUserSummary | null;
  dueDate: string | null;
}

// ---- CSMO-004: go-live readiness ---------------------------------------------------------------

export const goLiveChecklistItems = [
  { key: "configuration", label: "Configuration complete", critical: false },
  { key: "data_migration", label: "Data migration validated", critical: true },
  { key: "access", label: "Access & provisioning", critical: true },
  { key: "training", label: "Training delivered", critical: false },
  { key: "integrations", label: "Integrations verified", critical: false },
  { key: "testing", label: "Testing / UAT signed off", critical: true },
  { key: "sign_off", label: "Customer sign-off", critical: true },
  { key: "support_plan", label: "Support plan in place", critical: false }
] as const;
export type GoLiveChecklistKey = (typeof goLiveChecklistItems)[number]["key"];

export const goLiveItemStatuses = ["pending", "in_progress", "done", "na"] as const;
export type GoLiveItemStatus = (typeof goLiveItemStatuses)[number];

export interface GoLiveReadiness {
  total: number;
  completed: number;
  score: number;
  criticalPending: GoLiveChecklistKey[];
  canComplete: boolean;
}

/** CSMO-004: readiness score + critical-item gate. "done" and "na" both count as satisfied. */
export function computeGoLiveReadiness(statuses: Partial<Record<GoLiveChecklistKey, GoLiveItemStatus>> | null | undefined): GoLiveReadiness {
  const data = statuses ?? {};
  const isSatisfied = (key: GoLiveChecklistKey) => data[key] === "done" || data[key] === "na";
  const total = goLiveChecklistItems.length;
  const completed = goLiveChecklistItems.filter((item) => isSatisfied(item.key)).length;
  const criticalPending = goLiveChecklistItems.filter((item) => item.critical && !isSatisfied(item.key)).map((item) => item.key);
  return {
    total,
    completed,
    score: total > 0 ? Math.round((completed / total) * 100) : 0,
    criticalPending,
    canComplete: criticalPending.length === 0
  };
}

// ---- API contract ------------------------------------------------------------------------------

export interface CsOnboardingHandoverView {
  fields: HandoverInput;
  validation: HandoverValidation;
  sourceOpportunityId: string | null;
  updatedAt: string | null;
}

export interface CsOnboardingKickoffView {
  scheduledAt: string | null;
  agenda: string[];
  attendees: string[];
  decisions: string | null;
  actionItems: KickoffActionItem[];
  successCriteriaConfirmed: boolean;
  aiSummary: { available: false; message: string };
  completedAt: string | null;
}

export interface CsOnboardingGoLiveItemView {
  key: GoLiveChecklistKey;
  label: string;
  critical: boolean;
  status: GoLiveItemStatus;
}

export interface CsOnboardingGoLiveView {
  items: CsOnboardingGoLiveItemView[];
  readiness: GoLiveReadiness;
  goLiveDate: string | null;
  completedAt: string | null;
}

export interface CsOnboardingCompletionView {
  completedAt: string | null;
  goLiveDate: string | null;
  usersTrained: number | null;
  adoptionBaseline: number | null;
  openRisks: string | null;
  pendingItems: string | null;
  customerSignOff: boolean;
  ongoingCsm: CrmLookupUserSummary | null;
  initialHealthScore: number | null;
}

export interface CsOnboardingProjectView {
  planId: string;
  csAccountId: string;
  name: string;
  status: string;
  implementationType: OnboardingImplementationType | null;
  handover: CsOnboardingHandoverView;
  kickoff: CsOnboardingKickoffView;
  goLive: CsOnboardingGoLiveView;
  completion: CsOnboardingCompletionView | null;
  canStart: boolean;
}

export interface CsOnboardingProjectResponse {
  project: CsOnboardingProjectView;
}

// ---- Request bodies ----------------------------------------------------------------------------

export interface ProvisionOnboardingRequestBody {
  opportunityId: string;
  implementationType?: OnboardingImplementationType;
}

export interface RecordHandoverRequestBody {
  fields: HandoverInput;
}

export interface RecordKickoffRequestBody {
  scheduledAt?: string | null;
  attendees?: string[];
  decisions?: string | null;
  actionItems?: Array<{ description: string; ownerId?: string | null; dueDate?: string | null }>;
  successCriteriaConfirmed?: boolean;
  markCompleted?: boolean;
}

export interface UpdateGoLiveChecklistRequestBody {
  items: Partial<Record<GoLiveChecklistKey, GoLiveItemStatus>>;
}

export interface CompleteGoLiveRequestBody {
  goLiveDate: string;
}

export interface CompleteOnboardingRequestBody {
  goLiveDate?: string | null;
  usersTrained?: number | null;
  adoptionBaseline?: number | null;
  openRisks?: string | null;
  pendingItems?: string | null;
  customerSignOff: boolean;
  ongoingCsmId: string;
  initialHealthScore: number;
}
