-- migrate:up
-- Persona 16 (Proposal / Bid Manager) PB-004: tenant-level approved content library.
-- The per-opportunity proposal workspace (PB-001/002/003/005) lives in opportunity metadata;
-- only the cross-opportunity content library needs its own table.
CREATE TABLE IF NOT EXISTS proposal_content_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  category_option_id UUID NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  expires_at DATE NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL REFERENCES users (id),
  updated_by UUID NULL REFERENCES users (id),
  CONSTRAINT proposal_content_library_category_fk
    FOREIGN KEY (category_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_proposal_content_tenant_category
  ON proposal_content_library (tenant_id, category_option_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER set_proposal_content_library_updated_at
  BEFORE UPDATE ON proposal_content_library
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

-- Backfill the proposal option sets for existing tenants (idempotent).
INSERT INTO tenant_option_sets (tenant_id, set_key, module_key, kind, name, description, is_system_set, is_active, metadata)
SELECT t.id, v.set_key, 'presales', 'dropdown', v.name, v.description, true, true, '{"seeded": true, "phase": "phase-50-proposals"}'::jsonb
FROM tenants t
CROSS JOIN (VALUES
  ('proposal-request-status', 'Proposal Request Status', 'Lifecycle states for proposal/bid requests (PB-001).'),
  ('proposal-content-category', 'Proposal Content Category', 'Approved proposal content-library categories (PB-004).')
) AS v(set_key, name, description)
WHERE t.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_sets s WHERE s.tenant_id = t.id AND s.set_key = v.set_key);

INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata, color)
SELECT s.tenant_id, s.id, v.value_key, v.label, v.sort_order, v.is_default, true, '{}'::jsonb, v.color
FROM tenant_option_sets s
CROSS JOIN (VALUES
  ('proposal-request-status', 'draft', 'Draft', 0, true, '#94a3b8'),
  ('proposal-request-status', 'in_progress', 'In Progress', 1, false, '#06b6d4'),
  ('proposal-request-status', 'in_review', 'In Review', 2, false, '#0ea5e9'),
  ('proposal-request-status', 'approved', 'Approved', 3, false, '#8b5cf6'),
  ('proposal-request-status', 'submitted', 'Submitted', 4, false, '#22c55e'),
  ('proposal-request-status', 'archived', 'Archived', 5, false, '#64748b'),
  ('proposal-content-category', 'product_description', 'Product Description', 0, true, '#0ea5e9'),
  ('proposal-content-category', 'case_study', 'Case Study', 1, false, '#22c55e'),
  ('proposal-content-category', 'security_response', 'Security Response', 2, false, '#ef4444'),
  ('proposal-content-category', 'implementation_methodology', 'Implementation Methodology', 3, false, '#6366f1'),
  ('proposal-content-category', 'pricing_assumptions', 'Pricing Assumptions', 4, false, '#f59e0b'),
  ('proposal-content-category', 'company_profile', 'Company Profile', 5, false, '#14b8a6')
) AS v(set_key, value_key, label, sort_order, is_default, color)
WHERE s.set_key = v.set_key AND s.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_option_values ov WHERE ov.tenant_id = s.tenant_id AND ov.option_set_id = s.id AND ov.value_key = v.value_key);

-- migrate:down
DROP TABLE IF EXISTS proposal_content_library;

DELETE FROM tenant_option_values ov
USING tenant_option_sets s
WHERE s.id = ov.option_set_id AND s.tenant_id = ov.tenant_id AND s.set_key IN ('proposal-request-status', 'proposal-content-category');

DELETE FROM tenant_option_sets WHERE set_key IN ('proposal-request-status', 'proposal-content-category');
