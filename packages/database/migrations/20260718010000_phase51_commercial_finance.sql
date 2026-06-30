-- migrate:up
-- Persona 17 (Commercial / Finance Approver): payment-terms + partner-commission approval types
-- (FIN-003, FIN-004) and the configurable payment-term + discount-approval-tier option sets
-- (FIN-002, FIN-003). The per-opportunity commercial workspace lives in opportunity metadata.
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

-- Backfill the commercial option sets for existing tenants (idempotent).
INSERT INTO tenant_option_sets (tenant_id, set_key, module_key, kind, name, description, is_system_set, is_active, metadata)
SELECT t.id, v.set_key, 'sales', 'dropdown', v.name, v.description, true, true, '{"seeded": true, "phase": "phase-51-commercial"}'::jsonb
FROM tenants t
CROSS JOIN (VALUES
  ('payment-term', 'Payment Term', 'Quote/contract payment terms; non-standard terms require finance approval (FIN-003).'),
  ('discount-approval-tier', 'Discount Approval Tier', 'Configurable discount approval matrix; thresholdPct is the upper discount bound for each tier (FIN-002).')
) AS v(set_key, name, description)
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_sets s WHERE s.tenant_id = t.id AND s.set_key = v.set_key);

INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata, color)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, v.is_default, true, v.metadata::jsonb, v.color
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('payment-term', 'net_30', 'Net 30', 0, true, '{"standard": true}', '#22c55e'),
  ('payment-term', 'net_45', 'Net 45', 1, false, '{"standard": true}', '#0ea5e9'),
  ('payment-term', 'net_60', 'Net 60', 2, false, '{"standard": true}', '#6366f1'),
  ('payment-term', 'advance', 'Advance Payment', 3, false, '{"standard": false}', '#f59e0b'),
  ('payment-term', 'milestone', 'Milestone-based', 4, false, '{"standard": false}', '#8b5cf6'),
  ('payment-term', 'custom', 'Custom', 5, false, '{"standard": false}', '#ef4444'),
  ('discount-approval-tier', 'standard', 'Standard (auto)', 0, true, '{"thresholdPct": 10, "requiresApproval": false, "approverRole": null}', '#22c55e'),
  ('discount-approval-tier', 'manager', 'Manager', 1, false, '{"thresholdPct": 20, "requiresApproval": true, "approverRole": "sales-manager"}', '#0ea5e9'),
  ('discount-approval-tier', 'finance', 'Finance', 2, false, '{"thresholdPct": 35, "requiresApproval": true, "approverRole": "finance"}', '#f59e0b'),
  ('discount-approval-tier', 'executive', 'Executive', 3, false, '{"thresholdPct": 100, "requiresApproval": true, "approverRole": "sales-head"}', '#ef4444')
) AS v(set_key, value_key, label, sort_order, is_default, metadata, color)
WHERE s.set_key = v.set_key AND s.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_values ov WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key);

-- migrate:down
DELETE FROM tenant_option_values ov
USING tenant_option_sets s
WHERE s.id = ov.option_set_id AND s.tenant_id = ov.tenant_id AND s.set_key IN ('payment-term', 'discount-approval-tier');

DELETE FROM tenant_option_sets WHERE set_key IN ('payment-term', 'discount-approval-tier');

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
    'delivery_risk_approval'
  ));
