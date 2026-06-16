import { Router, type Request } from "express";
import { z } from "zod";
import {
  socialPostSortFields,
  type CreateSocialPostRequestBody,
  type SocialPostListQuery,
  type UpdateSocialPostRequestBody
} from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { SocialService } from "./social.service.js";

interface SocialRouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
const recordSchema = z.record(z.unknown());
const isoDateTimeSchema = z.string().max(64);

const socialPostListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  search: z.string().max(200).optional(),
  status: z.string().max(160).optional(),
  approvalStatus: z.string().max(160).optional(),
  channel: z.string().max(160).optional(),
  ownerId: uuidSchema.optional(),
  campaignId: uuidSchema.optional(),
  scheduledFrom: isoDateTimeSchema.optional(),
  scheduledTo: isoDateTimeSchema.optional(),
  sortBy: z.enum(socialPostSortFields).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional()
});

const createSocialPostSchema = z.object({
  title: z.string().min(2).max(160),
  caption: z.string().max(4000).nullable().optional(),
  creativeBrief: z.string().max(4000).nullable().optional(),
  hashtags: z.array(z.string().min(1).max(80)).max(24).optional(),
  scheduledAt: isoDateTimeSchema.nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  campaignId: uuidSchema.nullable().optional(),
  statusKey: z.string().min(2).max(160),
  approvalStatusKey: z.string().min(2).max(160),
  channelKeys: z.array(z.string().min(1).max(160)).min(1).max(12),
  metadata: recordSchema.optional()
});

const updateSocialPostSchema = z.object({
  title: z.string().min(2).max(160).optional(),
  caption: z.string().max(4000).nullable().optional(),
  creativeBrief: z.string().max(4000).nullable().optional(),
  hashtags: z.array(z.string().min(1).max(80)).max(24).optional(),
  scheduledAt: isoDateTimeSchema.nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  campaignId: uuidSchema.nullable().optional(),
  statusKey: z.string().min(2).max(160).optional(),
  approvalStatusKey: z.string().min(2).max(160).optional(),
  channelKeys: z.array(z.string().min(1).max(160)).min(1).max(12).optional(),
  metadata: recordSchema.optional()
});

const socialPostIdSchema = z.object({
  postId: uuidSchema
});

const socialReadPermissions: string[] = [
  "social.view",
  "social.create",
  "social.edit",
  "social.delete",
  "social.assign",
  "social.approve",
  "social.export",
  "social.import",
  "social.configure",
  "social.use_ai",
  "social.manage_ai",
  "social.view_dashboard",
  "social.manage_workflow"
];

const socialCreatePermissions: string[] = ["social.create", "social.configure"];
const socialUpdatePermissions: string[] = ["social.edit", "social.assign", "social.approve", "social.configure"];
const socialDeletePermissions: string[] = ["social.delete", "social.configure"];

function getClientIp(request: Request) {
  const forwardedFor = request.header("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return request.ip ?? null;
}

export function createSocialRouter({ databaseService }: SocialRouterDependencies) {
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
  const socialService = new SocialService(databaseService, {
    enableAuditLogs: env.ENABLE_AUDIT_LOGS
  });

  router.use(authMiddleware);

  router.get(
    "/channels",
    requirePermissions({ oneOf: socialReadPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await socialService.getSocialChannels(request.auth!));
    })
  );

  router.get(
    "/options",
    requirePermissions({ oneOf: socialReadPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await socialService.getSocialOptions(request.auth!));
    })
  );

  router.get(
    "/",
    requirePermissions({ oneOf: socialReadPermissions }),
    validateRequest({
      query: socialPostListQuerySchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await socialService.listSocialPosts(request.auth!, request.query as SocialPostListQuery));
    })
  );

  router.post(
    "/",
    requirePermissions({ oneOf: socialCreatePermissions }),
    validateRequest({
      body: createSocialPostSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await socialService.createSocialPost(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.body as CreateSocialPostRequestBody
        )
      );
    })
  );

  router.get(
    "/:postId",
    requirePermissions({ oneOf: socialReadPermissions }),
    validateRequest({
      params: socialPostIdSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await socialService.getSocialPost(request.auth!, request.params.postId));
    })
  );

  router.patch(
    "/:postId",
    requirePermissions({ oneOf: socialUpdatePermissions }),
    validateRequest({
      params: socialPostIdSchema,
      body: updateSocialPostSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await socialService.updateSocialPost(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.postId,
          request.body as UpdateSocialPostRequestBody
        )
      );
    })
  );

  router.delete(
    "/:postId",
    requirePermissions({ oneOf: socialDeletePermissions }),
    validateRequest({
      params: socialPostIdSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await socialService.deleteSocialPost(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.postId
        )
      );
    })
  );

  return router;
}
