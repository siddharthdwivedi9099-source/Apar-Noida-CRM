-- migrate:up
CREATE TABLE IF NOT EXISTS bd_target_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  account_id UUID NULL,
  owner_id UUID NULL,
  name TEXT NOT NULL,
  industry TEXT NULL,
  region TEXT NULL,
  tier_option_id UUID NOT NULL,
  stage_option_id UUID NOT NULL,
  partnership_type_option_id UUID NULL,
  annual_revenue NUMERIC(16, 2) NULL CHECK (annual_revenue IS NULL OR annual_revenue >= 0),
  employee_count INTEGER NULL CHECK (employee_count IS NULL OR employee_count >= 0),
  market_opportunity_notes TEXT NULL,
  executive_sponsor TEXT NULL,
  next_step TEXT NULL,
  is_partnership BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT bd_target_accounts_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT bd_target_accounts_account_fk
    FOREIGN KEY (account_id, tenant_id)
    REFERENCES accounts (id, tenant_id),
  CONSTRAINT bd_target_accounts_owner_fk
    FOREIGN KEY (owner_id, tenant_id)
    REFERENCES users (id, tenant_id),
  CONSTRAINT bd_target_accounts_tier_option_fk
    FOREIGN KEY (tier_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT bd_target_accounts_stage_option_fk
    FOREIGN KEY (stage_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT bd_target_accounts_partnership_type_option_fk
    FOREIGN KEY (partnership_type_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_bd_target_accounts_tenant_active
  ON bd_target_accounts (tenant_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bd_target_accounts_tenant_owner_active
  ON bd_target_accounts (tenant_id, owner_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bd_target_accounts_tenant_stage_active
  ON bd_target_accounts (tenant_id, stage_option_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bd_target_accounts_tenant_tier_active
  ON bd_target_accounts (tenant_id, tier_option_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS bd_account_stakeholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  target_account_id UUID NOT NULL,
  contact_id UUID NULL,
  name TEXT NOT NULL,
  title TEXT NULL,
  influence_level TEXT NOT NULL DEFAULT 'medium'
    CHECK (influence_level IN ('low', 'medium', 'high', 'champion', 'blocker')),
  relationship_strength TEXT NOT NULL DEFAULT 'developing'
    CHECK (relationship_strength IN ('none', 'developing', 'engaged', 'strong')),
  is_executive BOOLEAN NOT NULL DEFAULT FALSE,
  last_engagement_at TIMESTAMPTZ NULL,
  engagement_notes TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT bd_account_stakeholders_target_account_fk
    FOREIGN KEY (target_account_id, tenant_id)
    REFERENCES bd_target_accounts (id, tenant_id),
  CONSTRAINT bd_account_stakeholders_contact_fk
    FOREIGN KEY (contact_id, tenant_id)
    REFERENCES contacts (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_bd_account_stakeholders_tenant_account_active
  ON bd_account_stakeholders (tenant_id, target_account_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bd_account_stakeholders_tenant_executive_active
  ON bd_account_stakeholders (tenant_id, target_account_id, is_executive)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS presales_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  opportunity_id UUID NULL,
  account_id UUID NULL,
  owner_id UUID NULL,
  assignee_id UUID NULL,
  title TEXT NOT NULL,
  request_type_option_id UUID NOT NULL,
  status_option_id UUID NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date DATE NULL,
  summary TEXT NULL,
  technical_requirements TEXT NULL,
  proposal_content TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT presales_requests_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT presales_requests_opportunity_fk
    FOREIGN KEY (opportunity_id, tenant_id)
    REFERENCES opportunities (id, tenant_id),
  CONSTRAINT presales_requests_account_fk
    FOREIGN KEY (account_id, tenant_id)
    REFERENCES accounts (id, tenant_id),
  CONSTRAINT presales_requests_owner_fk
    FOREIGN KEY (owner_id, tenant_id)
    REFERENCES users (id, tenant_id),
  CONSTRAINT presales_requests_assignee_fk
    FOREIGN KEY (assignee_id, tenant_id)
    REFERENCES users (id, tenant_id),
  CONSTRAINT presales_requests_request_type_option_fk
    FOREIGN KEY (request_type_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT presales_requests_status_option_fk
    FOREIGN KEY (status_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_presales_requests_tenant_active
  ON presales_requests (tenant_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_presales_requests_tenant_assignee_active
  ON presales_requests (tenant_id, assignee_id, due_date ASC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_presales_requests_tenant_status_active
  ON presales_requests (tenant_id, status_option_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_presales_requests_tenant_type_active
  ON presales_requests (tenant_id, request_type_option_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_presales_requests_tenant_opportunity_active
  ON presales_requests (tenant_id, opportunity_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS presales_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  request_id UUID NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'functional'
    CHECK (category IN ('functional', 'technical', 'security', 'commercial', 'integration', 'other')),
  requirement TEXT NULL,
  response TEXT NULL,
  compliance_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (compliance_status IN ('pending', 'met', 'partial', 'gap', 'not_applicable')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT presales_requirements_request_fk
    FOREIGN KEY (request_id, tenant_id)
    REFERENCES presales_requests (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_presales_requirements_tenant_request_active
  ON presales_requirements (tenant_id, request_id, sort_order ASC, created_at ASC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_presales_requirements_tenant_compliance_active
  ON presales_requirements (tenant_id, request_id, compliance_status)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_bd_target_accounts_updated_at
  BEFORE UPDATE ON bd_target_accounts
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_bd_account_stakeholders_updated_at
  BEFORE UPDATE ON bd_account_stakeholders
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_presales_requests_updated_at
  BEFORE UPDATE ON presales_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_presales_requirements_updated_at
  BEFORE UPDATE ON presales_requirements
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS trg_presales_requirements_updated_at ON presales_requirements;
DROP TRIGGER IF EXISTS trg_presales_requests_updated_at ON presales_requests;
DROP TRIGGER IF EXISTS trg_bd_account_stakeholders_updated_at ON bd_account_stakeholders;
DROP TRIGGER IF EXISTS trg_bd_target_accounts_updated_at ON bd_target_accounts;

DROP TABLE IF EXISTS presales_requirements;
DROP TABLE IF EXISTS presales_requests;
DROP TABLE IF EXISTS bd_account_stakeholders;
DROP TABLE IF EXISTS bd_target_accounts;
