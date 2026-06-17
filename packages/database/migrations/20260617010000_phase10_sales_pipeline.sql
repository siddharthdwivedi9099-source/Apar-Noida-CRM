-- migrate:up
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  account_id UUID NULL,
  primary_contact_id UUID NULL,
  owner_id UUID NULL,
  name TEXT NOT NULL,
  stage_option_id UUID NOT NULL,
  source_option_id UUID NOT NULL,
  outcome_status_option_id UUID NOT NULL,
  amount NUMERIC(14, 2) NULL CHECK (amount IS NULL OR amount >= 0),
  probability INTEGER NULL CHECK (probability IS NULL OR (probability >= 0 AND probability <= 100)),
  expected_close_date DATE NULL,
  competitor TEXT NULL,
  next_step TEXT NULL,
  win_loss_reason TEXT NULL,
  last_stage_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT opportunities_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT opportunities_account_fk
    FOREIGN KEY (account_id, tenant_id)
    REFERENCES accounts (id, tenant_id),
  CONSTRAINT opportunities_primary_contact_fk
    FOREIGN KEY (primary_contact_id, tenant_id)
    REFERENCES contacts (id, tenant_id),
  CONSTRAINT opportunities_owner_fk
    FOREIGN KEY (owner_id, tenant_id)
    REFERENCES users (id, tenant_id),
  CONSTRAINT opportunities_stage_option_fk
    FOREIGN KEY (stage_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT opportunities_source_option_fk
    FOREIGN KEY (source_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT opportunities_outcome_status_option_fk
    FOREIGN KEY (outcome_status_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_opportunities_tenant_active
  ON opportunities (tenant_id, expected_close_date ASC, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_tenant_owner_active
  ON opportunities (tenant_id, owner_id, expected_close_date ASC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_tenant_stage_active
  ON opportunities (tenant_id, stage_option_id, last_stage_changed_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_tenant_account_active
  ON opportunities (tenant_id, account_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_tenant_outcome_active
  ON opportunities (tenant_id, outcome_status_option_id, expected_close_date ASC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS opportunity_stakeholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  opportunity_id UUID NOT NULL,
  contact_id UUID NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT opportunity_stakeholders_opportunity_fk
    FOREIGN KEY (opportunity_id, tenant_id)
    REFERENCES opportunities (id, tenant_id),
  CONSTRAINT opportunity_stakeholders_contact_fk
    FOREIGN KEY (contact_id, tenant_id)
    REFERENCES contacts (id, tenant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_opportunity_stakeholders_active
  ON opportunity_stakeholders (opportunity_id, contact_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_opportunity_stakeholders_tenant_opportunity_active
  ON opportunity_stakeholders (tenant_id, opportunity_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_opportunity_stakeholders_tenant_contact_active
  ON opportunity_stakeholders (tenant_id, contact_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_opportunity_stakeholders_updated_at
  BEFORE UPDATE ON opportunity_stakeholders
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS trg_opportunity_stakeholders_updated_at ON opportunity_stakeholders;
DROP TRIGGER IF EXISTS trg_opportunities_updated_at ON opportunities;

DROP TABLE IF EXISTS opportunity_stakeholders;
DROP TABLE IF EXISTS opportunities;
