import type {
  AddPortalCollaborationRequestBody,
  CrmLookupUserSummary,
  CrmOptionValueSummary,
  PartnerPortalDeal,
  PartnerPortalDealResponse,
  PartnerPortalDealsResponse,
  PartnerPortalSessionResponse,
  PortalCommissionResponse,
  RaiseCommissionQueryRequestBody,
  RegisterPortalDealRequestBody,
  RegisterPortalDealResponse,
  RespondPortalCollaborationRequestBody,
  RoleSummary
} from "@crm/types";
import { partnerCollaborationTypes, resolveCommissionStatus } from "@crm/types";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { NotificationService } from "../notifications/notifications.service.js";

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

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function str(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}
function trimmed(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const next = value.trim();
  return next.length > 0 ? next : null;
}
function num(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function mapStoredUser(value: unknown): CrmLookupUserSummary | null {
  const record = getRecord(value);
  const id = typeof record.id === "string" ? record.id : null;
  if (!id) {
    return null;
  }
  return { id, displayName: typeof record.displayName === "string" ? record.displayName : "", email: typeof record.email === "string" ? record.email : "", teamName: null, departmentName: null };
}

interface PortalDealRow {
  id: string;
  partner_id: string;
  partner_name: string | null;
  partner_owner_id: string | null;
  partner_portal_users: unknown;
  opportunity_id: string | null;
  account_id: string | null;
  name: string;
  customer_name: string | null;
  amount: string | number | null;
  expected_close_date: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  stage_id: string | null;
  stage_key: string | null;
  stage_label: string | null;
  stage_color: string | null;
  stage_is_default: boolean | null;
  stage_is_active: boolean | null;
}

export class PartnerPortalService {
  private readonly notificationService: NotificationService;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {
    this.notificationService = new NotificationService(databaseService, config);
  }

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "The partner portal is unavailable until the database connection is enabled.", undefined, "PARTNER_PORTAL_UNAVAILABLE");
    }
  }

  private async recordAuditLog(client: PoolClient, actor: ActorContext, audit: AuditMetadata, input: { action: string; resourceType: string; resourceId: string; status: "success" | "failure"; metadata?: Record<string, unknown> }) {
    if (!this.config.enableAuditLogs) {
      return;
    }
    await client.query(
      `
        INSERT INTO audit_logs (tenant_id, actor_user_id, session_id, event_type, action, resource_type, resource_id, status, ip_address, user_agent, request_id, metadata)
        VALUES ($1, $2, $3, 'crm', $4, $5, $6, $7, NULLIF($8, '')::inet, $9, $10, $11::jsonb)
      `,
      [actor.tenantId, actor.userId, actor.sessionId, input.action, input.resourceType, input.resourceId, input.status, audit.ipAddress ?? "", audit.userAgent ?? null, audit.requestId, JSON.stringify(input.metadata ?? {})]
    );
  }

  private async accessiblePartners(client: PoolClient, actor: ActorContext) {
    const result = await client.query<{ id: string; name: string; owner_id: string | null; portal_users: unknown; status_id: string | null; status_key: string | null; status_label: string | null; status_color: string | null; status_is_default: boolean | null; status_is_active: boolean | null; tier_id: string | null; tier_key: string | null; tier_label: string | null; tier_color: string | null; tier_is_default: boolean | null; tier_is_active: boolean | null }>(
      `
        SELECT p.id, p.name, p.owner_id, p.metadata->'portalUserIds' AS portal_users,
          sv.id AS status_id, sv.value_key AS status_key, sv.label AS status_label, sv.color AS status_color, sv.is_default AS status_is_default, sv.is_active AS status_is_active,
          tv.id AS tier_id, tv.value_key AS tier_key, tv.label AS tier_label, tv.color AS tier_color, tv.is_default AS tier_is_default, tv.is_active AS tier_is_active
        FROM partners p
        LEFT JOIN tenant_option_values sv ON sv.id = p.status_option_id AND sv.tenant_id = p.tenant_id
        LEFT JOIN tenant_option_values tv ON tv.id = p.tier_option_id AND tv.tenant_id = p.tenant_id
        WHERE p.tenant_id = $1 AND p.deleted_at IS NULL
          AND (p.owner_id = $2 OR p.metadata->'portalUserIds' @> to_jsonb($2::text))
        ORDER BY p.name ASC
      `,
      [actor.tenantId, actor.userId]
    );
    return result.rows;
  }

  private option(id: string | null, key: string | null, label: string | null, color: string | null, isDefault: boolean | null, isActive: boolean | null): CrmOptionValueSummary | null {
    return id && key ? { id, key, label: label ?? key, description: null, color, isDefault: isDefault ?? false, isActive: isActive ?? true } : null;
  }

  async getSession(actor: ActorContext, audit: AuditMetadata): Promise<PartnerPortalSessionResponse> {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      const partners = await this.accessiblePartners(client, actor);
      if (partners.length === 0) {
        throw new AppError(403, "You do not have partner portal access.", undefined, "PARTNER_PORTAL_NO_ACCESS");
      }
      const ids = partners.map((partner) => partner.id);
      const dealCount = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM partner_deal_registrations WHERE tenant_id = $1 AND partner_id = ANY($2::uuid[]) AND deleted_at IS NULL`, [actor.tenantId, ids]);
      await this.recordAuditLog(client, actor, audit, { action: "partner_portal.access", resourceType: "partner_portal", resourceId: actor.userId, status: "success", metadata: { partnerCount: partners.length } });
      return {
        session: {
          user: { id: actor.userId, displayName: actor.displayName, email: actor.email, teamName: null, departmentName: null },
          partners: partners.map((partner) => ({ id: partner.id, name: partner.name, status: this.option(partner.status_id, partner.status_key, partner.status_label, partner.status_color, partner.status_is_default, partner.status_is_active), tier: this.option(partner.tier_id, partner.tier_key, partner.tier_label, partner.tier_color, partner.tier_is_default, partner.tier_is_active) })),
          dealCount: Number(dealCount.rows[0]?.count ?? "0")
        }
      };
    });
  }

  private async accessiblePartnerIds(client: PoolClient, actor: ActorContext): Promise<string[]> {
    const partners = await this.accessiblePartners(client, actor);
    if (partners.length === 0) {
      throw new AppError(403, "You do not have partner portal access.", undefined, "PARTNER_PORTAL_NO_ACCESS");
    }
    return partners.map((partner) => partner.id);
  }

  private dealSelect() {
    return `
      SELECT d.id, d.partner_id, p.name AS partner_name, p.owner_id AS partner_owner_id, p.metadata->'portalUserIds' AS partner_portal_users,
        d.opportunity_id, d.account_id, d.name, d.customer_name, d.amount, d.expected_close_date, d.notes, d.metadata, d.created_at, d.updated_at,
        sv.id AS stage_id, sv.value_key AS stage_key, sv.label AS stage_label, sv.color AS stage_color, sv.is_default AS stage_is_default, sv.is_active AS stage_is_active
      FROM partner_deal_registrations d
      INNER JOIN tenant_option_values sv ON sv.id = d.stage_option_id AND sv.tenant_id = d.tenant_id
      LEFT JOIN partners p ON p.id = d.partner_id AND p.tenant_id = d.tenant_id
    `;
  }

  private async dealCommission(client: PoolClient, tenantId: string, opportunityId: string | null): Promise<{ amount: number | null; financeApproved: boolean }> {
    if (!opportunityId) {
      return { amount: null, financeApproved: false };
    }
    const result = await client.query<{ metadata: Record<string, unknown> | null }>(`SELECT metadata FROM opportunities WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [opportunityId, tenantId]);
    const commission = getRecord(getRecord(getRecord(result.rows[0]?.metadata).commercial).commission);
    const amount = num(commission.computedAmount);
    const approvalId = typeof commission.approvalId === "string" ? commission.approvalId : null;
    let financeApproved = false;
    if (approvalId) {
      const approval = await client.query<{ status: string }>(`SELECT status FROM approval_requests WHERE id = $1 AND tenant_id = $2`, [approvalId, tenantId]);
      financeApproved = approval.rows[0]?.status === "approved";
    }
    return { amount, financeApproved };
  }

  // RS-003: only partner-safe fields are returned (no owner, no internal-only metadata).
  private mapDeal(row: PortalDealRow, commission: { amount: number | null; financeApproved: boolean }): PartnerPortalDeal {
    const metadata = getRecord(row.metadata);
    const rawCollab = Array.isArray(metadata.collaboration) ? metadata.collaboration : [];
    const collaboration = rawCollab
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
      .map((entry) => ({
        id: typeof entry.id === "string" ? entry.id : randomUUID(),
        type: (partnerCollaborationTypes.includes(entry.type as never) || entry.type === "response" ? entry.type : "note") as PartnerPortalDeal["collaboration"][number]["type"],
        content: typeof entry.content === "string" ? entry.content : "",
        role: entry.role === "internal" ? "internal" as const : "partner" as const,
        author: mapStoredUser(entry.author),
        createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date(0).toISOString()
      }));
    const commissionState = resolveCommissionStatus(row.stage_key, commission.financeApproved);
    return {
      id: row.id,
      partnerId: row.partner_id,
      partnerName: row.partner_name ?? "",
      name: row.name,
      customerName: row.customer_name,
      contact: str(metadata, "contact"),
      product: str(metadata, "product"),
      amount: num(row.amount),
      stage: this.option(row.stage_id, row.stage_key, row.stage_label, row.stage_color, row.stage_is_default, row.stage_is_active),
      expectedCloseDate: row.expected_close_date,
      notes: row.notes,
      documents: Array.isArray(metadata.documents) ? metadata.documents.filter((doc): doc is string => typeof doc === "string") : [],
      submissionStatus: row.stage_label ?? row.stage_key ?? "registered",
      decisionNote: str(metadata, "decisionNote"),
      protectionUntil: str(metadata, "protectionUntil"),
      collaboration,
      commission: { status: commissionState.status, amount: commission.amount, payoutApproved: commission.financeApproved },
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  async listDeals(actor: ActorContext): Promise<PartnerPortalDealsResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const partnerIds = await this.accessiblePartnerIds(client, actor);
      const result = await client.query<PortalDealRow>(`${this.dealSelect()} WHERE d.tenant_id = $1 AND d.partner_id = ANY($2::uuid[]) AND d.deleted_at IS NULL ORDER BY d.created_at DESC LIMIT 200`, [actor.tenantId, partnerIds]);
      const deals: PartnerPortalDeal[] = [];
      for (const row of result.rows) {
        deals.push(this.mapDeal(row, await this.dealCommission(client, actor.tenantId, row.opportunity_id)));
      }
      return { deals };
    });
  }

  private async loadScopedDeal(client: PoolClient, actor: ActorContext, dealId: string): Promise<PortalDealRow> {
    const partnerIds = await this.accessiblePartnerIds(client, actor);
    const result = await client.query<PortalDealRow>(`${this.dealSelect()} WHERE d.id = $1 AND d.tenant_id = $2 AND d.partner_id = ANY($3::uuid[]) AND d.deleted_at IS NULL`, [dealId, actor.tenantId, partnerIds]);
    if (result.rowCount === 0) {
      throw new AppError(404, "Deal registration not found.", undefined, "NOT_FOUND");
    }
    return result.rows[0];
  }

  async getDeal(actor: ActorContext, dealId: string): Promise<PartnerPortalDealResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const row = await this.loadScopedDeal(client, actor, dealId);
      return { deal: this.mapDeal(row, await this.dealCommission(client, actor.tenantId, row.opportunity_id)) };
    });
  }

  // RS-002
  async registerDeal(actor: ActorContext, audit: AuditMetadata, input: RegisterPortalDealRequestBody): Promise<RegisterPortalDealResponse> {
    this.assertEnabled();
    const name = trimmed(input.name);
    if (!name) {
      throw new AppError(400, "A deal name is required.", undefined, "VALIDATION_ERROR");
    }
    let dealId = "";
    let duplicates: RegisterPortalDealResponse["duplicates"] = [];
    await this.databaseService.withTransaction(async (client) => {
      const partnerIds = await this.accessiblePartnerIds(client, actor);
      if (!partnerIds.includes(input.partnerId)) {
        throw new AppError(403, "You cannot register deals for this partner.", undefined, "AUTHORIZATION_ERROR");
      }
      const stage = await client.query<{ id: string }>(
        `SELECT v.id FROM tenant_option_values v INNER JOIN tenant_option_sets s ON s.id = v.option_set_id AND s.tenant_id = v.tenant_id WHERE s.tenant_id = $1 AND s.set_key = 'partner-deal-stage' AND v.value_key = 'registered' AND v.deleted_at IS NULL AND s.deleted_at IS NULL LIMIT 1`,
        [actor.tenantId]
      );
      if (stage.rowCount === 0) {
        throw new AppError(409, "Partner deal stages are not configured.", undefined, "INVALID_STATE");
      }
      const customerName = trimmed(input.customerName);
      // RS-002 duplicate check: existing active registrations for the same customer (any partner).
      if (customerName) {
        const dupResult = await client.query<{ id: string; partner_name: string | null; customer_name: string | null; amount: string | number | null }>(
          `
            SELECT d.id, p.name AS partner_name, d.customer_name, d.amount
            FROM partner_deal_registrations d
            INNER JOIN tenant_option_values sv ON sv.id = d.stage_option_id AND sv.tenant_id = d.tenant_id
            LEFT JOIN partners p ON p.id = d.partner_id AND p.tenant_id = d.tenant_id
            WHERE d.tenant_id = $1 AND d.deleted_at IS NULL AND sv.value_key IN ('registered', 'approved', 'in_progress')
              AND LOWER(d.customer_name) = LOWER($2)
          `,
          [actor.tenantId, customerName]
        );
        duplicates = dupResult.rows.map((dup) => ({ dealId: dup.id, partnerName: dup.partner_name, customerName: dup.customer_name, amount: num(dup.amount) }));
      }
      const metadata = { product: trimmed(input.product), contact: trimmed(input.contact), documents: Array.isArray(input.documents) ? input.documents.filter((doc) => typeof doc === "string") : [], source: "partner_portal" };
      const inserted = await client.query<{ id: string }>(
        `
          INSERT INTO partner_deal_registrations (tenant_id, partner_id, name, customer_name, stage_option_id, amount, expected_close_date, notes, metadata, created_by, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, $9::jsonb, $10, $10)
          RETURNING id
        `,
        [actor.tenantId, input.partnerId, name, customerName, stage.rows[0].id, input.amount ?? null, trimmed(input.expectedCloseDate), trimmed(input.notes), JSON.stringify(metadata), actor.userId]
      );
      dealId = inserted.rows[0].id;
      // Notify the partner's vendor owner for approval.
      const owner = await client.query<{ owner_id: string | null }>(`SELECT owner_id FROM partners WHERE id = $1 AND tenant_id = $2`, [input.partnerId, actor.tenantId]);
      const ownerId = owner.rows[0]?.owner_id;
      if (ownerId && ownerId !== actor.userId) {
        await this.notificationService.createNotificationWithClient(client, actor, audit, {
          notificationType: "record_assignment",
          recipientUserId: ownerId,
          title: "New partner deal registered",
          message: `${name}${customerName ? ` for ${customerName}` : ""} was registered via the partner portal and awaits approval.`
        });
      }
      await this.recordAuditLog(client, actor, audit, { action: "partner_portal.deal.register", resourceType: "partner_deal_registration", resourceId: dealId, status: "success", metadata: { partnerId: input.partnerId, duplicates: duplicates.length } });
    });
    const dealResponse = await this.getDeal(actor, dealId);
    return { deal: dealResponse.deal, duplicates };
  }

  // RS-003
  private async appendCollaboration(actor: ActorContext, audit: AuditMetadata, dealId: string, item: { type: string; content: string; role: "partner" | "internal" }, internal: boolean): Promise<PartnerPortalDealResponse> {
    const content = trimmed(item.content);
    if (!content) {
      throw new AppError(400, "Content is required.", undefined, "VALIDATION_ERROR");
    }
    await this.databaseService.withTransaction(async (client) => {
      // Internal responders are not scoped to portal membership but need partner edit rights.
      let row: PortalDealRow;
      if (internal) {
        const result = await client.query<PortalDealRow>(`${this.dealSelect()} WHERE d.id = $1 AND d.tenant_id = $2 AND d.deleted_at IS NULL`, [dealId, actor.tenantId]);
        if (result.rowCount === 0) {
          throw new AppError(404, "Deal registration not found.", undefined, "NOT_FOUND");
        }
        row = result.rows[0];
      } else {
        row = await this.loadScopedDeal(client, actor, dealId);
      }
      const metadata = getRecord(row.metadata);
      const collaboration = Array.isArray(metadata.collaboration) ? metadata.collaboration : [];
      const entry = { id: randomUUID(), type: item.type, content, role: item.role, author: { id: actor.userId, displayName: actor.displayName, email: actor.email }, createdAt: new Date().toISOString() };
      await client.query(`UPDATE partner_deal_registrations SET metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [dealId, actor.tenantId, JSON.stringify({ ...metadata, collaboration: [...collaboration, entry] }), actor.userId]);
      // Notify the other side.
      const portalUsers = Array.isArray(row.partner_portal_users) ? row.partner_portal_users.filter((id): id is string => typeof id === "string") : [];
      const recipients = internal ? portalUsers : (row.partner_owner_id ? [row.partner_owner_id] : []);
      for (const recipientUserId of recipients) {
        if (recipientUserId !== actor.userId) {
          await this.notificationService.createNotificationWithClient(client, actor, audit, { notificationType: "record_assignment", recipientUserId, title: internal ? "Vendor response on your deal" : "Partner collaboration update", message: content });
        }
      }
      await this.recordAuditLog(client, actor, audit, { action: internal ? "partner_portal.collaboration.respond" : "partner_portal.collaboration.add", resourceType: "partner_deal_registration", resourceId: dealId, status: "success", metadata: { type: item.type } });
    });
    return this.getDealInternalSafe(actor, dealId, internal);
  }

  private async getDealInternalSafe(actor: ActorContext, dealId: string, internal: boolean): Promise<PartnerPortalDealResponse> {
    if (!internal) {
      return this.getDeal(actor, dealId);
    }
    return this.databaseService.withClient(async (client) => {
      const result = await client.query<PortalDealRow>(`${this.dealSelect()} WHERE d.id = $1 AND d.tenant_id = $2 AND d.deleted_at IS NULL`, [dealId, actor.tenantId]);
      if (result.rowCount === 0) {
        throw new AppError(404, "Deal registration not found.", undefined, "NOT_FOUND");
      }
      const row = result.rows[0];
      return { deal: this.mapDeal(row, await this.dealCommission(client, actor.tenantId, row.opportunity_id)) };
    });
  }

  async addCollaboration(actor: ActorContext, audit: AuditMetadata, dealId: string, input: AddPortalCollaborationRequestBody): Promise<PartnerPortalDealResponse> {
    this.assertEnabled();
    const type = partnerCollaborationTypes.includes(input.type) ? input.type : "note";
    return this.appendCollaboration(actor, audit, dealId, { type, content: input.content, role: "partner" }, false);
  }

  async respondCollaboration(actor: ActorContext, audit: AuditMetadata, dealId: string, input: RespondPortalCollaborationRequestBody): Promise<PartnerPortalDealResponse> {
    this.assertEnabled();
    return this.appendCollaboration(actor, audit, dealId, { type: "response", content: input.content, role: "internal" }, true);
  }

  // RS-004
  async listCommission(actor: ActorContext): Promise<PortalCommissionResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const partnerIds = await this.accessiblePartnerIds(client, actor);
      const result = await client.query<PortalDealRow>(`${this.dealSelect()} WHERE d.tenant_id = $1 AND d.partner_id = ANY($2::uuid[]) AND d.deleted_at IS NULL ORDER BY d.created_at DESC LIMIT 200`, [actor.tenantId, partnerIds]);
      const rows: PortalCommissionResponse["rows"] = [];
      for (const row of result.rows) {
        const commission = await this.dealCommission(client, actor.tenantId, row.opportunity_id);
        const state = resolveCommissionStatus(row.stage_key, commission.financeApproved);
        rows.push({
          dealId: row.id,
          name: row.name,
          customerName: row.customer_name,
          amount: num(row.amount),
          commissionStatus: state.status,
          commissionAmount: commission.amount,
          payoutApproved: commission.financeApproved,
          closed: state.closed,
          query: str(getRecord(row.metadata), "commissionQuery")
        });
      }
      return { rows };
    });
  }

  async raiseCommissionQuery(actor: ActorContext, audit: AuditMetadata, dealId: string, input: RaiseCommissionQueryRequestBody): Promise<PartnerPortalDealResponse> {
    this.assertEnabled();
    const message = trimmed(input.message);
    if (!message) {
      throw new AppError(400, "A query message is required.", undefined, "VALIDATION_ERROR");
    }
    await this.databaseService.withTransaction(async (client) => {
      const row = await this.loadScopedDeal(client, actor, dealId);
      const metadata = getRecord(row.metadata);
      await client.query(`UPDATE partner_deal_registrations SET metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [dealId, actor.tenantId, JSON.stringify({ ...metadata, commissionQuery: message, commissionQueryAt: new Date().toISOString() }), actor.userId]);
      if (row.partner_owner_id && row.partner_owner_id !== actor.userId) {
        await this.notificationService.createNotificationWithClient(client, actor, audit, { notificationType: "record_assignment", recipientUserId: row.partner_owner_id, title: "Partner commission query", message });
      }
      await this.recordAuditLog(client, actor, audit, { action: "partner_portal.commission.query", resourceType: "partner_deal_registration", resourceId: dealId, status: "success" });
    });
    return this.getDeal(actor, dealId);
  }
}
