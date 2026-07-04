-- migrate:up
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

-- migrate:down
ALTER TABLE leads
  DROP COLUMN IF EXISTS custom_fields;
