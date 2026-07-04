-- migrate:up
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

-- migrate:down
ALTER TABLE contacts
  DROP COLUMN IF EXISTS custom_fields;
