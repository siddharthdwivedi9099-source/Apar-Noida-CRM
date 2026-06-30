import type {
  CommercialApprovalState,
  CommercialOptionsResponse,
  CommercialResponse,
  CommercialView,
  CrmLookupUserSummary,
  CrmOptionValueSummary,
  DiscountTier,
  QuoteReviewStatus,
  ReviewQuoteRequestBody,
  RoleSummary,
  SetCommissionRequestBody,
  SubmitCommissionRequestBody,
  SubmitDiscountRequestBody,
  SubmitPaymentTermsRequestBody,
  UpsertQuoteRequestBody
} from "@crm/types";
import {
  computePartnerCommission,
  computeQuoteTotals,
  detectQuoteDeviations,
  evaluateDiscountApprovalRequirement,
  isNonStandardPaymentTerm
} from "@crm/types";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { NotificationService } from "../notifications/notifications.service.js";
import { ApprovalService } from "../approvals/approvals.service.js";

const MIN_MARGIN_PCT = 20;
const DEFAULT_CURRENCY = "USD";

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
function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function trimmed(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const next = value.trim();
  return next.length > 0 ? next : null;
}
function mapStoredUser(value: unknown): CrmLookupUserSummary | null {
  const record = getRecord(value);
  const id = typeof record.id === "string" ? record.id : null;
  if (!id) {
    return null;
  }
  return { id, displayName: typeof record.displayName === "string" ? record.displayName : "", email: typeof record.email === "string" ? record.email : "", teamName: null, departmentName: null };
}

interface OptionValueWithMetadata extends CrmOptionValueSummary {
  metadata: Record<string, unknown>;
}

export class CommercialService {
  private readonly notificationService: NotificationService;
  private readonly approvalService: ApprovalService;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {
    this.notificationService = new NotificationService(databaseService, config);
    this.approvalService = new ApprovalService(databaseService, config);
  }

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "Commercial finance is unavailable until the database connection is enabled.", undefined, "COMMERCIAL_UNAVAILABLE");
    }
  }

  private assertManage(actor: ActorContext) {
    const allowed = ["opportunities.edit", "opportunities.configure", "opportunities.manage_workflow", "opportunities.approve"];
    if (!allowed.some((code) => actor.permissionCodes.includes(code))) {
      throw new AppError(403, "You do not have permission to manage commercial finance.", undefined, "AUTHORIZATION_ERROR");
    }
  }

  private async recordAuditLog(client: PoolClient, actor: ActorContext, audit: AuditMetadata, input: { action: string; resourceId: string; status: "success" | "failure"; metadata?: Record<string, unknown> }) {
    if (!this.config.enableAuditLogs) {
      return;
    }
    await client.query(
      `
        INSERT INTO audit_logs (tenant_id, actor_user_id, session_id, event_type, action, resource_type, resource_id, status, ip_address, user_agent, request_id, metadata)
        VALUES ($1, $2, $3, 'crm', $4, 'opportunity', $5, $6, NULLIF($7, '')::inet, $8, $9, $10::jsonb)
      `,
      [actor.tenantId, actor.userId, actor.sessionId, input.action, input.resourceId, input.status, audit.ipAddress ?? "", audit.userAgent ?? null, audit.requestId, JSON.stringify(input.metadata ?? {})]
    );
  }

  private async loadOptionValues(client: PoolClient, tenantId: string, setKey: string): Promise<OptionValueWithMetadata[]> {
    const result = await client.query<{ id: string; value_key: string; label: string; description: string | null; color: string | null; is_default: boolean; is_active: boolean; metadata: Record<string, unknown> | null }>(
      `
        SELECT v.id, v.value_key, v.label, v.description, v.color, v.is_default, v.is_active, v.metadata
        FROM tenant_option_values v
        INNER JOIN tenant_option_sets s ON s.id = v.option_set_id AND s.tenant_id = v.tenant_id
        WHERE s.tenant_id = $1 AND s.set_key = $2 AND v.deleted_at IS NULL AND s.deleted_at IS NULL
        ORDER BY v.sort_order ASC, v.label ASC
      `,
      [tenantId, setKey]
    );
    return result.rows.map((row) => ({ id: row.id, key: row.value_key, label: row.label, description: row.description, color: row.color, isDefault: row.is_default, isActive: row.is_active, metadata: getRecord(row.metadata) }));
  }

  private buildDiscountTiers(values: OptionValueWithMetadata[]): DiscountTier[] {
    return values.map((value) => ({
      key: value.key,
      label: value.label,
      thresholdPct: num(value.metadata.thresholdPct, 100),
      requiresApproval: value.metadata.requiresApproval === true,
      approverRole: typeof value.metadata.approverRole === "string" ? value.metadata.approverRole : null
    }));
  }

  private standardPaymentTermKeys(values: OptionValueWithMetadata[]): string[] {
    return values.filter((value) => value.metadata.standard !== false).map((value) => value.key);
  }

  private maxAutoDiscountPct(tiers: DiscountTier[]): number | null {
    const autoTiers = tiers.filter((tier) => !tier.requiresApproval);
    return autoTiers.length > 0 ? Math.max(...autoTiers.map((tier) => tier.thresholdPct)) : null;
  }

  private async loadOpportunity(client: PoolClient, tenantId: string, opportunityId: string) {
    const result = await client.query<{ name: string; amount: string | number | null; metadata: Record<string, unknown> | null; outcome_key: string | null }>(
      `
        SELECT o.name, o.amount, o.metadata, ov.value_key AS outcome_key
        FROM opportunities o
        LEFT JOIN tenant_option_values ov ON ov.id = o.outcome_status_option_id AND ov.tenant_id = o.tenant_id
        WHERE o.id = $1 AND o.tenant_id = $2 AND o.deleted_at IS NULL
      `,
      [opportunityId, tenantId]
    );
    if (result.rowCount === 0) {
      throw new AppError(404, "Opportunity was not found.", undefined, "NOT_FOUND");
    }
    const row = result.rows[0];
    return { name: row.name, amount: num(row.amount), outcomeKey: row.outcome_key, metadata: getRecord(row.metadata), commercial: getRecord(getRecord(row.metadata).commercial) };
  }

  private async writeCommercial(client: PoolClient, actor: ActorContext, opportunityId: string, metadata: Record<string, unknown>, commercial: Record<string, unknown>) {
    await client.query(
      `UPDATE opportunities SET metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [opportunityId, actor.tenantId, JSON.stringify({ ...metadata, commercial }), actor.userId]
    );
  }

  private async approvalStatus(client: PoolClient, tenantId: string, approvalId: string | null): Promise<string | null> {
    if (!approvalId) {
      return null;
    }
    const result = await client.query<{ status: string }>(`SELECT status FROM approval_requests WHERE id = $1 AND tenant_id = $2`, [approvalId, tenantId]);
    return result.rows[0]?.status ?? null;
  }

  private resolveState(requires: boolean, approvalId: string | null, approvalStatus: string | null): CommercialApprovalState {
    if (approvalId) {
      if (approvalStatus === "approved") return "approved";
      if (approvalStatus === "rejected") return "rejected";
      return "submitted";
    }
    return requires ? "required" : "not_required";
  }

  private async buildView(client: PoolClient, tenantId: string, opportunityId: string): Promise<CommercialView> {
    const { amount, outcomeKey, commercial } = await this.loadOpportunity(client, tenantId, opportunityId);
    const paymentTermValues = await this.loadOptionValues(client, tenantId, "payment-term");
    const tierValues = await this.loadOptionValues(client, tenantId, "discount-approval-tier");
    const tiers = this.buildDiscountTiers(tierValues);
    const standardKeys = this.standardPaymentTermKeys(paymentTermValues);
    const maxAuto = this.maxAutoDiscountPct(tiers);

    // Quote (FIN-001)
    const quoteRaw = getRecord(commercial.quote);
    const lineItemsRaw = Array.isArray(quoteRaw.lineItems) ? quoteRaw.lineItems : [];
    const lineItems = lineItemsRaw
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
      .map((entry) => {
        const quantity = num(entry.quantity);
        const unitPrice = num(entry.unitPrice);
        const discountPct = num(entry.discountPct);
        const taxPct = num(entry.taxPct);
        const net = quantity * unitPrice * (1 - Math.max(0, Math.min(100, discountPct)) / 100);
        const lineTotal = Math.round((net * (1 + Math.max(0, taxPct) / 100)) * 100) / 100;
        return { id: typeof entry.id === "string" ? entry.id : randomUUID(), product: typeof entry.product === "string" ? entry.product : "", quantity, unitPrice, discountPct, taxPct, lineTotal };
      });
    const implementationFees = num(quoteRaw.implementationFees);
    const recurringFees = num(quoteRaw.recurringFees);
    const totals = computeQuoteTotals(lineItems, implementationFees, recurringFees);
    const paymentTermsKey = str(getRecord(commercial.paymentTerms), "termsKey") ?? str(quoteRaw, "paymentTermsKey");
    const marginPct = typeof quoteRaw.marginPct === "number" ? quoteRaw.marginPct : null;
    const blendedDiscountPct = totals.subtotal > 0 ? Math.round((totals.discountTotal / totals.subtotal) * 1000) / 10 : 0;
    const nonStandardTerm = isNonStandardPaymentTerm(standardKeys, paymentTermsKey);
    const deviations = detectQuoteDeviations({ discountPct: blendedDiscountPct, maxAutoDiscountPct: maxAuto ?? undefined, marginPct, minMarginPct: MIN_MARGIN_PCT, nonStandardPaymentTerm: nonStandardTerm });

    // Discount (FIN-002)
    const discountRaw = getRecord(commercial.discount);
    const requestedDiscountPct = num(discountRaw.requestedDiscountPct);
    const requirement = evaluateDiscountApprovalRequirement(requestedDiscountPct, tiers);
    const discountApprovalId = str(discountRaw, "approvalId");
    const discountApprovalStatus = await this.approvalStatus(client, tenantId, discountApprovalId);

    // Payment terms (FIN-003)
    const ptRaw = getRecord(commercial.paymentTerms);
    const ptApprovalId = str(ptRaw, "approvalId");
    const ptApprovalStatus = await this.approvalStatus(client, tenantId, ptApprovalId);

    // Commission (FIN-004)
    const commissionRaw = getRecord(commercial.commission);
    const basisAmount = typeof commissionRaw.basisAmount === "number" ? commissionRaw.basisAmount : amount;
    const ratePct = num(commissionRaw.ratePct);
    const adjustmentAmount = num(commissionRaw.adjustmentAmount);
    const commissionApprovalId = str(commissionRaw, "approvalId");
    const commissionApprovalStatus = await this.approvalStatus(client, tenantId, commissionApprovalId);

    return {
      opportunityId,
      currency: DEFAULT_CURRENCY,
      quote: {
        lineItems,
        implementationFees,
        recurringFees,
        paymentTermsKey,
        marginPct,
        totals,
        deviations,
        reviewStatus: (["pending", "approved", "rejected", "changes_requested"].includes(quoteRaw.reviewStatus as string) ? quoteRaw.reviewStatus : "pending") as QuoteReviewStatus,
        reviewedBy: mapStoredUser(quoteRaw.reviewedBy),
        reviewComments: str(quoteRaw, "reviewComments"),
        updatedAt: str(quoteRaw, "updatedAt")
      },
      discount: {
        requestedDiscountPct,
        justification: str(discountRaw, "justification"),
        marginImpactPct: typeof discountRaw.marginImpactPct === "number" ? discountRaw.marginImpactPct : null,
        requirement,
        approvalId: discountApprovalId,
        approvalStatus: discountApprovalStatus,
        state: this.resolveState(requirement.requiresApproval, discountApprovalId, discountApprovalStatus)
      },
      paymentTerms: {
        termsKey: paymentTermsKey,
        nonStandard: nonStandardTerm,
        approvedTermsText: str(ptRaw, "approvedTermsText"),
        approvalId: ptApprovalId,
        approvalStatus: ptApprovalStatus,
        state: this.resolveState(nonStandardTerm, ptApprovalId, ptApprovalStatus)
      },
      commission: {
        partnerId: str(commissionRaw, "partnerId"),
        partnerName: str(commissionRaw, "partnerName"),
        basisAmount,
        ratePct,
        adjustmentAmount,
        adjustmentReason: str(commissionRaw, "adjustmentReason"),
        computedAmount: computePartnerCommission(basisAmount, ratePct, adjustmentAmount),
        linkedClosedWon: outcomeKey === "won",
        approvalId: commissionApprovalId,
        approvalStatus: commissionApprovalStatus,
        state: this.resolveState(ratePct > 0, commissionApprovalId, commissionApprovalStatus)
      }
    };
  }

  async getCommercial(actor: ActorContext, opportunityId: string): Promise<CommercialResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => ({ commercial: await this.buildView(client, actor.tenantId, opportunityId) }));
  }

  async getOptions(actor: ActorContext): Promise<CommercialOptionsResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const paymentTermValues = await this.loadOptionValues(client, actor.tenantId, "payment-term");
      const tierValues = await this.loadOptionValues(client, actor.tenantId, "discount-approval-tier");
      const tiers = this.buildDiscountTiers(tierValues);
      const partners = await client.query<{ id: string; name: string }>(`SELECT id, name FROM partners WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY name ASC LIMIT 500`, [actor.tenantId]);
      const approvers = await client.query<{ id: string; display_name: string; email: string }>(`SELECT id, display_name, email FROM users WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY display_name ASC LIMIT 500`, [actor.tenantId]);
      return {
        paymentTerms: paymentTermValues.map(({ metadata: _metadata, ...rest }) => rest),
        standardPaymentTermKeys: this.standardPaymentTermKeys(paymentTermValues),
        discountTiers: tiers,
        maxAutoDiscountPct: this.maxAutoDiscountPct(tiers),
        partners: partners.rows.map((row) => ({ id: row.id, name: row.name })),
        approvers: approvers.rows.map((row) => ({ id: row.id, displayName: row.display_name, email: row.email, teamName: null, departmentName: null }))
      };
    });
  }

  // FIN-001
  async upsertQuote(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: UpsertQuoteRequestBody): Promise<CommercialResponse> {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const { metadata, commercial } = await this.loadOpportunity(client, actor.tenantId, opportunityId);
      const lineItems = (Array.isArray(input.lineItems) ? input.lineItems : [])
        .filter((item) => trimmed(item.product))
        .map((item) => ({ id: item.id ?? randomUUID(), product: trimmed(item.product) ?? "", quantity: num(item.quantity), unitPrice: num(item.unitPrice), discountPct: num(item.discountPct), taxPct: num(item.taxPct) }));
      const quote = {
        ...getRecord(commercial.quote),
        lineItems,
        implementationFees: num(input.implementationFees),
        recurringFees: num(input.recurringFees),
        paymentTermsKey: input.paymentTermsKey !== undefined ? trimmed(input.paymentTermsKey) : str(getRecord(commercial.quote), "paymentTermsKey"),
        marginPct: input.marginPct !== undefined ? (input.marginPct === null ? null : num(input.marginPct)) : getRecord(commercial.quote).marginPct ?? null,
        reviewStatus: "pending",
        reviewedBy: null,
        reviewComments: null,
        updatedAt: new Date().toISOString()
      };
      await this.writeCommercial(client, actor, opportunityId, metadata, { ...commercial, quote });
      await this.recordAuditLog(client, actor, audit, { action: "commercial.quote.upsert", resourceId: opportunityId, status: "success" });
      return { commercial: await this.buildView(client, actor.tenantId, opportunityId) };
    });
  }

  async reviewQuote(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: ReviewQuoteRequestBody): Promise<CommercialResponse> {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const { metadata, commercial } = await this.loadOpportunity(client, actor.tenantId, opportunityId);
      const quote = { ...getRecord(commercial.quote), reviewStatus: input.decision, reviewedBy: { id: actor.userId, displayName: actor.displayName, email: actor.email }, reviewComments: trimmed(input.comments), reviewedAt: new Date().toISOString() };
      await this.writeCommercial(client, actor, opportunityId, metadata, { ...commercial, quote });
      await this.recordAuditLog(client, actor, audit, { action: "commercial.quote.review", resourceId: opportunityId, status: "success", metadata: { decision: input.decision } });
      return { commercial: await this.buildView(client, actor.tenantId, opportunityId) };
    });
  }

  // FIN-002
  async submitDiscount(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: SubmitDiscountRequestBody): Promise<CommercialResponse> {
    this.assertEnabled();
    const requested = num(input.requestedDiscountPct);
    let opportunityName = "";
    let requires = false;
    await this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const { name, metadata, commercial } = await this.loadOpportunity(client, actor.tenantId, opportunityId);
      opportunityName = name;
      const tiers = this.buildDiscountTiers(await this.loadOptionValues(client, actor.tenantId, "discount-approval-tier"));
      requires = evaluateDiscountApprovalRequirement(requested, tiers).requiresApproval;
      const discount = { ...getRecord(commercial.discount), requestedDiscountPct: requested, justification: trimmed(input.justification), marginImpactPct: input.marginImpactPct !== undefined && input.marginImpactPct !== null ? num(input.marginImpactPct) : null };
      await this.writeCommercial(client, actor, opportunityId, metadata, { ...commercial, discount });
      await this.recordAuditLog(client, actor, audit, { action: "commercial.discount.submit", resourceId: opportunityId, status: "success", metadata: { requested, requires } });
    });

    if (requires) {
      const approval = await this.approvalService.createApproval(actor, audit, {
        approvalType: "discount_approval",
        title: `Discount approval (${requested}%): ${opportunityName}`,
        description: trimmed(input.justification ?? null) ?? "Discount exceeds the auto-approval threshold (FIN-002).",
        approverUserId: input.approverUserId,
        linkedRecord: { entityType: "opportunity", entityId: opportunityId },
        metadata: { opportunityId, requestedDiscountPct: requested, marginImpactPct: input.marginImpactPct ?? null }
      });
      await this.databaseService.withTransaction(async (client) => {
        const { metadata, commercial } = await this.loadOpportunity(client, actor.tenantId, opportunityId);
        await this.writeCommercial(client, actor, opportunityId, metadata, { ...commercial, discount: { ...getRecord(commercial.discount), approvalId: approval.approval.id } });
      });
    }
    return this.getCommercial(actor, opportunityId);
  }

  // FIN-003
  async setPaymentTerms(actor: ActorContext, audit: AuditMetadata, opportunityId: string, termsKey: string): Promise<CommercialResponse> {
    this.assertEnabled();
    const key = trimmed(termsKey);
    if (!key) {
      throw new AppError(400, "A payment term is required.", undefined, "VALIDATION_ERROR");
    }
    return this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const standardKeys = this.standardPaymentTermKeys(await this.loadOptionValues(client, actor.tenantId, "payment-term"));
      if (!standardKeys.includes(key)) {
        const allValues = await this.loadOptionValues(client, actor.tenantId, "payment-term");
        if (!allValues.some((value) => value.key === key)) {
          throw new AppError(400, "Unknown payment term.", undefined, "VALIDATION_ERROR");
        }
      }
      const { metadata, commercial } = await this.loadOpportunity(client, actor.tenantId, opportunityId);
      const paymentTerms = { ...getRecord(commercial.paymentTerms), termsKey: key };
      await this.writeCommercial(client, actor, opportunityId, metadata, { ...commercial, paymentTerms });
      await this.recordAuditLog(client, actor, audit, { action: "commercial.payment_terms.set", resourceId: opportunityId, status: "success", metadata: { termsKey: key } });
      return { commercial: await this.buildView(client, actor.tenantId, opportunityId) };
    });
  }

  async submitPaymentTermsException(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: SubmitPaymentTermsRequestBody): Promise<CommercialResponse> {
    this.assertEnabled();
    const key = trimmed(input.termsKey);
    if (!key) {
      throw new AppError(400, "A payment term is required.", undefined, "VALIDATION_ERROR");
    }
    let opportunityName = "";
    let nonStandard = false;
    await this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const { name, metadata, commercial } = await this.loadOpportunity(client, actor.tenantId, opportunityId);
      opportunityName = name;
      const standardKeys = this.standardPaymentTermKeys(await this.loadOptionValues(client, actor.tenantId, "payment-term"));
      nonStandard = isNonStandardPaymentTerm(standardKeys, key);
      await this.writeCommercial(client, actor, opportunityId, metadata, { ...commercial, paymentTerms: { ...getRecord(commercial.paymentTerms), termsKey: key, approvedTermsText: trimmed(input.note) } });
      await this.recordAuditLog(client, actor, audit, { action: "commercial.payment_terms.submit", resourceId: opportunityId, status: "success", metadata: { termsKey: key, nonStandard } });
    });

    if (nonStandard) {
      const approval = await this.approvalService.createApproval(actor, audit, {
        approvalType: "payment_terms_approval",
        title: `Payment terms exception: ${opportunityName}`,
        description: trimmed(input.note ?? null) ?? "Non-standard payment terms require finance approval (FIN-003).",
        approverUserId: input.approverUserId,
        linkedRecord: { entityType: "opportunity", entityId: opportunityId },
        metadata: { opportunityId, termsKey: key }
      });
      await this.databaseService.withTransaction(async (client) => {
        const { metadata, commercial } = await this.loadOpportunity(client, actor.tenantId, opportunityId);
        await this.writeCommercial(client, actor, opportunityId, metadata, { ...commercial, paymentTerms: { ...getRecord(commercial.paymentTerms), approvalId: approval.approval.id } });
      });
    }
    return this.getCommercial(actor, opportunityId);
  }

  // FIN-004
  async setCommission(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: SetCommissionRequestBody): Promise<CommercialResponse> {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const { amount, metadata, commercial } = await this.loadOpportunity(client, actor.tenantId, opportunityId);
      let partnerName: string | null = null;
      if (input.partnerId) {
        const partner = await client.query<{ name: string }>(`SELECT name FROM partners WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [input.partnerId, actor.tenantId]);
        if (partner.rowCount === 0) {
          throw new AppError(400, "Partner was not found.", undefined, "VALIDATION_ERROR");
        }
        partnerName = partner.rows[0].name;
      }
      const commission = {
        ...getRecord(commercial.commission),
        partnerId: input.partnerId ?? null,
        partnerName,
        basisAmount: input.basisAmount !== undefined && input.basisAmount !== null ? num(input.basisAmount) : amount,
        ratePct: num(input.ratePct),
        adjustmentAmount: input.adjustmentAmount !== undefined && input.adjustmentAmount !== null ? num(input.adjustmentAmount) : 0,
        adjustmentReason: trimmed(input.adjustmentReason)
      };
      await this.writeCommercial(client, actor, opportunityId, metadata, { ...commercial, commission });
      await this.recordAuditLog(client, actor, audit, { action: "commercial.commission.set", resourceId: opportunityId, status: "success" });
      return { commercial: await this.buildView(client, actor.tenantId, opportunityId) };
    });
  }

  async submitCommission(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: SubmitCommissionRequestBody): Promise<CommercialResponse> {
    this.assertEnabled();
    let opportunityName = "";
    await this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const { name, commercial } = await this.loadOpportunity(client, actor.tenantId, opportunityId);
      opportunityName = name;
      if (num(getRecord(commercial.commission).ratePct) <= 0) {
        throw new AppError(409, "Set a commission rate before requesting approval.", undefined, "INVALID_STATE");
      }
    });

    const approval = await this.approvalService.createApproval(actor, audit, {
      approvalType: "partner_commission_approval",
      title: `Partner commission approval: ${opportunityName}`,
      description: trimmed(input.note ?? null) ?? "Partner commission payout requires finance approval before disbursement (FIN-004).",
      approverUserId: input.approverUserId,
      linkedRecord: { entityType: "opportunity", entityId: opportunityId },
      metadata: { opportunityId }
    });
    await this.databaseService.withTransaction(async (client) => {
      const { metadata, commercial } = await this.loadOpportunity(client, actor.tenantId, opportunityId);
      await this.writeCommercial(client, actor, opportunityId, metadata, { ...commercial, commission: { ...getRecord(commercial.commission), approvalId: approval.approval.id } });
    });
    return this.getCommercial(actor, opportunityId);
  }
}
