import { Router } from "express";
import { z } from "zod";
import type {
  AddLeadershipCommentRequestBody,
  CreateSalesQuotaRequestBody,
  ReviveLostDealRequestBody,
  SetDealReviewBoardRequestBody,
  UpdateSalesQuotaRequestBody
} from "@crm/types";
import { getClientIp } from "../../common/http/request-metadata.js";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { SalesLeadershipService, type RevenueDashboardQuery } from "./sales-leadership.service.js";

interface SalesLeadershipRouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();

const readPermissions = [
  "opportunities.view",
  "opportunities.view_dashboard",
  "opportunities.configure",
  "opportunities.manage_workflow",
  "dashboards.view_dashboard"
];
const managePermissions = ["opportunities.configure", "opportunities.manage_workflow", "opportunities.approve"];

const dashboardQuerySchema = z.object({
  from: z.string().max(40).optional(),
  to: z.string().max(40).optional(),
  region: z.string().max(160).optional(),
  product: z.string().max(160).optional(),
  segment: z.string().max(160).optional(),
  teamId: uuidSchema.optional()
});

const nullableText = (max: number) => z.string().max(max).nullable().optional();

const createQuotaSchema = z.object({
  name: z.string().min(2).max(200),
  periodType: z.enum(["month", "quarter", "year"]),
  periodStart: z.string().min(4).max(40),
  periodEnd: z.string().min(4).max(40),
  ownerId: uuidSchema.nullable().optional(),
  teamId: uuidSchema.nullable().optional(),
  product: nullableText(160),
  region: nullableText(160),
  segment: nullableText(160),
  targetAmount: z.coerce.number().min(0).max(1_000_000_000_000),
  parentQuotaId: uuidSchema.nullable().optional()
});

const updateQuotaSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  targetAmount: z.coerce.number().min(0).max(1_000_000_000_000).optional(),
  ownerId: uuidSchema.nullable().optional(),
  teamId: uuidSchema.nullable().optional(),
  product: nullableText(160),
  region: nullableText(160),
  segment: nullableText(160),
  parentQuotaId: uuidSchema.nullable().optional()
});

const dealReviewBoardSchema = z.object({
  executiveSponsor: nullableText(400),
  businessCase: nullableText(8000),
  competitiveRisk: nullableText(8000),
  commercials: nullableText(8000),
  deliveryRisk: nullableText(8000),
  legalStatus: nullableText(2000),
  nextAction: nullableText(4000)
});

const leadershipCommentSchema = z.object({ comment: z.string().min(1).max(8000) });
const reviveSchema = z.object({ ownerId: uuidSchema, note: nullableText(4000) });

export function createSalesLeadershipRouter({ databaseService }: SalesLeadershipRouterDependencies) {
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
  const service = new SalesLeadershipService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS });

  const audit = (request: import("express").Request) => ({
    requestId: request.requestId,
    ipAddress: getClientIp(request),
    userAgent: request.header("user-agent") ?? null
  });

  router.use(authMiddleware);

  // SH-001
  router.get(
    "/revenue-dashboard",
    requirePermissions({ oneOf: readPermissions }),
    validateRequest({ query: dashboardQuerySchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.getRevenueDashboard(request.auth!, request.query as RevenueDashboardQuery));
    })
  );

  // SH-002
  router.get(
    "/quotas",
    requirePermissions({ oneOf: readPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.listQuotas(request.auth!));
    })
  );
  router.post(
    "/quotas",
    requirePermissions({ oneOf: managePermissions }),
    validateRequest({ body: createQuotaSchema }),
    asyncHandler(async (request, response) => {
      response.status(201).json(await service.createQuota(request.auth!, audit(request), request.body as CreateSalesQuotaRequestBody));
    })
  );
  router.patch(
    "/quotas/:quotaId",
    requirePermissions({ oneOf: managePermissions }),
    validateRequest({ params: z.object({ quotaId: uuidSchema }), body: updateQuotaSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.updateQuota(request.auth!, audit(request), request.params.quotaId, request.body as UpdateSalesQuotaRequestBody));
    })
  );
  router.delete(
    "/quotas/:quotaId",
    requirePermissions({ oneOf: managePermissions }),
    validateRequest({ params: z.object({ quotaId: uuidSchema }) }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.deleteQuota(request.auth!, audit(request), request.params.quotaId));
    })
  );

  // SH-003
  router.get(
    "/deal-review-board",
    requirePermissions({ oneOf: readPermissions }),
    validateRequest({ query: z.object({ threshold: z.coerce.number().min(0).max(1_000_000_000_000).optional() }) }),
    asyncHandler(async (request, response) => {
      const threshold = typeof request.query.threshold === "number" ? (request.query.threshold as number) : Number(request.query.threshold ?? 100000);
      response.status(200).json(await service.getDealReviewBoard(request.auth!, Number.isFinite(threshold) ? threshold : 100000));
    })
  );
  router.post(
    "/opportunities/:opportunityId/deal-review-board",
    requirePermissions({ oneOf: managePermissions }),
    validateRequest({ params: z.object({ opportunityId: uuidSchema }), body: dealReviewBoardSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.setDealReviewBoard(request.auth!, audit(request), request.params.opportunityId, request.body as SetDealReviewBoardRequestBody));
    })
  );
  router.post(
    "/opportunities/:opportunityId/leadership-comment",
    requirePermissions({ oneOf: managePermissions }),
    validateRequest({ params: z.object({ opportunityId: uuidSchema }), body: leadershipCommentSchema }),
    asyncHandler(async (request, response) => {
      response.status(201).json(await service.addLeadershipComment(request.auth!, audit(request), request.params.opportunityId, request.body as AddLeadershipCommentRequestBody));
    })
  );

  // SH-004
  router.get(
    "/win-loss",
    requirePermissions({ oneOf: readPermissions }),
    validateRequest({ query: dashboardQuerySchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.getWinLossAnalytics(request.auth!, request.query as RevenueDashboardQuery));
    })
  );
  router.post(
    "/opportunities/:opportunityId/revive",
    requirePermissions({ oneOf: managePermissions }),
    validateRequest({ params: z.object({ opportunityId: uuidSchema }), body: reviveSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.reviveLostDeal(request.auth!, audit(request), request.params.opportunityId, request.body as ReviveLostDealRequestBody));
    })
  );

  return router;
}
