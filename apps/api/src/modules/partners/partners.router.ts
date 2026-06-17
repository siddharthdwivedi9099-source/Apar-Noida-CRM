import { Router, type Request } from "express";
import { z } from "zod";
import {
  partnerOnboardingTaskStatuses,
  partnerPipelineScopes,
  partnerSortFields,
  type CreatePartnerDealRegistrationRequestBody,
  type CreatePartnerRequestBody,
  type PartnerListQuery,
  type UpdatePartnerDealRegistrationRequestBody,
  type UpdatePartnerRequestBody
} from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { PartnersService } from "./partners.service.js";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
const recordSchema = z.record(z.unknown());
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const partnerContactSchema = z.object({
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
  status: z.enum(partnerOnboardingTaskStatuses).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  dueDate: dateOnlySchema.nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

const partnerListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  search: z.string().max(200).optional(),
  type: z.string().max(160).optional(),
  tier: z.string().max(160).optional(),
  status: z.string().max(160).optional(),
  onboardingStatus: z.string().max(160).optional(),
  ownerId: uuidSchema.optional(),
  scope: z.enum(partnerPipelineScopes).optional(),
  sortBy: z.enum(partnerSortFields).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional()
});

const partnerCreateSchema = z.object({
  name: z.string().min(2).max(200),
  accountId: uuidSchema.nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  typeKey: z.string().min(2).max(160),
  tierKey: z.string().min(2).max(160),
  statusKey: z.string().min(2).max(160).optional(),
  onboardingStatusKey: z.string().min(2).max(160).optional(),
  region: z.string().max(200).nullable().optional(),
  territory: z.string().max(200).nullable().optional(),
  agreementReference: z.string().max(200).nullable().optional(),
  agreementStartDate: dateOnlySchema.nullable().optional(),
  agreementEndDate: dateOnlySchema.nullable().optional(),
  agreementNotes: z.string().max(4000).nullable().optional(),
  contacts: z.array(partnerContactSchema).max(100).optional(),
  onboardingTasks: z.array(onboardingTaskSchema).max(100).optional(),
  metadata: recordSchema.optional()
});

const partnerUpdateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  accountId: uuidSchema.nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  typeKey: z.string().min(2).max(160).optional(),
  tierKey: z.string().min(2).max(160).optional(),
  statusKey: z.string().min(2).max(160).optional(),
  onboardingStatusKey: z.string().min(2).max(160).optional(),
  region: z.string().max(200).nullable().optional(),
  territory: z.string().max(200).nullable().optional(),
  agreementReference: z.string().max(200).nullable().optional(),
  agreementStartDate: dateOnlySchema.nullable().optional(),
  agreementEndDate: dateOnlySchema.nullable().optional(),
  agreementNotes: z.string().max(4000).nullable().optional(),
  contacts: z.array(partnerContactSchema).max(100).optional(),
  onboardingTasks: z.array(onboardingTaskSchema).max(100).optional(),
  metadata: recordSchema.optional()
});

const dealCreateSchema = z.object({
  name: z.string().min(2).max(200),
  stageKey: z.string().min(2).max(160).optional(),
  customerName: z.string().max(200).nullable().optional(),
  amount: z.coerce.number().min(0).nullable().optional(),
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
  expectedCloseDate: dateOnlySchema.nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  opportunityId: uuidSchema.nullable().optional(),
  accountId: uuidSchema.nullable().optional(),
  leadId: uuidSchema.nullable().optional(),
  metadata: recordSchema.optional()
});

const partnerIdSchema = z.object({ partnerId: uuidSchema });
const partnerDealIdSchema = z.object({ partnerId: uuidSchema, dealId: uuidSchema });

const readPermissions: string[] = [
  "partners.view",
  "partners.create",
  "partners.edit",
  "partners.delete",
  "partners.assign",
  "partners.approve",
  "partners.export",
  "partners.configure",
  "partners.use_ai",
  "partners.manage_ai",
  "partners.view_dashboard",
  "partners.manage_workflow"
];
const createPermissions: string[] = ["partners.create", "partners.configure"];
const updatePermissions: string[] = [
  "partners.edit",
  "partners.assign",
  "partners.approve",
  "partners.configure",
  "partners.manage_workflow"
];
const deletePermissions: string[] = ["partners.delete", "partners.configure"];
const dealCreatePermissions: string[] = ["partners.create", "partners.edit", "partners.configure"];
const dealUpdatePermissions: string[] = [
  "partners.edit",
  "partners.approve",
  "partners.configure",
  "partners.manage_workflow"
];

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

export function createPartnersRouter({ databaseService }: RouterDependencies) {
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
  const service = new PartnersService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS });

  router.use(authMiddleware);

  router.get(
    "/options",
    requirePermissions({ oneOf: readPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.getPartnerOptions(request.auth!));
    })
  );

  router.get(
    "/dashboard",
    requirePermissions({ oneOf: readPermissions }),
    validateRequest({ query: partnerListQuerySchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.getPartnerDashboard(request.auth!, request.query as PartnerListQuery));
    })
  );

  router.get(
    "/",
    requirePermissions({ oneOf: readPermissions }),
    validateRequest({ query: partnerListQuerySchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.listPartners(request.auth!, request.query as PartnerListQuery));
    })
  );

  router.post(
    "/",
    requirePermissions({ oneOf: createPermissions }),
    validateRequest({ body: partnerCreateSchema }),
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(await service.createPartner(request.auth!, getAuditMetadata(request), request.body as CreatePartnerRequestBody));
    })
  );

  router.get(
    "/:partnerId",
    requirePermissions({ oneOf: readPermissions }),
    validateRequest({ params: partnerIdSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.getPartner(request.auth!, request.params.partnerId));
    })
  );

  router.patch(
    "/:partnerId",
    requirePermissions({ oneOf: updatePermissions }),
    validateRequest({ params: partnerIdSchema, body: partnerUpdateSchema }),
    asyncHandler(async (request, response) => {
      response
        .status(200)
        .json(
          await service.updatePartner(
            request.auth!,
            getAuditMetadata(request),
            request.params.partnerId,
            request.body as UpdatePartnerRequestBody
          )
        );
    })
  );

  router.delete(
    "/:partnerId",
    requirePermissions({ oneOf: deletePermissions }),
    validateRequest({ params: partnerIdSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.deletePartner(request.auth!, getAuditMetadata(request), request.params.partnerId));
    })
  );

  router.get(
    "/:partnerId/deals",
    requirePermissions({ oneOf: readPermissions }),
    validateRequest({ params: partnerIdSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.listPartnerDeals(request.auth!, request.params.partnerId));
    })
  );

  router.post(
    "/:partnerId/deals",
    requirePermissions({ oneOf: dealCreatePermissions }),
    validateRequest({ params: partnerIdSchema, body: dealCreateSchema }),
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          await service.createPartnerDeal(
            request.auth!,
            getAuditMetadata(request),
            request.params.partnerId,
            request.body as CreatePartnerDealRegistrationRequestBody
          )
        );
    })
  );

  router.patch(
    "/:partnerId/deals/:dealId",
    requirePermissions({ oneOf: dealUpdatePermissions }),
    validateRequest({ params: partnerDealIdSchema, body: dealUpdateSchema }),
    asyncHandler(async (request, response) => {
      response
        .status(200)
        .json(
          await service.updatePartnerDeal(
            request.auth!,
            getAuditMetadata(request),
            request.params.partnerId,
            request.params.dealId,
            request.body as UpdatePartnerDealRegistrationRequestBody
          )
        );
    })
  );

  return router;
}
