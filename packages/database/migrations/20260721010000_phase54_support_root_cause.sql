-- migrate:up
-- Persona 21 (Support Agent L1) L1-005: configurable root-cause categories captured at
-- ticket closure. All other L1 state reuses the existing support_tickets table + metadata.
INSERT INTO tenant_option_sets (tenant_id, set_key, module_key, kind, name, description, is_system_set, is_active, metadata)
SELECT t.id, 'support-root-cause', 'support', 'dropdown', 'Support Root Cause',
       'Root-cause categories captured at ticket closure (L1-005).', true, true,
       '{"seeded": true, "phase": "phase-54-support-l1"}'::jsonb
FROM tenants t
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_sets s WHERE s.tenant_id = t.id AND s.set_key = 'support-root-cause');

INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata, color)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, v.is_default, true, '{}'::jsonb, v.color
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('user_error', 'User Error', 0, true, '#64748b'),
  ('configuration', 'Configuration', 1, false, '#0ea5e9'),
  ('software_defect', 'Software Defect', 2, false, '#ef4444'),
  ('integration', 'Integration', 3, false, '#14b8a6'),
  ('data_issue', 'Data Issue', 4, false, '#f59e0b'),
  ('training_gap', 'Training Gap', 5, false, '#8b5cf6'),
  ('third_party', 'Third Party', 6, false, '#a16207')
) AS v(value_key, label, sort_order, is_default, color)
WHERE s.set_key = 'support-root-cause' AND s.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_values ov WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key);

-- migrate:down
DELETE FROM tenant_option_values ov
USING tenant_option_sets s
WHERE s.id = ov.option_set_id AND s.tenant_id = ov.tenant_id AND s.set_key = 'support-root-cause';

DELETE FROM tenant_option_sets WHERE set_key = 'support-root-cause';
