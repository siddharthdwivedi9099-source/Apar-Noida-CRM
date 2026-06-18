// ============================================================================
// Phase 20: RAG Knowledge System
// ============================================================================

export interface RagPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ----------------------------------------------------------------------------
// Knowledge sources
// ----------------------------------------------------------------------------

export const knowledgeSourceTypes = [
  "product_documentation",
  "user_guide",
  "admin_guide",
  "training_content",
  "faq",
  "release_notes",
  "support_article",
  "resolved_ticket",
  "customer_document"
] as const;
export type KnowledgeSourceType = (typeof knowledgeSourceTypes)[number];

export const knowledgeSourceTypeLabels: Record<KnowledgeSourceType, string> = {
  product_documentation: "Product documentation",
  user_guide: "User guide",
  admin_guide: "Admin guide",
  training_content: "Training content",
  faq: "FAQs",
  release_notes: "Release notes",
  support_article: "Support articles",
  resolved_ticket: "Past resolved tickets",
  customer_document: "Customer-specific documents"
};

export const knowledgeAccessScopes = ["tenant", "restricted"] as const;
export type KnowledgeAccessScope = (typeof knowledgeAccessScopes)[number];

export interface KnowledgeSource {
  id: string;
  sourceKey: string;
  name: string;
  description: string;
  sourceType: KnowledgeSourceType;
  accessScope: KnowledgeAccessScope;
  requiredPermission: string | null;
  isEnabled: boolean;
  isSystem: boolean;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface KnowledgeSourceDefinition {
  key: string;
  name: string;
  description: string;
  sourceType: KnowledgeSourceType;
  accessScope: KnowledgeAccessScope;
  requiredPermission: string | null;
}

// Seeded per-tenant baseline of knowledge sources, covering the standard
// corpus categories. Customer-specific documents are restricted by default.
export const defaultKnowledgeSources: KnowledgeSourceDefinition[] = [
  { key: "product_documentation", name: "Product documentation", description: "Core product documentation and reference material.", sourceType: "product_documentation", accessScope: "tenant", requiredPermission: null },
  { key: "user_guide", name: "User guide", description: "End-user how-to guides and walkthroughs.", sourceType: "user_guide", accessScope: "tenant", requiredPermission: null },
  { key: "admin_guide", name: "Admin guide", description: "Administrator configuration and governance guides.", sourceType: "admin_guide", accessScope: "restricted", requiredPermission: "admin.view" },
  { key: "training_content", name: "Training content", description: "Training programs, lessons, and enablement material.", sourceType: "training_content", accessScope: "tenant", requiredPermission: null },
  { key: "faqs", name: "FAQs", description: "Frequently asked questions and quick answers.", sourceType: "faq", accessScope: "tenant", requiredPermission: null },
  { key: "release_notes", name: "Release notes", description: "Product release notes and change history.", sourceType: "release_notes", accessScope: "tenant", requiredPermission: null },
  { key: "support_articles", name: "Support articles", description: "Knowledge base and support how-to articles.", sourceType: "support_article", accessScope: "tenant", requiredPermission: null },
  { key: "resolved_tickets", name: "Past resolved tickets", description: "Resolutions distilled from previously resolved support tickets.", sourceType: "resolved_ticket", accessScope: "restricted", requiredPermission: "support.view" },
  { key: "customer_documents", name: "Customer-specific documents", description: "Customer-scoped documents available only to permitted roles.", sourceType: "customer_document", accessScope: "restricted", requiredPermission: "customer_success.view" }
];

export interface CreateKnowledgeSourceRequestBody {
  sourceKey: string;
  name: string;
  description?: string;
  sourceType: KnowledgeSourceType;
  accessScope?: KnowledgeAccessScope;
  requiredPermission?: string | null;
  isEnabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateKnowledgeSourceRequestBody {
  name?: string;
  description?: string;
  accessScope?: KnowledgeAccessScope;
  requiredPermission?: string | null;
  isEnabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeSourceListQuery {
  sourceType?: string;
  isEnabled?: string;
  search?: string;
}

export interface KnowledgeSourceListResponse {
  sources: KnowledgeSource[];
}

export interface KnowledgeSourceResponse {
  source: KnowledgeSource;
}

// ----------------------------------------------------------------------------
// Knowledge documents and chunks
// ----------------------------------------------------------------------------

export const knowledgeDocumentStatuses = ["pending", "chunked", "embedded"] as const;
export type KnowledgeDocumentStatus = (typeof knowledgeDocumentStatuses)[number];

export const knowledgeContentFormats = ["text", "markdown", "html"] as const;
export type KnowledgeContentFormat = (typeof knowledgeContentFormats)[number];

export const chunkEmbeddingStatuses = ["pending", "placeholder", "embedded"] as const;
export type ChunkEmbeddingStatus = (typeof chunkEmbeddingStatuses)[number];

export interface KnowledgeDocumentSummary {
  id: string;
  sourceId: string;
  title: string;
  summary: string;
  contentFormat: KnowledgeContentFormat;
  sourceUri: string;
  status: KnowledgeDocumentStatus;
  chunkCount: number;
  tokenEstimate: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  sourceId: string;
  chunkIndex: number;
  content: string;
  tokenEstimate: number;
  embeddingStatus: ChunkEmbeddingStatus;
  embeddingModel: string;
  embeddingRef: string;
  createdAt: string;
}

export interface KnowledgeDocumentDetail extends KnowledgeDocumentSummary {
  content: string;
  metadata: Record<string, unknown>;
  chunks: KnowledgeChunk[];
}

export interface CreateKnowledgeDocumentRequestBody {
  title: string;
  content: string;
  summary?: string;
  contentFormat?: KnowledgeContentFormat;
  sourceUri?: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeDocumentListQuery {
  sourceId?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface KnowledgeDocumentListResponse {
  documents: KnowledgeDocumentSummary[];
  pagination: RagPagination;
}

export interface KnowledgeDocumentResponse {
  document: KnowledgeDocumentDetail;
}

export interface KnowledgeChunkListResponse {
  documentId: string;
  chunks: KnowledgeChunk[];
}

// ----------------------------------------------------------------------------
// Knowledge articles
// ----------------------------------------------------------------------------

export const knowledgeArticleStatuses = ["draft", "pending_review", "approved", "archived"] as const;
export type KnowledgeArticleStatus = (typeof knowledgeArticleStatuses)[number];

export interface KnowledgeArticleVersion {
  id: string;
  version: number;
  title: string;
  summary: string;
  body: string;
  changeSummary: string;
  status: KnowledgeArticleStatus;
  isActive: boolean;
  createdAt: string;
  createdBy: string | null;
}

export interface KnowledgeArticleSummary {
  id: string;
  articleKey: string;
  title: string;
  summary: string;
  category: string;
  status: KnowledgeArticleStatus;
  isPublished: boolean;
  currentVersion: number;
  latestVersion: number;
  sourceId: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface KnowledgeArticleDetail extends KnowledgeArticleSummary {
  body: string;
  metadata: Record<string, unknown>;
  versions: KnowledgeArticleVersion[];
}

export interface CreateKnowledgeArticleRequestBody {
  articleKey: string;
  title: string;
  body: string;
  summary?: string;
  category?: string;
  sourceId?: string | null;
  changeSummary?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateKnowledgeArticleRequestBody {
  title?: string;
  summary?: string;
  category?: string;
  sourceId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateKnowledgeArticleVersionRequestBody {
  title?: string;
  summary?: string;
  body: string;
  changeSummary?: string;
  activate?: boolean;
}

export interface UpdateKnowledgeArticleStatusRequestBody {
  status: KnowledgeArticleStatus;
  isPublished?: boolean;
}

export interface KnowledgeArticleListQuery {
  status?: string;
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface KnowledgeArticleListResponse {
  articles: KnowledgeArticleSummary[];
  pagination: RagPagination;
}

export interface KnowledgeArticleResponse {
  article: KnowledgeArticleDetail;
}

// ----------------------------------------------------------------------------
// Knowledge gaps
// ----------------------------------------------------------------------------

export const knowledgeGapStatuses = ["open", "reviewing", "resolved", "dismissed"] as const;
export type KnowledgeGapStatus = (typeof knowledgeGapStatuses)[number];

export const knowledgeGapDetectedSources = ["retrieval", "support", "manual"] as const;
export type KnowledgeGapDetectedSource = (typeof knowledgeGapDetectedSources)[number];

export interface KnowledgeGap {
  id: string;
  queryText: string;
  detectedSource: KnowledgeGapDetectedSource;
  status: KnowledgeGapStatus;
  resolutionNote: string;
  relatedArticleId: string | null;
  occurrenceCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface CreateKnowledgeGapRequestBody {
  queryText: string;
  detectedSource?: KnowledgeGapDetectedSource;
  relatedArticleId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateKnowledgeGapRequestBody {
  status?: KnowledgeGapStatus;
  resolutionNote?: string;
  relatedArticleId?: string | null;
}

export interface KnowledgeGapListQuery {
  status?: string;
  search?: string;
}

export interface KnowledgeGapListResponse {
  gaps: KnowledgeGap[];
}

export interface KnowledgeGapResponse {
  gap: KnowledgeGap;
}

// ----------------------------------------------------------------------------
// Retrieval
// ----------------------------------------------------------------------------

export type RagCitationKind = "document" | "article";

export interface RagCitation {
  kind: RagCitationKind;
  sourceId: string | null;
  sourceName: string | null;
  sourceType: KnowledgeSourceType | null;
  documentId: string | null;
  documentTitle: string | null;
  articleId: string | null;
  articleTitle: string | null;
  chunkIndex: number | null;
  snippet: string;
  score: number;
}

export interface RagRetrieveRequestBody {
  query: string;
  topK?: number;
  sourceTypes?: KnowledgeSourceType[];
  includeArticles?: boolean;
}

export interface RagRetrieveResponse {
  query: string;
  topK: number;
  retrieval: {
    vectorBackend: string;
    embeddingModel: string;
    strategy: string;
    deferred: boolean;
  };
  citations: RagCitation[];
  accessibleSourceCount: number;
  restrictedSourceCount: number;
  gapLogged: boolean;
}
