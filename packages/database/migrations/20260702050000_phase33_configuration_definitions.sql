-- migrate:up
-- Generic registry for configurable definition types governed by the
-- configuration engine: module metadata, objects, page layouts, business
-- process flows, approval matrices, notification rules, and dashboards.
-- Additive only.
CREATE TABLE IF NOT EXISTS configuration_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  definition_type TEXT NOT NULL CHECK (
    definition_type IN ('module_meta', 'object', 'page_layout', 'business_process_flow', 'approval_matrix', 'notification_rule', 'dashboard')
  ),
  definition_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT configuration_definitions_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT configuration_definitions_tenant_type_key_unique UNIQUE (tenant_id, definition_type, definition_key)
);

CREATE INDEX IF NOT EXISTS idx_configuration_definitions_tenant_type
  ON configuration_definitions (tenant_id, definition_type, definition_key)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_configuration_definitions_updated_at
  BEFORE UPDATE ON configuration_definitions
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS trg_configuration_definitions_updated_at ON configuration_definitions;
DROP INDEX IF EXISTS idx_configuration_definitions_tenant_type;
DROP TABLE IF EXISTS configuration_definitions;
