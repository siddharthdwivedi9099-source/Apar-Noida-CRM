import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";

const apiBaseUrl = process.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4012/api/v1";
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://crm:crm@localhost:5433/crm";
const defaultTenantSlug = process.env.DEFAULT_TENANT_SLUG ?? "sample-tenant";
const runToken = randomUUID().replace(/-/g, "").slice(0, 10);
const userPassword = `AuditPass!${runToken}`;
const MARK = `phase27_${runToken}`;

const ADMIN_FULL_PERMISSIONS = ["admin.view", "admin.export", "admin.configure"];
const ADMIN_READ_PERMISSIONS = ["admin.view"];
const NON_ADMIN_PERMISSIONS = ["leads.view"];

function log(message) {
  console.log(`[phase27-exhaustive] ${message}`);
}

function parsePayload(rawBody) {
  if (!rawBody) {
    return null;
  }
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

async function loginSession(tenantSlug, email, password) {
  const authPayload = await request("/auth/login", {
    method: "POST",
    expectedStatus: 200,
    body: { tenantSlug, email, password }
  });
  const accessToken = authPayload.tokens.accessToken;
  assert.ok(accessToken, "Login should return an access token.");
  return { accessToken };
}

async function queryOne(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0] ?? null;
}

async function createRole(client, { tenantId, roleSlug, roleName, permissionCodes }) {
  const result = await client.query(
    `INSERT INTO roles (tenant_id, slug, name, description, metadata)
     VALUES ($1, $2, $3, $4, jsonb_build_object('testRun', $5::text))
     RETURNING id`,
    [tenantId, roleSlug, roleName, `${roleName} for Phase 27 testing`, runToken]
  );
  const roleId = result.rows[0].id;
  await client.query(
    `INSERT INTO role_permissions (tenant_id, role_id, permission_id, metadata)
     SELECT $1, $2, permissions.id, jsonb_build_object('testRun', $4::text)
     FROM permissions
     WHERE permissions.code = ANY($3::text[]) AND permissions.deleted_at IS NULL`,
    [tenantId, roleId, permissionCodes, runToken]
  );
  return roleId;
}

async function createUser(client, { tenantId, email, password, firstName, lastName, roleId }) {
  const displayName = `${firstName} ${lastName}`.trim();
  const userResult = await client.query(
    `INSERT INTO users (
       tenant_id, email, normalized_email, first_name, last_name, display_name,
       password_hash, status, password_changed_at, metadata
     )
     VALUES ($1, $2, LOWER($2), $3, $4, $5, crypt($6, gen_salt('bf')), 'active', NOW(), jsonb_build_object('testRun', $7::text))
     RETURNING id`,
    [tenantId, email, firstName, lastName, displayName, password, runToken]
  );
  const userId = userResult.rows[0].id;
  await client.query(
    `INSERT INTO user_roles (tenant_id, user_id, role_id, metadata)
     VALUES ($1, $2, $3, jsonb_build_object('testRun', $4::text))`,
    [tenantId, userId, roleId, runToken]
  );
  return userId;
}

// Insert a controlled set of audit-log rows, all sharing a unique resource_type
// (MARK) so they can be isolated from any pre-existing tenant audit history.
async function seedAuditRows(client, { tenantId, actorUserId }) {
  const rows = [
    { event_type: "auth", action: "auth.login", status: "success", actor: actorUserId },
    { event_type: "auth", action: "auth.login", status: "failure", actor: actorUserId },
    { event_type: "ai", action: "ai.gateway.invoke", status: "success", actor: null },
    { event_type: "rbac", action: "rbac.role.create", status: "success", actor: null },
    { event_type: "rbac", action: "rbac.role.permissions.replace", status: "success", actor: null },
    { event_type: "security", action: "audit.export", status: "success", actor: null },
    { event_type: "crm", action: "lead.delete", status: "success", actor: null },
    { event_type: "dashboards", action: "dashboards.view", status: "success", actor: null },
    { event_type: "security", action: "security.access_denied", status: "denied", actor: null },
    { event_type: "customer_portal", action: "customer_portal.ticket.create", status: "success", actor: null }
  ];
  for (const row of rows) {
    await client.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, session_id, event_type, action, resource_type, resource_id, status, metadata)
       VALUES ($1, $2, NULL, $3, $4, $5, NULL, $6, jsonb_build_object('testRun', $7::text))`,
      [tenantId, row.actor, row.event_type, row.action, MARK, row.status, runToken]
    );
  }
  return rows.length;
}

async function pollAuditEvent(client, { tenantId, action, resourceType, status, attempts = 20, delayMs = 150 }) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const row = await queryOne(
      client,
      `SELECT status FROM audit_logs
       WHERE tenant_id = $1 AND action = $2 AND resource_type = $3 ${status ? "AND status = $4" : ""}
       ORDER BY created_at DESC LIMIT 1`,
      status ? [tenantId, action, resourceType, status] : [tenantId, action, resourceType]
    );
    if (row) {
      return row;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    log("Checking root API status, schema, and permission catalog.");
    const root = await request("/", { expectedStatus: 200 });
    // The root status is a single global current-phase marker that advances each phase;
    // assert it is operational rather than pinning it to this phase specifically.
    assert.match(root.status, /^phase-\d+-operational$/, "API root should report an operational phase status.");

    const governanceTable = await queryOne(
      client,
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'data_governance_settings' LIMIT 1`
    );
    assert.equal(governanceTable?.table_name, "data_governance_settings", "data_governance_settings table should exist for Phase 27.");

    for (const indexName of [
      "idx_audit_logs_tenant_event_created",
      "idx_audit_logs_tenant_action_created",
      "idx_audit_logs_tenant_status_created"
    ]) {
      const index = await queryOne(client, `SELECT indexname FROM pg_indexes WHERE indexname = $1 LIMIT 1`, [indexName]);
      assert.equal(index?.indexname, indexName, `${indexName} should exist for Phase 27.`);
    }

    for (const permissionCode of [...ADMIN_FULL_PERMISSIONS, "admin.view_dashboard", "admin.manage_workflow"]) {
      const permission = await queryOne(client, `SELECT code FROM permissions WHERE code = $1 AND deleted_at IS NULL LIMIT 1`, [permissionCode]);
      assert.equal(permission?.code, permissionCode, `${permissionCode} should exist in the permission catalog.`);
    }

    const tenant = await queryOne(client, `SELECT id FROM tenants WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`, [defaultTenantSlug]);
    assert.ok(tenant, "Default tenant should exist.");
    const tenantId = tenant.id;

    log("Provisioning roles and users (admin, read-only, non-admin, probe).");
    const adminRoleId = await createRole(client, { tenantId, roleSlug: `phase27-admin-${runToken}`, roleName: `Phase 27 Admin ${runToken}`, permissionCodes: ADMIN_FULL_PERMISSIONS });
    const readRoleId = await createRole(client, { tenantId, roleSlug: `phase27-read-${runToken}`, roleName: `Phase 27 Read ${runToken}`, permissionCodes: ADMIN_READ_PERMISSIONS });
    const nonAdminRoleId = await createRole(client, { tenantId, roleSlug: `phase27-nonadmin-${runToken}`, roleName: `Phase 27 NonAdmin ${runToken}`, permissionCodes: NON_ADMIN_PERMISSIONS });

    const adminEmail = `phase27-admin-${runToken}@example.test`;
    const readEmail = `phase27-read-${runToken}@example.test`;
    const nonAdminEmail = `phase27-nonadmin-${runToken}@example.test`;
    const probeEmail = `phase27-probe-${runToken}@example.test`;
    const actorEmail = `phase27-actor-${runToken}@example.test`;

    const actorUserId = await createUser(client, { tenantId, email: actorEmail, password: userPassword, firstName: "Audit", lastName: "Actor", roleId: readRoleId });
    await createUser(client, { tenantId, email: adminEmail, password: userPassword, firstName: "Audit", lastName: "Admin", roleId: adminRoleId });
    await createUser(client, { tenantId, email: readEmail, password: userPassword, firstName: "Audit", lastName: "Reader", roleId: readRoleId });
    await createUser(client, { tenantId, email: nonAdminEmail, password: userPassword, firstName: "Audit", lastName: "Outsider", roleId: nonAdminRoleId });
    await createUser(client, { tenantId, email: probeEmail, password: userPassword, firstName: "Audit", lastName: "Probe", roleId: readRoleId });

    const adminSession = await loginSession(defaultTenantSlug, adminEmail, userPassword);
    const readSession = await loginSession(defaultTenantSlug, readEmail, userPassword);
    const nonAdminSession = await loginSession(defaultTenantSlug, nonAdminEmail, userPassword);
    const probeSession = await loginSession(defaultTenantSlug, probeEmail, userPassword);

    const seededCount = await seedAuditRows(client, { tenantId, actorUserId });
    log(`Seeded ${seededCount} marked audit-log rows (resource_type=${MARK}).`);

    log("Verifying authorization gates on /audit routes.");
    for (const path of ["/audit/logs", "/audit/summary", "/audit/security-review", "/audit/governance"]) {
      await expectError(path, { accessToken: nonAdminSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN" });
    }
    await expectError("/audit/logs", { expectedStatus: 401, expectedCode: "AUTHENTICATION_ERROR" });

    log("Verifying audit log listing, filters, categories, and pagination.");
    const allMarked = await request(`/audit/logs?resourceType=${MARK}&pageSize=200`, { accessToken: adminSession.accessToken });
    assert.equal(allMarked.pagination.total, seededCount, "Marked audit rows total should match seeded count.");
    assert.equal(allMarked.logs.length, seededCount, "All marked rows should be returned on one page.");
    assert.ok(
      allMarked.logs.every((entry) => entry.resourceType === MARK),
      "Every returned row should match the resourceType filter."
    );
    assert.ok(
      allMarked.logs.every((entry, index) => index === 0 || allMarked.logs[index - 1].createdAt >= entry.createdAt),
      "Logs should be ordered by createdAt descending."
    );

    const byEventType = await request(`/audit/logs?resourceType=${MARK}&eventType=auth`, { accessToken: adminSession.accessToken });
    assert.equal(byEventType.pagination.total, 2, "Two seeded auth events expected.");

    const byStatusFailure = await request(`/audit/logs?resourceType=${MARK}&status=failure`, { accessToken: adminSession.accessToken });
    assert.equal(byStatusFailure.pagination.total, 1, "One seeded failure event expected.");

    const byStatusDenied = await request(`/audit/logs?resourceType=${MARK}&status=denied`, { accessToken: adminSession.accessToken });
    assert.equal(byStatusDenied.pagination.total, 1, "One seeded denied event expected.");

    const byAction = await request(`/audit/logs?resourceType=${MARK}&action=auth.login`, { accessToken: adminSession.accessToken });
    assert.equal(byAction.pagination.total, 2, "Two seeded auth.login events expected.");

    const byActor = await request(`/audit/logs?resourceType=${MARK}&actorUserId=${actorUserId}`, { accessToken: adminSession.accessToken });
    assert.equal(byActor.pagination.total, 2, "Two seeded rows attributed to the actor expected.");
    assert.ok(
      byActor.logs.every((entry) => entry.actorName === "Audit Actor"),
      "Actor-attributed rows should resolve the actor display name."
    );

    const bySearch = await request(`/audit/logs?resourceType=${MARK}&search=GATEWAY`, { accessToken: adminSession.accessToken });
    assert.equal(bySearch.pagination.total, 1, "Case-insensitive search on action should find the ai.gateway.invoke row.");

    const byCategoryAuth = await request(`/audit/logs?resourceType=${MARK}&category=authentication`, { accessToken: adminSession.accessToken });
    assert.equal(byCategoryAuth.pagination.total, 2, "Authentication category should match the two auth rows.");

    const byCategoryExports = await request(`/audit/logs?resourceType=${MARK}&category=exports`, { accessToken: adminSession.accessToken });
    assert.equal(byCategoryExports.pagination.total, 1, "Exports category should match the audit.export row.");

    const byCategoryDataAccess = await request(`/audit/logs?resourceType=${MARK}&category=data_access`, { accessToken: adminSession.accessToken });
    assert.equal(byCategoryDataAccess.pagination.total, 2, "Data-access category should match dashboards and customer-portal rows.");

    const byCategoryFailed = await request(`/audit/logs?resourceType=${MARK}&category=failed_access`, { accessToken: adminSession.accessToken });
    assert.equal(byCategoryFailed.pagination.total, 3, "Failed-access category should match the failure, denied, and security rows.");

    // Date filtering.
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const fromToday = await request(`/audit/logs?resourceType=${MARK}&from=${today}`, { accessToken: adminSession.accessToken });
    assert.equal(fromToday.pagination.total, seededCount, "from=today should include all seeded rows.");
    const fromTomorrow = await request(`/audit/logs?resourceType=${MARK}&from=${tomorrow}`, { accessToken: adminSession.accessToken });
    assert.equal(fromTomorrow.pagination.total, 0, "from=tomorrow should exclude all seeded rows.");
    const toYesterday = await request(`/audit/logs?resourceType=${MARK}&to=${yesterday}`, { accessToken: adminSession.accessToken });
    assert.equal(toYesterday.pagination.total, 0, "to=yesterday should exclude all seeded rows.");

    // Pagination.
    const paged = await request(`/audit/logs?resourceType=${MARK}&pageSize=4&page=1`, { accessToken: adminSession.accessToken });
    assert.equal(paged.logs.length, 4, "First page should hold the page size.");
    assert.equal(paged.pagination.total, seededCount, "Pagination total should report all marked rows.");
    assert.equal(paged.pagination.totalPages, 3, "Ten rows at page size four should be three pages.");
    assert.equal(paged.pagination.hasNextPage, true, "First page should report a next page.");
    assert.equal(paged.pagination.hasPreviousPage, false, "First page should not report a previous page.");
    const lastPage = await request(`/audit/logs?resourceType=${MARK}&pageSize=4&page=3`, { accessToken: adminSession.accessToken });
    assert.equal(lastPage.logs.length, 2, "Last page should hold the remainder.");
    assert.equal(lastPage.pagination.hasNextPage, false, "Last page should not report a next page.");

    log("Verifying audit summary structure and counts.");
    const summary = await request(`/audit/summary?windowDays=60`, { accessToken: readSession.accessToken });
    assert.equal(summary.windowDays, 60, "Summary should echo the requested window.");
    assert.ok(summary.totalEvents >= seededCount, "Summary total should include seeded rows.");
    assert.equal(summary.categories.length, 9, "Summary should expose all nine categories.");
    const categoryKeys = summary.categories.map((category) => category.key).sort();
    assert.deepEqual(
      categoryKeys,
      ["ai_usage", "authentication", "data_access", "exports", "failed_access", "permission_change", "role_change", "sensitive_action", "user_activity"].sort(),
      "Summary should expose the expected category keys."
    );
    assert.ok(summary.failedAccessCount >= 3, "Summary failed-access count should include seeded rows.");
    assert.ok(Array.isArray(summary.eventTypeDistribution) && summary.eventTypeDistribution.length > 0, "Summary should include an event-type distribution.");
    assert.ok(Array.isArray(summary.statusDistribution) && summary.statusDistribution.length > 0, "Summary should include a status distribution.");

    log("Verifying security review checklist.");
    const review = await request("/audit/security-review", { accessToken: readSession.accessToken });
    assert.ok(Array.isArray(review.checklist) && review.checklist.length >= 10, "Security review should return a checklist.");
    assert.ok(
      review.checklist.every((item) => item.area && item.control && ["enforced", "configured", "deferred"].includes(item.status)),
      "Each checklist item should have an area, control, and valid status."
    );

    log("Verifying audit export and export authorization.");
    await expectError(`/audit/export?resourceType=${MARK}`, { accessToken: readSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN" });
    const exportResult = await request(`/audit/export?resourceType=${MARK}`, { accessToken: adminSession.accessToken });
    assert.equal(exportResult.count, seededCount, "Export count should match the marked rows.");
    assert.equal(exportResult.rows.length, seededCount, "Export should return all marked rows.");
    assert.equal(exportResult.filter.resourceType, MARK, "Export should echo the applied filter.");
    const exportAudit = await pollAuditEvent(client, { tenantId, action: "audit.export", resourceType: "audit_log" });
    assert.ok(exportAudit, "Export should write an audit.export security event.");

    log("Verifying data governance settings get/update and validation.");
    const governance = await request("/audit/governance", { accessToken: readSession.accessToken });
    assert.ok(governance.settings, "Governance settings should be returned.");
    assert.ok(Number.isInteger(governance.settings.auditLogRetentionDays) && governance.settings.auditLogRetentionDays > 0, "Audit retention should be a positive integer.");
    assert.ok(Array.isArray(governance.settings.allowedFileTypes) && governance.settings.allowedFileTypes.length > 0, "Allowed file types should be a non-empty array by default.");

    await expectError("/audit/governance", { method: "PATCH", accessToken: readSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { auditLogRetentionDays: 400 } });
    await expectError("/audit/governance", { method: "PATCH", accessToken: adminSession.accessToken, expectedStatus: 400, expectedCode: "VALIDATION_ERROR", body: {} });
    await expectError("/audit/governance", { method: "PATCH", accessToken: adminSession.accessToken, expectedStatus: 400, expectedCode: "VALIDATION_ERROR", body: { auditLogRetentionDays: -5 } });

    const updated = await request("/audit/governance", {
      method: "PATCH",
      accessToken: adminSession.accessToken,
      body: { auditLogRetentionDays: 400, piiRedactionEnabled: false, failedAccessLoggingEnabled: false, fileUploadMaxMb: 64, allowedFileTypes: ["pdf", "png"] }
    });
    assert.equal(updated.settings.auditLogRetentionDays, 400, "Updated audit retention should persist.");
    assert.equal(updated.settings.piiRedactionEnabled, false, "Updated PII redaction flag should persist.");
    assert.equal(updated.settings.failedAccessLoggingEnabled, false, "Updated failed-access flag should persist.");
    assert.equal(updated.settings.fileUploadMaxMb, 64, "Updated upload limit should persist.");
    assert.deepEqual(updated.settings.allowedFileTypes, ["pdf", "png"], "Updated allowed file types should persist.");

    const governanceAudit = await pollAuditEvent(client, { tenantId, action: "data_governance.update", resourceType: "data_governance_settings" });
    assert.ok(governanceAudit, "Governance update should write a data_governance.update security event.");

    const governanceRowCount = await queryOne(
      client,
      `SELECT COUNT(*)::int AS count FROM data_governance_settings WHERE tenant_id = $1 AND deleted_at IS NULL`,
      [tenantId]
    );
    assert.equal(governanceRowCount.count, 1, "Exactly one active governance row should exist per tenant.");

    log("Verifying failed-access logging on authenticated authorization denials.");
    const deniedBefore = await client.query(
      `SELECT COUNT(*)::int AS count FROM audit_logs WHERE tenant_id = $1 AND actor_user_id = (SELECT id FROM users WHERE normalized_email = LOWER($2)) AND action = 'security.access_denied'`,
      [tenantId, readEmail]
    );
    await expectError("/audit/governance", { method: "PATCH", accessToken: readSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { auditLogRetentionDays: 500 } });
    let deniedRow = null;
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const deniedAfter = await client.query(
        `SELECT id, status FROM audit_logs WHERE tenant_id = $1 AND actor_user_id = (SELECT id FROM users WHERE normalized_email = LOWER($2)) AND action = 'security.access_denied' ORDER BY created_at DESC LIMIT 1`,
        [tenantId, readEmail]
      );
      const afterCount = (await client.query(
        `SELECT COUNT(*)::int AS count FROM audit_logs WHERE tenant_id = $1 AND actor_user_id = (SELECT id FROM users WHERE normalized_email = LOWER($2)) AND action = 'security.access_denied'`,
        [tenantId, readEmail]
      )).rows[0].count;
      if (afterCount > deniedBefore.rows[0].count && deniedAfter.rows[0]) {
        deniedRow = deniedAfter.rows[0];
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    assert.ok(deniedRow, "A 403 for an authenticated request should record a security.access_denied audit event.");
    assert.equal(deniedRow.status, "denied", "Failed-access event for a 403 should have denied status.");

    log("Verifying the strict per-user rate-limit probe.");
    const firstProbe = await rawRequest("/audit/security/rate-limit-check", { accessToken: probeSession.accessToken });
    assert.equal(firstProbe.status, 200, "First probe call should succeed.");
    assert.equal(firstProbe.payload.ok, true, "Probe success payload should be ok.");
    const probeLimit = Number(firstProbe.payload.limit);
    assert.ok(Number.isInteger(probeLimit) && probeLimit >= 1, "Probe should report its limit.");
    assert.ok(probeLimit <= 100, "Probe limit should be small enough to exercise within the test.");
    let consumed = 1;
    while (consumed < probeLimit) {
      const ok = await rawRequest("/audit/security/rate-limit-check", { accessToken: probeSession.accessToken });
      assert.equal(ok.status, 200, `Probe call ${consumed + 1} within the limit should succeed.`);
      consumed += 1;
    }
    const overLimit = await rawRequest("/audit/security/rate-limit-check", { accessToken: probeSession.accessToken });
    assert.equal(overLimit.status, 429, "Exceeding the probe limit should return 429.");
    assert.equal(overLimit.payload.error.code, "RATE_LIMITED", "Over-limit probe should return RATE_LIMITED.");

    log("Checking documentation updates.");
    const docsToCheck = [
      ["docs/technical/API_DOCUMENTATION.md", "Audit, Security and Data Governance Routes (Phase 27)"],
      ["docs/security/ACCESS_CONTROL_GUIDE.md", "Audit, Security and Data Governance (Phase 27)"],
      ["CHANGELOG.md", "Phase 27 migration"]
    ];
    for (const [filePath, expectedText] of docsToCheck) {
      const contents = await readFile(filePath, "utf8");
      assert.ok(contents.includes(expectedText), `${filePath} should mention "${expectedText}".`);
    }

    log("Phase 27 exhaustive checks passed.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
