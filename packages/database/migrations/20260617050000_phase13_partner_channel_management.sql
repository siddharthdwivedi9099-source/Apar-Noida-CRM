-- migrate:up
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  account_id UUID NULL,
  owner_id UUID NULL,
  name TEXT NOT NULL,
  type_option_id UUID NOT NULL,
  tier_option_id UUID NOT NULL,
  status_option_id UUID NOT NULL,
  onboarding_status_option_id UUID NOT NULL,
  region TEXT NULL,
  territory TEXT NULL,
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
  CONSTRAINT partners_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT partners_account_fk
    FOREIGN KEY (account_id, tenant_id)
    REFERENCES accounts (id, tenant_id),
  CONSTRAINT partners_owner_fk
    FOREIGN KEY (owner_id, tenant_id)
    REFERENCES users (id, tenant_id),
  CONSTRAINT partners_type_option_fk
    FOREIGN KEY (type_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT partners_tier_option_fk
    FOREIGN KEY (tier_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT partners_status_option_fk
    FOREIGN KEY (status_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT partners_onboarding_status_option_fk
    FOREIGN KEY (onboarding_status_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_partners_tenant_active
  ON partners (tenant_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_partners_tenant_owner_active
  ON partners (tenant_id, owner_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_partners_tenant_tier_active
  ON partners (tenant_id, tier_option_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_partners_tenant_status_active
  ON partners (tenant_id, status_option_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_partners_tenant_type_active
  ON partners (tenant_id, type_option_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS partner_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  partner_id UUID NOT NULL,
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
  CONSTRAINT partner_contacts_partner_fk
    FOREIGN KEY (partner_id, tenant_id)
    REFERENCES partners (id, tenant_id),
  CONSTRAINT partner_contacts_contact_fk
    FOREIGN KEY (contact_id, tenant_id)
    REFERENCES contacts (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_contacts_tenant_partner_active
  ON partner_contacts (tenant_id, partner_id, created_at ASC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS partner_onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  partner_id UUID NOT NULL,
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
  CONSTRAINT partner_onboarding_tasks_partner_fk
    FOREIGN KEY (partner_id, tenant_id)
    REFERENCES partners (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_onboarding_tasks_tenant_partner_active
  ON partner_onboarding_tasks (tenant_id, partner_id, sort_order ASC, created_at ASC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_partner_onboarding_tasks_tenant_status_active
  ON partner_onboarding_tasks (tenant_id, partner_id, status)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS partner_deal_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  partner_id UUID NOT NULL,
  opportunity_id UUID NULL,
  account_id UUID NULL,
  lead_id UUID NULL,
  name TEXT NOT NULL,
  customer_name TEXT NULL,
  stage_option_id UUID NOT NULL,
  amount NUMERIC(16, 2) NULL CHECK (amount IS NULL OR amount >= 0),
  expected_close_date DATE NULL,
  notes TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT partner_deal_registrations_partner_fk
    FOREIGN KEY (partner_id, tenant_id)
    REFERENCES partners (id, tenant_id),
  CONSTRAINT partner_deal_registrations_opportunity_fk
    FOREIGN KEY (opportunity_id, tenant_id)
    REFERENCES opportunities (id, tenant_id),
  CONSTRAINT partner_deal_registrations_account_fk
    FOREIGN KEY (account_id, tenant_id)
    REFERENCES accounts (id, tenant_id),
  CONSTRAINT partner_deal_registrations_lead_fk
    FOREIGN KEY (lead_id, tenant_id)
    REFERENCES leads (id, tenant_id),
  CONSTRAINT partner_deal_registrations_stage_option_fk
    FOREIGN KEY (stage_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_deal_registrations_tenant_partner_active
  ON partner_deal_registrations (tenant_id, partner_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_partner_deal_registrations_tenant_stage_active
  ON partner_deal_registrations (tenant_id, stage_option_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_partner_deal_registrations_tenant_opportunity_active
  ON partner_deal_registrations (tenant_id, opportunity_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_partner_contacts_updated_at
  BEFORE UPDATE ON partner_contacts
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_partner_onboarding_tasks_updated_at
  BEFORE UPDATE ON partner_onboarding_tasks
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_partner_deal_registrations_updated_at
  BEFORE UPDATE ON partner_deal_registrations
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS trg_partner_deal_registrations_updated_at ON partner_deal_registrations;
DROP TRIGGER IF EXISTS trg_partner_onboarding_tasks_updated_at ON partner_onboarding_tasks;
DROP TRIGGER IF EXISTS trg_partner_contacts_updated_at ON partner_contacts;
DROP TRIGGER IF EXISTS trg_partners_updated_at ON partners;

DROP TABLE IF EXISTS partner_deal_registrations;
DROP TABLE IF EXISTS partner_onboarding_tasks;
DROP TABLE IF EXISTS partner_contacts;
DROP TABLE IF EXISTS partners;
