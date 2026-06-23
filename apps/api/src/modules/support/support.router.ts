import { Router } from "express";
import { getAuditMetadata, getClientIp } from "../../common/http/request-metadata.js";
import { z } from "zod";
import {
  supportEscalationStatuses,
  supportKnowledgeArticleStatuses,
  supportTicketMessageTypes,
  supportTicketScopes,
  supportTicketSortFields,
  type CreateSupportKnowledgeArticleRequestBody,
  type CreateSupportSlaPolicyRequestBody,
  type CreateSupportTicketMessageRequestBody,
  type CreateSupportTicketRequestBody,
  type SupportTicketListQuery,
  type UpdateSupportTicketRequestBody
} from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { SupportService } from "./support.service.js";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
const recordSchema = z.record(z.unknown());
const booleanQuerySchema = z.preprocess((value) => {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return value;
}, z.boolean());

const ticketListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  search: z.string().max(200).optional(),
  status: z.string().max(160).optional(),
  priority: z.string().max(160).optional(),
  category: z.string().max(160).optional(),
  source: z.string().max(160).optional(),
  assigneeId: uuidSchema.optional(),
  accountId: uuidSchema.optional(),
  escalationStatus: z.enum(supportEscalationStatuses).optional(),
  breachedOnly: booleanQuerySchema.optional(),
  scope: z.enum(supportTicketScopes).optional(),
  sortBy: z.enum(supportTicketSortFields).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional()
});

const ticketCreateSchema = z.object({
  subject: z.string().min(2).max(300),
  description: z.string().max(8000).nullable().optional(),
  statusKey: z.string().min(2).max(160).optional(),
  priorityKey: z.string().min(2).max(160).optional(),
  categoryKey: z.string().min(2).max(160).optional(),
  sourceKey: z.string().min(2).max(160).optional(),
  accountId: uuidSchema.nullable().optional(),
  contactId: uuidSchema.nullable().optional(),
  customerSuccessAccountId: uuidSchema.nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  assigneeId: uuidSchema.nullable().optional(),
  slaPolicyId: uuidSchema.nullable().optional(),
  escalationStatus: z.enum(supportEscalationStatuses).optional(),
  rootCause: z.string().max(4000).nullable().optional(),
  resolutionNotes: z.string().max(8000).nullable().optional(),
  metadata: recordSchema.optional()
});

const ticketUpdateSchema = z.object({
  subject: z.string().min(2).max(300).optional(),
  description: z.string().max(8000).nullable().optional(),
  statusKey: z.string().min(2).max(160).optional(),
  priorityKey: z.string().min(2).max(160).optional(),
  categoryKey: z.string().min(2).max(160).optional(),
  sourceKey: z.string().min(2).max(160).optional(),
  accountId: uuidSchema.nullable().optional(),
  contactId: uuidSchema.nullable().optional(),
  customerSuccessAccountId: uuidSchema.nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  assigneeId: uuidSchema.nullable().optional(),
  slaPolicyId: uuidSchema.nullable().optional(),
  escalationStatus: z.enum(supportEscalationStatuses).optional(),
  rootCause: z.string().max(4000).nullable().optional(),
  resolutionNotes: z.string().max(8000).nullable().optional(),
  metadata: recordSchema.optional()
});

const messageCreateSchema = z.object({
  messageType: z.enum(supportTicketMessageTypes),
  body: z.string().min(1).max(8000),
  metadata: recordSchema.optional()
});

const slaPolicyCreateSchema = z.object({
  name: z.string().min(2).max(200),
  priorityKey: z.string().min(2).max(160).nullable().optional(),
  firstResponseMinutes: z.coerce.number().int().positive(),
  resolutionMinutes: z.coerce.number().int().positive(),
  isActive: z.boolean().optional(),
  metadata: recordSchema.optional()
});

const articleCreateSchema = z.object({
  title: z.string().min(2).max(300),
  categoryKey: z.string().min(2).max(160).nullable().optional(),
  summary: z.string().max(2000).nullable().optional(),
  body: z.string().max(20000).nullable().optional(),
  status: z.enum(supportKnowledgeArticleStatuses).optional(),
  metadata: recordSchema.optional()
});

const linkArticleSchema = z.object({ articleId: uuidSchema });

const ticketIdSchema = z.object({ ticketId: uuidSchema });

const readPermissions: string[] = [
  "support.view",
  "support.create",
  "support.edit",
  "support.delete",
  "support.assign",
  "support.approve",
  "support.export",
  "support.configure",
  "support.use_ai",
  "support.manage_ai",
  "support.view_dashboard",
  "support.manage_workflow"
];
const createPermissions: string[] = ["support.create", "support.configure"];
const updatePermissions: string[] = ["support.edit", "support.assign", "support.approve", "support.configure", "support.manage_workflow"];
const deletePermissions: string[] = ["support.delete", "support.configure"];
const messagePermissions: string[] = ["support.edit", "support.create", "support.configure", "support.manage_workflow"];
const configurePermissions: string[] = ["support.configure", "support.manage_workflow"];

export function createSupportRouter({ databaseService }: RouterDependencies) {
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
  const service = new SupportService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS });

  router.use(authMiddleware);

  router.get(
    "/options",
    requirePermissions({ oneOf: readPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.getSupportOptions(request.auth!));
    })
  );

  router.get(
    "/dashboard",
    requirePermissions({ oneOf: readPermissions }),
    validateRequest({ query: ticketListQuerySchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.getSupportDashboard(request.auth!, request.query as SupportTicketListQuery));
    })
  );

  router.get(
    "/sla-policies",
    requirePermissions({ oneOf: readPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.listSlaPolicies(request.auth!));
    })
  );

  router.post(
    "/sla-policies",
    requirePermissions({ oneOf: configurePermissions }),
    validateRequest({ body: slaPolicyCreateSchema }),
    asyncHandler(async (request, response) => {
      response.status(201).json(await service.createSlaPolicy(request.auth!, getAuditMetadata(request), request.body as CreateSupportSlaPolicyRequestBody));
    })
  );

  router.get(
    "/knowledge-articles",
    requirePermissions({ oneOf: readPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.listKnowledgeArticles(request.auth!));
    })
  );

  router.post(
    "/knowledge-articles",
    requirePermissions({ oneOf: createPermissions }),
    validateRequest({ body: articleCreateSchema }),
    asyncHandler(async (request, response) => {
      response.status(201).json(await service.createKnowledgeArticle(request.auth!, getAuditMetadata(request), request.body as CreateSupportKnowledgeArticleRequestBody));
    })
  );

  router.get(
    "/tickets",
    requirePermissions({ oneOf: readPermissions }),
    validateRequest({ query: ticketListQuerySchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.listTickets(request.auth!, request.query as SupportTicketListQuery));
    })
  );

  router.post(
    "/tickets",
    requirePermissions({ oneOf: createPermissions }),
    validateRequest({ body: ticketCreateSchema }),
    asyncHandler(async (request, response) => {
      response.status(201).json(await service.createTicket(request.auth!, getAuditMetadata(request), request.body as CreateSupportTicketRequestBody));
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

  router.patch(
    "/tickets/:ticketId",
    requirePermissions({ oneOf: updatePermissions }),
    validateRequest({ params: ticketIdSchema, body: ticketUpdateSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await service.updateTicket(request.auth!, getAuditMetadata(request), request.params.ticketId, request.body as UpdateSupportTicketRequestBody)
      );
    })
  );

  router.delete(
    "/tickets/:ticketId",
    requirePermissions({ oneOf: deletePermissions }),
    validateRequest({ params: ticketIdSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.deleteTicket(request.auth!, getAuditMetadata(request), request.params.ticketId));
    })
  );

  router.post(
    "/tickets/:ticketId/messages",
    requirePermissions({ oneOf: messagePermissions }),
    validateRequest({ params: ticketIdSchema, body: messageCreateSchema }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await service.addTicketMessage(request.auth!, getAuditMetadata(request), request.params.ticketId, request.body as CreateSupportTicketMessageRequestBody)
      );
    })
  );

  router.post(
    "/tickets/:ticketId/articles",
    requirePermissions({ oneOf: updatePermissions }),
    validateRequest({ params: ticketIdSchema, body: linkArticleSchema }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await service.linkArticleToTicket(request.auth!, getAuditMetadata(request), request.params.ticketId, request.body.articleId)
      );
    })
  );

  return router;
}
