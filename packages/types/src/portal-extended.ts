// Persona 27 (Customer / Prospect Portal User) additions — demo request (→ lead), knowledge
// article rating, and onboarding-task completion. Extends the existing customer-portal module.

import type { CrmLookupUserSummary } from "./crm.js";

// ---- CP-001: demo request ----------------------------------------------------------------------

export const portalOrganizationTypes = ["enterprise", "mid_market", "smb", "startup", "public_sector", "other"] as const;
export type PortalOrganizationType = (typeof portalOrganizationTypes)[number];

export interface PortalDemoRequestBody {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  phone?: string | null;
  productInterest: string;
  preferredDate?: string | null;
  organizationType?: PortalOrganizationType;
  message?: string | null;
}

export interface PortalDemoRequestResponse {
  leadId: string;
  confirmationMessage: string;
}

// ---- CP-003: knowledge article rating ----------------------------------------------------------

export interface RatePortalArticleRequestBody {
  helpful: boolean;
  comment?: string | null;
}

export interface RatePortalArticleResponse {
  articleId: string;
  helpful: boolean;
}

// ---- CP-004: onboarding task completion --------------------------------------------------------

export const portalOnboardingTaskStatuses = ["pending", "in_progress", "completed", "blocked"] as const;
export type PortalOnboardingTaskStatus = (typeof portalOnboardingTaskStatuses)[number];

export interface PortalOnboardingTask {
  id: string;
  label: string;
  status: PortalOnboardingTaskStatus;
  dueDate: string | null;
  owner: CrmLookupUserSummary | null;
  instructions: string | null;
  documents: string[];
  completedAt: string | null;
}

export interface PortalOnboardingResponse {
  planId: string | null;
  planName: string | null;
  tasks: PortalOnboardingTask[];
}

export interface CompletePortalOnboardingTaskRequestBody {
  documentRef?: string | null;
  note?: string | null;
}
