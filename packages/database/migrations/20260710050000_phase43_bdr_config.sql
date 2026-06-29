-- migrate:up
-- Persona 8 (BDR) — priority/technology segmentation (BDR-001), buyer roles (BDR-002),
-- outbound sequence (BDR-003) config backfill for existing tenants. Idempotent.

-- 1. Create the four BDR option sets per tenant.
INSERT INTO tenant_option_sets (tenant_id, set_key, module_key, kind, name, description, is_system_set, is_active, metadata)
SELECT t.id, v.set_key, 'business_development', 'dropdown', v.name, v.description, true, true,
       '{"seeded": true, "phase": "phase-43-bdr"}'::jsonb
FROM tenants t
CROSS JOIN (VALUES
  ('bd-account-priority', 'BD Account Priority', 'Outbound prioritization for target accounts (BDR-001).'),
  ('bd-technology', 'BD Account Technology', 'Technology stack tags used to segment target accounts (BDR-001).'),
  ('bd-buyer-role', 'BD Buyer Role', 'Buying-committee roles for stakeholder mapping (BDR-002).'),
  ('bd-sequence-step', 'BD Outbound Sequence', 'Configurable outbound sequence steps (BDR-003).')
) AS v(set_key, name, description)
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM tenant_option_sets s WHERE s.tenant_id = t.id AND s.set_key = v.set_key
  );

-- 2. Priority values.
INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata, color)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, v.is_default, true, '{}'::jsonb, v.color
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('strategic', 'Strategic', 0, false, '#6366f1'),
  ('high', 'High', 1, false, '#ef4444'),
  ('medium', 'Medium', 2, true, '#f59e0b'),
  ('low', 'Low', 3, false, '#64748b')
) AS v(value_key, label, sort_order, is_default, color)
WHERE s.set_key = 'bd-account-priority' AND s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM tenant_option_values ov WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key
  );

-- 3. Technology values.
INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, v.is_default, true, '{}'::jsonb
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('salesforce', 'Salesforce', 0, true),
  ('microsoft', 'Microsoft', 1, false),
  ('aws', 'AWS', 2, false),
  ('azure', 'Azure', 3, false),
  ('gcp', 'Google Cloud', 4, false),
  ('sap', 'SAP', 5, false),
  ('oracle', 'Oracle', 6, false),
  ('custom', 'Custom / In-house', 7, false)
) AS v(value_key, label, sort_order, is_default)
WHERE s.set_key = 'bd-technology' AND s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM tenant_option_values ov WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key
  );

-- 4. Buyer role values.
INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, v.is_default, true, '{}'::jsonb
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('decision_maker', 'Decision Maker', 0, true),
  ('influencer', 'Influencer', 1, false),
  ('evaluator', 'Evaluator', 2, false),
  ('procurement', 'Procurement', 3, false),
  ('finance', 'Finance', 4, false),
  ('technical', 'Technical', 5, false),
  ('user', 'User', 6, false),
  ('executive', 'Executive', 7, false)
) AS v(value_key, label, sort_order, is_default)
WHERE s.set_key = 'bd-buyer-role' AND s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM tenant_option_values ov WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key
  );

-- 5. Outbound sequence steps.
INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, v.is_default, true, v.metadata::jsonb
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('email_day0', 'Day 0 - Intro email', 0, true, '{"channel": "email", "offsetHours": 0}'),
  ('linkedin_day1', 'Day 1 - LinkedIn touch', 1, false, '{"channel": "linkedin", "offsetHours": 24}'),
  ('call_day2', 'Day 2 - Call', 2, false, '{"channel": "call", "offsetHours": 48}'),
  ('email_day4', 'Day 4 - Value email', 3, false, '{"channel": "email", "offsetHours": 96}'),
  ('whatsapp_day6', 'Day 6 - WhatsApp/SMS', 4, false, '{"channel": "whatsapp", "offsetHours": 144}'),
  ('task_day8', 'Day 8 - Breakup task', 5, false, '{"channel": "task", "offsetHours": 192}')
) AS v(value_key, label, sort_order, is_default, metadata)
WHERE s.set_key = 'bd-sequence-step' AND s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM tenant_option_values ov WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key
  );

-- migrate:down
DELETE FROM tenant_option_values ov
USING tenant_option_sets s
WHERE s.id = ov.option_set_id
  AND s.tenant_id = ov.tenant_id
  AND s.set_key IN ('bd-account-priority', 'bd-technology', 'bd-buyer-role', 'bd-sequence-step');

DELETE FROM tenant_option_sets
WHERE set_key IN ('bd-account-priority', 'bd-technology', 'bd-buyer-role', 'bd-sequence-step');
