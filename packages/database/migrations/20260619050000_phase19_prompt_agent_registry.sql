-- migrate:up
CREATE TABLE IF NOT EXISTS ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  prompt_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  module TEXT NOT NULL DEFAULT 'general',
  prompt_role TEXT NOT NULL DEFAULT 'system'
    CHECK (prompt_role IN ('system', 'user', 'assistant', 'tool')),
  input_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  guardrails JSONB NOT NULL DEFAULT '[]'::jsonb,
  approval_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (approval_status IN ('draft', 'pending_review', 'approved', 'rejected')),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  current_version INTEGER NOT NULL DEFAULT 1,
  latest_version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT uniq_ai_prompts_id_tenant UNIQUE (id, tenant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_ai_prompts_tenant_key_active ON ai_prompts (tenant_id, prompt_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_prompts_tenant_module ON ai_prompts (tenant_id, module) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_prompts_tenant_approval ON ai_prompts (tenant_id, approval_status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS ai_prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  prompt_id UUID NOT NULL,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  input_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  guardrails JSONB NOT NULL DEFAULT '[]'::jsonb,
  change_summary TEXT NOT NULL DEFAULT '',
  approval_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (approval_status IN ('draft', 'pending_review', 'approved', 'rejected')),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL,
  CONSTRAINT fk_ai_prompt_versions_prompt FOREIGN KEY (prompt_id, tenant_id) REFERENCES ai_prompts (id, tenant_id),
  CONSTRAINT uniq_ai_prompt_versions_prompt_version UNIQUE (tenant_id, prompt_id, version)
);

CREATE INDEX IF NOT EXISTS idx_ai_prompt_versions_prompt ON ai_prompt_versions (tenant_id, prompt_id, version DESC);

CREATE TABLE IF NOT EXISTS ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  agent_key TEXT NOT NULL,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT '',
  module TEXT NOT NULL DEFAULT 'general',
  allowed_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  allowed_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  data_access_scope TEXT NOT NULL DEFAULT 'module'
    CHECK (data_access_scope IN ('own', 'team', 'module', 'tenant')),
  requires_human_approval BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'inactive')),
  logging_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  escalation_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_ai_agents_tenant_key_active ON ai_agents (tenant_id, agent_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_agents_tenant_module ON ai_agents (tenant_id, module) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_agents_tenant_status ON ai_agents (tenant_id, status) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_ai_prompts_updated_at BEFORE UPDATE ON ai_prompts FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_ai_agents_updated_at BEFORE UPDATE ON ai_agents FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS trg_ai_agents_updated_at ON ai_agents;
DROP TRIGGER IF EXISTS trg_ai_prompts_updated_at ON ai_prompts;
DROP TABLE IF EXISTS ai_agents;
DROP TABLE IF EXISTS ai_prompt_versions;
DROP TABLE IF EXISTS ai_prompts;
