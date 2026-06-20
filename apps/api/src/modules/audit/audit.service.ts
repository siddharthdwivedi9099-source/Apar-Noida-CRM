import {
  auditLogStatuses,
  securityReviewChecklist,
  type AuditExportResponse,
  type AuditLogCategoryKey,
  type AuditLogEntry,
  type AuditLogListQuery,
  type AuditLogListResponse,
  type AuditLogStatus,
  type AuditSummaryResponse,
  type DataGovernanceSettings,
  type DataGovernanceSettingsResponse,
  type RoleSummary,
  type SecurityReviewResponse,
  type UpdateDataGovernanceSettingsRequestBody
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

interface AuditConfig {
  enableAuditLogs: boolean;
  retentionDefaults: {
    auditLogRetentionDays: number;
    aiLogRetentionDays: number;
    exportLogRetentionDays: number;
    fileUploadMaxMb: number;
  };
}

const CATEGORY_LABELS: Record<AuditLogCategoryKey, { label: string; description: string }> = {
  user_activity: { label: "User activity", description: "All audited user and system activity." },
  authentication: { label: "Authentication", description: "Login, logout, and session events." },
  data_access: { label: "Data access", description: "Customer portal, query, and dashboard access events." },
  role_change: { label: "Role changes", description: "Role creation, updates, deletion, and user-role assignment." },
  permission_change: { label: "Permission changes", description: "Role-permission assignment changes." },
  ai_usage: { label: "AI usage", description: "AI gateway, action, and registry events." },
  exports: { label: "Exports", description: "Data and dashboard export events." },
  failed_access: { label: "Failed access", description: "Denied or failed access attempts." },
  sensitive_action: { label: "Sensitive actions", description: "High-impact actions (AI, RBAC, workflows, deletes, approvals, exports)." }
};

function categoryWhere(category: AuditLogCategoryKey): string {
  switch (category) {
    case "authentication":
      return "a.event_type = 'auth'";
    case "data_access":
      return "a.event_type IN ('customer_portal', 'customer_query', 'dashboards')";
    case "role_change":
      return "(a.action LIKE 'rbac.role.%' OR a.action = 'rbac.user.roles.replace')";
    case "permission_change":
      return "a.action = 'rbac.role.permissions.replace'";
    case "ai_usage":
      return "a.event_type = 'ai'";
    case "exports":
      return "a.action LIKE '%.export'";
    case "failed_access":
      return "(a.status IN ('denied', 'failure') OR a.event_type = 'security')";
    case "sensitive_action":
      return "(a.event_type IN ('ai', 'rbac', 'workflows', 'security') OR a.action LIKE '%delete%' OR a.action LIKE '%.export' OR a.action LIKE '%approve%' OR a.action LIKE '%decision%')";
    case "user_activity":
    default:
      return "TRUE";
  }
}

function normalizeStatus(value: unknown): AuditLogStatus {
  return auditLogStatuses.includes(value as AuditLogStatus) ? (value as AuditLogStatus) : "success";
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export class AuditService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: AuditConfig
  ) {}

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "Audit logs are unavailable until the database connection is enabled.", undefined, "AUDIT_UNAVAILABLE");
    }
  }

  private mapEntry(row: Record<string, unknown>): AuditLogEntry {
    return {
      id: row.id as string,
      eventType: row.event_type as string,
      action: row.action as string,
      resourceType: row.resource_type as string,
      resourceId: (row.resource_id as string | null) ?? null,
      status: normalizeStatus(row.status),
      actorUserId: (row.actor_user_id as string | null) ?? null,
      actorName: (row.actor_name as string | null) ?? null,
      ipAddress: (row.ip_address as string | null) ?? null,
      requestId: (row.request_id as string | null) ?? null,
      metadata: asObject(row.metadata),
      createdAt: (row.created_at as Date).toISOString()
    };
  }

  private buildFilters(query: AuditLogListQuery, startIndex: number): { clause: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];
    const push = (value: unknown) => {
      params.push(value);
      return startIndex + params.length;
    };
    if (query.eventType) {
      conditions.push(`a.event_type = $${push(query.eventType)}`);
    }
    if (query.action) {
      conditions.push(`a.action = $${push(query.action)}`);
    }
    if (query.actorUserId) {
      conditions.push(`a.actor_user_id = $${push(query.actorUserId)}`);
    }
    if (query.resourceType) {
      conditions.push(`a.resource_type = $${push(query.resourceType)}`);
    }
    if (query.status) {
      conditions.push(`a.status = $${push(query.status)}`);
    }
    if (query.from) {
      conditions.push(`a.created_at >= $${push(query.from)}::timestamptz`);
    }
    if (query.to) {
      conditions.push(`a.created_at < ($${push(query.to)}::date + INTERVAL '1 day')`);
    }
    if (query.search) {
      const index = push(`%${query.search.toLowerCase()}%`);
      conditions.push(`(LOWER(a.action) LIKE $${index} OR LOWER(a.resource_type) LIKE $${index} OR LOWER(a.event_type) LIKE $${index})`);
    }
    if (query.category) {
      conditions.push(categoryWhere(query.category as AuditLogCategoryKey));
    }
    return { clause: conditions.length ? ` AND ${conditions.join(" AND ")}` : "", params };
  }

  async listLogs(actor: ActorContext, query: AuditLogListQuery): Promise<AuditLogListResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const page = Math.max(1, query.page ?? 1);
      const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 50));
      const filters = this.buildFilters(query, 1);
      const params: unknown[] = [actor.tenantId, ...filters.params];
      const countResult = await client.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total FROM audit_logs a WHERE a.tenant_id = $1${filters.clause}`,
        params
      );
      const total = Number(countResult.rows[0]?.total ?? "0");
      const listParams = [...params, pageSize, (page - 1) * pageSize];
      const listResult = await client.query(
        `SELECT a.id, a.event_type, a.action, a.resource_type, a.resource_id, a.status, a.actor_user_id,
           u.display_name AS actor_name, a.ip_address::text AS ip_address, a.request_id, a.metadata, a.created_at
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.actor_user_id AND u.tenant_id = a.tenant_id
         WHERE a.tenant_id = $1${filters.clause}
         ORDER BY a.created_at DESC
         LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams
      );
      const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
      return {
        logs: listResult.rows.map((row) => this.mapEntry(row)),
        pagination: { page, pageSize, total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 }
      };
    });
  }

  async getSummary(actor: ActorContext, windowDays = 30): Promise<AuditSummaryResponse> {
    this.assertEnabled();
    const days = Math.min(365, Math.max(1, windowDays));
    return this.databaseService.withClient(async (client) => {
      const windowClause = `a.tenant_id = $1 AND a.created_at >= NOW() - ($2 || ' days')::interval`;
      const eventTypes = await client.query<{ event_type: string; count: number }>(
        `SELECT a.event_type, COUNT(*)::int AS count FROM audit_logs a WHERE ${windowClause} GROUP BY a.event_type ORDER BY count DESC`,
        [actor.tenantId, days]
      );
      const statuses = await client.query<{ status: string; count: number }>(
        `SELECT a.status, COUNT(*)::int AS count FROM audit_logs a WHERE ${windowClause} GROUP BY a.status`,
        [actor.tenantId, days]
      );
      const totalResult = await client.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM audit_logs a WHERE ${windowClause}`, [actor.tenantId, days]);

      const categories = [];
      for (const key of Object.keys(CATEGORY_LABELS) as AuditLogCategoryKey[]) {
        const result = await client.query<{ count: number }>(
          `SELECT COUNT(*)::int AS count FROM audit_logs a WHERE ${windowClause} AND ${categoryWhere(key)}`,
          [actor.tenantId, days]
        );
        categories.push({ key, label: CATEGORY_LABELS[key].label, description: CATEGORY_LABELS[key].description, count: Number(result.rows[0]?.count ?? 0) });
      }

      const failedAccessCount = categories.find((category) => category.key === "failed_access")?.count ?? 0;
      const sensitiveActionCount = categories.find((category) => category.key === "sensitive_action")?.count ?? 0;

      return {
        totalEvents: Number(totalResult.rows[0]?.count ?? 0),
        windowDays: days,
        eventTypeDistribution: eventTypes.rows.map((row) => ({ eventType: row.event_type, count: Number(row.count) })),
        statusDistribution: statuses.rows.map((row) => ({ status: normalizeStatus(row.status), count: Number(row.count) })),
        failedAccessCount,
        sensitiveActionCount,
        categories
      };
    });
  }

  async exportLogs(actor: ActorContext, audit: AuditMetadata, query: AuditLogListQuery): Promise<AuditExportResponse> {
    this.assertEnabled();
    const rows = await this.databaseService.withClient(async (client) => {
      const filters = this.buildFilters(query, 1);
      const params: unknown[] = [actor.tenantId, ...filters.params];
      const result = await client.query(
        `SELECT a.id, a.event_type, a.action, a.resource_type, a.resource_id, a.status, a.actor_user_id,
           u.display_name AS actor_name, a.ip_address::text AS ip_address, a.request_id, a.metadata, a.created_at
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.actor_user_id AND u.tenant_id = a.tenant_id
         WHERE a.tenant_id = $1${filters.clause}
         ORDER BY a.created_at DESC
         LIMIT 5000`,
        params
      );
      return result.rows.map((row) => this.mapEntry(row));
    });

    // Exports are themselves audited (Phase 27: export logs).
    if (this.config.enableAuditLogs) {
      await this.databaseService.query(
        `INSERT INTO audit_logs (tenant_id, actor_user_id, session_id, event_type, action, resource_type, resource_id, status, ip_address, user_agent, request_id, metadata)
         VALUES ($1, $2, $3, 'security', 'audit.export', 'audit_log', NULL, 'success', NULLIF($4, '')::inet, $5, $6, $7::jsonb)`,
        [actor.tenantId, actor.userId, actor.sessionId, audit.ipAddress ?? "", audit.userAgent ?? null, audit.requestId, JSON.stringify({ count: rows.length, filter: query })]
      );
    }

    return { exportedAt: new Date().toISOString(), count: rows.length, filter: query, rows };
  }

  securityReview(): SecurityReviewResponse {
    return { checklist: securityReviewChecklist };
  }

  // -------------------------------------------------------------------------
  // Data governance settings
  // -------------------------------------------------------------------------

  private mapGovernance(row: Record<string, unknown>): DataGovernanceSettings {
    return {
      auditLogRetentionDays: Number(row.audit_log_retention_days),
      aiLogRetentionDays: Number(row.ai_log_retention_days),
      exportLogRetentionDays: Number(row.export_log_retention_days),
      piiRedactionEnabled: row.pii_redaction_enabled as boolean,
      failedAccessLoggingEnabled: row.failed_access_logging_enabled as boolean,
      fileUploadMaxMb: Number(row.file_upload_max_mb),
      allowedFileTypes: Array.isArray(row.allowed_file_types) ? (row.allowed_file_types as string[]) : [],
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString()
    };
  }

  private async ensureGovernanceRow(client: PoolClient, actor: ActorContext) {
    const existing = await client.query(`SELECT * FROM data_governance_settings WHERE tenant_id = $1 AND deleted_at IS NULL LIMIT 1`, [actor.tenantId]);
    if (existing.rows[0]) {
      return existing.rows[0];
    }
    const inserted = await client.query(
      `INSERT INTO data_governance_settings (tenant_id, audit_log_retention_days, ai_log_retention_days, export_log_retention_days, file_upload_max_mb, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING *`,
      [actor.tenantId, this.config.retentionDefaults.auditLogRetentionDays, this.config.retentionDefaults.aiLogRetentionDays, this.config.retentionDefaults.exportLogRetentionDays, this.config.retentionDefaults.fileUploadMaxMb, actor.userId]
    );
    return inserted.rows[0];
  }

  async getGovernance(actor: ActorContext): Promise<DataGovernanceSettingsResponse> {
    this.assertEnabled();
    const settings = await this.databaseService.withTransaction(async (client) => this.mapGovernance(await this.ensureGovernanceRow(client, actor)));
    return { settings };
  }

  async updateGovernance(actor: ActorContext, audit: AuditMetadata, input: UpdateDataGovernanceSettingsRequestBody): Promise<DataGovernanceSettingsResponse> {
    this.assertEnabled();
    const settings = await this.databaseService.withTransaction(async (client) => {
      await this.ensureGovernanceRow(client, actor);
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateDataGovernanceSettingsRequestBody] !== undefined);
      if (keys.length === 0) {
        throw new AppError(400, "At least one setting must be updated.", undefined, "VALIDATION_ERROR");
      }
      const assignments: string[] = [];
      const params: unknown[] = [actor.tenantId, actor.userId];
      const push = (column: string, value: unknown, cast = "") => {
        params.push(value);
        assignments.push(`${column} = $${params.length}${cast}`);
      };
      if (input.auditLogRetentionDays !== undefined) push("audit_log_retention_days", input.auditLogRetentionDays);
      if (input.aiLogRetentionDays !== undefined) push("ai_log_retention_days", input.aiLogRetentionDays);
      if (input.exportLogRetentionDays !== undefined) push("export_log_retention_days", input.exportLogRetentionDays);
      if (input.piiRedactionEnabled !== undefined) push("pii_redaction_enabled", Boolean(input.piiRedactionEnabled));
      if (input.failedAccessLoggingEnabled !== undefined) push("failed_access_logging_enabled", Boolean(input.failedAccessLoggingEnabled));
      if (input.fileUploadMaxMb !== undefined) push("file_upload_max_mb", input.fileUploadMaxMb);
      if (input.allowedFileTypes !== undefined) push("allowed_file_types", JSON.stringify(input.allowedFileTypes), "::jsonb");
      if (input.metadata !== undefined) push("metadata", JSON.stringify(input.metadata), "::jsonb");
      await client.query(`UPDATE data_governance_settings SET ${assignments.join(", ")}, updated_by = $2 WHERE tenant_id = $1 AND deleted_at IS NULL`, params);

      if (this.config.enableAuditLogs) {
        await client.query(
          `INSERT INTO audit_logs (tenant_id, actor_user_id, session_id, event_type, action, resource_type, resource_id, status, ip_address, user_agent, request_id, metadata)
           VALUES ($1, $2, $3, 'security', 'data_governance.update', 'data_governance_settings', NULL, 'success', NULLIF($4, '')::inet, $5, $6, $7::jsonb)`,
          [actor.tenantId, actor.userId, actor.sessionId, audit.ipAddress ?? "", audit.userAgent ?? null, audit.requestId, JSON.stringify({ updatedFields: keys })]
        );
      }

      return this.mapGovernance(await this.ensureGovernanceRow(client, actor));
    });
    return { settings };
  }
}
