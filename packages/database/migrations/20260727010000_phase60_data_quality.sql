-- migrate:up
-- Persona 31 (Data Quality Manager): enrichment queue (DQM-003), merge log (DQM-004), and import
-- batch log (DQM-002). The quality dashboard (DQM-001) is computed live from the CRM tables.

CREATE TABLE IF NOT EXISTS dq_enrichment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  entity_type TEXT NOT NULL DEFAULT 'lead' CHECK (entity_type IN ('lead', 'contact', 'account')),
  entity_id UUID NOT NULL,
  missing_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggestions JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'edited')),
  source TEXT NULL,
  confidence INTEGER NULL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100)),
  resolved_by UUID NULL,
  resolved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT dq_enrichment_queue_entity_unique UNIQUE (tenant_id, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_dq_enrichment_queue_tenant_status ON dq_enrichment_queue (tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS dq_merge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'contact', 'account')),
  master_id UUID NOT NULL,
  duplicate_id UUID NOT NULL,
  field_selections JSONB NOT NULL DEFAULT '{}'::jsonb,
  preserved JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT NOT NULL,
  merged_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dq_merge_log_tenant ON dq_merge_log (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS dq_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  entity_type TEXT NOT NULL DEFAULT 'lead' CHECK (entity_type IN ('lead', 'contact', 'account')),
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,
  imported_rows INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'committed' CHECK (status IN ('validated', 'committed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL
);
CREATE INDEX IF NOT EXISTS idx_dq_import_batches_tenant ON dq_import_batches (tenant_id, created_at DESC);

CREATE TRIGGER trg_dq_enrichment_queue_updated_at BEFORE UPDATE ON dq_enrichment_queue FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TABLE IF EXISTS dq_import_batches;
DROP TABLE IF EXISTS dq_merge_log;
DROP TABLE IF EXISTS dq_enrichment_queue;
