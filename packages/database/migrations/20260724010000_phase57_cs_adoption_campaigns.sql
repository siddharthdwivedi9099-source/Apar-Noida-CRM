-- migrate:up
-- Persona 25 (CSM — Scaled) CSMS-002: tenant-level adoption campaigns targeting many customers by
-- usage / module / role / segment / health band. Targeting + performance live in JSONB so the
-- scaled-CS motion stays configurable; all other CSMS state reuses existing CS tables + metadata.
CREATE TABLE IF NOT EXISTS cs_adoption_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  owner_id UUID NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_template TEXT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT cs_adoption_campaigns_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT cs_adoption_campaigns_owner_fk
    FOREIGN KEY (owner_id, tenant_id) REFERENCES users (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_cs_adoption_campaigns_tenant_active ON cs_adoption_campaigns (tenant_id, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_cs_adoption_campaigns_updated_at BEFORE UPDATE ON cs_adoption_campaigns FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TABLE IF EXISTS cs_adoption_campaigns;
