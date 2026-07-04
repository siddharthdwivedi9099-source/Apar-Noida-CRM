-- migrate:up
-- Persona 19 (Partner Manager) PM-002: configurable structured onboarding checklist. Idempotent.
-- All other Partner Manager state reuses the existing partners / partner_deal_registrations /
-- partner_onboarding_tasks tables and partner metadata.
INSERT INTO tenant_option_sets (tenant_id, set_key, module_key, kind, name, description, is_system_set, is_active, metadata)
SELECT t.id, 'partner-onboarding-checklist', 'partners', 'dropdown', 'Partner Onboarding Checklist',
       'Configurable structured onboarding steps for new channel partners (PM-002).', true, true,
       '{"seeded": true, "phase": "phase-53-partner-mgmt"}'::jsonb
FROM tenants t
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_sets s WHERE s.tenant_id = t.id AND s.set_key = 'partner-onboarding-checklist');

INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata, color)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, v.is_default, true, '{}'::jsonb, v.color
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('agreement', 'Agreement executed', 0, true, '#0ea5e9'),
  ('profile', 'Profile completion', 1, false, '#6366f1'),
  ('portal_access', 'Portal access created', 2, false, '#06b6d4'),
  ('product_training', 'Product training', 3, false, '#22c55e'),
  ('sales_training', 'Sales training', 4, false, '#14b8a6'),
  ('certification', 'Certification', 5, false, '#8b5cf6'),
  ('marketing_assets', 'Marketing assets', 6, false, '#f59e0b'),
  ('first_deal_plan', 'First deal plan', 7, false, '#ef4444')
) AS v(value_key, label, sort_order, is_default, color)
WHERE s.set_key = 'partner-onboarding-checklist' AND s.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_values ov WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key);

-- migrate:down
DELETE FROM tenant_option_values ov
USING tenant_option_sets s
WHERE s.id = ov.option_set_id AND s.tenant_id = ov.tenant_id AND s.set_key = 'partner-onboarding-checklist';

DELETE FROM tenant_option_sets WHERE set_key = 'partner-onboarding-checklist';
