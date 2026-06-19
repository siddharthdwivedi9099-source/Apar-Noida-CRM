-- migrate:up
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  notification_type TEXT NOT NULL
    CHECK (notification_type IN (
      'approval_requested',
      'approval_decided',
      'approval_completed',
      'workflow_signal',
      'record_assignment',
      'campaign_update',
      'customer_escalation',
      'sensitive_ai_action',
      'system_announcement'
    )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  linked_record_type TEXT NULL,
  linked_record_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL REFERENCES users (id),
  updated_by UUID NULL REFERENCES users (id),
  CONSTRAINT uniq_notifications_id_tenant UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_type_created
  ON notifications (tenant_id, notification_type, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_linked_record
  ON notifications (tenant_id, linked_record_type, linked_record_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  notification_id UUID NOT NULL,
  recipient_user_id UUID NOT NULL REFERENCES users (id),
  recipient_role_id UUID NULL REFERENCES roles (id),
  owner_id UUID NULL REFERENCES users (id),
  read_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL REFERENCES users (id),
  updated_by UUID NULL REFERENCES users (id),
  CONSTRAINT fk_notification_deliveries_notification
    FOREIGN KEY (notification_id, tenant_id)
    REFERENCES notifications (id, tenant_id),
  CONSTRAINT uniq_notification_delivery_recipient UNIQUE (notification_id, recipient_user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_recipient
  ON notification_deliveries (tenant_id, recipient_user_id, read_at, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_role
  ON notification_deliveries (tenant_id, recipient_role_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  user_id UUID NOT NULL REFERENCES users (id),
  owner_id UUID NULL REFERENCES users (id),
  notification_type TEXT NOT NULL
    CHECK (notification_type IN (
      'approval_requested',
      'approval_decided',
      'approval_completed',
      'workflow_signal',
      'record_assignment',
      'campaign_update',
      'customer_escalation',
      'sensitive_ai_action',
      'system_announcement'
    )),
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL REFERENCES users (id),
  updated_by UUID NULL REFERENCES users (id),
  CONSTRAINT uniq_notification_preferences_user_type UNIQUE (tenant_id, user_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user
  ON notification_preferences (tenant_id, user_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  approval_type TEXT NOT NULL
    CHECK (approval_type IN (
      'discount_approval',
      'campaign_approval',
      'proposal_approval',
      'partner_approval',
      'reseller_approval',
      'sensitive_ai_action_approval',
      'customer_escalation_approval'
    )),
  title TEXT NOT NULL,
  description TEXT NULL,
  linked_record_type TEXT NULL,
  linked_record_id UUID NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by_user_id UUID NOT NULL REFERENCES users (id),
  approver_user_id UUID NULL REFERENCES users (id),
  approver_role_id UUID NULL REFERENCES roles (id),
  decision_by_user_id UUID NULL REFERENCES users (id),
  owner_id UUID NULL REFERENCES users (id),
  decision_comment TEXT NULL,
  decided_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  created_by UUID NULL REFERENCES users (id),
  updated_by UUID NULL REFERENCES users (id),
  CONSTRAINT chk_approval_requests_target
    CHECK (approver_user_id IS NOT NULL OR approver_role_id IS NOT NULL),
  CONSTRAINT uniq_approval_requests_id_tenant UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_tenant_status
  ON approval_requests (tenant_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_approval_requests_requested_by
  ON approval_requests (tenant_id, requested_by_user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_approval_requests_approver_user
  ON approval_requests (tenant_id, approver_user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_approval_requests_approver_role
  ON approval_requests (tenant_id, approver_role_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_approval_requests_linked_record
  ON approval_requests (tenant_id, linked_record_type, linked_record_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id),
  approval_request_id UUID NOT NULL,
  action_type TEXT NOT NULL
    CHECK (action_type IN ('created', 'commented', 'approved', 'rejected', 'cancelled', 'reassigned')),
  actor_user_id UUID NULL REFERENCES users (id),
  from_status TEXT NULL
    CHECK (from_status IN ('pending', 'approved', 'rejected', 'cancelled')),
  to_status TEXT NULL
    CHECK (to_status IN ('pending', 'approved', 'rejected', 'cancelled')),
  comment TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_approval_history_request
    FOREIGN KEY (approval_request_id, tenant_id)
    REFERENCES approval_requests (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_approval_history_request
  ON approval_history (tenant_id, approval_request_id, created_at ASC);

CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_notification_deliveries_updated_at
  BEFORE UPDATE ON notification_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

CREATE TRIGGER trg_approval_requests_updated_at
  BEFORE UPDATE ON approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_row_updated_at();

-- migrate:down
DROP TRIGGER IF EXISTS trg_approval_requests_updated_at ON approval_requests;
DROP TRIGGER IF EXISTS trg_notification_preferences_updated_at ON notification_preferences;
DROP TRIGGER IF EXISTS trg_notification_deliveries_updated_at ON notification_deliveries;
DROP TRIGGER IF EXISTS trg_notifications_updated_at ON notifications;
DROP TABLE IF EXISTS approval_history;
DROP TABLE IF EXISTS approval_requests;
DROP TABLE IF EXISTS notification_preferences;
DROP TABLE IF EXISTS notification_deliveries;
DROP TABLE IF EXISTS notifications;
