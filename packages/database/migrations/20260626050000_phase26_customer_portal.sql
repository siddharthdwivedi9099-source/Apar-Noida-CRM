-- migrate:up

CREATE TABLE IF NOT EXISTS customer_portal_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  user_id UUID NOT NULL,
  account_id UUID NOT NULL,
  contact_id UUID,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  portal_role TEXT NOT NULL DEFAULT 'customer_user',
  job_title TEXT,
  phone TEXT,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,
  CONSTRAINT customer_portal_profiles_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT customer_portal_profiles_user_fk FOREIGN KEY (user_id, tenant_id) REFERENCES users (id, tenant_id),
  CONSTRAINT customer_portal_profiles_account_fk FOREIGN KEY (account_id, tenant_id) REFERENCES accounts (id, tenant_id),
  CONSTRAINT customer_portal_profiles_contact_fk FOREIGN KEY (contact_id, tenant_id) REFERENCES contacts (id, tenant_id),
  CONSTRAINT customer_portal_profiles_created_by_fk FOREIGN KEY (created_by, tenant_id) REFERENCES users (id, tenant_id),
  CONSTRAINT customer_portal_profiles_updated_by_fk FOREIGN KEY (updated_by, tenant_id) REFERENCES users (id, tenant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_customer_portal_profiles_tenant_user_active
  ON customer_portal_profiles (tenant_id, user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_portal_profiles_tenant_account_active
  ON customer_portal_profiles (tenant_id, account_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_portal_profiles_tenant_contact_active
  ON customer_portal_profiles (tenant_id, contact_id)
  WHERE deleted_at IS NULL AND contact_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS customer_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  profile_id UUID NOT NULL,
  account_id UUID NOT NULL,
  feedback_type TEXT NOT NULL DEFAULT 'csat' CHECK (feedback_type IN ('csat', 'product_feedback', 'portal_feedback')),
  rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  comment TEXT,
  related_entity_type TEXT,
  related_entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,
  CONSTRAINT customer_feedback_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT customer_feedback_profile_fk FOREIGN KEY (profile_id, tenant_id) REFERENCES customer_portal_profiles (id, tenant_id),
  CONSTRAINT customer_feedback_account_fk FOREIGN KEY (account_id, tenant_id) REFERENCES accounts (id, tenant_id),
  CONSTRAINT customer_feedback_created_by_fk FOREIGN KEY (created_by, tenant_id) REFERENCES users (id, tenant_id),
  CONSTRAINT customer_feedback_updated_by_fk FOREIGN KEY (updated_by, tenant_id) REFERENCES users (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_feedback_tenant_account_active
  ON customer_feedback (tenant_id, account_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_feedback_tenant_profile_active
  ON customer_feedback (tenant_id, profile_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_customer_portal_profiles_updated_at
  BEFORE UPDATE ON customer_portal_profiles
  FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_customer_feedback_updated_at
  BEFORE UPDATE ON customer_feedback
  FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- migrate:down

DROP TRIGGER IF EXISTS trg_customer_feedback_updated_at ON customer_feedback;
DROP TRIGGER IF EXISTS trg_customer_portal_profiles_updated_at ON customer_portal_profiles;

DROP TABLE IF EXISTS customer_feedback;
DROP TABLE IF EXISTS customer_portal_profiles;
