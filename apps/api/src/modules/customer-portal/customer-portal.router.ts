import { Router, type Request } from "express";
import { z } from "zod";
import type {
  CreateCustomerPortalFeedbackRequestBody,
  CreateCustomerPortalTicketMessageRequestBody,
  CreateCustomerPortalTicketRequestBody,
  CustomerPortalAskAiRequestBody,
  UpdateCustomerPortalProfileRequestBody,
  UpdateCustomerPortalTrainingProgressRequestBody
} from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { CustomerPortalService } from "./customer-portal.service.js";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
const recordSchema = z.record(z.unknown());

const ticketCreateSchema = z.object({
  subject: z.string().min(2).max(300),
  description: z.string().max(8000).nullable().optional(),
  priorityKey: z.string().min(2).max(160).optional(),
  categoryKey: z.string().min(2).max(160).optional(),
  metadata: recordSchema.optional()
});

const ticketMessageCreateSchema = z.object({
  body: z.string().min(1).max(8000),
  metadata: recordSchema.optional()
});

const askAiSchema = z.object({
  question: z.string().min(3).max(2000)
});

const profileUpdateSchema = z.object({
  jobTitle: z.string().max(160).nullable().optional(),
  phone: z.string().max(80).nullable().optional(),
  preferences: recordSchema.optional()
});

const trainingProgressSchema = z.object({
  lessonId: uuidSchema,
  status: z.enum(["not_started", "in_progress", "completed"]).optional(),
  progressPercent: z.coerce.number().int().min(0).max(100).optional(),
  metadata: recordSchema.optional()
});

const feedbackSchema = z.object({
  feedbackType: z.enum(["csat", "product_feedback", "portal_feedback"]).optional(),
  rating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  comment: z.string().max(4000).nullable().optional(),
  relatedEntityType: z.string().max(120).nullable().optional(),
  relatedEntityId: uuidSchema.nullable().optional(),
  metadata: recordSchema.optional()
});

const articleSearchQuerySchema = z.object({
  search: z.string().max(200).optional()
});

const ticketIdSchema = z.object({ ticketId: uuidSchema });
const articleIdSchema = z.object({ articleId: uuidSchema });
const assignmentIdSchema = z.object({ assignmentId: uuidSchema });

const readPermissions = ["customer_portal.view", "customer_portal.create", "customer_portal.edit", "customer_portal.use_ai"];
const createPermissions = ["customer_portal.create"];
const editPermissions = ["customer_portal.edit"];
const aiPermissions = ["customer_portal.use_ai"];

function getClientIp(request: Request) {
  const forwardedFor = request.header("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return request.ip ?? null;
}

function getAuditMetadata(request: Request) {
  return {
    requestId: request.requestId,
    ipAddress: getClientIp(request),
    userAgent: request.header("user-agent") ?? null
  };
}

export function createCustomerPortalRouter({ databaseService }: RouterDependencies) {
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
  const service = new CustomerPortalService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS });

  router.use(authMiddleware);

  router.get(
    "/profile",
    requirePermissions({ oneOf: readPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.getProfile(request.auth!));
    })
  );

  router.patch(
    "/profile",
    requirePermissions({ oneOf: editPermissions }),
    validateRequest({ body: profileUpdateSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.updateProfile(request.auth!, getAuditMetadata(request), request.body as UpdateCustomerPortalProfileRequestBody));
    })
  );

  router.get(
    "/dashboard",
    requirePermissions({ oneOf: readPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.getDashboard(request.auth!));
    })
  );

  router.get(
    "/tickets",
    requirePermissions({ oneOf: readPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.listTickets(request.auth!));
    })
  );

  router.post(
    "/tickets",
    requirePermissions({ oneOf: createPermissions }),
    validateRequest({ body: ticketCreateSchema }),
    asyncHandler(async (request, response) => {
      response.status(201).json(await service.createTicket(request.auth!, getAuditMetadata(request), request.body as CreateCustomerPortalTicketRequestBody));
    })
  );

  router.get(
    "/tickets/:ticketId",
    requirePermissions({ oneOf: readPermissions }),
    validateRequest({ params: ticketIdSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.getTicket(request.auth!, request.params.ticketId));
    })
  );

  router.post(
    "/tickets/:ticketId/messages",
    requirePermissions({ oneOf: createPermissions }),
    validateRequest({ params: ticketIdSchema, body: ticketMessageCreateSchema }),
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(await service.addTicketMessage(request.auth!, getAuditMetadata(request), request.params.ticketId, request.body as CreateCustomerPortalTicketMessageRequestBody));
    })
  );

  router.get(
    "/knowledge",
    requirePermissions({ oneOf: readPermissions }),
    validateRequest({ query: articleSearchQuerySchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.listKnowledgeArticles(request.auth!, (request.query as { search?: string }).search));
    })
  );

  router.get(
    "/knowledge/:articleId",
    requirePermissions({ oneOf: readPermissions }),
    validateRequest({ params: articleIdSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.getKnowledgeArticle(request.auth!, request.params.articleId));
    })
  );

  router.post(
    "/ask-ai",
    requirePermissions({ oneOf: aiPermissions }),
    validateRequest({ body: askAiSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.askAi(request.auth!, getAuditMetadata(request), request.body as CustomerPortalAskAiRequestBody));
    })
  );

  router.get(
    "/training",
    requirePermissions({ oneOf: readPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.listTraining(request.auth!));
    })
  );

  router.get(
    "/training/:assignmentId",
    requirePermissions({ oneOf: readPermissions }),
    validateRequest({ params: assignmentIdSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.getTrainingAssignment(request.auth!, request.params.assignmentId));
    })
  );

  router.post(
    "/training/:assignmentId/progress",
    requirePermissions({ oneOf: editPermissions }),
    validateRequest({ params: assignmentIdSchema, body: trainingProgressSchema }),
    asyncHandler(async (request, response) => {
      response
        .status(200)
        .json(await service.updateTrainingProgress(request.auth!, getAuditMetadata(request), request.params.assignmentId, request.body as UpdateCustomerPortalTrainingProgressRequestBody));
    })
  );

  router.post(
    "/feedback",
    requirePermissions({ oneOf: editPermissions }),
    validateRequest({ body: feedbackSchema }),
    asyncHandler(async (request, response) => {
      response.status(201).json(await service.createFeedback(request.auth!, getAuditMetadata(request), request.body as CreateCustomerPortalFeedbackRequestBody));
    })
  );

  return router;
}
