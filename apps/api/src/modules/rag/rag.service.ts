import {
  knowledgeSourceTypes,
  type RagCitation,
  type RagRetrieveRequestBody,
  type RagRetrieveResponse,
  type RoleSummary
} from "@crm/types";
import type { PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import { DatabaseService } from "../../platform/database/database.service.js";

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

export interface RagConfig {
  enableAuditLogs: boolean;
  embeddingModel: string;
  vectorBackend: string;
}

function tokenize(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((term) => term.trim())
        .filter((term) => term.length >= 3)
    )
  );
}

function scoreText(text: string, terms: string[]): number {
  const haystack = text.toLowerCase();
  let score = 0;
  for (const term of terms) {
    let index = haystack.indexOf(term);
    while (index !== -1) {
      score += 1;
      index = haystack.indexOf(term, index + term.length);
    }
  }
  return score;
}

function buildSnippet(text: string, terms: string[]): string {
  const haystack = text.toLowerCase();
  let position = -1;
  for (const term of terms) {
    const found = haystack.indexOf(term);
    if (found !== -1 && (position === -1 || found < position)) {
      position = found;
    }
  }
  if (position === -1) {
    return text.slice(0, 200).trim();
  }
  const start = Math.max(0, position - 60);
  const end = Math.min(text.length, position + 140);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

export class RagService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: RagConfig
  ) {}

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "Retrieval is unavailable until the database connection is enabled.", undefined, "RAG_UNAVAILABLE");
    }
  }

  private async recordAuditLog(client: PoolClient, actor: ActorContext, audit: AuditMetadata, metadata: Record<string, unknown>) {
    if (!this.config.enableAuditLogs) {
      return;
    }
    await client.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, session_id, event_type, action, resource_type, resource_id, status, ip_address, user_agent, request_id, metadata) VALUES ($1, $2, $3, 'ai', 'ai.rag.retrieve', 'rag_query', NULL, 'success', NULLIF($4, '')::inet, $5, $6, $7::jsonb)`,
      [actor.tenantId, actor.userId, actor.sessionId, audit.ipAddress ?? "", audit.userAgent ?? null, audit.requestId, JSON.stringify(metadata)]
    );
  }

  async retrieve(actor: ActorContext, audit: AuditMetadata, input: RagRetrieveRequestBody): Promise<RagRetrieveResponse> {
    this.assertEnabled();
    const query = input.query.trim();
    const topK = Math.min(20, Math.max(1, input.topK ?? 5));
    const includeArticles = input.includeArticles !== false;
    const sourceTypeFilter = (input.sourceTypes ?? []).filter((type) => knowledgeSourceTypes.includes(type));
    const terms = tokenize(query);

    return this.databaseService.withTransaction(async (client) => {
      // Permission-aware: only enabled sources the actor may access contribute.
      const sourceResult = await client.query(
        `SELECT id, name, source_type, required_permission FROM knowledge_sources WHERE tenant_id = $1 AND deleted_at IS NULL AND is_enabled = TRUE`,
        [actor.tenantId]
      );
      const accessibleSources = sourceResult.rows.filter((row) => !row.required_permission || actor.permissionCodes.includes(row.required_permission as string));
      const restrictedSourceCount = sourceResult.rows.length - accessibleSources.length;
      const accessibleSourceIds = accessibleSources
        .filter((row) => sourceTypeFilter.length === 0 || sourceTypeFilter.includes(row.source_type))
        .map((row) => row.id as string);

      const citations: RagCitation[] = [];

      if (terms.length > 0 && accessibleSourceIds.length > 0) {
        const patterns = terms.map((term) => `%${term}%`);
        const chunkResult = await client.query(
          `SELECT c.document_id, c.source_id, c.chunk_index, c.content, d.title AS document_title, s.name AS source_name, s.source_type
           FROM knowledge_chunks c
           JOIN knowledge_documents d ON d.id = c.document_id AND d.tenant_id = c.tenant_id AND d.deleted_at IS NULL
           JOIN knowledge_sources s ON s.id = c.source_id AND s.tenant_id = c.tenant_id AND s.deleted_at IS NULL
           WHERE c.tenant_id = $1 AND c.source_id = ANY($2::uuid[]) AND c.content ILIKE ANY($3::text[])
           LIMIT 300`,
          [actor.tenantId, accessibleSourceIds, patterns]
        );
        for (const row of chunkResult.rows) {
          const score = scoreText(row.content as string, terms);
          if (score <= 0) {
            continue;
          }
          citations.push({
            kind: "document",
            sourceId: row.source_id as string,
            sourceName: row.source_name as string,
            sourceType: row.source_type,
            documentId: row.document_id as string,
            documentTitle: row.document_title as string,
            articleId: null,
            articleTitle: null,
            chunkIndex: Number(row.chunk_index),
            snippet: buildSnippet(row.content as string, terms),
            score
          });
        }
      }

      if (includeArticles && terms.length > 0) {
        const patterns = terms.map((term) => `%${term}%`);
        const articleResult = await client.query(
          `SELECT a.id, a.title, a.summary, a.body, a.source_id, s.name AS source_name, s.source_type, s.required_permission
           FROM knowledge_articles a
           LEFT JOIN knowledge_sources s ON s.id = a.source_id AND s.tenant_id = a.tenant_id AND s.deleted_at IS NULL
           WHERE a.tenant_id = $1 AND a.deleted_at IS NULL AND a.status = 'approved' AND a.is_published = TRUE
             AND (LOWER(a.title) LIKE ANY($2::text[]) OR LOWER(a.body) LIKE ANY($2::text[]) OR LOWER(a.summary) LIKE ANY($2::text[]))
           LIMIT 100`,
          [actor.tenantId, patterns]
        );
        for (const row of articleResult.rows) {
          // Permission-aware: an article linked to a restricted source is hidden
          // unless the actor can access that source.
          if (row.required_permission && !actor.permissionCodes.includes(row.required_permission as string)) {
            continue;
          }
          const score = scoreText(`${row.title} ${row.title} ${row.body}`, terms);
          if (score <= 0) {
            continue;
          }
          citations.push({
            kind: "article",
            sourceId: (row.source_id as string | null) ?? null,
            sourceName: (row.source_name as string | null) ?? null,
            sourceType: (row.source_type as RagCitation["sourceType"]) ?? null,
            documentId: null,
            documentTitle: null,
            articleId: row.id as string,
            articleTitle: row.title as string,
            chunkIndex: null,
            snippet: buildSnippet((row.summary as string) || (row.body as string), terms),
            score
          });
        }
      }

      citations.sort((a, b) => b.score - a.score);
      const topCitations = citations.slice(0, topK);

      // Knowledge gap tracking placeholder: a query that returns nothing is logged.
      let gapLogged = false;
      if (topCitations.length === 0 && query.length > 0) {
        await client.query(
          `INSERT INTO knowledge_gaps (tenant_id, query_text, detected_source, status, created_by, updated_by) VALUES ($1, $2, 'retrieval', 'open', $3, $3)`,
          [actor.tenantId, query, actor.userId]
        );
        gapLogged = true;
      }

      await this.recordAuditLog(client, actor, audit, { topK, results: topCitations.length, gapLogged });

      return {
        query,
        topK,
        retrieval: {
          vectorBackend: this.config.vectorBackend,
          embeddingModel: this.config.embeddingModel,
          strategy: "keyword_placeholder",
          deferred: true
        },
        citations: topCitations,
        accessibleSourceCount: accessibleSources.length,
        restrictedSourceCount,
        gapLogged
      };
    });
  }
}
