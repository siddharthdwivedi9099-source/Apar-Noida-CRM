-- migrate:up
CREATE TABLE IF NOT EXISTS support_sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  name TEXT NOT NULL,
  priority_option_id UUID NULL,
  first_response_minutes INTEGER NOT NULL CHECK (first_response_minutes > 0),
  resolution_minutes INTEGER NOT NULL CHECK (resolution_minutes > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT support_sla_policies_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT support_sla_policies_priority_option_fk
    FOREIGN KEY (priority_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_support_sla_policies_tenant_active
  ON support_sla_policies (tenant_id, is_active, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  account_id UUID NULL,
  contact_id UUID NULL,
  customer_success_account_id UUID NULL,
  owner_id UUID NULL,
  assignee_id UUID NULL,
  sla_policy_id UUID NULL,
  subject TEXT NOT NULL,
  description TEXT NULL,
  status_option_id UUID NOT NULL,
  priority_option_id UUID NOT NULL,
  category_option_id UUID NOT NULL,
  source_option_id UUID NOT NULL,
  escalation_status TEXT NOT NULL DEFAULT 'none'
    CHECK (escalation_status IN ('none', 'pending', 'escalated', 'resolved')),
  root_cause TEXT NULL,
  resolution_notes TEXT NULL,
  first_response_due_at TIMESTAMPTZ NULL,
  resolution_due_at TIMESTAMPTZ NULL,
  first_response_at TIMESTAMPTZ NULL,
  resolved_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT support_tickets_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT support_tickets_account_fk
    FOREIGN KEY (account_id, tenant_id)
    REFERENCES accounts (id, tenant_id),
  CONSTRAINT support_tickets_contact_fk
    FOREIGN KEY (contact_id, tenant_id)
    REFERENCES contacts (id, tenant_id),
  CONSTRAINT support_tickets_cs_account_fk
    FOREIGN KEY (customer_success_account_id, tenant_id)
    REFERENCES accounts (id, tenant_id),
  CONSTRAINT support_tickets_owner_fk
    FOREIGN KEY (owner_id, tenant_id)
    REFERENCES users (id, tenant_id),
  CONSTRAINT support_tickets_assignee_fk
    FOREIGN KEY (assignee_id, tenant_id)
    REFERENCES users (id, tenant_id),
  CONSTRAINT support_tickets_sla_policy_fk
    FOREIGN KEY (sla_policy_id, tenant_id)
    REFERENCES support_sla_policies (id, tenant_id),
  CONSTRAINT support_tickets_status_option_fk
    FOREIGN KEY (status_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT support_tickets_priority_option_fk
    FOREIGN KEY (priority_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT support_tickets_category_option_fk
    FOREIGN KEY (category_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT support_tickets_source_option_fk
    FOREIGN KEY (source_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant_active
  ON support_tickets (tenant_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant_assignee_active
  ON support_tickets (tenant_id, assignee_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant_status_active
  ON support_tickets (tenant_id, status_option_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant_priority_active
  ON support_tickets (tenant_id, priority_option_id, resolution_due_at ASC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant_account_active
  ON support_tickets (tenant_id, account_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  ticket_id UUID NOT NULL,
  author_id UUID NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('internal_note', 'customer_reply')),
  body TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT support_ticket_messages_ticket_fk
    FOREIGN KEY (ticket_id, tenant_id)
    REFERENCES support_tickets (id, tenant_id),
  CONSTRAINT support_ticket_messages_author_fk
    FOREIGN KEY (author_id, tenant_id)
    REFERENCES users (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_tenant_ticket_active
  ON support_ticket_messages (tenant_id, ticket_id, created_at ASC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS support_knowledge_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  title TEXT NOT NULL,
  category_option_id UUID NULL,
  summary TEXT NULL,
  body TEXT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT support_knowledge_articles_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT support_knowledge_articles_category_option_fk
    FOREIGN KEY (category_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_support_knowledge_articles_tenant_active
  ON support_knowledge_articles (tenant_id, status, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS support_ticket_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  ticket_id UUID NOT NULL,
  article_id UUID NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT support_ticket_articles_ticket_fk
    FOREIGN KEY (ticket_id, tenant_id)
    REFERENCES support_tickets (id, tenant_id),
  CONSTRAINT support_ticket_articles_article_fk
    FOREIGN KEY (article_id, tenant_id)
    REFERENCES support_knowledge_articles (id, tenant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_support_ticket_articles_active
  ON support_ticket_articles (ticket_id, article_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_support_ticket_articles_tenant_ticket_active
  ON support_ticket_articles (tenant_id, ticket_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_support_sla_policies_updated_at
  BEFORE UPDATE ON support_sla_policies
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_support_ticket_messages_updated_at
  BEFORE UPDATE ON support_ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_support_knowledge_articles_updated_at
  BEFORE UPDATE ON support_knowledge_articles
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_support_ticket_articles_updated_at
  BEFORE UPDATE ON support_ticket_articles
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS trg_support_ticket_articles_updated_at ON support_ticket_articles;
DROP TRIGGER IF EXISTS trg_support_knowledge_articles_updated_at ON support_knowledge_articles;
DROP TRIGGER IF EXISTS trg_support_ticket_messages_updated_at ON support_ticket_messages;
DROP TRIGGER IF EXISTS trg_support_tickets_updated_at ON support_tickets;
DROP TRIGGER IF EXISTS trg_support_sla_policies_updated_at ON support_sla_policies;

DROP TABLE IF EXISTS support_ticket_articles;
DROP TABLE IF EXISTS support_knowledge_articles;
DROP TABLE IF EXISTS support_ticket_messages;
DROP TABLE IF EXISTS support_tickets;
DROP TABLE IF EXISTS support_sla_policies;
