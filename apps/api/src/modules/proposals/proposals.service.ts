import type {
  AddProposalComplianceItemRequestBody,
  AddProposalVersionRequestBody,
  CreateProposalContentRequestBody,
  CrmLookupUserSummary,
  CrmOptionValueSummary,
  InitProposalRequestBody,
  ProposalComplianceItem,
  ProposalContentEntry,
  ProposalContentLibraryResponse,
  ProposalOptionsResponse,
  ProposalQueueResponse,
  ProposalVersion,
  ProposalWorkspace,
  ProposalWorkspaceResponse,
  RecordProposalSubmissionRequestBody,
  RoleSummary,
  SubmitProposalForApprovalRequestBody,
  UpdateProposalComplianceItemRequestBody,
  UpdateProposalContentRequestBody
} from "@crm/types";
import {
  evaluateProposalCompliance,
  isProposalContentExpired,
  proposalComplianceStatuses,
  proposalResponseStatuses,
  summarizeProposalVersions
} from "@crm/types";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { NotificationService } from "../notifications/notifications.service.js";
import { ApprovalService } from "../approvals/approvals.service.js";
import { OpportunityService } from "../opportunities/opportunities.service.js";

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
  return {
    id,
    displayName: typeof record.displayName === "string" ? record.displayName : "",
    email: typeof record.email === "string" ? record.email : "",
    teamName: null,
    departmentName: null
  };
}

function normalizeResponseStatus(value: unknown) {
  return proposalResponseStatuses.includes(value as never) ? (value as ProposalComplianceItem["responseStatus"]) : "pending";
}
function normalizeComplianceStatus(value: unknown) {
  return proposalComplianceStatuses.includes(value as never) ? (value as ProposalComplianceItem["complianceStatus"]) : "pending";
}

export class ProposalsService {
  private readonly notificationService: NotificationService;
  private readonly approvalService: ApprovalService;
  private readonly opportunityService: OpportunityService;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {
    this.notificationService = new NotificationService(databaseService, config);
    this.approvalService = new ApprovalService(databaseService, config);
    this.opportunityService = new OpportunityService(databaseService, config);
  }

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "Proposals are unavailable until the database connection is enabled.", undefined, "PROPOSALS_UNAVAILABLE");
    }
  }

  private assertManage(actor: ActorContext) {
    const allowed = ["opportunities.edit", "opportunities.configure", "opportunities.manage_workflow", "opportunities.approve", "presales.edit", "presales.configure"];
    if (!allowed.some((code) => actor.permissionCodes.includes(code))) {
      throw new AppError(403, "You do not have permission to manage proposals.", undefined, "AUTHORIZATION_ERROR");
    }
  }

  private async recordAuditLog(
    client: PoolClient,
    actor: ActorContext,
    audit: AuditMetadata,
    input: { action: string; resourceType: string; resourceId: string; status: "success" | "failure"; metadata?: Record<string, unknown> }
  ) {
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

  private async resolveOption(client: PoolClient, tenantId: string, setKey: string, valueKey: string): Promise<CrmOptionValueSummary> {
    const values = await this.loadOptionValues(client, tenantId, setKey);
    const match = values.find((value) => value.key === valueKey);
    if (!match) {
      throw new AppError(400, `Unknown ${setKey} value: ${valueKey}.`, undefined, "VALIDATION_ERROR");
    }
    return match;
  }

  private async loadUsers(client: PoolClient, tenantId: string, ids: string[]): Promise<CrmLookupUserSummary[]> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) {
      return [];
    }
    const result = await client.query<{ id: string; display_name: string; email: string }>(
      `SELECT id, display_name, email FROM users WHERE tenant_id = $1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL`,
      [tenantId, unique]
    );
    return result.rows.map((row) => ({ id: row.id, displayName: row.display_name, email: row.email, teamName: null, departmentName: null }));
  }

  private async loadProposalMetadata(client: PoolClient, tenantId: string, opportunityId: string): Promise<{ metadata: Record<string, unknown>; proposal: Record<string, unknown> }> {
    const result = await client.query<{ metadata: Record<string, unknown> | null }>(
      `SELECT metadata FROM opportunities WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [opportunityId, tenantId]
    );
    if (result.rowCount === 0) {
      throw new AppError(404, "Opportunity was not found.", undefined, "NOT_FOUND");
    }
    const metadata = getRecord(result.rows[0].metadata);
    return { metadata, proposal: getRecord(metadata.proposal) };
  }

  private async writeProposal(client: PoolClient, actor: ActorContext, opportunityId: string, metadata: Record<string, unknown>, proposal: Record<string, unknown>) {
    await client.query(
      `UPDATE opportunities SET metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [opportunityId, actor.tenantId, JSON.stringify({ ...metadata, proposal: { ...proposal, updatedAt: new Date().toISOString() } }), actor.userId]
    );
  }

  private mapComplianceItems(proposal: Record<string, unknown>): ProposalComplianceItem[] {
    const raw = Array.isArray(proposal.complianceItems) ? proposal.complianceItems : [];
    return raw
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
      .map((entry) => ({
        id: typeof entry.id === "string" ? entry.id : randomUUID(),
        requirement: typeof entry.requirement === "string" ? entry.requirement : "",
        owner: str(entry, "owner"),
        responseStatus: normalizeResponseStatus(entry.responseStatus),
        complianceStatus: normalizeComplianceStatus(entry.complianceStatus),
        comments: str(entry, "comments"),
        evidence: str(entry, "evidence"),
        response: str(entry, "response")
      }));
  }

  private mapVersions(proposal: Record<string, unknown>): ProposalVersion[] {
    const raw = Array.isArray(proposal.versions) ? proposal.versions : [];
    return raw
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
      .map((entry) => ({
        id: typeof entry.id === "string" ? entry.id : randomUUID(),
        label: typeof entry.label === "string" ? entry.label : "",
        notes: str(entry, "notes"),
        fileRef: str(entry, "fileRef"),
        createdBy: mapStoredUser(entry.createdBy),
        createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date(0).toISOString(),
        locked: entry.locked === true,
        isFinal: entry.isFinal === true
      }));
  }

  async getProposal(actor: ActorContext, opportunityId: string): Promise<ProposalWorkspaceResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const { proposal } = await this.loadProposalMetadata(client, actor.tenantId, opportunityId);
      return { proposal: await this.buildWorkspace(client, actor.tenantId, opportunityId, proposal) };
    });
  }

  private async buildWorkspace(client: PoolClient, tenantId: string, opportunityId: string, proposal: Record<string, unknown>): Promise<ProposalWorkspace> {
    const initialized = Object.keys(proposal).length > 0;
    const statusKey = str(proposal, "statusKey");
    const templateKey = str(proposal, "templateKey");
    const statuses = statusKey ? await this.loadOptionValues(client, tenantId, "proposal-request-status") : [];
    const templates = templateKey ? await this.loadOptionValues(client, tenantId, "opportunity-proposal-template") : [];
    const contributorIds = Array.isArray(proposal.contributorIds) ? proposal.contributorIds.filter((id): id is string => typeof id === "string") : [];
    const contributors = await this.loadUsers(client, tenantId, contributorIds);
    const complianceItems = this.mapComplianceItems(proposal);
    const versions = this.mapVersions(proposal);
    const finalVersionId = str(proposal, "finalVersionId");
    const approvalId = str(proposal, "approvalId");

    let approvalStatus: string | null = null;
    if (approvalId) {
      const approval = await client.query<{ status: string }>(`SELECT status FROM approval_requests WHERE id = $1 AND tenant_id = $2`, [approvalId, tenantId]);
      approvalStatus = approval.rows[0]?.status ?? null;
    }

    const submissionRaw = getRecord(proposal.submission);
    const submission = submissionRaw.submittedAt
      ? {
          submittedAt: str(submissionRaw, "submittedAt") ?? "",
          mode: str(submissionRaw, "mode") ?? "",
          recipient: str(submissionRaw, "recipient"),
          documents: str(submissionRaw, "documents"),
          acknowledgement: str(submissionRaw, "acknowledgement"),
          remarks: str(submissionRaw, "remarks"),
          submittedBy: mapStoredUser(submissionRaw.submittedBy)
        }
      : null;

    return {
      opportunityId,
      initialized,
      status: statuses.find((value) => value.key === statusKey) ?? null,
      template: templates.find((value) => value.key === templateKey) ?? null,
      scope: str(proposal, "scope"),
      dueDate: str(proposal, "dueDate"),
      contributors,
      complianceItems,
      complianceSummary: evaluateProposalCompliance(complianceItems),
      versions,
      versionSummary: summarizeProposalVersions(versions, finalVersionId, versions),
      finalVersionId,
      approvalId,
      approvalStatus,
      submission,
      updatedAt: str(proposal, "updatedAt"),
      aiPlaceholders: { available: false, message: "AI requirement extraction and content recommendation will connect with the governed AI Gateway." }
    };
  }

  // PB-001
  async initProposal(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: InitProposalRequestBody): Promise<ProposalWorkspaceResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const { metadata, proposal } = await this.loadProposalMetadata(client, actor.tenantId, opportunityId);
      const statusKey = input.statusKey ? (await this.resolveOption(client, actor.tenantId, "proposal-request-status", input.statusKey)).key : str(proposal, "statusKey") ?? "draft";
      const templateKey = input.templateKey ? (await this.resolveOption(client, actor.tenantId, "opportunity-proposal-template", input.templateKey)).key : str(proposal, "templateKey");
      const contributorIds = Array.isArray(input.contributorIds) ? [...new Set(input.contributorIds.filter(Boolean))] : (Array.isArray(proposal.contributorIds) ? proposal.contributorIds : []);
      const contributors = await this.loadUsers(client, actor.tenantId, contributorIds as string[]);
      const dueDate = input.dueDate !== undefined ? trimmed(input.dueDate) : str(proposal, "dueDate");

      await this.writeProposal(client, actor, opportunityId, metadata, {
        ...proposal,
        statusKey,
        templateKey,
        scope: input.scope !== undefined ? trimmed(input.scope) : str(proposal, "scope"),
        dueDate,
        contributorIds: contributors.map((contributor) => contributor.id)
      });

      // PB-001: deadline reminder task + contributor assignment notifications.
      if (dueDate) {
        await client.query(
          `
            INSERT INTO crm_tasks (tenant_id, entity_type, entity_id, owner_user_id, assignee_user_id, title, description, due_at, reminder_at, priority, status, metadata, created_by, updated_by)
            VALUES ($1, 'opportunity', $2, $3, $3, $4, $5, $6::timestamptz, $6::timestamptz, 'high', 'open', $7::jsonb, $3, $3)
          `,
          [actor.tenantId, opportunityId, actor.userId, "Proposal deadline", `Proposal/bid response is due on ${dueDate}.`, new Date(dueDate).toISOString(), JSON.stringify({ proposalDeadline: true })]
        );
      }
      for (const contributor of contributors) {
        if (contributor.id !== actor.userId) {
          await this.notificationService.createNotificationWithClient(client, actor, audit, {
            notificationType: "record_assignment",
            recipientUserId: contributor.id,
            title: "Assigned to a proposal",
            message: "You have been assigned as a contributor on a proposal/bid response.",
            linkedRecord: { entityType: "opportunity", entityId: opportunityId }
          });
        }
      }
      await this.recordAuditLog(client, actor, audit, { action: "proposal.request.init", resourceType: "opportunity", resourceId: opportunityId, status: "success" });
    });
    return this.getProposal(actor, opportunityId);
  }

  // PB-002
  async addComplianceItem(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: AddProposalComplianceItemRequestBody): Promise<ProposalWorkspaceResponse> {
    this.assertEnabled();
    const requirement = trimmed(input.requirement);
    if (!requirement) {
      throw new AppError(400, "A requirement is required.", undefined, "VALIDATION_ERROR");
    }
    await this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const { metadata, proposal } = await this.loadProposalMetadata(client, actor.tenantId, opportunityId);
      const items = Array.isArray(proposal.complianceItems) ? proposal.complianceItems : [];
      const entry = {
        id: randomUUID(),
        requirement,
        owner: trimmed(input.owner),
        responseStatus: normalizeResponseStatus(input.responseStatus),
        complianceStatus: normalizeComplianceStatus(input.complianceStatus),
        comments: trimmed(input.comments),
        evidence: trimmed(input.evidence),
        response: trimmed(input.response)
      };
      await this.writeProposal(client, actor, opportunityId, metadata, { ...proposal, complianceItems: [...items, entry] });
      await this.recordAuditLog(client, actor, audit, { action: "proposal.compliance.add", resourceType: "opportunity", resourceId: opportunityId, status: "success" });
    });
    return this.getProposal(actor, opportunityId);
  }

  async updateComplianceItem(actor: ActorContext, audit: AuditMetadata, opportunityId: string, itemId: string, input: UpdateProposalComplianceItemRequestBody): Promise<ProposalWorkspaceResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const { metadata, proposal } = await this.loadProposalMetadata(client, actor.tenantId, opportunityId);
      const items = (Array.isArray(proposal.complianceItems) ? proposal.complianceItems : []).map((raw) => {
        const item = getRecord(raw);
        if (item.id !== itemId) {
          return item;
        }
        return {
          ...item,
          requirement: input.requirement !== undefined ? trimmed(input.requirement) ?? item.requirement : item.requirement,
          owner: input.owner !== undefined ? trimmed(input.owner) : item.owner,
          responseStatus: input.responseStatus !== undefined ? normalizeResponseStatus(input.responseStatus) : item.responseStatus,
          complianceStatus: input.complianceStatus !== undefined ? normalizeComplianceStatus(input.complianceStatus) : item.complianceStatus,
          comments: input.comments !== undefined ? trimmed(input.comments) : item.comments,
          evidence: input.evidence !== undefined ? trimmed(input.evidence) : item.evidence,
          response: input.response !== undefined ? trimmed(input.response) : item.response
        };
      });
      await this.writeProposal(client, actor, opportunityId, metadata, { ...proposal, complianceItems: items });
      await this.recordAuditLog(client, actor, audit, { action: "proposal.compliance.update", resourceType: "opportunity", resourceId: opportunityId, status: "success", metadata: { itemId } });
    });
    return this.getProposal(actor, opportunityId);
  }

  async removeComplianceItem(actor: ActorContext, audit: AuditMetadata, opportunityId: string, itemId: string): Promise<ProposalWorkspaceResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const { metadata, proposal } = await this.loadProposalMetadata(client, actor.tenantId, opportunityId);
      const items = (Array.isArray(proposal.complianceItems) ? proposal.complianceItems : []).filter((raw) => getRecord(raw).id !== itemId);
      await this.writeProposal(client, actor, opportunityId, metadata, { ...proposal, complianceItems: items });
      await this.recordAuditLog(client, actor, audit, { action: "proposal.compliance.remove", resourceType: "opportunity", resourceId: opportunityId, status: "success", metadata: { itemId } });
    });
    return this.getProposal(actor, opportunityId);
  }

  // PB-003
  async addVersion(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: AddProposalVersionRequestBody): Promise<ProposalWorkspaceResponse> {
    this.assertEnabled();
    const label = trimmed(input.label);
    if (!label) {
      throw new AppError(400, "A version label is required.", undefined, "VALIDATION_ERROR");
    }
    await this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const { metadata, proposal } = await this.loadProposalMetadata(client, actor.tenantId, opportunityId);
      const versions = Array.isArray(proposal.versions) ? proposal.versions : [];
      const entry = { id: randomUUID(), label, notes: trimmed(input.notes), fileRef: trimmed(input.fileRef), createdBy: { id: actor.userId, displayName: actor.displayName, email: actor.email }, createdAt: new Date().toISOString(), locked: false, isFinal: false };
      await this.writeProposal(client, actor, opportunityId, metadata, { ...proposal, versions: [...versions, entry] });
      await this.recordAuditLog(client, actor, audit, { action: "proposal.version.add", resourceType: "opportunity", resourceId: opportunityId, status: "success" });
    });
    return this.getProposal(actor, opportunityId);
  }

  async submitForApproval(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: SubmitProposalForApprovalRequestBody): Promise<ProposalWorkspaceResponse> {
    this.assertEnabled();
    let opportunityName = "";
    await this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const { metadata, proposal } = await this.loadProposalMetadata(client, actor.tenantId, opportunityId);
      const versions = Array.isArray(proposal.versions) ? proposal.versions : [];
      if (!versions.some((raw) => getRecord(raw).id === input.versionId)) {
        throw new AppError(404, "Version was not found.", undefined, "NOT_FOUND");
      }
      const nameResult = await client.query<{ name: string }>(`SELECT name FROM opportunities WHERE id = $1 AND tenant_id = $2`, [opportunityId, actor.tenantId]);
      opportunityName = nameResult.rows[0]?.name ?? "";
      await this.writeProposal(client, actor, opportunityId, metadata, { ...proposal, pendingFinalVersionId: input.versionId, statusKey: "in_review" });
      await this.recordAuditLog(client, actor, audit, { action: "proposal.version.submit_for_approval", resourceType: "opportunity", resourceId: opportunityId, status: "success", metadata: { versionId: input.versionId } });
    });

    const approval = await this.approvalService.createApproval(actor, audit, {
      approvalType: "proposal_approval",
      title: `Proposal approval: ${opportunityName}`,
      description: trimmed(input.note ?? null) ?? "Approval required before final proposal submission (PB-003).",
      approverUserId: input.approverUserId,
      linkedRecord: { entityType: "opportunity", entityId: opportunityId },
      metadata: { opportunityId, versionId: input.versionId }
    });
    await this.databaseService.withTransaction(async (client) => {
      const { metadata, proposal } = await this.loadProposalMetadata(client, actor.tenantId, opportunityId);
      await this.writeProposal(client, actor, opportunityId, metadata, { ...proposal, approvalId: approval.approval.id });
    });
    return this.getProposal(actor, opportunityId);
  }

  async lockFinalVersion(actor: ActorContext, audit: AuditMetadata, opportunityId: string, versionId: string): Promise<ProposalWorkspaceResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const { metadata, proposal } = await this.loadProposalMetadata(client, actor.tenantId, opportunityId);
      const approvalId = str(proposal, "approvalId");
      if (!approvalId) {
        throw new AppError(409, "A proposal version must be approved before it can be locked as final.", undefined, "INVALID_STATE");
      }
      const approval = await client.query<{ status: string }>(`SELECT status FROM approval_requests WHERE id = $1 AND tenant_id = $2`, [approvalId, actor.tenantId]);
      if (approval.rows[0]?.status !== "approved") {
        throw new AppError(409, "The proposal approval is not approved yet.", undefined, "INVALID_STATE");
      }
      const rawVersions = Array.isArray(proposal.versions) ? proposal.versions : [];
      if (!rawVersions.some((raw) => getRecord(raw).id === versionId)) {
        throw new AppError(404, "Version was not found.", undefined, "NOT_FOUND");
      }
      const versions = rawVersions.map((raw) => {
        const version = getRecord(raw);
        if (version.id === versionId) {
          return { ...version, locked: true, isFinal: true };
        }
        return { ...version, isFinal: false };
      });
      await this.writeProposal(client, actor, opportunityId, metadata, { ...proposal, versions, finalVersionId: versionId, statusKey: "approved" });
      await this.recordAuditLog(client, actor, audit, { action: "proposal.version.lock_final", resourceType: "opportunity", resourceId: opportunityId, status: "success", metadata: { versionId } });
    });
    return this.getProposal(actor, opportunityId);
  }

  // PB-005
  async recordSubmission(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: RecordProposalSubmissionRequestBody): Promise<ProposalWorkspaceResponse> {
    this.assertEnabled();
    const submittedAt = trimmed(input.submittedAt);
    const mode = trimmed(input.mode);
    if (!submittedAt || !mode) {
      throw new AppError(400, "Submission date and mode are required.", undefined, "VALIDATION_ERROR");
    }
    const advanceStage = input.advanceStage !== false;
    await this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const { metadata, proposal } = await this.loadProposalMetadata(client, actor.tenantId, opportunityId);
      const submission = {
        submittedAt,
        mode,
        recipient: trimmed(input.recipient),
        documents: trimmed(input.documents),
        acknowledgement: trimmed(input.acknowledgement),
        remarks: trimmed(input.remarks),
        submittedBy: { id: actor.userId, displayName: actor.displayName, email: actor.email }
      };
      await this.writeProposal(client, actor, opportunityId, metadata, { ...proposal, submission, statusKey: "submitted" });
      // PB-005: follow-up task.
      await client.query(
        `
          INSERT INTO crm_tasks (tenant_id, entity_type, entity_id, owner_user_id, assignee_user_id, title, description, due_at, priority, status, metadata, created_by, updated_by)
          VALUES ($1, 'opportunity', $2, $3, $3, $4, $5, NOW() + interval '3 days', 'medium', 'open', $6::jsonb, $3, $3)
        `,
        [actor.tenantId, opportunityId, actor.userId, "Follow up on proposal submission", `Confirm receipt/acknowledgement for the proposal submitted on ${submittedAt}.`, JSON.stringify({ proposalFollowUp: true })]
      );
      await this.recordAuditLog(client, actor, audit, { action: "proposal.submission.record", resourceType: "opportunity", resourceId: opportunityId, status: "success", metadata: { mode } });
    });

    if (advanceStage) {
      try {
        await this.opportunityService.updateOpportunity(actor, audit, opportunityId, { stageKey: "proposal" });
      } catch {
        // Stage advance is best-effort; tenants may use a different pipeline.
      }
    }
    return this.getProposal(actor, opportunityId);
  }

  async getQueue(actor: ActorContext): Promise<ProposalQueueResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const statuses = await this.loadOptionValues(client, actor.tenantId, "proposal-request-status");
      const result = await client.query<{ id: string; name: string; account_name: string | null; metadata: Record<string, unknown> | null }>(
        `
          SELECT opportunities.id, opportunities.name, accounts.name AS account_name, opportunities.metadata
          FROM opportunities
          LEFT JOIN accounts ON accounts.id = opportunities.account_id AND accounts.tenant_id = opportunities.tenant_id
          WHERE opportunities.tenant_id = $1 AND opportunities.deleted_at IS NULL
            AND opportunities.metadata ? 'proposal'
          ORDER BY opportunities.updated_at DESC
          LIMIT 200
        `,
        [actor.tenantId]
      );
      return {
        requests: result.rows.map((row) => {
          const proposal = getRecord(getRecord(row.metadata).proposal);
          const compliance = evaluateProposalCompliance(this.mapComplianceItems(proposal));
          const versions = Array.isArray(proposal.versions) ? proposal.versions : [];
          const statusKey = str(proposal, "statusKey");
          return {
            opportunityId: row.id,
            opportunityName: row.name,
            accountName: row.account_name,
            status: statuses.find((value) => value.key === statusKey) ?? null,
            dueDate: str(proposal, "dueDate"),
            complianceComplete: compliance.complete,
            missingResponseCount: compliance.missingResponseCount,
            versionCount: versions.length,
            submitted: Boolean(getRecord(proposal.submission).submittedAt)
          };
        })
      };
    });
  }

  async getOptions(actor: ActorContext): Promise<ProposalOptionsResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const owners = await client.query<{ id: string; display_name: string; email: string }>(
        `SELECT id, display_name, email FROM users WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY display_name ASC LIMIT 500`,
        [actor.tenantId]
      );
      return {
        owners: owners.rows.map((row) => ({ id: row.id, displayName: row.display_name, email: row.email, teamName: null, departmentName: null })),
        templates: await this.loadOptionValues(client, actor.tenantId, "opportunity-proposal-template"),
        statuses: await this.loadOptionValues(client, actor.tenantId, "proposal-request-status"),
        contentCategories: await this.loadOptionValues(client, actor.tenantId, "proposal-content-category"),
        responseStatuses: [...proposalResponseStatuses],
        complianceStatuses: [...proposalComplianceStatuses]
      };
    });
  }

  // PB-004 content library
  private mapContentRow(row: ContentRow): ProposalContentEntry {
    return {
      id: row.id,
      category: row.category_id ? { id: row.category_id, key: row.category_key ?? "", label: row.category_label ?? "", description: row.category_description, color: row.category_color, isDefault: row.category_is_default ?? false, isActive: row.category_is_active ?? true } : null,
      title: row.title,
      body: row.body,
      status: row.status === "approved" ? "approved" : "draft",
      tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === "string") : [],
      expiresAt: row.expires_at,
      expired: isProposalContentExpired(row.expires_at),
      updatedBy: row.updated_by_id ? { id: row.updated_by_id, displayName: row.updated_by_name ?? "", email: row.updated_by_email ?? "", teamName: null, departmentName: null } : null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private contentSelect() {
    return `
      SELECT lib.id, lib.title, lib.body, lib.status, lib.tags, lib.expires_at, lib.created_at, lib.updated_at,
        cat.id AS category_id, cat.value_key AS category_key, cat.label AS category_label, cat.description AS category_description, cat.color AS category_color, cat.is_default AS category_is_default, cat.is_active AS category_is_active,
        u.id AS updated_by_id, u.display_name AS updated_by_name, u.email AS updated_by_email
      FROM proposal_content_library lib
      LEFT JOIN tenant_option_values cat ON cat.id = lib.category_option_id AND cat.tenant_id = lib.tenant_id
      LEFT JOIN users u ON u.id = lib.updated_by AND u.tenant_id = lib.tenant_id
    `;
  }

  async listContent(actor: ActorContext): Promise<ProposalContentLibraryResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const result = await client.query<ContentRow>(`${this.contentSelect()} WHERE lib.tenant_id = $1 AND lib.deleted_at IS NULL ORDER BY lib.updated_at DESC LIMIT 500`, [actor.tenantId]);
      return { entries: result.rows.map((row) => this.mapContentRow(row)) };
    });
  }

  async createContent(actor: ActorContext, audit: AuditMetadata, input: CreateProposalContentRequestBody): Promise<ProposalContentEntry> {
    this.assertEnabled();
    const title = trimmed(input.title);
    const body = trimmed(input.body);
    if (!title || !body) {
      throw new AppError(400, "Title and body are required.", undefined, "VALIDATION_ERROR");
    }
    return this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const category = await this.resolveOption(client, actor.tenantId, "proposal-content-category", input.categoryKey);
      const inserted = await client.query<{ id: string }>(
        `
          INSERT INTO proposal_content_library (tenant_id, category_option_id, title, body, status, tags, expires_at, created_by, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $8)
          RETURNING id
        `,
        [actor.tenantId, category.id, title, body, input.status === "approved" ? "approved" : "draft", JSON.stringify(Array.isArray(input.tags) ? input.tags : []), trimmed(input.expiresAt), actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "proposal.content.create", resourceType: "proposal_content", resourceId: inserted.rows[0].id, status: "success" });
      const row = await client.query<ContentRow>(`${this.contentSelect()} WHERE lib.id = $1 AND lib.tenant_id = $2`, [inserted.rows[0].id, actor.tenantId]);
      return this.mapContentRow(row.rows[0]);
    });
  }

  async updateContent(actor: ActorContext, audit: AuditMetadata, contentId: string, input: UpdateProposalContentRequestBody): Promise<ProposalContentEntry> {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const existing = await client.query<{ id: string }>(`SELECT id FROM proposal_content_library WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [contentId, actor.tenantId]);
      if (existing.rowCount === 0) {
        throw new AppError(404, "Content item was not found.", undefined, "NOT_FOUND");
      }
      const categoryId = input.categoryKey ? (await this.resolveOption(client, actor.tenantId, "proposal-content-category", input.categoryKey)).id : null;
      await client.query(
        `
          UPDATE proposal_content_library SET
            category_option_id = COALESCE($3, category_option_id),
            title = COALESCE($4, title),
            body = COALESCE($5, body),
            status = COALESCE($6, status),
            tags = COALESCE($7::jsonb, tags),
            expires_at = CASE WHEN $8 = true THEN $9::date ELSE expires_at END,
            updated_by = $10
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
        `,
        [
          contentId,
          actor.tenantId,
          categoryId,
          input.title !== undefined ? trimmed(input.title) : null,
          input.body !== undefined ? trimmed(input.body) : null,
          input.status !== undefined ? (input.status === "approved" ? "approved" : "draft") : null,
          input.tags !== undefined ? JSON.stringify(input.tags) : null,
          input.expiresAt !== undefined,
          input.expiresAt !== undefined ? trimmed(input.expiresAt) : null,
          actor.userId
        ]
      );
      await this.recordAuditLog(client, actor, audit, { action: "proposal.content.update", resourceType: "proposal_content", resourceId: contentId, status: "success" });
      const row = await client.query<ContentRow>(`${this.contentSelect()} WHERE lib.id = $1 AND lib.tenant_id = $2`, [contentId, actor.tenantId]);
      return this.mapContentRow(row.rows[0]);
    });
  }

  async deleteContent(actor: ActorContext, audit: AuditMetadata, contentId: string): Promise<{ success: true }> {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      const result = await client.query(`UPDATE proposal_content_library SET deleted_at = NOW(), updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [contentId, actor.tenantId, actor.userId]);
      if (result.rowCount === 0) {
        throw new AppError(404, "Content item was not found.", undefined, "NOT_FOUND");
      }
      await this.recordAuditLog(client, actor, audit, { action: "proposal.content.delete", resourceType: "proposal_content", resourceId: contentId, status: "success" });
      return { success: true };
    });
  }
}

interface ContentRow {
  id: string;
  title: string;
  body: string;
  status: string;
  tags: unknown;
  expires_at: string | null;
  created_at: Date;
  updated_at: Date;
  category_id: string | null;
  category_key: string | null;
  category_label: string | null;
  category_description: string | null;
  category_color: string | null;
  category_is_default: boolean | null;
  category_is_active: boolean | null;
  updated_by_id: string | null;
  updated_by_name: string | null;
  updated_by_email: string | null;
}
