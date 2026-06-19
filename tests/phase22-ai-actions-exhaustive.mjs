import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

const apiBaseUrl = process.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4000/api/v1";
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://crm:crm@localhost:5433/crm";
const defaultTenantSlug = process.env.DEFAULT_TENANT_SLUG ?? "sample-tenant";
const runToken = randomUUID().replace(/-/g, "").slice(0, 10);

const EXPECTED_MODULES = ["leads", "accounts", "opportunities", "campaigns", "social", "support", "customer_success", "training", "partners", "resellers"];

const EXPECTED_ACTIONS = {
  leads: ["lead_summary", "lead_score_explanation", "lead_followup_email", "lead_qualification_recommendation"],
  accounts: ["account_brief", "account_relationship_summary", "account_health_explanation"],
  opportunities: ["opportunity_summary", "deal_risk_analysis", "next_best_action", "proposal_draft_outline"],
  campaigns: ["campaign_plan_generator", "email_copy_generator", "audience_suggestion", "campaign_performance_summary"],
  social: ["caption_generator", "hashtag_suggestion", "comment_sentiment_summary"],
  support: ["ticket_summary", "suggested_response", "knowledge_article_recommendation", "escalation_summary"],
  customer_success: ["onboarding_plan_generator", "customer_health_summary", "churn_risk_explanation", "adoption_recommendation", "qbr_ebr_outline", "renewal_strategy_suggestion"],
  training: ["lesson_summary", "quiz_generator", "learning_path_suggestion"],
  partners: ["partner_performance_summary", "partner_action_plan", "partner_inactivity_alert_explanation"],
  resellers: ["reseller_performance_summary", "reseller_action_plan", "reseller_inactivity_alert_explanation"]
};

const EXPECTED_SENSITIVE = new Set([
  "lead_followup_email", "lead_qualification_recommendation", "next_best_action", "proposal_draft_outline",
  "campaign_plan_generator", "email_copy_generator", "audience_suggestion", "caption_generator", "suggested_response",
  "onboarding_plan_generator", "adoption_recommendation", "qbr_ebr_outline", "renewal_strategy_suggestion",
  "partner_action_plan", "reseller_action_plan"
]);

function log(message) {
  console.log(`[phase22-exhaustive] ${message}`);
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
  const roleResult = await client.query(`INSERT INTO roles (tenant_id, slug, name, description, metadata) VALUES ($1, $2, $3, $4, jsonb_build_object('testRun', $5::text)) RETURNING id`, [tenantId, roleSlug, roleName, `${roleName} for phase 22 testing`, runToken]);
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
  assert.equal(row.status, "success");
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    log("Checking schema baseline.");
    const table = await queryOne(client, `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_action_runs' LIMIT 1`);
    assert.equal(table?.table_name, "ai_action_runs", "ai_action_runs should exist for Phase 22.");
    const tenant = await queryOne(client, `SELECT id FROM tenants WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`, [defaultTenantSlug]);
    assert.ok(tenant, "Default tenant should exist.");
    const tenantId = tenant.id;

    log("Creating AI admin, leads user, leads approver, and outsider users.");
    const adminPassword = `Adm!${runToken}99`;
    const leadsPassword = `Led!${runToken}99`;
    const approverPassword = `App!${runToken}99`;
    const outsiderPassword = `Out!${runToken}99`;
    await createUserWithPermissions(client, { tenantId, email: `aiadmin22-${runToken}@example.test`, password: adminPassword, firstName: "Ada", lastName: "Admin", roleSlug: `aiadmin22-${runToken}`, roleName: `AI Admin 22 ${runToken}`, permissionCodes: ["ai.manage_ai", "ai.approve", "ai.configure", "ai.use_ai"] });
    await createUserWithPermissions(client, { tenantId, email: `leads22-${runToken}@example.test`, password: leadsPassword, firstName: "Lee", lastName: "Leads", roleSlug: `leads22-${runToken}`, roleName: `Leads 22 ${runToken}`, permissionCodes: ["leads.view"] });
    await createUserWithPermissions(client, { tenantId, email: `approver22-${runToken}@example.test`, password: approverPassword, firstName: "Ame", lastName: "Approver", roleSlug: `approver22-${runToken}`, roleName: `Approver 22 ${runToken}`, permissionCodes: ["leads.approve"] });
    await createUserWithPermissions(client, { tenantId, email: `outsider22-${runToken}@example.test`, password: outsiderPassword, firstName: "Val", lastName: "Outsider", roleSlug: `outsider22-${runToken}`, roleName: `Outsider 22 ${runToken}`, permissionCodes: ["contacts.view"] });

    const adminSession = await loginSession(defaultTenantSlug, `aiadmin22-${runToken}@example.test`, adminPassword);
    const leadsSession = await loginSession(defaultTenantSlug, `leads22-${runToken}@example.test`, leadsPassword);
    const approverSession = await loginSession(defaultTenantSlug, `approver22-${runToken}@example.test`, approverPassword);
    const outsiderSession = await loginSession(defaultTenantSlug, `outsider22-${runToken}@example.test`, outsiderPassword);

    log("Ensuring the AI gateway is enabled and logging.");
    await request("/ai/settings", { method: "PATCH", accessToken: adminSession.accessToken, body: { isEnabled: true, loggingEnabled: true } });

    // ----------------------------------------------------------------------
    // Catalog
    // ----------------------------------------------------------------------
    log("Validating the full module AI action catalog.");
    const catalog = await request("/ai/actions", { accessToken: adminSession.accessToken });
    assert.ok(catalog.actions.length >= 37, "The catalog should expose actions across modules.");
    assert.equal(catalog.modules.length, EXPECTED_MODULES.length, "Ten modules should expose AI actions.");
    const templates = await request("/ai/templates", { accessToken: adminSession.accessToken });
    const templateByKey = new Map(templates.templates.map((t) => [t.key, t]));
    const actionByKey = new Map(catalog.actions.map((a) => [a.key, a]));

    // Every listed module action must exist, belong to its module, be sensitive
    // exactly when expected, reference a registered prompt template, and declare
    // variables matching that template (Prompt Registry consistency).
    for (const [module, keys] of Object.entries(EXPECTED_ACTIONS)) {
      assert.ok(catalog.modules.includes(module), `Module ${module} should expose AI actions.`);
      for (const key of keys) {
        const action = actionByKey.get(key);
        assert.ok(action, `Action ${key} should be present in the catalog.`);
        assert.equal(action.module, module, `Action ${key} should belong to ${module}.`);
        assert.ok(action.variables.length > 0, `Action ${key} should declare variables.`);
        assert.equal(action.sensitive, EXPECTED_SENSITIVE.has(key), `Action ${key} should have the expected sensitivity flag.`);
        const template = templateByKey.get(action.templateKey);
        assert.ok(template, `Action ${key} should reference a registered prompt template (${action.templateKey}).`);
        assert.deepEqual([...action.variables].sort(), [...template.variables].sort(), `Action ${key} variables should match its prompt template.`);
      }
    }
    // No action may reference an unregistered template (no hardcoded prompts).
    for (const action of catalog.actions) {
      assert.ok(templateByKey.has(action.templateKey), `Action ${action.key} must reference a registered template.`);
    }
    assert.ok(catalog.actions.every((a) => a.permitted === true), "An ai.manage_ai admin should be permitted to run every action.");

    log("Validating permitted flags and module filtering.");
    const leadsCatalog = await request("/ai/actions?module=leads", { accessToken: leadsSession.accessToken });
    assert.ok(leadsCatalog.actions.every((a) => a.module === "leads"), "Module filter should be applied.");
    assert.equal(leadsCatalog.actions.length, 4, "There should be four lead actions.");
    assert.ok(leadsCatalog.actions.every((a) => a.permitted === true), "A leads.view user should be permitted for lead actions.");
    const leadsFullCatalog = await request("/ai/actions", { accessToken: leadsSession.accessToken });
    assert.ok(leadsFullCatalog.actions.filter((a) => a.module === "accounts").every((a) => a.permitted === false), "A leads.view user should not be permitted for account actions.");
    const outsiderCatalog = await request("/ai/actions", { accessToken: outsiderSession.accessToken });
    assert.ok(outsiderCatalog.actions.every((a) => a.permitted === false), "An unrelated user should not be permitted for any action.");

    // ----------------------------------------------------------------------
    // Execute (non-sensitive) — permission, gateway, prompt registry, logging
    // ----------------------------------------------------------------------
    log("Executing a non-sensitive action and validating gateway/prompt/logging.");
    const nameValue = `Acme${runToken}`;
    const exec = await request("/ai/actions/lead_summary/execute", { method: "POST", accessToken: leadsSession.accessToken, expectedStatus: 201, body: { variables: { name: nameValue, company: "Globex", status: "new", source: "website" }, entityId: randomUUID() } });
    assert.equal(exec.run.status, "completed", "A non-sensitive action should complete.");
    assert.equal(exec.requiresReview, false);
    assert.equal(exec.run.reviewStatus, "not_required");
    assert.equal(exec.run.templateKey, "lead_summary", "The run should record the Prompt Registry template.");
    assert.ok(exec.run.provider.length > 0 && exec.run.model.length > 0, "The run should record the gateway provider and model (AI Gateway used).");
    assert.ok(exec.run.output.toLowerCase().includes("placeholder"), "The gateway should return governed placeholder output.");
    assert.ok(exec.run.resolvedPrompt.includes(nameValue), "The resolved prompt should substitute variables from the Prompt Registry template.");
    assert.ok(typeof exec.run.totalTokens === "number" && exec.run.totalTokens > 0, "The run should log usage tokens.");
    await assertAuditByAction(client, { tenantId, action: "ai.action.execute", resourceType: "ai_action_run" });

    log("Validating request/response logging in ai_action_runs and ai_usage_logs.");
    const runRow = await queryOne(client, `SELECT id, output, resolved_prompt, variables, metadata FROM ai_action_runs WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [exec.run.id, tenantId]);
    assert.ok(runRow, "The action run should be logged.");
    assert.equal(runRow.variables.name, nameValue, "The run should log the request variables.");
    assert.ok(runRow.output.length > 0, "The run should log the response output.");
    assert.ok(runRow.resolved_prompt.includes(nameValue), "The run should log the resolved prompt.");
    assert.ok(runRow.metadata.gatewayRequestId, "The run should link the gateway request id.");
    const usageRow = await queryOne(client, `SELECT id FROM ai_usage_logs WHERE tenant_id = $1 AND template_key = 'lead_summary' ORDER BY created_at DESC LIMIT 1`, [tenantId]);
    assert.ok(usageRow, "The gateway should write an ai_usage_logs entry for the action.");

    // ----------------------------------------------------------------------
    // Permission enforcement
    // ----------------------------------------------------------------------
    log("Validating per-action permission enforcement.");
    await expectError("/ai/actions/account_brief/execute", { method: "POST", accessToken: leadsSession.accessToken, expectedStatus: 403, expectedCode: "AUTHORIZATION_ERROR", body: { variables: { account: "X" } } });
    await expectError("/ai/actions/lead_summary/execute", { method: "POST", accessToken: outsiderSession.accessToken, expectedStatus: 403, expectedCode: "AUTHORIZATION_ERROR", body: { variables: { name: "X" } } });
    await expectError(`/ai/actions/nope-${runToken}/execute`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 404, expectedCode: "AI_ACTION_NOT_FOUND", body: { variables: {} } });
    await expectError("/ai/actions/lead_summary/execute", { method: "POST", accessToken: leadsSession.accessToken, expectedStatus: 400, expectedCode: "VALIDATION_ERROR", body: { variables: { name: "x" }, entityId: "not-a-uuid" } });

    // ----------------------------------------------------------------------
    // Sensitive actions — human review
    // ----------------------------------------------------------------------
    log("Executing a sensitive action and validating human review.");
    const sensitive = await request("/ai/actions/lead_followup_email/execute", { method: "POST", accessToken: leadsSession.accessToken, expectedStatus: 201, body: { variables: { contact: "Jordan", topic: "renewal" } } });
    assert.equal(sensitive.requiresReview, true, "Sensitive actions must require human review.");
    assert.equal(sensitive.run.status, "pending_review");
    assert.equal(sensitive.run.reviewStatus, "pending_review");

    await expectError(`/ai/actions/runs/${sensitive.run.id}/review`, { method: "POST", accessToken: leadsSession.accessToken, expectedStatus: 403, expectedCode: "AUTHORIZATION_ERROR", body: { decision: "approved" } });
    const approved = (await request(`/ai/actions/runs/${sensitive.run.id}/review`, { method: "POST", accessToken: approverSession.accessToken, body: { decision: "approved", note: "Looks good." } })).run;
    assert.equal(approved.reviewStatus, "approved", "A module approver should be able to approve a sensitive run.");
    assert.equal(approved.status, "completed");
    assert.ok(approved.reviewedBy, "The reviewer should be recorded.");
    await assertAuditByAction(client, { tenantId, action: "ai.action.review", resourceType: "ai_action_run" });
    await expectError(`/ai/actions/runs/${sensitive.run.id}/review`, { method: "POST", accessToken: approverSession.accessToken, expectedStatus: 400, expectedCode: "AI_ACTION_NOT_PENDING_REVIEW", body: { decision: "approved" } });

    log("Validating rejection flow.");
    const rejectable = await request("/ai/actions/lead_qualification_recommendation/execute", { method: "POST", accessToken: leadsSession.accessToken, expectedStatus: 201, body: { variables: { name: "Lead X", criteria: "budget, authority" } } });
    const rejected = (await request(`/ai/actions/runs/${rejectable.run.id}/review`, { method: "POST", accessToken: approverSession.accessToken, body: { decision: "rejected", note: "Needs work." } })).run;
    assert.equal(rejected.reviewStatus, "rejected");

    log("Validating the cross-cutting ai.approve reviewer path on a non-leads sensitive action.");
    const socialSensitive = await request("/ai/actions/caption_generator/execute", { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { variables: { topic: "launch", channel: "x", tone: "bold" } } });
    assert.equal(socialSensitive.requiresReview, true, "A social caption is a sensitive action.");
    assert.equal(socialSensitive.run.status, "pending_review");
    const socialApproved = (await request(`/ai/actions/runs/${socialSensitive.run.id}/review`, { method: "POST", accessToken: adminSession.accessToken, body: { decision: "approved" } })).run;
    assert.equal(socialApproved.reviewStatus, "approved", "An ai.approve reviewer should approve any module's sensitive action.");
    assert.ok(socialApproved.reviewedAt, "Approval time should be recorded.");
    await expectError(`/ai/actions/runs/${socialSensitive.run.id}/review`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 400, expectedCode: "VALIDATION_ERROR", body: { decision: "maybe" } });

    // ----------------------------------------------------------------------
    // Cross-module coverage
    // ----------------------------------------------------------------------
    log("Validating AI actions are available across every module.");
    const moduleProbe = {
      account_brief: { account: "Globex", industry: "tech", arr: "100k" },
      opportunity_summary: { name: "Deal", account: "Globex", stage: "proposal", amount: "50k" },
      campaign_performance_summary: { campaign: "Spring", sent: "1000", conversions: "40" },
      caption_generator: { topic: "launch", channel: "linkedin", tone: "excited" },
      ticket_summary: { subject: "Login issue", status: "open" },
      customer_health_summary: { account: "Globex", healthScore: "72", riskStatus: "low" },
      lesson_summary: { lessonTitle: "Getting started" },
      partner_performance_summary: { partner: "PartnerCo", dealCount: "12" },
      reseller_performance_summary: { reseller: "ResellCo", revenue: "200k", deals: "8" }
    };
    for (const [actionKey, variables] of Object.entries(moduleProbe)) {
      const res = await request(`/ai/actions/${actionKey}/execute`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { variables } });
      assert.ok(res.run.id, `Action ${actionKey} should execute.`);
    }

    // ----------------------------------------------------------------------
    // Observability
    // ----------------------------------------------------------------------
    log("Validating action run observability.");
    const runs = await request("/ai/actions/runs?pageSize=100", { accessToken: adminSession.accessToken });
    assert.ok(runs.runs.some((r) => r.id === exec.run.id), "Run observability should list executed runs.");
    const leadsRuns = await request("/ai/actions/runs?module=leads&pageSize=100", { accessToken: adminSession.accessToken });
    assert.ok(leadsRuns.runs.every((r) => r.module === "leads"), "Run module filter should be applied.");
    const pendingRuns = await request("/ai/actions/runs?reviewStatus=rejected&pageSize=100", { accessToken: adminSession.accessToken });
    assert.ok(pendingRuns.runs.every((r) => r.reviewStatus === "rejected"), "Run review-status filter should be applied.");
    const runDetail = await request(`/ai/actions/runs/${exec.run.id}`, { accessToken: adminSession.accessToken });
    assert.equal(runDetail.run.id, exec.run.id);
    await expectError("/ai/actions/runs", { accessToken: leadsSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN" });
    await expectError(`/ai/actions/runs/${randomUUID()}`, { accessToken: adminSession.accessToken, expectedStatus: 404, expectedCode: "AI_ACTION_RUN_NOT_FOUND" });

    // ----------------------------------------------------------------------
    // Tenant isolation
    // ----------------------------------------------------------------------
    log("Checking tenant isolation for action runs.");
    const secondTenantId = (await client.query(`INSERT INTO tenants (slug, name, status, metadata) VALUES ($1, $2, 'active', jsonb_build_object('testRun', $3::text)) RETURNING id`, [`phase22-${runToken}-tenant`, `Phase 22 Tenant ${runToken}`, runToken])).rows[0].id;
    const otherRunId = (await client.query(`INSERT INTO ai_action_runs (tenant_id, action_key, module, capability, template_key, output) VALUES ($1, 'lead_summary', 'leads', 'lead_summary', 'lead_summary', 'isolated') RETURNING id`, [secondTenantId])).rows[0].id;
    await expectError(`/ai/actions/runs/${otherRunId}`, { accessToken: adminSession.accessToken, expectedStatus: 404, expectedCode: "AI_ACTION_RUN_NOT_FOUND" });
    const ownRuns = await request("/ai/actions/runs?pageSize=100", { accessToken: adminSession.accessToken });
    assert.ok(ownRuns.runs.every((r) => r.id !== otherRunId), "Another tenant's action runs must not be visible.");

    log("Phase 22 AI actions checks passed.");
  } finally {
    await client.end();
  }
}

await main();
