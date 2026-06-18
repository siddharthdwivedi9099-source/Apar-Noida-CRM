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

const trainingOptionSetKeys = ["training-category", "training-level"];
const trainingTables = ["training_programs", "training_modules", "training_lessons", "training_assets", "training_assignments", "customer_learners", "training_progress", "training_feedback", "training_certifications"];

function log(message) {
  console.log(`[phase17-exhaustive] ${message}`);
}

function parsePayload(rawBody) {
  if (!rawBody) return null;
  try {
    return JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
}

async function request(path, { method = "GET", accessToken, body, expectedStatus = 200 } = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
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
  for (const tableName of trainingTables) {
    const table = await queryOne(client, `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`, [tableName]);
    assert.equal(table?.table_name, tableName, `${tableName} should exist for Phase 17.`);
  }
}

async function assertSeedBaseline(client) {
  const tenant = await queryOne(client, `SELECT id FROM tenants WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`, [defaultTenantSlug]);
  assert.ok(tenant, "Default tenant should exist.");
  const optionSetCount = await queryOne(client, `SELECT COUNT(*)::int AS count FROM tenant_option_sets WHERE tenant_id = $1 AND deleted_at IS NULL AND set_key = ANY($2::text[])`, [tenant.id, trainingOptionSetKeys]);
  assert.equal(optionSetCount.count, trainingOptionSetKeys.length, "Phase 17 option sets should be seeded.");
  const permissionCount = await queryOne(client, `SELECT COUNT(*)::int AS count FROM permissions WHERE code LIKE 'training.%' AND deleted_at IS NULL`);
  assert.equal(permissionCount.count, 13, "training permission catalog should be seeded.");
  return { tenantId: tenant.id };
}

async function createUserWithPermissions(client, { tenantId, email, password, firstName, lastName, roleSlug, roleName, permissionCodes }) {
  const roleResult = await client.query(`INSERT INTO roles (tenant_id, slug, name, description, metadata) VALUES ($1, $2, $3, $4, jsonb_build_object('testRun', $5::text)) RETURNING id`, [tenantId, roleSlug, roleName, `${roleName} for phase 17 testing`, runToken]);
  const roleId = roleResult.rows[0].id;
  await client.query(`INSERT INTO role_permissions (tenant_id, role_id, permission_id, metadata) SELECT $1, $2, permissions.id, jsonb_build_object('testRun', $4::text) FROM permissions WHERE permissions.code = ANY($3::text[]) AND permissions.deleted_at IS NULL`, [tenantId, roleId, permissionCodes, runToken]);
  const displayName = `${firstName} ${lastName}`.trim();
  const userResult = await client.query(`INSERT INTO users (tenant_id, email, normalized_email, first_name, last_name, display_name, password_hash, status, password_changed_at, metadata) VALUES ($1, $2, LOWER($2), $3, $4, $5, crypt($6, gen_salt('bf')), 'active', NOW(), jsonb_build_object('testRun', $7::text)) RETURNING id`, [tenantId, email, firstName, lastName, displayName, password, runToken]);
  const userId = userResult.rows[0].id;
  await client.query(`INSERT INTO user_roles (tenant_id, user_id, role_id, metadata) VALUES ($1, $2, $3, jsonb_build_object('testRun', $4::text))`, [tenantId, userId, roleId, runToken]);
  return { userId, roleId, displayName };
}

async function cloneOptionSet(client, sourceTenantId, targetTenantId, setKey) {
  const setResult = await client.query(`WITH source_set AS (SELECT * FROM tenant_option_sets WHERE tenant_id = $1 AND set_key = $2 AND deleted_at IS NULL LIMIT 1) INSERT INTO tenant_option_sets (tenant_id, set_key, module_key, kind, name, description, is_system_set, metadata) SELECT $3, source_set.set_key, source_set.module_key, source_set.kind, source_set.name, source_set.description, source_set.is_system_set, source_set.metadata || jsonb_build_object('clonedFor', $4::text) FROM source_set RETURNING id`, [sourceTenantId, setKey, targetTenantId, runToken]);
  const targetSetId = setResult.rows[0].id;
  await client.query(`INSERT INTO tenant_option_values (tenant_id, option_set_id, value_key, label, description, color, sort_order, is_default, is_active, metadata) SELECT $3, $4, v.value_key, v.label, v.description, v.color, v.sort_order, v.is_default, v.is_active, v.metadata || jsonb_build_object('clonedFor', $5::text) FROM tenant_option_sets s INNER JOIN tenant_option_values v ON v.option_set_id = s.id AND v.tenant_id = s.tenant_id WHERE s.tenant_id = $1 AND s.set_key = $2 AND s.deleted_at IS NULL AND v.deleted_at IS NULL`, [sourceTenantId, setKey, targetTenantId, targetSetId, runToken]);
}

async function getOptionValueId(client, tenantId, setKey, valueKey) {
  const row = await queryOne(client, `SELECT tenant_option_values.id FROM tenant_option_sets INNER JOIN tenant_option_values ON tenant_option_values.option_set_id = tenant_option_sets.id AND tenant_option_values.tenant_id = tenant_option_sets.tenant_id WHERE tenant_option_sets.tenant_id = $1 AND tenant_option_sets.set_key = $2 AND tenant_option_values.value_key = $3 AND tenant_option_sets.deleted_at IS NULL AND tenant_option_values.deleted_at IS NULL LIMIT 1`, [tenantId, setKey, valueKey]);
  return row?.id ?? null;
}

async function assertAuditLog(client, { tenantId, actorUserId, sessionId, action, resourceType, resourceId }) {
  const row = await queryOne(client, `SELECT status FROM audit_logs WHERE tenant_id = $1 AND actor_user_id = $2 AND session_id = $3 AND action = $4 AND resource_type = $5 AND resource_id = $6 ORDER BY created_at DESC LIMIT 1`, [tenantId, actorUserId, sessionId, action, resourceType, resourceId]);
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

    log("Creating training admin, learner, and unrelated viewer users.");
    const adminTrainPassword = `Train!${runToken}99`;
    const learnerPassword = `Learn!${runToken}99`;
    const viewerPassword = `View!${runToken}99`;
    await createUserWithPermissions(client, { tenantId, email: `trainadmin-${runToken}@example.test`, password: adminTrainPassword, firstName: "Tina", lastName: "Trainer", roleSlug: `trainadmin-phase17-${runToken}`, roleName: `Training Admin Phase17 ${runToken}`, permissionCodes: ["training.view", "training.create", "training.edit", "training.assign", "training.delete", "ai.use_ai"] });
    const learnerUser = await createUserWithPermissions(client, { tenantId, email: `learner-${runToken}@example.test`, password: learnerPassword, firstName: "Leo", lastName: "Learner", roleSlug: `learner-phase17-${runToken}`, roleName: `Learner Phase17 ${runToken}`, permissionCodes: ["training.view"] });
    await createUserWithPermissions(client, { tenantId, email: `viewer17-${runToken}@example.test`, password: viewerPassword, firstName: "Val", lastName: "Outsider", roleSlug: `viewer17-phase17-${runToken}`, roleName: `Viewer Phase17 ${runToken}`, permissionCodes: ["leads.view"] });

    const trainSession = await loginSession(defaultTenantSlug, `trainadmin-${runToken}@example.test`, adminTrainPassword);
    const learnerSession = await loginSession(defaultTenantSlug, `learner-${runToken}@example.test`, learnerPassword);
    const viewerSession = await loginSession(defaultTenantSlug, `viewer17-${runToken}@example.test`, viewerPassword);

    log("Creating a supporting account, CS account, and onboarding plan for linkage.");
    const account = (await request("/accounts", { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { name: `Training Account ${runToken}`, industry: "Technology" } })).account;
    const csAccount = (await request("/customer-success/accounts", { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { accountId: account.id, segmentKey: "onboarding", lifecycleStageKey: "onboarding" } })).customerSuccessAccount;
    const withPlan = await request(`/customer-success/accounts/${csAccount.id}/onboarding-plan`, { method: "PUT", accessToken: adminSession.accessToken, body: { name: `Onboarding ${runToken}` } });
    const onboardingPlanId = withPlan.customerSuccessAccount.onboardingPlans[0].id;

    log("Validating options and permission/validation guards.");
    const options = await request("/training/options", { accessToken: trainSession.accessToken });
    assert.ok(options.categories.some((entry) => entry.key === "certification"));
    assert.ok(options.levels.some((entry) => entry.key === "advanced"));

    await expectError("/training/programs", { method: "POST", accessToken: viewerSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { title: "Blocked program" } });
    await expectError("/training/programs", { method: "POST", accessToken: learnerSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { title: "Blocked program" } });
    await expectError("/training/programs", { method: "POST", accessToken: trainSession.accessToken, expectedStatus: 400, expectedCode: "INVALID_OPTION_VALUE", body: { title: `Bad cat ${runToken}`, categoryKey: "nonexistent" } });

    log("Creating a training program, module, lessons, and an asset.");
    const created = await request("/training/programs", { method: "POST", accessToken: trainSession.accessToken, expectedStatus: 201, body: { title: `Product 101 ${runToken}`, description: "Intro", categoryKey: "product", levelKey: "beginner", estimatedMinutes: 60, isRoleBased: true, targetRole: "CSM" } });
    const programId = created.program.id;
    assert.equal(created.program.status, "draft");
    assert.equal(created.program.category?.key, "product");
    assert.equal(created.program.level?.key, "beginner");
    assert.equal(created.program.isRoleBased, true);
    assert.equal(created.program.targetRole, "CSM");
    assert.equal(created.program.roleBasedPathPlaceholder.available, false);
    assert.equal(created.program.certificationPlaceholder.available, false);
    assert.deepEqual(created.program.aiPlaceholders.actions.map((a) => a.key).sort(), ["ai_product_trainer", "knowledge_gap_detection", "learning_path_recommender", "lesson_summarizer", "quiz_generator"], "Training AI placeholders should expose the full Phase 17 action set.");

    await assertAuditLog(client, { tenantId, actorUserId: trainSession.currentUser.id, sessionId: trainSession.session.id, action: "training.program.create", resourceType: "training_program", resourceId: programId });

    const withModule = await request(`/training/programs/${programId}/modules`, { method: "POST", accessToken: trainSession.accessToken, expectedStatus: 201, body: { title: `Module A ${runToken}` } });
    assert.equal(withModule.program.modules.length, 1);
    assert.equal(withModule.program.moduleCount, 1);
    const moduleId = withModule.program.modules[0].id;

    const updatedModule = await request(`/training/programs/${programId}/modules/${moduleId}`, { method: "PATCH", accessToken: trainSession.accessToken, body: { description: "Foundations" } });
    assert.equal(updatedModule.program.modules[0].description, "Foundations");

    await expectError(`/training/programs/${programId}/modules/${moduleId}`, { method: "PATCH", accessToken: learnerSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { description: "blocked" } });
    await expectError(`/training/programs/${programId}/modules/${randomUUID()}/lessons`, { method: "POST", accessToken: trainSession.accessToken, expectedStatus: 404, expectedCode: "TRAINING_MODULE_NOT_FOUND", body: { title: `Bad module lesson ${runToken}` } });

    const withLesson1 = await request(`/training/programs/${programId}/modules/${moduleId}/lessons`, { method: "POST", accessToken: trainSession.accessToken, expectedStatus: 201, body: { title: `Lesson 1 ${runToken}`, lessonType: "video", durationMinutes: 10 } });
    assert.equal(withLesson1.program.modules[0].lessons.length, 1);
    assert.equal(withLesson1.program.modules[0].lessons[0].lessonType, "video");
    assert.equal(withLesson1.program.modules[0].lessons[0].durationMinutes, 10, "Lesson duration should be retained.");
    const lesson1Id = withLesson1.program.modules[0].lessons[0].id;
    const withLesson2 = await request(`/training/programs/${programId}/modules/${moduleId}/lessons`, { method: "POST", accessToken: trainSession.accessToken, expectedStatus: 201, body: { title: `Lesson 2 ${runToken}`, lessonType: "quiz" } });
    const lesson2Id = withLesson2.program.modules[0].lessons[1].id;
    assert.equal(withLesson2.program.lessonCount, 2);

    const updatedLesson = await request(`/training/programs/${programId}/lessons/${lesson1Id}`, { method: "PATCH", accessToken: trainSession.accessToken, body: { content: "Watch the intro video" } });
    assert.equal(updatedLesson.program.modules[0].lessons[0].content, "Watch the intro video");

    await expectError(`/training/programs/${programId}/lessons/${randomUUID()}/assets`, { method: "POST", accessToken: trainSession.accessToken, expectedStatus: 404, expectedCode: "TRAINING_LESSON_NOT_FOUND", body: { name: `Bad lesson asset ${runToken}` } });

    const withAsset = await request(`/training/programs/${programId}/lessons/${lesson1Id}/assets`, { method: "POST", accessToken: trainSession.accessToken, expectedStatus: 201, body: { name: `Slides ${runToken}`, assetType: "document", url: "https://example.test/slides", externalReference: "REF-1" } });
    const lesson1 = withAsset.program.modules[0].lessons.find((l) => l.id === lesson1Id);
    assert.equal(lesson1.assets.length, 1);
    assert.equal(lesson1.assets[0].assetType, "document");
    assert.equal(lesson1.assets[0].url, "https://example.test/slides", "Asset URL should be retained.");
    assert.equal(lesson1.assets[0].externalReference, "REF-1", "Asset external reference should be retained.");

    log("Updating program profile fields.");
    const programUpdated = await request(`/training/programs/${programId}`, { method: "PATCH", accessToken: trainSession.accessToken, body: { title: `Product 101 v2 ${runToken}`, description: "Updated intro", levelKey: "intermediate", estimatedMinutes: 90, isRoleBased: false, targetRole: "All" } });
    assert.equal(programUpdated.program.title, `Product 101 v2 ${runToken}`);
    assert.equal(programUpdated.program.description, "Updated intro");
    assert.equal(programUpdated.program.level?.key, "intermediate");
    assert.equal(programUpdated.program.estimatedMinutes, 90);
    assert.equal(programUpdated.program.isRoleBased, false);
    assert.equal(programUpdated.program.targetRole, "All");

    log("Publishing the program and validating list filters.");
    const published = await request(`/training/programs/${programId}`, { method: "PATCH", accessToken: trainSession.accessToken, body: { status: "published" } });
    assert.equal(published.program.status, "published");
    const list = await request("/training/programs?pageSize=100", { accessToken: trainSession.accessToken });
    assert.ok(list.programs.some((p) => p.id === programId));
    const filtered = await request(`/training/programs?status=published&category=product&search=${runToken}&sortBy=title&sortOrder=asc`, { accessToken: trainSession.accessToken });
    assert.ok(filtered.programs.some((p) => p.id === programId), "Program filters and sort should match.");

    log("Creating a learner record.");
    const learners = await request("/training/learners", { method: "POST", accessToken: trainSession.accessToken, expectedStatus: 201, body: { learnerType: "user", userId: learnerUser.userId, accountId: account.id, displayName: "Leo Learner", email: `leo-${runToken}@example.test` } });
    assert.ok(learners.learners.some((l) => l.displayName === "Leo Learner"));

    log("Assigning the program to the learner with CS account and onboarding plan links.");
    const assignment = (await request("/training/assignments", { method: "POST", accessToken: trainSession.accessToken, expectedStatus: 201, body: { programId, assigneeType: "user", userId: learnerUser.userId, csAccountId: csAccount.id, onboardingPlanId, dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) } })).assignment;
    const assignmentId = assignment.id;
    assert.equal(assignment.status, "assigned");
    assert.equal(assignment.completionPercent, 0);
    assert.equal(assignment.lessonCount, 2);
    assert.equal(assignment.csAccountId, csAccount.id, "Assignment should link to the customer success account.");
    assert.equal(assignment.onboardingPlanId, onboardingPlanId, "Assignment should link to the onboarding plan.");
    assert.equal(assignment.user?.id, learnerUser.userId);
    assert.equal(assignment.progress.length, 2, "Assignment detail should list a progress row per lesson.");
    await assertAuditLog(client, { tenantId, actorUserId: trainSession.currentUser.id, sessionId: trainSession.session.id, action: "training.assignment.create", resourceType: "training_assignment", resourceId: assignmentId });

    await expectError("/training/assignments", { method: "POST", accessToken: trainSession.accessToken, expectedStatus: 404, expectedCode: "TRAINING_PROGRAM_NOT_FOUND", body: { programId: randomUUID(), userId: learnerUser.userId } });

    log("Validating assignment list filters.");
    const assignmentsByProgram = await request(`/training/assignments?programId=${programId}`, { accessToken: trainSession.accessToken });
    assert.ok(assignmentsByProgram.assignments.some((a) => a.id === assignmentId), "Assignment program filter should match.");
    const assignmentsByUser = await request(`/training/assignments?userId=${learnerUser.userId}&status=assigned`, { accessToken: trainSession.accessToken });
    assert.ok(assignmentsByUser.assignments.some((a) => a.id === assignmentId), "Assignment user/status filter should match.");

    log("Assigning the program to an account and updating the assignment.");
    const accountAssignment = (await request("/training/assignments", { method: "POST", accessToken: trainSession.accessToken, expectedStatus: 201, body: { programId, assigneeType: "account", accountId: account.id } })).assignment;
    assert.equal(accountAssignment.assigneeType, "account");
    assert.equal(accountAssignment.account?.id, account.id, "Account assignment should link to the account.");
    const assignmentsByAccount = await request(`/training/assignments?accountId=${account.id}`, { accessToken: trainSession.accessToken });
    assert.ok(assignmentsByAccount.assignments.some((a) => a.id === accountAssignment.id), "Assignment account filter should match.");
    const csFiltered = await request(`/training/assignments?csAccountId=${csAccount.id}`, { accessToken: trainSession.accessToken });
    assert.ok(csFiltered.assignments.some((a) => a.id === assignmentId), "Assignment CS account filter should match.");
    const expiredAssignment = await request(`/training/assignments/${accountAssignment.id}`, { method: "PATCH", accessToken: trainSession.accessToken, body: { status: "expired", dueDate: "2026-12-31" } });
    assert.equal(expiredAssignment.assignment.status, "expired", "Assignment status update should persist.");
    assert.equal(expiredAssignment.assignment.dueDate, "2026-12-31", "Assignment due date update should persist.");

    log("Tracking progress and verifying completion recompute (learner self-service).");
    const afterLesson1 = await request(`/training/assignments/${assignmentId}/progress`, { method: "POST", accessToken: learnerSession.accessToken, body: { lessonId: lesson1Id, status: "completed" } });
    assert.equal(afterLesson1.assignment.completionPercent, 50, "Completing one of two lessons should be 50%.");
    assert.equal(afterLesson1.assignment.status, "in_progress");
    assert.equal(afterLesson1.assignment.completedLessonCount, 1);
    const completedLesson1 = afterLesson1.assignment.progress.find((p) => p.lessonId === lesson1Id);
    assert.equal(completedLesson1.status, "completed");
    assert.ok(completedLesson1.completedAt, "Completed lesson should record completedAt.");

    const afterLesson2 = await request(`/training/assignments/${assignmentId}/progress`, { method: "POST", accessToken: learnerSession.accessToken, body: { lessonId: lesson2Id, status: "completed" } });
    assert.equal(afterLesson2.assignment.completionPercent, 100, "Completing all lessons should be 100%.");
    assert.equal(afterLesson2.assignment.status, "completed", "Assignment should complete when all lessons are done.");
    assert.ok(afterLesson2.assignment.completedAt, "Completed assignment should record completedAt.");

    await expectError(`/training/assignments/${assignmentId}/progress`, { method: "POST", accessToken: learnerSession.accessToken, expectedStatus: 400, expectedCode: "INVALID_LESSON", body: { lessonId: randomUUID(), status: "completed" } });

    log("Submitting feedback.");
    const withFeedback = await request(`/training/assignments/${assignmentId}/feedback`, { method: "POST", accessToken: learnerSession.accessToken, expectedStatus: 201, body: { rating: 5, comments: "Great program", lessonId: lesson1Id } });
    assert.equal(withFeedback.assignment.id, assignmentId);
    const programAfterFeedback = await request(`/training/programs/${programId}`, { accessToken: trainSession.accessToken });
    assert.equal(programAfterFeedback.program.feedbackCount, 1);
    assert.equal(programAfterFeedback.program.averageRating, 5);
    // Program-level feedback (no lessonId) on the account assignment.
    await request(`/training/assignments/${accountAssignment.id}/feedback`, { method: "POST", accessToken: trainSession.accessToken, expectedStatus: 201, body: { rating: 3, comments: "Program-level feedback" } });
    const programAfterFeedback2 = await request(`/training/programs/${programId}`, { accessToken: trainSession.accessToken });
    assert.equal(programAfterFeedback2.program.feedbackCount, 2, "Program-level feedback should increment the feedback count.");
    assert.equal(programAfterFeedback2.program.averageRating, 4, "Average rating should reflect both feedback entries.");

    log("Validating the learner portal (My Training).");
    const portal = await request("/training/portal/my-training", { accessToken: learnerSession.accessToken });
    assert.ok(portal.assignments.some((a) => a.id === assignmentId), "Learner portal should include the assigned training.");
    assert.ok(portal.completedCount >= 1, "Learner portal should count completed training.");
    assert.equal(portal.recommendedTrainingPlaceholder.available, false);

    log("Validating the training dashboard.");
    const dashboard = await request("/training/dashboard", { accessToken: trainSession.accessToken });
    assert.ok(dashboard.totalPrograms >= 1, "Dashboard should count programs.");
    assert.ok(dashboard.publishedPrograms >= 1, "Dashboard should count published programs.");
    assert.ok(dashboard.totalAssignments >= 1, "Dashboard should count assignments.");
    assert.ok(dashboard.completedAssignments >= 1, "Dashboard should count completed assignments.");
    assert.ok(dashboard.averageCompletionPercent !== null, "Dashboard should compute average completion.");
    assert.ok(dashboard.averageRating !== null, "Dashboard should compute average rating.");
    assert.ok(dashboard.categoryDistribution.length >= 1, "Dashboard should report a category distribution.");
    assert.ok(dashboard.statusDistribution.some((entry) => entry.status === "completed"), "Dashboard status distribution should include completed.");

    log("Checking tenant isolation against a second tenant program.");
    const secondTenantId = (await client.query(`INSERT INTO tenants (slug, name, status, metadata) VALUES ($1, $2, 'active', jsonb_build_object('testRun', $3::text)) RETURNING id`, [`phase17-${runToken}-tenant`, `Phase 17 Tenant ${runToken}`, runToken])).rows[0].id;
    for (const setKey of trainingOptionSetKeys) {
      await cloneOptionSet(client, tenantId, secondTenantId, setKey);
    }
    const secondProgram = (await client.query(`INSERT INTO training_programs (tenant_id, category_option_id, level_option_id, title, metadata) VALUES ($1, $2, $3, $4, jsonb_build_object('testRun', $5::text)) RETURNING id`, [secondTenantId, await getOptionValueId(client, secondTenantId, "training-category", "product"), await getOptionValueId(client, secondTenantId, "training-level", "beginner"), `Isolated Program ${runToken}`, runToken])).rows[0].id;
    await expectError(`/training/programs/${secondProgram}`, { accessToken: adminSession.accessToken, expectedStatus: 404, expectedCode: "TRAINING_PROGRAM_NOT_FOUND" });

    log("Deleting the program.");
    await request(`/training/programs/${programId}`, { method: "DELETE", accessToken: trainSession.accessToken });
    await expectError(`/training/programs/${programId}`, { accessToken: trainSession.accessToken, expectedStatus: 404, expectedCode: "TRAINING_PROGRAM_NOT_FOUND" });

    log("Phase 17 customer training checks passed.");
  } finally {
    await client.end();
  }
}

await main();
