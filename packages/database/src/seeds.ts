import { createHash } from "node:crypto";
import type { Pool } from "pg";
import type { CoreSeedOptions, PermissionCatalogEntry, SeedResult } from "./types.js";

export const DEFAULT_PERMISSION_CATALOG: PermissionCatalogEntry[] = [
  {
    code: "tenants.manage",
    resource: "tenants",
    action: "manage",
    description: "Manage tenant profile, configuration, and lifecycle state.",
    category: "platform"
  },
  {
    code: "users.manage",
    resource: "users",
    action: "manage",
    description: "Create, edit, deactivate, and restore tenant users.",
    category: "identity"
  },
  {
    code: "teams.manage",
    resource: "teams",
    action: "manage",
    description: "Manage teams, departments, and ownership assignments.",
    category: "identity"
  },
  {
    code: "roles.manage",
    resource: "roles",
    action: "manage",
    description: "Create roles and assign permissions within a tenant.",
    category: "identity"
  },
  {
    code: "permissions.view",
    resource: "permissions",
    action: "view",
    description: "View the platform permission catalog.",
    category: "identity"
  },
  {
    code: "audit_logs.view",
    resource: "audit_logs",
    action: "view",
    description: "Review audit history for authentication and privileged actions.",
    category: "security"
  },
  {
    code: "system_settings.manage",
    resource: "system_settings",
    action: "manage",
    description: "Manage tenant and platform configuration settings.",
    category: "platform"
  },
  {
    code: "dashboard.view",
    resource: "dashboard",
    action: "view",
    description: "View platform dashboards and scorecards.",
    category: "workspace"
  },
  {
    code: "leads.manage",
    resource: "leads",
    action: "manage",
    description: "Manage leads and qualification workflows.",
    category: "sales"
  },
  {
    code: "accounts.manage",
    resource: "accounts",
    action: "manage",
    description: "Manage accounts and customer records.",
    category: "sales"
  },
  {
    code: "opportunities.manage",
    resource: "opportunities",
    action: "manage",
    description: "Manage revenue opportunities and pipeline state.",
    category: "sales"
  },
  {
    code: "campaigns.manage",
    resource: "campaigns",
    action: "manage",
    description: "Manage campaign planning and execution.",
    category: "marketing"
  },
  {
    code: "support.manage",
    resource: "support",
    action: "manage",
    description: "Manage support tickets and service workflows.",
    category: "service"
  },
  {
    code: "customer_success.manage",
    resource: "customer_success",
    action: "manage",
    description: "Manage customer success plans, onboarding, and health.",
    category: "service"
  },
  {
    code: "ai_assistant.use",
    resource: "ai_assistant",
    action: "use",
    description: "Use AI assistant workflows within the tenant boundary.",
    category: "ai"
  }
];

const CORE_SEED_NAME = "core-bootstrap";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function createSeedChecksum(options: CoreSeedOptions) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        ...options,
        adminPassword: "[redacted]",
        permissionCatalog: DEFAULT_PERMISSION_CATALOG
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
            metadata = permissions.metadata || jsonb_build_object('seeded', true)
          WHERE code = $1
        `,
        [permission.code, permission.resource, permission.action, permission.description, permission.category]
      );

      if (updateResult.rowCount === 0) {
        await client.query(
          `
            INSERT INTO permissions (code, resource, action, description, category, metadata)
            VALUES ($1, $2, $3, $4, $5, jsonb_build_object('seeded', true))
          `,
          [permission.code, permission.resource, permission.action, permission.description, permission.category]
        );
      }
    }

    const roleResult = await client.query<{ id: string }>(
      `
        INSERT INTO roles (tenant_id, slug, name, description, is_system_role, metadata)
        VALUES (
          $1,
          'tenant-admin',
          'Tenant Admin',
          'Bootstrap administrator role for tenant setup and governance.',
          true,
          jsonb_build_object('seeded', true)
        )
        ON CONFLICT (tenant_id, slug)
        DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          is_system_role = true,
          deleted_at = NULL,
          updated_at = NOW(),
          metadata = roles.metadata || jsonb_build_object('seeded', true)
        RETURNING id
      `,
      [tenantId]
    );

    const roleId = roleResult.rows[0]?.id;

    if (!roleId) {
      throw new Error("Role seed failed to return a role id.");
    }

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

    await client.query(
      `
        INSERT INTO role_permissions (tenant_id, role_id, permission_id, created_by, updated_by, metadata)
        SELECT
          $1,
          $2,
          permissions.id,
          $3,
          $3,
          jsonb_build_object('seeded', true)
        FROM permissions
        WHERE permissions.code = ANY($4::text[])
        ON CONFLICT (tenant_id, role_id, permission_id)
        DO UPDATE SET
          deleted_at = NULL,
          updated_at = NOW(),
          updated_by = EXCLUDED.updated_by,
          metadata = role_permissions.metadata || jsonb_build_object('seeded', true)
      `,
      [tenantId, roleId, adminUserId, DEFAULT_PERMISSION_CATALOG.map((permission) => permission.code)]
    );

    await client.query(
      `
        INSERT INTO user_roles (tenant_id, user_id, role_id, created_by, updated_by, metadata)
        VALUES (
          $1,
          $2,
          $3,
          $2,
          $2,
          jsonb_build_object('seeded', true)
        )
        ON CONFLICT (tenant_id, user_id, role_id)
        DO UPDATE SET
          deleted_at = NULL,
          updated_at = NOW(),
          updated_by = EXCLUDED.updated_by,
          metadata = user_roles.metadata || jsonb_build_object('seeded', true)
      `,
      [tenantId, adminUserId, roleId]
    );

    await client.query(
      `
        UPDATE system_settings
        SET
          setting_value = jsonb_build_object('slug', $2::text, 'name', $3::text, 'adminEmail', $4::text),
          description = 'Bootstrap metadata for the default development tenant.',
          deleted_at = NULL,
          updated_at = NOW(),
          updated_by = $5,
          metadata = system_settings.metadata || jsonb_build_object('seeded', true)
        WHERE tenant_id = $1 AND setting_key = 'tenant.bootstrap'
      `,
      [tenantId, options.defaultTenantSlug, options.defaultTenantName, normalizedEmail, adminUserId]
    );

    if ((await client.query("SELECT 1 FROM system_settings WHERE tenant_id = $1 AND setting_key = 'tenant.bootstrap'", [
      tenantId
    ])).rowCount === 0) {
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
            jsonb_build_object('slug', $2::text, 'name', $3::text, 'adminEmail', $4::text),
            'Bootstrap metadata for the default development tenant.',
            $5,
            $5,
            $5,
            jsonb_build_object('seeded', true)
          )
        `,
        [tenantId, options.defaultTenantSlug, options.defaultTenantName, normalizedEmail, adminUserId]
      );
    }

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
