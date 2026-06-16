-- migrate:up
ALTER TABLE crm_notes
  DROP CONSTRAINT IF EXISTS crm_notes_entity_type_check;

ALTER TABLE crm_notes
  ADD COLUMN IF NOT EXISTS is_customer_facing BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE crm_notes
  ADD CONSTRAINT crm_notes_entity_type_check
  CHECK (entity_type IN ('lead', 'account', 'contact', 'opportunity', 'ticket', 'customer_success_account'));

CREATE INDEX IF NOT EXISTS idx_crm_notes_tenant_customer_facing_active
  ON crm_notes (tenant_id, is_customer_facing, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE crm_activities
  DROP CONSTRAINT IF EXISTS crm_activities_entity_type_check;

ALTER TABLE crm_activities
  DROP CONSTRAINT IF EXISTS crm_activities_activity_type_check;

ALTER TABLE crm_activities
  ADD COLUMN IF NOT EXISTS owner_user_id UUID NULL,
  ADD COLUMN IF NOT EXISTS outcome TEXT NULL;

UPDATE crm_activities
SET owner_user_id = COALESCE(owner_user_id, author_user_id)
WHERE owner_user_id IS NULL;

ALTER TABLE crm_activities
  ADD CONSTRAINT crm_activities_entity_type_check
  CHECK (entity_type IN ('lead', 'account', 'contact', 'opportunity', 'ticket', 'customer_success_account'));

ALTER TABLE crm_activities
  ADD CONSTRAINT crm_activities_activity_type_check
  CHECK (
    activity_type IN (
      'call',
      'email',
      'meeting',
      'chat',
      'social',
      'demo',
      'training',
      'support',
      'renewal',
      'task',
      'status_change',
      'note'
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'crm_activities_owner_fk'
  ) THEN
    ALTER TABLE crm_activities
      ADD CONSTRAINT crm_activities_owner_fk
      FOREIGN KEY (owner_user_id, tenant_id)
      REFERENCES users (id, tenant_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_activities_tenant_owner_active
  ON crm_activities (tenant_id, owner_user_id, occurred_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS crm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'account', 'contact', 'opportunity', 'ticket', 'customer_success_account')),
  entity_id UUID NOT NULL,
  owner_user_id UUID NULL,
  assignee_user_id UUID NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  due_at TIMESTAMPTZ NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'blocked', 'completed', 'cancelled')),
  reminder_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT crm_tasks_owner_fk
    FOREIGN KEY (owner_user_id, tenant_id)
    REFERENCES users (id, tenant_id),
  CONSTRAINT crm_tasks_assignee_fk
    FOREIGN KEY (assignee_user_id, tenant_id)
    REFERENCES users (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_tenant_entity_active
  ON crm_tasks (tenant_id, entity_type, entity_id, due_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_crm_tasks_tenant_assignee_active
  ON crm_tasks (tenant_id, assignee_user_id, status, due_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_crm_tasks_tenant_status_active
  ON crm_tasks (tenant_id, status, priority, due_at)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS crm_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'account', 'contact', 'opportunity', 'ticket', 'customer_success_account')),
  entity_id UUID NOT NULL,
  touchpoint_type TEXT NOT NULL CHECK (touchpoint_type IN ('ticket', 'campaign', 'training', 'onboarding_milestone')),
  title TEXT NOT NULL,
  description TEXT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  owner_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  updated_by UUID NULL,
  CONSTRAINT crm_timeline_events_owner_fk
    FOREIGN KEY (owner_user_id, tenant_id)
    REFERENCES users (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_timeline_events_tenant_entity_active
  ON crm_timeline_events (tenant_id, entity_type, entity_id, occurred_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_crm_tasks_updated_at
  BEFORE UPDATE ON crm_tasks
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_crm_timeline_events_updated_at
  BEFORE UPDATE ON crm_timeline_events
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS trg_crm_timeline_events_updated_at ON crm_timeline_events;
DROP TRIGGER IF EXISTS trg_crm_tasks_updated_at ON crm_tasks;

DROP TABLE IF EXISTS crm_timeline_events;
DROP TABLE IF EXISTS crm_tasks;

DROP INDEX IF EXISTS idx_crm_activities_tenant_owner_active;

ALTER TABLE crm_activities
  DROP CONSTRAINT IF EXISTS crm_activities_owner_fk;

ALTER TABLE crm_activities
  DROP CONSTRAINT IF EXISTS crm_activities_activity_type_check;

ALTER TABLE crm_activities
  DROP CONSTRAINT IF EXISTS crm_activities_entity_type_check;

ALTER TABLE crm_activities
  DROP COLUMN IF EXISTS owner_user_id,
  DROP COLUMN IF EXISTS outcome;

ALTER TABLE crm_activities
  ADD CONSTRAINT crm_activities_entity_type_check
  CHECK (entity_type IN ('lead', 'account', 'contact'));

ALTER TABLE crm_activities
  ADD CONSTRAINT crm_activities_activity_type_check
  CHECK (activity_type IN ('call', 'email', 'meeting', 'task', 'status_change', 'note'));

DROP INDEX IF EXISTS idx_crm_notes_tenant_customer_facing_active;

ALTER TABLE crm_notes
  DROP CONSTRAINT IF EXISTS crm_notes_entity_type_check;

ALTER TABLE crm_notes
  DROP COLUMN IF EXISTS is_customer_facing;

ALTER TABLE crm_notes
  ADD CONSTRAINT crm_notes_entity_type_check
  CHECK (entity_type IN ('lead', 'account', 'contact'));
