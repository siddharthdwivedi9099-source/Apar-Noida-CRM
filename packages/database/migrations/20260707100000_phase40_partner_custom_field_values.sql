-- migrate:up
ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

-- migrate:down
ALTER TABLE partners
  DROP COLUMN IF EXISTS custom_fields;
