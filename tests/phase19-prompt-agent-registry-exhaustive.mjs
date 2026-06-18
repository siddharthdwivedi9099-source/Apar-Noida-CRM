import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

const apiBaseUrl = process.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4000/api/v1";
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://crm:crm@localhost:5433/crm";
const defaultTenantSlug = process.env.DEFAULT_TENANT_SLUG ?? "sample-tenant";
const runToken = randomUUID().replace(/-/g, "").slice(0, 10);

const DEFAULT_AGENT_KEYS = [
  "sales_copilot",
  "marketing_copilot",
  "social_media",
  "sdr_assistant",
  "presales_proposal",
  "support_resolution",
  "cs_onboarding",
  "cs_scaled",
  "cs_enterprise",
  "customer_training",
  "customer_query_resolution",
  "partner_manager",
  "reseller_growth",
  "executive_insight",
  "data_quality",
  "workflow_automation"
];

function log(message) {
  console.log(`[phase19-exhaustive] ${message}`);
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
  const currentUserPayload = await request("/auth/me", { accessToken, expectedStatus: 200 });
  return { accessToken, currentUser: currentUserPayload.user, session: currentUserPayload.session };
}

async function queryOne(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0] ?? null;
}

async function createUserWithPermissions(client, { tenantId, email, password, firstName, lastName, roleSlug, roleName, permissionCodes }) {
  const roleResult = await client.query(`INSERT INTO roles (tenant_id, slug, name, description, metadata) VALUES ($1, $2, $3, $4, jsonb_build_object('testRun', $5::text)) RETURNING id`, [tenantId, roleSlug, roleName, `${roleName} for phase 19 testing`, runToken]);
  const roleId = roleResult.rows[0].id;
  await client.query(`INSERT INTO role_permissions (tenant_id, role_id, permission_id, metadata) SELECT $1, $2, permissions.id, jsonb_build_object('testRun', $4::text) FROM permissions WHERE permissions.code = ANY($3::text[]) AND permissions.deleted_at IS NULL`, [tenantId, roleId, permissionCodes, runToken]);
  const displayName = `${firstName} ${lastName}`.trim();
  const userResult = await client.query(`INSERT INTO users (tenant_id, email, normalized_email, first_name, last_name, display_name, password_hash, status, password_changed_at, metadata) VALUES ($1, $2, LOWER($2), $3, $4, $5, crypt($6, gen_salt('bf')), 'active', NOW(), jsonb_build_object('testRun', $7::text)) RETURNING id`, [tenantId, email, firstName, lastName, displayName, password, runToken]);
  const userId = userResult.rows[0].id;
  await client.query(`INSERT INTO user_roles (tenant_id, user_id, role_id, metadata) VALUES ($1, $2, $3, jsonb_build_object('testRun', $4::text))`, [tenantId, userId, roleId, runToken]);
  return { userId, roleId, displayName };
}

async function assertAuditLog(client, { tenantId, action, resourceType, resourceId }) {
  const row = await queryOne(client, `SELECT status FROM audit_logs WHERE tenant_id = $1 AND action = $2 AND resource_type = $3 AND resource_id = $4 ORDER BY created_at DESC LIMIT 1`, [tenantId, action, resourceType, resourceId]);
  assert.ok(row, `Audit log ${action} should exist for ${resourceType} ${resourceId}.`);
  assert.equal(row.status, "success");
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    log("Checking schema and seed baseline.");
    for (const tableName of ["ai_prompts", "ai_prompt_versions", "ai_agents"]) {
      const table = await queryOne(client, `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`, [tableName]);
      assert.equal(table?.table_name, tableName, `${tableName} should exist for Phase 19.`);
    }
    const tenant = await queryOne(client, `SELECT id FROM tenants WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`, [defaultTenantSlug]);
    assert.ok(tenant, "Default tenant should exist.");
    const tenantId = tenant.id;

    log("Creating AI admin, AI author, AI viewer, and unrelated viewer users.");
    const adminPassword = `Adm!${runToken}99`;
    const authorPassword = `Aut!${runToken}99`;
    const viewerPassword = `Vie!${runToken}99`;
    const outsiderPassword = `Out!${runToken}99`;
    await createUserWithPermissions(client, { tenantId, email: `aiadmin19-${runToken}@example.test`, password: adminPassword, firstName: "Ada", lastName: "Admin", roleSlug: `aiadmin19-${runToken}`, roleName: `AI Admin 19 ${runToken}`, permissionCodes: ["ai.configure"] });
    await createUserWithPermissions(client, { tenantId, email: `aiauthor19-${runToken}@example.test`, password: authorPassword, firstName: "Ari", lastName: "Author", roleSlug: `aiauthor19-${runToken}`, roleName: `AI Author 19 ${runToken}`, permissionCodes: ["ai.create", "ai.edit"] });
    await createUserWithPermissions(client, { tenantId, email: `aiview19-${runToken}@example.test`, password: viewerPassword, firstName: "Vic", lastName: "Viewer", roleSlug: `aiview19-${runToken}`, roleName: `AI Viewer 19 ${runToken}`, permissionCodes: ["ai.view"] });
    await createUserWithPermissions(client, { tenantId, email: `outsider19-${runToken}@example.test`, password: outsiderPassword, firstName: "Val", lastName: "Outsider", roleSlug: `outsider19-${runToken}`, roleName: `Outsider 19 ${runToken}`, permissionCodes: ["leads.view"] });

    const adminSession = await loginSession(defaultTenantSlug, `aiadmin19-${runToken}@example.test`, adminPassword);
    const authorSession = await loginSession(defaultTenantSlug, `aiauthor19-${runToken}@example.test`, authorPassword);
    const viewerSession = await loginSession(defaultTenantSlug, `aiview19-${runToken}@example.test`, viewerPassword);
    const outsiderSession = await loginSession(defaultTenantSlug, `outsider19-${runToken}@example.test`, outsiderPassword);

    // ----------------------------------------------------------------------
    // Prompt Registry: creation
    // ----------------------------------------------------------------------
    log("Creating a prompt and verifying version 1 baseline.");
    const promptKey = `sales-summary-${runToken}`;
    const created = await request("/ai/prompts", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        promptKey,
        name: "Sales summary",
        description: "Summarize a sales opportunity.",
        module: "sales",
        promptRole: "system",
        content: "Summarize {{name}} for {{account}}.",
        inputSchema: { type: "object", properties: { name: { type: "string" } } },
        outputSchema: { type: "string" },
        guardrails: ["No PII in output", "Stay factual"],
        changeSummary: "Initial"
      }
    });
    const prompt = created.prompt;
    assert.equal(prompt.promptKey, promptKey);
    assert.equal(prompt.approvalStatus, "draft", "New prompts start as draft.");
    assert.equal(prompt.isActive, false, "New prompts start inactive.");
    assert.equal(prompt.currentVersion, 1);
    assert.equal(prompt.latestVersion, 1);
    assert.equal(prompt.versions.length, 1, "A new prompt should have exactly one version.");
    assert.equal(prompt.versions[0].content, "Summarize {{name}} for {{account}}.");
    assert.equal(prompt.versions[0].isActive, true, "Version 1 should be the active version.");
    assert.deepEqual(prompt.guardrails, ["No PII in output", "Stay factual"], "Guardrails should be stored.");
    assert.equal(prompt.activeContent, "Summarize {{name}} for {{account}}.");
    assert.deepEqual(prompt.inputSchema, { type: "object", properties: { name: { type: "string" } } }, "Input schema should round-trip.");
    assert.deepEqual(prompt.outputSchema, { type: "string" }, "Output schema should round-trip.");
    assert.deepEqual(prompt.versions[0].inputSchema, { type: "object", properties: { name: { type: "string" } } }, "Version 1 should snapshot the input schema.");
    assert.deepEqual(prompt.versions[0].outputSchema, { type: "string" }, "Version 1 should snapshot the output schema.");
    assert.deepEqual(prompt.versions[0].guardrails, ["No PII in output", "Stay factual"], "Version 1 should snapshot the guardrails.");
    assert.equal(prompt.createdBy, adminSession.currentUser.id, "createdBy should be the creating user.");
    assert.equal(prompt.updatedBy, adminSession.currentUser.id, "updatedBy should be set on creation.");
    assert.equal(prompt.versions[0].createdBy, adminSession.currentUser.id, "Version author should be tracked.");
    await assertAuditLog(client, { tenantId, action: "ai.prompt.create", resourceType: "ai_prompt", resourceId: prompt.id });

    log("Validating prompt creation guards.");
    await expectError("/ai/prompts", { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 409, expectedCode: "AI_PROMPT_KEY_EXISTS", body: { promptKey, name: "Dup", content: "x" } });
    await expectError("/ai/prompts", { method: "POST", accessToken: viewerSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { promptKey: `v-${runToken}`, name: "Nope", content: "x" } });
    await expectError("/ai/prompts", { accessToken: outsiderSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN" });
    await expectError("/ai/prompts", { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 400, expectedCode: "VALIDATION_ERROR", body: { promptKey: "bad key!!", name: "x", content: "x" } });

    // ----------------------------------------------------------------------
    // Prompt Registry: edit + versioning
    // ----------------------------------------------------------------------
    log("Editing prompt metadata.");
    const patched = (await request(`/ai/prompts/${prompt.id}`, { method: "PATCH", accessToken: adminSession.accessToken, body: { name: "Sales summary v2", module: "sales", promptRole: "user" } })).prompt;
    assert.equal(patched.name, "Sales summary v2");
    assert.equal(patched.promptRole, "user");
    await expectError(`/ai/prompts/${prompt.id}`, { method: "PATCH", accessToken: adminSession.accessToken, expectedStatus: 400, expectedCode: "VALIDATION_ERROR", body: {} });
    await expectError(`/ai/prompts/${prompt.id}`, { method: "PATCH", accessToken: viewerSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { name: "x" } });

    log("Versioning the prompt (non-activating and activating).");
    const v2 = (await request(`/ai/prompts/${prompt.id}/versions`, { method: "POST", accessToken: authorSession.accessToken, expectedStatus: 201, body: { content: "Summarize {{name}} (v2).", changeSummary: "Tweak" } })).prompt;
    assert.equal(v2.latestVersion, 2, "Latest version should increment.");
    assert.equal(v2.currentVersion, 1, "Non-activating version should not move the current pointer.");
    assert.equal(v2.versions.length, 2);
    assert.equal(v2.createdBy, adminSession.currentUser.id, "createdBy should remain the original author.");
    assert.equal(v2.updatedBy, authorSession.currentUser.id, "updatedBy should reflect the version author.");
    assert.equal(v2.versions.find((entry) => entry.version === 2).createdBy, authorSession.currentUser.id, "New version author should be tracked.");

    const v3 = (await request(`/ai/prompts/${prompt.id}/versions`, { method: "POST", accessToken: authorSession.accessToken, expectedStatus: 201, body: { content: "Summarize {{name}} (v3).", activate: true } })).prompt;
    assert.equal(v3.latestVersion, 3);
    assert.equal(v3.currentVersion, 3, "Activating version should move the current pointer.");
    assert.equal(v3.approvalStatus, "draft", "A newly activated version resets approval to draft.");
    assert.equal(v3.activeContent, "Summarize {{name}} (v3).");
    assert.equal(v3.versions.find((entry) => entry.version === 3).isActive, true);
    assert.equal(v3.versions.find((entry) => entry.version === 1).isActive, false);
    await assertAuditLog(client, { tenantId, action: "ai.prompt.version", resourceType: "ai_prompt", resourceId: prompt.id });

    log("Validating version-activation permissions.");
    await expectError(`/ai/prompts/${prompt.id}/versions/1/activate`, { method: "POST", accessToken: authorSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN" });
    const reactivated = (await request(`/ai/prompts/${prompt.id}/versions/1/activate`, { method: "POST", accessToken: adminSession.accessToken })).prompt;
    assert.equal(reactivated.currentVersion, 1, "Admin should be able to repoint the current version.");
    assert.equal(reactivated.activeContent, "Summarize {{name}} for {{account}}.");
    assert.equal(reactivated.versions.find((entry) => entry.version === 1).content, "Summarize {{name}} for {{account}}.", "Older versions must remain immutable.");
    assert.equal(reactivated.versions.find((entry) => entry.version === 2).content, "Summarize {{name}} (v2).", "Older versions must remain immutable.");
    assert.equal(reactivated.versions.find((entry) => entry.version === 3).content, "Summarize {{name}} (v3).", "Older versions must remain immutable.");
    await expectError(`/ai/prompts/${prompt.id}/versions/999/activate`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 404, expectedCode: "AI_PROMPT_VERSION_NOT_FOUND" });

    log("Validating GET version listing and prompt-not-found handling.");
    const versionList = await request(`/ai/prompts/${prompt.id}/versions`, { accessToken: viewerSession.accessToken });
    assert.equal(versionList.versions.length, 3, "All three versions should be listed.");
    await expectError(`/ai/prompts/${randomUUID()}`, { accessToken: adminSession.accessToken, expectedStatus: 404, expectedCode: "AI_PROMPT_NOT_FOUND" });

    log("Validating per-version schema and guardrail snapshots with activation sync.");
    const v4 = (await request(`/ai/prompts/${prompt.id}/versions`, {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: { content: "Summarize {{name}} (v4).", inputSchema: { type: "object", properties: { account: { type: "string" } } }, outputSchema: { type: "object" }, guardrails: ["v4 guardrail"], activate: true }
    })).prompt;
    assert.equal(v4.currentVersion, 4, "Activating the new version should move the pointer.");
    assert.deepEqual(v4.inputSchema, { type: "object", properties: { account: { type: "string" } } }, "Activating a version should sync its input schema to the prompt.");
    assert.deepEqual(v4.outputSchema, { type: "object" }, "Activating a version should sync its output schema to the prompt.");
    assert.deepEqual(v4.guardrails, ["v4 guardrail"], "Activating a version should sync its guardrails to the prompt.");
    assert.deepEqual(v4.versions.find((entry) => entry.version === 4).inputSchema, { type: "object", properties: { account: { type: "string" } } }, "The new version should snapshot its own input schema.");
    assert.deepEqual(v4.versions.find((entry) => entry.version === 1).guardrails, ["No PII in output", "Stay factual"], "Older version guardrails must remain immutable.");

    // ----------------------------------------------------------------------
    // Prompt Registry: approval + activation governance
    // ----------------------------------------------------------------------
    log("Validating approval workflow permissions and the approval-gated activation.");
    await expectError(`/ai/prompts/${prompt.id}/approval`, { method: "POST", accessToken: authorSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { approvalStatus: "approved" } });
    await expectError(`/ai/prompts/${prompt.id}/active`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 400, expectedCode: "AI_PROMPT_NOT_APPROVED", body: { isActive: true } });

    const pendingReview = (await request(`/ai/prompts/${prompt.id}/approval`, { method: "POST", accessToken: adminSession.accessToken, body: { approvalStatus: "pending_review" } })).prompt;
    assert.equal(pendingReview.approvalStatus, "pending_review", "Approval should transition to pending_review.");
    const rejected = (await request(`/ai/prompts/${prompt.id}/approval`, { method: "POST", accessToken: adminSession.accessToken, body: { approvalStatus: "rejected" } })).prompt;
    assert.equal(rejected.approvalStatus, "rejected", "Approval should transition to rejected.");
    assert.equal(rejected.versions.find((entry) => entry.version === rejected.currentVersion).approvalStatus, "rejected", "Current version should carry the rejection.");
    await expectError(`/ai/prompts/${prompt.id}/active`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 400, expectedCode: "AI_PROMPT_NOT_APPROVED", body: { isActive: true } });

    const approved = (await request(`/ai/prompts/${prompt.id}/approval`, { method: "POST", accessToken: adminSession.accessToken, body: { approvalStatus: "approved" } })).prompt;
    assert.equal(approved.approvalStatus, "approved");
    assert.equal(approved.versions.find((entry) => entry.version === approved.currentVersion).approvalStatus, "approved", "Current version should carry the approval.");
    await assertAuditLog(client, { tenantId, action: "ai.prompt.approval", resourceType: "ai_prompt", resourceId: prompt.id });

    const activated = (await request(`/ai/prompts/${prompt.id}/active`, { method: "POST", accessToken: adminSession.accessToken, body: { isActive: true } })).prompt;
    assert.equal(activated.isActive, true, "An approved prompt can be activated.");
    await assertAuditLog(client, { tenantId, action: "ai.prompt.activate", resourceType: "ai_prompt", resourceId: prompt.id });
    const deactivated = (await request(`/ai/prompts/${prompt.id}/active`, { method: "POST", accessToken: adminSession.accessToken, body: { isActive: false } })).prompt;
    assert.equal(deactivated.isActive, false);
    await request(`/ai/prompts/${prompt.id}/active`, { method: "POST", accessToken: adminSession.accessToken, body: { isActive: true } });

    log("Validating prompt list filters, search, and pagination.");
    const secondKey = `support-reply-${runToken}`;
    const secondPrompt = (await request("/ai/prompts", { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { promptKey: secondKey, name: `Support reply ${runToken}`, module: "support", content: "Reply to {{subject}}." } })).prompt;
    const byModule = await request("/ai/prompts?module=support&pageSize=100", { accessToken: viewerSession.accessToken });
    assert.ok(byModule.prompts.every((entry) => entry.module === "support"), "Module filter should be applied.");
    assert.ok(byModule.prompts.some((entry) => entry.id === secondPrompt.id));
    const byApproval = await request("/ai/prompts?approvalStatus=approved&pageSize=100", { accessToken: adminSession.accessToken });
    assert.ok(byApproval.prompts.every((entry) => entry.approvalStatus === "approved"), "Approval filter should be applied.");
    assert.ok(byApproval.prompts.some((entry) => entry.id === prompt.id));
    const byActive = await request("/ai/prompts?isActive=true&pageSize=100", { accessToken: adminSession.accessToken });
    assert.ok(byActive.prompts.every((entry) => entry.isActive === true), "isActive=true filter should be applied.");
    assert.ok(byActive.prompts.some((entry) => entry.id === prompt.id), "The activated prompt should appear in the active filter.");
    const byInactive = await request("/ai/prompts?isActive=false&pageSize=100", { accessToken: adminSession.accessToken });
    assert.ok(byInactive.prompts.every((entry) => entry.isActive === false), "isActive=false filter should be applied.");
    assert.ok(byInactive.prompts.some((entry) => entry.id === secondPrompt.id), "The inactive prompt should appear in the inactive filter.");
    const search = await request(`/ai/prompts?search=${runToken}&pageSize=100`, { accessToken: adminSession.accessToken });
    assert.ok(search.prompts.length >= 1, "Search should match by name/key.");
    const paged = await request("/ai/prompts?pageSize=1&page=1", { accessToken: adminSession.accessToken });
    assert.equal(paged.prompts.length, 1, "Pagination should cap the page size.");
    assert.ok(paged.pagination.total >= 2 && paged.pagination.pageSize === 1, "Pagination metadata should be reported.");

    // ----------------------------------------------------------------------
    // Agent Registry
    // ----------------------------------------------------------------------
    log("Validating agent registry seeding and baseline agents.");
    const agentsResponse = await request("/ai/agents", { accessToken: adminSession.accessToken });
    const agentKeys = agentsResponse.agents.map((agent) => agent.agentKey);
    for (const key of DEFAULT_AGENT_KEYS) {
      assert.ok(agentKeys.includes(key), `Baseline agent ${key} should be seeded.`);
    }
    assert.ok(agentsResponse.agents.length >= 16, "At least sixteen baseline agents should exist.");
    const salesCopilot = agentsResponse.agents.find((agent) => agent.agentKey === "sales_copilot");
    assert.equal(salesCopilot.module, "sales");
    assert.equal(salesCopilot.isSystem, true, "Baseline agents should be flagged as system agents.");
    assert.ok(salesCopilot.allowedTools.includes("opportunity_summary"), "Sales Copilot should declare its tools.");
    assert.ok(salesCopilot.allowedRoles.includes("account-executive"), "Sales Copilot should serve account executives.");
    assert.ok(salesCopilot.escalationRules.length > 0 && salesCopilot.escalationRules[0].trigger, "Agents should declare escalation rules.");

    const validScopes = ["own", "team", "module", "tenant"];
    const validStatuses = ["draft", "active", "inactive"];
    for (const key of DEFAULT_AGENT_KEYS) {
      const agent = agentsResponse.agents.find((entry) => entry.agentKey === key);
      assert.ok(agent, `Baseline agent ${key} should be present.`);
      assert.ok(agent.name.length > 0 && agent.purpose.length > 0, `Agent ${key} should declare a name and purpose.`);
      assert.ok(agent.module.length > 0, `Agent ${key} should declare a module.`);
      assert.ok(validScopes.includes(agent.dataAccessScope), `Agent ${key} should declare a valid data-access scope.`);
      assert.ok(validStatuses.includes(agent.status), `Agent ${key} should declare a valid status.`);
      assert.ok(Array.isArray(agent.allowedTools) && agent.allowedTools.length > 0, `Agent ${key} should declare allowed tools.`);
      assert.ok(Array.isArray(agent.allowedRoles) && agent.allowedRoles.length > 0, `Agent ${key} should declare allowed roles.`);
      assert.ok(agent.escalationRules.length > 0 && agent.escalationRules.every((rule) => rule.trigger && rule.action && rule.escalateTo), `Agent ${key} should declare complete escalation rules.`);
      assert.equal(typeof agent.requiresHumanApproval, "boolean", `Agent ${key} should declare a human-approval flag.`);
      assert.equal(typeof agent.loggingEnabled, "boolean", `Agent ${key} should declare a logging flag.`);
      assert.equal(agent.isSystem, true, `Baseline agent ${key} should be a system agent.`);
    }
    assert.equal(agentsResponse.agents.find((entry) => entry.agentKey === "data_quality").module, "ai", "Data Quality agent should target the ai module.");
    assert.equal(agentsResponse.agents.find((entry) => entry.agentKey === "workflow_automation").module, "workflows", "Workflow Automation agent should target the workflows module.");

    log("Validating that agent seeding is idempotent.");
    const reseed = await request("/ai/agents", { accessToken: adminSession.accessToken });
    assert.equal(reseed.agents.length, agentsResponse.agents.length, "Re-reading the registry must not duplicate seeded agents.");

    log("Validating agent detail, filters, and read permissions.");
    const detail = await request(`/ai/agents/${salesCopilot.id}`, { accessToken: viewerSession.accessToken });
    assert.equal(detail.agent.id, salesCopilot.id);
    const csAgents = await request("/ai/agents?module=customer_success", { accessToken: adminSession.accessToken });
    assert.equal(csAgents.agents.length, 3, "There should be three customer success agents.");
    assert.deepEqual(csAgents.agents.map((agent) => agent.agentKey).sort(), ["cs_enterprise", "cs_onboarding", "cs_scaled"], "The three customer success agents should be the seeded set.");
    const activeAgents = await request("/ai/agents?status=active", { accessToken: adminSession.accessToken });
    assert.ok(activeAgents.agents.every((agent) => agent.status === "active"), "Status filter should be applied.");
    await expectError("/ai/agents", { accessToken: outsiderSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN" });

    log("Configuring an agent and validating permissions.");
    const configured = (await request(`/ai/agents/${salesCopilot.id}`, { method: "PATCH", accessToken: adminSession.accessToken, body: { status: "inactive", dataAccessScope: "tenant", requiresHumanApproval: false, loggingEnabled: false, allowedTools: ["opportunity_summary", "deal_risk", "custom_tool"] } })).agent;
    assert.equal(configured.status, "inactive");
    assert.equal(configured.dataAccessScope, "tenant");
    assert.equal(configured.requiresHumanApproval, false);
    assert.equal(configured.loggingEnabled, false);
    assert.deepEqual(configured.allowedTools, ["opportunity_summary", "deal_risk", "custom_tool"]);
    assert.equal(configured.updatedBy, adminSession.currentUser.id, "Agent updatedBy should track the configuring user.");
    assert.equal(configured.isSystem, true, "Configuring a system agent must not change its system flag.");
    await assertAuditLog(client, { tenantId, action: "ai.agent.update", resourceType: "ai_agent", resourceId: salesCopilot.id });
    // Restore so reruns stay deterministic.
    await request(`/ai/agents/${salesCopilot.id}`, { method: "PATCH", accessToken: adminSession.accessToken, body: { status: "active", dataAccessScope: "module", requiresHumanApproval: true, loggingEnabled: true, allowedTools: ["opportunity_summary", "deal_risk", "follow_up_email_generator"] } });

    const authorEdited = (await request(`/ai/agents/${salesCopilot.id}`, { method: "PATCH", accessToken: authorSession.accessToken, body: { purpose: `Edited by author ${runToken}` } })).agent;
    assert.equal(authorEdited.purpose, `Edited by author ${runToken}`, "ai.edit should permit agent configuration.");
    assert.equal(authorEdited.updatedBy, authorSession.currentUser.id, "Agent updatedBy should track the editing user.");
    await expectError(`/ai/agents/${salesCopilot.id}`, { method: "PATCH", accessToken: viewerSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { status: "inactive" } });
    await expectError(`/ai/agents/${salesCopilot.id}`, { method: "PATCH", accessToken: adminSession.accessToken, expectedStatus: 400, expectedCode: "VALIDATION_ERROR", body: {} });

    log("Creating a custom agent and validating guards.");
    const customKey = `custom-agent-${runToken}`;
    const customAgent = (await request("/ai/agents", { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { agentKey: customKey, name: "Custom Agent", module: "sales", allowedTools: ["x"], allowedRoles: ["analyst"], dataAccessScope: "own", escalationRules: [{ trigger: "t", action: "a", escalateTo: "lead" }] } })).agent;
    assert.equal(customAgent.isSystem, false, "Custom agents are not system agents.");
    assert.equal(customAgent.escalationRules[0].escalateTo, "lead");
    await expectError("/ai/agents", { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 409, expectedCode: "AI_AGENT_KEY_EXISTS", body: { agentKey: customKey, name: "Dup" } });
    await expectError("/ai/agents", { method: "POST", accessToken: viewerSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { agentKey: `nope-${runToken}`, name: "Nope" } });

    // ----------------------------------------------------------------------
    // Tenant isolation
    // ----------------------------------------------------------------------
    log("Checking tenant isolation for prompts and agents.");
    const secondTenantId = (await client.query(`INSERT INTO tenants (slug, name, status, metadata) VALUES ($1, $2, 'active', jsonb_build_object('testRun', $3::text)) RETURNING id`, [`phase19-${runToken}-tenant`, `Phase 19 Tenant ${runToken}`, runToken])).rows[0].id;
    const isolatedPromptKey = `isolated-prompt-${runToken}`;
    const isolatedPromptId = (await client.query(`INSERT INTO ai_prompts (tenant_id, prompt_key, name, module, current_version, latest_version) VALUES ($1, $2, 'Isolated', 'sales', 1, 1) RETURNING id`, [secondTenantId, isolatedPromptKey])).rows[0].id;
    await client.query(`INSERT INTO ai_prompt_versions (tenant_id, prompt_id, version, content, is_active) VALUES ($1, $2, 1, 'isolated', true)`, [secondTenantId, isolatedPromptId]);
    const isolatedAgentKey = `isolated-agent-${runToken}`;
    await client.query(`INSERT INTO ai_agents (tenant_id, agent_key, name, module, status) VALUES ($1, $2, 'Isolated Agent', 'sales', 'active')`, [secondTenantId, isolatedAgentKey]);

    await expectError(`/ai/prompts/${isolatedPromptId}`, { accessToken: adminSession.accessToken, expectedStatus: 404, expectedCode: "AI_PROMPT_NOT_FOUND" });
    const ownPromptSearch = await request(`/ai/prompts?search=${isolatedPromptKey}&pageSize=100`, { accessToken: adminSession.accessToken });
    assert.equal(ownPromptSearch.prompts.length, 0, "Prompts from another tenant must not be visible.");
    const ownAgents = await request("/ai/agents?pageSize=100", { accessToken: adminSession.accessToken });
    assert.ok(ownAgents.agents.every((agent) => agent.agentKey !== isolatedAgentKey), "Agents from another tenant must not be visible.");

    log("Phase 19 prompt and agent registry checks passed.");
  } finally {
    await client.end();
  }
}

await main();
