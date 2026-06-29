import { Router } from "express";
import { getAuditMetadata, getClientIp } from "../../common/http/request-metadata.js";
import { z } from "zod";
import {
  bdPipelineScopes,
  bdInfluenceLevels,
  bdRelationshipStrengths,
  bdTargetAccountSortFields,
  presalesComplianceStatuses,
  presalesPipelineScopes,
  presalesPriorities,
  presalesRequestSortFields,
  presalesRequirementCategories,
  type BdConvertRequestBody,
  type BdHandoffRequestBody,
  type BdImportRequestBody,
  type CreateBdMarketSignalRequestBody,
  type CreateBdPartnerReferralRequestBody,
  type CreateBdTargetAccountRequestBody,
  type CreateBdTerritoryPlanRequestBody,
  type SubmitBdTerritoryPlanReviewRequestBody,
  type UpdateBdPartnerReferralRequestBody,
  type CreatePresalesRequestRequestBody,
  type BdTargetAccountListQuery,
  type PresalesRequestListQuery,
  type UpdateBdTargetAccountRequestBody,
  type UpdatePresalesRequestRequestBody
} from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { BusinessDevelopmentService } from "./business-development.service.js";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
const recordSchema = z.record(z.unknown());
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const booleanQuerySchema = z.preprocess((value) => {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return value;
}, z.boolean());

const bdStakeholderSchema = z.object({
  id: uuidSchema.optional(),
  contactId: uuidSchema.nullable().optional(),
  name: z.string().min(1).max(200),
  title: z.string().max(200).nullable().optional(),
  influenceLevel: z.enum(bdInfluenceLevels).optional(),
  relationshipStrength: z.enum(bdRelationshipStrengths).optional(),
  isExecutive: z.boolean().optional(),
  buyerRoleKey: z.string().min(2).max(160).nullable().optional(),
  lastEngagementAt: z.string().datetime().nullable().optional(),
  engagementNotes: z.string().max(2000).nullable().optional()
});

const bdSegmentationFields = {
  priorityKey: z.string().min(2).max(160).nullable().optional(),
  technologies: z.array(z.string().min(1).max(160)).max(30).optional()
};

const bdEngagementSignalsSchema = z
  .object({
    opens: z.coerce.number().int().min(0).optional(),
    clicks: z.coerce.number().int().min(0).optional(),
    websiteVisits: z.coerce.number().int().min(0).optional(),
    eventAttendance: z.coerce.number().int().min(0).optional(),
    replies: z.coerce.number().int().min(0).optional(),
    meetings: z.coerce.number().int().min(0).optional(),
    stakeholderEngagement: z.coerce.number().int().min(0).optional()
  })
  .strict();

const bdListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  search: z.string().max(200).optional(),
  tier: z.string().max(160).optional(),
  stage: z.string().max(160).optional(),
  partnershipType: z.string().max(160).optional(),
  ownerId: uuidSchema.optional(),
  isPartnership: booleanQuerySchema.optional(),
  scope: z.enum(bdPipelineScopes).optional(),
  sortBy: z.enum(bdTargetAccountSortFields).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional()
});

const bdCreateSchema = z.object({
  name: z.string().min(2).max(200),
  accountId: uuidSchema.nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  tierKey: z.string().min(2).max(160),
  stageKey: z.string().min(2).max(160),
  partnershipTypeKey: z.string().min(2).max(160).nullable().optional(),
  industry: z.string().max(200).nullable().optional(),
  region: z.string().max(200).nullable().optional(),
  annualRevenue: z.coerce.number().min(0).nullable().optional(),
  employeeCount: z.coerce.number().int().min(0).nullable().optional(),
  marketOpportunityNotes: z.string().max(4000).nullable().optional(),
  executiveSponsor: z.string().max(200).nullable().optional(),
  nextStep: z.string().max(4000).nullable().optional(),
  isPartnership: z.boolean().optional(),
  stakeholders: z.array(bdStakeholderSchema).max(100).optional(),
  ...bdSegmentationFields,
  metadata: recordSchema.optional()
});

const bdUpdateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  accountId: uuidSchema.nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  tierKey: z.string().min(2).max(160).optional(),
  stageKey: z.string().min(2).max(160).optional(),
  partnershipTypeKey: z.string().min(2).max(160).nullable().optional(),
  industry: z.string().max(200).nullable().optional(),
  region: z.string().max(200).nullable().optional(),
  annualRevenue: z.coerce.number().min(0).nullable().optional(),
  employeeCount: z.coerce.number().int().min(0).nullable().optional(),
  marketOpportunityNotes: z.string().max(4000).nullable().optional(),
  executiveSponsor: z.string().max(200).nullable().optional(),
  nextStep: z.string().max(4000).nullable().optional(),
  isPartnership: z.boolean().optional(),
  stakeholders: z.array(bdStakeholderSchema).max(100).optional(),
  ...bdSegmentationFields,
  sequence: z
    .object({
      paused: z.boolean().optional(),
      pauseReason: z.string().max(2000).nullable().optional(),
      completeStepKey: z.string().min(1).max(160).optional(),
      logReply: z.boolean().optional()
    })
    .optional(),
  engagementSignals: bdEngagementSignalsSchema.optional(),
  metadata: recordSchema.optional()
});

const targetAccountIdSchema = z.object({ targetAccountId: uuidSchema });

const bdImportSchema = z.object({
  accounts: z
    .array(
      z.object({
        name: z.string().min(2).max(200),
        accountId: uuidSchema.nullable().optional(),
        industry: z.string().max(200).nullable().optional(),
        region: z.string().max(200).nullable().optional(),
        tierKey: z.string().min(2).max(160).nullable().optional(),
        stageKey: z.string().min(2).max(160).nullable().optional(),
        priorityKey: z.string().min(2).max(160).nullable().optional(),
        technologies: z.array(z.string().min(1).max(160)).max(30).optional(),
        annualRevenue: z.coerce.number().min(0).nullable().optional(),
        employeeCount: z.coerce.number().int().min(0).nullable().optional()
      })
    )
    .min(1)
    .max(200)
});

const bdConvertSchema = z.object({
  opportunityName: z.string().max(200).nullable().optional(),
  stageKey: z.string().min(2).max(160),
  amount: z.coerce.number().min(0),
  expectedCloseDate: dateOnlySchema,
  nextStep: z.string().min(1).max(4000),
  ownerId: uuidSchema.nullable().optional()
});

const bdHandoffSchema = z.object({
  salesOwnerId: uuidSchema,
  recommendedApproach: z.string().min(1).max(8000),
  painPoints: z.string().max(8000).nullable().optional(),
  nextMeetingAt: z.string().datetime().nullable().optional(),
  requireApproval: z.boolean().optional(),
  approverUserId: uuidSchema.nullable().optional()
});

// ---- Persona 11 (BDM) schemas ------------------------------------------------------------------
const territoryPlanSchema = z.object({
  name: z.string().min(2).max(200),
  ownerId: uuidSchema.nullable().optional(),
  geography: z.string().max(2000).nullable().optional(),
  targetSegments: z.string().max(8000).nullable().optional(),
  namedAccounts: z.string().max(8000).nullable().optional(),
  partnerCoverage: z.string().max(8000).nullable().optional(),
  campaigns: z.string().max(8000).nullable().optional(),
  pipelineTarget: z.coerce.number().min(0).nullable().optional(),
  revenueTarget: z.coerce.number().min(0).nullable().optional()
});
const territoryPlanReviewSchema = z.object({ reviewerUserId: uuidSchema, note: z.string().max(4000).nullable().optional() });
const marketSignalSchema = z.object({
  signalTypeKey: z.string().min(2).max(160),
  content: z.string().min(1).max(8000),
  linkedEntityType: z.enum(["account", "opportunity", "campaign"]).nullable().optional(),
  linkedEntityId: uuidSchema.nullable().optional()
});
const partnerReferralSchema = z.object({
  customerName: z.string().min(1).max(200),
  partnerAccountId: uuidSchema.nullable().optional(),
  referralSource: z.string().max(2000).nullable().optional(),
  referredValue: z.coerce.number().min(0).nullable().optional(),
  notes: z.string().max(8000).nullable().optional()
});
const partnerReferralUpdateSchema = z.object({
  converted: z.boolean().optional(),
  commissionEligible: z.boolean().optional(),
  referredValue: z.coerce.number().min(0).nullable().optional(),
  opportunityId: uuidSchema.nullable().optional(),
  notes: z.string().max(8000).nullable().optional()
});

const presalesRequirementSchema = z.object({
  id: uuidSchema.optional(),
  label: z.string().min(1).max(300),
  category: z.enum(presalesRequirementCategories).optional(),
  requirement: z.string().max(4000).nullable().optional(),
  response: z.string().max(4000).nullable().optional(),
  complianceStatus: z.enum(presalesComplianceStatuses).optional(),
  priority: z.enum(presalesPriorities).optional(),
  sortOrder: z.coerce.number().int().min(0).optional()
});

const presalesListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  search: z.string().max(200).optional(),
  type: z.string().max(160).optional(),
  status: z.string().max(160).optional(),
  priority: z.enum(presalesPriorities).optional(),
  ownerId: uuidSchema.optional(),
  assigneeId: uuidSchema.optional(),
  opportunityId: uuidSchema.optional(),
  accountId: uuidSchema.optional(),
  scope: z.enum(presalesPipelineScopes).optional(),
  sortBy: z.enum(presalesRequestSortFields).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional()
});

const presalesCreateSchema = z.object({
  title: z.string().min(2).max(200),
  typeKey: z.string().min(2).max(160),
  statusKey: z.string().min(2).max(160).optional(),
  priority: z.enum(presalesPriorities).optional(),
  opportunityId: uuidSchema.nullable().optional(),
  accountId: uuidSchema.nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  assigneeId: uuidSchema.nullable().optional(),
  dueDate: dateOnlySchema.nullable().optional(),
  summary: z.string().max(4000).nullable().optional(),
  technicalRequirements: z.string().max(8000).nullable().optional(),
  proposalContent: z.string().max(20000).nullable().optional(),
  requirements: z.array(presalesRequirementSchema).max(200).optional(),
  metadata: recordSchema.optional()
});

const presalesUpdateSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  typeKey: z.string().min(2).max(160).optional(),
  statusKey: z.string().min(2).max(160).optional(),
  priority: z.enum(presalesPriorities).optional(),
  opportunityId: uuidSchema.nullable().optional(),
  accountId: uuidSchema.nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  assigneeId: uuidSchema.nullable().optional(),
  dueDate: dateOnlySchema.nullable().optional(),
  summary: z.string().max(4000).nullable().optional(),
  technicalRequirements: z.string().max(8000).nullable().optional(),
  proposalContent: z.string().max(20000).nullable().optional(),
  requirements: z.array(presalesRequirementSchema).max(200).optional(),
  metadata: recordSchema.optional()
});

const presalesRequestIdSchema = z.object({ requestId: uuidSchema });

const bdReadPermissions: string[] = [
  "business_development.view",
  "business_development.create",
  "business_development.edit",
  "business_development.delete",
  "business_development.assign",
  "business_development.approve",
  "business_development.export",
  "business_development.configure",
  "business_development.use_ai",
  "business_development.manage_ai",
  "business_development.view_dashboard",
  "business_development.manage_workflow"
];
const bdCreatePermissions: string[] = ["business_development.create", "business_development.configure"];
const bdUpdatePermissions: string[] = [
  "business_development.edit",
  "business_development.assign",
  "business_development.approve",
  "business_development.configure",
  "business_development.manage_workflow"
];
const bdDeletePermissions: string[] = ["business_development.delete", "business_development.configure"];

const presalesReadPermissions: string[] = [
  "presales.view",
  "presales.create",
  "presales.edit",
  "presales.delete",
  "presales.assign",
  "presales.approve",
  "presales.export",
  "presales.configure",
  "presales.use_ai",
  "presales.manage_ai",
  "presales.view_dashboard",
  "presales.manage_workflow"
];
const presalesCreatePermissions: string[] = ["presales.create", "presales.configure"];
const presalesUpdatePermissions: string[] = [
  "presales.edit",
  "presales.assign",
  "presales.approve",
  "presales.configure",
  "presales.manage_workflow"
];
const presalesDeletePermissions: string[] = ["presales.delete", "presales.configure"];

function createService(databaseService: DatabaseService) {
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
  const service = new BusinessDevelopmentService(databaseService, {
    enableAuditLogs: env.ENABLE_AUDIT_LOGS
  });

  return { authMiddleware, service };
}

export function createBusinessDevelopmentRouter({ databaseService }: RouterDependencies) {
  const router = Router();
  const { authMiddleware, service } = createService(databaseService);

  router.use(authMiddleware);

  router.get(
    "/options",
    requirePermissions({ oneOf: bdReadPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.getBdOptions(request.auth!));
    })
  );

  router.get(
    "/",
    requirePermissions({ oneOf: bdReadPermissions }),
    validateRequest({ query: bdListQuerySchema }),
    asyncHandler(async (request, response) => {
      response
        .status(200)
        .json(await service.listBdTargetAccounts(request.auth!, request.query as BdTargetAccountListQuery));
    })
  );

  router.post(
    "/",
    requirePermissions({ oneOf: bdCreatePermissions }),
    validateRequest({ body: bdCreateSchema }),
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          await service.createBdTargetAccount(
            request.auth!,
            getAuditMetadata(request),
            request.body as CreateBdTargetAccountRequestBody
          )
        );
    })
  );

  router.post(
    "/import",
    requirePermissions({ oneOf: bdCreatePermissions }),
    validateRequest({ body: bdImportSchema }),
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          await service.importBdTargetAccounts(request.auth!, getAuditMetadata(request), request.body as BdImportRequestBody)
        );
    })
  );

  // ---- Persona 11 (BDM) routes (static paths registered before /:targetAccountId) -------------
  router.get(
    "/territory-plans",
    requirePermissions({ oneOf: bdReadPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.listTerritoryPlans(request.auth!));
    })
  );
  router.post(
    "/territory-plans",
    requirePermissions({ oneOf: bdCreatePermissions }),
    validateRequest({ body: territoryPlanSchema }),
    asyncHandler(async (request, response) => {
      response.status(201).json(await service.createTerritoryPlan(request.auth!, getAuditMetadata(request), request.body as CreateBdTerritoryPlanRequestBody));
    })
  );
  router.post(
    "/territory-plans/:planId/review",
    requirePermissions({ oneOf: bdUpdatePermissions }),
    validateRequest({ params: z.object({ planId: uuidSchema }), body: territoryPlanReviewSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.submitTerritoryPlanReview(request.auth!, getAuditMetadata(request), request.params.planId, request.body as SubmitBdTerritoryPlanReviewRequestBody));
    })
  );

  router.get(
    "/market-signals",
    requirePermissions({ oneOf: bdReadPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.listMarketSignals(request.auth!));
    })
  );
  router.post(
    "/market-signals",
    requirePermissions({ oneOf: bdCreatePermissions }),
    validateRequest({ body: marketSignalSchema }),
    asyncHandler(async (request, response) => {
      response.status(201).json(await service.createMarketSignal(request.auth!, getAuditMetadata(request), request.body as CreateBdMarketSignalRequestBody));
    })
  );

  router.get(
    "/partner-referrals",
    requirePermissions({ oneOf: bdReadPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.listPartnerReferrals(request.auth!));
    })
  );
  router.post(
    "/partner-referrals",
    requirePermissions({ oneOf: bdCreatePermissions }),
    validateRequest({ body: partnerReferralSchema }),
    asyncHandler(async (request, response) => {
      response.status(201).json(await service.createPartnerReferral(request.auth!, getAuditMetadata(request), request.body as CreateBdPartnerReferralRequestBody));
    })
  );
  router.patch(
    "/partner-referrals/:referralId",
    requirePermissions({ oneOf: bdUpdatePermissions }),
    validateRequest({ params: z.object({ referralId: uuidSchema }), body: partnerReferralUpdateSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.updatePartnerReferral(request.auth!, getAuditMetadata(request), request.params.referralId, request.body as UpdateBdPartnerReferralRequestBody));
    })
  );

  router.get(
    "/:targetAccountId",
    requirePermissions({ oneOf: bdReadPermissions }),
    validateRequest({ params: targetAccountIdSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.getBdTargetAccount(request.auth!, request.params.targetAccountId));
    })
  );

  router.post(
    "/:targetAccountId/convert",
    requirePermissions({ oneOf: bdUpdatePermissions }),
    validateRequest({ params: targetAccountIdSchema, body: bdConvertSchema }),
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          await service.convertBdTargetAccount(
            request.auth!,
            getAuditMetadata(request),
            request.params.targetAccountId,
            request.body as BdConvertRequestBody
          )
        );
    })
  );

  router.post(
    "/:targetAccountId/handoff",
    requirePermissions({ oneOf: bdUpdatePermissions }),
    validateRequest({ params: targetAccountIdSchema, body: bdHandoffSchema }),
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          await service.handoffBdTargetAccount(
            request.auth!,
            getAuditMetadata(request),
            request.params.targetAccountId,
            request.body as BdHandoffRequestBody
          )
        );
    })
  );

  router.patch(
    "/:targetAccountId",
    requirePermissions({ oneOf: bdUpdatePermissions }),
    validateRequest({ params: targetAccountIdSchema, body: bdUpdateSchema }),
    asyncHandler(async (request, response) => {
      response
        .status(200)
        .json(
          await service.updateBdTargetAccount(
            request.auth!,
            getAuditMetadata(request),
            request.params.targetAccountId,
            request.body as UpdateBdTargetAccountRequestBody
          )
        );
    })
  );

  router.delete(
    "/:targetAccountId",
    requirePermissions({ oneOf: bdDeletePermissions }),
    validateRequest({ params: targetAccountIdSchema }),
    asyncHandler(async (request, response) => {
      response
        .status(200)
        .json(
          await service.deleteBdTargetAccount(request.auth!, getAuditMetadata(request), request.params.targetAccountId)
        );
    })
  );

  return router;
}

export function createPresalesRouter({ databaseService }: RouterDependencies) {
  const router = Router();
  const { authMiddleware, service } = createService(databaseService);

  router.use(authMiddleware);

  router.get(
    "/options",
    requirePermissions({ oneOf: presalesReadPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.getPresalesOptions(request.auth!));
    })
  );

  router.get(
    "/",
    requirePermissions({ oneOf: presalesReadPermissions }),
    validateRequest({ query: presalesListQuerySchema }),
    asyncHandler(async (request, response) => {
      response
        .status(200)
        .json(await service.listPresalesRequests(request.auth!, request.query as PresalesRequestListQuery));
    })
  );

  router.post(
    "/",
    requirePermissions({ oneOf: presalesCreatePermissions }),
    validateRequest({ body: presalesCreateSchema }),
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          await service.createPresalesRequest(
            request.auth!,
            getAuditMetadata(request),
            request.body as CreatePresalesRequestRequestBody
          )
        );
    })
  );

  router.get(
    "/:requestId",
    requirePermissions({ oneOf: presalesReadPermissions }),
    validateRequest({ params: presalesRequestIdSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.getPresalesRequest(request.auth!, request.params.requestId));
    })
  );

  router.patch(
    "/:requestId",
    requirePermissions({ oneOf: presalesUpdatePermissions }),
    validateRequest({ params: presalesRequestIdSchema, body: presalesUpdateSchema }),
    asyncHandler(async (request, response) => {
      response
        .status(200)
        .json(
          await service.updatePresalesRequest(
            request.auth!,
            getAuditMetadata(request),
            request.params.requestId,
            request.body as UpdatePresalesRequestRequestBody
          )
        );
    })
  );

  router.delete(
    "/:requestId",
    requirePermissions({ oneOf: presalesDeletePermissions }),
    validateRequest({ params: presalesRequestIdSchema }),
    asyncHandler(async (request, response) => {
      response
        .status(200)
        .json(await service.deletePresalesRequest(request.auth!, getAuditMetadata(request), request.params.requestId));
    })
  );

  return router;
}
