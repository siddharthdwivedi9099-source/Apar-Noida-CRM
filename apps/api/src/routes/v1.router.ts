import { Router } from "express";
import { apiConfig } from "@crm/config";
import { createAiGatewayRouter } from "../modules/ai/ai-gateway.router.js";
import { createAiRegistryRouter } from "../modules/ai/ai-registry.router.js";
import { createAiActionsRouter } from "../modules/ai-actions/ai-actions.router.js";
import { createRagRouter } from "../modules/rag/rag.router.js";
import { createCustomerQueryRouter } from "../modules/customer-query/customer-query.router.js";
import { createDashboardsRouter } from "../modules/dashboards/dashboards.router.js";
import { createWorkflowsRouter } from "../modules/workflows/workflows.router.js";
import { createApprovalsRouter } from "../modules/approvals/approvals.router.js";
import { createAuthRouter } from "../modules/auth/auth.router.js";
import {
  createBusinessDevelopmentRouter,
  createPresalesRouter
} from "../modules/business-development/business-development.router.js";
import { createCampaignRouter } from "../modules/campaigns/campaigns.router.js";
import { createCrmRouter } from "../modules/crm/crm.router.js";
import { createCustomerSuccessRouter } from "../modules/customer-success/customer-success.router.js";
import { createHealthRouter } from "../modules/health/health.router.js";
import { createOpportunityRouter } from "../modules/opportunities/opportunities.router.js";
import { createNotificationsRouter } from "../modules/notifications/notifications.router.js";
import { createPartnersRouter } from "../modules/partners/partners.router.js";
import { createRbacRouter } from "../modules/rbac/rbac.router.js";
import { createResellersRouter } from "../modules/resellers/resellers.router.js";
import { createSalesWorkspacesRouter } from "../modules/sales-workspaces/sales-workspaces.router.js";
import { createSocialRouter } from "../modules/social/social.router.js";
import { createSupportRouter } from "../modules/support/support.router.js";
import { createTrainingRouter } from "../modules/training/training.router.js";
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
      status: "phase-25-operational"
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
  router.use("/customer-success", createCustomerSuccessRouter({ databaseService }));
  router.use("/training", createTrainingRouter({ databaseService }));
  router.use("/ai", createAiGatewayRouter({ databaseService }));
  router.use("/ai", createAiRegistryRouter({ databaseService }));
  router.use("/ai", createAiActionsRouter({ databaseService }));
  router.use("/ai", createRagRouter({ databaseService }));
  router.use("/customer-query", createCustomerQueryRouter({ databaseService }));
  router.use("/dashboards", createDashboardsRouter({ databaseService }));
  router.use("/notifications", createNotificationsRouter({ databaseService }));
  router.use("/approvals", createApprovalsRouter({ databaseService }));
  router.use("/workflows", createWorkflowsRouter({ databaseService }));
  router.use(createCrmRouter({ databaseService }));

  return router;
}
