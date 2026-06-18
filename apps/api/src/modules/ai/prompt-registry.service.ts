import {
  aiApprovalStatuses,
  aiPromptRoles,
  type AiApprovalStatus,
  type AiPromptDetail,
  type AiPromptListQuery,
  type AiPromptListResponse,
  type AiPromptResponse,
  type AiPromptRole,
  type AiPromptSummary,
  type AiPromptVersion,
  type AiPromptVersionsResponse,
  type CreateAiPromptRequestBody,
  type CreateAiPromptVersionRequestBody,
  type RoleSummary,
  type UpdateAiPromptApprovalRequestBody,
  type UpdateAiPromptRequestBody
} from "@crm/types";
import type { PoolClient } from "pg";
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

interface PromptRegistryConfig {
  enableAuditLogs: boolean;
}

interface PromptRow {
  id: string;
  prompt_key: string;
  name: string;
  description: string;
  module: string;
  prompt_role: string;
  input_schema: unknown;
  output_schema: unknown;
  guardrails: unknown;
  approval_status: string;
  is_active: boolean;
  current_version: number;
  latest_version: number;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

interface VersionRow {
  id: string;
  version: number;
  content: string;
  input_schema: unknown;
  output_schema: unknown;
  guardrails: unknown;
  change_summary: string;
  approval_status: string;
  is_active: boolean;
  created_at: Date;
  created_by: string | null;
}

const CREATE_PERMISSIONS = ["ai.create", "ai.configure", "ai.manage_ai"];
const EDIT_PERMISSIONS = ["ai.edit", "ai.configure", "ai.manage_ai"];
const ACTIVATE_PERMISSIONS = ["ai.configure", "ai.manage_ai"];
const APPROVE_PERMISSIONS = ["ai.approve", "ai.configure", "ai.manage_ai"];

function normalizeRole(value: unknown): AiPromptRole {
  return aiPromptRoles.includes(value as AiPromptRole) ? (value as AiPromptRole) : "system";
}

function normalizeApproval(value: unknown): AiApprovalStatus {
  return aiApprovalStatuses.includes(value as AiApprovalStatus) ? (value as AiApprovalStatus) : "draft";
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

export class PromptRegistryService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: PromptRegistryConfig
  ) {}

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "The prompt registry is unavailable until the database connection is enabled.", undefined, "AI_REGISTRY_UNAVAILABLE");
    }
  }

  private requirePermission(actor: ActorContext, permissions: string[], message: string) {
    if (!permissions.some((code) => actor.permissionCodes.includes(code))) {
      throw new AppError(403, message, undefined, "AUTHORIZATION_ERROR");
    }
  }

  private async recordAuditLog(client: PoolClient, actor: ActorContext, audit: AuditMetadata, input: { action: string; resourceId: string; status: "success" | "failure"; metadata?: Record<string, unknown> }) {
    if (!this.config.enableAuditLogs) {
      return;
    }
    await client.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, session_id, event_type, action, resource_type, resource_id, status, ip_address, user_agent, request_id, metadata) VALUES ($1, $2, $3, 'ai', $4, 'ai_prompt', $5, $6, NULLIF($7, '')::inet, $8, $9, $10::jsonb)`,
      [actor.tenantId, actor.userId, actor.sessionId, input.action, input.resourceId, input.status, audit.ipAddress ?? "", audit.userAgent ?? null, audit.requestId, JSON.stringify(input.metadata ?? {})]
    );
  }

  private mapVersion(row: VersionRow): AiPromptVersion {
    return {
      id: row.id,
      version: row.version,
      content: row.content,
      inputSchema: asObject(row.input_schema),
      outputSchema: asObject(row.output_schema),
      guardrails: asStringArray(row.guardrails),
      changeSummary: row.change_summary,
      approvalStatus: normalizeApproval(row.approval_status),
      isActive: row.is_active,
      createdAt: row.created_at.toISOString(),
      createdBy: row.created_by
    };
  }

  private mapSummary(row: PromptRow): AiPromptSummary {
    return {
      id: row.id,
      promptKey: row.prompt_key,
      name: row.name,
      description: row.description,
      module: row.module,
      promptRole: normalizeRole(row.prompt_role),
      approvalStatus: normalizeApproval(row.approval_status),
      isActive: row.is_active,
      currentVersion: row.current_version,
      latestVersion: row.latest_version,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      createdBy: row.created_by,
      updatedBy: row.updated_by
    };
  }

  private async loadPromptRow(client: PoolClient, tenantId: string, promptId: string): Promise<PromptRow> {
    const result = await client.query<PromptRow>(
      `SELECT id, prompt_key, name, description, module, prompt_role, input_schema, output_schema, guardrails, approval_status, is_active, current_version, latest_version, created_at, updated_at, created_by, updated_by
       FROM ai_prompts WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [promptId, tenantId]
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, "The requested prompt was not found.", undefined, "AI_PROMPT_NOT_FOUND");
    }
    return row;
  }

  private async loadVersions(client: PoolClient, tenantId: string, promptId: string): Promise<VersionRow[]> {
    const result = await client.query<VersionRow>(
      `SELECT id, version, content, input_schema, output_schema, guardrails, change_summary, approval_status, is_active, created_at, created_by
       FROM ai_prompt_versions WHERE tenant_id = $1 AND prompt_id = $2 ORDER BY version DESC`,
      [tenantId, promptId]
    );
    return result.rows;
  }

  private buildDetail(promptRow: PromptRow, versionRows: VersionRow[]): AiPromptDetail {
    const versions = versionRows.map((row) => this.mapVersion(row));
    const activeVersion = versions.find((version) => version.version === promptRow.current_version) ?? versions[0];
    return {
      ...this.mapSummary(promptRow),
      inputSchema: asObject(promptRow.input_schema),
      outputSchema: asObject(promptRow.output_schema),
      guardrails: asStringArray(promptRow.guardrails),
      activeContent: activeVersion?.content ?? "",
      versions
    };
  }

  async createPrompt(actor: ActorContext, audit: AuditMetadata, input: CreateAiPromptRequestBody): Promise<AiPromptResponse> {
    this.assertEnabled();
    this.requirePermission(actor, CREATE_PERMISSIONS, "You do not have permission to create prompts.");
    const promptKey = input.promptKey.trim().toLowerCase();
    const guardrails = (input.guardrails ?? []).map((rule) => rule.trim()).filter((rule) => rule.length > 0);

    const prompt = await this.databaseService.withTransaction(async (client) => {
      const existing = await client.query<{ id: string }>(`SELECT id FROM ai_prompts WHERE tenant_id = $1 AND prompt_key = $2 AND deleted_at IS NULL LIMIT 1`, [actor.tenantId, promptKey]);
      if (existing.rows[0]) {
        throw new AppError(409, "A prompt with this key already exists.", undefined, "AI_PROMPT_KEY_EXISTS");
      }
      const inserted = await client.query<PromptRow>(
        `INSERT INTO ai_prompts (tenant_id, prompt_key, name, description, module, prompt_role, input_schema, output_schema, guardrails, approval_status, is_active, current_version, latest_version, metadata, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, 'draft', FALSE, 1, 1, $10::jsonb, $11, $11)
         RETURNING id, prompt_key, name, description, module, prompt_role, input_schema, output_schema, guardrails, approval_status, is_active, current_version, latest_version, created_at, updated_at, created_by, updated_by`,
        [
          actor.tenantId,
          promptKey,
          input.name.trim(),
          (input.description ?? "").trim(),
          (input.module ?? "general").trim(),
          normalizeRole(input.promptRole),
          JSON.stringify(input.inputSchema ?? {}),
          JSON.stringify(input.outputSchema ?? {}),
          JSON.stringify(guardrails),
          JSON.stringify(input.metadata ?? {}),
          actor.userId
        ]
      );
      const promptRow = inserted.rows[0];
      await client.query(
        `INSERT INTO ai_prompt_versions (tenant_id, prompt_id, version, content, input_schema, output_schema, guardrails, change_summary, approval_status, is_active, created_by)
         VALUES ($1, $2, 1, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, 'draft', TRUE, $8)`,
        [actor.tenantId, promptRow.id, input.content, JSON.stringify(input.inputSchema ?? {}), JSON.stringify(input.outputSchema ?? {}), JSON.stringify(guardrails), (input.changeSummary ?? "Initial version").trim(), actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "ai.prompt.create", resourceId: promptRow.id, status: "success", metadata: { promptKey } });
      const versions = await this.loadVersions(client, actor.tenantId, promptRow.id);
      return this.buildDetail(promptRow, versions);
    });

    return { prompt };
  }

  async listPrompts(actor: ActorContext, query: AiPromptListQuery): Promise<AiPromptListResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const page = Math.max(1, query.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
      const conditions = ["tenant_id = $1", "deleted_at IS NULL"];
      const params: unknown[] = [actor.tenantId];
      if (query.module) {
        params.push(query.module);
        conditions.push(`module = $${params.length}`);
      }
      if (query.approvalStatus) {
        params.push(query.approvalStatus);
        conditions.push(`approval_status = $${params.length}`);
      }
      if (query.isActive === "true" || query.isActive === "false") {
        params.push(query.isActive === "true");
        conditions.push(`is_active = $${params.length}`);
      }
      if (query.search) {
        params.push(`%${query.search.toLowerCase()}%`);
        conditions.push(`(LOWER(name) LIKE $${params.length} OR LOWER(prompt_key) LIKE $${params.length})`);
      }
      const whereClause = conditions.join(" AND ");
      const countResult = await client.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM ai_prompts WHERE ${whereClause}`, params);
      const total = Number(countResult.rows[0]?.total ?? "0");
      const listParams = [...params, pageSize, (page - 1) * pageSize];
      const listResult = await client.query<PromptRow>(
        `SELECT id, prompt_key, name, description, module, prompt_role, input_schema, output_schema, guardrails, approval_status, is_active, current_version, latest_version, created_at, updated_at, created_by, updated_by
         FROM ai_prompts WHERE ${whereClause} ORDER BY updated_at DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams
      );
      const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
      return {
        prompts: listResult.rows.map((row) => this.mapSummary(row)),
        pagination: { page, pageSize, total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 }
      };
    });
  }

  async getPrompt(actor: ActorContext, promptId: string): Promise<AiPromptResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const promptRow = await this.loadPromptRow(client, actor.tenantId, promptId);
      const versions = await this.loadVersions(client, actor.tenantId, promptId);
      return { prompt: this.buildDetail(promptRow, versions) };
    });
  }

  async listVersions(actor: ActorContext, promptId: string): Promise<AiPromptVersionsResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      await this.loadPromptRow(client, actor.tenantId, promptId);
      const versions = await this.loadVersions(client, actor.tenantId, promptId);
      return { promptId, versions: versions.map((row) => this.mapVersion(row)) };
    });
  }

  async updatePrompt(actor: ActorContext, audit: AuditMetadata, promptId: string, input: UpdateAiPromptRequestBody): Promise<AiPromptResponse> {
    this.assertEnabled();
    this.requirePermission(actor, EDIT_PERMISSIONS, "You do not have permission to edit prompts.");

    const prompt = await this.databaseService.withTransaction(async (client) => {
      await this.loadPromptRow(client, actor.tenantId, promptId);
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateAiPromptRequestBody] !== undefined);
      if (keys.length === 0) {
        throw new AppError(400, "At least one field must be updated.", undefined, "VALIDATION_ERROR");
      }
      const assignments: string[] = [];
      const params: unknown[] = [promptId, actor.tenantId, actor.userId];
      const push = (column: string, value: unknown, cast = "") => {
        params.push(value);
        assignments.push(`${column} = $${params.length}${cast}`);
      };
      if (input.name !== undefined) push("name", input.name.trim());
      if (input.description !== undefined) push("description", input.description.trim());
      if (input.module !== undefined) push("module", input.module.trim());
      if (input.promptRole !== undefined) push("prompt_role", normalizeRole(input.promptRole));
      if (input.metadata !== undefined) push("metadata", JSON.stringify(input.metadata), "::jsonb");
      await client.query(`UPDATE ai_prompts SET ${assignments.join(", ")}, updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, params);
      await this.recordAuditLog(client, actor, audit, { action: "ai.prompt.update", resourceId: promptId, status: "success", metadata: { updatedFields: keys } });
      const promptRow = await this.loadPromptRow(client, actor.tenantId, promptId);
      const versions = await this.loadVersions(client, actor.tenantId, promptId);
      return this.buildDetail(promptRow, versions);
    });

    return { prompt };
  }

  async createVersion(actor: ActorContext, audit: AuditMetadata, promptId: string, input: CreateAiPromptVersionRequestBody): Promise<AiPromptResponse> {
    this.assertEnabled();
    this.requirePermission(actor, EDIT_PERMISSIONS, "You do not have permission to version prompts.");
    const guardrails = (input.guardrails ?? []).map((rule) => rule.trim()).filter((rule) => rule.length > 0);

    const prompt = await this.databaseService.withTransaction(async (client) => {
      const promptRow = await this.loadPromptRow(client, actor.tenantId, promptId);
      const nextVersion = promptRow.latest_version + 1;
      const inputSchema = input.inputSchema ?? asObject(promptRow.input_schema);
      const outputSchema = input.outputSchema ?? asObject(promptRow.output_schema);
      const effectiveGuardrails = input.guardrails === undefined ? asStringArray(promptRow.guardrails) : guardrails;
      await client.query(
        `INSERT INTO ai_prompt_versions (tenant_id, prompt_id, version, content, input_schema, output_schema, guardrails, change_summary, approval_status, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, 'draft', $9, $10)`,
        [actor.tenantId, promptId, nextVersion, input.content, JSON.stringify(inputSchema), JSON.stringify(outputSchema), JSON.stringify(effectiveGuardrails), (input.changeSummary ?? `Version ${nextVersion}`).trim(), input.activate === true, actor.userId]
      );
      // A new version resets review state. Activation of a draft version moves the
      // pointer but the prompt stays inactive until the version is approved.
      if (input.activate === true) {
        await client.query(`UPDATE ai_prompt_versions SET is_active = (version = $3) WHERE tenant_id = $1 AND prompt_id = $2`, [actor.tenantId, promptId, nextVersion]);
        await client.query(
          `UPDATE ai_prompts SET latest_version = $3, current_version = $3, approval_status = 'draft', is_active = FALSE, input_schema = $4::jsonb, output_schema = $5::jsonb, guardrails = $6::jsonb, updated_by = $7 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          [promptId, actor.tenantId, nextVersion, JSON.stringify(inputSchema), JSON.stringify(outputSchema), JSON.stringify(effectiveGuardrails), actor.userId]
        );
      } else {
        await client.query(`UPDATE ai_prompts SET latest_version = $3, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [promptId, actor.tenantId, nextVersion, actor.userId]);
      }
      await this.recordAuditLog(client, actor, audit, { action: "ai.prompt.version", resourceId: promptId, status: "success", metadata: { version: nextVersion, activated: input.activate === true } });
      const updatedRow = await this.loadPromptRow(client, actor.tenantId, promptId);
      const versions = await this.loadVersions(client, actor.tenantId, promptId);
      return this.buildDetail(updatedRow, versions);
    });

    return { prompt };
  }

  async activateVersion(actor: ActorContext, audit: AuditMetadata, promptId: string, version: number): Promise<AiPromptResponse> {
    this.assertEnabled();
    this.requirePermission(actor, ACTIVATE_PERMISSIONS, "You do not have permission to activate prompt versions.");

    const prompt = await this.databaseService.withTransaction(async (client) => {
      await this.loadPromptRow(client, actor.tenantId, promptId);
      const target = await client.query<VersionRow>(`SELECT id, version, content, input_schema, output_schema, guardrails, change_summary, approval_status, is_active, created_at, created_by FROM ai_prompt_versions WHERE tenant_id = $1 AND prompt_id = $2 AND version = $3 LIMIT 1`, [actor.tenantId, promptId, version]);
      const targetRow = target.rows[0];
      if (!targetRow) {
        throw new AppError(404, "The requested prompt version was not found.", undefined, "AI_PROMPT_VERSION_NOT_FOUND");
      }
      await client.query(`UPDATE ai_prompt_versions SET is_active = (version = $3) WHERE tenant_id = $1 AND prompt_id = $2`, [actor.tenantId, promptId, version]);
      await client.query(
        `UPDATE ai_prompts SET current_version = $3, input_schema = $4::jsonb, output_schema = $5::jsonb, guardrails = $6::jsonb, updated_by = $7 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [promptId, actor.tenantId, version, JSON.stringify(asObject(targetRow.input_schema)), JSON.stringify(asObject(targetRow.output_schema)), JSON.stringify(asStringArray(targetRow.guardrails)), actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "ai.prompt.version.activate", resourceId: promptId, status: "success", metadata: { version } });
      const updatedRow = await this.loadPromptRow(client, actor.tenantId, promptId);
      const versions = await this.loadVersions(client, actor.tenantId, promptId);
      return this.buildDetail(updatedRow, versions);
    });

    return { prompt };
  }

  async setApproval(actor: ActorContext, audit: AuditMetadata, promptId: string, input: UpdateAiPromptApprovalRequestBody): Promise<AiPromptResponse> {
    this.assertEnabled();
    this.requirePermission(actor, APPROVE_PERMISSIONS, "You do not have permission to change prompt approval status.");
    const approvalStatus = normalizeApproval(input.approvalStatus);

    const prompt = await this.databaseService.withTransaction(async (client) => {
      const promptRow = await this.loadPromptRow(client, actor.tenantId, promptId);
      await client.query(`UPDATE ai_prompts SET approval_status = $3, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [promptId, actor.tenantId, approvalStatus, actor.userId]);
      await client.query(`UPDATE ai_prompt_versions SET approval_status = $4 WHERE tenant_id = $1 AND prompt_id = $2 AND version = $3`, [actor.tenantId, promptId, promptRow.current_version, approvalStatus]);
      await this.recordAuditLog(client, actor, audit, { action: "ai.prompt.approval", resourceId: promptId, status: "success", metadata: { approvalStatus } });
      const updatedRow = await this.loadPromptRow(client, actor.tenantId, promptId);
      const versions = await this.loadVersions(client, actor.tenantId, promptId);
      return this.buildDetail(updatedRow, versions);
    });

    return { prompt };
  }

  async setActive(actor: ActorContext, audit: AuditMetadata, promptId: string, isActive: boolean): Promise<AiPromptResponse> {
    this.assertEnabled();
    this.requirePermission(actor, ACTIVATE_PERMISSIONS, "You do not have permission to activate or deactivate prompts.");

    const prompt = await this.databaseService.withTransaction(async (client) => {
      const promptRow = await this.loadPromptRow(client, actor.tenantId, promptId);
      // Governance: a prompt can only be activated once its current version is approved.
      if (isActive && normalizeApproval(promptRow.approval_status) !== "approved") {
        throw new AppError(400, "A prompt must be approved before it can be activated.", undefined, "AI_PROMPT_NOT_APPROVED");
      }
      await client.query(`UPDATE ai_prompts SET is_active = $3, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [promptId, actor.tenantId, isActive, actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: isActive ? "ai.prompt.activate" : "ai.prompt.deactivate", resourceId: promptId, status: "success", metadata: { isActive } });
      const updatedRow = await this.loadPromptRow(client, actor.tenantId, promptId);
      const versions = await this.loadVersions(client, actor.tenantId, promptId);
      return this.buildDetail(updatedRow, versions);
    });

    return { prompt };
  }
}
