import cors from "cors";
import express from "express";
import helmet from "helmet";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { apiConfig } from "@crm/config";
import { createErrorHandler } from "./common/middleware/error-handler.js";
import { notFoundHandler } from "./common/middleware/not-found.js";
import { createRateLimiter } from "./common/middleware/rate-limit.js";
import { requestLogger } from "./common/middleware/request-logger.js";
import { requestContext } from "./common/middleware/request-context.js";
import { env } from "./config/env.js";
import { createV1Router } from "./routes/v1.router.js";
import { DatabaseService } from "./platform/database/database.service.js";
import { RedisService } from "./platform/redis/redis.service.js";

function normalizeOrigin(value: string) {
  return value.trim().replace(/\/+$/, "");
}

// Resolve the Express "trust proxy" setting from configuration. A finite hop
// count is preferred in production so a client cannot spoof X-Forwarded-For to
// influence IP-derived rate limiting and audit logs.
function parseTrustProxy(value: string): boolean | number | string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  const asNumber = Number(normalized);
  if (Number.isInteger(asNumber) && asNumber >= 0) {
    return asNumber;
  }
  return value.trim();
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

function getProductionWebPath() {
  if (env.NODE_ENV !== "production") {
    return null;
  }

  const webPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist");
  return existsSync(path.join(webPath, "index.html")) ? webPath : null;
}

export function serveProductionWebApp(app: express.Express, webPath: string) {
  app.use(
    "/assets",
    express.static(path.join(webPath, "assets"), {
      immutable: true,
      maxAge: "1y"
    })
  );
  app.use(express.static(webPath, { index: false, maxAge: 0 }));
  app.get("*", (request, response, next) => {
    if (request.path.startsWith(apiConfig.versionPrefix)) {
      next();
      return;
    }

    response.sendFile(path.join(webPath, "index.html"));
  });
}

export function createApp() {
  const app = express();
  const productionWebPath = getProductionWebPath();
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
  app.set("trust proxy", parseTrustProxy(env.API_TRUST_PROXY));
  app.use(
    helmet({
      referrerPolicy: { policy: "no-referrer" },
      crossOriginResourcePolicy: { policy: "same-site" },
      hsts: env.NODE_ENV === "production" ? undefined : false
    })
  );
  app.use(
    cors({
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      maxAge: 600,
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

  if (env.API_RATE_LIMIT_ENABLED) {
    app.use(createRateLimiter({ windowMs: env.API_RATE_LIMIT_WINDOW_MS, max: env.API_RATE_LIMIT_MAX, keyPrefix: "api" }));
  }

  if (!productionWebPath) {
    app.get("/", (_request, response) => {
      response.status(200).json({
        name: "AI-Native CRM API",
        version: apiConfig.version,
        status: "phase-30-operational",
        docs: apiConfig.versionPrefix
      });
    });
  }

  app.use(apiConfig.versionPrefix, createV1Router({ databaseService, redisService }));
  if (productionWebPath) {
    serveProductionWebApp(app, productionWebPath);
  }
  app.use(notFoundHandler);
  app.use(createErrorHandler(databaseService));

  return app;
}
