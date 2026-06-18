import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

const apiBaseUrl = process.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4000/api/v1";
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://crm:crm@localhost:5433/crm";
const defaultTenantSlug = process.env.DEFAULT_TENANT_SLUG ?? "sample-tenant";
const defaultAdminEmail = process.env.DEFAULT_ADMIN_EMAIL ?? "admin@sample-tenant.local";
const defaultAdminPassword = process.env.DEFAULT_ADMIN_PASSWORD ?? "ChangeMe123!";
const runToken = randomUUID().replace(/-/g, "").slice(0, 10);

function log(message) {
  console.log(`[phase18-exhaustive] ${message}`);
}

function parsePayload(rawBody) {
  if (!rawBody) return null;
  try {
    return JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
}

async function request(path, { method = "GET", accessToken, body, expectedStatus = 200 } = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const rawBody = await response.text();
  const payload = parsePayload(rawBody);
  if (response.status !== expectedStatus) {
    throw new Error(`Expected ${expectedStatus} from ${method} ${path}, received ${response.status}: ${rawBody}`);
  }
  return payload;
}

async function expectError(path, { expectedStatus, expectedCode, ...options }) {
  const payload = await request(path, { ...options, expectedStatus });
  assert.ok(payload?.error, `Expected an error payload from ${options.method ?? "GET"} ${path}.`);
  assert.equal(payload.error.code, expectedCode);
  return payload.error;
}

async function loginSession(tenantSlug, email, password) {
  const authPayload = await request("/auth/login", { method: "POST", expectedStatus: 200, body: { tenantSlug, email, password } });
  const accessToken = authPayload.tokens.accessToken;
  assert.ok(accessToken, "Login should return an access token.");
  const currentUserPayload = await request("/auth/me", { accessToken, expectedStatus: 200 });
  return { accessToken, currentUser: currentUserPayload.user, session: currentUserPayload.session };
}

async function queryOne(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0] ?? null;
}

async function createUserWithPermissions(client, { tenantId, email, password, firstName, lastName, roleSlug, roleName, permissionCodes }) {
  const roleResult = await client.query(`INSERT INTO roles (tenant_id, slug, name, description, metadata) VALUES ($1, $2, $3, $4, jsonb_build_object('testRun', $5::text)) RETURNING id`, [tenantId, roleSlug, roleName, `${roleName} for phase 18 testing`, runToken]);
  const roleId = roleResult.rows[0].id;
  await client.query(`INSERT INTO role_permissions (tenant_id, role_id, permission_id, metadata) SELECT $1, $2, permissions.id, jsonb_build_object('testRun', $4::text) FROM permissions WHERE permissions.code = ANY($3::text[]) AND permissions.deleted_at IS NULL`, [tenantId, roleId, permissionCodes, runToken]);
  const displayName = `${firstName} ${lastName}`.trim();
  const userResult = await client.query(`INSERT INTO users (tenant_id, email, normalized_email, first_name, last_name, display_name, password_hash, status, password_changed_at, metadata) VALUES ($1, $2, LOWER($2), $3, $4, $5, crypt($6, gen_salt('bf')), 'active', NOW(), jsonb_build_object('testRun', $7::text)) RETURNING id`, [tenantId, email, firstName, lastName, displayName, password, runToken]);
  const userId = userResult.rows[0].id;
  await client.query(`INSERT INTO user_roles (tenant_id, user_id, role_id, metadata) VALUES ($1, $2, $3, jsonb_build_object('testRun', $4::text))`, [tenantId, userId, roleId, runToken]);
  return { userId, roleId, displayName };
}

async function assertAuditLog(client, { tenantId, actorUserId, sessionId, action, resourceType }) {
  const row = await queryOne(client, `SELECT status FROM audit_logs WHERE tenant_id = $1 AND actor_user_id = $2 AND session_id = $3 AND action = $4 AND resource_type = $5 ORDER BY created_at DESC LIMIT 1`, [tenantId, actorUserId, sessionId, action, resourceType]);
  assert.ok(row, `Audit log ${action} should exist for ${resourceType}.`);
  assert.equal(row.status, "success");
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    log("Checking schema and seed baseline.");
    for (const tableName of ["ai_settings", "ai_usage_logs"]) {
      const table = await queryOne(client, `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`, [tableName]);
      assert.equal(table?.table_name, tableName, `${tableName} should exist for Phase 18.`);
    }
    const tenant = await queryOne(client, `SELECT id FROM tenants WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`, [defaultTenantSlug]);
    assert.ok(tenant, "Default tenant should exist.");
    const tenantId = tenant.id;
    const permissionCount = await queryOne(client, `SELECT COUNT(*)::int AS count FROM permissions WHERE code LIKE 'ai.%' AND deleted_at IS NULL`);
    assert.equal(permissionCount.count, 13, "ai permission catalog should be seeded.");

    log("Logging in with the seeded admin user.");
    const adminSession = await loginSession(defaultTenantSlug, defaultAdminEmail, defaultAdminPassword);

    log("Creating AI user, AI admin, AI viewer, and unrelated viewer users.");
    const aiUserPassword = `Use!${runToken}99`;
    const aiAdminPassword = `Adm!${runToken}99`;
    const aiViewerPassword = `Vie!${runToken}99`;
    const viewerPassword = `Out!${runToken}99`;
    await createUserWithPermissions(client, { tenantId, email: `aiuse-${runToken}@example.test`, password: aiUserPassword, firstName: "Uma", lastName: "User", roleSlug: `aiuse-phase18-${runToken}`, roleName: `AI User Phase18 ${runToken}`, permissionCodes: ["ai.use_ai"] });
    await createUserWithPermissions(client, { tenantId, email: `aiadmin-${runToken}@example.test`, password: aiAdminPassword, firstName: "Ada", lastName: "Admin", roleSlug: `aiadmin-phase18-${runToken}`, roleName: `AI Admin Phase18 ${runToken}`, permissionCodes: ["ai.use_ai", "ai.configure"] });
    await createUserWithPermissions(client, { tenantId, email: `aiview-${runToken}@example.test`, password: aiViewerPassword, firstName: "Vic", lastName: "Viewer", roleSlug: `aiview-phase18-${runToken}`, roleName: `AI Viewer Phase18 ${runToken}`, permissionCodes: ["ai.view"] });
    await createUserWithPermissions(client, { tenantId, email: `outsider18-${runToken}@example.test`, password: viewerPassword, firstName: "Val", lastName: "Outsider", roleSlug: `outsider18-phase18-${runToken}`, roleName: `Outsider Phase18 ${runToken}`, permissionCodes: ["leads.view"] });

    const aiUserSession = await loginSession(defaultTenantSlug, `aiuse-${runToken}@example.test`, aiUserPassword);
    const aiAdminSession = await loginSession(defaultTenantSlug, `aiadmin-${runToken}@example.test`, aiAdminPassword);
    const aiViewerSession = await loginSession(defaultTenantSlug, `aiview-${runToken}@example.test`, aiViewerPassword);
    const outsiderSession = await loginSession(defaultTenantSlug, `outsider18-${runToken}@example.test`, viewerPassword);

    // Normalize the persistent per-tenant settings row to a known baseline so the
    // run is deterministic and idempotent across repeated executions.
    await request("/ai/settings", { method: "PATCH", accessToken: aiAdminSession.accessToken, body: { isEnabled: true, allowUserOverrides: false, defaultProvider: "anthropic", defaultModel: "claude-opus-4-8", rateLimitPerMinute: 60, redactionEnabled: true, loggingEnabled: true } });

    log("Validating settings auto-creation, providers, and templates.");
    const settings = (await request("/ai/settings", { accessToken: aiUserSession.accessToken })).settings;
    assert.equal(settings.isEnabled, true, "AI should be enabled by default.");
    assert.ok(["openai", "anthropic", "azure_openai", "local"].includes(settings.defaultProvider));
    assert.ok(settings.defaultModel.length > 0);
    assert.equal(settings.allowUserOverrides, false, "User overrides should be off by default.");

    const providers = await request("/ai/providers", { accessToken: aiUserSession.accessToken });
    assert.equal(providers.providers.length, 4, "All four providers should be abstracted.");
    assert.equal(providers.providers.filter((p) => p.isDefault).length, 1, "Exactly one provider should be the default.");
    assert.equal(providers.defaultProvider, settings.defaultProvider, "Providers response should echo the tenant default provider.");
    assert.deepEqual(providers.providers.map((p) => p.key).sort(), ["anthropic", "azure_openai", "local", "openai"]);
    assert.ok(providers.providers.every((p) => typeof p.configured === "boolean"), "Each provider should report a configured flag.");
    assert.equal(providers.gatewayEnabled, true, "Gateway should be enabled by default.");

    const templates = await request("/ai/templates", { accessToken: aiUserSession.accessToken });
    assert.ok(templates.templates.some((t) => t.key === "generic_assistant"), "Prompt template registry should include the generic assistant.");
    assert.ok(templates.templates.every((t) => Array.isArray(t.variables)), "Every template should declare variables.");
    const opportunityTemplate = templates.templates.find((t) => t.key === "opportunity_summary");
    assert.ok(opportunityTemplate, "Registry should include the opportunity summary template.");
    assert.equal(opportunityTemplate.category, "sales");
    assert.equal(opportunityTemplate.requestType, "summary");
    assert.deepEqual(opportunityTemplate.variables.sort(), ["account", "amount", "name", "stage"]);

    log("Validating permission guards on settings and execute.");
    await expectError("/ai/settings", { method: "PATCH", accessToken: aiUserSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { isEnabled: false } });
    await expectError("/ai/settings", { method: "PATCH", accessToken: aiViewerSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { isEnabled: false } });
    await expectError("/ai/gateway/execute", { method: "POST", accessToken: aiViewerSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { templateKey: "generic_assistant" } });
    await expectError("/ai/gateway/execute", { method: "POST", accessToken: outsiderSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { templateKey: "generic_assistant" } });
    await expectError("/ai/settings", { accessToken: outsiderSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN" });
    await expectError("/ai/logs", { accessToken: aiUserSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN" });

    log("Executing a prompt template through the gateway (placeholder).");
    const usageBefore = await request("/ai/usage", { accessToken: aiAdminSession.accessToken });
    const exec = await request("/ai/gateway/execute", { method: "POST", accessToken: aiUserSession.accessToken, body: { templateKey: "generic_assistant", variables: { prompt: `Hello ${runToken}` } } });
    assert.equal(exec.status, "placeholder", "Execution should return a governed placeholder status.");
    assert.equal(exec.placeholder, true);
    assert.equal(exec.templateKey, "generic_assistant");
    assert.equal(exec.capability, "generic_assistant");
    assert.equal(exec.provider, settings.defaultProvider, "Execution should use the tenant default provider.");
    assert.equal(exec.model, settings.defaultModel);
    assert.ok(exec.output.toLowerCase().includes("placeholder"), "Placeholder output should be returned.");
    assert.equal(exec.resolvedPrompt, `Hello ${runToken}`, "Variables should be substituted into the prompt.");
    assert.ok(typeof exec.usage.totalTokens === "number", "Usage tokens should be reported.");
    assert.equal(exec.rateLimit.enforced, false, "Rate limit should be a placeholder (not enforced).");
    assert.ok(exec.rateLimit.limitPerMinute > 0, "Rate limit per minute should be reported.");
    assert.equal(exec.governance.deferred, true, "Governance should mark execution as deferred.");
    assert.equal(exec.governance.loggingEnabled, true, "Governance should report logging enabled.");
    assert.equal(exec.governance.redactionEnabled, true, "Governance should report redaction enabled by default.");
    assert.ok(typeof exec.latencyMs === "number", "Latency should be reported.");
    await assertAuditLog(client, { tenantId, actorUserId: aiUserSession.currentUser.id, sessionId: aiUserSession.session.id, action: "ai.gateway.execute", resourceType: "ai_request" });

    log("Validating multi-variable substitution and missing-variable handling.");
    const execMulti = await request("/ai/gateway/execute", { method: "POST", accessToken: aiUserSession.accessToken, body: { templateKey: "opportunity_summary", variables: { name: `Deal ${runToken}`, account: "Acme", stage: "proposal" } } });
    assert.ok(execMulti.resolvedPrompt.includes(`Deal ${runToken}`) && execMulti.resolvedPrompt.includes("Acme") && execMulti.resolvedPrompt.includes("proposal"), "Provided variables should be substituted.");
    assert.ok(execMulti.resolvedPrompt.includes("{{amount}}"), "A missing variable should remain as its placeholder token.");

    log("Validating template-not-found and override-not-allowed errors.");
    await expectError("/ai/gateway/execute", { method: "POST", accessToken: aiUserSession.accessToken, expectedStatus: 400, expectedCode: "AI_TEMPLATE_NOT_FOUND", body: { templateKey: `nope-${runToken}` } });
    await expectError("/ai/gateway/execute", { method: "POST", accessToken: aiUserSession.accessToken, expectedStatus: 403, expectedCode: "AI_OVERRIDE_NOT_ALLOWED", body: { templateKey: "generic_assistant", providerKey: "openai" } });

    log("Enabling user overrides and executing with an explicit provider.");
    const overridesEnabled = (await request("/ai/settings", { method: "PATCH", accessToken: aiAdminSession.accessToken, body: { allowUserOverrides: true } })).settings;
    assert.equal(overridesEnabled.allowUserOverrides, true);
    await assertAuditLog(client, { tenantId, actorUserId: aiAdminSession.currentUser.id, sessionId: aiAdminSession.session.id, action: "ai.settings.update", resourceType: "ai_settings" });
    const execOverride = await request("/ai/gateway/execute", { method: "POST", accessToken: aiUserSession.accessToken, body: { templateKey: "generic_assistant", providerKey: "openai", model: "gpt-test", variables: { prompt: "override" } } });
    assert.equal(execOverride.provider, "openai", "Provider override should be honored when allowed.");
    assert.equal(execOverride.model, "gpt-test", "Model override should be honored when allowed.");

    log("Disabling AI and confirming execution is denied.");
    await request("/ai/settings", { method: "PATCH", accessToken: aiAdminSession.accessToken, body: { isEnabled: false } });
    await expectError("/ai/gateway/execute", { method: "POST", accessToken: aiUserSession.accessToken, expectedStatus: 403, expectedCode: "AI_DISABLED", body: { templateKey: "generic_assistant" } });
    await request("/ai/settings", { method: "PATCH", accessToken: aiAdminSession.accessToken, body: { isEnabled: true, allowUserOverrides: false } });

    log("Validating full settings update and the empty-body guard.");
    const fullUpdate = (await request("/ai/settings", { method: "PATCH", accessToken: aiAdminSession.accessToken, body: { defaultModel: `model-${runToken}`, rateLimitPerMinute: 120, redactionEnabled: false, loggingEnabled: true } })).settings;
    assert.equal(fullUpdate.defaultModel, `model-${runToken}`, "Default model should update.");
    assert.equal(fullUpdate.rateLimitPerMinute, 120, "Rate limit should update.");
    assert.equal(fullUpdate.redactionEnabled, false, "Redaction flag should update.");
    await expectError("/ai/settings", { method: "PATCH", accessToken: aiAdminSession.accessToken, expectedStatus: 400, expectedCode: "VALIDATION_ERROR", body: {} });

    log("Validating that disabling logging suppresses usage logging.");
    await request("/ai/settings", { method: "PATCH", accessToken: aiAdminSession.accessToken, body: { loggingEnabled: false } });
    const usageBeforeUnlogged = await request("/ai/usage", { accessToken: aiAdminSession.accessToken });
    const unlogged = await request("/ai/gateway/execute", { method: "POST", accessToken: aiUserSession.accessToken, body: { templateKey: "generic_assistant", variables: { prompt: "no log" } } });
    assert.equal(unlogged.governance.loggingEnabled, false, "Governance should reflect logging disabled.");
    const usageAfterUnlogged = await request("/ai/usage", { accessToken: aiAdminSession.accessToken });
    assert.equal(usageAfterUnlogged.totalRequests, usageBeforeUnlogged.totalRequests, "Disabling logging should suppress usage logging.");
    await request("/ai/settings", { method: "PATCH", accessToken: aiAdminSession.accessToken, body: { loggingEnabled: true } });

    log("Validating usage logging, log filters, and usage summary deltas.");
    const usageAfter = await request("/ai/usage", { accessToken: aiAdminSession.accessToken });
    assert.ok(usageAfter.totalRequests > usageBefore.totalRequests, "Usage total should increase after gateway calls.");
    assert.ok(usageAfter.placeholderRequests >= 2, "Placeholder requests should be logged.");
    assert.ok(usageAfter.deniedRequests >= 1, "Denied requests should be logged.");
    assert.ok(usageAfter.providerDistribution.some((entry) => entry.provider === "openai"), "Usage should record the openai override request.");
    assert.ok(usageAfter.statusDistribution.some((entry) => entry.status === "placeholder"), "Status distribution should include placeholder.");
    assert.ok(usageAfter.statusDistribution.some((entry) => entry.status === "denied"), "Status distribution should include denied.");
    assert.ok(usageAfter.totalTokens > 0, "Usage should sum estimated tokens.");

    const logs = await request("/ai/logs?pageSize=100&templateKey=generic_assistant", { accessToken: aiAdminSession.accessToken });
    assert.ok(logs.logs.length >= 1, "Logs filtered by template should return entries.");
    assert.ok(logs.logs.every((entry) => entry.templateKey === "generic_assistant"), "Template filter should be applied.");
    const pagedLogs = await request("/ai/logs?pageSize=1&page=1", { accessToken: aiAdminSession.accessToken });
    assert.equal(pagedLogs.logs.length, 1, "Log pagination should cap the page size.");
    assert.ok(pagedLogs.pagination.total >= 1 && pagedLogs.pagination.pageSize === 1, "Log pagination metadata should be reported.");
    const deniedLogs = await request("/ai/logs?status=denied&pageSize=100", { accessToken: aiAdminSession.accessToken });
    assert.ok(deniedLogs.logs.every((entry) => entry.status === "denied") && deniedLogs.logs.length >= 1, "Denied logs should be filterable.");
    const placeholderLogs = await request("/ai/logs?status=placeholder&pageSize=100", { accessToken: aiAdminSession.accessToken });
    assert.ok(placeholderLogs.logs.every((entry) => entry.status === "placeholder"), "Status filter should be applied.");
    const aiViewerLogs = await request("/ai/logs?pageSize=5", { accessToken: aiViewerSession.accessToken });
    assert.ok(Array.isArray(aiViewerLogs.logs), "An ai.view role should read AI logs.");

    log("Checking tenant isolation for AI settings and logs.");
    const secondTenantId = (await client.query(`INSERT INTO tenants (slug, name, status, metadata) VALUES ($1, $2, 'active', jsonb_build_object('testRun', $3::text)) RETURNING id`, [`phase18-${runToken}-tenant`, `Phase 18 Tenant ${runToken}`, runToken])).rows[0].id;
    await client.query(`INSERT INTO ai_settings (tenant_id, is_enabled, default_provider, default_model, rate_limit_per_minute) VALUES ($1, true, 'openai', 'isolated-model', 99)`, [secondTenantId]);
    const isolatedTemplateKey = `isolated-${runToken}`;
    await client.query(`INSERT INTO ai_usage_logs (tenant_id, provider, model, template_key, status) VALUES ($1, 'openai', 'isolated-model', $2, 'placeholder')`, [secondTenantId, isolatedTemplateKey]);
    const ownSettings = (await request("/ai/settings", { accessToken: aiAdminSession.accessToken })).settings;
    assert.notEqual(ownSettings.defaultModel, "isolated-model", "Tenant settings must not leak across tenants.");
    const isolatedLogs = await request(`/ai/logs?templateKey=${isolatedTemplateKey}&pageSize=50`, { accessToken: aiAdminSession.accessToken });
    assert.equal(isolatedLogs.logs.length, 0, "AI logs from another tenant must not be visible.");

    log("Phase 18 AI gateway checks passed.");
  } finally {
    await client.end();
  }
}

await main();
