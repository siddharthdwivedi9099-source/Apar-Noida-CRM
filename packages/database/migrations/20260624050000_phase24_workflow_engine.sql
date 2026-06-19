-- migrate:up
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  module TEXT NOT NULL DEFAULT 'workflows',
  trigger_type TEXT NOT NULL
    CHECK (trigger_type IN (
      'record_created', 'record_updated', 'stage_changed', 'assignment_changed', 'date_reached',
      'sla_breached', 'campaign_response_received', 'ticket_escalated', 'ai_score_changed',
      'customer_health_changed', 'onboarding_delayed', 'training_incomplete', 'renewal_approaching', 'usage_dropped'
    )),
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'inactive')),
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  run_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT uniq_workflows_id_tenant UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_workflows_tenant_trigger ON workflows (tenant_id, trigger_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workflows_tenant_status ON workflows (tenant_id, status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS workflow_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  workflow_id UUID NOT NULL,
  action_type TEXT NOT NULL
    CHECK (action_type IN (
      'assign_owner', 'create_task', 'send_notification', 'send_email', 'update_field', 'change_status',
      'trigger_approval', 'call_webhook', 'run_ai_prompt', 'run_ai_agent', 'create_support_ticket',
      'assign_training', 'create_customer_success_task', 'trigger_renewal_playbook'
    )),
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  requires_permission TEXT NULL,
  sequence INTEGER NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT fk_workflow_actions_workflow FOREIGN KEY (workflow_id, tenant_id) REFERENCES workflows (id, tenant_id),
  CONSTRAINT uniq_workflow_actions_id_tenant UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_actions_workflow ON workflow_actions (tenant_id, workflow_id, sequence) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  workflow_id UUID NOT NULL,
  trigger_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'succeeded', 'failed', 'skipped')),
  trigger_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions_total INTEGER NOT NULL DEFAULT 0,
  actions_succeeded INTEGER NOT NULL DEFAULT 0,
  actions_failed INTEGER NOT NULL DEFAULT 0,
  error_message TEXT NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NULL,
  triggered_by UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_workflow_runs_workflow FOREIGN KEY (workflow_id, tenant_id) REFERENCES workflows (id, tenant_id),
  CONSTRAINT uniq_workflow_runs_id_tenant UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs (tenant_id, workflow_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_tenant_status ON workflow_runs (tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS workflow_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  run_id UUID NOT NULL,
  workflow_id UUID NOT NULL,
  action_id UUID NULL,
  action_type TEXT NULL,
  sequence INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'succeeded'
    CHECK (status IN ('succeeded', 'failed', 'skipped')),
  message TEXT NOT NULL DEFAULT '',
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_workflow_logs_run FOREIGN KEY (run_id, tenant_id) REFERENCES workflow_runs (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_logs_run ON workflow_logs (tenant_id, run_id, sequence);

CREATE TRIGGER trg_workflows_updated_at BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_workflow_actions_updated_at BEFORE UPDATE ON workflow_actions FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS trg_workflow_actions_updated_at ON workflow_actions;
DROP TRIGGER IF EXISTS trg_workflows_updated_at ON workflows;
DROP TABLE IF EXISTS workflow_logs;
DROP TABLE IF EXISTS workflow_runs;
DROP TABLE IF EXISTS workflow_actions;
DROP TABLE IF EXISTS workflows;
