import { Router } from "express";
import { getAuditMetadata } from "../../common/http/request-metadata.js";
import { z } from "zod";
import {
  customerQueryChannels,
  customerQueryEscalationReasons,
  type AskCustomerQueryRequestBody,
  type CustomerQuerySessionListQuery,
  type EscalateCustomerQueryRequestBody,
  type SubmitCustomerQueryFeedbackRequestBody
} from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { CustomerQueryService } from "./customer-query.service.js";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const askSchema = z.object({
  query: z.string().min(1).max(2000),
  sessionId: z.string().uuid().optional(),
  subject: z.string().max(200).optional(),
  channel: z.enum(customerQueryChannels).optional(),
  topK: z.coerce.number().int().positive().max(20).optional()
});

const feedbackSchema = z.object({
  feedback: z.enum(["helpful", "not_helpful"]),
  note: z.string().max(2000).optional(),
  messageId: z.string().uuid().optional()
});

const ticketSchema = z.object({ note: z.string().max(2000).optional() });
const escalateSchema = z.object({ reason: z.enum(customerQueryEscalationReasons).optional(), note: z.string().max(2000).optional() });
const resolveSchema = z.object({ note: z.string().max(2000).optional() });

const sessionListQuerySchema = z.object({
  status: z.string().max(40).optional(),
  channel: z.string().max(40).optional(),
  escalated: z.string().max(10).optional(),
  search: z.string().max(160).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional()
});

const gapsQuerySchema = z.object({ status: z.string().max(40).optional() });
const sessionIdParams = z.object({ sessionId: z.string().uuid() });

const askPermissions: string[] = ["customer_query.use_ai", "customer_query.create", "customer_query.manage_ai", "customer_query.configure"];
const reviewPermissions: string[] = ["customer_query.view", "customer_query.view_dashboard", "customer_query.manage_ai", "customer_query.assign", "customer_query.configure", "customer_query.edit"];
const managePermissions: string[] = ["customer_query.assign", "customer_query.manage_ai", "customer_query.configure", "customer_query.edit"];
const accessPermissions: string[] = Array.from(new Set([...askPermissions, ...reviewPermissions]));

export function createCustomerQueryRouter({ databaseService }: RouterDependencies) {
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
  const service = new CustomerQueryService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS, embeddingModel: env.AI_EMBEDDING_MODEL, vectorBackend: env.AI_VECTOR_BACKEND });

  router.use(authMiddleware);

  router.post("/ask", requirePermissions({ oneOf: askPermissions }), validateRequest({ body: askSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.ask(request.auth!, getAuditMetadata(request), request.body as AskCustomerQueryRequestBody));
  }));

  router.get("/dashboard", requirePermissions({ oneOf: reviewPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getDashboard(request.auth!));
  }));

  router.get("/knowledge-gaps", requirePermissions({ oneOf: reviewPermissions }), validateRequest({ query: gapsQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listKnowledgeGaps(request.auth!, (request.query as { status?: string }).status));
  }));

  router.get("/sessions", requirePermissions({ oneOf: reviewPermissions }), validateRequest({ query: sessionListQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listSessions(request.auth!, request.query as CustomerQuerySessionListQuery));
  }));

  router.get("/sessions/:sessionId", requirePermissions({ oneOf: accessPermissions }), validateRequest({ params: sessionIdParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getSession(request.auth!, request.params.sessionId));
  }));

  router.post("/sessions/:sessionId/feedback", requirePermissions({ oneOf: accessPermissions }), validateRequest({ params: sessionIdParams, body: feedbackSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.submitFeedback(request.auth!, getAuditMetadata(request), request.params.sessionId, request.body as SubmitCustomerQueryFeedbackRequestBody));
  }));

  router.post("/sessions/:sessionId/ticket", requirePermissions({ oneOf: accessPermissions }), validateRequest({ params: sessionIdParams, body: ticketSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createTicket(request.auth!, getAuditMetadata(request), request.params.sessionId, (request.body as { note?: string }).note));
  }));

  router.post("/sessions/:sessionId/escalate", requirePermissions({ oneOf: accessPermissions }), validateRequest({ params: sessionIdParams, body: escalateSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.escalate(request.auth!, getAuditMetadata(request), request.params.sessionId, request.body as EscalateCustomerQueryRequestBody));
  }));

  router.post("/sessions/:sessionId/resolve", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: sessionIdParams, body: resolveSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.resolveSession(request.auth!, getAuditMetadata(request), request.params.sessionId, (request.body as { note?: string }).note));
  }));

  return router;
}
