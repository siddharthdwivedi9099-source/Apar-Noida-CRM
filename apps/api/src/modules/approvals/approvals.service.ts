import type {
  AddApprovalCommentRequestBody,
  ApprovalDecisionRequestBody,
  ApprovalHistoryEntry,
  ApprovalListQuery,
  ApprovalRequestDetail,
  ApprovalRequestSummary,
  ApprovalResponse,
  ApprovalsResponse,
  CreateApprovalRequestBody,
  CrmLookupUserSummary,
  RoleSummary
} from "@crm/types";
import { approvalTypeCatalog } from "@crm/types";
import type { PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import { getPositiveNumber } from "../../common/pagination.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { NotificationService } from "../notifications/notifications.service.js";

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

interface ApprovalRow {
  id: string;
  approval_type: ApprovalRequestSummary["approvalType"];
  title: string;
  description: string | null;
  status: ApprovalRequestSummary["status"];
  linked_record_type: string | null;
  linked_record_id: string | null;
  decision_comment: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  decided_at: Date | null;
  requested_by_user_id: string;
  approver_user_id: string | null;
  approver_role_id: string | null;
  decision_by_user_id: string | null;
  requested_by_display_name: string | null;
  requested_by_email: string | null;
  requested_by_team_name: string | null;
  requested_by_department_name: string | null;
  approver_user_display_name: string | null;
  approver_user_email: string | null;
  approver_user_team_name: string | null;
  approver_user_department_name: string | null;
  decision_by_display_name: string | null;
  decision_by_email: string | null;
  decision_by_team_name: string | null;
  decision_by_department_name: string | null;
  approver_role_slug: string | null;
  approver_role_name: string | null;
  latest_comment: string | null;
}

interface ApprovalHistoryRow {
  id: string;
  action_type: ApprovalHistoryEntry["action"];
  from_status: ApprovalHistoryEntry["fromStatus"];
  to_status: ApprovalHistoryEntry["toStatus"];
  comment: string | null;
  created_at: Date;
  metadata: Record<string, unknown> | null;
  actor_id: string | null;
  actor_display_name: string | null;
  actor_email: string | null;
  actor_team_name: string | null;
  actor_department_name: string | null;
}

function getMetadata(value: Record<string, unknown> | null | undefined) {
  return value ?? {};
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

function mapRole(input: { id: string | null; slug: string | null; name: string | null }): RoleSummary | null {
  if (!input.id || !input.slug || !input.name) {
    return null;
  }

  return {
    id: input.id,
    slug: input.slug,
    name: input.name
  };
}

export class ApprovalService {
  private readonly notificationService: NotificationService;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {
    this.notificationService = new NotificationService(databaseService, config);
  }

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(
        503,
        "Approvals are unavailable until the database connection is enabled.",
        undefined,
        "APPROVALS_UNAVAILABLE"
      );
    }
  }

  private canManageAll(actor: ActorContext) {
    return actor.permissionCodes.includes("approvals.configure") || actor.permissionCodes.includes("admin.configure");
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
        VALUES ($1, $2, $3, 'approvals', $4, 'approval_request', $5, $6, NULLIF($7, '')::inet, $8, $9, $10::jsonb)
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
      throw new AppError(404, "The approver user was not found.", undefined, "APPROVER_NOT_FOUND");
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

  private async resolveApprover(
    client: PoolClient,
    actor: ActorContext,
    input: { approverUserId?: string | null; approverRoleId?: string | null; approverRoleSlug?: string | null }
  ) {
    if (input.approverUserId) {
      await this.ensureUserExists(client, actor.tenantId, input.approverUserId);
      return {
        approverUserId: input.approverUserId,
        approverRole: null as RoleSummary | null
      };
    }

    const role = await this.loadRole(client, actor.tenantId, {
      roleId: input.approverRoleId,
      roleSlug: input.approverRoleSlug
    });

    if (role) {
      return {
        approverUserId: null,
        approverRole: {
          id: role.id,
          slug: role.slug,
          name: role.name
        } satisfies RoleSummary
      };
    }

    if (input.approverRoleId || input.approverRoleSlug) {
      throw new AppError(404, "The approver role was not found.", undefined, "APPROVER_ROLE_NOT_FOUND");
    }

    throw new AppError(
      400,
      "An approver user or role is required.",
      undefined,
      "APPROVER_REQUIRED"
    );
  }

  private mapApprovalRow(row: ApprovalRow): ApprovalRequestSummary {
    return {
      id: row.id,
      approvalType: row.approval_type,
      title: row.title,
      description: row.description,
      status: row.status,
      requestedBy: mapUser({
        id: row.requested_by_user_id,
        displayName: row.requested_by_display_name,
        email: row.requested_by_email,
        teamName: row.requested_by_team_name,
        departmentName: row.requested_by_department_name
      }),
      approverUser: mapUser({
        id: row.approver_user_id,
        displayName: row.approver_user_display_name,
        email: row.approver_user_email,
        teamName: row.approver_user_team_name,
        departmentName: row.approver_user_department_name
      }),
      approverRole: mapRole({
        id: row.approver_role_id,
        slug: row.approver_role_slug,
        name: row.approver_role_name
      }),
      decidedBy: mapUser({
        id: row.decision_by_user_id,
        displayName: row.decision_by_display_name,
        email: row.decision_by_email,
        teamName: row.decision_by_team_name,
        departmentName: row.decision_by_department_name
      }),
      linkedRecord: row.linked_record_type && row.linked_record_id
        ? {
            entityType: row.linked_record_type,
            entityId: row.linked_record_id
          }
        : null,
      latestComment: row.latest_comment ?? row.decision_comment ?? null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      decidedAt: row.decided_at ? row.decided_at.toISOString() : null,
      metadata: getMetadata(row.metadata)
    };
  }

  private mapHistoryRow(row: ApprovalHistoryRow): ApprovalHistoryEntry {
    return {
      id: row.id,
      action: row.action_type,
      actor: mapUser({
        id: row.actor_id,
        displayName: row.actor_display_name,
        email: row.actor_email,
        teamName: row.actor_team_name,
        departmentName: row.actor_department_name
      }),
      fromStatus: row.from_status,
      toStatus: row.to_status,
      comment: row.comment,
      createdAt: row.created_at.toISOString(),
      metadata: getMetadata(row.metadata)
    };
  }

  private async loadApprovalRow(client: PoolClient, tenantId: string, approvalId: string) {
    const result = await client.query<ApprovalRow>(
      `
        SELECT
          approval_requests.id,
          approval_requests.approval_type,
          approval_requests.title,
          approval_requests.description,
          approval_requests.status,
          approval_requests.linked_record_type,
          approval_requests.linked_record_id,
          approval_requests.decision_comment,
          approval_requests.metadata,
          approval_requests.created_at,
          approval_requests.updated_at,
          approval_requests.decided_at,
          approval_requests.requested_by_user_id,
          approval_requests.approver_user_id,
          approval_requests.approver_role_id,
          approval_requests.decision_by_user_id,
          requested_by_users.display_name AS requested_by_display_name,
          requested_by_users.email AS requested_by_email,
          requested_by_teams.name AS requested_by_team_name,
          requested_by_departments.name AS requested_by_department_name,
          approver_users.display_name AS approver_user_display_name,
          approver_users.email AS approver_user_email,
          approver_user_teams.name AS approver_user_team_name,
          approver_user_departments.name AS approver_user_department_name,
          decision_by_users.display_name AS decision_by_display_name,
          decision_by_users.email AS decision_by_email,
          decision_by_teams.name AS decision_by_team_name,
          decision_by_departments.name AS decision_by_department_name,
          approver_roles.slug AS approver_role_slug,
          approver_roles.name AS approver_role_name,
          latest_history.comment AS latest_comment
        FROM approval_requests
        INNER JOIN users AS requested_by_users
          ON requested_by_users.id = approval_requests.requested_by_user_id
         AND requested_by_users.tenant_id = approval_requests.tenant_id
         AND requested_by_users.deleted_at IS NULL
        LEFT JOIN teams AS requested_by_teams
          ON requested_by_teams.id = requested_by_users.team_id
         AND requested_by_teams.tenant_id = requested_by_users.tenant_id
         AND requested_by_teams.deleted_at IS NULL
        LEFT JOIN departments AS requested_by_departments
          ON requested_by_departments.id = requested_by_users.department_id
         AND requested_by_departments.tenant_id = requested_by_users.tenant_id
         AND requested_by_departments.deleted_at IS NULL
        LEFT JOIN users AS approver_users
          ON approver_users.id = approval_requests.approver_user_id
         AND approver_users.tenant_id = approval_requests.tenant_id
         AND approver_users.deleted_at IS NULL
        LEFT JOIN teams AS approver_user_teams
          ON approver_user_teams.id = approver_users.team_id
         AND approver_user_teams.tenant_id = approver_users.tenant_id
         AND approver_user_teams.deleted_at IS NULL
        LEFT JOIN departments AS approver_user_departments
          ON approver_user_departments.id = approver_users.department_id
         AND approver_user_departments.tenant_id = approver_users.tenant_id
         AND approver_user_departments.deleted_at IS NULL
        LEFT JOIN users AS decision_by_users
          ON decision_by_users.id = approval_requests.decision_by_user_id
         AND decision_by_users.tenant_id = approval_requests.tenant_id
         AND decision_by_users.deleted_at IS NULL
        LEFT JOIN teams AS decision_by_teams
          ON decision_by_teams.id = decision_by_users.team_id
         AND decision_by_teams.tenant_id = decision_by_users.tenant_id
         AND decision_by_teams.deleted_at IS NULL
        LEFT JOIN departments AS decision_by_departments
          ON decision_by_departments.id = decision_by_users.department_id
         AND decision_by_departments.tenant_id = decision_by_users.tenant_id
         AND decision_by_departments.deleted_at IS NULL
        LEFT JOIN roles AS approver_roles
          ON approver_roles.id = approval_requests.approver_role_id
         AND approver_roles.tenant_id = approval_requests.tenant_id
         AND approver_roles.deleted_at IS NULL
        LEFT JOIN LATERAL (
          SELECT approval_history.comment
          FROM approval_history
          WHERE approval_history.tenant_id = approval_requests.tenant_id
            AND approval_history.approval_request_id = approval_requests.id
            AND approval_history.comment IS NOT NULL
          ORDER BY approval_history.created_at DESC
          LIMIT 1
        ) AS latest_history ON TRUE
        WHERE approval_requests.id = $1
          AND approval_requests.tenant_id = $2
          AND approval_requests.deleted_at IS NULL
        LIMIT 1
      `,
      [approvalId, tenantId]
    );

    const row = result.rows[0];

    if (!row) {
      throw new AppError(404, "The approval request was not found.", undefined, "APPROVAL_NOT_FOUND");
    }

    return row;
  }

  private canViewApproval(actor: ActorContext, row: ApprovalRow) {
    if (this.canManageAll(actor)) {
      return true;
    }

    if (row.requested_by_user_id === actor.userId) {
      return true;
    }

    if (row.approver_user_id === actor.userId) {
      return true;
    }

    if (row.approver_role_id && actor.roles.some((role) => role.id === row.approver_role_id)) {
      return true;
    }

    return false;
  }

  private canDecideApproval(actor: ActorContext, row: ApprovalRow) {
    if (this.canManageAll(actor)) {
      return true;
    }

    if (!actor.permissionCodes.includes("approvals.approve")) {
      return false;
    }

    if (row.approver_user_id === actor.userId) {
      return true;
    }

    if (row.approver_role_id && actor.roles.some((role) => role.id === row.approver_role_id)) {
      return true;
    }

    return false;
  }

  private async buildApprovalDetail(client: PoolClient, actor: ActorContext, approvalId: string) {
    const row = await this.loadApprovalRow(client, actor.tenantId, approvalId);

    if (!this.canViewApproval(actor, row)) {
      throw new AppError(
        403,
        "You do not have permission to view this approval request.",
        undefined,
        "FORBIDDEN"
      );
    }

    const historyRows = await client.query<ApprovalHistoryRow>(
      `
        SELECT
          approval_history.id,
          approval_history.action_type,
          approval_history.from_status,
          approval_history.to_status,
          approval_history.comment,
          approval_history.created_at,
          approval_history.metadata,
          actor_users.id AS actor_id,
          actor_users.display_name AS actor_display_name,
          actor_users.email AS actor_email,
          actor_teams.name AS actor_team_name,
          actor_departments.name AS actor_department_name
        FROM approval_history
        LEFT JOIN users AS actor_users
          ON actor_users.id = approval_history.actor_user_id
         AND actor_users.tenant_id = approval_history.tenant_id
         AND actor_users.deleted_at IS NULL
        LEFT JOIN teams AS actor_teams
          ON actor_teams.id = actor_users.team_id
         AND actor_teams.tenant_id = actor_users.tenant_id
         AND actor_teams.deleted_at IS NULL
        LEFT JOIN departments AS actor_departments
          ON actor_departments.id = actor_users.department_id
         AND actor_departments.tenant_id = actor_users.tenant_id
         AND actor_departments.deleted_at IS NULL
        WHERE approval_history.tenant_id = $1
          AND approval_history.approval_request_id = $2
        ORDER BY approval_history.created_at ASC
      `,
      [actor.tenantId, approvalId]
    );

    return {
      ...this.mapApprovalRow(row),
      history: historyRows.rows.map((historyRow) => this.mapHistoryRow(historyRow))
    } satisfies ApprovalRequestDetail;
  }

  async createApprovalWithClient(
    client: PoolClient,
    actor: ActorContext,
    audit: AuditMetadata,
    input: CreateApprovalRequestBody
  ): Promise<ApprovalRequestDetail> {
    this.assertEnabled();

    const resolvedApprover = await this.resolveApprover(client, actor, input);
    const insertResult = await client.query<{ id: string }>(
      `
        INSERT INTO approval_requests (
          tenant_id,
          approval_type,
          title,
          description,
          linked_record_type,
          linked_record_id,
          requested_by_user_id,
          approver_user_id,
          approver_role_id,
          owner_id,
          metadata,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $8, $10::jsonb, $7, $7)
        RETURNING id
      `,
      [
        actor.tenantId,
        input.approvalType,
        input.title.trim(),
        input.description?.trim() || null,
        input.linkedRecord?.entityType ?? null,
        input.linkedRecord?.entityId ?? null,
        actor.userId,
        resolvedApprover.approverUserId,
        resolvedApprover.approverRole?.id ?? null,
        JSON.stringify(input.metadata ?? {})
      ]
    );

    const approvalId = insertResult.rows[0]?.id;

    if (!approvalId) {
      throw new AppError(500, "The approval request could not be created.", undefined, "APPROVAL_CREATE_FAILED");
    }

    await client.query(
      `
        INSERT INTO approval_history (
          tenant_id,
          approval_request_id,
          action_type,
          actor_user_id,
          from_status,
          to_status,
          comment,
          metadata
        )
        VALUES ($1, $2, 'created', $3, NULL, 'pending', $4, $5::jsonb)
      `,
      [
        actor.tenantId,
        approvalId,
        actor.userId,
        input.initialComment?.trim() || null,
        JSON.stringify({
          approvalType: input.approvalType
        })
      ]
    );

    await this.notificationService.createNotificationWithClient(client, actor, audit, {
      notificationType: "approval_requested",
      title: `Approval requested: ${input.title.trim()}`,
      message:
        input.description?.trim() ||
        "A new approval request needs your review in the approval inbox.",
      recipientUserId: resolvedApprover.approverUserId,
      recipientRoleId: resolvedApprover.approverRole?.id ?? null,
      linkedRecord: input.linkedRecord ?? {
        entityType: "approval_request",
        entityId: approvalId
      },
      metadata: {
        approvalId,
        approvalType: input.approvalType
      }
    });

    await this.recordAuditLog(client, actor, audit, {
      action: "approval.create",
      resourceId: approvalId,
      status: "success",
      metadata: {
        approvalType: input.approvalType,
        approverUserId: resolvedApprover.approverUserId,
        approverRoleId: resolvedApprover.approverRole?.id ?? null
      }
    });

    return this.buildApprovalDetail(client, actor, approvalId);
  }

  async createApproval(
    actor: ActorContext,
    audit: AuditMetadata,
    input: CreateApprovalRequestBody
  ): Promise<ApprovalResponse> {
    const approval = await this.databaseService.withTransaction((client) =>
      this.createApprovalWithClient(client, actor, audit, input)
    );

    return {
      approval
    };
  }

  async listApprovals(actor: ActorContext, query: ApprovalListQuery): Promise<ApprovalsResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => {
      const page = getPositiveNumber(query.page, 1, 10_000);
      const pageSize = getPositiveNumber(query.pageSize, 20, 100);
      const offset = (page - 1) * pageSize;
      const conditions = ["approval_requests.tenant_id = $1", "approval_requests.deleted_at IS NULL"];
      const params: unknown[] = [actor.tenantId];
      const actorRoleIds = actor.roles.map((role) => role.id);
      const canManageAll = this.canManageAll(actor);
      const scope = query.scope ?? "assigned";

      if (!canManageAll) {
        if (scope === "requested") {
          params.push(actor.userId);
          conditions.push(`approval_requests.requested_by_user_id = $${params.length}`);
        } else if (scope === "all") {
          params.push(actor.userId, actorRoleIds);
          conditions.push(
            `(approval_requests.requested_by_user_id = $${params.length - 1} OR approval_requests.approver_user_id = $${params.length - 1} OR approval_requests.approver_role_id = ANY($${params.length}::uuid[]))`
          );
        } else {
          params.push(actor.userId, actorRoleIds);
          conditions.push(
            `(approval_requests.approver_user_id = $${params.length - 1} OR approval_requests.approver_role_id = ANY($${params.length}::uuid[]))`
          );
        }
      } else if (scope === "requested") {
        params.push(actor.userId);
        conditions.push(`approval_requests.requested_by_user_id = $${params.length}`);
      } else if (scope === "assigned") {
        params.push(actor.userId, actorRoleIds);
        conditions.push(
          `(approval_requests.approver_user_id = $${params.length - 1} OR approval_requests.approver_role_id = ANY($${params.length}::uuid[]))`
        );
      }

      if (query.status && query.status !== "all") {
        params.push(query.status);
        conditions.push(`approval_requests.status = $${params.length}`);
      }

      if (query.approvalType) {
        params.push(query.approvalType);
        conditions.push(`approval_requests.approval_type = $${params.length}`);
      }

      if (query.search) {
        params.push(`%${query.search.trim().toLowerCase()}%`);
        conditions.push(
          `(LOWER(approval_requests.title) LIKE $${params.length} OR LOWER(COALESCE(approval_requests.description, '')) LIKE $${params.length})`
        );
      }

      const whereClause = conditions.join(" AND ");
      const countResult = await client.query<{ total: number }>(
        `
          SELECT COUNT(*)::int AS total
          FROM approval_requests
          WHERE ${whereClause}
        `,
        params
      );

      params.push(pageSize, offset);
      const rows = await client.query<ApprovalRow>(
        `
          SELECT
            approval_requests.id,
            approval_requests.approval_type,
            approval_requests.title,
            approval_requests.description,
            approval_requests.status,
            approval_requests.linked_record_type,
            approval_requests.linked_record_id,
            approval_requests.decision_comment,
            approval_requests.metadata,
            approval_requests.created_at,
            approval_requests.updated_at,
            approval_requests.decided_at,
            approval_requests.requested_by_user_id,
            approval_requests.approver_user_id,
            approval_requests.approver_role_id,
            approval_requests.decision_by_user_id,
            requested_by_users.display_name AS requested_by_display_name,
            requested_by_users.email AS requested_by_email,
            requested_by_teams.name AS requested_by_team_name,
            requested_by_departments.name AS requested_by_department_name,
            approver_users.display_name AS approver_user_display_name,
            approver_users.email AS approver_user_email,
            approver_user_teams.name AS approver_user_team_name,
            approver_user_departments.name AS approver_user_department_name,
            decision_by_users.display_name AS decision_by_display_name,
            decision_by_users.email AS decision_by_email,
            decision_by_teams.name AS decision_by_team_name,
            decision_by_departments.name AS decision_by_department_name,
            approver_roles.slug AS approver_role_slug,
            approver_roles.name AS approver_role_name,
            latest_history.comment AS latest_comment
          FROM approval_requests
          INNER JOIN users AS requested_by_users
            ON requested_by_users.id = approval_requests.requested_by_user_id
           AND requested_by_users.tenant_id = approval_requests.tenant_id
           AND requested_by_users.deleted_at IS NULL
          LEFT JOIN teams AS requested_by_teams
            ON requested_by_teams.id = requested_by_users.team_id
           AND requested_by_teams.tenant_id = requested_by_users.tenant_id
           AND requested_by_teams.deleted_at IS NULL
          LEFT JOIN departments AS requested_by_departments
            ON requested_by_departments.id = requested_by_users.department_id
           AND requested_by_departments.tenant_id = requested_by_users.tenant_id
           AND requested_by_departments.deleted_at IS NULL
          LEFT JOIN users AS approver_users
            ON approver_users.id = approval_requests.approver_user_id
           AND approver_users.tenant_id = approval_requests.tenant_id
           AND approver_users.deleted_at IS NULL
          LEFT JOIN teams AS approver_user_teams
            ON approver_user_teams.id = approver_users.team_id
           AND approver_user_teams.tenant_id = approver_users.tenant_id
           AND approver_user_teams.deleted_at IS NULL
          LEFT JOIN departments AS approver_user_departments
            ON approver_user_departments.id = approver_users.department_id
           AND approver_user_departments.tenant_id = approver_users.tenant_id
           AND approver_user_departments.deleted_at IS NULL
          LEFT JOIN users AS decision_by_users
            ON decision_by_users.id = approval_requests.decision_by_user_id
           AND decision_by_users.tenant_id = approval_requests.tenant_id
           AND decision_by_users.deleted_at IS NULL
          LEFT JOIN teams AS decision_by_teams
            ON decision_by_teams.id = decision_by_users.team_id
           AND decision_by_teams.tenant_id = decision_by_users.tenant_id
           AND decision_by_teams.deleted_at IS NULL
          LEFT JOIN departments AS decision_by_departments
            ON decision_by_departments.id = decision_by_users.department_id
           AND decision_by_departments.tenant_id = decision_by_users.tenant_id
           AND decision_by_departments.deleted_at IS NULL
          LEFT JOIN roles AS approver_roles
            ON approver_roles.id = approval_requests.approver_role_id
           AND approver_roles.tenant_id = approval_requests.tenant_id
           AND approver_roles.deleted_at IS NULL
          LEFT JOIN LATERAL (
            SELECT approval_history.comment
            FROM approval_history
            WHERE approval_history.tenant_id = approval_requests.tenant_id
              AND approval_history.approval_request_id = approval_requests.id
              AND approval_history.comment IS NOT NULL
            ORDER BY approval_history.created_at DESC
            LIMIT 1
          ) AS latest_history ON TRUE
          WHERE ${whereClause}
          ORDER BY
            CASE WHEN approval_requests.status = 'pending' THEN 0 ELSE 1 END,
            approval_requests.created_at DESC
          LIMIT $${params.length - 1}
          OFFSET $${params.length}
        `,
        params
      );

      const pendingCountConditions = ["tenant_id = $1", "deleted_at IS NULL", "status = 'pending'"];
      const pendingParams: unknown[] = [actor.tenantId];

      if (!canManageAll) {
        pendingParams.push(actor.userId, actorRoleIds);
        pendingCountConditions.push(
          `(approver_user_id = $${pendingParams.length - 1} OR approver_role_id = ANY($${pendingParams.length}::uuid[]))`
        );
      }

      const pendingCountResult = await client.query<{ count: number }>(
        `
          SELECT COUNT(*)::int AS count
          FROM approval_requests
          WHERE ${pendingCountConditions.join(" AND ")}
        `,
        pendingParams
      );

      return {
        approvals: rows.rows.map((row) => this.mapApprovalRow(row)),
        pagination: getPagination(countResult.rows[0]?.total ?? 0, page, pageSize),
        pendingCount: pendingCountResult.rows[0]?.count ?? 0,
        availableTypes: approvalTypeCatalog
      };
    });
  }

  async getApproval(actor: ActorContext, approvalId: string): Promise<ApprovalResponse> {
    this.assertEnabled();

    return this.databaseService.withClient(async (client) => ({
      approval: await this.buildApprovalDetail(client, actor, approvalId)
    }));
  }

  async decideApproval(
    actor: ActorContext,
    audit: AuditMetadata,
    approvalId: string,
    input: ApprovalDecisionRequestBody
  ): Promise<ApprovalResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const row = await this.loadApprovalRow(client, actor.tenantId, approvalId);

      if (!this.canDecideApproval(actor, row)) {
        throw new AppError(
          403,
          "You do not have permission to decide this approval request.",
          undefined,
          "FORBIDDEN"
        );
      }

      if (row.status !== "pending") {
        throw new AppError(
          400,
          "Only pending approval requests can be approved or rejected.",
          undefined,
          "APPROVAL_NOT_PENDING"
        );
      }

      await client.query(
        `
          UPDATE approval_requests
          SET
            status = $3,
            decision_by_user_id = $4,
            decision_comment = $5,
            decided_at = NOW(),
            updated_at = NOW(),
            updated_by = $4
          WHERE id = $1
            AND tenant_id = $2
            AND deleted_at IS NULL
        `,
        [approvalId, actor.tenantId, input.decision, actor.userId, input.comment?.trim() || null]
      );

      await client.query(
        `
          INSERT INTO approval_history (
            tenant_id,
            approval_request_id,
            action_type,
            actor_user_id,
            from_status,
            to_status,
            comment,
            metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, '{}'::jsonb)
        `,
        [
          actor.tenantId,
          approvalId,
          input.decision,
          actor.userId,
          row.status,
          input.decision,
          input.comment?.trim() || null
        ]
      );

      await this.notificationService.createNotificationWithClient(client, actor, audit, {
        notificationType: "approval_decided",
        title: `Approval ${input.decision}: ${row.title}`,
        message:
          input.comment?.trim() ||
          `Your approval request "${row.title}" was ${input.decision}.`,
        recipientUserId: row.requested_by_user_id,
        linkedRecord: row.linked_record_type && row.linked_record_id
          ? {
              entityType: row.linked_record_type,
              entityId: row.linked_record_id
            }
          : {
              entityType: "approval_request",
              entityId: approvalId
            },
        metadata: {
          approvalId,
          approvalType: row.approval_type,
          decision: input.decision
        }
      });

      await this.recordAuditLog(client, actor, audit, {
        action: "approval.decision",
        resourceId: approvalId,
        status: "success",
        metadata: {
          decision: input.decision
        }
      });

      return {
        approval: await this.buildApprovalDetail(client, actor, approvalId)
      };
    });
  }

  async addComment(
    actor: ActorContext,
    audit: AuditMetadata,
    approvalId: string,
    input: AddApprovalCommentRequestBody
  ): Promise<ApprovalResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const row = await this.loadApprovalRow(client, actor.tenantId, approvalId);

      if (!this.canViewApproval(actor, row)) {
        throw new AppError(
          403,
          "You do not have permission to comment on this approval request.",
          undefined,
          "FORBIDDEN"
        );
      }

      await client.query(
        `
          INSERT INTO approval_history (
            tenant_id,
            approval_request_id,
            action_type,
            actor_user_id,
            from_status,
            to_status,
            comment,
            metadata
          )
          VALUES ($1, $2, 'commented', $3, $4, $4, $5, $6::jsonb)
        `,
        [
          actor.tenantId,
          approvalId,
          actor.userId,
          row.status,
          input.comment.trim(),
          JSON.stringify(input.metadata ?? {})
        ]
      );

      await this.recordAuditLog(client, actor, audit, {
        action: "approval.comment",
        resourceId: approvalId,
        status: "success"
      });

      return {
        approval: await this.buildApprovalDetail(client, actor, approvalId)
      };
    });
  }
}
