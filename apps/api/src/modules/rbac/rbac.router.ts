import { Router, type Request } from "express";
import { z } from "zod";
import type {
  CreateRoleRequestBody,
  ReplaceRolePermissionsRequestBody,
  ReplaceUserRolesRequestBody,
  UpdateRoleRequestBody
} from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { RbacService } from "./rbac.service.js";

interface RbacRouterDependencies {
  databaseService: DatabaseService;
}

const roleIdSchema = z.object({
  roleId: z.string().uuid()
});

const userIdSchema = z.object({
  userId: z.string().uuid()
});

const createRoleSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  templateKey: z.string().min(2).max(160).optional(),
  permissionCodes: z.array(z.string()).optional()
});

const updateRoleSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  slug: z.string().min(2).max(120).optional(),
  description: z.string().max(500).nullable().optional()
});

const replaceRolePermissionsSchema = z.object({
  permissionCodes: z.array(z.string())
});

const replaceUserRolesSchema = z.object({
  roleIds: z.array(z.string().uuid())
});

function getClientIp(request: Request) {
  const forwardedFor = request.header("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return request.ip ?? null;
}

export function createRbacRouter({ databaseService }: RbacRouterDependencies) {
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
  const rbacService = new RbacService(databaseService, {
    enableAuditLogs: env.ENABLE_AUDIT_LOGS
  });

  router.use(authMiddleware);

  router.get(
    "/catalog",
    requirePermissions({ oneOf: ["admin.view", "admin.configure"] }),
    asyncHandler(async (_request, response) => {
      response.status(200).json(await rbacService.getCatalog());
    })
  );

  router.get(
    "/roles",
    requirePermissions({ oneOf: ["admin.view", "admin.configure"] }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await rbacService.listRoles(request.auth!));
    })
  );

  router.post(
    "/roles",
    requirePermissions({ oneOf: ["admin.create", "admin.configure"] }),
    validateRequest({
      body: createRoleSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await rbacService.createRole(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.body as CreateRoleRequestBody
        )
      );
    })
  );

  router.patch(
    "/roles/:roleId",
    requirePermissions({ oneOf: ["admin.edit", "admin.configure"] }),
    validateRequest({
      params: roleIdSchema,
      body: updateRoleSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await rbacService.updateRole(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.roleId,
          request.body as UpdateRoleRequestBody
        )
      );
    })
  );

  router.delete(
    "/roles/:roleId",
    requirePermissions({ oneOf: ["admin.delete", "admin.configure"] }),
    validateRequest({
      params: roleIdSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await rbacService.deleteRole(request.auth!, {
          requestId: request.requestId,
          ipAddress: getClientIp(request),
          userAgent: request.header("user-agent") ?? null
        }, request.params.roleId)
      );
    })
  );

  router.put(
    "/roles/:roleId/permissions",
    requirePermissions({ oneOf: ["admin.assign", "admin.configure"] }),
    validateRequest({
      params: roleIdSchema,
      body: replaceRolePermissionsSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await rbacService.replaceRolePermissions(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.roleId,
          request.body as ReplaceRolePermissionsRequestBody
        )
      );
    })
  );

  router.get(
    "/users",
    requirePermissions({ oneOf: ["admin.view", "admin.configure"] }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await rbacService.listUsers(request.auth!));
    })
  );

  router.put(
    "/users/:userId/roles",
    requirePermissions({ oneOf: ["admin.assign", "admin.configure"] }),
    validateRequest({
      params: userIdSchema,
      body: replaceUserRolesSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await rbacService.replaceUserRoles(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.userId,
          request.body as ReplaceUserRolesRequestBody
        )
      );
    })
  );

  return router;
}
