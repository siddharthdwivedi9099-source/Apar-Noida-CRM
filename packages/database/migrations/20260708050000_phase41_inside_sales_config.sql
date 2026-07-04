-- migrate:up
-- Persona 6 (Inside Sales) configuration backfill for existing tenants.
-- New tenants receive these via the TS seed; this keeps already-provisioned tenants in sync.
-- All statements are idempotent (guarded by NOT EXISTS / metadata merge).

-- 1. Create the two new inside-sales option sets per tenant (ISR-002 scripts, ISR-004 checklist).
INSERT INTO tenant_option_sets (tenant_id, set_key, module_key, kind, name, description, is_system_set, is_active, metadata)
SELECT t.id, v.set_key, 'leads', 'dropdown', v.name, v.description, true, true,
       '{"seeded": true, "phase": "phase-41-inside-sales"}'::jsonb
FROM tenants t
CROSS JOIN (VALUES
  ('lead-qualification-checklist', 'Lead Qualification Checklist',
   'Configurable inside-sales qualification checklist items (ISR-004).'),
  ('lead-contact-script', 'Lead First-Contact Script',
   'Configurable guided first-contact scripts (ISR-002).')
) AS v(set_key, name, description)
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM tenant_option_sets s
    WHERE s.tenant_id = t.id AND s.set_key = v.set_key
  );

-- 2. Seed qualification checklist values (ISR-004).
INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, v.is_default, true, v.metadata::jsonb
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('need', 'Need identified', 0, true, '{"required": true}'),
  ('product_interest', 'Product interest', 1, false, '{"required": true}'),
  ('organization_type', 'Organization type', 2, false, '{"required": false}'),
  ('location', 'Location', 3, false, '{"required": false}'),
  ('decision_authority', 'Decision authority', 4, false, '{"required": true}'),
  ('budget_range', 'Budget range', 5, false, '{"required": true}'),
  ('timeline', 'Timeline', 6, false, '{"required": true}'),
  ('current_solution', 'Current solution', 7, false, '{"required": false}'),
  ('meeting_interest', 'Meeting interest', 8, false, '{"required": true}')
) AS v(value_key, label, sort_order, is_default, metadata)
WHERE s.set_key = 'lead-qualification-checklist'
  AND s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM tenant_option_values ov
    WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key
  );

-- 3. Seed first-contact script values (ISR-002).
INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, v.is_default, true, v.metadata::jsonb
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('default', 'General first-contact script', 0, true,
   '{"required": false, "body": "Introduce yourself and the company, confirm you are speaking with the right person, ask what prompted their interest, and confirm need, timeline, and decision process before proposing a next step."}'),
  ('service_project', 'IT service project discovery', 1, false,
   '{"required": false, "leadFor": "service_project", "body": "Confirm the project scope and current technology stack, identify the business outcome they need, ask about budget range and timeline, and qualify decision authority before booking a technical discovery call."}'),
  ('product', 'Product interest discovery', 2, false,
   '{"required": false, "leadFor": "product", "body": "Confirm which product caught their attention, ask about team size and current tooling, surface the problem they want to solve, and qualify budget and timeline before booking a product demo."}'),
  ('inbound_website', 'Inbound website lead', 3, false,
   '{"required": false, "sourceKey": "website", "body": "Thank them for reaching out through the website, reference the page or content they engaged with, confirm what they are evaluating, and qualify need, timeline, and authority before proposing a meeting."}')
) AS v(value_key, label, sort_order, is_default, metadata)
WHERE s.set_key = 'lead-contact-script'
  AND s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM tenant_option_values ov
    WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key
  );

-- 4. Add the new call-disposition outcomes required by ISR-002 to existing tenants.
INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, false, true, v.metadata::jsonb
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('wrong_number', 'Wrong Number', 20, '{}'),
  ('callback_requested', 'Callback Requested', 21,
   '{"nextStep": {"taskType": "call", "offsetHours": 24, "title": "Callback requested by lead"}}'),
  ('interested', 'Interested', 22,
   '{"nextStep": {"taskType": "follow_up", "offsetHours": 48, "title": "Advance interested lead"}}')
) AS v(value_key, label, sort_order, metadata)
WHERE s.set_key = 'lead-call-disposition'
  AND s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM tenant_option_values ov
    WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key
  );

-- 5. Merge auto-next-step hints onto existing dispositions (ISR-002 "next step created automatically").
UPDATE tenant_option_values ov
SET metadata = ov.metadata || ns.metadata::jsonb,
    updated_at = NOW()
FROM tenant_option_sets s,
  (VALUES
    ('connected', '{"nextStep": {"taskType": "follow_up", "offsetHours": 48, "title": "Post-call follow-up"}}'),
    ('voicemail', '{"nextStep": {"taskType": "call", "offsetHours": 24, "title": "Follow up after voicemail"}}'),
    ('no_answer', '{"nextStep": {"taskType": "call", "offsetHours": 4, "title": "Retry call - no answer"}}'),
    ('follow_up_needed', '{"nextStep": {"taskType": "follow_up", "offsetHours": 24, "title": "Follow-up needed"}}')
  ) AS ns(value_key, metadata)
WHERE s.set_key = 'lead-call-disposition'
  AND s.deleted_at IS NULL
  AND ov.option_set_id = s.id
  AND ov.tenant_id = s.tenant_id
  AND ov.value_key = ns.value_key
  AND NOT (ov.metadata ? 'nextStep');

-- migrate:down
DELETE FROM tenant_option_values ov
USING tenant_option_sets s
WHERE s.id = ov.option_set_id
  AND s.tenant_id = ov.tenant_id
  AND s.set_key IN ('lead-qualification-checklist', 'lead-contact-script');

DELETE FROM tenant_option_sets
WHERE set_key IN ('lead-qualification-checklist', 'lead-contact-script');

DELETE FROM tenant_option_values ov
USING tenant_option_sets s
WHERE s.id = ov.option_set_id
  AND s.tenant_id = ov.tenant_id
  AND s.set_key = 'lead-call-disposition'
  AND ov.value_key IN ('wrong_number', 'callback_requested', 'interested');

UPDATE tenant_option_values ov
SET metadata = ov.metadata - 'nextStep'
FROM tenant_option_sets s
WHERE s.id = ov.option_set_id
  AND s.tenant_id = ov.tenant_id
  AND s.set_key = 'lead-call-disposition'
  AND ov.value_key IN ('connected', 'voicemail', 'no_answer', 'follow_up_needed');
