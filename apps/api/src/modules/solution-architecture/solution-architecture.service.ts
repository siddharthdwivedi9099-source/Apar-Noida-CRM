import type {
  AddIntegrationAssessmentRequestBody,
  AddSecurityQuestionnaireVersionRequestBody,
  ArchitectureRecommendation,
  CrmLookupUserSummary,
  DeliveryRiskAssessment,
  DeliveryRiskDimension,
  IntegrationComplexity,
  RiskLevel,
  RoleSummary,
  SecurityQuestionnaireVersion,
  SolutionArchitectureResponse,
  SolutionArchitectureView,
  SolutionIntegrationAssessment,
  SubmitDeliveryRiskRequestBody,
  TechnicalDiscovery,
  TechnicalDiscoveryFieldKey,
  UpdateDeliveryRiskRequestBody,
  UpdateTechnicalDiscoveryRequestBody,
  UpsertArchitectureRequestBody
} from "@crm/types";
import {
  deliveryRiskDimensions,
  estimateIntegrationEffortDays,
  evaluateTechnicalDiscovery,
  integrationComplexities,
  riskLevels,
  summarizeDeliveryRisk,
  technicalDiscoveryFieldKeys
} from "@crm/types";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { NotificationService } from "../notifications/notifications.service.js";
import { ApprovalService } from "../approvals/approvals.service.js";

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

function normalizeRisk(value: unknown): RiskLevel {
  return value === "medium" || value === "high" ? value : "low";
}

function normalizeComplexity(value: unknown): IntegrationComplexity {
  return integrationComplexities.includes(value as IntegrationComplexity) ? (value as IntegrationComplexity) : "medium";
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

export class SolutionArchitectureService {
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
      throw new AppError(503, "Solution architecture is unavailable until the database connection is enabled.", undefined, "SOLUTION_ARCHITECTURE_UNAVAILABLE");
    }
  }

  private async recordAuditLog(
    client: PoolClient,
    actor: ActorContext,
    audit: AuditMetadata,
    input: { action: string; resourceId: string; status: "success" | "failure" | "denied" | "error"; metadata?: Record<string, unknown> }
  ) {
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

  private async loadOpportunityMetadata(client: PoolClient, tenantId: string, opportunityId: string): Promise<Record<string, unknown>> {
    const result = await client.query<{ metadata: Record<string, unknown> | null }>(
      `SELECT metadata FROM opportunities WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [opportunityId, tenantId]
    );
    if (result.rowCount === 0) {
      throw new AppError(404, "Opportunity was not found.", undefined, "NOT_FOUND");
    }
    return getRecord(result.rows[0].metadata);
  }

  private async writeArchitecture(client: PoolClient, actor: ActorContext, opportunityId: string, metadata: Record<string, unknown>, architecture: Record<string, unknown>) {
    await client.query(
      `UPDATE opportunities SET metadata = $3::jsonb, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [opportunityId, actor.tenantId, JSON.stringify({ ...metadata, architecture }), actor.userId]
    );
  }

  private mapView(opportunityId: string, architecture: Record<string, unknown>): SolutionArchitectureView {
    const discoveryRaw = getRecord(architecture.technicalDiscovery);
    const technicalDiscovery = { updatedAt: str(discoveryRaw, "updatedAt") } as TechnicalDiscovery;
    for (const key of technicalDiscoveryFieldKeys) {
      technicalDiscovery[key] = str(discoveryRaw, key);
    }

    const archRaw = getRecord(architecture.architecture);
    const architectureRecommendation: ArchitectureRecommendation = {
      frontend: str(archRaw, "frontend"),
      backend: str(archRaw, "backend"),
      database: str(archRaw, "database"),
      integrations: str(archRaw, "integrations"),
      aiLayer: str(archRaw, "aiLayer"),
      analytics: str(archRaw, "analytics"),
      security: str(archRaw, "security"),
      deployment: str(archRaw, "deployment"),
      support: str(archRaw, "support"),
      status: archRaw.status === "approved" ? "approved" : "draft",
      approvedBy: mapStoredUser(archRaw.approvedBy),
      approvedAt: str(archRaw, "approvedAt"),
      linkedToProposal: archRaw.linkedToProposal === true,
      updatedAt: str(archRaw, "updatedAt")
    };

    const integrationsRaw = Array.isArray(architecture.integrations) ? architecture.integrations : [];
    const integrations: SolutionIntegrationAssessment[] = integrationsRaw
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
      .map((entry) => {
        const complexity = normalizeComplexity(entry.complexity);
        return {
          id: typeof entry.id === "string" ? entry.id : randomUUID(),
          system: typeof entry.system === "string" ? entry.system : "",
          method: str(entry, "method"),
          apiAvailability: str(entry, "apiAvailability"),
          authentication: str(entry, "authentication"),
          frequency: str(entry, "frequency"),
          dataDirection: str(entry, "dataDirection"),
          complexity,
          owner: str(entry, "owner"),
          risk: normalizeRisk(entry.risk),
          effortDays: typeof entry.effortDays === "number" ? entry.effortDays : estimateIntegrationEffortDays(complexity)
        };
      });

    const securityRaw = getRecord(architecture.securityQuestionnaire);
    const versionsRaw = Array.isArray(securityRaw.versions) ? securityRaw.versions : [];
    const securityVersions: SecurityQuestionnaireVersion[] = versionsRaw
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
      .map((entry, index) => ({
        id: typeof entry.id === "string" ? entry.id : randomUUID(),
        version: typeof entry.version === "number" ? entry.version : index + 1,
        note: str(entry, "note"),
        items: (Array.isArray(entry.items) ? entry.items : [])
          .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
          .map((item) => ({ question: typeof item.question === "string" ? item.question : "", answer: str(item, "answer") })),
        createdBy: mapStoredUser(entry.createdBy),
        createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date(0).toISOString(),
        approved: entry.approved === true,
        approvedBy: mapStoredUser(entry.approvedBy),
        approvedAt: str(entry, "approvedAt")
      }));

    const riskRaw = getRecord(architecture.deliveryRisk);
    const dimensionsRaw = getRecord(riskRaw.dimensions);
    const dimensions = {} as DeliveryRiskAssessment["dimensions"];
    const levels: Partial<Record<DeliveryRiskDimension, RiskLevel>> = {};
    for (const dimension of deliveryRiskDimensions) {
      const entry = getRecord(dimensionsRaw[dimension]);
      const level = normalizeRisk(entry.level);
      dimensions[dimension] = { level, note: str(entry, "note") };
      levels[dimension] = level;
    }
    const statusValue = riskRaw.status;
    const deliveryRisk: DeliveryRiskAssessment = {
      dimensions,
      summary: summarizeDeliveryRisk(levels),
      status: statusValue === "submitted" || statusValue === "approved" || statusValue === "flagged" ? statusValue : "open",
      approvalId: typeof riskRaw.approvalId === "string" ? riskRaw.approvalId : null,
      updatedAt: str(riskRaw, "updatedAt")
    };

    return {
      opportunityId,
      technicalDiscovery,
      technicalDiscoveryStatus: evaluateTechnicalDiscovery(technicalDiscovery),
      architecture: architectureRecommendation,
      integrations,
      securityVersions,
      deliveryRisk,
      aiPlaceholders: { available: false, message: "AI requirement extraction, architecture drafting, and security-answer suggestions will connect with the governed AI Gateway." }
    };
  }

  async getArchitecture(actor: ActorContext, opportunityId: string): Promise<SolutionArchitectureResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const metadata = await this.loadOpportunityMetadata(client, actor.tenantId, opportunityId);
      const view = this.mapView(opportunityId, getRecord(metadata.architecture));
      // Close the loop: reflect the linked delivery-risk approval's current decision.
      if (view.deliveryRisk.approvalId) {
        const approval = await client.query<{ status: string }>(
          `SELECT status FROM approval_requests WHERE id = $1 AND tenant_id = $2`,
          [view.deliveryRisk.approvalId, actor.tenantId]
        );
        const approvalStatus = approval.rows[0]?.status;
        if (approvalStatus === "approved") {
          view.deliveryRisk.status = "approved";
        } else if (approvalStatus === "rejected") {
          view.deliveryRisk.status = "flagged";
        }
      }
      return { architecture: view };
    });
  }

  private assertArchitectMutation(actor: ActorContext) {
    const allowed = ["opportunities.edit", "opportunities.configure", "opportunities.manage_workflow", "opportunities.approve", "presales.edit", "presales.configure"];
    if (!allowed.some((code) => actor.permissionCodes.includes(code))) {
      throw new AppError(403, "You do not have permission to manage solution architecture.", undefined, "AUTHORIZATION_ERROR");
    }
  }

  // SA-001
  async updateTechnicalDiscovery(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: UpdateTechnicalDiscoveryRequestBody): Promise<SolutionArchitectureResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertArchitectMutation(actor);
      const metadata = await this.loadOpportunityMetadata(client, actor.tenantId, opportunityId);
      const architecture = getRecord(metadata.architecture);
      const discovery = getRecord(architecture.technicalDiscovery);
      const next: Record<string, unknown> = { ...discovery };
      for (const key of technicalDiscoveryFieldKeys) {
        if (input[key as TechnicalDiscoveryFieldKey] !== undefined) {
          next[key] = trimmed(input[key as TechnicalDiscoveryFieldKey]);
        }
      }
      next.updatedAt = new Date().toISOString();
      await this.writeArchitecture(client, actor, opportunityId, metadata, { ...architecture, technicalDiscovery: next });
      await this.recordAuditLog(client, actor, audit, { action: "architecture.technical_discovery.update", resourceId: opportunityId, status: "success" });
    });
    return this.getArchitecture(actor, opportunityId);
  }

  // SA-002
  async upsertArchitecture(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: UpsertArchitectureRequestBody): Promise<SolutionArchitectureResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertArchitectMutation(actor);
      const metadata = await this.loadOpportunityMetadata(client, actor.tenantId, opportunityId);
      const architecture = getRecord(metadata.architecture);
      const current = getRecord(architecture.architecture);
      const fields = ["frontend", "backend", "database", "integrations", "aiLayer", "analytics", "security", "deployment", "support"] as const;
      const next: Record<string, unknown> = { ...current };
      for (const field of fields) {
        if (input[field] !== undefined) {
          next[field] = trimmed(input[field]);
        }
      }
      if (input.linkedToProposal !== undefined) {
        next.linkedToProposal = Boolean(input.linkedToProposal);
      }
      // Any edit returns the recommendation to draft so re-approval is explicit.
      next.status = "draft";
      next.approvedBy = null;
      next.approvedAt = null;
      next.updatedAt = new Date().toISOString();
      await this.writeArchitecture(client, actor, opportunityId, metadata, { ...architecture, architecture: next });
      await this.recordAuditLog(client, actor, audit, { action: "architecture.recommendation.upsert", resourceId: opportunityId, status: "success" });
    });
    return this.getArchitecture(actor, opportunityId);
  }

  async approveArchitecture(actor: ActorContext, audit: AuditMetadata, opportunityId: string): Promise<SolutionArchitectureResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertArchitectMutation(actor);
      const metadata = await this.loadOpportunityMetadata(client, actor.tenantId, opportunityId);
      const architecture = getRecord(metadata.architecture);
      const current = getRecord(architecture.architecture);
      const next = { ...current, status: "approved", approvedBy: { id: actor.userId, displayName: actor.displayName, email: actor.email }, approvedAt: new Date().toISOString() };
      await this.writeArchitecture(client, actor, opportunityId, metadata, { ...architecture, architecture: next });
      await this.recordAuditLog(client, actor, audit, { action: "architecture.recommendation.approve", resourceId: opportunityId, status: "success" });
    });
    return this.getArchitecture(actor, opportunityId);
  }

  // SA-003
  async addIntegration(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: AddIntegrationAssessmentRequestBody): Promise<SolutionArchitectureResponse> {
    this.assertEnabled();
    const system = trimmed(input.system);
    if (!system) {
      throw new AppError(400, "An integration system name is required.", undefined, "VALIDATION_ERROR");
    }
    await this.databaseService.withTransaction(async (client) => {
      this.assertArchitectMutation(actor);
      const metadata = await this.loadOpportunityMetadata(client, actor.tenantId, opportunityId);
      const architecture = getRecord(metadata.architecture);
      const integrations = Array.isArray(architecture.integrations) ? architecture.integrations : [];
      const complexity = normalizeComplexity(input.complexity);
      const entry = {
        id: randomUUID(),
        system,
        method: trimmed(input.method),
        apiAvailability: trimmed(input.apiAvailability),
        authentication: trimmed(input.authentication),
        frequency: trimmed(input.frequency),
        dataDirection: trimmed(input.dataDirection),
        complexity,
        owner: trimmed(input.owner),
        risk: normalizeRisk(input.risk),
        effortDays: estimateIntegrationEffortDays(complexity)
      };
      await this.writeArchitecture(client, actor, opportunityId, metadata, { ...architecture, integrations: [...integrations, entry] });
      await this.recordAuditLog(client, actor, audit, { action: "architecture.integration.add", resourceId: opportunityId, status: "success" });
    });
    return this.getArchitecture(actor, opportunityId);
  }

  async removeIntegration(actor: ActorContext, audit: AuditMetadata, opportunityId: string, integrationId: string): Promise<SolutionArchitectureResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertArchitectMutation(actor);
      const metadata = await this.loadOpportunityMetadata(client, actor.tenantId, opportunityId);
      const architecture = getRecord(metadata.architecture);
      const integrations = (Array.isArray(architecture.integrations) ? architecture.integrations : []).filter((entry) => getRecord(entry).id !== integrationId);
      await this.writeArchitecture(client, actor, opportunityId, metadata, { ...architecture, integrations });
      await this.recordAuditLog(client, actor, audit, { action: "architecture.integration.remove", resourceId: opportunityId, status: "success", metadata: { integrationId } });
    });
    return this.getArchitecture(actor, opportunityId);
  }

  // SA-004
  async addSecurityVersion(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: AddSecurityQuestionnaireVersionRequestBody): Promise<SolutionArchitectureResponse> {
    this.assertEnabled();
    const items = (Array.isArray(input.items) ? input.items : [])
      .map((item) => ({ question: trimmed(item.question) ?? "", answer: trimmed(item.answer) }))
      .filter((item) => item.question.length > 0);
    if (items.length === 0) {
      throw new AppError(400, "At least one questionnaire item with a question is required.", undefined, "VALIDATION_ERROR");
    }
    await this.databaseService.withTransaction(async (client) => {
      this.assertArchitectMutation(actor);
      const metadata = await this.loadOpportunityMetadata(client, actor.tenantId, opportunityId);
      const architecture = getRecord(metadata.architecture);
      const security = getRecord(architecture.securityQuestionnaire);
      const versions = Array.isArray(security.versions) ? security.versions : [];
      const entry = {
        id: randomUUID(),
        version: versions.length + 1,
        note: trimmed(input.note),
        items,
        createdBy: { id: actor.userId, displayName: actor.displayName, email: actor.email },
        createdAt: new Date().toISOString(),
        approved: false,
        approvedBy: null,
        approvedAt: null
      };
      await this.writeArchitecture(client, actor, opportunityId, metadata, { ...architecture, securityQuestionnaire: { versions: [...versions, entry] } });
      await this.recordAuditLog(client, actor, audit, { action: "architecture.security.version_add", resourceId: opportunityId, status: "success" });
    });
    return this.getArchitecture(actor, opportunityId);
  }

  async approveSecurityVersion(actor: ActorContext, audit: AuditMetadata, opportunityId: string, versionId: string): Promise<SolutionArchitectureResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertArchitectMutation(actor);
      const metadata = await this.loadOpportunityMetadata(client, actor.tenantId, opportunityId);
      const architecture = getRecord(metadata.architecture);
      const security = getRecord(architecture.securityQuestionnaire);
      const versions = (Array.isArray(security.versions) ? security.versions : []).map((entry) => {
        const record = getRecord(entry);
        if (record.id === versionId) {
          return { ...record, approved: true, approvedBy: { id: actor.userId, displayName: actor.displayName, email: actor.email }, approvedAt: new Date().toISOString() };
        }
        return record;
      });
      await this.writeArchitecture(client, actor, opportunityId, metadata, { ...architecture, securityQuestionnaire: { versions } });
      await this.recordAuditLog(client, actor, audit, { action: "architecture.security.version_approve", resourceId: opportunityId, status: "success", metadata: { versionId } });
    });
    return this.getArchitecture(actor, opportunityId);
  }

  // SA-005
  async updateDeliveryRisk(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: UpdateDeliveryRiskRequestBody): Promise<SolutionArchitectureResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      this.assertArchitectMutation(actor);
      const metadata = await this.loadOpportunityMetadata(client, actor.tenantId, opportunityId);
      const architecture = getRecord(metadata.architecture);
      const risk = getRecord(architecture.deliveryRisk);
      const dimensions = getRecord(risk.dimensions);
      const next: Record<string, unknown> = { ...dimensions };
      for (const dimension of deliveryRiskDimensions) {
        const provided = input.dimensions?.[dimension];
        if (provided) {
          next[dimension] = { level: riskLevels.includes(provided.level) ? provided.level : "low", note: trimmed(provided.note ?? null) };
        }
      }
      await this.writeArchitecture(client, actor, opportunityId, metadata, { ...architecture, deliveryRisk: { ...risk, dimensions: next, status: risk.status === "approved" ? "open" : risk.status ?? "open", updatedAt: new Date().toISOString() } });
      await this.recordAuditLog(client, actor, audit, { action: "architecture.delivery_risk.update", resourceId: opportunityId, status: "success" });
    });
    return this.getArchitecture(actor, opportunityId);
  }

  async submitDeliveryRisk(actor: ActorContext, audit: AuditMetadata, opportunityId: string, input: SubmitDeliveryRiskRequestBody): Promise<SolutionArchitectureResponse> {
    this.assertEnabled();
    let requiresApproval = false;
    let opportunityName = "";
    await this.databaseService.withTransaction(async (client) => {
      this.assertArchitectMutation(actor);
      const nameResult = await client.query<{ name: string }>(`SELECT name FROM opportunities WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [opportunityId, actor.tenantId]);
      if (nameResult.rowCount === 0) {
        throw new AppError(404, "Opportunity was not found.", undefined, "NOT_FOUND");
      }
      opportunityName = nameResult.rows[0].name;
      const metadata = await this.loadOpportunityMetadata(client, actor.tenantId, opportunityId);
      const architecture = getRecord(metadata.architecture);
      const risk = getRecord(architecture.deliveryRisk);
      const dimensions = getRecord(risk.dimensions);
      const levels: Partial<Record<DeliveryRiskDimension, RiskLevel>> = {};
      for (const dimension of deliveryRiskDimensions) {
        levels[dimension] = normalizeRisk(getRecord(dimensions[dimension]).level);
      }
      requiresApproval = summarizeDeliveryRisk(levels).requiresLeadershipApproval;
      const nextStatus = requiresApproval ? "submitted" : "approved";
      await this.writeArchitecture(client, actor, opportunityId, metadata, { ...architecture, deliveryRisk: { ...risk, dimensions, status: nextStatus, updatedAt: new Date().toISOString() } });
      await this.recordAuditLog(client, actor, audit, { action: "architecture.delivery_risk.submit", resourceId: opportunityId, status: "success", metadata: { requiresApproval } });
    });

    if (requiresApproval) {
      const approval = await this.approvalService.createApproval(actor, audit, {
        approvalType: "delivery_risk_approval",
        title: `Delivery risk sign-off: ${opportunityName}`,
        description: trimmed(input.note ?? null) ?? "High delivery risk requires leadership approval before closure (SA-005).",
        approverUserId: input.approverUserId ?? null,
        linkedRecord: { entityType: "opportunity", entityId: opportunityId },
        metadata: { opportunityId }
      });
      // Persist the approval id so the architecture view can reflect the decision.
      await this.databaseService.withTransaction(async (client) => {
        const metadata = await this.loadOpportunityMetadata(client, actor.tenantId, opportunityId);
        const architecture = getRecord(metadata.architecture);
        const risk = getRecord(architecture.deliveryRisk);
        await this.writeArchitecture(client, actor, opportunityId, metadata, { ...architecture, deliveryRisk: { ...risk, approvalId: approval.approval.id } });
      });
    }

    return this.getArchitecture(actor, opportunityId);
  }
}
