-- migrate:up
CREATE TABLE IF NOT EXISTS customer_query_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  subject TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL DEFAULT 'customer_portal'
    CHECK (channel IN ('customer_portal', 'in_app', 'support_console')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'escalated', 'resolved', 'closed')),
  escalation_level INTEGER NOT NULL DEFAULT 0,
  last_confidence NUMERIC(4, 3) NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  customer_user_id UUID NULL,
  assigned_agent_id UUID NULL,
  related_ticket_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT uniq_customer_query_sessions_id_tenant UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_query_sessions_tenant_status ON customer_query_sessions (tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_query_sessions_tenant_customer ON customer_query_sessions (tenant_id, customer_user_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS customer_query_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  session_id UUID NOT NULL,
  role TEXT NOT NULL
    CHECK (role IN ('customer', 'assistant', 'agent', 'system')),
  content TEXT NOT NULL,
  query_level INTEGER NULL,
  confidence_score NUMERIC(4, 3) NULL,
  is_grounded BOOLEAN NOT NULL DEFAULT FALSE,
  escalated BOOLEAN NOT NULL DEFAULT FALSE,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  retrieval_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  feedback TEXT NOT NULL DEFAULT 'pending'
    CHECK (feedback IN ('pending', 'helpful', 'not_helpful')),
  feedback_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL,
  CONSTRAINT fk_customer_query_messages_session FOREIGN KEY (session_id, tenant_id) REFERENCES customer_query_sessions (id, tenant_id),
  CONSTRAINT uniq_customer_query_messages_id_tenant UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_query_messages_session ON customer_query_messages (tenant_id, session_id, created_at ASC);

CREATE TABLE IF NOT EXISTS customer_query_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  session_id UUID NOT NULL,
  message_id UUID NULL,
  reason TEXT NOT NULL DEFAULT 'customer_request'
    CHECK (reason IN ('low_confidence', 'level_3', 'no_answer', 'customer_request')),
  level INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'resolved')),
  notes TEXT NOT NULL DEFAULT '',
  related_ticket_id UUID NULL,
  assigned_agent_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT fk_customer_query_escalations_session FOREIGN KEY (session_id, tenant_id) REFERENCES customer_query_sessions (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_query_escalations_tenant_status ON customer_query_escalations (tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_query_escalations_session ON customer_query_escalations (tenant_id, session_id);

CREATE TRIGGER trg_customer_query_sessions_updated_at BEFORE UPDATE ON customer_query_sessions FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_customer_query_escalations_updated_at BEFORE UPDATE ON customer_query_escalations FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS trg_customer_query_escalations_updated_at ON customer_query_escalations;
DROP TRIGGER IF EXISTS trg_customer_query_sessions_updated_at ON customer_query_sessions;
DROP TABLE IF EXISTS customer_query_escalations;
DROP TABLE IF EXISTS customer_query_messages;
DROP TABLE IF EXISTS customer_query_sessions;
