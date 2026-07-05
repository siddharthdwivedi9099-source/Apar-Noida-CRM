import type { PoolClient } from "pg";
import type { RoleSummary } from "@crm/types";
import type {
  AssessMarginRequestBody,
  ConflictCheckResponse,
  DuplicateWarningResponse,
  LinkDuplicateLeadRequestBody,
  LogComplaintRequestBody,
  MarginAssessmentResponse,
  RecycleLeadRequestBody,
  RegressStageRequestBody,
  ResolveConflictRequestBody,
  StakeholderEngagementResponse
} from "@crm/types";
import {
  aggregateStakeholderEngagement,
  checkStageRegression,
  computeMarginRisk,
  detectDuplicateCampaignLead,
  emailDomain,
  leadRecycleActions,
  matchExistingCustomer
} from "@crm/types";
import { AppError } from "../../common/errors/app-error.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { NotificationService } from "../notifications/notifications.service.js";

interface ActorContext {
  userId: string;
  tenantId: string;
  sessionId: string;
  email: string;
  displayName: string;
  permissionCodes: string[];
  roles: RoleSummary[];
}

interface AuditMetadata {
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

function trimmed(value: string | null | undefined): string | null {
  const next = value?.trim();
  return next && next.length > 0 ? next : null;
}

export class ExceptionsService {
  private readonly notificationService: NotificationService;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {
    this.notificationService = new NotificationService(databaseService, config);
  }

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "Exception handling is unavailable until the database connection is enabled.", undefined, "EXCEPTIONS_UNAVAILABLE");
    }
  }

  private async recordAuditLog(client: PoolClient, actor: ActorContext, audit: AuditMetadata, input: { action: string; resourceType: string; resourceId?: string | null; status: "success" | "failure"; metadata?: Record<string, unknown> }) {
    if (!this.config.enableAuditLogs) {
      return;
    }
    await client.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, event_type, action, resource_type, resource_id, status, ip_address, user_agent, metadata)
       VALUES ($1, $2, 'exception', $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [actor.tenantId, actor.userId, input.action, input.resourceType, input.resourceId ?? null, input.status, audit.ipAddress, audit.userAgent, JSON.stringify(input.metadata ?? {})]
    );
  }

  private async resolveOption(client: PoolClient, tenantId: string, setKey: string, valueKey: string) {
    const result = await client.query<{ id: string }>(
      `SELECT v.id FROM tenant_option_sets s INNER JOIN tenant_option_values v ON v.option_set_id = s.id AND v.tenant_id = s.tenant_id
       WHERE s.tenant_id = $1 AND s.set_key = $2 AND s.deleted_at IS NULL AND v.deleted_at IS NULL AND v.is_active = true AND v.value_key = $3 LIMIT 1`,
      [tenantId, setKey, valueKey]
    );
    return result.rows[0]?.id ?? null;
  }

  private async firstOption(client: PoolClient, tenantId: string, setKey: string) {
    const result = await client.query<{ id: string }>(
      `SELECT v.id FROM tenant_option_sets s INNER JOIN tenant_option_values v ON v.option_set_id = s.id AND v.tenant_id = s.tenant_id
       WHERE s.tenant_id = $1 AND s.set_key = $2 AND s.deleted_at IS NULL AND v.deleted_at IS NULL AND v.is_active = true ORDER BY v.sort_order ASC LIMIT 1`,
      [tenantId, setKey]
    );
    return result.rows[0]?.id ?? null;
  }

  private async loadLead(client: PoolClient, tenantId: string, leadId: string) {
    const row = (await client.query<{ id: string; first_name: string; last_name: string; company_name: string; email: string | null; owner_id: string | null; account_id: string | null; metadata: Record<string, unknown> | null }>(
      `SELECT id, first_name, last_name, company_name, email, owner_id, NULL::uuid AS account_id, metadata FROM leads WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [leadId, tenantId])).rows[0];
    if (!row) throw new AppError(404, "Lead not found.", undefined, "NOT_FOUND");
    return row;
  }

  // ---- EXC-001: duplicate campaign lead --------------------------------------------------------

  async checkDuplicate(actor: ActorContext, leadId: string): Promise<DuplicateWarningResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const lead = await this.loadLead(client, actor.tenantId, leadId);
      const others = await client.query<{ id: string; email: string | null; first_name: string; last_name: string; company_name: string }>(
        `SELECT id, email, first_name, last_name, company_name FROM leads WHERE tenant_id = $1 AND deleted_at IS NULL AND id <> $2 AND (lower(email) = lower($3) OR (lower(company_name) = lower($4) AND lower(last_name) = lower($5))) LIMIT 25`,
        [actor.tenantId, leadId, lead.email, lead.company_name, lead.last_name]
      );
      const matches = detectDuplicateCampaignLead(
        { id: lead.id, email: lead.email, firstName: lead.first_name, lastName: lead.last_name, companyName: lead.company_name },
        others.rows.map((r) => ({ id: r.id, email: r.email, firstName: r.first_name, lastName: r.last_name, companyName: r.company_name }))
      );
      const byId = new Map(others.rows.map((r) => [r.id, r]));
      return { candidateLeadId: leadId, duplicates: matches.map((m) => ({ ...m, companyName: byId.get(m.id)?.company_name ?? null, email: byId.get(m.id)?.email ?? null })) };
    });
  }

  async linkDuplicate(actor: ActorContext, audit: AuditMetadata, candidateLeadId: string, input: LinkDuplicateLeadRequestBody) {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      const candidate = await this.loadLead(client, actor.tenantId, candidateLeadId);
      const existing = await this.loadLead(client, actor.tenantId, input.existingLeadId);
      // EXC-001: add the campaign touch to the existing record and mark the candidate as a duplicate.
      await client.query(
        `INSERT INTO cf_attribution_touches (tenant_id, lead_id, source, campaign, created_by) VALUES ($1, $2, $3, $4, $5)`,
        [actor.tenantId, existing.id, trimmed(input.source) ?? "campaign", trimmed(input.campaign), actor.userId]
      );
      await client.query(`UPDATE leads SET metadata = metadata || $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2`, [candidate.id, actor.tenantId, JSON.stringify({ duplicateOf: existing.id, linkedAt: new Date().toISOString() }), actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "exception.duplicate.link", resourceType: "lead", resourceId: candidate.id, status: "success", metadata: { existingLeadId: existing.id, campaign: input.campaign } });
      return { candidateLeadId: candidate.id, linkedTo: existing.id };
    });
  }

  // ---- EXC-002: lead from existing customer ----------------------------------------------------

  async routeExistingCustomer(actor: ActorContext, audit: AuditMetadata, leadId: string) {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      const lead = await this.loadLead(client, actor.tenantId, leadId);
      const domain = emailDomain(lead.email);
      if (!domain) {
        return { matched: false as const };
      }
      const accounts = await client.query<{ id: string; owner_id: string | null; website: string | null }>(`SELECT id, owner_id, website FROM accounts WHERE tenant_id = $1 AND deleted_at IS NULL AND website IS NOT NULL LIMIT 1000`, [actor.tenantId]);
      const match = matchExistingCustomer(lead.email, accounts.rows.map((a) => ({ accountId: a.id, ownerId: a.owner_id, domain: a.website ? a.website.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null })));
      if (!match) {
        return { matched: false as const };
      }
      // Route to the account owner (falls back to the CS manager) and record the change.
      let routedOwner = match.ownerId;
      if (!routedOwner) {
        const cs = (await client.query<{ csm_owner_id: string | null }>(`SELECT csm_owner_id FROM customer_success_accounts WHERE tenant_id = $1 AND account_id = $2 AND deleted_at IS NULL LIMIT 1`, [actor.tenantId, match.accountId])).rows[0];
        routedOwner = cs?.csm_owner_id ?? null;
      }
      if (routedOwner && routedOwner !== lead.owner_id) {
        await client.query(`UPDATE leads SET owner_id = $3, updated_by = $4 WHERE id = $1 AND tenant_id = $2`, [leadId, actor.tenantId, routedOwner, actor.userId]);
        await client.query(`INSERT INTO cf_ownership_changes (tenant_id, entity_type, entity_id, from_owner_id, to_owner_id, reason, changed_by) VALUES ($1, 'lead', $2, $3, $4, $5, $6)`, [actor.tenantId, leadId, lead.owner_id, routedOwner, "Existing-customer routing (EXC-002)", actor.userId]);
        if (routedOwner !== actor.userId) {
          await this.notificationService.createNotificationWithClient(client, actor, audit, { notificationType: "record_assignment", recipientUserId: routedOwner, title: "Lead from an existing customer routed to you", message: `A lead matched account domain ${domain}.`, linkedRecord: { entityType: "lead", entityId: leadId } });
        }
      }
      await client.query(`UPDATE leads SET metadata = metadata || $3::jsonb WHERE id = $1 AND tenant_id = $2`, [leadId, actor.tenantId, JSON.stringify({ existingCustomer: { accountId: match.accountId, domain } })]);
      await this.recordAuditLog(client, actor, audit, { action: "exception.existing_customer.route", resourceType: "lead", resourceId: leadId, status: "success", metadata: { accountId: match.accountId, routedOwner } });
      return { matched: true as const, accountId: match.accountId, routedOwner };
    });
  }

  async createExpansionFromLead(actor: ActorContext, audit: AuditMetadata, leadId: string) {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      const lead = await this.loadLead(client, actor.tenantId, leadId);
      const meta = (lead.metadata ?? {}) as Record<string, unknown>;
      const accountId = ((meta.existingCustomer as Record<string, unknown> | undefined)?.accountId as string | undefined) ?? null;
      if (!accountId) {
        throw new AppError(409, "Route the lead to an existing customer first.", undefined, "NO_ACCOUNT_MATCH");
      }
      const stageId = await this.resolveOption(client, actor.tenantId, "opportunity-pipeline", "qualification");
      const sourceId = await this.resolveOption(client, actor.tenantId, "opportunity-source", "expansion");
      const outcomeId = await this.resolveOption(client, actor.tenantId, "opportunity-outcome-status", "open");
      if (!stageId || !sourceId || !outcomeId) {
        throw new AppError(500, "Opportunity option values are not configured.", undefined, "CONFIG_ERROR");
      }
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO opportunities (tenant_id, account_id, owner_id, name, stage_option_id, source_option_id, outcome_status_option_id, metadata, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $9) RETURNING id`,
        [actor.tenantId, accountId, lead.owner_id ?? actor.userId, `Expansion — ${lead.company_name}`, stageId, sourceId, outcomeId, JSON.stringify({ expansion: { fromLeadId: leadId } }), actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "exception.existing_customer.expansion", resourceType: "opportunity", resourceId: inserted.rows[0].id, status: "success", metadata: { leadId, accountId } });
      return { opportunityId: inserted.rows[0].id, accountId };
    });
  }

  // ---- EXC-003: multiple stakeholders ----------------------------------------------------------

  async getStakeholderEngagement(actor: ActorContext): Promise<StakeholderEngagementResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const leads = await client.query<{ id: string; company_name: string; owner_id: string | null; score: number | null }>(`SELECT id, company_name, owner_id, score FROM leads WHERE tenant_id = $1 AND deleted_at IS NULL LIMIT 5000`, [actor.tenantId]);
      const groups = aggregateStakeholderEngagement(leads.rows.map((l) => ({ id: l.id, companyName: l.company_name, ownerId: l.owner_id, engagement: l.score })));
      return { groups: groups.slice(0, 50) };
    });
  }

  async alertStakeholderOwner(actor: ActorContext, audit: AuditMetadata, organization: string) {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      const leads = await client.query<{ id: string; company_name: string; owner_id: string | null; score: number | null }>(`SELECT id, company_name, owner_id, score FROM leads WHERE tenant_id = $1 AND deleted_at IS NULL AND lower(company_name) = lower($2) LIMIT 500`, [actor.tenantId, organization]);
      const group = aggregateStakeholderEngagement(leads.rows.map((l) => ({ id: l.id, companyName: l.company_name, ownerId: l.owner_id, engagement: l.score })))[0];
      if (!group) {
        throw new AppError(404, "No multi-stakeholder group for that organization.", undefined, "NOT_FOUND");
      }
      if (group.ownerId && group.ownerId !== actor.userId) {
        await this.notificationService.createNotificationWithClient(client, actor, audit, { notificationType: "record_assignment", recipientUserId: group.ownerId, title: `${group.stakeholderCount} stakeholders engaged at ${group.organization}`, message: `Aggregate engagement ${group.totalEngagement}. Coordinate account strategy.`, linkedRecord: { entityType: "lead", entityId: group.leadIds[0] } });
      }
      await this.recordAuditLog(client, actor, audit, { action: "exception.stakeholders.alert", resourceType: "lead", resourceId: group.leadIds[0], status: "success", metadata: { organization: group.organization, count: group.stakeholderCount } });
      return group;
    });
  }

  // ---- EXC-004: inactive lead recycling --------------------------------------------------------

  async recycleLead(actor: ActorContext, audit: AuditMetadata, leadId: string, input: RecycleLeadRequestBody) {
    this.assertEnabled();
    if (!leadRecycleActions.includes(input.action)) {
      throw new AppError(400, "Invalid recycle action.", undefined, "VALIDATION_ERROR");
    }
    if (!input.reason?.trim()) {
      throw new AppError(400, "A reason is required to recycle a lead.", undefined, "RECYCLE_REASON_REQUIRED");
    }
    await this.databaseService.withTransaction(async (client) => {
      const lead = await this.loadLead(client, actor.tenantId, leadId);
      if (input.action === "disqualify") {
        const statusId = await this.resolveOption(client, actor.tenantId, "lead-status", "disqualified");
        if (statusId) await client.query(`UPDATE leads SET status_option_id = $3, updated_by = $4 WHERE id = $1 AND tenant_id = $2`, [leadId, actor.tenantId, statusId, actor.userId]);
      } else if (input.action === "nurture") {
        const statusId = await this.resolveOption(client, actor.tenantId, "lead-status", "nurturing");
        if (statusId) await client.query(`UPDATE leads SET status_option_id = $3, updated_by = $4 WHERE id = $1 AND tenant_id = $2`, [leadId, actor.tenantId, statusId, actor.userId]);
      } else if (input.action === "reassign") {
        const owner = await this.resolveUser(client, actor.tenantId, input.toOwnerId);
        await client.query(`UPDATE leads SET owner_id = $3, updated_by = $4 WHERE id = $1 AND tenant_id = $2`, [leadId, actor.tenantId, owner, actor.userId]);
        await client.query(`INSERT INTO cf_ownership_changes (tenant_id, entity_type, entity_id, from_owner_id, to_owner_id, reason, changed_by) VALUES ($1, 'lead', $2, $3, $4, $5, $6)`, [actor.tenantId, leadId, lead.owner_id, owner, input.reason.trim(), actor.userId]);
      }
      await client.query(`UPDATE leads SET metadata = metadata || $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2`, [leadId, actor.tenantId, JSON.stringify({ recycle: { action: input.action, reason: input.reason.trim(), at: new Date().toISOString() } }), actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "exception.lead.recycle", resourceType: "lead", resourceId: leadId, status: "success", metadata: { action: input.action, reason: input.reason.trim() } });
    });
    return { leadId, action: input.action };
  }

  private async resolveUser(client: PoolClient, tenantId: string, userId: string | null | undefined) {
    if (!userId) throw new AppError(400, "A target owner is required.", undefined, "VALIDATION_ERROR");
    const row = await client.query<{ id: string }>(`SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [userId, tenantId]);
    if (row.rowCount === 0) throw new AppError(400, "The selected owner is invalid.", undefined, "INVALID_OWNER");
    return row.rows[0].id;
  }

  private async loadOpportunity(client: PoolClient, tenantId: string, opportunityId: string) {
    const row = (await client.query<{ id: string; name: string; owner_id: string | null; stage_key: string | null; metadata: Record<string, unknown> | null }>(
      `SELECT o.id, o.name, o.owner_id, st.value_key AS stage_key, o.metadata FROM opportunities o LEFT JOIN tenant_option_values st ON st.id = o.stage_option_id AND st.tenant_id = o.tenant_id WHERE o.id = $1 AND o.tenant_id = $2 AND o.deleted_at IS NULL LIMIT 1`, [opportunityId, tenantId])).rows[0];
    if (!row) throw new AppError(404, "Opportunity not found.", undefined, "NOT_FOUND");
    return row;
  }

  // ---- EXC-005: opportunity stage regression ---------------------------------------------------

  async regressStage(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: RegressStageRequestBody) {
    this.assertEnabled();
    if (!input.reason?.trim()) {
      throw new AppError(400, "A reason is required to move a deal backward.", undefined, "REGRESSION_REASON_REQUIRED");
    }
    return this.databaseService.withTransaction(async (client) => {
      const opp = await this.loadOpportunity(client, actor.tenantId, opportunityId);
      const check = checkStageRegression(opp.stage_key ?? "", input.toStageKey);
      if (!check.isRegression) {
        throw new AppError(400, "That is not a backward stage move.", undefined, "NOT_A_REGRESSION");
      }
      const toStageId = await this.resolveOption(client, actor.tenantId, "opportunity-pipeline", input.toStageKey);
      if (!toStageId) {
        throw new AppError(400, "Unknown target stage.", undefined, "VALIDATION_ERROR");
      }
      // EXC-005: late-stage regression requires manager approval — flag + notify, do not move yet.
      if (check.requiresApproval) {
        await client.query(`UPDATE opportunities SET metadata = metadata || $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2`, [opportunityId, actor.tenantId, JSON.stringify({ regression: { requested: true, fromStage: opp.stage_key, toStage: input.toStageKey, reason: input.reason.trim(), status: "pending_approval", at: new Date().toISOString() } }), actor.userId]);
        await this.recordAuditLog(client, actor, audit, { action: "exception.opportunity.regression_requested", resourceType: "opportunity", resourceId: opportunityId, status: "success", metadata: { from: opp.stage_key, to: input.toStageKey, reason: input.reason.trim() } });
        return { opportunityId, moved: false, approvalRequired: true };
      }
      await client.query(`UPDATE opportunities SET stage_option_id = $3, last_stage_changed_at = NOW(), metadata = metadata || $4::jsonb, updated_by = $5 WHERE id = $1 AND tenant_id = $2`, [opportunityId, actor.tenantId, toStageId, JSON.stringify({ regression: { fromStage: opp.stage_key, toStage: input.toStageKey, reason: input.reason.trim(), at: new Date().toISOString() } }), actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "exception.opportunity.regression", resourceType: "opportunity", resourceId: opportunityId, status: "success", metadata: { from: opp.stage_key, to: input.toStageKey, reason: input.reason.trim() } });
      return { opportunityId, moved: true, approvalRequired: false };
    });
  }

  // ---- EXC-007: complaint during sales cycle ---------------------------------------------------

  async logComplaint(actor: ActorContext, audit: AuditMetadata, input: LogComplaintRequestBody) {
    this.assertEnabled();
    if (!input.subject?.trim()) {
      throw new AppError(400, "A complaint subject is required.", undefined, "VALIDATION_ERROR");
    }
    return this.databaseService.withTransaction(async (client) => {
      // Resolve the account + owner from the originating lead/opportunity.
      let accountId: string | null = null;
      let ownerId: string | null;
      if (input.entityType === "opportunity") {
        const opp = (await client.query<{ account_id: string | null; owner_id: string | null }>(`SELECT account_id, owner_id FROM opportunities WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [input.entityId, actor.tenantId])).rows[0];
        if (!opp) throw new AppError(404, "Opportunity not found.", undefined, "NOT_FOUND");
        accountId = opp.account_id; ownerId = opp.owner_id;
      } else {
        const lead = (await client.query<{ owner_id: string | null }>(`SELECT owner_id FROM leads WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [input.entityId, actor.tenantId])).rows[0];
        if (!lead) throw new AppError(404, "Lead not found.", undefined, "NOT_FOUND");
        ownerId = lead.owner_id;
      }
      const statusId = await this.resolveOption(client, actor.tenantId, "support-ticket-status", "new");
      const priorityId = (await this.resolveOption(client, actor.tenantId, "support-ticket-priority", input.severity === "critical" ? "urgent" : input.severity ?? "high")) ?? (await this.firstOption(client, actor.tenantId, "support-ticket-priority"));
      const categoryId = (await this.resolveOption(client, actor.tenantId, "support-ticket-category", "general")) ?? (await this.firstOption(client, actor.tenantId, "support-ticket-category"));
      const sourceId = (await this.resolveOption(client, actor.tenantId, "support-ticket-source", "internal")) ?? (await this.firstOption(client, actor.tenantId, "support-ticket-source"));
      if (!statusId || !priorityId || !categoryId || !sourceId) {
        throw new AppError(500, "Support ticket option values are not configured.", undefined, "CONFIG_ERROR");
      }
      const ticket = await client.query<{ id: string }>(
        `INSERT INTO support_tickets (tenant_id, account_id, subject, description, status_option_id, priority_option_id, category_option_id, source_option_id, owner_id, metadata, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $11) RETURNING id`,
        [actor.tenantId, accountId, input.subject.trim(), trimmed(input.description), statusId, priorityId, categoryId, sourceId, ownerId, JSON.stringify({ origin: "sales_complaint", sourceEntity: { type: input.entityType, id: input.entityId } }), actor.userId]
      );
      // EXC-007: raise the opportunity risk flag + notify the deal owner.
      if (input.entityType === "opportunity") {
        await client.query(`UPDATE opportunities SET metadata = metadata || $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2`, [input.entityId, actor.tenantId, JSON.stringify({ riskFlags: { complaint: { ticketId: ticket.rows[0].id, at: new Date().toISOString(), severity: input.severity ?? "high" } } }), actor.userId]);
      }
      if (ownerId && ownerId !== actor.userId) {
        await this.notificationService.createNotificationWithClient(client, actor, audit, { notificationType: "customer_escalation", recipientUserId: ownerId, title: `Complaint on your ${input.entityType}`, message: input.subject.trim(), linkedRecord: { entityType: "ticket", entityId: ticket.rows[0].id } });
      }
      await this.recordAuditLog(client, actor, audit, { action: "exception.complaint.log", resourceType: "support_ticket", resourceId: ticket.rows[0].id, status: "success", metadata: { entityType: input.entityType, entityId: input.entityId } });
      return { ticketId: ticket.rows[0].id, opportunityRiskRaised: input.entityType === "opportunity" };
    });
  }

  // ---- EXC-008: partner / direct conflict ------------------------------------------------------

  async checkConflict(actor: ActorContext, accountId: string): Promise<ConflictCheckResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const account = (await client.query<{ owner_id: string | null }>(`SELECT owner_id FROM accounts WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [accountId, actor.tenantId])).rows[0];
      if (!account) throw new AppError(404, "Account not found.", undefined, "NOT_FOUND");
      const regs = await client.query<{ id: string; partner_id: string }>(
        `SELECT id, partner_id FROM partner_deal_registrations WHERE tenant_id = $1 AND deleted_at IS NULL AND (account_id = $2 OR metadata->>'accountId' = $2::text) LIMIT 50`,
        [actor.tenantId, accountId]
      ).catch(() => ({ rows: [] as Array<{ id: string; partner_id: string }> }));
      const hasConflict = Boolean(account.owner_id) && regs.rows.length > 0;
      return { hasConflict, directOwnerId: account.owner_id, partnerRegistrations: regs.rows.map((r) => ({ registrationId: r.id, partnerId: r.partner_id })) };
    });
  }

  async resolveConflict(actor: ActorContext, audit: AuditMetadata, accountId: string, input: ResolveConflictRequestBody) {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      const account = (await client.query<{ id: string; metadata: Record<string, unknown> | null }>(`SELECT id, metadata FROM accounts WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [accountId, actor.tenantId])).rows[0];
      if (!account) throw new AppError(404, "Account not found.", undefined, "NOT_FOUND");
      await client.query(`UPDATE accounts SET metadata = metadata || $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2`, [accountId, actor.tenantId, JSON.stringify({ channelConflict: { decision: input.decision, note: trimmed(input.note), resolvedBy: actor.userId, resolvedAt: new Date().toISOString() } }), actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "exception.conflict.resolve", resourceType: "account", resourceId: accountId, status: "success", metadata: { decision: input.decision } });
    });
    return { accountId, decision: input.decision };
  }

  // ---- EXC-009: high discount / low margin -----------------------------------------------------

  async assessMargin(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: AssessMarginRequestBody): Promise<MarginAssessmentResponse> {
    this.assertEnabled();
    const assessment = computeMarginRisk(input.listPrice, input.cost, input.discountPct);
    await this.databaseService.withTransaction(async (client) => {
      const opp = await this.loadOpportunity(client, actor.tenantId, opportunityId);
      const marginRisk = { ...assessment, approved: !assessment.requiresSeniorApproval, assessedAt: new Date().toISOString() };
      // jsonb_set cannot create a missing intermediate key, so build salesExec explicitly.
      await client.query(
        `UPDATE opportunities SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{salesExec}', COALESCE(metadata->'salesExec', '{}'::jsonb) || jsonb_build_object('marginRisk', $3::jsonb), true), updated_by = $4 WHERE id = $1 AND tenant_id = $2`,
        [opportunityId, actor.tenantId, JSON.stringify(marginRisk), actor.userId]
      );
      if (assessment.requiresSeniorApproval && opp.owner_id) {
        await this.notificationService.createNotificationWithClient(client, actor, audit, { notificationType: "approval_requested", recipientUserId: opp.owner_id, title: `Margin approval required: ${opp.name}`, message: `Net margin ${assessment.marginPct}% is below threshold — senior approval needed before close.`, linkedRecord: { entityType: "opportunity", entityId: opportunityId } });
      }
      await this.recordAuditLog(client, actor, audit, { action: "exception.margin.assess", resourceType: "opportunity", resourceId: opportunityId, status: "success", metadata: { marginPct: assessment.marginPct, riskLevel: assessment.riskLevel } });
    });
    return { assessment, approvalRequested: assessment.requiresSeniorApproval, message: assessment.requiresSeniorApproval ? "High-risk discount — the deal cannot close until senior margin approval is granted." : "Margin is within policy." };
  }

  async approveMargin(actor: ActorContext, audit: AuditMetadata, opportunityId: string) {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      const opp = await this.loadOpportunity(client, actor.tenantId, opportunityId);
      const marginRisk = (((opp.metadata ?? {}) as Record<string, unknown>).salesExec as Record<string, unknown> | undefined)?.marginRisk as Record<string, unknown> | undefined;
      if (!marginRisk) throw new AppError(409, "No margin assessment to approve.", undefined, "NO_MARGIN_ASSESSMENT");
      await client.query(`UPDATE opportunities SET metadata = jsonb_set(metadata, '{salesExec,marginRisk,approved}', 'true'::jsonb, true), updated_by = $3 WHERE id = $1 AND tenant_id = $2`, [opportunityId, actor.tenantId, actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "exception.margin.approve", resourceType: "opportunity", resourceId: opportunityId, status: "success" });
    });
    return { opportunityId, approved: true };
  }
}
