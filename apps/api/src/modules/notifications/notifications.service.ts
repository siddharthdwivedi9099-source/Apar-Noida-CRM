import type {
  CreateNotificationRequestBody,
  CrmLookupUserSummary,
  NotificationListQuery,
  NotificationMutationResponse,
  NotificationPreferencesResponse,
  NotificationResponse,
  NotificationsResponse,
  NotificationSummary,
  ReplaceNotificationPreferencesRequestBody,
  RoleSummary
} from "@crm/types";
import { notificationTypeCatalog } from "@crm/types";
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

interface UserLookupRow {
  id: string;
  display_name: string;
  email: string;
  team_name: string | null;
  department_name: string | null;
}

interface NotificationRow {
  id: string;
  notification_type: NotificationSummary["notificationType"];
  title: string;
  message: string;
  linked_record_type: string | null;
  linked_record_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  read_at: Date | null;
  actor_id: string | null;
  actor_display_name: string | null;
  actor_email: string | null;
  actor_team_name: string | null;
  actor_department_name: string | null;
  recipient_role_id: string | null;
  recipient_role_slug: string | null;
  recipient_role_name: string | null;
}

function getPagination(total: number, page: number, pageSize: number) {
  const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
}

function getMetadata(value: Record<string, unknown> | null | undefined) {
  return value ?? {};
}

function getPositiveNumber(value: number | undefined, fallback: number, maximum: number) {
  if (!value || value < 1) {
    return fallback;
  }

  return Math.min(value, maximum);
}

function mapUser(input: {
  id: string | null;
  displayName: string | null;
  email: string | null;
  teamName: string | null;
  departmentName: string | null;
}): CrmLookupUserSummary | null {
  if (!input.id || !input.displayName || !input.email) {
    return null;
  }

  return {
    id: input.id,
    displayName: input.displayName,
    email: input.email,
    teamName: input.teamName,
    departmentName: input.departmentName
  };
}

function getActorSummary(actor: ActorContext): CrmLookupUserSummary {
  return {
    id: actor.userId,
    displayName: actor.displayName,
    email: actor.email,
    teamName: null,
    departmentName: null
  };
}

function getRoleSummary(input: {
  id: string | null;
  slug: string | null;
  name: string | null;
}): RoleSummary | null {
  if (!input.id || !input.slug || !input.name) {
    return null;
  }

  return {
    id: input.id,
    slug: input.slug,
    name: input.name
  };
}

export class NotificationService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {}

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(
        503,
        "Notifications are unavailable until the database connection is enabled.",
        undefined,
        "NOTIFICATIONS_UNAVAILABLE"
      );
    }
  }

  private async recordAuditLog(
    client: PoolClient,
    actor: ActorContext,
    audit: AuditMetadata,
    input: {
      action: string;
      resourceId?: string | null;
      status: "success" | "failure";
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
        VALUES ($1, $2, $3, 'notifications', $4, 'notification', $5, $6, NULLIF($7, '')::inet, $8, $9, $10::jsonb)
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

  private async ensureUserExists(client: PoolClient, tenantId: string, userId: string) {
    const result = await client.query<{ id: string }>(
      `
        SELECT id
        FROM users
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
          AND status IN ('active', 'invited')
        LIMIT 1
      `,
      [userId, tenantId]
    );

    if (!result.rows[0]) {
      throw new AppError(
        404,
        "The notification recipient user was not found.",
        undefined,
        "NOTIFICATION_RECIPIENT_NOT_FOUND"
      );
    }
  }

  private async loadRole(
    client: PoolClient,
    tenantId: string,
    input: { roleId?: string | null; roleSlug?: string | null }
  ) {
    if (input.roleId) {
      const result = await client.query<{ id: string; slug: string; name: string }>(
        `
          SELECT id, slug, name
          FROM roles
          WHERE id = $1
            AND tenant_id = $2
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [input.roleId, tenantId]
      );

      return result.rows[0] ?? null;
    }

    if (input.roleSlug) {
      const result = await client.query<{ id: string; slug: string; name: string }>(
        `
          SELECT id, slug, name
          FROM roles
          WHERE slug = $1
            AND tenant_id = $2
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [input.roleSlug, tenantId]
      );

      return result.rows[0] ?? null;
    }

    return null;
  }

  private getNotificationDefault(notificationType: NotificationSummary["notificationType"]) {
    return notificationTypeCatalog.find((definition) => definition.key === notificationType)?.defaultEnabled ?? true;
  }

  private async resolveRecipients(
    client: PoolClient,
    actor: ActorContext,
    input: CreateNotificationRequestBody
  ) {
    if (input.recipientUserId) {
      await this.ensureUserExists(client, actor.tenantId, input.recipientUserId);
      return {
        userIds: [input.recipientUserId],
        recipientRole: null as RoleSummary | null
      };
    }

    const role = await this.loadRole(client, actor.tenantId, {
      roleId: input.recipientRoleId,
      roleSlug: input.recipientRoleSlug
    });

    if (!role && (input.recipientRoleId || input.recipientRoleSlug)) {
      throw new AppError(404, "The notification recipient role was not found.", undefined, "NOTIFICATION_ROLE_NOT_FOUND");
    }

    if (role) {
      const roleUsers = await client.query<{ user_id: string }>(
        `
          SELECT user_roles.user_id
          FROM user_roles
          INNER JOIN users
            ON users.id = user_roles.user_id
           AND users.tenant_id = user_roles.tenant_id
           AND users.deleted_at IS NULL
           AND users.status IN ('active', 'invited')
          WHERE user_roles.tenant_id = $1
            AND user_roles.role_id = $2
            AND user_roles.deleted_at IS NULL
        `,
        [actor.tenantId, role.id]
      );

      return {
        userIds: roleUsers.rows.map((row) => row.user_id),
        recipientRole: {
          id: role.id,
          slug: role.slug,
          name: role.name
        } satisfies RoleSummary
      };
    }

    return {
      userIds: [actor.userId],
      recipientRole: null as RoleSummary | null
    };
  }

  private async filterRecipientsByPreference(
    client: PoolClient,
    tenantId: string,
    userIds: string[],
    notificationType: NotificationSummary["notificationType"]
  ) {
    if (userIds.length === 0) {
      return [];
    }

    const result = await client.query<{ user_id: string; in_app_enabled: boolean }>(
      `
        SELECT user_id, in_app_enabled
        FROM notification_preferences
        WHERE tenant_id = $1
          AND user_id = ANY($2::uuid[])
          AND notification_type = $3
          AND deleted_at IS NULL
      `,
      [tenantId, userIds, notificationType]
    );

    const preferenceMap = new Map(result.rows.map((row) => [row.user_id, row.in_app_enabled]));
    const defaultEnabled = this.getNotificationDefault(notificationType);

    return userIds.filter((userId) => preferenceMap.get(userId) ?? defaultEnabled);
  }

  private mapNotificationRow(row: NotificationRow): NotificationSummary {
    return {
      id: row.id,
      notificationType: row.notification_type,
      title: row.title,
      message: row.message,
      isRead: Boolean(row.read_at),
      readAt: row.read_at ? row.read_at.toISOString() : null,
      createdAt: row.created_at.toISOString(),
      actor: mapUser({
        id: row.actor_id,
        displayName: row.actor_display_name,
        email: row.actor_email,
        teamName: row.actor_team_name,
        departmentName: row.actor_department_name
      }),
      recipientRole: getRoleSummary({
        id: row.recipient_role_id,
        slug: row.recipient_role_slug,
        name: row.recipient_role_name
      }),
      linkedRecord: row.linked_record_type && row.linked_record_id
        ? {
            entityType: row.linked_record_type,
            entityId: row.linked_record_id
          }
        : null,
      metadata: getMetadata(row.metadata)
    };
  }

  private async getUnreadCountWithClient(client: PoolClient, actor: ActorContext) {
    const result = await client.query<{ count: number }>(
      `
        SELECT COUNT(*)::int AS count
        FROM notification_deliveries
        WHERE tenant_id = $1
          AND recipient_user_id = $2
          AND read_at IS NULL
          AND deleted_at IS NULL
      `,
      [actor.tenantId, actor.userId]
    );

    return result.rows[0]?.count ?? 0;
  }

  async createNotificationWithClient(
    client: PoolClient,
    actor: ActorContext,
    audit: AuditMetadata,
    input: CreateNotificationRequestBody
  ): Promise<NotificationSummary> {
    this.assertEnabled();

    const resolved = await this.resolveRecipients(client, actor, input);
    const recipientRole = resolved.recipientRole;
    const enabledUserIds = await this.filterRecipientsByPreference(
      client,
      actor.tenantId,
      Array.from(new Set(resolved.userIds)),
      input.notificationType
    );

    const insertResult = await client.query<{
      id: string;
      notification_type: NotificationSummary["notificationType"];
      title: string;
      message: string;
      linked_record_type: string | null;
      linked_record_id: string | null;
      metadata: Record<string, unknown> | null;
      created_at: Date;
    }>(
      `
        INSERT INTO notifications (
          tenant_id,
          notification_type,
          title,
          message,
          linked_record_type,
          linked_record_id,
          metadata,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $8)
        RETURNING id, notification_type, title, message, linked_record_type, linked_record_id, metadata, created_at
      `,
      [
        actor.tenantId,
        input.notificationType,
        input.title.trim(),
        input.message.trim(),
        input.linkedRecord?.entityType ?? null,
        input.linkedRecord?.entityId ?? null,
        JSON.stringify(input.metadata ?? {}),
        actor.userId
      ]
    );

    const created = insertResult.rows[0];

    if (enabledUserIds.length > 0) {
      await client.query(
        `
          INSERT INTO notification_deliveries (
            tenant_id,
            notification_id,
            recipient_user_id,
            recipient_role_id,
            owner_id,
            metadata,
            created_by,
            updated_by
          )
          SELECT
            $1,
            $2,
            recipient_user_id,
            $3,
            recipient_user_id,
            $4::jsonb,
            $5,
            $5
          FROM UNNEST($6::uuid[]) AS recipient_user_id
          ON CONFLICT (notification_id, recipient_user_id)
          DO UPDATE SET
            recipient_role_id = EXCLUDED.recipient_role_id,
            owner_id = EXCLUDED.owner_id,
            metadata = notification_deliveries.metadata || EXCLUDED.metadata,
            deleted_at = NULL,
            updated_at = NOW(),
            updated_by = EXCLUDED.updated_by
        `,
        [
          actor.tenantId,
          created.id,
          recipientRole?.id ?? null,
          JSON.stringify({
            deliverySource: recipientRole ? "role" : "direct"
          }),
          actor.userId,
          enabledUserIds
        ]
      );
    }

    await this.recordAuditLog(client, actor, audit, {
      action: "notification.create",
      resourceId: created.id,
      status: "success",
      metadata: {
        notificationType: input.notificationType,
        deliveryCount: enabledUserIds.length,
        recipientRoleId: recipientRole?.id ?? null
      }
    });

    return {
      id: created.id,
      notificationType: created.notification_type,
      title: created.title,
      message: created.message,
      isRead: false,
      readAt: null,
      createdAt: created.created_at.toISOString(),
      actor: getActorSummary(actor),
      recipientRole,
      linkedRecord: created.linked_record_type && created.linked_record_id
        ? {
            entityType: created.linked_record_type,
            entityId: created.linked_record_id
          }
        : null,
      metadata: getMetadata(created.metadata)
    };
  }

  async createNotification(
    actor: ActorContext,
    audit: AuditMetadata,
    input: CreateNotificationRequestBody
  ): Promise<NotificationResponse> {
    const notification = await this.databaseService.withTransaction((client) =>
      this.createNotificationWithClient(client, actor, audit, input)
    );

    return {
      notification
    };
  }

  async listNotifications(actor: ActorContext, query: NotificationListQuery): Promise<NotificationsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const page = getPositiveNumber(query.page, 1, 10_000);
      const pageSize = getPositiveNumber(query.pageSize, 20, 100);
      const offset = (page - 1) * pageSize;
      const conditions = [
        "notification_deliveries.tenant_id = $1",
        "notification_deliveries.recipient_user_id = $2",
        "notification_deliveries.deleted_at IS NULL",
        "notifications.deleted_at IS NULL"
      ];
      const params: unknown[] = [actor.tenantId, actor.userId];

      if (query.status === "read") {
        conditions.push("notification_deliveries.read_at IS NOT NULL");
      }

      if (query.status === "unread") {
        conditions.push("notification_deliveries.read_at IS NULL");
      }

      if (query.notificationType) {
        params.push(query.notificationType);
        conditions.push(`notifications.notification_type = $${params.length}`);
      }

      const whereClause = conditions.join(" AND ");
      const countResult = await client.query<{ total: number }>(
        `
          SELECT COUNT(*)::int AS total
          FROM notification_deliveries
          INNER JOIN notifications
            ON notifications.id = notification_deliveries.notification_id
           AND notifications.tenant_id = notification_deliveries.tenant_id
          WHERE ${whereClause}
        `,
        params
      );

      params.push(pageSize, offset);
      const rows = await client.query<NotificationRow>(
        `
          SELECT
            notifications.id,
            notifications.notification_type,
            notifications.title,
            notifications.message,
            notifications.linked_record_type,
            notifications.linked_record_id,
            notifications.metadata,
            notifications.created_at,
            notification_deliveries.read_at,
            actor_users.id AS actor_id,
            actor_users.display_name AS actor_display_name,
            actor_users.email AS actor_email,
            actor_teams.name AS actor_team_name,
            actor_departments.name AS actor_department_name,
            recipient_roles.id AS recipient_role_id,
            recipient_roles.slug AS recipient_role_slug,
            recipient_roles.name AS recipient_role_name
          FROM notification_deliveries
          INNER JOIN notifications
            ON notifications.id = notification_deliveries.notification_id
           AND notifications.tenant_id = notification_deliveries.tenant_id
          LEFT JOIN users AS actor_users
            ON actor_users.id = notifications.created_by
           AND actor_users.tenant_id = notifications.tenant_id
           AND actor_users.deleted_at IS NULL
          LEFT JOIN teams AS actor_teams
            ON actor_teams.id = actor_users.team_id
           AND actor_teams.tenant_id = actor_users.tenant_id
           AND actor_teams.deleted_at IS NULL
          LEFT JOIN departments AS actor_departments
            ON actor_departments.id = actor_users.department_id
           AND actor_departments.tenant_id = actor_users.tenant_id
           AND actor_departments.deleted_at IS NULL
          LEFT JOIN roles AS recipient_roles
            ON recipient_roles.id = notification_deliveries.recipient_role_id
           AND recipient_roles.tenant_id = notification_deliveries.tenant_id
           AND recipient_roles.deleted_at IS NULL
          WHERE ${whereClause}
          ORDER BY notification_deliveries.read_at ASC NULLS FIRST, notifications.created_at DESC
          LIMIT $${params.length - 1}
          OFFSET $${params.length}
        `,
        params
      );

      return {
        notifications: rows.rows.map((row) => this.mapNotificationRow(row)),
        pagination: getPagination(countResult.rows[0]?.total ?? 0, page, pageSize),
        unreadCount: await this.getUnreadCountWithClient(client, actor),
        availableTypes: notificationTypeCatalog
      };
    });
  }

  async getPreferences(actor: ActorContext): Promise<NotificationPreferencesResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const result = await client.query<{
        notification_type: NotificationSummary["notificationType"];
        in_app_enabled: boolean;
        updated_at: Date;
      }>(
        `
          SELECT notification_type, in_app_enabled, updated_at
          FROM notification_preferences
          WHERE tenant_id = $1
            AND user_id = $2
            AND deleted_at IS NULL
        `,
        [actor.tenantId, actor.userId]
      );

      const preferenceMap = new Map(
        result.rows.map((row) => [
          row.notification_type,
          {
            enabled: row.in_app_enabled,
            updatedAt: row.updated_at.toISOString()
          }
        ])
      );

      return {
        preferences: notificationTypeCatalog.map((definition) => ({
          notificationType: definition.key,
          label: definition.label,
          description: definition.description,
          enabled: preferenceMap.get(definition.key)?.enabled ?? definition.defaultEnabled,
          updatedAt: preferenceMap.get(definition.key)?.updatedAt ?? null
        }))
      };
    });
  }

  async replacePreferences(
    actor: ActorContext,
    audit: AuditMetadata,
    input: ReplaceNotificationPreferencesRequestBody
  ): Promise<NotificationPreferencesResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      for (const preference of input.preferences) {
        await client.query(
          `
            INSERT INTO notification_preferences (
              tenant_id,
              user_id,
              owner_id,
              notification_type,
              in_app_enabled,
              metadata,
              created_by,
              updated_by
            )
            VALUES ($1, $2, $2, $3, $4, '{}'::jsonb, $2, $2)
            ON CONFLICT (tenant_id, user_id, notification_type)
            DO UPDATE SET
              in_app_enabled = EXCLUDED.in_app_enabled,
              owner_id = EXCLUDED.owner_id,
              deleted_at = NULL,
              updated_at = NOW(),
              updated_by = EXCLUDED.updated_by
          `,
          [actor.tenantId, actor.userId, preference.notificationType, preference.enabled]
        );
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "notification.preferences.replace",
        status: "success",
        metadata: {
          preferenceCount: input.preferences.length
        }
      });

      const updated = await client.query<{
        notification_type: NotificationSummary["notificationType"];
        in_app_enabled: boolean;
        updated_at: Date;
      }>(
        `
          SELECT notification_type, in_app_enabled, updated_at
          FROM notification_preferences
          WHERE tenant_id = $1
            AND user_id = $2
            AND deleted_at IS NULL
        `,
        [actor.tenantId, actor.userId]
      );

      const preferenceMap = new Map(
        updated.rows.map((row) => [
          row.notification_type,
          {
            enabled: row.in_app_enabled,
            updatedAt: row.updated_at.toISOString()
          }
        ])
      );

      return {
        preferences: notificationTypeCatalog.map((definition) => ({
          notificationType: definition.key,
          label: definition.label,
          description: definition.description,
          enabled: preferenceMap.get(definition.key)?.enabled ?? definition.defaultEnabled,
          updatedAt: preferenceMap.get(definition.key)?.updatedAt ?? null
        }))
      };
    });
  }

  async markRead(
    actor: ActorContext,
    audit: AuditMetadata,
    notificationId: string
  ): Promise<NotificationMutationResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<{ id: string }>(
        `
          UPDATE notification_deliveries
          SET
            read_at = COALESCE(read_at, NOW()),
            updated_at = NOW(),
            updated_by = $3
          WHERE tenant_id = $1
            AND recipient_user_id = $2
            AND notification_id = $4
            AND deleted_at IS NULL
          RETURNING id
        `,
        [actor.tenantId, actor.userId, actor.userId, notificationId]
      );

      if (!result.rows[0]) {
        throw new AppError(404, "The requested notification was not found.", undefined, "NOTIFICATION_NOT_FOUND");
      }

      await this.recordAuditLog(client, actor, audit, {
        action: "notification.read",
        resourceId: notificationId,
        status: "success"
      });

      return {
        success: true,
        unreadCount: await this.getUnreadCountWithClient(client, actor)
      };
    });
  }

  async markAllRead(actor: ActorContext, audit: AuditMetadata): Promise<NotificationMutationResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const updated = await client.query<{ count: number }>(
        `
          WITH changed AS (
            UPDATE notification_deliveries
            SET
              read_at = NOW(),
              updated_at = NOW(),
              updated_by = $3
            WHERE tenant_id = $1
              AND recipient_user_id = $2
              AND read_at IS NULL
              AND deleted_at IS NULL
            RETURNING id
          )
          SELECT COUNT(*)::int AS count
          FROM changed
        `,
        [actor.tenantId, actor.userId, actor.userId]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "notification.read_all",
        status: "success",
        metadata: {
          updatedCount: updated.rows[0]?.count ?? 0
        }
      });

      return {
        success: true,
        unreadCount: await this.getUnreadCountWithClient(client, actor)
      };
    });
  }
}
