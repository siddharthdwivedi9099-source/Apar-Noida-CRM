import { Router, type Request } from "express";
import { z } from "zod";
import {
  resellerOnboardingTaskStatuses,
  resellerPipelineScopes,
  resellerSortFields,
  type CreateResellerDealRegistrationRequestBody,
  type CreateResellerRequestBody,
  type ResellerListQuery,
  type UpdateResellerDealRegistrationRequestBody,
  type UpdateResellerRequestBody
} from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { ResellersService } from "./resellers.service.js";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
const recordSchema = z.record(z.unknown());
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const resellerContactSchema = z.object({
  id: uuidSchema.optional(),
  contactId: uuidSchema.nullable().optional(),
  name: z.string().min(1).max(200),
  title: z.string().max(200).nullable().optional(),
  email: z.string().max(320).nullable().optional(),
  phone: z.string().max(60).nullable().optional(),
  isPrimary: z.boolean().optional()
});

const onboardingTaskSchema = z.object({
  id: uuidSchema.optional(),
  label: z.string().min(1).max(300),
  status: z.enum(resellerOnboardingTaskStatuses).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  dueDate: dateOnlySchema.nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

const resellerListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  search: z.string().max(200).optional(),
  status: z.string().max(160).optional(),
  pricingTier: z.string().max(160).optional(),
  marginProfile: z.string().max(160).optional(),
  onboardingStatus: z.string().max(160).optional(),
  ownerId: uuidSchema.optional(),
  scope: z.enum(resellerPipelineScopes).optional(),
  sortBy: z.enum(resellerSortFields).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional()
});

const marginPercentSchema = z.coerce.number().min(0).max(100).nullable().optional();

const resellerCreateSchema = z.object({
  name: z.string().min(2).max(200),
  accountId: uuidSchema.nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  statusKey: z.string().min(2).max(160).optional(),
  pricingTierKey: z.string().min(2).max(160),
  marginProfileKey: z.string().min(2).max(160),
  onboardingStatusKey: z.string().min(2).max(160).optional(),
  region: z.string().max(200).nullable().optional(),
  territory: z.string().max(200).nullable().optional(),
  marginPercent: marginPercentSchema,
  agreementReference: z.string().max(200).nullable().optional(),
  agreementStartDate: dateOnlySchema.nullable().optional(),
  agreementEndDate: dateOnlySchema.nullable().optional(),
  agreementNotes: z.string().max(4000).nullable().optional(),
  contacts: z.array(resellerContactSchema).max(100).optional(),
  onboardingTasks: z.array(onboardingTaskSchema).max(100).optional(),
  metadata: recordSchema.optional()
});

const resellerUpdateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  accountId: uuidSchema.nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  statusKey: z.string().min(2).max(160).optional(),
  pricingTierKey: z.string().min(2).max(160).optional(),
  marginProfileKey: z.string().min(2).max(160).optional(),
  onboardingStatusKey: z.string().min(2).max(160).optional(),
  region: z.string().max(200).nullable().optional(),
  territory: z.string().max(200).nullable().optional(),
  marginPercent: marginPercentSchema,
  agreementReference: z.string().max(200).nullable().optional(),
  agreementStartDate: dateOnlySchema.nullable().optional(),
  agreementEndDate: dateOnlySchema.nullable().optional(),
  agreementNotes: z.string().max(4000).nullable().optional(),
  contacts: z.array(resellerContactSchema).max(100).optional(),
  onboardingTasks: z.array(onboardingTaskSchema).max(100).optional(),
  metadata: recordSchema.optional()
});

const dealCreateSchema = z.object({
  name: z.string().min(2).max(200),
  stageKey: z.string().min(2).max(160).optional(),
  customerName: z.string().max(200).nullable().optional(),
  amount: z.coerce.number().min(0).nullable().optional(),
  marginPercent: marginPercentSchema,
  expectedCloseDate: dateOnlySchema.nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  opportunityId: uuidSchema.nullable().optional(),
  accountId: uuidSchema.nullable().optional(),
  leadId: uuidSchema.nullable().optional(),
  metadata: recordSchema.optional()
});

const dealUpdateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  stageKey: z.string().min(2).max(160).optional(),
  customerName: z.string().max(200).nullable().optional(),
  amount: z.coerce.number().min(0).nullable().optional(),
  marginPercent: marginPercentSchema,
  expectedCloseDate: dateOnlySchema.nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  opportunityId: uuidSchema.nullable().optional(),
  accountId: uuidSchema.nullable().optional(),
  leadId: uuidSchema.nullable().optional(),
  metadata: recordSchema.optional()
});

const resellerIdSchema = z.object({ resellerId: uuidSchema });
const resellerDealIdSchema = z.object({ resellerId: uuidSchema, dealId: uuidSchema });

const readPermissions: string[] = [
  "resellers.view",
  "resellers.create",
  "resellers.edit",
  "resellers.delete",
  "resellers.assign",
  "resellers.approve",
  "resellers.export",
  "resellers.configure",
  "resellers.use_ai",
  "resellers.manage_ai",
  "resellers.view_dashboard",
  "resellers.manage_workflow"
];
const createPermissions: string[] = ["resellers.create", "resellers.configure"];
const updatePermissions: string[] = ["resellers.edit", "resellers.assign", "resellers.approve", "resellers.configure", "resellers.manage_workflow"];
const deletePermissions: string[] = ["resellers.delete", "resellers.configure"];
const dealCreatePermissions: string[] = ["resellers.create", "resellers.edit", "resellers.configure"];
const dealUpdatePermissions: string[] = ["resellers.edit", "resellers.approve", "resellers.configure", "resellers.manage_workflow"];

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

export function createResellersRouter({ databaseService }: RouterDependencies) {
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
  const service = new ResellersService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS });

  router.use(authMiddleware);

  router.get(
    "/options",
    requirePermissions({ oneOf: readPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.getResellerOptions(request.auth!));
    })
  );

  router.get(
    "/dashboard",
    requirePermissions({ oneOf: readPermissions }),
    validateRequest({ query: resellerListQuerySchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.getResellerDashboard(request.auth!, request.query as ResellerListQuery));
    })
  );

  router.get(
    "/",
    requirePermissions({ oneOf: readPermissions }),
    validateRequest({ query: resellerListQuerySchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.listResellers(request.auth!, request.query as ResellerListQuery));
    })
  );

  router.post(
    "/",
    requirePermissions({ oneOf: createPermissions }),
    validateRequest({ body: resellerCreateSchema }),
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(await service.createReseller(request.auth!, getAuditMetadata(request), request.body as CreateResellerRequestBody));
    })
  );

  router.get(
    "/:resellerId",
    requirePermissions({ oneOf: readPermissions }),
    validateRequest({ params: resellerIdSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.getReseller(request.auth!, request.params.resellerId));
    })
  );

  router.patch(
    "/:resellerId",
    requirePermissions({ oneOf: updatePermissions }),
    validateRequest({ params: resellerIdSchema, body: resellerUpdateSchema }),
    asyncHandler(async (request, response) => {
      response
        .status(200)
        .json(
          await service.updateReseller(
            request.auth!,
            getAuditMetadata(request),
            request.params.resellerId,
            request.body as UpdateResellerRequestBody
          )
        );
    })
  );

  router.delete(
    "/:resellerId",
    requirePermissions({ oneOf: deletePermissions }),
    validateRequest({ params: resellerIdSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.deleteReseller(request.auth!, getAuditMetadata(request), request.params.resellerId));
    })
  );

  router.get(
    "/:resellerId/deals",
    requirePermissions({ oneOf: readPermissions }),
    validateRequest({ params: resellerIdSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.listResellerDeals(request.auth!, request.params.resellerId));
    })
  );

  router.post(
    "/:resellerId/deals",
    requirePermissions({ oneOf: dealCreatePermissions }),
    validateRequest({ params: resellerIdSchema, body: dealCreateSchema }),
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          await service.createResellerDeal(
            request.auth!,
            getAuditMetadata(request),
            request.params.resellerId,
            request.body as CreateResellerDealRegistrationRequestBody
          )
        );
    })
  );

  router.patch(
    "/:resellerId/deals/:dealId",
    requirePermissions({ oneOf: dealUpdatePermissions }),
    validateRequest({ params: resellerDealIdSchema, body: dealUpdateSchema }),
    asyncHandler(async (request, response) => {
      response
        .status(200)
        .json(
          await service.updateResellerDeal(
            request.auth!,
            getAuditMetadata(request),
            request.params.resellerId,
            request.params.dealId,
            request.body as UpdateResellerDealRegistrationRequestBody
          )
        );
    })
  );

  return router;
}
