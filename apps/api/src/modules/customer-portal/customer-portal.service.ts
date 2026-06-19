import type {
  CreateCustomerPortalFeedbackRequestBody,
  CreateCustomerPortalTicketMessageRequestBody,
  CreateCustomerPortalTicketRequestBody,
  CustomerPortalAskAiCitation,
  CustomerPortalAskAiRequestBody,
  CustomerPortalAskAiResponse,
  CustomerPortalDashboardResponse,
  CustomerPortalFeedbackResponse,
  CustomerPortalKnowledgeArticleDetail,
  CustomerPortalKnowledgeArticleResponse,
  CustomerPortalKnowledgeArticleSummary,
  CustomerPortalKnowledgeListResponse,
  CustomerPortalProfileSummary,
  CustomerPortalTicketDetail,
  CustomerPortalTicketListResponse,
  CustomerPortalTicketResponse,
  CustomerPortalTicketSummary,
  CustomerPortalTrainingAssignmentDetail,
  CustomerPortalTrainingAssignmentResponse,
  CustomerPortalTrainingAssignmentSummary,
  CustomerPortalTrainingListResponse,
  RoleSummary,
  UpdateCustomerPortalProfileRequestBody,
  UpdateCustomerPortalTrainingProgressRequestBody
} from "@crm/types";
import type { PoolClient, QueryResultRow } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import { DatabaseService } from "../../platform/database/database.service.js";

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

interface CustomerPortalConfig {
  enableAuditLogs: boolean;
}

interface PortalProfileRow extends QueryResultRow {
  id: string;
  status: "active" | "inactive";
  portal_role: string;
  job_title: string | null;
  phone: string | null;
  preferences: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  user_display_name: string;
  user_email: string;
  account_id: string;
  account_name: string;
  account_website: string | null;
  account_industry: string | null;
  contact_id: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

interface TicketRow extends QueryResultRow {
  id: string;
  subject: string;
  description: string | null;
  status_key: string | null;
  status_label: string | null;
  status_color: string | null;
  priority_key: string | null;
  priority_label: string | null;
  priority_color: string | null;
  category_key: string | null;
  category_label: string | null;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
}

interface TicketMessageRow extends QueryResultRow {
  id: string;
  body: string;
  author_name: string | null;
  created_at: Date;
}

interface KnowledgeArticleRow extends QueryResultRow {
  id: string;
  title: string;
  summary: string;
  body: string;
  source_name: string | null;
  updated_at: Date;
}

interface TrainingAssignmentRow extends QueryResultRow {
  id: string;
  status: string;
  completion_percent: number;
  due_date: Date | string | null;
  updated_at: Date;
  program_id: string;
  program_title: string;
  program_description: string | null;
  estimated_minutes: number | null;
  learner_id: string | null;
}

interface TrainingLessonRow extends QueryResultRow {
  id: string;
  title: string;
  lesson_type: string;
  duration_minutes: number | null;
  content: string | null;
  progress_status: string | null;
  progress_percent: number | null;
  sort_order: number;
}

interface PortalProfileContext {
  profile: CustomerPortalProfileSummary;
  row: PortalProfileRow;
}

const PORTAL_READ_PERMISSIONS = ["customer_portal.view", "customer_portal.create", "customer_portal.edit", "customer_portal.use_ai"];
const PORTAL_CREATE_PERMISSIONS = ["customer_portal.create"];
const PORTAL_EDIT_PERMISSIONS = ["customer_portal.edit"];
const PORTAL_AI_PERMISSIONS = ["customer_portal.use_ai"];

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toDateOnly(value: Date | string | null) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function nullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

const CUSTOMER_AI_STOPWORDS = new Set([
  "about",
  "answer",
  "answers",
  "approved",
  "customer",
  "from",
  "help",
  "portal",
  "question",
  "that",
  "the",
  "this",
  "use",
  "what",
  "with"
]);

function tokenize(value: string) {
  return Array.from(new Set(value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []))
    .filter((token) => !CUSTOMER_AI_STOPWORDS.has(token))
    .slice(0, 10);
}

function scoreArticle(article: KnowledgeArticleRow, tokens: string[]) {
  const title = article.title.toLowerCase();
  const summary = article.summary.toLowerCase();
  const body = article.body.toLowerCase();

  return tokens.reduce((score, token) => {
    let nextScore = score;
    if (title.includes(token)) {
      nextScore += 5;
    }
    if (summary.includes(token)) {
      nextScore += 3;
    }
    if (body.includes(token)) {
      nextScore += 1;
    }
    return nextScore;
  }, 0);
}

function buildSnippet(article: KnowledgeArticleRow, tokens: string[]) {
  const content = `${article.summary}\n${article.body}`.replace(/\s+/g, " ").trim();
  const matchToken = tokens.find((token) => content.toLowerCase().includes(token));

  if (!matchToken) {
    return content.slice(0, 260);
  }

  const index = content.toLowerCase().indexOf(matchToken);
  const start = Math.max(0, index - 90);
  const end = Math.min(content.length, index + 210);
  return `${start > 0 ? "..." : ""}${content.slice(start, end)}${end < content.length ? "..." : ""}`;
}

function buildCustomerAnswer(citations: CustomerPortalAskAiCitation[]) {
  if (citations.length === 0) {
    return "I could not find an approved customer-visible answer for that question. Please create a support ticket so our team can help with the right context.";
  }

  const lines = citations.map((citation) => `- ${citation.title}: ${citation.snippet}`);
  return `Based on approved customer-visible knowledge:\n${lines.join("\n")}`;
}

export class CustomerPortalService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: CustomerPortalConfig
  ) {}

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "The customer portal is unavailable until the database connection is enabled.", undefined, "CUSTOMER_PORTAL_UNAVAILABLE");
    }
  }

  private requirePermission(actor: ActorContext, permissions: string[], message = "You do not have permission to access the customer portal.") {
    if (!permissions.some((code) => actor.permissionCodes.includes(code))) {
      throw new AppError(403, message, undefined, "AUTHORIZATION_ERROR");
    }
  }

  private async recordAuditLog(
    client: PoolClient,
    actor: ActorContext,
    audit: AuditMetadata,
    input: { action: string; resourceType: string; resourceId?: string | null; metadata?: Record<string, unknown> }
  ) {
    if (!this.config.enableAuditLogs) {
      return;
    }

    await client.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, session_id, event_type, action, resource_type, resource_id, status, ip_address, user_agent, request_id, metadata)
       VALUES ($1, $2, $3, 'customer_portal', $4, $5, $6, 'success', NULLIF($7, '')::inet, $8, $9, $10::jsonb)`,
      [
        actor.tenantId,
        actor.userId,
        actor.sessionId,
        input.action,
        input.resourceType,
        input.resourceId ?? null,
        audit.ipAddress ?? "",
        audit.userAgent ?? null,
        audit.requestId,
        JSON.stringify(input.metadata ?? {})
      ]
    );
  }

  private mapProfile(row: PortalProfileRow): CustomerPortalProfileSummary {
    return {
      id: row.id,
      status: row.status,
      portalRole: row.portal_role,
      displayName: row.user_display_name,
      email: row.user_email,
      jobTitle: row.job_title,
      phone: row.phone,
      account: {
        id: row.account_id,
        name: row.account_name,
        website: row.account_website,
        industry: row.account_industry
      },
      contact: row.contact_id
        ? {
            id: row.contact_id,
            firstName: row.contact_first_name ?? "",
            lastName: row.contact_last_name,
            email: row.contact_email,
            phone: row.contact_phone
          }
        : null,
      preferences: asRecord(row.preferences),
      metadata: asRecord(row.metadata),
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at)
    };
  }

  private async loadProfile(client: PoolClient, actor: ActorContext): Promise<PortalProfileContext> {
    const result = await client.query<PortalProfileRow>(
      `SELECT
         p.id, p.status, p.portal_role, p.job_title, p.phone, p.preferences, p.metadata, p.created_at, p.updated_at,
         u.display_name AS user_display_name, u.email AS user_email,
         a.id AS account_id, a.name AS account_name, a.website AS account_website, a.industry AS account_industry,
         c.id AS contact_id, c.first_name AS contact_first_name, c.last_name AS contact_last_name,
         c.email AS contact_email, c.phone AS contact_phone
       FROM customer_portal_profiles p
       INNER JOIN users u ON u.id = p.user_id AND u.tenant_id = p.tenant_id AND u.deleted_at IS NULL
       INNER JOIN accounts a ON a.id = p.account_id AND a.tenant_id = p.tenant_id AND a.deleted_at IS NULL
       LEFT JOIN contacts c ON c.id = p.contact_id AND c.tenant_id = p.tenant_id AND c.deleted_at IS NULL
       WHERE p.tenant_id = $1 AND p.user_id = $2 AND p.deleted_at IS NULL AND p.status = 'active'
       LIMIT 1`,
      [actor.tenantId, actor.userId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError(403, "A customer portal profile is required before this user can access the customer portal.", undefined, "CUSTOMER_PORTAL_PROFILE_REQUIRED");
    }

    return { row, profile: this.mapProfile(row) };
  }

  private mapTicket(row: TicketRow): CustomerPortalTicketSummary {
    return {
      id: row.id,
      subject: row.subject,
      description: row.description,
      status: {
        key: row.status_key,
        label: row.status_label,
        color: row.status_color
      },
      priority: {
        key: row.priority_key,
        label: row.priority_label,
        color: row.priority_color
      },
      category: {
        key: row.category_key,
        label: row.category_label
      },
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
      resolvedAt: row.resolved_at ? toIso(row.resolved_at) : null
    };
  }

  private mapTicketDetail(ticket: TicketRow, messages: TicketMessageRow[]): CustomerPortalTicketDetail {
    return {
      ...this.mapTicket(ticket),
      messages: messages.map((message) => ({
        id: message.id,
        body: message.body,
        authorName: message.author_name,
        createdAt: toIso(message.created_at)
      }))
    };
  }

  private ticketSelectClause() {
    return `
      t.id, t.subject, t.description, t.created_at, t.updated_at, t.resolved_at,
      status_values.value_key AS status_key, status_values.label AS status_label, status_values.color AS status_color,
      priority_values.value_key AS priority_key, priority_values.label AS priority_label, priority_values.color AS priority_color,
      category_values.value_key AS category_key, category_values.label AS category_label
    `;
  }

  private ticketFromClause() {
    return `
      FROM support_tickets t
      LEFT JOIN tenant_option_values status_values ON status_values.id = t.status_option_id AND status_values.tenant_id = t.tenant_id
      LEFT JOIN tenant_option_values priority_values ON priority_values.id = t.priority_option_id AND priority_values.tenant_id = t.tenant_id
      LEFT JOIN tenant_option_values category_values ON category_values.id = t.category_option_id AND category_values.tenant_id = t.tenant_id
    `;
  }

  private async getTicketRow(client: PoolClient, actor: ActorContext, profile: CustomerPortalProfileSummary, ticketId: string) {
    const result = await client.query<TicketRow>(
      `SELECT ${this.ticketSelectClause()}
       ${this.ticketFromClause()}
       WHERE t.id = $1 AND t.tenant_id = $2 AND t.account_id = $3 AND t.deleted_at IS NULL
       LIMIT 1`,
      [ticketId, actor.tenantId, profile.account.id]
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, "Ticket was not found for this customer account.", undefined, "CUSTOMER_PORTAL_TICKET_NOT_FOUND");
    }

    return row;
  }

  private async resolveOptionValueId(client: PoolClient, tenantId: string, setKey: string, key: string) {
    const result = await client.query<{ id: string }>(
      `SELECT v.id
       FROM tenant_option_values v
       INNER JOIN tenant_option_sets s ON s.id = v.option_set_id AND s.tenant_id = v.tenant_id
       WHERE s.tenant_id = $1 AND s.set_key = $2 AND v.value_key = $3 AND s.deleted_at IS NULL AND v.deleted_at IS NULL AND v.is_active = TRUE
       LIMIT 1`,
      [tenantId, setKey, key]
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError(400, `Invalid ${setKey} option: ${key}.`, undefined, "CUSTOMER_PORTAL_INVALID_OPTION");
    }

    return row.id;
  }

  private mapKnowledgeArticle(row: KnowledgeArticleRow): CustomerPortalKnowledgeArticleSummary {
    return {
      id: row.id,
      title: row.title,
      summary: row.summary || null,
      sourceName: row.source_name,
      updatedAt: toIso(row.updated_at)
    };
  }

  private mapKnowledgeArticleDetail(row: KnowledgeArticleRow): CustomerPortalKnowledgeArticleDetail {
    return {
      ...this.mapKnowledgeArticle(row),
      body: row.body || null
    };
  }

  private knowledgeVisibilityWhere() {
    return `
      a.tenant_id = $1
      AND a.deleted_at IS NULL
      AND a.status = 'approved'
      AND a.is_published = TRUE
      AND s.id IS NOT NULL
      AND s.deleted_at IS NULL
      AND s.is_enabled = TRUE
      AND s.access_scope = 'tenant'
      AND s.required_permission IS NULL
    `;
  }

  private async listVisibleKnowledgeRows(client: PoolClient, tenantId: string, search?: string) {
    const params: unknown[] = [tenantId];
    let searchClause = "";

    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      searchClause = `AND (a.title ILIKE $${params.length} OR a.summary ILIKE $${params.length} OR a.body ILIKE $${params.length})`;
    }

    const result = await client.query<KnowledgeArticleRow>(
      `SELECT a.id, a.title, a.summary, a.body, s.name AS source_name, a.updated_at
       FROM knowledge_articles a
       INNER JOIN knowledge_sources s ON s.id = a.source_id AND s.tenant_id = a.tenant_id
       WHERE ${this.knowledgeVisibilityWhere()} ${searchClause}
       ORDER BY a.updated_at DESC
       LIMIT 100`,
      params
    );

    return result.rows;
  }

  private mapTrainingAssignment(row: TrainingAssignmentRow): CustomerPortalTrainingAssignmentSummary {
    return {
      id: row.id,
      status: row.status,
      completionPercent: Number(row.completion_percent ?? 0),
      dueDate: toDateOnly(row.due_date),
      program: {
        id: row.program_id,
        title: row.program_title,
        description: row.program_description,
        estimatedMinutes: row.estimated_minutes === null ? null : Number(row.estimated_minutes)
      },
      updatedAt: toIso(row.updated_at)
    };
  }

  private trainingAssignmentSelectClause() {
    return `
      ta.id, ta.status, ta.completion_percent, ta.due_date, ta.updated_at, ta.learner_id,
      p.id AS program_id, p.title AS program_title, p.description AS program_description, p.estimated_minutes
    `;
  }

  private trainingAssignmentFromClause() {
    return `
      FROM training_assignments ta
      INNER JOIN training_programs p ON p.id = ta.program_id AND p.tenant_id = ta.tenant_id
      LEFT JOIN customer_learners cl ON cl.id = ta.learner_id AND cl.tenant_id = ta.tenant_id AND cl.deleted_at IS NULL
    `;
  }

  private trainingAssignmentVisibilityWhere() {
    return `
      ta.tenant_id = $1
      AND ta.deleted_at IS NULL
      AND p.deleted_at IS NULL
      AND p.status = 'published'
      AND (
        ta.user_id = $2
        OR ($3::uuid IS NOT NULL AND ta.contact_id = $3::uuid)
        OR ta.account_id = $4
        OR (
          ta.learner_id IS NOT NULL
          AND (
            cl.user_id = $2
            OR ($3::uuid IS NOT NULL AND cl.contact_id = $3::uuid)
            OR cl.account_id = $4
          )
        )
      )
    `;
  }

  private async getTrainingAssignmentRow(
    client: PoolClient,
    actor: ActorContext,
    profile: CustomerPortalProfileSummary,
    assignmentId: string
  ) {
    const result = await client.query<TrainingAssignmentRow>(
      `SELECT ${this.trainingAssignmentSelectClause()}
       ${this.trainingAssignmentFromClause()}
       WHERE ${this.trainingAssignmentVisibilityWhere()} AND ta.id = $5
       LIMIT 1`,
      [actor.tenantId, actor.userId, profile.contact?.id ?? null, profile.account.id, assignmentId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, "Training assignment was not found for this customer profile.", undefined, "CUSTOMER_PORTAL_TRAINING_NOT_FOUND");
    }

    return row;
  }

  async getProfile(actor: ActorContext) {
    this.assertEnabled();
    this.requirePermission(actor, PORTAL_READ_PERMISSIONS);

    return this.databaseService.withClient(async (client) => {
      const { profile } = await this.loadProfile(client, actor);
      return { profile };
    });
  }

  async updateProfile(actor: ActorContext, audit: AuditMetadata, input: UpdateCustomerPortalProfileRequestBody) {
    this.assertEnabled();
    this.requirePermission(actor, PORTAL_EDIT_PERMISSIONS, "You do not have permission to update your customer portal profile.");

    return this.databaseService.withTransaction(async (client) => {
      const { profile } = await this.loadProfile(client, actor);
      const updates: string[] = [];
      const params: unknown[] = [profile.id, actor.tenantId, actor.userId];

      if (Object.prototype.hasOwnProperty.call(input, "jobTitle")) {
        params.push(nullableText(input.jobTitle));
        updates.push(`job_title = $${params.length}`);
      }
      if (Object.prototype.hasOwnProperty.call(input, "phone")) {
        params.push(nullableText(input.phone));
        updates.push(`phone = $${params.length}`);
      }
      if (Object.prototype.hasOwnProperty.call(input, "preferences")) {
        params.push(JSON.stringify(input.preferences ?? {}));
        updates.push(`preferences = $${params.length}::jsonb`);
      }

      if (updates.length > 0) {
        await client.query(
          `UPDATE customer_portal_profiles SET ${updates.join(", ")}, updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          params
        );
        await this.recordAuditLog(client, actor, audit, { action: "customer_portal.profile.update", resourceType: "customer_portal_profile", resourceId: profile.id });
      }

      const refreshed = await this.loadProfile(client, actor);
      return { profile: refreshed.profile };
    });
  }

  async getDashboard(actor: ActorContext): Promise<CustomerPortalDashboardResponse> {
    this.assertEnabled();
    this.requirePermission(actor, PORTAL_READ_PERMISSIONS);

    return this.databaseService.withClient(async (client) => {
      const { profile } = await this.loadProfile(client, actor);
      const ticketCounts = await client.query<{ open_count: number; resolved_count: number }>(
        `SELECT
           COUNT(*) FILTER (WHERE COALESCE(status_values.value_key, '') NOT IN ('resolved', 'closed'))::int AS open_count,
           COUNT(*) FILTER (WHERE COALESCE(status_values.value_key, '') IN ('resolved', 'closed'))::int AS resolved_count
         FROM support_tickets t
         LEFT JOIN tenant_option_values status_values ON status_values.id = t.status_option_id AND status_values.tenant_id = t.tenant_id
         WHERE t.tenant_id = $1 AND t.account_id = $2 AND t.deleted_at IS NULL`,
        [actor.tenantId, profile.account.id]
      );
      const trainingCounts = await client.query<{ assigned_count: number; completed_count: number }>(
        `SELECT
           COUNT(*)::int AS assigned_count,
           COUNT(*) FILTER (WHERE ta.status = 'completed')::int AS completed_count
         ${this.trainingAssignmentFromClause()}
         WHERE ${this.trainingAssignmentVisibilityWhere()}`,
        [actor.tenantId, actor.userId, profile.contact?.id ?? null, profile.account.id]
      );
      const knowledgeCount = await client.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count
         FROM knowledge_articles a
         INNER JOIN knowledge_sources s ON s.id = a.source_id AND s.tenant_id = a.tenant_id
         WHERE ${this.knowledgeVisibilityWhere()}`,
        [actor.tenantId]
      );
      const sessionCount = await client.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count
         FROM customer_query_sessions
         WHERE tenant_id = $1 AND customer_user_id = $2 AND deleted_at IS NULL AND status IN ('active', 'escalated')`,
        [actor.tenantId, actor.userId]
      );

      return {
        profile,
        metrics: {
          openTicketCount: Number(ticketCounts.rows[0]?.open_count ?? 0),
          resolvedTicketCount: Number(ticketCounts.rows[0]?.resolved_count ?? 0),
          trainingAssignedCount: Number(trainingCounts.rows[0]?.assigned_count ?? 0),
          trainingCompletedCount: Number(trainingCounts.rows[0]?.completed_count ?? 0),
          knowledgeArticleCount: Number(knowledgeCount.rows[0]?.count ?? 0),
          activeAiSessionCount: Number(sessionCount.rows[0]?.count ?? 0)
        },
        placeholders: {
          productAnnouncements: [
            {
              title: "Product announcements",
              description: "Release notes and account-specific announcements will appear here in a future phase.",
              status: "placeholder"
            }
          ],
          feedback: {
            csatEnabled: true,
            message: "Share quick CSAT or portal feedback from your profile page."
          }
        }
      };
    });
  }

  async listTickets(actor: ActorContext): Promise<CustomerPortalTicketListResponse> {
    this.assertEnabled();
    this.requirePermission(actor, PORTAL_READ_PERMISSIONS);

    return this.databaseService.withClient(async (client) => {
      const { profile } = await this.loadProfile(client, actor);
      const result = await client.query<TicketRow>(
        `SELECT ${this.ticketSelectClause()}
         ${this.ticketFromClause()}
         WHERE t.tenant_id = $1 AND t.account_id = $2 AND t.deleted_at IS NULL
         ORDER BY t.updated_at DESC
         LIMIT 100`,
        [actor.tenantId, profile.account.id]
      );

      return { tickets: result.rows.map((row) => this.mapTicket(row)) };
    });
  }

  async getTicket(actor: ActorContext, ticketId: string): Promise<CustomerPortalTicketResponse> {
    this.assertEnabled();
    this.requirePermission(actor, PORTAL_READ_PERMISSIONS);

    return this.databaseService.withClient(async (client) => {
      const { profile } = await this.loadProfile(client, actor);
      const ticket = await this.getTicketRow(client, actor, profile, ticketId);
      const messages = await client.query<TicketMessageRow>(
        `SELECT m.id, m.body, COALESCE(u.display_name, 'Customer') AS author_name, m.created_at
         FROM support_ticket_messages m
         LEFT JOIN users u ON u.id = m.author_id AND u.tenant_id = m.tenant_id AND u.deleted_at IS NULL
         WHERE m.tenant_id = $1 AND m.ticket_id = $2 AND m.deleted_at IS NULL AND m.message_type = 'customer_reply'
         ORDER BY m.created_at ASC`,
        [actor.tenantId, ticketId]
      );

      return { ticket: this.mapTicketDetail(ticket, messages.rows) };
    });
  }

  async createTicket(actor: ActorContext, audit: AuditMetadata, input: CreateCustomerPortalTicketRequestBody): Promise<CustomerPortalTicketResponse> {
    this.assertEnabled();
    this.requirePermission(actor, PORTAL_CREATE_PERMISSIONS, "You do not have permission to create customer portal tickets.");

    return this.databaseService.withTransaction(async (client) => {
      const { profile } = await this.loadProfile(client, actor);
      const [statusId, priorityId, categoryId, sourceId] = await Promise.all([
        this.resolveOptionValueId(client, actor.tenantId, "support-ticket-status", "new"),
        this.resolveOptionValueId(client, actor.tenantId, "support-ticket-priority", input.priorityKey ?? "medium"),
        this.resolveOptionValueId(client, actor.tenantId, "support-ticket-category", input.categoryKey ?? "technical"),
        this.resolveOptionValueId(client, actor.tenantId, "support-ticket-source", "portal")
      ]);
      const metadata = {
        ...(input.metadata ?? {}),
        origin: "customer_portal",
        profileId: profile.id
      };
      const result = await client.query<{ id: string }>(
        `INSERT INTO support_tickets (
           tenant_id, account_id, contact_id, subject, description, status_option_id, priority_option_id,
           category_option_id, source_option_id, metadata, created_by, updated_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $11)
         RETURNING id`,
        [
          actor.tenantId,
          profile.account.id,
          profile.contact?.id ?? null,
          input.subject.trim(),
          nullableText(input.description),
          statusId,
          priorityId,
          categoryId,
          sourceId,
          JSON.stringify(metadata),
          actor.userId
        ]
      );
      const ticketId = result.rows[0]!.id;
      await this.recordAuditLog(client, actor, audit, { action: "customer_portal.ticket.create", resourceType: "support_ticket", resourceId: ticketId, metadata: { accountId: profile.account.id } });
      const ticket = await this.getTicketRow(client, actor, profile, ticketId);
      return { ticket: this.mapTicketDetail(ticket, []) };
    });
  }

  async addTicketMessage(
    actor: ActorContext,
    audit: AuditMetadata,
    ticketId: string,
    input: CreateCustomerPortalTicketMessageRequestBody
  ): Promise<CustomerPortalTicketResponse> {
    this.assertEnabled();
    this.requirePermission(actor, PORTAL_CREATE_PERMISSIONS, "You do not have permission to add ticket replies.");

    return this.databaseService.withTransaction(async (client) => {
      const { profile } = await this.loadProfile(client, actor);
      await this.getTicketRow(client, actor, profile, ticketId);
      const result = await client.query<{ id: string }>(
        `INSERT INTO support_ticket_messages (tenant_id, ticket_id, author_id, message_type, body, metadata, created_by, updated_by)
         VALUES ($1, $2, $3, 'customer_reply', $4, $5::jsonb, $3, $3)
         RETURNING id`,
        [
          actor.tenantId,
          ticketId,
          actor.userId,
          input.body.trim(),
          JSON.stringify({ ...(input.metadata ?? {}), origin: "customer_portal", profileId: profile.id })
        ]
      );
      await client.query(`UPDATE support_tickets SET updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [ticketId, actor.tenantId, actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "customer_portal.ticket.reply", resourceType: "support_ticket_message", resourceId: result.rows[0]?.id, metadata: { ticketId } });
      const ticket = await this.getTicketRow(client, actor, profile, ticketId);
      const messages = await client.query<TicketMessageRow>(
        `SELECT m.id, m.body, COALESCE(u.display_name, 'Customer') AS author_name, m.created_at
         FROM support_ticket_messages m
         LEFT JOIN users u ON u.id = m.author_id AND u.tenant_id = m.tenant_id AND u.deleted_at IS NULL
         WHERE m.tenant_id = $1 AND m.ticket_id = $2 AND m.deleted_at IS NULL AND m.message_type = 'customer_reply'
         ORDER BY m.created_at ASC`,
        [actor.tenantId, ticketId]
      );
      return { ticket: this.mapTicketDetail(ticket, messages.rows) };
    });
  }

  async listKnowledgeArticles(actor: ActorContext, search?: string): Promise<CustomerPortalKnowledgeListResponse> {
    this.assertEnabled();
    this.requirePermission(actor, PORTAL_READ_PERMISSIONS);

    return this.databaseService.withClient(async (client) => {
      await this.loadProfile(client, actor);
      const rows = await this.listVisibleKnowledgeRows(client, actor.tenantId, search);
      return { articles: rows.map((row) => this.mapKnowledgeArticle(row)) };
    });
  }

  async getKnowledgeArticle(actor: ActorContext, articleId: string): Promise<CustomerPortalKnowledgeArticleResponse> {
    this.assertEnabled();
    this.requirePermission(actor, PORTAL_READ_PERMISSIONS);

    return this.databaseService.withClient(async (client) => {
      await this.loadProfile(client, actor);
      const result = await client.query<KnowledgeArticleRow>(
        `SELECT a.id, a.title, a.summary, a.body, s.name AS source_name, a.updated_at
         FROM knowledge_articles a
         INNER JOIN knowledge_sources s ON s.id = a.source_id AND s.tenant_id = a.tenant_id
         WHERE ${this.knowledgeVisibilityWhere()} AND a.id = $2
         LIMIT 1`,
        [actor.tenantId, articleId]
      );
      const row = result.rows[0];
      if (!row) {
        throw new AppError(404, "Knowledge article was not found in the customer-visible knowledge base.", undefined, "CUSTOMER_PORTAL_KNOWLEDGE_NOT_FOUND");
      }

      return { article: this.mapKnowledgeArticleDetail(row) };
    });
  }

  async askAi(actor: ActorContext, audit: AuditMetadata, input: CustomerPortalAskAiRequestBody): Promise<CustomerPortalAskAiResponse> {
    this.assertEnabled();
    this.requirePermission(actor, PORTAL_AI_PERMISSIONS, "You do not have permission to use customer portal AI.");

    return this.databaseService.withTransaction(async (client) => {
      const { profile } = await this.loadProfile(client, actor);
      const tokens = tokenize(input.question);
      const rows = await this.listVisibleKnowledgeRows(client, actor.tenantId);
      const citations = rows
        .map((row) => ({
          row,
          score: scoreArticle(row, tokens)
        }))
        .filter((candidate) => candidate.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 4)
        .map<CustomerPortalAskAiCitation>(({ row }) => ({
          articleId: row.id,
          title: row.title,
          snippet: buildSnippet(row, tokens)
        }));
      const escalated = citations.length === 0;
      const confidence = citations.length === 0 ? 0 : Math.min(0.95, 0.45 + citations.length * 0.15);
      const answer = buildCustomerAnswer(citations);
      const sessionResult = await client.query<{ id: string }>(
        `INSERT INTO customer_query_sessions (
           tenant_id, subject, channel, status, escalation_level, last_confidence, message_count,
           customer_user_id, metadata, created_by, updated_by
         )
         VALUES ($1, $2, 'customer_portal', $3, $4, $5, 2, $6, $7::jsonb, $6, $6)
         RETURNING id`,
        [
          actor.tenantId,
          input.question.trim().slice(0, 180),
          escalated ? "escalated" : "active",
          escalated ? 2 : 1,
          confidence,
          actor.userId,
          JSON.stringify({ profileId: profile.id, accountId: profile.account.id, customerPortal: true })
        ]
      );
      const sessionId = sessionResult.rows[0]!.id;
      await client.query(
        `INSERT INTO customer_query_messages (tenant_id, session_id, role, content, query_level, confidence_score, is_grounded, escalated, citations, retrieval_metadata, created_by)
         VALUES
         ($1, $2, 'customer', $3, $4, NULL, FALSE, FALSE, '[]'::jsonb, $5::jsonb, $6),
         ($1, $2, 'assistant', $7, $4, $8, $9, $10, $11::jsonb, $5::jsonb, $6)`,
        [
          actor.tenantId,
          sessionId,
          input.question.trim(),
          escalated ? 2 : 1,
          JSON.stringify({ source: "customer_portal", approvedCustomerVisibleOnly: true }),
          actor.userId,
          answer,
          confidence,
          citations.length > 0,
          escalated,
          JSON.stringify(citations)
        ]
      );

      if (escalated) {
        await client.query(
          `INSERT INTO customer_query_escalations (tenant_id, session_id, reason, level, status, notes, metadata, created_by, updated_by)
           VALUES ($1, $2, 'no_answer', 2, 'open', $3, $4::jsonb, $5, $5)`,
          [
            actor.tenantId,
            sessionId,
            "Customer portal AI did not find an approved customer-visible answer.",
            JSON.stringify({ profileId: profile.id, accountId: profile.account.id }),
            actor.userId
          ]
        );
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "customer_portal.ask_ai",
        resourceType: "customer_query_session",
        resourceId: sessionId,
        metadata: { citationCount: citations.length, escalated, approvedCustomerVisibleOnly: true }
      });

      return { sessionId, answer, citations, escalated, relatedTicketId: null };
    });
  }

  async listTraining(actor: ActorContext): Promise<CustomerPortalTrainingListResponse> {
    this.assertEnabled();
    this.requirePermission(actor, PORTAL_READ_PERMISSIONS);

    return this.databaseService.withClient(async (client) => {
      const { profile } = await this.loadProfile(client, actor);
      const result = await client.query<TrainingAssignmentRow>(
        `SELECT ${this.trainingAssignmentSelectClause()}
         ${this.trainingAssignmentFromClause()}
         WHERE ${this.trainingAssignmentVisibilityWhere()}
         ORDER BY ta.updated_at DESC
         LIMIT 100`,
        [actor.tenantId, actor.userId, profile.contact?.id ?? null, profile.account.id]
      );

      return { assignments: result.rows.map((row) => this.mapTrainingAssignment(row)) };
    });
  }

  async getTrainingAssignment(actor: ActorContext, assignmentId: string): Promise<CustomerPortalTrainingAssignmentResponse> {
    this.assertEnabled();
    this.requirePermission(actor, PORTAL_READ_PERMISSIONS);

    return this.databaseService.withClient(async (client) => {
      const { profile } = await this.loadProfile(client, actor);
      const assignment = await this.getTrainingAssignmentRow(client, actor, profile, assignmentId);
      const lessons = await client.query<TrainingLessonRow>(
        `SELECT l.id, l.title, l.lesson_type, l.duration_minutes, l.content, l.sort_order,
           progress.status AS progress_status, COALESCE(progress.progress_percent, 0)::int AS progress_percent
         FROM training_lessons l
         LEFT JOIN training_progress progress
           ON progress.lesson_id = l.id
          AND progress.assignment_id = $1
          AND progress.tenant_id = l.tenant_id
          AND progress.deleted_at IS NULL
         WHERE l.tenant_id = $2 AND l.program_id = $3 AND l.deleted_at IS NULL
         ORDER BY l.sort_order ASC, l.created_at ASC`,
        [assignmentId, actor.tenantId, assignment.program_id]
      );
      const detail: CustomerPortalTrainingAssignmentDetail = {
        ...this.mapTrainingAssignment(assignment),
        lessons: lessons.rows.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          lessonType: lesson.lesson_type,
          durationMinutes: lesson.duration_minutes,
          content: lesson.content,
          progressStatus: lesson.progress_status,
          progressPercent: Number(lesson.progress_percent ?? 0),
          sortOrder: Number(lesson.sort_order ?? 0)
        }))
      };

      return { assignment: detail };
    });
  }

  async updateTrainingProgress(
    actor: ActorContext,
    audit: AuditMetadata,
    assignmentId: string,
    input: UpdateCustomerPortalTrainingProgressRequestBody
  ): Promise<CustomerPortalTrainingAssignmentResponse> {
    this.assertEnabled();
    this.requirePermission(actor, PORTAL_EDIT_PERMISSIONS, "You do not have permission to update training progress.");

    return this.databaseService.withTransaction(async (client) => {
      const { profile } = await this.loadProfile(client, actor);
      const assignment = await this.getTrainingAssignmentRow(client, actor, profile, assignmentId);
      const lessonResult = await client.query<{ id: string }>(
        `SELECT id FROM training_lessons WHERE id = $1 AND tenant_id = $2 AND program_id = $3 AND deleted_at IS NULL LIMIT 1`,
        [input.lessonId, actor.tenantId, assignment.program_id]
      );

      if (!lessonResult.rows[0]) {
        throw new AppError(404, "Training lesson was not found for this assignment.", undefined, "CUSTOMER_PORTAL_LESSON_NOT_FOUND");
      }

      const progressPercent = Math.max(0, Math.min(100, Number(input.progressPercent ?? (input.status === "completed" ? 100 : 0))));
      const status = input.status ?? (progressPercent >= 100 ? "completed" : progressPercent > 0 ? "in_progress" : "not_started");
      await client.query(
        `INSERT INTO training_progress (
           tenant_id, assignment_id, lesson_id, learner_id, status, progress_percent,
           started_at, completed_at, metadata, created_by, updated_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $5 IN ('in_progress', 'completed') THEN NOW() ELSE NULL END,
           CASE WHEN $5 = 'completed' THEN NOW() ELSE NULL END, $7::jsonb, $8, $8)
         ON CONFLICT (assignment_id, lesson_id) WHERE deleted_at IS NULL DO UPDATE SET
           status = EXCLUDED.status,
           progress_percent = EXCLUDED.progress_percent,
           started_at = COALESCE(training_progress.started_at, EXCLUDED.started_at),
           completed_at = CASE WHEN EXCLUDED.status = 'completed' THEN NOW() ELSE NULL END,
           metadata = EXCLUDED.metadata,
           updated_by = EXCLUDED.updated_by`,
        [
          actor.tenantId,
          assignmentId,
          input.lessonId,
          assignment.learner_id,
          status,
          progressPercent,
          JSON.stringify({ ...(input.metadata ?? {}), origin: "customer_portal", profileId: profile.id }),
          actor.userId
        ]
      );

      const completionResult = await client.query<{ total_count: number; completed_count: number }>(
        `SELECT
           COUNT(*)::int AS total_count,
           COUNT(progress.id) FILTER (WHERE progress.status = 'completed')::int AS completed_count
         FROM training_lessons lessons
         LEFT JOIN training_progress progress
           ON progress.lesson_id = lessons.id
          AND progress.assignment_id = $1
          AND progress.tenant_id = lessons.tenant_id
          AND progress.deleted_at IS NULL
         WHERE lessons.tenant_id = $2 AND lessons.program_id = $3 AND lessons.deleted_at IS NULL`,
        [assignmentId, actor.tenantId, assignment.program_id]
      );
      const total = Number(completionResult.rows[0]?.total_count ?? 0);
      const completed = Number(completionResult.rows[0]?.completed_count ?? 0);
      const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
      const assignmentStatus = completionPercent >= 100 ? "completed" : completionPercent > 0 ? "in_progress" : "assigned";
      await client.query(
        `UPDATE training_assignments
         SET completion_percent = $4, status = $5, completed_at = CASE WHEN $5 = 'completed' THEN NOW() ELSE NULL END, updated_by = $3
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [assignmentId, actor.tenantId, actor.userId, completionPercent, assignmentStatus]
      );
      await this.recordAuditLog(client, actor, audit, {
        action: "customer_portal.training.progress",
        resourceType: "training_assignment",
        resourceId: assignmentId,
        metadata: { lessonId: input.lessonId, completionPercent }
      });

      const refreshedAssignment = await this.getTrainingAssignmentRow(client, actor, profile, assignmentId);
      const lessons = await client.query<TrainingLessonRow>(
        `SELECT l.id, l.title, l.lesson_type, l.duration_minutes, l.content, l.sort_order,
           progress.status AS progress_status, COALESCE(progress.progress_percent, 0)::int AS progress_percent
         FROM training_lessons l
         LEFT JOIN training_progress progress
           ON progress.lesson_id = l.id
          AND progress.assignment_id = $1
          AND progress.tenant_id = l.tenant_id
          AND progress.deleted_at IS NULL
         WHERE l.tenant_id = $2 AND l.program_id = $3 AND l.deleted_at IS NULL
         ORDER BY l.sort_order ASC, l.created_at ASC`,
        [assignmentId, actor.tenantId, refreshedAssignment.program_id]
      );
      return {
        assignment: {
          ...this.mapTrainingAssignment(refreshedAssignment),
          lessons: lessons.rows.map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            lessonType: lesson.lesson_type,
            durationMinutes: lesson.duration_minutes,
            content: lesson.content,
            progressStatus: lesson.progress_status,
            progressPercent: Number(lesson.progress_percent ?? 0),
            sortOrder: Number(lesson.sort_order ?? 0)
          }))
        }
      };
    });
  }

  async createFeedback(actor: ActorContext, audit: AuditMetadata, input: CreateCustomerPortalFeedbackRequestBody): Promise<CustomerPortalFeedbackResponse> {
    this.assertEnabled();
    this.requirePermission(actor, PORTAL_EDIT_PERMISSIONS, "You do not have permission to submit customer portal feedback.");

    return this.databaseService.withTransaction(async (client) => {
      const { profile } = await this.loadProfile(client, actor);
      const result = await client.query<{ id: string; feedback_type: "csat" | "product_feedback" | "portal_feedback"; rating: number | null; comment: string | null; created_at: Date }>(
        `INSERT INTO customer_feedback (
           tenant_id, profile_id, account_id, feedback_type, rating, comment, related_entity_type,
           related_entity_id, metadata, created_by, updated_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $10)
         RETURNING id, feedback_type, rating, comment, created_at`,
        [
          actor.tenantId,
          profile.id,
          profile.account.id,
          input.feedbackType ?? "csat",
          input.rating ?? null,
          nullableText(input.comment),
          nullableText(input.relatedEntityType),
          input.relatedEntityId ?? null,
          JSON.stringify(input.metadata ?? {}),
          actor.userId
        ]
      );
      const row = result.rows[0]!;
      await this.recordAuditLog(client, actor, audit, { action: "customer_portal.feedback.create", resourceType: "customer_feedback", resourceId: row.id, metadata: { feedbackType: row.feedback_type, rating: row.rating } });

      return {
        feedback: {
          id: row.id,
          feedbackType: row.feedback_type,
          rating: row.rating === null ? null : Number(row.rating),
          comment: row.comment,
          createdAt: toIso(row.created_at)
        }
      };
    });
  }
}
