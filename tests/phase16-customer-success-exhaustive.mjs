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

const csOptionSetKeys = ["cs-segment", "cs-risk-status", "cs-expansion-potential", "cs-renewal-status"];
const csTables = ["customer_success_accounts", "onboarding_plans", "onboarding_milestones", "success_plans", "customer_health_scores", "adoption_metrics", "qbrs", "renewals", "escalations"];

function log(message) {
  console.log(`[phase16-exhaustive] ${message}`);
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

async function assertSchemaFoundation(client) {
  for (const tableName of csTables) {
    const table = await queryOne(client, `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`, [tableName]);
    assert.equal(table?.table_name, tableName, `${tableName} should exist for Phase 16.`);
  }
}

async function assertSeedBaseline(client) {
  const tenant = await queryOne(client, `SELECT id, status FROM tenants WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`, [defaultTenantSlug]);
  assert.ok(tenant, "Default tenant should exist.");
  const optionSetCount = await queryOne(client, `SELECT COUNT(*)::int AS count FROM tenant_option_sets WHERE tenant_id = $1 AND deleted_at IS NULL AND set_key = ANY($2::text[])`, [tenant.id, csOptionSetKeys]);
  assert.equal(optionSetCount.count, csOptionSetKeys.length, "Phase 16 option sets should be seeded.");
  const permissionCount = await queryOne(client, `SELECT COUNT(*)::int AS count FROM permissions WHERE code LIKE 'customer_success.%' AND deleted_at IS NULL`);
  assert.equal(permissionCount.count, 13, "customer_success permission catalog should be seeded.");
  return { tenantId: tenant.id };
}

async function createUserWithPermissions(client, { tenantId, email, password, firstName, lastName, roleSlug, roleName, permissionCodes }) {
  const roleResult = await client.query(`INSERT INTO roles (tenant_id, slug, name, description, metadata) VALUES ($1, $2, $3, $4, jsonb_build_object('testRun', $5::text)) RETURNING id`, [tenantId, roleSlug, roleName, `${roleName} for phase 16 testing`, runToken]);
  const roleId = roleResult.rows[0].id;
  await client.query(`INSERT INTO role_permissions (tenant_id, role_id, permission_id, metadata) SELECT $1, $2, permissions.id, jsonb_build_object('testRun', $4::text) FROM permissions WHERE permissions.code = ANY($3::text[]) AND permissions.deleted_at IS NULL`, [tenantId, roleId, permissionCodes, runToken]);
  const displayName = `${firstName} ${lastName}`.trim();
  const userResult = await client.query(`INSERT INTO users (tenant_id, email, normalized_email, first_name, last_name, display_name, password_hash, status, password_changed_at, metadata) VALUES ($1, $2, LOWER($2), $3, $4, $5, crypt($6, gen_salt('bf')), 'active', NOW(), jsonb_build_object('testRun', $7::text)) RETURNING id`, [tenantId, email, firstName, lastName, displayName, password, runToken]);
  const userId = userResult.rows[0].id;
  await client.query(`INSERT INTO user_roles (tenant_id, user_id, role_id, metadata) VALUES ($1, $2, $3, jsonb_build_object('testRun', $4::text))`, [tenantId, userId, roleId, runToken]);
  return { userId, roleId, displayName };
}

async function getOptionValueId(client, tenantId, setKey, valueKey) {
  const row = await queryOne(client, `SELECT tenant_option_values.id FROM tenant_option_sets INNER JOIN tenant_option_values ON tenant_option_values.option_set_id = tenant_option_sets.id AND tenant_option_values.tenant_id = tenant_option_sets.tenant_id WHERE tenant_option_sets.tenant_id = $1 AND tenant_option_sets.set_key = $2 AND tenant_option_values.value_key = $3 AND tenant_option_sets.deleted_at IS NULL AND tenant_option_values.deleted_at IS NULL LIMIT 1`, [tenantId, setKey, valueKey]);
  return row?.id ?? null;
}

async function cloneOptionSet(client, sourceTenantId, targetTenantId, setKey) {
  const setResult = await client.query(`WITH source_set AS (SELECT * FROM tenant_option_sets WHERE tenant_id = $1 AND set_key = $2 AND deleted_at IS NULL LIMIT 1) INSERT INTO tenant_option_sets (tenant_id, set_key, module_key, kind, name, description, is_system_set, metadata) SELECT $3, source_set.set_key, source_set.module_key, source_set.kind, source_set.name, source_set.description, source_set.is_system_set, source_set.metadata || jsonb_build_object('clonedFor', $4::text) FROM source_set RETURNING id`, [sourceTenantId, setKey, targetTenantId, runToken]);
  const targetSetId = setResult.rows[0].id;
  await client.query(`INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, description, color, sort_order, is_default, is_active, metadata) SELECT $3, $4, v.value_key, v.label, v.description, v.color, v.sort_order, v.is_default, v.is_active, v.metadata || jsonb_build_object('clonedFor', $5::text) FROM tenant_option_sets s INNER JOIN tenant_option_values v ON v.option_set_id = s.id AND v.tenant_id = s.tenant_id WHERE s.tenant_id = $1 AND s.set_key = $2 AND s.deleted_at IS NULL AND v.deleted_at IS NULL`, [sourceTenantId, setKey, targetTenantId, targetSetId, runToken]);
}

async function assertAuditLog(client, { tenantId, actorUserId, sessionId, action, resourceType, resourceId }) {
  const row = await queryOne(client, `SELECT status FROM audit_logs WHERE tenant_id = $1 AND actor_user_id = $2 AND session_id = $3 AND action = $4 AND resource_type = $5 AND resource_id = $6 ORDER BY created_at DESC LIMIT 1`, [tenantId, actorUserId, sessionId, action, resourceType, resourceId]);
  assert.ok(row, `Audit log ${action} should exist for ${resourceType} ${resourceId}.`);
  assert.equal(row.status, "success");
}

function inDays(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function createCsAccount(accessToken, body) {
  const response = await request("/customer-success/accounts", { method: "POST", accessToken, expectedStatus: 201, body });
  return response.customerSuccessAccount;
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    log("Checking schema and seed baseline.");
    await assertSchemaFoundation(client);
    const { tenantId } = await assertSeedBaseline(client);

    log("Logging in with the seeded admin user.");
    const adminSession = await loginSession(defaultTenantSlug, defaultAdminEmail, defaultAdminPassword);

    log("Creating CSM, view-only, and unrelated viewer users.");
    const csmPassword = `Csm!${runToken}99`;
    const readPassword = `Read!${runToken}99`;
    const viewerPassword = `View!${runToken}99`;
    const csmUser = await createUserWithPermissions(client, { tenantId, email: `csm-${runToken}@example.test`, password: csmPassword, firstName: "Cleo", lastName: "Success", roleSlug: `csm-phase16-${runToken}`, roleName: `CSM Phase16 ${runToken}`, permissionCodes: ["customer_success.view", "customer_success.create", "customer_success.edit", "ai.use_ai"] });
    await createUserWithPermissions(client, { tenantId, email: `csread-${runToken}@example.test`, password: readPassword, firstName: "Cody", lastName: "ReadOnly", roleSlug: `csread-phase16-${runToken}`, roleName: `CS Read Phase16 ${runToken}`, permissionCodes: ["customer_success.view"] });
    const viewerUser = await createUserWithPermissions(client, { tenantId, email: `viewer16-${runToken}@example.test`, password: viewerPassword, firstName: "Val", lastName: "Outsider", roleSlug: `viewer16-phase16-${runToken}`, roleName: `Viewer Phase16 ${runToken}`, permissionCodes: ["leads.view"] });

    const csmSession = await loginSession(defaultTenantSlug, `csm-${runToken}@example.test`, csmPassword);
    const readSession = await loginSession(defaultTenantSlug, `csread-${runToken}@example.test`, readPassword);
    const viewerSession = await loginSession(defaultTenantSlug, `viewer16-${runToken}@example.test`, viewerPassword);

    log("Creating supporting accounts.");
    const account1 = (await request("/accounts", { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { name: `CS Onboarding ${runToken}`, website: "https://cs1.example.test", industry: "Technology" } })).account;
    const account2 = (await request("/accounts", { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { name: `CS Scaled ${runToken}`, industry: "Technology" } })).account;
    const account3 = (await request("/accounts", { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { name: `CS Enterprise ${runToken}`, industry: "Technology" } })).account;

    log("Validating options and permission/validation guards.");
    const options = await request("/customer-success/options", { accessToken: csmSession.accessToken });
    assert.ok(options.segments.some((entry) => entry.key === "enterprise"));
    assert.ok(options.riskStatuses.some((entry) => entry.key === "critical"));
    assert.ok(options.expansionPotentials.some((entry) => entry.key === "high"));
    assert.ok(options.renewalStatuses.some((entry) => entry.key === "renewed"));

    await expectError("/customer-success/accounts", { method: "POST", accessToken: viewerSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { accountId: account1.id } });
    await expectError("/customer-success/accounts", { method: "POST", accessToken: readSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { accountId: account1.id } });
    await expectError("/customer-success/accounts", { method: "POST", accessToken: csmSession.accessToken, expectedStatus: 400, expectedCode: "INVALID_OPTION_VALUE", body: { accountId: account1.id, segmentKey: "nonexistent" } });
    await expectError("/customer-success/accounts", { method: "POST", accessToken: csmSession.accessToken, expectedStatus: 400, expectedCode: "INVALID_ACCOUNT", body: { accountId: randomUUID() } });

    log("Creating customer success accounts across all three segments.");
    const onboardingAccount = await createCsAccount(csmSession.accessToken, { accountId: account1.id, csmOwnerId: csmUser.userId, segmentKey: "onboarding", lifecycleStageKey: "onboarding", riskStatusKey: "healthy", expansionPotentialKey: "low", contractValue: 50000, adoptionScore: 40 });
    const scaledAccount = await createCsAccount(csmSession.accessToken, { accountId: account2.id, csmOwnerId: csmUser.userId, segmentKey: "scaled", lifecycleStageKey: "adoption", riskStatusKey: "watch", expansionPotentialKey: "medium", contractValue: 30000 });
    const enterpriseAccount = await createCsAccount(csmSession.accessToken, { accountId: account3.id, csmOwnerId: csmUser.userId, segmentKey: "enterprise", lifecycleStageKey: "value_realization", riskStatusKey: "healthy", expansionPotentialKey: "high", contractValue: 250000 });
    const csAccountId = onboardingAccount.id;
    assert.equal(onboardingAccount.segment?.key, "onboarding");
    assert.equal(onboardingAccount.lifecycleStage?.key, "onboarding");
    assert.equal(onboardingAccount.riskStatus?.key, "healthy");
    assert.equal(onboardingAccount.expansionPotential?.key, "low");
    assert.equal(onboardingAccount.account?.id, account1.id, "CS account should link to the CRM account.");
    assert.equal(onboardingAccount.csmOwner?.id, csmUser.userId, "CS account should resolve its CSM owner.");
    assert.equal(onboardingAccount.contractValue, 50000);
    assert.equal(onboardingAccount.adoptionScore, 40);
    assert.equal(onboardingAccount.supportTrend, "stable", "Support trend should default to stable.");
    assert.equal(onboardingAccount.trainingStatus, "not_started", "Training status should default to not_started.");
    assert.deepEqual(onboardingAccount.aiPlaceholders.actions.map((a) => a.key).sort(), ["adoption_recommendation", "churn_risk_prediction", "customer_health_summary", "customer_success_email_draft", "executive_account_brief", "onboarding_plan_generator", "qbr_ebr_summary", "renewal_strategy_recommendation"], "CS AI placeholders should expose the full Phase 16 action set.");
    assert.equal(onboardingAccount.lowTouchCampaignsPlaceholder.available, false);
    assert.equal(onboardingAccount.automatedCheckInPlaceholder.available, false);

    await assertAuditLog(client, { tenantId, actorUserId: csmSession.currentUser.id, sessionId: csmSession.session.id, action: "customer_success.account.create", resourceType: "customer_success_account", resourceId: csAccountId });

    log("Validating list filters, detail, and update with ownership guard.");
    const list = await request("/customer-success/accounts?pageSize=100", { accessToken: csmSession.accessToken });
    assert.ok(list.customerSuccessAccounts.some((entry) => entry.id === csAccountId), "CS account list should include the created account.");
    const segmentFiltered = await request("/customer-success/accounts?segment=enterprise&riskStatus=healthy", { accessToken: csmSession.accessToken });
    assert.ok(segmentFiltered.customerSuccessAccounts.some((entry) => entry.id === enterpriseAccount.id), "Segment filter should match the enterprise account.");
    const ownerFiltered = await request(`/customer-success/accounts?csmOwnerId=${csmUser.userId}&sortBy=account&sortOrder=asc`, { accessToken: csmSession.accessToken });
    assert.ok(ownerFiltered.customerSuccessAccounts.length >= 3, "Owner filter should match all CSM accounts.");

    const touchpoint = new Date().toISOString();
    const updated = await request(`/customer-success/accounts/${csAccountId}`, { method: "PATCH", accessToken: csmSession.accessToken, body: { adoptionScore: 65, supportTrend: "improving", trainingStatus: "in_progress", nextAction: "Schedule kickoff", renewalDate: inDays(60), lastTouchpointAt: touchpoint, expansionPotentialKey: "medium" } });
    assert.equal(updated.customerSuccessAccount.adoptionScore, 65);
    assert.equal(updated.customerSuccessAccount.supportTrend, "improving");
    assert.equal(updated.customerSuccessAccount.trainingStatus, "in_progress");
    assert.equal(updated.customerSuccessAccount.nextAction, "Schedule kickoff");
    assert.equal(updated.customerSuccessAccount.renewalDate, inDays(60), "Account renewal date should be retained.");
    assert.equal(updated.customerSuccessAccount.expansionPotential?.key, "medium", "Expansion potential should update.");
    assert.ok(updated.customerSuccessAccount.lastTouchpointAt, "Last touchpoint should be retained.");

    const lifecycleFiltered = await request("/customer-success/accounts?lifecycleStage=onboarding", { accessToken: csmSession.accessToken });
    assert.ok(lifecycleFiltered.customerSuccessAccounts.some((entry) => entry.id === csAccountId), "Lifecycle filter should match.");

    await expectError(`/customer-success/accounts/${csAccountId}`, { method: "PATCH", accessToken: csmSession.accessToken, expectedStatus: 403, expectedCode: "AUTHORIZATION_ERROR", body: { csmOwnerId: viewerUser.userId } });
    await expectError(`/customer-success/accounts/${randomUUID()}`, { accessToken: csmSession.accessToken, expectedStatus: 404, expectedCode: "CS_ACCOUNT_NOT_FOUND" });

    log("Upserting the onboarding plan with a milestone checklist.");
    const firstValue = new Date().toISOString();
    const withPlan = await request(`/customer-success/accounts/${csAccountId}/onboarding-plan`, { method: "PUT", accessToken: csmSession.accessToken, body: { name: `Onboarding ${runToken}`, status: "in_progress", targetGoLiveDate: inDays(30), productActivationStatus: "in_progress", trainingCompletion: 50, firstValueAt: firstValue, riskNotes: "Integration risk", handoverNotes: "Pending CSM handover", milestones: [{ label: "Kickoff", status: "completed" }, { label: "Data import", status: "in_progress", dueDate: inDays(10) }, { label: "Go live" }] } });
    const plan = withPlan.customerSuccessAccount.onboardingPlans[0];
    assert.equal(withPlan.customerSuccessAccount.onboardingPlans.length, 1);
    assert.equal(plan.milestoneCount, 3);
    assert.equal(plan.completedMilestoneCount, 1);
    assert.equal(plan.productActivationStatus, "in_progress");
    assert.equal(plan.trainingCompletion, 50, "Training completion should be retained.");
    assert.ok(plan.firstValueAt, "First-value timestamp should be retained.");
    assert.equal(plan.riskNotes, "Integration risk", "Onboarding risk capture should be retained.");
    assert.equal(plan.handoverNotes, "Pending CSM handover", "Handover notes should be retained.");
    assert.equal(plan.targetGoLiveDate, inDays(30), "Target go-live date should be retained.");
    const dataImportMilestone = plan.milestones.find((milestone) => milestone.label === "Data import");
    assert.equal(dataImportMilestone?.dueDate, inDays(10), "Milestone due date should be retained.");
    // Upsert again should replace, not duplicate.
    const replan = await request(`/customer-success/accounts/${csAccountId}/onboarding-plan`, { method: "PUT", accessToken: csmSession.accessToken, body: { name: `Onboarding v2 ${runToken}`, status: "completed", milestones: [{ label: "Kickoff", status: "completed" }] } });
    assert.equal(replan.customerSuccessAccount.onboardingPlans.length, 1, "Onboarding plan upsert should not duplicate plans.");
    assert.equal(replan.customerSuccessAccount.onboardingPlans[0].milestoneCount, 1);

    log("Recording health scores and verifying the denormalized account score.");
    const health1 = await request(`/customer-success/accounts/${csAccountId}/health-scores`, { method: "POST", accessToken: csmSession.accessToken, expectedStatus: 201, body: { score: 72, drivers: "Strong adoption" } });
    assert.equal(health1.customerSuccessAccount.healthScore, 72, "Recording a health score should update the account score.");
    const health2 = await request(`/customer-success/accounts/${csAccountId}/health-scores`, { method: "POST", accessToken: csmSession.accessToken, expectedStatus: 201, body: { score: 45, riskStatusKey: "at_risk", drivers: "Support spike" } });
    assert.equal(health2.customerSuccessAccount.healthScore, 45);
    assert.equal(health2.customerSuccessAccount.riskStatus?.key, "at_risk", "Recording a health score with risk should update account risk.");
    assert.equal(health2.customerSuccessAccount.healthScores.length, 2);
    await assertAuditLog(client, { tenantId, actorUserId: csmSession.currentUser.id, sessionId: csmSession.session.id, action: "customer_success.health_score.record", resourceType: "customer_success_account", resourceId: csAccountId });

    await expectError(`/customer-success/accounts/${csAccountId}/health-scores`, { method: "POST", accessToken: readSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { score: 10 } });

    log("Adding an adoption metric.");
    const withMetric = await request(`/customer-success/accounts/${csAccountId}/adoption-metrics`, { method: "POST", accessToken: csmSession.accessToken, expectedStatus: 201, body: { metricKey: "active_users", label: "Active Users", value: 120, target: 200, unit: "users", trend: "up", periodEnd: inDays(0) } });
    const metric = withMetric.customerSuccessAccount.adoptionMetrics[0];
    assert.equal(withMetric.customerSuccessAccount.adoptionMetrics.length, 1);
    assert.equal(metric.value, 120);
    assert.equal(metric.target, 200, "Adoption metric target should be retained.");
    assert.equal(metric.unit, "users", "Adoption metric unit should be retained.");
    assert.equal(metric.trend, "up");
    assert.equal(metric.periodEnd, inDays(0), "Adoption metric period end should be retained.");

    log("Creating and updating a QBR/EBR.");
    const withQbr = await request(`/customer-success/accounts/${csAccountId}/qbrs`, { method: "POST", accessToken: csmSession.accessToken, expectedStatus: 201, body: { title: `Q1 EBR ${runToken}`, qbrType: "ebr", scheduledAt: new Date().toISOString(), summary: "Executive review" } });
    assert.equal(withQbr.customerSuccessAccount.qbrs.length, 1);
    assert.equal(withQbr.customerSuccessAccount.qbrs[0].qbrType, "ebr");
    const qbrId = withQbr.customerSuccessAccount.qbrs[0].id;
    const qbrUpdated = await request(`/customer-success/accounts/${csAccountId}/qbrs/${qbrId}`, { method: "PATCH", accessToken: csmSession.accessToken, body: { status: "completed", outcomes: "Expansion agreed" } });
    assert.equal(qbrUpdated.customerSuccessAccount.qbrs[0].status, "completed");
    assert.equal(qbrUpdated.customerSuccessAccount.qbrs[0].outcomes, "Expansion agreed");
    await expectError(`/customer-success/accounts/${csAccountId}/qbrs/${randomUUID()}`, { method: "PATCH", accessToken: csmSession.accessToken, expectedStatus: 404, expectedCode: "QBR_NOT_FOUND", body: { status: "cancelled" } });

    log("Creating and updating a renewal.");
    const withRenewal = await request(`/customer-success/accounts/${csAccountId}/renewals`, { method: "POST", accessToken: csmSession.accessToken, expectedStatus: 201, body: { renewalDate: inDays(60), statusKey: "forecasted", contractValue: 50000, forecastValue: 55000, probability: 70 } });
    assert.equal(withRenewal.customerSuccessAccount.renewals.length, 1);
    assert.equal(withRenewal.customerSuccessAccount.renewals[0].status?.key, "forecasted");
    assert.equal(withRenewal.customerSuccessAccount.renewals[0].forecastValue, 55000);
    const renewalId = withRenewal.customerSuccessAccount.renewals[0].id;
    const renewalUpdated = await request(`/customer-success/accounts/${csAccountId}/renewals/${renewalId}`, { method: "PATCH", accessToken: csmSession.accessToken, body: { statusKey: "committed", probability: 90 } });
    assert.equal(renewalUpdated.customerSuccessAccount.renewals[0].status?.key, "committed");
    assert.equal(renewalUpdated.customerSuccessAccount.renewals[0].probability, 90);

    log("Creating and resolving an escalation.");
    const withEscalation = await request(`/customer-success/accounts/${csAccountId}/escalations`, { method: "POST", accessToken: csmSession.accessToken, expectedStatus: 201, body: { title: `Outage ${runToken}`, severity: "high", description: "Customer impacted" } });
    assert.equal(withEscalation.customerSuccessAccount.escalations.length, 1);
    assert.equal(withEscalation.customerSuccessAccount.escalations[0].status, "open");
    assert.equal(withEscalation.customerSuccessAccount.openEscalationCount, 1);
    const escalationId = withEscalation.customerSuccessAccount.escalations[0].id;
    const escalationResolved = await request(`/customer-success/accounts/${csAccountId}/escalations/${escalationId}`, { method: "PATCH", accessToken: csmSession.accessToken, body: { status: "resolved", resolution: "Service restored" } });
    assert.equal(escalationResolved.customerSuccessAccount.escalations[0].status, "resolved");
    assert.ok(escalationResolved.customerSuccessAccount.escalations[0].resolvedAt, "Resolving an escalation should set resolvedAt.");
    assert.equal(escalationResolved.customerSuccessAccount.openEscalationCount, 0, "Open escalation count should drop after resolution.");

    log("Upserting a success plan with a stakeholder map.");
    const withSuccessPlan = await request(`/customer-success/accounts/${enterpriseAccount.id}/success-plan`, { method: "PUT", accessToken: csmSession.accessToken, body: { name: `Strategic Plan ${runToken}`, status: "active", objective: "Drive value", valueRealization: "ROI achieved", executiveSponsor: "CIO", expansionOpportunities: "New BU", renewalStrategy: "Multi-year", stakeholders: [{ name: "Jane Exec", title: "CIO", role: "champion", sentiment: "positive" }, { name: "Tom Ops", title: "Director", role: "user" }] } });
    const successPlan = withSuccessPlan.customerSuccessAccount.successPlans[0];
    assert.equal(withSuccessPlan.customerSuccessAccount.successPlans.length, 1);
    assert.equal(successPlan.stakeholders.length, 2);
    assert.equal(successPlan.status, "active");
    assert.equal(successPlan.objective, "Drive value", "Success plan objective should be retained.");
    assert.equal(successPlan.valueRealization, "ROI achieved", "Value realization should be retained.");
    assert.equal(successPlan.executiveSponsor, "CIO", "Executive sponsor should be retained.");
    assert.equal(successPlan.expansionOpportunities, "New BU", "Expansion opportunities should be retained.");
    assert.equal(successPlan.renewalStrategy, "Multi-year", "Renewal strategy should be retained.");
    const champion = successPlan.stakeholders.find((entry) => entry.role === "champion");
    assert.ok(champion, "Stakeholder map should retain the champion.");
    assert.equal(champion.title, "CIO");
    assert.equal(champion.sentiment, "positive");
    // Upsert again should replace, not duplicate.
    const replanSuccess = await request(`/customer-success/accounts/${enterpriseAccount.id}/success-plan`, { method: "PUT", accessToken: csmSession.accessToken, body: { name: `Strategic Plan v2 ${runToken}`, status: "active", stakeholders: [{ name: "Solo Sponsor" }] } });
    assert.equal(replanSuccess.customerSuccessAccount.successPlans.length, 1, "Success plan upsert should not duplicate plans.");
    assert.equal(replanSuccess.customerSuccessAccount.successPlans[0].stakeholders.length, 1);

    log("Opening an enterprise escalation to validate workspace and dashboard escalation counts.");
    const enterpriseEscalation = await request(`/customer-success/accounts/${enterpriseAccount.id}/escalations`, { method: "POST", accessToken: csmSession.accessToken, expectedStatus: 201, body: { title: `Exec risk ${runToken}`, severity: "critical" } });
    assert.equal(enterpriseEscalation.customerSuccessAccount.openEscalationCount, 1);

    log("Validating the onboarding, scaled, and enterprise workspaces.");
    const onboardingWorkspace = await request("/customer-success/workspaces/onboarding", { accessToken: csmSession.accessToken });
    assert.ok(onboardingWorkspace.accounts.some((entry) => entry.id === csAccountId), "Onboarding workspace should include the onboarding account.");
    assert.ok(!onboardingWorkspace.accounts.some((entry) => entry.id === scaledAccount.id), "Onboarding workspace should exclude scaled accounts.");
    const scaledWorkspace = await request("/customer-success/workspaces/scaled", { accessToken: csmSession.accessToken });
    assert.ok(scaledWorkspace.accounts.some((entry) => entry.id === scaledAccount.id), "Scaled workspace should include the scaled account.");
    assert.ok(scaledWorkspace.portfolioCount >= 1);
    const enterpriseWorkspace = await request("/customer-success/workspaces/enterprise", { accessToken: csmSession.accessToken });
    assert.ok(enterpriseWorkspace.accounts.some((entry) => entry.id === enterpriseAccount.id), "Enterprise workspace should include the enterprise account.");
    assert.ok(enterpriseWorkspace.expansionOpportunityCount >= 1, "Enterprise workspace should count expansion opportunities.");
    assert.ok(enterpriseWorkspace.openEscalationCount >= 1, "Enterprise workspace should count open escalations.");
    assert.ok(enterpriseWorkspace.totalContractValue >= 250000, "Enterprise workspace should sum contract value.");

    log("Validating customer success, health, and renewal dashboards.");
    const dashboard = await request("/customer-success/dashboard", { accessToken: csmSession.accessToken });
    assert.ok(dashboard.totalAccounts >= 3, "Dashboard should count all CS accounts.");
    assert.ok(dashboard.segmentDistribution.length >= 3, "Dashboard should report a segment distribution.");
    assert.ok(dashboard.riskDistribution.length >= 1, "Dashboard should report a risk distribution.");
    assert.ok(dashboard.lifecycleDistribution.length >= 1, "Dashboard should report a lifecycle distribution.");
    assert.ok(dashboard.totalContractValue >= 330000, "Dashboard should sum contract value.");
    assert.ok(dashboard.averageHealthScore !== null, "Dashboard should compute an average health score.");
    assert.ok(dashboard.averageAdoptionScore !== null, "Dashboard should compute an average adoption score.");
    assert.ok(dashboard.openEscalationCount >= 1, "Dashboard should count open escalations.");
    assert.ok(dashboard.atRiskCount >= 1, "Dashboard should count at-risk accounts.");

    const healthDashboard = await request("/customer-success/dashboards/health", { accessToken: csmSession.accessToken });
    assert.ok(healthDashboard.averageHealthScore !== null, "Health dashboard should compute an average health score.");
    assert.ok(healthDashboard.averageAdoptionScore !== null, "Health dashboard should compute an average adoption score.");
    assert.ok(healthDashboard.atRiskCount >= 1, "Health dashboard should count at-risk accounts.");
    assert.ok(healthDashboard.healthyCount >= 1, "Health dashboard should count healthy accounts.");
    assert.ok(healthDashboard.riskDistribution.length >= 1, "Health dashboard should report a risk distribution.");
    assert.equal(typeof healthDashboard.decliningSupportCount, "number", "Health dashboard should report declining-support count.");

    const renewalDashboard = await request("/customer-success/dashboards/renewal", { accessToken: csmSession.accessToken });
    assert.ok(renewalDashboard.totalRenewals >= 1, "Renewal dashboard should count renewals.");
    assert.ok(renewalDashboard.renewalsDueSoonCount >= 1, "Renewal dashboard should count renewals due soon.");
    assert.ok(renewalDashboard.totalContractValue >= 50000, "Renewal dashboard should sum renewal contract value.");
    assert.ok(renewalDashboard.forecastValue >= 55000, "Renewal dashboard should sum forecast value.");
    assert.ok(renewalDashboard.statusDistribution.length >= 1, "Renewal dashboard should report a status distribution.");
    assert.ok(renewalDashboard.statusDistribution.some((entry) => entry.status?.key === "committed"), "Renewal dashboard status distribution should include the committed renewal.");

    log("Checking tenant isolation against a second tenant CS account.");
    const secondTenantId = (await client.query(`INSERT INTO tenants (slug, name, status, metadata) VALUES ($1, $2, 'active', jsonb_build_object('testRun', $3::text)) RETURNING id`, [`phase16-${runToken}-tenant`, `Phase 16 Tenant ${runToken}`, runToken])).rows[0].id;
    for (const setKey of ["cs-segment", "customer-success-stage", "cs-risk-status", "cs-expansion-potential"]) {
      await cloneOptionSet(client, tenantId, secondTenantId, setKey);
    }
    const secondAccount = (await client.query(`INSERT INTO accounts (tenant_id, name, metadata) VALUES ($1, $2, jsonb_build_object('testRun', $3::text)) RETURNING id`, [secondTenantId, `Isolated Account ${runToken}`, runToken])).rows[0].id;
    const secondCs = (await client.query(`INSERT INTO customer_success_accounts (tenant_id, account_id, segment_option_id, lifecycle_stage_option_id, risk_status_option_id, expansion_potential_option_id, metadata) VALUES ($1, $2, $3, $4, $5, $6, jsonb_build_object('testRun', $7::text)) RETURNING id`, [secondTenantId, secondAccount, await getOptionValueId(client, secondTenantId, "cs-segment", "onboarding"), await getOptionValueId(client, secondTenantId, "customer-success-stage", "onboarding"), await getOptionValueId(client, secondTenantId, "cs-risk-status", "healthy"), await getOptionValueId(client, secondTenantId, "cs-expansion-potential", "low"), runToken])).rows[0].id;
    await expectError(`/customer-success/accounts/${secondCs}`, { accessToken: adminSession.accessToken, expectedStatus: 404, expectedCode: "CS_ACCOUNT_NOT_FOUND" });

    log("Soft-deleting a customer success account.");
    await request(`/customer-success/accounts/${csAccountId}`, { method: "DELETE", accessToken: adminSession.accessToken });
    await expectError(`/customer-success/accounts/${csAccountId}`, { accessToken: csmSession.accessToken, expectedStatus: 404, expectedCode: "CS_ACCOUNT_NOT_FOUND" });

    log("Phase 16 customer success checks passed.");
  } finally {
    await client.end();
  }
}

await main();
