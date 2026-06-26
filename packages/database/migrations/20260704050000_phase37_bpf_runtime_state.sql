-- migrate:up
-- BPF runtime overlay: current stage per record and full stage-change history.
-- Generic across all CRM objects; additive, does not touch existing object tables.
CREATE TABLE IF NOT EXISTS bpf_record_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  object TEXT NOT NULL,
  record_id TEXT NOT NULL,
  bpf_key TEXT NOT NULL,
  current_stage TEXT NOT NULL,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT bpf_record_state_tenant_object_record_unique UNIQUE (tenant_id, object, record_id, bpf_key)
);

CREATE INDEX IF NOT EXISTS idx_bpf_record_state_lookup
  ON bpf_record_state (tenant_id, object, record_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS bpf_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  object TEXT NOT NULL,
  record_id TEXT NOT NULL,
  bpf_key TEXT NOT NULL,
  from_stage TEXT NULL,
  to_stage TEXT NOT NULL,
  reason TEXT NULL,
  override_reason TEXT NULL,
  is_backward BOOLEAN NOT NULL DEFAULT false,
  is_override BOOLEAN NOT NULL DEFAULT false,
  changed_by UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bpf_stage_history_lookup
  ON bpf_stage_history (tenant_id, object, record_id, created_at DESC);

CREATE TRIGGER trg_bpf_record_state_updated_at
  BEFORE UPDATE ON bpf_record_state
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS trg_bpf_record_state_updated_at ON bpf_record_state;
DROP INDEX IF EXISTS idx_bpf_stage_history_lookup;
DROP TABLE IF EXISTS bpf_stage_history;
DROP INDEX IF EXISTS idx_bpf_record_state_lookup;
DROP TABLE IF EXISTS bpf_record_state;
