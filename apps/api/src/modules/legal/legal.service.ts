import type {
  AddLegalClauseRequestBody,
  CrmLookupUserSummary,
  CrmOptionValueSummary,
  InitLegalRequestBody,
  LegalClause,
  LegalClauseStatus,
  LegalOptionsResponse,
  LegalReview,
  LegalReviewResponse,
  LegalRiskLevel,
  RoleSummary,
  SubmitClauseApprovalRequestBody,
  UpdateLegalClauseRequestBody,
  UploadSignedContractRequestBody
} from "@crm/types";
import { canApproveContract, evaluateLegalClauses, evaluateLegalSla, legalClauseStatuses, legalRiskLevels } from "@crm/types";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { NotificationService } from "../notifications/notifications.service.js";
import { ApprovalService } from "../approvals/approvals.service.js";

const DEFAULT_SLA_DAYS = 5;

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
function mapStoredUser(value: unknown): CrmLookupUserSummary | null {
  const record = getRecord(value);
  const id = typeof record.id === "string" ? record.id : null;
  if (!id) {
    return null;
  }
  return { id, displayName: typeof record.displayName === "string" ? record.displayName : "", email: typeof record.email === "string" ? record.email : "", teamName: null, departmentName: null };
}
function normalizeClauseStatus(value: unknown): LegalClauseStatus {
  return legalClauseStatuses.includes(value as LegalClauseStatus) ? (value as LegalClauseStatus) : "standard";
}
function normalizeRisk(value: unknown): LegalRiskLevel | null {
  return legalRiskLevels.includes(value as LegalRiskLevel) ? (value as LegalRiskLevel) : null;
}

export class LegalService {
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
      throw new AppError(503, "Legal review is unavailable until the database connection is enabled.", undefined, "LEGAL_UNAVAILABLE");
    }
  }

  private assertManage(actor: ActorContext) {
    const allowed = ["opportunities.edit", "opportunities.configure", "opportunities.manage_workflow", "opportunities.approve"];
    if (!allowed.some((code) => actor.permissionCodes.includes(code))) {
      throw new AppError(403, "You do not have permission to manage legal review.", undefined, "AUTHORIZATION_ERROR");
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

  private async loadOptionValues(client: PoolClient, tenantId: string, setKey: string): Promise<CrmOptionValueSummary[]> {
    const result = await client.query<{ id: string; value_key: string; label: string; description: string | null; color: string | null; is_default: boolean; is_active: boolean }>(
      `
        SELECT v.id, v.value_key, v.label, v.description, v.color, v.is_default, v.is_active
        FROM tenant_option_values v
        INNER JOIN tenant_option_sets s ON s.id = v.option_set_id AND s.tenant_id = v.tenant_id
        WHERE s.tenant_id = $1 AND s.set_key = $2 AND v.deleted_at IS NULL AND s.deleted_at IS NULL
        ORDER BY v.sort_order ASC, v.label ASC
      `,
      [tenantId, setKey]
    );
    return result.rows.map((row) => ({ id: row.id, key: row.value_key, label: row.label, description: row.description, color: row.color, isDefault: row.is_default, isActive: row.is_active }));
  }

  private async loadUser(client: PoolClient, tenantId: string, userId: string): Promise<CrmLookupUserSummary> {
    const result = await client.query<{ id: string; display_name: string; email: string }>(`SELECT id, display_name, email FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [userId, tenantId]);
    if (result.rowCount === 0) {
      throw new AppError(400, "Referenced user was not found.", undefined, "VALIDATION_ERROR");
    }
    return { id: result.rows[0].id, displayName: result.rows[0].display_name, email: result.rows[0].email, teamName: null, departmentName: null };
  }

  private async loadOpportunity(client: PoolClient, tenantId: string, opportunityId: string) {
    const result = await client.query<{ name: string; metadata: Record<string, unknown> | null }>(
      `SELECT name, metadata FROM opportunities WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [opportunityId, tenantId]
    );
    if (result.rowCount === 0) {
      throw new AppError(404, "Opportunity was not found.", undefined, "NOT_FOUND");
    }
    return { name: result.rows[0].name, metadata: getRecord(result.rows[0].metadata), legal: getRecord(getRecord(result.rows[0].metadata).legal) };
  }

  private async writeLegal(client: PoolClient, actor: ActorContext, opportunityId: string, metadata: Record<string, unknown>, legal: Record<string, unknown>) {
    await client.query(
      `UPDATE opportunities SET metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [opportunityId, actor.tenantId, JSON.stringify({ ...metadata, legal: { ...legal, updatedAt: new Date().toISOString() } }), actor.userId]
    );
  }

  private async approvalStatus(client: PoolClient, tenantId: string, approvalId: string | null): Promise<string | null> {
    if (!approvalId) {
      return null;
    }
    const result = await client.query<{ status: string }>(`SELECT status FROM approval_requests WHERE id = $1 AND tenant_id = $2`, [approvalId, tenantId]);
    return result.rows[0]?.status ?? null;
  }

  private async buildView(client: PoolClient, tenantId: string, opportunityId: string): Promise<LegalReview> {
    const { legal } = await this.loadOpportunity(client, tenantId, opportunityId);
    const initialized = Object.keys(legal).length > 0;
    const contractTypeKey = str(legal, "contractTypeKey");
    const contractTypes = contractTypeKey ? await this.loadOptionValues(client, tenantId, "legal-contract-type") : [];
    const legalOwnerId = str(legal, "legalOwnerId");

    const clausesRaw = Array.isArray(legal.clauses) ? legal.clauses : [];
    const clauses: LegalClause[] = [];
    for (const raw of clausesRaw) {
      const entry = getRecord(raw);
      const approvalId = str(entry, "approvalId");
      const approvalStatus = await this.approvalStatus(client, tenantId, approvalId);
      const status = normalizeClauseStatus(entry.status);
      clauses.push({
        id: typeof entry.id === "string" ? entry.id : randomUUID(),
        title: typeof entry.title === "string" ? entry.title : "",
        category: str(entry, "category"),
        status,
        riskNote: str(entry, "riskNote"),
        approvalId,
        approvalStatus,
        resolved: status !== "high_risk" || approvalStatus === "approved",
        createdBy: mapStoredUser(entry.createdBy),
        createdAt: str(entry, "createdAt") ?? new Date(0).toISOString()
      });
    }
    const clauseSummary = evaluateLegalClauses(clauses.map((clause) => ({ status: clause.status, approvalApproved: clause.approvalStatus === "approved" })));
    const slaDueAt = str(legal, "slaDueAt");

    return {
      opportunityId,
      initialized,
      contractType: contractTypes.find((value) => value.key === contractTypeKey) ?? null,
      dueDate: str(legal, "dueDate"),
      redlines: str(legal, "redlines"),
      riskLevel: normalizeRisk(legal.riskLevel),
      legalOwner: legalOwnerId ? mapStoredUser(legal.legalOwner) : null,
      slaStartedAt: str(legal, "slaStartedAt"),
      slaDueAt,
      slaStatus: evaluateLegalSla(slaDueAt),
      clauses,
      clauseSummary,
      contractApproved: legal.contractApproved === true,
      approvedBy: mapStoredUser(legal.approvedBy),
      approvedAt: str(legal, "approvedAt"),
      signedFileRef: str(legal, "signedFileRef"),
      signedAt: str(legal, "signedAt"),
      closureReady: legal.closureReady === true,
      updatedAt: str(legal, "updatedAt")
    };
  }

  async getLegal(actor: ActorContext, opportunityId: string): Promise<LegalReviewResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => ({ legal: await this.buildView(client, actor.tenantId, opportunityId) }));
  }

  async getOptions(actor: ActorContext): Promise<LegalOptionsResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const owners = await client.query<{ id: string; display_name: string; email: string }>(`SELECT id, display_name, email FROM users WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY display_name ASC LIMIT 500`, [actor.tenantId]);
      return {
        contractTypes: await this.loadOptionValues(client, actor.tenantId, "legal-contract-type"),
        riskLevels: [...legalRiskLevels],
        clauseStatuses: [...legalClauseStatuses],
        owners: owners.rows.map((row) => ({ id: row.id, displayName: row.display_name, email: row.email, teamName: null, departmentName: null }))
      };
    });
  }

  // LEG-001
  async initLegalRequest(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: InitLegalRequestBody): Promise<LegalReviewResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const { metadata, legal } = await this.loadOpportunity(client, actor.tenantId, opportunityId);
      const contractTypeKey = input.contractTypeKey ? (await this.loadOptionValues(client, actor.tenantId, "legal-contract-type")).find((value) => value.key === input.contractTypeKey)?.key ?? null : str(legal, "contractTypeKey");
      if (input.contractTypeKey && !contractTypeKey) {
        throw new AppError(400, "Unknown contract type.", undefined, "VALIDATION_ERROR");
      }
      let legalOwner = mapStoredUser(legal.legalOwner);
      let legalOwnerId = str(legal, "legalOwnerId");
      if (input.legalOwnerId) {
        legalOwner = await this.loadUser(client, actor.tenantId, input.legalOwnerId);
        legalOwnerId = legalOwner.id;
      }
      const dueDate = input.dueDate !== undefined ? trimmed(input.dueDate) : str(legal, "dueDate");
      const slaStartedAt = str(legal, "slaStartedAt") ?? new Date().toISOString();
      const slaDueAt = dueDate ? new Date(dueDate).toISOString() : str(legal, "slaDueAt") ?? new Date(Date.now() + DEFAULT_SLA_DAYS * 24 * 60 * 60 * 1000).toISOString();

      await this.writeLegal(client, actor, opportunityId, metadata, {
        ...legal,
        contractTypeKey,
        dueDate,
        redlines: input.redlines !== undefined ? trimmed(input.redlines) : str(legal, "redlines"),
        riskLevel: input.riskLevel !== undefined ? normalizeRisk(input.riskLevel) : normalizeRisk(legal.riskLevel),
        legalOwnerId,
        legalOwner: legalOwner ? { id: legalOwner.id, displayName: legalOwner.displayName, email: legalOwner.email } : null,
        slaStartedAt,
        slaDueAt
      });
      if (legalOwnerId && legalOwnerId !== actor.userId) {
        await this.notificationService.createNotificationWithClient(client, actor, audit, {
          notificationType: "record_assignment",
          recipientUserId: legalOwnerId,
          title: "Legal review assigned",
          message: "A contract has been assigned to you for legal review.",
          linkedRecord: { entityType: "opportunity", entityId: opportunityId }
        });
      }
      await this.recordAuditLog(client, actor, audit, { action: "legal.request.init", resourceId: opportunityId, status: "success" });
    });
    return this.getLegal(actor, opportunityId);
  }

  // LEG-002
  async addClause(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: AddLegalClauseRequestBody): Promise<LegalReviewResponse> {
    this.assertEnabled();
    const title = trimmed(input.title);
    if (!title) {
      throw new AppError(400, "A clause title is required.", undefined, "VALIDATION_ERROR");
    }
    await this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const { metadata, legal } = await this.loadOpportunity(client, actor.tenantId, opportunityId);
      const clauses = Array.isArray(legal.clauses) ? legal.clauses : [];
      const entry = { id: randomUUID(), title, category: trimmed(input.category), status: normalizeClauseStatus(input.status), riskNote: trimmed(input.riskNote), approvalId: null, createdBy: { id: actor.userId, displayName: actor.displayName, email: actor.email }, createdAt: new Date().toISOString() };
      await this.writeLegal(client, actor, opportunityId, metadata, { ...legal, clauses: [...clauses, entry] });
      await this.recordAuditLog(client, actor, audit, { action: "legal.clause.add", resourceId: opportunityId, status: "success", metadata: { status: entry.status } });
    });
    return this.getLegal(actor, opportunityId);
  }

  async updateClause(actor: ActorContext, audit: AuditMetadata, opportunityId: string, clauseId: string, input: UpdateLegalClauseRequestBody): Promise<LegalReviewResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const { metadata, legal } = await this.loadOpportunity(client, actor.tenantId, opportunityId);
      let found = false;
      const clauses = (Array.isArray(legal.clauses) ? legal.clauses : []).map((raw) => {
        const clause = getRecord(raw);
        if (clause.id !== clauseId) {
          return clause;
        }
        found = true;
        const nextStatus = input.status !== undefined ? normalizeClauseStatus(input.status) : normalizeClauseStatus(clause.status);
        return {
          ...clause,
          title: input.title !== undefined ? trimmed(input.title) ?? clause.title : clause.title,
          category: input.category !== undefined ? trimmed(input.category) : clause.category,
          status: nextStatus,
          riskNote: input.riskNote !== undefined ? trimmed(input.riskNote) : clause.riskNote,
          // Re-tagging away from high_risk clears any prior approval linkage.
          approvalId: nextStatus === "high_risk" ? clause.approvalId ?? null : null
        };
      });
      if (!found) {
        throw new AppError(404, "Clause was not found.", undefined, "NOT_FOUND");
      }
      await this.writeLegal(client, actor, opportunityId, metadata, { ...legal, clauses });
      await this.recordAuditLog(client, actor, audit, { action: "legal.clause.update", resourceId: opportunityId, status: "success", metadata: { clauseId } });
    });
    return this.getLegal(actor, opportunityId);
  }

  async removeClause(actor: ActorContext, audit: AuditMetadata, opportunityId: string, clauseId: string): Promise<LegalReviewResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const { metadata, legal } = await this.loadOpportunity(client, actor.tenantId, opportunityId);
      const clauses = (Array.isArray(legal.clauses) ? legal.clauses : []).filter((raw) => getRecord(raw).id !== clauseId);
      await this.writeLegal(client, actor, opportunityId, metadata, { ...legal, clauses });
      await this.recordAuditLog(client, actor, audit, { action: "legal.clause.remove", resourceId: opportunityId, status: "success", metadata: { clauseId } });
    });
    return this.getLegal(actor, opportunityId);
  }

  // LEG-002: high-risk clause -> leadership approval.
  async submitClauseForApproval(actor: ActorContext, audit: AuditMetadata, opportunityId: string, clauseId: string, input: SubmitClauseApprovalRequestBody): Promise<LegalReviewResponse> {
    this.assertEnabled();
    let clauseTitle = "";
    let opportunityName = "";
    await this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const { name, legal } = await this.loadOpportunity(client, actor.tenantId, opportunityId);
      opportunityName = name;
      const clause = (Array.isArray(legal.clauses) ? legal.clauses : []).map(getRecord).find((entry) => entry.id === clauseId);
      if (!clause) {
        throw new AppError(404, "Clause was not found.", undefined, "NOT_FOUND");
      }
      if (normalizeClauseStatus(clause.status) !== "high_risk") {
        throw new AppError(409, "Only high-risk clauses require leadership approval.", undefined, "INVALID_STATE");
      }
      clauseTitle = typeof clause.title === "string" ? clause.title : "";
    });

    const approval = await this.approvalService.createApproval(actor, audit, {
      approvalType: "legal_clause_approval",
      title: `High-risk clause approval: ${opportunityName}`,
      description: trimmed(input.note ?? null) ?? `Leadership sign-off to accept the high-risk clause "${clauseTitle}" (LEG-002).`,
      approverUserId: input.approverUserId,
      linkedRecord: { entityType: "opportunity", entityId: opportunityId },
      metadata: { opportunityId, clauseId }
    });
    await this.databaseService.withTransaction(async (client) => {
      const { metadata, legal } = await this.loadOpportunity(client, actor.tenantId, opportunityId);
      const clauses = (Array.isArray(legal.clauses) ? legal.clauses : []).map((raw) => {
        const clause = getRecord(raw);
        return clause.id === clauseId ? { ...clause, approvalId: approval.approval.id } : clause;
      });
      await this.writeLegal(client, actor, opportunityId, metadata, { ...legal, clauses });
      await this.recordAuditLog(client, actor, audit, { action: "legal.clause.submit_approval", resourceId: opportunityId, status: "success", metadata: { clauseId } });
    });
    return this.getLegal(actor, opportunityId);
  }

  // LEG-003
  async uploadSigned(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: UploadSignedContractRequestBody): Promise<LegalReviewResponse> {
    this.assertEnabled();
    const ref = trimmed(input.signedFileRef);
    if (!ref) {
      throw new AppError(400, "A signed file reference is required.", undefined, "VALIDATION_ERROR");
    }
    await this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const { metadata, legal } = await this.loadOpportunity(client, actor.tenantId, opportunityId);
      await this.writeLegal(client, actor, opportunityId, metadata, { ...legal, signedFileRef: ref, signedAt: trimmed(input.signedAt) ?? new Date().toISOString() });
      await this.recordAuditLog(client, actor, audit, { action: "legal.contract.signed_upload", resourceId: opportunityId, status: "success" });
    });
    return this.getLegal(actor, opportunityId);
  }

  async approveContract(actor: ActorContext, audit: AuditMetadata, opportunityId: string): Promise<LegalReviewResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const { metadata, legal } = await this.loadOpportunity(client, actor.tenantId, opportunityId);
      const clausesRaw = Array.isArray(legal.clauses) ? legal.clauses : [];
      const evalInputs = [];
      for (const raw of clausesRaw) {
        const clause = getRecord(raw);
        const approvalStatus = await this.approvalStatus(client, actor.tenantId, str(clause, "approvalId"));
        evalInputs.push({ status: normalizeClauseStatus(clause.status), approvalApproved: approvalStatus === "approved" });
      }
      if (!canApproveContract(evalInputs)) {
        throw new AppError(409, "The contract cannot be approved while unresolved high-risk clauses exist.", undefined, "INVALID_STATE");
      }
      await this.writeLegal(client, actor, opportunityId, metadata, {
        ...legal,
        contractApproved: true,
        approvedBy: { id: actor.userId, displayName: actor.displayName, email: actor.email },
        approvedAt: new Date().toISOString(),
        closureReady: true
      });
      await this.recordAuditLog(client, actor, audit, { action: "legal.contract.approve", resourceId: opportunityId, status: "success" });
    });
    return this.getLegal(actor, opportunityId);
  }
}
