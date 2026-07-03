-- migrate:up
-- Persona 32 (Executive / CEO / CXO): strategic risk register (EXE-003) and executive insight
-- actions (EXE-002). The command-center KPIs (EXE-001) are computed live from CRM tables.

CREATE TABLE IF NOT EXISTS strategic_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  title TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('opportunity', 'customer', 'support', 'renewal', 'ai_alert', 'manual')),
  source_entity_type TEXT NULL,
  source_entity_id UUID NULL,
  owner_id UUID NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  impact TEXT NULL,
  mitigation TEXT NULL,
  due_date DATE NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'monitoring', 'mitigated', 'closed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT strategic_risks_id_tenant_unique UNIQUE (id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_strategic_risks_tenant_status ON strategic_risks (tenant_id, status, severity, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS executive_insight_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  insight_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  assigned_to UUID NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL,
  updated_by UUID NULL
);
CREATE INDEX IF NOT EXISTS idx_executive_insight_actions_tenant ON executive_insight_actions (tenant_id, created_at DESC);

CREATE TRIGGER trg_strategic_risks_updated_at BEFORE UPDATE ON strategic_risks FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_executive_insight_actions_updated_at BEFORE UPDATE ON executive_insight_actions FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TABLE IF EXISTS executive_insight_actions;
DROP TABLE IF EXISTS strategic_risks;
