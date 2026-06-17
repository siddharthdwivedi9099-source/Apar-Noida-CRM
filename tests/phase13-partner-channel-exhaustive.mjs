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

const partnerOptionSetKeys = [
  "partner-type",
  "partner-tier",
  "partner-status",
  "partner-onboarding-status",
  "partner-deal-stage"
];

function log(message) {
  console.log(`[phase13-exhaustive] ${message}`);
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
  const authPayload = await request("/auth/login", {
    method: "POST",
    expectedStatus: 200,
    body: { tenantSlug, email, password }
  });
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
  for (const tableName of ["partners", "partner_contacts", "partner_onboarding_tasks", "partner_deal_registrations"]) {
    const table = await queryOne(
      client,
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
      [tableName]
    );
    assert.equal(table?.table_name, tableName, `${tableName} should exist for Phase 13.`);
  }
}

async function assertSeedBaseline(client) {
  const tenant = await queryOne(client, `SELECT id, status FROM tenants WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`, [
    defaultTenantSlug
  ]);
  assert.ok(tenant, "Default tenant should exist.");
  assert.equal(tenant.status, "active");

  const optionSetCount = await queryOne(
    client,
    `SELECT COUNT(*)::int AS count FROM tenant_option_sets WHERE tenant_id = $1 AND deleted_at IS NULL AND set_key = ANY($2::text[])`,
    [tenant.id, partnerOptionSetKeys]
  );
  assert.equal(optionSetCount.count, partnerOptionSetKeys.length, "Phase 13 option sets should be seeded.");

  const permissionCount = await queryOne(
    client,
    `SELECT COUNT(*)::int AS count FROM permissions WHERE code LIKE 'partners.%' AND deleted_at IS NULL`
  );
  assert.equal(permissionCount.count, 13, "partners permission catalog should be seeded.");

  return { tenantId: tenant.id };
}

async function createUserWithPermissions(client, { tenantId, email, password, firstName, lastName, roleSlug, roleName, permissionCodes }) {
  const roleResult = await client.query(
    `INSERT INTO roles (tenant_id, slug, name, description, metadata) VALUES ($1, $2, $3, $4, jsonb_build_object('testRun', $5::text)) RETURNING id`,
    [tenantId, roleSlug, roleName, `${roleName} for phase 13 testing`, runToken]
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

async function getOptionValueId(client, tenantId, setKey, valueKey) {
  const row = await queryOne(
    client,
    `SELECT tenant_option_values.id
     FROM tenant_option_sets
     INNER JOIN tenant_option_values ON tenant_option_values.option_set_id = tenant_option_sets.id AND tenant_option_values.tenant_id = tenant_option_sets.tenant_id
     WHERE tenant_option_sets.tenant_id = $1 AND tenant_option_sets.set_key = $2 AND tenant_option_values.value_key = $3 AND tenant_option_sets.deleted_at IS NULL AND tenant_option_values.deleted_at IS NULL
     LIMIT 1`,
    [tenantId, setKey, valueKey]
  );
  return row?.id ?? null;
}

async function cloneOptionSet(client, sourceTenantId, targetTenantId, setKey) {
  const setResult = await client.query(
    `WITH source_set AS (SELECT * FROM tenant_option_sets WHERE tenant_id = $1 AND set_key = $2 AND deleted_at IS NULL LIMIT 1)
     INSERT INTO tenant_option_sets (tenant_id, set_key, module_key, kind, name, description, is_system_set, metadata)
     SELECT $3, source_set.set_key, source_set.module_key, source_set.kind, source_set.name, source_set.description, source_set.is_system_set, source_set.metadata || jsonb_build_object('clonedFor', $4::text)
     FROM source_set RETURNING id`,
    [sourceTenantId, setKey, targetTenantId, runToken]
  );
  const targetSetId = setResult.rows[0].id;

  await client.query(
    `INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, description, color, sort_order, is_default, is_active, metadata)
     SELECT $3, $4, v.value_key, v.label, v.description, v.color, v.sort_order, v.is_default, v.is_active, v.metadata || jsonb_build_object('clonedFor', $5::text)
     FROM tenant_option_sets s INNER JOIN tenant_option_values v ON v.option_set_id = s.id AND v.tenant_id = s.tenant_id
     WHERE s.tenant_id = $1 AND s.set_key = $2 AND s.deleted_at IS NULL AND v.deleted_at IS NULL`,
    [sourceTenantId, setKey, targetTenantId, targetSetId, runToken]
  );
}

async function assertAuditLog(client, { tenantId, actorUserId, sessionId, action, resourceType, resourceId }) {
  const row = await queryOne(
    client,
    `SELECT status FROM audit_logs WHERE tenant_id = $1 AND actor_user_id = $2 AND session_id = $3 AND action = $4 AND resource_type = $5 AND resource_id = $6 ORDER BY created_at DESC LIMIT 1`,
    [tenantId, actorUserId, sessionId, action, resourceType, resourceId]
  );
  assert.ok(row, `Audit log ${action} should exist for ${resourceType} ${resourceId}.`);
  assert.equal(row.status, "success");
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

    log("Creating partner manager and viewer users.");
    const partnerPassword = `Part!${runToken}99`;
    const viewerPassword = `View!${runToken}99`;
    const partnerUser = await createUserWithPermissions(client, {
      tenantId,
      email: `partner-${runToken}@example.test`,
      password: partnerPassword,
      firstName: "Pam",
      lastName: "Partner",
      roleSlug: `partner-phase13-${runToken}`,
      roleName: `Partner Phase13 ${runToken}`,
      permissionCodes: ["partners.view", "partners.create", "partners.edit", "ai.use_ai"]
    });
    const viewerUser = await createUserWithPermissions(client, {
      tenantId,
      email: `viewer13-${runToken}@example.test`,
      password: viewerPassword,
      firstName: "Val",
      lastName: "Viewer",
      roleSlug: `viewer13-phase13-${runToken}`,
      roleName: `Viewer Phase13 ${runToken}`,
      permissionCodes: ["leads.view"]
    });
    const partnerReadPassword = `Read!${runToken}99`;
    await createUserWithPermissions(client, {
      tenantId,
      email: `partner-read-${runToken}@example.test`,
      password: partnerReadPassword,
      firstName: "Ravi",
      lastName: "ReadOnly",
      roleSlug: `partner-read-phase13-${runToken}`,
      roleName: `Partner Read Phase13 ${runToken}`,
      permissionCodes: ["partners.view"]
    });

    const partnerSession = await loginSession(defaultTenantSlug, `partner-${runToken}@example.test`, partnerPassword);
    const viewerSession = await loginSession(defaultTenantSlug, `viewer13-${runToken}@example.test`, viewerPassword);
    const partnerReadSession = await loginSession(defaultTenantSlug, `partner-read-${runToken}@example.test`, partnerReadPassword);

    log("Creating supporting account, contact, opportunity, and lead for linkage.");
    const account = await request("/accounts", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: { name: `Phase13 Account ${runToken}`, website: "https://p13.example.test", industry: "Technology" }
    });
    const accountId = account.account.id;
    const contact = await request("/contacts", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: { firstName: "Cyril", lastName: `Channel ${runToken}`, email: `cyril-${runToken}@example.test`, accountId }
    });
    const contactId = contact.contact.id;
    const opportunity = await request("/opportunities", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: { name: `Phase13 Deal ${runToken}`, accountId, primaryContactId: contactId, stageKey: "discovery", sourceKey: "partner" }
    });
    const opportunityId = opportunity.opportunity.id;
    const lead = await request("/leads", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: { firstName: "Lara", lastName: `Lead ${runToken}`, companyName: `Lead Co ${runToken}`, statusKey: "new", sourceKey: "partner" }
    });
    const leadId = lead.lead.id;

    log("Validating partner options and viewer restrictions.");
    const options = await request("/partners/options", { accessToken: partnerSession.accessToken });
    assert.ok(options.types.some((entry) => entry.key === "reseller"));
    assert.ok(options.tiers.some((entry) => entry.key === "gold"));
    assert.ok(options.statuses.some((entry) => entry.key === "active"));
    assert.ok(options.onboardingStatuses.some((entry) => entry.key === "completed"));
    assert.ok(options.dealStages.some((entry) => entry.key === "won"));

    await expectError("/partners", {
      method: "POST",
      accessToken: viewerSession.accessToken,
      expectedStatus: 403,
      expectedCode: "FORBIDDEN",
      body: { name: "Blocked Partner", typeKey: "reseller", tierKey: "registered" }
    });

    log("Validating permission boundaries for a partners.view-only role.");
    const readList = await request("/partners?pageSize=5", { accessToken: partnerReadSession.accessToken });
    assert.ok(Array.isArray(readList.partners), "A partners.view role should read the partner list.");
    await expectError("/partners", {
      method: "POST",
      accessToken: partnerReadSession.accessToken,
      expectedStatus: 403,
      expectedCode: "FORBIDDEN",
      body: { name: "Read Only Partner", typeKey: "reseller", tierKey: "registered" }
    });

    log("Validating option-value validation on partner create.");
    await expectError("/partners", {
      method: "POST",
      accessToken: partnerSession.accessToken,
      expectedStatus: 400,
      expectedCode: "INVALID_OPTION_VALUE",
      body: { name: `Bad Tier ${runToken}`, typeKey: "reseller", tierKey: "nonexistent_tier" }
    });

    log("Creating a partner with contacts and an onboarding checklist.");
    const createdPartner = await request("/partners", {
      method: "POST",
      accessToken: partnerSession.accessToken,
      expectedStatus: 201,
      body: {
        name: `Channel Partner ${runToken}`,
        accountId,
        ownerId: partnerUser.userId,
        typeKey: "reseller",
        tierKey: "gold",
        statusKey: "active",
        onboardingStatusKey: "in_progress",
        region: "APAC",
        territory: "South Asia",
        agreementReference: `AGR-${runToken}`,
        agreementStartDate: "2026-07-01",
        agreementEndDate: "2027-06-30",
        contacts: [
          { contactId, name: "Cyril Channel", title: "Alliance Lead", email: `cyril-${runToken}@example.test`, isPrimary: true },
          { name: "Nadia Ops", title: "Ops Manager", isPrimary: false }
        ],
        onboardingTasks: [
          { label: "Sign partner agreement", status: "completed" },
          { label: "Provision partner portal", status: "in_progress" },
          { label: "Complete enablement training" }
        ]
      }
    });
    const partnerId = createdPartner.partner.id;
    assert.equal(createdPartner.partner.type?.key, "reseller");
    assert.equal(createdPartner.partner.tier?.key, "gold");
    assert.equal(createdPartner.partner.status?.key, "active");
    assert.equal(createdPartner.partner.onboardingStatus?.key, "in_progress");
    assert.equal(createdPartner.partner.region, "APAC");
    assert.equal(createdPartner.partner.territory, "South Asia");
    assert.equal(createdPartner.partner.contacts.length, 2);
    assert.equal(createdPartner.partner.onboardingTasks.length, 3);
    assert.equal(createdPartner.partner.performance.completedOnboardingTaskCount, 1);
    assert.ok(createdPartner.partner.contacts.some((entry) => entry.isPrimary && entry.contact));
    assert.deepEqual(
      createdPartner.partner.aiPlaceholders.actions.map((action) => action.key).sort(),
      ["partner_action_plan", "partner_churn_risk", "partner_conflict_detection", "partner_fit_score", "partner_performance_summary"],
      "Partner AI placeholders should expose the full Phase 13 action set."
    );
    assert.equal(createdPartner.partner.enablementAssetsPlaceholder.available, false);
    assert.equal(createdPartner.partner.trainingPlaceholder.available, false);
    assert.equal(createdPartner.partner.supportTicketsPlaceholder.available, false);

    await assertAuditLog(client, {
      tenantId,
      actorUserId: partnerSession.currentUser.id,
      sessionId: partnerSession.session.id,
      action: "partner.create",
      resourceType: "partner",
      resourceId: partnerId
    });

    log("Validating partner list, detail, and dashboard.");
    const list = await request("/partners?pageSize=100", { accessToken: partnerSession.accessToken });
    assert.ok(list.partners.some((entry) => entry.id === partnerId), "Partner list should include the created partner.");

    const tierFiltered = await request("/partners?tier=gold&status=active", { accessToken: partnerSession.accessToken });
    assert.ok(tierFiltered.partners.some((entry) => entry.id === partnerId), "Partner filters should match the created partner.");
    const typeFiltered = await request("/partners?type=reseller&onboardingStatus=in_progress", { accessToken: partnerSession.accessToken });
    assert.ok(typeFiltered.partners.some((entry) => entry.id === partnerId), "Type and onboarding filters should match the partner.");
    const searchFiltered = await request(`/partners?search=Channel%20Partner%20${runToken}`, { accessToken: partnerSession.accessToken });
    assert.ok(searchFiltered.partners.some((entry) => entry.id === partnerId), "Search filter should match the partner name.");
    const ownerFiltered = await request(`/partners?ownerId=${partnerUser.userId}`, { accessToken: partnerSession.accessToken });
    assert.ok(ownerFiltered.partners.some((entry) => entry.id === partnerId), "Owner filter should match the partner owner.");
    const tierMissFiltered = await request("/partners?tier=platinum", { accessToken: partnerSession.accessToken });
    assert.ok(!tierMissFiltered.partners.some((entry) => entry.id === partnerId), "Tier filter should exclude other tiers.");

    const detail = await request(`/partners/${partnerId}`, { accessToken: partnerSession.accessToken });
    assert.equal(detail.partner.agreementReference, `AGR-${runToken}`);
    assert.equal(detail.partner.agreementStartDate, "2026-07-01", "Agreement start date should be retained.");
    assert.equal(detail.partner.agreementEndDate, "2027-06-30", "Agreement end date should be retained.");
    assert.equal(detail.partner.owner?.id, partnerUser.userId, "Partner owner should resolve.");
    assert.equal(detail.partner.account?.id, accountId, "Partner should link to the CRM account.");
    assert.equal(detail.partner.region, "APAC");
    assert.equal(detail.partner.territory, "South Asia");
    assert.equal(detail.partner.performance.onboardingTaskCount, 3);
    assert.equal(detail.partner.performance.contactCount, 2, "Performance summary should count partner contacts.");
    const primaryContact = detail.partner.contacts.find((entry) => entry.isPrimary);
    assert.ok(primaryContact?.contact, "Primary contact should resolve its linked CRM contact.");

    const dashboard = await request("/partners/dashboard", { accessToken: partnerSession.accessToken });
    assert.ok(dashboard.totalPartners >= 1, "Dashboard should count partners.");
    assert.ok(dashboard.activePartners >= 1, "Dashboard should count active partners.");
    assert.equal(dashboard.performancePlaceholder.available, false);

    log("Advancing the onboarding checklist and updating onboarding status.");
    const advanced = await request(`/partners/${partnerId}`, {
      method: "PATCH",
      accessToken: partnerSession.accessToken,
      body: {
        onboardingStatusKey: "completed",
        onboardingTasks: [
          { label: "Sign partner agreement", status: "completed" },
          { label: "Provision partner portal", status: "completed" },
          { label: "Complete enablement training", status: "completed" }
        ]
      }
    });
    assert.equal(advanced.partner.onboardingStatus?.key, "completed");
    assert.equal(advanced.partner.performance.completedOnboardingTaskCount, 3);
    assert.equal(advanced.partner.performance.onboardingCompletionRate, 1);

    await assertAuditLog(client, {
      tenantId,
      actorUserId: partnerSession.currentUser.id,
      sessionId: partnerSession.session.id,
      action: "partner.update",
      resourceType: "partner",
      resourceId: partnerId
    });

    log("Updating partner profile fields (tier, status, region, agreement).");
    const profileUpdated = await request(`/partners/${partnerId}`, {
      method: "PATCH",
      accessToken: partnerSession.accessToken,
      body: {
        tierKey: "platinum",
        statusKey: "suspended",
        region: "EMEA",
        territory: "Middle East",
        agreementReference: `AGR-${runToken}-V2`
      }
    });
    assert.equal(profileUpdated.partner.tier?.key, "platinum");
    assert.equal(profileUpdated.partner.status?.key, "suspended");
    assert.equal(profileUpdated.partner.region, "EMEA");
    assert.equal(profileUpdated.partner.territory, "Middle East");
    assert.equal(profileUpdated.partner.agreementReference, `AGR-${runToken}-V2`);
    // restore active status so downstream dashboard checks remain meaningful
    await request(`/partners/${partnerId}`, {
      method: "PATCH",
      accessToken: partnerSession.accessToken,
      body: { statusKey: "active" }
    });

    log("Checking the ownership reassignment guard.");
    await expectError(`/partners/${partnerId}`, {
      method: "PATCH",
      accessToken: partnerSession.accessToken,
      expectedStatus: 403,
      expectedCode: "AUTHORIZATION_ERROR",
      body: { ownerId: viewerUser.userId }
    });

    await expectError(`/partners/${randomUUID()}`, {
      accessToken: partnerSession.accessToken,
      expectedStatus: 404,
      expectedCode: "PARTNER_NOT_FOUND"
    });

    log("Registering and progressing a partner deal.");
    const registeredDeal = await request(`/partners/${partnerId}/deals`, {
      method: "POST",
      accessToken: partnerSession.accessToken,
      expectedStatus: 201,
      body: {
        name: `Registered Deal ${runToken}`,
        stageKey: "registered",
        customerName: "Bright Future School",
        amount: 120000,
        expectedCloseDate: "2026-09-30",
        opportunityId,
        accountId,
        leadId
      }
    });
    const dealId = registeredDeal.deal.id;
    assert.equal(registeredDeal.deal.stage?.key, "registered");
    assert.equal(registeredDeal.deal.opportunity?.id, opportunityId);
    assert.equal(registeredDeal.deal.account?.id, accountId);
    assert.equal(registeredDeal.deal.leadId, leadId);
    assert.equal(registeredDeal.deal.amount, 120000);

    await assertAuditLog(client, {
      tenantId,
      actorUserId: partnerSession.currentUser.id,
      sessionId: partnerSession.session.id,
      action: "partner.deal.register",
      resourceType: "partner_deal_registration",
      resourceId: dealId
    });

    await expectError(`/partners/${partnerId}/deals`, {
      method: "POST",
      accessToken: partnerReadSession.accessToken,
      expectedStatus: 403,
      expectedCode: "FORBIDDEN",
      body: { name: `Read Only Deal ${runToken}` }
    });
    await expectError(`/partners/${partnerId}/deals`, {
      method: "POST",
      accessToken: partnerSession.accessToken,
      expectedStatus: 400,
      expectedCode: "INVALID_OPPORTUNITY",
      body: { name: `Bad Opportunity Deal ${runToken}`, opportunityId: randomUUID() }
    });

    const deals = await request(`/partners/${partnerId}/deals`, { accessToken: partnerSession.accessToken });
    assert.ok(deals.deals.some((entry) => entry.id === dealId), "Deal list should include the registered deal.");

    const wonDeal = await request(`/partners/${partnerId}/deals/${dealId}`, {
      method: "PATCH",
      accessToken: partnerSession.accessToken,
      body: { stageKey: "won", amount: 150000, customerName: "Bright Future Group" }
    });
    assert.equal(wonDeal.deal.stage?.key, "won");
    assert.equal(wonDeal.deal.amount, 150000, "Deal amount update should persist.");
    assert.equal(wonDeal.deal.customerName, "Bright Future Group", "Deal customer update should persist.");

    const detailAfterDeal = await request(`/partners/${partnerId}`, { accessToken: partnerSession.accessToken });
    assert.equal(detailAfterDeal.partner.dealCount, 1);
    assert.equal(detailAfterDeal.partner.performance.wonDealCount, 1);
    assert.equal(detailAfterDeal.partner.performance.registeredDealValue, 150000);

    await expectError(`/partners/${partnerId}/deals/${randomUUID()}`, {
      method: "PATCH",
      accessToken: partnerSession.accessToken,
      expectedStatus: 404,
      expectedCode: "PARTNER_DEAL_NOT_FOUND",
      body: { stageKey: "lost" }
    });

    log("Checking tenant isolation against a second tenant partner.");
    const secondTenantResult = await client.query(
      `INSERT INTO tenants (slug, name, status, metadata) VALUES ($1, $2, 'active', jsonb_build_object('testRun', $3::text)) RETURNING id`,
      [`phase13-${runToken}-tenant`, `Phase 13 Tenant ${runToken}`, runToken]
    );
    const secondTenantId = secondTenantResult.rows[0].id;
    for (const setKey of ["partner-type", "partner-tier", "partner-status", "partner-onboarding-status"]) {
      await cloneOptionSet(client, tenantId, secondTenantId, setKey);
    }
    const secondTenantPartner = await client.query(
      `INSERT INTO partners (tenant_id, name, type_option_id, tier_option_id, status_option_id, onboarding_status_option_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, jsonb_build_object('testRun', $7::text)) RETURNING id`,
      [
        secondTenantId,
        `Isolated Partner ${runToken}`,
        await getOptionValueId(client, secondTenantId, "partner-type", "reseller"),
        await getOptionValueId(client, secondTenantId, "partner-tier", "registered"),
        await getOptionValueId(client, secondTenantId, "partner-status", "prospect"),
        await getOptionValueId(client, secondTenantId, "partner-onboarding-status", "not_started"),
        runToken
      ]
    );
    const secondTenantPartnerId = secondTenantPartner.rows[0].id;

    await expectError(`/partners/${secondTenantPartnerId}`, {
      accessToken: adminSession.accessToken,
      expectedStatus: 404,
      expectedCode: "PARTNER_NOT_FOUND"
    });

    log("Soft-deleting the partner.");
    await request(`/partners/${partnerId}`, { method: "DELETE", accessToken: adminSession.accessToken });
    await expectError(`/partners/${partnerId}`, {
      accessToken: partnerSession.accessToken,
      expectedStatus: 404,
      expectedCode: "PARTNER_NOT_FOUND"
    });

    log("Phase 13 partner channel management checks passed.");
  } finally {
    await client.end();
  }
}

await main();
