// ============================================================================
// Section 13: Required Validation Rules (configurable, deterministic engine)
//
// A single, tenant-configurable catalogue for the 15 required validation rules.
// Each rule is data (key, entity, transition, severity, enabled, params) and is
// evaluated by a pure, unit-tested resolver returning structured violations.
// Rules are seeded as `validation_rule` configuration definitions so admins can
// enable/disable and tune them without code changes; enforcement points call
// the matching resolver. Several rules are already enforced in module services
// (close-lost loss reason, support resolution summary + RCA, discount/margin on
// close, ES-005 strategic review); this layer makes the full set first-class,
// configurable, and centrally defined, and adds enforcement for the gaps.
// ============================================================================

import type { ConfigurationDefinition } from "./configuration-definitions.js";

export type ValidationSeverity = "error" | "warning";

export interface ValidationRuleDefinition {
  key: string;
  entity: "lead" | "opportunity" | "proposal" | "demo" | "support_ticket" | "partner_deal" | "ai_action" | "record";
  transition: string;
  description: string;
  severity: ValidationSeverity;
  defaultEnabled: boolean;
  // Configurable parameters (thresholds, required-field lists) surfaced to admins.
  params?: Record<string, unknown>;
  // Where the rule is enforced today: "service" (live gate) or "catalog" (defined,
  // pending an enforcement hook at its endpoint).
  enforcement: "service" | "catalog";
  // Human-readable pointer to the enforcement site (for traceability/audit).
  enforcedBy?: string;
}

export interface ValidationViolation {
  ruleKey: string;
  field: string | null;
  message: string;
}

export interface ValidationOutcome {
  valid: boolean;
  violations: ValidationViolation[];
}

// ---------------------------------------------------------------------------
// Catalogue — the 15 required validation rules as data.
// ---------------------------------------------------------------------------

export const validationRuleCatalog: ValidationRuleDefinition[] = [
  { key: "lead_mql_requires_score_consent", entity: "lead", transition: "to_mql", severity: "error", defaultEnabled: true, enforcement: "service", enforcedBy: "crm.createLead/updateLead compute MQL via evaluateMqlReadiness + evaluateMql (mql_rule); the flag is only set when score + consent are present and the rule passes",
    description: "Lead cannot become MQL without a score and a consent status.", params: { requiredFields: ["score", "consentStatus"] } },
  { key: "lead_sql_requires_qualification", entity: "lead", transition: "to_sql", severity: "error", defaultEnabled: true, enforcement: "service", enforcedBy: "crm.convertLead readiness (BANT qualification checklist)",
    description: "Lead cannot become SQL without qualification fields (budget, authority, need, timeline).", params: { requiredFields: ["budget", "authority", "need", "timeline"] } },
  { key: "lead_convert_requires_account_contact", entity: "lead", transition: "convert", severity: "error", defaultEnabled: true, enforcement: "service", enforcedBy: "crm.convertLead (evaluateLeadConversionReadiness + account/contact matching)",
    description: "Lead cannot convert without a validated account and contact.", params: { requiredFields: ["accountId", "contactId"] } },
  { key: "opp_proposal_requires_discovery", entity: "opportunity", transition: "to_proposal", severity: "error", defaultEnabled: true, enforcement: "service", enforcedBy: "opportunities.updateOpportunity (critical discovery gate)",
    description: "Opportunity cannot move to proposal without discovery completion." },
  { key: "opp_negotiation_requires_proposal", entity: "opportunity", transition: "to_negotiation", severity: "error", defaultEnabled: true, enforcement: "service", enforcedBy: "opportunities.updateOpportunity (ES-005 strategic review before negotiation)",
    description: "Opportunity cannot move to negotiation without a submitted proposal." },
  { key: "opp_close_won_requires_completion", entity: "opportunity", transition: "close_won", severity: "error", defaultEnabled: true, enforcement: "service", enforcedBy: "opportunities.closeOpportunityWon (evaluateCloseWon)",
    description: "Opportunity cannot close won without final value, contract/PO status, and handover note.", params: { requiredFields: ["finalValue", "contractStatus", "poStatus", "handoverNote"] } },
  { key: "opp_close_lost_requires_reason", entity: "opportunity", transition: "close_lost", severity: "error", defaultEnabled: true, enforcement: "service", enforcedBy: "opportunities.closeOpportunityLost (loss-reason option required)",
    description: "Opportunity cannot close lost without a loss reason." },
  { key: "proposal_discount_requires_approval", entity: "proposal", transition: "submit", severity: "error", defaultEnabled: true, enforcement: "service", enforcedBy: "opportunities close-won discount gate (unapproved discount blocks close)",
    description: "Discounted proposal cannot be submitted without approval." },
  { key: "opp_strategic_close_requires_review", entity: "opportunity", transition: "close_won", severity: "error", defaultEnabled: true, enforcement: "service", enforcedBy: "opportunities.updateOpportunity ES-005 + margin approval gate",
    description: "Strategic (high-value) deal cannot close without manager/sales-head review.", params: { strategicThreshold: 1000000 } },
  { key: "demo_requires_use_case_context", entity: "demo", transition: "submit", severity: "error", defaultEnabled: true, enforcement: "service", enforcedBy: "opportunity demo workspace (use-case/audience required)",
    description: "Demo request cannot be submitted without a use case and customer context.", params: { requiredFields: ["useCase", "audience"] } },
  { key: "ticket_close_requires_summary", entity: "support_ticket", transition: "close", severity: "error", defaultEnabled: true, enforcement: "service", enforcedBy: "support.closeTicket (resolution summary required)",
    description: "Support ticket cannot close without a resolution summary." },
  { key: "ticket_close_requires_rca", entity: "support_ticket", transition: "close", severity: "error", defaultEnabled: true, enforcement: "service", enforcedBy: "support.closeTicket (isRcaRequired gate)",
    description: "Critical ticket cannot close without RCA when RCA is required." },
  { key: "partner_deal_blocks_on_conflict", entity: "partner_deal", transition: "approve", severity: "error", defaultEnabled: true, enforcement: "service", enforcedBy: "partners.decidePartnerDeal (evaluatePartnerApproval)",
    description: "Partner deal cannot be approved while a duplicate conflict is unresolved." },
  { key: "ai_external_requires_approval", entity: "ai_action", transition: "send_external", severity: "error", defaultEnabled: true, enforcement: "service", enforcedBy: "ai-actions / ai-governance human-review gate (requires_review)",
    description: "AI cannot send external communication without user approval when governance requires it." },
  { key: "closed_record_edit_authorized_only", entity: "record", transition: "edit", severity: "error", defaultEnabled: true, enforcement: "service", enforcedBy: "opportunities.updateOpportunity (evaluateClosedRecordEdit)",
    description: "Closed records cannot be edited except by authorized roles.", params: { authorizedPermission: "opportunities.configure" } }
];

export function findValidationRule(key: string): ValidationRuleDefinition | undefined {
  return validationRuleCatalog.find((rule) => rule.key === key);
}

export function validationRulesForEntity(entity: ValidationRuleDefinition["entity"]): ValidationRuleDefinition[] {
  return validationRuleCatalog.filter((rule) => rule.entity === entity);
}

// ---------------------------------------------------------------------------
// Pure resolvers — deterministic, unit-tested. Each returns violations (empty
// when the transition is allowed). A missing value is anything null/undefined
// or a blank/whitespace string; numbers must be finite and > 0 where required.
// ---------------------------------------------------------------------------

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
}

function isPositiveNumber(value: unknown): boolean {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

export function evaluateRequiredFields(ruleKey: string, record: Record<string, unknown>, fields: string[]): ValidationViolation[] {
  return fields
    .filter((field) => isBlank(record[field]))
    .map((field) => ({ ruleKey, field, message: `${field} is required.` }));
}

function outcome(violations: ValidationViolation[]): ValidationOutcome {
  return { valid: violations.length === 0, violations };
}

// R1
export function evaluateMqlReadiness(lead: { score?: unknown; consentStatus?: unknown }): ValidationOutcome {
  const violations: ValidationViolation[] = [];
  const key = "lead_mql_requires_score_consent";
  if (lead.score === null || lead.score === undefined || !Number.isFinite(Number(lead.score))) {
    violations.push({ ruleKey: key, field: "score", message: "A lead score is required to qualify as MQL." });
  }
  if (isBlank(lead.consentStatus)) {
    violations.push({ ruleKey: key, field: "consentStatus", message: "A consent status is required to qualify as MQL." });
  }
  return outcome(violations);
}

// R2
export function evaluateSqlReadiness(lead: Record<string, unknown>, requiredFields = ["budget", "authority", "need", "timeline"]): ValidationOutcome {
  return outcome(evaluateRequiredFields("lead_sql_requires_qualification", lead, requiredFields));
}

// R3
export function evaluateLeadConversion(lead: { accountId?: unknown; contactId?: unknown }): ValidationOutcome {
  return outcome(evaluateRequiredFields("lead_convert_requires_account_contact", lead as Record<string, unknown>, ["accountId", "contactId"]));
}

// R4 / R5 — stage advancement gating
export function evaluateStageTransition(
  toStage: string,
  ctx: { discoveryComplete?: boolean; proposalSubmitted?: boolean }
): ValidationOutcome {
  const violations: ValidationViolation[] = [];
  if (toStage === "proposal" && ctx.discoveryComplete !== true) {
    violations.push({ ruleKey: "opp_proposal_requires_discovery", field: "discovery", message: "Discovery must be completed before moving to proposal." });
  }
  if (toStage === "negotiation" && ctx.proposalSubmitted !== true) {
    violations.push({ ruleKey: "opp_negotiation_requires_proposal", field: "proposal", message: "A proposal must be submitted before moving to negotiation." });
  }
  return outcome(violations);
}

// R6
export function evaluateCloseWon(
  closeWon: { finalValue?: unknown; contractStatus?: unknown; poStatus?: unknown; handoverNote?: unknown }
): ValidationOutcome {
  const key = "opp_close_won_requires_completion";
  const violations: ValidationViolation[] = [];
  if (!isPositiveNumber(closeWon.finalValue)) {
    violations.push({ ruleKey: key, field: "finalValue", message: "A final value greater than zero is required to close won." });
  }
  if (isBlank(closeWon.contractStatus)) {
    violations.push({ ruleKey: key, field: "contractStatus", message: "A contract status is required to close won." });
  }
  if (isBlank(closeWon.poStatus)) {
    violations.push({ ruleKey: key, field: "poStatus", message: "A PO status is required to close won." });
  }
  if (isBlank(closeWon.handoverNote)) {
    violations.push({ ruleKey: key, field: "handoverNote", message: "A handover note is required to close won." });
  }
  return outcome(violations);
}

// R7
export function evaluateCloseLost(closeLost: { lossReasonKey?: unknown }): ValidationOutcome {
  return outcome(
    isBlank(closeLost.lossReasonKey)
      ? [{ ruleKey: "opp_close_lost_requires_reason", field: "lossReasonKey", message: "A loss reason is required to close lost." }]
      : []
  );
}

// R8
export function evaluateProposalSubmission(proposal: { discountPercent?: unknown; discountApproved?: unknown }): ValidationOutcome {
  const discounted = isPositiveNumber(proposal.discountPercent);
  const approved = proposal.discountApproved === true;
  return outcome(
    discounted && !approved
      ? [{ ruleKey: "proposal_discount_requires_approval", field: "discountApproved", message: "A discounted proposal requires approval before submission." }]
      : []
  );
}

// R9
export function evaluateStrategicClose(
  amount: number | null | undefined,
  review: { approved?: boolean },
  strategicThreshold = 1000000
): ValidationOutcome {
  const strategic = typeof amount === "number" && Number.isFinite(amount) && amount >= strategicThreshold;
  return outcome(
    strategic && review.approved !== true
      ? [{ ruleKey: "opp_strategic_close_requires_review", field: "review", message: "A strategic deal requires manager/sales-head review before closing." }]
      : []
  );
}

// R10
export function evaluateDemoRequest(demo: Record<string, unknown>, requiredFields = ["useCase", "audience"]): ValidationOutcome {
  return outcome(evaluateRequiredFields("demo_requires_use_case_context", demo, requiredFields));
}

// R11 / R12
export function evaluateTicketClosure(
  ticket: { resolutionSummary?: unknown; rcaRequired?: boolean; rootCause?: unknown }
): ValidationOutcome {
  const violations: ValidationViolation[] = [];
  if (isBlank(ticket.resolutionSummary)) {
    violations.push({ ruleKey: "ticket_close_requires_summary", field: "resolutionSummary", message: "A resolution summary is required to close the ticket." });
  }
  if (ticket.rcaRequired === true && isBlank(ticket.rootCause)) {
    violations.push({ ruleKey: "ticket_close_requires_rca", field: "rootCause", message: "A root cause analysis is required to close this critical ticket." });
  }
  return outcome(violations);
}

// R13
export function evaluatePartnerApproval(deal: { conflictUnresolved?: boolean }): ValidationOutcome {
  return outcome(
    deal.conflictUnresolved === true
      ? [{ ruleKey: "partner_deal_blocks_on_conflict", field: "conflict", message: "Resolve the duplicate channel conflict before approving this partner deal." }]
      : []
  );
}

// R14
export function evaluateAiExternalComm(action: { governanceRequiresApproval?: boolean; approved?: boolean }): ValidationOutcome {
  return outcome(
    action.governanceRequiresApproval === true && action.approved !== true
      ? [{ ruleKey: "ai_external_requires_approval", field: "approval", message: "AI external communication requires user approval under the current governance policy." }]
      : []
  );
}

// R15
export function evaluateClosedRecordEdit(
  record: { isClosed?: boolean },
  actorPermissionCodes: string[],
  authorizedPermission = "opportunities.configure"
): ValidationOutcome {
  return outcome(
    record.isClosed === true && !actorPermissionCodes.includes(authorizedPermission)
      ? [{ ruleKey: "closed_record_edit_authorized_only", field: null, message: "This record is closed and can only be edited by an authorized role." }]
      : []
  );
}

// ---------------------------------------------------------------------------
// Seed — the catalogue as a tenant-scoped `validation_rule` configuration
// definition so the rules are governed, versionable, and admin-editable.
// ---------------------------------------------------------------------------

const VALIDATION_RULE_PHASE = "section-13-validation-rules";

export const defaultValidationRuleConfigurationDefinitions: ConfigurationDefinition[] = [
  {
    definitionType: "validation_rule",
    definitionKey: "crm-default",
    name: "CRM Validation Rules",
    description: "Required lifecycle validation rules across leads, opportunities, proposals, demos, support, partners, and AI governance.",
    isActive: true,
    definition: { rules: validationRuleCatalog, metadata: { phase: VALIDATION_RULE_PHASE } }
  }
];
