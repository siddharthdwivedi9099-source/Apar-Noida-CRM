import { createHash } from "node:crypto";
import {
  defaultPermissionCatalog,
  defaultRoleTemplateDefinitions,
  type RoleTemplateDefinition
} from "@crm/types";
import type { Pool, PoolClient } from "pg";
import type { CoreSeedOptions, PermissionCatalogEntry, SeedResult } from "./types.js";

export const DEFAULT_PERMISSION_CATALOG: PermissionCatalogEntry[] = defaultPermissionCatalog.map((permission) => ({
  code: permission.code,
  resource: permission.moduleKey,
  action: permission.actionKey,
  description: permission.description,
  category: permission.actionKey
}));
const DEFAULT_PERMISSION_CODES = DEFAULT_PERMISSION_CATALOG.map((permission) => permission.code);

export const DEFAULT_ROLE_TEMPLATES = defaultRoleTemplateDefinitions;

const CORE_SEED_NAME = "core-bootstrap";
const LEGACY_BOOTSTRAP_ADMIN_ROLE_SLUG = "tenant-admin";
const DEFAULT_ADMIN_TEMPLATE_KEY = "super-admin";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function createSeedChecksum(options: CoreSeedOptions) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        ...options,
        adminPassword: "[redacted]",
        permissionCatalog: DEFAULT_PERMISSION_CATALOG,
        roleTemplates: DEFAULT_ROLE_TEMPLATES
      })
    )
    .digest("hex");
}

async function ensureSeedRunsTable(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS seed_runs (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      checksum TEXT NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function upsertPermission(client: PoolClient, permission: PermissionCatalogEntry) {
  const updateResult = await client.query(
    `
      UPDATE permissions
      SET
        resource = $2,
        action = $3,
        description = $4,
        category = $5,
        deleted_at = NULL,
        updated_at = NOW(),
        metadata = permissions.metadata || jsonb_build_object('seeded', true, 'phase', 'phase-4-rbac')
      WHERE code = $1
    `,
    [
      permission.code,
      permission.resource,
      permission.action,
      permission.description,
      permission.category
    ]
  );

  if (updateResult.rowCount === 0) {
    await client.query(
      `
        INSERT INTO permissions (code, resource, action, description, category, metadata)
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          jsonb_build_object('seeded', true, 'phase', 'phase-4-rbac')
        )
      `,
      [
        permission.code,
        permission.resource,
        permission.action,
        permission.description,
        permission.category
      ]
    );
  }
}

async function retireLegacySeededPermissions(client: PoolClient) {
  await client.query(
    `
      WITH retired_permissions AS (
        SELECT id
        FROM permissions
        WHERE deleted_at IS NULL
          AND metadata @> '{"seeded": true}'::jsonb
          AND code <> ALL($1::text[])
      )
      UPDATE role_template_permissions
      SET
        deleted_at = NOW(),
        updated_at = NOW()
      WHERE permission_id IN (SELECT id FROM retired_permissions)
        AND deleted_at IS NULL
    `,
    [DEFAULT_PERMISSION_CODES]
  );

  await client.query(
    `
      WITH retired_permissions AS (
        SELECT id
        FROM permissions
        WHERE deleted_at IS NULL
          AND metadata @> '{"seeded": true}'::jsonb
          AND code <> ALL($1::text[])
      )
      UPDATE role_permissions
      SET
        deleted_at = NOW(),
        updated_at = NOW()
      WHERE permission_id IN (SELECT id FROM retired_permissions)
        AND deleted_at IS NULL
    `,
    [DEFAULT_PERMISSION_CODES]
  );

  await client.query(
    `
      UPDATE permissions
      SET
        deleted_at = NOW(),
        updated_at = NOW(),
        metadata = permissions.metadata || jsonb_build_object('retiredBy', 'phase-4-rbac')
      WHERE deleted_at IS NULL
        AND metadata @> '{"seeded": true}'::jsonb
        AND code <> ALL($1::text[])
    `,
    [DEFAULT_PERMISSION_CODES]
  );
}

async function upsertRoleTemplate(client: PoolClient, template: RoleTemplateDefinition) {
  const templateResult = await client.query<{ id: string }>(
    `
      INSERT INTO role_templates (template_key, slug, name, description, metadata)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      ON CONFLICT (template_key)
      DO UPDATE SET
        slug = EXCLUDED.slug,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        deleted_at = NULL,
        updated_at = NOW(),
        metadata = role_templates.metadata || EXCLUDED.metadata
      RETURNING id
    `,
    [
      template.key,
      template.slug,
      template.name,
      template.description,
      JSON.stringify(template.metadata)
    ]
  );

  const templateId = templateResult.rows[0]?.id;

  if (!templateId) {
    throw new Error(`Role template seed failed for "${template.key}".`);
  }

  await client.query(
    `
      INSERT INTO role_template_permissions (
        role_template_id,
        permission_id,
        metadata
      )
      SELECT
        $1,
        permissions.id,
        jsonb_build_object('seeded', true, 'templateKey', $2::text)
      FROM permissions
      WHERE permissions.code = ANY($3::text[])
      ON CONFLICT (role_template_id, permission_id)
      DO UPDATE SET
        deleted_at = NULL,
        updated_at = NOW(),
        metadata = role_template_permissions.metadata || EXCLUDED.metadata
    `,
    [templateId, template.key, template.permissionCodes]
  );

  return templateId;
}

async function migrateLegacyBootstrapRole(client: PoolClient, tenantId: string) {
  await client.query(
    `
      UPDATE roles
      SET
        slug = 'super-admin',
        name = 'Super Admin',
        description = 'Migrated bootstrap administrator role with full tenant-wide access.',
        is_system_role = true,
        deleted_at = NULL,
        updated_at = NOW(),
        metadata = roles.metadata
          || jsonb_build_object(
            'seeded', true,
            'templateKey', $2::text,
            'migratedFromRoleSlug', $3::text
          )
      WHERE tenant_id = $1
        AND slug = $3
        AND NOT EXISTS (
          SELECT 1
          FROM roles existing_roles
          WHERE existing_roles.tenant_id = $1
            AND existing_roles.slug = 'super-admin'
        )
    `,
    [tenantId, DEFAULT_ADMIN_TEMPLATE_KEY, LEGACY_BOOTSTRAP_ADMIN_ROLE_SLUG]
  );
}

async function syncTenantRoleFromTemplate(
  client: PoolClient,
  input: {
    tenantId: string;
    actorUserId: string;
    template: RoleTemplateDefinition;
  }
) {
  const { tenantId, actorUserId, template } = input;
  const roleResult = await client.query<{ id: string }>(
    `
      INSERT INTO roles (
        tenant_id,
        slug,
        name,
        description,
        is_system_role,
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
        $6,
        $6,
        $7::jsonb
      )
      ON CONFLICT (tenant_id, slug)
      DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        deleted_at = NULL,
        updated_at = NOW(),
        updated_by = $6,
        is_system_role = roles.is_system_role OR EXCLUDED.is_system_role,
        metadata = roles.metadata || EXCLUDED.metadata
      RETURNING id
    `,
    [
      tenantId,
      template.slug,
      template.name,
      template.description,
      template.key === DEFAULT_ADMIN_TEMPLATE_KEY || template.key === "crm-admin",
      actorUserId,
      JSON.stringify({
        ...template.metadata,
        seeded: true,
        templateKey: template.key,
        templateName: template.name
      })
    ]
  );

  const roleId = roleResult.rows[0]?.id;

  if (!roleId) {
    throw new Error(`Tenant role seed failed for "${template.slug}".`);
  }

  await client.query(
    `
      INSERT INTO role_permissions (
        tenant_id,
        role_id,
        permission_id,
        created_by,
        updated_by,
        metadata
      )
      SELECT
        $1,
        $2,
        permissions.id,
        $3,
        $3,
        jsonb_build_object('seeded', true, 'templateKey', $4::text)
      FROM permissions
      WHERE permissions.code = ANY($5::text[])
      ON CONFLICT (tenant_id, role_id, permission_id)
      DO UPDATE SET
        deleted_at = NULL,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by,
        metadata = role_permissions.metadata || EXCLUDED.metadata
    `,
    [tenantId, roleId, actorUserId, template.key, template.permissionCodes]
  );

  return roleId;
}

async function ensureSeedRunsRecord(client: PoolClient, checksum: string) {
  await client.query(
    `
      INSERT INTO seed_runs (name, checksum, executed_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (name)
      DO UPDATE SET
        checksum = EXCLUDED.checksum,
        executed_at = NOW()
    `,
    [CORE_SEED_NAME, checksum]
  );
}

export async function runCoreSeed(pool: Pool, options: CoreSeedOptions): Promise<SeedResult> {
  await ensureSeedRunsTable(pool);

  const normalizedEmail = normalizeEmail(options.adminEmail);
  const displayName = `${options.adminFirstName.trim()} ${options.adminLastName.trim()}`.trim();
  const checksum = createSeedChecksum(options);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tenantResult = await client.query<{ id: string }>(
      `
        INSERT INTO tenants (slug, name, status, metadata)
        VALUES ($1, $2, 'active', jsonb_build_object('seeded', true))
        ON CONFLICT (slug)
        DO UPDATE SET
          name = EXCLUDED.name,
          status = 'active',
          deleted_at = NULL,
          updated_at = NOW(),
          metadata = tenants.metadata || jsonb_build_object('seeded', true)
        RETURNING id
      `,
      [options.defaultTenantSlug, options.defaultTenantName]
    );

    const tenantId = tenantResult.rows[0]?.id;

    if (!tenantId) {
      throw new Error("Tenant seed failed to return a tenant id.");
    }

    for (const permission of DEFAULT_PERMISSION_CATALOG) {
      await upsertPermission(client, permission);
    }

    await retireLegacySeededPermissions(client);

    for (const template of DEFAULT_ROLE_TEMPLATES) {
      await upsertRoleTemplate(client, template);
    }

    await migrateLegacyBootstrapRole(client, tenantId);

    const userResult = await client.query<{ id: string }>(
      `
        INSERT INTO users (
          tenant_id,
          email,
          normalized_email,
          first_name,
          last_name,
          display_name,
          password_hash,
          status,
          password_changed_at,
          metadata
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          crypt($7, gen_salt('bf', 12)),
          'active',
          NOW(),
          jsonb_build_object('seeded', true)
        )
        ON CONFLICT (tenant_id, normalized_email)
        DO UPDATE SET
          email = EXCLUDED.email,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          display_name = EXCLUDED.display_name,
          password_hash = crypt($7, gen_salt('bf', 12)),
          status = 'active',
          password_changed_at = NOW(),
          failed_login_attempts = 0,
          locked_until = NULL,
          deleted_at = NULL,
          updated_at = NOW(),
          metadata = users.metadata || jsonb_build_object('seeded', true)
        RETURNING id
      `,
      [
        tenantId,
        options.adminEmail.trim(),
        normalizedEmail,
        options.adminFirstName.trim(),
        options.adminLastName.trim(),
        displayName,
        options.adminPassword
      ]
    );

    const adminUserId = userResult.rows[0]?.id;

    if (!adminUserId) {
      throw new Error("Admin user seed failed to return a user id.");
    }

    await client.query(
      `
        UPDATE tenants
        SET
          owner_id = $2,
          updated_at = NOW(),
          metadata = tenants.metadata || jsonb_build_object('ownerSeeded', true)
        WHERE id = $1
      `,
      [tenantId, adminUserId]
    );

    const tenantRoleIds = new Map<string, string>();

    for (const template of DEFAULT_ROLE_TEMPLATES) {
      const roleId = await syncTenantRoleFromTemplate(client, {
        tenantId,
        actorUserId: adminUserId,
        template
      });

      tenantRoleIds.set(template.key, roleId);
    }

    const adminRoleId = tenantRoleIds.get(DEFAULT_ADMIN_TEMPLATE_KEY);

    if (!adminRoleId) {
      throw new Error("Super Admin role seed failed to return a role id.");
    }

    await client.query(
      `
        INSERT INTO user_roles (tenant_id, user_id, role_id, created_by, updated_by, metadata)
        VALUES (
          $1,
          $2,
          $3,
          $2,
          $2,
          jsonb_build_object('seeded', true, 'templateKey', $4::text)
        )
        ON CONFLICT (tenant_id, user_id, role_id)
        DO UPDATE SET
          deleted_at = NULL,
          updated_at = NOW(),
          updated_by = EXCLUDED.updated_by,
          metadata = user_roles.metadata || EXCLUDED.metadata
      `,
      [tenantId, adminUserId, adminRoleId, DEFAULT_ADMIN_TEMPLATE_KEY]
    );

    await client.query(
      `
        UPDATE system_settings
        SET
          setting_value = jsonb_build_object(
            'slug', $2::text,
            'name', $3::text,
            'adminEmail', $4::text,
            'rbacTemplateCount', $5::int
          ),
          description = 'Bootstrap metadata for the default development tenant.',
          deleted_at = NULL,
          updated_at = NOW(),
          updated_by = $6,
          metadata = system_settings.metadata || jsonb_build_object('seeded', true, 'phase', 'phase-4-rbac')
        WHERE tenant_id = $1 AND setting_key = 'tenant.bootstrap'
      `,
      [
        tenantId,
        options.defaultTenantSlug,
        options.defaultTenantName,
        normalizedEmail,
        DEFAULT_ROLE_TEMPLATES.length,
        adminUserId
      ]
    );

    if (
      (
        await client.query(
          "SELECT 1 FROM system_settings WHERE tenant_id = $1 AND setting_key = 'tenant.bootstrap'",
          [tenantId]
        )
      ).rowCount === 0
    ) {
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
          VALUES (
            $1,
            'tenant.bootstrap',
            jsonb_build_object(
              'slug', $2::text,
              'name', $3::text,
              'adminEmail', $4::text,
              'rbacTemplateCount', $5::int
            ),
            'Bootstrap metadata for the default development tenant.',
            $6,
            $6,
            $6,
            jsonb_build_object('seeded', true, 'phase', 'phase-4-rbac')
          )
        `,
        [
          tenantId,
          options.defaultTenantSlug,
          options.defaultTenantName,
          normalizedEmail,
          DEFAULT_ROLE_TEMPLATES.length,
          adminUserId
        ]
      );
    }

    await ensureSeedRunsRecord(client, checksum);
    await client.query("COMMIT");

    return {
      applied: [CORE_SEED_NAME]
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
