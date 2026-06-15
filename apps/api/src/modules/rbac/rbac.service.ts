import type {
  CreateRoleRequestBody,
  PermissionActionKey,
  PermissionModuleKey,
  PermissionSummary,
  RbacActionSummary,
  RbacCatalogResponse,
  RbacModuleSummary,
  RbacRolesResponse,
  RbacUserSummary,
  RbacUsersResponse,
  ReplaceRolePermissionsRequestBody,
  ReplaceUserRolesRequestBody,
  RoleDetail,
  RoleResponse,
  RoleSummary,
  RoleTemplateSummary,
  UpdateRoleRequestBody,
  UserRolesResponse
} from "@crm/types";
import {
  permissionActionKeys,
  permissionActionLabels,
  permissionModuleKeys,
  permissionModuleLabels
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

interface PermissionRow {
  id: string;
  code: string;
  resource: string;
  action: string;
  description: string;
}

interface RoleRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_system_role: boolean;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  user_count: string;
}

interface RolePermissionRow extends PermissionRow {
  role_id: string;
}

interface RoleTemplateRow {
  id: string;
  template_key: string;
  slug: string;
  name: string;
  description: string;
  metadata: Record<string, unknown> | null;
}

interface RoleTemplatePermissionRow extends PermissionRow {
  role_template_id: string;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  status: string;
  team_name: string | null;
  department_name: string | null;
  created_at: Date;
  last_login_at: Date | null;
}

interface UserRoleRow {
  user_id: string;
  id: string;
  slug: string;
  name: string;
}

interface UserPermissionRow extends PermissionRow {
  user_id: string;
}

const ADMIN_VIEW_PERMISSION = "admin.view";
const ADMIN_ASSIGN_PERMISSION = "admin.assign";
const MANAGED_PERMISSION_RESOURCES = permissionModuleKeys as readonly string[];
const MANAGED_PERMISSION_ACTIONS = permissionActionKeys as readonly string[];

function normalizeRoleSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function sortPermissionSummaries(left: PermissionSummary, right: PermissionSummary) {
  return left.code.localeCompare(right.code);
}

function toModuleSummary(moduleKey: PermissionModuleKey): RbacModuleSummary {
  return {
    key: moduleKey,
    label: permissionModuleLabels[moduleKey]
  };
}

function toActionSummary(actionKey: PermissionActionKey): RbacActionSummary {
  return {
    key: actionKey,
    label: permissionActionLabels[actionKey]
  };
}

function isManagedPermissionRow(row: { resource: string; action: string }) {
  return MANAGED_PERMISSION_RESOURCES.includes(row.resource) && MANAGED_PERMISSION_ACTIONS.includes(row.action);
}

export class RbacService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {}

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(
        503,
        "RBAC management is unavailable until the database connection is enabled.",
        undefined,
        "RBAC_UNAVAILABLE"
      );
    }
  }

  private mapPermission(row: PermissionRow): PermissionSummary {
    const moduleKey = row.resource as PermissionModuleKey;
    const actionKey = row.action as PermissionActionKey;

    return {
      id: row.id,
      code: row.code,
      moduleKey,
      moduleLabel: permissionModuleLabels[moduleKey],
      actionKey,
      actionLabel: permissionActionLabels[actionKey],
      description: row.description
    };
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
        VALUES ($1, $2, $3, 'rbac', $4, $5, $6, $7, NULLIF($8, '')::inet, $9, $10, $11::jsonb)
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

  private async loadManagedPermissions(client: PoolClient) {
    const permissionResult = await client.query<PermissionRow>(
      `
        SELECT id, code, resource, action, description
        FROM permissions
        WHERE deleted_at IS NULL
          AND resource = ANY($1::text[])
          AND action = ANY($2::text[])
        ORDER BY resource ASC, action ASC
      `,
      [permissionModuleKeys, permissionActionKeys]
    );

    return permissionResult.rows.filter(isManagedPermissionRow).map((row) => this.mapPermission(row));
  }

  private async loadRoleTemplates(client: PoolClient) {
    const templateResult = await client.query<RoleTemplateRow>(
      `
        SELECT id, template_key, slug, name, description, metadata
        FROM role_templates
        WHERE deleted_at IS NULL
        ORDER BY name ASC
      `
    );

    if (templateResult.rows.length === 0) {
      return [] satisfies RoleTemplateSummary[];
    }

    const templatePermissionResult = await client.query<RoleTemplatePermissionRow>(
      `
        SELECT
          role_template_permissions.role_template_id,
          permissions.id,
          permissions.code,
          permissions.resource,
          permissions.action,
          permissions.description
        FROM role_template_permissions
        INNER JOIN permissions
          ON permissions.id = role_template_permissions.permission_id
        WHERE role_template_permissions.deleted_at IS NULL
          AND permissions.deleted_at IS NULL
        ORDER BY permissions.code ASC
      `
    );

    const permissionMap = new Map<string, PermissionSummary[]>();

    for (const row of templatePermissionResult.rows) {
      if (!isManagedPermissionRow(row)) {
        continue;
      }

      const permissions = permissionMap.get(row.role_template_id) ?? [];
      permissions.push(this.mapPermission(row));
      permissionMap.set(row.role_template_id, permissions);
    }

    return templateResult.rows.map((row) => {
      const permissions = (permissionMap.get(row.id) ?? []).sort(sortPermissionSummaries);

      return {
        id: row.id,
        key: row.template_key,
        slug: row.slug,
        name: row.name,
        description: row.description,
        permissionCodes: permissions.map((permission) => permission.code),
        permissions,
        metadata: row.metadata ?? {}
      } satisfies RoleTemplateSummary;
    });
  }

  private async loadRoleDetails(
    client: PoolClient,
    tenantId: string,
    roleIds?: string[]
  ) {
    const roleFilters: string[] = ["roles.tenant_id = $1", "roles.deleted_at IS NULL"];
    const params: unknown[] = [tenantId];

    if (roleIds && roleIds.length > 0) {
      params.push(roleIds);
      roleFilters.push(`roles.id = ANY($${params.length}::uuid[])`);
    }

    const roleResult = await client.query<RoleRow>(
      `
        SELECT
          roles.id,
          roles.slug,
          roles.name,
          roles.description,
          roles.is_system_role,
          roles.metadata,
          roles.created_at,
          roles.updated_at,
          COUNT(DISTINCT user_roles.user_id)::text AS user_count
        FROM roles
        LEFT JOIN user_roles
          ON user_roles.role_id = roles.id
          AND user_roles.tenant_id = roles.tenant_id
          AND user_roles.deleted_at IS NULL
          AND (user_roles.expires_at IS NULL OR user_roles.expires_at > NOW())
        WHERE ${roleFilters.join(" AND ")}
        GROUP BY roles.id
        ORDER BY roles.is_system_role DESC, roles.name ASC
      `,
      params
    );

    if (roleResult.rows.length === 0) {
      return [] satisfies RoleDetail[];
    }

    const resolvedRoleIds = roleResult.rows.map((row) => row.id);
    const permissionResult = await client.query<RolePermissionRow>(
      `
        SELECT
          role_permissions.role_id,
          permissions.id,
          permissions.code,
          permissions.resource,
          permissions.action,
          permissions.description
        FROM role_permissions
        INNER JOIN permissions
          ON permissions.id = role_permissions.permission_id
        WHERE role_permissions.tenant_id = $1
          AND role_permissions.role_id = ANY($2::uuid[])
          AND role_permissions.deleted_at IS NULL
          AND permissions.deleted_at IS NULL
        ORDER BY permissions.code ASC
      `,
      [tenantId, resolvedRoleIds]
    );

    const permissionMap = new Map<string, PermissionSummary[]>();

    for (const row of permissionResult.rows) {
      if (!isManagedPermissionRow(row)) {
        continue;
      }

      const permissions = permissionMap.get(row.role_id) ?? [];
      permissions.push(this.mapPermission(row));
      permissionMap.set(row.role_id, permissions);
    }

    return roleResult.rows.map((row) => {
      const permissions = (permissionMap.get(row.id) ?? []).sort(sortPermissionSummaries);
      const templateKey =
        typeof row.metadata?.templateKey === "string" ? String(row.metadata.templateKey) : null;

      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        isSystemRole: row.is_system_role,
        templateKey,
        permissions,
        permissionCodes: permissions.map((permission) => permission.code),
        userCount: Number(row.user_count),
        metadata: row.metadata ?? {},
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString()
      } satisfies RoleDetail;
    });
  }

  private async getRoleById(client: PoolClient, tenantId: string, roleId: string) {
    const [role] = await this.loadRoleDetails(client, tenantId, [roleId]);

    if (!role) {
      throw new AppError(404, "Role not found.", undefined, "ROLE_NOT_FOUND");
    }

    return role;
  }

  private async getTemplatePermissionCodes(client: PoolClient, templateKey: string) {
    const result = await client.query<{ code: string }>(
      `
        SELECT permissions.code
        FROM role_templates
        INNER JOIN role_template_permissions
          ON role_template_permissions.role_template_id = role_templates.id
        INNER JOIN permissions
          ON permissions.id = role_template_permissions.permission_id
        WHERE role_templates.template_key = $1
          AND role_templates.deleted_at IS NULL
          AND role_template_permissions.deleted_at IS NULL
          AND permissions.deleted_at IS NULL
        ORDER BY permissions.code ASC
      `,
      [templateKey]
    );

    if (result.rows.length === 0) {
      throw new AppError(400, "The selected role template does not exist.", undefined, "INVALID_ROLE_TEMPLATE");
    }

    return result.rows.map((row) => row.code);
  }

  private async validatePermissionCodes(client: PoolClient, permissionCodes: string[]) {
    if (permissionCodes.length === 0) {
      return [] as { id: string; code: string }[];
    }

    const result = await client.query<{ id: string; code: string }>(
      `
        SELECT id, code
        FROM permissions
        WHERE code = ANY($1::text[])
          AND deleted_at IS NULL
          AND resource = ANY($2::text[])
          AND action = ANY($3::text[])
        ORDER BY code ASC
      `,
      [permissionCodes, permissionModuleKeys, permissionActionKeys]
    );

    if (result.rows.length !== unique(permissionCodes).length) {
      const validPermissionCodes = new Set(result.rows.map((row) => row.code));
      const invalidPermissionCodes = unique(permissionCodes).filter((code) => !validPermissionCodes.has(code));

      throw new AppError(
        400,
        "One or more permissions are invalid.",
        { invalidPermissionCodes },
        "INVALID_PERMISSION_CODES"
      );
    }

    return result.rows;
  }

  private async findRoleBySlug(client: PoolClient, tenantId: string, roleSlug: string) {
    const result = await client.query<{
      id: string;
      deleted_at: Date | null;
    }>(
      `
        SELECT id, deleted_at
        FROM roles
        WHERE tenant_id = $1
          AND slug = $2
        LIMIT 1
      `,
      [tenantId, roleSlug]
    );

    return result.rows[0] ?? null;
  }

  private async ensureUniqueRoleSlug(
    client: PoolClient,
    tenantId: string,
    roleSlug: string,
    excludedRoleId?: string
  ) {
    const params: unknown[] = [tenantId, roleSlug];
    const filters = ["tenant_id = $1", "slug = $2"];

    if (excludedRoleId) {
      params.push(excludedRoleId);
      filters.push(`id <> $${params.length}`);
    }

    const result = await client.query(
      `
        SELECT 1
        FROM roles
        WHERE ${filters.join(" AND ")}
        LIMIT 1
      `,
      params
    );

    if (result.rowCount) {
      throw new AppError(409, "A role with this slug already exists.", undefined, "ROLE_SLUG_CONFLICT");
    }
  }

  private async syncRolePermissions(
    client: PoolClient,
    actor: ActorContext,
    roleId: string,
    permissionRows: { id: string; code: string }[]
  ) {
    const permissionIds = permissionRows.map((permission) => permission.id);

    if (permissionIds.length === 0) {
      await client.query(
        `
          UPDATE role_permissions
          SET
            deleted_at = NOW(),
            updated_at = NOW(),
            updated_by = $3
          WHERE tenant_id = $1
            AND role_id = $2
            AND deleted_at IS NULL
        `,
        [actor.tenantId, roleId, actor.userId]
      );
      return;
    }

    await client.query(
      `
        UPDATE role_permissions
        SET
          deleted_at = NOW(),
          updated_at = NOW(),
          updated_by = $4
        WHERE tenant_id = $1
          AND role_id = $2
          AND deleted_at IS NULL
          AND permission_id <> ALL($3::uuid[])
      `,
      [actor.tenantId, roleId, permissionIds, actor.userId]
    );

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
          jsonb_build_object('assignedBy', ($3::uuid)::text)
        FROM permissions
        WHERE permissions.id = ANY($4::uuid[])
        ON CONFLICT (tenant_id, role_id, permission_id)
        DO UPDATE SET
          deleted_at = NULL,
          updated_at = NOW(),
          updated_by = EXCLUDED.updated_by,
          metadata = role_permissions.metadata || EXCLUDED.metadata
      `,
      [actor.tenantId, roleId, actor.userId, permissionIds]
    );
  }

  private async validateRoleIds(client: PoolClient, tenantId: string, roleIds: string[]) {
    if (roleIds.length === 0) {
      return [] as RoleDetail[];
    }

    const roles = await this.loadRoleDetails(client, tenantId, unique(roleIds));

    if (roles.length !== unique(roleIds).length) {
      const resolvedRoleIds = new Set(roles.map((role) => role.id));
      const invalidRoleIds = unique(roleIds).filter((roleId) => !resolvedRoleIds.has(roleId));

      throw new AppError(400, "One or more roles are invalid.", { invalidRoleIds }, "INVALID_ROLE_IDS");
    }

    return roles;
  }

  private async loadUsers(client: PoolClient, tenantId: string) {
    const userResult = await client.query<UserRow>(
      `
        SELECT
          users.id,
          users.email,
          users.display_name,
          users.status,
          teams.name AS team_name,
          departments.name AS department_name,
          users.created_at,
          users.last_login_at
        FROM users
        LEFT JOIN teams
          ON teams.id = users.team_id
          AND teams.tenant_id = users.tenant_id
        LEFT JOIN departments
          ON departments.id = users.department_id
          AND departments.tenant_id = users.tenant_id
        WHERE users.tenant_id = $1
          AND users.deleted_at IS NULL
        ORDER BY users.display_name ASC, users.email ASC
      `,
      [tenantId]
    );

    if (userResult.rows.length === 0) {
      return [] satisfies RbacUserSummary[];
    }

    const userIds = userResult.rows.map((row) => row.id);

    const roleResult = await client.query<UserRoleRow>(
      `
        SELECT
          user_roles.user_id,
          roles.id,
          roles.slug,
          roles.name
        FROM user_roles
        INNER JOIN roles
          ON roles.id = user_roles.role_id
          AND roles.tenant_id = user_roles.tenant_id
        WHERE user_roles.tenant_id = $1
          AND user_roles.user_id = ANY($2::uuid[])
          AND user_roles.deleted_at IS NULL
          AND roles.deleted_at IS NULL
          AND (user_roles.expires_at IS NULL OR user_roles.expires_at > NOW())
        ORDER BY roles.name ASC
      `,
      [tenantId, userIds]
    );

    const permissionResult = await client.query<UserPermissionRow>(
      `
        SELECT
          user_roles.user_id,
          permissions.id,
          permissions.code,
          permissions.resource,
          permissions.action,
          permissions.description
        FROM user_roles
        INNER JOIN role_permissions
          ON role_permissions.role_id = user_roles.role_id
          AND role_permissions.tenant_id = user_roles.tenant_id
        INNER JOIN permissions
          ON permissions.id = role_permissions.permission_id
        WHERE user_roles.tenant_id = $1
          AND user_roles.user_id = ANY($2::uuid[])
          AND user_roles.deleted_at IS NULL
          AND role_permissions.deleted_at IS NULL
          AND permissions.deleted_at IS NULL
          AND (user_roles.expires_at IS NULL OR user_roles.expires_at > NOW())
        ORDER BY permissions.code ASC
      `,
      [tenantId, userIds]
    );

    const roleMap = new Map<string, RoleSummary[]>();

    for (const row of roleResult.rows) {
      const roles = roleMap.get(row.user_id) ?? [];
      roles.push({
        id: row.id,
        slug: row.slug,
        name: row.name
      });
      roleMap.set(row.user_id, roles);
    }

    const permissionMap = new Map<string, string[]>();

    for (const row of permissionResult.rows) {
      if (!isManagedPermissionRow(row)) {
        continue;
      }

      const permissionCodes = permissionMap.get(row.user_id) ?? [];
      permissionCodes.push(row.code);
      permissionMap.set(row.user_id, permissionCodes);
    }

    return userResult.rows.map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      status: row.status,
      teamName: row.team_name,
      departmentName: row.department_name,
      roles: roleMap.get(row.id) ?? [],
      permissionCodes: unique(permissionMap.get(row.id) ?? []).sort((left, right) => left.localeCompare(right)),
      createdAt: row.created_at.toISOString(),
      lastLoginAt: row.last_login_at?.toISOString() ?? null
    }));
  }

  private async getUserById(client: PoolClient, tenantId: string, userId: string) {
    const users = await this.loadUsers(client, tenantId);
    const user = users.find((entry) => entry.id === userId);

    if (!user) {
      throw new AppError(404, "User not found.", undefined, "USER_NOT_FOUND");
    }

    return user;
  }

  async getCatalog(): Promise<RbacCatalogResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const [permissions, roleTemplates] = await Promise.all([
        this.loadManagedPermissions(client),
        this.loadRoleTemplates(client)
      ]);

      return {
        modules: permissionModuleKeys.map((moduleKey) => toModuleSummary(moduleKey)),
        actions: permissionActionKeys.map((actionKey) => toActionSummary(actionKey)),
        permissions,
        roleTemplates
      };
    });
  }

  async listRoles(actor: ActorContext): Promise<RbacRolesResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => ({
      roles: await this.loadRoleDetails(client, actor.tenantId)
    }));
  }

  async createRole(
    actor: ActorContext,
    audit: AuditMetadata,
    payload: CreateRoleRequestBody
  ): Promise<RoleResponse> {
    this.assertEnabled();

    const normalizedSlug = normalizeRoleSlug(payload.slug || payload.name);

    if (!normalizedSlug) {
      throw new AppError(400, "A valid role slug is required.", undefined, "INVALID_ROLE_SLUG");
    }

    return this.databaseService.withTransaction(async (client) => {
      const existingRole = await this.findRoleBySlug(client, actor.tenantId, normalizedSlug);
      const templatePermissionCodes = payload.templateKey
        ? await this.getTemplatePermissionCodes(client, payload.templateKey)
        : [];
      const desiredPermissionCodes = unique([...(payload.permissionCodes ?? []), ...templatePermissionCodes]);
      const permissionRows = await this.validatePermissionCodes(client, desiredPermissionCodes);

      let roleId: string;

      if (existingRole?.deleted_at) {
        await client.query(
          `
            UPDATE roles
            SET
              name = $3,
              description = $4,
              deleted_at = NULL,
              updated_at = NOW(),
              updated_by = $5,
              metadata = roles.metadata || $6::jsonb
            WHERE tenant_id = $1
              AND id = $2
          `,
          [
            actor.tenantId,
            existingRole.id,
            payload.name.trim(),
            payload.description?.trim() || null,
            actor.userId,
            JSON.stringify({
              templateKey: payload.templateKey ?? null,
              createdByRoleManagement: true
            })
          ]
        );
        roleId = existingRole.id;
      } else {
        if (existingRole) {
          throw new AppError(409, "A role with this slug already exists.", undefined, "ROLE_SLUG_CONFLICT");
        }

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
            VALUES ($1, $2, $3, $4, false, $5, $5, $5, $6::jsonb)
            RETURNING id
          `,
          [
            actor.tenantId,
            normalizedSlug,
            payload.name.trim(),
            payload.description?.trim() || null,
            actor.userId,
            JSON.stringify({
              templateKey: payload.templateKey ?? null,
              createdByRoleManagement: true
            })
          ]
        );

        roleId = roleResult.rows[0]?.id ?? "";
      }

      if (!roleId) {
        throw new Error("Role creation failed to return an id.");
      }

      await this.syncRolePermissions(client, actor, roleId, permissionRows);

      await this.recordAuditLog(client, actor, audit, {
        action: "rbac.role.create",
        resourceType: "role",
        resourceId: roleId,
        status: "success",
        metadata: {
          slug: normalizedSlug,
          permissionCodes: desiredPermissionCodes,
          templateKey: payload.templateKey ?? null
        }
      });

      return {
        role: await this.getRoleById(client, actor.tenantId, roleId)
      };
    });
  }

  async updateRole(
    actor: ActorContext,
    audit: AuditMetadata,
    roleId: string,
    payload: UpdateRoleRequestBody
  ): Promise<RoleResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const existingRole = await this.getRoleById(client, actor.tenantId, roleId);
      const nextSlug = payload.slug ? normalizeRoleSlug(payload.slug) : existingRole.slug;

      if (!nextSlug) {
        throw new AppError(400, "A valid role slug is required.", undefined, "INVALID_ROLE_SLUG");
      }

      await this.ensureUniqueRoleSlug(client, actor.tenantId, nextSlug, roleId);

      await client.query(
        `
          UPDATE roles
          SET
            slug = $3,
            name = $4,
            description = $5,
            updated_at = NOW(),
            updated_by = $6
          WHERE tenant_id = $1
            AND id = $2
            AND deleted_at IS NULL
        `,
        [
          actor.tenantId,
          roleId,
          nextSlug,
          payload.name?.trim() || existingRole.name,
          payload.description === undefined ? existingRole.description : payload.description?.trim() || null,
          actor.userId
        ]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "rbac.role.update",
        resourceType: "role",
        resourceId: roleId,
        status: "success",
        metadata: {
          previousSlug: existingRole.slug,
          nextSlug
        }
      });

      return {
        role: await this.getRoleById(client, actor.tenantId, roleId)
      };
    });
  }

  async deleteRole(actor: ActorContext, audit: AuditMetadata, roleId: string) {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const role = await this.getRoleById(client, actor.tenantId, roleId);

      if (role.isSystemRole) {
        throw new AppError(409, "System roles cannot be deleted.", undefined, "SYSTEM_ROLE_PROTECTED");
      }

      await client.query(
        `
          UPDATE roles
          SET
            deleted_at = NOW(),
            updated_at = NOW(),
            updated_by = $3
          WHERE tenant_id = $1
            AND id = $2
            AND deleted_at IS NULL
        `,
        [actor.tenantId, roleId, actor.userId]
      );

      await client.query(
        `
          UPDATE role_permissions
          SET
            deleted_at = NOW(),
            updated_at = NOW(),
            updated_by = $3
          WHERE tenant_id = $1
            AND role_id = $2
            AND deleted_at IS NULL
        `,
        [actor.tenantId, roleId, actor.userId]
      );

      await client.query(
        `
          UPDATE user_roles
          SET
            deleted_at = NOW(),
            updated_at = NOW(),
            updated_by = $3
          WHERE tenant_id = $1
            AND role_id = $2
            AND deleted_at IS NULL
        `,
        [actor.tenantId, roleId, actor.userId]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "rbac.role.delete",
        resourceType: "role",
        resourceId: roleId,
        status: "success",
        metadata: {
          slug: role.slug,
          name: role.name
        }
      });

      return {
        success: true as const
      };
    });
  }

  async replaceRolePermissions(
    actor: ActorContext,
    audit: AuditMetadata,
    roleId: string,
    payload: ReplaceRolePermissionsRequestBody
  ): Promise<RoleResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const role = await this.getRoleById(client, actor.tenantId, roleId);
      const desiredPermissionCodes = unique(payload.permissionCodes ?? []);
      const permissionRows = await this.validatePermissionCodes(client, desiredPermissionCodes);

      await this.syncRolePermissions(client, actor, roleId, permissionRows);

      await this.recordAuditLog(client, actor, audit, {
        action: "rbac.role.permissions.replace",
        resourceType: "role",
        resourceId: roleId,
        status: "success",
        metadata: {
          slug: role.slug,
          permissionCodes: desiredPermissionCodes
        }
      });

      return {
        role: await this.getRoleById(client, actor.tenantId, roleId)
      };
    });
  }

  async listUsers(actor: ActorContext): Promise<RbacUsersResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => ({
      users: await this.loadUsers(client, actor.tenantId)
    }));
  }

  async replaceUserRoles(
    actor: ActorContext,
    audit: AuditMetadata,
    userId: string,
    payload: ReplaceUserRolesRequestBody
  ): Promise<UserRolesResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      await this.getUserById(client, actor.tenantId, userId);

      const roles = await this.validateRoleIds(client, actor.tenantId, unique(payload.roleIds ?? []));

      if (userId === actor.userId) {
        const nextPermissionCodes = new Set(roles.flatMap((role) => role.permissionCodes));

        if (!nextPermissionCodes.has(ADMIN_VIEW_PERMISSION) || !nextPermissionCodes.has(ADMIN_ASSIGN_PERMISSION)) {
          throw new AppError(
            400,
            "You cannot remove your own administrative access in the current session.",
            undefined,
            "SELF_ADMIN_ACCESS_REQUIRED"
          );
        }
      }

      const roleIds = roles.map((role) => role.id);

      if (roleIds.length === 0) {
        await client.query(
          `
            UPDATE user_roles
            SET
              deleted_at = NOW(),
              updated_at = NOW(),
              updated_by = $3
            WHERE tenant_id = $1
              AND user_id = $2
              AND deleted_at IS NULL
          `,
          [actor.tenantId, userId, actor.userId]
        );
      } else {
        await client.query(
          `
            UPDATE user_roles
            SET
              deleted_at = NOW(),
              updated_at = NOW(),
              updated_by = $4
            WHERE tenant_id = $1
              AND user_id = $2
              AND deleted_at IS NULL
              AND role_id <> ALL($3::uuid[])
          `,
          [actor.tenantId, userId, roleIds, actor.userId]
        );

        await client.query(
          `
            INSERT INTO user_roles (
              tenant_id,
              user_id,
              role_id,
              created_by,
              updated_by,
              metadata
            )
            SELECT
              $1,
              $2,
              roles.id,
              $3,
              $3,
              jsonb_build_object('assignedBy', ($3::uuid)::text)
            FROM roles
            WHERE roles.id = ANY($4::uuid[])
            ON CONFLICT (tenant_id, user_id, role_id)
            DO UPDATE SET
              deleted_at = NULL,
              updated_at = NOW(),
              updated_by = EXCLUDED.updated_by,
              metadata = user_roles.metadata || EXCLUDED.metadata
          `,
          [actor.tenantId, userId, actor.userId, roleIds]
        );
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "rbac.user.roles.replace",
        resourceType: "user",
        resourceId: userId,
        status: "success",
        metadata: {
          roleIds
        }
      });

      return {
        user: await this.getUserById(client, actor.tenantId, userId)
      };
    });
  }
}
