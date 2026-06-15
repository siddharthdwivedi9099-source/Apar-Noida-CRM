-- migrate:up
CREATE TABLE IF NOT EXISTS role_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NULL,
  owner_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL
);

CREATE INDEX IF NOT EXISTS idx_role_templates_active
  ON role_templates (name)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS role_template_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_template_id UUID NOT NULL REFERENCES role_templates (id),
  permission_id UUID NOT NULL REFERENCES permissions (id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT role_template_permissions_unique UNIQUE (role_template_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_template_permissions_active
  ON role_template_permissions (role_template_id, permission_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_role_templates_updated_at
  BEFORE UPDATE ON role_templates
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_role_template_permissions_updated_at
  BEFORE UPDATE ON role_template_permissions
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS trg_role_template_permissions_updated_at ON role_template_permissions;
DROP TRIGGER IF EXISTS trg_role_templates_updated_at ON role_templates;

DROP TABLE IF EXISTS role_template_permissions;
DROP TABLE IF EXISTS role_templates;
