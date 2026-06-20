import { Router } from "express";
import { validateRequest } from "../../common/validation/validate-request.js";
import { asyncHandler } from "../../common/http/async-handler.js";
import { env } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { RedisService } from "../../platform/redis/redis.service.js";
import { CacheService } from "../../platform/cache/cache.service.js";
import { HealthService } from "./health.service.js";

interface HealthRouterDependencies {
  databaseService: DatabaseService;
  redisService: RedisService;
  cacheService: CacheService;
}

export function createHealthRouter({ databaseService, redisService, cacheService }: HealthRouterDependencies) {
  const router = Router();
  const healthService = new HealthService(databaseService, redisService, cacheService);

  // Liveness (process is up). `/health` is kept for backwards compatibility and
  // `/live` is provided as the conventional liveness probe name.
  const liveness = asyncHandler(async (_request, response) => {
    response.status(200).json(await healthService.getHealth());
  });
  router.get("/health", validateRequest({}), liveness);
  router.get("/live", validateRequest({}), liveness);

  // Readiness (dependencies reachable). Returns 503 when not ready so load
  // balancers and orchestrators can route traffic away from the instance.
  router.get(
    "/ready",
    validateRequest({}),
    asyncHandler(async (_request, response) => {
      const readiness = await healthService.getReadiness();
      response.status(readiness.status === "ready" ? 200 : 503).json(readiness);
    })
  );

  // Metrics placeholder (process + cache counters as JSON).
  router.get(
    "/metrics",
    validateRequest({}),
    asyncHandler(async (_request, response) => {
      if (!env.METRICS_ENABLED) {
        throw new AppError(404, "Metrics endpoint is disabled.", undefined, "METRICS_DISABLED");
      }
      response.status(200).json(healthService.getMetrics());
    })
  );

  return router;
}
