import { Router, type Request } from "express";
import { z } from "zod";
import type { CreateDashboardViewRequestBody, UpdateDashboardViewRequestBody } from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { DashboardService } from "./dashboard.service.js";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const recordSchema = z.record(z.unknown());
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must be in YYYY-MM-DD format.");

const dateFilterSchema = z.object({ from: dateString.optional(), to: dateString.optional() });
const dashboardKeyParams = z.object({ dashboardKey: z.string().min(1).max(80) });
const widgetParams = z.object({ dashboardKey: z.string().min(1).max(80), widgetKey: z.string().min(1).max(80) });
const viewIdParams = z.object({ viewId: z.string().uuid() });

const createViewSchema = z.object({
  name: z.string().min(1).max(160),
  config: recordSchema.optional(),
  isShared: z.boolean().optional(),
  isDefault: z.boolean().optional()
});

const updateViewSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  config: recordSchema.optional(),
  isShared: z.boolean().optional(),
  isDefault: z.boolean().optional()
});

function getClientIp(request: Request) {
  const forwardedFor = request.header("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }
  return request.ip ?? null;
}

function getAuditMetadata(request: Request) {
  return { requestId: request.requestId, ipAddress: getClientIp(request), userAgent: request.header("user-agent") ?? null };
}

function getFilter(request: Request) {
  const query = request.query as { from?: string; to?: string };
  return { from: query.from ?? null, to: query.to ?? null };
}

export function createDashboardsRouter({ databaseService }: RouterDependencies) {
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
  const service = new DashboardService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS });

  router.use(authMiddleware);

  // Catalog (any authenticated user; each dashboard carries a `permitted` flag).
  router.get("/", asyncHandler(async (request, response) => {
    response.status(200).json(service.listDashboards(request.auth!));
  }));

  // Saved-view update/delete (own views only). Declared before the generic
  // ":dashboardKey" routes so "saved-views" is never treated as a dashboard key.
  router.patch("/saved-views/:viewId", validateRequest({ params: viewIdParams, body: updateViewSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.updateView(request.auth!, request.params.viewId, request.body as UpdateDashboardViewRequestBody));
  }));

  router.delete("/saved-views/:viewId", validateRequest({ params: viewIdParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.deleteView(request.auth!, request.params.viewId));
  }));

  router.get("/:dashboardKey", validateRequest({ params: dashboardKeyParams, query: dateFilterSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getDashboard(request.auth!, request.params.dashboardKey, getFilter(request)));
  }));

  router.get("/:dashboardKey/widgets/:widgetKey/drilldown", validateRequest({ params: widgetParams, query: dateFilterSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.drilldown(request.auth!, request.params.dashboardKey, request.params.widgetKey, getFilter(request)));
  }));

  router.get("/:dashboardKey/export", validateRequest({ params: dashboardKeyParams, query: dateFilterSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.exportDashboard(request.auth!, getAuditMetadata(request), request.params.dashboardKey, getFilter(request)));
  }));

  router.get("/:dashboardKey/views", validateRequest({ params: dashboardKeyParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listViews(request.auth!, request.params.dashboardKey));
  }));

  router.post("/:dashboardKey/views", validateRequest({ params: dashboardKeyParams, body: createViewSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createView(request.auth!, request.params.dashboardKey, request.body as CreateDashboardViewRequestBody));
  }));

  return router;
}
