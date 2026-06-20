import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";

const apiBaseUrl = process.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4012/api/v1";
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://crm:crm@localhost:5433/crm";
const defaultTenantSlug = process.env.DEFAULT_TENANT_SLUG ?? "sample-tenant";
const adminEmail = process.env.DEFAULT_ADMIN_EMAIL ?? "admin@sample-tenant.local";
const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD ?? "ChangeMe123!";
const runToken = randomUUID().replace(/-/g, "").slice(0, 10);
const userPassword = `ObsPass!${runToken}`;

const PHASE29_INDEXES = [
  "idx_leads_tenant_email_active",
  "idx_leads_tenant_score_active",
  "idx_accounts_tenant_name_active",
  "idx_accounts_tenant_health_active",
  "idx_contacts_tenant_email_active",
  "idx_opportunities_tenant_amount_active",
  "idx_campaigns_tenant_schedule_active",
  "idx_support_tickets_tenant_sla_open"
];

function log(message) {
  console.log(`[phase29-exhaustive] ${message}`);
}

function parsePayload(rawBody) {
  if (!rawBody) return null;
  try {
    return JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
}

async function rawRequest(path, { method = "GET", accessToken, body } = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const rawBody = await response.text();
  return { status: response.status, payload: parsePayload(rawBody), rawBody };
}

async function request(path, { expectedStatus = 200, ...options } = {}) {
  const { status, payload, rawBody } = await rawRequest(path, options);
  if (status !== expectedStatus) {
    throw new Error(`Expected ${expectedStatus} from ${options.method ?? "GET"} ${path}, received ${status}: ${rawBody}`);
  }
  return payload;
}

async function expectError(path, { expectedStatus, expectedCode, ...options }) {
  const payload = await request(path, { ...options, expectedStatus });
  assert.ok(payload?.error, `Expected an error payload from ${options.method ?? "GET"} ${path}.`);
  assert.equal(payload.error.code, expectedCode, `Expected ${expectedCode} from ${options.method ?? "GET"} ${path}.`);
  return payload.error;
}

async function login(email, password) {
  const payload = await request("/auth/login", { method: "POST", expectedStatus: 200, body: { tenantSlug: defaultTenantSlug, email, password } });
  assert.ok(payload.tokens?.accessToken, "Login should return an access token.");
  return payload.tokens.accessToken;
}

async function queryOne(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0] ?? null;
}

async function createRole(client, { tenantId, roleSlug, roleName, permissionCodes }) {
  const roleId = (await client.query(
    `INSERT INTO roles (tenant_id, slug, name, description, metadata) VALUES ($1,$2,$3,$4, jsonb_build_object('testRun',$5::text)) RETURNING id`,
    [tenantId, roleSlug, roleName, `${roleName} for Phase 29 testing`, runToken]
  )).rows[0].id;
  await client.query(
    `INSERT INTO role_permissions (tenant_id, role_id, permission_id, metadata)
     SELECT $1,$2,permissions.id, jsonb_build_object('testRun',$4::text) FROM permissions
     WHERE permissions.code = ANY($3::text[]) AND permissions.deleted_at IS NULL`,
    [tenantId, roleId, permissionCodes, runToken]
  );
  return roleId;
}

async function createUser(client, { tenantId, email, password, firstName, lastName, roleId }) {
  const userId = (await client.query(
    `INSERT INTO users (tenant_id, email, normalized_email, first_name, last_name, display_name, password_hash, status, password_changed_at, metadata)
     VALUES ($1,$2,LOWER($2),$3,$4,$5, crypt($6, gen_salt('bf')), 'active', NOW(), jsonb_build_object('testRun',$7::text)) RETURNING id`,
    [tenantId, email, firstName, lastName, `${firstName} ${lastName}`, password, runToken]
  )).rows[0].id;
  await client.query(
    `INSERT INTO user_roles (tenant_id, user_id, role_id, metadata) VALUES ($1,$2,$3, jsonb_build_object('testRun',$4::text))`,
    [tenantId, userId, roleId, runToken]
  );
  return userId;
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    log("Checking root API status reports Phase 29.");
    const root = await request("/", { expectedStatus: 200 });
    assert.equal(root.status, "phase-29-operational", "API root should report Phase 29 status.");

    log("Verifying Phase 29 performance indexes exist in the database.");
    for (const indexName of PHASE29_INDEXES) {
      const row = await queryOne(client, `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname=$1 LIMIT 1`, [indexName]);
      assert.equal(row?.indexname, indexName, `${indexName} should exist for Phase 29.`);
    }

    log("Verifying liveness endpoints (/health and /live).");
    for (const path of ["/health", "/live"]) {
      const health = await request(path, { expectedStatus: 200 });
      assert.equal(health.status, "ok", `${path} should report ok.`);
      assert.ok(health.dependencies?.database, `${path} should include database health.`);
      assert.ok(health.dependencies?.redis, `${path} should include redis health.`);
      assert.ok(health.uptimeSeconds >= 0, `${path} should report uptime.`);
    }

    log("Verifying readiness endpoint (/ready) with a live database.");
    const ready = await request("/ready", { expectedStatus: 200 });
    assert.equal(ready.status, "ready", "Service should be ready with a connected database.");
    const dbCheck = ready.checks.find((c) => c.name === "database");
    assert.equal(dbCheck?.status, "pass", "Database readiness check should pass.");
    assert.ok(ready.checks.find((c) => c.name === "redis"), "Readiness should include a redis check.");

    log("Verifying metrics endpoint (/metrics).");
    const metrics = await request("/metrics", { expectedStatus: 200 });
    assert.ok(metrics.process.pid > 0, "Metrics should include a process id.");
    assert.match(metrics.process.nodeVersion, /^v\d/, "Metrics should include the node version.");
    assert.ok(metrics.process.memoryRssMb > 0, "Metrics should include memory usage.");
    assert.ok(metrics.cache, "Metrics should include cache status.");
    assert.match(metrics.note, /placeholder/i, "Metrics note should flag the placeholder.");
    const baselineMisses = metrics.cache.misses;

    log("Authenticating as the seeded admin.");
    const adminToken = await login(adminEmail, adminPassword);

    log("Verifying admin-gated observability endpoints.");
    await expectError("/observability/jobs", { expectedStatus: 401, expectedCode: "AUTHENTICATION_ERROR" });
    const jobs = await request("/observability/jobs", { accessToken: adminToken, expectedStatus: 200 });
    assert.equal(jobs.workerRuntime.enabled, false, "No worker runtime should be enabled.");
    assert.ok(jobs.jobs.length >= 5, "The background job catalog should be published.");
    assert.ok(jobs.jobs.every((j) => j.status === "deferred"), "All jobs should be deferred without a worker runtime.");
    const jobKeys = jobs.jobs.map((j) => j.key);
    assert.equal(new Set(jobKeys).size, jobKeys.length, "Job keys should be unique.");
    assert.ok(jobKeys.includes("workflow_scheduler"), "The workflow scheduler job should be listed.");

    const cacheStatus = await request("/observability/cache", { accessToken: adminToken, expectedStatus: 200 });
    assert.ok(cacheStatus.cache, "Cache status should be returned.");
    assert.equal(cacheStatus.cache.enabled, false, "Dashboard cache should be deferred by default.");

    log("Exercising the dashboard cache seam end-to-end.");
    const catalog = await request("/dashboards", { accessToken: adminToken, expectedStatus: 200 });
    const permitted = catalog.dashboards.find((d) => d.permitted) ?? catalog.dashboards[0];
    assert.ok(permitted?.key, "At least one dashboard should be available to the admin.");
    const dashboardCalls = 2;
    for (let i = 0; i < dashboardCalls; i += 1) {
      const dashboard = await request(`/dashboards/${permitted.key}`, { accessToken: adminToken, expectedStatus: 200 });
      assert.ok(Array.isArray(dashboard.widgets), "Dashboard should return widgets.");
    }
    const afterMetrics = await request("/metrics", { expectedStatus: 200 });
    assert.ok(
      afterMetrics.cache.misses >= baselineMisses + dashboardCalls,
      `Dashboard reads should flow through the cache seam (misses ${baselineMisses} -> ${afterMetrics.cache.misses}).`
    );

    log("Verifying authorization: a non-admin cannot read observability data.");
    const tenant = await queryOne(client, `SELECT id FROM tenants WHERE slug=$1 AND deleted_at IS NULL LIMIT 1`, [defaultTenantSlug]);
    assert.ok(tenant, "Default tenant should exist.");
    const nonAdminRoleId = await createRole(client, { tenantId: tenant.id, roleSlug: `phase29-nonadmin-${runToken}`, roleName: `Phase 29 NonAdmin ${runToken}`, permissionCodes: ["leads.view"] });
    const nonAdminEmail = `phase29-nonadmin-${runToken}@example.test`;
    await createUser(client, { tenantId: tenant.id, email: nonAdminEmail, password: userPassword, firstName: "Obs", lastName: "Outsider", roleId: nonAdminRoleId });
    const nonAdminToken = await login(nonAdminEmail, userPassword);
    await expectError("/observability/jobs", { accessToken: nonAdminToken, expectedStatus: 403, expectedCode: "FORBIDDEN" });
    await expectError("/observability/cache", { accessToken: nonAdminToken, expectedStatus: 403, expectedCode: "FORBIDDEN" });

    log("Checking documentation updates.");
    const docsToCheck = [
      ["docs/deployment/OBSERVABILITY_GUIDE.md", "Readiness"],
      ["docs/deployment/PERFORMANCE_GUIDE.md", "Dashboard Caching Strategy"],
      ["docs/deployment/PRODUCTION_READINESS_CHECKLIST.md", "Observability and Performance Readiness (Phase 29)"],
      ["docs/technical/TECHNICAL_DESIGN.md", "Observability and Performance (Phase 29)"],
      ["CHANGELOG.md", "Phase 29 observability"]
    ];
    for (const [filePath, expectedText] of docsToCheck) {
      const contents = await readFile(filePath, "utf8");
      assert.ok(contents.includes(expectedText), `${filePath} should mention "${expectedText}".`);
    }

    log("Phase 29 exhaustive checks passed.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
