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

const workspaceOptionSetKeys = [
  "lead-status",
  "lead-source",
  "lead-outreach-status",
  "lead-handoff-status",
  "lead-call-disposition"
];

function log(message) {
  console.log(`[phase11-exhaustive] ${message}`);
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
  const leadColumn = await queryOne(
    client,
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'leads'
        AND column_name = 'metadata'
      LIMIT 1
    `
  );
  assert.equal(leadColumn?.column_name, "metadata", "leads.metadata should exist for workspace state.");

  const taskTable = await queryOne(
    client,
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'crm_tasks'
      LIMIT 1
    `
  );
  assert.equal(taskTable?.table_name, "crm_tasks", "crm_tasks should exist for queue work.");
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

  const optionSetCount = await queryOne(
    client,
    `
      SELECT COUNT(*)::int AS count
      FROM tenant_option_sets
      WHERE tenant_id = $1
        AND deleted_at IS NULL
        AND set_key = ANY($2::text[])
    `,
    [tenant.id, workspaceOptionSetKeys]
  );
  assert.equal(optionSetCount.count, workspaceOptionSetKeys.length, "Phase 11 option sets should be seeded.");

  const callDisposition = await queryOne(
    client,
    `
      SELECT COUNT(*)::int AS count
      FROM tenant_option_sets
      INNER JOIN tenant_option_values
        ON tenant_option_values.option_set_id = tenant_option_sets.id
       AND tenant_option_values.tenant_id = tenant_option_sets.tenant_id
      WHERE tenant_option_sets.tenant_id = $1
        AND tenant_option_sets.set_key = 'lead-call-disposition'
        AND tenant_option_values.deleted_at IS NULL
        AND tenant_option_values.value_key = ANY($2::text[])
    `,
    [tenant.id, ["connected", "voicemail", "meeting_booked"]]
  );
  assert.equal(callDisposition.count, 3, "Lead call disposition catalog should be seeded.");

  return {
    tenantId: tenant.id,
    adminUserId: adminUser.id
  };
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
    [tenantId, roleSlug, roleName, `${roleName} for phase 11 testing`, runToken]
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

async function createLead(accessToken, payload) {
  const response = await request("/leads", {
    method: "POST",
    accessToken,
    expectedStatus: 201,
    body: payload
  });

  return response.lead;
}

async function createLeadTask(accessToken, leadId, payload) {
  const response = await request(`/records/lead/${leadId}/tasks`, {
    method: "POST",
    accessToken,
    expectedStatus: 201,
    body: payload
  });

  return response.task;
}

async function assertAuditLog(client, { tenantId, actorUserId, sessionId, action, resourceType, resourceId }) {
  const row = await queryOne(
    client,
    `
      SELECT action, resource_type, resource_id, status
      FROM audit_logs
      WHERE tenant_id = $1
        AND actor_user_id = $2
        AND session_id = $3
        AND action = $4
        AND resource_type = $5
        AND resource_id = $6
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [tenantId, actorUserId, sessionId, action, resourceType, resourceId]
  );

  assert.ok(row, `Audit log ${action} should exist for ${resourceType} ${resourceId}.`);
  assert.equal(row.status, "success");
}

async function assertLeadWorkspaceState(client, leadId, expected) {
  const row = await queryOne(
    client,
    `
      SELECT metadata->'salesWorkspace' AS sales_workspace
      FROM leads
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
    `,
    [leadId]
  );

  assert.ok(row?.sales_workspace, "Lead should store a salesWorkspace metadata envelope.");
  assert.equal(row.sales_workspace.outreachStatusKey, expected.outreachStatusKey);
  assert.equal(row.sales_workspace.handoffStatusKey, expected.handoffStatusKey);
  assert.equal(row.sales_workspace.callDispositionKey, expected.callDispositionKey);
  assert.equal(row.sales_workspace.qualificationFramework, expected.qualificationFramework);
  assert.equal(row.sales_workspace.qualificationChecklist.budget, expected.qualificationChecklist.budget);
  assert.equal(row.sales_workspace.qualificationChecklist.authority, expected.qualificationChecklist.authority);
  assert.equal(row.sales_workspace.qualificationChecklist.need, expected.qualificationChecklist.need);
  assert.equal(row.sales_workspace.qualificationChecklist.timeline, expected.qualificationChecklist.timeline);
}

async function assertHandoffActivity(client, { tenantId, leadId, actorUserId, expectedOutcome }) {
  const row = await queryOne(
    client,
    `
      SELECT activity_type, outcome, author_user_id, metadata
      FROM crm_activities
      WHERE tenant_id = $1
        AND entity_type = 'lead'
        AND entity_id = $2
        AND activity_type = 'status_change'
        AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [tenantId, leadId]
  );

  assert.ok(row, "Lead handoff updates should create a status_change activity.");
  assert.equal(row.outcome, expectedOutcome);
  assert.equal(row.author_user_id, actorUserId);
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
        source_set.metadata || jsonb_build_object('clonedFor', $4::text)
      FROM source_set
      RETURNING id
    `,
    [sourceTenantId, setKey, targetTenantId, runToken]
  );
  const targetSetId = setResult.rows[0].id;

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

async function getOptionValueId(client, tenantId, setKey, valueKey) {
  const row = await queryOne(
    client,
    `
      SELECT tenant_option_values.id
      FROM tenant_option_sets
      INNER JOIN tenant_option_values
        ON tenant_option_values.option_set_id = tenant_option_sets.id
       AND tenant_option_values.tenant_id = tenant_option_sets.tenant_id
      WHERE tenant_option_sets.tenant_id = $1
        AND tenant_option_sets.set_key = $2
        AND tenant_option_values.value_key = $3
        AND tenant_option_sets.deleted_at IS NULL
        AND tenant_option_values.deleted_at IS NULL
      LIMIT 1
    `,
    [tenantId, setKey, valueKey]
  );

  return row?.id ?? null;
}

async function main() {
  const client = new Client({
    connectionString: databaseUrl
  });

  await client.connect();

  try {
    log("Checking schema and seed baseline.");
    await assertSchemaFoundation(client);
    const { tenantId } = await assertSeedBaseline(client);

    log("Logging in with the seeded admin user.");
    const adminSession = await loginSession(defaultTenantSlug, defaultAdminEmail, defaultAdminPassword);

    log("Creating SDR, inside-sales, and viewer users with focused permissions.");
    const sdrPassword = `Sdr!${runToken}99`;
    const insidePassword = `Inside!${runToken}99`;
    const viewerPassword = `Viewer!${runToken}99`;

    const sdrUser = await createUserWithPermissions(client, {
      tenantId,
      email: `sdr-${runToken}@example.test`,
      password: sdrPassword,
      firstName: "Sam",
      lastName: "SDR",
      roleName: `SDR Phase11 ${runToken}`,
      roleSlug: `sdr-phase11-${runToken}`,
      permissionCodes: ["leads.view", "leads.create", "leads.edit", "dashboards.view_dashboard", "ai.use_ai"]
    });
    const insideSalesUser = await createUserWithPermissions(client, {
      tenantId,
      email: `inside-sales-${runToken}@example.test`,
      password: insidePassword,
      firstName: "Indy",
      lastName: "Sales",
      roleName: `Inside Sales Phase11 ${runToken}`,
      roleSlug: `inside-sales-phase11-${runToken}`,
      permissionCodes: [
        "leads.view",
        "leads.create",
        "leads.edit",
        "sales.view",
        "dashboards.view_dashboard",
        "ai.use_ai"
      ]
    });
    const viewerUser = await createUserWithPermissions(client, {
      tenantId,
      email: `viewer-${runToken}@example.test`,
      password: viewerPassword,
      firstName: "Val",
      lastName: "Viewer",
      roleName: `Viewer Phase11 ${runToken}`,
      roleSlug: `viewer-phase11-${runToken}`,
      permissionCodes: ["leads.view"]
    });

    log("Creating lead records and workspace-linked tasks through the live API.");
    const sdrLead = await createLead(adminSession.accessToken, {
      firstName: "Alice",
      lastName: "Prospect",
      companyName: `Outbound Labs ${runToken}`,
      email: `alice.${runToken}@example.test`,
      phone: "+1-555-0100",
      statusKey: "new",
      sourceKey: "outbound",
      ownerId: sdrUser.userId,
      metadata: {
        phase11TestRun: runToken
      }
    });
    const insideLead = await createLead(adminSession.accessToken, {
      firstName: "Ben",
      lastName: "Inbound",
      companyName: `Website Works ${runToken}`,
      email: `ben.${runToken}@example.test`,
      phone: "+1-555-0101",
      statusKey: "working",
      sourceKey: "website",
      ownerId: insideSalesUser.userId,
      metadata: {
        phase11TestRun: runToken
      }
    });
    const restrictedLead = await createLead(adminSession.accessToken, {
      firstName: "Cara",
      lastName: "Restricted",
      companyName: `Hidden Pipeline ${runToken}`,
      email: `cara.${runToken}@example.test`,
      phone: "+1-555-0102",
      statusKey: "working",
      sourceKey: "campaign",
      ownerId: adminSession.currentUser.id,
      metadata: {
        phase11TestRun: runToken
      }
    });

    const sdrCallTask = await createLeadTask(adminSession.accessToken, sdrLead.id, {
      title: "Call the outbound prospect",
      description: "Run the SDR discovery script.",
      dueAt: new Date(Date.now() + 86_400_000).toISOString(),
      priority: "high",
      ownerId: sdrUser.userId,
      assigneeId: sdrUser.userId,
      metadata: {
        phase11TaskType: "call",
        phase11TestRun: runToken
      }
    });
    const insideCallTask = await createLeadTask(adminSession.accessToken, insideLead.id, {
      title: "Complete qualification call",
      description: "Capture qualification answers and the call disposition.",
      dueAt: new Date(Date.now() + 172_800_000).toISOString(),
      priority: "medium",
      ownerId: insideSalesUser.userId,
      assigneeId: insideSalesUser.userId,
      metadata: {
        phase11TaskType: "call",
        phase11TestRun: runToken
      }
    });
    const insideFollowUpTask = await createLeadTask(adminSession.accessToken, insideLead.id, {
      title: "Send inside-sales follow-up email",
      description: "Summarize qualification notes and next steps.",
      dueAt: new Date(Date.now() + 259_200_000).toISOString(),
      priority: "medium",
      ownerId: insideSalesUser.userId,
      assigneeId: insideSalesUser.userId,
      metadata: {
        phase11TaskType: "follow_up",
        phase11TestRun: runToken
      }
    });

    log("Logging in as role-specific sales users.");
    const sdrSession = await loginSession(defaultTenantSlug, `sdr-${runToken}@example.test`, sdrPassword);
    const insideSession = await loginSession(
      defaultTenantSlug,
      `inside-sales-${runToken}@example.test`,
      insidePassword
    );
    const viewerSession = await loginSession(defaultTenantSlug, `viewer-${runToken}@example.test`, viewerPassword);

    log("Validating workspace options and permission-sensitive read behavior.");
    const optionsResponse = await request("/sales-workspaces/options", {
      accessToken: sdrSession.accessToken
    });
    assert.ok(optionsResponse.outreachStatuses.some((entry) => entry.key === "attempting_contact"));
    assert.ok(optionsResponse.handoffStatuses.some((entry) => entry.key === "sales_ready"));
    assert.ok(optionsResponse.callDispositions.some((entry) => entry.key === "meeting_booked"));
    assert.equal(
      optionsResponse.qualificationFrameworks.find((entry) => entry.key === "meddic")?.available,
      false,
      "MEDDIC should remain a placeholder in this phase."
    );

    const viewerWorkspace = await request("/sales-workspaces/sdr", {
      accessToken: viewerSession.accessToken
    });
    assert.deepEqual(viewerWorkspace.assignedLeads, [], "A viewer without owned leads should receive an empty assigned queue.");
    assert.equal(viewerWorkspace.aiPlaceholders.actions.length, 0, "AI placeholders should be hidden without AI permissions.");

    await expectError(`/sales-workspaces/leads/${sdrLead.id}/workflow`, {
      method: "PATCH",
      accessToken: viewerSession.accessToken,
      expectedStatus: 403,
      expectedCode: "FORBIDDEN",
      body: {
        statusKey: "qualified"
      }
    });

    log("Validating the SDR workspace queue, AI placeholders, and workflow mutation path.");
    const sdrWorkspace = await request("/sales-workspaces/sdr", {
      accessToken: sdrSession.accessToken
    });
    assert.ok(sdrWorkspace.assignedLeads.some((lead) => lead.id === sdrLead.id), "SDR should see the assigned lead.");
    assert.ok(sdrWorkspace.prospectingQueue.some((lead) => lead.id === sdrLead.id), "SDR prospecting queue should contain the assigned outbound lead.");
    assert.ok(
      sdrWorkspace.callTaskList.some((task) => task.id === sdrCallTask.id),
      "SDR call queue should expose the lead-linked call task."
    );
    assert.ok(
      sdrWorkspace.aiPlaceholders.actions.some((action) => action.key === "call_script_generator"),
      "AI placeholder actions should be visible to SDR roles with AI usage permission."
    );
    assert.ok(
      !sdrWorkspace.assignedLeads.some((lead) => lead.id === restrictedLead.id),
      "SDR should not see leads owned by another user."
    );

    const sdrWorkflowResponse = await request(`/sales-workspaces/leads/${sdrLead.id}/workflow`, {
      method: "PATCH",
      accessToken: sdrSession.accessToken,
      body: {
        statusKey: "qualified",
        outreachStatusKey: "responded",
        handoffStatusKey: "sales_ready",
        callDispositionKey: "connected",
        qualificationFramework: "bant",
        qualificationChecklist: {
          budget: true,
          authority: true,
          need: true,
          timeline: false
        },
        qualificationNotes: "Discovery complete and budget validated.",
        customQualificationFields: [
          {
            label: "Region",
            value: "North America"
          }
        ]
      }
    });
    assert.equal(sdrWorkflowResponse.lead.status?.key, "qualified");
    assert.equal(sdrWorkflowResponse.lead.workspace.handoffStatus?.key, "sales_ready");
    assert.equal(sdrWorkflowResponse.lead.workspace.callDisposition?.key, "connected");
    assert.equal(sdrWorkflowResponse.lead.workspace.qualificationChecklistCompletionCount, 3);
    assert.equal(sdrWorkflowResponse.lead.workspace.customQualificationFields.length, 1);

    await assertLeadWorkspaceState(client, sdrLead.id, {
      outreachStatusKey: "responded",
      handoffStatusKey: "sales_ready",
      callDispositionKey: "connected",
      qualificationFramework: "bant",
      qualificationChecklist: {
        budget: true,
        authority: true,
        need: true,
        timeline: false
      }
    });
    await assertAuditLog(client, {
      tenantId,
      actorUserId: sdrSession.currentUser.id,
      sessionId: sdrSession.session.id,
      action: "lead.workspace.update",
      resourceType: "lead",
      resourceId: sdrLead.id
    });
    await assertAuditLog(client, {
      tenantId,
      actorUserId: sdrSession.currentUser.id,
      sessionId: sdrSession.session.id,
      action: "lead.handoff.update",
      resourceType: "lead",
      resourceId: sdrLead.id
    });
    await assertHandoffActivity(client, {
      tenantId,
      leadId: sdrLead.id,
      actorUserId: sdrSession.currentUser.id,
      expectedOutcome: "Sales Ready"
    });

    await expectError(`/sales-workspaces/leads/${sdrLead.id}/workflow`, {
      method: "PATCH",
      accessToken: sdrSession.accessToken,
      expectedStatus: 403,
      expectedCode: "AUTHORIZATION_ERROR",
      body: {
        ownerId: insideSalesUser.userId
      }
    });
    await expectError(`/sales-workspaces/leads/${restrictedLead.id}/workflow`, {
      method: "PATCH",
      accessToken: sdrSession.accessToken,
      expectedStatus: 404,
      expectedCode: "LEAD_NOT_FOUND",
      body: {
        statusKey: "working"
      }
    });

    log("Validating the inside-sales workspace queue, call disposition tracking, and follow-up tasks.");
    const insideWorkspace = await request("/sales-workspaces/inside-sales", {
      accessToken: insideSession.accessToken
    });
    assert.ok(insideWorkspace.leadQueue.some((lead) => lead.id === insideLead.id), "Inside sales should see the assigned lead queue.");
    assert.ok(insideWorkspace.callQueue.some((task) => task.id === insideCallTask.id), "Call queue should expose call tasks.");
    assert.ok(
      insideWorkspace.followUpTasks.some((task) => task.id === insideFollowUpTask.id),
      "Follow-up tasks should remain visible in the inside-sales queue."
    );

    const insideWorkflowResponse = await request(`/sales-workspaces/leads/${insideLead.id}/workflow`, {
      method: "PATCH",
      accessToken: insideSession.accessToken,
      body: {
        statusKey: "qualified",
        outreachStatusKey: "meeting_booked",
        handoffStatusKey: "handed_to_sales",
        callDispositionKey: "meeting_booked",
        qualificationFramework: "custom",
        qualificationChecklist: {
          budget: true,
          authority: true,
          need: true,
          timeline: true
        },
        qualificationNotes: "Meeting booked and handed to field sales.",
        customQualificationFields: [
          {
            label: "Deal urgency",
            value: "Immediate"
          },
          {
            label: "Decision group",
            value: "Economic buyer identified"
          }
        ]
      }
    });
    assert.equal(insideWorkflowResponse.lead.workspace.qualificationFramework, "custom");
    assert.equal(insideWorkflowResponse.lead.workspace.handoffStatus?.key, "handed_to_sales");
    assert.equal(insideWorkflowResponse.lead.workspace.qualificationChecklistCompletionCount, 4);
    assert.equal(insideWorkflowResponse.lead.workspace.customQualificationFields.length, 2);

    await assertLeadWorkspaceState(client, insideLead.id, {
      outreachStatusKey: "meeting_booked",
      handoffStatusKey: "handed_to_sales",
      callDispositionKey: "meeting_booked",
      qualificationFramework: "custom",
      qualificationChecklist: {
        budget: true,
        authority: true,
        need: true,
        timeline: true
      }
    });

    log("Validating owner reassignment and queue movement through the admin path.");
    const reassignedLead = await request(`/sales-workspaces/leads/${sdrLead.id}/workflow`, {
      method: "PATCH",
      accessToken: adminSession.accessToken,
      body: {
        ownerId: insideSalesUser.userId,
        handoffStatusKey: "handed_to_sales"
      }
    });
    assert.equal(reassignedLead.lead.owner?.id, insideSalesUser.userId);
    assert.equal(reassignedLead.lead.workspace.handoffStatus?.key, "handed_to_sales");

    const sdrWorkspaceAfterReassign = await request("/sales-workspaces/sdr", {
      accessToken: sdrSession.accessToken
    });
    assert.ok(
      !sdrWorkspaceAfterReassign.assignedLeads.some((lead) => lead.id === sdrLead.id),
      "Reassigned leads should disappear from the original SDR queue."
    );

    const insideWorkspaceAfterReassign = await request("/sales-workspaces/inside-sales", {
      accessToken: insideSession.accessToken
    });
    assert.ok(
      insideWorkspaceAfterReassign.leadQueue.some((lead) => lead.id === sdrLead.id),
      "Reassigned leads should appear in the inside-sales queue for the new owner."
    );

    log("Checking tenant isolation against a second tenant lead.");
    const secondTenantId = await createTenant(client, `phase11-${runToken}-tenant`, `Phase 11 Tenant ${runToken}`);
    for (const setKey of workspaceOptionSetKeys) {
      await cloneOptionSet(client, tenantId, secondTenantId, setKey);
    }

    const secondTenantStatusId = await getOptionValueId(client, secondTenantId, "lead-status", "new");
    const secondTenantSourceId = await getOptionValueId(client, secondTenantId, "lead-source", "website");
    const secondTenantLeadResult = await client.query(
      `
        INSERT INTO leads (
          tenant_id,
          first_name,
          last_name,
          company_name,
          status_option_id,
          source_option_id,
          metadata
        )
        VALUES ($1, 'Tenant', 'Isolated', $2, $3, $4, jsonb_build_object('testRun', $5::text))
        RETURNING id
      `,
      [secondTenantId, `Second Tenant ${runToken}`, secondTenantStatusId, secondTenantSourceId, runToken]
    );
    const secondTenantLeadId = secondTenantLeadResult.rows[0].id;

    await expectError(`/sales-workspaces/leads/${secondTenantLeadId}/workflow`, {
      method: "PATCH",
      accessToken: adminSession.accessToken,
      expectedStatus: 404,
      expectedCode: "LEAD_NOT_FOUND",
      body: {
        statusKey: "working"
      }
    });

    log("Phase 11 SDR and inside-sales checks passed.");
  } finally {
    await client.end();
  }
}

await main();
