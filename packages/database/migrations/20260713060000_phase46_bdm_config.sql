-- migrate:up
-- Persona 11 (BDM): market-signal-type set (BDM-002) + business_development opportunity source (BDM-004). Idempotent.

INSERT INTO tenant_option_sets (tenant_id, set_key, module_key, kind, name, description, is_system_set, is_active, metadata)
SELECT t.id, 'bd-market-signal-type', 'business_development', 'dropdown', 'BD Market Signal Type',
       'Market-intelligence signal categories captured by business development managers (BDM-002).', true, true,
       '{"seeded": true, "phase": "phase-46-bdm"}'::jsonb
FROM tenants t
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_sets s WHERE s.tenant_id = t.id AND s.set_key = 'bd-market-signal-type');

INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, v.is_default, true, '{}'::jsonb
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('competitor', 'Competitor insight', 0, true),
  ('pricing', 'Pricing signal', 1, false),
  ('objection', 'Objection', 2, false),
  ('customer_trend', 'Customer trend', 3, false),
  ('opportunity', 'Market opportunity', 4, false)
) AS v(value_key, label, sort_order, is_default)
WHERE s.set_key = 'bd-market-signal-type' AND s.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_values ov WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key);

-- Add the business_development opportunity source for existing tenants (BDM-004).
INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata, color)
SELECT s.tenant_id, s.id, 'business_development', 'Business Development', 8, false, true, '{}'::jsonb, '#0891b2'
FROM tenant_option_sets s
WHERE s.set_key = 'opportunity-source' AND s.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_values ov WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = 'business_development');

-- migrate:down
DELETE FROM tenant_option_values ov
USING tenant_option_sets s
WHERE s.id = ov.option_set_id AND s.tenant_id = ov.tenant_id AND s.set_key = 'bd-market-signal-type';

DELETE FROM tenant_option_sets WHERE set_key = 'bd-market-signal-type';

DELETE FROM tenant_option_values ov
USING tenant_option_sets s
WHERE s.id = ov.option_set_id AND s.tenant_id = ov.tenant_id AND s.set_key = 'opportunity-source' AND ov.value_key = 'business_development';
