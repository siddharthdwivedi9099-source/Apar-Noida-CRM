-- migrate:up
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

-- migrate:down
ALTER TABLE support_tickets
  DROP COLUMN IF EXISTS custom_fields;
