import {
  customerQueryChannels,
  customerQueryEscalationReasons,
  customerQueryEscalationStatuses,
  customerQueryFeedbackValues,
  customerQueryMessageRoles,
  customerQuerySessionStatuses,
  type AskCustomerQueryRequestBody,
  type CustomerQueryAnswer,
  type CustomerQueryAnswerResponse,
  type CustomerQueryChannel,
  type CustomerQueryDashboardResponse,
  type CustomerQueryEscalation,
  type CustomerQueryEscalationReason,
  type CustomerQueryEscalationResponse,
  type CustomerQueryKnowledgeGapListResponse,
  type CustomerQueryLevel,
  type CustomerQueryMessage,
  type CustomerQuerySession,
  type CustomerQuerySessionDetail,
  type CustomerQuerySessionListQuery,
  type CustomerQuerySessionListResponse,
  type CustomerQuerySessionResponse,
  type EscalateCustomerQueryRequestBody,
  type RagCitation,
  type RoleSummary,
  type SubmitCustomerQueryFeedbackRequestBody
} from "@crm/types";
import type { PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { RagService } from "../rag/rag.service.js";

interface AuditMetadata {
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

interface ActorContext {
  userId: string;
  tenantId: string;
  sessionId: string;
  email: string;
  displayName: string;
  permissionCodes: string[];
  roles: RoleSummary[];
}

export interface CustomerQueryConfig {
  enableAuditLogs: boolean;
  embeddingModel: string;
  vectorBackend: string;
}

const ASK_PERMISSIONS = ["customer_query.use_ai", "customer_query.create", "customer_query.manage_ai", "customer_query.configure"];
const REVIEW_PERMISSIONS = ["customer_query.view", "customer_query.view_dashboard", "customer_query.manage_ai", "customer_query.assign", "customer_query.configure", "customer_query.edit"];
const MANAGE_PERMISSIONS = ["customer_query.assign", "customer_query.manage_ai", "customer_query.configure", "customer_query.edit"];

const LOW_CONFIDENCE_THRESHOLD = 0.4;
const TOP_CITATIONS = 4;

// Query-level classification keywords. Level 3 is always escalated.
const LEVEL_3_KEYWORDS = ["outage", "down", "offline", "data loss", "data corruption", "corrupt", "breach", "hacked", "security", "vulnerability", "billing", "invoice", "charge", "refund", "payment", "contract", "integration failure", "integration fail", "api down", "critical", "emergency", "custom development", "custom feature", "data leak"];
const LEVEL_2_KEYWORDS = ["workflow", "permission", "access denied", "denied", "dashboard", "assignment", "assign", "configuration", "config", "troubleshoot", "not working", "broken", "error", "cannot", "can't", "unable", "fails", "failing"];

// Exported for unit testing of the query classification + escalation logic.
export function classifyLevel(text: string): CustomerQueryLevel {
  const haystack = text.toLowerCase();
  if (LEVEL_3_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    return 3;
  }
  if (LEVEL_2_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    return 2;
  }
  return 1;
}

export function computeConfidence(citations: RagCitation[]): number {
  if (citations.length === 0) {
    return 0;
  }
  const topScore = citations[0]?.score ?? 0;
  const scoreFactor = Math.min(1, topScore / 5);
  const countFactor = Math.min(1, citations.length / 3);
  return Math.round((0.6 * scoreFactor + 0.4 * countFactor) * 1000) / 1000;
}

export function buildAnswer(citations: RagCitation[], escalated: boolean): string {
  if (citations.length === 0) {
    return "I couldn't find an approved answer to your question. I've escalated it to our team and logged it so we can improve our knowledge base.";
  }
  const lines = citations.slice(0, TOP_CITATIONS).map((citation) => `• ${citation.sourceName ?? "Knowledge"}: ${citation.snippet}`);
  let answer = `Based on our approved knowledge sources:\n${lines.join("\n")}`;
  if (escalated) {
    answer += "\n\nThis may need additional help, so I've routed it to our team for review.";
  }
  return answer;
}

export class CustomerQueryService {
  private readonly ragService: RagService;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: CustomerQueryConfig
  ) {
    this.ragService = new RagService(databaseService, { enableAuditLogs: config.enableAuditLogs, embeddingModel: config.embeddingModel, vectorBackend: config.vectorBackend });
  }

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "The customer query bot is unavailable until the database connection is enabled.", undefined, "CUSTOMER_QUERY_UNAVAILABLE");
    }
  }

  private requirePermission(actor: ActorContext, permissions: string[], message: string) {
    if (!permissions.some((code) => actor.permissionCodes.includes(code))) {
      throw new AppError(403, message, undefined, "AUTHORIZATION_ERROR");
    }
  }

  private canReview(actor: ActorContext) {
    return REVIEW_PERMISSIONS.some((code) => actor.permissionCodes.includes(code));
  }

  private async recordAuditLog(client: PoolClient, actor: ActorContext, audit: AuditMetadata, input: { action: string; resourceType: string; resourceId: string; metadata?: Record<string, unknown> }) {
    if (!this.config.enableAuditLogs) {
      return;
    }
    await client.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, session_id, event_type, action, resource_type, resource_id, status, ip_address, user_agent, request_id, metadata) VALUES ($1, $2, $3, 'ai', $4, $5, $6, 'success', NULLIF($7, '')::inet, $8, $9, $10::jsonb)`,
      [actor.tenantId, actor.userId, actor.sessionId, input.action, input.resourceType, input.resourceId, audit.ipAddress ?? "", audit.userAgent ?? null, audit.requestId, JSON.stringify(input.metadata ?? {})]
    );
  }

  // -------------------------------------------------------------------------
  // Mapping helpers
  // -------------------------------------------------------------------------

  private mapSession(row: Record<string, unknown>): CustomerQuerySession {
    return {
      id: row.id as string,
      subject: row.subject as string,
      channel: (customerQueryChannels.includes(row.channel as CustomerQueryChannel) ? row.channel : "customer_portal") as CustomerQueryChannel,
      status: (customerQuerySessionStatuses.includes(row.status as CustomerQuerySession["status"]) ? row.status : "active") as CustomerQuerySession["status"],
      escalationLevel: Number(row.escalation_level ?? 0),
      lastConfidence: row.last_confidence === null || row.last_confidence === undefined ? null : Number(row.last_confidence),
      messageCount: Number(row.message_count ?? 0),
      customerUserId: (row.customer_user_id as string | null) ?? null,
      assignedAgentId: (row.assigned_agent_id as string | null) ?? null,
      relatedTicketId: (row.related_ticket_id as string | null) ?? null,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
      createdBy: (row.created_by as string | null) ?? null,
      updatedBy: (row.updated_by as string | null) ?? null
    };
  }

  private mapMessage(row: Record<string, unknown>): CustomerQueryMessage {
    const citations = Array.isArray(row.citations) ? (row.citations as RagCitation[]) : [];
    return {
      id: row.id as string,
      sessionId: row.session_id as string,
      role: (customerQueryMessageRoles.includes(row.role as CustomerQueryMessage["role"]) ? row.role : "system") as CustomerQueryMessage["role"],
      content: row.content as string,
      queryLevel: row.query_level === null || row.query_level === undefined ? null : (Number(row.query_level) as CustomerQueryLevel),
      confidenceScore: row.confidence_score === null || row.confidence_score === undefined ? null : Number(row.confidence_score),
      isGrounded: row.is_grounded as boolean,
      escalated: row.escalated as boolean,
      citations,
      feedback: (customerQueryFeedbackValues.includes(row.feedback as CustomerQueryMessage["feedback"]) ? row.feedback : "pending") as CustomerQueryMessage["feedback"],
      feedbackNote: row.feedback_note as string,
      createdAt: (row.created_at as Date).toISOString(),
      createdBy: (row.created_by as string | null) ?? null
    };
  }

  private mapEscalation(row: Record<string, unknown>): CustomerQueryEscalation {
    return {
      id: row.id as string,
      sessionId: row.session_id as string,
      messageId: (row.message_id as string | null) ?? null,
      reason: (customerQueryEscalationReasons.includes(row.reason as CustomerQueryEscalationReason) ? row.reason : "customer_request") as CustomerQueryEscalationReason,
      level: Number(row.level ?? 0),
      status: (customerQueryEscalationStatuses.includes(row.status as CustomerQueryEscalation["status"]) ? row.status : "open") as CustomerQueryEscalation["status"],
      notes: row.notes as string,
      relatedTicketId: (row.related_ticket_id as string | null) ?? null,
      assignedAgentId: (row.assigned_agent_id as string | null) ?? null,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
      createdBy: (row.created_by as string | null) ?? null,
      updatedBy: (row.updated_by as string | null) ?? null
    };
  }

  private async loadSessionRow(client: PoolClient, tenantId: string, sessionId: string) {
    const result = await client.query(`SELECT * FROM customer_query_sessions WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [sessionId, tenantId]);
    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, "The requested query session was not found.", undefined, "CUSTOMER_QUERY_SESSION_NOT_FOUND");
    }
    return row;
  }

  private assertSessionAccess(actor: ActorContext, sessionRow: Record<string, unknown>) {
    const isOwner = sessionRow.created_by === actor.userId || sessionRow.customer_user_id === actor.userId;
    if (!isOwner && !this.canReview(actor)) {
      throw new AppError(403, "You do not have access to this query session.", undefined, "AUTHORIZATION_ERROR");
    }
  }

  private async buildSessionDetail(client: PoolClient, tenantId: string, sessionRow: Record<string, unknown>): Promise<CustomerQuerySessionDetail> {
    const messages = await client.query(`SELECT * FROM customer_query_messages WHERE tenant_id = $1 AND session_id = $2 ORDER BY created_at ASC`, [tenantId, sessionRow.id]);
    const escalations = await client.query(`SELECT * FROM customer_query_escalations WHERE tenant_id = $1 AND session_id = $2 AND deleted_at IS NULL ORDER BY created_at ASC`, [tenantId, sessionRow.id]);
    return {
      ...this.mapSession(sessionRow),
      messages: messages.rows.map((row) => this.mapMessage(row)),
      escalations: escalations.rows.map((row) => this.mapEscalation(row))
    };
  }

  // -------------------------------------------------------------------------
  // Support ticket creation (best-effort, reuses Phase 15 support schema)
  // -------------------------------------------------------------------------

  private async resolveDefaultOptionValueId(client: PoolClient, tenantId: string, setKey: string): Promise<string | null> {
    const result = await client.query<{ id: string }>(
      `SELECT tov.id FROM tenant_option_sets tos
       INNER JOIN tenant_option_values tov ON tov.option_set_id = tos.id AND tov.tenant_id = tos.tenant_id
       WHERE tos.tenant_id = $1 AND tos.set_key = $2 AND tos.deleted_at IS NULL AND tov.deleted_at IS NULL AND tov.is_active = TRUE
       ORDER BY tov.is_default DESC, tov.sort_order ASC LIMIT 1`,
      [tenantId, setKey]
    );
    return result.rows[0]?.id ?? null;
  }

  private async createSupportTicket(client: PoolClient, actor: ActorContext, subject: string, description: string): Promise<string | null> {
    const [status, priority, category, source] = await Promise.all([
      this.resolveDefaultOptionValueId(client, actor.tenantId, "support-ticket-status"),
      this.resolveDefaultOptionValueId(client, actor.tenantId, "support-ticket-priority"),
      this.resolveDefaultOptionValueId(client, actor.tenantId, "support-ticket-category"),
      this.resolveDefaultOptionValueId(client, actor.tenantId, "support-ticket-source")
    ]);
    if (!status || !priority || !category || !source) {
      // Support option sets are not configured for this tenant; skip ticketing.
      return null;
    }
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO support_tickets (tenant_id, subject, description, status_option_id, priority_option_id, category_option_id, source_option_id, escalation_status, metadata, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'escalated', $8::jsonb, $9, $9) RETURNING id`,
      [actor.tenantId, subject.slice(0, 240), description, status, priority, category, source, JSON.stringify({ origin: "customer_query_ai" }), actor.userId]
    );
    return inserted.rows[0]?.id ?? null;
  }

  // -------------------------------------------------------------------------
  // Ask
  // -------------------------------------------------------------------------

  async ask(actor: ActorContext, audit: AuditMetadata, input: AskCustomerQueryRequestBody): Promise<CustomerQueryAnswerResponse> {
    this.assertEnabled();
    this.requirePermission(actor, ASK_PERMISSIONS, "You do not have permission to use the customer query bot.");
    const query = input.query.trim();
    const channel: CustomerQueryChannel = customerQueryChannels.includes(input.channel as CustomerQueryChannel) ? (input.channel as CustomerQueryChannel) : "customer_portal";

    // Resolve or create the session.
    const sessionRow = await this.databaseService.withTransaction(async (client) => {
      if (input.sessionId) {
        const existing = await this.loadSessionRow(client, actor.tenantId, input.sessionId);
        this.assertSessionAccess(actor, existing);
        return existing;
      }
      const subject = (input.subject ?? query).trim().slice(0, 200);
      const inserted = await client.query(
        `INSERT INTO customer_query_sessions (tenant_id, subject, channel, customer_user_id, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $5) RETURNING *`,
        [actor.tenantId, subject, channel, actor.userId, actor.userId]
      );
      return inserted.rows[0];
    });

    // The bot must retrieve approved sources before answering (RAG, permission-aware).
    const retrieval = await this.ragService.retrieve(actor, audit, { query, topK: input.topK ?? 5 });
    const citations = retrieval.citations;

    const level = classifyLevel(query);
    const confidence = computeConfidence(citations);
    const isGrounded = citations.length > 0;

    let escalationReason: CustomerQueryEscalationReason | null = null;
    if (level === 3) {
      escalationReason = "level_3";
    } else if (citations.length === 0) {
      escalationReason = "no_answer";
    } else if (confidence < LOW_CONFIDENCE_THRESHOLD) {
      escalationReason = "low_confidence";
    }
    const escalated = escalationReason !== null;
    const shouldCreateTicket = escalationReason === "level_3" || escalationReason === "no_answer";
    const answerText = buildAnswer(citations, escalated);

    const result = await this.databaseService.withTransaction(async (client) => {
      const questionMessage = await client.query(
        `INSERT INTO customer_query_messages (tenant_id, session_id, role, content, query_level, created_by) VALUES ($1, $2, 'customer', $3, $4, $5) RETURNING id`,
        [actor.tenantId, sessionRow.id, query, level, actor.userId]
      );
      const answerMessage = await client.query(
        `INSERT INTO customer_query_messages (tenant_id, session_id, role, content, confidence_score, is_grounded, escalated, citations, retrieval_metadata, created_by)
         VALUES ($1, $2, 'assistant', $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9) RETURNING id`,
        [actor.tenantId, sessionRow.id, answerText, confidence, isGrounded, escalated, JSON.stringify(citations), JSON.stringify({ strategy: retrieval.retrieval.strategy, accessibleSourceCount: retrieval.accessibleSourceCount, restrictedSourceCount: retrieval.restrictedSourceCount }), actor.userId]
      );
      const answerMessageId = answerMessage.rows[0].id as string;

      let ticketId: string | null = null;
      if (shouldCreateTicket) {
        const description = `Customer query escalation (level ${level}).\n\nQuestion: ${query}\n\nAI answer: ${answerText}`;
        ticketId = await this.createSupportTicket(client, actor, `AI query: ${(sessionRow.subject as string) || query}`, description);
      }

      if (escalated) {
        await client.query(
          `INSERT INTO customer_query_escalations (tenant_id, session_id, message_id, reason, level, related_ticket_id, notes, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
          [actor.tenantId, sessionRow.id, answerMessageId, escalationReason, level, ticketId, `Auto-escalated: ${escalationReason}`, actor.userId]
        );
      }

      const newStatus = escalated ? "escalated" : (sessionRow.status === "escalated" ? "escalated" : "active");
      const newLevel = escalated ? Math.max(Number(sessionRow.escalation_level ?? 0), level) : Number(sessionRow.escalation_level ?? 0);
      await client.query(
        `UPDATE customer_query_sessions SET status = $3, escalation_level = $4, last_confidence = $5, message_count = message_count + 2, related_ticket_id = COALESCE($6, related_ticket_id), updated_by = $7 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [sessionRow.id, actor.tenantId, newStatus, newLevel, confidence, ticketId, actor.userId]
      );

      await this.recordAuditLog(client, actor, audit, { action: "ai.customer_query.ask", resourceType: "customer_query_session", resourceId: sessionRow.id as string, metadata: { level, escalated, escalationReason, confidence, gapLogged: retrieval.gapLogged, ticketId } });

      const updatedSession = await this.loadSessionRow(client, actor.tenantId, sessionRow.id as string);
      const answer: CustomerQueryAnswer = {
        sessionId: sessionRow.id as string,
        questionMessageId: questionMessage.rows[0].id as string,
        answerMessageId,
        answer: answerText,
        queryLevel: level,
        confidenceScore: confidence,
        isGrounded,
        escalated,
        escalationReason,
        citations,
        relatedTicketId: ticketId ?? (updatedSession.related_ticket_id as string | null) ?? null,
        gapLogged: retrieval.gapLogged,
        retrieval: { accessibleSourceCount: retrieval.accessibleSourceCount, restrictedSourceCount: retrieval.restrictedSourceCount, strategy: retrieval.retrieval.strategy, deferred: retrieval.retrieval.deferred }
      };
      return { result: answer, session: this.mapSession(updatedSession) };
    });

    return result;
  }

  // -------------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------------

  async getSession(actor: ActorContext, sessionId: string): Promise<CustomerQuerySessionResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const sessionRow = await this.loadSessionRow(client, actor.tenantId, sessionId);
      this.assertSessionAccess(actor, sessionRow);
      return { session: await this.buildSessionDetail(client, actor.tenantId, sessionRow) };
    });
  }

  async listSessions(actor: ActorContext, query: CustomerQuerySessionListQuery): Promise<CustomerQuerySessionListResponse> {
    this.assertEnabled();
    this.requirePermission(actor, REVIEW_PERMISSIONS, "You do not have permission to review query sessions.");
    return this.databaseService.withClient(async (client) => {
      const page = Math.max(1, query.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
      const conditions = ["tenant_id = $1", "deleted_at IS NULL"];
      const params: unknown[] = [actor.tenantId];
      if (query.status) {
        params.push(query.status);
        conditions.push(`status = $${params.length}`);
      }
      if (query.channel) {
        params.push(query.channel);
        conditions.push(`channel = $${params.length}`);
      }
      if (query.escalated === "true") {
        conditions.push(`status = 'escalated'`);
      }
      if (query.search) {
        params.push(`%${query.search.toLowerCase()}%`);
        conditions.push(`LOWER(subject) LIKE $${params.length}`);
      }
      const whereClause = conditions.join(" AND ");
      const countResult = await client.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM customer_query_sessions WHERE ${whereClause}`, params);
      const total = Number(countResult.rows[0]?.total ?? "0");
      const listParams = [...params, pageSize, (page - 1) * pageSize];
      const listResult = await client.query(`SELECT * FROM customer_query_sessions WHERE ${whereClause} ORDER BY updated_at DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`, listParams);
      const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
      return {
        sessions: listResult.rows.map((row) => this.mapSession(row)),
        pagination: { page, pageSize, total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 }
      };
    });
  }

  async submitFeedback(actor: ActorContext, audit: AuditMetadata, sessionId: string, input: SubmitCustomerQueryFeedbackRequestBody): Promise<CustomerQuerySessionResponse> {
    this.assertEnabled();
    const session = await this.databaseService.withTransaction(async (client) => {
      const sessionRow = await this.loadSessionRow(client, actor.tenantId, sessionId);
      this.assertSessionAccess(actor, sessionRow);
      const target = input.messageId
        ? await client.query(`SELECT id, role FROM customer_query_messages WHERE id = $1 AND tenant_id = $2 AND session_id = $3 LIMIT 1`, [input.messageId, actor.tenantId, sessionId])
        : await client.query(`SELECT id, role FROM customer_query_messages WHERE tenant_id = $1 AND session_id = $2 AND role = 'assistant' ORDER BY created_at DESC LIMIT 1`, [actor.tenantId, sessionId]);
      const messageRow = target.rows[0];
      if (!messageRow || messageRow.role !== "assistant") {
        throw new AppError(404, "No assistant answer was found to provide feedback on.", undefined, "CUSTOMER_QUERY_MESSAGE_NOT_FOUND");
      }
      await client.query(`UPDATE customer_query_messages SET feedback = $3, feedback_note = $4 WHERE id = $1 AND tenant_id = $2`, [messageRow.id, actor.tenantId, input.feedback, (input.note ?? "").trim()]);
      await this.recordAuditLog(client, actor, audit, { action: "ai.customer_query.feedback", resourceType: "customer_query_session", resourceId: sessionId, metadata: { feedback: input.feedback, messageId: messageRow.id } });
      return this.buildSessionDetail(client, actor.tenantId, await this.loadSessionRow(client, actor.tenantId, sessionId));
    });
    return { session };
  }

  async createTicket(actor: ActorContext, audit: AuditMetadata, sessionId: string, note?: string): Promise<CustomerQuerySessionResponse> {
    this.assertEnabled();
    this.requirePermission(actor, ASK_PERMISSIONS, "You do not have permission to escalate this query to a ticket.");
    const session = await this.databaseService.withTransaction(async (client) => {
      const sessionRow = await this.loadSessionRow(client, actor.tenantId, sessionId);
      this.assertSessionAccess(actor, sessionRow);
      const description = `Customer-requested support ticket from query session.\n\nSubject: ${sessionRow.subject as string}\n\nNote: ${(note ?? "").trim()}`;
      const ticketId = await this.createSupportTicket(client, actor, `AI query: ${(sessionRow.subject as string) || "customer question"}`, description);
      if (!ticketId) {
        throw new AppError(409, "Support ticketing is not configured for this tenant.", undefined, "SUPPORT_TICKETING_UNAVAILABLE");
      }
      await client.query(
        `INSERT INTO customer_query_escalations (tenant_id, session_id, reason, level, related_ticket_id, notes, created_by, updated_by) VALUES ($1, $2, 'customer_request', $3, $4, $5, $6, $6)`,
        [actor.tenantId, sessionId, Number(sessionRow.escalation_level ?? 0), ticketId, (note ?? "Customer requested a support ticket.").trim(), actor.userId]
      );
      await client.query(`UPDATE customer_query_sessions SET status = 'escalated', related_ticket_id = $3, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [sessionId, actor.tenantId, ticketId, actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "ai.customer_query.ticket", resourceType: "customer_query_session", resourceId: sessionId, metadata: { ticketId } });
      return this.buildSessionDetail(client, actor.tenantId, await this.loadSessionRow(client, actor.tenantId, sessionId));
    });
    return { session };
  }

  async escalate(actor: ActorContext, audit: AuditMetadata, sessionId: string, input: EscalateCustomerQueryRequestBody): Promise<CustomerQueryEscalationResponse> {
    this.assertEnabled();
    const reason: CustomerQueryEscalationReason = customerQueryEscalationReasons.includes(input.reason as CustomerQueryEscalationReason) ? (input.reason as CustomerQueryEscalationReason) : "customer_request";
    return this.databaseService.withTransaction(async (client) => {
      const sessionRow = await this.loadSessionRow(client, actor.tenantId, sessionId);
      this.assertSessionAccess(actor, sessionRow);
      const inserted = await client.query(
        `INSERT INTO customer_query_escalations (tenant_id, session_id, reason, level, notes, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING *`,
        [actor.tenantId, sessionId, reason, Number(sessionRow.escalation_level ?? 0), (input.note ?? "").trim(), actor.userId]
      );
      await client.query(`UPDATE customer_query_sessions SET status = 'escalated', updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [sessionId, actor.tenantId, actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "ai.customer_query.escalate", resourceType: "customer_query_session", resourceId: sessionId, metadata: { reason } });
      const session = this.mapSession(await this.loadSessionRow(client, actor.tenantId, sessionId));
      return { escalation: this.mapEscalation(inserted.rows[0]), session };
    });
  }

  async resolveSession(actor: ActorContext, audit: AuditMetadata, sessionId: string, note?: string): Promise<CustomerQuerySessionResponse> {
    this.assertEnabled();
    this.requirePermission(actor, MANAGE_PERMISSIONS, "You do not have permission to resolve query sessions.");
    const session = await this.databaseService.withTransaction(async (client) => {
      await this.loadSessionRow(client, actor.tenantId, sessionId);
      await client.query(`UPDATE customer_query_sessions SET status = 'resolved', assigned_agent_id = $3, updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [sessionId, actor.tenantId, actor.userId]);
      await client.query(`UPDATE customer_query_escalations SET status = 'resolved', notes = CASE WHEN $4 = '' THEN notes ELSE $4 END, updated_by = $3 WHERE tenant_id = $1 AND session_id = $2 AND status <> 'resolved' AND deleted_at IS NULL`, [actor.tenantId, sessionId, actor.userId, (note ?? "").trim()]);
      await this.recordAuditLog(client, actor, audit, { action: "ai.customer_query.resolve", resourceType: "customer_query_session", resourceId: sessionId });
      return this.buildSessionDetail(client, actor.tenantId, await this.loadSessionRow(client, actor.tenantId, sessionId));
    });
    return { session };
  }

  // -------------------------------------------------------------------------
  // Dashboard + knowledge gaps
  // -------------------------------------------------------------------------

  async getDashboard(actor: ActorContext): Promise<CustomerQueryDashboardResponse> {
    this.assertEnabled();
    this.requirePermission(actor, REVIEW_PERMISSIONS, "You do not have permission to view the query dashboard.");
    return this.databaseService.withClient(async (client) => {
      const sessions = await client.query(`SELECT status, related_ticket_id FROM customer_query_sessions WHERE tenant_id = $1 AND deleted_at IS NULL`, [actor.tenantId]);
      const messages = await client.query(`SELECT role, query_level, is_grounded, confidence_score, feedback FROM customer_query_messages WHERE tenant_id = $1`, [actor.tenantId]);
      const escalations = await client.query(`SELECT reason, status FROM customer_query_escalations WHERE tenant_id = $1 AND deleted_at IS NULL`, [actor.tenantId]);

      const levelCounts = new Map<CustomerQueryLevel, number>();
      let totalQuestions = 0;
      let groundedAnswers = 0;
      let confidenceSum = 0;
      let confidenceCount = 0;
      let helpfulCount = 0;
      let notHelpfulCount = 0;
      for (const row of messages.rows) {
        if (row.role === "customer" && row.query_level !== null) {
          totalQuestions += 1;
          const level = Number(row.query_level) as CustomerQueryLevel;
          levelCounts.set(level, (levelCounts.get(level) ?? 0) + 1);
        }
        if (row.role === "assistant") {
          if (row.is_grounded) groundedAnswers += 1;
          if (row.confidence_score !== null) {
            confidenceSum += Number(row.confidence_score);
            confidenceCount += 1;
          }
          if (row.feedback === "helpful") helpfulCount += 1;
          if (row.feedback === "not_helpful") notHelpfulCount += 1;
        }
      }

      const reasonCounts = new Map<CustomerQueryEscalationReason, number>();
      let openEscalations = 0;
      for (const row of escalations.rows) {
        const reason = row.reason as CustomerQueryEscalationReason;
        reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
        if (row.status === "open") openEscalations += 1;
      }

      return {
        totalSessions: sessions.rows.length,
        activeSessions: sessions.rows.filter((row) => row.status === "active").length,
        escalatedSessions: sessions.rows.filter((row) => row.status === "escalated").length,
        resolvedSessions: sessions.rows.filter((row) => row.status === "resolved").length,
        totalQuestions,
        groundedAnswers,
        averageConfidence: confidenceCount === 0 ? 0 : Math.round((confidenceSum / confidenceCount) * 1000) / 1000,
        helpfulCount,
        notHelpfulCount,
        openEscalations,
        ticketsCreated: sessions.rows.filter((row) => row.related_ticket_id !== null).length,
        levelDistribution: [1, 2, 3].map((level) => ({ level: level as CustomerQueryLevel, count: levelCounts.get(level as CustomerQueryLevel) ?? 0 })),
        escalationReasonDistribution: Array.from(reasonCounts.entries()).map(([reason, count]) => ({ reason, count }))
      };
    });
  }

  async listKnowledgeGaps(actor: ActorContext, status?: string): Promise<CustomerQueryKnowledgeGapListResponse> {
    this.assertEnabled();
    this.requirePermission(actor, REVIEW_PERMISSIONS, "You do not have permission to view knowledge gaps.");
    return this.databaseService.withClient(async (client) => {
      const conditions = ["tenant_id = $1", "deleted_at IS NULL"];
      const params: unknown[] = [actor.tenantId];
      if (status) {
        params.push(status);
        conditions.push(`status = $${params.length}`);
      }
      const result = await client.query(`SELECT id, query_text, detected_source, status, resolution_note, occurrence_count, created_at, updated_at FROM knowledge_gaps WHERE ${conditions.join(" AND ")} ORDER BY updated_at DESC LIMIT 200`, params);
      return {
        gaps: result.rows.map((row) => ({
          id: row.id as string,
          queryText: row.query_text as string,
          detectedSource: row.detected_source as string,
          status: row.status as string,
          resolutionNote: row.resolution_note as string,
          occurrenceCount: Number(row.occurrence_count ?? 1),
          createdAt: (row.created_at as Date).toISOString(),
          updatedAt: (row.updated_at as Date).toISOString()
        }))
      };
    });
  }
}
