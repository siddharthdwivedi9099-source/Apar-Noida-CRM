-- migrate:up
-- Persona 13 (Sales Head) SH-002: quota management. Quotas can be set by period
-- (month/quarter/year) and scoped by product, region, segment, owner, or team, with
-- parent_quota_id supporting hierarchy roll-up. Attainment is computed from won
-- opportunities at read time; no denormalized attainment is stored here.
CREATE TABLE IF NOT EXISTS sales_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  name TEXT NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('month', 'quarter', 'year')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  owner_id UUID NULL REFERENCES users (id),
  team_id UUID NULL REFERENCES teams (id),
  product TEXT NULL,
  region TEXT NULL,
  segment TEXT NULL,
  target_amount NUMERIC(14, 2) NOT NULL CHECK (target_amount >= 0),
  parent_quota_id UUID NULL REFERENCES sales_quotas (id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL REFERENCES users (id),
  updated_by UUID NULL REFERENCES users (id),
  CONSTRAINT sales_quotas_period_order CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_sales_quotas_tenant_period
  ON sales_quotas (tenant_id, period_start, period_end)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sales_quotas_tenant_owner
  ON sales_quotas (tenant_id, owner_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sales_quotas_parent
  ON sales_quotas (parent_quota_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER set_sales_quotas_updated_at
  BEFORE UPDATE ON sales_quotas
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TABLE IF EXISTS sales_quotas;
