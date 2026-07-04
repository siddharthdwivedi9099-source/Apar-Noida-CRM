import { Router, type Request } from "express";
import { getClientIp } from "../../common/http/request-metadata.js";
import { z } from "zod";
import {
  opportunityInfluenceLevels,
  opportunityPipelineScopes,
  opportunityRelationshipStrengths,
  opportunitySortFields,
  opportunityStakeholderSentiments,
  type AcceptOpportunityRequestBody,
  type AddOpportunityDealReviewRequestBody,
  type CreateCoachingTaskRequestBody,
  type CreateOpportunityRequestBody,
  type SetOpportunityForecastRequestBody,
  type OpportunityCloseLostRequestBody,
  type OpportunityCloseWonRequestBody,
  type OpportunityDemoFeedbackBody,
  type OpportunityDemoRequestBody,
  type OpportunityDiscountRequestBody,
  type OpportunityDiscoveryUpdateBody,
  type OpportunityListQuery,
  type OpportunityNegotiationUpdateBody,
  type OpportunityProposalRequestBody,
  type OpportunityReactivateRequestBody,
  type OpportunityStakeholderProfilesUpdateBody,
  type OpportunityTenderChecklistUpdateBody,
  type RejectOpportunityRequestBody,
  type SetOpportunityParentRequestBody,
  type UpdateOpportunityRequestBody,
  type UpsertOpportunityDealReviewRequestBody,
  type UpsertOpportunityTenderRequestBody
} from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { OpportunityService } from "./opportunities.service.js";

interface OpportunityRouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
const recordSchema = z.record(z.unknown());
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const opportunityListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  search: z.string().max(200).optional(),
  stage: z.string().max(160).optional(),
  source: z.string().max(160).optional(),
  ownerId: uuidSchema.optional(),
  accountId: uuidSchema.optional(),
  contactId: uuidSchema.optional(),
  outcomeStatus: z.string().max(160).optional(),
  expectedCloseFrom: dateOnlySchema.optional(),
  expectedCloseTo: dateOnlySchema.optional(),
  stalledDays: z.coerce.number().int().positive().optional(),
  scope: z.enum(opportunityPipelineScopes).optional(),
  sortBy: z.enum(opportunitySortFields).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional()
});

const opportunityCreateSchema = z.object({
  name: z.string().min(2).max(160),
  accountId: uuidSchema.nullable().optional(),
  primaryContactId: uuidSchema.nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  stageKey: z.string().min(2).max(160),
  amount: z.coerce.number().min(0).nullable().optional(),
  probability: z.coerce.number().int().min(0).max(100).nullable().optional(),
  expectedCloseDate: dateOnlySchema.nullable().optional(),
  sourceKey: z.string().min(2).max(160),
  competitor: z.string().max(200).nullable().optional(),
  stakeholderContactIds: z.array(uuidSchema).max(200).optional(),
  nextStep: z.string().max(4000).nullable().optional(),
  outcomeStatusKey: z.string().min(2).max(160).nullable().optional(),
  outcomeReason: z.string().max(4000).nullable().optional(),
  metadata: recordSchema.optional(),
  customFields: recordSchema.optional()
});

const opportunityUpdateSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  accountId: uuidSchema.nullable().optional(),
  primaryContactId: uuidSchema.nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  stageKey: z.string().min(2).max(160).optional(),
  amount: z.coerce.number().min(0).nullable().optional(),
  probability: z.coerce.number().int().min(0).max(100).nullable().optional(),
  expectedCloseDate: dateOnlySchema.nullable().optional(),
  sourceKey: z.string().min(2).max(160).optional(),
  competitor: z.string().max(200).nullable().optional(),
  stakeholderContactIds: z.array(uuidSchema).max(200).optional(),
  nextStep: z.string().max(4000).nullable().optional(),
  outcomeStatusKey: z.string().min(2).max(160).nullable().optional(),
  outcomeReason: z.string().max(4000).nullable().optional(),
  metadata: recordSchema.optional(),
  customFields: recordSchema.optional()
});

const opportunityIdSchema = z.object({
  opportunityId: uuidSchema
});

// ---- Persona 9 (AE) schemas --------------------------------------------------------------------
const acceptSchema = z.object({ slaHours: z.coerce.number().int().positive().max(2160).nullable().optional() });
const rejectSchema = z.object({
  reason: z.string().min(1).max(4000),
  reassignToUserId: uuidSchema.nullable().optional()
});
const discoverySchema = z.object({ discovery: z.record(z.string().max(8000)) });
const stakeholderProfilesSchema = z.object({
  profiles: z
    .array(
      z.object({
        contactId: uuidSchema,
        roleKey: z.string().min(2).max(160).nullable().optional(),
        influence: z.enum(opportunityInfluenceLevels).nullable().optional(),
        sentiment: z.enum(opportunityStakeholderSentiments).nullable().optional(),
        relationship: z.enum(opportunityRelationshipStrengths).nullable().optional()
      })
    )
    .max(200)
});
const negotiationSchema = z.object({
  commercialAsks: z.string().max(8000).nullable().optional(),
  legalAsks: z.string().max(8000).nullable().optional(),
  procurementBlockers: z.string().max(8000).nullable().optional(),
  competitorOffers: z.string().max(8000).nullable().optional(),
  finalPrice: z.coerce.number().min(0).nullable().optional(),
  nextAction: z.string().max(4000).nullable().optional()
});
const demoRequestSchema = z.object({
  useCase: z.string().min(1).max(8000),
  audience: z.string().max(2000).nullable().optional(),
  painPoints: z.string().max(8000).nullable().optional(),
  modules: z.string().max(2000).nullable().optional(),
  desiredOutcome: z.string().max(4000).nullable().optional(),
  requestedDate: z.string().datetime().nullable().optional(),
  presalesOwnerId: uuidSchema
});
const demoFeedbackSchema = z.object({
  status: z.enum(["requested", "scheduled", "delivered", "cancelled"]).optional(),
  feedback: z.string().max(8000).nullable().optional()
});
const proposalSchema = z.object({
  templateKey: z.string().min(1).max(160).nullable().optional(),
  scope: z.string().max(20000).nullable().optional(),
  pricing: z.string().max(20000).nullable().optional(),
  timeline: z.string().max(8000).nullable().optional(),
  terms: z.string().max(20000).nullable().optional(),
  assumptions: z.string().max(8000).nullable().optional(),
  exclusions: z.string().max(8000).nullable().optional(),
  executiveSummary: z.string().max(20000).nullable().optional(),
  requireApproval: z.boolean().optional(),
  approverUserId: uuidSchema.nullable().optional()
});
const discountSchema = z.object({
  percent: z.coerce.number().min(0).max(100),
  justification: z.string().min(1).max(8000),
  competitorContext: z.string().max(8000).nullable().optional(),
  marginImpact: z.string().max(8000).nullable().optional(),
  value: z.coerce.number().min(0).nullable().optional(),
  closeProbability: z.coerce.number().min(0).max(100).nullable().optional(),
  approverUserId: uuidSchema
});
const closeWonSchema = z.object({
  finalValue: z.coerce.number().min(0),
  contractStatus: z.string().min(1).max(2000),
  poStatus: z.string().min(1).max(2000),
  billingTerms: z.string().min(1).max(4000),
  startDate: z.string().min(1).max(40),
  implementationScope: z.string().min(1).max(8000),
  onboardingOwnerId: uuidSchema,
  handoverNote: z.string().min(1).max(8000)
});
const closeLostSchema = z.object({
  lossReasonKey: z.string().min(2).max(160),
  competitor: z.string().max(2000).nullable().optional(),
  revisitDate: z.string().max(40).nullable().optional()
});
const reactivateSchema = z.object({ reason: z.string().min(1).max(4000), approverUserId: uuidSchema });

// ---- Persona 12 (Sales Manager) schemas --------------------------------------------------------
const dealReviewLogSchema = z.object({
  closeDate: z.string().max(40).nullable().optional(),
  nextStep: z.string().max(4000).nullable().optional(),
  stakeholders: z.string().max(8000).nullable().optional(),
  competitor: z.string().max(2000).nullable().optional(),
  risks: z.string().max(8000).nullable().optional(),
  blockers: z.string().max(8000).nullable().optional(),
  probability: z.coerce.number().int().min(0).max(100).nullable().optional(),
  comments: z.string().min(1).max(8000)
});
const forecastSchema = z.object({
  forecastCategoryKey: z.string().min(2).max(160).nullable().optional(),
  managerOverrideCategoryKey: z.string().min(2).max(160).nullable().optional(),
  overrideReason: z.string().max(4000).nullable().optional()
});
const coachingTaskSchema = z.object({
  assigneeUserId: uuidSchema,
  title: z.string().min(2).max(200),
  description: z.string().max(8000).nullable().optional(),
  dueAt: z.string().datetime().nullable().optional()
});

// ---- Persona 10 (Enterprise Sales) schemas -----------------------------------------------------
const setParentSchema = z.object({ parentOpportunityId: uuidSchema.nullable() });
const tenderSchema = z.object({
  tenderNumber: z.string().max(200).nullable().optional(),
  issuingAuthority: z.string().max(400).nullable().optional(),
  deadline: z.string().max(40).nullable().optional(),
  eligibility: z.string().max(8000).nullable().optional(),
  scope: z.string().max(20000).nullable().optional(),
  preBidDate: z.string().max(40).nullable().optional(),
  emd: z.string().max(2000).nullable().optional(),
  commercialFormat: z.string().max(2000).nullable().optional(),
  generateTasks: z.boolean().optional()
});
const tenderChecklistSchema = z.object({ checklist: z.record(z.boolean()) });
const dealReviewSchema = z.object({
  solutionFit: z.string().max(8000).nullable().optional(),
  pricing: z.string().max(8000).nullable().optional(),
  legal: z.string().max(8000).nullable().optional(),
  risk: z.string().max(8000).nullable().optional(),
  deliveryReadiness: z.string().max(8000).nullable().optional(),
  leadershipSupport: z.string().max(8000).nullable().optional(),
  submitForApproval: z.boolean().optional(),
  approverUserId: uuidSchema.nullable().optional()
});

const opportunityReadPermissions: string[] = [
  "opportunities.view",
  "opportunities.create",
  "opportunities.edit",
  "opportunities.delete",
  "opportunities.assign",
  "opportunities.approve",
  "opportunities.export",
  "opportunities.import",
  "opportunities.configure",
  "opportunities.use_ai",
  "opportunities.manage_ai",
  "opportunities.view_dashboard",
  "opportunities.manage_workflow"
];

const opportunityCreatePermissions: string[] = ["opportunities.create", "opportunities.configure"];
const opportunityUpdatePermissions: string[] = [
  "opportunities.edit",
  "opportunities.assign",
  "opportunities.approve",
  "opportunities.configure",
  "opportunities.manage_workflow"
];
const opportunityDeletePermissions: string[] = ["opportunities.delete", "opportunities.configure"];

function auditFrom(request: Request) {
  return {
    requestId: request.requestId,
    ipAddress: getClientIp(request),
    userAgent: request.header("user-agent") ?? null
  };
}

export function createOpportunityRouter({ databaseService }: OpportunityRouterDependencies) {
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
  const opportunityService = new OpportunityService(databaseService, {
    enableAuditLogs: env.ENABLE_AUDIT_LOGS
  });

  router.use(authMiddleware);

  router.get(
    "/options",
    requirePermissions({ oneOf: opportunityReadPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await opportunityService.getOpportunityOptions(request.auth!));
    })
  );

  router.get(
    "/dashboard",
    requirePermissions({ oneOf: opportunityReadPermissions }),
    validateRequest({
      query: opportunityListQuerySchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await opportunityService.getOpportunityDashboard(request.auth!, request.query as OpportunityListQuery));
    })
  );

  // ---- Persona 12 (Sales Manager) read routes (static, before /:opportunityId) ----------------
  router.get(
    "/manager/pipeline",
    requirePermissions({ oneOf: opportunityReadPermissions }),
    validateRequest({ query: opportunityListQuerySchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await opportunityService.getManagerPipeline(request.auth!, request.query as OpportunityListQuery));
    })
  );
  router.get(
    "/manager/forecast",
    requirePermissions({ oneOf: opportunityReadPermissions }),
    validateRequest({ query: opportunityListQuerySchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await opportunityService.getManagerForecast(request.auth!, request.query as OpportunityListQuery));
    })
  );
  router.get(
    "/manager/performance",
    requirePermissions({ oneOf: opportunityReadPermissions }),
    validateRequest({ query: opportunityListQuerySchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await opportunityService.getManagerPerformance(request.auth!, request.query as OpportunityListQuery));
    })
  );

  router.get(
    "/",
    requirePermissions({ oneOf: opportunityReadPermissions }),
    validateRequest({
      query: opportunityListQuerySchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await opportunityService.listOpportunities(request.auth!, request.query as OpportunityListQuery));
    })
  );

  router.post(
    "/",
    requirePermissions({ oneOf: opportunityCreatePermissions }),
    validateRequest({
      body: opportunityCreateSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await opportunityService.createOpportunity(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.body as CreateOpportunityRequestBody
        )
      );
    })
  );

  router.get(
    "/:opportunityId",
    requirePermissions({ oneOf: opportunityReadPermissions }),
    validateRequest({
      params: opportunityIdSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await opportunityService.getOpportunity(request.auth!, request.params.opportunityId));
    })
  );

  router.patch(
    "/:opportunityId",
    requirePermissions({ oneOf: opportunityUpdatePermissions }),
    validateRequest({
      params: opportunityIdSchema,
      body: opportunityUpdateSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await opportunityService.updateOpportunity(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.opportunityId,
          request.body as UpdateOpportunityRequestBody
        )
      );
    })
  );

  router.delete(
    "/:opportunityId",
    requirePermissions({ oneOf: opportunityDeletePermissions }),
    validateRequest({
      params: opportunityIdSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await opportunityService.deleteOpportunity(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.opportunityId
        )
      );
    })
  );

  router.post(
    "/:opportunityId/accept",
    requirePermissions({ oneOf: opportunityUpdatePermissions }),
    validateRequest({ params: opportunityIdSchema, body: acceptSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await opportunityService.acceptOpportunity(request.auth!, auditFrom(request), request.params.opportunityId, request.body as AcceptOpportunityRequestBody)
      );
    })
  );

  router.post(
    "/:opportunityId/reject",
    requirePermissions({ oneOf: opportunityUpdatePermissions }),
    validateRequest({ params: opportunityIdSchema, body: rejectSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await opportunityService.rejectOpportunity(request.auth!, auditFrom(request), request.params.opportunityId, request.body as RejectOpportunityRequestBody)
      );
    })
  );

  router.patch(
    "/:opportunityId/discovery",
    requirePermissions({ oneOf: opportunityUpdatePermissions }),
    validateRequest({ params: opportunityIdSchema, body: discoverySchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await opportunityService.updateOpportunityDiscovery(request.auth!, auditFrom(request), request.params.opportunityId, request.body as OpportunityDiscoveryUpdateBody)
      );
    })
  );

  router.patch(
    "/:opportunityId/stakeholder-profiles",
    requirePermissions({ oneOf: opportunityUpdatePermissions }),
    validateRequest({ params: opportunityIdSchema, body: stakeholderProfilesSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await opportunityService.updateOpportunityStakeholderProfiles(request.auth!, auditFrom(request), request.params.opportunityId, request.body as OpportunityStakeholderProfilesUpdateBody)
      );
    })
  );

  router.patch(
    "/:opportunityId/negotiation",
    requirePermissions({ oneOf: opportunityUpdatePermissions }),
    validateRequest({ params: opportunityIdSchema, body: negotiationSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await opportunityService.updateOpportunityNegotiation(request.auth!, auditFrom(request), request.params.opportunityId, request.body as OpportunityNegotiationUpdateBody)
      );
    })
  );

  router.post(
    "/:opportunityId/demo",
    requirePermissions({ oneOf: opportunityUpdatePermissions }),
    validateRequest({ params: opportunityIdSchema, body: demoRequestSchema }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await opportunityService.requestOpportunityDemo(request.auth!, auditFrom(request), request.params.opportunityId, request.body as OpportunityDemoRequestBody)
      );
    })
  );

  router.patch(
    "/:opportunityId/demo",
    requirePermissions({ oneOf: opportunityUpdatePermissions }),
    validateRequest({ params: opportunityIdSchema, body: demoFeedbackSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await opportunityService.updateOpportunityDemoFeedback(request.auth!, auditFrom(request), request.params.opportunityId, request.body as OpportunityDemoFeedbackBody)
      );
    })
  );

  router.post(
    "/:opportunityId/proposal",
    requirePermissions({ oneOf: opportunityUpdatePermissions }),
    validateRequest({ params: opportunityIdSchema, body: proposalSchema }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await opportunityService.upsertOpportunityProposal(request.auth!, auditFrom(request), request.params.opportunityId, request.body as OpportunityProposalRequestBody)
      );
    })
  );

  router.post(
    "/:opportunityId/discount",
    requirePermissions({ oneOf: opportunityUpdatePermissions }),
    validateRequest({ params: opportunityIdSchema, body: discountSchema }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await opportunityService.requestOpportunityDiscount(request.auth!, auditFrom(request), request.params.opportunityId, request.body as OpportunityDiscountRequestBody)
      );
    })
  );

  router.post(
    "/:opportunityId/close-won",
    requirePermissions({ oneOf: opportunityUpdatePermissions }),
    validateRequest({ params: opportunityIdSchema, body: closeWonSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await opportunityService.closeOpportunityWon(request.auth!, auditFrom(request), request.params.opportunityId, request.body as OpportunityCloseWonRequestBody)
      );
    })
  );

  router.post(
    "/:opportunityId/close-lost",
    requirePermissions({ oneOf: opportunityUpdatePermissions }),
    validateRequest({ params: opportunityIdSchema, body: closeLostSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await opportunityService.closeOpportunityLost(request.auth!, auditFrom(request), request.params.opportunityId, request.body as OpportunityCloseLostRequestBody)
      );
    })
  );

  router.post(
    "/:opportunityId/reactivate",
    requirePermissions({ oneOf: opportunityUpdatePermissions }),
    validateRequest({ params: opportunityIdSchema, body: reactivateSchema }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await opportunityService.reactivateOpportunity(request.auth!, auditFrom(request), request.params.opportunityId, request.body as OpportunityReactivateRequestBody)
      );
    })
  );

  router.post(
    "/:opportunityId/parent",
    requirePermissions({ oneOf: opportunityUpdatePermissions }),
    validateRequest({ params: opportunityIdSchema, body: setParentSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await opportunityService.setOpportunityParent(request.auth!, auditFrom(request), request.params.opportunityId, request.body as SetOpportunityParentRequestBody)
      );
    })
  );

  router.post(
    "/:opportunityId/tender",
    requirePermissions({ oneOf: opportunityUpdatePermissions }),
    validateRequest({ params: opportunityIdSchema, body: tenderSchema }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await opportunityService.upsertOpportunityTender(request.auth!, auditFrom(request), request.params.opportunityId, request.body as UpsertOpportunityTenderRequestBody)
      );
    })
  );

  router.patch(
    "/:opportunityId/tender/checklist",
    requirePermissions({ oneOf: opportunityUpdatePermissions }),
    validateRequest({ params: opportunityIdSchema, body: tenderChecklistSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await opportunityService.updateOpportunityTenderChecklist(request.auth!, auditFrom(request), request.params.opportunityId, request.body as OpportunityTenderChecklistUpdateBody)
      );
    })
  );

  router.post(
    "/:opportunityId/deal-review",
    requirePermissions({ oneOf: opportunityUpdatePermissions }),
    validateRequest({ params: opportunityIdSchema, body: dealReviewSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await opportunityService.upsertOpportunityDealReview(request.auth!, auditFrom(request), request.params.opportunityId, request.body as UpsertOpportunityDealReviewRequestBody)
      );
    })
  );

  // ---- Persona 12 (Sales Manager) write routes ------------------------------------------------
  router.post(
    "/:opportunityId/deal-review-log",
    requirePermissions({ oneOf: opportunityUpdatePermissions }),
    validateRequest({ params: opportunityIdSchema, body: dealReviewLogSchema }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await opportunityService.addOpportunityDealReview(request.auth!, auditFrom(request), request.params.opportunityId, request.body as AddOpportunityDealReviewRequestBody)
      );
    })
  );
  router.post(
    "/:opportunityId/forecast",
    requirePermissions({ oneOf: opportunityUpdatePermissions }),
    validateRequest({ params: opportunityIdSchema, body: forecastSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await opportunityService.setOpportunityForecast(request.auth!, auditFrom(request), request.params.opportunityId, request.body as SetOpportunityForecastRequestBody)
      );
    })
  );
  router.post(
    "/:opportunityId/coaching-task",
    requirePermissions({ oneOf: opportunityUpdatePermissions }),
    validateRequest({ params: opportunityIdSchema, body: coachingTaskSchema }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await opportunityService.createCoachingTask(request.auth!, auditFrom(request), request.params.opportunityId, request.body as CreateCoachingTaskRequestBody)
      );
    })
  );

  return router;
}
