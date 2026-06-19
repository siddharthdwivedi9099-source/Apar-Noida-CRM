-- migrate:up
CREATE TABLE IF NOT EXISTS dashboard_saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  dashboard_key TEXT NOT NULL,
  owner_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_shared BOOLEAN NOT NULL DEFAULT FALSE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT uniq_dashboard_saved_views_id_tenant UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_saved_views_lookup ON dashboard_saved_views (tenant_id, dashboard_key, owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dashboard_saved_views_shared ON dashboard_saved_views (tenant_id, dashboard_key, is_shared) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_dashboard_saved_views_updated_at BEFORE UPDATE ON dashboard_saved_views FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS trg_dashboard_saved_views_updated_at ON dashboard_saved_views;
DROP TABLE IF EXISTS dashboard_saved_views;
