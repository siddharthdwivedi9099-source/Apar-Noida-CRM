-- migrate:up
CREATE TABLE IF NOT EXISTS resellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  account_id UUID NULL,
  owner_id UUID NULL,
  name TEXT NOT NULL,
  status_option_id UUID NOT NULL,
  pricing_tier_option_id UUID NOT NULL,
  margin_profile_option_id UUID NOT NULL,
  onboarding_status_option_id UUID NOT NULL,
  region TEXT NULL,
  territory TEXT NULL,
  margin_percent NUMERIC(5, 2) NULL CHECK (margin_percent IS NULL OR (margin_percent >= 0 AND margin_percent <= 100)),
  agreement_reference TEXT NULL,
  agreement_start_date DATE NULL,
  agreement_end_date DATE NULL,
  agreement_notes TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT resellers_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT resellers_account_fk
    FOREIGN KEY (account_id, tenant_id)
    REFERENCES accounts (id, tenant_id),
  CONSTRAINT resellers_owner_fk
    FOREIGN KEY (owner_id, tenant_id)
    REFERENCES users (id, tenant_id),
  CONSTRAINT resellers_status_option_fk
    FOREIGN KEY (status_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT resellers_pricing_tier_option_fk
    FOREIGN KEY (pricing_tier_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT resellers_margin_profile_option_fk
    FOREIGN KEY (margin_profile_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT resellers_onboarding_status_option_fk
    FOREIGN KEY (onboarding_status_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_resellers_tenant_active
  ON resellers (tenant_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_resellers_tenant_owner_active
  ON resellers (tenant_id, owner_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_resellers_tenant_status_active
  ON resellers (tenant_id, status_option_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_resellers_tenant_pricing_tier_active
  ON resellers (tenant_id, pricing_tier_option_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS reseller_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  reseller_id UUID NOT NULL,
  contact_id UUID NULL,
  name TEXT NOT NULL,
  title TEXT NULL,
  email TEXT NULL,
  phone TEXT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT reseller_contacts_reseller_fk
    FOREIGN KEY (reseller_id, tenant_id)
    REFERENCES resellers (id, tenant_id),
  CONSTRAINT reseller_contacts_contact_fk
    FOREIGN KEY (contact_id, tenant_id)
    REFERENCES contacts (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_reseller_contacts_tenant_reseller_active
  ON reseller_contacts (tenant_id, reseller_id, created_at ASC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS reseller_onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  reseller_id UUID NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  due_date DATE NULL,
  completed_at TIMESTAMPTZ NULL,
  notes TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT reseller_onboarding_tasks_reseller_fk
    FOREIGN KEY (reseller_id, tenant_id)
    REFERENCES resellers (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_reseller_onboarding_tasks_tenant_reseller_active
  ON reseller_onboarding_tasks (tenant_id, reseller_id, sort_order ASC, created_at ASC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reseller_onboarding_tasks_tenant_status_active
  ON reseller_onboarding_tasks (tenant_id, reseller_id, status)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS reseller_deal_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  reseller_id UUID NOT NULL,
  opportunity_id UUID NULL,
  account_id UUID NULL,
  lead_id UUID NULL,
  name TEXT NOT NULL,
  customer_name TEXT NULL,
  stage_option_id UUID NOT NULL,
  amount NUMERIC(16, 2) NULL CHECK (amount IS NULL OR amount >= 0),
  margin_percent NUMERIC(5, 2) NULL CHECK (margin_percent IS NULL OR (margin_percent >= 0 AND margin_percent <= 100)),
  expected_close_date DATE NULL,
  notes TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT reseller_deal_registrations_reseller_fk
    FOREIGN KEY (reseller_id, tenant_id)
    REFERENCES resellers (id, tenant_id),
  CONSTRAINT reseller_deal_registrations_opportunity_fk
    FOREIGN KEY (opportunity_id, tenant_id)
    REFERENCES opportunities (id, tenant_id),
  CONSTRAINT reseller_deal_registrations_account_fk
    FOREIGN KEY (account_id, tenant_id)
    REFERENCES accounts (id, tenant_id),
  CONSTRAINT reseller_deal_registrations_lead_fk
    FOREIGN KEY (lead_id, tenant_id)
    REFERENCES leads (id, tenant_id),
  CONSTRAINT reseller_deal_registrations_stage_option_fk
    FOREIGN KEY (stage_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_reseller_deal_registrations_tenant_reseller_active
  ON reseller_deal_registrations (tenant_id, reseller_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reseller_deal_registrations_tenant_stage_active
  ON reseller_deal_registrations (tenant_id, stage_option_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reseller_deal_registrations_tenant_opportunity_active
  ON reseller_deal_registrations (tenant_id, opportunity_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_resellers_updated_at
  BEFORE UPDATE ON resellers
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_reseller_contacts_updated_at
  BEFORE UPDATE ON reseller_contacts
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_reseller_onboarding_tasks_updated_at
  BEFORE UPDATE ON reseller_onboarding_tasks
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_reseller_deal_registrations_updated_at
  BEFORE UPDATE ON reseller_deal_registrations
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS trg_reseller_deal_registrations_updated_at ON reseller_deal_registrations;
DROP TRIGGER IF EXISTS trg_reseller_onboarding_tasks_updated_at ON reseller_onboarding_tasks;
DROP TRIGGER IF EXISTS trg_reseller_contacts_updated_at ON reseller_contacts;
DROP TRIGGER IF EXISTS trg_resellers_updated_at ON resellers;

DROP TABLE IF EXISTS reseller_deal_registrations;
DROP TABLE IF EXISTS reseller_onboarding_tasks;
DROP TABLE IF EXISTS reseller_contacts;
DROP TABLE IF EXISTS resellers;
