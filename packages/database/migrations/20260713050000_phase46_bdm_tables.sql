-- migrate:up
-- Persona 11 (Business Development Manager): territory plans (BDM-001), market intelligence
-- (BDM-002), and partner referral tracking (BDM-003).

CREATE TABLE IF NOT EXISTS bd_territory_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  owner_id UUID NULL,
  name TEXT NOT NULL,
  geography TEXT NULL,
  target_segments TEXT NULL,
  named_accounts TEXT NULL,
  partner_coverage TEXT NULL,
  campaigns TEXT NULL,
  pipeline_target NUMERIC(16, 2) NULL CHECK (pipeline_target IS NULL OR pipeline_target >= 0),
  revenue_target NUMERIC(16, 2) NULL CHECK (revenue_target IS NULL OR revenue_target >= 0),
  review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'in_review', 'reviewed')),
  reviewer_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT bd_territory_plans_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT bd_territory_plans_owner_fk FOREIGN KEY (owner_id, tenant_id) REFERENCES users (id, tenant_id),
  CONSTRAINT bd_territory_plans_reviewer_fk FOREIGN KEY (reviewer_id, tenant_id) REFERENCES users (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_bd_territory_plans_tenant_active
  ON bd_territory_plans (tenant_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_bd_territory_plans_updated_at
  BEFORE UPDATE ON bd_territory_plans
  FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

CREATE TABLE IF NOT EXISTS bd_market_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  owner_id UUID NULL,
  signal_type TEXT NOT NULL,
  content TEXT NOT NULL,
  linked_entity_type TEXT NULL CHECK (linked_entity_type IS NULL OR linked_entity_type IN ('account', 'opportunity', 'campaign')),
  linked_entity_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT bd_market_signals_owner_fk FOREIGN KEY (owner_id, tenant_id) REFERENCES users (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_bd_market_signals_tenant_active
  ON bd_market_signals (tenant_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_bd_market_signals_updated_at
  BEFORE UPDATE ON bd_market_signals
  FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

CREATE TABLE IF NOT EXISTS bd_partner_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  owner_id UUID NULL,
  partner_account_id UUID NULL,
  referral_source TEXT NULL,
  customer_name TEXT NOT NULL,
  opportunity_id UUID NULL,
  referred_value NUMERIC(16, 2) NULL CHECK (referred_value IS NULL OR referred_value >= 0),
  converted BOOLEAN NOT NULL DEFAULT FALSE,
  commission_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT bd_partner_referrals_owner_fk FOREIGN KEY (owner_id, tenant_id) REFERENCES users (id, tenant_id),
  CONSTRAINT bd_partner_referrals_account_fk FOREIGN KEY (partner_account_id, tenant_id) REFERENCES accounts (id, tenant_id),
  CONSTRAINT bd_partner_referrals_opportunity_fk FOREIGN KEY (opportunity_id, tenant_id) REFERENCES opportunities (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_bd_partner_referrals_tenant_active
  ON bd_partner_referrals (tenant_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_bd_partner_referrals_updated_at
  BEFORE UPDATE ON bd_partner_referrals
  FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TABLE IF EXISTS bd_partner_referrals;
DROP TABLE IF EXISTS bd_market_signals;
DROP TABLE IF EXISTS bd_territory_plans;
