import {
  CONFIGURATION_SNAPSHOT_SCHEMA_VERSION,
  canTransitionConfigurationVersion,
  planConfigurationApply,
  summarizeConfigurationSnapshot,
  validateConfigurationSnapshot,
  type ConfigurationApplyPlan,
  type ConfigurationApplyResult,
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

// Must match the keys used by TenantConfigService so applied config is read back correctly.
const SETTING_KEYS = {
  core: "tenant.settings",
  theme: "tenant.theme",
  modules: "tenant.modules",
  terminology: "tenant.terminology"
} as const;

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

  /** Dry-run: the upsert plan if this version were applied to live config now. */
  async getApplyPlan(actor: ActorContext, versionId: string): Promise<ConfigurationApplyPlan> {
    this.ensureEnabled();
    const target = await this.getVersion(actor, versionId);
    const current = await this.assembleSnapshot(actor);
    return planConfigurationApply(current, target.snapshot);
  }

  /**
   * Apply a published version onto the live configuration tables.
   * Published-only + validation-gated. Captures a pre-apply backup draft for
   * rollback, then applies all sections in a single transaction (upsert-only),
   * so a failure rolls everything back automatically.
   */
  async applyVersion(actor: ActorContext, audit: AuditMetadata, versionId: string): Promise<ConfigurationApplyResult> {
    this.ensureEnabled();

    const target = await this.getVersion(actor, versionId);
    if (target.status !== "published") {
      throw new AppError(
        409,
        "Only a published configuration version can be applied to live tables.",
        undefined,
        "CONFIGURATION_NOT_PUBLISHED"
      );
    }

    const validation = validateConfigurationSnapshot(target.snapshot);
    if (!validation.valid) {
      throw new AppError(
        422,
        "Configuration cannot be applied while it has validation errors.",
        { issues: validation.issues },
        "CONFIGURATION_INVALID"
      );
    }

    // Capture current live config as a rollback point before mutating anything.
    const currentSnapshot = await this.assembleSnapshot(actor);
    const backup = await this.createDraft(actor, audit, {
      snapshot: currentSnapshot,
      changeReason: `Pre-apply backup before applying v${target.versionNumber}`
    });
    const plan = planConfigurationApply(currentSnapshot, target.snapshot);

    const appliedAt = await this.databaseService.withTransaction(async (client) => {
      await this.applySnapshotToLiveTables(client, actor, target.snapshot);
      const stamp = await client.query<{ applied_at: Date }>(
        `UPDATE configuration_versions
           SET applied_at = NOW(), applied_by = $3, updated_by = $3, updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2
         RETURNING applied_at`,
        [actor.tenantId, versionId, actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, {
        action: "configuration.applied",
        resourceId: versionId,
        status: "success",
        metadata: {
          versionNumber: target.versionNumber,
          backupVersionId: backup.id,
          createCount: plan.createCount,
          updateCount: plan.updateCount
        }
      });
      return new Date(stamp.rows[0].applied_at).toISOString();
    });

    return { versionId, versionNumber: target.versionNumber, backupVersionId: backup.id, appliedAt, plan };
  }

  /**
   * Upsert every section of a snapshot onto live config tables within the
   * caller's transaction. Upsert-only: never deletes. Option sets are applied
   * before custom fields so option-set references resolve.
   */
  private async applySnapshotToLiveTables(client: PoolClient, actor: ActorContext, snapshot: ConfigurationSnapshot) {
    await this.upsertSetting(client, actor, SETTING_KEYS.core, { ...snapshot.settings });
    await this.upsertSetting(client, actor, SETTING_KEYS.theme, { ...snapshot.theme });

    const moduleMap = Object.fromEntries(
      (snapshot.modules ?? []).map((module) => [
        module.moduleKey,
        { enabled: module.locked ? true : module.enabled, locked: module.locked, label: module.label }
      ])
    );
    await this.upsertSetting(client, actor, SETTING_KEYS.modules, moduleMap);

    const terminologyMap = Object.fromEntries(
      (snapshot.terminology ?? []).map((entry) => [
        entry.moduleKey,
        { singular: entry.singular, plural: entry.plural, description: entry.description }
      ])
    );
    await this.upsertSetting(client, actor, SETTING_KEYS.terminology, terminologyMap);

    for (const set of snapshot.optionSets ?? []) {
      const optionSetId = await this.upsertOptionSet(client, actor, set);
      for (const value of set.values ?? []) {
        await this.upsertOptionValue(client, actor, optionSetId, value);
      }
    }

    for (const field of snapshot.customFields ?? []) {
      if (field.isSystemField) {
        continue; // system fields are code-owned; never overwrite them
      }
      const optionSetId = field.optionSetKey
        ? await this.resolveOptionSetId(client, actor.tenantId, field.optionSetKey)
        : null;
      await this.upsertCustomField(client, actor, field, optionSetId);
    }
  }

  private async upsertSetting(
    client: PoolClient,
    actor: ActorContext,
    settingKey: string,
    settingValue: Record<string, unknown>
  ) {
    const updateResult = await client.query(
      `UPDATE system_settings
         SET setting_value = $3::jsonb, owner_id = COALESCE(owner_id, $2), deleted_at = NULL,
             updated_at = NOW(), updated_by = $2,
             metadata = system_settings.metadata || jsonb_build_object('appliedVia', 'configuration-apply')
       WHERE tenant_id = $1 AND setting_key = $4`,
      [actor.tenantId, actor.userId, JSON.stringify(settingValue), settingKey]
    );
    if (updateResult.rowCount === 0) {
      await client.query(
        `INSERT INTO system_settings (tenant_id, setting_key, setting_value, owner_id, created_by, updated_by, metadata)
         VALUES ($1, $2, $3::jsonb, $4, $4, $4, jsonb_build_object('appliedVia', 'configuration-apply'))`,
        [actor.tenantId, settingKey, JSON.stringify(settingValue), actor.userId]
      );
    }
  }

  private async upsertOptionSet(
    client: PoolClient,
    actor: ActorContext,
    set: ConfigurationSnapshot["optionSets"][number]
  ): Promise<string> {
    const result = await client.query<{ id: string }>(
      `INSERT INTO tenant_option_sets
         (tenant_id, set_key, module_key, kind, name, description, is_system_set, is_active, owner_id, created_by, updated_by, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $8, $8, jsonb_build_object('appliedVia', 'configuration-apply'))
       ON CONFLICT (tenant_id, set_key) DO UPDATE SET
         module_key = EXCLUDED.module_key, kind = EXCLUDED.kind, name = EXCLUDED.name,
         description = EXCLUDED.description, is_active = true, deleted_at = NULL,
         updated_at = NOW(), updated_by = $8,
         metadata = tenant_option_sets.metadata || EXCLUDED.metadata
       RETURNING id`,
      [actor.tenantId, set.setKey, set.moduleKey ?? null, set.kind, set.name, set.description ?? null, set.isSystemSet, actor.userId]
    );
    const id = result.rows[0]?.id;
    if (!id) {
      throw new AppError(500, "Option set could not be applied.", undefined, "OPTION_SET_ERROR");
    }
    return id;
  }

  private async upsertOptionValue(
    client: PoolClient,
    actor: ActorContext,
    optionSetId: string,
    value: ConfigurationSnapshot["optionSets"][number]["values"][number]
  ) {
    await client.query(
      `INSERT INTO tenant_option_values
         (tenant_id, option_set_id, value_key, label, description, color, sort_order, is_default, is_active, owner_id, created_by, updated_by, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, true), $10, $10, $10, '{}'::jsonb)
       ON CONFLICT (tenant_id, option_set_id, value_key) DO UPDATE SET
         label = EXCLUDED.label, description = EXCLUDED.description, color = EXCLUDED.color,
         sort_order = EXCLUDED.sort_order, is_default = EXCLUDED.is_default, is_active = EXCLUDED.is_active,
         deleted_at = NULL, updated_at = NOW(), updated_by = $10`,
      [
        actor.tenantId,
        optionSetId,
        value.key,
        value.label,
        value.description ?? null,
        value.color ?? null,
        value.sortOrder ?? 0,
        value.isDefault ?? false,
        value.isActive ?? true,
        actor.userId
      ]
    );
  }

  private async upsertCustomField(
    client: PoolClient,
    actor: ActorContext,
    field: ConfigurationSnapshot["customFields"][number],
    optionSetId: string | null
  ) {
    await client.query(
      `INSERT INTO custom_field_definitions
         (tenant_id, module_key, entity_key, field_key, label, description, data_type, placeholder, option_set_id,
          is_required, is_active, is_system_field, sort_order, settings, owner_id, created_by, updated_by, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false, $12, $13::jsonb, $14, $14, $14,
               jsonb_build_object('appliedVia', 'configuration-apply'))
       ON CONFLICT (tenant_id, entity_key, field_key) DO UPDATE SET
         module_key = EXCLUDED.module_key, label = EXCLUDED.label, description = EXCLUDED.description,
         data_type = EXCLUDED.data_type, placeholder = EXCLUDED.placeholder, option_set_id = EXCLUDED.option_set_id,
         is_required = EXCLUDED.is_required, is_active = EXCLUDED.is_active, sort_order = EXCLUDED.sort_order,
         settings = EXCLUDED.settings, deleted_at = NULL, updated_at = NOW(), updated_by = $14,
         metadata = custom_field_definitions.metadata || EXCLUDED.metadata`,
      [
        actor.tenantId,
        field.moduleKey,
        field.entityKey,
        field.fieldKey,
        field.label,
        field.description ?? null,
        field.dataType,
        field.placeholder ?? null,
        optionSetId,
        field.isRequired,
        field.isActive,
        field.sortOrder,
        JSON.stringify(field.settings ?? {}),
        actor.userId
      ]
    );
  }

  private async resolveOptionSetId(client: PoolClient, tenantId: string, setKey: string): Promise<string | null> {
    const result = await client.query<{ id: string }>(
      `SELECT id FROM tenant_option_sets WHERE tenant_id = $1 AND set_key = $2 AND deleted_at IS NULL LIMIT 1`,
      [tenantId, setKey]
    );
    return result.rows[0]?.id ?? null;
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
