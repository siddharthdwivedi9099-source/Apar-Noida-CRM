-- migrate:up
-- Persona 22 (Support Agent L2) L2-003: allow the rca_share_approval approval type so a
-- root-cause analysis can be shared with the customer only after approval.
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
    'configuration_change_approval',
    'delivery_risk_approval',
    'payment_terms_approval',
    'partner_commission_approval',
    'legal_clause_approval',
    'rca_share_approval'
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
    'deal_review_approval',
    'configuration_change_approval',
    'delivery_risk_approval',
    'payment_terms_approval',
    'partner_commission_approval',
    'legal_clause_approval'
  ));
