-- migrate:up
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

-- migrate:down
ALTER TABLE accounts
  DROP COLUMN IF EXISTS custom_fields;
