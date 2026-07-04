-- migrate:up
-- Persona 14 (Presales Consultant) PS-002: configurable demo preparation checklist. Idempotent.

INSERT INTO tenant_option_sets (tenant_id, set_key, module_key, kind, name, description, is_system_set, is_active, metadata)
SELECT t.id, 'presales-demo-checklist', 'presales', 'dropdown', 'Presales Demo Checklist',
       'Configurable preparation checklist for tailored presales demos (PS-002).', true, true,
       '{"seeded": true, "phase": "phase-48-presales"}'::jsonb
FROM tenants t
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_sets s WHERE s.tenant_id = t.id AND s.set_key = 'presales-demo-checklist');

INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata, color)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, v.is_default, true, '{}'::jsonb, v.color
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('environment_ready', 'Demo environment ready', 0, true, '#0ea5e9'),
  ('data_seeded', 'Demo data seeded', 1, false, '#22c55e'),
  ('script_prepared', 'Demo script prepared', 2, false, '#6366f1'),
  ('stakeholders_confirmed', 'Stakeholders confirmed', 3, false, '#f59e0b'),
  ('objections_prepared', 'Objection handling prepared', 4, false, '#8b5cf6'),
  ('success_criteria_aligned', 'Success criteria aligned', 5, false, '#14b8a6')
) AS v(value_key, label, sort_order, is_default, color)
WHERE s.set_key = 'presales-demo-checklist' AND s.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_values ov WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key);

-- migrate:down
DELETE FROM tenant_option_values ov
USING tenant_option_sets s
WHERE s.id = ov.option_set_id AND s.tenant_id = ov.tenant_id AND s.set_key = 'presales-demo-checklist';

DELETE FROM tenant_option_sets WHERE set_key = 'presales-demo-checklist';
