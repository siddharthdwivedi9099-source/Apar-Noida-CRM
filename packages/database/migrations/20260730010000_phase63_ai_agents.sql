-- migrate:up
-- AI-specific CRM user stories (AI-001..010): governed AI agent runs. Every agent produces a
-- deterministic result (stand-in for the LLM) with confidence, explanation, sources, low-confidence
-- flag, and a human-review gate, then supports accept / override / reject with feedback so outcomes
-- improve future scoring (AI-002) and triage accuracy is stored (AI-008). Feedback reuses the
-- Persona-30 ai_feedback table.
CREATE TABLE IF NOT EXISTS ai_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  agent_kind TEXT NOT NULL CHECK (agent_kind IN (
    'lead_enrichment', 'lead_scoring', 'email_drafting', 'call_summary', 'proposal_drafting',
    'opportunity_risk', 'forecasting', 'support_triage', 'customer_health', 'knowledge_assistant'
  )),
  entity_type TEXT NULL,
  entity_id UUID NULL,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence INTEGER NULL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100)),
  low_confidence BOOLEAN NOT NULL DEFAULT false,
  review_required BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'accepted', 'overridden', 'rejected')),
  corrected JSONB NULL,
  feedback JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL,
  updated_by UUID NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_tenant_entity ON ai_agent_runs (tenant_id, entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_tenant_kind ON ai_agent_runs (tenant_id, agent_kind, created_at DESC);

CREATE TRIGGER trg_ai_agent_runs_updated_at BEFORE UPDATE ON ai_agent_runs FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TABLE IF EXISTS ai_agent_runs;
