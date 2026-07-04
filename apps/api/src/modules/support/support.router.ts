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
  type UpdateSupportTicketRequestBody,
  type CloseTicketRequestBody,
  type EscalateTicketRequestBody,
  type LogKbUsageRequestBody,
  type CreateArticleFromTicketRequestBody,
  type EscalateBugRequestBody,
  type PublishKnowledgeArticleRequestBody,
  type RequestRcaShareRequestBody,
  type UpdateBugStatusRequestBody,
  type UpdateInvestigationRequestBody,
  type UpsertRcaRequestBody,
  type ReassignTicketsRequestBody,
  type RecordBreachReviewRequestBody,
  type RecordCsatRequestBody,
  type ReviewEscalationRequestBody
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
  autoAcknowledge: z.boolean().optional(),
  attachments: z.array(z.string().max(1000)).max(20).optional(),
  metadata: recordSchema.optional(),
  customFields: recordSchema.optional()
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
  metadata: recordSchema.optional(),
  customFields: recordSchema.optional()
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

// ---- Persona 21 (Support Agent L1) schemas -----------------------------------------------------
const l1NullableText = (max: number) => z.string().max(max).nullable().optional();
const kbUsageSchema = z.object({ articleId: uuidSchema, helpful: z.boolean(), note: l1NullableText(2000) });
const escalateSchema = z.object({
  reason: z.string().min(1).max(4000),
  troubleshooting: l1NullableText(8000),
  logs: l1NullableText(8000),
  screenshots: l1NullableText(4000),
  impact: l1NullableText(2000),
  urgency: z.enum(["low", "medium", "high", "urgent"]).optional(),
  l2OwnerId: uuidSchema.nullable().optional(),
  notifyCustomer: z.boolean().optional(),
  slaPolicyId: uuidSchema.nullable().optional()
});
const closeSchema = z.object({ resolutionSummary: z.string().min(1).max(8000), rootCauseCategoryKey: z.string().min(1).max(160).nullable().optional(), requestCustomerConfirmation: z.boolean().optional() });

// ---- Persona 22 (Support Agent L2) schemas -----------------------------------------------------
const investigationSchema = z.object({ environment: l1NullableText(8000), configuration: l1NullableText(8000), logs: l1NullableText(20000), note: l1NullableText(8000) });
const bugEscalationSchema = z.object({
  stepsToReproduce: z.string().min(1).max(8000),
  expectedResult: l1NullableText(4000),
  actualResult: l1NullableText(4000),
  environment: l1NullableText(4000),
  logs: l1NullableText(20000),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  customerImpact: l1NullableText(4000),
  engineeringRef: l1NullableText(400)
});
const bugStatusSchema = z.object({ syncStatus: z.enum(["open", "acknowledged", "in_progress", "fixed", "wont_fix", "released"]), engineeringRef: l1NullableText(400), generateCustomerUpdate: z.boolean().optional() });
const rcaSchema = z.object({ rootCause: l1NullableText(8000), impact: l1NullableText(4000), timeline: l1NullableText(8000), resolution: l1NullableText(8000), preventiveAction: l1NullableText(8000), ownerId: uuidSchema.nullable().optional(), dueDate: z.string().max(40).nullable().optional() });
const rcaShareSchema = z.object({ approverUserId: uuidSchema, note: l1NullableText(2000) });
const articleFromTicketSchema = z.object({ title: l1NullableText(300), categoryKey: z.string().min(1).max(160).nullable().optional(), summary: l1NullableText(2000), body: l1NullableText(20000) });
const publishArticleSchema = z.object({ note: l1NullableText(2000) });

// ---- Persona 23 (Support Manager) schemas ------------------------------------------------------
const workloadQuerySchema = ticketListQuerySchema.extend({ capacity: z.coerce.number().int().min(1).max(500).optional() });
const reassignSchema = z.object({ ticketIds: z.array(uuidSchema).min(1).max(200), assigneeId: uuidSchema, note: l1NullableText(2000) });
const breachReviewSchema = z.object({ reasonKey: z.string().min(1).max(160), correctiveAction: l1NullableText(4000) });
const reviewEscalationSchema = z.object({ decision: z.enum(["reassign", "return_to_l1"]), ownerId: uuidSchema.nullable().optional(), note: l1NullableText(2000) });
const csatSchema = z.object({ score: z.coerce.number().int().min(1).max(5), comment: l1NullableText(4000) });

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

  // ---- Persona 21 (Support Agent L1) routes ----------------------------------------------------
  router.get("/queue", requirePermissions({ oneOf: readPermissions }), validateRequest({ query: ticketListQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getSupportQueue(request.auth!, request.query as SupportTicketListQuery));
  }));
  router.get("/tickets/:ticketId/intake-assist", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: ticketIdSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getIntakeAssist(request.auth!, request.params.ticketId));
  }));
  router.post("/tickets/:ticketId/acknowledge", requirePermissions({ oneOf: messagePermissions }), validateRequest({ params: ticketIdSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.acknowledgeTicket(request.auth!, getAuditMetadata(request), request.params.ticketId));
  }));
  router.get("/tickets/:ticketId/kb-recommendations", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: ticketIdSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getKbRecommendations(request.auth!, request.params.ticketId));
  }));
  router.post("/tickets/:ticketId/kb-usage", requirePermissions({ oneOf: messagePermissions }), validateRequest({ params: ticketIdSchema, body: kbUsageSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.logKbUsage(request.auth!, getAuditMetadata(request), request.params.ticketId, request.body as LogKbUsageRequestBody));
  }));
  router.post("/tickets/:ticketId/kb-insert", requirePermissions({ oneOf: messagePermissions }), validateRequest({ params: ticketIdSchema, body: z.object({ articleId: uuidSchema }) }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.insertKbTemplate(request.auth!, getAuditMetadata(request), request.params.ticketId, (request.body as { articleId: string }).articleId));
  }));
  router.post("/tickets/:ticketId/escalate", requirePermissions({ oneOf: updatePermissions }), validateRequest({ params: ticketIdSchema, body: escalateSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.escalateTicket(request.auth!, getAuditMetadata(request), request.params.ticketId, request.body as EscalateTicketRequestBody));
  }));
  router.post("/tickets/:ticketId/close", requirePermissions({ oneOf: updatePermissions }), validateRequest({ params: ticketIdSchema, body: closeSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.closeTicket(request.auth!, getAuditMetadata(request), request.params.ticketId, request.body as CloseTicketRequestBody));
  }));

  // ---- Persona 22 (Support Agent L2) routes ----------------------------------------------------
  router.get("/tickets/:ticketId/investigation", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: ticketIdSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getInvestigation(request.auth!, request.params.ticketId));
  }));
  router.put("/tickets/:ticketId/investigation", requirePermissions({ oneOf: updatePermissions }), validateRequest({ params: ticketIdSchema, body: investigationSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.updateInvestigation(request.auth!, getAuditMetadata(request), request.params.ticketId, request.body as UpdateInvestigationRequestBody));
  }));
  router.post("/tickets/:ticketId/bug-escalation", requirePermissions({ oneOf: updatePermissions }), validateRequest({ params: ticketIdSchema, body: bugEscalationSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.escalateBug(request.auth!, getAuditMetadata(request), request.params.ticketId, request.body as EscalateBugRequestBody));
  }));
  router.post("/tickets/:ticketId/bug-status", requirePermissions({ oneOf: updatePermissions }), validateRequest({ params: ticketIdSchema, body: bugStatusSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.updateBugStatus(request.auth!, getAuditMetadata(request), request.params.ticketId, request.body as UpdateBugStatusRequestBody));
  }));
  router.put("/tickets/:ticketId/rca", requirePermissions({ oneOf: updatePermissions }), validateRequest({ params: ticketIdSchema, body: rcaSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.upsertRca(request.auth!, getAuditMetadata(request), request.params.ticketId, request.body as UpsertRcaRequestBody));
  }));
  router.post("/tickets/:ticketId/rca/share", requirePermissions({ oneOf: updatePermissions }), validateRequest({ params: ticketIdSchema, body: rcaShareSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.requestRcaShare(request.auth!, getAuditMetadata(request), request.params.ticketId, request.body as RequestRcaShareRequestBody));
  }));
  router.post("/tickets/:ticketId/kb-article", requirePermissions({ oneOf: createPermissions }), validateRequest({ params: ticketIdSchema, body: articleFromTicketSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createArticleFromTicket(request.auth!, getAuditMetadata(request), request.params.ticketId, request.body as CreateArticleFromTicketRequestBody));
  }));
  router.post("/knowledge-articles/:articleId/publish", requirePermissions({ oneOf: configurePermissions }), validateRequest({ params: z.object({ articleId: uuidSchema }), body: publishArticleSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.publishKnowledgeArticle(request.auth!, getAuditMetadata(request), request.params.articleId, request.body as PublishKnowledgeArticleRequestBody));
  }));

  // ---- Persona 23 (Support Manager) routes -----------------------------------------------------
  router.get("/management/performance", requirePermissions({ oneOf: readPermissions }), validateRequest({ query: ticketListQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getTeamPerformance(request.auth!, request.query as SupportTicketListQuery));
  }));
  router.get("/management/workload", requirePermissions({ oneOf: readPermissions }), validateRequest({ query: workloadQuerySchema }), asyncHandler(async (request, response) => {
    const { capacity, ...query } = request.query as SupportTicketListQuery & { capacity?: number };
    response.status(200).json(await service.getWorkload(request.auth!, query as SupportTicketListQuery, capacity ?? 15));
  }));
  router.get("/management/escalations", requirePermissions({ oneOf: readPermissions }), validateRequest({ query: ticketListQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getEscalationOversight(request.auth!, request.query as SupportTicketListQuery));
  }));
  router.post("/management/reassign", requirePermissions({ oneOf: updatePermissions }), validateRequest({ body: reassignSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.reassignTickets(request.auth!, getAuditMetadata(request), request.body as ReassignTicketsRequestBody));
  }));
  router.post("/tickets/:ticketId/breach-review", requirePermissions({ oneOf: updatePermissions }), validateRequest({ params: ticketIdSchema, body: breachReviewSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.recordBreachReview(request.auth!, getAuditMetadata(request), request.params.ticketId, request.body as RecordBreachReviewRequestBody));
  }));
  router.post("/tickets/:ticketId/escalation-review", requirePermissions({ oneOf: updatePermissions }), validateRequest({ params: ticketIdSchema, body: reviewEscalationSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.reviewEscalation(request.auth!, getAuditMetadata(request), request.params.ticketId, request.body as ReviewEscalationRequestBody));
  }));
  router.post("/tickets/:ticketId/csat", requirePermissions({ oneOf: messagePermissions }), validateRequest({ params: ticketIdSchema, body: csatSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.recordCsat(request.auth!, getAuditMetadata(request), request.params.ticketId, request.body as RecordCsatRequestBody));
  }));

  return router;
}
