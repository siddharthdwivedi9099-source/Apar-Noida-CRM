-- migrate:up
-- Persona 23 (Support Manager) SPM-003: configurable SLA-breach reason categories captured when a
-- manager reviews a breached ticket. All other Support Manager state reuses the existing
-- support_tickets table + metadata (performance, workload, escalation oversight, CSAT).
INSERT INTO tenant_option_sets (tenant_id, set_key, module_key, kind, name, description, is_system_set, is_active, metadata)
SELECT t.id, 'support-breach-reason', 'support', 'dropdown', 'Support Breach Reason',
       'SLA-breach reason categories captured during manager breach review (SPM-003).', true, true,
       '{"seeded": true, "phase": "phase-56-support-manager"}'::jsonb
FROM tenants t
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_sets s WHERE s.tenant_id = t.id AND s.set_key = 'support-breach-reason');

INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata, color)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, v.is_default, true, '{}'::jsonb, v.color
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('high_volume', 'High Ticket Volume', 0, true, '#f59e0b'),
  ('staffing_gap', 'Staffing Gap', 1, false, '#ef4444'),
  ('complex_issue', 'Complex Issue', 2, false, '#8b5cf6'),
  ('awaiting_customer', 'Awaiting Customer', 3, false, '#0ea5e9'),
  ('awaiting_third_party', 'Awaiting Third Party', 4, false, '#a16207'),
  ('process_delay', 'Process Delay', 5, false, '#14b8a6'),
  ('misrouted', 'Misrouted Ticket', 6, false, '#64748b')
) AS v(value_key, label, sort_order, is_default, color)
WHERE s.set_key = 'support-breach-reason' AND s.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_values ov WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key);

-- migrate:down
DELETE FROM tenant_option_values ov
USING tenant_option_sets s
WHERE s.id = ov.option_set_id AND s.tenant_id = ov.tenant_id AND s.set_key = 'support-breach-reason';

DELETE FROM tenant_option_sets WHERE set_key = 'support-breach-reason';
