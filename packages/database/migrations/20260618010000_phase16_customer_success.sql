-- migrate:up
CREATE TABLE IF NOT EXISTS customer_success_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  account_id UUID NOT NULL,
  csm_owner_id UUID NULL,
  segment_option_id UUID NOT NULL,
  lifecycle_stage_option_id UUID NOT NULL,
  risk_status_option_id UUID NOT NULL,
  expansion_potential_option_id UUID NOT NULL,
  health_score INTEGER NULL CHECK (health_score IS NULL OR (health_score >= 0 AND health_score <= 100)),
  adoption_score INTEGER NULL CHECK (adoption_score IS NULL OR (adoption_score >= 0 AND adoption_score <= 100)),
  renewal_date DATE NULL,
  contract_value NUMERIC(16, 2) NULL CHECK (contract_value IS NULL OR contract_value >= 0),
  support_trend TEXT NOT NULL DEFAULT 'stable' CHECK (support_trend IN ('improving', 'stable', 'declining')),
  training_status TEXT NOT NULL DEFAULT 'not_started' CHECK (training_status IN ('not_started', 'in_progress', 'completed')),
  last_touchpoint_at TIMESTAMPTZ NULL,
  next_action TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT customer_success_accounts_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT customer_success_accounts_account_fk
    FOREIGN KEY (account_id, tenant_id) REFERENCES accounts (id, tenant_id),
  CONSTRAINT customer_success_accounts_owner_fk
    FOREIGN KEY (csm_owner_id, tenant_id) REFERENCES users (id, tenant_id),
  CONSTRAINT customer_success_accounts_segment_option_fk
    FOREIGN KEY (segment_option_id, tenant_id) REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT customer_success_accounts_lifecycle_option_fk
    FOREIGN KEY (lifecycle_stage_option_id, tenant_id) REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT customer_success_accounts_risk_option_fk
    FOREIGN KEY (risk_status_option_id, tenant_id) REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT customer_success_accounts_expansion_option_fk
    FOREIGN KEY (expansion_potential_option_id, tenant_id) REFERENCES tenant_option_values (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_cs_accounts_tenant_active ON customer_success_accounts (tenant_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cs_accounts_tenant_owner_active ON customer_success_accounts (tenant_id, csm_owner_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cs_accounts_tenant_segment_active ON customer_success_accounts (tenant_id, segment_option_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cs_accounts_tenant_risk_active ON customer_success_accounts (tenant_id, risk_status_option_id, renewal_date ASC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS onboarding_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  cs_account_id UUID NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'blocked')),
  start_date DATE NULL,
  target_go_live_date DATE NULL,
  product_activation_status TEXT NOT NULL DEFAULT 'not_started' CHECK (product_activation_status IN ('not_started', 'in_progress', 'activated')),
  first_value_at TIMESTAMPTZ NULL,
  training_completion INTEGER NULL CHECK (training_completion IS NULL OR (training_completion >= 0 AND training_completion <= 100)),
  risk_notes TEXT NULL,
  handover_notes TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT onboarding_plans_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT onboarding_plans_cs_account_fk
    FOREIGN KEY (cs_account_id, tenant_id) REFERENCES customer_success_accounts (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_plans_tenant_account_active ON onboarding_plans (tenant_id, cs_account_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS onboarding_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  onboarding_plan_id UUID NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  due_date DATE NULL,
  completed_at TIMESTAMPTZ NULL,
  notes TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT onboarding_milestones_plan_fk
    FOREIGN KEY (onboarding_plan_id, tenant_id) REFERENCES onboarding_plans (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_milestones_tenant_plan_active ON onboarding_milestones (tenant_id, onboarding_plan_id, sort_order ASC, created_at ASC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS success_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  cs_account_id UUID NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
  objective TEXT NULL,
  value_realization TEXT NULL,
  executive_sponsor TEXT NULL,
  stakeholders JSONB NOT NULL DEFAULT '[]'::jsonb,
  expansion_opportunities TEXT NULL,
  renewal_strategy TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT success_plans_cs_account_fk
    FOREIGN KEY (cs_account_id, tenant_id) REFERENCES customer_success_accounts (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_success_plans_tenant_account_active ON success_plans (tenant_id, cs_account_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS customer_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  cs_account_id UUID NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  risk_status_option_id UUID NULL,
  drivers TEXT NULL,
  notes TEXT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT customer_health_scores_cs_account_fk
    FOREIGN KEY (cs_account_id, tenant_id) REFERENCES customer_success_accounts (id, tenant_id),
  CONSTRAINT customer_health_scores_risk_option_fk
    FOREIGN KEY (risk_status_option_id, tenant_id) REFERENCES tenant_option_values (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_health_scores_tenant_account_active ON customer_health_scores (tenant_id, cs_account_id, recorded_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS adoption_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  cs_account_id UUID NOT NULL,
  metric_key TEXT NOT NULL,
  label TEXT NOT NULL,
  value NUMERIC(16, 2) NOT NULL,
  target NUMERIC(16, 2) NULL,
  unit TEXT NULL,
  trend TEXT NOT NULL DEFAULT 'flat' CHECK (trend IN ('up', 'flat', 'down')),
  period_start DATE NULL,
  period_end DATE NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT adoption_metrics_cs_account_fk
    FOREIGN KEY (cs_account_id, tenant_id) REFERENCES customer_success_accounts (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_adoption_metrics_tenant_account_active ON adoption_metrics (tenant_id, cs_account_id, period_end DESC NULLS LAST, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS qbrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  cs_account_id UUID NOT NULL,
  owner_id UUID NULL,
  title TEXT NOT NULL,
  qbr_type TEXT NOT NULL DEFAULT 'qbr' CHECK (qbr_type IN ('qbr', 'ebr')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  scheduled_at TIMESTAMPTZ NULL,
  summary TEXT NULL,
  outcomes TEXT NULL,
  next_steps TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT qbrs_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT qbrs_cs_account_fk
    FOREIGN KEY (cs_account_id, tenant_id) REFERENCES customer_success_accounts (id, tenant_id),
  CONSTRAINT qbrs_owner_fk
    FOREIGN KEY (owner_id, tenant_id) REFERENCES users (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_qbrs_tenant_account_active ON qbrs (tenant_id, cs_account_id, scheduled_at DESC NULLS LAST) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  cs_account_id UUID NOT NULL,
  owner_id UUID NULL,
  renewal_date DATE NOT NULL,
  status_option_id UUID NOT NULL,
  contract_value NUMERIC(16, 2) NULL CHECK (contract_value IS NULL OR contract_value >= 0),
  forecast_value NUMERIC(16, 2) NULL CHECK (forecast_value IS NULL OR forecast_value >= 0),
  probability INTEGER NULL CHECK (probability IS NULL OR (probability >= 0 AND probability <= 100)),
  risk_notes TEXT NULL,
  strategy TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT renewals_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT renewals_cs_account_fk
    FOREIGN KEY (cs_account_id, tenant_id) REFERENCES customer_success_accounts (id, tenant_id),
  CONSTRAINT renewals_owner_fk
    FOREIGN KEY (owner_id, tenant_id) REFERENCES users (id, tenant_id),
  CONSTRAINT renewals_status_option_fk
    FOREIGN KEY (status_option_id, tenant_id) REFERENCES tenant_option_values (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_renewals_tenant_account_active ON renewals (tenant_id, cs_account_id, renewal_date ASC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_renewals_tenant_status_active ON renewals (tenant_id, status_option_id, renewal_date ASC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  cs_account_id UUID NOT NULL,
  owner_id UUID NULL,
  title TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  description TEXT NULL,
  resolution TEXT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT escalations_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT escalations_cs_account_fk
    FOREIGN KEY (cs_account_id, tenant_id) REFERENCES customer_success_accounts (id, tenant_id),
  CONSTRAINT escalations_owner_fk
    FOREIGN KEY (owner_id, tenant_id) REFERENCES users (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_escalations_tenant_account_active ON escalations (tenant_id, cs_account_id, opened_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_escalations_tenant_status_active ON escalations (tenant_id, status, opened_at DESC) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_customer_success_accounts_updated_at BEFORE UPDATE ON customer_success_accounts FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_onboarding_plans_updated_at BEFORE UPDATE ON onboarding_plans FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_onboarding_milestones_updated_at BEFORE UPDATE ON onboarding_milestones FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_success_plans_updated_at BEFORE UPDATE ON success_plans FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_customer_health_scores_updated_at BEFORE UPDATE ON customer_health_scores FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_adoption_metrics_updated_at BEFORE UPDATE ON adoption_metrics FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_qbrs_updated_at BEFORE UPDATE ON qbrs FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_renewals_updated_at BEFORE UPDATE ON renewals FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
CREATE TRIGGER trg_escalations_updated_at BEFORE UPDATE ON escalations FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS trg_escalations_updated_at ON escalations;
DROP TRIGGER IF EXISTS trg_renewals_updated_at ON renewals;
DROP TRIGGER IF EXISTS trg_qbrs_updated_at ON qbrs;
DROP TRIGGER IF EXISTS trg_adoption_metrics_updated_at ON adoption_metrics;
DROP TRIGGER IF EXISTS trg_customer_health_scores_updated_at ON customer_health_scores;
DROP TRIGGER IF EXISTS trg_success_plans_updated_at ON success_plans;
DROP TRIGGER IF EXISTS trg_onboarding_milestones_updated_at ON onboarding_milestones;
DROP TRIGGER IF EXISTS trg_onboarding_plans_updated_at ON onboarding_plans;
DROP TRIGGER IF EXISTS trg_customer_success_accounts_updated_at ON customer_success_accounts;

DROP TABLE IF EXISTS escalations;
DROP TABLE IF EXISTS renewals;
DROP TABLE IF EXISTS qbrs;
DROP TABLE IF EXISTS adoption_metrics;
DROP TABLE IF EXISTS customer_health_scores;
DROP TABLE IF EXISTS success_plans;
DROP TABLE IF EXISTS onboarding_milestones;
DROP TABLE IF EXISTS onboarding_plans;
DROP TABLE IF EXISTS customer_success_accounts;
