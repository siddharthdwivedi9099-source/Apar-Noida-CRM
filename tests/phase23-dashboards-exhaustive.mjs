import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

const apiBaseUrl = process.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4000/api/v1";
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://crm:crm@localhost:5433/crm";
const defaultTenantSlug = process.env.DEFAULT_TENANT_SLUG ?? "sample-tenant";
const runToken = randomUUID().replace(/-/g, "").slice(0, 10);

const EXPECTED_DASHBOARDS = ["executive", "sales", "marketing", "campaign", "social", "sdr", "inside_sales", "presales", "partner", "reseller", "support", "customer_success", "onboarding", "customer_health", "training", "revenue", "forecast", "ai_insights"];

function log(message) {
  console.log(`[phase23-exhaustive] ${message}`);
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
  assert.equal(payload.error.code, expectedCode, `Expected ${expectedCode} from ${options.method ?? "GET"} ${path}, received ${payload.error.code}.`);
  return payload.error;
}

async function loginSession(tenantSlug, email, password) {
  const authPayload = await request("/auth/login", { method: "POST", expectedStatus: 200, body: { tenantSlug, email, password } });
  const accessToken = authPayload.tokens.accessToken;
  assert.ok(accessToken, "Login should return an access token.");
  const me = await request("/auth/me", { accessToken, expectedStatus: 200 });
  return { accessToken, currentUser: me.user, session: me.session };
}

async function queryOne(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0] ?? null;
}

async function createUserWithPermissions(client, { tenantId, email, password, firstName, lastName, roleSlug, roleName, permissionCodes }) {
  const roleResult = await client.query(`INSERT INTO roles (tenant_id, slug, name, description, metadata) VALUES ($1, $2, $3, $4, jsonb_build_object('testRun', $5::text)) RETURNING id`, [tenantId, roleSlug, roleName, `${roleName} for phase 23 testing`, runToken]);
  const roleId = roleResult.rows[0].id;
  await client.query(`INSERT INTO role_permissions (tenant_id, role_id, permission_id, metadata) SELECT $1, $2, permissions.id, jsonb_build_object('testRun', $4::text) FROM permissions WHERE permissions.code = ANY($3::text[]) AND permissions.deleted_at IS NULL`, [tenantId, roleId, permissionCodes, runToken]);
  const displayName = `${firstName} ${lastName}`.trim();
  const userResult = await client.query(`INSERT INTO users (tenant_id, email, normalized_email, first_name, last_name, display_name, password_hash, status, password_changed_at, metadata) VALUES ($1, $2, LOWER($2), $3, $4, $5, crypt($6, gen_salt('bf')), 'active', NOW(), jsonb_build_object('testRun', $7::text)) RETURNING id`, [tenantId, email, firstName, lastName, displayName, password, runToken]);
  const userId = userResult.rows[0].id;
  await client.query(`INSERT INTO user_roles (tenant_id, user_id, role_id, metadata) VALUES ($1, $2, $3, jsonb_build_object('testRun', $4::text))`, [tenantId, userId, roleId, runToken]);
  return { userId, roleId, displayName };
}

function widgetByKey(data, key) {
  return data.widgets.find((widget) => widget.key === key);
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    log("Checking schema baseline.");
    const table = await queryOne(client, `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dashboard_saved_views' LIMIT 1`);
    assert.equal(table?.table_name, "dashboard_saved_views", "dashboard_saved_views should exist for Phase 23.");
    const tenant = await queryOne(client, `SELECT id FROM tenants WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`, [defaultTenantSlug]);
    assert.ok(tenant, "Default tenant should exist.");
    const tenantId = tenant.id;

    log("Creating dashboard admin, sales user, and outsider users.");
    const adminPassword = `Adm!${runToken}99`;
    const salesPassword = `Sal!${runToken}99`;
    const outsiderPassword = `Out!${runToken}99`;
    await createUserWithPermissions(client, { tenantId, email: `dashadmin23-${runToken}@example.test`, password: adminPassword, firstName: "Dana", lastName: "Admin", roleSlug: `dashadmin23-${runToken}`, roleName: `Dashboard Admin 23 ${runToken}`, permissionCodes: ["dashboards.view", "dashboards.view_dashboard", "dashboards.export"] });
    await createUserWithPermissions(client, { tenantId, email: `sales23-${runToken}@example.test`, password: salesPassword, firstName: "Sam", lastName: "Sales", roleSlug: `sales23-${runToken}`, roleName: `Sales 23 ${runToken}`, permissionCodes: ["sales.view_dashboard"] });
    await createUserWithPermissions(client, { tenantId, email: `outsider23-${runToken}@example.test`, password: outsiderPassword, firstName: "Val", lastName: "Outsider", roleSlug: `outsider23-${runToken}`, roleName: `Outsider 23 ${runToken}`, permissionCodes: ["contacts.view"] });

    const adminSession = await loginSession(defaultTenantSlug, `dashadmin23-${runToken}@example.test`, adminPassword);
    const salesSession = await loginSession(defaultTenantSlug, `sales23-${runToken}@example.test`, salesPassword);
    const outsiderSession = await loginSession(defaultTenantSlug, `outsider23-${runToken}@example.test`, outsiderPassword);

    log("Seeding a real signal for AI insights (a pending AI action).");
    await client.query(`INSERT INTO ai_action_runs (tenant_id, action_key, module, capability, template_key, review_status, requires_review, status) VALUES ($1, 'lead_summary', 'leads', 'lead_summary', 'lead_summary', 'pending_review', TRUE, 'pending_review')`, [tenantId]);

    // ----------------------------------------------------------------------
    // Catalog + role-based visibility
    // ----------------------------------------------------------------------
    log("Validating the dashboard catalog and role-based visibility.");
    const catalog = await request("/dashboards", { accessToken: adminSession.accessToken });
    assert.equal(catalog.dashboards.length, EXPECTED_DASHBOARDS.length, "All eighteen dashboards should be present.");
    for (const key of EXPECTED_DASHBOARDS) {
      assert.ok(catalog.dashboards.some((d) => d.key === key), `Dashboard ${key} should be in the catalog.`);
    }
    assert.ok(catalog.dashboards.find((d) => d.key === "customer_success"), "The customer success dashboard should exist.");
    assert.ok(catalog.dashboards.find((d) => d.key === "ai_insights"), "The AI insights dashboard should exist.");
    assert.ok(catalog.dashboards.every((d) => d.permitted === true), "A dashboards.view admin should see every dashboard.");

    const salesCatalog = await request("/dashboards", { accessToken: salesSession.accessToken });
    assert.equal(salesCatalog.dashboards.find((d) => d.key === "sales").permitted, true, "A sales user should see the sales dashboard.");
    assert.equal(salesCatalog.dashboards.find((d) => d.key === "support").permitted, false, "A sales user should not see the support dashboard.");
    const outsiderCatalog = await request("/dashboards", { accessToken: outsiderSession.accessToken });
    assert.ok(outsiderCatalog.dashboards.every((d) => d.permitted === false), "An unrelated user should see no dashboards.");

    // ----------------------------------------------------------------------
    // Dashboard data — real CRM metrics
    // ----------------------------------------------------------------------
    log("Validating the sales dashboard widgets compute real metrics.");
    const sales = await request("/dashboards/sales", { accessToken: salesSession.accessToken });
    assert.equal(sales.widgets.length, 5, "The sales dashboard should have five widgets.");
    assert.equal(widgetByKey(sales, "leads_by_status").kind, "breakdown", "Leads by status is a breakdown.");
    assert.ok(Array.isArray(widgetByKey(sales, "leads_by_status").breakdown), "Breakdown data should be present.");
    assert.equal(widgetByKey(sales, "opportunities_by_stage").kind, "funnel", "Opportunities by stage is a funnel.");
    const pipeline = widgetByKey(sales, "pipeline_value");
    assert.equal(pipeline.kind, "scalar");
    assert.ok(typeof pipeline.value === "number", "Pipeline value should be a computed number.");
    const winRate = widgetByKey(sales, "win_rate");
    assert.ok(typeof winRate.value === "number" && winRate.value >= 0 && winRate.value <= 100, "Win rate should be a 0-100 percentage.");
    assert.equal(winRate.unit, "%");

    log("Validating the customer success and AI insights dashboards.");
    const cs = await request("/dashboards/customer_success", { accessToken: adminSession.accessToken });
    assert.ok(widgetByKey(cs, "health"), "Customer success dashboard should include health distribution.");
    assert.equal(widgetByKey(cs, "renewal_timeline").kind, "series", "Renewal timeline is a series.");
    assert.equal(widgetByKey(cs, "at_risk").kind, "scalar");

    const ai = await request("/dashboards/ai_insights", { accessToken: adminSession.accessToken });
    assert.ok(widgetByKey(ai, "customer_risk_summary"), "AI insights should include a customer risk table.");
    assert.equal(widgetByKey(ai, "customer_risk_summary").kind, "table");
    const recommended = widgetByKey(ai, "recommended_actions");
    assert.ok(recommended.value >= 1, "Recommended actions should reflect the real pending AI action.");
    assert.ok(recommended.breakdown.some((entry) => entry.label === "leads"), "Recommended actions should attribute the pending action to its module (real data).");
    for (const key of ["risk_alerts", "recommended_actions", "underperforming_areas", "customer_risk_summary", "deal_risk_summary"]) {
      assert.ok(widgetByKey(ai, key), `AI insights should include the ${key} widget.`);
    }
    assert.equal(widgetByKey(ai, "deal_risk_summary").kind, "table", "Deal risk summary is a table.");

    log("Validating kanban summaries and placeholder metrics.");
    const support = await request("/dashboards/support", { accessToken: adminSession.accessToken });
    const kanban = widgetByKey(support, "ticket_status");
    assert.ok(kanban, "The support dashboard should include a kanban ticket summary.");
    assert.equal(kanban.type, "kanban", "The ticket summary should be a kanban widget.");
    assert.ok(Array.isArray(kanban.breakdown), "Kanban summary should carry breakdown columns.");
    assert.ok(widgetByKey(support, "sla_breaches") && widgetByKey(support, "ticket_priority") && widgetByKey(support, "ticket_category"), "Support should include SLA, priority, and category widgets.");
    const csat = widgetByKey(support, "csat");
    assert.equal(csat.value, null, "CSAT is a deferred placeholder.");
    assert.ok(csat.note, "The CSAT placeholder should carry an explanatory note.");

    const sdr = await request("/dashboards/sdr", { accessToken: adminSession.accessToken });
    assert.equal(widgetByKey(sdr, "leads_kanban").type, "kanban", "The SDR dashboard should include a leads kanban.");

    const marketing = await request("/dashboards/marketing", { accessToken: adminSession.accessToken });
    for (const key of ["campaign_count", "campaign_members", "lead_source", "campaign_conversion"]) {
      assert.ok(widgetByKey(marketing, key), `Marketing should include the ${key} widget.`);
    }
    assert.equal(typeof widgetByKey(marketing, "campaign_count").value, "number", "Campaign count should be computed from real data.");
    const conversion = widgetByKey(marketing, "campaign_conversion");
    assert.equal(conversion.value, null, "Campaign conversion is a deferred placeholder.");
    assert.ok(conversion.note, "The campaign conversion placeholder should carry a note.");

    log("Validating date filters and dashboard permission enforcement.");
    await request("/dashboards/sales?from=2020-01-01&to=2020-12-31", { accessToken: salesSession.accessToken });
    await expectError("/dashboards/sales?from=bad-date", { accessToken: salesSession.accessToken, expectedStatus: 400, expectedCode: "VALIDATION_ERROR" });
    await expectError("/dashboards/support", { accessToken: salesSession.accessToken, expectedStatus: 403, expectedCode: "AUTHORIZATION_ERROR" });
    await expectError("/dashboards/sales", { accessToken: outsiderSession.accessToken, expectedStatus: 403, expectedCode: "AUTHORIZATION_ERROR" });
    await expectError(`/dashboards/nope-${runToken}`, { accessToken: adminSession.accessToken, expectedStatus: 404, expectedCode: "DASHBOARD_NOT_FOUND" });

    // ----------------------------------------------------------------------
    // Drill-down
    // ----------------------------------------------------------------------
    log("Validating widget drill-down.");
    const drill = await request("/dashboards/sales/widgets/leads_by_status/drilldown", { accessToken: salesSession.accessToken });
    assert.ok(Array.isArray(drill.rows), "Drill-down should return rows.");
    assert.equal(drill.total, drill.rows.length);
    await expectError("/dashboards/sales/widgets/win_rate/drilldown", { accessToken: salesSession.accessToken, expectedStatus: 400, expectedCode: "DASHBOARD_DRILLDOWN_UNSUPPORTED" });
    await expectError(`/dashboards/sales/widgets/nope-${runToken}/drilldown`, { accessToken: salesSession.accessToken, expectedStatus: 404, expectedCode: "DASHBOARD_WIDGET_NOT_FOUND" });

    // ----------------------------------------------------------------------
    // Export (permission check)
    // ----------------------------------------------------------------------
    log("Validating export and its permission check.");
    const exportData = await request("/dashboards/sales/export", { accessToken: adminSession.accessToken });
    assert.equal(exportData.dashboardKey, "sales");
    assert.equal(exportData.rows.length, 5, "Export should include a row per widget.");
    const auditRow = await queryOne(client, `SELECT status FROM audit_logs WHERE tenant_id = $1 AND action = 'dashboard.export' AND resource_type = 'dashboard' ORDER BY created_at DESC LIMIT 1`, [tenantId]);
    assert.ok(auditRow, "Export should be audited.");
    await expectError("/dashboards/sales/export", { accessToken: salesSession.accessToken, expectedStatus: 403, expectedCode: "AUTHORIZATION_ERROR" });

    // ----------------------------------------------------------------------
    // Saved views
    // ----------------------------------------------------------------------
    log("Validating saved views.");
    const created = (await request("/dashboards/sales/views", { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { name: `Q1 ${runToken}`, config: { from: "2026-01-01", to: "2026-03-31" } } })).view;
    assert.equal(created.name, `Q1 ${runToken}`);
    assert.equal(created.dashboardKey, "sales");
    assert.equal(created.config.from, "2026-01-01", "Saved view config (widget configuration) should persist.");
    assert.equal(created.config.to, "2026-03-31");
    const ownViews = await request("/dashboards/sales/views", { accessToken: adminSession.accessToken });
    assert.ok(ownViews.views.some((v) => v.id === created.id), "Saved views should be listed for the owner.");
    const updated = (await request(`/dashboards/saved-views/${created.id}`, { method: "PATCH", accessToken: adminSession.accessToken, body: { name: `Q1 updated ${runToken}`, isShared: true } })).view;
    assert.equal(updated.name, `Q1 updated ${runToken}`);
    assert.equal(updated.isShared, true);

    log("Validating shared-view visibility and owner-only mutation.");
    const salesViews = await request("/dashboards/sales/views", { accessToken: salesSession.accessToken });
    assert.ok(salesViews.views.some((v) => v.id === created.id), "Shared views should be visible to other users.");
    await expectError(`/dashboards/saved-views/${created.id}`, { method: "PATCH", accessToken: salesSession.accessToken, expectedStatus: 403, expectedCode: "AUTHORIZATION_ERROR", body: { name: "hijack" } });
    await expectError(`/dashboards/saved-views/${created.id}`, { method: "PATCH", accessToken: adminSession.accessToken, expectedStatus: 400, expectedCode: "VALIDATION_ERROR", body: {} });
    await expectError(`/dashboards/saved-views/${randomUUID()}`, { method: "PATCH", accessToken: adminSession.accessToken, expectedStatus: 404, expectedCode: "DASHBOARD_VIEW_NOT_FOUND", body: { name: "x" } });

    const deleteResult = await request(`/dashboards/saved-views/${created.id}`, { method: "DELETE", accessToken: adminSession.accessToken });
    assert.equal(deleteResult.deleted, true, "Owners can delete their saved views.");
    const afterDelete = await request("/dashboards/sales/views", { accessToken: adminSession.accessToken });
    assert.ok(!afterDelete.views.some((v) => v.id === created.id), "Deleted views should no longer be listed.");

    // ----------------------------------------------------------------------
    // Tenant isolation
    // ----------------------------------------------------------------------
    log("Checking tenant isolation for saved views.");
    const secondTenantId = (await client.query(`INSERT INTO tenants (slug, name, status, metadata) VALUES ($1, $2, 'active', jsonb_build_object('testRun', $3::text)) RETURNING id`, [`phase23-${runToken}-tenant`, `Phase 23 Tenant ${runToken}`, runToken])).rows[0].id;
    const otherViewId = (await client.query(`INSERT INTO dashboard_saved_views (tenant_id, dashboard_key, owner_user_id, name, is_shared) VALUES ($1, 'sales', $2, 'Isolated', TRUE) RETURNING id`, [secondTenantId, randomUUID()])).rows[0].id;
    const isolationViews = await request("/dashboards/sales/views", { accessToken: adminSession.accessToken });
    assert.ok(isolationViews.views.every((v) => v.id !== otherViewId), "Another tenant's saved views must not be visible.");
    await expectError(`/dashboards/saved-views/${otherViewId}`, { method: "PATCH", accessToken: adminSession.accessToken, expectedStatus: 404, expectedCode: "DASHBOARD_VIEW_NOT_FOUND", body: { name: "x" } });

    log("Phase 23 dashboards checks passed.");
  } finally {
    await client.end();
  }
}

await main();
