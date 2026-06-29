-- migrate:up
-- Persona 13 (Sales Head) SH-005: allow the configuration_change_approval approval type
-- so RevOps-proposed process changes (configuration versions) can be governed by an
-- approval before publish.
ALTER TABLE approval_requests
  DROP CONSTRAINT IF EXISTS approval_requests_approval_type_check;

ALTER TABLE approval_requests
  ADD CONSTRAINT approval_requests_approval_type_check
  CHECK (approval_type IN (
    'discount_approval',
    'campaign_approval',
    'proposal_approval',
    'partner_approval',
    'reseller_approval',
    'sensitive_ai_action_approval',
    'customer_escalation_approval',
    'strategic_handoff_approval',
    'opportunity_reactivation_approval',
    'deal_review_approval',
    'configuration_change_approval'
  ));

-- migrate:down
ALTER TABLE approval_requests
  DROP CONSTRAINT IF EXISTS approval_requests_approval_type_check;

ALTER TABLE approval_requests
  ADD CONSTRAINT approval_requests_approval_type_check
  CHECK (approval_type IN (
    'discount_approval',
    'campaign_approval',
    'proposal_approval',
    'partner_approval',
    'reseller_approval',
    'sensitive_ai_action_approval',
    'customer_escalation_approval',
    'strategic_handoff_approval',
    'opportunity_reactivation_approval',
    'deal_review_approval'
  ));
