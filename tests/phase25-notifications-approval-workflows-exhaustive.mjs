import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";

const apiBaseUrl = process.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4012/api/v1";
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://crm:crm@localhost:5433/crm";
const defaultTenantSlug = process.env.DEFAULT_TENANT_SLUG ?? "sample-tenant";
const runToken = randomUUID().replace(/-/g, "").slice(0, 10);

const NOTIFICATION_PERMISSION_CODES = [
  "notifications.view",
  "notifications.create",
  "notifications.edit",
  "approvals.view",
  "approvals.create",
  "approvals.edit",
  "approvals.approve",
  "workflows.view",
  "workflows.create",
  "workflows.edit",
  "workflows.configure",
  "workflows.manage_workflow",
  "workflows.approve"
];
const REVIEWER_PERMISSION_CODES = ["notifications.view", "notifications.edit", "approvals.view", "approvals.approve"];
const OUTSIDER_PERMISSION_CODES = ["contacts.view"];

function log(message) {
  console.log(`[phase25-exhaustive] ${message}`);
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
  assert.equal(payload.error.code, expectedCode, `Expected ${expectedCode} from ${options.method ?? "GET"} ${path}.`);
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
  const me = await request("/auth/me", { accessToken, expectedStatus: 200 });
  return {
    accessToken,
    user: me.user,
    session: me.session
  };
}

async function queryOne(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0] ?? null;
}

async function createRole(client, { tenantId, roleSlug, roleName, permissionCodes }) {
  const result = await client.query(
    `
      INSERT INTO roles (tenant_id, slug, name, description, metadata)
      VALUES ($1, $2, $3, $4, jsonb_build_object('testRun', $5::text))
      RETURNING id
    `,
    [tenantId, roleSlug, roleName, `${roleName} for Phase 25 testing`, runToken]
  );
  const roleId = result.rows[0].id;

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

  return roleId;
}

async function createUser(client, { tenantId, email, password, firstName, lastName, roleId }) {
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

  return userId;
}

async function assertAuditExists(client, { tenantId, action, resourceType }) {
  const row = await queryOne(
    client,
    `
      SELECT status
      FROM audit_logs
      WHERE tenant_id = $1
        AND action = $2
        AND resource_type = $3
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [tenantId, action, resourceType]
  );
  assert.ok(row, `Audit log ${action} should exist for ${resourceType}.`);
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    log("Checking root API status and Phase 25 schema.");
    const root = await request("/", { expectedStatus: 200 });
    assert.equal(root.status, "phase-25-operational", "API root should report Phase 25 status.");

    for (const tableName of [
      "notifications",
      "notification_deliveries",
      "notification_preferences",
      "approval_requests",
      "approval_history"
    ]) {
      const table = await queryOne(
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
      assert.equal(table?.table_name, tableName, `${tableName} should exist for Phase 25.`);
    }

    for (const permissionCode of [
      "notifications.view",
      "notifications.edit",
      "approvals.view",
      "approvals.approve"
    ]) {
      const permission = await queryOne(
        client,
        `SELECT code FROM permissions WHERE code = $1 AND deleted_at IS NULL LIMIT 1`,
        [permissionCode]
      );
      assert.equal(permission?.code, permissionCode, `${permissionCode} should exist in the permission catalog.`);
    }

    const tenant = await queryOne(
      client,
      `SELECT id FROM tenants WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`,
      [defaultTenantSlug]
    );
    assert.ok(tenant, "Default tenant should exist.");
    const tenantId = tenant.id;

    log("Creating Phase 25 roles and users.");
    const managerRoleId = await createRole(client, {
      tenantId,
      roleSlug: `phase25-manager-${runToken}`,
      roleName: `Phase 25 Manager ${runToken}`,
      permissionCodes: NOTIFICATION_PERMISSION_CODES
    });
    const reviewerRoleId = await createRole(client, {
      tenantId,
      roleSlug: `phase25-reviewers-${runToken}`,
      roleName: `Phase 25 Reviewers ${runToken}`,
      permissionCodes: REVIEWER_PERMISSION_CODES
    });
    const outsiderRoleId = await createRole(client, {
      tenantId,
      roleSlug: `phase25-outsider-${runToken}`,
      roleName: `Phase 25 Outsider ${runToken}`,
      permissionCodes: OUTSIDER_PERMISSION_CODES
    });

    const managerPassword = `Mgr!${runToken}55`;
    const reviewerOnePassword = `Rev!${runToken}11`;
    const reviewerTwoPassword = `Rev!${runToken}22`;
    const outsiderPassword = `Out!${runToken}99`;

    const managerUserId = await createUser(client, {
      tenantId,
      email: `phase25-manager-${runToken}@example.test`,
      password: managerPassword,
      firstName: "Mina",
      lastName: "Manager",
      roleId: managerRoleId
    });
    const reviewerOneUserId = await createUser(client, {
      tenantId,
      email: `phase25-reviewer1-${runToken}@example.test`,
      password: reviewerOnePassword,
      firstName: "Ravi",
      lastName: "Reviewer",
      roleId: reviewerRoleId
    });
    const reviewerTwoUserId = await createUser(client, {
      tenantId,
      email: `phase25-reviewer2-${runToken}@example.test`,
      password: reviewerTwoPassword,
      firstName: "Rina",
      lastName: "Reviewer",
      roleId: reviewerRoleId
    });
    await createUser(client, {
      tenantId,
      email: `phase25-outsider-${runToken}@example.test`,
      password: outsiderPassword,
      firstName: "Omar",
      lastName: "Outsider",
      roleId: outsiderRoleId
    });

    const managerSession = await loginSession(
      defaultTenantSlug,
      `phase25-manager-${runToken}@example.test`,
      managerPassword
    );
    const reviewerOneSession = await loginSession(
      defaultTenantSlug,
      `phase25-reviewer1-${runToken}@example.test`,
      reviewerOnePassword
    );
    const reviewerTwoSession = await loginSession(
      defaultTenantSlug,
      `phase25-reviewer2-${runToken}@example.test`,
      reviewerTwoPassword
    );
    const outsiderSession = await loginSession(
      defaultTenantSlug,
      `phase25-outsider-${runToken}@example.test`,
      outsiderPassword
    );

    await expectError("/notifications", {
      accessToken: outsiderSession.accessToken,
      expectedStatus: 403,
      expectedCode: "FORBIDDEN"
    });
    await expectError("/approvals", {
      accessToken: outsiderSession.accessToken,
      expectedStatus: 403,
      expectedCode: "FORBIDDEN"
    });

    log("Testing direct notification delivery, read state, and role fan-out.");
    const directNotification = (
      await request("/notifications", {
        method: "POST",
        accessToken: managerSession.accessToken,
        expectedStatus: 201,
        body: {
          notificationType: "system_announcement",
          title: `Direct notification ${runToken}`,
          message: "Manager-to-reviewer notification.",
          recipientUserId: reviewerOneUserId,
          linkedRecord: {
            entityType: "lead",
            entityId: randomUUID()
          }
        }
      })
    ).notification;
    assert.equal(directNotification.notificationType, "system_announcement");

    const reviewerOneNotifications = await request("/notifications?status=unread", {
      accessToken: reviewerOneSession.accessToken
    });
    assert.ok(
      reviewerOneNotifications.notifications.some((notification) => notification.id === directNotification.id),
      "Reviewer one should receive the direct notification."
    );

    await request(`/notifications/${directNotification.id}/read`, {
      method: "POST",
      accessToken: reviewerOneSession.accessToken
    });
    const directDelivery = await queryOne(
      client,
      `
        SELECT read_at
        FROM notification_deliveries
        WHERE tenant_id = $1
          AND notification_id = $2
          AND recipient_user_id = $3
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [tenantId, directNotification.id, reviewerOneUserId]
    );
    assert.ok(directDelivery?.read_at, "Read state should persist to notification_deliveries.");

    const roleNotification = (
      await request("/notifications", {
        method: "POST",
        accessToken: managerSession.accessToken,
        expectedStatus: 201,
        body: {
          notificationType: "system_announcement",
          title: `Role notification ${runToken}`,
          message: "Role-targeted delivery.",
          recipientRoleId: reviewerRoleId
        }
      })
    ).notification;

    const roleDeliveryCount = await queryOne(
      client,
      `
        SELECT COUNT(*)::int AS count
        FROM notification_deliveries
        WHERE tenant_id = $1
          AND notification_id = $2
          AND deleted_at IS NULL
      `,
      [tenantId, roleNotification.id]
    );
    assert.equal(roleDeliveryCount.count, 2, "Role delivery should fan out to both reviewers.");

    await request("/notifications/preferences", {
      method: "PUT",
      accessToken: reviewerTwoSession.accessToken,
      body: {
        preferences: [
          { notificationType: "system_announcement", enabled: false },
          { notificationType: "approval_requested", enabled: true },
          { notificationType: "approval_decided", enabled: true },
          { notificationType: "approval_completed", enabled: true },
          { notificationType: "workflow_signal", enabled: true },
          { notificationType: "record_assignment", enabled: true },
          { notificationType: "campaign_update", enabled: true },
          { notificationType: "customer_escalation", enabled: true },
          { notificationType: "sensitive_ai_action", enabled: true }
        ]
      }
    });

    const mutedRoleNotification = (
      await request("/notifications", {
        method: "POST",
        accessToken: managerSession.accessToken,
        expectedStatus: 201,
        body: {
          notificationType: "system_announcement",
          title: `Muted role notification ${runToken}`,
          message: "Preference-aware role fan-out.",
          recipientRoleId: reviewerRoleId
        }
      })
    ).notification;

    const mutedDeliveryCount = await queryOne(
      client,
      `
        SELECT COUNT(*)::int AS count
        FROM notification_deliveries
        WHERE tenant_id = $1
          AND notification_id = $2
          AND deleted_at IS NULL
      `,
      [tenantId, mutedRoleNotification.id]
    );
    assert.equal(mutedDeliveryCount.count, 1, "Muted users should be skipped during notification fan-out.");

    log("Testing approval creation, comments, approval history, and decisions.");
    const userApproval = (
      await request("/approvals", {
        method: "POST",
        accessToken: managerSession.accessToken,
        expectedStatus: 201,
        body: {
          approvalType: "discount_approval",
          title: `Discount approval ${runToken}`,
          description: "Discount requires reviewer approval.",
          approverUserId: reviewerOneUserId,
          linkedRecord: {
            entityType: "opportunity",
            entityId: randomUUID()
          },
          initialComment: "Created by manager."
        }
      })
    ).approval;
    assert.equal(userApproval.status, "pending");

    const reviewerAssignedList = await request("/approvals?scope=assigned&status=pending", {
      accessToken: reviewerOneSession.accessToken
    });
    assert.ok(
      reviewerAssignedList.approvals.some((approval) => approval.id === userApproval.id),
      "Assigned approver should see the approval request."
    );

    await expectError(`/approvals/${userApproval.id}/decision`, {
      method: "POST",
      accessToken: reviewerTwoSession.accessToken,
      expectedStatus: 403,
      expectedCode: "FORBIDDEN",
      body: {
        decision: "rejected",
        comment: "Not assigned to me."
      }
    });

    await request(`/approvals/${userApproval.id}/comments`, {
      method: "POST",
      accessToken: reviewerOneSession.accessToken,
      body: {
        comment: "Reviewing discount details."
      }
    });
    const approvedResponse = await request(`/approvals/${userApproval.id}/decision`, {
      method: "POST",
      accessToken: reviewerOneSession.accessToken,
      body: {
        decision: "approved",
        comment: "Approved after validation."
      }
    });
    assert.equal(approvedResponse.approval.status, "approved");
    assert.equal(
      approvedResponse.approval.history.filter((entry) => ["created", "commented", "approved"].includes(entry.action)).length,
      3,
      "Approval history should record create, comment, and decision steps."
    );

    await expectError(`/approvals/${userApproval.id}/decision`, {
      method: "POST",
      accessToken: reviewerOneSession.accessToken,
      expectedStatus: 400,
      expectedCode: "APPROVAL_NOT_PENDING",
      body: {
        decision: "approved",
        comment: "Second decision should fail."
      }
    });

    const roleApproval = (
      await request("/approvals", {
        method: "POST",
        accessToken: managerSession.accessToken,
        expectedStatus: 201,
        body: {
          approvalType: "campaign_approval",
          title: `Campaign approval ${runToken}`,
          description: "Role-queue approval.",
          approverRoleId: reviewerRoleId,
          linkedRecord: {
            entityType: "campaign",
            entityId: randomUUID()
          }
        }
      })
    ).approval;
    const roleApprovalList = await request("/approvals?scope=assigned&status=pending", {
      accessToken: reviewerTwoSession.accessToken
    });
    assert.ok(
      roleApprovalList.approvals.some((approval) => approval.id === roleApproval.id),
      "Role approvers should see queue-routed approval requests."
    );

    const rejectedRoleApproval = await request(`/approvals/${roleApproval.id}/decision`, {
      method: "POST",
      accessToken: reviewerTwoSession.accessToken,
      body: {
        decision: "rejected",
        comment: "Campaign needs more data."
      }
    });
    assert.equal(rejectedRoleApproval.approval.status, "rejected");

    log("Testing workflow integration for persisted notifications and approvals.");
    const workflow = (
      await request("/workflows", {
        method: "POST",
        accessToken: managerSession.accessToken,
        expectedStatus: 201,
        body: {
          name: `Phase 25 workflow ${runToken}`,
          triggerType: "record_created"
        }
      })
    ).workflow;
    await request(`/workflows/${workflow.id}/actions`, {
      method: "POST",
      accessToken: managerSession.accessToken,
      expectedStatus: 201,
      body: {
        actionType: "send_notification",
        actionConfig: {
          notificationType: "workflow_signal",
          title: `Workflow signal ${runToken}`,
          message: `Workflow signal body ${runToken}`,
          recipientUserId: reviewerOneUserId
        }
      }
    });
    await request(`/workflows/${workflow.id}/actions`, {
      method: "POST",
      accessToken: managerSession.accessToken,
      expectedStatus: 201,
      body: {
        actionType: "trigger_approval",
        actionConfig: {
          approvalType: "campaign_approval",
          title: `Workflow approval ${runToken}`,
          description: "Workflow-generated approval.",
          approverUserId: reviewerOneUserId
        }
      }
    });
    await request(`/workflows/${workflow.id}`, {
      method: "PATCH",
      accessToken: managerSession.accessToken,
      body: {
        status: "active",
        isEnabled: true
      }
    });
    const workflowRun = (
      await request(`/workflows/${workflow.id}/run`, {
        method: "POST",
        accessToken: managerSession.accessToken,
        expectedStatus: 201,
        body: {
          context: {
            recordType: "campaign",
            recordId: randomUUID()
          }
        }
      })
    ).run;
    assert.equal(workflowRun.status, "succeeded", "Workflow run should succeed with real notification and approval actions.");
    assert.ok(
      workflowRun.logs.some((entry) => entry.message === "In-app notification created."),
      "Workflow log should record notification persistence."
    );
    assert.ok(
      workflowRun.logs.some((entry) => entry.message === "Approval request created."),
      "Workflow log should record approval creation."
    );

    const workflowNotification = await queryOne(
      client,
      `
        SELECT id
        FROM notifications
        WHERE tenant_id = $1
          AND title = $2
          AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [tenantId, `Workflow signal ${runToken}`]
    );
    assert.ok(workflowNotification, "Workflow notification should be persisted.");

    const workflowApproval = await queryOne(
      client,
      `
        SELECT id
        FROM approval_requests
        WHERE tenant_id = $1
          AND title = $2
          AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [tenantId, `Workflow approval ${runToken}`]
    );
    assert.ok(workflowApproval, "Workflow approval should be persisted.");

    log("Checking audit logs, tenant isolation, and docs.");
    await assertAuditExists(client, { tenantId, action: "notification.create", resourceType: "notification" });
    await assertAuditExists(client, { tenantId, action: "approval.create", resourceType: "approval_request" });
    await assertAuditExists(client, { tenantId, action: "approval.decision", resourceType: "approval_request" });
    await assertAuditExists(client, { tenantId, action: "workflow.run", resourceType: "workflow" });

    const secondTenantId = (
      await client.query(
        `
          INSERT INTO tenants (slug, name, status, metadata)
          VALUES ($1, $2, 'active', jsonb_build_object('testRun', $3::text))
          RETURNING id
        `,
        [`phase25-${runToken}-tenant`, `Phase 25 Tenant ${runToken}`, runToken]
      )
    ).rows[0].id;
    await client.query(
      `
        INSERT INTO notifications (
          tenant_id,
          notification_type,
          title,
          message,
          metadata
        )
        VALUES ($1, 'system_announcement', 'Other tenant', 'Isolated', '{}'::jsonb)
      `,
      [secondTenantId]
    );
    const ownNotifications = await request("/notifications", {
      accessToken: managerSession.accessToken
    });
    assert.ok(
      ownNotifications.notifications.every((notification) => notification.title !== "Other tenant"),
      "Another tenant's notifications must not leak into the current tenant inbox."
    );

    for (const [filePath, expectedSnippet] of [
      ["docs/technical/WORKFLOW_ENGINE.md", "persisted workflow outcomes"],
      ["docs/user-guides/USER_GUIDE.md", "Notification center"],
      ["docs/user-guides/ADMIN_GUIDE.md", "Approval inbox"],
      ["docs/security/AUDIT_LOGGING_GUIDE.md", "notification.create"],
      ["CHANGELOG.md", "Phase 25 migration"]
    ]) {
      const contents = await readFile(filePath, "utf8");
      assert.ok(contents.includes(expectedSnippet), `${filePath} should mention ${expectedSnippet}.`);
    }

    log("Phase 25 exhaustive checks passed.");
  } finally {
    await client.end();
  }
}

await main();
