import { Router, type Request } from "express";
import { z } from "zod";
import type {
  CreateNotificationRequestBody,
  NotificationListQuery,
  ReplaceNotificationPreferencesRequestBody
} from "@crm/types";
import { notificationTypes } from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { NotificationService } from "./notifications.service.js";

interface NotificationRouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
const recordSchema = z.record(z.unknown());

const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  status: z.enum(["all", "read", "unread"]).optional(),
  notificationType: z.enum(notificationTypes).optional()
});

const linkedRecordSchema = z.object({
  entityType: z.string().min(2).max(120),
  entityId: uuidSchema
});

const createNotificationSchema = z.object({
  notificationType: z.enum(notificationTypes),
  title: z.string().min(2).max(200),
  message: z.string().min(2).max(4000),
  recipientUserId: uuidSchema.nullable().optional(),
  recipientRoleId: uuidSchema.nullable().optional(),
  recipientRoleSlug: z.string().min(2).max(120).nullable().optional(),
  linkedRecord: linkedRecordSchema.nullable().optional(),
  metadata: recordSchema.optional()
});

const replacePreferencesSchema = z.object({
  preferences: z
    .array(
      z.object({
        notificationType: z.enum(notificationTypes),
        enabled: z.boolean()
      })
    )
    .max(50)
});

const notificationIdSchema = z.object({
  notificationId: uuidSchema
});

function getAuditMetadata(request: Request) {
  const forwardedFor = request.header("x-forwarded-for");

  return {
    requestId: request.requestId,
    ipAddress: forwardedFor ? forwardedFor.split(",")[0]?.trim() ?? null : request.ip ?? null,
    userAgent: request.header("user-agent") ?? null
  };
}

const notificationReadPermissions = ["notifications.view", "notifications.edit", "notifications.configure"];
const notificationCreatePermissions = [
  "notifications.create",
  "notifications.configure",
  "admin.configure"
];
const notificationWritePermissions = ["notifications.edit", "notifications.configure"];

export function createNotificationsRouter({ databaseService }: NotificationRouterDependencies) {
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
  const notificationService = new NotificationService(databaseService, {
    enableAuditLogs: env.ENABLE_AUDIT_LOGS
  });

  router.use(authMiddleware);

  router.get(
    "/",
    requirePermissions({ oneOf: notificationReadPermissions }),
    validateRequest({
      query: notificationListQuerySchema
    }),
    asyncHandler(async (request, response) => {
      response
        .status(200)
        .json(await notificationService.listNotifications(request.auth!, request.query as NotificationListQuery));
    })
  );

  router.post(
    "/",
    requirePermissions({ oneOf: notificationCreatePermissions }),
    validateRequest({
      body: createNotificationSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await notificationService.createNotification(
          request.auth!,
          getAuditMetadata(request),
          request.body as CreateNotificationRequestBody
        )
      );
    })
  );

  router.get(
    "/preferences",
    requirePermissions({ oneOf: notificationReadPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await notificationService.getPreferences(request.auth!));
    })
  );

  router.put(
    "/preferences",
    requirePermissions({ oneOf: notificationWritePermissions }),
    validateRequest({
      body: replacePreferencesSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await notificationService.replacePreferences(
          request.auth!,
          getAuditMetadata(request),
          request.body as ReplaceNotificationPreferencesRequestBody
        )
      );
    })
  );

  router.post(
    "/read-all",
    requirePermissions({ oneOf: notificationWritePermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await notificationService.markAllRead(request.auth!, getAuditMetadata(request)));
    })
  );

  router.post(
    "/:notificationId/read",
    requirePermissions({ oneOf: notificationWritePermissions }),
    validateRequest({
      params: notificationIdSchema
    }),
    asyncHandler(async (request, response) => {
      response
        .status(200)
        .json(await notificationService.markRead(request.auth!, getAuditMetadata(request), request.params.notificationId));
    })
  );

  return router;
}
