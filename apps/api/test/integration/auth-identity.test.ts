import { describe, expect, it } from "vitest";
import type { DatabaseService } from "../../src/platform/database/database.service";
import { AuthService } from "../../src/modules/auth/auth.service";
import { signJwt } from "../../src/common/auth/jwt";

const ACCESS_SECRET = "auth-identity-test-access-secret";

interface SessionOverrides {
  id?: string;
  user_id?: string;
  tenant_id?: string;
  revoked_at?: Date | null;
  deleted_at?: Date | null;
  status?: string;
}

function buildSessionRow(overrides: SessionOverrides = {}) {
  return {
    id: "session-1",
    tenant_id: "tenant-1",
    user_id: "user-1",
    refresh_token_hash: "hash",
    expires_at: new Date(Date.now() + 3_600_000),
    last_seen_at: new Date(),
    revoked_at: null,
    deleted_at: null,
    status: "active",
    email: "user@example.test",
    first_name: "Test",
    last_name: "User",
    display_name: "Test User",
    user_metadata: {},
    tenant_slug: "tenant-1-slug",
    tenant_name: "Tenant One",
    ...overrides
  };
}

// A fake database that returns canned rows for the queries authenticateAccessToken
// runs (session lookup + user/role/permission summary), so we can exercise the real
// identity + tenant-isolation logic without a live PostgreSQL.
function fakeDatabase(session: ReturnType<typeof buildSessionRow> | null): DatabaseService {
  const client = {
    async query(sql: string) {
      if (sql.includes("FROM auth_sessions")) {
        return { rows: session ? [session] : [] };
      }
      if (sql.includes("FROM users") && sql.includes("INNER JOIN tenants")) {
        return {
          rows: [
            {
              id: "user-1",
              email: "user@example.test",
              first_name: "Test",
              last_name: "User",
              display_name: "Test User",
              status: "active",
              metadata: {},
              tenant_id: "tenant-1",
              tenant_slug: "tenant-1-slug",
              tenant_name: "Tenant One"
            }
          ]
        };
      }
      if (sql.includes("roles.slug")) {
        return { rows: [{ id: "role-1", slug: "sales-manager", name: "Sales Manager" }] };
      }
      if (sql.includes("permissions.code")) {
        return { rows: [{ code: "leads.view" }, { code: "leads.edit" }] };
      }
      return { rows: [] };
    }
  };
  return {
    isEnabled: () => true,
    async withClient<T>(callback: (c: typeof client) => Promise<T>) {
      return callback(client);
    }
  } as unknown as DatabaseService;
}

function buildAuthService(session: ReturnType<typeof buildSessionRow> | null) {
  return new AuthService(fakeDatabase(session), {
    enabled: true,
    accessTokenSecret: ACCESS_SECRET,
    refreshTokenSecret: "auth-identity-test-refresh-secret",
    accessTokenTtlMinutes: 15,
    refreshTokenTtlDays: 30,
    accountLockThreshold: 5,
    accountLockMinutes: 30,
    enableAuditLogs: false
  });
}

function tokenFor(overrides: { sub?: string; tenantId?: string; sessionId?: string } = {}) {
  return signJwt({
    subject: overrides.sub ?? "user-1",
    tenantId: overrides.tenantId ?? "tenant-1",
    sessionId: overrides.sessionId ?? "session-1",
    email: "user@example.test",
    secret: ACCESS_SECRET,
    expiresInSeconds: 900,
    type: "access"
  }).token;
}

describe("Auth: access-token identity resolution", () => {
  it("resolves a valid token to a tenant-scoped identity with roles + permissions", async () => {
    const service = buildAuthService(buildSessionRow());
    const identity = await service.authenticateAccessToken(tokenFor());
    expect(identity.userId).toBe("user-1");
    expect(identity.tenantId).toBe("tenant-1");
    expect(identity.sessionId).toBe("session-1");
    expect(identity.permissionCodes).toContain("leads.view");
    expect(identity.roles[0]?.slug).toBe("sales-manager");
  });

  it("rejects a structurally invalid token with 401", async () => {
    const service = buildAuthService(buildSessionRow());
    await expect(service.authenticateAccessToken("not.a.jwt")).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects a token signed with the wrong secret", async () => {
    const service = buildAuthService(buildSessionRow());
    const foreign = signJwt({
      subject: "user-1",
      tenantId: "tenant-1",
      sessionId: "session-1",
      email: "user@example.test",
      secret: "a-different-secret-entirely",
      expiresInSeconds: 900,
      type: "access"
    }).token;
    await expect(service.authenticateAccessToken(foreign)).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe("Tenant isolation: access tokens are bound to their session's tenant", () => {
  it("rejects a token whose tenant claim does not match the session tenant", async () => {
    const service = buildAuthService(buildSessionRow({ tenant_id: "tenant-1" }));
    await expect(
      service.authenticateAccessToken(tokenFor({ tenantId: "tenant-attacker" }))
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects a token whose user claim does not match the session user", async () => {
    const service = buildAuthService(buildSessionRow({ user_id: "user-1" }));
    await expect(
      service.authenticateAccessToken(tokenFor({ sub: "user-attacker" }))
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects a revoked session", async () => {
    const service = buildAuthService(buildSessionRow({ revoked_at: new Date() }));
    await expect(service.authenticateAccessToken(tokenFor())).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects when the session cannot be found", async () => {
    const service = buildAuthService(null);
    await expect(service.authenticateAccessToken(tokenFor())).rejects.toMatchObject({ statusCode: 401 });
  });
});
