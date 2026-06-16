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

function log(message) {
  console.log(`[phase6-exhaustive] ${message}`);
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
    throw new Error(
      `Expected ${expectedStatus} from ${method} ${path}, received ${response.status}: ${rawBody}`
    );
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

function assertPagination(
  pagination,
  { page, pageSize, total, totalPages, hasNextPage, hasPreviousPage }
) {
  assert.equal(pagination.page, page);
  assert.equal(pagination.pageSize, pageSize);
  assert.equal(pagination.total, total);
  assert.equal(pagination.totalPages, totalPages);
  assert.equal(pagination.hasNextPage, hasNextPage);
  assert.equal(pagination.hasPreviousPage, hasPreviousPage);
}

function assertSorted(values, order = "asc") {
  const actual = [...values];
  const expected = [...values].sort((left, right) => left.localeCompare(right));

  if (order === "desc") {
    expected.reverse();
  }

  assert.deepEqual(actual, expected);
}

async function queryOne(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0] ?? null;
}

async function assertSeedBaseline(client) {
  const tenant = await queryOne(
    client,
    `
      SELECT id, slug, name, status
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
      SELECT id, email, normalized_email, status
      FROM users
      WHERE tenant_id = $1
        AND normalized_email = LOWER($2)
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [tenant.id, defaultAdminEmail]
  );
  assert.ok(adminUser, "Default admin user should exist after seeding.");
  assert.equal(adminUser.normalized_email, defaultAdminEmail.toLowerCase());
  assert.equal(adminUser.status, "active");

  const adminRole = await queryOne(
    client,
    `
      SELECT roles.id, roles.slug
      FROM roles
      INNER JOIN user_roles
        ON user_roles.role_id = roles.id
       AND user_roles.tenant_id = roles.tenant_id
       AND user_roles.deleted_at IS NULL
      WHERE roles.tenant_id = $1
        AND user_roles.user_id = $2
        AND roles.slug = 'super-admin'
        AND roles.deleted_at IS NULL
      LIMIT 1
    `,
    [tenant.id, adminUser.id]
  );
  assert.ok(adminRole, "Default admin user should be assigned the super-admin role.");

  const permissionCatalog = await queryOne(
    client,
    `
      SELECT COUNT(*)::int AS count
      FROM permissions
      WHERE deleted_at IS NULL
    `
  );
  assert.ok(permissionCatalog?.count > 0, "Permission catalog should be seeded.");

  const requiredPermissions = await queryOne(
    client,
    `
      SELECT COUNT(*)::int AS count
      FROM permissions
      WHERE deleted_at IS NULL
        AND code = ANY($1::text[])
    `,
    [["leads.view", "accounts.view", "contacts.view"]]
  );
  assert.equal(requiredPermissions.count, 3);

  const optionSets = await queryOne(
    client,
    `
      SELECT COUNT(*)::int AS count
      FROM tenant_option_sets
      WHERE tenant_id = $1
        AND deleted_at IS NULL
        AND set_key = ANY($2::text[])
    `,
    [tenant.id, ["lead-status", "lead-source", "account-type", "account-health", "contact-role"]]
  );
  assert.equal(optionSets.count, 5, "CRM option sets should be seeded for the default tenant.");

  const seedRun = await queryOne(
    client,
    `
      SELECT name
      FROM seed_runs
      WHERE name = 'core-bootstrap'
      LIMIT 1
    `
  );
  assert.ok(seedRun, "Seed tracker should record the core bootstrap run.");

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
      SELECT tenant_id, actor_user_id, session_id, event_type, action, resource_type, resource_id, status, metadata
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
  return row;
}

async function assertAuthAuditLog(client, { tenantId, actorUserId, sessionId, email }) {
  const row = await queryOne(
    client,
    `
      SELECT tenant_id, actor_user_id, session_id, event_type, action, resource_type, resource_id, status, metadata
      FROM audit_logs
      WHERE tenant_id = $1
        AND actor_user_id = $2
        AND session_id = $3
        AND action = 'auth.login'
        AND resource_type = 'session'
        AND status = 'success'
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [tenantId, actorUserId, sessionId]
  );

  assert.ok(row, "Successful login audit log should exist.");
  assert.equal(row.event_type, "auth");
  assert.equal(row.metadata.email, email.toLowerCase());
}

async function assertCrmRecordState(
  client,
  tableName,
  recordId,
  { tenantId, ownerId, createdBy, updatedBy, deleted }
) {
  const row = await queryOne(
    client,
    `
      SELECT tenant_id, owner_id, created_by, updated_by, metadata, deleted_at, created_at, updated_at
      FROM ${tableName}
      WHERE id = $1
      LIMIT 1
    `,
    [recordId]
  );

  assert.ok(row, `${tableName} record ${recordId} should exist.`);
  assert.equal(row.tenant_id, tenantId);
  assert.equal(row.owner_id, ownerId);
  assert.equal(row.created_by, createdBy);
  assert.equal(row.updated_by, updatedBy);
  assert.equal(Boolean(row.deleted_at), deleted);
  assert.ok(row.metadata.runToken === runToken, `${tableName} metadata should carry the run token.`);
  assert.ok(new Date(row.updated_at).getTime() >= new Date(row.created_at).getTime());

  return row;
}

async function assertTrailRecordState(
  client,
  tableName,
  recordId,
  { tenantId, entityType, entityId, actorUserId }
) {
  const row = await queryOne(
    client,
    `
      SELECT tenant_id, entity_type, entity_id, author_user_id, created_by, updated_by, deleted_at, created_at, updated_at
      FROM ${tableName}
      WHERE id = $1
      LIMIT 1
    `,
    [recordId]
  );

  assert.ok(row, `${tableName} record ${recordId} should exist.`);
  assert.equal(row.tenant_id, tenantId);
  assert.equal(row.entity_type, entityType);
  assert.equal(row.entity_id, entityId);
  assert.equal(row.author_user_id, actorUserId);
  assert.equal(row.created_by, actorUserId);
  assert.equal(row.updated_by, actorUserId);
  assert.equal(row.deleted_at, null);
  assert.ok(new Date(row.updated_at).getTime() >= new Date(row.created_at).getTime());
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
  { tenantId, email, password, firstName, lastName, roleName, roleSlug, permissionCodes }
) {
  const roleResult = await client.query(
    `
      INSERT INTO roles (tenant_id, slug, name, description, metadata)
      VALUES ($1, $2, $3, $4, jsonb_build_object('testRun', $5::text))
      RETURNING id
    `,
    [tenantId, roleSlug, roleName, `${roleName} for phase 6 testing`, runToken]
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

  return { userId, roleId, displayName };
}

async function main() {
  log("Connecting to PostgreSQL.");
  const client = new Client({
    connectionString: databaseUrl
  });
  await client.connect();

  try {
    log("Checking seeded tenant, admin, roles, permissions, and option catalog.");
    const seedBaseline = await assertSeedBaseline(client);

    log("Logging in with the seeded admin account.");
    const adminSession = await loginSession(defaultTenantSlug, defaultAdminEmail, defaultAdminPassword);
    const adminAccessToken = adminSession.accessToken;
    const adminTenantId = adminSession.currentUser.tenant.id;
    const adminUserId = adminSession.currentUser.id;
    const adminSessionId = adminSession.session.id;

    assert.equal(adminTenantId, seedBaseline.tenantId);
    assert.equal(adminUserId, seedBaseline.adminUserId);
    await assertAuthAuditLog(client, {
      tenantId: adminTenantId,
      actorUserId: adminUserId,
      sessionId: adminSessionId,
      email: defaultAdminEmail
    });

    log("Verifying auth guards, option endpoints, and validation behavior.");
    await expectError("/leads", {
      expectedStatus: 401,
      expectedCode: "AUTHENTICATION_ERROR"
    });
    await expectError("/leads/not-a-uuid", {
      accessToken: adminAccessToken,
      expectedStatus: 400,
      expectedCode: "VALIDATION_ERROR"
    });
    await expectError(`/accounts${buildQueryString({ sortBy: "invalid-sort" })}`, {
      accessToken: adminAccessToken,
      expectedStatus: 400,
      expectedCode: "VALIDATION_ERROR"
    });
    await expectError(`/contacts${buildQueryString({ accountId: "not-a-uuid" })}`, {
      accessToken: adminAccessToken,
      expectedStatus: 400,
      expectedCode: "VALIDATION_ERROR"
    });

    const leadOptions = await request("/leads/options", {
      accessToken: adminAccessToken,
      expectedStatus: 200
    });
    const accountOptions = await request("/accounts/options", {
      accessToken: adminAccessToken,
      expectedStatus: 200
    });
    const contactOptions = await request("/contacts/options", {
      accessToken: adminAccessToken,
      expectedStatus: 200
    });

    assert.ok(leadOptions.statuses.some((option) => option.key === "new"));
    assert.ok(leadOptions.sources.some((option) => option.key === "website"));
    assert.ok(accountOptions.accountTypes.some((option) => option.key === "prospect"));
    assert.ok(accountOptions.healthStatuses.some((option) => option.key === "monitor"));
    assert.ok(contactOptions.roles.some((option) => option.key === "decision_maker"));
    assert.ok(leadOptions.owners.some((owner) => owner.id === adminUserId));

    const transferUser = await createUserWithPermissions(client, {
      tenantId: adminTenantId,
      email: `transfer-${runToken}@example.test`,
      password: `Transfer!${runToken}`,
      firstName: "Transfer",
      lastName: "Owner",
      roleName: `Transfer Owner ${runToken}`,
      roleSlug: `transfer-owner-${runToken}`,
      permissionCodes: ["leads.view", "accounts.view", "contacts.view"]
    });

    const refreshedLeadOptions = await request("/leads/options", {
      accessToken: adminAccessToken,
      expectedStatus: 200
    });
    assert.ok(refreshedLeadOptions.owners.some((owner) => owner.id === transferUser.userId));

    await expectError("/accounts", {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 400,
      expectedCode: "VALIDATION_ERROR",
      body: {
        name: `Broken Account ${runToken}`,
        website: "not-a-url"
      }
    });
    await expectError("/accounts", {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 400,
      expectedCode: "INVALID_OWNER",
      body: {
        name: `Invalid Owner Account ${runToken}`,
        ownerId: randomUUID()
      }
    });
    await expectError("/accounts", {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 400,
      expectedCode: "INVALID_OPTION_VALUE",
      body: {
        name: `Invalid Type Account ${runToken}`,
        accountTypeKey: "not-real"
      }
    });

    log("Exercising accounts CRUD, sorting, pagination, filters, notes, activities, and metadata.");
    const accountCreatePayloads = [
      {
        name: `Smoke Account ${runToken}`,
        website: `https://account-${runToken}.example.test`,
        industry: "Software",
        accountTypeKey: "prospect",
        healthStatusKey: "healthy",
        ownerId: adminUserId,
        metadata: {
          runToken,
          recordKind: "primary-account",
          stage: "created"
        }
      },
      {
        name: `Account Alpha ${runToken}`,
        website: `https://alpha-${runToken}.example.test`,
        industry: "Manufacturing",
        accountTypeKey: "customer",
        ownerId: adminUserId,
        metadata: {
          runToken,
          recordKind: "account"
        }
      },
      {
        name: `Account Beta ${runToken}`,
        website: `https://beta-${runToken}.example.test`,
        industry: "Services",
        accountTypeKey: "partner",
        ownerId: adminUserId,
        metadata: {
          runToken,
          recordKind: "account"
        }
      },
      {
        name: `Account Gamma ${runToken}`,
        website: `https://gamma-${runToken}.example.test`,
        industry: "Software",
        accountTypeKey: "prospect",
        ownerId: adminUserId,
        metadata: {
          runToken,
          recordKind: "account"
        }
      }
    ];

    const createdAccounts = [];
    for (const payload of accountCreatePayloads) {
      const response = await request("/accounts", {
        method: "POST",
        accessToken: adminAccessToken,
        expectedStatus: 201,
        body: payload
      });
      createdAccounts.push(response.account);
    }

    const primaryAccount = createdAccounts[0];
    const primaryAccountId = primaryAccount.id;
    const accountPageOne = await request(
      `/accounts${buildQueryString({
        search: runToken,
        sortBy: "name",
        sortOrder: "asc",
        page: 1,
        pageSize: 2
      })}`,
      {
        accessToken: adminAccessToken,
        expectedStatus: 200
      }
    );
    const accountPageTwo = await request(
      `/accounts${buildQueryString({
        search: runToken,
        sortBy: "name",
        sortOrder: "asc",
        page: 2,
        pageSize: 2
      })}`,
      {
        accessToken: adminAccessToken,
        expectedStatus: 200
      }
    );
    assertPagination(accountPageOne.pagination, {
      page: 1,
      pageSize: 2,
      total: 4,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false
    });
    assertPagination(accountPageTwo.pagination, {
      page: 2,
      pageSize: 2,
      total: 4,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true
    });
    const sortedAccountNames = [...accountPageOne.accounts, ...accountPageTwo.accounts].map((account) => account.name);
    assert.deepEqual(
      sortedAccountNames,
      accountCreatePayloads.map((payload) => payload.name).sort((left, right) => left.localeCompare(right))
    );

    const filteredAccounts = await request(
      `/accounts${buildQueryString({
        search: runToken,
        accountType: "prospect",
        industry: "Software",
        ownerId: adminUserId,
        sortBy: "name",
        sortOrder: "asc",
        page: 1,
        pageSize: 12
      })}`,
      {
        accessToken: adminAccessToken,
        expectedStatus: 200
      }
    );
    assert.ok(filteredAccounts.accounts.some((account) => account.id === primaryAccountId));

    const emptyAccounts = await request(
      `/accounts${buildQueryString({
        search: `missing-${runToken}`,
        page: 1,
        pageSize: 12
      })}`,
      {
        accessToken: adminAccessToken,
        expectedStatus: 200
      }
    );
    assert.equal(emptyAccounts.accounts.length, 0);
    assertPagination(emptyAccounts.pagination, {
      page: 1,
      pageSize: 12,
      total: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    });

    const accountNote = await request(`/accounts/${primaryAccountId}/notes`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        body: `Account note ${runToken}`
      }
    });
    const accountActivity = await request(`/accounts/${primaryAccountId}/activities`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        activityType: "meeting",
        subject: `Account discovery ${runToken}`,
        description: "Captured during exhaustive phase 6 verification"
      }
    });
    const accountUpdate = await request(`/accounts/${primaryAccountId}`, {
      method: "PATCH",
      accessToken: adminAccessToken,
      expectedStatus: 200,
      body: {
        industry: "SaaS",
        healthStatusKey: "monitor",
        ownerId: transferUser.userId,
        metadata: {
          review: "updated",
          mergedFromTest: true
        }
      }
    });
    assert.equal(accountUpdate.account.industry, "SaaS");
    assert.equal(accountUpdate.account.healthStatus?.key, "monitor");
    assert.equal(accountUpdate.account.owner?.id, transferUser.userId);
    assert.equal(accountUpdate.account.metadata.runToken, runToken);
    assert.equal(accountUpdate.account.metadata.stage, "created");
    assert.equal(accountUpdate.account.metadata.mergedFromTest, true);

    await expectError(`/accounts/${primaryAccountId}`, {
      method: "PATCH",
      accessToken: adminAccessToken,
      expectedStatus: 400,
      expectedCode: "VALIDATION_ERROR",
      body: {}
    });

    await assertCrmRecordState(client, "accounts", primaryAccountId, {
      tenantId: adminTenantId,
      ownerId: transferUser.userId,
      createdBy: adminUserId,
      updatedBy: adminUserId,
      deleted: false
    });
    await assertTrailRecordState(client, "crm_notes", accountNote.note.id, {
      tenantId: adminTenantId,
      entityType: "account",
      entityId: primaryAccountId,
      actorUserId: adminUserId
    });
    await assertTrailRecordState(client, "crm_activities", accountActivity.activity.id, {
      tenantId: adminTenantId,
      entityType: "account",
      entityId: primaryAccountId,
      actorUserId: adminUserId
    });

    await expectError("/contacts", {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 400,
      expectedCode: "VALIDATION_ERROR",
      body: {
        firstName: "Broken",
        lastName: `Contact-${runToken}`,
        linkedinUrl: "not-a-url"
      }
    });
    await expectError("/contacts", {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 400,
      expectedCode: "INVALID_ACCOUNT",
      body: {
        firstName: "Broken",
        lastName: `Missing-${runToken}`,
        accountId: randomUUID()
      }
    });
    await expectError("/contacts", {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 400,
      expectedCode: "INVALID_OPTION_VALUE",
      body: {
        firstName: "Broken",
        lastName: `Role-${runToken}`,
        roleKey: "not-real"
      }
    });

    log("Exercising contacts CRUD, account relationships, sorting, filters, notes, activities, and metadata.");
    const contactCreatePayloads = [
      {
        firstName: "Taylor",
        lastName: `Buyer-${runToken}`,
        email: `contact-${runToken}@example.test`,
        phone: "+1-415-555-0111",
        linkedinUrl: `https://linkedin.com/in/contact-${runToken}`,
        roleKey: "decision_maker",
        ownerId: adminUserId,
        accountId: primaryAccountId,
        metadata: {
          runToken,
          recordKind: "primary-contact",
          stage: "created"
        }
      },
      {
        firstName: "Alex",
        lastName: `Alpha-${runToken}`,
        email: `contact-alpha-${runToken}@example.test`,
        roleKey: "champion",
        ownerId: adminUserId,
        accountId: primaryAccountId,
        metadata: {
          runToken,
          recordKind: "contact"
        }
      },
      {
        firstName: "Blair",
        lastName: `Beta-${runToken}`,
        email: `contact-beta-${runToken}@example.test`,
        roleKey: "influencer",
        ownerId: adminUserId,
        accountId: createdAccounts[1].id,
        metadata: {
          runToken,
          recordKind: "contact"
        }
      },
      {
        firstName: "Casey",
        lastName: `Gamma-${runToken}`,
        email: `contact-gamma-${runToken}@example.test`,
        roleKey: "decision_maker",
        ownerId: adminUserId,
        accountId: createdAccounts[2].id,
        metadata: {
          runToken,
          recordKind: "contact"
        }
      }
    ];

    const createdContacts = [];
    for (const payload of contactCreatePayloads) {
      const response = await request("/contacts", {
        method: "POST",
        accessToken: adminAccessToken,
        expectedStatus: 201,
        body: payload
      });
      createdContacts.push(response.contact);
    }

    const primaryContact = createdContacts[0];
    const primaryContactId = primaryContact.id;
    const filteredContacts = await request(
      `/contacts${buildQueryString({
        search: runToken,
        accountId: primaryAccountId,
        role: "decision_maker",
        ownerId: adminUserId,
        sortBy: "name",
        sortOrder: "asc",
        page: 1,
        pageSize: 12
      })}`,
      {
        accessToken: adminAccessToken,
        expectedStatus: 200
      }
    );
    assert.ok(filteredContacts.contacts.some((contact) => contact.id === primaryContactId));

    const contactPageOne = await request(
      `/contacts${buildQueryString({
        search: runToken,
        sortBy: "name",
        sortOrder: "asc",
        page: 1,
        pageSize: 2
      })}`,
      {
        accessToken: adminAccessToken,
        expectedStatus: 200
      }
    );
    const contactPageTwo = await request(
      `/contacts${buildQueryString({
        search: runToken,
        sortBy: "name",
        sortOrder: "asc",
        page: 2,
        pageSize: 2
      })}`,
      {
        accessToken: adminAccessToken,
        expectedStatus: 200
      }
    );
    assertPagination(contactPageOne.pagination, {
      page: 1,
      pageSize: 2,
      total: 4,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false
    });
    assertPagination(contactPageTwo.pagination, {
      page: 2,
      pageSize: 2,
      total: 4,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true
    });
    const sortedContactNames = [...contactPageOne.contacts, ...contactPageTwo.contacts].map((contact) => contact.fullName);
    const expectedSortedContactNames = [...contactCreatePayloads]
      .sort((left, right) => left.lastName.localeCompare(right.lastName))
      .map((payload) => `${payload.firstName} ${payload.lastName}`);
    assert.deepEqual(sortedContactNames, expectedSortedContactNames);

    const emptyContacts = await request(
      `/contacts${buildQueryString({
        search: `missing-${runToken}`,
        page: 1,
        pageSize: 12
      })}`,
      {
        accessToken: adminAccessToken,
        expectedStatus: 200
      }
    );
    assert.equal(emptyContacts.contacts.length, 0);
    assertPagination(emptyContacts.pagination, {
      page: 1,
      pageSize: 12,
      total: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    });

    const contactNote = await request(`/contacts/${primaryContactId}/notes`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        body: `Contact note ${runToken}`
      }
    });
    const contactActivity = await request(`/contacts/${primaryContactId}/activities`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        activityType: "call",
        subject: `Contact call ${runToken}`,
        description: "Captured during exhaustive phase 6 verification"
      }
    });
    const contactUpdate = await request(`/contacts/${primaryContactId}`, {
      method: "PATCH",
      accessToken: adminAccessToken,
      expectedStatus: 200,
      body: {
        roleKey: "champion",
        phone: "+1-415-555-0222",
        ownerId: transferUser.userId,
        metadata: {
          review: "updated",
          mergedFromTest: true
        }
      }
    });
    assert.equal(contactUpdate.contact.role?.key, "champion");
    assert.equal(contactUpdate.contact.phone, "+1-415-555-0222");
    assert.equal(contactUpdate.contact.owner?.id, transferUser.userId);
    assert.equal(contactUpdate.contact.metadata.runToken, runToken);
    assert.equal(contactUpdate.contact.metadata.stage, "created");
    assert.equal(contactUpdate.contact.metadata.mergedFromTest, true);

    const refreshedAccount = await request(`/accounts/${primaryAccountId}`, {
      accessToken: adminAccessToken,
      expectedStatus: 200
    });
    assert.equal(refreshedAccount.account.contactCount, 2);
    assert.ok(refreshedAccount.account.relatedContacts.some((contact) => contact.id === primaryContactId));
    assert.ok(refreshedAccount.account.relatedOpportunitiesPlaceholder.message.length > 0);
    assert.ok(refreshedAccount.account.noteCount >= 1);
    assert.ok(refreshedAccount.account.activityCount >= 1);

    await expectError(`/contacts/${primaryContactId}`, {
      method: "PATCH",
      accessToken: adminAccessToken,
      expectedStatus: 400,
      expectedCode: "VALIDATION_ERROR",
      body: {}
    });

    await assertCrmRecordState(client, "contacts", primaryContactId, {
      tenantId: adminTenantId,
      ownerId: transferUser.userId,
      createdBy: adminUserId,
      updatedBy: adminUserId,
      deleted: false
    });
    await assertTrailRecordState(client, "crm_notes", contactNote.note.id, {
      tenantId: adminTenantId,
      entityType: "contact",
      entityId: primaryContactId,
      actorUserId: adminUserId
    });
    await assertTrailRecordState(client, "crm_activities", contactActivity.activity.id, {
      tenantId: adminTenantId,
      entityType: "contact",
      entityId: primaryContactId,
      actorUserId: adminUserId
    });

    await expectError("/leads", {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 400,
      expectedCode: "VALIDATION_ERROR",
      body: {
        firstName: "Broken",
        lastName: `Lead-${runToken}`,
        companyName: `Broken Company ${runToken}`,
        email: "not-an-email",
        statusKey: "new",
        sourceKey: "website"
      }
    });
    await expectError("/leads", {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 400,
      expectedCode: "INVALID_OPTION_VALUE",
      body: {
        firstName: "Broken",
        lastName: `Status-${runToken}`,
        companyName: `Broken Company ${runToken}`,
        statusKey: "missing-status",
        sourceKey: "website"
      }
    });
    await expectError("/leads", {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 400,
      expectedCode: "INVALID_OWNER",
      body: {
        firstName: "Broken",
        lastName: `Owner-${runToken}`,
        companyName: `Broken Company ${runToken}`,
        statusKey: "new",
        sourceKey: "website",
        ownerId: randomUUID()
      }
    });

    log("Exercising leads CRUD, sorting, pagination, filters, notes, activities, and metadata.");
    const leadCreatePayloads = [
      {
        firstName: "Jordan",
        lastName: `Prospect-${runToken}`,
        companyName: `Lead Company ${runToken}`,
        email: `lead-${runToken}@example.test`,
        phone: "+1-415-555-0333",
        statusKey: "new",
        sourceKey: "website",
        score: 55,
        ownerId: adminUserId,
        metadata: {
          runToken,
          recordKind: "primary-lead",
          stage: "created"
        }
      },
      {
        firstName: "Avery",
        lastName: `Alpha-${runToken}`,
        companyName: `Lead Alpha ${runToken}`,
        statusKey: "new",
        sourceKey: "website",
        ownerId: adminUserId,
        metadata: {
          runToken,
          recordKind: "lead"
        }
      },
      {
        firstName: "Blake",
        lastName: `Beta-${runToken}`,
        companyName: `Lead Beta ${runToken}`,
        statusKey: "new",
        sourceKey: "website",
        ownerId: adminUserId,
        metadata: {
          runToken,
          recordKind: "lead"
        }
      },
      {
        firstName: "Charlie",
        lastName: `Gamma-${runToken}`,
        companyName: `Lead Gamma ${runToken}`,
        statusKey: "new",
        sourceKey: "website",
        ownerId: adminUserId,
        metadata: {
          runToken,
          recordKind: "lead"
        }
      }
    ];

    const createdLeads = [];
    for (const payload of leadCreatePayloads) {
      const response = await request("/leads", {
        method: "POST",
        accessToken: adminAccessToken,
        expectedStatus: 201,
        body: payload
      });
      createdLeads.push(response.lead);
    }

    const primaryLead = createdLeads[0];
    const primaryLeadId = primaryLead.id;
    const filteredLeads = await request(
      `/leads${buildQueryString({
        search: runToken,
        status: "new",
        source: "website",
        ownerId: adminUserId,
        sortBy: "companyName",
        sortOrder: "asc",
        page: 1,
        pageSize: 12
      })}`,
      {
        accessToken: adminAccessToken,
        expectedStatus: 200
      }
    );
    assert.ok(filteredLeads.leads.some((lead) => lead.id === primaryLeadId));

    const leadPageOne = await request(
      `/leads${buildQueryString({
        search: runToken,
        sortBy: "companyName",
        sortOrder: "asc",
        page: 1,
        pageSize: 2
      })}`,
      {
        accessToken: adminAccessToken,
        expectedStatus: 200
      }
    );
    const leadPageTwo = await request(
      `/leads${buildQueryString({
        search: runToken,
        sortBy: "companyName",
        sortOrder: "asc",
        page: 2,
        pageSize: 2
      })}`,
      {
        accessToken: adminAccessToken,
        expectedStatus: 200
      }
    );
    assertPagination(leadPageOne.pagination, {
      page: 1,
      pageSize: 2,
      total: 4,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false
    });
    assertPagination(leadPageTwo.pagination, {
      page: 2,
      pageSize: 2,
      total: 4,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true
    });
    const sortedLeadCompanies = [...leadPageOne.leads, ...leadPageTwo.leads].map((lead) => lead.companyName);
    assert.deepEqual(
      sortedLeadCompanies,
      leadCreatePayloads.map((payload) => payload.companyName).sort((left, right) => left.localeCompare(right))
    );

    const emptyLeads = await request(
      `/leads${buildQueryString({
        search: `missing-${runToken}`,
        page: 1,
        pageSize: 12
      })}`,
      {
        accessToken: adminAccessToken,
        expectedStatus: 200
      }
    );
    assert.equal(emptyLeads.leads.length, 0);
    assertPagination(emptyLeads.pagination, {
      page: 1,
      pageSize: 12,
      total: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    });

    const leadNote = await request(`/leads/${primaryLeadId}/notes`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        body: `Lead note ${runToken}`
      }
    });
    const leadActivity = await request(`/leads/${primaryLeadId}/activities`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        activityType: "email",
        subject: `Lead email ${runToken}`,
        description: "Captured during exhaustive phase 6 verification"
      }
    });
    const leadUpdate = await request(`/leads/${primaryLeadId}`, {
      method: "PATCH",
      accessToken: adminAccessToken,
      expectedStatus: 200,
      body: {
        statusKey: "working",
        sourceKey: "campaign",
        score: 72,
        ownerId: transferUser.userId,
        metadata: {
          review: "updated",
          mergedFromTest: true
        }
      }
    });
    assert.equal(leadUpdate.lead.status?.key, "working");
    assert.equal(leadUpdate.lead.source?.key, "campaign");
    assert.equal(leadUpdate.lead.score, 72);
    assert.equal(leadUpdate.lead.owner?.id, transferUser.userId);
    assert.equal(leadUpdate.lead.metadata.runToken, runToken);
    assert.equal(leadUpdate.lead.metadata.stage, "created");
    assert.equal(leadUpdate.lead.metadata.mergedFromTest, true);
    assert.ok(leadUpdate.lead.conversionPlaceholder.message.length > 0);
    assert.ok(leadUpdate.lead.noteCount >= 1);
    assert.ok(leadUpdate.lead.activityCount >= 1);
    assert.ok(leadUpdate.lead.lastActivityAt);

    await expectError(`/leads/${primaryLeadId}`, {
      method: "PATCH",
      accessToken: adminAccessToken,
      expectedStatus: 400,
      expectedCode: "VALIDATION_ERROR",
      body: {}
    });

    await assertCrmRecordState(client, "leads", primaryLeadId, {
      tenantId: adminTenantId,
      ownerId: transferUser.userId,
      createdBy: adminUserId,
      updatedBy: adminUserId,
      deleted: false
    });
    await assertTrailRecordState(client, "crm_notes", leadNote.note.id, {
      tenantId: adminTenantId,
      entityType: "lead",
      entityId: primaryLeadId,
      actorUserId: adminUserId
    });
    await assertTrailRecordState(client, "crm_activities", leadActivity.activity.id, {
      tenantId: adminTenantId,
      entityType: "lead",
      entityId: primaryLeadId,
      actorUserId: adminUserId
    });

    log("Verifying permission middleware and assign-only mutation rules.");
    const limitedPassword = `Limit!${runToken}`;
    const limitedUser = await createUserWithPermissions(client, {
      tenantId: adminTenantId,
      email: `limited-${runToken}@example.test`,
      password: limitedPassword,
      firstName: "Limited",
      lastName: "Viewer",
      roleName: `Limited Viewer ${runToken}`,
      roleSlug: `limited-viewer-${runToken}`,
      permissionCodes: ["leads.view"]
    });
    const limitedSession = await loginSession(
      defaultTenantSlug,
      `limited-${runToken}@example.test`,
      limitedPassword
    );
    await assertAuthAuditLog(client, {
      tenantId: adminTenantId,
      actorUserId: limitedUser.userId,
      sessionId: limitedSession.session.id,
      email: `limited-${runToken}@example.test`
    });
    await request("/leads", {
      accessToken: limitedSession.accessToken,
      expectedStatus: 200
    });
    await expectError("/leads", {
      method: "POST",
      accessToken: limitedSession.accessToken,
      expectedStatus: 403,
      expectedCode: "FORBIDDEN",
      body: {
        firstName: "Blocked",
        lastName: "User",
        companyName: `Blocked ${runToken}`,
        statusKey: "new",
        sourceKey: "website"
      }
    });
    await expectError(`/leads/${primaryLeadId}`, {
      method: "PATCH",
      accessToken: limitedSession.accessToken,
      expectedStatus: 403,
      expectedCode: "FORBIDDEN",
      body: {
        companyName: `Should Fail ${runToken}`
      }
    });

    const assignPassword = `Assign!${runToken}`;
    const assignUser = await createUserWithPermissions(client, {
      tenantId: adminTenantId,
      email: `assign-${runToken}@example.test`,
      password: assignPassword,
      firstName: "Assign",
      lastName: "Only",
      roleName: `Assign Only ${runToken}`,
      roleSlug: `assign-only-${runToken}`,
      permissionCodes: [
        "leads.view",
        "leads.assign",
        "accounts.view",
        "accounts.assign",
        "contacts.view",
        "contacts.assign"
      ]
    });
    const assignSession = await loginSession(defaultTenantSlug, `assign-${runToken}@example.test`, assignPassword);
    await assertAuthAuditLog(client, {
      tenantId: adminTenantId,
      actorUserId: assignUser.userId,
      sessionId: assignSession.session.id,
      email: `assign-${runToken}@example.test`
    });

    const assignedAccount = await request(`/accounts/${primaryAccountId}`, {
      method: "PATCH",
      accessToken: assignSession.accessToken,
      expectedStatus: 200,
      body: {
        ownerId: adminUserId
      }
    });
    const assignedContact = await request(`/contacts/${primaryContactId}`, {
      method: "PATCH",
      accessToken: assignSession.accessToken,
      expectedStatus: 200,
      body: {
        ownerId: adminUserId
      }
    });
    const assignedLead = await request(`/leads/${primaryLeadId}`, {
      method: "PATCH",
      accessToken: assignSession.accessToken,
      expectedStatus: 200,
      body: {
        ownerId: adminUserId
      }
    });
    assert.equal(assignedAccount.account.owner?.id, adminUserId);
    assert.equal(assignedContact.contact.owner?.id, adminUserId);
    assert.equal(assignedLead.lead.owner?.id, adminUserId);

    await expectError(`/accounts/${primaryAccountId}`, {
      method: "PATCH",
      accessToken: assignSession.accessToken,
      expectedStatus: 403,
      expectedCode: "AUTHORIZATION_ERROR",
      body: {
        industry: "Blocked by assign-only role"
      }
    });
    await expectError(`/contacts/${primaryContactId}`, {
      method: "PATCH",
      accessToken: assignSession.accessToken,
      expectedStatus: 403,
      expectedCode: "AUTHORIZATION_ERROR",
      body: {
        phone: "+1-415-555-0999"
      }
    });
    await expectError(`/leads/${primaryLeadId}`, {
      method: "PATCH",
      accessToken: assignSession.accessToken,
      expectedStatus: 403,
      expectedCode: "AUTHORIZATION_ERROR",
      body: {
        companyName: `Blocked Update ${runToken}`
      }
    });

    log("Verifying tenant isolation using a second tenant and cross-tenant references.");
    const secondTenantSlug = `tenant-${runToken}`;
    const secondTenantId = await createTenant(client, secondTenantSlug, `Tenant ${runToken}`);
    for (const setKey of ["lead-status", "lead-source", "account-type", "account-health", "contact-role"]) {
      await cloneOptionSet(client, adminTenantId, secondTenantId, setKey);
    }

    const secondTenantPassword = `Tenant!${runToken}`;
    const secondTenantUser = await createUserWithPermissions(client, {
      tenantId: secondTenantId,
      email: `tenant-admin-${runToken}@example.test`,
      password: secondTenantPassword,
      firstName: "Tenant",
      lastName: "Admin",
      roleName: `Tenant Admin ${runToken}`,
      roleSlug: `tenant-admin-${runToken}`,
      permissionCodes: [
        "leads.view",
        "leads.create",
        "leads.edit",
        "leads.delete",
        "leads.assign",
        "accounts.view",
        "accounts.create",
        "accounts.edit",
        "accounts.delete",
        "accounts.assign",
        "contacts.view",
        "contacts.create",
        "contacts.edit",
        "contacts.delete",
        "contacts.assign"
      ]
    });
    const secondTenantSession = await loginSession(
      secondTenantSlug,
      `tenant-admin-${runToken}@example.test`,
      secondTenantPassword
    );
    await assertAuthAuditLog(client, {
      tenantId: secondTenantId,
      actorUserId: secondTenantUser.userId,
      sessionId: secondTenantSession.session.id,
      email: `tenant-admin-${runToken}@example.test`
    });

    const secondAccount = await request("/accounts", {
      method: "POST",
      accessToken: secondTenantSession.accessToken,
      expectedStatus: 201,
      body: {
        name: `Second Tenant Account ${runToken}`,
        accountTypeKey: "prospect",
        metadata: {
          runToken
        }
      }
    });
    const secondContact = await request("/contacts", {
      method: "POST",
      accessToken: secondTenantSession.accessToken,
      expectedStatus: 201,
      body: {
        firstName: "Second",
        lastName: `Contact-${runToken}`,
        roleKey: "decision_maker",
        accountId: secondAccount.account.id,
        metadata: {
          runToken
        }
      }
    });
    const secondLead = await request("/leads", {
      method: "POST",
      accessToken: secondTenantSession.accessToken,
      expectedStatus: 201,
      body: {
        firstName: "Second",
        lastName: `Lead-${runToken}`,
        companyName: `Second Tenant Lead ${runToken}`,
        statusKey: "new",
        sourceKey: "website",
        metadata: {
          runToken
        }
      }
    });

    await request(`/accounts/${secondAccount.account.id}`, {
      accessToken: adminAccessToken,
      expectedStatus: 404
    });
    await request(`/contacts/${secondContact.contact.id}`, {
      accessToken: adminAccessToken,
      expectedStatus: 404
    });
    await request(`/leads/${secondLead.lead.id}`, {
      accessToken: adminAccessToken,
      expectedStatus: 404
    });

    const isolatedAccounts = await request(
      `/accounts${buildQueryString({
        search: `Second Tenant Account ${runToken}`
      })}`,
      {
        accessToken: adminAccessToken,
        expectedStatus: 200
      }
    );
    const isolatedContacts = await request(
      `/contacts${buildQueryString({
        search: `Second Contact-${runToken}`
      })}`,
      {
        accessToken: adminAccessToken,
        expectedStatus: 200
      }
    );
    const isolatedLeads = await request(
      `/leads${buildQueryString({
        search: `Second Tenant Lead ${runToken}`
      })}`,
      {
        accessToken: adminAccessToken,
        expectedStatus: 200
      }
    );
    assert.equal(isolatedAccounts.accounts.length, 0);
    assert.equal(isolatedContacts.contacts.length, 0);
    assert.equal(isolatedLeads.leads.length, 0);

    await expectError("/leads", {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 400,
      expectedCode: "INVALID_OWNER",
      body: {
        firstName: "Cross",
        lastName: `Owner-${runToken}`,
        companyName: `Cross Owner ${runToken}`,
        statusKey: "new",
        sourceKey: "website",
        ownerId: secondTenantUser.userId
      }
    });
    await expectError("/contacts", {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 400,
      expectedCode: "INVALID_ACCOUNT",
      body: {
        firstName: "Cross",
        lastName: `Account-${runToken}`,
        accountId: secondAccount.account.id
      }
    });

    log("Verifying soft delete behavior and deleted record visibility.");
    await request(`/contacts/${primaryContactId}`, {
      method: "DELETE",
      accessToken: adminAccessToken,
      expectedStatus: 200
    });
    await request(`/accounts/${primaryAccountId}`, {
      method: "DELETE",
      accessToken: adminAccessToken,
      expectedStatus: 200
    });
    await request(`/leads/${primaryLeadId}`, {
      method: "DELETE",
      accessToken: adminAccessToken,
      expectedStatus: 200
    });

    await request(`/contacts/${primaryContactId}`, {
      accessToken: adminAccessToken,
      expectedStatus: 404
    });
    await request(`/accounts/${primaryAccountId}`, {
      accessToken: adminAccessToken,
      expectedStatus: 404
    });
    await request(`/leads/${primaryLeadId}`, {
      accessToken: adminAccessToken,
      expectedStatus: 404
    });

    const postDeleteContacts = await request(
      `/contacts${buildQueryString({
        search: `contact-${runToken}@example.test`
      })}`,
      {
        accessToken: adminAccessToken,
        expectedStatus: 200
      }
    );
    const postDeleteAccounts = await request(
      `/accounts${buildQueryString({
        search: `Smoke Account ${runToken}`
      })}`,
      {
        accessToken: adminAccessToken,
        expectedStatus: 200
      }
    );
    const postDeleteLeads = await request(
      `/leads${buildQueryString({
        search: `Lead Company ${runToken}`
      })}`,
      {
        accessToken: adminAccessToken,
        expectedStatus: 200
      }
    );
    assert.equal(postDeleteContacts.contacts.length, 0);
    assert.equal(postDeleteAccounts.accounts.length, 0);
    assert.equal(postDeleteLeads.leads.length, 0);

    await assertCrmRecordState(client, "contacts", primaryContactId, {
      tenantId: adminTenantId,
      ownerId: adminUserId,
      createdBy: adminUserId,
      updatedBy: adminUserId,
      deleted: true
    });
    await assertCrmRecordState(client, "accounts", primaryAccountId, {
      tenantId: adminTenantId,
      ownerId: adminUserId,
      createdBy: adminUserId,
      updatedBy: adminUserId,
      deleted: true
    });
    await assertCrmRecordState(client, "leads", primaryLeadId, {
      tenantId: adminTenantId,
      ownerId: adminUserId,
      createdBy: adminUserId,
      updatedBy: adminUserId,
      deleted: true
    });

    log("Checking audit logs for CRM lifecycle actions.");
    for (const [action, resourceType, resourceId] of [
      ["account.create", "account", primaryAccountId],
      ["account.note.create", "account", primaryAccountId],
      ["account.activity.create", "account", primaryAccountId],
      ["account.update", "account", primaryAccountId],
      ["account.delete", "account", primaryAccountId],
      ["contact.create", "contact", primaryContactId],
      ["contact.note.create", "contact", primaryContactId],
      ["contact.activity.create", "contact", primaryContactId],
      ["contact.update", "contact", primaryContactId],
      ["contact.delete", "contact", primaryContactId],
      ["lead.create", "lead", primaryLeadId],
      ["lead.note.create", "lead", primaryLeadId],
      ["lead.activity.create", "lead", primaryLeadId],
      ["lead.update", "lead", primaryLeadId],
      ["lead.delete", "lead", primaryLeadId]
    ]) {
      await assertAuditLog(client, {
        tenantId: adminTenantId,
        actorUserId: adminUserId,
        sessionId: adminSessionId,
        action,
        resourceType,
        resourceId
      });
    }

    for (const [action, resourceType, resourceId] of [
      ["account.update", "account", primaryAccountId],
      ["contact.update", "contact", primaryContactId],
      ["lead.update", "lead", primaryLeadId]
    ]) {
      await assertAuditLog(client, {
        tenantId: adminTenantId,
        actorUserId: assignUser.userId,
        sessionId: assignSession.session.id,
        action,
        resourceType,
        resourceId
      });
    }

    log(`Phase 6 exhaustive test completed successfully for run ${runToken}.`);
    console.log(
      JSON.stringify(
        {
          runToken,
          adminUserId,
          limitedUserId: limitedUser.userId,
          assignUserId: assignUser.userId,
          transferUserId: transferUser.userId,
          createdIds: {
            primaryAccountId,
            primaryContactId,
            primaryLeadId,
            secondTenantAccountId: secondAccount.account.id,
            secondTenantContactId: secondContact.contact.id,
            secondTenantLeadId: secondLead.lead.id
          }
        },
        null,
        2
      )
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
