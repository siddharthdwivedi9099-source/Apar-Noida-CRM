import { Router } from "express";
import { apiConfig } from "@crm/config";
import { createAuthRouter } from "../modules/auth/auth.router.js";
import { createHealthRouter } from "../modules/health/health.router.js";
import { DatabaseService } from "../platform/database/database.service.js";
import { RedisService } from "../platform/redis/redis.service.js";

interface V1RouterDependencies {
  databaseService: DatabaseService;
  redisService: RedisService;
}

export function createV1Router({
  databaseService,
  redisService
}: V1RouterDependencies) {
  const router = Router();

  router.get("/", (_request, response) => {
    response.status(200).json({
      name: "AI-Native CRM API",
      version: apiConfig.version,
      status: "phase-3-operational"
    });
  });

  router.use(createHealthRouter({ databaseService, redisService }));
  router.use("/auth", createAuthRouter({ databaseService }));

  return router;
}
