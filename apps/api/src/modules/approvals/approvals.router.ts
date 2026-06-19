import { Router, type Request } from "express";
import { z } from "zod";
import {
  approvalStatuses,
  approvalTypes,
  approvalScopes,
  type AddApprovalCommentRequestBody,
  type ApprovalDecisionRequestBody,
  type ApprovalListQuery,
  type CreateApprovalRequestBody
} from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { ApprovalService } from "./approvals.service.js";

interface ApprovalsRouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
const recordSchema = z.record(z.unknown());

const approvalStatusFilterOptions = ["all", ...approvalStatuses] as const;

const approvalListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  status: z.enum(approvalStatusFilterOptions).optional(),
  scope: z.enum(approvalScopes).optional(),
  approvalType: z.enum(approvalTypes).optional(),
  search: z.string().max(200).optional()
});

const linkedRecordSchema = z.object({
  entityType: z.string().min(2).max(120),
  entityId: uuidSchema
});

const createApprovalSchema = z.object({
  approvalType: z.enum(approvalTypes),
  title: z.string().min(2).max(200),
  description: z.string().max(4000).nullable().optional(),
  approverUserId: uuidSchema.nullable().optional(),
  approverRoleId: uuidSchema.nullable().optional(),
  approverRoleSlug: z.string().min(2).max(120).nullable().optional(),
  linkedRecord: linkedRecordSchema.nullable().optional(),
  initialComment: z.string().max(4000).nullable().optional(),
  metadata: recordSchema.optional()
});

const approvalDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().max(4000).nullable().optional()
});

const approvalCommentSchema = z.object({
  comment: z.string().min(2).max(4000),
  metadata: recordSchema.optional()
});

const approvalIdSchema = z.object({
  approvalId: uuidSchema
});

function getAuditMetadata(request: Request) {
  const forwardedFor = request.header("x-forwarded-for");

  return {
    requestId: request.requestId,
    ipAddress: forwardedFor ? forwardedFor.split(",")[0]?.trim() ?? null : request.ip ?? null,
    userAgent: request.header("user-agent") ?? null
  };
}

const approvalReadPermissions = [
  "approvals.view",
  "approvals.approve",
  "approvals.edit",
  "approvals.configure"
];
const approvalCreatePermissions = [
  "approvals.create",
  "approvals.assign",
  "approvals.configure",
  "admin.configure"
];
const approvalDecisionPermissions = ["approvals.approve", "approvals.configure", "admin.configure"];
const approvalCommentPermissions = ["approvals.view", "approvals.edit", "approvals.approve", "approvals.configure"];

export function createApprovalsRouter({ databaseService }: ApprovalsRouterDependencies) {
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
  const approvalService = new ApprovalService(databaseService, {
    enableAuditLogs: env.ENABLE_AUDIT_LOGS
  });

  router.use(authMiddleware);

  router.get(
    "/",
    requirePermissions({ oneOf: approvalReadPermissions }),
    validateRequest({
      query: approvalListQuerySchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await approvalService.listApprovals(request.auth!, request.query as ApprovalListQuery));
    })
  );

  router.post(
    "/",
    requirePermissions({ oneOf: approvalCreatePermissions }),
    validateRequest({
      body: createApprovalSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await approvalService.createApproval(
          request.auth!,
          getAuditMetadata(request),
          request.body as CreateApprovalRequestBody
        )
      );
    })
  );

  router.get(
    "/:approvalId",
    requirePermissions({ oneOf: approvalReadPermissions }),
    validateRequest({
      params: approvalIdSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await approvalService.getApproval(request.auth!, request.params.approvalId));
    })
  );

  router.post(
    "/:approvalId/decision",
    requirePermissions({ oneOf: approvalDecisionPermissions }),
    validateRequest({
      params: approvalIdSchema,
      body: approvalDecisionSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await approvalService.decideApproval(
          request.auth!,
          getAuditMetadata(request),
          request.params.approvalId,
          request.body as ApprovalDecisionRequestBody
        )
      );
    })
  );

  router.post(
    "/:approvalId/comments",
    requirePermissions({ oneOf: approvalCommentPermissions }),
    validateRequest({
      params: approvalIdSchema,
      body: approvalCommentSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await approvalService.addComment(
          request.auth!,
          getAuditMetadata(request),
          request.params.approvalId,
          request.body as AddApprovalCommentRequestBody
        )
      );
    })
  );

  return router;
}
