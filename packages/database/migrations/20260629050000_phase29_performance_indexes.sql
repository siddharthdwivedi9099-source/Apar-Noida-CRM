-- migrate:up
-- Phase 29: performance indexes for common, high-traffic query patterns on the
-- major CRM tables. These complement the existing tenant/owner/status indexes by
-- covering lookups and sorts that the list, search, and SLA endpoints rely on.
-- All are partial indexes on active (non-deleted) rows to stay small.

-- Leads: email lookup/dedupe and score-ranked qualification queues.
CREATE INDEX IF NOT EXISTS idx_leads_tenant_email_active ON leads (tenant_id, email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_tenant_score_active ON leads (tenant_id, score DESC) WHERE deleted_at IS NULL;

-- Accounts: name search/sort and health-status filtering.
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_name_active ON accounts (tenant_id, name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_health_active ON accounts (tenant_id, health_status_option_id) WHERE deleted_at IS NULL;

-- Contacts: email lookup.
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_email_active ON contacts (tenant_id, email) WHERE deleted_at IS NULL;

-- Opportunities: value-sorted pipeline views.
CREATE INDEX IF NOT EXISTS idx_opportunities_tenant_amount_active ON opportunities (tenant_id, amount DESC) WHERE deleted_at IS NULL;

-- Campaigns: schedule/date-range queries.
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_schedule_active ON campaigns (tenant_id, start_date, end_date) WHERE deleted_at IS NULL;

-- Support tickets: SLA-breach scanning over still-open tickets.
CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant_sla_open ON support_tickets (tenant_id, resolution_due_at) WHERE deleted_at IS NULL AND resolved_at IS NULL;

-- migrate:down
DROP INDEX IF EXISTS idx_support_tickets_tenant_sla_open;
DROP INDEX IF EXISTS idx_campaigns_tenant_schedule_active;
DROP INDEX IF EXISTS idx_opportunities_tenant_amount_active;
DROP INDEX IF EXISTS idx_contacts_tenant_email_active;
DROP INDEX IF EXISTS idx_accounts_tenant_health_active;
DROP INDEX IF EXISTS idx_accounts_tenant_name_active;
DROP INDEX IF EXISTS idx_leads_tenant_score_active;
DROP INDEX IF EXISTS idx_leads_tenant_email_active;
