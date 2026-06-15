import { Router } from "express";
import { validateRequest } from "../../common/validation/validate-request.js";
import { asyncHandler } from "../../common/http/async-handler.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { RedisService } from "../../platform/redis/redis.service.js";
import { HealthService } from "./health.service.js";

interface HealthRouterDependencies {
  databaseService: DatabaseService;
  redisService: RedisService;
}

export function createHealthRouter({
  databaseService,
  redisService
}: HealthRouterDependencies) {
  const router = Router();
  const healthService = new HealthService(databaseService, redisService);

  router.get(
    "/health",
    validateRequest({}),
    asyncHandler(async (_request, response) => {
      response.status(200).json(await healthService.getHealth());
    })
  );

  return router;
}
