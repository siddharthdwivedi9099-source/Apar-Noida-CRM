-- migrate:up
-- Persona 7 (SDR) — discovery (SDR-003), objections (SDR-006), ICP criteria (SDR-002) config backfill.
-- New tenants receive these via the TS seed; this keeps already-provisioned tenants in sync. Idempotent.

-- 1. Create the three SDR option sets per tenant.
INSERT INTO tenant_option_sets (tenant_id, set_key, module_key, kind, name, description, is_system_set, is_active, metadata)
SELECT t.id, v.set_key, 'leads', 'dropdown', v.name, v.description, true, true,
       '{"seeded": true, "phase": "phase-42-sdr"}'::jsonb
FROM tenants t
CROSS JOIN (VALUES
  ('lead-discovery-field', 'Lead Discovery Field', 'Configurable SDR discovery-call fields (SDR-003).'),
  ('lead-objection-type', 'Lead Objection Type', 'Configurable objection categories captured during SDR conversations (SDR-006).'),
  ('lead-icp-criterion', 'Lead ICP Criterion', 'Configurable ICP fit criteria + weights (SDR-002).')
) AS v(set_key, name, description)
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM tenant_option_sets s
    WHERE s.tenant_id = t.id AND s.set_key = v.set_key
  );

-- 2. Discovery fields (SDR-003).
INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, v.is_default, true, v.metadata::jsonb
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('pain', 'Pain / problem', 0, true, '{"required": true}'),
  ('current_process', 'Current process', 1, false, '{"required": false}'),
  ('current_vendor', 'Current vendor', 2, false, '{"required": false}'),
  ('urgency', 'Urgency', 3, false, '{"required": true}'),
  ('budget', 'Budget', 4, false, '{"required": true}'),
  ('authority', 'Authority', 5, false, '{"required": true}'),
  ('timeline', 'Timeline', 6, false, '{"required": true}'),
  ('decision_process', 'Decision process', 7, false, '{"required": false}'),
  ('stakeholders', 'Stakeholders', 8, false, '{"required": false}'),
  ('success_criteria', 'Success criteria', 9, false, '{"required": false}'),
  ('risks', 'Risks', 10, false, '{"required": false}')
) AS v(value_key, label, sort_order, is_default, metadata)
WHERE s.set_key = 'lead-discovery-field'
  AND s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM tenant_option_values ov
    WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key
  );

-- 3. Objection types (SDR-006).
INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, v.is_default, true, '{}'::jsonb
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('price', 'Price', 0, true),
  ('timing', 'Timing', 1, false),
  ('competitor', 'Competitor', 2, false),
  ('authority', 'Authority', 3, false),
  ('feature_gap', 'Feature gap', 4, false),
  ('integration', 'Integration', 5, false),
  ('security', 'Security', 6, false),
  ('implementation', 'Implementation', 7, false),
  ('unclear_need', 'Unclear need', 8, false)
) AS v(value_key, label, sort_order, is_default)
WHERE s.set_key = 'lead-objection-type'
  AND s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM tenant_option_values ov
    WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key
  );

-- 4. ICP criteria + weights (SDR-002).
INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, v.is_default, true, v.metadata::jsonb
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('industry', 'Industry', 0, true, '{"weight": 1}'),
  ('segment', 'Segment', 1, false, '{"weight": 1}'),
  ('size', 'Company size', 2, false, '{"weight": 1}'),
  ('geography', 'Geography', 3, false, '{"weight": 1}'),
  ('use_case', 'Use case', 4, false, '{"weight": 1}'),
  ('budget', 'Budget', 5, false, '{"weight": 1}'),
  ('strategic_value', 'Strategic value', 6, false, '{"weight": 2}')
) AS v(value_key, label, sort_order, is_default, metadata)
WHERE s.set_key = 'lead-icp-criterion'
  AND s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM tenant_option_values ov
    WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key
  );

-- migrate:down
DELETE FROM tenant_option_values ov
USING tenant_option_sets s
WHERE s.id = ov.option_set_id
  AND s.tenant_id = ov.tenant_id
  AND s.set_key IN ('lead-discovery-field', 'lead-objection-type', 'lead-icp-criterion');

DELETE FROM tenant_option_sets
WHERE set_key IN ('lead-discovery-field', 'lead-objection-type', 'lead-icp-criterion');
