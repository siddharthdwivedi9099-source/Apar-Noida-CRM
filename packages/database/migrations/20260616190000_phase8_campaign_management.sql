-- migrate:up
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  owner_id UUID NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  type_option_id UUID NOT NULL,
  objective_option_id UUID NOT NULL,
  status_option_id UUID NOT NULL,
  channel_option_id UUID NOT NULL,
  target_audience TEXT NULL,
  budget_amount NUMERIC(14, 2) NULL CHECK (budget_amount IS NULL OR budget_amount >= 0),
  start_date DATE NULL,
  end_date DATE NULL,
  related_assets JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(related_assets) = 'array'),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT campaigns_id_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT campaigns_owner_fk
    FOREIGN KEY (owner_id, tenant_id)
    REFERENCES users (id, tenant_id),
  CONSTRAINT campaigns_type_option_fk
    FOREIGN KEY (type_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT campaigns_objective_option_fk
    FOREIGN KEY (objective_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT campaigns_status_option_fk
    FOREIGN KEY (status_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT campaigns_channel_option_fk
    FOREIGN KEY (channel_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id),
  CONSTRAINT campaigns_date_window_check
    CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_active
  ON campaigns (tenant_id, name, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_owner_active
  ON campaigns (tenant_id, owner_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_status_active
  ON campaigns (tenant_id, status_option_id, start_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_type_active
  ON campaigns (tenant_id, type_option_id, channel_option_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS campaign_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  campaign_id UUID NOT NULL,
  member_entity_type TEXT NOT NULL CHECK (member_entity_type IN ('lead', 'contact', 'account')),
  member_entity_id UUID NOT NULL,
  status_option_id UUID NULL,
  response_text TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT campaign_members_campaign_fk
    FOREIGN KEY (campaign_id, tenant_id)
    REFERENCES campaigns (id, tenant_id),
  CONSTRAINT campaign_members_status_option_fk
    FOREIGN KEY (status_option_id, tenant_id)
    REFERENCES tenant_option_values (id, tenant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_campaign_members_active_record
  ON campaign_members (campaign_id, member_entity_type, member_entity_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_members_tenant_campaign_active
  ON campaign_members (tenant_id, campaign_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_members_tenant_status_active
  ON campaign_members (tenant_id, status_option_id, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE crm_notes
  DROP CONSTRAINT IF EXISTS crm_notes_entity_type_check;

ALTER TABLE crm_notes
  ADD CONSTRAINT crm_notes_entity_type_check
  CHECK (entity_type IN ('lead', 'account', 'contact', 'campaign', 'opportunity', 'ticket', 'customer_success_account'));

ALTER TABLE crm_activities
  DROP CONSTRAINT IF EXISTS crm_activities_entity_type_check;

ALTER TABLE crm_activities
  ADD CONSTRAINT crm_activities_entity_type_check
  CHECK (entity_type IN ('lead', 'account', 'contact', 'campaign', 'opportunity', 'ticket', 'customer_success_account'));

ALTER TABLE crm_tasks
  DROP CONSTRAINT IF EXISTS crm_tasks_entity_type_check;

ALTER TABLE crm_tasks
  ADD CONSTRAINT crm_tasks_entity_type_check
  CHECK (entity_type IN ('lead', 'account', 'contact', 'campaign', 'opportunity', 'ticket', 'customer_success_account'));

ALTER TABLE crm_timeline_events
  DROP CONSTRAINT IF EXISTS crm_timeline_events_entity_type_check;

ALTER TABLE crm_timeline_events
  ADD CONSTRAINT crm_timeline_events_entity_type_check
  CHECK (entity_type IN ('lead', 'account', 'contact', 'campaign', 'opportunity', 'ticket', 'customer_success_account'));

CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_campaign_members_updated_at
  BEFORE UPDATE ON campaign_members
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS trg_campaign_members_updated_at ON campaign_members;
DROP TRIGGER IF EXISTS trg_campaigns_updated_at ON campaigns;

ALTER TABLE crm_timeline_events
  DROP CONSTRAINT IF EXISTS crm_timeline_events_entity_type_check;

ALTER TABLE crm_timeline_events
  ADD CONSTRAINT crm_timeline_events_entity_type_check
  CHECK (entity_type IN ('lead', 'account', 'contact', 'opportunity', 'ticket', 'customer_success_account'));

ALTER TABLE crm_tasks
  DROP CONSTRAINT IF EXISTS crm_tasks_entity_type_check;

ALTER TABLE crm_tasks
  ADD CONSTRAINT crm_tasks_entity_type_check
  CHECK (entity_type IN ('lead', 'account', 'contact', 'opportunity', 'ticket', 'customer_success_account'));

ALTER TABLE crm_activities
  DROP CONSTRAINT IF EXISTS crm_activities_entity_type_check;

ALTER TABLE crm_activities
  ADD CONSTRAINT crm_activities_entity_type_check
  CHECK (entity_type IN ('lead', 'account', 'contact', 'opportunity', 'ticket', 'customer_success_account'));

ALTER TABLE crm_notes
  DROP CONSTRAINT IF EXISTS crm_notes_entity_type_check;

ALTER TABLE crm_notes
  ADD CONSTRAINT crm_notes_entity_type_check
  CHECK (entity_type IN ('lead', 'account', 'contact', 'opportunity', 'ticket', 'customer_success_account'));

DROP TABLE IF EXISTS campaign_members;
DROP TABLE IF EXISTS campaigns;
