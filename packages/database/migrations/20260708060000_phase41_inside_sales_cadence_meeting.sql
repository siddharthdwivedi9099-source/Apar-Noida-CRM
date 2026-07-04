-- migrate:up
-- Persona 6 (Inside Sales) — ISR-002 (campaign script), ISR-003 (cadence), ISR-005 (meeting) config backfill.
-- New tenants receive these via the TS seed; this keeps already-provisioned tenants in sync. Idempotent.

-- 1. Create the cadence + meeting-type option sets per tenant.
INSERT INTO tenant_option_sets (tenant_id, set_key, module_key, kind, name, description, is_system_set, is_active, metadata)
SELECT t.id, v.set_key, 'leads', 'dropdown', v.name, v.description, true, true,
       '{"seeded": true, "phase": "phase-41-inside-sales"}'::jsonb
FROM tenants t
CROSS JOIN (VALUES
  ('lead-cadence-step', 'Lead Contact Cadence', 'Configurable inside-sales contact cadence (ISR-003).'),
  ('lead-meeting-type', 'Lead Meeting Type', 'Configurable meeting types an inside-sales rep can book from a lead (ISR-005).')
) AS v(set_key, name, description)
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM tenant_option_sets s
    WHERE s.tenant_id = t.id AND s.set_key = v.set_key
  );

-- 2. Seed cadence steps (ISR-003).
INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, v.is_default, true, v.metadata::jsonb
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('call_day0', 'Day 0 - Call', 0, true, '{"channel": "call", "offsetHours": 0}'),
  ('email_day1', 'Day 1 - Email', 1, false, '{"channel": "email", "offsetHours": 24}'),
  ('whatsapp_day2', 'Day 2 - WhatsApp', 2, false, '{"channel": "whatsapp", "offsetHours": 48}'),
  ('linkedin_day4', 'Day 4 - LinkedIn touch', 3, false, '{"channel": "linkedin", "offsetHours": 96}'),
  ('call_day6', 'Day 6 - Call', 4, false, '{"channel": "call", "offsetHours": 144}'),
  ('follow_up_day8', 'Day 8 - Follow-up', 5, false, '{"channel": "follow_up", "offsetHours": 192}')
) AS v(value_key, label, sort_order, is_default, metadata)
WHERE s.set_key = 'lead-cadence-step'
  AND s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM tenant_option_values ov
    WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key
  );

-- 3. Seed meeting types (ISR-005).
INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, v.is_default, true, '{}'::jsonb
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('sales', 'Sales meeting', 0, true),
  ('presales', 'Presales / technical', 1, false),
  ('manager', 'Manager review', 2, false)
) AS v(value_key, label, sort_order, is_default)
WHERE s.set_key = 'lead-meeting-type'
  AND s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM tenant_option_values ov
    WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key
  );

-- 4. Add the campaign-targeted first-contact script (ISR-002 campaign dimension).
INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata)
SELECT s.tenant_id, s.id, 'webinar_followup', 'Webinar follow-up', 4, false, true,
  '{"required": false, "campaignKey": "webinar", "body": "Reference the webinar they attended, ask which topics were most relevant, confirm the problem they want to solve, and qualify timeline and authority before proposing a tailored demo."}'::jsonb
FROM tenant_option_sets s
WHERE s.set_key = 'lead-contact-script'
  AND s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM tenant_option_values ov
    WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = 'webinar_followup'
  );

-- 5. Add the meeting_scheduled lead status (ISR-005).
INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata, color)
SELECT s.tenant_id, s.id, 'meeting_scheduled', 'Meeting Scheduled', 4, false, true, '{}'::jsonb, '#0ea5e9'
FROM tenant_option_sets s
WHERE s.set_key = 'lead-status'
  AND s.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM tenant_option_values ov
    WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = 'meeting_scheduled'
  );

-- migrate:down
DELETE FROM tenant_option_values ov
USING tenant_option_sets s
WHERE s.id = ov.option_set_id
  AND s.tenant_id = ov.tenant_id
  AND s.set_key IN ('lead-cadence-step', 'lead-meeting-type');

DELETE FROM tenant_option_sets
WHERE set_key IN ('lead-cadence-step', 'lead-meeting-type');

DELETE FROM tenant_option_values ov
USING tenant_option_sets s
WHERE s.id = ov.option_set_id
  AND s.tenant_id = ov.tenant_id
  AND s.set_key = 'lead-contact-script'
  AND ov.value_key = 'webinar_followup';

DELETE FROM tenant_option_values ov
USING tenant_option_sets s
WHERE s.id = ov.option_set_id
  AND s.tenant_id = ov.tenant_id
  AND s.set_key = 'lead-status'
  AND ov.value_key = 'meeting_scheduled';
