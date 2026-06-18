import { Router } from "express";
import { apiConfig } from "@crm/config";
import { createAuthRouter } from "../modules/auth/auth.router.js";
import {
  createBusinessDevelopmentRouter,
  createPresalesRouter
} from "../modules/business-development/business-development.router.js";
import { createCampaignRouter } from "../modules/campaigns/campaigns.router.js";
import { createCrmRouter } from "../modules/crm/crm.router.js";
import { createHealthRouter } from "../modules/health/health.router.js";
import { createOpportunityRouter } from "../modules/opportunities/opportunities.router.js";
import { createPartnersRouter } from "../modules/partners/partners.router.js";
import { createRbacRouter } from "../modules/rbac/rbac.router.js";
import { createResellersRouter } from "../modules/resellers/resellers.router.js";
import { createSalesWorkspacesRouter } from "../modules/sales-workspaces/sales-workspaces.router.js";
import { createSocialRouter } from "../modules/social/social.router.js";
import { createSupportRouter } from "../modules/support/support.router.js";
import { createTenantConfigRouter } from "../modules/tenant-config/tenant-config.router.js";
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
      status: "phase-15-operational"
    });
  });

  router.use(createHealthRouter({ databaseService, redisService }));
  router.use("/auth", createAuthRouter({ databaseService }));
  router.use("/rbac", createRbacRouter({ databaseService }));
  router.use("/tenant-config", createTenantConfigRouter({ databaseService }));
  router.use("/campaigns", createCampaignRouter({ databaseService }));
  router.use("/opportunities", createOpportunityRouter({ databaseService }));
  router.use("/business-development", createBusinessDevelopmentRouter({ databaseService }));
  router.use("/presales", createPresalesRouter({ databaseService }));
  router.use("/partners", createPartnersRouter({ databaseService }));
  router.use("/resellers", createResellersRouter({ databaseService }));
  router.use("/sales-workspaces", createSalesWorkspacesRouter({ databaseService }));
  router.use("/social", createSocialRouter({ databaseService }));
  router.use("/support", createSupportRouter({ databaseService }));
  router.use(createCrmRouter({ databaseService }));

  return router;
}
