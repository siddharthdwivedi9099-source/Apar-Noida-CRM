-- migrate:up
-- Persona 10 (Enterprise Sales) — RFP/tender checklist (ES-003) config backfill. Idempotent.

INSERT INTO tenant_option_sets (tenant_id, set_key, module_key, kind, name, description, is_system_set, is_active, metadata)
SELECT t.id, 'opportunity-tender-checklist', 'opportunities', 'dropdown', 'Opportunity Tender Checklist',
       'Configurable RFP/tender document checklist (ES-003).', true, true,
       '{"seeded": true, "phase": "phase-45-enterprise"}'::jsonb
FROM tenants t
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_sets s WHERE s.tenant_id = t.id AND s.set_key = 'opportunity-tender-checklist');

INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, v.is_default, true, v.metadata::jsonb
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('eligibility_certificate', 'Eligibility certificate', 0, true, '{"required": true}'),
  ('technical_bid', 'Technical bid', 1, false, '{"required": true}'),
  ('commercial_bid', 'Commercial bid', 2, false, '{"required": true}'),
  ('emd_proof', 'EMD proof', 3, false, '{"required": true}'),
  ('compliance_sheet', 'Compliance sheet', 4, false, '{"required": true}'),
  ('authorization_letter', 'Authorization letter', 5, false, '{"required": false}'),
  ('financial_statements', 'Financial statements', 6, false, '{"required": false}'),
  ('experience_certificates', 'Experience certificates', 7, false, '{"required": false}')
) AS v(value_key, label, sort_order, is_default, metadata)
WHERE s.set_key = 'opportunity-tender-checklist' AND s.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_values ov WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key);

-- migrate:down
DELETE FROM tenant_option_values ov
USING tenant_option_sets s
WHERE s.id = ov.option_set_id AND s.tenant_id = ov.tenant_id AND s.set_key = 'opportunity-tender-checklist';

DELETE FROM tenant_option_sets WHERE set_key = 'opportunity-tender-checklist';
