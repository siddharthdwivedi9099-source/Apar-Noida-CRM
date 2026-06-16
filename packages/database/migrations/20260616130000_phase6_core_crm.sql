-- migrate:up
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  owner_id UUID NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  email TEXT NULL,
  phone TEXT NULL,
  status_option_id UUID NOT NULL,
  source_option_id UUID NOT NULL,
  score INTEGER NULL CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT leads_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT leads_owner_fk
    FOREIGN KEY (owner_id, tenant_id)
    REFERENCES users (id, tenant_id),
  CONSTRAINT leads_status_option_fk
    FOREIGN KEY (status_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT leads_source_option_fk
    FOREIGN KEY (source_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_leads_tenant_active
  ON leads (tenant_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_tenant_owner_active
  ON leads (tenant_id, owner_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_tenant_status_active
  ON leads (tenant_id, status_option_id, source_option_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  owner_id UUID NULL,
  name TEXT NOT NULL,
  website TEXT NULL,
  industry TEXT NULL,
  account_type_option_id UUID NULL,
  health_status_option_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT accounts_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT accounts_owner_fk
    FOREIGN KEY (owner_id, tenant_id)
    REFERENCES users (id, tenant_id),
  CONSTRAINT accounts_type_option_fk
    FOREIGN KEY (account_type_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT accounts_health_option_fk
    FOREIGN KEY (health_status_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_accounts_tenant_active
  ON accounts (tenant_id, name, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_tenant_owner_active
  ON accounts (tenant_id, owner_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  owner_id UUID NULL,
  account_id UUID NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NULL,
  phone TEXT NULL,
  linkedin_url TEXT NULL,
  role_option_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT contacts_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT contacts_owner_fk
    FOREIGN KEY (owner_id, tenant_id)
    REFERENCES users (id, tenant_id),
  CONSTRAINT contacts_account_fk
    FOREIGN KEY (account_id, tenant_id)
    REFERENCES accounts (id, tenant_id),
  CONSTRAINT contacts_role_option_fk
    FOREIGN KEY (role_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_active
  ON contacts (tenant_id, last_name, first_name, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_owner_active
  ON contacts (tenant_id, owner_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_account_active
  ON contacts (tenant_id, account_id, last_name)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS crm_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'account', 'contact')),
  entity_id UUID NOT NULL,
  author_user_id UUID NULL,
  body TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT crm_notes_author_fk
    FOREIGN KEY (author_user_id, tenant_id)
    REFERENCES users (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_notes_tenant_entity_active
  ON crm_notes (tenant_id, entity_type, entity_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'account', 'contact')),
  entity_id UUID NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('call', 'email', 'meeting', 'task', 'status_change', 'note')),
  subject TEXT NOT NULL,
  description TEXT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  author_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT crm_activities_author_fk
    FOREIGN KEY (author_user_id, tenant_id)
    REFERENCES users (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_tenant_entity_active
  ON crm_activities (tenant_id, entity_type, entity_id, occurred_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_crm_notes_updated_at
  BEFORE UPDATE ON crm_notes
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_crm_activities_updated_at
  BEFORE UPDATE ON crm_activities
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS trg_crm_activities_updated_at ON crm_activities;
DROP TRIGGER IF EXISTS trg_crm_notes_updated_at ON crm_notes;
DROP TRIGGER IF EXISTS trg_contacts_updated_at ON contacts;
DROP TRIGGER IF EXISTS trg_accounts_updated_at ON accounts;
DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;

DROP TABLE IF EXISTS crm_activities;
DROP TABLE IF EXISTS crm_notes;
DROP TABLE IF EXISTS contacts;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS leads;
