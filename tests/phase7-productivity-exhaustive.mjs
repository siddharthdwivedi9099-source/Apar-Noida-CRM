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
  console.log(`[phase7-exhaustive] ${message}`);
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
  const requiredTables = ["crm_tasks", "crm_timeline_events"];

  for (const tableName of requiredTables) {
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
    assert.equal(row?.table_name, tableName, `${tableName} should exist after Phase 7 migration.`);
  }

  for (const [tableName, columnName] of [
    ["crm_notes", "is_customer_facing"],
    ["crm_activities", "owner_user_id"],
    ["crm_activities", "outcome"],
    ["crm_tasks", "assignee_user_id"],
    ["crm_timeline_events", "touchpoint_type"]
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
    assert.equal(row?.column_name, columnName, `${tableName}.${columnName} should exist after Phase 7 migration.`);
  }
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
  assert.equal(adminUser.status, "active");

  const requiredPermissions = await queryOne(
    client,
    `
      SELECT COUNT(*)::int AS count
      FROM permissions
      WHERE deleted_at IS NULL
        AND code = ANY($1::text[])
    `,
    [[
      "leads.view",
      "accounts.view",
      "contacts.view",
      "opportunities.view",
      "support.view",
      "customer_success.view"
    ]]
  );
  assert.equal(requiredPermissions.count, 6, "Shared productivity permission modules should be seeded.");

  return {
    tenantId: tenant.id,
    adminUserId: adminUser.id
  };
}

async function assertAuthAuditLog(client, { tenantId, actorUserId, sessionId, email }) {
  const row = await queryOne(
    client,
    `
      SELECT event_type, action, resource_type, metadata
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

async function assertAuditLog(client, { tenantId, actorUserId, sessionId, action, resourceType, resourceId }) {
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
        AND status = 'success'
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [tenantId, actorUserId, sessionId, action, resourceType, resourceId]
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
    [tenantId, roleSlug, roleName, `${roleName} for phase 7 testing`, runToken]
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

async function assertNoteState(
  client,
  noteId,
  { tenantId, entityType, entityId, actorUserId, body, isCustomerFacing }
) {
  const row = await queryOne(
    client,
    `
      SELECT tenant_id, entity_type, entity_id, author_user_id, body, is_customer_facing, metadata, created_by, updated_by, deleted_at
      FROM crm_notes
      WHERE id = $1
      LIMIT 1
    `,
    [noteId]
  );

  assert.ok(row, `crm_notes row ${noteId} should exist.`);
  assert.equal(row.tenant_id, tenantId);
  assert.equal(row.entity_type, entityType);
  assert.equal(row.entity_id, entityId);
  assert.equal(row.author_user_id, actorUserId);
  assert.equal(row.body, body);
  assert.equal(row.is_customer_facing, isCustomerFacing);
  assert.equal(row.created_by, actorUserId);
  assert.equal(row.updated_by, actorUserId);
  assert.equal(row.deleted_at, null);
  assert.equal(row.metadata.runToken, runToken);
}

async function assertActivityState(
  client,
  activityId,
  { tenantId, entityType, entityId, actorUserId, ownerUserId, subject, notes, outcome }
) {
  const row = await queryOne(
    client,
    `
      SELECT tenant_id, entity_type, entity_id, owner_user_id, author_user_id, subject, description, outcome, metadata, deleted_at
      FROM crm_activities
      WHERE id = $1
      LIMIT 1
    `,
    [activityId]
  );

  assert.ok(row, `crm_activities row ${activityId} should exist.`);
  assert.equal(row.tenant_id, tenantId);
  assert.equal(row.entity_type, entityType);
  assert.equal(row.entity_id, entityId);
  assert.equal(row.owner_user_id, ownerUserId);
  assert.equal(row.author_user_id, actorUserId);
  assert.equal(row.subject, subject);
  assert.equal(row.description, notes);
  assert.equal(row.outcome, outcome);
  assert.equal(row.deleted_at, null);
  assert.equal(row.metadata.runToken, runToken);
}

async function assertTaskState(
  client,
  taskId,
  { tenantId, entityType, entityId, actorUserId, ownerUserId, assigneeUserId, title, priority, status }
) {
  const row = await queryOne(
    client,
    `
      SELECT tenant_id, entity_type, entity_id, owner_user_id, assignee_user_id, title, priority, status, metadata, created_by, updated_by, deleted_at
      FROM crm_tasks
      WHERE id = $1
      LIMIT 1
    `,
    [taskId]
  );

  assert.ok(row, `crm_tasks row ${taskId} should exist.`);
  assert.equal(row.tenant_id, tenantId);
  assert.equal(row.entity_type, entityType);
  assert.equal(row.entity_id, entityId);
  assert.equal(row.owner_user_id, ownerUserId);
  assert.equal(row.assignee_user_id, assigneeUserId);
  assert.equal(row.title, title);
  assert.equal(row.priority, priority);
  assert.equal(row.status, status);
  assert.equal(row.created_by, actorUserId);
  assert.equal(row.deleted_at, null);
  assert.equal(row.metadata.runToken, runToken);
}

function assertTimelineSortedDescending(items) {
  for (let index = 1; index < items.length; index += 1) {
    const previousTime = new Date(items[index - 1].occurredAt).getTime();
    const currentTime = new Date(items[index].occurredAt).getTime();
    assert.ok(previousTime >= currentTime, "Timeline items should be sorted in descending chronological order.");
  }
}

async function exerciseEntityProductivity({
  accessToken,
  client,
  tenantId,
  actorUserId,
  sessionId,
  entityType,
  entityId,
  resourceType,
  createNotePath,
  createActivityPath,
  detailPath,
  detailKey,
  ownerUserId,
  assigneeUserId
}) {
  const noteInitialCustomerFacing = entityType !== "account";
  const noteCreate = await request(createNotePath, {
    method: "POST",
    accessToken,
    expectedStatus: 201,
    body: {
      body: `${resourceType} note ${runToken}`,
      isCustomerFacing: noteInitialCustomerFacing,
      metadata: {
        runToken,
        source: createNotePath.startsWith("/records") ? "generic" : "compatibility-route"
      }
    }
  });
  assert.equal(noteCreate.note.isCustomerFacing, noteInitialCustomerFacing);
  assert.equal(noteCreate.note.isInternal, !noteInitialCustomerFacing);

  const noteUpdate = await request(`/records/${entityType}/${entityId}/notes/${noteCreate.note.id}`, {
    method: "PATCH",
    accessToken,
    expectedStatus: 200,
    body: {
      body: `${resourceType} note updated ${runToken}`,
      isCustomerFacing: !noteInitialCustomerFacing,
      metadata: {
        runToken,
        updated: true
      }
    }
  });
  assert.equal(noteUpdate.note.body, `${resourceType} note updated ${runToken}`);
  assert.equal(noteUpdate.note.isCustomerFacing, !noteInitialCustomerFacing);

  const activityOccurredAt = new Date("2026-06-16T11:30:00.000Z").toISOString();
  const activityCreate = await request(createActivityPath, {
    method: "POST",
    accessToken,
    expectedStatus: 201,
    body: {
      activityType: entityType === "lead" ? "email" : entityType === "account" ? "meeting" : "call",
      subject: `${resourceType} activity ${runToken}`,
      outcome: `${resourceType} outcome ${runToken}`,
      notes: `${resourceType} activity notes ${runToken}`,
      ownerId: ownerUserId,
      occurredAt: activityOccurredAt,
      metadata: {
        runToken,
        route: createActivityPath
      }
    }
  });
  assert.equal(activityCreate.activity.subject, `${resourceType} activity ${runToken}`);
  assert.equal(activityCreate.activity.outcome, `${resourceType} outcome ${runToken}`);
  assert.equal(activityCreate.activity.notes, `${resourceType} activity notes ${runToken}`);
  assert.equal(activityCreate.activity.owner?.id, ownerUserId);
  assert.equal(activityCreate.activity.relatedRecord.entityType, entityType);
  assert.equal(activityCreate.activity.relatedRecord.entityId, entityId);

  const taskCreate = await request(`/records/${entityType}/${entityId}/tasks`, {
    method: "POST",
    accessToken,
    expectedStatus: 201,
    body: {
      title: `${resourceType} task ${runToken}`,
      description: `${resourceType} task description ${runToken}`,
      dueAt: new Date("2026-06-18T09:00:00.000Z").toISOString(),
      reminderAt: new Date("2026-06-17T09:00:00.000Z").toISOString(),
      priority: "high",
      status: "open",
      ownerId: actorUserId,
      assigneeId: assigneeUserId,
      metadata: {
        runToken,
        resourceType
      }
    }
  });
  assert.equal(taskCreate.task.status, "open");
  assert.equal(taskCreate.task.priority, "high");
  assert.equal(taskCreate.task.relatedRecord.entityType, entityType);
  assert.equal(taskCreate.task.relatedRecord.entityId, entityId);

  const taskListBeforeUpdate = await request(`/records/${entityType}/${entityId}/tasks`, {
    accessToken,
    expectedStatus: 200
  });
  assert.ok(taskListBeforeUpdate.tasks.some((task) => task.id === taskCreate.task.id));

  const taskUpdate = await request(`/records/${entityType}/${entityId}/tasks/${taskCreate.task.id}`, {
    method: "PATCH",
    accessToken,
    expectedStatus: 200,
    body: {
      status: "completed",
      priority: "urgent",
      assigneeId: ownerUserId,
      metadata: {
        runToken,
        updated: true
      }
    }
  });
  assert.equal(taskUpdate.task.status, "completed");
  assert.equal(taskUpdate.task.priority, "urgent");
  assert.equal(taskUpdate.task.assignee?.id, ownerUserId);

  const detailPayload = await request(detailPath, {
    accessToken,
    expectedStatus: 200
  });
  const detailRecord = detailPayload[detailKey];
  assert.ok(detailRecord.notes.some((note) => note.id === noteUpdate.note.id));
  assert.ok(detailRecord.activities.some((activity) => activity.id === activityCreate.activity.id));
  assert.ok(detailRecord.tasks.some((task) => task.id === taskCreate.task.id));
  assert.ok(detailRecord.timeline.some((item) => item.id === noteUpdate.note.id && item.kind === "note"));
  assert.ok(detailRecord.timeline.some((item) => item.id === activityCreate.activity.id && item.kind === "activity"));
  assert.ok(detailRecord.timeline.some((item) => item.id === taskCreate.task.id && item.kind === "task"));

  const timelineAll = await request(`/records/${entityType}/${entityId}/timeline`, {
    accessToken,
    expectedStatus: 200
  });
  assert.equal(timelineAll.activeTouchpointType, "all");
  assert.ok(timelineAll.availableTouchpointTypes.includes("note"));
  assert.ok(timelineAll.availableTouchpointTypes.includes("activity"));
  assert.ok(timelineAll.availableTouchpointTypes.includes("task"));
  assert.ok(timelineAll.items.some((item) => item.id === noteUpdate.note.id));
  assert.ok(timelineAll.items.some((item) => item.id === activityCreate.activity.id));
  assert.ok(timelineAll.items.some((item) => item.id === taskCreate.task.id));
  assertTimelineSortedDescending(timelineAll.items);

  const timelineTaskOnly = await request(`/records/${entityType}/${entityId}/timeline${buildQueryString({ kind: "task" })}`, {
    accessToken,
    expectedStatus: 200
  });
  assert.equal(timelineTaskOnly.activeTouchpointType, "task");
  assert.ok(timelineTaskOnly.items.every((item) => item.kind === "task"));
  assert.equal(timelineTaskOnly.items[0]?.id, taskCreate.task.id);

  const timelineNoteOnly = await request(`/records/${entityType}/${entityId}/timeline${buildQueryString({ kind: "note" })}`, {
    accessToken,
    expectedStatus: 200
  });
  assert.equal(timelineNoteOnly.activeTouchpointType, "note");
  assert.ok(timelineNoteOnly.items.every((item) => item.kind === "note"));
  assert.ok(timelineNoteOnly.items.some((item) => item.id === noteUpdate.note.id));

  const timelineActivityOnly = await request(
    `/records/${entityType}/${entityId}/timeline${buildQueryString({ kind: "activity" })}`,
    {
      accessToken,
      expectedStatus: 200
    }
  );
  assert.equal(timelineActivityOnly.activeTouchpointType, "activity");
  assert.ok(timelineActivityOnly.items.every((item) => item.kind === "activity"));
  assert.ok(timelineActivityOnly.items.some((item) => item.id === activityCreate.activity.id));

  await assertNoteState(client, noteCreate.note.id, {
    tenantId,
    entityType,
    entityId,
    actorUserId,
    body: `${resourceType} note updated ${runToken}`,
    isCustomerFacing: !noteInitialCustomerFacing
  });
  await assertActivityState(client, activityCreate.activity.id, {
    tenantId,
    entityType,
    entityId,
    actorUserId,
    ownerUserId,
    subject: `${resourceType} activity ${runToken}`,
    notes: `${resourceType} activity notes ${runToken}`,
    outcome: `${resourceType} outcome ${runToken}`
  });
  await assertTaskState(client, taskCreate.task.id, {
    tenantId,
    entityType,
    entityId,
    actorUserId,
    ownerUserId: actorUserId,
    assigneeUserId: ownerUserId,
    title: `${resourceType} task ${runToken}`,
    priority: "urgent",
    status: "completed"
  });

  for (const action of [
    `${resourceType}.note.create`,
    `${resourceType}.note.edit`,
    `${resourceType}.activity.create`,
    `${resourceType}.task.create`,
    `${resourceType}.task.update`
  ]) {
    await assertAuditLog(client, {
      tenantId,
      actorUserId,
      sessionId,
      action,
      resourceType,
      resourceId: entityId
    });
  }

  return {
    noteId: noteCreate.note.id,
    activityId: activityCreate.activity.id,
    taskId: taskCreate.task.id
  };
}

async function main() {
  log("Connecting to PostgreSQL.");
  const client = new Client({
    connectionString: databaseUrl
  });
  await client.connect();

  try {
    log("Checking Phase 7 schema foundation and seeded permission coverage.");
    await assertSchemaFoundation(client);
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

    log("Loading option endpoints and validating shared productivity request guards.");
    await request("/leads/options", { accessToken: adminAccessToken, expectedStatus: 200 });
    await request("/accounts/options", { accessToken: adminAccessToken, expectedStatus: 200 });
    await request("/contacts/options", { accessToken: adminAccessToken, expectedStatus: 200 });
    await expectError("/records/lead/not-a-uuid/timeline", {
      accessToken: adminAccessToken,
      expectedStatus: 400,
      expectedCode: "VALIDATION_ERROR"
    });
    await expectError("/records/lead/00000000-0000-0000-0000-000000000000/timeline", {
      accessToken: adminAccessToken,
      expectedStatus: 404,
      expectedCode: "LEAD_NOT_FOUND"
    });

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

    log("Creating core lead, account, and contact records for shared productivity checks.");
    const accountCreate = await request("/accounts", {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        name: `Productivity Account ${runToken}`,
        website: `https://account-${runToken}.example.test`,
        industry: "Software",
        accountTypeKey: "prospect",
        healthStatusKey: "healthy",
        ownerId: adminUserId,
        metadata: {
          runToken,
          phase: "phase7"
        }
      }
    });
    const accountId = accountCreate.account.id;

    const contactCreate = await request("/contacts", {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        firstName: "Taylor",
        lastName: `Productivity-${runToken}`,
        email: `contact-${runToken}@example.test`,
        phone: "+1-415-555-0111",
        linkedinUrl: `https://linkedin.com/in/contact-${runToken}`,
        roleKey: "decision_maker",
        ownerId: adminUserId,
        accountId,
        metadata: {
          runToken,
          phase: "phase7"
        }
      }
    });
    const contactId = contactCreate.contact.id;

    const leadCreate = await request("/leads", {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        firstName: "Jordan",
        lastName: `Productivity-${runToken}`,
        companyName: `Productivity Lead ${runToken}`,
        email: `lead-${runToken}@example.test`,
        phone: "+1-415-555-0222",
        statusKey: "new",
        sourceKey: "website",
        score: 64,
        ownerId: adminUserId,
        metadata: {
          runToken,
          phase: "phase7"
        }
      }
    });
    const leadId = leadCreate.lead.id;

    log("Exercising notes, activities, tasks, and timeline on lead, account, and contact records.");
    const leadArtifacts = await exerciseEntityProductivity({
      accessToken: adminAccessToken,
      client,
      tenantId: adminTenantId,
      actorUserId: adminUserId,
      sessionId: adminSessionId,
      entityType: "lead",
      entityId: leadId,
      resourceType: "lead",
      createNotePath: `/leads/${leadId}/notes`,
      createActivityPath: `/leads/${leadId}/activities`,
      detailPath: `/leads/${leadId}`,
      detailKey: "lead",
      ownerUserId: transferUser.userId,
      assigneeUserId: transferUser.userId
    });

    const accountArtifacts = await exerciseEntityProductivity({
      accessToken: adminAccessToken,
      client,
      tenantId: adminTenantId,
      actorUserId: adminUserId,
      sessionId: adminSessionId,
      entityType: "account",
      entityId: accountId,
      resourceType: "account",
      createNotePath: `/records/account/${accountId}/notes`,
      createActivityPath: `/records/account/${accountId}/activities`,
      detailPath: `/accounts/${accountId}`,
      detailKey: "account",
      ownerUserId: transferUser.userId,
      assigneeUserId: transferUser.userId
    });

    const contactArtifacts = await exerciseEntityProductivity({
      accessToken: adminAccessToken,
      client,
      tenantId: adminTenantId,
      actorUserId: adminUserId,
      sessionId: adminSessionId,
      entityType: "contact",
      entityId: contactId,
      resourceType: "contact",
      createNotePath: `/records/contact/${contactId}/notes`,
      createActivityPath: `/records/contact/${contactId}/activities`,
      detailPath: `/contacts/${contactId}`,
      detailKey: "contact",
      ownerUserId: transferUser.userId,
      assigneeUserId: transferUser.userId
    });

    log("Checking legacy account/contact compatibility endpoints and generic lead endpoints.");
    const genericLeadNote = await request(`/records/lead/${leadId}/notes`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        body: `Generic lead note ${runToken}`,
        isCustomerFacing: false,
        metadata: {
          runToken,
          route: "generic-lead-note"
        }
      }
    });
    const genericLeadActivity = await request(`/records/lead/${leadId}/activities`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        activityType: "chat",
        subject: `Generic lead activity ${runToken}`,
        outcome: `Generic lead outcome ${runToken}`,
        notes: `Generic lead notes ${runToken}`,
        ownerId: adminUserId,
        metadata: {
          runToken,
          route: "generic-lead-activity"
        }
      }
    });
    const legacyAccountNote = await request(`/accounts/${accountId}/notes`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        body: `Legacy account note ${runToken}`,
        isCustomerFacing: true,
        metadata: {
          runToken,
          route: "legacy-account-note"
        }
      }
    });
    const legacyAccountActivity = await request(`/accounts/${accountId}/activities`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        activityType: "support",
        subject: `Legacy account activity ${runToken}`,
        outcome: `Legacy account outcome ${runToken}`,
        notes: `Legacy account notes ${runToken}`,
        ownerId: adminUserId,
        metadata: {
          runToken,
          route: "legacy-account-activity"
        }
      }
    });
    const legacyContactNote = await request(`/contacts/${contactId}/notes`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        body: `Legacy contact note ${runToken}`,
        isCustomerFacing: false,
        metadata: {
          runToken,
          route: "legacy-contact-note"
        }
      }
    });
    const legacyContactActivity = await request(`/contacts/${contactId}/activities`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        activityType: "social",
        subject: `Legacy contact activity ${runToken}`,
        outcome: `Legacy contact outcome ${runToken}`,
        notes: `Legacy contact notes ${runToken}`,
        ownerId: adminUserId,
        metadata: {
          runToken,
          route: "legacy-contact-activity"
        }
      }
    });
    assert.equal(genericLeadNote.note.body, `Generic lead note ${runToken}`);
    assert.equal(genericLeadActivity.activity.subject, `Generic lead activity ${runToken}`);
    assert.equal(legacyAccountNote.note.body, `Legacy account note ${runToken}`);
    assert.equal(legacyAccountActivity.activity.subject, `Legacy account activity ${runToken}`);
    assert.equal(legacyContactNote.note.body, `Legacy contact note ${runToken}`);
    assert.equal(legacyContactActivity.activity.subject, `Legacy contact activity ${runToken}`);

    log("Exercising shared record support for real opportunities and future-facing ticket and customer-success-account entity types.");
    const opportunityRecord = await request("/opportunities", {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        name: `Opportunity foundation ${runToken}`,
        ownerId: adminUserId,
        stageKey: "discovery",
        sourceKey: "inbound",
        metadata: {
          runToken
        }
      }
    });
    const opportunityId = opportunityRecord.opportunity.id;
    const opportunityNote = await request(`/records/opportunity/${opportunityId}/notes`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        body: `Opportunity note ${runToken}`,
        isCustomerFacing: true,
        metadata: {
          runToken
        }
      }
    });
    const opportunityActivity = await request(`/records/opportunity/${opportunityId}/activities`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        activityType: "demo",
        subject: `Opportunity demo ${runToken}`,
        outcome: `Opportunity advanced ${runToken}`,
        notes: `Opportunity foundation activity ${runToken}`,
        ownerId: adminUserId,
        occurredAt: new Date("2026-06-16T12:00:00.000Z").toISOString(),
        metadata: {
          runToken
        }
      }
    });
    const opportunityTask = await request(`/records/opportunity/${opportunityId}/tasks`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        title: `Opportunity task ${runToken}`,
        status: "open",
        priority: "medium",
        ownerId: adminUserId,
        assigneeId: transferUser.userId,
        metadata: {
          runToken
        }
      }
    });
    assert.equal(opportunityActivity.activity.relatedRecord.entityType, "opportunity");
    const opportunityTimeline = await request(`/records/opportunity/${opportunityId}/timeline`, {
      accessToken: adminAccessToken,
      expectedStatus: 200
    });
    assert.ok(opportunityTimeline.items.some((item) => item.id === opportunityNote.note.id && item.kind === "note"));
    assert.ok(opportunityTimeline.items.some((item) => item.id === opportunityActivity.activity.id && item.kind === "activity"));
    assert.ok(opportunityTimeline.items.some((item) => item.id === opportunityTask.task.id && item.kind === "task"));

    const ticketId = randomUUID();
    const ticketNote = await request(`/records/ticket/${ticketId}/notes`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        body: `Ticket note ${runToken}`,
        isCustomerFacing: false,
        metadata: {
          runToken
        }
      }
    });
    const ticketActivity = await request(`/records/ticket/${ticketId}/activities`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        activityType: "support",
        subject: `Ticket activity ${runToken}`,
        outcome: `Ticket outcome ${runToken}`,
        notes: `Ticket notes ${runToken}`,
        ownerId: adminUserId,
        metadata: {
          runToken
        }
      }
    });
    const ticketTask = await request(`/records/ticket/${ticketId}/tasks`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        title: `Ticket task ${runToken}`,
        status: "open",
        priority: "high",
        ownerId: adminUserId,
        assigneeId: transferUser.userId,
        metadata: {
          runToken
        }
      }
    });
    const ticketTimeline = await request(`/records/ticket/${ticketId}/timeline`, {
      accessToken: adminAccessToken,
      expectedStatus: 200
    });
    assert.ok(ticketTimeline.items.some((item) => item.id === ticketNote.note.id && item.kind === "note"));
    assert.ok(ticketTimeline.items.some((item) => item.id === ticketActivity.activity.id && item.kind === "activity"));
    assert.ok(ticketTimeline.items.some((item) => item.id === ticketTask.task.id && item.kind === "task"));

    const customerSuccessAccountId = randomUUID();
    const customerSuccessNote = await request(`/records/customer_success_account/${customerSuccessAccountId}/notes`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        body: `Customer success note ${runToken}`,
        isCustomerFacing: true,
        metadata: {
          runToken
        }
      }
    });
    const customerSuccessActivity = await request(
      `/records/customer_success_account/${customerSuccessAccountId}/activities`,
      {
        method: "POST",
        accessToken: adminAccessToken,
        expectedStatus: 201,
        body: {
          activityType: "training",
          subject: `Customer success training ${runToken}`,
          outcome: `Customer success milestone ${runToken}`,
          notes: `Customer success foundation activity ${runToken}`,
          ownerId: adminUserId,
          occurredAt: new Date("2026-06-16T12:15:00.000Z").toISOString(),
          metadata: {
            runToken
          }
        }
      }
    );
    const customerSuccessTask = await request(`/records/customer_success_account/${customerSuccessAccountId}/tasks`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 201,
      body: {
        title: `Customer success task ${runToken}`,
        status: "open",
        priority: "medium",
        ownerId: adminUserId,
        assigneeId: transferUser.userId,
        metadata: {
          runToken
        }
      }
    });
    const customerSuccessTimeline = await request(
      `/records/customer_success_account/${customerSuccessAccountId}/timeline`,
      {
        accessToken: adminAccessToken,
        expectedStatus: 200
      }
    );
    assert.ok(customerSuccessTimeline.items.some((item) => item.id === customerSuccessNote.note.id && item.kind === "note"));
    assert.ok(customerSuccessTimeline.items.some((item) => item.id === customerSuccessActivity.activity.id));
    assert.ok(customerSuccessTimeline.items.some((item) => item.id === customerSuccessTask.task.id && item.kind === "task"));

    log("Verifying permission middleware and assign-only task update rules.");
    const limitedPassword = `Limit!${runToken}`;
    const limitedUser = await createUserWithPermissions(client, {
      tenantId: adminTenantId,
      email: `limited-${runToken}@example.test`,
      password: limitedPassword,
      firstName: "Limited",
      lastName: "Viewer",
      roleName: `Limited Viewer ${runToken}`,
      roleSlug: `limited-viewer-${runToken}`,
      permissionCodes: ["leads.view", "accounts.view", "contacts.view"]
    });
    const limitedSession = await loginSession(defaultTenantSlug, `limited-${runToken}@example.test`, limitedPassword);
    await assertAuthAuditLog(client, {
      tenantId: adminTenantId,
      actorUserId: limitedUser.userId,
      sessionId: limitedSession.session.id,
      email: `limited-${runToken}@example.test`
    });
    await request(`/records/lead/${leadId}/timeline`, {
      accessToken: limitedSession.accessToken,
      expectedStatus: 200
    });
    for (const [path, method] of [
      [`/records/lead/${leadId}/notes`, "POST"],
      [`/records/lead/${leadId}/activities`, "POST"],
      [`/records/lead/${leadId}/tasks`, "POST"],
      [`/records/lead/${leadId}/notes/${leadArtifacts.noteId}`, "PATCH"],
      [`/records/lead/${leadId}/tasks/${leadArtifacts.taskId}`, "PATCH"]
    ]) {
      await expectError(path, {
        method,
        accessToken: limitedSession.accessToken,
        expectedStatus: 403,
        expectedCode: "FORBIDDEN",
        body:
          method === "POST"
            ? path.includes("/activities")
              ? { activityType: "call", subject: "blocked" }
              : path.includes("/tasks")
                ? { title: "blocked task" }
                : { body: "blocked note" }
            : path.includes("/tasks/")
              ? { status: "in_progress" }
              : { body: "blocked update" }
      });
    }

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

    const assignTaskUpdate = await request(`/records/lead/${leadId}/tasks/${leadArtifacts.taskId}`, {
      method: "PATCH",
      accessToken: assignSession.accessToken,
      expectedStatus: 200,
      body: {
        status: "in_progress",
        assigneeId: assignUser.userId
      }
    });
    assert.equal(assignTaskUpdate.task.status, "in_progress");
    assert.equal(assignTaskUpdate.task.assignee?.id, assignUser.userId);
    await assertAuditLog(client, {
      tenantId: adminTenantId,
      actorUserId: assignUser.userId,
      sessionId: assignSession.session.id,
      action: "lead.task.update",
      resourceType: "lead",
      resourceId: leadId
    });

    await expectError(`/records/lead/${leadId}/tasks/${leadArtifacts.taskId}`, {
      method: "PATCH",
      accessToken: assignSession.accessToken,
      expectedStatus: 403,
      expectedCode: "AUTHORIZATION_ERROR",
      body: {
        title: `Blocked task update ${runToken}`
      }
    });

    log("Verifying tenant isolation for shared productivity routes.");
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
        "leads.assign",
        "accounts.view",
        "accounts.create",
        "accounts.edit",
        "accounts.assign",
        "contacts.view",
        "contacts.create",
        "contacts.edit",
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

    const secondTenantLead = await request("/leads", {
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

    await request(`/records/lead/${secondTenantLead.lead.id}/timeline`, {
      accessToken: adminAccessToken,
      expectedStatus: 404
    });
    await request(`/records/lead/${leadId}/timeline`, {
      accessToken: secondTenantSession.accessToken,
      expectedStatus: 404
    });
    await expectError(`/records/lead/${leadId}/tasks`, {
      method: "POST",
      accessToken: adminAccessToken,
      expectedStatus: 400,
      expectedCode: "INVALID_OWNER",
      body: {
        title: `Cross tenant task ${runToken}`,
        ownerId: secondTenantUser.userId
      }
    });

    log("Verifying invalid shared productivity mutations.");
    await expectError(`/records/account/${accountId}/notes/${accountArtifacts.noteId}`, {
      method: "PATCH",
      accessToken: adminAccessToken,
      expectedStatus: 400,
      expectedCode: "VALIDATION_ERROR",
      body: {}
    });
    await expectError(`/records/contact/${contactId}/tasks/${contactArtifacts.taskId}`, {
      method: "PATCH",
      accessToken: adminAccessToken,
      expectedStatus: 400,
      expectedCode: "VALIDATION_ERROR",
      body: {}
    });

    log(`Phase 7 exhaustive test completed successfully for run ${runToken}.`);
    console.log(
      JSON.stringify(
        {
          runToken,
          createdIds: {
            leadId,
            accountId,
            contactId,
            leadTaskId: leadArtifacts.taskId,
            accountTaskId: accountArtifacts.taskId,
            contactTaskId: contactArtifacts.taskId,
            opportunityActivityId: opportunityActivity.activity.id,
            customerSuccessActivityId: customerSuccessActivity.activity.id
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
