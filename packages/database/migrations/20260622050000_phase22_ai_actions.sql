-- migrate:up
CREATE TABLE IF NOT EXISTS ai_action_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  action_key TEXT NOT NULL,
  module TEXT NOT NULL,
  capability TEXT NOT NULL,
  template_key TEXT NOT NULL,
  entity_type TEXT NULL,
  entity_id UUID NULL,
  provider TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed', 'pending_review', 'error')),
  requires_review BOOLEAN NOT NULL DEFAULT FALSE,
  review_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (review_status IN ('not_required', 'pending_review', 'approved', 'rejected')),
  output TEXT NOT NULL DEFAULT '',
  resolved_prompt TEXT NOT NULL DEFAULT '',
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  prompt_tokens INTEGER NULL,
  completion_tokens INTEGER NULL,
  total_tokens INTEGER NULL,
  reviewed_by UUID NULL,
  reviewed_at TIMESTAMPTZ NULL,
  review_note TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT uniq_ai_action_runs_id_tenant UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_action_runs_tenant_created ON ai_action_runs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_action_runs_tenant_module ON ai_action_runs (tenant_id, module, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_action_runs_tenant_action ON ai_action_runs (tenant_id, action_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_action_runs_tenant_review ON ai_action_runs (tenant_id, review_status, created_at DESC);

CREATE TRIGGER trg_ai_action_runs_updated_at BEFORE UPDATE ON ai_action_runs FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS trg_ai_action_runs_updated_at ON ai_action_runs;
DROP TABLE IF EXISTS ai_action_runs;
