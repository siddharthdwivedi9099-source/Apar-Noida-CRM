-- migrate:up
-- Persona 9 (Account Executive) — discovery fields (AE-004), stakeholder roles (AE-003),
-- proposal templates (AE-006) config backfill for existing tenants. Idempotent.

INSERT INTO tenant_option_sets (tenant_id, set_key, module_key, kind, name, description, is_system_set, is_active, metadata)
SELECT t.id, v.set_key, 'opportunities', 'dropdown', v.name, v.description, true, true,
       '{"seeded": true, "phase": "phase-44-ae"}'::jsonb
FROM tenants t
CROSS JOIN (VALUES
  ('opportunity-discovery-field', 'Opportunity Discovery Field', 'Configurable AE discovery-call fields (AE-004).'),
  ('opportunity-stakeholder-role', 'Opportunity Stakeholder Role', 'Buying-committee roles for opportunity stakeholder mapping (AE-003).'),
  ('opportunity-proposal-template', 'Opportunity Proposal Template', 'Configurable proposal templates for AE proposal generation (AE-006).')
) AS v(set_key, name, description)
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_sets s WHERE s.tenant_id = t.id AND s.set_key = v.set_key);

-- Discovery fields (AE-004).
INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, v.is_default, true, v.metadata::jsonb
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('business_problem', 'Business problem', 0, true, '{"required": true, "critical": true}'),
  ('current_process', 'Current process', 1, false, '{"required": false, "critical": false}'),
  ('urgency', 'Urgency', 2, false, '{"required": true, "critical": false}'),
  ('success_metrics', 'Success metrics', 3, false, '{"required": true, "critical": false}'),
  ('budget', 'Budget', 4, false, '{"required": true, "critical": true}'),
  ('timeline', 'Timeline', 5, false, '{"required": true, "critical": false}'),
  ('decision_criteria', 'Decision criteria', 6, false, '{"required": true, "critical": true}'),
  ('procurement_process', 'Procurement process', 7, false, '{"required": false, "critical": false}'),
  ('risks', 'Risks', 8, false, '{"required": false, "critical": false}')
) AS v(value_key, label, sort_order, is_default, metadata)
WHERE s.set_key = 'opportunity-discovery-field' AND s.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_values ov WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key);

-- Stakeholder roles (AE-003).
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
WHERE s.set_key = 'opportunity-stakeholder-role' AND s.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_values ov WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key);

-- Proposal templates (AE-006).
INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, v.is_default, true, '{}'::jsonb
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('standard', 'Standard proposal', 0, true),
  ('enterprise', 'Enterprise proposal', 1, false),
  ('services', 'Services / SOW', 2, false)
) AS v(value_key, label, sort_order, is_default)
WHERE s.set_key = 'opportunity-proposal-template' AND s.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_values ov WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key);

-- migrate:down
DELETE FROM tenant_option_values ov
USING tenant_option_sets s
WHERE s.id = ov.option_set_id
  AND s.tenant_id = ov.tenant_id
  AND s.set_key IN ('opportunity-discovery-field', 'opportunity-stakeholder-role', 'opportunity-proposal-template');

DELETE FROM tenant_option_sets
WHERE set_key IN ('opportunity-discovery-field', 'opportunity-stakeholder-role', 'opportunity-proposal-template');
