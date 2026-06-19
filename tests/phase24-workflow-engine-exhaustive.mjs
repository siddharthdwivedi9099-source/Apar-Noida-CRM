import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

const apiBaseUrl = process.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4000/api/v1";
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://crm:crm@localhost:5433/crm";
const defaultTenantSlug = process.env.DEFAULT_TENANT_SLUG ?? "sample-tenant";
const runToken = randomUUID().replace(/-/g, "").slice(0, 10);

const EXPECTED_TRIGGERS = ["record_created", "record_updated", "stage_changed", "assignment_changed", "date_reached", "sla_breached", "campaign_response_received", "ticket_escalated", "ai_score_changed", "customer_health_changed", "onboarding_delayed", "training_incomplete", "renewal_approaching", "usage_dropped"];
const EXPECTED_ACTIONS = ["assign_owner", "create_task", "send_notification", "send_email", "update_field", "change_status", "trigger_approval", "call_webhook", "run_ai_prompt", "run_ai_agent", "create_support_ticket", "assign_training", "create_customer_success_task", "trigger_renewal_playbook"];

function log(message) {
  console.log(`[phase24-exhaustive] ${message}`);
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
  const roleResult = await client.query(`INSERT INTO roles (tenant_id, slug, name, description, metadata) VALUES ($1, $2, $3, $4, jsonb_build_object('testRun', $5::text)) RETURNING id`, [tenantId, roleSlug, roleName, `${roleName} for phase 24 testing`, runToken]);
  const roleId = roleResult.rows[0].id;
  await client.query(`INSERT INTO role_permissions (tenant_id, role_id, permission_id, metadata) SELECT $1, $2, permissions.id, jsonb_build_object('testRun', $4::text) FROM permissions WHERE permissions.code = ANY($3::text[]) AND permissions.deleted_at IS NULL`, [tenantId, roleId, permissionCodes, runToken]);
  const displayName = `${firstName} ${lastName}`.trim();
  const userResult = await client.query(`INSERT INTO users (tenant_id, email, normalized_email, first_name, last_name, display_name, password_hash, status, password_changed_at, metadata) VALUES ($1, $2, LOWER($2), $3, $4, $5, crypt($6, gen_salt('bf')), 'active', NOW(), jsonb_build_object('testRun', $7::text)) RETURNING id`, [tenantId, email, firstName, lastName, displayName, password, runToken]);
  const userId = userResult.rows[0].id;
  await client.query(`INSERT INTO user_roles (tenant_id, user_id, role_id, metadata) VALUES ($1, $2, $3, jsonb_build_object('testRun', $4::text))`, [tenantId, userId, roleId, runToken]);
  return { userId, roleId, displayName };
}

async function assertAuditByAction(client, { tenantId, action, resourceType }) {
  const row = await queryOne(client, `SELECT status FROM audit_logs WHERE tenant_id = $1 AND action = $2 AND resource_type = $3 ORDER BY created_at DESC LIMIT 1`, [tenantId, action, resourceType]);
  assert.ok(row, `Audit log ${action} should exist for ${resourceType}.`);
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    log("Checking schema baseline.");
    for (const tableName of ["workflows", "workflow_actions", "workflow_runs", "workflow_logs"]) {
      const table = await queryOne(client, `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`, [tableName]);
      assert.equal(table?.table_name, tableName, `${tableName} should exist for Phase 24.`);
    }
    const tenant = await queryOne(client, `SELECT id FROM tenants WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`, [defaultTenantSlug]);
    assert.ok(tenant, "Default tenant should exist.");
    const tenantId = tenant.id;

    log("Creating workflow admin, runner, viewer, and outsider users.");
    const adminPassword = `Adm!${runToken}99`;
    const runnerPassword = `Run!${runToken}99`;
    const viewerPassword = `Vie!${runToken}99`;
    const outsiderPassword = `Out!${runToken}99`;
    await createUserWithPermissions(client, { tenantId, email: `wfadmin24-${runToken}@example.test`, password: adminPassword, firstName: "Win", lastName: "Admin", roleSlug: `wfadmin24-${runToken}`, roleName: `Workflow Admin 24 ${runToken}`, permissionCodes: ["workflows.create", "workflows.configure", "workflows.manage_workflow", "workflows.approve", "ai.use_ai", "ai.configure"] });
    await createUserWithPermissions(client, { tenantId, email: `wfrunner24-${runToken}@example.test`, password: runnerPassword, firstName: "Rey", lastName: "Runner", roleSlug: `wfrunner24-${runToken}`, roleName: `Workflow Runner 24 ${runToken}`, permissionCodes: ["workflows.manage_workflow"] });
    await createUserWithPermissions(client, { tenantId, email: `wfviewer24-${runToken}@example.test`, password: viewerPassword, firstName: "Vic", lastName: "Viewer", roleSlug: `wfviewer24-${runToken}`, roleName: `Workflow Viewer 24 ${runToken}`, permissionCodes: ["workflows.view"] });
    await createUserWithPermissions(client, { tenantId, email: `outsider24-${runToken}@example.test`, password: outsiderPassword, firstName: "Val", lastName: "Outsider", roleSlug: `outsider24-${runToken}`, roleName: `Outsider 24 ${runToken}`, permissionCodes: ["contacts.view"] });

    const adminSession = await loginSession(defaultTenantSlug, `wfadmin24-${runToken}@example.test`, adminPassword);
    const runnerSession = await loginSession(defaultTenantSlug, `wfrunner24-${runToken}@example.test`, runnerPassword);
    const viewerSession = await loginSession(defaultTenantSlug, `wfviewer24-${runToken}@example.test`, viewerPassword);
    const outsiderSession = await loginSession(defaultTenantSlug, `outsider24-${runToken}@example.test`, outsiderPassword);

    log("Ensuring the AI gateway is enabled for AI actions.");
    await request("/ai/settings", { method: "PATCH", accessToken: adminSession.accessToken, body: { isEnabled: true, loggingEnabled: true } });

    // ----------------------------------------------------------------------
    // Catalog
    // ----------------------------------------------------------------------
    log("Validating the trigger and action catalog.");
    const catalog = await request("/workflows/catalog", { accessToken: adminSession.accessToken });
    assert.equal(catalog.triggers.length, EXPECTED_TRIGGERS.length, "All fourteen triggers should be present.");
    assert.equal(catalog.actions.length, EXPECTED_ACTIONS.length, "All fourteen actions should be present.");
    for (const trigger of EXPECTED_TRIGGERS) {
      assert.ok(catalog.triggers.some((t) => t.type === trigger), `Trigger ${trigger} should be catalogued.`);
    }
    for (const action of EXPECTED_ACTIONS) {
      assert.ok(catalog.actions.some((a) => a.type === action), `Action ${action} should be catalogued.`);
    }
    assert.ok(catalog.actions.find((a) => a.type === "run_ai_prompt").isAi, "run_ai_prompt should be flagged as an AI action.");
    await expectError("/workflows/catalog", { accessToken: outsiderSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN" });

    // ----------------------------------------------------------------------
    // Create workflow
    // ----------------------------------------------------------------------
    log("Creating a workflow with a trigger and condition.");
    const created = (await request("/workflows", { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { name: `New lead workflow ${runToken}`, triggerType: "record_created", conditions: [{ field: "status", operator: "eq", value: "new" }] } })).workflow;
    assert.equal(created.status, "draft", "New workflows start as drafts.");
    assert.equal(created.isEnabled, false);
    assert.equal(created.conditions.length, 1, "The condition should be stored.");
    assert.equal(created.actions.length, 0);
    await assertAuditByAction(client, { tenantId, action: "workflow.create", resourceType: "workflow" });
    const workflowId = created.id;
    await expectError("/workflows", { method: "POST", accessToken: viewerSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { name: "x", triggerType: "record_created" } });
    await expectError("/workflows", { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 400, expectedCode: "VALIDATION_ERROR", body: { name: "", triggerType: "record_created" } });

    // ----------------------------------------------------------------------
    // Configure actions
    // ----------------------------------------------------------------------
    log("Updating workflow metadata and validating guards.");
    const renamed = (await request(`/workflows/${workflowId}`, { method: "PATCH", accessToken: adminSession.accessToken, body: { name: `Renamed workflow ${runToken}`, description: "Handles new leads." } })).workflow;
    assert.equal(renamed.name, `Renamed workflow ${runToken}`, "Workflow metadata should update.");
    await expectError(`/workflows/${workflowId}`, { method: "PATCH", accessToken: adminSession.accessToken, expectedStatus: 400, expectedCode: "VALIDATION_ERROR", body: {} });
    await expectError(`/workflows/${workflowId}`, { method: "PATCH", accessToken: viewerSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { name: "x" } });

    log("Configuring workflow actions.");
    await request(`/workflows/${workflowId}/actions`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { actionType: "create_task", actionConfig: { title: "Follow up" } } });
    const notify = (await request(`/workflows/${workflowId}/actions`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { actionType: "send_notification", actionConfig: { message: "New lead" } } })).action;
    const aiAction = (await request(`/workflows/${workflowId}/actions`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { actionType: "run_ai_prompt", actionConfig: { templateKey: "generic_assistant", variables: { prompt: "Summarize the new lead." } } } })).action;
    assert.equal(aiAction.requiresPermission, "ai.use_ai", "AI actions should default to requiring ai.use_ai.");
    const aiAgentAction = (await request(`/workflows/${workflowId}/actions`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { actionType: "run_ai_agent", actionConfig: { agentKey: "sales_copilot", templateKey: "generic_assistant", variables: { prompt: "Dispatch the sales copilot." } } } })).action;
    assert.equal(aiAgentAction.requiresPermission, "ai.use_ai", "AI agent actions should default to requiring ai.use_ai.");
    const throwaway = (await request(`/workflows/${workflowId}/actions`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { actionType: "send_email" } })).action;

    let detail = (await request(`/workflows/${workflowId}`, { accessToken: adminSession.accessToken })).workflow;
    assert.equal(detail.actions.length, 5, "All five actions should be configured.");
    const updatedAction = (await request(`/workflows/${workflowId}/actions/${notify.id}`, { method: "PATCH", accessToken: adminSession.accessToken, body: { requiresPermission: "workflows.manage_workflow" } })).action;
    assert.equal(updatedAction.requiresPermission, "workflows.manage_workflow", "Action configuration should update.");
    await request(`/workflows/${workflowId}/actions/${throwaway.id}`, { method: "DELETE", accessToken: adminSession.accessToken });
    detail = (await request(`/workflows/${workflowId}`, { accessToken: adminSession.accessToken })).workflow;
    assert.equal(detail.actions.length, 4, "Deleting an action should remove it.");
    await expectError(`/workflows/${workflowId}/actions`, { method: "POST", accessToken: viewerSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { actionType: "create_task" } });
    await expectError(`/workflows/${workflowId}/actions/${randomUUID()}`, { method: "PATCH", accessToken: adminSession.accessToken, expectedStatus: 404, expectedCode: "WORKFLOW_ACTION_NOT_FOUND", body: { isEnabled: false } });

    // ----------------------------------------------------------------------
    // Run guards + successful execution
    // ----------------------------------------------------------------------
    log("Validating that a draft workflow cannot run.");
    await expectError(`/workflows/${workflowId}/run`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 400, expectedCode: "WORKFLOW_NOT_ACTIVE", body: { context: { status: "new" } } });

    log("Activating and running the workflow successfully (acceptance: at least one execution).");
    await request(`/workflows/${workflowId}`, { method: "PATCH", accessToken: adminSession.accessToken, body: { status: "active", isEnabled: true } });
    const successRun = (await request(`/workflows/${workflowId}/run`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { context: { status: "new" } } })).run;
    assert.equal(successRun.status, "succeeded", "A matching, fully-permitted run should succeed.");
    assert.equal(successRun.actionsTotal, 4);
    assert.equal(successRun.actionsSucceeded, 4);
    assert.equal(successRun.actionsFailed, 0);
    assert.equal(successRun.logs.length, 4, "Every action should be logged.");
    assert.ok(successRun.logs.every((entry) => entry.status === "succeeded"), "All actions should succeed.");
    const aiPromptLog = successRun.logs.find((entry) => entry.actionType === "run_ai_prompt");
    const aiAgentLog = successRun.logs.find((entry) => entry.actionType === "run_ai_agent");
    assert.ok(aiPromptLog && aiPromptLog.detail.provider, "The AI prompt log should record the gateway provider (AI Gateway used).");
    assert.ok(aiAgentLog && aiAgentLog.detail.provider, "The AI agent log should record the gateway provider (AI Gateway used).");
    await assertAuditByAction(client, { tenantId, action: "workflow.run", resourceType: "workflow" });
    const runRow = await queryOne(client, `SELECT status FROM workflow_runs WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [successRun.id, tenantId]);
    assert.equal(runRow.status, "succeeded", "The run should be persisted (logged).");
    const logCount = await queryOne(client, `SELECT COUNT(*)::int AS count FROM workflow_logs WHERE tenant_id = $1 AND run_id = $2`, [tenantId, successRun.id]);
    assert.equal(logCount.count, 4, "Per-action logs should be stored.");

    log("Validating AI-failure traceability when the gateway is disabled.");
    await request("/ai/settings", { method: "PATCH", accessToken: adminSession.accessToken, body: { isEnabled: false } });
    const aiDisabledRun = (await request(`/workflows/${workflowId}/run`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { context: { status: "new" } } })).run;
    assert.equal(aiDisabledRun.status, "failed", "AI gateway failures should fail the run.");
    assert.equal(aiDisabledRun.actionsFailed, 2, "Both AI actions should fail when the gateway is disabled.");
    const disabledLog = aiDisabledRun.logs.find((entry) => entry.status === "failed" && entry.detail.code === "AI_DISABLED");
    assert.ok(disabledLog, "The AI failure must be traceable with its gateway error code.");
    await request("/ai/settings", { method: "PATCH", accessToken: adminSession.accessToken, body: { isEnabled: true } });

    // ----------------------------------------------------------------------
    // Conditions gate (skipped run)
    // ----------------------------------------------------------------------
    log("Validating that unmet conditions produce a skipped run.");
    const skipped = (await request(`/workflows/${workflowId}/run`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { context: { status: "old" } } })).run;
    assert.equal(skipped.status, "skipped", "An unmet condition should skip the run.");
    assert.equal(skipped.actionsSucceeded, 0);
    assert.ok(skipped.logs.some((entry) => entry.status === "skipped"), "The skip should be logged for traceability.");

    // ----------------------------------------------------------------------
    // Permission enforcement + failure traceability
    // ----------------------------------------------------------------------
    log("Validating action permission enforcement and failure traceability.");
    await request(`/workflows/${workflowId}/actions`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { actionType: "create_support_ticket", actionConfig: { subject: "Auto" } } });
    const failedRun = (await request(`/workflows/${workflowId}/run`, { method: "POST", accessToken: runnerSession.accessToken, expectedStatus: 201, body: { context: { status: "new" } } })).run;
    assert.equal(failedRun.status, "failed", "A run with permission-denied actions should fail.");
    assert.ok(failedRun.actionsFailed >= 3, "The two AI actions and the support-ticket action should fail for the runner.");
    assert.ok(failedRun.actionsSucceeded >= 2, "Permitted actions should still succeed.");
    assert.ok(failedRun.errorMessage.length > 0, "A failed run should record an error message.");
    const denied = failedRun.logs.find((entry) => entry.status === "failed" && entry.message.includes("Permission denied"));
    assert.ok(denied, "A permission-denied action must be traceable in the run logs.");

    // ----------------------------------------------------------------------
    // Run log retrieval
    // ----------------------------------------------------------------------
    log("Validating run log retrieval.");
    const runs = await request(`/workflows/${workflowId}/runs`, { accessToken: viewerSession.accessToken });
    assert.ok(runs.runs.length >= 3, "Recent runs should be listed.");
    assert.ok(runs.runs.some((r) => r.id === successRun.id) && runs.runs.some((r) => r.id === failedRun.id));
    const runDetail = await request(`/workflows/runs/${successRun.id}`, { accessToken: viewerSession.accessToken });
    assert.equal(runDetail.run.id, successRun.id);
    assert.equal(runDetail.run.logs.length, 4);
    await expectError(`/workflows/runs/${randomUUID()}`, { accessToken: adminSession.accessToken, expectedStatus: 404, expectedCode: "WORKFLOW_RUN_NOT_FOUND" });
    await expectError(`/workflows/${randomUUID()}`, { accessToken: adminSession.accessToken, expectedStatus: 404, expectedCode: "WORKFLOW_NOT_FOUND" });

    // ----------------------------------------------------------------------
    // Multi-operator condition evaluation
    // ----------------------------------------------------------------------
    log("Validating multi-operator condition evaluation (gt/contains/exists, AND).");
    const condWf = (await request("/workflows", { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { name: `Condition workflow ${runToken}`, triggerType: "customer_health_changed", conditions: [{ field: "score", operator: "gt", value: 50 }, { field: "tags", operator: "contains", value: "vip" }, { field: "email", operator: "exists" }] } })).workflow;
    await request(`/workflows/${condWf.id}/actions`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { actionType: "send_notification", actionConfig: { message: "Health changed" } } });
    await request(`/workflows/${condWf.id}`, { method: "PATCH", accessToken: adminSession.accessToken, body: { status: "active", isEnabled: true } });
    const allMet = (await request(`/workflows/${condWf.id}/run`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { context: { score: 80, tags: "vip,enterprise", email: "a@b.com" } } })).run;
    assert.equal(allMet.status, "succeeded", "All conditions met should execute the workflow.");
    const failsGt = (await request(`/workflows/${condWf.id}/run`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { context: { score: 10, tags: "vip", email: "a@b.com" } } })).run;
    assert.equal(failsGt.status, "skipped", "A failed gt condition should skip the run.");
    const failsContains = (await request(`/workflows/${condWf.id}/run`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { context: { score: 80, tags: "standard", email: "a@b.com" } } })).run;
    assert.equal(failsContains.status, "skipped", "A failed contains condition should skip the run.");
    const failsExists = (await request(`/workflows/${condWf.id}/run`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { context: { score: 80, tags: "vip" } } })).run;
    assert.equal(failsExists.status, "skipped", "A failed exists condition should skip the run.");

    // ----------------------------------------------------------------------
    // Tenant isolation
    // ----------------------------------------------------------------------
    log("Checking tenant isolation.");
    const secondTenantId = (await client.query(`INSERT INTO tenants (slug, name, status, metadata) VALUES ($1, $2, 'active', jsonb_build_object('testRun', $3::text)) RETURNING id`, [`phase24-${runToken}-tenant`, `Phase 24 Tenant ${runToken}`, runToken])).rows[0].id;
    const otherWorkflowId = (await client.query(`INSERT INTO workflows (tenant_id, name, trigger_type) VALUES ($1, 'Isolated', 'record_created') RETURNING id`, [secondTenantId])).rows[0].id;
    await expectError(`/workflows/${otherWorkflowId}`, { accessToken: adminSession.accessToken, expectedStatus: 404, expectedCode: "WORKFLOW_NOT_FOUND" });
    const ownList = await request("/workflows?pageSize=100", { accessToken: adminSession.accessToken });
    assert.ok(ownList.workflows.every((w) => w.id !== otherWorkflowId), "Another tenant's workflows must not be visible.");

    log("Phase 24 workflow engine checks passed.");
  } finally {
    await client.end();
  }
}

await main();
