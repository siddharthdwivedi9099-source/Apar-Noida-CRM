import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

const apiBaseUrl = process.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4000/api/v1";
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://crm:crm@localhost:5433/crm";
const defaultTenantSlug = process.env.DEFAULT_TENANT_SLUG ?? "sample-tenant";
const runToken = randomUUID().replace(/-/g, "").slice(0, 10);

const DEFAULT_SOURCE_KEYS = ["product_documentation", "user_guide", "admin_guide", "training_content", "faqs", "release_notes", "support_articles", "resolved_tickets", "customer_documents"];

function log(message) {
  console.log(`[phase20-exhaustive] ${message}`);
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
  assert.equal(payload.error.code, expectedCode, `Expected ${expectedCode} from ${options.method ?? "GET"} ${path}, received ${payload.error.code}.`);
  return payload.error;
}

async function loginSession(tenantSlug, email, password) {
  const authPayload = await request("/auth/login", { method: "POST", expectedStatus: 200, body: { tenantSlug, email, password } });
  const accessToken = authPayload.tokens.accessToken;
  assert.ok(accessToken, "Login should return an access token.");
  const me = await request("/auth/me", { accessToken, expectedStatus: 200 });
  return { accessToken, currentUser: me.user, session: me.session };
}

async function queryOne(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0] ?? null;
}

async function createUserWithPermissions(client, { tenantId, email, password, firstName, lastName, roleSlug, roleName, permissionCodes }) {
  const roleResult = await client.query(`INSERT INTO roles (tenant_id, slug, name, description, metadata) VALUES ($1, $2, $3, $4, jsonb_build_object('testRun', $5::text)) RETURNING id`, [tenantId, roleSlug, roleName, `${roleName} for phase 20 testing`, runToken]);
  const roleId = roleResult.rows[0].id;
  await client.query(`INSERT INTO role_permissions (tenant_id, role_id, permission_id, metadata) SELECT $1, $2, permissions.id, jsonb_build_object('testRun', $4::text) FROM permissions WHERE permissions.code = ANY($3::text[]) AND permissions.deleted_at IS NULL`, [tenantId, roleId, permissionCodes, runToken]);
  const displayName = `${firstName} ${lastName}`.trim();
  const userResult = await client.query(`INSERT INTO users (tenant_id, email, normalized_email, first_name, last_name, display_name, password_hash, status, password_changed_at, metadata) VALUES ($1, $2, LOWER($2), $3, $4, $5, crypt($6, gen_salt('bf')), 'active', NOW(), jsonb_build_object('testRun', $7::text)) RETURNING id`, [tenantId, email, firstName, lastName, displayName, password, runToken]);
  const userId = userResult.rows[0].id;
  await client.query(`INSERT INTO user_roles (tenant_id, user_id, role_id, metadata) VALUES ($1, $2, $3, jsonb_build_object('testRun', $4::text))`, [tenantId, userId, roleId, runToken]);
  return { userId, roleId, displayName };
}

async function assertAuditByAction(client, { tenantId, action, resourceType }) {
  const row = await queryOne(client, `SELECT status FROM audit_logs WHERE tenant_id = $1 AND action = $2 AND resource_type = $3 ORDER BY created_at DESC LIMIT 1`, [tenantId, action, resourceType]);
  assert.ok(row, `Audit log ${action} should exist for ${resourceType}.`);
  assert.equal(row.status, "success");
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    log("Checking schema and seed baseline.");
    for (const tableName of ["knowledge_sources", "knowledge_documents", "knowledge_chunks", "knowledge_articles", "knowledge_article_versions", "knowledge_gaps"]) {
      const table = await queryOne(client, `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`, [tableName]);
      assert.equal(table?.table_name, tableName, `${tableName} should exist for Phase 20.`);
    }
    const tenant = await queryOne(client, `SELECT id FROM tenants WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`, [defaultTenantSlug]);
    assert.ok(tenant, "Default tenant should exist.");
    const tenantId = tenant.id;

    log("Creating knowledge admin, author, viewer, privileged, and outsider users.");
    const adminPassword = `Adm!${runToken}99`;
    const authorPassword = `Aut!${runToken}99`;
    const viewerPassword = `Vie!${runToken}99`;
    const privPassword = `Prv!${runToken}99`;
    const outsiderPassword = `Out!${runToken}99`;
    await createUserWithPermissions(client, { tenantId, email: `kadmin20-${runToken}@example.test`, password: adminPassword, firstName: "Ada", lastName: "Admin", roleSlug: `kadmin20-${runToken}`, roleName: `Knowledge Admin 20 ${runToken}`, permissionCodes: ["ai.configure"] });
    await createUserWithPermissions(client, { tenantId, email: `kauthor20-${runToken}@example.test`, password: authorPassword, firstName: "Ari", lastName: "Author", roleSlug: `kauthor20-${runToken}`, roleName: `Knowledge Author 20 ${runToken}`, permissionCodes: ["ai.create", "ai.edit"] });
    await createUserWithPermissions(client, { tenantId, email: `kviewer20-${runToken}@example.test`, password: viewerPassword, firstName: "Vic", lastName: "Viewer", roleSlug: `kviewer20-${runToken}`, roleName: `Knowledge Viewer 20 ${runToken}`, permissionCodes: ["ai.view"] });
    await createUserWithPermissions(client, { tenantId, email: `kpriv20-${runToken}@example.test`, password: privPassword, firstName: "Pat", lastName: "Privileged", roleSlug: `kpriv20-${runToken}`, roleName: `Knowledge Privileged 20 ${runToken}`, permissionCodes: ["ai.use_ai", "customer_success.view"] });
    await createUserWithPermissions(client, { tenantId, email: `outsider20-${runToken}@example.test`, password: outsiderPassword, firstName: "Val", lastName: "Outsider", roleSlug: `outsider20-${runToken}`, roleName: `Outsider 20 ${runToken}`, permissionCodes: ["leads.view"] });

    const adminSession = await loginSession(defaultTenantSlug, `kadmin20-${runToken}@example.test`, adminPassword);
    const authorSession = await loginSession(defaultTenantSlug, `kauthor20-${runToken}@example.test`, authorPassword);
    const viewerSession = await loginSession(defaultTenantSlug, `kviewer20-${runToken}@example.test`, viewerPassword);
    const privSession = await loginSession(defaultTenantSlug, `kpriv20-${runToken}@example.test`, privPassword);
    const outsiderSession = await loginSession(defaultTenantSlug, `outsider20-${runToken}@example.test`, outsiderPassword);

    // ----------------------------------------------------------------------
    // Knowledge sources
    // ----------------------------------------------------------------------
    log("Validating knowledge source seeding, scopes, and guards.");
    const sourcesResponse = await request("/ai/knowledge/sources", { accessToken: adminSession.accessToken });
    const sourceKeys = sourcesResponse.sources.map((s) => s.sourceKey);
    for (const key of DEFAULT_SOURCE_KEYS) {
      assert.ok(sourceKeys.includes(key), `Baseline source ${key} should be seeded.`);
    }
    const customerSource = sourcesResponse.sources.find((s) => s.sourceKey === "customer_documents");
    assert.equal(customerSource.accessScope, "restricted", "Customer documents source should be restricted.");
    assert.equal(customerSource.requiredPermission, "customer_success.view", "Customer documents should require customer_success.view.");
    const faqSource = sourcesResponse.sources.find((s) => s.sourceKey === "faqs");
    assert.equal(faqSource.accessScope, "tenant");
    assert.equal(faqSource.requiredPermission, null);
    for (const key of DEFAULT_SOURCE_KEYS) {
      assert.equal(sourcesResponse.sources.find((s) => s.sourceKey === key).isSystem, true, `Baseline source ${key} should be a system source.`);
    }

    log("Validating source seeding is idempotent.");
    const reseed = await request("/ai/knowledge/sources", { accessToken: adminSession.accessToken });
    assert.equal(reseed.sources.length, sourcesResponse.sources.length, "Re-reading must not duplicate seeded sources.");

    log("Validating source creation, update, and permission guards.");
    const customSourceKey = `custom-src-${runToken}`;
    const customSource = (await request("/ai/knowledge/sources", { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { sourceKey: customSourceKey, name: "Custom Source", sourceType: "faq" } })).source;
    assert.equal(customSource.isSystem, false, "Custom sources are not system sources.");
    assert.equal(customSource.createdBy, adminSession.currentUser.id, "Source authorship should be tracked.");
    assert.equal(customSource.documentCount, 0, "A new source should report zero documents.");
    await assertAuditByAction(client, { tenantId, action: "ai.knowledge.source.create", resourceType: "knowledge_source" });
    await expectError("/ai/knowledge/sources", { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 409, expectedCode: "KNOWLEDGE_SOURCE_KEY_EXISTS", body: { sourceKey: customSourceKey, name: "Dup", sourceType: "faq" } });
    await expectError("/ai/knowledge/sources", { method: "POST", accessToken: viewerSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { sourceKey: `nope-${runToken}`, name: "Nope", sourceType: "faq" } });
    await expectError("/ai/knowledge/sources", { accessToken: outsiderSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN" });
    const toggled = (await request(`/ai/knowledge/sources/${customSource.id}`, { method: "PATCH", accessToken: adminSession.accessToken, body: { isEnabled: false } })).source;
    assert.equal(toggled.isEnabled, false);
    await request(`/ai/knowledge/sources/${customSource.id}`, { method: "PATCH", accessToken: adminSession.accessToken, body: { isEnabled: true } });
    await expectError(`/ai/knowledge/sources/${customSource.id}`, { method: "PATCH", accessToken: adminSession.accessToken, expectedStatus: 400, expectedCode: "VALIDATION_ERROR", body: {} });
    await expectError(`/ai/knowledge/sources/${randomUUID()}`, { accessToken: adminSession.accessToken, expectedStatus: 404, expectedCode: "KNOWLEDGE_SOURCE_NOT_FOUND" });

    // ----------------------------------------------------------------------
    // Documents, chunking, embedding placeholder
    // ----------------------------------------------------------------------
    log("Ingesting a document and validating chunking structure.");
    const docContent = Array.from({ length: 20 }, (_, i) => `Step ${i}: to reset your password use the Zorptokenreset secure workflow within the tenant boundary.`).join(" ");
    const document = (await request(`/ai/knowledge/sources/${faqSource.id}/documents`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { title: `Password reset guide ${runToken}`, content: docContent, summary: "How to reset a password.", contentFormat: "markdown", sourceUri: "https://docs.example.test/reset", metadata: { topic: "password" } } })).document;
    assert.equal(document.status, "chunked", "A new document should be chunked.");
    assert.ok(document.chunkCount >= 2, "A long document should produce multiple chunks.");
    assert.ok(document.tokenEstimate > 0, "Token estimate should be reported.");
    assert.equal(document.contentFormat, "markdown", "Content format should be stored.");
    assert.equal(document.sourceUri, "https://docs.example.test/reset", "Source URI should be stored.");
    assert.equal(document.createdBy, adminSession.currentUser.id, "Document authorship should be tracked.");
    assert.equal(document.chunks.length, document.chunkCount, "Returned chunks should match the chunk count.");
    assert.equal(document.chunks[0].chunkIndex, 0, "Chunks should be zero-indexed.");
    document.chunks.forEach((chunk, index) => {
      assert.equal(chunk.chunkIndex, index, "Chunk indexes should be contiguous.");
      assert.ok(chunk.tokenEstimate > 0, "Each chunk should carry a token estimate.");
      assert.ok(chunk.content.length > 0, "Each chunk should carry content.");
    });
    assert.ok(document.chunks.every((c) => c.embeddingStatus === "pending"), "New chunks should be pending embedding.");
    await assertAuditByAction(client, { tenantId, action: "ai.knowledge.document.create", resourceType: "knowledge_document" });
    await expectError(`/ai/knowledge/sources/${faqSource.id}/documents`, { method: "POST", accessToken: viewerSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { title: "x", content: "y" } });

    log("Validating document detail, chunk listing, and embedding placeholder.");
    const detail = await request(`/ai/knowledge/documents/${document.id}`, { accessToken: viewerSession.accessToken });
    assert.equal(detail.document.content, docContent, "Document content should round-trip.");
    assert.deepEqual(detail.document.metadata, { topic: "password" }, "Document metadata should round-trip.");
    const chunkList = await request(`/ai/knowledge/documents/${document.id}/chunks`, { accessToken: viewerSession.accessToken });
    assert.equal(chunkList.chunks.length, document.chunkCount);
    await expectError(`/ai/knowledge/documents/${document.id}/process`, { method: "POST", accessToken: viewerSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN" });
    const processed = (await request(`/ai/knowledge/documents/${document.id}/process`, { method: "POST", accessToken: adminSession.accessToken })).document;
    assert.equal(processed.status, "embedded", "Processing should move the document to embedded.");
    assert.ok(processed.chunks.every((c) => c.embeddingStatus === "placeholder"), "Processed chunks should be placeholder-embedded.");
    assert.ok(processed.chunks.every((c) => c.embeddingModel === "text-embedding-3-large"), "Processed chunks should record the configured embedding model.");
    assert.ok(processed.chunks.every((c) => c.embeddingRef.startsWith("placeholder://")), "Processed chunks should record a vector reference.");
    assert.ok(processed.chunks.every((c) => c.embeddingRef.includes(document.id) && c.embeddingRef.endsWith(`/${c.chunkIndex}`)), "The vector reference should locate the document and chunk.");
    const docList = await request(`/ai/knowledge/documents?sourceId=${faqSource.id}&pageSize=100`, { accessToken: adminSession.accessToken });
    assert.ok(docList.documents.some((d) => d.id === document.id), "Document list should be filterable by source.");
    await expectError(`/ai/knowledge/documents/${randomUUID()}`, { accessToken: adminSession.accessToken, expectedStatus: 404, expectedCode: "KNOWLEDGE_DOCUMENT_NOT_FOUND" });

    log("Ingesting a restricted customer document for permission-aware retrieval.");
    await request(`/ai/knowledge/sources/${customerSource.id}/documents`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { title: `Customer secret ${runToken}`, content: "This restricted customer record references the Sekretdokfoo confidential identifier and onboarding terms." } });

    // ----------------------------------------------------------------------
    // Articles
    // ----------------------------------------------------------------------
    log("Creating and versioning a knowledge article.");
    const articleKey = `kb-onboarding-${runToken}`;
    const article = (await request("/ai/knowledge/articles", { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { articleKey, title: "Onboarding overview", body: "The Quibblefyx onboarding flow guides new customers through setup.", summary: "Onboarding." } })).article;
    assert.equal(article.status, "draft");
    assert.equal(article.isPublished, false);
    assert.equal(article.currentVersion, 1);
    assert.equal(article.versions.length, 1);
    assert.equal(article.createdBy, adminSession.currentUser.id, "Article authorship should be tracked.");
    assert.equal(article.updatedBy, adminSession.currentUser.id, "Article updatedBy should be set on creation.");
    assert.equal(article.versions[0].createdBy, adminSession.currentUser.id, "Version authorship should be tracked.");
    await assertAuditByAction(client, { tenantId, action: "ai.knowledge.article.create", resourceType: "knowledge_article" });
    await expectError("/ai/knowledge/articles", { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 409, expectedCode: "KNOWLEDGE_ARTICLE_KEY_EXISTS", body: { articleKey, title: "Dup", body: "x" } });
    await expectError("/ai/knowledge/articles", { method: "POST", accessToken: viewerSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { articleKey: `nope-${runToken}`, title: "Nope", body: "x" } });

    log("Validating article editing and not-found handling.");
    const editedArticle = (await request(`/ai/knowledge/articles/${article.id}`, { method: "PATCH", accessToken: adminSession.accessToken, body: { category: "onboarding", sourceId: faqSource.id } })).article;
    assert.equal(editedArticle.category, "onboarding", "Article metadata should update.");
    assert.equal(editedArticle.sourceId, faqSource.id, "Article source link should update.");
    await expectError(`/ai/knowledge/articles/${article.id}`, { method: "PATCH", accessToken: adminSession.accessToken, expectedStatus: 400, expectedCode: "VALIDATION_ERROR", body: {} });
    await expectError(`/ai/knowledge/articles/${article.id}`, { method: "PATCH", accessToken: adminSession.accessToken, expectedStatus: 404, expectedCode: "KNOWLEDGE_SOURCE_NOT_FOUND", body: { sourceId: randomUUID() } });
    await expectError(`/ai/knowledge/articles/${randomUUID()}`, { accessToken: adminSession.accessToken, expectedStatus: 404, expectedCode: "KNOWLEDGE_ARTICLE_NOT_FOUND" });

    const versioned = (await request(`/ai/knowledge/articles/${article.id}/versions`, { method: "POST", accessToken: authorSession.accessToken, expectedStatus: 201, body: { body: "The Quibblefyx onboarding flow (v2) guides new customers through setup and training.", activate: true } })).article;
    assert.equal(versioned.currentVersion, 2, "Activating a version should move the pointer.");
    assert.equal(versioned.status, "draft", "A new active version resets status to draft.");
    assert.equal(versioned.isPublished, false, "A new active version unpublishes the article.");
    assert.equal(versioned.updatedBy, authorSession.currentUser.id, "updatedBy should track the version author.");
    assert.equal(versioned.versions.find((v) => v.version === 1).body, "The Quibblefyx onboarding flow guides new customers through setup.", "Older article versions must remain immutable.");
    assert.equal(versioned.versions.find((v) => v.version === 2).createdBy, authorSession.currentUser.id, "New version authorship should be tracked.");

    log("Validating approval-gated publishing.");
    await expectError(`/ai/knowledge/articles/${article.id}/status`, { method: "POST", accessToken: authorSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { status: "approved" } });
    await expectError(`/ai/knowledge/articles/${article.id}/status`, { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 400, expectedCode: "KNOWLEDGE_ARTICLE_NOT_APPROVED", body: { status: "draft", isPublished: true } });
    const approved = (await request(`/ai/knowledge/articles/${article.id}/status`, { method: "POST", accessToken: adminSession.accessToken, body: { status: "approved" } })).article;
    assert.equal(approved.status, "approved");
    assert.equal(approved.isPublished, false, "Approval alone does not publish.");
    assert.equal(approved.versions.find((v) => v.version === approved.currentVersion).status, "approved", "The current version should carry the approved status.");
    const published = (await request(`/ai/knowledge/articles/${article.id}/status`, { method: "POST", accessToken: adminSession.accessToken, body: { status: "approved", isPublished: true } })).article;
    assert.equal(published.isPublished, true, "An approved article can be published.");

    log("Creating an unapproved article that must not be retrievable.");
    await request("/ai/knowledge/articles", { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 201, body: { articleKey: `kb-draft-${runToken}`, title: "Draft note", body: "This Wuzzleflorp draft note is not approved for retrieval." } });

    // ----------------------------------------------------------------------
    // Retrieval
    // ----------------------------------------------------------------------
    log("Validating retrieval, citations, and permission gating.");
    await expectError("/ai/rag/retrieve", { method: "POST", accessToken: outsiderSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { query: "password" } });
    await expectError("/ai/rag/retrieve", { method: "POST", accessToken: adminSession.accessToken, expectedStatus: 400, expectedCode: "VALIDATION_ERROR", body: { query: "" } });

    const docRetrieval = await request("/ai/rag/retrieve", { method: "POST", accessToken: adminSession.accessToken, body: { query: "Zorptokenreset password", topK: 5 } });
    assert.ok(docRetrieval.citations.length >= 1, "Retrieval should return document citations.");
    const docCitation = docRetrieval.citations.find((c) => c.kind === "document");
    assert.ok(docCitation, "A document citation should be present.");
    assert.ok(docCitation.sourceId && docCitation.sourceName, "Citations must carry their source.");
    assert.ok(docCitation.sourceType, "Document citations must carry the source type.");
    assert.ok(docCitation.documentId && docCitation.documentTitle && docCitation.chunkIndex !== null, "Document citations must reference the document and chunk.");
    assert.ok(docCitation.score > 0 && docCitation.snippet.length > 0, "Citations should carry a score and snippet.");
    assert.ok(docRetrieval.citations.every((c, i) => i === 0 || docRetrieval.citations[i - 1].score >= c.score), "Citations should be ordered by descending score.");
    assert.equal(docRetrieval.retrieval.deferred, true, "Retrieval should report deferred embeddings.");
    assert.equal(docRetrieval.retrieval.strategy, "keyword_placeholder", "Retrieval should report its placeholder strategy.");
    assert.ok(docRetrieval.retrieval.vectorBackend.length > 0 && docRetrieval.retrieval.embeddingModel.length > 0);
    assert.ok(docRetrieval.accessibleSourceCount >= 6, "Accessible sources should be reported.");
    assert.ok(docRetrieval.restrictedSourceCount >= 3, "Restricted sources should be counted (admin/support/customer gated).");
    await assertAuditByAction(client, { tenantId, action: "ai.rag.retrieve", resourceType: "rag_query" });

    const articleRetrieval = await request("/ai/rag/retrieve", { method: "POST", accessToken: adminSession.accessToken, body: { query: "Quibblefyx onboarding" } });
    const articleCitation = articleRetrieval.citations.find((c) => c.kind === "article" && c.articleTitle === "Onboarding overview");
    assert.ok(articleCitation, "Approved, published articles should be retrievable.");
    assert.ok(articleCitation.articleId, "Article citations must carry the article id.");

    log("Validating retrieval filters (includeArticles, sourceTypes, topK).");
    const docsOnly = await request("/ai/rag/retrieve", { method: "POST", accessToken: adminSession.accessToken, body: { query: "Quibblefyx onboarding password", includeArticles: false } });
    assert.ok(!docsOnly.citations.some((c) => c.kind === "article"), "includeArticles=false should suppress article citations.");
    const faqOnly = await request("/ai/rag/retrieve", { method: "POST", accessToken: adminSession.accessToken, body: { query: "Zorptokenreset", sourceTypes: ["faq"] } });
    assert.ok(faqOnly.citations.every((c) => c.kind !== "document" || c.sourceType === "faq"), "The sourceTypes filter should restrict document citations.");
    const capped = await request("/ai/rag/retrieve", { method: "POST", accessToken: adminSession.accessToken, body: { query: "Zorptokenreset password", topK: 1 } });
    assert.ok(capped.citations.length <= 1, "topK should cap the number of citations.");
    assert.equal(capped.topK, 1, "Retrieval should echo the effective topK.");

    const unapprovedRetrieval = await request("/ai/rag/retrieve", { method: "POST", accessToken: adminSession.accessToken, body: { query: "Wuzzleflorp" } });
    assert.ok(!unapprovedRetrieval.citations.some((c) => c.kind === "article"), "Unapproved articles must not be retrievable.");
    assert.equal(unapprovedRetrieval.gapLogged, true, "A query with no results should log a gap.");

    log("Validating permission-aware retrieval of restricted sources.");
    const adminRestricted = await request("/ai/rag/retrieve", { method: "POST", accessToken: adminSession.accessToken, body: { query: "Sekretdokfoo" } });
    assert.equal(adminRestricted.citations.length, 0, "A user without the gating permission must not retrieve restricted content.");
    const privRestricted = await request("/ai/rag/retrieve", { method: "POST", accessToken: privSession.accessToken, body: { query: "Sekretdokfoo" } });
    assert.ok(privRestricted.citations.length >= 1, "A user with the gating permission should retrieve restricted content.");
    assert.ok(privRestricted.citations.some((c) => c.sourceName === "Customer-specific documents"), "Restricted citation should name the customer source.");

    log("Validating knowledge gap logging.");
    const nonsense = `Xyzzyplugh${runToken}`;
    const gapRetrieval = await request("/ai/rag/retrieve", { method: "POST", accessToken: viewerSession.accessToken, body: { query: nonsense } });
    assert.equal(gapRetrieval.citations.length, 0);
    assert.equal(gapRetrieval.gapLogged, true);
    const gaps = await request("/ai/knowledge/gaps", { accessToken: adminSession.accessToken });
    assert.ok(gaps.gaps.some((g) => g.queryText === nonsense && g.detectedSource === "retrieval"), "The nonsense query should be logged as a retrieval gap.");

    log("Validating knowledge gap management.");
    await expectError("/ai/knowledge/gaps", { method: "POST", accessToken: viewerSession.accessToken, expectedStatus: 403, expectedCode: "FORBIDDEN", body: { queryText: "x" } });
    const manualGap = (await request("/ai/knowledge/gaps", { method: "POST", accessToken: authorSession.accessToken, expectedStatus: 201, body: { queryText: `Manual gap ${runToken}`, detectedSource: "manual" } })).gap;
    assert.equal(manualGap.status, "open", "A new gap should open.");
    assert.equal(manualGap.detectedSource, "manual");
    assert.equal(manualGap.occurrenceCount, 1);
    const resolvedGap = (await request(`/ai/knowledge/gaps/${manualGap.id}`, { method: "PATCH", accessToken: authorSession.accessToken, body: { status: "resolved", resolutionNote: "Documented in the FAQ." } })).gap;
    assert.equal(resolvedGap.status, "resolved", "Gap status should update.");
    assert.equal(resolvedGap.resolutionNote, "Documented in the FAQ.", "Resolution note should persist.");
    const statusFiltered = await request("/ai/knowledge/gaps?status=resolved", { accessToken: adminSession.accessToken });
    assert.ok(statusFiltered.gaps.every((g) => g.status === "resolved"), "Gap status filter should be applied.");
    await expectError(`/ai/knowledge/gaps/${manualGap.id}`, { method: "PATCH", accessToken: authorSession.accessToken, expectedStatus: 400, expectedCode: "VALIDATION_ERROR", body: {} });
    await expectError(`/ai/knowledge/gaps/${randomUUID()}`, { method: "PATCH", accessToken: authorSession.accessToken, expectedStatus: 404, expectedCode: "KNOWLEDGE_GAP_NOT_FOUND", body: { status: "open" } });

    // ----------------------------------------------------------------------
    // Tenant isolation
    // ----------------------------------------------------------------------
    log("Checking tenant isolation for sources, documents, and retrieval.");
    const secondTenantId = (await client.query(`INSERT INTO tenants (slug, name, status, metadata) VALUES ($1, $2, 'active', jsonb_build_object('testRun', $3::text)) RETURNING id`, [`phase20-${runToken}-tenant`, `Phase 20 Tenant ${runToken}`, runToken])).rows[0].id;
    const otherSourceId = (await client.query(`INSERT INTO knowledge_sources (tenant_id, source_key, name, source_type) VALUES ($1, $2, 'Other FAQ', 'faq') RETURNING id`, [secondTenantId, `isolated-src-${runToken}`])).rows[0].id;
    const otherDocId = (await client.query(`INSERT INTO knowledge_documents (tenant_id, source_id, title, content, status, chunk_count) VALUES ($1, $2, 'Other doc', 'isolated', 'chunked', 1) RETURNING id`, [secondTenantId, otherSourceId])).rows[0].id;
    await client.query(`INSERT INTO knowledge_chunks (tenant_id, document_id, source_id, chunk_index, content) VALUES ($1, $2, $3, 0, 'This Tenantbleedtest content belongs to another tenant.')`, [secondTenantId, otherDocId, otherSourceId]);

    await expectError(`/ai/knowledge/sources/${otherSourceId}`, { accessToken: adminSession.accessToken, expectedStatus: 404, expectedCode: "KNOWLEDGE_SOURCE_NOT_FOUND" });
    const isolationRetrieval = await request("/ai/rag/retrieve", { method: "POST", accessToken: adminSession.accessToken, body: { query: "Tenantbleedtest" } });
    assert.equal(isolationRetrieval.citations.length, 0, "Another tenant's knowledge must not be retrievable.");

    log("Phase 20 RAG knowledge system checks passed.");
  } finally {
    await client.end();
  }
}

await main();
