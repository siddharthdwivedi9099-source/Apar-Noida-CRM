-- migrate:up
-- Personas 1–5 gap closure (SM-002/SM-004/MM-003/MM-005): social lead sources,
-- sales handoff rejection, rejection reasons, and social response templates.
-- All additions are idempotent option-set backfills for existing tenants; new
-- tenants get the same values from the core seed.

-- SM-002: social channels become selectable lead sources.
INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata, color)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, false, true, '{}'::jsonb, v.color
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('linkedin', 'LinkedIn', 5, '#0a66c2'),
  ('instagram', 'Instagram', 6, '#e1306c'),
  ('facebook', 'Facebook', 7, '#1877f2'),
  ('youtube', 'YouTube', 8, '#ff0033'),
  ('whatsapp', 'WhatsApp', 9, '#22c55e'),
  ('social_other', 'Social (Other)', 10, '#64748b')
) AS v(value_key, label, sort_order, color)
WHERE s.set_key = 'lead-source' AND s.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_values ov WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key);

-- MM-003: sales can reject a marketing handoff.
INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata, color)
SELECT s.tenant_id, s.id, 'rejected_by_sales', 'Rejected by Sales', 6, false, true, '{}'::jsonb, '#f43f5e'
FROM tenant_option_sets s
WHERE s.set_key = 'lead-handoff-status' AND s.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_values ov WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = 'rejected_by_sales');

-- MM-005: configurable rejection reasons (mandatory on rejected_by_sales).
INSERT INTO tenant_option_sets (tenant_id, set_key, module_key, kind, name, description, is_system_set, is_active, metadata)
SELECT t.id, 'lead-rejection-reason', 'leads', 'dropdown', 'Lead Rejection Reason',
       'Reason sales rejected a marketing handoff (MM-003/MM-005).',
       true, true, '{"seeded": true, "phase": "phase-66-marketing-personas"}'::jsonb
FROM tenants t
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_sets s WHERE s.tenant_id = t.id AND s.set_key = 'lead-rejection-reason');

INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata, color)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, v.is_default, true, '{}'::jsonb, NULL
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('poor_fit', 'Poor Fit', 0, true),
  ('no_budget', 'No Budget', 1, false),
  ('wrong_contact', 'Wrong Contact', 2, false),
  ('bad_timing', 'Bad Timing', 3, false),
  ('duplicate', 'Duplicate', 4, false),
  ('insufficient_context', 'Insufficient Context', 5, false)
) AS v(value_key, label, sort_order, is_default)
WHERE s.set_key = 'lead-rejection-reason' AND s.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_values ov WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key);

-- SM-004: brand-approved social response templates (metadata.body carries the text).
INSERT INTO tenant_option_sets (tenant_id, set_key, module_key, kind, name, description, is_system_set, is_active, metadata)
SELECT t.id, 'social-response-template', 'social', 'dropdown', 'Social Response Template',
       'Brand-approved social response templates (SM-004).',
       true, true, '{"seeded": true, "phase": "phase-66-marketing-personas"}'::jsonb
FROM tenants t
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_sets s WHERE s.tenant_id = t.id AND s.set_key = 'social-response-template');

INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata, color)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, v.is_default, true, v.metadata::jsonb, NULL
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('thanks_interest', 'Thanks for the interest', 0, true,
   '{"body": "Thank you for your interest! A member of our team will reach out shortly with the details you asked for."}'),
  ('demo_offer', 'Offer a demo', 1, false,
   '{"body": "We''d love to show you how it works — can we set up a quick personalized demo this week?"}'),
  ('pricing_followup', 'Pricing follow-up', 2, false,
   '{"body": "Great question on pricing — plans depend on team size and modules. Sharing a summary by DM now."}'),
  ('complaint_ack', 'Complaint acknowledgement', 3, false,
   '{"body": "We''re sorry about the experience. Our support team is looking into this right away and will follow up directly.", "sensitive": true}'),
  ('support_redirect', 'Redirect to support', 4, false,
   '{"body": "So we can resolve this quickly, our support team will take this up — expect a reply within the hour.", "sensitive": true}')
) AS v(value_key, label, sort_order, is_default, metadata)
WHERE s.set_key = 'social-response-template' AND s.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_values ov WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key);

-- migrate:down
DELETE FROM tenant_option_values ov
USING tenant_option_sets s
WHERE s.id = ov.option_set_id AND s.tenant_id = ov.tenant_id
  AND ((s.set_key = 'lead-source' AND ov.value_key IN ('linkedin', 'instagram', 'facebook', 'youtube', 'whatsapp', 'social_other'))
    OR (s.set_key = 'lead-handoff-status' AND ov.value_key = 'rejected_by_sales'));

DELETE FROM tenant_option_values ov
USING tenant_option_sets s
WHERE s.id = ov.option_set_id AND s.tenant_id = ov.tenant_id
  AND s.set_key IN ('lead-rejection-reason', 'social-response-template');

DELETE FROM tenant_option_sets WHERE set_key IN ('lead-rejection-reason', 'social-response-template');
