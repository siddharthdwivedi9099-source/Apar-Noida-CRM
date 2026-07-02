-- migrate:up
-- Persona 29 (System Administrator): integration monitoring (SYS-001), environment management
-- (SYS-003), and backup/recovery controls (SYS-004). Audit logging (SYS-002) already exists in
-- audit_logs. All tables are tenant-scoped and append-only where the story requires immutability.

-- SYS-001: integration connections + their sync-run history (retries, latency, errors, retention).
CREATE TABLE IF NOT EXISTS integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT integration_connections_id_tenant_unique UNIQUE (id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_integration_connections_tenant_active ON integration_connections (tenant_id, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS integration_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  connection_id UUID NOT NULL,
  direction TEXT NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  records_processed INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NULL,
  error_message TEXT NULL,
  retry_of UUID NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT integration_sync_runs_connection_fk FOREIGN KEY (connection_id, tenant_id) REFERENCES integration_connections (id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_integration_sync_runs_tenant_conn ON integration_sync_runs (tenant_id, connection_id, started_at DESC);

-- SYS-003: labeled environments + tracked deployments (production requires approval; rollback plan).
CREATE TABLE IF NOT EXISTS environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  label TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'dev' CHECK (kind IN ('dev', 'test', 'staging', 'production')),
  is_production BOOLEAN NOT NULL DEFAULT false,
  notes TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT environments_id_tenant_unique UNIQUE (id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_environments_tenant_active ON environments (tenant_id, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS environment_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  environment_id UUID NOT NULL,
  configuration_version_id UUID NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'pending_approval', 'approved', 'deployed', 'rolled_back', 'rejected')),
  rollback_plan TEXT NULL,
  approved_by UUID NULL,
  approved_at TIMESTAMPTZ NULL,
  deployed_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT environment_deployments_env_fk FOREIGN KEY (environment_id, tenant_id) REFERENCES environments (id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_environment_deployments_tenant_env ON environment_deployments (tenant_id, environment_id, created_at DESC);

-- SYS-004: backup policy (schedule + RPO/RTO) and backup/restore-test run log.
CREATE TABLE IF NOT EXISTS backup_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  name TEXT NOT NULL DEFAULT 'Default backup policy',
  schedule_cron TEXT NOT NULL DEFAULT '0 2 * * *',
  rpo_minutes INTEGER NOT NULL DEFAULT 1440,
  rto_minutes INTEGER NOT NULL DEFAULT 240,
  retention_days INTEGER NOT NULL DEFAULT 30,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT backup_policies_id_tenant_unique UNIQUE (id, tenant_id)
);

CREATE TABLE IF NOT EXISTS backup_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  policy_id UUID NULL,
  run_type TEXT NOT NULL DEFAULT 'backup' CHECK (run_type IN ('backup', 'restore_test')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  size_bytes BIGINT NULL,
  error_message TEXT NULL,
  notes TEXT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NULL,
  CONSTRAINT backup_runs_policy_fk FOREIGN KEY (policy_id, tenant_id) REFERENCES backup_policies (id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_backup_runs_tenant_started ON backup_runs (tenant_id, started_at DESC);

CREATE TRIGGER trg_integration_connections_updated_at BEFORE UPDATE ON integration_connections FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_environments_updated_at BEFORE UPDATE ON environments FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_environment_deployments_updated_at BEFORE UPDATE ON environment_deployments FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_backup_policies_updated_at BEFORE UPDATE ON backup_policies FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TABLE IF EXISTS backup_runs;
DROP TABLE IF EXISTS backup_policies;
DROP TABLE IF EXISTS environment_deployments;
DROP TABLE IF EXISTS environments;
DROP TABLE IF EXISTS integration_sync_runs;
DROP TABLE IF EXISTS integration_connections;
