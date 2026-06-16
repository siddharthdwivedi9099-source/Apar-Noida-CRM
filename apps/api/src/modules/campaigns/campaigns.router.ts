import { Router, type Request } from "express";
import { z } from "zod";
import {
  campaignMemberEntityTypes,
  campaignSortFields,
  type CampaignListQuery,
  type CreateCampaignMemberRequestBody,
  type CreateCampaignRequestBody,
  type UpdateCampaignMemberRequestBody,
  type UpdateCampaignRequestBody
} from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { CampaignService } from "./campaigns.service.js";

interface CampaignRouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
const recordSchema = z.record(z.unknown());
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const campaignListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  search: z.string().max(200).optional(),
  status: z.string().max(160).optional(),
  type: z.string().max(160).optional(),
  channel: z.string().max(160).optional(),
  ownerId: uuidSchema.optional(),
  sortBy: z.enum(campaignSortFields).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional()
});

const campaignAssetSchema = z.object({
  label: z.string().min(2).max(120),
  url: z.string().url().max(500),
  assetType: z.string().max(80).nullable().optional()
});

const campaignCreateSchema = z.object({
  name: z.string().min(2).max(160),
  description: z.string().max(4000).nullable().optional(),
  typeKey: z.string().min(2).max(160),
  objectiveKey: z.string().min(2).max(160),
  targetAudience: z.string().max(4000).nullable().optional(),
  budgetAmount: z.coerce.number().min(0).nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  statusKey: z.string().min(2).max(160),
  startDate: dateOnlySchema.nullable().optional(),
  endDate: dateOnlySchema.nullable().optional(),
  channelKey: z.string().min(2).max(160),
  relatedAssets: z.array(campaignAssetSchema).optional(),
  metadata: recordSchema.optional()
});

const campaignUpdateSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  description: z.string().max(4000).nullable().optional(),
  typeKey: z.string().min(2).max(160).optional(),
  objectiveKey: z.string().min(2).max(160).optional(),
  targetAudience: z.string().max(4000).nullable().optional(),
  budgetAmount: z.coerce.number().min(0).nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  statusKey: z.string().min(2).max(160).optional(),
  startDate: dateOnlySchema.nullable().optional(),
  endDate: dateOnlySchema.nullable().optional(),
  channelKey: z.string().min(2).max(160).optional(),
  relatedAssets: z.array(campaignAssetSchema).optional(),
  metadata: recordSchema.optional()
});

const memberCreateSchema = z.object({
  memberEntityType: z.enum(campaignMemberEntityTypes),
  memberEntityId: uuidSchema,
  statusKey: z.string().min(2).max(160).nullable().optional(),
  response: z.string().max(4000).nullable().optional(),
  metadata: recordSchema.optional()
});

const memberUpdateSchema = z.object({
  statusKey: z.string().min(2).max(160).nullable().optional(),
  response: z.string().max(4000).nullable().optional(),
  metadata: recordSchema.optional()
});

const campaignIdSchema = z.object({
  campaignId: uuidSchema
});

const campaignMemberIdSchema = z.object({
  campaignId: uuidSchema,
  memberId: uuidSchema
});

const campaignReadPermissions: string[] = [
  "campaigns.view",
  "campaigns.create",
  "campaigns.edit",
  "campaigns.delete",
  "campaigns.assign",
  "campaigns.approve",
  "campaigns.export",
  "campaigns.import",
  "campaigns.configure",
  "campaigns.use_ai",
  "campaigns.manage_ai",
  "campaigns.view_dashboard",
  "campaigns.manage_workflow"
];

const campaignCreatePermissions: string[] = ["campaigns.create", "campaigns.configure"];
const campaignUpdatePermissions: string[] = ["campaigns.edit", "campaigns.assign", "campaigns.configure"];
const campaignDeletePermissions: string[] = ["campaigns.delete", "campaigns.configure"];
const campaignMemberWritePermissions: string[] = [
  "campaigns.create",
  "campaigns.edit",
  "campaigns.assign",
  "campaigns.configure"
];

function getClientIp(request: Request) {
  const forwardedFor = request.header("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return request.ip ?? null;
}

export function createCampaignRouter({ databaseService }: CampaignRouterDependencies) {
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
  const campaignService = new CampaignService(databaseService, {
    enableAuditLogs: env.ENABLE_AUDIT_LOGS
  });

  router.use(authMiddleware);

  router.get(
    "/options",
    requirePermissions({ oneOf: campaignReadPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await campaignService.getCampaignOptions(request.auth!));
    })
  );

  router.get(
    "/",
    requirePermissions({ oneOf: campaignReadPermissions }),
    validateRequest({
      query: campaignListQuerySchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await campaignService.listCampaigns(request.auth!, request.query as CampaignListQuery));
    })
  );

  router.post(
    "/",
    requirePermissions({ oneOf: campaignCreatePermissions }),
    validateRequest({
      body: campaignCreateSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await campaignService.createCampaign(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.body as CreateCampaignRequestBody
        )
      );
    })
  );

  router.get(
    "/:campaignId",
    requirePermissions({ oneOf: campaignReadPermissions }),
    validateRequest({
      params: campaignIdSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await campaignService.getCampaign(request.auth!, request.params.campaignId));
    })
  );

  router.patch(
    "/:campaignId",
    requirePermissions({ oneOf: campaignUpdatePermissions }),
    validateRequest({
      params: campaignIdSchema,
      body: campaignUpdateSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await campaignService.updateCampaign(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.campaignId,
          request.body as UpdateCampaignRequestBody
        )
      );
    })
  );

  router.delete(
    "/:campaignId",
    requirePermissions({ oneOf: campaignDeletePermissions }),
    validateRequest({
      params: campaignIdSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await campaignService.deleteCampaign(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.campaignId
        )
      );
    })
  );

  router.get(
    "/:campaignId/members",
    requirePermissions({ oneOf: campaignReadPermissions }),
    validateRequest({
      params: campaignIdSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await campaignService.listCampaignMembers(request.auth!, request.params.campaignId));
    })
  );

  router.post(
    "/:campaignId/members",
    requirePermissions({ oneOf: campaignMemberWritePermissions }),
    validateRequest({
      params: campaignIdSchema,
      body: memberCreateSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await campaignService.createCampaignMember(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.campaignId,
          request.body as CreateCampaignMemberRequestBody
        )
      );
    })
  );

  router.patch(
    "/:campaignId/members/:memberId",
    requirePermissions({ oneOf: campaignMemberWritePermissions }),
    validateRequest({
      params: campaignMemberIdSchema,
      body: memberUpdateSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await campaignService.updateCampaignMember(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.campaignId,
          request.params.memberId,
          request.body as UpdateCampaignMemberRequestBody
        )
      );
    })
  );

  router.delete(
    "/:campaignId/members/:memberId",
    requirePermissions({ oneOf: campaignMemberWritePermissions }),
    validateRequest({
      params: campaignMemberIdSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await campaignService.deleteCampaignMember(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.campaignId,
          request.params.memberId
        )
      );
    })
  );

  return router;
}
