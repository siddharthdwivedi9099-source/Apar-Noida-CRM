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

const supportOptionSetKeys = [
  "support-ticket-status",
  "support-ticket-priority",
  "support-ticket-category",
  "support-ticket-source",
  "support-knowledge-category"
];

function log(message) {
  console.log(`[phase15-exhaustive] ${message}`);
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

async function request(path, { method = "GET", accessToken, body, expectedStatus = 200 } = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
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
  for (const tableName of ["support_sla_policies", "support_tickets", "support_ticket_messages", "support_knowledge_articles", "support_ticket_articles"]) {
    const table = await queryOne(
      client,
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
      [tableName]
    );
    assert.equal(table?.table_name, tableName, `${tableName} should exist for Phase 15.`);
  }
}

async function assertSeedBaseline(client) {
  const tenant = await queryOne(client, `SELECT id, status FROM tenants WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`, [defaultTenantSlug]);
  assert.ok(tenant, "Default tenant should exist.");
  assert.equal(tenant.status, "active");

  const optionSetCount = await queryOne(
    client,
    `SELECT COUNT(*)::int AS count FROM tenant_option_sets WHERE tenant_id = $1 AND deleted_at IS NULL AND set_key = ANY($2::text[])`,
    [tenant.id, supportOptionSetKeys]
  );
  assert.equal(optionSetCount.count, supportOptionSetKeys.length, "Phase 15 option sets should be seeded.");

  const permissionCount = await queryOne(client, `SELECT COUNT(*)::int AS count FROM permissions WHERE code LIKE 'support.%' AND deleted_at IS NULL`);
  assert.equal(permissionCount.count, 13, "support permission catalog should be seeded.");

  return { tenantId: tenant.id };
}

async function createUserWithPermissions(client, { tenantId, email, password, firstName, lastName, roleSlug, roleName, permissionCodes }) {
  const roleResult = await client.query(
    `INSERT INTO roles (tenant_id, slug, name, description, metadata) VALUES ($1, $2, $3, $4, jsonb_build_object('testRun', $5::text)) RETURNING id`,
    [tenantId, roleSlug, roleName, `${roleName} for phase 15 testing`, runToken]
  );
  const roleId = roleResult.rows[0].id;

  await client.query(
    `INSERT INTO role_permissions (tenant_id, role_id, permission_id, metadata)
     SELECT $1, $2, permissions.id, jsonb_build_object('testRun', $4::text)
     FROM permissions WHERE permissions.code = ANY($3::text[]) AND permissions.deleted_at IS NULL`,
    [tenantId, roleId, permissionCodes, runToken]
  );

  const displayName = `${firstName} ${lastName}`.trim();
  const userResult = await client.query(
    `INSERT INTO users (tenant_id, email, normalized_email, first_name, last_name, display_name, password_hash, status, password_changed_at, metadata)
     VALUES ($1, $2, LOWER($2), $3, $4, $5, crypt($6, gen_salt('bf')), 'active', NOW(), jsonb_build_object('testRun', $7::text)) RETURNING id`,
    [tenantId, email, firstName, lastName, displayName, password, runToken]
  );
  const userId = userResult.rows[0].id;

  await client.query(
    `INSERT INTO user_roles (tenant_id, user_id, role_id, metadata) VALUES ($1, $2, $3, jsonb_build_object('testRun', $4::text))`,
    [tenantId, userId, roleId, runToken]
  );

  return { userId, roleId, displayName };
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

    log("Creating support agent, assign-only, support viewer, and unrelated viewer users.");
    const agentPassword = `Agent!${runToken}99`;
    const assignPassword = `Assign!${runToken}99`;
    const supportViewerPassword = `SView!${runToken}99`;
    const viewerPassword = `View!${runToken}99`;
    const agentUser = await createUserWithPermissions(client, {
      tenantId,
      email: `agent-${runToken}@example.test`,
      password: agentPassword,
      firstName: "Asha",
      lastName: "Agent",
      roleSlug: `support-agent-phase15-${runToken}`,
      roleName: `Support Agent Phase15 ${runToken}`,
      permissionCodes: ["support.view", "support.create", "support.edit", "ai.use_ai"]
    });
    const assignUser = await createUserWithPermissions(client, {
      tenantId,
      email: `assign-${runToken}@example.test`,
      password: assignPassword,
      firstName: "Avi",
      lastName: "Assign",
      roleSlug: `support-assign-phase15-${runToken}`,
      roleName: `Support Assign Phase15 ${runToken}`,
      permissionCodes: ["support.view", "support.assign"]
    });
    await createUserWithPermissions(client, {
      tenantId,
      email: `sview-${runToken}@example.test`,
      password: supportViewerPassword,
      firstName: "Sara",
      lastName: "Viewer",
      roleSlug: `support-view-phase15-${runToken}`,
      roleName: `Support View Phase15 ${runToken}`,
      permissionCodes: ["support.view"]
    });
    await createUserWithPermissions(client, {
      tenantId,
      email: `viewer15-${runToken}@example.test`,
      password: viewerPassword,
      firstName: "Val",
      lastName: "Outsider",
      roleSlug: `viewer15-phase15-${runToken}`,
      roleName: `Viewer Phase15 ${runToken}`,
      permissionCodes: ["leads.view"]
    });

    const agentSession = await loginSession(defaultTenantSlug, `agent-${runToken}@example.test`, agentPassword);
    const assignSession = await loginSession(defaultTenantSlug, `assign-${runToken}@example.test`, assignPassword);
    const supportViewerSession = await loginSession(defaultTenantSlug, `sview-${runToken}@example.test`, supportViewerPassword);
    const viewerSession = await loginSession(defaultTenantSlug, `viewer15-${runToken}@example.test`, viewerPassword);

    log("Creating supporting account and contact.");
    const account = await request("/accounts", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: { name: `Phase15 Account ${runToken}`, website: "https://p15.example.test", industry: "Technology" }
    });
    const accountId = account.account.id;
    const contact = await request("/contacts", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: { firstName: "Tara", lastName: `Ticket ${runToken}`, email: `tara-${runToken}@example.test`, accountId }
    });
    const contactId = contact.contact.id;

    log("Validating support options and option-set seeding.");
    const options = await request("/support/options", { accessToken: agentSession.accessToken });
    assert.ok(options.priorities.some((entry) => entry.key === "urgent"));
    assert.ok(options.categories.some((entry) => entry.key === "billing"));
    assert.ok(options.sources.some((entry) => entry.key === "portal"));
    assert.ok(options.knowledgeCategories.some((entry) => entry.key === "troubleshooting"));
    assert.ok(options.statuses.some((entry) => entry.key === "resolved"));

    log("Validating SLA policy configuration permission and creation.");
    await expectError("/support/sla-policies", {
      method: "POST",
      accessToken: agentSession.accessToken,
      expectedStatus: 403,
      expectedCode: "FORBIDDEN",
      body: { name: `Blocked SLA ${runToken}`, firstResponseMinutes: 60, resolutionMinutes: 240 }
    });
    const slaPolicy = await request("/support/sla-policies", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: { name: `Gold SLA ${runToken}`, priorityKey: "high", firstResponseMinutes: 60, resolutionMinutes: 240 }
    });
    const slaPolicyId = slaPolicy.policy.id;
    assert.equal(slaPolicy.policy.firstResponseMinutes, 60);
    assert.equal(slaPolicy.policy.resolutionMinutes, 240);
    assert.equal(slaPolicy.policy.priority?.key, "high");

    const slaList = await request("/support/sla-policies", { accessToken: agentSession.accessToken });
    assert.ok(slaList.policies.some((entry) => entry.id === slaPolicyId), "SLA policy list should include the new policy.");

    log("Creating a knowledge base article.");
    const article = await request("/support/knowledge-articles", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: { title: `Reset Guide ${runToken}`, categoryKey: "troubleshooting", summary: "How to reset.", status: "published" }
    });
    const articleId = article.article.id;
    assert.equal(article.article.category?.key, "troubleshooting");
    assert.equal(article.article.status, "published");
    const articleList = await request("/support/knowledge-articles", { accessToken: agentSession.accessToken });
    assert.ok(articleList.articles.some((entry) => entry.id === articleId), "Knowledge article list should include the new article.");

    log("Validating ticket creation, viewer restriction, and SLA due-date calculation.");
    await expectError("/support/tickets", {
      method: "POST",
      accessToken: viewerSession.accessToken,
      expectedStatus: 403,
      expectedCode: "FORBIDDEN",
      body: { subject: "Blocked ticket" }
    });
    await expectError("/support/tickets", {
      method: "POST",
      accessToken: agentSession.accessToken,
      expectedStatus: 400,
      expectedCode: "INVALID_OPTION_VALUE",
      body: { subject: `Bad priority ${runToken}`, priorityKey: "nonexistent" }
    });

    const createdTicket = await request("/support/tickets", {
      method: "POST",
      accessToken: agentSession.accessToken,
      expectedStatus: 201,
      body: {
        subject: `Login failure ${runToken}`,
        description: "Customer cannot log in.",
        priorityKey: "high",
        categoryKey: "technical",
        sourceKey: "email",
        accountId,
        contactId,
        customerSuccessAccountId: accountId,
        assigneeId: agentUser.userId,
        slaPolicyId,
        rootCause: "Auth provider outage"
      }
    });
    const ticketId = createdTicket.ticket.id;
    assert.equal(createdTicket.ticket.priority?.key, "high");
    assert.equal(createdTicket.ticket.category?.key, "technical");
    assert.equal(createdTicket.ticket.source?.key, "email");
    assert.equal(createdTicket.ticket.status?.key, "new");
    assert.equal(createdTicket.ticket.account?.id, accountId);
    assert.equal(createdTicket.ticket.contact?.id, contactId);
    assert.equal(createdTicket.ticket.customerSuccessAccount?.id, accountId);
    assert.equal(createdTicket.ticket.assignee?.id, agentUser.userId);
    assert.equal(createdTicket.ticket.rootCause, "Auth provider outage");
    assert.equal(createdTicket.ticket.sla.policy?.id, slaPolicyId);
    assert.ok(createdTicket.ticket.sla.firstResponseDueAt, "First response due date should be calculated.");
    assert.ok(createdTicket.ticket.sla.resolutionDueAt, "Resolution due date should be calculated.");
    assert.equal(createdTicket.ticket.sla.firstResponseBreached, false);
    assert.equal(createdTicket.ticket.sla.resolutionBreached, false);
    assert.deepEqual(
      createdTicket.ticket.aiPlaceholders.actions.map((action) => action.key).sort(),
      ["escalation_recommendation", "knowledge_recommendation", "similar_tickets", "suggested_response", "ticket_classification", "ticket_summary"],
      "Support AI placeholders should expose the full Phase 15 action set."
    );
    assert.equal(createdTicket.ticket.attachmentsPlaceholder.available, false);
    assert.equal(createdTicket.ticket.csatPlaceholder.available, false);
    assert.equal(createdTicket.ticket.escalationPlaceholder.available, false);
    assert.equal(createdTicket.ticket.escalationStatus, "none", "New tickets should start with no escalation.");

    const createdAtMs = new Date(createdTicket.ticket.createdAt).getTime();
    const firstDiffMin = Math.round((new Date(createdTicket.ticket.sla.firstResponseDueAt).getTime() - createdAtMs) / 60000);
    const resolutionDiffMin = Math.round((new Date(createdTicket.ticket.sla.resolutionDueAt).getTime() - createdAtMs) / 60000);
    assert.ok(Math.abs(firstDiffMin - 60) <= 1, `First response due should be ~60 minutes after creation (got ${firstDiffMin}).`);
    assert.ok(Math.abs(resolutionDiffMin - 240) <= 1, `Resolution due should be ~240 minutes after creation (got ${resolutionDiffMin}).`);

    log("Validating ticket list, filters, and dashboard.");
    const list = await request("/support/tickets?pageSize=100", { accessToken: agentSession.accessToken });
    assert.ok(list.tickets.some((entry) => entry.id === ticketId), "Ticket list should include the created ticket.");
    const priorityFiltered = await request("/support/tickets?priority=high&category=technical&source=email", { accessToken: agentSession.accessToken });
    assert.ok(priorityFiltered.tickets.some((entry) => entry.id === ticketId), "Ticket filters should match.");
    const searchFiltered = await request(`/support/tickets?search=Login%20failure%20${runToken}`, { accessToken: agentSession.accessToken });
    assert.ok(searchFiltered.tickets.some((entry) => entry.id === ticketId), "Ticket search filter should match.");
    const assigneeFiltered = await request(`/support/tickets?assigneeId=${agentUser.userId}`, { accessToken: agentSession.accessToken });
    assert.ok(assigneeFiltered.tickets.some((entry) => entry.id === ticketId), "Assignee filter should match.");
    const statusFiltered = await request("/support/tickets?status=new&sortBy=createdAt&sortOrder=desc", { accessToken: agentSession.accessToken });
    assert.ok(statusFiltered.tickets.some((entry) => entry.id === ticketId), "Status filter and sort should match.");
    const accountFiltered = await request(`/support/tickets?accountId=${accountId}`, { accessToken: agentSession.accessToken });
    assert.ok(accountFiltered.tickets.some((entry) => entry.id === ticketId), "Account filter should match.");
    const statusMissFiltered = await request("/support/tickets?status=closed", { accessToken: agentSession.accessToken });
    assert.ok(!statusMissFiltered.tickets.some((entry) => entry.id === ticketId), "Status filter should exclude other statuses.");

    const dashboard = await request("/support/dashboard", { accessToken: agentSession.accessToken });
    assert.ok(dashboard.totalTickets >= 1, "Dashboard should count tickets.");
    assert.ok(dashboard.openTickets >= 1, "Dashboard should count open tickets.");
    assert.ok(dashboard.knowledgeArticleCount >= 1, "Dashboard should count knowledge articles.");
    assert.equal(dashboard.csatPlaceholder.available, false);

    log("Adding internal note and customer reply (first-response tracking).");
    const afterNote = await request(`/support/tickets/${ticketId}/messages`, {
      method: "POST",
      accessToken: agentSession.accessToken,
      expectedStatus: 201,
      body: { messageType: "internal_note", body: "Investigating with the auth team." }
    });
    assert.equal(afterNote.ticket.messages.length, 1);
    assert.equal(afterNote.ticket.sla.firstResponseAt, null, "Internal notes should not record the first response.");

    const afterReply = await request(`/support/tickets/${ticketId}/messages`, {
      method: "POST",
      accessToken: agentSession.accessToken,
      expectedStatus: 201,
      body: { messageType: "customer_reply", body: "We are looking into your issue." }
    });
    assert.equal(afterReply.ticket.messages.length, 2);
    assert.ok(afterReply.ticket.sla.firstResponseAt, "The first customer reply should record the first response time.");

    log("Linking a knowledge article to the ticket.");
    await expectError(`/support/tickets/${ticketId}/articles`, {
      method: "POST",
      accessToken: agentSession.accessToken,
      expectedStatus: 400,
      expectedCode: "INVALID_ARTICLE",
      body: { articleId: randomUUID() }
    });
    const linked = await request(`/support/tickets/${ticketId}/articles`, {
      method: "POST",
      accessToken: agentSession.accessToken,
      expectedStatus: 201,
      body: { articleId }
    });
    assert.equal(linked.ticket.articles.length, 1);
    assert.equal(linked.ticket.articles[0].id, articleId);
    const relinked = await request(`/support/tickets/${ticketId}/articles`, {
      method: "POST",
      accessToken: agentSession.accessToken,
      expectedStatus: 201,
      body: { articleId }
    });
    assert.equal(relinked.ticket.articles.length, 1, "Linking the same article twice should not duplicate it.");

    log("Validating the assignment-only authorization guard.");
    const reassigned = await request(`/support/tickets/${ticketId}`, {
      method: "PATCH",
      accessToken: assignSession.accessToken,
      body: { assigneeId: assignUser.userId }
    });
    assert.equal(reassigned.ticket.assignee?.id, assignUser.userId, "Assign-only role should reassign tickets.");
    await expectError(`/support/tickets/${ticketId}`, {
      method: "PATCH",
      accessToken: assignSession.accessToken,
      expectedStatus: 403,
      expectedCode: "AUTHORIZATION_ERROR",
      body: { subject: "Assign-only cannot edit subject" }
    });

    log("Updating escalation status, priority, and category.");
    const escalated = await request(`/support/tickets/${ticketId}`, {
      method: "PATCH",
      accessToken: agentSession.accessToken,
      body: { escalationStatus: "escalated", priorityKey: "urgent", categoryKey: "billing" }
    });
    assert.equal(escalated.ticket.escalationStatus, "escalated");
    assert.equal(escalated.ticket.priority?.key, "urgent");
    assert.equal(escalated.ticket.category?.key, "billing");

    log("Updating ticket status and verifying resolved_at maintenance.");
    const resolved = await request(`/support/tickets/${ticketId}`, {
      method: "PATCH",
      accessToken: agentSession.accessToken,
      body: { statusKey: "resolved", resolutionNotes: "Auth provider recovered." }
    });
    assert.equal(resolved.ticket.status?.key, "resolved");
    assert.equal(resolved.ticket.resolutionNotes, "Auth provider recovered.");
    assert.ok(resolved.ticket.sla.resolvedAt, "Resolving a ticket should set resolved_at.");

    const reopened = await request(`/support/tickets/${ticketId}`, {
      method: "PATCH",
      accessToken: agentSession.accessToken,
      body: { statusKey: "in_progress" }
    });
    assert.equal(reopened.ticket.status?.key, "in_progress");
    assert.equal(reopened.ticket.sla.resolvedAt, null, "Reopening a ticket should clear resolved_at.");

    log("Forcing an SLA breach and verifying breach detection plus the breachedOnly filter.");
    await client.query(
      `UPDATE support_tickets SET first_response_due_at = NOW() - INTERVAL '2 hours', resolution_due_at = NOW() - INTERVAL '1 hour', first_response_at = NULL WHERE id = $1 AND tenant_id = $2`,
      [ticketId, tenantId]
    );
    const breached = await request(`/support/tickets/${ticketId}`, { accessToken: adminSession.accessToken });
    assert.equal(breached.ticket.sla.firstResponseBreached, true, "Past first-response due date should be breached.");
    assert.equal(breached.ticket.sla.resolutionBreached, true, "Past resolution due date should be breached.");
    const breachedList = await request("/support/tickets?breachedOnly=true&pageSize=100", { accessToken: adminSession.accessToken });
    assert.ok(breachedList.tickets.some((entry) => entry.id === ticketId), "breachedOnly filter should include the breached ticket.");

    log("Validating escalation filter and dashboard distributions.");
    const escalationFiltered = await request("/support/tickets?escalationStatus=escalated&pageSize=100", { accessToken: adminSession.accessToken });
    assert.ok(escalationFiltered.tickets.some((entry) => entry.id === ticketId), "Escalation filter should include the escalated ticket.");
    const adminDashboard = await request("/support/dashboard", { accessToken: adminSession.accessToken });
    assert.ok(adminDashboard.escalatedTickets >= 1, "Dashboard should count escalated tickets.");
    assert.ok(adminDashboard.slaBreachedTickets >= 1, "Dashboard should count SLA-breached tickets.");
    assert.ok(adminDashboard.statusDistribution.length >= 1, "Dashboard should report a status distribution.");
    assert.ok(adminDashboard.priorityDistribution.length >= 1, "Dashboard should report a priority distribution.");

    log("Checking not-found guard and tenant isolation.");
    await expectError(`/support/tickets/${randomUUID()}`, {
      accessToken: agentSession.accessToken,
      expectedStatus: 404,
      expectedCode: "TICKET_NOT_FOUND"
    });

    const secondTenantResult = await client.query(
      `INSERT INTO tenants (slug, name, status, metadata) VALUES ($1, $2, 'active', jsonb_build_object('testRun', $3::text)) RETURNING id`,
      [`phase15-${runToken}-tenant`, `Phase 15 Tenant ${runToken}`, runToken]
    );
    const secondTenantId = secondTenantResult.rows[0].id;
    const secondStatusSet = await client.query(
      `INSERT INTO tenant_option_sets (tenant_id, set_key, module_key, kind, name, description, is_system_set, metadata)
       VALUES ($1, 'support-ticket-status', 'support', 'ticket_status', 'Status', 'status', false, jsonb_build_object('clonedFor', $2::text)) RETURNING id`,
      [secondTenantId, runToken]
    );
    const secondPrioritySet = await client.query(
      `INSERT INTO tenant_option_sets (tenant_id, set_key, module_key, kind, name, description, is_system_set, metadata)
       VALUES ($1, 'support-ticket-priority', 'support', 'dropdown', 'Priority', 'priority', false, jsonb_build_object('clonedFor', $2::text)) RETURNING id`,
      [secondTenantId, runToken]
    );
    const secondCategorySet = await client.query(
      `INSERT INTO tenant_option_sets (tenant_id, set_key, module_key, kind, name, description, is_system_set, metadata)
       VALUES ($1, 'support-ticket-category', 'support', 'dropdown', 'Category', 'category', false, jsonb_build_object('clonedFor', $2::text)) RETURNING id`,
      [secondTenantId, runToken]
    );
    const secondSourceSet = await client.query(
      `INSERT INTO tenant_option_sets (tenant_id, set_key, module_key, kind, name, description, is_system_set, metadata)
       VALUES ($1, 'support-ticket-source', 'support', 'dropdown', 'Source', 'source', false, jsonb_build_object('clonedFor', $2::text)) RETURNING id`,
      [secondTenantId, runToken]
    );
    async function insertOption(setId, key) {
      const row = await client.query(
        `INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, sort_order, is_default, is_active, metadata)
         VALUES ($1, $2, $3, $3, 0, true, true, jsonb_build_object('clonedFor', $4::text)) RETURNING id`,
        [secondTenantId, setId, key, runToken]
      );
      return row.rows[0].id;
    }
    const secondStatusId = await insertOption(secondStatusSet.rows[0].id, "new");
    const secondPriorityId = await insertOption(secondPrioritySet.rows[0].id, "medium");
    const secondCategoryId = await insertOption(secondCategorySet.rows[0].id, "technical");
    const secondSourceId = await insertOption(secondSourceSet.rows[0].id, "email");
    const secondTenantTicket = await client.query(
      `INSERT INTO support_tickets (tenant_id, subject, status_option_id, priority_option_id, category_option_id, source_option_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, jsonb_build_object('testRun', $7::text)) RETURNING id`,
      [secondTenantId, `Isolated Ticket ${runToken}`, secondStatusId, secondPriorityId, secondCategoryId, secondSourceId, runToken]
    );
    const secondTenantTicketId = secondTenantTicket.rows[0].id;

    await expectError(`/support/tickets/${secondTenantTicketId}`, {
      accessToken: adminSession.accessToken,
      expectedStatus: 404,
      expectedCode: "TICKET_NOT_FOUND"
    });

    log("Confirming a support.view role can read but not mutate, then soft-deleting the ticket.");
    const viewerRead = await request(`/support/tickets/${ticketId}`, { accessToken: supportViewerSession.accessToken });
    assert.equal(viewerRead.ticket.id, ticketId, "A support.view role should read ticket detail.");
    await expectError(`/support/tickets/${ticketId}`, {
      method: "PATCH",
      accessToken: supportViewerSession.accessToken,
      expectedStatus: 403,
      expectedCode: "FORBIDDEN",
      body: { statusKey: "closed" }
    });

    await request(`/support/tickets/${ticketId}`, { method: "DELETE", accessToken: adminSession.accessToken });
    await expectError(`/support/tickets/${ticketId}`, {
      accessToken: agentSession.accessToken,
      expectedStatus: 404,
      expectedCode: "TICKET_NOT_FOUND"
    });

    log("Phase 15 support ticketing checks passed.");
  } finally {
    await client.end();
  }
}

await main();
