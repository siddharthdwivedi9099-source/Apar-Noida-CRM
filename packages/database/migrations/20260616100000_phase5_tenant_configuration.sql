-- migrate:up
CREATE TABLE IF NOT EXISTS tenant_option_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  set_key TEXT NOT NULL,
  module_key TEXT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('dropdown', 'pipeline', 'ticket_status', 'customer_success_stage')),
  name TEXT NOT NULL,
  description TEXT NULL,
  is_system_set BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  owner_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT tenant_option_sets_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT tenant_option_sets_tenant_set_key_unique UNIQUE (tenant_id, set_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_option_sets_tenant_active
  ON tenant_option_sets (tenant_id, module_key, kind, name)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS tenant_option_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  option_set_id UUID NOT NULL,
  value_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NULL,
  color TEXT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  owner_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT tenant_option_values_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT tenant_option_values_tenant_set_value_unique UNIQUE (tenant_id, option_set_id, value_key),
  CONSTRAINT tenant_option_values_set_fk
    FOREIGN KEY (option_set_id, tenant_id)
    REFERENCES tenant_option_sets (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_option_values_tenant_active
  ON tenant_option_values (tenant_id, option_set_id, sort_order, label)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS custom_form_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  module_key TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  layout_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  layout_schema JSONB NOT NULL DEFAULT jsonb_build_object('sections', jsonb_build_array()),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system_layout BOOLEAN NOT NULL DEFAULT false,
  owner_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT custom_form_layouts_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT custom_form_layouts_tenant_layout_unique UNIQUE (tenant_id, entity_key, layout_key)
);

CREATE INDEX IF NOT EXISTS idx_custom_form_layouts_tenant_active
  ON custom_form_layouts (tenant_id, module_key, entity_key, name)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  module_key TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NULL,
  data_type TEXT NOT NULL CHECK (
    data_type IN ('text', 'textarea', 'number', 'date', 'datetime', 'email', 'phone', 'url', 'select', 'multiselect', 'boolean')
  ),
  placeholder TEXT NULL,
  option_set_id UUID NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system_field BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  owner_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT custom_field_definitions_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT custom_field_definitions_tenant_field_unique UNIQUE (tenant_id, entity_key, field_key),
  CONSTRAINT custom_field_definitions_option_set_fk
    FOREIGN KEY (option_set_id, tenant_id)
    REFERENCES tenant_option_sets (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_tenant_active
  ON custom_field_definitions (tenant_id, module_key, entity_key, sort_order, label)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_tenant_option_sets_updated_at
  BEFORE UPDATE ON tenant_option_sets
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_tenant_option_values_updated_at
  BEFORE UPDATE ON tenant_option_values
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_custom_form_layouts_updated_at
  BEFORE UPDATE ON custom_form_layouts
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_custom_field_definitions_updated_at
  BEFORE UPDATE ON custom_field_definitions
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS trg_custom_field_definitions_updated_at ON custom_field_definitions;
DROP TRIGGER IF EXISTS trg_custom_form_layouts_updated_at ON custom_form_layouts;
DROP TRIGGER IF EXISTS trg_tenant_option_values_updated_at ON tenant_option_values;
DROP TRIGGER IF EXISTS trg_tenant_option_sets_updated_at ON tenant_option_sets;

DROP TABLE IF EXISTS custom_field_definitions;
DROP TABLE IF EXISTS custom_form_layouts;
DROP TABLE IF EXISTS tenant_option_values;
DROP TABLE IF EXISTS tenant_option_sets;
