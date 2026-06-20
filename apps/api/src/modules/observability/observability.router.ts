import { Router } from "express";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { CacheService } from "../../platform/cache/cache.service.js";
import { JobMonitorService } from "../../platform/jobs/job-monitor.service.js";
import { AuthService } from "../auth/auth.service.js";

interface RouterDependencies {
  databaseService: DatabaseService;
  cacheService: CacheService;
  jobMonitorService: JobMonitorService;
}

const readPermissions: string[] = ["admin.view", "admin.view_dashboard", "admin.configure", "admin.manage_workflow"];

export function createObservabilityRouter({ databaseService, cacheService, jobMonitorService }: RouterDependencies) {
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

  router.use(createAuthMiddleware(authService));

  // Background job monitoring placeholder: the catalog of background jobs and the
  // current worker-runtime status.
  router.get("/jobs", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (_request, response) => {
    response.status(200).json(jobMonitorService.getJobs());
  }));

  // Cache status placeholder: dashboard cache configuration and hit/miss counters.
  router.get("/cache", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (_request, response) => {
    response.status(200).json({ cache: cacheService.getStatus() });
  }));

  return router;
}
