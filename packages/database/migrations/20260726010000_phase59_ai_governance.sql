-- migrate:up
-- Persona 30 (AI Governance Manager): AI use-case registry with versioning (AIG-001), AI feedback
-- capture incl. hallucination reports (AIG-003/AIG-004), and AI improvement tasks (AIG-005).
-- AI action approval (AIG-002) and the AI audit trail (AIG-004) already exist in ai_action_runs +
-- the AI gateway logs; this phase adds the governance registry, quality, and feedback layer.

CREATE TABLE IF NOT EXISTS ai_use_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  name TEXT NOT NULL,
  owner_id UUID NULL,
  object_type TEXT NULL,
  persona TEXT NULL,
  data_used TEXT NULL,
  action_type TEXT NOT NULL DEFAULT 'assist' CHECK (action_type IN ('assist', 'score', 'draft', 'classify', 'recommend', 'automate')),
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  approval_status TEXT NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft', 'pending_approval', 'approved', 'rejected')),
  model TEXT NULL,
  prompt TEXT NULL,
  monitoring_plan TEXT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  approved_by UUID NULL,
  approved_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT ai_use_cases_id_tenant_unique UNIQUE (id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_use_cases_tenant_active ON ai_use_cases (tenant_id, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS ai_use_case_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  use_case_id UUID NOT NULL,
  version INTEGER NOT NULL,
  change_reason TEXT NULL,
  snapshot JSONB NOT NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_use_case_versions_fk FOREIGN KEY (use_case_id, tenant_id) REFERENCES ai_use_cases (id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_use_case_versions_uc ON ai_use_case_versions (tenant_id, use_case_id, version DESC);

CREATE TABLE IF NOT EXISTS ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  run_id UUID NULL,
  use_case_id UUID NULL,
  entity_type TEXT NULL,
  entity_id UUID NULL,
  rating TEXT NOT NULL DEFAULT 'neutral' CHECK (rating IN ('helpful', 'not_helpful', 'neutral')),
  is_hallucination BOOLEAN NOT NULL DEFAULT false,
  confidence_flag TEXT NOT NULL DEFAULT 'normal' CHECK (confidence_flag IN ('normal', 'low')),
  comment TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_tenant_created ON ai_feedback (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_improvement_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  use_case_id UUID NULL,
  feedback_id UUID NULL,
  source TEXT NOT NULL DEFAULT 'quality' CHECK (source IN ('feedback', 'hallucination', 'quality', 'override')),
  title TEXT NOT NULL,
  description TEXT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done')),
  owner_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL,
  updated_by UUID NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_improvement_tasks_tenant ON ai_improvement_tasks (tenant_id, created_at DESC);

CREATE TRIGGER trg_ai_use_cases_updated_at BEFORE UPDATE ON ai_use_cases FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_ai_improvement_tasks_updated_at BEFORE UPDATE ON ai_improvement_tasks FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TABLE IF EXISTS ai_improvement_tasks;
DROP TABLE IF EXISTS ai_feedback;
DROP TABLE IF EXISTS ai_use_case_versions;
DROP TABLE IF EXISTS ai_use_cases;
