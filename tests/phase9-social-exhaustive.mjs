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
const socialOptionSetKeys = ["social-channel", "social-post-status", "social-approval-status"];
const socialPermissionCodes = [
  "social.view",
  "social.create",
  "social.approve",
  "social.use_ai",
  "ai.use_ai"
];

function log(message) {
  console.log(`[phase9-exhaustive] ${message}`);
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
  for (const tableName of ["social_posts", "social_post_channels"]) {
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
    assert.equal(row?.table_name, tableName, `${tableName} should exist after the Phase 9 migration.`);
  }

  for (const [tableName, columnName] of [
    ["social_posts", "title"],
    ["social_posts", "approval_status_option_id"],
    ["social_posts", "hashtags"],
    ["social_post_channels", "channel_option_id"]
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
    assert.equal(row?.column_name, columnName, `${tableName}.${columnName} should exist after Phase 9.`);
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
    [socialPermissionCodes]
  );
  assert.equal(permissions.count, socialPermissionCodes.length, "Social and AI permissions should be seeded.");

  const optionSets = await queryOne(
    client,
    `
      SELECT COUNT(*)::int AS count
      FROM tenant_option_sets
      WHERE tenant_id = $1
        AND deleted_at IS NULL
        AND set_key = ANY($2::text[])
    `,
    [tenant.id, socialOptionSetKeys]
  );
  assert.equal(optionSets.count, socialOptionSetKeys.length, "Social option sets should be seeded for the default tenant.");

  const formLayout = await queryOne(
    client,
    `
      SELECT layout_key
      FROM custom_form_layouts
      WHERE tenant_id = $1
        AND module_key = 'social'
        AND entity_key = 'social_post'
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [tenant.id]
  );
  assert.equal(formLayout?.layout_key, "default-social-post-layout");

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
    [tenantId, roleSlug, roleName, `${roleName} for phase 9 testing`, runToken]
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

async function assertSocialPostState(
  client,
  postId,
  {
    tenantId,
    actorUserId,
    ownerUserId,
    campaignId,
    title,
    statusKey,
    approvalStatusKey,
    channelKeys,
    hashtags
  }
) {
  const row = await queryOne(
    client,
    `
      SELECT
        social_posts.tenant_id,
        social_posts.owner_id,
        social_posts.campaign_id,
        social_posts.title,
        social_posts.hashtags,
        social_posts.created_by,
        social_posts.updated_by,
        status_values.value_key AS status_key,
        approval_values.value_key AS approval_status_key,
        ARRAY_REMOVE(ARRAY_AGG(channel_values.value_key ORDER BY channel_values.value_key), NULL) AS channel_keys,
        social_posts.deleted_at
      FROM social_posts
      INNER JOIN tenant_option_values AS status_values
        ON status_values.id = social_posts.status_option_id
       AND status_values.tenant_id = social_posts.tenant_id
      INNER JOIN tenant_option_values AS approval_values
        ON approval_values.id = social_posts.approval_status_option_id
       AND approval_values.tenant_id = social_posts.tenant_id
      LEFT JOIN social_post_channels
        ON social_post_channels.social_post_id = social_posts.id
       AND social_post_channels.tenant_id = social_posts.tenant_id
       AND social_post_channels.deleted_at IS NULL
      LEFT JOIN tenant_option_values AS channel_values
        ON channel_values.id = social_post_channels.channel_option_id
       AND channel_values.tenant_id = social_post_channels.tenant_id
       AND channel_values.deleted_at IS NULL
      WHERE social_posts.id = $1
      GROUP BY
        social_posts.tenant_id,
        social_posts.owner_id,
        social_posts.campaign_id,
        social_posts.title,
        social_posts.hashtags,
        social_posts.created_by,
        social_posts.updated_by,
        status_values.value_key,
        approval_values.value_key,
        social_posts.deleted_at
      LIMIT 1
    `,
    [postId]
  );

  assert.ok(row, `social post ${postId} should exist.`);
  assert.equal(row.tenant_id, tenantId);
  assert.equal(row.owner_id, ownerUserId);
  assert.equal(row.campaign_id, campaignId);
  assert.equal(row.title, title);
  assert.equal(row.status_key, statusKey);
  assert.equal(row.approval_status_key, approvalStatusKey);
  assert.equal(row.created_by, actorUserId);
  assert.equal(row.updated_by, actorUserId);
  assert.equal(row.deleted_at, null);
  assert.deepEqual((row.channel_keys ?? []).sort(), [...channelKeys].sort());
  assert.deepEqual((row.hashtags ?? []).sort(), [...hashtags].sort());
}

async function main() {
  const client = new Client({
    connectionString: databaseUrl
  });

  await client.connect();

  try {
    log("Checking Phase 9 schema foundation and seeded social catalogs.");
    await assertSchemaFoundation(client);
    const { tenantId, adminUserId } = await assertSeedBaseline(client);

    log("Authenticating as the seeded admin user.");
    const adminSession = await loginSession(defaultTenantSlug, defaultAdminEmail, defaultAdminPassword);
    assert.equal(adminSession.currentUser.id, adminUserId);

    const ownerPassword = `Owner-${runToken}-Pass1!`;
    const ownerUser = await createUserWithPermissions(client, {
      tenantId,
      email: `social-owner-${runToken}@example.test`,
      password: ownerPassword,
      firstName: "Social",
      lastName: "Owner",
      roleName: `Social Owner ${runToken}`,
      roleSlug: `social-owner-${runToken}`,
      permissionCodes: ["social.view", "campaigns.view"]
    });

    log("Creating a linked campaign for social mapping checks.");
    const linkedCampaign = await request("/campaigns", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        name: `Social Campaign ${runToken}`,
        description: `Campaign for phase 9 ${runToken}`,
        typeKey: "social",
        objectiveKey: "awareness",
        targetAudience: `Revenue teams ${runToken}`,
        budgetAmount: 9000,
        ownerId: ownerUser.userId,
        statusKey: "draft",
        startDate: "2026-07-01",
        endDate: "2026-07-15",
        channelKey: "social"
      }
    });
    const linkedCampaignId = linkedCampaign.campaign.id;

    log("Checking social options, channels, and campaign lookup coverage.");
    const socialOptions = await request("/social/options", {
      accessToken: adminSession.accessToken,
      expectedStatus: 200
    });
    const socialChannels = await request("/social/channels", {
      accessToken: adminSession.accessToken,
      expectedStatus: 200
    });
    assert.ok(socialOptions.statuses.some((option) => option.key === "planned"));
    assert.ok(socialOptions.approvalStatuses.some((option) => option.key === "pending_review"));
    assert.ok(socialOptions.channels.some((option) => option.key === "linkedin"));
    assert.ok(socialChannels.channels.some((channel) => channel.key === "instagram"));
    assert.ok(socialOptions.campaigns.some((campaign) => campaign.id === linkedCampaignId));
    assert.ok(socialOptions.owners.some((owner) => owner.id === ownerUser.userId));

    log("Checking validation paths before creating live social posts.");
    await expectError("/social", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 400,
      expectedCode: "INVALID_OWNER",
      body: {
        title: `Invalid Owner ${runToken}`,
        statusKey: "planned",
        approvalStatusKey: "pending_review",
        channelKeys: ["linkedin"],
        ownerId: randomUUID()
      }
    });
    await expectError("/social", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 400,
      expectedCode: "INVALID_CAMPAIGN_LINK",
      body: {
        title: `Invalid Campaign ${runToken}`,
        statusKey: "planned",
        approvalStatusKey: "pending_review",
        channelKeys: ["linkedin"],
        campaignId: randomUUID()
      }
    });

    log("Creating, listing, and updating social posts.");
    const alphaPost = await request("/social", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        title: `Alpha Social ${runToken}`,
        caption: `Alpha caption ${runToken}`,
        creativeBrief: `Alpha brief ${runToken}`,
        hashtags: ["#alpha", "#launch"],
        scheduledAt: "2026-07-03T09:00:00.000Z",
        ownerId: ownerUser.userId,
        campaignId: linkedCampaignId,
        statusKey: "planned",
        approvalStatusKey: "pending_review",
        channelKeys: ["linkedin", "instagram"],
        metadata: {
          runToken
        }
      }
    });
    const alphaPostId = alphaPost.post.id;
    assert.equal(alphaPost.post.aiPlaceholders.actions.length, 5, "Admin should see all AI placeholder actions.");
    await assertSocialPostState(client, alphaPostId, {
      tenantId,
      actorUserId: adminSession.currentUser.id,
      ownerUserId: ownerUser.userId,
      campaignId: linkedCampaignId,
      title: `Alpha Social ${runToken}`,
      statusKey: "planned",
      approvalStatusKey: "pending_review",
      channelKeys: ["instagram", "linkedin"],
      hashtags: ["#alpha", "#launch"]
    });
    await assertAuditLog(client, {
      tenantId,
      actorUserId: adminSession.currentUser.id,
      sessionId: adminSession.session.id,
      action: "social.create",
      resourceType: "social_post",
      resourceId: alphaPostId
    });

    const launchPost = await request("/social", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        title: `Launch Social ${runToken}`,
        caption: `Launch caption ${runToken}`,
        creativeBrief: `Launch brief ${runToken}`,
        hashtags: ["#launch", "#crm"],
        scheduledAt: "2026-07-08T11:30:00.000Z",
        ownerId: ownerUser.userId,
        campaignId: linkedCampaignId,
        statusKey: "scheduled",
        approvalStatusKey: "approved",
        channelKeys: ["linkedin"]
      }
    });

    await request("/social", {
      method: "POST",
      accessToken: adminSession.accessToken,
      expectedStatus: 201,
      body: {
        title: `Zulu Social ${runToken}`,
        caption: `Zulu caption ${runToken}`,
        creativeBrief: `Zulu brief ${runToken}`,
        hashtags: ["#zulu"],
        ownerId: adminSession.currentUser.id,
        statusKey: "draft",
        approvalStatusKey: "not_submitted",
        channelKeys: ["x"]
      }
    });

    const sortedList = await request(`/social${buildQueryString({ search: runToken, sortBy: "title", sortOrder: "asc", pageSize: 1, page: 1 })}`, {
      accessToken: adminSession.accessToken,
      expectedStatus: 200
    });
    assert.equal(sortedList.pagination.total, 3);
    assert.equal(sortedList.posts[0]?.id, alphaPostId);

    const secondSortedPage = await request(`/social${buildQueryString({ search: runToken, sortBy: "title", sortOrder: "asc", pageSize: 1, page: 2 })}`, {
      accessToken: adminSession.accessToken,
      expectedStatus: 200
    });
    assert.equal(secondSortedPage.posts[0]?.id, launchPost.post.id);
    assert.equal(secondSortedPage.pagination.hasPreviousPage, true);

    const campaignFilteredList = await request(`/social${buildQueryString({ search: runToken, campaignId: linkedCampaignId, sortBy: "title", sortOrder: "asc" })}`, {
      accessToken: adminSession.accessToken,
      expectedStatus: 200
    });
    assert.equal(campaignFilteredList.pagination.total, 2);

    const channelFilteredList = await request(`/social${buildQueryString({ search: runToken, channel: "linkedin" })}`, {
      accessToken: adminSession.accessToken,
      expectedStatus: 200
    });
    assert.equal(channelFilteredList.pagination.total, 2);

    const approvalFilteredList = await request(`/social${buildQueryString({ search: runToken, approvalStatus: "approved" })}`, {
      accessToken: adminSession.accessToken,
      expectedStatus: 200
    });
    assert.equal(approvalFilteredList.pagination.total, 1);
    assert.equal(approvalFilteredList.posts[0]?.id, launchPost.post.id);

    const ownerFilteredList = await request(`/social${buildQueryString({ search: runToken, ownerId: ownerUser.userId })}`, {
      accessToken: adminSession.accessToken,
      expectedStatus: 200
    });
    assert.equal(ownerFilteredList.pagination.total, 2);

    const calendarRangeList = await request(
      `/social${buildQueryString({ search: runToken, scheduledFrom: "2026-07-01T00:00:00.000Z", scheduledTo: "2026-07-31T23:59:59.999Z", sortBy: "scheduledAt", sortOrder: "asc" })}`,
      {
        accessToken: adminSession.accessToken,
        expectedStatus: 200
      }
    );
    assert.equal(calendarRangeList.pagination.total, 2, "Two posts should be calendar-ready in July.");

    const postUpdate = await request(`/social/${alphaPostId}`, {
      method: "PATCH",
      accessToken: adminSession.accessToken,
      expectedStatus: 200,
      body: {
        statusKey: "scheduled",
        approvalStatusKey: "approved",
        caption: `Alpha caption updated ${runToken}`,
        creativeBrief: `Alpha brief updated ${runToken}`,
        hashtags: ["#alpha", "#launch", "#approved"],
        channelKeys: ["linkedin", "instagram", "facebook"]
      }
    });
    assert.equal(postUpdate.post.status?.key, "scheduled");
    assert.equal(postUpdate.post.approvalStatus?.key, "approved");
    await assertSocialPostState(client, alphaPostId, {
      tenantId,
      actorUserId: adminSession.currentUser.id,
      ownerUserId: ownerUser.userId,
      campaignId: linkedCampaignId,
      title: `Alpha Social ${runToken}`,
      statusKey: "scheduled",
      approvalStatusKey: "approved",
      channelKeys: ["facebook", "instagram", "linkedin"],
      hashtags: ["#alpha", "#launch", "#approved"]
    });
    await assertAuditLog(client, {
      tenantId,
      actorUserId: adminSession.currentUser.id,
      sessionId: adminSession.session.id,
      action: "social.update",
      resourceType: "social_post",
      resourceId: alphaPostId
    });

    await expectError(`/social/${alphaPostId}`, {
      method: "PATCH",
      accessToken: adminSession.accessToken,
      expectedStatus: 400,
      expectedCode: "VALIDATION_ERROR",
      body: {}
    });

    log("Verifying permission middleware, AI visibility, and limited social mutations.");
    const viewerPassword = `Viewer-${runToken}-Pass1!`;
    await createUserWithPermissions(client, {
      tenantId,
      email: `social-viewer-${runToken}@example.test`,
      password: viewerPassword,
      firstName: "Social",
      lastName: "Viewer",
      roleName: `Social Viewer ${runToken}`,
      roleSlug: `social-viewer-${runToken}`,
      permissionCodes: ["social.view"]
    });
    const viewerSession = await loginSession(defaultTenantSlug, `social-viewer-${runToken}@example.test`, viewerPassword);
    const viewerDetail = await request(`/social/${alphaPostId}`, {
      accessToken: viewerSession.accessToken,
      expectedStatus: 200
    });
    assert.equal(viewerDetail.post.aiPlaceholders.actions.length, 0, "View-only user should not see AI placeholder actions.");
    await expectError("/social", {
      method: "POST",
      accessToken: viewerSession.accessToken,
      expectedStatus: 403,
      expectedCode: "FORBIDDEN",
      body: {
        title: `Blocked Social ${runToken}`,
        statusKey: "planned",
        approvalStatusKey: "pending_review",
        channelKeys: ["linkedin"]
      }
    });

    const assignPassword = `Assign-${runToken}-Pass1!`;
    await createUserWithPermissions(client, {
      tenantId,
      email: `social-assign-${runToken}@example.test`,
      password: assignPassword,
      firstName: "Social",
      lastName: "Assign",
      roleName: `Social Assign ${runToken}`,
      roleSlug: `social-assign-${runToken}`,
      permissionCodes: ["social.view", "social.assign"]
    });
    const assignSession = await loginSession(defaultTenantSlug, `social-assign-${runToken}@example.test`, assignPassword);
    const assignUpdate = await request(`/social/${alphaPostId}`, {
      method: "PATCH",
      accessToken: assignSession.accessToken,
      expectedStatus: 200,
      body: {
        ownerId: adminSession.currentUser.id,
        campaignId: null
      }
    });
    assert.equal(assignUpdate.post.owner?.id, adminSession.currentUser.id);
    assert.equal(assignUpdate.post.campaign, null);
    await expectError(`/social/${alphaPostId}`, {
      method: "PATCH",
      accessToken: assignSession.accessToken,
      expectedStatus: 403,
      expectedCode: "AUTHORIZATION_ERROR",
      body: {
        title: `Blocked title ${runToken}`
      }
    });

    const approvePassword = `Approve-${runToken}-Pass1!`;
    await createUserWithPermissions(client, {
      tenantId,
      email: `social-approve-${runToken}@example.test`,
      password: approvePassword,
      firstName: "Social",
      lastName: "Approve",
      roleName: `Social Approver ${runToken}`,
      roleSlug: `social-approver-${runToken}`,
      permissionCodes: ["social.view", "social.approve"]
    });
    const approveSession = await loginSession(defaultTenantSlug, `social-approve-${runToken}@example.test`, approvePassword);
    const approvalUpdate = await request(`/social/${alphaPostId}`, {
      method: "PATCH",
      accessToken: approveSession.accessToken,
      expectedStatus: 200,
      body: {
        approvalStatusKey: "changes_requested"
      }
    });
    assert.equal(approvalUpdate.post.approvalStatus?.key, "changes_requested");
    await expectError(`/social/${alphaPostId}`, {
      method: "PATCH",
      accessToken: approveSession.accessToken,
      expectedStatus: 403,
      expectedCode: "AUTHORIZATION_ERROR",
      body: {
        caption: `Blocked caption ${runToken}`
      }
    });

    log("Checking tenant isolation for social posts and campaign linkage.");
    const secondTenantId = await createTenant(client, `social-tenant-${runToken}`, `Social Tenant ${runToken}`);
    for (const setKey of socialOptionSetKeys) {
      await cloneOptionSet(client, tenantId, secondTenantId, setKey);
    }

    const secondTenantPassword = `Second-${runToken}-Pass1!`;
    await createUserWithPermissions(client, {
      tenantId: secondTenantId,
      email: `social-admin-${runToken}@tenant-two.test`,
      password: secondTenantPassword,
      firstName: "Second",
      lastName: "Tenant",
      roleName: `Second Social Admin ${runToken}`,
      roleSlug: `second-social-admin-${runToken}`,
      permissionCodes: [
        "social.view",
        "social.create",
        "social.edit",
        "social.delete",
        "social.assign",
        "social.approve",
        "social.configure"
      ]
    });
    const secondTenantSession = await loginSession(
      `social-tenant-${runToken}`,
      `social-admin-${runToken}@tenant-two.test`,
      secondTenantPassword
    );

    await request("/social", {
      method: "POST",
      accessToken: secondTenantSession.accessToken,
      expectedStatus: 201,
      body: {
        title: `Second Tenant Social ${runToken}`,
        statusKey: "planned",
        approvalStatusKey: "pending_review",
        channelKeys: ["linkedin"]
      }
    });

    await expectError(`/social/${alphaPostId}`, {
      accessToken: secondTenantSession.accessToken,
      expectedStatus: 404,
      expectedCode: "SOCIAL_POST_NOT_FOUND"
    });
    await expectError("/social", {
      method: "POST",
      accessToken: secondTenantSession.accessToken,
      expectedStatus: 400,
      expectedCode: "INVALID_CAMPAIGN_LINK",
      body: {
        title: `Cross Tenant Campaign ${runToken}`,
        statusKey: "planned",
        approvalStatusKey: "pending_review",
        channelKeys: ["linkedin"],
        campaignId: linkedCampaignId
      }
    });

    log("Soft-deleting the primary social post and confirming it disappears from the tenant view.");
    await request(`/social/${alphaPostId}`, {
      method: "DELETE",
      accessToken: adminSession.accessToken,
      expectedStatus: 200
    });
    await assertAuditLog(client, {
      tenantId,
      actorUserId: adminSession.currentUser.id,
      sessionId: adminSession.session.id,
      action: "social.delete",
      resourceType: "social_post",
      resourceId: alphaPostId
    });
    await expectError(`/social/${alphaPostId}`, {
      accessToken: adminSession.accessToken,
      expectedStatus: 404,
      expectedCode: "SOCIAL_POST_NOT_FOUND"
    });

    const finalList = await request(`/social${buildQueryString({ search: runToken })}`, {
      accessToken: adminSession.accessToken,
      expectedStatus: 200
    });
    assert.ok(finalList.posts.every((post) => post.id !== alphaPostId));

    log("Phase 9 social media marketing checks passed.");
  } finally {
    await client.end();
  }
}

await main();
