-- migrate:up
-- Persona 18 (Legal / Contract Reviewer): legal_clause_approval type (LEG-002) and the
-- configurable legal-contract-type option set (LEG-001). The per-opportunity legal review
-- workspace lives in opportunity metadata.
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

-- Backfill the legal-contract-type option set for existing tenants (idempotent).
INSERT INTO tenant_option_sets (tenant_id, set_key, module_key, kind, name, description, is_system_set, is_active, metadata)
SELECT t.id, 'legal-contract-type', 'sales', 'dropdown', 'Legal Contract Type',
       'Contract document types routed for legal review (LEG-001).', true, true,
       '{"seeded": true, "phase": "phase-52-legal"}'::jsonb
FROM tenants t
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_sets s WHERE s.tenant_id = t.id AND s.set_key = 'legal-contract-type');

INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata, color)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, v.is_default, true, '{}'::jsonb, v.color
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('nda', 'NDA', 0, true, '#0ea5e9'),
  ('msa', 'Master Service Agreement', 1, false, '#6366f1'),
  ('sow', 'Statement of Work', 2, false, '#22c55e'),
  ('dpa', 'Data Processing Agreement', 3, false, '#ef4444'),
  ('order_form', 'Order Form', 4, false, '#f59e0b'),
  ('amendment', 'Amendment', 5, false, '#8b5cf6')
) AS v(value_key, label, sort_order, is_default, color)
WHERE s.set_key = 'legal-contract-type' AND s.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_values ov WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key);

-- migrate:down
DELETE FROM tenant_option_values ov
USING tenant_option_sets s
WHERE s.id = ov.option_set_id AND s.tenant_id = ov.tenant_id AND s.set_key = 'legal-contract-type';

DELETE FROM tenant_option_sets WHERE set_key = 'legal-contract-type';

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
    'partner_commission_approval'
  ));
