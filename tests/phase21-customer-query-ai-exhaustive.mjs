import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

const apiBaseUrl = process.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4000/api/v1";
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://crm:crm@localhost:5433/crm";
const defaultTenantSlug = process.env.DEFAULT_TENANT_SLUG ?? "sample-tenant";
const runToken = randomUUID().replace(/-/g, "").slice(0, 10);

function log(message) {
  console.log(`[phase21-exhaustive] ${message}`);
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
  const roleResult = await client.query(`INSERT INTO roles (tenant_id, slug, name, description, metadata) VALUES ($1, $2, $3, $4, jsonb_build_object('testRun', $5::text)) RETURNING id`, [tenantId, roleSlug, roleName, `${roleName} for phase 21 testing`, runToken]);
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
    log("Checking schema and seed baseline.");
    for (const tableName of ["customer_query_sessions", "customer_query_messages", "customer_query_escalations"]) {
      const table = await queryOne(client, `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`, [tableName]);
      assert.equal(table?.table_name, tableName, `${tableName} should exist for Phase 21.`);
    }
    const tenant = await queryOne(client, `SELECT id FROM tenants WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`, [defaultTenantSlug]);
    assert.ok(tenant, "Default tenant should exist.");
    const tenantId = tenant.id;

    log("Creating knowledge admin, customer, reviewer, and outsider users.");
    const adminPassword = `Adm!${runToken}99`;
    const customerPassword = `Cus!${runToken}99`;
    const reviewerPassword = `Rev!${runToken}99`;
    const outsiderPassword = `Out!${runToken}99`;
    await createUserWithPermissions(client, { tenantId, email: `kadmin21-${runToken}@example.test`, password: adminPassword, firstName: "Ada", lastName: "Admin", roleSlug: `kadmin21-${runToken}`, roleName: `Knowledge Admin 21 ${runToken}`, permissionCodes: ["ai.configure"] });
    await createUserWithPermissions(client, { tenantId, email: `customer21-${runToken}@example.test`, password: customerPassword, firstName: "Cleo", lastName: "Customer", roleSlug: `customer21-${runToken}`, roleName: `Customer 21 ${runToken}`, permissionCodes: ["customer_query.use_ai"] });
    await createUserWithPermissions(client, { tenantId, email: `customer21b-${runToken}@example.test`, password: customerPassword, firstName: "Cyrus", lastName: "Customer", roleSlug: `customer21b-${runToken}`, roleName: `Customer B 21 ${runToken}`, permissionCodes: ["customer_query.use_ai"] });
    await createUserWithPermissions(client, { tenantId, email: `reviewer21-${runToken}@example.test`, password: reviewerPassword, firstName: "Rex", lastName: "Reviewer", roleSlug: `reviewer21-${runToken}`, roleName: `Reviewer 21 ${runToken}`, permissionCodes: ["customer_query.view", "customer_query.assign"] });
    await createUserWithPermissions(client, { tenantId, email: `outsider21-${runToken}@example.test`, password: outsiderPassword, firstName: "Val", lastName: "Outsider", roleSlug: `outsider21-${runToken}`, roleName: `Outsider 21 ${runToken}`, permissionCodes: ["leads.view"] });

    const adminSession = await loginSession(defaultTenantSlug, `kadmin21-${runToken}@example.test`, adminPassword);
    const customerSession = await loginSession(defaultTenantSlug, `customer21-${runToken}@example.test`, customerPassword);
    const customerBSession = await loginSession(defaultTenantSlug, `customer21b-${runToken}@example.test`, customerPassword);
    const reviewerSession = await loginSession(defaultTenantSlug, `reviewer21-${runToken}@example.test`, reviewerPassword);
    const outsiderSession = await loginSession(defaultTenantSlug, `outsider21-${runToken}@example.test`, outsiderPassword);

    log("Seeding approved knowledge (FAQ + restricted source) for retrieval.");
    const sources = (await request("/ai/knowledge/sources", { accessToken: adminSession.accessToken })).sources;
    const faqSource = sources.find((s) => s.sourceKey === "faqs");
    const customerSource = sources.find((s) => s.sourceKey === "customer_documents");
    assert.ok(faqSource && customerSource, "FAQ and customer document sources should be seeded.");

    const anchor = `Floomptiqual${runToken}`;
    const strongContent = Array.from({ length: 8 }, () => `To reset your ${anchor} password open settings and confirm the secure reset.`).join(" ");
    await request(`/ai/knowledge/sources/${faqSource.id}/documents`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { title: `Password reset ${runToken}`, content: strongContent } });

    const weakTerm = `Wuzzlefitch${runToken}`;
    await request(`/ai/knowledge/sources/${faqSource.id}/documents`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { title: `Weak ${runToken}`, content: `The ${weakTerm} indicator is shown in advanced settings for reference.` } });

    const restrictedTerm = `Restrictomatic${runToken}`;
    await request(`/ai/knowledge/sources/${customerSource.id}/documents`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { title: `Restricted ${runToken}`, content: `The ${restrictedTerm} confidential record is only for permitted roles and customers.` } });

    const workflowTerm = `Quibworkflow${runToken}`;
    const workflowContent = Array.from({ length: 8 }, () => `To fix the ${workflowTerm} workflow assignment, open configuration and adjust the workflow.`).join(" ");
    await request(`/ai/knowledge/sources/${faqSource.id}/documents`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { title: `Workflow help ${runToken}`, content: workflowContent } });

    // ----------------------------------------------------------------------
    // Permission guards on ask
    // ----------------------------------------------------------------------
    log("Validating ask permission guards and validation.");
    await expectError("/customer-query/ask", { method: "POST", accessToken: outsiderSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { query: "hello" } });
    await expectError("/customer-query/ask", { method: "POST", accessToken: reviewerSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { query: "hello" } });
    await expectError("/customer-query/ask", { method: "POST", accessToken: customerSession.accessToken, expectedStatus: 400, expectedCode: "VALIDATION_ERROR", body: { query: "" } });
    await expectError("/customer-query/ask", { method: "POST", accessToken: customerSession.accessToken, expectedStatus: 404, expectedCode: "CUSTOMER_QUERY_SESSION_NOT_FOUND", body: { query: "hi", sessionId: randomUUID() } });

    // ----------------------------------------------------------------------
    // Level 1 — confident, grounded answer
    // ----------------------------------------------------------------------
    log("Asking a Level 1 question and validating a grounded, cited answer.");
    const confident = await request("/customer-query/ask", { method: "POST", accessToken: customerSession.accessToken, body: { query: `How do I reset my ${anchor} password?` } });
    assert.equal(confident.result.queryLevel, 1, "A simple how-to should classify as Level 1.");
    assert.equal(confident.result.isGrounded, true, "The answer should be grounded in retrieved sources.");
    assert.ok(confident.result.citations.length >= 1, "The answer should retrieve approved sources.");
    assert.ok(confident.result.confidenceScore >= 0.4, "A strong match should produce a confident answer.");
    assert.equal(confident.result.escalated, false, "A confident Level 1 answer should not escalate.");
    assert.equal(confident.result.escalationReason, null);
    assert.equal(confident.result.relatedTicketId, null, "A confident answer should not create a ticket.");
    const topCitation = confident.result.citations[0];
    assert.ok(topCitation.sourceName, "Citations must name their source.");
    assert.ok(["document", "article"].includes(topCitation.kind), "Citations should declare their kind.");
    assert.ok(topCitation.sourceType, "Citations should carry the source type.");
    if (topCitation.kind === "document") {
      assert.ok(topCitation.documentId, "Document citations should reference a document.");
    }
    assert.ok(confident.result.answer.includes(topCitation.snippet), "The grounded answer must be composed from the retrieved snippet (no hallucination).");
    assert.equal(confident.session.status, "active");
    assert.ok(confident.session.subject.startsWith("How do I reset"), "The session subject should derive from the first question.");
    assert.equal(confident.session.messageCount, 2, "A question and an answer should be logged.");
    await assertAuditByAction(client, { tenantId, action: "ai.customer_query.ask", resourceType: "customer_query_session" });
    const confidentSessionId = confident.result.sessionId;

    log("Validating query and answer logging in the session.");
    const sessionDetail = (await request(`/customer-query/sessions/${confidentSessionId}`, { accessToken: customerSession.accessToken })).session;
    assert.equal(sessionDetail.messages.length, 2, "Both turns should be persisted.");
    assert.equal(sessionDetail.messages[0].role, "customer");
    assert.equal(sessionDetail.messages[0].queryLevel, 1);
    assert.equal(sessionDetail.messages[1].role, "assistant");
    assert.ok(sessionDetail.messages[1].citations.length >= 1, "The stored answer should carry its citations.");

    log("Continuing the same session.");
    const followUp = await request("/customer-query/ask", { method: "POST", accessToken: customerSession.accessToken, body: { query: `Where is the ${anchor} setting?`, sessionId: confidentSessionId } });
    assert.equal(followUp.result.sessionId, confidentSessionId, "A follow-up should reuse the session.");
    assert.equal(followUp.session.messageCount, 4, "The session should accumulate messages.");

    log("Asking a Level 2 question and validating troubleshooting classification without auto-escalation.");
    const level2 = await request("/customer-query/ask", { method: "POST", accessToken: customerSession.accessToken, body: { query: `My ${workflowTerm} workflow assignment is failing` } });
    assert.equal(level2.result.queryLevel, 2, "Workflow/assignment troubleshooting should classify as Level 2.");
    assert.equal(level2.result.isGrounded, true, "The Level 2 answer should be grounded.");
    assert.ok(level2.result.confidenceScore >= 0.4, "A strong Level 2 match should be confident.");
    assert.equal(level2.result.escalated, false, "A confident Level 2 question should not auto-escalate (only Level 3 always escalates).");

    log("Validating channel handling (in-app help panel).");
    const inApp = await request("/customer-query/ask", { method: "POST", accessToken: customerSession.accessToken, body: { query: `How do I open the ${anchor} settings?`, channel: "in_app" } });
    assert.equal(inApp.session.channel, "in_app", "The session channel should be recorded.");

    log("Validating non-owner session access is blocked.");
    await expectError(`/customer-query/sessions/${confidentSessionId}`, { accessToken: customerBSession.accessToken, expectedStatus: 403, expectedCode: "AUTHORIZATION_ERROR" });

    // ----------------------------------------------------------------------
    // Level 3 — always escalate + ticket
    // ----------------------------------------------------------------------
    log("Asking a Level 3 question and validating escalation and ticket creation.");
    const level3 = await request("/customer-query/ask", { method: "POST", accessToken: customerSession.accessToken, body: { query: "We have a security breach and a billing outage — this is critical." } });
    assert.equal(level3.result.queryLevel, 3, "Critical/security/billing should classify as Level 3.");
    assert.equal(level3.result.escalated, true, "Level 3 must always escalate.");
    assert.equal(level3.result.escalationReason, "level_3");
    assert.ok(level3.result.relatedTicketId, "Level 3 should create a support ticket.");
    assert.equal(level3.session.status, "escalated");
    assert.equal(level3.session.escalationLevel, 3);
    const ticket = await queryOne(client, `SELECT id, metadata FROM support_tickets WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [level3.result.relatedTicketId, tenantId]);
    assert.ok(ticket, "The support ticket should exist.");
    assert.equal(ticket.metadata.origin, "customer_query_ai", "The ticket should be marked as AI-originated.");
    const level3Escalation = await queryOne(client, `SELECT reason, related_ticket_id FROM customer_query_escalations WHERE tenant_id = $1 AND session_id = $2 ORDER BY created_at DESC LIMIT 1`, [tenantId, level3.result.sessionId]);
    assert.equal(level3Escalation.reason, "level_3");
    assert.equal(level3Escalation.related_ticket_id, level3.result.relatedTicketId);

    // ----------------------------------------------------------------------
    // No answer — escalate, gap, ticket
    // ----------------------------------------------------------------------
    log("Asking an unanswerable question and validating no-answer escalation and gap logging.");
    const nonsense = `Zxqwvtleam${runToken}`;
    const noAnswer = await request("/customer-query/ask", { method: "POST", accessToken: customerSession.accessToken, body: { query: nonsense } });
    assert.equal(noAnswer.result.isGrounded, false, "An unanswerable query should not be grounded.");
    assert.equal(noAnswer.result.escalated, true);
    assert.equal(noAnswer.result.escalationReason, "no_answer");
    assert.equal(noAnswer.result.gapLogged, true, "An unanswerable query should log a knowledge gap.");
    assert.ok(noAnswer.result.relatedTicketId, "An unanswerable query should create a ticket.");
    assert.ok(noAnswer.result.answer.toLowerCase().includes("couldn't find") || !noAnswer.result.isGrounded, "The bot must not fabricate an answer.");

    // ----------------------------------------------------------------------
    // Low confidence — escalate, no ticket
    // ----------------------------------------------------------------------
    log("Asking a weakly-matched question and validating low-confidence escalation.");
    const lowConf = await request("/customer-query/ask", { method: "POST", accessToken: customerSession.accessToken, body: { query: weakTerm } });
    assert.equal(lowConf.result.queryLevel, 1);
    assert.ok(lowConf.result.citations.length >= 1, "There should be a weak match.");
    assert.ok(lowConf.result.confidenceScore < 0.4, "A single weak match should be low confidence.");
    assert.equal(lowConf.result.escalated, true);
    assert.equal(lowConf.result.escalationReason, "low_confidence");
    assert.equal(lowConf.result.relatedTicketId, null, "Low confidence should escalate for review without a ticket.");

    log("Validating manual support ticket creation from an unresolved session.");
    const ticketSession = (await request(`/customer-query/sessions/${lowConf.result.sessionId}/ticket`, { method: "POST", accessToken: customerSession.accessToken, expectedStatus: 201, body: { note: "I still need help with this." } })).session;
    assert.ok(ticketSession.relatedTicketId, "Creating a ticket should link it to the session.");
    assert.equal(ticketSession.status, "escalated", "Creating a ticket should escalate the session.");
    const manualTicket = await queryOne(client, `SELECT id, metadata FROM support_tickets WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [ticketSession.relatedTicketId, tenantId]);
    assert.ok(manualTicket, "The manually-created ticket should exist.");
    assert.equal(manualTicket.metadata.origin, "customer_query_ai");
    await assertAuditByAction(client, { tenantId, action: "ai.customer_query.ticket", resourceType: "customer_query_session" });

    // ----------------------------------------------------------------------
    // Permission-aware retrieval — restricted source not used
    // ----------------------------------------------------------------------
    log("Validating permission-aware retrieval (restricted source is not used).");
    const restricted = await request("/customer-query/ask", { method: "POST", accessToken: customerSession.accessToken, body: { query: restrictedTerm } });
    assert.equal(restricted.result.isGrounded, false, "A customer without the gating permission must not retrieve restricted content.");
    assert.equal(restricted.result.escalationReason, "no_answer");

    // ----------------------------------------------------------------------
    // Feedback
    // ----------------------------------------------------------------------
    log("Capturing helpful/not-helpful feedback.");
    const helpfulSession = (await request(`/customer-query/sessions/${confidentSessionId}/feedback`, { method: "POST", accessToken: customerSession.accessToken, body: { feedback: "helpful", messageId: confident.result.answerMessageId } })).session;
    const ratedMessage = helpfulSession.messages.find((m) => m.id === confident.result.answerMessageId);
    assert.equal(ratedMessage.feedback, "helpful", "Feedback should be recorded on the answer.");
    await assertAuditByAction(client, { tenantId, action: "ai.customer_query.feedback", resourceType: "customer_query_session" });
    await request(`/customer-query/sessions/${level3.result.sessionId}/feedback`, { method: "POST", accessToken: customerSession.accessToken, body: { feedback: "not_helpful" } });
    await expectError(`/customer-query/sessions/${confidentSessionId}/feedback`, { method: "POST", accessToken: customerSession.accessToken, expectedStatus: 404, expectedCode: "CUSTOMER_QUERY_MESSAGE_NOT_FOUND", body: { feedback: "helpful", messageId: randomUUID() } });

    // ----------------------------------------------------------------------
    // Review, dashboard, gaps, resolve
    // ----------------------------------------------------------------------
    log("Validating support/customer-success review surfaces.");
    await expectError("/customer-query/sessions", { accessToken: customerSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN" });
    await expectError("/customer-query/dashboard", { accessToken: customerSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN" });
    const sessionList = await request("/customer-query/sessions?pageSize=100", { accessToken: reviewerSession.accessToken });
    assert.ok(sessionList.sessions.some((s) => s.id === confidentSessionId), "Reviewers should see query sessions.");
    const escalatedList = await request("/customer-query/sessions?escalated=true&pageSize=100", { accessToken: reviewerSession.accessToken });
    assert.ok(escalatedList.sessions.every((s) => s.status === "escalated"), "The escalated filter should be applied.");

    const dashboard = await request("/customer-query/dashboard", { accessToken: reviewerSession.accessToken });
    assert.ok(dashboard.totalSessions >= 5, "The dashboard should count sessions.");
    assert.ok(dashboard.escalatedSessions >= 1 && dashboard.totalQuestions >= 5, "The dashboard should report questions and escalations.");
    assert.ok(dashboard.helpfulCount >= 1 && dashboard.notHelpfulCount >= 1, "The dashboard should aggregate feedback.");
    assert.ok(dashboard.ticketsCreated >= 1, "The dashboard should count created tickets.");
    assert.ok(dashboard.groundedAnswers >= 1, "The dashboard should count grounded answers.");
    assert.ok(dashboard.averageConfidence >= 0 && dashboard.averageConfidence <= 1, "Average confidence should be a 0..1 ratio.");
    assert.ok(dashboard.levelDistribution.find((l) => l.level === 1).count >= 1, "The dashboard should report a Level 1 question.");
    assert.ok(dashboard.levelDistribution.find((l) => l.level === 2).count >= 1, "The dashboard should report a Level 2 question.");
    assert.ok(dashboard.levelDistribution.find((l) => l.level === 3).count >= 1, "The dashboard should report a Level 3 question.");
    assert.ok(dashboard.escalationReasonDistribution.some((r) => r.reason === "level_3"), "Escalation reasons should be distributed.");

    const gaps = await request("/customer-query/knowledge-gaps", { accessToken: reviewerSession.accessToken });
    assert.ok(gaps.gaps.some((g) => g.queryText === nonsense), "The unanswered query should appear as a knowledge gap.");

    log("Validating escalate and resolve.");
    const escalation = await request(`/customer-query/sessions/${confidentSessionId}/escalate`, { method: "POST", accessToken: customerSession.accessToken, expectedStatus: 201, body: { reason: "customer_request", note: "Please review." } });
    assert.equal(escalation.escalation.reason, "customer_request");
    assert.equal(escalation.session.status, "escalated");
    await expectError(`/customer-query/sessions/${confidentSessionId}/resolve`, { method: "POST", accessToken: customerSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: {} });
    const resolved = (await request(`/customer-query/sessions/${confidentSessionId}/resolve`, { method: "POST", accessToken: reviewerSession.accessToken, body: { note: "Resolved by review." } })).session;
    assert.equal(resolved.status, "resolved", "Reviewers should be able to resolve sessions.");
    assert.ok(resolved.escalations.every((e) => e.status === "resolved"), "Resolving a session should resolve its escalations.");
    await assertAuditByAction(client, { tenantId, action: "ai.customer_query.escalate", resourceType: "customer_query_session" });
    await assertAuditByAction(client, { tenantId, action: "ai.customer_query.resolve", resourceType: "customer_query_session" });

    // ----------------------------------------------------------------------
    // Tenant isolation
    // ----------------------------------------------------------------------
    log("Checking tenant isolation.");
    const secondTenantId = (await client.query(`INSERT INTO tenants (slug, name, status, metadata) VALUES ($1, $2, 'active', jsonb_build_object('testRun', $3::text)) RETURNING id`, [`phase21-${runToken}-tenant`, `Phase 21 Tenant ${runToken}`, runToken])).rows[0].id;
    const otherSessionId = (await client.query(`INSERT INTO customer_query_sessions (tenant_id, subject, channel) VALUES ($1, 'Isolated', 'customer_portal') RETURNING id`, [secondTenantId])).rows[0].id;
    await expectError(`/customer-query/sessions/${otherSessionId}`, { accessToken: reviewerSession.accessToken, expectedStatus: 404, expectedCode: "CUSTOMER_QUERY_SESSION_NOT_FOUND" });
    const ownList = await request("/customer-query/sessions?pageSize=100", { accessToken: reviewerSession.accessToken });
    assert.ok(ownList.sessions.every((s) => s.id !== otherSessionId), "Another tenant's sessions must not be visible.");

    log("Phase 21 customer query AI checks passed.");
  } finally {
    await client.end();
  }
}

await main();
