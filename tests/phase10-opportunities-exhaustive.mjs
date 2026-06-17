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
const opportunityOptionSetKeys = [
  "opportunity-pipeline",
  "opportunity-source",
  "opportunity-outcome-status"
];
const opportunityPermissionCodes = [
  "opportunities.view",
  "opportunities.create",
  "opportunities.approve",
  "opportunities.manage_workflow",
  "ai.use_ai"
];

function log(message) {
  console.log(`[phase10-exhaustive] ${message}`);
}

function buildQueryString(input) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    params.set(key, String(value));
  }

  const queryString = params.toString();
  return queryString.length > 0 ? `?${queryString}` : "";
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

function getDateString(date) {
  return date.toISOString().slice(0, 10);
}

function toSlug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
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
  const payload = await request(path, {
    ...options,
    expectedStatus
  });

  assert.ok(payload?.error, `Expected an error payload from ${options.method ?? "GET"} ${path}.`);
  assert.equal(payload.error.code, expectedCode);
  return payload.error;
}

async function loginSession(tenantSlug, email, password) {
  const authPayload = await request("/auth/login", {
    method: "POST",
    expectedStatus: 200,
    body: {
      tenantSlug,
      email,
      password
    }
  });

  const accessToken = authPayload.tokens.accessToken;
  assert.ok(accessToken, "Login should return an access token.");

  const currentUserPayload = await request("/auth/me", {
    accessToken,
    expectedStatus: 200
  });

  return {
    accessToken,
    auth: authPayload,
    currentUser: currentUserPayload.user,
    session: currentUserPayload.session
  };
}

async function queryOne(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0] ?? null;
}

async function assertSchemaFoundation(client) {
  for (const tableName of ["opportunities", "opportunity_stakeholders"]) {
    const row = await queryOne(
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
    assert.equal(row?.table_name, tableName, `${tableName} should exist after the Phase 10 migration.`);
  }

  for (const [tableName, columnName] of [
    ["opportunities", "stage_option_id"],
    ["opportunities", "source_option_id"],
    ["opportunities", "outcome_status_option_id"],
    ["opportunities", "last_stage_changed_at"],
    ["opportunity_stakeholders", "contact_id"]
  ]) {
    const row = await queryOne(
      client,
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
        LIMIT 1
      `,
      [tableName, columnName]
    );
    assert.equal(row?.column_name, columnName, `${tableName}.${columnName} should exist after Phase 10.`);
  }
}

async function assertSeedBaseline(client) {
  const tenant = await queryOne(
    client,
    `
      SELECT id, slug, status
      FROM tenants
      WHERE slug = $1
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [defaultTenantSlug]
  );
  assert.ok(tenant, "Default tenant should exist after seeding.");
  assert.equal(tenant.status, "active");

  const adminUser = await queryOne(
    client,
    `
      SELECT id, status
      FROM users
      WHERE tenant_id = $1
        AND normalized_email = LOWER($2)
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [tenant.id, defaultAdminEmail]
  );
  assert.ok(adminUser, "Default admin user should exist after seeding.");
  assert.equal(adminUser.status, "active");

  const permissions = await queryOne(
    client,
    `
      SELECT COUNT(*)::int AS count
      FROM permissions
      WHERE deleted_at IS NULL
        AND code = ANY($1::text[])
    `,
    [opportunityPermissionCodes]
  );
  assert.equal(permissions.count, opportunityPermissionCodes.length, "Opportunity and AI permissions should be seeded.");

  const optionSets = await queryOne(
    client,
    `
      SELECT COUNT(*)::int AS count
      FROM tenant_option_sets
      WHERE tenant_id = $1
        AND deleted_at IS NULL
        AND set_key = ANY($2::text[])
    `,
    [tenant.id, opportunityOptionSetKeys]
  );
  assert.equal(optionSets.count, opportunityOptionSetKeys.length, "Opportunity option sets should be seeded.");

  const formLayout = await queryOne(
    client,
    `
      SELECT layout_key
      FROM custom_form_layouts
      WHERE tenant_id = $1
        AND module_key = 'opportunities'
        AND entity_key = 'opportunity'
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [tenant.id]
  );
  assert.equal(formLayout?.layout_key, "default-opportunity-layout");

  return {
    tenantId: tenant.id,
    adminUserId: adminUser.id
  };
}

async function assertAuditLog(
  client,
  {
    tenantId,
    actorUserId,
    sessionId,
    action,
    resourceType,
    resourceId,
    status = "success"
  }
) {
  const row = await queryOne(
    client,
    `
      SELECT event_type, action, resource_type, resource_id, status
      FROM audit_logs
      WHERE tenant_id = $1
        AND actor_user_id = $2
        AND session_id = $3
        AND action = $4
        AND resource_type = $5
        AND resource_id = $6
        AND status = $7
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [tenantId, actorUserId, sessionId, action, resourceType, resourceId, status]
  );

  assert.ok(row, `Audit log ${action} for ${resourceType} ${resourceId} should exist.`);
  assert.equal(row.event_type, "crm");
}

async function createTenant(client, slug, name) {
  const result = await client.query(
    `
      INSERT INTO tenants (slug, name, status, metadata)
      VALUES ($1, $2, 'active', jsonb_build_object('testRun', $3::text))
      RETURNING id
    `,
    [slug, name, runToken]
  );

  return result.rows[0].id;
}

async function createTeam(client, tenantId, name) {
  const result = await client.query(
    `
      INSERT INTO teams (tenant_id, slug, name, metadata)
      VALUES ($1, $2, $3, jsonb_build_object('testRun', $4::text))
      RETURNING id
    `,
    [tenantId, `${toSlug(name)}-${runToken}`, name, runToken]
  );

  return result.rows[0].id;
}

async function cloneOptionSet(client, sourceTenantId, targetTenantId, setKey) {
  const setResult = await client.query(
    `
      WITH source_set AS (
        SELECT *
        FROM tenant_option_sets
        WHERE tenant_id = $1
          AND set_key = $2
          AND deleted_at IS NULL
        LIMIT 1
      )
      INSERT INTO tenant_option_sets (
        tenant_id,
        set_key,
        module_key,
        kind,
        name,
        description,
        is_system_set,
        is_active,
        metadata
      )
      SELECT
        $3,
        source_set.set_key,
        source_set.module_key,
        source_set.kind,
        source_set.name,
        source_set.description,
        source_set.is_system_set,
        source_set.is_active,
        source_set.metadata || jsonb_build_object('clonedFor', $4::text)
      FROM source_set
      RETURNING id
    `,
    [sourceTenantId, setKey, targetTenantId, runToken]
  );

  const targetSetId = setResult.rows[0]?.id;
  assert.ok(targetSetId, `Option set ${setKey} should clone.`);

  await client.query(
    `
      INSERT INTO tenant_option_values (
        tenant_id,
        option_set_id,
        value_key,
        label,
        description,
        color,
        sort_order,
        is_default,
        is_active,
        metadata
      )
      SELECT
        $3,
        $4,
        tenant_option_values.value_key,
        tenant_option_values.label,
        tenant_option_values.description,
        tenant_option_values.color,
        tenant_option_values.sort_order,
        tenant_option_values.is_default,
        tenant_option_values.is_active,
        tenant_option_values.metadata || jsonb_build_object('clonedFor', $5::text)
      FROM tenant_option_sets
      INNER JOIN tenant_option_values
        ON tenant_option_values.option_set_id = tenant_option_sets.id
       AND tenant_option_values.tenant_id = tenant_option_sets.tenant_id
      WHERE tenant_option_sets.tenant_id = $1
        AND tenant_option_sets.set_key = $2
        AND tenant_option_sets.deleted_at IS NULL
        AND tenant_option_values.deleted_at IS NULL
    `,
    [sourceTenantId, setKey, targetTenantId, targetSetId, runToken]
  );
}

async function createUserWithPermissions(
  client,
  { tenantId, email, password, firstName, lastName, roleName, roleSlug, permissionCodes, teamId = null }
) {
  const roleResult = await client.query(
    `
      INSERT INTO roles (tenant_id, slug, name, description, metadata)
      VALUES ($1, $2, $3, $4, jsonb_build_object('testRun', $5::text))
      RETURNING id
    `,
    [tenantId, roleSlug, roleName, `${roleName} for phase 10 testing`, runToken]
  );
  const roleId = roleResult.rows[0].id;

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
        team_id,
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
        $7,
        NOW(),
        jsonb_build_object('testRun', $8::text)
      )
      RETURNING id
    `,
    [tenantId, email, firstName, lastName, displayName, password, teamId, runToken]
  );
  const userId = userResult.rows[0].id;

  await client.query(
    `
      INSERT INTO user_roles (tenant_id, user_id, role_id, metadata)
      VALUES ($1, $2, $3, jsonb_build_object('testRun', $4::text))
    `,
    [tenantId, userId, roleId, runToken]
  );

  return { userId, roleId, displayName };
}

async function assertOpportunityState(
  client,
  opportunityId,
  {
    tenantId,
    actorUserId,
    ownerUserId,
    accountId,
    primaryContactId,
    name,
    stageKey,
    sourceKey,
    outcomeStatusKey,
    stakeholderContactIds
  }
) {
  const row = await queryOne(
    client,
    `
      SELECT
        opportunities.tenant_id,
        opportunities.owner_id,
        opportunities.account_id,
        opportunities.primary_contact_id,
        opportunities.name,
        opportunities.created_by,
        opportunities.updated_by,
        opportunities.deleted_at,
        stage_values.value_key AS stage_key,
        source_values.value_key AS source_key,
        outcome_values.value_key AS outcome_status_key,
        ARRAY_REMOVE(ARRAY_AGG(opportunity_stakeholders.contact_id ORDER BY opportunity_stakeholders.contact_id), NULL) AS stakeholder_contact_ids
      FROM opportunities
      INNER JOIN tenant_option_values AS stage_values
        ON stage_values.id = opportunities.stage_option_id
       AND stage_values.tenant_id = opportunities.tenant_id
      INNER JOIN tenant_option_values AS source_values
        ON source_values.id = opportunities.source_option_id
       AND source_values.tenant_id = opportunities.tenant_id
      INNER JOIN tenant_option_values AS outcome_values
        ON outcome_values.id = opportunities.outcome_status_option_id
       AND outcome_values.tenant_id = opportunities.tenant_id
      LEFT JOIN opportunity_stakeholders
        ON opportunity_stakeholders.opportunity_id = opportunities.id
       AND opportunity_stakeholders.tenant_id = opportunities.tenant_id
       AND opportunity_stakeholders.deleted_at IS NULL
      WHERE opportunities.id = $1
      GROUP BY
        opportunities.tenant_id,
        opportunities.owner_id,
        opportunities.account_id,
        opportunities.primary_contact_id,
        opportunities.name,
        opportunities.created_by,
        opportunities.updated_by,
        opportunities.deleted_at,
        stage_values.value_key,
        source_values.value_key,
        outcome_values.value_key
      LIMIT 1
    `,
    [opportunityId]
  );

  assert.ok(row, `opportunity ${opportunityId} should exist.`);
  assert.equal(row.tenant_id, tenantId);
  assert.equal(row.owner_id, ownerUserId);
  assert.equal(row.account_id, accountId);
  assert.equal(row.primary_contact_id, primaryContactId);
  assert.equal(row.name, name);
  assert.equal(row.stage_key, stageKey);
  assert.equal(row.source_key, sourceKey);
  assert.equal(row.outcome_status_key, outcomeStatusKey);
  assert.equal(row.created_by, actorUserId);
  assert.equal(row.deleted_at, null);
  assert.deepEqual((row.stakeholder_contact_ids ?? []).sort(), [...stakeholderContactIds].sort());
}

async function assertStageChangeActivity(client, opportunityId, toStageLabel) {
  const row = await queryOne(
    client,
    `
      SELECT subject, activity_type
      FROM crm_activities
      WHERE tenant_id = (
          SELECT tenant_id
          FROM opportunities
          WHERE id = $1
          LIMIT 1
        )
        AND entity_type = 'opportunity'
        AND entity_id = $1
        AND activity_type = 'status_change'
        AND deleted_at IS NULL
      ORDER BY occurred_at DESC, created_at DESC
      LIMIT 1
    `,
    [opportunityId]
  );

  assert.ok(row, "A stage-change activity should be recorded.");
  assert.equal(row.activity_type, "status_change");
  assert.ok(row.subject.includes(toStageLabel), "Stage-change activity subject should reference the destination stage.");
}

async function main() {
  const client = new Client({
    connectionString: databaseUrl
  });

  await client.connect();

  try {
    log("Checking Phase 10 schema foundation and seeded opportunity catalogs.");
    await assertSchemaFoundation(client);
    const { tenantId, adminUserId } = await assertSeedBaseline(client);

    log("Authenticating as the seeded admin user.");
    const adminSession = await loginSession(defaultTenantSlug, defaultAdminEmail, defaultAdminPassword);
    assert.equal(adminSession.currentUser.id, adminUserId);

    const thisMonth = new Date();
    const closingThisMonthDate = getDateString(new Date(Date.UTC(thisMonth.getUTCFullYear(), thisMonth.getUTCMonth(), 24)));
    const nextMonthDate = getDateString(new Date(Date.UTC(thisMonth.getUTCFullYear(), thisMonth.getUTCMonth() + 1, 18)));

    const salesTeamId = await createTeam(client, tenantId, `Sales Team ${runToken}`);
    const growthTeamId = await createTeam(client, tenantId, `Growth Team ${runToken}`);

    const sameTeamOwnerPassword = `Owner-${runToken}-Pass1!`;
    const sameTeamOwner = await createUserWithPermissions(client, {
      tenantId,
      email: `opportunity-owner-${runToken}@example.test`,
      password: sameTeamOwnerPassword,
      firstName: "Sales",
      lastName: "Owner",
      roleName: `Opportunity Owner ${runToken}`,
      roleSlug: `opportunity-owner-${runToken}`,
      permissionCodes: ["opportunities.view", "accounts.view", "contacts.view"],
      teamId: salesTeamId
    });

    const sameTeamManagerPassword = `Manager-${runToken}-Pass1!`;
    await createUserWithPermissions(client, {
      tenantId,
      email: `opportunity-manager-${runToken}@example.test`,
      password: sameTeamManagerPassword,
      firstName: "Sales",
      lastName: "Manager",
      roleName: `Opportunity Manager ${runToken}`,
      roleSlug: `opportunity-manager-${runToken}`,
      permissionCodes: ["opportunities.view", "opportunities.view_dashboard"],
      teamId: salesTeamId
    });

    const otherTeamOwnerPassword = `Other-${runToken}-Pass1!`;
    const otherTeamOwner = await createUserWithPermissions(client, {
      tenantId,
      email: `opportunity-other-${runToken}@example.test`,
      password: otherTeamOwnerPassword,
      firstName: "Growth",
      lastName: "Owner",
      roleName: `Other Team Owner ${runToken}`,
      roleSlug: `other-team-owner-${runToken}`,
      permissionCodes: ["opportunities.view", "accounts.view", "contacts.view"],
      teamId: growthTeamId
    });

    log("Creating supporting accounts and contacts for account/contact linkage.");
    const accountAlpha = await request("/accounts", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        name: `Alpha Account ${runToken}`,
        website: "https://alpha.example.test",
        industry: "Technology"
      }
    });
    const accountBeta = await request("/accounts", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        name: `Beta Account ${runToken}`,
        website: "https://beta.example.test",
        industry: "Services"
      }
    });
    const accountAlphaId = accountAlpha.account.id;
    const accountBetaId = accountBeta.account.id;

    const contactAlpha = await request("/contacts", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        firstName: "Priya",
        lastName: `Alpha ${runToken}`,
        email: `priya-alpha-${runToken}@example.test`,
        accountId: accountAlphaId
      }
    });
    const contactBeta = await request("/contacts", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        firstName: "Rohit",
        lastName: `Beta ${runToken}`,
        email: `rohit-beta-${runToken}@example.test`,
        accountId: accountBetaId
      }
    });
    const contactAlphaId = contactAlpha.contact.id;
    const contactBetaId = contactBeta.contact.id;

    log("Checking opportunity options, candidate lookups, and validation paths.");
    const opportunityOptions = await request("/opportunities/options", {
      accessToken: adminSession.accessToken,
      expectedStatus: 200
    });
    assert.ok(opportunityOptions.stages.some((option) => option.key === "discovery"));
    assert.ok(opportunityOptions.sources.some((option) => option.key === "inbound"));
    assert.ok(opportunityOptions.outcomeStatuses.some((option) => option.key === "open"));
    assert.ok(opportunityOptions.accounts.some((account) => account.id === accountAlphaId));
    assert.ok(opportunityOptions.contacts.some((contact) => contact.id === contactAlphaId));
    assert.ok(opportunityOptions.availableScopes.includes("all"));

    await expectError("/opportunities", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 400,
      expectedCode: "INVALID_OWNER",
      body: {
        name: `Invalid Owner ${runToken}`,
        stageKey: "discovery",
        sourceKey: "inbound",
        ownerId: randomUUID()
      }
    });
    await expectError("/opportunities", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 400,
      expectedCode: "INVALID_CONTACT_ACCOUNT_RELATION",
      body: {
        name: `Invalid Contact ${runToken}`,
        accountId: accountBetaId,
        primaryContactId: contactAlphaId,
        stageKey: "discovery",
        sourceKey: "inbound"
      }
    });

    log("Creating, listing, and dashboarding live opportunities.");
    const alphaOpportunity = await request("/opportunities", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        name: `Alpha Deal ${runToken}`,
        accountId: accountAlphaId,
        primaryContactId: contactAlphaId,
        ownerId: sameTeamOwner.userId,
        stageKey: "discovery",
        amount: 20000,
        probability: 30,
        expectedCloseDate: closingThisMonthDate,
        sourceKey: "inbound",
        competitor: `Competitor ${runToken}`,
        stakeholderContactIds: [contactAlphaId],
        nextStep: `Discovery follow-up ${runToken}`,
        metadata: {
          runToken
        }
      }
    });
    const alphaOpportunityId = alphaOpportunity.opportunity.id;
    assert.equal(alphaOpportunity.opportunity.aiPlaceholders.actions.length, 5);
    await assertOpportunityState(client, alphaOpportunityId, {
      tenantId,
      actorUserId: adminSession.currentUser.id,
      ownerUserId: sameTeamOwner.userId,
      accountId: accountAlphaId,
      primaryContactId: contactAlphaId,
      name: `Alpha Deal ${runToken}`,
      stageKey: "discovery",
      sourceKey: "inbound",
      outcomeStatusKey: "open",
      stakeholderContactIds: [contactAlphaId]
    });
    await assertAuditLog(client, {
      tenantId,
      actorUserId: adminSession.currentUser.id,
      sessionId: adminSession.session.id,
      action: "opportunity.create",
      resourceType: "opportunity",
      resourceId: alphaOpportunityId
    });

    const betaOpportunity = await request("/opportunities", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        name: `Beta Deal ${runToken}`,
        accountId: accountAlphaId,
        primaryContactId: contactAlphaId,
        ownerId: otherTeamOwner.userId,
        stageKey: "proposal",
        amount: 30000,
        probability: 55,
        expectedCloseDate: nextMonthDate,
        sourceKey: "campaign",
        stakeholderContactIds: [contactAlphaId],
        nextStep: `Proposal review ${runToken}`
      }
    });
    const betaOpportunityId = betaOpportunity.opportunity.id;

    const gammaOpportunity = await request("/opportunities", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        name: `Gamma Deal ${runToken}`,
        accountId: accountBetaId,
        primaryContactId: contactBetaId,
        ownerId: sameTeamOwner.userId,
        stageKey: "closed_lost",
        amount: 15000,
        probability: 0,
        expectedCloseDate: closingThisMonthDate,
        sourceKey: "referral",
        outcomeStatusKey: "lost",
        outcomeReason: `Budget loss ${runToken}`,
        stakeholderContactIds: [contactBetaId]
      }
    });
    const gammaOpportunityId = gammaOpportunity.opportunity.id;

    await client.query(
      `
        UPDATE opportunities
        SET last_stage_changed_at = NOW() - interval '45 days'
        WHERE id = $1
      `,
      [betaOpportunityId]
    );

    const sortedList = await request(
      `/opportunities${buildQueryString({ search: runToken, sortBy: "name", sortOrder: "asc", scope: "all", pageSize: 1, page: 1 })}`,
      {
        accessToken: adminSession.accessToken,
        expectedStatus: 200
      }
    );
    assert.equal(sortedList.pagination.total, 3);
    assert.equal(sortedList.opportunities[0]?.id, alphaOpportunityId);

    const secondSortedPage = await request(
      `/opportunities${buildQueryString({ search: runToken, sortBy: "name", sortOrder: "asc", scope: "all", pageSize: 1, page: 2 })}`,
      {
        accessToken: adminSession.accessToken,
        expectedStatus: 200
      }
    );
    assert.equal(secondSortedPage.opportunities[0]?.id, betaOpportunityId);

    const stageFilteredList = await request(
      `/opportunities${buildQueryString({ search: runToken, stage: "proposal", scope: "all" })}`,
      {
        accessToken: adminSession.accessToken,
        expectedStatus: 200
      }
    );
    assert.equal(stageFilteredList.pagination.total, 1);
    assert.equal(stageFilteredList.opportunities[0]?.id, betaOpportunityId);

    const accountFilteredList = await request(
      `/opportunities${buildQueryString({ search: runToken, accountId: accountAlphaId, scope: "all" })}`,
      {
        accessToken: adminSession.accessToken,
        expectedStatus: 200
      }
    );
    assert.equal(accountFilteredList.pagination.total, 2);

    const contactFilteredList = await request(
      `/opportunities${buildQueryString({ search: runToken, contactId: contactAlphaId, scope: "all" })}`,
      {
        accessToken: adminSession.accessToken,
        expectedStatus: 200
      }
    );
    assert.equal(contactFilteredList.pagination.total, 2);

    const dashboard = await request(
      `/opportunities/dashboard${buildQueryString({ search: runToken, scope: "all", stalledDays: 30 })}`,
      {
        accessToken: adminSession.accessToken,
        expectedStatus: 200
      }
    );
    assert.equal(dashboard.visibleCount, 3);
    assert.equal(dashboard.pipelineValue, 50000);
    assert.equal(dashboard.closingThisMonthCount, 1);
    assert.equal(dashboard.closingThisMonthValue, 20000);
    assert.equal(dashboard.stalledDealsCount, 1);
    assert.equal(dashboard.stalledDealsValue, 30000);
    assert.ok(dashboard.stageDistribution.some((stage) => stage.stage?.key === "discovery"));

    log("Verifying pipeline scope behavior and permission middleware.");
    const managerSession = await loginSession(
      defaultTenantSlug,
      `opportunity-manager-${runToken}@example.test`,
      sameTeamManagerPassword
    );
    const teamScopeList = await request(
      `/opportunities${buildQueryString({ search: runToken, scope: "team", sortBy: "name", sortOrder: "asc" })}`,
      {
        accessToken: managerSession.accessToken,
        expectedStatus: 200
      }
    );
    assert.equal(teamScopeList.pagination.total, 2);
    assert.ok(teamScopeList.opportunities.every((opportunity) => opportunity.owner?.id === sameTeamOwner.userId));

    const allScopeList = await request(
      `/opportunities${buildQueryString({ search: runToken, scope: "all" })}`,
      {
        accessToken: managerSession.accessToken,
        expectedStatus: 200
      }
    );
    assert.equal(allScopeList.pagination.total, 3);

    const viewerPassword = `Viewer-${runToken}-Pass1!`;
    await createUserWithPermissions(client, {
      tenantId,
      email: `opportunity-viewer-${runToken}@example.test`,
      password: viewerPassword,
      firstName: "Opportunity",
      lastName: "Viewer",
      roleName: `Opportunity Viewer ${runToken}`,
      roleSlug: `opportunity-viewer-${runToken}`,
      permissionCodes: ["opportunities.view"]
    });
    const viewerSession = await loginSession(defaultTenantSlug, `opportunity-viewer-${runToken}@example.test`, viewerPassword);
    const viewerDetail = await request(`/opportunities/${alphaOpportunityId}`, {
      accessToken: viewerSession.accessToken,
      expectedStatus: 200
    });
    assert.equal(viewerDetail.opportunity.aiPlaceholders.actions.length, 0);
    await expectError("/opportunities", {
      method: "POST",
      accessToken: viewerSession.accessToken,
      expectedStatus: 403,
      expectedCode: "FORBIDDEN",
      body: {
        name: `Blocked Opportunity ${runToken}`,
        stageKey: "discovery",
        sourceKey: "inbound"
      }
    });
    await expectError(
      `/opportunities${buildQueryString({ search: runToken, scope: "all" })}`,
      {
        accessToken: viewerSession.accessToken,
        expectedStatus: 403,
        expectedCode: "AUTHORIZATION_ERROR"
      }
    );

    const assignPassword = `Assign-${runToken}-Pass1!`;
    await createUserWithPermissions(client, {
      tenantId,
      email: `opportunity-assign-${runToken}@example.test`,
      password: assignPassword,
      firstName: "Opportunity",
      lastName: "Assign",
      roleName: `Opportunity Assign ${runToken}`,
      roleSlug: `opportunity-assign-${runToken}`,
      permissionCodes: ["opportunities.view", "opportunities.assign"]
    });
    const assignSession = await loginSession(defaultTenantSlug, `opportunity-assign-${runToken}@example.test`, assignPassword);
    const assignUpdate = await request(`/opportunities/${alphaOpportunityId}`, {
      method: "PATCH",
      accessToken: assignSession.accessToken,
      expectedStatus: 200,
      body: {
        ownerId: adminSession.currentUser.id
      }
    });
    assert.equal(assignUpdate.opportunity.owner?.id, adminSession.currentUser.id);
    await expectError(`/opportunities/${alphaOpportunityId}`, {
      method: "PATCH",
      accessToken: assignSession.accessToken,
      expectedStatus: 403,
      expectedCode: "AUTHORIZATION_ERROR",
      body: {
        name: `Blocked rename ${runToken}`
      }
    });

    const approvePassword = `Approve-${runToken}-Pass1!`;
    await createUserWithPermissions(client, {
      tenantId,
      email: `opportunity-approve-${runToken}@example.test`,
      password: approvePassword,
      firstName: "Opportunity",
      lastName: "Approve",
      roleName: `Opportunity Approver ${runToken}`,
      roleSlug: `opportunity-approve-${runToken}`,
      permissionCodes: ["opportunities.view", "opportunities.approve"]
    });
    const approveSession = await loginSession(defaultTenantSlug, `opportunity-approve-${runToken}@example.test`, approvePassword);
    const approvalUpdate = await request(`/opportunities/${alphaOpportunityId}`, {
      method: "PATCH",
      accessToken: approveSession.accessToken,
      expectedStatus: 200,
      body: {
        stageKey: "negotiation",
        nextStep: `Negotiation review ${runToken}`,
        probability: 65
      }
    });
    assert.equal(approvalUpdate.opportunity.stage?.key, "negotiation");
    assert.equal(approvalUpdate.opportunity.outcomeStatus?.key, "open");
    await assertAuditLog(client, {
      tenantId,
      actorUserId: approveSession.currentUser.id,
      sessionId: approveSession.session.id,
      action: "opportunity.stage_change",
      resourceType: "opportunity",
      resourceId: alphaOpportunityId
    });
    await assertAuditLog(client, {
      tenantId,
      actorUserId: approveSession.currentUser.id,
      sessionId: approveSession.session.id,
      action: "opportunity.update",
      resourceType: "opportunity",
      resourceId: alphaOpportunityId
    });
    await assertStageChangeActivity(client, alphaOpportunityId, "Negotiation");
    await expectError(`/opportunities/${alphaOpportunityId}`, {
      method: "PATCH",
      accessToken: approveSession.accessToken,
      expectedStatus: 403,
      expectedCode: "AUTHORIZATION_ERROR",
      body: {
        amount: 99999,
        name: `Blocked amount change ${runToken}`
      }
    });

    log("Checking tenant isolation for opportunities.");
    const secondTenantId = await createTenant(client, `opportunity-tenant-${runToken}`, `Opportunity Tenant ${runToken}`);
    for (const setKey of opportunityOptionSetKeys) {
      await cloneOptionSet(client, tenantId, secondTenantId, setKey);
    }

    const secondTenantPassword = `Second-${runToken}-Pass1!`;
    await createUserWithPermissions(client, {
      tenantId: secondTenantId,
      email: `opportunity-admin-${runToken}@tenant-two.test`,
      password: secondTenantPassword,
      firstName: "Second",
      lastName: "Tenant",
      roleName: `Second Opportunity Admin ${runToken}`,
      roleSlug: `second-opportunity-admin-${runToken}`,
      permissionCodes: [
        "opportunities.view",
        "opportunities.create",
        "opportunities.edit",
        "opportunities.delete",
        "opportunities.approve",
        "opportunities.configure",
        "opportunities.view_dashboard",
        "opportunities.manage_workflow"
      ]
    });
    const secondTenantSession = await loginSession(
      `opportunity-tenant-${runToken}`,
      `opportunity-admin-${runToken}@tenant-two.test`,
      secondTenantPassword
    );
    await request("/opportunities", {
      method: "POST",
      accessToken: secondTenantSession.accessToken,
      expectedStatus: 201,
      body: {
        name: `Second Tenant Deal ${runToken}`,
        stageKey: "discovery",
        sourceKey: "inbound"
      }
    });
    await expectError(`/opportunities/${alphaOpportunityId}`, {
      accessToken: secondTenantSession.accessToken,
      expectedStatus: 404,
      expectedCode: "OPPORTUNITY_NOT_FOUND"
    });
    await expectError("/opportunities", {
      method: "POST",
      accessToken: secondTenantSession.accessToken,
      expectedStatus: 400,
      expectedCode: "INVALID_ACCOUNT",
      body: {
        name: `Cross Tenant Account ${runToken}`,
        accountId: accountAlphaId,
        stageKey: "discovery",
        sourceKey: "inbound"
      }
    });

    log("Soft-deleting the primary opportunity and confirming it disappears.");
    await request(`/opportunities/${alphaOpportunityId}`, {
      method: "DELETE",
      accessToken: adminSession.accessToken,
      expectedStatus: 200
    });
    await assertAuditLog(client, {
      tenantId,
      actorUserId: adminSession.currentUser.id,
      sessionId: adminSession.session.id,
      action: "opportunity.delete",
      resourceType: "opportunity",
      resourceId: alphaOpportunityId
    });
    await expectError(`/opportunities/${alphaOpportunityId}`, {
      accessToken: adminSession.accessToken,
      expectedStatus: 404,
      expectedCode: "OPPORTUNITY_NOT_FOUND"
    });

    const stakeholderRows = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM opportunity_stakeholders
        WHERE opportunity_id = $1
          AND deleted_at IS NULL
      `,
      [alphaOpportunityId]
    );
    assert.equal(stakeholderRows.rows[0].count, 0);

    const finalList = await request(`/opportunities${buildQueryString({ search: runToken, scope: "all" })}`, {
      accessToken: adminSession.accessToken,
      expectedStatus: 200
    });
    assert.ok(finalList.opportunities.every((opportunity) => opportunity.id !== alphaOpportunityId));

    log("Phase 10 opportunity and pipeline checks passed.");
  } finally {
    await client.end();
  }
}

await main();
