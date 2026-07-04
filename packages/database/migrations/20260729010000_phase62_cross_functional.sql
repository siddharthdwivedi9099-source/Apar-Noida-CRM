-- migrate:up
-- Cross-functional user stories: lead source attribution / multi-touch (CF-001), meeting
-- intelligence (CF-004), next best action (CF-005), record ownership history (CF-006), document
-- management (CF-009), and internal comments + mentions (CF-010). The unified timeline (CF-002),
-- task management (CF-003), SLA (CF-007) and approvals (CF-008) already exist in the crm / support
-- / approvals modules.

-- CF-001: multi-touch attribution touches for leads.
CREATE TABLE IF NOT EXISTS cf_attribution_touches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  lead_id UUID NOT NULL,
  source TEXT NOT NULL,
  sub_source TEXT NULL,
  campaign TEXT NULL,
  utm JSONB NOT NULL DEFAULT '{}'::jsonb,
  partner TEXT NULL,
  event TEXT NULL,
  referral TEXT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cf_attribution_touches_lead ON cf_attribution_touches (tenant_id, lead_id, occurred_at ASC);

-- CF-004: AI meeting summaries linked to a record.
CREATE TABLE IF NOT EXISTS cf_meeting_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'account', 'contact', 'opportunity', 'ticket', 'customer_success_account')),
  entity_id UUID NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NULL,
  decisions TEXT NULL,
  objections TEXT NULL,
  next_steps TEXT NULL,
  stakeholders TEXT NULL,
  sentiment TEXT NOT NULL DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'saved')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL,
  updated_by UUID NULL
);
CREATE INDEX IF NOT EXISTS idx_cf_meeting_summaries_entity ON cf_meeting_summaries (tenant_id, entity_type, entity_id, created_at DESC);

-- CF-005: next-best-action recommendations with accept/dismiss/snooze.
CREATE TABLE IF NOT EXISTS cf_next_best_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'account', 'contact', 'opportunity', 'ticket', 'customer_success_account')),
  entity_id UUID NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('call', 'email', 'meeting', 'proposal', 'manager_review', 'nurture', 'escalation', 'closure')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed', 'snoozed')),
  snoozed_until TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL,
  updated_by UUID NULL
);
CREATE INDEX IF NOT EXISTS idx_cf_nba_entity ON cf_next_best_actions (tenant_id, entity_type, entity_id, created_at DESC);

-- CF-006: record ownership change history.
CREATE TABLE IF NOT EXISTS cf_ownership_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'account', 'opportunity', 'ticket', 'customer_success_account')),
  entity_id UUID NOT NULL,
  from_owner_id UUID NULL,
  to_owner_id UUID NULL,
  reason TEXT NOT NULL,
  changed_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cf_ownership_changes_entity ON cf_ownership_changes (tenant_id, entity_type, entity_id, created_at DESC);

-- CF-009: documents + version history.
CREATE TABLE IF NOT EXISTS cf_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'account', 'contact', 'opportunity', 'ticket', 'customer_success_account')),
  entity_id UUID NOT NULL,
  name TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_version INTEGER NOT NULL DEFAULT 1,
  locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT cf_documents_id_tenant_unique UNIQUE (id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_cf_documents_entity ON cf_documents (tenant_id, entity_type, entity_id, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS cf_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  document_id UUID NOT NULL,
  version INTEGER NOT NULL,
  file_ref TEXT NOT NULL,
  notes TEXT NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cf_document_versions_fk FOREIGN KEY (document_id, tenant_id) REFERENCES cf_documents (id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_cf_document_versions_doc ON cf_document_versions (tenant_id, document_id, version DESC);

-- CF-010: internal record comments with mentions.
CREATE TABLE IF NOT EXISTS cf_record_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'account', 'contact', 'opportunity', 'ticket', 'customer_success_account')),
  entity_id UUID NOT NULL,
  body TEXT NOT NULL,
  mentions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_internal BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL
);
CREATE INDEX IF NOT EXISTS idx_cf_record_comments_entity ON cf_record_comments (tenant_id, entity_type, entity_id, created_at DESC);

CREATE TRIGGER trg_cf_meeting_summaries_updated_at BEFORE UPDATE ON cf_meeting_summaries FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_cf_next_best_actions_updated_at BEFORE UPDATE ON cf_next_best_actions FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_cf_documents_updated_at BEFORE UPDATE ON cf_documents FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TABLE IF EXISTS cf_record_comments;
DROP TABLE IF EXISTS cf_document_versions;
DROP TABLE IF EXISTS cf_documents;
DROP TABLE IF EXISTS cf_ownership_changes;
DROP TABLE IF EXISTS cf_next_best_actions;
DROP TABLE IF EXISTS cf_meeting_summaries;
DROP TABLE IF EXISTS cf_attribution_touches;
