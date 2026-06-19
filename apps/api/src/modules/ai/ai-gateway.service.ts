import { randomUUID } from "node:crypto";
import { createAiProviderRegistry, type AiProvider, type AiProviderKey } from "@crm/ai";
import {
  aiProviderKeys,
  aiProviderLabels,
  defaultAiPromptTemplates,
  type AiGatewayRequestBody,
  type AiGatewayResponse,
  type AiProvidersResponse,
  type AiSettings,
  type AiSettingsResponse,
  type AiTemplatesResponse,
  type AiUsageLogListQuery,
  type AiUsageLogsResponse,
  type AiUsageStatus,
  type AiUsageSummaryResponse,
  type RoleSummary,
  type UpdateAiSettingsRequestBody
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

export interface AiGatewayConfig {
  enableAuditLogs: boolean;
  gatewayEnabled: boolean;
  defaultProvider: AiProviderKey;
  defaultModel: string;
  rateLimitPerMinute: number;
  providerConfig: {
    openaiApiKey?: string;
    anthropicApiKey?: string;
    azureOpenAiApiKey?: string;
    azureOpenAiEndpoint?: string;
    localEndpoint?: string;
  };
}

interface SettingsRow {
  is_enabled: boolean;
  default_provider: string;
  default_model: string;
  rate_limit_per_minute: number;
  allow_user_overrides: boolean;
  redaction_enabled: boolean;
  logging_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

function normalizeProvider(value: unknown, fallback: AiProviderKey): AiProviderKey {
  return aiProviderKeys.includes(value as AiProviderKey) ? (value as AiProviderKey) : fallback;
}

export class AiGatewayService {
  private readonly providerRegistry: Map<AiProviderKey, AiProvider>;
  private readonly templateMap = new Map(defaultAiPromptTemplates.map((template) => [template.key, template]));

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: AiGatewayConfig
  ) {
    this.providerRegistry = createAiProviderRegistry(config.providerConfig);
  }

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "The AI gateway is unavailable until the database connection is enabled.", undefined, "AI_GATEWAY_UNAVAILABLE");
    }
  }

  private async recordAuditLog(client: PoolClient, actor: ActorContext, audit: AuditMetadata, input: { action: string; resourceType: string; resourceId?: string | null; status: "success" | "failure" | "denied" | "error"; metadata?: Record<string, unknown> }) {
    if (!this.config.enableAuditLogs) {
      return;
    }
    await client.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, session_id, event_type, action, resource_type, resource_id, status, ip_address, user_agent, request_id, metadata) VALUES ($1, $2, $3, 'ai', $4, $5, $6, $7, NULLIF($8, '')::inet, $9, $10, $11::jsonb)`,
      [actor.tenantId, actor.userId, actor.sessionId, input.action, input.resourceType, input.resourceId ?? null, input.status, audit.ipAddress ?? "", audit.userAgent ?? null, audit.requestId, JSON.stringify(input.metadata ?? {})]
    );
  }

  private mapSettings(row: SettingsRow): AiSettings {
    return {
      isEnabled: row.is_enabled,
      defaultProvider: normalizeProvider(row.default_provider, this.config.defaultProvider),
      defaultModel: row.default_model,
      rateLimitPerMinute: row.rate_limit_per_minute,
      allowUserOverrides: row.allow_user_overrides,
      redactionEnabled: row.redaction_enabled,
      loggingEnabled: row.logging_enabled,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private async ensureSettingsRow(client: PoolClient, actor: ActorContext): Promise<SettingsRow> {
    const existing = await client.query<SettingsRow>(
      `SELECT is_enabled, default_provider, default_model, rate_limit_per_minute, allow_user_overrides, redaction_enabled, logging_enabled, created_at, updated_at FROM ai_settings WHERE tenant_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [actor.tenantId]
    );
    if (existing.rows[0]) {
      return existing.rows[0];
    }
    const inserted = await client.query<SettingsRow>(
      `INSERT INTO ai_settings (tenant_id, is_enabled, default_provider, default_model, rate_limit_per_minute, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING is_enabled, default_provider, default_model, rate_limit_per_minute, allow_user_overrides, redaction_enabled, logging_enabled, created_at, updated_at`,
      [actor.tenantId, this.config.gatewayEnabled, this.config.defaultProvider, this.config.defaultModel, this.config.rateLimitPerMinute, actor.userId]
    );
    return inserted.rows[0];
  }

  async getSettings(actor: ActorContext): Promise<AiSettingsResponse> {
    this.assertEnabled();
    const settings = await this.databaseService.withTransaction(async (client) => this.mapSettings(await this.ensureSettingsRow(client, actor)));
    return { settings };
  }

  async updateSettings(actor: ActorContext, audit: AuditMetadata, input: UpdateAiSettingsRequestBody): Promise<AiSettingsResponse> {
    this.assertEnabled();
    const canConfigure = actor.permissionCodes.includes("ai.configure") || actor.permissionCodes.includes("ai.manage_ai");
    if (!canConfigure) {
      throw new AppError(403, "You do not have permission to configure AI settings.", undefined, "AUTHORIZATION_ERROR");
    }

    const settings = await this.databaseService.withTransaction(async (client) => {
      await this.ensureSettingsRow(client, actor);
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateAiSettingsRequestBody] !== undefined);
      if (keys.length === 0) {
        throw new AppError(400, "At least one setting must be updated.", undefined, "VALIDATION_ERROR");
      }
      const assignments: string[] = [];
      const params: unknown[] = [actor.tenantId, actor.userId];
      const push = (column: string, value: unknown, cast = "") => {
        params.push(value);
        assignments.push(`${column} = $${params.length}${cast}`);
      };
      if (keys.includes("isEnabled")) push("is_enabled", Boolean(input.isEnabled));
      if (keys.includes("defaultProvider") && input.defaultProvider) push("default_provider", normalizeProvider(input.defaultProvider, this.config.defaultProvider));
      if (keys.includes("defaultModel") && input.defaultModel) push("default_model", input.defaultModel.trim());
      if (keys.includes("rateLimitPerMinute") && input.rateLimitPerMinute) push("rate_limit_per_minute", input.rateLimitPerMinute);
      if (keys.includes("allowUserOverrides")) push("allow_user_overrides", Boolean(input.allowUserOverrides));
      if (keys.includes("redactionEnabled")) push("redaction_enabled", Boolean(input.redactionEnabled));
      if (keys.includes("loggingEnabled")) push("logging_enabled", Boolean(input.loggingEnabled));
      if (keys.includes("metadata")) push("metadata", JSON.stringify(input.metadata ?? {}), "::jsonb");

      if (assignments.length > 0) {
        await client.query(`UPDATE ai_settings SET ${assignments.join(", ")}, updated_by = $2 WHERE tenant_id = $1 AND deleted_at IS NULL`, params);
      }

      await this.recordAuditLog(client, actor, audit, { action: "ai.settings.update", resourceType: "ai_settings", status: "success", metadata: { updatedFields: keys } });
      return this.mapSettings(await this.ensureSettingsRow(client, actor));
    });

    return { settings };
  }

  async listProviders(actor: ActorContext): Promise<AiProvidersResponse> {
    this.assertEnabled();
    const settings = (await this.getSettings(actor)).settings;
    const descriptions: Record<AiProviderKey, string> = {
      openai: "OpenAI chat/completions provider (placeholder; configure AI_OPENAI_API_KEY to enable).",
      anthropic: "Anthropic Claude provider (placeholder; configure AI_ANTHROPIC_API_KEY to enable).",
      azure_openai: "Azure OpenAI provider (placeholder; configure AI_AZURE_OPENAI_API_KEY and endpoint to enable).",
      local: "Local/self-hosted model provider (placeholder; configure AI_LOCAL_ENDPOINT to enable)."
    };
    return {
      gatewayEnabled: this.config.gatewayEnabled && settings.isEnabled,
      defaultProvider: settings.defaultProvider,
      providers: aiProviderKeys.map((key) => ({
        key,
        label: aiProviderLabels[key],
        configured: this.providerRegistry.get(key)?.isConfigured() ?? false,
        isDefault: key === settings.defaultProvider,
        description: descriptions[key]
      }))
    };
  }

  listTemplates(): AiTemplatesResponse {
    return {
      templates: defaultAiPromptTemplates.map((template) => ({
        key: template.key,
        name: template.name,
        description: template.description,
        capability: template.capability,
        category: template.category,
        requestType: template.requestType,
        variables: template.variables
      }))
    };
  }

  private resolvePrompt(templateText: string, variables: Record<string, string>) {
    return templateText.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      const value = variables[key];
      return value === undefined || value === null ? `{{${key}}}` : String(value);
    });
  }

  private async logUsage(client: PoolClient, actor: ActorContext, input: {
    provider: AiProviderKey;
    model: string;
    templateKey: string | null;
    capability: string | null;
    requestType: string;
    status: AiUsageStatus;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    latencyMs: number | null;
    errorCode: string | null;
    errorMessage: string | null;
    requestMetadata?: Record<string, unknown>;
    responseMetadata?: Record<string, unknown>;
  }) {
    await client.query(
      `INSERT INTO ai_usage_logs (tenant_id, actor_user_id, session_id, provider, model, template_key, capability, request_type, status, prompt_tokens, completion_tokens, total_tokens, latency_ms, error_code, error_message, request_metadata, response_metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb)`,
      [actor.tenantId, actor.userId, actor.sessionId, input.provider, input.model, input.templateKey, input.capability, input.requestType, input.status, input.promptTokens, input.completionTokens, input.totalTokens, input.latencyMs, input.errorCode, input.errorMessage, JSON.stringify(input.requestMetadata ?? {}), JSON.stringify(input.responseMetadata ?? {})]
    );
  }

  async execute(actor: ActorContext, audit: AuditMetadata, input: AiGatewayRequestBody): Promise<AiGatewayResponse> {
    this.assertEnabled();
    const requestId = randomUUID();

    // Settings are loaded/created in a committed transaction so denial and error
    // logging below survives even when the request itself is rejected.
    const settings = this.mapSettings(await this.databaseService.withTransaction(async (client) => this.ensureSettingsRow(client, actor)));
    const template = this.templateMap.get(input.templateKey);
    const requestedProvider = input.providerKey ? normalizeProvider(input.providerKey, settings.defaultProvider) : null;

    // Failure logging runs in its own committed transaction, separate from any
    // throw, so AI usage logs and audit entries persist for denied/error calls.
    const fail = async (status: AiUsageStatus, code: string, message: string, httpStatus: number, provider: AiProviderKey, model: string, templateKey: string | null, capability: string | null): Promise<never> => {
      await this.databaseService.withTransaction(async (client) => {
        if (settings.loggingEnabled) {
          await this.logUsage(client, actor, { provider, model, templateKey, capability, requestType: input.requestType ?? "completion", status, promptTokens: null, completionTokens: null, totalTokens: null, latencyMs: null, errorCode: code, errorMessage: message, requestMetadata: { requestId } });
        }
        await this.recordAuditLog(client, actor, audit, { action: "ai.gateway.execute", resourceType: "ai_request", resourceId: requestId, status: status === "denied" ? "denied" : "error", metadata: { code, templateKey: input.templateKey } });
      });
      throw new AppError(httpStatus, message, undefined, code);
    };

    if (!this.config.gatewayEnabled || !settings.isEnabled) {
      await fail("denied", "AI_DISABLED", "AI is disabled for this tenant.", 403, requestedProvider ?? settings.defaultProvider, settings.defaultModel, input.templateKey, template?.capability ?? null);
    }
    if (!template) {
      await fail("error", "AI_TEMPLATE_NOT_FOUND", "The requested prompt template was not found.", 400, requestedProvider ?? settings.defaultProvider, settings.defaultModel, input.templateKey, null);
    }
    // `fail` always throws, so reaching here means the template is defined.
    const activeTemplate = template as NonNullable<typeof template>;

    if (requestedProvider && !settings.allowUserOverrides) {
      await fail("denied", "AI_OVERRIDE_NOT_ALLOWED", "Provider overrides are not allowed for this tenant.", 403, settings.defaultProvider, settings.defaultModel, input.templateKey, activeTemplate.capability);
    }

    const providerKey = requestedProvider ?? settings.defaultProvider;
    const model = (settings.allowUserOverrides && input.model ? input.model.trim() : settings.defaultModel) || settings.defaultModel;
    const provider = this.providerRegistry.get(providerKey);
    if (!provider) {
      await fail("error", "AI_PROVIDER_NOT_FOUND", "The requested AI provider is not available.", 400, providerKey, model, input.templateKey, activeTemplate.capability);
    }
    const activeProvider = provider as NonNullable<typeof provider>;

    const resolvedPrompt = this.resolvePrompt(activeTemplate.template, input.variables ?? {});
    // Rate limit placeholder: the limit is reported but not enforced in this phase.
    const rateLimit = { limitPerMinute: settings.rateLimitPerMinute, remaining: settings.rateLimitPerMinute, enforced: false };

    const result = await activeProvider.generate({ providerKey, model, prompt: resolvedPrompt, requestType: input.requestType ?? activeTemplate.requestType, tenantId: actor.tenantId, metadata: input.metadata });
    const status: AiUsageStatus = result.status === "success" ? "success" : "placeholder";

    await this.databaseService.withTransaction(async (client) => {
      if (settings.loggingEnabled) {
        await this.logUsage(client, actor, { provider: providerKey, model, templateKey: activeTemplate.key, capability: activeTemplate.capability, requestType: input.requestType ?? activeTemplate.requestType, status, promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens, latencyMs: result.latencyMs, errorCode: null, errorMessage: null, requestMetadata: { requestId }, responseMetadata: { placeholder: result.placeholder } });
      }
      await this.recordAuditLog(client, actor, audit, { action: "ai.gateway.execute", resourceType: "ai_request", resourceId: requestId, status: "success", metadata: { provider: providerKey, templateKey: activeTemplate.key } });
    });

    return {
      requestId,
      provider: providerKey,
      model,
      templateKey: activeTemplate.key,
      capability: activeTemplate.capability,
      status,
      placeholder: result.placeholder,
      output: result.output,
      resolvedPrompt,
      usage: { promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens: result.totalTokens },
      latencyMs: result.latencyMs,
      rateLimit,
      governance: { redactionEnabled: settings.redactionEnabled, loggingEnabled: settings.loggingEnabled, deferred: result.placeholder },
      createdAt: new Date().toISOString()
    };
  }

  async listLogs(actor: ActorContext, query: AiUsageLogListQuery): Promise<AiUsageLogsResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const page = Math.max(1, query.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
      const conditions = ["tenant_id = $1"];
      const params: unknown[] = [actor.tenantId];
      if (query.provider) {
        params.push(query.provider);
        conditions.push(`provider = $${params.length}`);
      }
      if (query.status) {
        params.push(query.status);
        conditions.push(`status = $${params.length}`);
      }
      if (query.templateKey) {
        params.push(query.templateKey);
        conditions.push(`template_key = $${params.length}`);
      }
      const whereClause = conditions.join(" AND ");
      const countResult = await client.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM ai_usage_logs WHERE ${whereClause}`, params);
      const total = Number(countResult.rows[0]?.total ?? "0");
      const listParams = [...params, pageSize, (page - 1) * pageSize];
      const listResult = await client.query<{
        id: string; provider: string; model: string; template_key: string | null; capability: string | null; request_type: string; status: string;
        prompt_tokens: number | null; completion_tokens: number | null; total_tokens: number | null; latency_ms: number | null; error_code: string | null; actor_user_id: string | null; created_at: Date;
      }>(`SELECT id, provider, model, template_key, capability, request_type, status, prompt_tokens, completion_tokens, total_tokens, latency_ms, error_code, actor_user_id, created_at FROM ai_usage_logs WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`, listParams);
      const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
      return {
        logs: listResult.rows.map((row) => ({
          id: row.id,
          provider: normalizeProvider(row.provider, this.config.defaultProvider),
          model: row.model,
          templateKey: row.template_key,
          capability: row.capability,
          requestType: row.request_type,
          status: (["placeholder", "success", "error", "rate_limited", "denied"].includes(row.status) ? row.status : "placeholder") as AiUsageStatus,
          promptTokens: row.prompt_tokens,
          completionTokens: row.completion_tokens,
          totalTokens: row.total_tokens,
          latencyMs: row.latency_ms,
          errorCode: row.error_code,
          actorUserId: row.actor_user_id,
          createdAt: row.created_at.toISOString()
        })),
        pagination: { page, pageSize, total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 }
      };
    });
  }

  async getUsageSummary(actor: ActorContext): Promise<AiUsageSummaryResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const result = await client.query<{ status: string; provider: string; total_tokens: number | null }>(`SELECT status, provider, total_tokens FROM ai_usage_logs WHERE tenant_id = $1`, [actor.tenantId]);
      const providerMap = new Map<AiProviderKey, number>();
      const statusMap = new Map<AiUsageStatus, number>();
      let totalTokens = 0;
      for (const row of result.rows) {
        const provider = normalizeProvider(row.provider, this.config.defaultProvider);
        providerMap.set(provider, (providerMap.get(provider) ?? 0) + 1);
        const status = (["placeholder", "success", "error", "rate_limited", "denied"].includes(row.status) ? row.status : "placeholder") as AiUsageStatus;
        statusMap.set(status, (statusMap.get(status) ?? 0) + 1);
        totalTokens += row.total_tokens ?? 0;
      }
      return {
        totalRequests: result.rows.length,
        placeholderRequests: statusMap.get("placeholder") ?? 0,
        errorRequests: statusMap.get("error") ?? 0,
        deniedRequests: statusMap.get("denied") ?? 0,
        rateLimitedRequests: statusMap.get("rate_limited") ?? 0,
        totalTokens,
        providerDistribution: Array.from(providerMap.entries()).map(([provider, requestCount]) => ({ provider, requestCount })),
        statusDistribution: Array.from(statusMap.entries()).map(([status, requestCount]) => ({ status, requestCount }))
      };
    });
  }
}
