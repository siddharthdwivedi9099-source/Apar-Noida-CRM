import type { LeadBantChecklist } from "./crm.js";

export interface LeadConversionReadinessInput {
  qualificationChecklist: LeadBantChecklist;
  duplicateCheckCompleted: boolean;
  hasOwner: boolean;
  hasNextStep: boolean;
  hasExpectedCloseDate: boolean;
  hasAmount: boolean;
  hasProductContext: boolean;
}

export interface LeadConversionReadiness {
  ready: boolean;
  blockers: string[];
}

export function mapLeadSourceToOpportunitySource(leadSourceKey: string | null | undefined): string {
  switch (leadSourceKey) {
    case "campaign":
      return "campaign";
    case "partner":
      return "partner";
    case "referral":
      return "referral";
    case "outbound":
      return "outbound";
    case "reseller":
      return "reseller";
    case "website":
    default:
      return "inbound";
  }
}

export function evaluateLeadConversionReadiness(input: LeadConversionReadinessInput): LeadConversionReadiness {
  const blockers: string[] = [];

  if (!Object.values(input.qualificationChecklist).every(Boolean)) {
    blockers.push("Qualification checklist is incomplete.");
  }
  if (!input.duplicateCheckCompleted) {
    blockers.push("Account/contact duplicate check has not been completed.");
  }
  if (!input.hasAmount) {
    blockers.push("Estimated opportunity value is required.");
  }
  if (!input.hasExpectedCloseDate) {
    blockers.push("Expected close date is required.");
  }
  if (!input.hasOwner) {
    blockers.push("A lead or opportunity owner must be assigned.");
  }
  if (!input.hasNextStep) {
    blockers.push("A next step is required before conversion.");
  }
  if (!input.hasProductContext) {
    blockers.push("Lead product or solution context is required before conversion.");
  }

  return {
    ready: blockers.length === 0,
    blockers
  };
}
