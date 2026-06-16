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
const campaignOptionSetKeys = [
  "campaign-type",
  "campaign-objective",
  "campaign-status",
  "campaign-channel",
  "campaign-member-status"
];

function log(message) {
  console.log(`[phase8-exhaustive] ${message}`);
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
  for (const tableName of ["campaigns", "campaign_members"]) {
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
    assert.equal(row?.table_name, tableName, `${tableName} should exist after the Phase 8 migration.`);
  }

  for (const [tableName, columnName] of [
    ["campaigns", "related_assets"],
    ["campaigns", "budget_amount"],
    ["campaign_members", "member_entity_type"],
    ["campaign_members", "response_text"]
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
    assert.equal(row?.column_name, columnName, `${tableName}.${columnName} should exist after Phase 8.`);
  }

  for (const constraintName of [
    "crm_notes_entity_type_check",
    "crm_activities_entity_type_check",
    "crm_tasks_entity_type_check",
    "crm_timeline_events_entity_type_check"
  ]) {
    const row = await queryOne(
      client,
      `
        SELECT pg_get_constraintdef(oid) AS definition
        FROM pg_constraint
        WHERE conname = $1
        LIMIT 1
      `,
      [constraintName]
    );
    assert.match(row?.definition ?? "", /campaign/, `${constraintName} should now allow campaign entity links.`);
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
    [[
      "campaigns.view",
      "campaigns.create",
      "campaigns.use_ai",
      "campaigns.manage_ai",
      "ai.use_ai"
    ]]
  );
  assert.equal(permissions.count, 5, "Campaign and AI permissions should be seeded.");

  const optionSets = await queryOne(
    client,
    `
      SELECT COUNT(*)::int AS count
      FROM tenant_option_sets
      WHERE tenant_id = $1
        AND deleted_at IS NULL
        AND set_key = ANY($2::text[])
    `,
    [tenant.id, campaignOptionSetKeys]
  );
  assert.equal(optionSets.count, campaignOptionSetKeys.length, "Campaign option sets should be seeded for the default tenant.");

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
    [tenantId, roleSlug, roleName, `${roleName} for phase 8 testing`, runToken]
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

async function assertCampaignState(
  client,
  campaignId,
  { tenantId, actorUserId, ownerUserId, name, typeKey, objectiveKey, statusKey, channelKey, budgetAmount }
) {
  const row = await queryOne(
    client,
    `
      SELECT
        campaigns.tenant_id,
        campaigns.owner_id,
        campaigns.name,
        campaigns.budget_amount,
        campaigns.related_assets,
        campaigns.created_by,
        campaigns.updated_by,
        type_values.value_key AS type_key,
        objective_values.value_key AS objective_key,
        status_values.value_key AS status_key,
        channel_values.value_key AS channel_key
      FROM campaigns
      INNER JOIN tenant_option_values AS type_values
        ON type_values.id = campaigns.type_option_id
       AND type_values.tenant_id = campaigns.tenant_id
      INNER JOIN tenant_option_values AS objective_values
        ON objective_values.id = campaigns.objective_option_id
       AND objective_values.tenant_id = campaigns.tenant_id
      INNER JOIN tenant_option_values AS status_values
        ON status_values.id = campaigns.status_option_id
       AND status_values.tenant_id = campaigns.tenant_id
      INNER JOIN tenant_option_values AS channel_values
        ON channel_values.id = campaigns.channel_option_id
       AND channel_values.tenant_id = campaigns.tenant_id
      WHERE campaigns.id = $1
      LIMIT 1
    `,
    [campaignId]
  );

  assert.ok(row, `campaign ${campaignId} should exist.`);
  assert.equal(row.tenant_id, tenantId);
  assert.equal(row.owner_id, ownerUserId);
  assert.equal(row.name, name);
  assert.equal(Number(row.budget_amount), budgetAmount);
  assert.equal(row.type_key, typeKey);
  assert.equal(row.objective_key, objectiveKey);
  assert.equal(row.status_key, statusKey);
  assert.equal(row.channel_key, channelKey);
  assert.equal(row.created_by, actorUserId);
  assert.equal(row.updated_by, actorUserId);
  assert.equal(row.related_assets[0]?.label, "Launch brief");
}

async function assertCampaignMemberState(
  client,
  memberId,
  { tenantId, campaignId, actorUserId, memberEntityType, memberEntityId, statusKey, response }
) {
  const row = await queryOne(
    client,
    `
      SELECT
        campaign_members.tenant_id,
        campaign_members.campaign_id,
        campaign_members.member_entity_type,
        campaign_members.member_entity_id,
        campaign_members.response_text,
        campaign_members.created_by,
        campaign_members.updated_by,
        status_values.value_key AS status_key,
        campaign_members.deleted_at
      FROM campaign_members
      LEFT JOIN tenant_option_values AS status_values
        ON status_values.id = campaign_members.status_option_id
       AND status_values.tenant_id = campaign_members.tenant_id
      WHERE campaign_members.id = $1
      LIMIT 1
    `,
    [memberId]
  );

  assert.ok(row, `campaign member ${memberId} should exist.`);
  assert.equal(row.tenant_id, tenantId);
  assert.equal(row.campaign_id, campaignId);
  assert.equal(row.member_entity_type, memberEntityType);
  assert.equal(row.member_entity_id, memberEntityId);
  assert.equal(row.status_key, statusKey);
  assert.equal(row.response_text, response);
  assert.equal(row.created_by, actorUserId);
  assert.equal(row.updated_by, actorUserId);
  assert.equal(row.deleted_at, null);
}

function assertTimelineContainsKinds(items, expectedKinds) {
  const kinds = new Set(items.map((item) => item.kind));

  for (const kind of expectedKinds) {
    assert.ok(kinds.has(kind), `Timeline should include ${kind} items.`);
  }
}

async function main() {
  const client = new Client({
    connectionString: databaseUrl
  });

  await client.connect();

  try {
    log("Checking Phase 8 schema foundation and seeded campaign option catalogs.");
    await assertSchemaFoundation(client);
    const { tenantId, adminUserId } = await assertSeedBaseline(client);

    log("Authenticating as the seeded admin user.");
    const adminSession = await loginSession(defaultTenantSlug, defaultAdminEmail, defaultAdminPassword);
    assert.equal(adminSession.currentUser.id, adminUserId);

    const ownerPassword = `Owner-${runToken}-Pass1!`;
    const ownerUser = await createUserWithPermissions(client, {
      tenantId,
      email: `campaign-owner-${runToken}@example.test`,
      password: ownerPassword,
      firstName: "Campaign",
      lastName: "Owner",
      roleName: `Campaign Owner ${runToken}`,
      roleSlug: `campaign-owner-${runToken}`,
      permissionCodes: ["campaigns.view", "leads.view", "accounts.view", "contacts.view"]
    });

    log("Creating lead, account, and contact records to attach as campaign members.");
    const leadCreate = await request("/leads", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        firstName: "Lena",
        lastName: `Lead${runToken}`,
        companyName: `Launch Prospect ${runToken}`,
        email: `lead-${runToken}@example.test`,
        statusKey: "new",
        sourceKey: "campaign",
        ownerId: ownerUser.userId,
        metadata: {
          runToken
        }
      }
    });

    const accountCreate = await request("/accounts", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        name: `Launch Account ${runToken}`,
        website: `https://account-${runToken}.example.test`,
        industry: "Technology",
        accountTypeKey: "prospect",
        healthStatusKey: "healthy",
        ownerId: ownerUser.userId,
        metadata: {
          runToken
        }
      }
    });

    const contactCreate = await request("/contacts", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        firstName: "Cora",
        lastName: `Contact${runToken}`,
        email: `contact-${runToken}@example.test`,
        phone: "+15550101010",
        roleKey: "decision_maker",
        ownerId: ownerUser.userId,
        accountId: accountCreate.account.id,
        metadata: {
          runToken
        }
      }
    });

    log("Checking campaign options and candidate lookups.");
    const options = await request("/campaigns/options", {
      accessToken: adminSession.accessToken,
      expectedStatus: 200
    });
    assert.ok(options.types.some((option) => option.key === "email"));
    assert.ok(options.objectives.some((option) => option.key === "lead_generation"));
    assert.ok(options.statuses.some((option) => option.key === "draft"));
    assert.ok(options.channels.some((option) => option.key === "multi_channel"));
    assert.ok(options.memberStatuses.some((option) => option.key === "planned"));
    assert.ok(options.leadCandidates.some((candidate) => candidate.id === leadCreate.lead.id));
    assert.ok(options.contactCandidates.some((candidate) => candidate.id === contactCreate.contact.id));
    assert.ok(options.accountCandidates.some((candidate) => candidate.id === accountCreate.account.id));

    const emailTypeKey = options.types.find((option) => option.key === "email")?.key ?? options.types[0]?.key;
    const alternateTypeKey = options.types.find((option) => option.key !== emailTypeKey)?.key ?? emailTypeKey;
    const hasAlternateType = alternateTypeKey !== emailTypeKey;
    const leadGenerationObjectiveKey =
      options.objectives.find((option) => option.key === "lead_generation")?.key ?? options.objectives[0]?.key;
    const pipelineAccelerationObjectiveKey =
      options.objectives.find((option) => option.key === "pipeline_acceleration")?.key ??
      options.objectives.find((option) => option.key !== leadGenerationObjectiveKey)?.key ??
      leadGenerationObjectiveKey;
    const draftStatusKey = options.statuses.find((option) => option.key === "draft")?.key ?? options.statuses[0]?.key;
    const activeStatusKey =
      options.statuses.find((option) => option.key === "active")?.key ??
      options.statuses.find((option) => option.key !== draftStatusKey)?.key ??
      draftStatusKey;
    const plannedStatusKey =
      options.statuses.find((option) => option.key === "planned")?.key ??
      options.statuses.find((option) => option.key !== draftStatusKey && option.key !== activeStatusKey)?.key ??
      draftStatusKey;
    const multiChannelKey =
      options.channels.find((option) => option.key === "multi_channel")?.key ?? options.channels[0]?.key;
    const alternateChannelKey = options.channels.find((option) => option.key !== multiChannelKey)?.key ?? multiChannelKey;
    const hasAlternateChannel = alternateChannelKey !== multiChannelKey;
    const plannedMemberStatusKey =
      options.memberStatuses.find((option) => option.key === "planned")?.key ?? options.memberStatuses[0]?.key;

    log("Checking campaign validation paths before creating live records.");
    await expectError("/campaigns", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 400,
      expectedCode: "INVALID_DATE_RANGE",
      body: {
        name: `Invalid Date Campaign ${runToken}`,
        typeKey: emailTypeKey,
        objectiveKey: leadGenerationObjectiveKey,
        statusKey: draftStatusKey,
        channelKey: multiChannelKey,
        startDate: "2026-06-30",
        endDate: "2026-06-20"
      }
    });
    await expectError("/campaigns", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 400,
      expectedCode: "INVALID_OWNER",
      body: {
        name: `Invalid Owner Campaign ${runToken}`,
        typeKey: emailTypeKey,
        objectiveKey: leadGenerationObjectiveKey,
        statusKey: draftStatusKey,
        channelKey: multiChannelKey,
        ownerId: randomUUID()
      }
    });

    log("Creating, listing, and updating campaigns.");
    const campaignCreate = await request("/campaigns", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        name: `Launch Campaign ${runToken}`,
        description: `Primary campaign ${runToken}`,
        typeKey: emailTypeKey,
        objectiveKey: leadGenerationObjectiveKey,
        targetAudience: `VPs and revenue leaders ${runToken}`,
        budgetAmount: 12500,
        ownerId: ownerUser.userId,
        statusKey: draftStatusKey,
        startDate: "2026-06-20",
        endDate: "2026-06-30",
        channelKey: multiChannelKey,
        relatedAssets: [
          {
            label: "Launch brief",
            url: `https://assets.example.test/${runToken}/brief`,
            assetType: "brief"
          }
        ],
        metadata: {
          runToken
        }
      }
    });

    const campaignId = campaignCreate.campaign.id;
    assert.equal(campaignCreate.campaign.aiPlaceholders.actions.length, 3, "Admin should see AI placeholder actions.");
    assert.equal(campaignCreate.campaign.memberCount, 0);
    await assertCampaignState(client, campaignId, {
      tenantId,
      actorUserId: adminSession.currentUser.id,
      ownerUserId: ownerUser.userId,
      name: `Launch Campaign ${runToken}`,
      typeKey: emailTypeKey,
      objectiveKey: leadGenerationObjectiveKey,
      statusKey: draftStatusKey,
      channelKey: multiChannelKey,
      budgetAmount: 12500
    });
    await assertAuditLog(client, {
      tenantId,
      actorUserId: adminSession.currentUser.id,
      sessionId: adminSession.session.id,
      action: "campaign.create",
      resourceType: "campaign",
      resourceId: campaignId
    });

    const alphaCampaign = await request("/campaigns", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        name: `Alpha Campaign ${runToken}`,
        description: `Alphabetically first ${runToken}`,
        typeKey: emailTypeKey,
        objectiveKey: leadGenerationObjectiveKey,
        statusKey: plannedStatusKey,
        channelKey: alternateChannelKey,
        ownerId: ownerUser.userId,
        budgetAmount: 5000,
        startDate: "2026-06-18",
        endDate: "2026-06-22"
      }
    });
    const zuluCampaign = await request("/campaigns", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        name: `Zulu Campaign ${runToken}`,
        description: `Alphabetically last ${runToken}`,
        typeKey: alternateTypeKey,
        objectiveKey: pipelineAccelerationObjectiveKey,
        statusKey: draftStatusKey,
        channelKey: alternateChannelKey,
        ownerId: adminSession.currentUser.id,
        budgetAmount: 20000,
        startDate: "2026-06-28",
        endDate: "2026-07-06"
      }
    });

    const campaignList = await request(
      `/campaigns${buildQueryString({ search: runToken, status: draftStatusKey, type: emailTypeKey })}`,
      {
        accessToken: adminSession.accessToken,
        expectedStatus: 200
      }
    );
    assert.equal(campaignList.campaigns.length, 1);
    assert.equal(campaignList.campaigns[0].id, campaignId);

    const pagedCampaignList = await request(
      `/campaigns${buildQueryString({ search: runToken, sortBy: "name", sortOrder: "asc", pageSize: 1, page: 1 })}`,
      {
        accessToken: adminSession.accessToken,
        expectedStatus: 200
      }
    );
    assert.equal(pagedCampaignList.pagination.total, 3);
    assert.equal(pagedCampaignList.pagination.pageSize, 1);
    assert.equal(pagedCampaignList.pagination.totalPages, 3);
    assert.equal(pagedCampaignList.pagination.hasNextPage, true);
    assert.equal(pagedCampaignList.campaigns[0]?.id, alphaCampaign.campaign.id);

    const secondPagedCampaignList = await request(
      `/campaigns${buildQueryString({ search: runToken, sortBy: "name", sortOrder: "asc", pageSize: 1, page: 2 })}`,
      {
        accessToken: adminSession.accessToken,
        expectedStatus: 200
      }
    );
    assert.equal(secondPagedCampaignList.pagination.hasPreviousPage, true);
    assert.equal(secondPagedCampaignList.campaigns[0]?.id, campaignId);

    const ownerFilteredList = await request(
      `/campaigns${buildQueryString({ search: runToken, ownerId: ownerUser.userId, sortBy: "name", sortOrder: "asc" })}`,
      {
        accessToken: adminSession.accessToken,
        expectedStatus: 200
      }
    );
    assert.equal(ownerFilteredList.pagination.total, 2);
    assert.deepEqual(
      ownerFilteredList.campaigns.map((campaign) => campaign.id),
      [alphaCampaign.campaign.id, campaignId]
    );

    const budgetSortedList = await request(
      `/campaigns${buildQueryString({ search: runToken, sortBy: "budget", sortOrder: "desc" })}`,
      {
        accessToken: adminSession.accessToken,
        expectedStatus: 200
      }
    );
    assert.equal(budgetSortedList.campaigns[0]?.id, zuluCampaign.campaign.id);
    assert.equal(budgetSortedList.campaigns[1]?.id, campaignId);

    const startDateSortedList = await request(
      `/campaigns${buildQueryString({ search: runToken, sortBy: "startDate", sortOrder: "asc" })}`,
      {
        accessToken: adminSession.accessToken,
        expectedStatus: 200
      }
    );
    assert.equal(startDateSortedList.campaigns[0]?.id, alphaCampaign.campaign.id);

    const channelFilteredList = await request(
      `/campaigns${buildQueryString({ search: runToken, channel: multiChannelKey })}`,
      {
        accessToken: adminSession.accessToken,
        expectedStatus: 200
      }
    );
    assert.ok(channelFilteredList.campaigns.some((campaign) => campaign.id === campaignId));
    if (hasAlternateChannel) {
      assert.equal(channelFilteredList.campaigns.length, 1);
      assert.equal(channelFilteredList.campaigns[0]?.id, campaignId);
    }

    if (hasAlternateType) {
      const typeFilteredList = await request(
        `/campaigns${buildQueryString({ search: runToken, type: alternateTypeKey })}`,
        {
          accessToken: adminSession.accessToken,
          expectedStatus: 200
        }
      );
      assert.equal(typeFilteredList.campaigns.length, 1);
      assert.equal(typeFilteredList.campaigns[0]?.id, zuluCampaign.campaign.id);
    }

    const campaignUpdate = await request(`/campaigns/${campaignId}`, {
      method: "PATCH",
      accessToken: adminSession.accessToken,
      expectedStatus: 200,
      body: {
        statusKey: activeStatusKey,
        objectiveKey: pipelineAccelerationObjectiveKey,
        budgetAmount: 15000,
        targetAudience: `Expanded audience ${runToken}`,
        relatedAssets: [
          {
            label: "Launch brief",
            url: `https://assets.example.test/${runToken}/brief`,
            assetType: "brief"
          },
          {
            label: "Email draft",
            url: `https://assets.example.test/${runToken}/email`,
            assetType: "email"
          }
        ],
        metadata: {
          runToken,
          updated: true
        }
      }
    });
    assert.equal(campaignUpdate.campaign.status?.key, activeStatusKey);
    assert.equal(campaignUpdate.campaign.objective?.key, pipelineAccelerationObjectiveKey);
    assert.equal(campaignUpdate.campaign.budgetAmount, 15000);
    assert.equal(campaignUpdate.campaign.relatedAssets.length, 2);
    await assertAuditLog(client, {
      tenantId,
      actorUserId: adminSession.currentUser.id,
      sessionId: adminSession.session.id,
      action: "campaign.update",
      resourceType: "campaign",
      resourceId: campaignId
    });
    await expectError(`/campaigns/${campaignId}`, {
      method: "PATCH",
      accessToken: adminSession.accessToken,
      expectedStatus: 400,
      expectedCode: "VALIDATION_ERROR",
      body: {}
    });

    log("Adding, updating, deleting, and re-adding campaign members.");
    const leadMemberCreate = await request(`/campaigns/${campaignId}/members`, {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        memberEntityType: "lead",
        memberEntityId: leadCreate.lead.id,
        statusKey: plannedMemberStatusKey,
        response: `Lead queued ${runToken}`,
        metadata: {
          runToken
        }
      }
    });
    const leadMemberId = leadMemberCreate.member.id;
    await assertCampaignMemberState(client, leadMemberId, {
      tenantId,
      campaignId,
      actorUserId: adminSession.currentUser.id,
      memberEntityType: "lead",
      memberEntityId: leadCreate.lead.id,
      statusKey: plannedMemberStatusKey,
      response: `Lead queued ${runToken}`
    });
    await assertAuditLog(client, {
      tenantId,
      actorUserId: adminSession.currentUser.id,
      sessionId: adminSession.session.id,
      action: "campaign.member.create",
      resourceType: "campaign",
      resourceId: campaignId
    });

    await request(`/campaigns/${campaignId}/members`, {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        memberEntityType: "contact",
        memberEntityId: contactCreate.contact.id,
        statusKey: "contacted",
        response: `Contact contacted ${runToken}`
      }
    });

    await request(`/campaigns/${campaignId}/members`, {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        memberEntityType: "account",
        memberEntityId: accountCreate.account.id,
        statusKey: "engaged",
        response: `Account engaged ${runToken}`
      }
    });

    await expectError(`/campaigns/${campaignId}/members`, {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 409,
      expectedCode: "CAMPAIGN_MEMBER_EXISTS",
      body: {
        memberEntityType: "lead",
        memberEntityId: leadCreate.lead.id,
        statusKey: plannedMemberStatusKey
      }
    });

    const memberUpdate = await request(`/campaigns/${campaignId}/members/${leadMemberId}`, {
      method: "PATCH",
      accessToken: adminSession.accessToken,
      expectedStatus: 200,
      body: {
        statusKey: "responded",
        response: `Lead responded ${runToken}`,
        metadata: {
          runToken,
          updated: true
        }
      }
    });
    assert.equal(memberUpdate.member.status?.key, "responded");
    assert.equal(memberUpdate.member.response, `Lead responded ${runToken}`);
    await assertAuditLog(client, {
      tenantId,
      actorUserId: adminSession.currentUser.id,
      sessionId: adminSession.session.id,
      action: "campaign.member.update",
      resourceType: "campaign",
      resourceId: campaignId
    });

    await request(`/campaigns/${campaignId}/members/${leadMemberId}`, {
      method: "DELETE",
      accessToken: adminSession.accessToken,
      expectedStatus: 200
    });
    await assertAuditLog(client, {
      tenantId,
      actorUserId: adminSession.currentUser.id,
      sessionId: adminSession.session.id,
      action: "campaign.member.delete",
      resourceType: "campaign",
      resourceId: campaignId
    });

    const membersAfterDelete = await request(`/campaigns/${campaignId}/members`, {
      accessToken: adminSession.accessToken,
      expectedStatus: 200
    });
    assert.equal(membersAfterDelete.members.length, 2);

    const leadMemberReAdd = await request(`/campaigns/${campaignId}/members`, {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        memberEntityType: "lead",
        memberEntityId: leadCreate.lead.id,
        statusKey: "queued",
        response: `Lead re-added ${runToken}`
      }
    });
    assert.equal(leadMemberReAdd.member.status?.key, "queued", "Soft-deleted members should be re-addable.");

    log("Using generic shared CRM endpoints on the campaign entity.");
    const noteCreate = await request(`/records/campaign/${campaignId}/notes`, {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        body: `Campaign note ${runToken}`,
        isCustomerFacing: false,
        metadata: {
          runToken
        }
      }
    });

    const noteUpdate = await request(`/records/campaign/${campaignId}/notes/${noteCreate.note.id}`, {
      method: "PATCH",
      accessToken: adminSession.accessToken,
      expectedStatus: 200,
      body: {
        body: `Campaign note updated ${runToken}`,
        isCustomerFacing: true,
        metadata: {
          runToken,
          updated: true
        }
      }
    });
    assert.equal(noteUpdate.note.isCustomerFacing, true);

    const activityCreate = await request(`/records/campaign/${campaignId}/activities`, {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        activityType: "email",
        subject: `Campaign activity ${runToken}`,
        outcome: `Campaign outcome ${runToken}`,
        notes: `Campaign notes ${runToken}`,
        ownerId: ownerUser.userId,
        occurredAt: new Date("2026-06-21T09:00:00.000Z").toISOString(),
        metadata: {
          runToken
        }
      }
    });
    assert.equal(activityCreate.activity.relatedRecord.entityType, "campaign");

    const taskCreate = await request(`/records/campaign/${campaignId}/tasks`, {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        title: `Campaign task ${runToken}`,
        description: `Campaign task description ${runToken}`,
        dueAt: new Date("2026-06-24T10:00:00.000Z").toISOString(),
        reminderAt: new Date("2026-06-23T10:00:00.000Z").toISOString(),
        priority: "high",
        status: "open",
        ownerId: adminSession.currentUser.id,
        assigneeId: ownerUser.userId,
        metadata: {
          runToken
        }
      }
    });

    const taskUpdate = await request(`/records/campaign/${campaignId}/tasks/${taskCreate.task.id}`, {
      method: "PATCH",
      accessToken: adminSession.accessToken,
      expectedStatus: 200,
      body: {
        status: "completed",
        priority: "urgent",
        ownerId: ownerUser.userId,
        assigneeId: adminSession.currentUser.id,
        metadata: {
          runToken,
          updated: true
        }
      }
    });
    assert.equal(taskUpdate.task.status, "completed");

    const notesList = await request(`/records/campaign/${campaignId}/notes`, {
      accessToken: adminSession.accessToken,
      expectedStatus: 200
    });
    const activitiesList = await request(`/records/campaign/${campaignId}/activities`, {
      accessToken: adminSession.accessToken,
      expectedStatus: 200
    });
    const tasksList = await request(`/records/campaign/${campaignId}/tasks`, {
      accessToken: adminSession.accessToken,
      expectedStatus: 200
    });
    const timeline = await request(`/records/campaign/${campaignId}/timeline`, {
      accessToken: adminSession.accessToken,
      expectedStatus: 200
    });
    assert.ok(notesList.notes.some((note) => note.id === noteCreate.note.id));
    assert.ok(activitiesList.activities.some((activity) => activity.id === activityCreate.activity.id));
    assert.ok(tasksList.tasks.some((task) => task.id === taskCreate.task.id));
    assertTimelineContainsKinds(timeline.items, ["note", "activity", "task"]);

    const detailAfterProductivity = await request(`/campaigns/${campaignId}`, {
      accessToken: adminSession.accessToken,
      expectedStatus: 200
    });
    assert.equal(detailAfterProductivity.campaign.noteCount, 1);
    assert.equal(detailAfterProductivity.campaign.activityCount, 1);
    assert.equal(detailAfterProductivity.campaign.taskCount, 1);
    assert.equal(detailAfterProductivity.campaign.memberCount, 3);
    assert.equal(detailAfterProductivity.campaign.aiPlaceholders.actions.length, 3);

    log("Verifying permission middleware, AI visibility, and assign-only campaign mutations.");
    const limitedPassword = `Limited-${runToken}-Pass1!`;
    await createUserWithPermissions(client, {
      tenantId,
      email: `limited-${runToken}@example.test`,
      password: limitedPassword,
      firstName: "Limited",
      lastName: "Viewer",
      roleName: `Campaign Viewer ${runToken}`,
      roleSlug: `campaign-viewer-${runToken}`,
      permissionCodes: ["campaigns.view"]
    });
    const limitedSession = await loginSession(defaultTenantSlug, `limited-${runToken}@example.test`, limitedPassword);
    const limitedDetail = await request(`/campaigns/${campaignId}`, {
      accessToken: limitedSession.accessToken,
      expectedStatus: 200
    });
    assert.equal(limitedDetail.campaign.aiPlaceholders.actions.length, 0, "View-only user should not see AI placeholder actions.");
    await expectError("/campaigns", {
      method: "POST",
      accessToken: limitedSession.accessToken,
      expectedStatus: 403,
      expectedCode: "FORBIDDEN",
      body: {
        name: `Blocked Campaign ${runToken}`,
        typeKey: "email",
        objectiveKey: "lead_generation",
        statusKey: "draft",
        channelKey: "email"
      }
    });

    const assignPassword = `Assign-${runToken}-Pass1!`;
    await createUserWithPermissions(client, {
      tenantId,
      email: `assign-${runToken}@example.test`,
      password: assignPassword,
      firstName: "Assign",
      lastName: "Only",
      roleName: `Campaign Assign ${runToken}`,
      roleSlug: `campaign-assign-${runToken}`,
      permissionCodes: ["campaigns.view", "campaigns.assign"]
    });
    const assignSession = await loginSession(defaultTenantSlug, `assign-${runToken}@example.test`, assignPassword);
    const assignUpdate = await request(`/campaigns/${campaignId}`, {
      method: "PATCH",
      accessToken: assignSession.accessToken,
      expectedStatus: 200,
      body: {
        ownerId: adminSession.currentUser.id
      }
    });
    assert.equal(assignUpdate.campaign.owner?.id, adminSession.currentUser.id);
    await expectError(`/campaigns/${campaignId}`, {
      method: "PATCH",
      accessToken: assignSession.accessToken,
      expectedStatus: 403,
      expectedCode: "AUTHORIZATION_ERROR",
      body: {
        budgetAmount: 9900
      }
    });
    const assignMemberUpdate = await request(`/campaigns/${campaignId}/members/${leadMemberReAdd.member.id}`, {
      method: "PATCH",
      accessToken: assignSession.accessToken,
      expectedStatus: 200,
      body: {
        statusKey: "engaged",
        response: `Assign-only follow-up ${runToken}`
      }
    });
    assert.equal(assignMemberUpdate.member.status?.key, "engaged");

    log("Checking tenant isolation for campaigns and member attachment.");
    const secondTenantId = await createTenant(client, `campaign-tenant-${runToken}`, `Campaign Tenant ${runToken}`);
    for (const setKey of campaignOptionSetKeys) {
      await cloneOptionSet(client, tenantId, secondTenantId, setKey);
    }

    const secondTenantPassword = `Second-${runToken}-Pass1!`;
    await createUserWithPermissions(client, {
      tenantId: secondTenantId,
      email: `campaign-admin-${runToken}@tenant-two.test`,
      password: secondTenantPassword,
      firstName: "Second",
      lastName: "Tenant",
      roleName: `Second Campaign Admin ${runToken}`,
      roleSlug: `second-campaign-admin-${runToken}`,
      permissionCodes: [
        "campaigns.view",
        "campaigns.create",
        "campaigns.edit",
        "campaigns.delete",
        "campaigns.assign",
        "campaigns.configure"
      ]
    });
    const secondTenantSession = await loginSession(
      `campaign-tenant-${runToken}`,
      `campaign-admin-${runToken}@tenant-two.test`,
      secondTenantPassword
    );

    const secondTenantCampaign = await request("/campaigns", {
      method: "POST",
      accessToken: secondTenantSession.accessToken,
      expectedStatus: 201,
      body: {
        name: `Second Tenant Campaign ${runToken}`,
        typeKey: "email",
        objectiveKey: "lead_generation",
        statusKey: "draft",
        channelKey: "email"
      }
    });

    await expectError(`/campaigns/${campaignId}`, {
      accessToken: secondTenantSession.accessToken,
      expectedStatus: 404,
      expectedCode: "CAMPAIGN_NOT_FOUND"
    });

    await expectError(`/campaigns/${secondTenantCampaign.campaign.id}/members`, {
      method: "POST",
      accessToken: secondTenantSession.accessToken,
      expectedStatus: 400,
      expectedCode: "INVALID_MEMBER_RECORD",
      body: {
        memberEntityType: "lead",
        memberEntityId: leadCreate.lead.id
      }
    });

    log("Soft-deleting the campaign and confirming it disappears from the tenant view.");
    await request(`/campaigns/${campaignId}`, {
      method: "DELETE",
      accessToken: adminSession.accessToken,
      expectedStatus: 200
    });
    await assertAuditLog(client, {
      tenantId,
      actorUserId: adminSession.currentUser.id,
      sessionId: adminSession.session.id,
      action: "campaign.delete",
      resourceType: "campaign",
      resourceId: campaignId
    });
    await expectError(`/campaigns/${campaignId}`, {
      accessToken: adminSession.accessToken,
      expectedStatus: 404,
      expectedCode: "CAMPAIGN_NOT_FOUND"
    });

    const finalList = await request(`/campaigns${buildQueryString({ search: runToken })}`, {
      accessToken: adminSession.accessToken,
      expectedStatus: 200
    });
    assert.ok(finalList.campaigns.every((campaign) => campaign.id !== campaignId));

    log("Phase 8 campaign management checks passed.");
  } finally {
    await client.end();
  }
}

await main();
