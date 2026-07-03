// ============================================================================
// Section 14: Required Notifications (configurable notification-rule registry)
//
// The 30 required notifications are defined as data — governed `notification_rule`
// configuration definitions (event → audience → channel → template → frequency)
// seeded per tenant and editable from the configuration engine, not hard-coded.
// Each rule also records the valid in-app notification type it maps to, a severity,
// and — honestly — whether it is actively emitted today (via a Section 12 workflow
// or a service gate) or is a defined policy still pending a trigger hook. This
// avoids overclaiming: the catalogue is the governed policy; `emission` states the
// truth about delivery.
// ============================================================================

import type { ConfigurationDefinition, NotificationChannel, NotificationFrequency } from "./configuration-definitions.js";
import type { NotificationType } from "./notifications.js";

export type NotificationSeverity = "info" | "warning" | "critical";
// "service"  -> emitted by service code on the real business event (fires today).
// "workflow" -> emitted by a seeded Section 12 workflow's send_notification action.
// "policy"   -> defined + governed, but its trigger (often time-based) is not wired yet.
export type NotificationEmission = "service" | "workflow" | "policy";

export interface NotificationRuleDefinition {
  key: string;
  label: string;
  event: string;
  audience: string;
  channel: NotificationChannel;
  template: string;
  frequency: NotificationFrequency;
  notificationType: NotificationType;
  severity: NotificationSeverity;
  emission: NotificationEmission;
  // Where the notification is (or will be) emitted from.
  emittedBy: string;
}

const rule = (
  key: string,
  label: string,
  event: string,
  audience: string,
  notificationType: NotificationType,
  severity: NotificationSeverity,
  emission: NotificationEmission,
  emittedBy: string,
  channel: NotificationChannel = "in_app",
  frequency: NotificationFrequency = "immediate"
): NotificationRuleDefinition => ({ key, label, event, audience, channel, template: `${key}_template`, frequency, notificationType, severity, emission, emittedBy });

export const notificationRuleCatalog: NotificationRuleDefinition[] = [
  rule("new_lead_assigned", "New lead assigned", "lead.assigned", "lead_owner", "record_assignment", "info", "workflow", "workflow: auto-create-lead-from-form / auto-route-mql (send_notification)"),
  rule("hot_lead_created", "Hot lead created", "lead.hot_created", "lead_owner", "record_assignment", "warning", "workflow", "workflow: auto-escalate-hot-lead (score threshold)"),
  rule("mql_ready_for_sales", "MQL ready for sales", "lead.mql_ready", "sales_owner", "record_assignment", "info", "workflow", "workflow: auto-mark-mql (MQL computed by crm R1, routed by workflow)"),
  rule("lead_sla_nearing_breach", "Lead SLA nearing breach", "lead.sla_nearing", "lead_owner", "customer_escalation", "warning", "policy", "time-based SLA monitor (pending scheduled job)"),
  rule("lead_sla_breached", "Lead SLA breached", "lead.sla_breached", "sales_manager", "customer_escalation", "critical", "workflow", "workflow: auto-escalate-hot-lead (sla_breached trigger)"),
  rule("meeting_booked", "Meeting booked", "meeting.booked", "opportunity_owner", "record_assignment", "info", "policy", "meeting workspace (pending emit hook)"),
  rule("demo_requested", "Demo requested", "demo.requested", "presales", "record_assignment", "info", "service", "opportunities.requestOpportunityDemo (notifies presales owner)"),
  rule("demo_completed", "Demo completed", "demo.completed", "opportunity_owner", "record_assignment", "info", "policy", "demo feedback update (pending emit hook)"),
  rule("proposal_due", "Proposal due", "proposal.due", "opportunity_owner", "record_assignment", "warning", "policy", "time-based proposal reminder (pending scheduled job)"),
  rule("proposal_decided", "Proposal approved/rejected", "proposal.decided", "opportunity_owner", "approval_decided", "info", "service", "approvals.decide (proposal_approval decision -> approval_decided)"),
  rule("discount_approval_needed", "Discount approval needed", "discount.approval_needed", "sales_manager", "approval_requested", "warning", "workflow", "workflow: auto-trigger-discount-approval (trigger_approval -> approver notified)"),
  rule("contract_review_needed", "Contract review needed", "contract.review_needed", "legal", "approval_requested", "warning", "workflow", "workflow: auto-trigger-legal-review (trigger_approval -> legal notified)"),
  rule("strategic_deal_risk", "Strategic deal risk", "opportunity.strategic_risk", "sales_head", "customer_escalation", "critical", "workflow", "workflow: auto-alert-sales-head-strategic-risk"),
  rule("opportunity_stagnant", "Opportunity stagnant", "opportunity.stagnant", "sales_manager", "customer_escalation", "warning", "workflow", "workflow: auto-alert-manager-stagnant-deal"),
  rule("opportunity_close_date_changed", "Opportunity close date changed", "opportunity.close_date_changed", "opportunity_owner", "record_assignment", "info", "service", "opportunities.updateOpportunity (notifies owner on close-date change)"),
  rule("opportunity_closed_won", "Opportunity closed won", "opportunity.closed_won", "cs_manager", "record_assignment", "info", "service", "opportunities.closeOpportunityWon (onboarding handover notification)"),
  rule("opportunity_closed_lost", "Opportunity closed lost", "opportunity.closed_lost", "sales_manager", "record_assignment", "info", "policy", "closeOpportunityLost (pending emit hook)"),
  rule("onboarding_project_created", "Onboarding project created", "onboarding.created", "cs_manager", "record_assignment", "info", "workflow", "workflow: auto-create-onboarding-after-won (send_notification)"),
  rule("onboarding_task_overdue", "Onboarding task overdue", "onboarding.task_overdue", "cs_owner", "customer_escalation", "warning", "policy", "time-based onboarding monitor (pending scheduled job)"),
  rule("ticket_assigned", "Ticket assigned", "ticket.assigned", "ticket_owner", "record_assignment", "info", "service", "support reassignment notification (record_assignment)"),
  rule("ticket_sla_nearing_breach", "Ticket SLA nearing breach", "ticket.sla_nearing", "support_agent", "customer_escalation", "warning", "policy", "time-based ticket SLA monitor (pending scheduled job)"),
  rule("ticket_escalated", "Ticket escalated", "ticket.escalated", "support_manager", "customer_escalation", "critical", "service", "support escalation notification + workflow auto-escalate-sla-breached-ticket"),
  rule("ticket_closed", "Ticket closed", "ticket.closed", "ticket_owner", "record_assignment", "info", "service", "support.closeTicket (notifies ticket owner)"),
  rule("customer_health_red", "Customer health changed to red", "cs.health_red", "cs_manager", "customer_escalation", "critical", "workflow", "workflow: auto-trigger-churn-playbook (customer_health_changed)"),
  rule("renewal_due", "Renewal due", "renewal.due", "cs_manager", "record_assignment", "warning", "workflow", "workflow: auto-create-renewal-opportunity (renewal_approaching)"),
  rule("expansion_signal_detected", "Expansion signal detected", "cs.expansion_signal", "cs_owner", "record_assignment", "info", "policy", "customer-success expansion detection (pending emit hook)"),
  rule("partner_deal_registered", "Partner deal registered", "partner.deal_registered", "partner_manager", "record_assignment", "info", "service", "partners.createPartnerDeal (notifies partner owner)"),
  rule("partner_conflict_detected", "Partner conflict detected", "partner.conflict_detected", "partner_manager", "customer_escalation", "warning", "service", "partners.resolveChannelConflict notification + workflow auto-detect-partner-conflict"),
  rule("ai_low_confidence_alert", "AI low confidence alert", "ai.low_confidence", "ai_governance_manager", "sensitive_ai_action", "warning", "policy", "ai-actions holds sensitive runs in pending_review; governance notification hook pending"),
  rule("data_quality_issue_detected", "Data quality issue detected", "data.quality_issue", "data_steward", "system_announcement", "info", "policy", "data-quality module (pending emit hook)")
];

export function findNotificationRule(key: string): NotificationRuleDefinition | undefined {
  return notificationRuleCatalog.find((entry) => entry.key === key);
}

export function notificationRuleForEvent(event: string): NotificationRuleDefinition | undefined {
  return notificationRuleCatalog.find((entry) => entry.event === event);
}

// ---------------------------------------------------------------------------
// Seed — one governed `notification_rule` configuration definition per rule
// (the config engine models notification rules as one event per definition).
// ---------------------------------------------------------------------------

const NOTIFICATION_RULE_PHASE = "section-14-notifications";

export const defaultNotificationRuleConfigurationDefinitions: ConfigurationDefinition[] = notificationRuleCatalog.map((entry) => ({
  definitionType: "notification_rule",
  definitionKey: entry.key,
  name: entry.label,
  description: `Notify ${entry.audience} on ${entry.event} (${entry.severity}).`,
  isActive: true,
  definition: {
    event: entry.event,
    audience: entry.audience,
    channel: entry.channel,
    template: entry.template,
    frequency: entry.frequency,
    notificationType: entry.notificationType,
    severity: entry.severity,
    emission: entry.emission,
    emittedBy: entry.emittedBy,
    metadata: { phase: NOTIFICATION_RULE_PHASE }
  }
}));
