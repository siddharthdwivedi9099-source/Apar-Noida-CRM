import {
  CONFIGURATION_SNAPSHOT_SCHEMA_VERSION,
  canTransitionConfigurationVersion,
  summarizeConfigurationSnapshot,
  validateConfigurationSnapshot,
  type ConfigurationExportResponse,
  type ConfigurationSnapshot,
  type ConfigurationValidationResponse,
  type ConfigurationVersion,
  type ConfigurationVersionStatus,
  type ConfigurationVersionSummary,
  type ImportConfigurationRequestBody,
  type RoleSummary,
  type SaveConfigurationDraftRequestBody
} from "@crm/types";
import type { PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { TenantConfigService } from "../tenant-config/tenant-config.service.js";

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

interface ConfigurationServiceConfig {
  enableAuditLogs: boolean;
}

interface ConfigurationVersionRow {
  id: string;
  tenant_id: string;
  version_number: number;
  status: ConfigurationVersionStatus;
  change_reason: string | null;
  snapshot: ConfigurationSnapshot;
  validation_issues: ConfigurationVersion["validationIssues"];
  effective_date: string | null;
  published_at: string | null;
  published_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export class ConfigurationService {
  private readonly tenantConfig: TenantConfigService;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: ConfigurationServiceConfig
  ) {
    this.tenantConfig = new TenantConfigService(databaseService, config);
  }

  private ensureEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(
        503,
        "Configuration engine is unavailable until the database connection is enabled.",
        undefined,
        "CONFIGURATION_UNAVAILABLE"
      );
    }
  }

  /** Assemble the live tenant configuration into a portable snapshot. */
  async assembleSnapshot(actor: ActorContext): Promise<ConfigurationSnapshot> {
    const [core, theme, modules, terminology, optionSets, customFields, formLayouts] = await Promise.all([
      this.tenantConfig.getCoreSettings(actor),
      this.tenantConfig.getTheme(actor),
      this.tenantConfig.getModules(actor),
      this.tenantConfig.getTerminology(actor),
      this.tenantConfig.listOptionSets(actor),
      this.tenantConfig.listCustomFields(actor, {}),
      this.tenantConfig.listFormLayouts(actor)
    ]);

    return {
      schemaVersion: CONFIGURATION_SNAPSHOT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      settings: core.settings,
      theme: theme.theme,
      modules: modules.modules,
      terminology: terminology.terminology,
      optionSets: optionSets.optionSets,
      customFields: customFields.fields,
      formLayouts: formLayouts.layouts
    };
  }

  /** Export the current configuration with its summary and validation result. */
  async exportConfiguration(actor: ActorContext): Promise<ConfigurationExportResponse> {
    const snapshot = await this.assembleSnapshot(actor);
    return {
      snapshot,
      summary: summarizeConfigurationSnapshot(snapshot),
      validation: validateConfigurationSnapshot(snapshot)
    };
  }

  /** Validate the current live configuration without persisting anything. */
  async validateCurrent(actor: ActorContext): Promise<ConfigurationValidationResponse> {
    const snapshot = await this.assembleSnapshot(actor);
    return {
      validation: validateConfigurationSnapshot(snapshot),
      summary: summarizeConfigurationSnapshot(snapshot)
    };
  }

  async listVersions(actor: ActorContext): Promise<ConfigurationVersionSummary[]> {
    this.ensureEnabled();
    return this.databaseService.withClient(async (client) => {
      const result = await client.query<ConfigurationVersionRow>(
        `
          SELECT id, tenant_id, version_number, status, change_reason, snapshot, validation_issues,
                 effective_date, published_at, published_by, created_by, created_at, updated_at
          FROM configuration_versions
          WHERE tenant_id = $1 AND deleted_at IS NULL
          ORDER BY version_number DESC
        `,
        [actor.tenantId]
      );
      return result.rows.map((row) => this.mapSummary(row));
    });
  }

  async getVersion(actor: ActorContext, versionId: string): Promise<ConfigurationVersion> {
    this.ensureEnabled();
    return this.databaseService.withClient(async (client) => {
      const row = await this.loadVersion(client, actor.tenantId, versionId);
      return this.mapVersion(row);
    });
  }

  /** Save a draft version from a provided snapshot, or from current config. */
  async createDraft(
    actor: ActorContext,
    audit: AuditMetadata,
    body: SaveConfigurationDraftRequestBody
  ): Promise<ConfigurationVersion> {
    this.ensureEnabled();
    const snapshot = body.snapshot ?? (await this.assembleSnapshot(actor));
    const validation = validateConfigurationSnapshot(snapshot);

    return this.databaseService.withTransaction(async (client) => {
      const versionNumber = await this.nextVersionNumber(client, actor.tenantId);
      const inserted = await client.query<{ id: string }>(
        `
          INSERT INTO configuration_versions
            (tenant_id, version_number, status, change_reason, snapshot, validation_issues, created_by, updated_by)
          VALUES ($1, $2, 'draft', $3, $4::jsonb, $5::jsonb, $6, $6)
          RETURNING id
        `,
        [
          actor.tenantId,
          versionNumber,
          body.changeReason?.trim() || null,
          JSON.stringify(snapshot),
          JSON.stringify(validation.issues),
          actor.userId
        ]
      );
      const id = inserted.rows[0].id;
      await this.recordAuditLog(client, actor, audit, {
        action: "configuration.draft_created",
        resourceId: id,
        status: "success",
        metadata: { versionNumber, valid: validation.valid, errorCount: validation.errorCount }
      });
      const row = await this.loadVersion(client, actor.tenantId, id);
      return this.mapVersion(row);
    });
  }

  /**
   * Publish a draft. Validation-gated: a snapshot with errors cannot be
   * published (Category 13). Archives any currently-published version first so
   * exactly one published version exists per tenant.
   */
  async publishVersion(actor: ActorContext, audit: AuditMetadata, versionId: string): Promise<ConfigurationVersion> {
    this.ensureEnabled();
    return this.databaseService.withTransaction(async (client) => {
      const row = await this.loadVersion(client, actor.tenantId, versionId);
      if (!canTransitionConfigurationVersion(row.status, "published")) {
        throw new AppError(
          409,
          `A ${row.status} configuration version cannot be published.`,
          undefined,
          "CONFIGURATION_INVALID_TRANSITION"
        );
      }

      const validation = validateConfigurationSnapshot(row.snapshot);
      if (!validation.valid) {
        await this.recordAuditLog(client, actor, audit, {
          action: "configuration.publish_blocked",
          resourceId: versionId,
          status: "failure",
          metadata: { errorCount: validation.errorCount }
        });
        throw new AppError(
          422,
          "Configuration cannot be published while it has validation errors.",
          { issues: validation.issues },
          "CONFIGURATION_INVALID"
        );
      }

      await client.query(
        `UPDATE configuration_versions
           SET status = 'archived', updated_by = $2, updated_at = NOW()
         WHERE tenant_id = $1 AND status = 'published' AND deleted_at IS NULL`,
        [actor.tenantId, actor.userId]
      );

      await client.query(
        `UPDATE configuration_versions
           SET status = 'published',
               published_by = $3,
               published_at = NOW(),
               effective_date = COALESCE(effective_date, NOW()),
               validation_issues = $4::jsonb,
               updated_by = $3,
               updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2`,
        [actor.tenantId, versionId, actor.userId, JSON.stringify(validation.issues)]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "configuration.published",
        resourceId: versionId,
        status: "success",
        metadata: { versionNumber: row.version_number, warningCount: validation.warningCount }
      });

      const published = await this.loadVersion(client, actor.tenantId, versionId);
      return this.mapVersion(published);
    });
  }

  /** Roll back by creating a fresh draft from a historical version's snapshot. */
  async rollbackToVersion(actor: ActorContext, audit: AuditMetadata, versionId: string): Promise<ConfigurationVersion> {
    this.ensureEnabled();
    const source = await this.getVersion(actor, versionId);
    return this.createDraft(actor, audit, {
      snapshot: source.snapshot,
      changeReason: `Rollback to v${source.versionNumber}`
    });
  }

  /** Import a snapshot: validate (dependency errors) and optionally stage as a draft. */
  async importConfiguration(
    actor: ActorContext,
    audit: AuditMetadata,
    body: ImportConfigurationRequestBody
  ): Promise<{ validation: ConfigurationValidationResponse["validation"]; version: ConfigurationVersion | null }> {
    const validation = validateConfigurationSnapshot(body.snapshot);
    if (body.dryRun) {
      return { validation, version: null };
    }
    if (!validation.valid) {
      throw new AppError(
        422,
        "Imported configuration has validation errors; resolve them or use dryRun to inspect.",
        { issues: validation.issues },
        "CONFIGURATION_IMPORT_INVALID"
      );
    }
    const version = await this.createDraft(actor, audit, {
      snapshot: body.snapshot,
      changeReason: body.changeReason?.trim() || "Imported configuration"
    });
    return { validation, version };
  }

  private async nextVersionNumber(client: PoolClient, tenantId: string): Promise<number> {
    const result = await client.query<{ max: number | null }>(
      `SELECT MAX(version_number) AS max FROM configuration_versions WHERE tenant_id = $1`,
      [tenantId]
    );
    return (result.rows[0]?.max ?? 0) + 1;
  }

  private async loadVersion(client: PoolClient, tenantId: string, versionId: string): Promise<ConfigurationVersionRow> {
    const result = await client.query<ConfigurationVersionRow>(
      `
        SELECT id, tenant_id, version_number, status, change_reason, snapshot, validation_issues,
               effective_date, published_at, published_by, created_by, created_at, updated_at
        FROM configuration_versions
        WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
      `,
      [tenantId, versionId]
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, "Configuration version not found.", undefined, "CONFIGURATION_VERSION_NOT_FOUND");
    }
    return row;
  }

  private mapSummary(row: ConfigurationVersionRow): ConfigurationVersionSummary {
    return {
      id: row.id,
      versionNumber: row.version_number,
      status: row.status,
      changeReason: row.change_reason,
      effectiveDate: row.effective_date,
      createdBy: row.created_by,
      publishedBy: row.published_by,
      createdAt: row.created_at,
      publishedAt: row.published_at
    };
  }

  private mapVersion(row: ConfigurationVersionRow): ConfigurationVersion {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      versionNumber: row.version_number,
      status: row.status,
      changeReason: row.change_reason,
      snapshot: row.snapshot,
      validationIssues: row.validation_issues ?? [],
      effectiveDate: row.effective_date,
      createdBy: row.created_by,
      publishedBy: row.published_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: row.published_at
    };
  }

  private async recordAuditLog(
    client: PoolClient,
    actor: ActorContext,
    audit: AuditMetadata,
    input: {
      action: string;
      resourceId?: string | null;
      status: "success" | "failure" | "denied" | "error";
      metadata?: Record<string, unknown>;
    }
  ) {
    if (!this.config.enableAuditLogs) {
      return;
    }
    await client.query(
      `
        INSERT INTO audit_logs (
          tenant_id, actor_user_id, session_id, event_type, action, resource_type,
          resource_id, status, ip_address, user_agent, request_id, metadata
        )
        VALUES ($1, $2, $3, 'configuration', $4, 'configuration_version', $5, $6, NULLIF($7, '')::inet, $8, $9, $10::jsonb)
      `,
      [
        actor.tenantId,
        actor.userId,
        actor.sessionId,
        input.action,
        input.resourceId ?? null,
        input.status,
        audit.ipAddress ?? "",
        audit.userAgent ?? null,
        audit.requestId,
        JSON.stringify(input.metadata ?? {})
      ]
    );
  }
}
