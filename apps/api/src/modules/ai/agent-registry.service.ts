import {
  aiAgentDataScopes,
  aiAgentStatuses,
  defaultAiAgents,
  type AiAgent,
  type AiAgentDataScope,
  type AiAgentEscalationRule,
  type AiAgentListQuery,
  type AiAgentListResponse,
  type AiAgentResponse,
  type AiAgentStatus,
  type CreateAiAgentRequestBody,
  type RoleSummary,
  type UpdateAiAgentRequestBody
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

interface AgentRegistryConfig {
  enableAuditLogs: boolean;
}

interface AgentRow {
  id: string;
  agent_key: string;
  name: string;
  purpose: string;
  module: string;
  allowed_tools: unknown;
  allowed_roles: unknown;
  data_access_scope: string;
  requires_human_approval: boolean;
  status: string;
  logging_enabled: boolean;
  escalation_rules: unknown;
  is_system: boolean;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

const CREATE_PERMISSIONS = ["ai.create", "ai.configure", "ai.manage_ai"];
const CONFIGURE_PERMISSIONS = ["ai.edit", "ai.configure", "ai.manage_ai"];

function normalizeScope(value: unknown): AiAgentDataScope {
  return aiAgentDataScopes.includes(value as AiAgentDataScope) ? (value as AiAgentDataScope) : "module";
}

function normalizeStatus(value: unknown): AiAgentStatus {
  return aiAgentStatuses.includes(value as AiAgentStatus) ? (value as AiAgentStatus) : "draft";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function asEscalationRules(value: unknown): AiAgentEscalationRule[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map((entry) => ({
      trigger: typeof entry.trigger === "string" ? entry.trigger : "",
      action: typeof entry.action === "string" ? entry.action : "",
      escalateTo: typeof entry.escalateTo === "string" ? entry.escalateTo : ""
    }));
}

export class AgentRegistryService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: AgentRegistryConfig
  ) {}

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "The agent registry is unavailable until the database connection is enabled.", undefined, "AI_REGISTRY_UNAVAILABLE");
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
      `INSERT INTO audit_logs (tenant_id, actor_user_id, session_id, event_type, action, resource_type, resource_id, status, ip_address, user_agent, request_id, metadata) VALUES ($1, $2, $3, 'ai', $4, 'ai_agent', $5, $6, NULLIF($7, '')::inet, $8, $9, $10::jsonb)`,
      [actor.tenantId, actor.userId, actor.sessionId, input.action, input.resourceId, input.status, audit.ipAddress ?? "", audit.userAgent ?? null, audit.requestId, JSON.stringify(input.metadata ?? {})]
    );
  }

  private mapAgent(row: AgentRow): AiAgent {
    return {
      id: row.id,
      agentKey: row.agent_key,
      name: row.name,
      purpose: row.purpose,
      module: row.module,
      allowedTools: asStringArray(row.allowed_tools),
      allowedRoles: asStringArray(row.allowed_roles),
      dataAccessScope: normalizeScope(row.data_access_scope),
      requiresHumanApproval: row.requires_human_approval,
      status: normalizeStatus(row.status),
      loggingEnabled: row.logging_enabled,
      escalationRules: asEscalationRules(row.escalation_rules),
      isSystem: row.is_system,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      createdBy: row.created_by,
      updatedBy: row.updated_by
    };
  }

  // Seed the baseline system agents the first time a tenant reads the registry.
  // Existing agents are never overwritten so operator reconfiguration is preserved.
  private async ensureSeeded(client: PoolClient, actor: ActorContext) {
    for (const agent of defaultAiAgents) {
      await client.query(
        `INSERT INTO ai_agents (tenant_id, agent_key, name, purpose, module, allowed_tools, allowed_roles, data_access_scope, requires_human_approval, status, logging_enabled, escalation_rules, is_system, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, 'active', $10, $11::jsonb, TRUE, $12, $12)
         ON CONFLICT DO NOTHING`,
        [
          actor.tenantId,
          agent.key,
          agent.name,
          agent.purpose,
          agent.module,
          JSON.stringify(agent.allowedTools),
          JSON.stringify(agent.allowedRoles),
          agent.dataAccessScope,
          agent.requiresHumanApproval,
          agent.loggingEnabled,
          JSON.stringify(agent.escalationRules),
          actor.userId
        ]
      );
    }
  }

  private async loadAgentRow(client: PoolClient, tenantId: string, agentId: string): Promise<AgentRow> {
    const result = await client.query<AgentRow>(
      `SELECT id, agent_key, name, purpose, module, allowed_tools, allowed_roles, data_access_scope, requires_human_approval, status, logging_enabled, escalation_rules, is_system, created_at, updated_at, created_by, updated_by
       FROM ai_agents WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [agentId, tenantId]
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, "The requested agent was not found.", undefined, "AI_AGENT_NOT_FOUND");
    }
    return row;
  }

  async listAgents(actor: ActorContext, query: AiAgentListQuery): Promise<AiAgentListResponse> {
    this.assertEnabled();
    const agents = await this.databaseService.withTransaction(async (client) => {
      await this.ensureSeeded(client, actor);
      const conditions = ["tenant_id = $1", "deleted_at IS NULL"];
      const params: unknown[] = [actor.tenantId];
      if (query.module) {
        params.push(query.module);
        conditions.push(`module = $${params.length}`);
      }
      if (query.status) {
        params.push(query.status);
        conditions.push(`status = $${params.length}`);
      }
      if (query.search) {
        params.push(`%${query.search.toLowerCase()}%`);
        conditions.push(`(LOWER(name) LIKE $${params.length} OR LOWER(agent_key) LIKE $${params.length})`);
      }
      const result = await client.query<AgentRow>(
        `SELECT id, agent_key, name, purpose, module, allowed_tools, allowed_roles, data_access_scope, requires_human_approval, status, logging_enabled, escalation_rules, is_system, created_at, updated_at, created_by, updated_by
         FROM ai_agents WHERE ${conditions.join(" AND ")} ORDER BY name ASC`,
        params
      );
      return result.rows.map((row) => this.mapAgent(row));
    });
    return { agents };
  }

  async getAgent(actor: ActorContext, agentId: string): Promise<AiAgentResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const row = await this.loadAgentRow(client, actor.tenantId, agentId);
      return { agent: this.mapAgent(row) };
    });
  }

  async createAgent(actor: ActorContext, audit: AuditMetadata, input: CreateAiAgentRequestBody): Promise<AiAgentResponse> {
    this.assertEnabled();
    this.requirePermission(actor, CREATE_PERMISSIONS, "You do not have permission to create agents.");
    const agentKey = input.agentKey.trim().toLowerCase();

    const agent = await this.databaseService.withTransaction(async (client) => {
      const existing = await client.query<{ id: string }>(`SELECT id FROM ai_agents WHERE tenant_id = $1 AND agent_key = $2 AND deleted_at IS NULL LIMIT 1`, [actor.tenantId, agentKey]);
      if (existing.rows[0]) {
        throw new AppError(409, "An agent with this key already exists.", undefined, "AI_AGENT_KEY_EXISTS");
      }
      const inserted = await client.query<AgentRow>(
        `INSERT INTO ai_agents (tenant_id, agent_key, name, purpose, module, allowed_tools, allowed_roles, data_access_scope, requires_human_approval, status, logging_enabled, escalation_rules, is_system, metadata, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12::jsonb, FALSE, $13::jsonb, $14, $14)
         RETURNING id, agent_key, name, purpose, module, allowed_tools, allowed_roles, data_access_scope, requires_human_approval, status, logging_enabled, escalation_rules, is_system, created_at, updated_at, created_by, updated_by`,
        [
          actor.tenantId,
          agentKey,
          input.name.trim(),
          (input.purpose ?? "").trim(),
          (input.module ?? "general").trim(),
          JSON.stringify(asStringArray(input.allowedTools)),
          JSON.stringify(asStringArray(input.allowedRoles)),
          normalizeScope(input.dataAccessScope),
          input.requiresHumanApproval ?? true,
          normalizeStatus(input.status),
          input.loggingEnabled ?? true,
          JSON.stringify(asEscalationRules(input.escalationRules)),
          JSON.stringify(input.metadata ?? {}),
          actor.userId
        ]
      );
      const row = inserted.rows[0];
      await this.recordAuditLog(client, actor, audit, { action: "ai.agent.create", resourceId: row.id, status: "success", metadata: { agentKey } });
      return this.mapAgent(row);
    });

    return { agent };
  }

  async updateAgent(actor: ActorContext, audit: AuditMetadata, agentId: string, input: UpdateAiAgentRequestBody): Promise<AiAgentResponse> {
    this.assertEnabled();
    this.requirePermission(actor, CONFIGURE_PERMISSIONS, "You do not have permission to configure agents.");

    const agent = await this.databaseService.withTransaction(async (client) => {
      await this.loadAgentRow(client, actor.tenantId, agentId);
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateAiAgentRequestBody] !== undefined);
      if (keys.length === 0) {
        throw new AppError(400, "At least one field must be updated.", undefined, "VALIDATION_ERROR");
      }
      const assignments: string[] = [];
      const params: unknown[] = [agentId, actor.tenantId, actor.userId];
      const push = (column: string, value: unknown, cast = "") => {
        params.push(value);
        assignments.push(`${column} = $${params.length}${cast}`);
      };
      if (input.name !== undefined) push("name", input.name.trim());
      if (input.purpose !== undefined) push("purpose", input.purpose.trim());
      if (input.module !== undefined) push("module", input.module.trim());
      if (input.allowedTools !== undefined) push("allowed_tools", JSON.stringify(asStringArray(input.allowedTools)), "::jsonb");
      if (input.allowedRoles !== undefined) push("allowed_roles", JSON.stringify(asStringArray(input.allowedRoles)), "::jsonb");
      if (input.dataAccessScope !== undefined) push("data_access_scope", normalizeScope(input.dataAccessScope));
      if (input.requiresHumanApproval !== undefined) push("requires_human_approval", Boolean(input.requiresHumanApproval));
      if (input.status !== undefined) push("status", normalizeStatus(input.status));
      if (input.loggingEnabled !== undefined) push("logging_enabled", Boolean(input.loggingEnabled));
      if (input.escalationRules !== undefined) push("escalation_rules", JSON.stringify(asEscalationRules(input.escalationRules)), "::jsonb");
      if (input.metadata !== undefined) push("metadata", JSON.stringify(input.metadata), "::jsonb");
      await client.query(`UPDATE ai_agents SET ${assignments.join(", ")}, updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, params);
      await this.recordAuditLog(client, actor, audit, { action: "ai.agent.update", resourceId: agentId, status: "success", metadata: { updatedFields: keys } });
      const row = await this.loadAgentRow(client, actor.tenantId, agentId);
      return this.mapAgent(row);
    });

    return { agent };
  }
}
