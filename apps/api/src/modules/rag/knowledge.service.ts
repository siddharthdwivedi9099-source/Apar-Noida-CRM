import {
  chunkEmbeddingStatuses,
  defaultKnowledgeSources,
  knowledgeAccessScopes,
  knowledgeArticleStatuses,
  knowledgeContentFormats,
  knowledgeDocumentStatuses,
  knowledgeGapStatuses,
  knowledgeSourceTypes,
  type ChunkEmbeddingStatus,
  type CreateKnowledgeArticleRequestBody,
  type CreateKnowledgeArticleVersionRequestBody,
  type CreateKnowledgeDocumentRequestBody,
  type CreateKnowledgeGapRequestBody,
  type CreateKnowledgeSourceRequestBody,
  type KnowledgeAccessScope,
  type KnowledgeArticleDetail,
  type KnowledgeArticleListQuery,
  type KnowledgeArticleListResponse,
  type KnowledgeArticleResponse,
  type KnowledgeArticleStatus,
  type KnowledgeArticleSummary,
  type KnowledgeArticleVersion,
  type KnowledgeChunk,
  type KnowledgeChunkListResponse,
  type KnowledgeContentFormat,
  type KnowledgeDocumentDetail,
  type KnowledgeDocumentListQuery,
  type KnowledgeDocumentListResponse,
  type KnowledgeDocumentResponse,
  type KnowledgeDocumentStatus,
  type KnowledgeDocumentSummary,
  type KnowledgeGap,
  type KnowledgeGapListQuery,
  type KnowledgeGapListResponse,
  type KnowledgeGapResponse,
  type KnowledgeGapStatus,
  type KnowledgeSource,
  type KnowledgeSourceListQuery,
  type KnowledgeSourceListResponse,
  type KnowledgeSourceResponse,
  type KnowledgeSourceType,
  type RoleSummary,
  type UpdateKnowledgeArticleRequestBody,
  type UpdateKnowledgeArticleStatusRequestBody,
  type UpdateKnowledgeGapRequestBody,
  type UpdateKnowledgeSourceRequestBody
} from "@crm/types";
import type { PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { chunkText, estimateTokens } from "./chunking.js";

interface AuditMetadata {
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

interface ActorContext {
  userId: string;
  tenantId: string;
  sessionId: string;
  email: string;
  displayName: string;
  permissionCodes: string[];
  roles: RoleSummary[];
}

export interface KnowledgeConfig {
  enableAuditLogs: boolean;
  embeddingModel: string;
  vectorBackend: string;
}

const CREATE_PERMISSIONS = ["ai.create", "ai.configure", "ai.manage_ai"];
const EDIT_PERMISSIONS = ["ai.edit", "ai.configure", "ai.manage_ai"];
const APPROVE_PERMISSIONS = ["ai.approve", "ai.configure", "ai.manage_ai"];

function oneOf<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return allowed.includes(value as T[number]) ? (value as T[number]) : fallback;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export class KnowledgeService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: KnowledgeConfig
  ) {}

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "The knowledge system is unavailable until the database connection is enabled.", undefined, "RAG_UNAVAILABLE");
    }
  }

  private requirePermission(actor: ActorContext, permissions: string[], message: string) {
    if (!permissions.some((code) => actor.permissionCodes.includes(code))) {
      throw new AppError(403, message, undefined, "AUTHORIZATION_ERROR");
    }
  }

  private async recordAuditLog(client: PoolClient, actor: ActorContext, audit: AuditMetadata, input: { action: string; resourceType: string; resourceId: string; metadata?: Record<string, unknown> }) {
    if (!this.config.enableAuditLogs) {
      return;
    }
    await client.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, session_id, event_type, action, resource_type, resource_id, status, ip_address, user_agent, request_id, metadata) VALUES ($1, $2, $3, 'ai', $4, $5, $6, 'success', NULLIF($7, '')::inet, $8, $9, $10::jsonb)`,
      [actor.tenantId, actor.userId, actor.sessionId, input.action, input.resourceType, input.resourceId, audit.ipAddress ?? "", audit.userAgent ?? null, audit.requestId, JSON.stringify(input.metadata ?? {})]
    );
  }

  // -------------------------------------------------------------------------
  // Knowledge sources
  // -------------------------------------------------------------------------

  private mapSource(row: Record<string, unknown>): KnowledgeSource {
    return {
      id: row.id as string,
      sourceKey: row.source_key as string,
      name: row.name as string,
      description: row.description as string,
      sourceType: oneOf(row.source_type, knowledgeSourceTypes, "product_documentation"),
      accessScope: oneOf(row.access_scope, knowledgeAccessScopes, "tenant"),
      requiredPermission: (row.required_permission as string | null) ?? null,
      isEnabled: row.is_enabled as boolean,
      isSystem: row.is_system as boolean,
      documentCount: Number(row.document_count ?? 0),
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
      createdBy: (row.created_by as string | null) ?? null,
      updatedBy: (row.updated_by as string | null) ?? null
    };
  }

  private async ensureSeeded(client: PoolClient, actor: ActorContext) {
    for (const source of defaultKnowledgeSources) {
      await client.query(
        `INSERT INTO knowledge_sources (tenant_id, source_key, name, description, source_type, access_scope, required_permission, is_enabled, is_system, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, TRUE, $8, $8)
         ON CONFLICT DO NOTHING`,
        [actor.tenantId, source.key, source.name, source.description, source.sourceType, source.accessScope, source.requiredPermission, actor.userId]
      );
    }
  }

  async listSources(actor: ActorContext, query: KnowledgeSourceListQuery): Promise<KnowledgeSourceListResponse> {
    this.assertEnabled();
    const sources = await this.databaseService.withTransaction(async (client) => {
      await this.ensureSeeded(client, actor);
      const conditions = ["s.tenant_id = $1", "s.deleted_at IS NULL"];
      const params: unknown[] = [actor.tenantId];
      if (query.sourceType) {
        params.push(query.sourceType);
        conditions.push(`s.source_type = $${params.length}`);
      }
      if (query.isEnabled === "true" || query.isEnabled === "false") {
        params.push(query.isEnabled === "true");
        conditions.push(`s.is_enabled = $${params.length}`);
      }
      if (query.search) {
        params.push(`%${query.search.toLowerCase()}%`);
        conditions.push(`(LOWER(s.name) LIKE $${params.length} OR LOWER(s.source_key) LIKE $${params.length})`);
      }
      const result = await client.query(
        `SELECT s.*, (SELECT COUNT(*) FROM knowledge_documents d WHERE d.source_id = s.id AND d.tenant_id = s.tenant_id AND d.deleted_at IS NULL) AS document_count
         FROM knowledge_sources s WHERE ${conditions.join(" AND ")} ORDER BY s.name ASC`,
        params
      );
      return result.rows.map((row) => this.mapSource(row));
    });
    return { sources };
  }

  private async loadSourceRow(client: PoolClient, tenantId: string, sourceId: string) {
    const result = await client.query(
      `SELECT s.*, (SELECT COUNT(*) FROM knowledge_documents d WHERE d.source_id = s.id AND d.tenant_id = s.tenant_id AND d.deleted_at IS NULL) AS document_count
       FROM knowledge_sources s WHERE s.id = $1 AND s.tenant_id = $2 AND s.deleted_at IS NULL LIMIT 1`,
      [sourceId, tenantId]
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, "The requested knowledge source was not found.", undefined, "KNOWLEDGE_SOURCE_NOT_FOUND");
    }
    return row;
  }

  async getSource(actor: ActorContext, sourceId: string): Promise<KnowledgeSourceResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => ({ source: this.mapSource(await this.loadSourceRow(client, actor.tenantId, sourceId)) }));
  }

  async createSource(actor: ActorContext, audit: AuditMetadata, input: CreateKnowledgeSourceRequestBody): Promise<KnowledgeSourceResponse> {
    this.assertEnabled();
    this.requirePermission(actor, CREATE_PERMISSIONS, "You do not have permission to create knowledge sources.");
    const sourceKey = input.sourceKey.trim().toLowerCase();
    const accessScope: KnowledgeAccessScope = oneOf(input.accessScope, knowledgeAccessScopes, "tenant");
    const sourceType: KnowledgeSourceType = oneOf(input.sourceType, knowledgeSourceTypes, "product_documentation");

    const source = await this.databaseService.withTransaction(async (client) => {
      const existing = await client.query(`SELECT id FROM knowledge_sources WHERE tenant_id = $1 AND source_key = $2 AND deleted_at IS NULL LIMIT 1`, [actor.tenantId, sourceKey]);
      if (existing.rows[0]) {
        throw new AppError(409, "A knowledge source with this key already exists.", undefined, "KNOWLEDGE_SOURCE_KEY_EXISTS");
      }
      const inserted = await client.query(
        `INSERT INTO knowledge_sources (tenant_id, source_key, name, description, source_type, access_scope, required_permission, is_enabled, is_system, metadata, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, $9::jsonb, $10, $10) RETURNING *, 0 AS document_count`,
        [actor.tenantId, sourceKey, input.name.trim(), (input.description ?? "").trim(), sourceType, accessScope, input.requiredPermission ?? null, input.isEnabled ?? true, JSON.stringify(input.metadata ?? {}), actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "ai.knowledge.source.create", resourceType: "knowledge_source", resourceId: inserted.rows[0].id, metadata: { sourceKey } });
      return this.mapSource(inserted.rows[0]);
    });

    return { source };
  }

  async updateSource(actor: ActorContext, audit: AuditMetadata, sourceId: string, input: UpdateKnowledgeSourceRequestBody): Promise<KnowledgeSourceResponse> {
    this.assertEnabled();
    this.requirePermission(actor, EDIT_PERMISSIONS, "You do not have permission to update knowledge sources.");

    const source = await this.databaseService.withTransaction(async (client) => {
      await this.loadSourceRow(client, actor.tenantId, sourceId);
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateKnowledgeSourceRequestBody] !== undefined);
      if (keys.length === 0) {
        throw new AppError(400, "At least one field must be updated.", undefined, "VALIDATION_ERROR");
      }
      const assignments: string[] = [];
      const params: unknown[] = [sourceId, actor.tenantId, actor.userId];
      const push = (column: string, value: unknown, cast = "") => {
        params.push(value);
        assignments.push(`${column} = $${params.length}${cast}`);
      };
      if (input.name !== undefined) push("name", input.name.trim());
      if (input.description !== undefined) push("description", input.description.trim());
      if (input.accessScope !== undefined) push("access_scope", oneOf(input.accessScope, knowledgeAccessScopes, "tenant"));
      if (input.requiredPermission !== undefined) push("required_permission", input.requiredPermission);
      if (input.isEnabled !== undefined) push("is_enabled", Boolean(input.isEnabled));
      if (input.metadata !== undefined) push("metadata", JSON.stringify(input.metadata), "::jsonb");
      await client.query(`UPDATE knowledge_sources SET ${assignments.join(", ")}, updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, params);
      await this.recordAuditLog(client, actor, audit, { action: "ai.knowledge.source.update", resourceType: "knowledge_source", resourceId: sourceId, metadata: { updatedFields: keys } });
      return this.mapSource(await this.loadSourceRow(client, actor.tenantId, sourceId));
    });

    return { source };
  }

  // -------------------------------------------------------------------------
  // Documents + chunking
  // -------------------------------------------------------------------------

  private mapDocumentSummary(row: Record<string, unknown>): KnowledgeDocumentSummary {
    return {
      id: row.id as string,
      sourceId: row.source_id as string,
      title: row.title as string,
      summary: row.summary as string,
      contentFormat: oneOf(row.content_format, knowledgeContentFormats, "text"),
      sourceUri: row.source_uri as string,
      status: oneOf(row.status, knowledgeDocumentStatuses, "pending"),
      chunkCount: Number(row.chunk_count ?? 0),
      tokenEstimate: Number(row.token_estimate ?? 0),
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
      createdBy: (row.created_by as string | null) ?? null,
      updatedBy: (row.updated_by as string | null) ?? null
    };
  }

  private mapChunk(row: Record<string, unknown>): KnowledgeChunk {
    return {
      id: row.id as string,
      documentId: row.document_id as string,
      sourceId: row.source_id as string,
      chunkIndex: Number(row.chunk_index),
      content: row.content as string,
      tokenEstimate: Number(row.token_estimate ?? 0),
      embeddingStatus: oneOf(row.embedding_status, chunkEmbeddingStatuses, "pending") as ChunkEmbeddingStatus,
      embeddingModel: row.embedding_model as string,
      embeddingRef: row.embedding_ref as string,
      createdAt: (row.created_at as Date).toISOString()
    };
  }

  private async loadDocumentRow(client: PoolClient, tenantId: string, documentId: string) {
    const result = await client.query(`SELECT * FROM knowledge_documents WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [documentId, tenantId]);
    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, "The requested document was not found.", undefined, "KNOWLEDGE_DOCUMENT_NOT_FOUND");
    }
    return row;
  }

  private async loadChunks(client: PoolClient, tenantId: string, documentId: string) {
    const result = await client.query(`SELECT * FROM knowledge_chunks WHERE tenant_id = $1 AND document_id = $2 ORDER BY chunk_index ASC`, [tenantId, documentId]);
    return result.rows.map((row) => this.mapChunk(row));
  }

  private async buildDocumentDetail(client: PoolClient, tenantId: string, row: Record<string, unknown>): Promise<KnowledgeDocumentDetail> {
    const chunks = await this.loadChunks(client, tenantId, row.id as string);
    return { ...this.mapDocumentSummary(row), content: row.content as string, metadata: asObject(row.metadata), chunks };
  }

  async createDocument(actor: ActorContext, audit: AuditMetadata, sourceId: string, input: CreateKnowledgeDocumentRequestBody): Promise<KnowledgeDocumentResponse> {
    this.assertEnabled();
    this.requirePermission(actor, CREATE_PERMISSIONS, "You do not have permission to add documents.");
    const contentFormat: KnowledgeContentFormat = oneOf(input.contentFormat, knowledgeContentFormats, "text");

    const document = await this.databaseService.withTransaction(async (client) => {
      await this.loadSourceRow(client, actor.tenantId, sourceId);
      const chunks = chunkText(input.content);
      const tokenEstimate = estimateTokens(input.content);
      const inserted = await client.query(
        `INSERT INTO knowledge_documents (tenant_id, source_id, title, summary, content, content_format, source_uri, status, chunk_count, token_estimate, metadata, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'chunked', $8, $9, $10::jsonb, $11, $11) RETURNING *`,
        [actor.tenantId, sourceId, input.title.trim(), (input.summary ?? "").trim(), input.content, contentFormat, (input.sourceUri ?? "").trim(), chunks.length, tokenEstimate, JSON.stringify(input.metadata ?? {}), actor.userId]
      );
      const documentRow = inserted.rows[0];
      // Document chunking: each chunk is persisted with an embedding status of
      // 'pending' until the embedding placeholder runs.
      for (let index = 0; index < chunks.length; index += 1) {
        await client.query(
          `INSERT INTO knowledge_chunks (tenant_id, document_id, source_id, chunk_index, content, token_estimate, embedding_status) VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
          [actor.tenantId, documentRow.id, sourceId, index, chunks[index], estimateTokens(chunks[index])]
        );
      }
      await this.recordAuditLog(client, actor, audit, { action: "ai.knowledge.document.create", resourceType: "knowledge_document", resourceId: documentRow.id, metadata: { sourceId, chunkCount: chunks.length } });
      return this.buildDocumentDetail(client, actor.tenantId, documentRow);
    });

    return { document };
  }

  async listDocuments(actor: ActorContext, query: KnowledgeDocumentListQuery): Promise<KnowledgeDocumentListResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const page = Math.max(1, query.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
      const conditions = ["tenant_id = $1", "deleted_at IS NULL"];
      const params: unknown[] = [actor.tenantId];
      if (query.sourceId) {
        params.push(query.sourceId);
        conditions.push(`source_id = $${params.length}`);
      }
      if (query.status) {
        params.push(query.status);
        conditions.push(`status = $${params.length}`);
      }
      if (query.search) {
        params.push(`%${query.search.toLowerCase()}%`);
        conditions.push(`LOWER(title) LIKE $${params.length}`);
      }
      const whereClause = conditions.join(" AND ");
      const countResult = await client.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM knowledge_documents WHERE ${whereClause}`, params);
      const total = Number(countResult.rows[0]?.total ?? "0");
      const listParams = [...params, pageSize, (page - 1) * pageSize];
      const listResult = await client.query(`SELECT * FROM knowledge_documents WHERE ${whereClause} ORDER BY updated_at DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`, listParams);
      const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
      return {
        documents: listResult.rows.map((row) => this.mapDocumentSummary(row)),
        pagination: { page, pageSize, total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 }
      };
    });
  }

  async getDocument(actor: ActorContext, documentId: string): Promise<KnowledgeDocumentResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const row = await this.loadDocumentRow(client, actor.tenantId, documentId);
      return { document: await this.buildDocumentDetail(client, actor.tenantId, row) };
    });
  }

  async listChunks(actor: ActorContext, documentId: string): Promise<KnowledgeChunkListResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      await this.loadDocumentRow(client, actor.tenantId, documentId);
      return { documentId, chunks: await this.loadChunks(client, actor.tenantId, documentId) };
    });
  }

  // Embedding generation through the AI Gateway is deferred: this marks chunks
  // as placeholder-embedded and records a vector-storage reference for each.
  async processDocument(actor: ActorContext, audit: AuditMetadata, documentId: string): Promise<KnowledgeDocumentResponse> {
    this.assertEnabled();
    this.requirePermission(actor, EDIT_PERMISSIONS, "You do not have permission to process documents.");

    const document = await this.databaseService.withTransaction(async (client) => {
      const row = await this.loadDocumentRow(client, actor.tenantId, documentId);
      await client.query(
        `UPDATE knowledge_chunks SET embedding_status = 'placeholder', embedding_model = $3, embedding_ref = $4 || tenant_id::text || '/' || document_id::text || '/' || chunk_index::text
         WHERE tenant_id = $1 AND document_id = $2`,
        [actor.tenantId, documentId, this.config.embeddingModel, `${this.config.vectorBackend}://`]
      );
      await client.query(`UPDATE knowledge_documents SET status = 'embedded', updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [documentId, actor.tenantId, actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "ai.knowledge.document.process", resourceType: "knowledge_document", resourceId: documentId, metadata: { embeddingModel: this.config.embeddingModel, vectorBackend: this.config.vectorBackend } });
      const updated = await this.loadDocumentRow(client, actor.tenantId, documentId);
      void row;
      return this.buildDocumentDetail(client, actor.tenantId, updated);
    });

    return { document };
  }

  // -------------------------------------------------------------------------
  // Articles
  // -------------------------------------------------------------------------

  private mapArticleSummary(row: Record<string, unknown>): KnowledgeArticleSummary {
    return {
      id: row.id as string,
      articleKey: row.article_key as string,
      title: row.title as string,
      summary: row.summary as string,
      category: row.category as string,
      status: oneOf(row.status, knowledgeArticleStatuses, "draft"),
      isPublished: row.is_published as boolean,
      currentVersion: Number(row.current_version),
      latestVersion: Number(row.latest_version),
      sourceId: (row.source_id as string | null) ?? null,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
      createdBy: (row.created_by as string | null) ?? null,
      updatedBy: (row.updated_by as string | null) ?? null
    };
  }

  private mapArticleVersion(row: Record<string, unknown>): KnowledgeArticleVersion {
    return {
      id: row.id as string,
      version: Number(row.version),
      title: row.title as string,
      summary: row.summary as string,
      body: row.body as string,
      changeSummary: row.change_summary as string,
      status: oneOf(row.status, knowledgeArticleStatuses, "draft"),
      isActive: row.is_active as boolean,
      createdAt: (row.created_at as Date).toISOString(),
      createdBy: (row.created_by as string | null) ?? null
    };
  }

  private async loadArticleRow(client: PoolClient, tenantId: string, articleId: string) {
    const result = await client.query(`SELECT * FROM knowledge_articles WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [articleId, tenantId]);
    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, "The requested knowledge article was not found.", undefined, "KNOWLEDGE_ARTICLE_NOT_FOUND");
    }
    return row;
  }

  private async loadArticleVersions(client: PoolClient, tenantId: string, articleId: string) {
    const result = await client.query(`SELECT * FROM knowledge_article_versions WHERE tenant_id = $1 AND article_id = $2 ORDER BY version DESC`, [tenantId, articleId]);
    return result.rows.map((row) => this.mapArticleVersion(row));
  }

  private async buildArticleDetail(client: PoolClient, tenantId: string, row: Record<string, unknown>): Promise<KnowledgeArticleDetail> {
    const versions = await this.loadArticleVersions(client, tenantId, row.id as string);
    return { ...this.mapArticleSummary(row), body: row.body as string, metadata: asObject(row.metadata), versions };
  }

  async createArticle(actor: ActorContext, audit: AuditMetadata, input: CreateKnowledgeArticleRequestBody): Promise<KnowledgeArticleResponse> {
    this.assertEnabled();
    this.requirePermission(actor, CREATE_PERMISSIONS, "You do not have permission to create knowledge articles.");
    const articleKey = input.articleKey.trim().toLowerCase();

    const article = await this.databaseService.withTransaction(async (client) => {
      const existing = await client.query(`SELECT id FROM knowledge_articles WHERE tenant_id = $1 AND article_key = $2 AND deleted_at IS NULL LIMIT 1`, [actor.tenantId, articleKey]);
      if (existing.rows[0]) {
        throw new AppError(409, "A knowledge article with this key already exists.", undefined, "KNOWLEDGE_ARTICLE_KEY_EXISTS");
      }
      if (input.sourceId) {
        await this.loadSourceRow(client, actor.tenantId, input.sourceId);
      }
      const inserted = await client.query(
        `INSERT INTO knowledge_articles (tenant_id, article_key, title, summary, body, category, status, is_published, current_version, latest_version, source_id, metadata, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'draft', FALSE, 1, 1, $7, $8::jsonb, $9, $9) RETURNING *`,
        [actor.tenantId, articleKey, input.title.trim(), (input.summary ?? "").trim(), input.body, (input.category ?? "general").trim(), input.sourceId ?? null, JSON.stringify(input.metadata ?? {}), actor.userId]
      );
      const articleRow = inserted.rows[0];
      await client.query(
        `INSERT INTO knowledge_article_versions (tenant_id, article_id, version, title, summary, body, change_summary, status, is_active, created_by)
         VALUES ($1, $2, 1, $3, $4, $5, $6, 'draft', TRUE, $7)`,
        [actor.tenantId, articleRow.id, input.title.trim(), (input.summary ?? "").trim(), input.body, (input.changeSummary ?? "Initial version").trim(), actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "ai.knowledge.article.create", resourceType: "knowledge_article", resourceId: articleRow.id, metadata: { articleKey } });
      return this.buildArticleDetail(client, actor.tenantId, articleRow);
    });

    return { article };
  }

  async listArticles(actor: ActorContext, query: KnowledgeArticleListQuery): Promise<KnowledgeArticleListResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const page = Math.max(1, query.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
      const conditions = ["tenant_id = $1", "deleted_at IS NULL"];
      const params: unknown[] = [actor.tenantId];
      if (query.status) {
        params.push(query.status);
        conditions.push(`status = $${params.length}`);
      }
      if (query.category) {
        params.push(query.category);
        conditions.push(`category = $${params.length}`);
      }
      if (query.search) {
        params.push(`%${query.search.toLowerCase()}%`);
        conditions.push(`(LOWER(title) LIKE $${params.length} OR LOWER(article_key) LIKE $${params.length})`);
      }
      const whereClause = conditions.join(" AND ");
      const countResult = await client.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM knowledge_articles WHERE ${whereClause}`, params);
      const total = Number(countResult.rows[0]?.total ?? "0");
      const listParams = [...params, pageSize, (page - 1) * pageSize];
      const listResult = await client.query(`SELECT * FROM knowledge_articles WHERE ${whereClause} ORDER BY updated_at DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`, listParams);
      const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
      return {
        articles: listResult.rows.map((row) => this.mapArticleSummary(row)),
        pagination: { page, pageSize, total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 }
      };
    });
  }

  async getArticle(actor: ActorContext, articleId: string): Promise<KnowledgeArticleResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const row = await this.loadArticleRow(client, actor.tenantId, articleId);
      return { article: await this.buildArticleDetail(client, actor.tenantId, row) };
    });
  }

  async updateArticle(actor: ActorContext, audit: AuditMetadata, articleId: string, input: UpdateKnowledgeArticleRequestBody): Promise<KnowledgeArticleResponse> {
    this.assertEnabled();
    this.requirePermission(actor, EDIT_PERMISSIONS, "You do not have permission to edit knowledge articles.");

    const article = await this.databaseService.withTransaction(async (client) => {
      await this.loadArticleRow(client, actor.tenantId, articleId);
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateKnowledgeArticleRequestBody] !== undefined);
      if (keys.length === 0) {
        throw new AppError(400, "At least one field must be updated.", undefined, "VALIDATION_ERROR");
      }
      const assignments: string[] = [];
      const params: unknown[] = [articleId, actor.tenantId, actor.userId];
      const push = (column: string, value: unknown, cast = "") => {
        params.push(value);
        assignments.push(`${column} = $${params.length}${cast}`);
      };
      if (input.title !== undefined) push("title", input.title.trim());
      if (input.summary !== undefined) push("summary", input.summary.trim());
      if (input.category !== undefined) push("category", input.category.trim());
      if (input.sourceId !== undefined) {
        if (input.sourceId) {
          await this.loadSourceRow(client, actor.tenantId, input.sourceId);
        }
        push("source_id", input.sourceId);
      }
      if (input.metadata !== undefined) push("metadata", JSON.stringify(input.metadata), "::jsonb");
      await client.query(`UPDATE knowledge_articles SET ${assignments.join(", ")}, updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, params);
      await this.recordAuditLog(client, actor, audit, { action: "ai.knowledge.article.update", resourceType: "knowledge_article", resourceId: articleId, metadata: { updatedFields: keys } });
      return this.buildArticleDetail(client, actor.tenantId, await this.loadArticleRow(client, actor.tenantId, articleId));
    });

    return { article };
  }

  async createArticleVersion(actor: ActorContext, audit: AuditMetadata, articleId: string, input: CreateKnowledgeArticleVersionRequestBody): Promise<KnowledgeArticleResponse> {
    this.assertEnabled();
    this.requirePermission(actor, EDIT_PERMISSIONS, "You do not have permission to version knowledge articles.");

    const article = await this.databaseService.withTransaction(async (client) => {
      const row = await this.loadArticleRow(client, actor.tenantId, articleId);
      const nextVersion = Number(row.latest_version) + 1;
      const title = (input.title ?? (row.title as string)).trim();
      const summary = (input.summary ?? (row.summary as string)).trim();
      await client.query(
        `INSERT INTO knowledge_article_versions (tenant_id, article_id, version, title, summary, body, change_summary, status, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9)`,
        [actor.tenantId, articleId, nextVersion, title, summary, input.body, (input.changeSummary ?? `Version ${nextVersion}`).trim(), input.activate === true, actor.userId]
      );
      // A new version resets review/publish state; an activated version becomes
      // the current content but the article returns to draft and is unpublished.
      if (input.activate === true) {
        await client.query(`UPDATE knowledge_article_versions SET is_active = (version = $3) WHERE tenant_id = $1 AND article_id = $2`, [actor.tenantId, articleId, nextVersion]);
        await client.query(
          `UPDATE knowledge_articles SET latest_version = $3, current_version = $3, title = $4, summary = $5, body = $6, status = 'draft', is_published = FALSE, updated_by = $7 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          [articleId, actor.tenantId, nextVersion, title, summary, input.body, actor.userId]
        );
      } else {
        await client.query(`UPDATE knowledge_articles SET latest_version = $3, updated_by = $4 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [articleId, actor.tenantId, nextVersion, actor.userId]);
      }
      await this.recordAuditLog(client, actor, audit, { action: "ai.knowledge.article.version", resourceType: "knowledge_article", resourceId: articleId, metadata: { version: nextVersion, activated: input.activate === true } });
      return this.buildArticleDetail(client, actor.tenantId, await this.loadArticleRow(client, actor.tenantId, articleId));
    });

    return { article };
  }

  async setArticleStatus(actor: ActorContext, audit: AuditMetadata, articleId: string, input: UpdateKnowledgeArticleStatusRequestBody): Promise<KnowledgeArticleResponse> {
    this.assertEnabled();
    this.requirePermission(actor, APPROVE_PERMISSIONS, "You do not have permission to change knowledge article status.");
    const status: KnowledgeArticleStatus = oneOf(input.status, knowledgeArticleStatuses, "draft");
    const publish = input.isPublished === true;
    // Governance: an article can only be published once approved.
    if (publish && status !== "approved") {
      throw new AppError(400, "A knowledge article must be approved before it can be published.", undefined, "KNOWLEDGE_ARTICLE_NOT_APPROVED");
    }
    const isPublished = status === "approved" ? publish : false;

    const article = await this.databaseService.withTransaction(async (client) => {
      const row = await this.loadArticleRow(client, actor.tenantId, articleId);
      await client.query(`UPDATE knowledge_articles SET status = $3, is_published = $4, updated_by = $5 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, [articleId, actor.tenantId, status, isPublished, actor.userId]);
      await client.query(`UPDATE knowledge_article_versions SET status = $4 WHERE tenant_id = $1 AND article_id = $2 AND version = $3`, [actor.tenantId, articleId, Number(row.current_version), status]);
      await this.recordAuditLog(client, actor, audit, { action: "ai.knowledge.article.status", resourceType: "knowledge_article", resourceId: articleId, metadata: { status, isPublished } });
      return this.buildArticleDetail(client, actor.tenantId, await this.loadArticleRow(client, actor.tenantId, articleId));
    });

    return { article };
  }

  // -------------------------------------------------------------------------
  // Knowledge gaps
  // -------------------------------------------------------------------------

  private mapGap(row: Record<string, unknown>): KnowledgeGap {
    return {
      id: row.id as string,
      queryText: row.query_text as string,
      detectedSource: oneOf(row.detected_source, ["retrieval", "support", "manual"] as const, "manual"),
      status: oneOf(row.status, knowledgeGapStatuses, "open") as KnowledgeGapStatus,
      resolutionNote: row.resolution_note as string,
      relatedArticleId: (row.related_article_id as string | null) ?? null,
      occurrenceCount: Number(row.occurrence_count ?? 1),
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
      createdBy: (row.created_by as string | null) ?? null,
      updatedBy: (row.updated_by as string | null) ?? null
    };
  }

  async listGaps(actor: ActorContext, query: KnowledgeGapListQuery): Promise<KnowledgeGapListResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const conditions = ["tenant_id = $1", "deleted_at IS NULL"];
      const params: unknown[] = [actor.tenantId];
      if (query.status) {
        params.push(query.status);
        conditions.push(`status = $${params.length}`);
      }
      if (query.search) {
        params.push(`%${query.search.toLowerCase()}%`);
        conditions.push(`LOWER(query_text) LIKE $${params.length}`);
      }
      const result = await client.query(`SELECT * FROM knowledge_gaps WHERE ${conditions.join(" AND ")} ORDER BY updated_at DESC LIMIT 200`, params);
      return { gaps: result.rows.map((row) => this.mapGap(row)) };
    });
  }

  async createGap(actor: ActorContext, audit: AuditMetadata, input: CreateKnowledgeGapRequestBody): Promise<KnowledgeGapResponse> {
    this.assertEnabled();
    this.requirePermission(actor, EDIT_PERMISSIONS, "You do not have permission to record knowledge gaps.");
    const gap = await this.databaseService.withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO knowledge_gaps (tenant_id, query_text, detected_source, related_article_id, metadata, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $6) RETURNING *`,
        [actor.tenantId, input.queryText.trim(), oneOf(input.detectedSource, ["retrieval", "support", "manual"] as const, "manual"), input.relatedArticleId ?? null, JSON.stringify(input.metadata ?? {}), actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "ai.knowledge.gap.create", resourceType: "knowledge_gap", resourceId: inserted.rows[0].id });
      return this.mapGap(inserted.rows[0]);
    });
    return { gap };
  }

  async updateGap(actor: ActorContext, audit: AuditMetadata, gapId: string, input: UpdateKnowledgeGapRequestBody): Promise<KnowledgeGapResponse> {
    this.assertEnabled();
    this.requirePermission(actor, EDIT_PERMISSIONS, "You do not have permission to update knowledge gaps.");
    const gap = await this.databaseService.withTransaction(async (client) => {
      const existing = await client.query(`SELECT id FROM knowledge_gaps WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [gapId, actor.tenantId]);
      if (!existing.rows[0]) {
        throw new AppError(404, "The requested knowledge gap was not found.", undefined, "KNOWLEDGE_GAP_NOT_FOUND");
      }
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateKnowledgeGapRequestBody] !== undefined);
      if (keys.length === 0) {
        throw new AppError(400, "At least one field must be updated.", undefined, "VALIDATION_ERROR");
      }
      const assignments: string[] = [];
      const params: unknown[] = [gapId, actor.tenantId, actor.userId];
      const push = (column: string, value: unknown) => {
        params.push(value);
        assignments.push(`${column} = $${params.length}`);
      };
      if (input.status !== undefined) push("status", oneOf(input.status, knowledgeGapStatuses, "open"));
      if (input.resolutionNote !== undefined) push("resolution_note", input.resolutionNote.trim());
      if (input.relatedArticleId !== undefined) push("related_article_id", input.relatedArticleId);
      await client.query(`UPDATE knowledge_gaps SET ${assignments.join(", ")}, updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, params);
      await this.recordAuditLog(client, actor, audit, { action: "ai.knowledge.gap.update", resourceType: "knowledge_gap", resourceId: gapId, metadata: { updatedFields: keys } });
      const updated = await client.query(`SELECT * FROM knowledge_gaps WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [gapId, actor.tenantId]);
      return this.mapGap(updated.rows[0]);
    });
    return { gap };
  }
}
