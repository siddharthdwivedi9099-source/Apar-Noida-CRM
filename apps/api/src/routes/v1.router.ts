import { Router } from "express";
import { apiConfig } from "@crm/config";
import { healthRouter } from "../modules/health/health.router.js";

const router = Router();

router.get("/", (_request, response) => {
  response.status(200).json({
    name: "AI-Native CRM API",
    version: apiConfig.version,
    status: "ready-for-foundation-work"
  });
});

router.use(healthRouter);

export { router as v1Router };

