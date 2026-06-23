import { Router } from "express";
import { getClientIp } from "../../common/http/request-metadata.js";
import { z } from "zod";
import {
  opportunityPipelineScopes,
  opportunitySortFields,
  type CreateOpportunityRequestBody,
  type OpportunityListQuery,
  type UpdateOpportunityRequestBody
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
  metadata: recordSchema.optional()
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
  metadata: recordSchema.optional()
});

const opportunityIdSchema = z.object({
  opportunityId: uuidSchema
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

  return router;
}
