import { Router } from "express";
import { env } from "../../config/env.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { RedisService } from "../../platform/redis/redis.service.js";
import { HealthService } from "./health.service.js";

const router = Router();

const databaseService = new DatabaseService({
  enabled: env.DATABASE_ENABLED,
  driver: "postgresql",
  url: env.DATABASE_URL
});

const redisService = new RedisService({
  enabled: env.REDIS_ENABLED,
  driver: "redis",
  url: env.REDIS_URL
});

const healthService = new HealthService(databaseService, redisService);

router.get(
  "/health",
  validateRequest({}),
  (_request, response) => {
    response.status(200).json(healthService.getHealth());
  }
);

export { router as healthRouter };

