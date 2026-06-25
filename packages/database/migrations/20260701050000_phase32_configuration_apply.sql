-- migrate:up
-- Track when a configuration version was applied onto live configuration tables.
-- Additive only — new nullable columns on the existing configuration_versions table.
ALTER TABLE configuration_versions
  ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS applied_by UUID NULL;

-- migrate:down
ALTER TABLE configuration_versions
  DROP COLUMN IF EXISTS applied_by,
  DROP COLUMN IF EXISTS applied_at;
