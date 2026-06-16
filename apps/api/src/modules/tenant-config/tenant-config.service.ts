import type {
  CreateCustomFieldRequestBody,
  CustomFieldDataType,
  CustomFieldDefinition,
  CustomFieldResponse,
  CustomFieldsResponse,
  CustomFormLayoutDefinition,
  CustomFormLayoutsResponse,
  ReplaceTenantOptionSetRequestBody,
  RoleSummary,
  TenantConfigurationBootstrapResponse,
  TenantCoreSettings,
  TenantCoreSettingsResponse,
  TenantModuleState,
  TenantModulesResponse,
  TenantOptionSet,
  TenantOptionSetResponse,
  TenantOptionSetsResponse,
  TenantTerminologyEntry,
  TenantTerminologyResponse,
  TenantThemeResponse,
  TenantThemeSettings,
  UpdateCustomFieldRequestBody
} from "@crm/types";
import {
  customFieldDataTypes,
  defaultTenantCoreSettings,
  defaultTenantTerminologyEntries,
  defaultTenantThemeSettings,
  permissionModuleLabels,
  tenantCardStyles,
  tenantDensityPreferences,
  tenantFontPreferences,
  tenantModuleDefinitions,
  tenantOptionSetKinds,
  tenantSidebarStyles,
  tenantThemeModes
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

interface TenantRow {
  id: string;
  slug: string;
  name: string;
}

interface SystemSettingRow {
  setting_key: string;
  setting_value: Record<string, unknown> | null;
}

interface SummaryCountRow {
  option_set_count: string;
  pipeline_count: string;
  ticket_status_count: string;
  customer_success_stage_count: string;
  custom_field_count: string;
  form_layout_count: string;
}

interface OptionSetRow {
  id: string;
  tenant_id: string;
  set_key: string;
  module_key: string | null;
  kind: string;
  name: string;
  description: string | null;
  is_system_set: boolean;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

interface OptionValueRow {
  id: string;
  tenant_id: string;
  option_set_id: string;
  value_key: string;
  label: string;
  description: string | null;
  color: string | null;
  sort_order: number;
  is_default: boolean;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
}

interface CustomFieldRow {
  id: string;
  tenant_id: string;
  module_key: string;
  entity_key: string;
  field_key: string;
  label: string;
  description: string | null;
  data_type: string;
  placeholder: string | null;
  option_set_key: string | null;
  is_required: boolean;
  is_active: boolean;
  is_system_field: boolean;
  sort_order: number;
  settings: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

interface CustomFormLayoutRow {
  id: string;
  tenant_id: string;
  module_key: string;
  entity_key: string;
  layout_key: string;
  name: string;
  description: string | null;
  layout_schema: Record<string, unknown> | null;
  is_active: boolean;
  is_system_layout: boolean;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

const SETTING_KEYS = {
  core: "tenant.settings",
  theme: "tenant.theme",
  modules: "tenant.modules",
  terminology: "tenant.terminology"
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function isAllowedString<T extends string>(value: unknown, allowedValues: readonly T[]): value is T {
  return typeof value === "string" && allowedValues.includes(value as T);
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function parseCount(value: string) {
  return Number.parseInt(value, 10) || 0;
}

function slugifyFieldKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isCustomFieldType(value: unknown): value is CustomFieldDataType {
  return typeof value === "string" && (customFieldDataTypes as readonly string[]).includes(value);
}

function toIsoString(value: Date) {
  return value.toISOString();
}

export class TenantConfigService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {}

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(
        503,
        "Tenant configuration is unavailable until the database connection is enabled.",
        undefined,
        "TENANT_CONFIG_UNAVAILABLE"
      );
    }
  }

  private mergeCoreSettings(value: Record<string, unknown> | null): TenantCoreSettings {
    const settings = value ?? {};

    return {
      workspaceName: asString(settings.workspaceName, defaultTenantCoreSettings.workspaceName),
      timezone: asString(settings.timezone, defaultTenantCoreSettings.timezone),
      locale: asString(settings.locale, defaultTenantCoreSettings.locale),
      currency: asString(settings.currency, defaultTenantCoreSettings.currency),
      dateFormat: asString(settings.dateFormat, defaultTenantCoreSettings.dateFormat),
      timeFormat: settings.timeFormat === "24h" ? "24h" : defaultTenantCoreSettings.timeFormat
    };
  }

  private mergeThemeSettings(value: Record<string, unknown> | null): TenantThemeSettings {
    const settings = value ?? {};

    return {
      logo: asNullableString(settings.logo),
      primaryColor: isHexColor(settings.primaryColor)
        ? settings.primaryColor
        : defaultTenantThemeSettings.primaryColor,
      secondaryColor: isHexColor(settings.secondaryColor)
        ? settings.secondaryColor
        : defaultTenantThemeSettings.secondaryColor,
      accentColor: isHexColor(settings.accentColor)
        ? settings.accentColor
        : defaultTenantThemeSettings.accentColor,
      mode: isAllowedString(settings.mode, tenantThemeModes)
        ? settings.mode
        : defaultTenantThemeSettings.mode,
      sidebarStyle: isAllowedString(settings.sidebarStyle, tenantSidebarStyles)
        ? settings.sidebarStyle
        : defaultTenantThemeSettings.sidebarStyle,
      cardStyle: isAllowedString(settings.cardStyle, tenantCardStyles)
        ? settings.cardStyle
        : defaultTenantThemeSettings.cardStyle,
      fontPreference: isAllowedString(settings.fontPreference, tenantFontPreferences)
        ? settings.fontPreference
        : defaultTenantThemeSettings.fontPreference,
      density: isAllowedString(settings.density, tenantDensityPreferences)
        ? settings.density
        : defaultTenantThemeSettings.density
    };
  }

  private mergeModuleStates(value: Record<string, unknown> | null): TenantModuleState[] {
    const stored = value ?? {};

    return tenantModuleDefinitions.map((definition) => {
      const storedValue = stored[definition.moduleKey];
      const storedEntry = isRecord(storedValue) ? storedValue : {};

      return {
        ...definition,
        enabled:
          typeof storedEntry.enabled === "boolean" ? storedEntry.enabled : definition.defaultEnabled
      };
    });
  }

  private mergeTerminologyEntries(value: Record<string, unknown> | null): TenantTerminologyEntry[] {
    const stored = value ?? {};
    const baseEntries = new Map(
      defaultTenantTerminologyEntries.map((entry) => [
        entry.moduleKey,
        {
          ...entry
        }
      ])
    );

    for (const [moduleKey, moduleValue] of Object.entries(stored)) {
      if (!permissionModuleLabels[moduleKey as keyof typeof permissionModuleLabels] || !isRecord(moduleValue)) {
        continue;
      }

      const defaultEntry =
        baseEntries.get(moduleKey as keyof typeof permissionModuleLabels) ?? {
          moduleKey: moduleKey as keyof typeof permissionModuleLabels,
          singular: permissionModuleLabels[moduleKey as keyof typeof permissionModuleLabels],
          plural: permissionModuleLabels[moduleKey as keyof typeof permissionModuleLabels],
          description: null
        };

      baseEntries.set(moduleKey as keyof typeof permissionModuleLabels, {
        moduleKey: moduleKey as keyof typeof permissionModuleLabels,
        singular: asString(moduleValue.singular, defaultEntry.singular),
        plural: asString(moduleValue.plural, defaultEntry.plural),
        description:
          moduleValue.description === null || typeof moduleValue.description === "string"
            ? moduleValue.description
            : defaultEntry.description
      });
    }

    return [...baseEntries.values()].sort((left, right) => left.plural.localeCompare(right.plural));
  }

  private async recordAuditLog(
    client: PoolClient,
    actor: ActorContext,
    audit: AuditMetadata,
    input: {
      action: string;
      resourceType: string;
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
          tenant_id,
          actor_user_id,
          session_id,
          event_type,
          action,
          resource_type,
          resource_id,
          status,
          ip_address,
          user_agent,
          request_id,
          metadata
        )
        VALUES ($1, $2, $3, 'tenant_config', $4, $5, $6, $7, NULLIF($8, '')::inet, $9, $10, $11::jsonb)
      `,
      [
        actor.tenantId,
        actor.userId,
        actor.sessionId,
        input.action,
        input.resourceType,
        input.resourceId ?? null,
        input.status,
        audit.ipAddress ?? "",
        audit.userAgent ?? null,
        audit.requestId,
        JSON.stringify(input.metadata ?? {})
      ]
    );
  }

  private async loadTenantSummary(client: PoolClient, tenantId: string) {
    const result = await client.query<TenantRow>(
      `
        SELECT id, slug, name
        FROM tenants
        WHERE id = $1
          AND deleted_at IS NULL
      `,
      [tenantId]
    );

    const tenant = result.rows[0];

    if (!tenant) {
      throw new AppError(404, "Tenant context could not be resolved.", undefined, "TENANT_NOT_FOUND");
    }

    return tenant;
  }

  private async loadSettingMap(client: PoolClient, tenantId: string) {
    const result = await client.query<SystemSettingRow>(
      `
        SELECT setting_key, setting_value
        FROM system_settings
        WHERE tenant_id = $1
          AND setting_key = ANY($2::text[])
          AND deleted_at IS NULL
      `,
      [tenantId, Object.values(SETTING_KEYS)]
    );

    return new Map(result.rows.map((row) => [row.setting_key, row.setting_value ?? {}]));
  }

  private async upsertTenantSetting(
    client: PoolClient,
    input: {
      tenantId: string;
      actorUserId: string;
      settingKey: string;
      description: string;
      settingValue: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }
  ) {
    const updateResult = await client.query(
      `
        UPDATE system_settings
        SET
          setting_value = $3::jsonb,
          description = $4,
          owner_id = COALESCE(owner_id, $2),
          deleted_at = NULL,
          updated_at = NOW(),
          updated_by = $2,
          metadata = system_settings.metadata || $5::jsonb
        WHERE tenant_id = $1
          AND setting_key = $6
      `,
      [
        input.tenantId,
        input.actorUserId,
        JSON.stringify(input.settingValue),
        input.description,
        JSON.stringify(input.metadata ?? {}),
        input.settingKey
      ]
    );

    if (updateResult.rowCount === 0) {
      await client.query(
        `
          INSERT INTO system_settings (
            tenant_id,
            setting_key,
            setting_value,
            description,
            owner_id,
            created_by,
            updated_by,
            metadata
          )
          VALUES ($1, $2, $3::jsonb, $4, $5, $5, $5, $6::jsonb)
        `,
        [
          input.tenantId,
          input.settingKey,
          JSON.stringify(input.settingValue),
          input.description,
          input.actorUserId,
          JSON.stringify(input.metadata ?? {})
        ]
      );
    }
  }

  private mapCustomField(row: CustomFieldRow): CustomFieldDefinition {
    const moduleKey = row.module_key as keyof typeof permissionModuleLabels;

    if (!permissionModuleLabels[moduleKey] || !isCustomFieldType(row.data_type)) {
      throw new AppError(500, "Encountered an invalid custom field definition.", undefined, "INVALID_CONFIG");
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      moduleKey,
      entityKey: row.entity_key,
      fieldKey: row.field_key,
      label: row.label,
      description: row.description,
      dataType: row.data_type,
      placeholder: row.placeholder,
      optionSetKey: row.option_set_key,
      isRequired: row.is_required,
      isActive: row.is_active,
      isSystemField: row.is_system_field,
      sortOrder: row.sort_order,
      settings: row.settings ?? {},
      metadata: row.metadata ?? {},
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at)
    };
  }

  private mapCustomFormLayout(row: CustomFormLayoutRow): CustomFormLayoutDefinition {
    const moduleKey = row.module_key as keyof typeof permissionModuleLabels;

    if (!permissionModuleLabels[moduleKey]) {
      throw new AppError(500, "Encountered an invalid form layout definition.", undefined, "INVALID_CONFIG");
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      moduleKey,
      entityKey: row.entity_key,
      layoutKey: row.layout_key,
      name: row.name,
      description: row.description,
      isActive: row.is_active,
      isSystemLayout: row.is_system_layout,
      layoutSchema: {
        sections: Array.isArray(row.layout_schema?.sections)
          ? (row.layout_schema.sections as Array<{ id: string; title: string; fields: string[] }>)
          : [],
        ...(row.layout_schema ?? {})
      },
      metadata: row.metadata ?? {},
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at)
    };
  }

  private async loadOptionSets(client: PoolClient, tenantId: string) {
    const optionSetResult = await client.query<OptionSetRow>(
      `
        SELECT
          id,
          tenant_id,
          set_key,
          module_key,
          kind,
          name,
          description,
          is_system_set,
          is_active,
          metadata,
          created_at,
          updated_at
        FROM tenant_option_sets
        WHERE tenant_id = $1
          AND deleted_at IS NULL
        ORDER BY name ASC
      `,
      [tenantId]
    );

    if (optionSetResult.rows.length === 0) {
      return [] satisfies TenantOptionSet[];
    }

    const optionValueResult = await client.query<OptionValueRow>(
      `
        SELECT
          id,
          tenant_id,
          option_set_id,
          value_key,
          label,
          description,
          color,
          sort_order,
          is_default,
          is_active,
          metadata
        FROM tenant_option_values
        WHERE tenant_id = $1
          AND deleted_at IS NULL
        ORDER BY option_set_id ASC, sort_order ASC, label ASC
      `,
      [tenantId]
    );

    return optionSetResult.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      setKey: row.set_key,
      moduleKey:
        row.module_key && permissionModuleLabels[row.module_key as keyof typeof permissionModuleLabels]
          ? (row.module_key as keyof typeof permissionModuleLabels)
          : null,
      kind: row.kind as TenantOptionSet["kind"],
      name: row.name,
      description: row.description,
      isSystemSet: row.is_system_set,
      isActive: row.is_active,
      metadata: row.metadata ?? {},
      values: optionValueResult.rows
        .filter((valueRow) => valueRow.option_set_id === row.id)
        .map((valueRow) => ({
          id: valueRow.id,
          key: valueRow.value_key,
          label: valueRow.label,
          description: valueRow.description,
          color: valueRow.color,
          sortOrder: valueRow.sort_order,
          isDefault: valueRow.is_default,
          isActive: valueRow.is_active,
          metadata: valueRow.metadata ?? {}
        })),
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at)
    }));
  }

  private async resolveOptionSetId(client: PoolClient, tenantId: string, setKey: string) {
    const result = await client.query<{ id: string }>(
      `
        SELECT id
        FROM tenant_option_sets
        WHERE tenant_id = $1
          AND set_key = $2
          AND deleted_at IS NULL
      `,
      [tenantId, setKey]
    );

    return result.rows[0]?.id ?? null;
  }

  async getWorkspace(actor: ActorContext): Promise<TenantConfigurationBootstrapResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const [tenant, settingsMap, summaryResult] = await Promise.all([
        this.loadTenantSummary(client, actor.tenantId),
        this.loadSettingMap(client, actor.tenantId),
        client.query<SummaryCountRow>(
          `
            SELECT
              (SELECT COUNT(*) FROM tenant_option_sets WHERE tenant_id = $1 AND deleted_at IS NULL) AS option_set_count,
              (SELECT COUNT(*) FROM tenant_option_sets WHERE tenant_id = $1 AND deleted_at IS NULL AND kind = 'pipeline') AS pipeline_count,
              (SELECT COUNT(*) FROM tenant_option_sets WHERE tenant_id = $1 AND deleted_at IS NULL AND kind = 'ticket_status') AS ticket_status_count,
              (SELECT COUNT(*) FROM tenant_option_sets WHERE tenant_id = $1 AND deleted_at IS NULL AND kind = 'customer_success_stage') AS customer_success_stage_count,
              (SELECT COUNT(*) FROM custom_field_definitions WHERE tenant_id = $1 AND deleted_at IS NULL) AS custom_field_count,
              (SELECT COUNT(*) FROM custom_form_layouts WHERE tenant_id = $1 AND deleted_at IS NULL) AS form_layout_count
          `,
          [actor.tenantId]
        )
      ]);

      const summary = summaryResult.rows[0];

      return {
        tenant,
        settings: this.mergeCoreSettings((settingsMap.get(SETTING_KEYS.core) as Record<string, unknown>) ?? null),
        theme: this.mergeThemeSettings((settingsMap.get(SETTING_KEYS.theme) as Record<string, unknown>) ?? null),
        modules: this.mergeModuleStates((settingsMap.get(SETTING_KEYS.modules) as Record<string, unknown>) ?? null),
        terminology: this.mergeTerminologyEntries(
          (settingsMap.get(SETTING_KEYS.terminology) as Record<string, unknown>) ?? null
        ),
        summary: {
          optionSetCount: parseCount(summary?.option_set_count ?? "0"),
          pipelineCount: parseCount(summary?.pipeline_count ?? "0"),
          ticketStatusCount: parseCount(summary?.ticket_status_count ?? "0"),
          customerSuccessStageCount: parseCount(summary?.customer_success_stage_count ?? "0"),
          customFieldCount: parseCount(summary?.custom_field_count ?? "0"),
          formLayoutCount: parseCount(summary?.form_layout_count ?? "0")
        }
      };
    });
  }

  async getCoreSettings(actor: ActorContext): Promise<TenantCoreSettingsResponse> {
    const workspace = await this.getWorkspace(actor);

    return {
      settings: workspace.settings
    };
  }

  async updateCoreSettings(
    actor: ActorContext,
    audit: AuditMetadata,
    input: TenantCoreSettings
  ): Promise<TenantCoreSettingsResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      await this.upsertTenantSetting(client, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        settingKey: SETTING_KEYS.core,
        description: "Tenant-level workspace settings for locale, timezone, and formatting.",
        settingValue: {
          ...input
        },
        metadata: {
          phase: "phase-5-config",
          category: "tenant-core"
        }
      });

      await this.recordAuditLog(client, actor, audit, {
        action: "update_settings",
        resourceType: "tenant_settings",
        status: "success",
        metadata: {
          settingKey: SETTING_KEYS.core,
          workspaceName: input.workspaceName,
          timezone: input.timezone
        }
      });

      return {
        settings: input
      };
    });
  }

  async getTheme(actor: ActorContext): Promise<TenantThemeResponse> {
    const workspace = await this.getWorkspace(actor);

    return {
      theme: workspace.theme
    };
  }

  async updateTheme(
    actor: ActorContext,
    audit: AuditMetadata,
    input: TenantThemeSettings
  ): Promise<TenantThemeResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      await this.upsertTenantSetting(client, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        settingKey: SETTING_KEYS.theme,
        description: "Tenant theme tokens for branding, density, and layout presentation.",
        settingValue: {
          ...input
        },
        metadata: {
          phase: "phase-5-config",
          category: "tenant-theme"
        }
      });

      await this.recordAuditLog(client, actor, audit, {
        action: "update_theme",
        resourceType: "tenant_theme",
        status: "success",
        metadata: {
          mode: input.mode,
          sidebarStyle: input.sidebarStyle,
          cardStyle: input.cardStyle
        }
      });

      return {
        theme: input
      };
    });
  }

  async getModules(actor: ActorContext): Promise<TenantModulesResponse> {
    const workspace = await this.getWorkspace(actor);

    return {
      modules: workspace.modules
    };
  }

  async updateModules(
    actor: ActorContext,
    audit: AuditMetadata,
    input: { modules: Array<{ moduleKey: TenantModuleState["moduleKey"]; enabled: boolean }> }
  ): Promise<TenantModulesResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const settingsMap = await this.loadSettingMap(client, actor.tenantId);
      const currentModules = this.mergeModuleStates(
        (settingsMap.get(SETTING_KEYS.modules) as Record<string, unknown>) ?? null
      );
      const updates = new Map(input.modules.map((entry) => [entry.moduleKey, entry.enabled]));
      const nextModules = currentModules.map((module) => ({
        ...module,
        enabled: module.locked ? true : updates.get(module.moduleKey) ?? module.enabled
      }));
      const settingValue = Object.fromEntries(
        nextModules.map((module) => [
          module.moduleKey,
          {
            enabled: module.enabled,
            locked: module.locked,
            label: module.label
          }
        ])
      );

      await this.upsertTenantSetting(client, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        settingKey: SETTING_KEYS.modules,
        description: "Tenant module enablement map for configurable navigation and route access.",
        settingValue,
        metadata: {
          phase: "phase-5-config",
          category: "tenant-modules"
        }
      });

      await this.recordAuditLog(client, actor, audit, {
        action: "update_modules",
        resourceType: "tenant_modules",
        status: "success",
        metadata: {
          enabledModules: nextModules.filter((module) => module.enabled).map((module) => module.moduleKey),
          disabledModules: nextModules.filter((module) => !module.enabled).map((module) => module.moduleKey)
        }
      });

      return {
        modules: nextModules
      };
    });
  }

  async getTerminology(actor: ActorContext): Promise<TenantTerminologyResponse> {
    const workspace = await this.getWorkspace(actor);

    return {
      terminology: workspace.terminology
    };
  }

  async updateTerminology(
    actor: ActorContext,
    audit: AuditMetadata,
    input: { terminology: TenantTerminologyEntry[] }
  ): Promise<TenantTerminologyResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const settingValue = Object.fromEntries(
        input.terminology.map((entry) => [
          entry.moduleKey,
          {
            singular: entry.singular,
            plural: entry.plural,
            description: entry.description
          }
        ])
      );

      await this.upsertTenantSetting(client, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        settingKey: SETTING_KEYS.terminology,
        description: "Tenant terminology overrides for business-facing labels and workspace copy.",
        settingValue,
        metadata: {
          phase: "phase-5-config",
          category: "tenant-terminology"
        }
      });

      await this.recordAuditLog(client, actor, audit, {
        action: "update_terminology",
        resourceType: "tenant_terminology",
        status: "success",
        metadata: {
          moduleKeys: input.terminology.map((entry) => entry.moduleKey)
        }
      });

      return {
        terminology: this.mergeTerminologyEntries(settingValue)
      };
    });
  }

  async listCustomFields(
    actor: ActorContext,
    filters?: {
      moduleKey?: TenantModuleState["moduleKey"];
      entityKey?: string;
    }
  ): Promise<CustomFieldsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const fieldResult = await client.query<CustomFieldRow>(
        `
          SELECT
            custom_field_definitions.id,
            custom_field_definitions.tenant_id,
            custom_field_definitions.module_key,
            custom_field_definitions.entity_key,
            custom_field_definitions.field_key,
            custom_field_definitions.label,
            custom_field_definitions.description,
            custom_field_definitions.data_type,
            custom_field_definitions.placeholder,
            tenant_option_sets.set_key AS option_set_key,
            custom_field_definitions.is_required,
            custom_field_definitions.is_active,
            custom_field_definitions.is_system_field,
            custom_field_definitions.sort_order,
            custom_field_definitions.settings,
            custom_field_definitions.metadata,
            custom_field_definitions.created_at,
            custom_field_definitions.updated_at
          FROM custom_field_definitions
          LEFT JOIN tenant_option_sets
            ON tenant_option_sets.id = custom_field_definitions.option_set_id
           AND tenant_option_sets.deleted_at IS NULL
          WHERE custom_field_definitions.tenant_id = $1
            AND custom_field_definitions.deleted_at IS NULL
            AND ($2::text IS NULL OR custom_field_definitions.module_key = $2)
            AND ($3::text IS NULL OR custom_field_definitions.entity_key = $3)
          ORDER BY custom_field_definitions.module_key ASC, custom_field_definitions.entity_key ASC, custom_field_definitions.sort_order ASC, custom_field_definitions.label ASC
        `,
        [actor.tenantId, filters?.moduleKey ?? null, filters?.entityKey ?? null]
      );

      return {
        fields: fieldResult.rows.map((row) => this.mapCustomField(row))
      };
    });
  }

  async createCustomField(
    actor: ActorContext,
    audit: AuditMetadata,
    input: CreateCustomFieldRequestBody
  ): Promise<CustomFieldResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const optionSetId = input.optionSetKey
        ? await this.resolveOptionSetId(client, actor.tenantId, input.optionSetKey)
        : null;

      if (input.optionSetKey && !optionSetId) {
        throw new AppError(404, "Referenced option set was not found.", undefined, "OPTION_SET_NOT_FOUND");
      }

      const fieldKey = slugifyFieldKey(input.fieldKey ?? input.label);

      const existingResult = await client.query<{ id: string; deleted_at: Date | null }>(
        `
          SELECT id, deleted_at
          FROM custom_field_definitions
          WHERE tenant_id = $1
            AND entity_key = $2
            AND field_key = $3
          LIMIT 1
        `,
        [actor.tenantId, input.entityKey, fieldKey]
      );

      const existingField = existingResult.rows[0] ?? null;

      if (existingField && !existingField.deleted_at) {
        throw new AppError(409, "A custom field with this key already exists.", undefined, "CUSTOM_FIELD_CONFLICT");
      }

      const fieldResult = existingField?.deleted_at
        ? await client.query<CustomFieldRow>(
            `
              UPDATE custom_field_definitions
              SET
                module_key = $3,
                label = $4,
                description = $5,
                data_type = $6,
                placeholder = $7,
                option_set_id = $8,
                is_required = $9,
                is_active = $10,
                is_system_field = false,
                sort_order = $11,
                settings = $12::jsonb,
                owner_id = $13,
                updated_at = NOW(),
                updated_by = $13,
                deleted_at = NULL,
                metadata = custom_field_definitions.metadata || $14::jsonb || jsonb_build_object('restoredVia', 'tenant-config-api')
              WHERE tenant_id = $1
                AND id = $2
              RETURNING
                id,
                tenant_id,
                module_key,
                entity_key,
                field_key,
                label,
                description,
                data_type,
                placeholder,
                $15::text AS option_set_key,
                is_required,
                is_active,
                is_system_field,
                sort_order,
                settings,
                metadata,
                created_at,
                updated_at
            `,
            [
              actor.tenantId,
              existingField.id,
              input.moduleKey,
              input.label,
              input.description ?? null,
              input.dataType,
              input.placeholder ?? null,
              optionSetId,
              input.isRequired ?? false,
              input.isActive ?? true,
              input.sortOrder ?? 0,
              JSON.stringify(input.settings ?? {}),
              actor.userId,
              JSON.stringify({
                phase: "phase-5-config",
                createdVia: "tenant-config-api"
              }),
              input.optionSetKey ?? null
            ]
          )
        : await client.query<CustomFieldRow>(
            `
              INSERT INTO custom_field_definitions (
                tenant_id,
                module_key,
                entity_key,
                field_key,
                label,
                description,
                data_type,
                placeholder,
                option_set_id,
                is_required,
                is_active,
                is_system_field,
                sort_order,
                settings,
                owner_id,
                created_by,
                updated_by,
                metadata
              )
              VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11,
                false,
                $12,
                $13::jsonb,
                $14,
                $14,
                $14,
                $15::jsonb
              )
              RETURNING
                id,
                tenant_id,
                module_key,
                entity_key,
                field_key,
                label,
                description,
                data_type,
                placeholder,
                $16::text AS option_set_key,
                is_required,
                is_active,
                is_system_field,
                sort_order,
                settings,
                metadata,
                created_at,
                updated_at
            `,
            [
              actor.tenantId,
              input.moduleKey,
              input.entityKey,
              fieldKey,
              input.label,
              input.description ?? null,
              input.dataType,
              input.placeholder ?? null,
              optionSetId,
              input.isRequired ?? false,
              input.isActive ?? true,
              input.sortOrder ?? 0,
              JSON.stringify(input.settings ?? {}),
              actor.userId,
              JSON.stringify({
                phase: "phase-5-config",
                createdVia: "tenant-config-api"
              }),
              input.optionSetKey ?? null
            ]
          );

      const field = this.mapCustomField(fieldResult.rows[0]!);

      await this.recordAuditLog(client, actor, audit, {
        action: "create_custom_field",
        resourceType: "custom_field",
        resourceId: field.id,
        status: "success",
        metadata: {
          moduleKey: field.moduleKey,
          entityKey: field.entityKey,
          fieldKey: field.fieldKey
        }
      });

      return {
        field
      };
    });
  }

  async updateCustomField(
    actor: ActorContext,
    audit: AuditMetadata,
    fieldId: string,
    input: UpdateCustomFieldRequestBody
  ): Promise<CustomFieldResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const existingResult = await client.query<CustomFieldRow>(
        `
          SELECT
            custom_field_definitions.id,
            custom_field_definitions.tenant_id,
            custom_field_definitions.module_key,
            custom_field_definitions.entity_key,
            custom_field_definitions.field_key,
            custom_field_definitions.label,
            custom_field_definitions.description,
            custom_field_definitions.data_type,
            custom_field_definitions.placeholder,
            tenant_option_sets.set_key AS option_set_key,
            custom_field_definitions.is_required,
            custom_field_definitions.is_active,
            custom_field_definitions.is_system_field,
            custom_field_definitions.sort_order,
            custom_field_definitions.settings,
            custom_field_definitions.metadata,
            custom_field_definitions.created_at,
            custom_field_definitions.updated_at
          FROM custom_field_definitions
          LEFT JOIN tenant_option_sets
            ON tenant_option_sets.id = custom_field_definitions.option_set_id
           AND tenant_option_sets.deleted_at IS NULL
          WHERE custom_field_definitions.tenant_id = $1
            AND custom_field_definitions.id = $2
            AND custom_field_definitions.deleted_at IS NULL
        `,
        [actor.tenantId, fieldId]
      );

      const currentField = existingResult.rows[0];

      if (!currentField) {
        throw new AppError(404, "Custom field was not found.", undefined, "CUSTOM_FIELD_NOT_FOUND");
      }

      const optionSetId =
        input.optionSetKey === undefined
          ? await this.resolveOptionSetId(client, actor.tenantId, currentField.option_set_key ?? "")
          : input.optionSetKey
            ? await this.resolveOptionSetId(client, actor.tenantId, input.optionSetKey)
            : null;

      if (input.optionSetKey && !optionSetId) {
        throw new AppError(404, "Referenced option set was not found.", undefined, "OPTION_SET_NOT_FOUND");
      }

      const updateResult = await client.query<CustomFieldRow>(
        `
          UPDATE custom_field_definitions
          SET
            label = COALESCE($3, label),
            description = CASE
              WHEN $4::boolean THEN $5
              ELSE description
            END,
            placeholder = CASE
              WHEN $6::boolean THEN $7
              ELSE placeholder
            END,
            option_set_id = CASE
              WHEN $8::boolean THEN $9
              ELSE option_set_id
            END,
            is_required = COALESCE($10, is_required),
            is_active = COALESCE($11, is_active),
            sort_order = COALESCE($12, sort_order),
            settings = CASE
              WHEN $13::boolean THEN $14::jsonb
              ELSE settings
            END,
            updated_at = NOW(),
            updated_by = $15,
            metadata = custom_field_definitions.metadata || jsonb_build_object('updatedVia', 'tenant-config-api')
          WHERE tenant_id = $1
            AND id = $2
            AND deleted_at IS NULL
          RETURNING
            id,
            tenant_id,
            module_key,
            entity_key,
            field_key,
            label,
            description,
            data_type,
            placeholder,
            $16::text AS option_set_key,
            is_required,
            is_active,
            is_system_field,
            sort_order,
            settings,
            metadata,
            created_at,
            updated_at
        `,
        [
          actor.tenantId,
          fieldId,
          input.label ?? null,
          Object.prototype.hasOwnProperty.call(input, "description"),
          input.description ?? null,
          Object.prototype.hasOwnProperty.call(input, "placeholder"),
          input.placeholder ?? null,
          Object.prototype.hasOwnProperty.call(input, "optionSetKey"),
          optionSetId,
          input.isRequired ?? null,
          input.isActive ?? null,
          input.sortOrder ?? null,
          Object.prototype.hasOwnProperty.call(input, "settings"),
          JSON.stringify(input.settings ?? {}),
          actor.userId,
          input.optionSetKey === undefined ? currentField.option_set_key : input.optionSetKey
        ]
      );

      const field = this.mapCustomField(updateResult.rows[0]!);

      await this.recordAuditLog(client, actor, audit, {
        action: "update_custom_field",
        resourceType: "custom_field",
        resourceId: field.id,
        status: "success",
        metadata: {
          moduleKey: field.moduleKey,
          entityKey: field.entityKey,
          fieldKey: field.fieldKey
        }
      });

      return {
        field
      };
    });
  }

  async deleteCustomField(actor: ActorContext, audit: AuditMetadata, fieldId: string) {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<{ id: string }>(
        `
          UPDATE custom_field_definitions
          SET
            deleted_at = NOW(),
            updated_at = NOW(),
            updated_by = $3,
            metadata = custom_field_definitions.metadata || jsonb_build_object('deletedVia', 'tenant-config-api')
          WHERE tenant_id = $1
            AND id = $2
            AND deleted_at IS NULL
          RETURNING id
        `,
        [actor.tenantId, fieldId, actor.userId]
      );

      if (result.rowCount === 0) {
        throw new AppError(404, "Custom field was not found.", undefined, "CUSTOM_FIELD_NOT_FOUND");
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "delete_custom_field",
        resourceType: "custom_field",
        resourceId: fieldId,
        status: "success"
      });

      return {
        success: true as const
      };
    });
  }

  async listOptionSets(actor: ActorContext): Promise<TenantOptionSetsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => ({
      optionSets: await this.loadOptionSets(client, actor.tenantId)
    }));
  }

  async replaceOptionSet(
    actor: ActorContext,
    audit: AuditMetadata,
    setKey: string,
    input: ReplaceTenantOptionSetRequestBody
  ): Promise<TenantOptionSetResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const optionSetResult = await client.query<OptionSetRow>(
        `
          INSERT INTO tenant_option_sets (
            tenant_id,
            set_key,
            module_key,
            kind,
            name,
            description,
            is_system_set,
            is_active,
            owner_id,
            created_by,
            updated_by,
            metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6, false, true, $7, $7, $7, $8::jsonb)
          ON CONFLICT (tenant_id, set_key)
          DO UPDATE SET
            module_key = EXCLUDED.module_key,
            kind = EXCLUDED.kind,
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            is_active = true,
            deleted_at = NULL,
            updated_at = NOW(),
            updated_by = $7,
            metadata = tenant_option_sets.metadata || EXCLUDED.metadata
          RETURNING
            id,
            tenant_id,
            set_key,
            module_key,
            kind,
            name,
            description,
            is_system_set,
            is_active,
            metadata,
            created_at,
            updated_at
        `,
        [
          actor.tenantId,
          setKey,
          input.moduleKey ?? null,
          input.kind,
          input.name,
          input.description ?? null,
          actor.userId,
          JSON.stringify({
            updatedVia: "tenant-config-api",
            managedBy: actor.email
          })
        ]
      );

      const optionSetId = optionSetResult.rows[0]?.id;

      if (!optionSetId) {
        throw new AppError(500, "Option set could not be updated.", undefined, "OPTION_SET_ERROR");
      }

      for (const option of input.options) {
        await client.query(
          `
            INSERT INTO tenant_option_values (
              tenant_id,
              option_set_id,
              value_key,
              label,
              description,
              color,
              sort_order,
              is_default,
              is_active,
              owner_id,
              created_by,
              updated_by,
              metadata
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              COALESCE($9, true),
              $10,
              $10,
              $10,
              $11::jsonb
            )
            ON CONFLICT (tenant_id, option_set_id, value_key)
            DO UPDATE SET
              label = EXCLUDED.label,
              description = EXCLUDED.description,
              color = EXCLUDED.color,
              sort_order = EXCLUDED.sort_order,
              is_default = EXCLUDED.is_default,
              is_active = EXCLUDED.is_active,
              deleted_at = NULL,
              updated_at = NOW(),
              updated_by = $10,
              metadata = tenant_option_values.metadata || EXCLUDED.metadata
          `,
          [
            actor.tenantId,
            optionSetId,
            option.key,
            option.label,
            option.description ?? null,
            option.color ?? null,
            option.sortOrder ?? 0,
            option.isDefault ?? false,
            option.isActive ?? true,
            actor.userId,
            JSON.stringify(option.metadata ?? {})
          ]
        );
      }

      await client.query(
        `
          UPDATE tenant_option_values
          SET
            deleted_at = NOW(),
            updated_at = NOW(),
            updated_by = $3,
            metadata = tenant_option_values.metadata || jsonb_build_object('retiredVia', 'tenant-config-api')
          WHERE tenant_id = $1
            AND option_set_id = $2
            AND deleted_at IS NULL
            AND value_key <> ALL($4::text[])
        `,
        [actor.tenantId, optionSetId, actor.userId, input.options.map((option) => option.key)]
      );

      const refreshedOptionSets = await this.loadOptionSets(client, actor.tenantId);
      const optionSet = refreshedOptionSets.find((entry) => entry.setKey === setKey);

      if (!optionSet) {
        throw new AppError(500, "Option set could not be reloaded.", undefined, "OPTION_SET_ERROR");
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "replace_option_set",
        resourceType: "option_set",
        resourceId: optionSet.id,
        status: "success",
        metadata: {
          setKey,
          optionCount: input.options.length,
          kind: input.kind
        }
      });

      return {
        optionSet
      };
    });
  }

  async listFormLayouts(actor: ActorContext): Promise<CustomFormLayoutsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const result = await client.query<CustomFormLayoutRow>(
        `
          SELECT
            id,
            tenant_id,
            module_key,
            entity_key,
            layout_key,
            name,
            description,
            layout_schema,
            is_active,
            is_system_layout,
            metadata,
            created_at,
            updated_at
          FROM custom_form_layouts
          WHERE tenant_id = $1
            AND deleted_at IS NULL
          ORDER BY module_key ASC, entity_key ASC, name ASC
        `,
        [actor.tenantId]
      );

      return {
        layouts: result.rows.map((row) => this.mapCustomFormLayout(row))
      };
    });
  }
}
