import { Router, type Request } from "express";
import { z } from "zod";
import {
  knowledgeAccessScopes,
  knowledgeArticleStatuses,
  knowledgeContentFormats,
  knowledgeGapStatuses,
  knowledgeSourceTypes,
  type CreateKnowledgeArticleRequestBody,
  type CreateKnowledgeArticleVersionRequestBody,
  type CreateKnowledgeDocumentRequestBody,
  type CreateKnowledgeGapRequestBody,
  type CreateKnowledgeSourceRequestBody,
  type KnowledgeArticleListQuery,
  type KnowledgeDocumentListQuery,
  type KnowledgeGapListQuery,
  type KnowledgeSourceListQuery,
  type RagRetrieveRequestBody,
  type UpdateKnowledgeArticleRequestBody,
  type UpdateKnowledgeArticleStatusRequestBody,
  type UpdateKnowledgeGapRequestBody,
  type UpdateKnowledgeSourceRequestBody
} from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { KnowledgeService } from "./knowledge.service.js";
import { RagService } from "./rag.service.js";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const recordSchema = z.record(z.unknown());

const createSourceSchema = z.object({
  sourceKey: z.string().min(1).max(120).regex(/^[a-zA-Z0-9_.-]+$/, "Source key may only contain letters, numbers, dots, dashes, and underscores."),
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  sourceType: z.enum(knowledgeSourceTypes),
  accessScope: z.enum(knowledgeAccessScopes).optional(),
  requiredPermission: z.string().max(120).nullable().optional(),
  isEnabled: z.boolean().optional(),
  metadata: recordSchema.optional()
});

const updateSourceSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  description: z.string().max(2000).optional(),
  accessScope: z.enum(knowledgeAccessScopes).optional(),
  requiredPermission: z.string().max(120).nullable().optional(),
  isEnabled: z.boolean().optional(),
  metadata: recordSchema.optional()
});

const sourceListQuerySchema = z.object({
  sourceType: z.string().max(60).optional(),
  isEnabled: z.string().max(10).optional(),
  search: z.string().max(160).optional()
});

const createDocumentSchema = z.object({
  title: z.string().min(1).max(240),
  content: z.string().min(1).max(200000),
  summary: z.string().max(2000).optional(),
  contentFormat: z.enum(knowledgeContentFormats).optional(),
  sourceUri: z.string().max(2000).optional(),
  metadata: recordSchema.optional()
});

const documentListQuerySchema = z.object({
  sourceId: z.string().uuid().optional(),
  status: z.string().max(40).optional(),
  search: z.string().max(160).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional()
});

const createArticleSchema = z.object({
  articleKey: z.string().min(1).max(120).regex(/^[a-zA-Z0-9_.-]+$/, "Article key may only contain letters, numbers, dots, dashes, and underscores."),
  title: z.string().min(1).max(240),
  body: z.string().min(1).max(200000),
  summary: z.string().max(2000).optional(),
  category: z.string().min(1).max(60).optional(),
  sourceId: z.string().uuid().nullable().optional(),
  changeSummary: z.string().max(500).optional(),
  metadata: recordSchema.optional()
});

const updateArticleSchema = z.object({
  title: z.string().min(1).max(240).optional(),
  summary: z.string().max(2000).optional(),
  category: z.string().min(1).max(60).optional(),
  sourceId: z.string().uuid().nullable().optional(),
  metadata: recordSchema.optional()
});

const createArticleVersionSchema = z.object({
  title: z.string().min(1).max(240).optional(),
  summary: z.string().max(2000).optional(),
  body: z.string().min(1).max(200000),
  changeSummary: z.string().max(500).optional(),
  activate: z.boolean().optional()
});

const articleStatusSchema = z.object({
  status: z.enum(knowledgeArticleStatuses),
  isPublished: z.boolean().optional()
});

const articleListQuerySchema = z.object({
  status: z.string().max(40).optional(),
  category: z.string().max(60).optional(),
  search: z.string().max(160).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional()
});

const createGapSchema = z.object({
  queryText: z.string().min(1).max(2000),
  detectedSource: z.enum(["retrieval", "support", "manual"]).optional(),
  relatedArticleId: z.string().uuid().nullable().optional(),
  metadata: recordSchema.optional()
});

const updateGapSchema = z.object({
  status: z.enum(knowledgeGapStatuses).optional(),
  resolutionNote: z.string().max(2000).optional(),
  relatedArticleId: z.string().uuid().nullable().optional()
});

const gapListQuerySchema = z.object({
  status: z.string().max(40).optional(),
  search: z.string().max(160).optional()
});

const retrieveSchema = z.object({
  query: z.string().min(1).max(2000),
  topK: z.coerce.number().int().positive().max(20).optional(),
  sourceTypes: z.array(z.enum(knowledgeSourceTypes)).max(20).optional(),
  includeArticles: z.boolean().optional()
});

const sourceIdParams = z.object({ sourceId: z.string().uuid() });
const documentIdParams = z.object({ documentId: z.string().uuid() });
const articleIdParams = z.object({ articleId: z.string().uuid() });
const gapIdParams = z.object({ gapId: z.string().uuid() });

const readPermissions: string[] = [
  "ai.view",
  "ai.create",
  "ai.edit",
  "ai.delete",
  "ai.assign",
  "ai.approve",
  "ai.export",
  "ai.configure",
  "ai.use_ai",
  "ai.manage_ai",
  "ai.view_dashboard",
  "ai.manage_workflow"
];
const createPermissions: string[] = ["ai.create", "ai.configure", "ai.manage_ai"];
const editPermissions: string[] = ["ai.edit", "ai.configure", "ai.manage_ai"];
const approvePermissions: string[] = ["ai.approve", "ai.configure", "ai.manage_ai"];
const retrievePermissions: string[] = ["ai.use_ai", "ai.view", "ai.manage_ai", "ai.configure", "ai.view_dashboard"];

function getClientIp(request: Request) {
  const forwardedFor = request.header("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }
  return request.ip ?? null;
}

function getAuditMetadata(request: Request) {
  return { requestId: request.requestId, ipAddress: getClientIp(request), userAgent: request.header("user-agent") ?? null };
}

export function createRagRouter({ databaseService }: RouterDependencies) {
  const router = Router();
  const authService = new AuthService(databaseService, {
    enabled: env.DATABASE_ENABLED,
    accessTokenSecret: env.JWT_ACCESS_TOKEN_SECRET,
    refreshTokenSecret: env.JWT_REFRESH_TOKEN_SECRET,
    accessTokenTtlMinutes: env.JWT_ACCESS_TOKEN_TTL_MINUTES,
    refreshTokenTtlDays: env.JWT_REFRESH_TOKEN_TTL_DAYS,
    accountLockThreshold: env.AUTH_ACCOUNT_LOCK_THRESHOLD,
    accountLockMinutes: env.AUTH_ACCOUNT_LOCK_MINUTES,
    enableAuditLogs: env.ENABLE_AUDIT_LOGS
  });
  const authMiddleware = createAuthMiddleware(authService);
  const knowledgeConfig = { enableAuditLogs: env.ENABLE_AUDIT_LOGS, embeddingModel: env.AI_EMBEDDING_MODEL, vectorBackend: env.AI_VECTOR_BACKEND };
  const knowledge = new KnowledgeService(databaseService, knowledgeConfig);
  const rag = new RagService(databaseService, knowledgeConfig);

  router.use(authMiddleware);

  // ----- Knowledge sources -----
  router.get("/knowledge/sources", requirePermissions({ oneOf: readPermissions }), validateRequest({ query: sourceListQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await knowledge.listSources(request.auth!, request.query as KnowledgeSourceListQuery));
  }));

  router.post("/knowledge/sources", requirePermissions({ oneOf: createPermissions }), validateRequest({ body: createSourceSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await knowledge.createSource(request.auth!, getAuditMetadata(request), request.body as CreateKnowledgeSourceRequestBody));
  }));

  router.get("/knowledge/sources/:sourceId", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: sourceIdParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await knowledge.getSource(request.auth!, request.params.sourceId));
  }));

  router.patch("/knowledge/sources/:sourceId", requirePermissions({ oneOf: editPermissions }), validateRequest({ params: sourceIdParams, body: updateSourceSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await knowledge.updateSource(request.auth!, getAuditMetadata(request), request.params.sourceId, request.body as UpdateKnowledgeSourceRequestBody));
  }));

  // ----- Documents -----
  router.get("/knowledge/documents", requirePermissions({ oneOf: readPermissions }), validateRequest({ query: documentListQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await knowledge.listDocuments(request.auth!, request.query as KnowledgeDocumentListQuery));
  }));

  router.post("/knowledge/sources/:sourceId/documents", requirePermissions({ oneOf: createPermissions }), validateRequest({ params: sourceIdParams, body: createDocumentSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await knowledge.createDocument(request.auth!, getAuditMetadata(request), request.params.sourceId, request.body as CreateKnowledgeDocumentRequestBody));
  }));

  router.get("/knowledge/documents/:documentId", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: documentIdParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await knowledge.getDocument(request.auth!, request.params.documentId));
  }));

  router.get("/knowledge/documents/:documentId/chunks", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: documentIdParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await knowledge.listChunks(request.auth!, request.params.documentId));
  }));

  router.post("/knowledge/documents/:documentId/process", requirePermissions({ oneOf: editPermissions }), validateRequest({ params: documentIdParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await knowledge.processDocument(request.auth!, getAuditMetadata(request), request.params.documentId));
  }));

  // ----- Articles -----
  router.get("/knowledge/articles", requirePermissions({ oneOf: readPermissions }), validateRequest({ query: articleListQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await knowledge.listArticles(request.auth!, request.query as KnowledgeArticleListQuery));
  }));

  router.post("/knowledge/articles", requirePermissions({ oneOf: createPermissions }), validateRequest({ body: createArticleSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await knowledge.createArticle(request.auth!, getAuditMetadata(request), request.body as CreateKnowledgeArticleRequestBody));
  }));

  router.get("/knowledge/articles/:articleId", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: articleIdParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await knowledge.getArticle(request.auth!, request.params.articleId));
  }));

  router.patch("/knowledge/articles/:articleId", requirePermissions({ oneOf: editPermissions }), validateRequest({ params: articleIdParams, body: updateArticleSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await knowledge.updateArticle(request.auth!, getAuditMetadata(request), request.params.articleId, request.body as UpdateKnowledgeArticleRequestBody));
  }));

  router.post("/knowledge/articles/:articleId/versions", requirePermissions({ oneOf: editPermissions }), validateRequest({ params: articleIdParams, body: createArticleVersionSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await knowledge.createArticleVersion(request.auth!, getAuditMetadata(request), request.params.articleId, request.body as CreateKnowledgeArticleVersionRequestBody));
  }));

  router.post("/knowledge/articles/:articleId/status", requirePermissions({ oneOf: approvePermissions }), validateRequest({ params: articleIdParams, body: articleStatusSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await knowledge.setArticleStatus(request.auth!, getAuditMetadata(request), request.params.articleId, request.body as UpdateKnowledgeArticleStatusRequestBody));
  }));

  // ----- Knowledge gaps -----
  router.get("/knowledge/gaps", requirePermissions({ oneOf: readPermissions }), validateRequest({ query: gapListQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await knowledge.listGaps(request.auth!, request.query as KnowledgeGapListQuery));
  }));

  router.post("/knowledge/gaps", requirePermissions({ oneOf: editPermissions }), validateRequest({ body: createGapSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await knowledge.createGap(request.auth!, getAuditMetadata(request), request.body as CreateKnowledgeGapRequestBody));
  }));

  router.patch("/knowledge/gaps/:gapId", requirePermissions({ oneOf: editPermissions }), validateRequest({ params: gapIdParams, body: updateGapSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await knowledge.updateGap(request.auth!, getAuditMetadata(request), request.params.gapId, request.body as UpdateKnowledgeGapRequestBody));
  }));

  // ----- Retrieval -----
  router.post("/rag/retrieve", requirePermissions({ oneOf: retrievePermissions }), validateRequest({ body: retrieveSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await rag.retrieve(request.auth!, getAuditMetadata(request), request.body as RagRetrieveRequestBody));
  }));

  return router;
}
