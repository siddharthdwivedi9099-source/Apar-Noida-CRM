-- migrate:up
-- AE-010: allow the opportunity_reactivation_approval approval type.
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
    'opportunity_reactivation_approval'
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
    'strategic_handoff_approval'
  ));
