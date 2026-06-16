import cors from "cors";
import express from "express";
import helmet from "helmet";
import { apiConfig } from "@crm/config";
import { errorHandler } from "./common/middleware/error-handler.js";
import { notFoundHandler } from "./common/middleware/not-found.js";
import { requestLogger } from "./common/middleware/request-logger.js";
import { requestContext } from "./common/middleware/request-context.js";
import { env } from "./config/env.js";
import { createV1Router } from "./routes/v1.router.js";
import { DatabaseService } from "./platform/database/database.service.js";
import { RedisService } from "./platform/redis/redis.service.js";

function normalizeOrigin(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function getAllowedCorsOrigins(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((origin) => normalizeOrigin(origin))
        .filter(Boolean)
    )
  );
}

export function createApp() {
  const app = express();
  const allowedCorsOrigins = getAllowedCorsOrigins(env.API_CORS_ORIGIN);
  const databaseService = new DatabaseService({
    enabled: env.DATABASE_ENABLED,
    driver: "postgresql",
    url: env.DATABASE_URL,
    applicationName: `${env.APP_NAME}-api`,
    maxPoolSize: env.DATABASE_POOL_MAX,
    idleTimeoutMs: env.DATABASE_IDLE_TIMEOUT_MS,
    connectionTimeoutMs: env.DATABASE_CONNECTION_TIMEOUT_MS
  });
  const redisService = new RedisService({
    enabled: env.REDIS_ENABLED,
    driver: "redis",
    url: env.REDIS_URL
  });

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin(requestOrigin, callback) {
        if (!requestOrigin) {
          callback(null, true);
          return;
        }

        callback(null, allowedCorsOrigins.includes(normalizeOrigin(requestOrigin)));
      }
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestContext);
  app.use(requestLogger);

  app.get("/", (_request, response) => {
    response.status(200).json({
      name: "AI-Native CRM API",
      phase: "Phase 7",
      docs: apiConfig.versionPrefix
    });
  });

  app.use(apiConfig.versionPrefix, createV1Router({ databaseService, redisService }));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
