-- migrate:up
CREATE TABLE IF NOT EXISTS data_governance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  audit_log_retention_days INTEGER NOT NULL DEFAULT 365 CHECK (audit_log_retention_days > 0),
  ai_log_retention_days INTEGER NOT NULL DEFAULT 180 CHECK (ai_log_retention_days > 0),
  export_log_retention_days INTEGER NOT NULL DEFAULT 365 CHECK (export_log_retention_days > 0),
  pii_redaction_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  failed_access_logging_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  file_upload_max_mb INTEGER NOT NULL DEFAULT 25 CHECK (file_upload_max_mb > 0),
  allowed_file_types JSONB NOT NULL DEFAULT '["pdf","png","jpg","jpeg","csv","docx","xlsx"]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_data_governance_settings_tenant_active ON data_governance_settings (tenant_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_data_governance_settings_updated_at BEFORE UPDATE ON data_governance_settings FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- Indexes to support centralized audit-log querying introduced in Phase 27.
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_event_created ON audit_logs (tenant_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_action_created ON audit_logs (tenant_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_status_created ON audit_logs (tenant_id, status, created_at DESC);

-- migrate:down
DROP INDEX IF EXISTS idx_audit_logs_tenant_status_created;
DROP INDEX IF EXISTS idx_audit_logs_tenant_action_created;
DROP INDEX IF EXISTS idx_audit_logs_tenant_event_created;
DROP TRIGGER IF EXISTS trg_data_governance_settings_updated_at ON data_governance_settings;
DROP TABLE IF EXISTS data_governance_settings;
