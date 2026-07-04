import type { PoolClient } from "pg";
import type { RoleSummary } from "@crm/types";
import type {
  AddDocumentVersionRequestBody,
  CfEntityType,
  CreateDocumentRequestBody,
  CreateRecordCommentRequestBody,
  DecideNbaRequestBody,
  DocumentsResponse,
  DocumentSummary,
  LeadAttributionResponse,
  MeetingSummariesResponse,
  NbaSignals,
  NextBestActionResponse,
  OwnableEntityType,
  OwnershipHistoryResponse,
  ReassignOwnerRequestBody,
  RecordAttributionTouchRequestBody,
  RecordCommentsResponse,
  UpsertMeetingSummaryRequestBody
} from "@crm/types";
import {
  cfEntityTypes,
  computeAttribution,
  extractMentions,
  meetingSentiments,
  nbaStatuses,
  nextBestActionTypes,
  ownableEntityTypes,
  recommendNextBestAction
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

function normalize<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return list.includes(value as T) ? (value as T) : fallback;
}

function trimmed(value: string | null | undefined): string | null {
  const next = value?.trim();
  return next && next.length > 0 ? next : null;
}

// Owner column per ownable entity (CF-006).
const OWNER_TABLE: Record<OwnableEntityType, { table: string; column: string }> = {
  lead: { table: "leads", column: "owner_id" },
  account: { table: "accounts", column: "owner_id" },
  opportunity: { table: "opportunities", column: "owner_id" },
  ticket: { table: "support_tickets", column: "owner_id" },
  customer_success_account: { table: "customer_success_accounts", column: "csm_owner_id" }
};

export class CrossFunctionalService {
  private readonly notificationService: NotificationService;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {
    this.notificationService = new NotificationService(databaseService, config);
  }

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "Cross-functional tools are unavailable until the database connection is enabled.", undefined, "CROSS_FUNCTIONAL_UNAVAILABLE");
    }
  }

  private assertEntityType(entityType: string): CfEntityType {
    if (!cfEntityTypes.includes(entityType as CfEntityType)) {
      throw new AppError(400, "Unsupported entity type.", undefined, "VALIDATION_ERROR");
    }
    return entityType as CfEntityType;
  }

  private async recordAuditLog(client: PoolClient, actor: ActorContext, audit: AuditMetadata, input: { action: string; resourceType: string; resourceId?: string | null; status: "success" | "failure"; metadata?: Record<string, unknown> }) {
    if (!this.config.enableAuditLogs) {
      return;
    }
    await client.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, event_type, action, resource_type, resource_id, status, ip_address, user_agent, metadata)
       VALUES ($1, $2, 'cross_functional', $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [actor.tenantId, actor.userId, input.action, input.resourceType, input.resourceId ?? null, input.status, audit.ipAddress, audit.userAgent, JSON.stringify(input.metadata ?? {})]
    );
  }

  // ---- CF-001: lead source attribution ---------------------------------------------------------

  async recordAttributionTouch(actor: ActorContext, audit: AuditMetadata, leadId: string, input: RecordAttributionTouchRequestBody): Promise<LeadAttributionResponse> {
    this.assertEnabled();
    const source = input.source?.trim();
    if (!source) {
      throw new AppError(400, "Source cannot be blank.", undefined, "SOURCE_REQUIRED");
    }
    await this.databaseService.withTransaction(async (client) => {
      const lead = await client.query<{ id: string }>(`SELECT id FROM leads WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [leadId, actor.tenantId]);
      if (lead.rowCount === 0) {
        throw new AppError(404, "Lead not found.", undefined, "NOT_FOUND");
      }
      await client.query(
        `INSERT INTO cf_attribution_touches (tenant_id, lead_id, source, sub_source, campaign, utm, partner, event, referral, occurred_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, COALESCE($10::timestamptz, NOW()), $11)`,
        [actor.tenantId, leadId, source, trimmed(input.subSource), trimmed(input.campaign), JSON.stringify(input.utm ?? {}), trimmed(input.partner), trimmed(input.event), trimmed(input.referral), trimmed(input.occurredAt), actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "cross_functional.attribution.touch", resourceType: "lead", resourceId: leadId, status: "success", metadata: { source } });
    });
    return this.getLeadAttribution(actor, leadId);
  }

  async getLeadAttribution(actor: ActorContext, leadId: string): Promise<LeadAttributionResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const result = await client.query<{ id: string; source: string; sub_source: string | null; campaign: string | null; partner: string | null; event: string | null; referral: string | null; utm: Record<string, string> | null; occurred_at: Date }>(
        `SELECT id, source, sub_source, campaign, partner, event, referral, utm, occurred_at FROM cf_attribution_touches WHERE tenant_id = $1 AND lead_id = $2 ORDER BY occurred_at ASC LIMIT 200`,
        [actor.tenantId, leadId]
      );
      const touches = result.rows.map((row) => ({ id: row.id, source: row.source, subSource: row.sub_source, campaign: row.campaign, partner: row.partner, event: row.event, referral: row.referral, utm: (row.utm ?? {}) as Record<string, string>, occurredAt: row.occurred_at.toISOString() }));
      const model = computeAttribution(result.rows.map((row) => ({ source: row.source, occurredAtMs: row.occurred_at.getTime() })));
      return { touches, model };
    });
  }

  // ---- CF-004: meeting intelligence ------------------------------------------------------------

  async createMeetingSummary(actor: ActorContext, audit: AuditMetadata, entityType: string, entityId: string, input: UpsertMeetingSummaryRequestBody): Promise<MeetingSummariesResponse> {
    this.assertEnabled();
    const type = this.assertEntityType(entityType);
    if (!input.title?.trim()) {
      throw new AppError(400, "A meeting title is required.", undefined, "VALIDATION_ERROR");
    }
    await this.databaseService.withTransaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO cf_meeting_summaries (tenant_id, entity_type, entity_id, title, summary, decisions, objections, next_steps, stakeholders, sentiment, status, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12) RETURNING id`,
        [actor.tenantId, type, entityId, input.title.trim(), trimmed(input.summary), trimmed(input.decisions), trimmed(input.objections), trimmed(input.nextSteps), trimmed(input.stakeholders), normalize(meetingSentiments, input.sentiment, "neutral"), input.save ? "saved" : "draft", actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "cross_functional.meeting.create", resourceType: "cf_meeting_summary", resourceId: inserted.rows[0].id, status: "success", metadata: { entityType: type } });
    });
    return this.listMeetingSummaries(actor, entityType, entityId);
  }

  async updateMeetingSummary(actor: ActorContext, audit: AuditMetadata, meetingId: string, input: UpsertMeetingSummaryRequestBody): Promise<MeetingSummariesResponse> {
    this.assertEnabled();
    const scope = await this.databaseService.withTransaction(async (client) => {
      const existing = await client.query<{ entity_type: string; entity_id: string }>(`SELECT entity_type, entity_id FROM cf_meeting_summaries WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [meetingId, actor.tenantId]);
      if (existing.rowCount === 0) {
        throw new AppError(404, "Meeting summary not found.", undefined, "NOT_FOUND");
      }
      await client.query(
        `UPDATE cf_meeting_summaries SET title = COALESCE($3, title), summary = $4, decisions = $5, objections = $6, next_steps = $7, stakeholders = $8, sentiment = $9, status = $10, updated_by = $11 WHERE id = $1 AND tenant_id = $2`,
        [meetingId, actor.tenantId, trimmed(input.title), trimmed(input.summary), trimmed(input.decisions), trimmed(input.objections), trimmed(input.nextSteps), trimmed(input.stakeholders), normalize(meetingSentiments, input.sentiment, "neutral"), input.save ? "saved" : "draft", actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "cross_functional.meeting.update", resourceType: "cf_meeting_summary", resourceId: meetingId, status: "success" });
      return existing.rows[0];
    });
    return this.listMeetingSummaries(actor, scope.entity_type, scope.entity_id);
  }

  async listMeetingSummaries(actor: ActorContext, entityType: string, entityId: string): Promise<MeetingSummariesResponse> {
    this.assertEnabled();
    const type = this.assertEntityType(entityType);
    return this.databaseService.withClient(async (client) => {
      const result = await client.query(
        `SELECT id, entity_type, entity_id, title, summary, decisions, objections, next_steps, stakeholders, sentiment, status, created_at, updated_at
         FROM cf_meeting_summaries WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3 ORDER BY created_at DESC LIMIT 50`,
        [actor.tenantId, type, entityId]
      );
      return {
        meetings: result.rows.map((row) => ({ id: row.id, entityType: normalize(cfEntityTypes, row.entity_type, "lead"), entityId: row.entity_id, title: row.title, summary: row.summary, decisions: row.decisions, objections: row.objections, nextSteps: row.next_steps, stakeholders: row.stakeholders, sentiment: normalize(meetingSentiments, row.sentiment, "neutral"), status: row.status === "saved" ? "saved" : "draft", createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() }))
      };
    });
  }

  // ---- CF-005: next best action ----------------------------------------------------------------

  private async gatherSignals(client: PoolClient, tenantId: string, entityType: CfEntityType, entityId: string): Promise<NbaSignals> {
    const signals: NbaSignals = { entityType, daysSinceLastActivity: 0 };
    if (entityType === "opportunity") {
      const row = (await client.query<{ updated_at: Date; stage_key: string | null; discount_status: string | null }>(
        `SELECT o.updated_at, st.value_key AS stage_key, o.metadata->'salesExec'->'discount'->>'status' AS discount_status
         FROM opportunities o LEFT JOIN tenant_option_values st ON st.id = o.stage_option_id AND st.tenant_id = o.tenant_id
         WHERE o.id = $1 AND o.tenant_id = $2 AND o.deleted_at IS NULL LIMIT 1`, [entityId, tenantId])).rows[0];
      if (row) { signals.daysSinceLastActivity = Math.floor((Date.now() - row.updated_at.getTime()) / 86_400_000); signals.stageKey = row.stage_key; signals.discountPendingApproval = row.discount_status === "pending_approval"; }
    } else if (entityType === "customer_success_account") {
      const row = (await client.query<{ updated_at: Date; health_score: number | null }>(`SELECT updated_at, health_score FROM customer_success_accounts WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [entityId, tenantId])).rows[0];
      if (row) { signals.daysSinceLastActivity = Math.floor((Date.now() - row.updated_at.getTime()) / 86_400_000); signals.healthBand = row.health_score === null ? null : row.health_score >= 75 ? "green" : row.health_score >= 50 ? "amber" : "red"; }
    } else if (entityType === "ticket") {
      const row = (await client.query<{ updated_at: Date; breached: boolean }>(`SELECT updated_at, (resolution_due_at IS NOT NULL AND COALESCE(resolved_at, NOW()) > resolution_due_at) AS breached FROM support_tickets WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [entityId, tenantId])).rows[0];
      if (row) { signals.daysSinceLastActivity = Math.floor((Date.now() - row.updated_at.getTime()) / 86_400_000); signals.slaBreached = row.breached; }
    } else {
      const table = entityType === "lead" ? "leads" : entityType === "account" ? "accounts" : "contacts";
      const row = (await client.query<{ updated_at: Date }>(`SELECT updated_at FROM ${table} WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [entityId, tenantId])).rows[0];
      if (row) { signals.daysSinceLastActivity = Math.floor((Date.now() - row.updated_at.getTime()) / 86_400_000); signals.isStale = signals.daysSinceLastActivity >= 60; }
    }
    return signals;
  }

  async getNextBestAction(actor: ActorContext, entityType: string, entityId: string): Promise<NextBestActionResponse> {
    this.assertEnabled();
    const type = this.assertEntityType(entityType);
    return this.databaseService.withClient(async (client) => {
      const recommendation = recommendNextBestAction(await this.gatherSignals(client, actor.tenantId, type, entityId));
      const pending = await client.query(
        `SELECT id, action_type, reason, status, snoozed_until, created_at FROM cf_next_best_actions
         WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3 AND status IN ('pending', 'snoozed') ORDER BY created_at DESC LIMIT 20`,
        [actor.tenantId, type, entityId]
      );
      return {
        recommendation,
        pending: pending.rows.map((row) => ({ id: row.id, actionType: normalize(nextBestActionTypes, row.action_type, "call"), reason: row.reason, status: normalize(nbaStatuses, row.status, "pending"), snoozedUntil: row.snoozed_until ? (row.snoozed_until as Date).toISOString() : null, createdAt: row.created_at.toISOString() })),
        aiPlaceholder: { available: false, message: "AI next-best-action narration will connect with the governed AI Gateway; a deterministic recommendation is shown meanwhile." }
      };
    });
  }

  async persistRecommendation(actor: ActorContext, audit: AuditMetadata, entityType: string, entityId: string) {
    this.assertEnabled();
    const type = this.assertEntityType(entityType);
    return this.databaseService.withTransaction(async (client) => {
      const rec = recommendNextBestAction(await this.gatherSignals(client, actor.tenantId, type, entityId));
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO cf_next_best_actions (tenant_id, entity_type, entity_id, action_type, reason, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`,
        [actor.tenantId, type, entityId, rec.actionType, rec.reason, actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "cross_functional.nba.create", resourceType: "cf_next_best_action", resourceId: inserted.rows[0].id, status: "success", metadata: { actionType: rec.actionType } });
      return { actionId: inserted.rows[0].id, recommendation: rec };
    });
  }

  async decideNba(actor: ActorContext, audit: AuditMetadata, actionId: string, input: DecideNbaRequestBody) {
    this.assertEnabled();
    const status = input.decision === "accept" ? "accepted" : input.decision === "dismiss" ? "dismissed" : "snoozed";
    await this.databaseService.withTransaction(async (client) => {
      const result = await client.query(
        `UPDATE cf_next_best_actions SET status = $3, snoozed_until = $4::timestamptz, updated_by = $5 WHERE id = $1 AND tenant_id = $2`,
        [actionId, actor.tenantId, status, input.decision === "snooze" ? trimmed(input.snoozeUntil) : null, actor.userId]
      );
      if (result.rowCount === 0) {
        throw new AppError(404, "Next best action not found.", undefined, "NOT_FOUND");
      }
      await this.recordAuditLog(client, actor, audit, { action: "cross_functional.nba.decide", resourceType: "cf_next_best_action", resourceId: actionId, status: "success", metadata: { decision: input.decision } });
    });
    return { actionId, status };
  }

  // ---- CF-006: record ownership ----------------------------------------------------------------

  async reassignOwner(actor: ActorContext, audit: AuditMetadata, entityType: string, entityId: string, input: ReassignOwnerRequestBody): Promise<OwnershipHistoryResponse> {
    this.assertEnabled();
    if (!ownableEntityTypes.includes(entityType as OwnableEntityType)) {
      throw new AppError(400, "This entity type does not support ownership.", undefined, "VALIDATION_ERROR");
    }
    if (!input.reason?.trim()) {
      throw new AppError(400, "A reason is required to change ownership.", undefined, "OWNERSHIP_REASON_REQUIRED");
    }
    const type = entityType as OwnableEntityType;
    const { table, column } = OWNER_TABLE[type];
    await this.databaseService.withTransaction(async (client) => {
      const current = (await client.query<{ owner: string | null }>(`SELECT ${column} AS owner FROM ${table} WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [entityId, actor.tenantId])).rows[0];
      if (!current) {
        throw new AppError(404, `${type} not found.`, undefined, "NOT_FOUND");
      }
      const newOwner = await client.query<{ id: string }>(`SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [input.toOwnerId, actor.tenantId]);
      if (newOwner.rowCount === 0) {
        throw new AppError(400, "The selected owner is invalid for this tenant.", undefined, "INVALID_OWNER");
      }
      await client.query(`UPDATE ${table} SET ${column} = $3, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [entityId, actor.tenantId, input.toOwnerId, actor.userId]);
      await client.query(
        `INSERT INTO cf_ownership_changes (tenant_id, entity_type, entity_id, from_owner_id, to_owner_id, reason, changed_by) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [actor.tenantId, type, entityId, current.owner, input.toOwnerId, input.reason.trim(), actor.userId]
      );
      if (input.toOwnerId !== actor.userId) {
        await this.notificationService.createNotificationWithClient(client, actor, audit, { notificationType: "record_assignment", recipientUserId: input.toOwnerId, title: `You now own a ${type.replace(/_/g, " ")}`, message: input.reason.trim(), linkedRecord: { entityType: type, entityId } });
      }
      await this.recordAuditLog(client, actor, audit, { action: "cross_functional.ownership.reassign", resourceType: type, resourceId: entityId, status: "success", metadata: { from: current.owner, to: input.toOwnerId, reason: input.reason.trim() } });
    });
    return this.getOwnershipHistory(actor, entityType, entityId);
  }

  async getOwnershipHistory(actor: ActorContext, entityType: string, entityId: string): Promise<OwnershipHistoryResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const result = await client.query(
        `SELECT id, from_owner_id, to_owner_id, reason, changed_by, created_at FROM cf_ownership_changes WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3 ORDER BY created_at DESC LIMIT 100`,
        [actor.tenantId, entityType, entityId]
      );
      return { history: result.rows.map((row) => ({ id: row.id, fromOwnerId: row.from_owner_id, toOwnerId: row.to_owner_id, reason: row.reason, changedBy: row.changed_by, createdAt: row.created_at.toISOString() })) };
    });
  }

  // ---- CF-009: document management -------------------------------------------------------------

  async createDocument(actor: ActorContext, audit: AuditMetadata, entityType: string, entityId: string, input: CreateDocumentRequestBody): Promise<DocumentsResponse> {
    this.assertEnabled();
    const type = this.assertEntityType(entityType);
    if (!input.name?.trim() || !input.fileRef?.trim()) {
      throw new AppError(400, "A document name and file reference are required.", undefined, "VALIDATION_ERROR");
    }
    await this.databaseService.withTransaction(async (client) => {
      const doc = await client.query<{ id: string }>(
        `INSERT INTO cf_documents (tenant_id, entity_type, entity_id, name, tags, current_version, created_by, updated_by) VALUES ($1, $2, $3, $4, $5::jsonb, 1, $6, $6) RETURNING id`,
        [actor.tenantId, type, entityId, input.name.trim(), JSON.stringify(Array.isArray(input.tags) ? input.tags : []), actor.userId]
      );
      await client.query(`INSERT INTO cf_document_versions (tenant_id, document_id, version, file_ref, notes, created_by) VALUES ($1, $2, 1, $3, $4, $5)`, [actor.tenantId, doc.rows[0].id, input.fileRef.trim(), trimmed(input.notes), actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "cross_functional.document.create", resourceType: "cf_document", resourceId: doc.rows[0].id, status: "success" });
    });
    return this.listDocuments(actor, entityType, entityId);
  }

  async addDocumentVersion(actor: ActorContext, audit: AuditMetadata, documentId: string, input: AddDocumentVersionRequestBody): Promise<DocumentsResponse> {
    this.assertEnabled();
    const scope = await this.databaseService.withTransaction(async (client) => {
      const doc = (await client.query<{ entity_type: string; entity_id: string; current_version: number; locked: boolean }>(`SELECT entity_type, entity_id, current_version, locked FROM cf_documents WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [documentId, actor.tenantId])).rows[0];
      if (!doc) {
        throw new AppError(404, "Document not found.", undefined, "NOT_FOUND");
      }
      if (doc.locked) {
        throw new AppError(409, "This document is locked and cannot be versioned.", undefined, "DOCUMENT_LOCKED");
      }
      if (!input.fileRef?.trim()) {
        throw new AppError(400, "A file reference is required.", undefined, "VALIDATION_ERROR");
      }
      const nextVersion = doc.current_version + 1;
      await client.query(`INSERT INTO cf_document_versions (tenant_id, document_id, version, file_ref, notes, created_by) VALUES ($1, $2, $3, $4, $5, $6)`, [actor.tenantId, documentId, nextVersion, input.fileRef.trim(), trimmed(input.notes), actor.userId]);
      await client.query(`UPDATE cf_documents SET current_version = $3, updated_by = $4 WHERE id = $1 AND tenant_id = $2`, [documentId, actor.tenantId, nextVersion, actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "cross_functional.document.version", resourceType: "cf_document", resourceId: documentId, status: "success", metadata: { version: nextVersion } });
      return doc;
    });
    return this.listDocuments(actor, scope.entity_type, scope.entity_id);
  }

  async lockDocument(actor: ActorContext, audit: AuditMetadata, documentId: string): Promise<DocumentsResponse> {
    this.assertEnabled();
    const scope = await this.databaseService.withTransaction(async (client) => {
      const doc = (await client.query<{ entity_type: string; entity_id: string }>(`SELECT entity_type, entity_id FROM cf_documents WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [documentId, actor.tenantId])).rows[0];
      if (!doc) {
        throw new AppError(404, "Document not found.", undefined, "NOT_FOUND");
      }
      await client.query(`UPDATE cf_documents SET locked = true, updated_by = $3 WHERE id = $1 AND tenant_id = $2`, [documentId, actor.tenantId, actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "cross_functional.document.lock", resourceType: "cf_document", resourceId: documentId, status: "success" });
      return doc;
    });
    return this.listDocuments(actor, scope.entity_type, scope.entity_id);
  }

  async listDocuments(actor: ActorContext, entityType: string, entityId: string): Promise<DocumentsResponse> {
    this.assertEnabled();
    const type = this.assertEntityType(entityType);
    return this.databaseService.withClient(async (client) => {
      const docs = await client.query<{ id: string; name: string; tags: unknown; current_version: number; locked: boolean; updated_at: Date }>(
        `SELECT id, name, tags, current_version, locked, updated_at FROM cf_documents WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 100`,
        [actor.tenantId, type, entityId]
      );
      const documents: DocumentSummary[] = [];
      for (const doc of docs.rows) {
        const versions = await client.query<{ version: number; file_ref: string; notes: string | null; created_at: Date }>(`SELECT version, file_ref, notes, created_at FROM cf_document_versions WHERE tenant_id = $1 AND document_id = $2 ORDER BY version DESC LIMIT 50`, [actor.tenantId, doc.id]);
        documents.push({ id: doc.id, name: doc.name, tags: Array.isArray(doc.tags) ? (doc.tags as unknown[]).filter((t): t is string => typeof t === "string") : [], currentVersion: doc.current_version, locked: doc.locked, versions: versions.rows.map((v) => ({ version: v.version, fileRef: v.file_ref, notes: v.notes, createdAt: v.created_at.toISOString() })), updatedAt: doc.updated_at.toISOString() });
      }
      return { documents };
    });
  }

  // ---- CF-010: internal comments + mentions ----------------------------------------------------

  async createComment(actor: ActorContext, audit: AuditMetadata, entityType: string, entityId: string, input: CreateRecordCommentRequestBody): Promise<RecordCommentsResponse> {
    this.assertEnabled();
    const type = this.assertEntityType(entityType);
    const body = input.body?.trim();
    if (!body) {
      throw new AppError(400, "A comment body is required.", undefined, "VALIDATION_ERROR");
    }
    const mentions = extractMentions(body);
    await this.databaseService.withTransaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO cf_record_comments (tenant_id, entity_type, entity_id, body, mentions, is_internal, created_by) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7) RETURNING id`,
        [actor.tenantId, type, entityId, body, JSON.stringify(mentions), input.isInternal === false ? false : true, actor.userId]
      );
      // Notify mentioned users, resolved by email local-part handle.
      if (mentions.length > 0) {
        const mentioned = await client.query<{ id: string }>(`SELECT id FROM users WHERE tenant_id = $1 AND deleted_at IS NULL AND split_part(email, '@', 1) = ANY($2::text[])`, [actor.tenantId, mentions]);
        for (const user of mentioned.rows) {
          if (user.id === actor.userId) continue;
          await this.notificationService.createNotificationWithClient(client, actor, audit, { notificationType: "record_assignment", recipientUserId: user.id, title: `${actor.displayName} mentioned you`, message: body.slice(0, 240), linkedRecord: { entityType: type, entityId } });
        }
      }
      await this.recordAuditLog(client, actor, audit, { action: "cross_functional.comment.create", resourceType: "cf_record_comment", resourceId: inserted.rows[0].id, status: "success", metadata: { mentions: mentions.length } });
    });
    return this.listComments(actor, entityType, entityId, true);
  }

  async listComments(actor: ActorContext, entityType: string, entityId: string, includeInternal: boolean): Promise<RecordCommentsResponse> {
    this.assertEnabled();
    const type = this.assertEntityType(entityType);
    return this.databaseService.withClient(async (client) => {
      // CF-010: portal users (no internal-comment permission) only see non-internal comments.
      const internalClause = includeInternal ? "" : "AND is_internal = false";
      const result = await client.query(
        `SELECT id, body, mentions, is_internal, created_by, created_at FROM cf_record_comments WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3 ${internalClause} ORDER BY created_at DESC LIMIT 100`,
        [actor.tenantId, type, entityId]
      );
      return { comments: result.rows.map((row) => ({ id: row.id, body: row.body, mentions: Array.isArray(row.mentions) ? (row.mentions as unknown[]).filter((m): m is string => typeof m === "string") : [], isInternal: row.is_internal, createdBy: row.created_by, createdAt: row.created_at.toISOString() })) };
    });
  }
}
