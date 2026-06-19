import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";

const apiBaseUrl = process.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4012/api/v1";
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://crm:crm@localhost:5433/crm";
const defaultTenantSlug = process.env.DEFAULT_TENANT_SLUG ?? "sample-tenant";
const runToken = randomUUID().replace(/-/g, "").slice(0, 10);
const customerPassword = `PortalPass!${runToken}`;

const CUSTOMER_PORTAL_PERMISSION_CODES = [
  "customer_portal.view",
  "customer_portal.create",
  "customer_portal.edit",
  "customer_portal.use_ai"
];

function log(message) {
  console.log(`[phase26-exhaustive] ${message}`);
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
  const me = await request("/auth/me", { accessToken, expectedStatus: 200 });
  return {
    accessToken,
    user: me.user,
    session: me.session
  };
}

async function queryOne(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0] ?? null;
}

async function createRole(client, { tenantId, roleSlug, roleName, permissionCodes }) {
  const result = await client.query(
    `
      INSERT INTO roles (tenant_id, slug, name, description, metadata)
      VALUES ($1, $2, $3, $4, jsonb_build_object('testRun', $5::text))
      RETURNING id
    `,
    [tenantId, roleSlug, roleName, `${roleName} for Phase 26 testing`, runToken]
  );
  const roleId = result.rows[0].id;

  await client.query(
    `
      INSERT INTO role_permissions (tenant_id, role_id, permission_id, metadata)
      SELECT
        $1,
        $2,
        permissions.id,
        jsonb_build_object('testRun', $4::text)
      FROM permissions
      WHERE permissions.code = ANY($3::text[])
        AND permissions.deleted_at IS NULL
    `,
    [tenantId, roleId, permissionCodes, runToken]
  );

  return roleId;
}

async function createUser(client, { tenantId, email, password, firstName, lastName, roleId }) {
  const displayName = `${firstName} ${lastName}`.trim();
  const userResult = await client.query(
    `
      INSERT INTO users (
        tenant_id,
        email,
        normalized_email,
        first_name,
        last_name,
        display_name,
        password_hash,
        status,
        password_changed_at,
        metadata
      )
      VALUES (
        $1,
        $2,
        LOWER($2),
        $3,
        $4,
        $5,
        crypt($6, gen_salt('bf')),
        'active',
        NOW(),
        jsonb_build_object('testRun', $7::text)
      )
      RETURNING id
    `,
    [tenantId, email, firstName, lastName, displayName, password, runToken]
  );
  const userId = userResult.rows[0].id;

  await client.query(
    `
      INSERT INTO user_roles (tenant_id, user_id, role_id, metadata)
      VALUES ($1, $2, $3, jsonb_build_object('testRun', $4::text))
    `,
    [tenantId, userId, roleId, runToken]
  );

  return userId;
}

async function optionId(client, tenantId, setKey, valueKey) {
  const row = await queryOne(
    client,
    `
      SELECT v.id
      FROM tenant_option_values v
      INNER JOIN tenant_option_sets s ON s.id = v.option_set_id AND s.tenant_id = v.tenant_id
      WHERE s.tenant_id = $1
        AND s.set_key = $2
        AND v.value_key = $3
        AND s.deleted_at IS NULL
        AND v.deleted_at IS NULL
      LIMIT 1
    `,
    [tenantId, setKey, valueKey]
  );
  assert.ok(row?.id, `${setKey}.${valueKey} option should exist.`);
  return row.id;
}

async function assertAuditExists(client, { tenantId, action, resourceType }) {
  const row = await queryOne(
    client,
    `
      SELECT status
      FROM audit_logs
      WHERE tenant_id = $1
        AND action = $2
        AND resource_type = $3
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [tenantId, action, resourceType]
  );
  assert.ok(row, `Audit log ${action} should exist for ${resourceType}.`);
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    log("Checking root API status, schema, permissions, and role templates.");
    const root = await request("/", { expectedStatus: 200 });
    assert.equal(root.status, "phase-26-operational", "API root should report Phase 26 status.");

    for (const tableName of ["customer_portal_profiles", "customer_feedback"]) {
      const table = await queryOne(
        client,
        `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = $1
          LIMIT 1
        `,
        [tableName]
      );
      assert.equal(table?.table_name, tableName, `${tableName} should exist for Phase 26.`);
    }

    for (const permissionCode of CUSTOMER_PORTAL_PERMISSION_CODES) {
      const permission = await queryOne(
        client,
        `SELECT code FROM permissions WHERE code = $1 AND deleted_at IS NULL LIMIT 1`,
        [permissionCode]
      );
      assert.equal(permission?.code, permissionCode, `${permissionCode} should exist in the permission catalog.`);
    }

    const template = await queryOne(
      client,
      `SELECT template_key FROM role_templates WHERE template_key = 'customer-portal-user' AND deleted_at IS NULL LIMIT 1`
    );
    assert.equal(template?.template_key, "customer-portal-user", "Customer Portal User role template should be seeded.");

    const tenant = await queryOne(
      client,
      `SELECT id FROM tenants WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`,
      [defaultTenantSlug]
    );
    assert.ok(tenant, "Default tenant should exist.");
    const tenantId = tenant.id;

    const roleId = await createRole(client, {
      tenantId,
      roleSlug: `phase26-customer-${runToken}`,
      roleName: `Phase 26 Customer ${runToken}`,
      permissionCodes: CUSTOMER_PORTAL_PERMISSION_CODES
    });

    const customerAEmail = `phase26-a-${runToken}@example.test`;
    const customerBEmail = `phase26-b-${runToken}@example.test`;
    const customerAId = await createUser(client, {
      tenantId,
      email: customerAEmail,
      password: customerPassword,
      firstName: "Portal",
      lastName: "Alpha",
      roleId
    });
    const customerBId = await createUser(client, {
      tenantId,
      email: customerBEmail,
      password: customerPassword,
      firstName: "Portal",
      lastName: "Beta",
      roleId
    });

    const accountAId = (await client.query(`INSERT INTO accounts (tenant_id, name, website, industry, metadata) VALUES ($1, $2, 'https://alpha.example.test', 'Software', jsonb_build_object('testRun', $3::text)) RETURNING id`, [tenantId, `Alpha Portal Account ${runToken}`, runToken])).rows[0].id;
    const accountBId = (await client.query(`INSERT INTO accounts (tenant_id, name, website, industry, metadata) VALUES ($1, $2, 'https://beta.example.test', 'Services', jsonb_build_object('testRun', $3::text)) RETURNING id`, [tenantId, `Beta Portal Account ${runToken}`, runToken])).rows[0].id;
    const contactAId = (await client.query(`INSERT INTO contacts (tenant_id, account_id, first_name, last_name, email, metadata) VALUES ($1, $2, 'Alpha', 'Customer', $3, jsonb_build_object('testRun', $4::text)) RETURNING id`, [tenantId, accountAId, customerAEmail, runToken])).rows[0].id;
    const contactBId = (await client.query(`INSERT INTO contacts (tenant_id, account_id, first_name, last_name, email, metadata) VALUES ($1, $2, 'Beta', 'Customer', $3, jsonb_build_object('testRun', $4::text)) RETURNING id`, [tenantId, accountBId, customerBEmail, runToken])).rows[0].id;

    await client.query(
      `
        INSERT INTO customer_portal_profiles (tenant_id, user_id, account_id, contact_id, portal_role, job_title, phone, metadata, created_by, updated_by)
        VALUES
          ($1, $2, $3, $4, 'customer_user', 'Customer Champion', '+15550000001', jsonb_build_object('testRun', $6::text), $2, $2),
          ($1, $5, $7, $8, 'customer_user', 'Operations Lead', '+15550000002', jsonb_build_object('testRun', $6::text), $5, $5)
      `,
      [tenantId, customerAId, accountAId, contactAId, customerBId, runToken, accountBId, contactBId]
    );

    const statusNewId = await optionId(client, tenantId, "support-ticket-status", "new");
    const statusResolvedId = await optionId(client, tenantId, "support-ticket-status", "resolved");
    const priorityMediumId = await optionId(client, tenantId, "support-ticket-priority", "medium");
    const categoryTechnicalId = await optionId(client, tenantId, "support-ticket-category", "technical");
    const sourcePortalId = await optionId(client, tenantId, "support-ticket-source", "portal");
    const trainingCategoryId = await optionId(client, tenantId, "training-category", "product");
    const trainingLevelId = await optionId(client, tenantId, "training-level", "beginner");

    const ticketAId = (await client.query(
      `
        INSERT INTO support_tickets (
          tenant_id, account_id, contact_id, subject, description, status_option_id, priority_option_id, category_option_id, source_option_id, metadata, created_by, updated_by
        )
        VALUES ($1, $2, $3, $4, 'Alpha visible ticket', $5, $6, $7, $8, jsonb_build_object('testRun', $9::text), $10, $10)
        RETURNING id
      `,
      [tenantId, accountAId, contactAId, `Alpha ticket ${runToken}`, statusNewId, priorityMediumId, categoryTechnicalId, sourcePortalId, runToken, customerAId]
    )).rows[0].id;
    const ticketBId = (await client.query(
      `
        INSERT INTO support_tickets (
          tenant_id, account_id, contact_id, subject, description, status_option_id, priority_option_id, category_option_id, source_option_id, metadata, created_by, updated_by
        )
        VALUES ($1, $2, $3, $4, 'Beta hidden ticket', $5, $6, $7, $8, jsonb_build_object('testRun', $9::text), $10, $10)
        RETURNING id
      `,
      [tenantId, accountBId, contactBId, `Beta ticket ${runToken}`, statusResolvedId, priorityMediumId, categoryTechnicalId, sourcePortalId, runToken, customerBId]
    )).rows[0].id;

    await client.query(
      `
        INSERT INTO support_ticket_messages (tenant_id, ticket_id, author_id, message_type, body, metadata, created_by, updated_by)
        VALUES
          ($1, $2, $3, 'internal_note', $4, jsonb_build_object('testRun', $6::text), $3, $3),
          ($1, $2, $3, 'customer_reply', $5, jsonb_build_object('testRun', $6::text), $3, $3)
      `,
      [tenantId, ticketAId, customerAId, `Internal-only diagnostic ${runToken}`, `Customer-visible reply ${runToken}`, runToken]
    );

    const visibleSourceId = (await client.query(
      `
        INSERT INTO knowledge_sources (tenant_id, source_key, name, source_type, access_scope, required_permission, is_enabled, metadata)
        VALUES ($1, $2, 'Customer Portal FAQ', 'faq', 'tenant', NULL, TRUE, jsonb_build_object('testRun', $3::text))
        RETURNING id
      `,
      [tenantId, `phase26-visible-${runToken}`, runToken]
    )).rows[0].id;
    const restrictedSourceId = (await client.query(
      `
        INSERT INTO knowledge_sources (tenant_id, source_key, name, source_type, access_scope, required_permission, is_enabled, metadata)
        VALUES ($1, $2, 'Restricted Internal Notes', 'customer_document', 'restricted', 'support.view', TRUE, jsonb_build_object('testRun', $3::text))
        RETURNING id
      `,
      [tenantId, `phase26-restricted-${runToken}`, runToken]
    )).rows[0].id;
    const visibleArticleId = (await client.query(
      `
        INSERT INTO knowledge_articles (tenant_id, article_key, title, summary, body, category, status, is_published, source_id, metadata)
        VALUES ($1, $2, $3, $4, $5, 'portal', 'approved', TRUE, $6, jsonb_build_object('testRun', $7::text))
        RETURNING id
      `,
      [
        tenantId,
        `phase26-visible-article-${runToken}`,
        `Portal knowledge ${runToken}`,
        `Use the ZORBAX-${runToken} customer setting from the portal knowledge base.`,
        `The ZORBAX-${runToken} setting is documented for customer-visible portal answers.`,
        visibleSourceId,
        runToken
      ]
    )).rows[0].id;
    const restrictedArticleId = (await client.query(
      `
        INSERT INTO knowledge_articles (tenant_id, article_key, title, summary, body, category, status, is_published, source_id, metadata)
        VALUES ($1, $2, $3, $4, $5, 'internal', 'approved', TRUE, $6, jsonb_build_object('testRun', $7::text))
        RETURNING id
      `,
      [
        tenantId,
        `phase26-restricted-article-${runToken}`,
        `Restricted knowledge ${runToken}`,
        `SECRET-${runToken} internal-only summary.`,
        `SECRET-${runToken} must never appear in customer portal AI answers.`,
        restrictedSourceId,
        runToken
      ]
    )).rows[0].id;

    const programAId = (await client.query(
      `
        INSERT INTO training_programs (tenant_id, category_option_id, level_option_id, title, description, status, estimated_minutes, metadata)
        VALUES ($1, $2, $3, $4, 'Customer-visible onboarding training', 'published', 20, jsonb_build_object('testRun', $5::text))
        RETURNING id
      `,
      [tenantId, trainingCategoryId, trainingLevelId, `Portal Training Alpha ${runToken}`, runToken]
    )).rows[0].id;
    const moduleAId = (await client.query(`INSERT INTO training_modules (tenant_id, program_id, title, sort_order, metadata) VALUES ($1, $2, 'Start here', 0, jsonb_build_object('testRun', $3::text)) RETURNING id`, [tenantId, programAId, runToken])).rows[0].id;
    const lessonAId = (await client.query(`INSERT INTO training_lessons (tenant_id, program_id, module_id, title, content, sort_order, metadata) VALUES ($1, $2, $3, 'Portal lesson', 'Customer-visible lesson content', 0, jsonb_build_object('testRun', $4::text)) RETURNING id`, [tenantId, programAId, moduleAId, runToken])).rows[0].id;
    const assignmentAId = (await client.query(
      `
        INSERT INTO training_assignments (tenant_id, program_id, assignee_type, account_id, contact_id, status, completion_percent, metadata, created_by, updated_by)
        VALUES ($1, $2, 'account', $3, $4, 'assigned', 0, jsonb_build_object('testRun', $5::text), $6, $6)
        RETURNING id
      `,
      [tenantId, programAId, accountAId, contactAId, runToken, customerAId]
    )).rows[0].id;

    const programBId = (await client.query(
      `
        INSERT INTO training_programs (tenant_id, category_option_id, level_option_id, title, description, status, estimated_minutes, metadata)
        VALUES ($1, $2, $3, $4, 'Hidden customer training', 'published', 15, jsonb_build_object('testRun', $5::text))
        RETURNING id
      `,
      [tenantId, trainingCategoryId, trainingLevelId, `Portal Training Beta ${runToken}`, runToken]
    )).rows[0].id;
    await client.query(
      `
        INSERT INTO training_assignments (tenant_id, program_id, assignee_type, account_id, contact_id, status, completion_percent, metadata, created_by, updated_by)
        VALUES ($1, $2, 'account', $3, $4, 'assigned', 0, jsonb_build_object('testRun', $5::text), $6, $6)
      `,
      [tenantId, programBId, accountBId, contactBId, runToken, customerBId]
    );

    log("Logging in customer users.");
    const customerASession = await loginSession(defaultTenantSlug, customerAEmail, customerPassword);
    const customerBSession = await loginSession(defaultTenantSlug, customerBEmail, customerPassword);
    assert.ok(customerASession.user.permissionCodes.includes("customer_portal.view"), "Customer A should have portal permissions.");
    assert.ok(!customerASession.user.permissionCodes.includes("support.view"), "Customer A should not have internal support permissions.");

    log("Verifying profile, dashboard, and ticket isolation.");
    const profileA = await request("/customer-portal/profile", { accessToken: customerASession.accessToken });
    assert.equal(profileA.profile.account.id, accountAId, "Customer A profile should be linked to account A.");
    assert.equal(profileA.profile.contact.id, contactAId, "Customer A profile should be linked to contact A.");

    const dashboardA = await request("/customer-portal/dashboard", { accessToken: customerASession.accessToken });
    assert.equal(dashboardA.profile.account.id, accountAId, "Dashboard should use profile account.");
    assert.ok(dashboardA.metrics.openTicketCount >= 1, "Dashboard should count account A open tickets.");

    const ticketsA = await request("/customer-portal/tickets", { accessToken: customerASession.accessToken });
    assert.ok(ticketsA.tickets.some((ticket) => ticket.id === ticketAId), "Customer A should see account A ticket.");
    assert.ok(!ticketsA.tickets.some((ticket) => ticket.id === ticketBId), "Customer A must not see account B ticket.");
    await expectError(`/customer-portal/tickets/${ticketBId}`, {
      accessToken: customerASession.accessToken,
      expectedStatus: 404,
      expectedCode: "CUSTOMER_PORTAL_TICKET_NOT_FOUND"
    });
    await expectError("/support/tickets", {
      accessToken: customerASession.accessToken,
      expectedStatus: 403,
      expectedCode: "FORBIDDEN"
    });

    const ticketADetail = await request(`/customer-portal/tickets/${ticketAId}`, { accessToken: customerASession.accessToken });
    assert.ok(ticketADetail.ticket.messages.some((message) => message.body.includes(`Customer-visible reply ${runToken}`)), "Customer-visible ticket reply should be shown.");
    assert.ok(!ticketADetail.ticket.messages.some((message) => message.body.includes(`Internal-only diagnostic ${runToken}`)), "Internal ticket notes must be hidden.");
    assert.equal(ticketADetail.ticket.assigneeId, undefined, "Portal ticket response must not expose internal assignee.");

    const createdTicket = await request("/customer-portal/tickets", {
      method: "POST",
      accessToken: customerASession.accessToken,
      expectedStatus: 201,
      body: {
        subject: `Portal-created ticket ${runToken}`,
        description: "Created from exhaustive Phase 26 test.",
        priorityKey: "medium",
        categoryKey: "technical"
      }
    });
    assert.equal(createdTicket.ticket.subject, `Portal-created ticket ${runToken}`, "Portal ticket creation should return the created ticket.");
    const createdTicketRow = await queryOne(client, `SELECT account_id, contact_id FROM support_tickets WHERE id = $1`, [createdTicket.ticket.id]);
    assert.equal(createdTicketRow.account_id, accountAId, "Portal-created ticket should be tied to profile account.");
    assert.equal(createdTicketRow.contact_id, contactAId, "Portal-created ticket should be tied to profile contact.");

    const repliedTicket = await request(`/customer-portal/tickets/${createdTicket.ticket.id}/messages`, {
      method: "POST",
      accessToken: customerASession.accessToken,
      expectedStatus: 201,
      body: { body: `Portal reply ${runToken}` }
    });
    assert.ok(repliedTicket.ticket.messages.some((message) => message.body === `Portal reply ${runToken}`), "Portal replies should be stored as customer-visible messages.");

    const ticketsB = await request("/customer-portal/tickets", { accessToken: customerBSession.accessToken });
    assert.ok(ticketsB.tickets.some((ticket) => ticket.id === ticketBId), "Customer B should see account B ticket.");
    assert.ok(!ticketsB.tickets.some((ticket) => ticket.id === ticketAId), "Customer B must not see account A ticket.");

    log("Verifying customer-visible knowledge and portal AI restrictions.");
    const knowledgeA = await request(`/customer-portal/knowledge?search=${encodeURIComponent(`ZORBAX-${runToken}`)}`, {
      accessToken: customerASession.accessToken
    });
    assert.ok(knowledgeA.articles.some((article) => article.id === visibleArticleId), "Customer-visible article should be listed.");
    assert.ok(!knowledgeA.articles.some((article) => article.id === restrictedArticleId), "Restricted article must not be listed.");

    const aiAnswer = await request("/customer-portal/ask-ai", {
      method: "POST",
      accessToken: customerASession.accessToken,
      body: { question: `How do I use ZORBAX-${runToken}?` }
    });
    assert.ok(aiAnswer.citations.some((citation) => citation.articleId === visibleArticleId), "Ask AI should cite the customer-visible article.");
    assert.ok(!JSON.stringify(aiAnswer).includes(`SECRET-${runToken}`), "Ask AI must not include restricted knowledge.");
    assert.equal(aiAnswer.escalated, false, "Grounded portal AI answer should not escalate.");

    const noAnswer = await request("/customer-portal/ask-ai", {
      method: "POST",
      accessToken: customerASession.accessToken,
      body: { question: `Question with no approved answer ${randomUUID()}` }
    });
    assert.equal(noAnswer.escalated, true, "No-answer portal AI path should escalate for review.");
    assert.equal(noAnswer.citations.length, 0, "No-answer portal AI path should not invent citations.");

    log("Verifying training access and progress tracking.");
    const trainingA = await request("/customer-portal/training", { accessToken: customerASession.accessToken });
    assert.ok(trainingA.assignments.some((assignment) => assignment.id === assignmentAId), "Customer A should see account A training.");
    assert.ok(!trainingA.assignments.some((assignment) => assignment.program.id === programBId), "Customer A must not see account B training.");

    const assignmentDetail = await request(`/customer-portal/training/${assignmentAId}`, {
      accessToken: customerASession.accessToken
    });
    assert.ok(assignmentDetail.assignment.lessons.some((lesson) => lesson.id === lessonAId), "Training detail should include visible lesson.");

    const progressResponse = await request(`/customer-portal/training/${assignmentAId}/progress`, {
      method: "POST",
      accessToken: customerASession.accessToken,
      body: {
        lessonId: lessonAId,
        status: "completed",
        progressPercent: 100
      }
    });
    assert.equal(progressResponse.assignment.completionPercent, 100, "Completing the only lesson should complete the assignment.");
    assert.equal(progressResponse.assignment.status, "completed", "Assignment should move to completed.");

    await expectError(`/customer-portal/training/${assignmentAId}`, {
      accessToken: customerBSession.accessToken,
      expectedStatus: 404,
      expectedCode: "CUSTOMER_PORTAL_TRAINING_NOT_FOUND"
    });

    log("Verifying profile updates, feedback, and audit logs.");
    const updatedProfile = await request("/customer-portal/profile", {
      method: "PATCH",
      accessToken: customerASession.accessToken,
      body: {
        jobTitle: `Updated Champion ${runToken}`,
        phone: "+15559990001",
        preferences: { digest: "weekly" }
      }
    });
    assert.equal(updatedProfile.profile.jobTitle, `Updated Champion ${runToken}`, "Profile update should persist.");
    assert.equal(updatedProfile.profile.preferences.digest, "weekly", "Profile preferences should persist.");

    const feedback = await request("/customer-portal/feedback", {
      method: "POST",
      accessToken: customerASession.accessToken,
      expectedStatus: 201,
      body: {
        feedbackType: "csat",
        rating: 5,
        comment: `CSAT ${runToken}`
      }
    });
    assert.equal(feedback.feedback.rating, 5, "Feedback rating should be returned.");
    const feedbackRow = await queryOne(client, `SELECT account_id, comment FROM customer_feedback WHERE id = $1`, [feedback.feedback.id]);
    assert.equal(feedbackRow.account_id, accountAId, "Feedback should be linked to profile account.");
    assert.equal(feedbackRow.comment, `CSAT ${runToken}`, "Feedback comment should persist.");

    await assertAuditExists(client, { tenantId, action: "customer_portal.ticket.create", resourceType: "support_ticket" });
    await assertAuditExists(client, { tenantId, action: "customer_portal.ticket.reply", resourceType: "support_ticket_message" });
    await assertAuditExists(client, { tenantId, action: "customer_portal.ask_ai", resourceType: "customer_query_session" });
    await assertAuditExists(client, { tenantId, action: "customer_portal.training.progress", resourceType: "training_assignment" });
    await assertAuditExists(client, { tenantId, action: "customer_portal.feedback.create", resourceType: "customer_feedback" });

    log("Checking documentation updates.");
    const docsToCheck = [
      ["docs/user-guides/CUSTOMER_PORTAL_USER_GUIDE.md", "Phase 26"],
      ["docs/security/ACCESS_CONTROL_GUIDE.md", "Customer Portal Access Control"],
      ["docs/ai/CUSTOMER_QUERY_AI_DESIGN.md", "Phase 26 Customer Portal Ask AI"],
      ["docs/technical/API_DOCUMENTATION.md", "Customer Portal Routes (Phase 26)"],
      ["CHANGELOG.md", "Phase 26 migration"]
    ];
    for (const [filePath, expectedText] of docsToCheck) {
      const contents = await readFile(filePath, "utf8");
      assert.ok(contents.includes(expectedText), `${filePath} should mention ${expectedText}.`);
    }

    log("Phase 26 exhaustive checks passed.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
