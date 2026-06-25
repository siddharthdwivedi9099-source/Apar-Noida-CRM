-- migrate:up
-- Configuration versioning: draft/published/archived snapshots of a tenant's
-- configuration, enabling validation-gated publishing, rollback, and audit.
-- Additive only — no existing tables are altered.
CREATE TABLE IF NOT EXISTS configuration_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  change_reason TEXT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  effective_date TIMESTAMPTZ NULL,
  published_at TIMESTAMPTZ NULL,
  published_by UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT configuration_versions_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT configuration_versions_tenant_version_unique UNIQUE (tenant_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_configuration_versions_tenant_status
  ON configuration_versions (tenant_id, status, version_number DESC)
  WHERE deleted_at IS NULL;

-- At most one published version per tenant at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_configuration_versions_one_published
  ON configuration_versions (tenant_id)
  WHERE status = 'published' AND deleted_at IS NULL;

CREATE TRIGGER trg_configuration_versions_updated_at
  BEFORE UPDATE ON configuration_versions
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS trg_configuration_versions_updated_at ON configuration_versions;
DROP INDEX IF EXISTS uq_configuration_versions_one_published;
DROP INDEX IF EXISTS idx_configuration_versions_tenant_status;
DROP TABLE IF EXISTS configuration_versions;
