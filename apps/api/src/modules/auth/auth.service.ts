import { randomUUID } from "node:crypto";
import type {
  AuthResponse,
  AuthSessionSummary,
  AuthUserSummary,
  CurrentUserResponse,
  LoginRequestBody,
  RoleSummary
} from "@crm/types";
import type { PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import { createTokenNonce, signJwt, verifyJwt } from "../../common/auth/jwt.js";
import { hashToken, safeStringEquals } from "../../common/auth/token-helpers.js";
import { DatabaseService } from "../../platform/database/database.service.js";

interface AuthServiceConfig {
  enabled: boolean;
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenTtlMinutes: number;
  refreshTokenTtlDays: number;
  accountLockThreshold: number;
  accountLockMinutes: number;
  enableAuditLogs: boolean;
}

interface LoginContext extends LoginRequestBody {
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string;
}

interface RefreshContext {
  refreshToken: string;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string;
}

interface LogoutContext {
  accessToken: string | null;
  refreshToken: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string;
}

interface AuthIdentity {
  userId: string;
  tenantId: string;
  sessionId: string;
  email: string;
}

interface UserLoginRow {
  id: string;
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  status: string;
  password_matches: boolean;
  failed_login_attempts: number;
  locked_until: Date | null;
}

interface SessionRow {
  id: string;
  tenant_id: string;
  user_id: string;
  email: string;
  refresh_token_hash: string;
  expires_at: Date;
  last_seen_at: Date;
  revoked_at: Date | null;
  deleted_at: Date | null;
  status: string;
  tenant_slug: string;
  tenant_name: string;
  first_name: string;
  last_name: string;
  display_name: string;
  user_metadata: Record<string, unknown> | null;
}

interface IssuedSession {
  session: AuthSessionSummary;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

interface AuthCommandResult {
  authResponse: AuthResponse;
  refreshToken: string;
}

const LOGIN_FAILURE_MESSAGE = "Invalid tenant, email, or password.";

function normalizeTenantSlug(value: string) {
  return value.trim().toLowerCase();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function getNullableString(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: AuthServiceConfig
  ) {}

  private assertEnabled() {
    if (!this.config.enabled || !this.databaseService.isEnabled()) {
      throw new AppError(
        503,
        "Authentication is unavailable until the database connection is enabled.",
        undefined,
        "AUTH_SERVICE_UNAVAILABLE"
      );
    }
  }

  private getAccessTokenTtlSeconds() {
    return this.config.accessTokenTtlMinutes * 60;
  }

  private getRefreshTokenTtlSeconds() {
    return this.config.refreshTokenTtlDays * 24 * 60 * 60;
  }

  private async recordAuditLog(
    client: PoolClient,
    input: {
      tenantId?: string | null;
      actorUserId?: string | null;
      sessionId?: string | null;
      eventType: string;
      action: string;
      resourceType: string;
      resourceId?: string | null;
      status: "success" | "failure" | "denied" | "error";
      ipAddress?: string | null;
      userAgent?: string | null;
      requestId: string;
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULLIF($9, '')::inet, $10, $11, $12::jsonb)
      `,
      [
        input.tenantId ?? null,
        input.actorUserId ?? null,
        input.sessionId ?? null,
        input.eventType,
        input.action,
        input.resourceType,
        input.resourceId ?? null,
        input.status,
        input.ipAddress ?? "",
        input.userAgent ?? null,
        input.requestId,
        JSON.stringify(input.metadata ?? {})
      ]
    );
  }

  private async getUserForLogin(
    client: PoolClient,
    tenantSlug: string,
    email: string,
    password: string
  ) {
    const result = await client.query<UserLoginRow>(
      `
        SELECT
          users.id,
          users.tenant_id,
          tenants.slug AS tenant_slug,
          tenants.name AS tenant_name,
          users.email,
          users.first_name,
          users.last_name,
          users.display_name,
          users.status,
          crypt($3, users.password_hash) = users.password_hash AS password_matches,
          users.failed_login_attempts,
          users.locked_until
        FROM users
        INNER JOIN tenants
          ON tenants.id = users.tenant_id
        WHERE tenants.slug = $1
          AND users.normalized_email = $2
          AND users.deleted_at IS NULL
          AND tenants.deleted_at IS NULL
        LIMIT 1
      `,
      [tenantSlug, email, password]
    );

    return result.rows[0] ?? null;
  }

  private async getTenantIdBySlug(client: PoolClient, tenantSlug: string) {
    const result = await client.query<{ id: string }>(
      `
        SELECT id
        FROM tenants
        WHERE slug = $1
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [tenantSlug]
    );

    return result.rows[0]?.id ?? null;
  }

  private async incrementFailedLogin(client: PoolClient, userId: string) {
    const result = await client.query<{ failed_login_attempts: number; locked_until: Date | null }>(
      `
        UPDATE users
        SET
          failed_login_attempts = failed_login_attempts + 1,
          locked_until = CASE
            WHEN failed_login_attempts + 1 >= $2 THEN NOW() + make_interval(mins => $3)
            ELSE locked_until
          END,
          status = CASE
            WHEN failed_login_attempts + 1 >= $2 THEN 'locked'
            ELSE status
          END,
          updated_at = NOW()
        WHERE id = $1
        RETURNING failed_login_attempts, locked_until
      `,
      [userId, this.config.accountLockThreshold, this.config.accountLockMinutes]
    );

    return result.rows[0] ?? null;
  }

  private async loadUserSummary(
    client: PoolClient,
    userId: string,
    tenantId: string
  ): Promise<AuthUserSummary> {
    const userResult = await client.query<{
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      display_name: string;
      status: string;
      metadata: Record<string, unknown> | null;
      tenant_id: string;
      tenant_slug: string;
      tenant_name: string;
    }>(
      `
        SELECT
          users.id,
          users.email,
          users.first_name,
          users.last_name,
          users.display_name,
          users.status,
          users.metadata,
          tenants.id AS tenant_id,
          tenants.slug AS tenant_slug,
          tenants.name AS tenant_name
        FROM users
        INNER JOIN tenants
          ON tenants.id = users.tenant_id
        WHERE users.id = $1
          AND users.tenant_id = $2
          AND users.deleted_at IS NULL
          AND tenants.deleted_at IS NULL
        LIMIT 1
      `,
      [userId, tenantId]
    );

    const user = userResult.rows[0];

    if (!user) {
      throw new AppError(401, "Authentication is required.", undefined, "AUTHENTICATION_ERROR");
    }

    const rolesResult = await client.query<RoleSummary>(
      `
        SELECT DISTINCT roles.id, roles.slug, roles.name
        FROM user_roles
        INNER JOIN roles
          ON roles.id = user_roles.role_id
          AND roles.tenant_id = user_roles.tenant_id
        WHERE user_roles.user_id = $1
          AND user_roles.tenant_id = $2
          AND user_roles.deleted_at IS NULL
          AND roles.deleted_at IS NULL
          AND (user_roles.expires_at IS NULL OR user_roles.expires_at > NOW())
        ORDER BY roles.name ASC
      `,
      [userId, tenantId]
    );

    const permissionsResult = await client.query<{ code: string }>(
      `
        SELECT DISTINCT permissions.code
        FROM user_roles
        INNER JOIN role_permissions
          ON role_permissions.role_id = user_roles.role_id
          AND role_permissions.tenant_id = user_roles.tenant_id
        INNER JOIN permissions
          ON permissions.id = role_permissions.permission_id
        WHERE user_roles.user_id = $1
          AND user_roles.tenant_id = $2
          AND user_roles.deleted_at IS NULL
          AND role_permissions.deleted_at IS NULL
          AND permissions.deleted_at IS NULL
          AND (user_roles.expires_at IS NULL OR user_roles.expires_at > NOW())
        ORDER BY permissions.code ASC
      `,
      [userId, tenantId]
    );

    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      displayName: user.display_name,
      status: user.status,
      tenant: {
        id: user.tenant_id,
        slug: user.tenant_slug,
        name: user.tenant_name
      },
      roles: rolesResult.rows,
      permissionCodes: permissionsResult.rows.map((permission) => permission.code),
      metadata: user.metadata ?? {}
    };
  }

  private async issueSession(
    client: PoolClient,
    user: Pick<
      UserLoginRow,
      "id" | "tenant_id" | "email" | "first_name" | "last_name" | "display_name"
    >,
    context: Pick<LoginContext, "ipAddress" | "userAgent">
  ): Promise<IssuedSession> {
    const sessionId = randomUUID();
    const accessTokenResult = signJwt({
      subject: user.id,
      tenantId: user.tenant_id,
      sessionId,
      email: user.email,
      secret: this.config.accessTokenSecret,
      expiresInSeconds: this.getAccessTokenTtlSeconds(),
      type: "access"
    });
    const refreshTokenResult = signJwt({
      subject: user.id,
      tenantId: user.tenant_id,
      sessionId,
      email: user.email,
      secret: this.config.refreshTokenSecret,
      expiresInSeconds: this.getRefreshTokenTtlSeconds(),
      type: "refresh",
      nonce: createTokenNonce()
    });

    await client.query(
      `
        INSERT INTO auth_sessions (
          id,
          tenant_id,
          user_id,
          refresh_token_hash,
          expires_at,
          last_seen_at,
          ip_address,
          user_agent,
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
          NOW(),
          NULLIF($6, '')::inet,
          $7,
          $3,
          $3,
          jsonb_build_object('issuedAt', NOW())
        )
      `,
      [
        sessionId,
        user.tenant_id,
        user.id,
        hashToken(refreshTokenResult.token),
        refreshTokenResult.expiresAt,
        context.ipAddress ?? "",
        context.userAgent ?? null
      ]
    );

    return {
      session: {
        id: sessionId,
        expiresAt: refreshTokenResult.expiresAt,
        lastSeenAt: new Date().toISOString()
      },
      accessToken: accessTokenResult.token,
      accessTokenExpiresAt: accessTokenResult.expiresAt,
      refreshToken: refreshTokenResult.token,
      refreshTokenExpiresAt: refreshTokenResult.expiresAt
    };
  }

  private createAuthResponse(
    user: AuthUserSummary,
    session: AuthSessionSummary,
    issuedSession: IssuedSession
  ): AuthResponse {
    return {
      user,
      session,
      tokens: {
        tokenType: "Bearer",
        accessToken: issuedSession.accessToken,
        accessTokenExpiresAt: issuedSession.accessTokenExpiresAt,
        refreshTokenExpiresAt: issuedSession.refreshTokenExpiresAt
      }
    };
  }

  private async getSessionById(client: PoolClient, sessionId: string) {
    const result = await client.query<SessionRow>(
      `
        SELECT
          auth_sessions.id,
          auth_sessions.tenant_id,
          auth_sessions.user_id,
          auth_sessions.refresh_token_hash,
          auth_sessions.expires_at,
          auth_sessions.last_seen_at,
          auth_sessions.revoked_at,
          auth_sessions.deleted_at,
          users.status,
          tenants.slug AS tenant_slug,
          tenants.name AS tenant_name,
          users.email,
          users.first_name,
          users.last_name,
          users.display_name,
          users.metadata AS user_metadata
        FROM auth_sessions
        INNER JOIN users
          ON users.id = auth_sessions.user_id
          AND users.tenant_id = auth_sessions.tenant_id
        INNER JOIN tenants
          ON tenants.id = auth_sessions.tenant_id
        WHERE auth_sessions.id = $1
          AND users.deleted_at IS NULL
          AND tenants.deleted_at IS NULL
        LIMIT 1
      `,
      [sessionId]
    );

    return result.rows[0] ?? null;
  }

  private async revokeSession(
    client: PoolClient,
    sessionId: string,
    updatedBy: string | null,
    reason: string
  ) {
    await client.query(
      `
        UPDATE auth_sessions
        SET
          revoked_at = NOW(),
          revoke_reason = $2,
          updated_at = NOW(),
          updated_by = COALESCE($3, updated_by)
        WHERE id = $1
      `,
      [sessionId, reason, updatedBy]
    );
  }

  async login(context: LoginContext): Promise<AuthCommandResult> {
    this.assertEnabled();
    const result = await this.databaseService.withTransaction(async (client) => {
      const tenantSlug = normalizeTenantSlug(context.tenantSlug);
      const email = normalizeEmail(context.email);
      const user = await this.getUserForLogin(client, tenantSlug, email, context.password);

      if (!user) {
        await this.recordAuditLog(client, {
          eventType: "auth",
          action: "auth.login",
          resourceType: "session",
          status: "failure",
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestId: context.requestId,
          metadata: {
            tenantSlug,
            email,
            reason: "user_not_found"
          }
        });

        return {
          kind: "error" as const
        };
      }

      if (user.status === "disabled") {
        await this.recordAuditLog(client, {
          tenantId: user.tenant_id,
          actorUserId: user.id,
          eventType: "auth",
          action: "auth.login",
          resourceType: "session",
          status: "denied",
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestId: context.requestId,
          metadata: {
            tenantSlug,
            email,
            reason: "user_disabled"
          }
        });

        return {
          kind: "error" as const
        };
      }

      if (user.locked_until && user.locked_until.getTime() > Date.now()) {
        await this.recordAuditLog(client, {
          tenantId: user.tenant_id,
          actorUserId: user.id,
          eventType: "auth",
          action: "auth.login",
          resourceType: "session",
          status: "denied",
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestId: context.requestId,
          metadata: {
            tenantSlug,
            email,
            reason: "account_locked"
          }
        });

        return {
          kind: "error" as const
        };
      }

      if (!user.password_matches) {
        const failedAttempt = await this.incrementFailedLogin(client, user.id);

        await this.recordAuditLog(client, {
          tenantId: user.tenant_id,
          actorUserId: user.id,
          eventType: "auth",
          action: "auth.login",
          resourceType: "session",
          status: "failure",
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestId: context.requestId,
          metadata: {
            tenantSlug,
            email,
            reason: failedAttempt?.locked_until ? "invalid_password_locked" : "invalid_password",
            failedLoginAttempts: failedAttempt?.failed_login_attempts ?? user.failed_login_attempts + 1
          }
        });

        return {
          kind: "error" as const
        };
      }

      await client.query(
        `
          UPDATE users
          SET
            failed_login_attempts = 0,
            locked_until = NULL,
            status = 'active',
            last_login_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
        `,
        [user.id]
      );

      const issuedSession = await this.issueSession(client, user, context);
      const userSummary = await this.loadUserSummary(client, user.id, user.tenant_id);

      await this.recordAuditLog(client, {
        tenantId: user.tenant_id,
        actorUserId: user.id,
        sessionId: issuedSession.session.id,
        eventType: "auth",
        action: "auth.login",
        resourceType: "session",
        resourceId: issuedSession.session.id,
        status: "success",
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
        metadata: {
          tenantSlug,
          email
        }
      });

      return {
        kind: "success" as const,
        authResponse: this.createAuthResponse(userSummary, issuedSession.session, issuedSession),
        refreshToken: issuedSession.refreshToken
      };
    });

    if (result.kind === "error") {
      throw new AppError(401, LOGIN_FAILURE_MESSAGE, undefined, "AUTHENTICATION_ERROR");
    }

    return {
      authResponse: result.authResponse,
      refreshToken: result.refreshToken
    };
  }

  async recordRateLimitedLoginAttempt(
    context: Pick<LoginContext, "tenantSlug" | "email" | "ipAddress" | "userAgent" | "requestId"> & {
      retryAfterSeconds: number;
    }
  ) {
    this.assertEnabled();

    const tenantSlug = normalizeTenantSlug(context.tenantSlug);
    const email = normalizeEmail(context.email);

    await this.databaseService.withTransaction(async (client) => {
      const tenantId = await this.getTenantIdBySlug(client, tenantSlug);

      await this.recordAuditLog(client, {
        tenantId,
        eventType: "auth",
        action: "auth.login",
        resourceType: "session",
        status: "denied",
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
        metadata: {
          tenantSlug,
          email,
          reason: "rate_limit_exceeded",
          retryAfterSeconds: context.retryAfterSeconds
        }
      });
    });
  }

  async authenticateAccessToken(accessToken: string): Promise<AuthIdentity> {
    this.assertEnabled();

    let claims;

    try {
      claims = verifyJwt(accessToken, this.config.accessTokenSecret, "access");
    } catch {
      throw new AppError(401, "Authentication is required.", undefined, "AUTHENTICATION_ERROR");
    }

    return this.databaseService.withClient(async (client) => {
      const session = await this.getSessionById(client, claims.sessionId);

      if (
        !session ||
        session.user_id !== claims.sub ||
        session.tenant_id !== claims.tenantId ||
        session.revoked_at ||
        session.deleted_at ||
        session.status !== "active"
      ) {
        throw new AppError(401, "Authentication is required.", undefined, "AUTHENTICATION_ERROR");
      }

      return {
        userId: session.user_id,
        tenantId: session.tenant_id,
        sessionId: session.id,
        email: session.email
      };
    });
  }

  async refresh(context: RefreshContext): Promise<AuthCommandResult> {
    this.assertEnabled();

    let claims;

    try {
      claims = verifyJwt(context.refreshToken, this.config.refreshTokenSecret, "refresh");
    } catch {
      throw new AppError(401, "Refresh token is invalid or expired.", undefined, "AUTHENTICATION_ERROR");
    }

    const result = await this.databaseService.withTransaction(async (client) => {
      const session = await this.getSessionById(client, claims.sessionId);

      if (
        !session ||
        session.user_id !== claims.sub ||
        session.tenant_id !== claims.tenantId ||
        session.revoked_at ||
        session.deleted_at ||
        session.status !== "active" ||
        session.expires_at.getTime() <= Date.now() ||
        !safeStringEquals(hashToken(context.refreshToken), session.refresh_token_hash)
      ) {
        if (session) {
          await this.revokeSession(client, session.id, session.user_id, "refresh_token_rejected");
          await this.recordAuditLog(client, {
            tenantId: session.tenant_id,
            actorUserId: session.user_id,
            sessionId: session.id,
            eventType: "auth",
            action: "auth.refresh",
            resourceType: "session",
            resourceId: session.id,
            status: "failure",
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
            requestId: context.requestId,
            metadata: {
              reason: "refresh_token_rejected"
            }
          });
        } else {
          await this.recordAuditLog(client, {
            tenantId: claims.tenantId,
            actorUserId: claims.sub,
            eventType: "auth",
            action: "auth.refresh",
            resourceType: "session",
            resourceId: claims.sessionId,
            status: "failure",
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
            requestId: context.requestId,
            metadata: {
              reason: "session_not_found"
            }
          });
        }

        return {
          kind: "error" as const
        };
      }

      const accessTokenResult = signJwt({
        subject: session.user_id,
        tenantId: session.tenant_id,
        sessionId: session.id,
        email: session.email,
        secret: this.config.accessTokenSecret,
        expiresInSeconds: this.getAccessTokenTtlSeconds(),
        type: "access"
      });
      const refreshTokenResult = signJwt({
        subject: session.user_id,
        tenantId: session.tenant_id,
        sessionId: session.id,
        email: session.email,
        secret: this.config.refreshTokenSecret,
        expiresInSeconds: this.getRefreshTokenTtlSeconds(),
        type: "refresh",
        nonce: createTokenNonce()
      });

      await client.query(
        `
          UPDATE auth_sessions
          SET
            refresh_token_hash = $2,
            expires_at = $3,
            last_seen_at = NOW(),
            ip_address = COALESCE(NULLIF($4, '')::inet, ip_address),
            user_agent = COALESCE($5, user_agent),
            updated_at = NOW(),
            updated_by = $6,
            metadata = auth_sessions.metadata || jsonb_build_object('rotatedAt', NOW())
          WHERE id = $1
        `,
        [
          session.id,
          hashToken(refreshTokenResult.token),
          refreshTokenResult.expiresAt,
          context.ipAddress ?? "",
          context.userAgent ?? null,
          session.user_id
        ]
      );

      const userSummary = await this.loadUserSummary(client, session.user_id, session.tenant_id);

      await this.recordAuditLog(client, {
        tenantId: session.tenant_id,
        actorUserId: session.user_id,
        sessionId: session.id,
        eventType: "auth",
        action: "auth.refresh",
        resourceType: "session",
        resourceId: session.id,
        status: "success",
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
        metadata: {
          tenantSlug: session.tenant_slug
        }
      });

      return {
        kind: "success" as const,
        authResponse: this.createAuthResponse(
          userSummary,
          {
            id: session.id,
            expiresAt: refreshTokenResult.expiresAt,
            lastSeenAt: new Date().toISOString()
          },
          {
            session: {
              id: session.id,
              expiresAt: refreshTokenResult.expiresAt,
              lastSeenAt: new Date().toISOString()
            },
            accessToken: accessTokenResult.token,
            accessTokenExpiresAt: accessTokenResult.expiresAt,
            refreshToken: refreshTokenResult.token,
            refreshTokenExpiresAt: refreshTokenResult.expiresAt
          }
        ),
        refreshToken: refreshTokenResult.token
      };
    });

    if (result.kind === "error") {
      throw new AppError(401, "Refresh token is invalid or expired.", undefined, "AUTHENTICATION_ERROR");
    }

    return {
      authResponse: result.authResponse,
      refreshToken: result.refreshToken
    };
  }

  async logout(context: LogoutContext): Promise<void> {
    this.assertEnabled();

    let sessionId: string | null = null;
    let actorUserId: string | null = null;
    let tenantId: string | null = null;

    if (context.accessToken) {
      try {
        const accessClaims = verifyJwt(context.accessToken, this.config.accessTokenSecret, "access");
        sessionId = accessClaims.sessionId;
        actorUserId = accessClaims.sub;
        tenantId = accessClaims.tenantId;
      } catch {
        sessionId = sessionId ?? null;
      }
    }

    if (!sessionId && context.refreshToken) {
      try {
        const refreshClaims = verifyJwt(context.refreshToken, this.config.refreshTokenSecret, "refresh");
        sessionId = refreshClaims.sessionId;
        actorUserId = refreshClaims.sub;
        tenantId = refreshClaims.tenantId;
      } catch {
        sessionId = sessionId ?? null;
      }
    }

    if (!sessionId) {
      return;
    }

    await this.databaseService.withTransaction(async (client) => {
      const session = await this.getSessionById(client, sessionId!);

      if (!session) {
        return;
      }

      await this.revokeSession(client, session.id, actorUserId ?? session.user_id, "logout");
      await this.recordAuditLog(client, {
        tenantId: tenantId ?? session.tenant_id,
        actorUserId: actorUserId ?? session.user_id,
        sessionId: session.id,
        eventType: "auth",
        action: "auth.logout",
        resourceType: "session",
        resourceId: session.id,
        status: "success",
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
        metadata: {
          reason: "user_logout"
        }
      });
    });
  }

  async getCurrentUser(identity: AuthIdentity): Promise<CurrentUserResponse> {
    this.assertEnabled();

    return this.databaseService.withTransaction(async (client) => {
      const session = await this.getSessionById(client, identity.sessionId);

      if (
        !session ||
        session.user_id !== identity.userId ||
        session.tenant_id !== identity.tenantId ||
        session.revoked_at ||
        session.deleted_at ||
        session.status !== "active"
      ) {
        throw new AppError(401, "Authentication is required.", undefined, "AUTHENTICATION_ERROR");
      }

      const userSummary = await this.loadUserSummary(client, identity.userId, identity.tenantId);

      return {
        user: userSummary,
        session: {
          id: session.id,
          expiresAt: session.expires_at.toISOString(),
          lastSeenAt: session.last_seen_at.toISOString()
        }
      };
    });
  }
}
