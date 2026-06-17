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

const resellerOptionSetKeys = [
  "reseller-status",
  "reseller-pricing-tier",
  "reseller-margin-profile",
  "reseller-onboarding-status",
  "reseller-deal-stage"
];

function log(message) {
  console.log(`[phase14-exhaustive] ${message}`);
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
  for (const tableName of ["resellers", "reseller_contacts", "reseller_onboarding_tasks", "reseller_deal_registrations"]) {
    const table = await queryOne(
      client,
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
      [tableName]
    );
    assert.equal(table?.table_name, tableName, `${tableName} should exist for Phase 14.`);
  }
}

async function assertSeedBaseline(client) {
  const tenant = await queryOne(client, `SELECT id, status FROM tenants WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`, [defaultTenantSlug]);
  assert.ok(tenant, "Default tenant should exist.");
  assert.equal(tenant.status, "active");

  const optionSetCount = await queryOne(
    client,
    `SELECT COUNT(*)::int AS count FROM tenant_option_sets WHERE tenant_id = $1 AND deleted_at IS NULL AND set_key = ANY($2::text[])`,
    [tenant.id, resellerOptionSetKeys]
  );
  assert.equal(optionSetCount.count, resellerOptionSetKeys.length, "Phase 14 option sets should be seeded.");

  const permissionCount = await queryOne(client, `SELECT COUNT(*)::int AS count FROM permissions WHERE code LIKE 'resellers.%' AND deleted_at IS NULL`);
  assert.equal(permissionCount.count, 13, "resellers permission catalog should be seeded.");

  return { tenantId: tenant.id };
}

async function createUserWithPermissions(client, { tenantId, email, password, firstName, lastName, roleSlug, roleName, permissionCodes }) {
  const roleResult = await client.query(
    `INSERT INTO roles (tenant_id, slug, name, description, metadata) VALUES ($1, $2, $3, $4, jsonb_build_object('testRun', $5::text)) RETURNING id`,
    [tenantId, roleSlug, roleName, `${roleName} for phase 14 testing`, runToken]
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

    log("Creating reseller manager, view-only, and viewer users.");
    const resellerPassword = `Res!${runToken}99`;
    const readPassword = `Read!${runToken}99`;
    const viewerPassword = `View!${runToken}99`;
    const resellerUser = await createUserWithPermissions(client, {
      tenantId,
      email: `reseller-${runToken}@example.test`,
      password: resellerPassword,
      firstName: "Rita",
      lastName: "Reseller",
      roleSlug: `reseller-phase14-${runToken}`,
      roleName: `Reseller Phase14 ${runToken}`,
      permissionCodes: ["resellers.view", "resellers.create", "resellers.edit", "ai.use_ai"]
    });
    await createUserWithPermissions(client, {
      tenantId,
      email: `reseller-read-${runToken}@example.test`,
      password: readPassword,
      firstName: "Reed",
      lastName: "ReadOnly",
      roleSlug: `reseller-read-phase14-${runToken}`,
      roleName: `Reseller Read Phase14 ${runToken}`,
      permissionCodes: ["resellers.view"]
    });
    const viewerUser = await createUserWithPermissions(client, {
      tenantId,
      email: `viewer14-${runToken}@example.test`,
      password: viewerPassword,
      firstName: "Val",
      lastName: "Viewer",
      roleSlug: `viewer14-phase14-${runToken}`,
      roleName: `Viewer Phase14 ${runToken}`,
      permissionCodes: ["leads.view"]
    });

    const resellerSession = await loginSession(defaultTenantSlug, `reseller-${runToken}@example.test`, resellerPassword);
    const readSession = await loginSession(defaultTenantSlug, `reseller-read-${runToken}@example.test`, readPassword);
    const viewerSession = await loginSession(defaultTenantSlug, `viewer14-${runToken}@example.test`, viewerPassword);

    log("Creating supporting account, contact, opportunity, and lead for linkage.");
    const account = await request("/accounts", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: { name: `Phase14 Account ${runToken}`, website: "https://p14.example.test", industry: "Technology" }
    });
    const accountId = account.account.id;
    const contact = await request("/contacts", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: { firstName: "Rhea", lastName: `Channel ${runToken}`, email: `rhea-${runToken}@example.test`, accountId }
    });
    const contactId = contact.contact.id;
    const opportunity = await request("/opportunities", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: { name: `Phase14 Deal ${runToken}`, accountId, primaryContactId: contactId, stageKey: "discovery", sourceKey: "reseller" }
    });
    const opportunityId = opportunity.opportunity.id;
    const lead = await request("/leads", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: { firstName: "Leo", lastName: `Lead ${runToken}`, companyName: `Lead Co ${runToken}`, statusKey: "new", sourceKey: "partner" }
    });
    const leadId = lead.lead.id;

    log("Validating reseller options and permission boundaries.");
    const options = await request("/resellers/options", { accessToken: resellerSession.accessToken });
    assert.ok(options.statuses.some((entry) => entry.key === "active"));
    assert.ok(options.pricingTiers.some((entry) => entry.key === "strategic"));
    assert.ok(options.marginProfiles.some((entry) => entry.key === "volume"));
    assert.ok(options.onboardingStatuses.some((entry) => entry.key === "completed"));
    assert.ok(options.dealStages.some((entry) => entry.key === "won"));

    await expectError("/resellers", {
      method: "POST",
      accessToken: viewerSession.accessToken,
      expectedStatus: 403,
      expectedCode: "FORBIDDEN",
      body: { name: "Blocked Reseller", pricingTierKey: "standard", marginProfileKey: "standard" }
    });
    const readList = await request("/resellers?pageSize=5", { accessToken: readSession.accessToken });
    assert.ok(Array.isArray(readList.resellers), "A resellers.view role should read the reseller list.");
    await expectError("/resellers", {
      method: "POST",
      accessToken: readSession.accessToken,
      expectedStatus: 403,
      expectedCode: "FORBIDDEN",
      body: { name: "Read Only Reseller", pricingTierKey: "standard", marginProfileKey: "standard" }
    });
    await expectError("/resellers", {
      method: "POST",
      accessToken: resellerSession.accessToken,
      expectedStatus: 400,
      expectedCode: "INVALID_OPTION_VALUE",
      body: { name: `Bad Tier ${runToken}`, pricingTierKey: "nonexistent", marginProfileKey: "standard" }
    });

    log("Creating a reseller with contacts and an onboarding checklist.");
    const created = await request("/resellers", {
      method: "POST",
      accessToken: resellerSession.accessToken,
      expectedStatus: 201,
      body: {
        name: `Channel Reseller ${runToken}`,
        accountId,
        ownerId: resellerUser.userId,
        statusKey: "active",
        pricingTierKey: "strategic",
        marginProfileKey: "volume",
        onboardingStatusKey: "in_progress",
        region: "APAC",
        territory: "South Asia",
        marginPercent: 18.5,
        agreementReference: `RES-${runToken}`,
        agreementStartDate: "2026-07-01",
        agreementEndDate: "2027-06-30",
        agreementNotes: "Annual renewal with volume rebate.",
        contacts: [
          { contactId, name: "Rhea Channel", title: "Account Lead", email: `rhea-${runToken}@example.test`, isPrimary: true },
          { name: "Omar Ops", title: "Ops Manager", isPrimary: false }
        ],
        onboardingTasks: [
          { label: "Sign reseller agreement", status: "completed" },
          { label: "Provision reseller portal", status: "in_progress", dueDate: "2026-08-15", notes: "Pending IT access" },
          { label: "Complete enablement training" }
        ]
      }
    });
    const resellerId = created.reseller.id;
    assert.equal(created.reseller.status?.key, "active");
    assert.equal(created.reseller.pricingTier?.key, "strategic");
    assert.equal(created.reseller.marginProfile?.key, "volume");
    assert.equal(created.reseller.marginPercent, 18.5);
    assert.equal(created.reseller.onboardingStatus?.key, "in_progress");
    assert.equal(created.reseller.contacts.length, 2);
    assert.equal(created.reseller.onboardingTasks.length, 3);
    assert.equal(created.reseller.performance.completedOnboardingTaskCount, 1);
    assert.ok(created.reseller.contacts.some((entry) => entry.isPrimary && entry.contact));
    assert.deepEqual(
      created.reseller.aiPlaceholders.actions.map((action) => action.key).sort(),
      [
        "inactivity_alert",
        "margin_optimization",
        "reseller_coaching_recommendation",
        "reseller_opportunity_recommendation",
        "reseller_performance_insight",
        "reseller_sales_prediction"
      ],
      "Reseller AI placeholders should expose the full Phase 14 action set."
    );
    assert.equal(created.reseller.catalogPlaceholder.available, false);
    assert.equal(created.reseller.orderTrackingPlaceholder.available, false);
    assert.equal(created.reseller.trainingPlaceholder.available, false);
    assert.equal(created.reseller.certificationPlaceholder.available, false);
    assert.equal(created.reseller.supportTicketsPlaceholder.available, false);

    await assertAuditLog(client, {
      tenantId,
      actorUserId: resellerSession.currentUser.id,
      sessionId: resellerSession.session.id,
      action: "reseller.create",
      resourceType: "reseller",
      resourceId: resellerId
    });

    log("Validating reseller list, filters, detail, and dashboard.");
    const list = await request("/resellers?pageSize=100", { accessToken: resellerSession.accessToken });
    assert.ok(list.resellers.some((entry) => entry.id === resellerId), "Reseller list should include the created reseller.");
    const filtered = await request("/resellers?status=active&pricingTier=strategic&marginProfile=volume", { accessToken: resellerSession.accessToken });
    assert.ok(filtered.resellers.some((entry) => entry.id === resellerId), "Reseller filters should match.");
    const searchFiltered = await request(`/resellers?search=Channel%20Reseller%20${runToken}`, { accessToken: resellerSession.accessToken });
    assert.ok(searchFiltered.resellers.some((entry) => entry.id === resellerId), "Reseller search filter should match.");
    const onboardingFiltered = await request("/resellers?onboardingStatus=in_progress", { accessToken: resellerSession.accessToken });
    assert.ok(onboardingFiltered.resellers.some((entry) => entry.id === resellerId), "Onboarding status filter should match.");
    const ownerFiltered = await request(`/resellers?ownerId=${resellerUser.userId}&sortBy=name&sortOrder=asc`, { accessToken: resellerSession.accessToken });
    assert.ok(ownerFiltered.resellers.some((entry) => entry.id === resellerId), "Owner filter and sort should match.");
    const missFiltered = await request("/resellers?pricingTier=preferred", { accessToken: resellerSession.accessToken });
    assert.ok(!missFiltered.resellers.some((entry) => entry.id === resellerId), "Pricing tier filter should exclude other tiers.");

    const detail = await request(`/resellers/${resellerId}`, { accessToken: resellerSession.accessToken });
    assert.equal(detail.reseller.agreementReference, `RES-${runToken}`);
    assert.equal(detail.reseller.agreementStartDate, "2026-07-01", "Agreement start date should be retained.");
    assert.equal(detail.reseller.agreementEndDate, "2027-06-30", "Agreement end date should be retained.");
    assert.equal(detail.reseller.agreementNotes, "Annual renewal with volume rebate.", "Agreement notes should be retained.");
    assert.equal(detail.reseller.owner?.id, resellerUser.userId);
    assert.equal(detail.reseller.account?.id, accountId);
    assert.equal(detail.reseller.region, "APAC");
    assert.equal(detail.reseller.territory, "South Asia", "Territory should be retained.");
    assert.equal(detail.reseller.performance.onboardingTaskCount, 3);
    assert.equal(detail.reseller.performance.contactCount, 2);
    const portalTask = detail.reseller.onboardingTasks.find((task) => task.label === "Provision reseller portal");
    assert.ok(portalTask, "Onboarding task should be retained.");
    assert.equal(portalTask.dueDate, "2026-08-15", "Onboarding task due date should be retained.");
    assert.equal(portalTask.notes, "Pending IT access", "Onboarding task notes should be retained.");

    const dashboard = await request("/resellers/dashboard", { accessToken: resellerSession.accessToken });
    assert.ok(dashboard.totalResellers >= 1, "Dashboard should count resellers.");
    assert.ok(dashboard.activeResellers >= 1, "Dashboard should count active resellers.");
    assert.ok(dashboard.averageMarginPercent !== null, "Dashboard should compute an average margin.");
    assert.ok(
      dashboard.pricingTierDistribution.some((entry) => entry.pricingTier?.key === "strategic" && entry.resellerCount >= 1),
      "Dashboard should report pricing tier distribution."
    );
    assert.equal(dashboard.performancePlaceholder.available, false);

    log("Advancing the onboarding checklist and updating profile fields.");
    const advanced = await request(`/resellers/${resellerId}`, {
      method: "PATCH",
      accessToken: resellerSession.accessToken,
      body: {
        onboardingStatusKey: "completed",
        onboardingTasks: [
          { label: "Sign reseller agreement", status: "completed" },
          { label: "Provision reseller portal", status: "completed" },
          { label: "Complete enablement training", status: "completed" }
        ]
      }
    });
    assert.equal(advanced.reseller.onboardingStatus?.key, "completed");
    assert.equal(advanced.reseller.performance.completedOnboardingTaskCount, 3);
    assert.equal(advanced.reseller.performance.onboardingCompletionRate, 1);

    const profileUpdated = await request(`/resellers/${resellerId}`, {
      method: "PATCH",
      accessToken: resellerSession.accessToken,
      body: { pricingTierKey: "preferred", marginProfileKey: "strategic", marginPercent: 22, region: "EMEA" }
    });
    assert.equal(profileUpdated.reseller.pricingTier?.key, "preferred");
    assert.equal(profileUpdated.reseller.marginProfile?.key, "strategic");
    assert.equal(profileUpdated.reseller.marginPercent, 22);
    assert.equal(profileUpdated.reseller.region, "EMEA");

    await assertAuditLog(client, {
      tenantId,
      actorUserId: resellerSession.currentUser.id,
      sessionId: resellerSession.session.id,
      action: "reseller.update",
      resourceType: "reseller",
      resourceId: resellerId
    });

    log("Re-syncing reseller contacts through update.");
    const contactsResynced = await request(`/resellers/${resellerId}`, {
      method: "PATCH",
      accessToken: resellerSession.accessToken,
      body: { contacts: [{ name: "Single Primary Contact", title: "Owner", isPrimary: true }] }
    });
    assert.equal(contactsResynced.reseller.contactCount, 1, "Contact re-sync should replace the contact set.");
    assert.equal(contactsResynced.reseller.contacts.length, 1);
    assert.equal(contactsResynced.reseller.contacts[0].name, "Single Primary Contact");

    log("Checking ownership and not-found guards.");
    await expectError(`/resellers/${resellerId}`, {
      method: "PATCH",
      accessToken: resellerSession.accessToken,
      expectedStatus: 403,
      expectedCode: "AUTHORIZATION_ERROR",
      body: { ownerId: viewerUser.userId }
    });
    await expectError(`/resellers/${randomUUID()}`, {
      accessToken: resellerSession.accessToken,
      expectedStatus: 404,
      expectedCode: "RESELLER_NOT_FOUND"
    });

    log("Registering and progressing a reseller deal with margin.");
    await expectError(`/resellers/${resellerId}/deals`, {
      method: "POST",
      accessToken: readSession.accessToken,
      expectedStatus: 403,
      expectedCode: "FORBIDDEN",
      body: { name: `Read Only Deal ${runToken}` }
    });
    await expectError(`/resellers/${resellerId}/deals`, {
      method: "POST",
      accessToken: resellerSession.accessToken,
      expectedStatus: 400,
      expectedCode: "INVALID_LEAD",
      body: { name: `Bad Lead Deal ${runToken}`, leadId: randomUUID() }
    });

    const registeredDeal = await request(`/resellers/${resellerId}/deals`, {
      method: "POST",
      accessToken: resellerSession.accessToken,
      expectedStatus: 201,
      body: {
        name: `Registered Deal ${runToken}`,
        stageKey: "registered",
        customerName: "Sunrise Academy",
        amount: 90000,
        marginPercent: 15,
        expectedCloseDate: "2026-10-31",
        notes: "Renewal plus expansion bundle.",
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
    assert.equal(registeredDeal.deal.amount, 90000);
    assert.equal(registeredDeal.deal.marginPercent, 15);
    assert.equal(registeredDeal.deal.expectedCloseDate, "2026-10-31", "Deal expected close date should be retained.");
    assert.equal(registeredDeal.deal.notes, "Renewal plus expansion bundle.", "Deal notes should be retained.");

    await assertAuditLog(client, {
      tenantId,
      actorUserId: resellerSession.currentUser.id,
      sessionId: resellerSession.session.id,
      action: "reseller.deal.register",
      resourceType: "reseller_deal_registration",
      resourceId: dealId
    });

    const deals = await request(`/resellers/${resellerId}/deals`, { accessToken: resellerSession.accessToken });
    assert.ok(deals.deals.some((entry) => entry.id === dealId), "Deal list should include the registered deal.");

    const wonDeal = await request(`/resellers/${resellerId}/deals/${dealId}`, {
      method: "PATCH",
      accessToken: resellerSession.accessToken,
      body: { stageKey: "won", amount: 95000, marginPercent: 17, customerName: "Sunrise Academy Group" }
    });
    assert.equal(wonDeal.deal.stage?.key, "won");
    assert.equal(wonDeal.deal.amount, 95000);
    assert.equal(wonDeal.deal.marginPercent, 17);
    assert.equal(wonDeal.deal.customerName, "Sunrise Academy Group");

    const detailAfterDeal = await request(`/resellers/${resellerId}`, { accessToken: resellerSession.accessToken });
    assert.equal(detailAfterDeal.reseller.dealCount, 1);
    assert.equal(detailAfterDeal.reseller.performance.wonDealCount, 1);
    assert.equal(detailAfterDeal.reseller.performance.registeredDealValue, 95000);
    assert.equal(detailAfterDeal.reseller.performance.averageMarginPercent, 17);

    await expectError(`/resellers/${resellerId}/deals/${randomUUID()}`, {
      method: "PATCH",
      accessToken: resellerSession.accessToken,
      expectedStatus: 404,
      expectedCode: "RESELLER_DEAL_NOT_FOUND",
      body: { stageKey: "lost" }
    });

    log("Checking tenant isolation against a second tenant reseller.");
    const secondTenantResult = await client.query(
      `INSERT INTO tenants (slug, name, status, metadata) VALUES ($1, $2, 'active', jsonb_build_object('testRun', $3::text)) RETURNING id`,
      [`phase14-${runToken}-tenant`, `Phase 14 Tenant ${runToken}`, runToken]
    );
    const secondTenantId = secondTenantResult.rows[0].id;
    for (const setKey of resellerOptionSetKeys) {
      await cloneOptionSet(client, tenantId, secondTenantId, setKey);
    }
    const secondTenantReseller = await client.query(
      `INSERT INTO resellers (tenant_id, name, status_option_id, pricing_tier_option_id, margin_profile_option_id, onboarding_status_option_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, jsonb_build_object('testRun', $7::text)) RETURNING id`,
      [
        secondTenantId,
        `Isolated Reseller ${runToken}`,
        await getOptionValueId(client, secondTenantId, "reseller-status", "prospect"),
        await getOptionValueId(client, secondTenantId, "reseller-pricing-tier", "standard"),
        await getOptionValueId(client, secondTenantId, "reseller-margin-profile", "standard"),
        await getOptionValueId(client, secondTenantId, "reseller-onboarding-status", "not_started"),
        runToken
      ]
    );
    const secondTenantResellerId = secondTenantReseller.rows[0].id;

    await expectError(`/resellers/${secondTenantResellerId}`, {
      accessToken: adminSession.accessToken,
      expectedStatus: 404,
      expectedCode: "RESELLER_NOT_FOUND"
    });

    log("Soft-deleting the reseller.");
    await request(`/resellers/${resellerId}`, { method: "DELETE", accessToken: adminSession.accessToken });
    await expectError(`/resellers/${resellerId}`, {
      accessToken: resellerSession.accessToken,
      expectedStatus: 404,
      expectedCode: "RESELLER_NOT_FOUND"
    });

    log("Phase 14 reseller management checks passed.");
  } finally {
    await client.end();
  }
}

await main();
