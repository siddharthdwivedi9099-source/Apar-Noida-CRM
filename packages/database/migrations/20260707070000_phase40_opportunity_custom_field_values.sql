-- migrate:up
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

-- migrate:down
ALTER TABLE opportunities
  DROP COLUMN IF EXISTS custom_fields;
