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
  console.log(`[phase6-smoke] ${message}`);
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
  const payload = rawBody ? JSON.parse(rawBody) : null;

  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected ${expectedStatus} from ${method} ${path}, received ${response.status}: ${rawBody}`
    );
  }

  return payload;
}

async function login(tenantSlug, email, password) {
  const payload = await request("/auth/login", {
    method: "POST",
    expectedStatus: 200,
    body: {
      tenantSlug,
      email,
      password
    }
  });

  return payload.tokens.accessToken;
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

async function createUserWithPermissions(client, {
  tenantId,
  email,
  password,
  firstName,
  lastName,
  roleName,
  roleSlug,
  permissionCodes
}) {
  const roleResult = await client.query(
    `
      INSERT INTO roles (tenant_id, slug, name, description, metadata)
      VALUES ($1, $2, $3, $4, jsonb_build_object('testRun', $5::text))
      RETURNING id
    `,
    [tenantId, roleSlug, roleName, `${roleName} for smoke testing`, runToken]
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
    log("Logging in with the seeded admin account.");
    const adminAccessToken = await login(defaultTenantSlug, defaultAdminEmail, defaultAdminPassword);
    const currentUser = await request("/auth/me", {
      accessToken: adminAccessToken,
      expectedStatus: 200
    });
    const adminTenantId = currentUser.user.tenant.id;
    const adminUserId = currentUser.user.id;

    log("Verifying public and authenticated API behavior.");
    await request("/leads", {
      expectedStatus: 401
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
    assert.ok(contactOptions.owners.some((owner) => owner.id === adminUserId));

    log("Exercising account CRUD, filters, notes, and activities.");
    const accountCreate = await request("/accounts", {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        name: `Smoke Account ${runToken}`,
        website: `https://account-${runToken}.example.test`,
        industry: "Software",
        accountTypeKey: "prospect",
        healthStatusKey: "healthy",
        ownerId: adminUserId
      }
    });
    const accountId = accountCreate.account.id;

    const accountList = await request(
      `/accounts?${new URLSearchParams({
        search: runToken,
        accountType: "prospect",
        ownerId: adminUserId,
        sortBy: "name",
        sortOrder: "asc",
        page: "1",
        pageSize: "12"
      }).toString()}`,
      {
        accessToken: adminAccessToken,
        expectedStatus: 200
      }
    );
    assert.ok(accountList.accounts.some((account) => account.id === accountId));

    await request(`/accounts/${accountId}/notes`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        body: `Account note ${runToken}`
      }
    });
    await request(`/accounts/${accountId}/activities`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        activityType: "meeting",
        subject: `Account discovery ${runToken}`,
        description: "Captured in smoke test"
      }
    });
    const accountUpdate = await request(`/accounts/${accountId}`, {
      method: "PATCH",
      accessToken: adminAccessToken,
      expectedStatus: 200,
      body: {
        industry: "SaaS",
        healthStatusKey: "monitor",
        ownerId: adminUserId
      }
    });
    assert.equal(accountUpdate.account.industry, "SaaS");
    assert.equal(accountUpdate.account.healthStatus?.key, "monitor");

    log("Exercising contact CRUD, account relationship, notes, and activities.");
    const contactCreate = await request("/contacts", {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        firstName: "Taylor",
        lastName: `Buyer-${runToken}`,
        email: `contact-${runToken}@example.test`,
        phone: "+1-415-555-0111",
        linkedinUrl: `https://linkedin.com/in/contact-${runToken}`,
        roleKey: "decision_maker",
        ownerId: adminUserId,
        accountId
      }
    });
    const contactId = contactCreate.contact.id;

    const contactList = await request(
      `/contacts?${new URLSearchParams({
        search: runToken,
        accountId,
        role: "decision_maker",
        ownerId: adminUserId,
        sortBy: "name",
        sortOrder: "asc",
        page: "1",
        pageSize: "12"
      }).toString()}`,
      {
        accessToken: adminAccessToken,
        expectedStatus: 200
      }
    );
    assert.ok(contactList.contacts.some((contact) => contact.id === contactId));

    await request(`/contacts/${contactId}/notes`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        body: `Contact note ${runToken}`
      }
    });
    await request(`/contacts/${contactId}/activities`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        activityType: "call",
        subject: `Contact call ${runToken}`,
        description: "Captured in smoke test"
      }
    });
    const contactUpdate = await request(`/contacts/${contactId}`, {
      method: "PATCH",
      accessToken: adminAccessToken,
      expectedStatus: 200,
      body: {
        roleKey: "champion",
        phone: "+1-415-555-0222",
        ownerId: adminUserId
      }
    });
    assert.equal(contactUpdate.contact.role?.key, "champion");
    assert.equal(contactUpdate.contact.phone, "+1-415-555-0222");

    const refreshedAccount = await request(`/accounts/${accountId}`, {
      accessToken: adminAccessToken,
      expectedStatus: 200
    });
    assert.ok(refreshedAccount.account.relatedContacts.some((contact) => contact.id === contactId));
    assert.ok(refreshedAccount.account.relatedOpportunitiesPlaceholder.message.length > 0);

    log("Exercising lead CRUD, filters, notes, and activities.");
    const leadCreate = await request("/leads", {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        firstName: "Jordan",
        lastName: `Prospect-${runToken}`,
        companyName: `Lead Company ${runToken}`,
        email: `lead-${runToken}@example.test`,
        phone: "+1-415-555-0333",
        statusKey: "new",
        sourceKey: "website",
        score: 55,
        ownerId: adminUserId
      }
    });
    const leadId = leadCreate.lead.id;

    const leadList = await request(
      `/leads?${new URLSearchParams({
        search: runToken,
        status: "new",
        source: "website",
        ownerId: adminUserId,
        sortBy: "companyName",
        sortOrder: "asc",
        page: "1",
        pageSize: "12"
      }).toString()}`,
      {
        accessToken: adminAccessToken,
        expectedStatus: 200
      }
    );
    assert.ok(leadList.leads.some((lead) => lead.id === leadId));

    await request(`/leads/${leadId}/notes`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        body: `Lead note ${runToken}`
      }
    });
    await request(`/leads/${leadId}/activities`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        activityType: "email",
        subject: `Lead email ${runToken}`,
        description: "Captured in smoke test"
      }
    });
    const leadUpdate = await request(`/leads/${leadId}`, {
      method: "PATCH",
      accessToken: adminAccessToken,
      expectedStatus: 200,
      body: {
        statusKey: "working",
        sourceKey: "campaign",
        score: 72,
        ownerId: adminUserId
      }
    });
    assert.equal(leadUpdate.lead.status?.key, "working");
    assert.equal(leadUpdate.lead.source?.key, "campaign");
    assert.equal(leadUpdate.lead.score, 72);
    assert.ok(leadUpdate.lead.conversionPlaceholder.message.length > 0);

    log("Verifying RBAC enforcement with a limited user.");
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
    const limitedAccessToken = await login(defaultTenantSlug, `limited-${runToken}@example.test`, limitedPassword);
    await request("/leads", {
      accessToken: limitedAccessToken,
      expectedStatus: 200
    });
    await request("/leads", {
      method: "POST",
      accessToken: limitedAccessToken,
      expectedStatus: 403,
      body: {
        firstName: "Blocked",
        lastName: "User",
        companyName: `Blocked ${runToken}`,
        statusKey: "new",
        sourceKey: "website"
      }
    });
    await request(`/leads/${leadId}`, {
      method: "PATCH",
      accessToken: limitedAccessToken,
      expectedStatus: 403,
      body: {
        companyName: `Should Fail ${runToken}`
      }
    });

    log("Verifying tenant isolation with a second tenant.");
    const secondTenantSlug = `tenant-${runToken}`;
    const secondTenantId = await createTenant(client, secondTenantSlug, `Tenant ${runToken}`);
    for (const setKey of ["lead-status", "lead-source", "account-type", "account-health", "contact-role"]) {
      await cloneOptionSet(client, adminTenantId, secondTenantId, setKey);
    }
    const secondTenantPassword = `Tenant!${runToken}`;
    await createUserWithPermissions(client, {
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
    const secondTenantAccessToken = await login(
      secondTenantSlug,
      `tenant-admin-${runToken}@example.test`,
      secondTenantPassword
    );

    const secondAccount = await request("/accounts", {
      method: "POST",
      accessToken: secondTenantAccessToken,
      expectedStatus: 201,
      body: {
        name: `Second Tenant Account ${runToken}`,
        accountTypeKey: "prospect"
      }
    });
    const secondContact = await request("/contacts", {
      method: "POST",
      accessToken: secondTenantAccessToken,
      expectedStatus: 201,
      body: {
        firstName: "Second",
        lastName: `Contact-${runToken}`,
        roleKey: "decision_maker",
        accountId: secondAccount.account.id
      }
    });
    const secondLead = await request("/leads", {
      method: "POST",
      accessToken: secondTenantAccessToken,
      expectedStatus: 201,
      body: {
        firstName: "Second",
        lastName: `Lead-${runToken}`,
        companyName: `Second Tenant Lead ${runToken}`,
        statusKey: "new",
        sourceKey: "website"
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

    const isolatedLeadList = await request(
      `/leads?${new URLSearchParams({
        search: `Second Tenant Lead ${runToken}`
      }).toString()}`,
      {
        accessToken: adminAccessToken,
        expectedStatus: 200
      }
    );
    assert.equal(isolatedLeadList.leads.length, 0);

    log("Verifying soft delete behavior.");
    await request(`/contacts/${contactId}`, {
      method: "DELETE",
      accessToken: adminAccessToken,
      expectedStatus: 200
    });
    await request(`/contacts/${contactId}`, {
      accessToken: adminAccessToken,
      expectedStatus: 404
    });

    await request(`/accounts/${accountId}`, {
      method: "DELETE",
      accessToken: adminAccessToken,
      expectedStatus: 200
    });
    await request(`/accounts/${accountId}`, {
      accessToken: adminAccessToken,
      expectedStatus: 404
    });

    await request(`/leads/${leadId}`, {
      method: "DELETE",
      accessToken: adminAccessToken,
      expectedStatus: 200
    });
    await request(`/leads/${leadId}`, {
      accessToken: adminAccessToken,
      expectedStatus: 404
    });

    log(`Phase 6 smoke test completed successfully for run ${runToken}.`);
    console.log(JSON.stringify({
      runToken,
      adminUserId,
      limitedUserId: limitedUser.userId,
      createdIds: {
        accountId,
        contactId,
        leadId,
        secondTenantAccountId: secondAccount.account.id,
        secondTenantContactId: secondContact.contact.id,
        secondTenantLeadId: secondLead.lead.id
      }
    }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
