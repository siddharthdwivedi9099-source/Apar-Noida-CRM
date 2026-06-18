-- migrate:up
CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  default_provider TEXT NOT NULL DEFAULT 'anthropic'
    CHECK (default_provider IN ('openai', 'anthropic', 'azure_openai', 'local')),
  default_model TEXT NOT NULL DEFAULT 'claude-opus-4-8',
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60 CHECK (rate_limit_per_minute > 0),
  allow_user_overrides BOOLEAN NOT NULL DEFAULT FALSE,
  redaction_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  logging_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_ai_settings_tenant_active ON ai_settings (tenant_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  actor_user_id UUID NULL,
  session_id UUID NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  template_key TEXT NULL,
  capability TEXT NULL,
  request_type TEXT NOT NULL DEFAULT 'completion',
  status TEXT NOT NULL DEFAULT 'placeholder'
    CHECK (status IN ('placeholder', 'success', 'error', 'rate_limited', 'denied')),
  prompt_tokens INTEGER NULL,
  completion_tokens INTEGER NULL,
  total_tokens INTEGER NULL,
  latency_ms INTEGER NULL,
  error_code TEXT NULL,
  error_message TEXT NULL,
  request_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_tenant_created ON ai_usage_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_tenant_actor_created ON ai_usage_logs (tenant_id, actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_tenant_provider_created ON ai_usage_logs (tenant_id, provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_tenant_status_created ON ai_usage_logs (tenant_id, status, created_at DESC);

CREATE TRIGGER trg_ai_settings_updated_at BEFORE UPDATE ON ai_settings FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS trg_ai_settings_updated_at ON ai_settings;
DROP TABLE IF EXISTS ai_usage_logs;
DROP TABLE IF EXISTS ai_settings;
