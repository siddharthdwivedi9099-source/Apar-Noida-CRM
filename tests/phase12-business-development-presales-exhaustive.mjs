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

const phase12OptionSetKeys = [
  "bd-account-tier",
  "bd-pipeline-stage",
  "bd-partnership-type",
  "presales-request-type",
  "presales-request-status"
];

function log(message) {
  console.log(`[phase12-exhaustive] ${message}`);
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

  return {
    accessToken,
    currentUser: currentUserPayload.user,
    session: currentUserPayload.session
  };
}

async function queryOne(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0] ?? null;
}

async function assertSchemaFoundation(client) {
  for (const tableName of [
    "bd_target_accounts",
    "bd_account_stakeholders",
    "presales_requests",
    "presales_requirements"
  ]) {
    const table = await queryOne(
      client,
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
      [tableName]
    );
    assert.equal(table?.table_name, tableName, `${tableName} should exist for Phase 12.`);
  }
}

async function assertSeedBaseline(client) {
  const tenant = await queryOne(
    client,
    `SELECT id, status FROM tenants WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`,
    [defaultTenantSlug]
  );
  assert.ok(tenant, "Default tenant should exist after seeding.");
  assert.equal(tenant.status, "active");

  const optionSetCount = await queryOne(
    client,
    `SELECT COUNT(*)::int AS count FROM tenant_option_sets WHERE tenant_id = $1 AND deleted_at IS NULL AND set_key = ANY($2::text[])`,
    [tenant.id, phase12OptionSetKeys]
  );
  assert.equal(optionSetCount.count, phase12OptionSetKeys.length, "Phase 12 option sets should be seeded.");

  const permissionCount = await queryOne(
    client,
    `SELECT COUNT(*)::int AS count FROM permissions WHERE code LIKE 'business_development.%' AND deleted_at IS NULL`
  );
  assert.equal(permissionCount.count, 13, "business_development permission catalog should be seeded.");

  return { tenantId: tenant.id };
}

async function createUserWithPermissions(client, { tenantId, email, password, firstName, lastName, roleSlug, roleName, permissionCodes }) {
  const roleResult = await client.query(
    `INSERT INTO roles (tenant_id, slug, name, description, metadata) VALUES ($1, $2, $3, $4, jsonb_build_object('testRun', $5::text)) RETURNING id`,
    [tenantId, roleSlug, roleName, `${roleName} for phase 12 testing`, runToken]
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
    `WITH source_set AS (
       SELECT * FROM tenant_option_sets WHERE tenant_id = $1 AND set_key = $2 AND deleted_at IS NULL LIMIT 1
     )
     INSERT INTO tenant_option_sets (tenant_id, set_key, module_key, kind, name, description, is_system_set, metadata)
     SELECT $3, source_set.set_key, source_set.module_key, source_set.kind, source_set.name, source_set.description, source_set.is_system_set, source_set.metadata || jsonb_build_object('clonedFor', $4::text)
     FROM source_set RETURNING id`,
    [sourceTenantId, setKey, targetTenantId, runToken]
  );
  const targetSetId = setResult.rows[0].id;

  await client.query(
    `INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, description, color, sort_order, is_default, is_active, metadata)
     SELECT $3, $4, tenant_option_values.value_key, tenant_option_values.label, tenant_option_values.description, tenant_option_values.color, tenant_option_values.sort_order, tenant_option_values.is_default, tenant_option_values.is_active, tenant_option_values.metadata || jsonb_build_object('clonedFor', $5::text)
     FROM tenant_option_sets
     INNER JOIN tenant_option_values ON tenant_option_values.option_set_id = tenant_option_sets.id AND tenant_option_values.tenant_id = tenant_option_sets.tenant_id
     WHERE tenant_option_sets.tenant_id = $1 AND tenant_option_sets.set_key = $2 AND tenant_option_sets.deleted_at IS NULL AND tenant_option_values.deleted_at IS NULL`,
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

    log("Creating BD, presales, and viewer users with focused permissions.");
    const bdPassword = `Bd!${runToken}99`;
    const presalesPassword = `Pre!${runToken}99`;
    const viewerPassword = `View!${runToken}99`;

    const bdUser = await createUserWithPermissions(client, {
      tenantId,
      email: `bd-${runToken}@example.test`,
      password: bdPassword,
      firstName: "Bea",
      lastName: "Dev",
      roleSlug: `bd-phase12-${runToken}`,
      roleName: `BD Phase12 ${runToken}`,
      permissionCodes: [
        "business_development.view",
        "business_development.create",
        "business_development.edit",
        "ai.use_ai"
      ]
    });
    const presalesUser = await createUserWithPermissions(client, {
      tenantId,
      email: `presales-${runToken}@example.test`,
      password: presalesPassword,
      firstName: "Pat",
      lastName: "Sales",
      roleSlug: `presales-phase12-${runToken}`,
      roleName: `Presales Phase12 ${runToken}`,
      permissionCodes: ["presales.view", "presales.create", "presales.edit", "ai.use_ai"]
    });
    const viewerUser = await createUserWithPermissions(client, {
      tenantId,
      email: `viewer12-${runToken}@example.test`,
      password: viewerPassword,
      firstName: "Val",
      lastName: "Viewer",
      roleSlug: `viewer12-phase12-${runToken}`,
      roleName: `Viewer Phase12 ${runToken}`,
      permissionCodes: ["leads.view"]
    });

    const bdSession = await loginSession(defaultTenantSlug, `bd-${runToken}@example.test`, bdPassword);
    const presalesSession = await loginSession(defaultTenantSlug, `presales-${runToken}@example.test`, presalesPassword);
    const viewerSession = await loginSession(defaultTenantSlug, `viewer12-${runToken}@example.test`, viewerPassword);

    log("Creating supporting account, contact, and opportunity for linkage.");
    const account = await request("/accounts", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: { name: `Phase12 Account ${runToken}`, website: "https://p12.example.test", industry: "Technology" }
    });
    const accountId = account.account.id;
    const contact = await request("/contacts", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: { firstName: "Eve", lastName: `Exec ${runToken}`, email: `eve-${runToken}@example.test`, accountId }
    });
    const contactId = contact.contact.id;
    const opportunity = await request("/opportunities", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: { name: `Phase12 Deal ${runToken}`, accountId, primaryContactId: contactId, stageKey: "discovery", sourceKey: "inbound" }
    });
    const opportunityId = opportunity.opportunity.id;

    log("Validating business development options and viewer restrictions.");
    const bdOptions = await request("/business-development/options", { accessToken: bdSession.accessToken });
    assert.ok(bdOptions.tiers.some((tier) => tier.key === "strategic"));
    assert.ok(bdOptions.stages.some((stage) => stage.key === "committed"));
    assert.ok(bdOptions.partnershipTypes.some((type) => type.key === "technology"));

    await expectError("/business-development", {
      method: "POST",
      accessToken: viewerSession.accessToken,
      expectedStatus: 403,
      expectedCode: "FORBIDDEN",
      body: { name: "Blocked", tierKey: "strategic", stageKey: "identified" }
    });

    log("Creating, listing, and inspecting a strategic target account.");
    const createdBd = await request("/business-development", {
      method: "POST",
      accessToken: bdSession.accessToken,
      expectedStatus: 201,
      body: {
        name: `Strategic Target ${runToken}`,
        accountId,
        ownerId: bdUser.userId,
        tierKey: "strategic",
        stageKey: "identified",
        partnershipTypeKey: "technology",
        industry: "Technology",
        region: "North America",
        annualRevenue: 5000000,
        employeeCount: 1200,
        executiveSponsor: "Chief Revenue Officer",
        marketOpportunityNotes: "Strong expansion fit.",
        nextStep: "Schedule executive briefing.",
        isPartnership: true,
        stakeholders: [
          { contactId, name: "Eve Exec", title: "CTO", influenceLevel: "champion", relationshipStrength: "engaged", isExecutive: true },
          { name: "Sam Buyer", title: "Procurement", influenceLevel: "high", relationshipStrength: "developing", isExecutive: false }
        ]
      }
    });
    const targetAccountId = createdBd.targetAccount.id;
    assert.equal(createdBd.targetAccount.tier?.key, "strategic");
    assert.equal(createdBd.targetAccount.partnershipType?.key, "technology");
    assert.equal(createdBd.targetAccount.stakeholderCount, 2);
    assert.equal(createdBd.targetAccount.executiveStakeholderCount, 1);
    assert.equal(createdBd.targetAccount.stakeholders.length, 2);
    assert.ok(createdBd.targetAccount.aiPlaceholders.actions.some((action) => action.key === "account_research_brief"));
    assert.equal(createdBd.targetAccount.territoryPlaceholder.available, false);

    await assertAuditLog(client, {
      tenantId,
      actorUserId: bdSession.currentUser.id,
      sessionId: bdSession.session.id,
      action: "bd.target_account.create",
      resourceType: "bd_target_account",
      resourceId: targetAccountId
    });

    const bdList = await request("/business-development?pageSize=100", { accessToken: bdSession.accessToken });
    assert.ok(bdList.targetAccounts.some((entry) => entry.id === targetAccountId), "BD list should include the created account.");
    assert.ok(bdList.pagination.total >= 1);

    const bdTierFiltered = await request("/business-development?tier=strategic&isPartnership=true", {
      accessToken: bdSession.accessToken
    });
    assert.ok(
      bdTierFiltered.targetAccounts.some((entry) => entry.id === targetAccountId),
      "BD list should support tier and partnership filters."
    );
    const bdStageMissFiltered = await request("/business-development?stage=on_hold", { accessToken: bdSession.accessToken });
    assert.ok(
      !bdStageMissFiltered.targetAccounts.some((entry) => entry.id === targetAccountId),
      "BD stage filter should exclude accounts in other stages."
    );
    const bdSearchFiltered = await request(`/business-development?search=Strategic%20Target%20${runToken}`, {
      accessToken: bdSession.accessToken
    });
    assert.ok(
      bdSearchFiltered.targetAccounts.some((entry) => entry.id === targetAccountId),
      "BD search filter should match the account name."
    );

    const bdDetail = await request(`/business-development/${targetAccountId}`, { accessToken: bdSession.accessToken });
    assert.equal(bdDetail.targetAccount.name, `Strategic Target ${runToken}`);
    assert.equal(bdDetail.targetAccount.annualRevenue, 5000000);
    assert.equal(bdDetail.targetAccount.employeeCount, 1200, "Target account profile should retain employee count.");
    assert.equal(bdDetail.targetAccount.industry, "Technology", "Target account profile should retain industry.");
    assert.equal(bdDetail.targetAccount.region, "North America", "Target account profile should retain region.");
    assert.equal(
      bdDetail.targetAccount.executiveSponsor,
      "Chief Revenue Officer",
      "Executive engagement tracking should retain the executive sponsor."
    );
    assert.equal(
      bdDetail.targetAccount.marketOpportunityNotes,
      "Strong expansion fit.",
      "Market opportunity notes should be retained."
    );
    assert.equal(bdDetail.targetAccount.account?.id, accountId, "Target account should link to the CRM account.");
    assert.deepEqual(
      bdDetail.targetAccount.aiPlaceholders.actions.map((action) => action.key).sort(),
      ["account_research_brief", "stakeholder_map"],
      "BD AI placeholders should expose the account research brief and stakeholder map."
    );
    const executiveStakeholder = bdDetail.targetAccount.stakeholders.find((entry) => entry.isExecutive);
    assert.ok(executiveStakeholder, "Relationship map should include an executive stakeholder.");
    assert.equal(executiveStakeholder.influenceLevel, "champion");
    assert.equal(executiveStakeholder.relationshipStrength, "engaged");
    assert.ok(executiveStakeholder.contact, "Executive stakeholder should resolve its linked contact.");

    log("Advancing the BD pipeline stage and checking the ownership guard.");
    const bdUpdated = await request(`/business-development/${targetAccountId}`, {
      method: "PATCH",
      accessToken: bdSession.accessToken,
      body: { stageKey: "committed", nextStep: "Draft partnership agreement." }
    });
    assert.equal(bdUpdated.targetAccount.stage?.key, "committed");
    assert.equal(bdUpdated.targetAccount.nextStep, "Draft partnership agreement.");

    await expectError(`/business-development/${targetAccountId}`, {
      method: "PATCH",
      accessToken: bdSession.accessToken,
      expectedStatus: 403,
      expectedCode: "AUTHORIZATION_ERROR",
      body: { ownerId: presalesUser.userId }
    });

    await expectError(`/business-development/${randomUUID()}`, {
      accessToken: bdSession.accessToken,
      expectedStatus: 404,
      expectedCode: "TARGET_ACCOUNT_NOT_FOUND"
    });

    log("Validating presales options, intake, and RFP/RFI requirement tracking.");
    const presalesOptions = await request("/presales/options", { accessToken: presalesSession.accessToken });
    assert.ok(presalesOptions.requestTypes.some((type) => type.key === "rfp"));
    assert.ok(presalesOptions.statuses.some((status) => status.key === "submitted"));
    assert.ok(presalesOptions.opportunities.some((entry) => entry.id === opportunityId));

    await expectError("/presales", {
      method: "POST",
      accessToken: viewerSession.accessToken,
      expectedStatus: 403,
      expectedCode: "FORBIDDEN",
      body: { title: "Blocked", typeKey: "demo" }
    });

    const createdPresales = await request("/presales", {
      method: "POST",
      accessToken: presalesSession.accessToken,
      expectedStatus: 201,
      body: {
        title: `RFP Response ${runToken}`,
        typeKey: "rfp",
        statusKey: "in_review",
        priority: "high",
        opportunityId,
        accountId,
        ownerId: presalesUser.userId,
        assigneeId: presalesUser.userId,
        dueDate: "2026-07-15",
        summary: "Enterprise RFP covering security and integration.",
        technicalRequirements: "SSO, SOC2, REST API",
        proposalContent: "Executive summary and solution overview.",
        requirements: [
          { label: "SSO support", category: "security", requirement: "SAML/OIDC SSO", response: "Supported", complianceStatus: "met", priority: "high" },
          { label: "On-prem deploy", category: "technical", requirement: "Self-hosted option", complianceStatus: "gap", priority: "medium" },
          { label: "Data residency", category: "commercial", complianceStatus: "pending", priority: "low" }
        ]
      }
    });
    const presalesRequestId = createdPresales.request.id;
    assert.equal(createdPresales.request.type?.key, "rfp");
    assert.equal(createdPresales.request.status?.key, "in_review");
    assert.equal(createdPresales.request.priority, "high");
    assert.equal(createdPresales.request.opportunity?.id, opportunityId);
    assert.equal(createdPresales.request.requirementCount, 3);
    assert.equal(createdPresales.request.metRequirementCount, 1);
    assert.equal(createdPresales.request.gapRequirementCount, 1);
    assert.equal(createdPresales.request.requirements.length, 3);
    assert.equal(createdPresales.request.proposalContent, "Executive summary and solution overview.");
    assert.equal(createdPresales.request.account?.id, accountId, "Presales request should link to the account.");
    assert.equal(createdPresales.request.assignee?.id, presalesUser.userId, "Presales task assignment should be retained.");
    assert.equal(createdPresales.request.technicalRequirements, "SSO, SOC2, REST API", "Technical requirement mapping should be retained.");
    assert.deepEqual(
      createdPresales.request.aiPlaceholders.actions.map((action) => action.key).sort(),
      ["compliance_matrix", "demo_script", "proposal_response_draft", "rfp_extraction", "technical_risk_detection"],
      "Presales AI placeholders should expose the full Phase 12 action set."
    );
    assert.equal(createdPresales.request.demoCalendarPlaceholder.available, false);
    assert.equal(createdPresales.request.solutionRepositoryPlaceholder.available, false);
    const gapRequirement = createdPresales.request.requirements.find((entry) => entry.complianceStatus === "gap");
    assert.ok(gapRequirement, "Compliance matrix should track a gap requirement.");
    assert.equal(gapRequirement.category, "technical");

    log("Creating a demo-type presales request to cover the demo intake path.");
    const demoRequest = await request("/presales", {
      method: "POST",
      accessToken: presalesSession.accessToken,
      expectedStatus: 201,
      body: {
        title: `Demo Request ${runToken}`,
        typeKey: "demo",
        priority: "medium",
        opportunityId,
        ownerId: presalesUser.userId,
        assigneeId: presalesUser.userId,
        summary: "Tailored product demo for the buying committee."
      }
    });
    assert.equal(demoRequest.request.type?.key, "demo", "Demo request type should be supported.");
    assert.equal(demoRequest.request.requirementCount, 0, "Demo request should start with no requirements.");

    log("Creating an RFI-type presales request to complete RFP/RFI coverage.");
    const rfiRequest = await request("/presales", {
      method: "POST",
      accessToken: presalesSession.accessToken,
      expectedStatus: 201,
      body: {
        title: `RFI Response ${runToken}`,
        typeKey: "rfi",
        priority: "low",
        accountId,
        ownerId: presalesUser.userId,
        assigneeId: presalesUser.userId,
        requirements: [{ label: "Integration overview", category: "integration", complianceStatus: "met", priority: "low" }]
      }
    });
    assert.equal(rfiRequest.request.type?.key, "rfi", "RFI request type should be supported.");
    assert.equal(rfiRequest.request.requirementCount, 1);

    log("Validating presales list filters by type, status, and priority.");
    const presalesByType = await request("/presales?type=rfp", { accessToken: presalesSession.accessToken });
    assert.ok(presalesByType.requests.some((entry) => entry.id === presalesRequestId), "Type filter should match the RFP request.");
    assert.ok(
      !presalesByType.requests.some((entry) => entry.id === demoRequest.request.id),
      "Type filter should exclude requests of other types."
    );
    const presalesByPriority = await request("/presales?priority=high", { accessToken: presalesSession.accessToken });
    assert.ok(
      presalesByPriority.requests.some((entry) => entry.id === presalesRequestId),
      "Priority filter should match the high-priority request."
    );
    const presalesByStatus = await request("/presales?status=in_review", { accessToken: presalesSession.accessToken });
    assert.ok(
      presalesByStatus.requests.some((entry) => entry.id === presalesRequestId),
      "Status filter should match the in-review request."
    );

    await assertAuditLog(client, {
      tenantId,
      actorUserId: presalesSession.currentUser.id,
      sessionId: presalesSession.session.id,
      action: "presales.request.create",
      resourceType: "presales_request",
      resourceId: presalesRequestId
    });

    const presalesList = await request("/presales?pageSize=100", { accessToken: presalesSession.accessToken });
    assert.ok(presalesList.requests.some((entry) => entry.id === presalesRequestId));

    const presalesByOpportunity = await request(`/presales?opportunityId=${opportunityId}`, {
      accessToken: presalesSession.accessToken
    });
    assert.ok(
      presalesByOpportunity.requests.some((entry) => entry.id === presalesRequestId),
      "Presales requests should be filterable by linked opportunity."
    );

    log("Updating a presales request status and requirement compliance.");
    const presalesUpdated = await request(`/presales/${presalesRequestId}`, {
      method: "PATCH",
      accessToken: presalesSession.accessToken,
      body: {
        statusKey: "submitted",
        requirements: [
          { label: "SSO support", category: "security", complianceStatus: "met", priority: "high" },
          { label: "On-prem deploy", category: "technical", complianceStatus: "met", priority: "medium" }
        ]
      }
    });
    assert.equal(presalesUpdated.request.status?.key, "submitted");
    assert.equal(presalesUpdated.request.requirementCount, 2);
    assert.equal(presalesUpdated.request.metRequirementCount, 2);
    assert.equal(presalesUpdated.request.gapRequirementCount, 0);

    await expectError(`/presales/${randomUUID()}`, {
      accessToken: presalesSession.accessToken,
      expectedStatus: 404,
      expectedCode: "PRESALES_REQUEST_NOT_FOUND"
    });

    log("Checking tenant isolation against a second tenant target account.");
    const secondTenantResult = await client.query(
      `INSERT INTO tenants (slug, name, status, metadata) VALUES ($1, $2, 'active', jsonb_build_object('testRun', $3::text)) RETURNING id`,
      [`phase12-${runToken}-tenant`, `Phase 12 Tenant ${runToken}`, runToken]
    );
    const secondTenantId = secondTenantResult.rows[0].id;
    for (const setKey of ["bd-account-tier", "bd-pipeline-stage"]) {
      await cloneOptionSet(client, tenantId, secondTenantId, setKey);
    }
    const secondTierId = await getOptionValueId(client, secondTenantId, "bd-account-tier", "strategic");
    const secondStageId = await getOptionValueId(client, secondTenantId, "bd-pipeline-stage", "identified");
    const secondTenantBd = await client.query(
      `INSERT INTO bd_target_accounts (tenant_id, name, tier_option_id, stage_option_id, metadata)
       VALUES ($1, $2, $3, $4, jsonb_build_object('testRun', $5::text)) RETURNING id`,
      [secondTenantId, `Isolated Target ${runToken}`, secondTierId, secondStageId, runToken]
    );
    const secondTenantBdId = secondTenantBd.rows[0].id;

    await expectError(`/business-development/${secondTenantBdId}`, {
      accessToken: adminSession.accessToken,
      expectedStatus: 404,
      expectedCode: "TARGET_ACCOUNT_NOT_FOUND"
    });

    log("Soft-deleting the BD target account and presales request.");
    await request(`/presales/${presalesRequestId}`, {
      method: "DELETE",
      accessToken: adminSession.accessToken
    });
    await expectError(`/presales/${presalesRequestId}`, {
      accessToken: presalesSession.accessToken,
      expectedStatus: 404,
      expectedCode: "PRESALES_REQUEST_NOT_FOUND"
    });

    await request(`/business-development/${targetAccountId}`, {
      method: "DELETE",
      accessToken: adminSession.accessToken
    });
    await expectError(`/business-development/${targetAccountId}`, {
      accessToken: bdSession.accessToken,
      expectedStatus: 404,
      expectedCode: "TARGET_ACCOUNT_NOT_FOUND"
    });

    log("Phase 12 business development and presales checks passed.");
  } finally {
    await client.end();
  }
}

await main();
