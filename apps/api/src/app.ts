import cors from "cors";
import express from "express";
import helmet from "helmet";
import { apiConfig } from "@crm/config";
import { errorHandler } from "./common/middleware/error-handler.js";
import { notFoundHandler } from "./common/middleware/not-found.js";
import { requestLogger } from "./common/middleware/request-logger.js";
import { env } from "./config/env.js";
import { v1Router } from "./routes/v1.router.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: env.API_CORS_ORIGIN
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  app.get("/", (_request, response) => {
    response.status(200).json({
      name: "AI-Native CRM API",
      phase: "Phase 1",
      docs: apiConfig.versionPrefix
    });
  });

  app.use(apiConfig.versionPrefix, v1Router);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

