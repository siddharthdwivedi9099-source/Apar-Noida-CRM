import { Router } from "express";
import { z } from "zod";
import type {
  AddIntegrationAssessmentRequestBody,
  AddSecurityQuestionnaireVersionRequestBody,
  SubmitDeliveryRiskRequestBody,
  UpdateDeliveryRiskRequestBody,
  UpdateTechnicalDiscoveryRequestBody,
  UpsertArchitectureRequestBody
} from "@crm/types";
import { deliveryRiskDimensions, integrationComplexities, riskLevels, technicalDiscoveryFieldKeys } from "@crm/types";
import { getAuditMetadata } from "../../common/http/request-metadata.js";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { SolutionArchitectureService } from "./solution-architecture.service.js";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
const nullableText = (max: number) => z.string().max(max).nullable().optional();

const readPermissions = ["opportunities.view", "opportunities.view_dashboard", "opportunities.configure", "opportunities.manage_workflow", "presales.view", "presales.edit", "presales.configure"];
const managePermissions = ["opportunities.edit", "opportunities.configure", "opportunities.manage_workflow", "opportunities.approve", "presales.edit", "presales.configure"];

const opportunityParam = z.object({ opportunityId: uuidSchema });

const technicalDiscoverySchema = z.object(
  Object.fromEntries(technicalDiscoveryFieldKeys.map((key) => [key, nullableText(8000)]))
);

const architectureSchema = z.object({
  frontend: nullableText(4000),
  backend: nullableText(4000),
  database: nullableText(4000),
  integrations: nullableText(8000),
  aiLayer: nullableText(4000),
  analytics: nullableText(4000),
  security: nullableText(4000),
  deployment: nullableText(4000),
  support: nullableText(4000),
  linkedToProposal: z.boolean().optional()
});

const integrationSchema = z.object({
  system: z.string().min(1).max(300),
  method: nullableText(300),
  apiAvailability: nullableText(300),
  authentication: nullableText(300),
  frequency: nullableText(300),
  dataDirection: nullableText(300),
  complexity: z.enum(integrationComplexities).optional(),
  owner: nullableText(300),
  risk: z.enum(riskLevels).optional()
});

const securityVersionSchema = z.object({
  note: nullableText(2000),
  items: z.array(z.object({ question: z.string().min(1).max(4000), answer: z.string().max(8000).nullable().optional() })).min(1).max(200)
});

const deliveryRiskSchema = z.object({
  dimensions: z.object(
    Object.fromEntries(deliveryRiskDimensions.map((key) => [key, z.object({ level: z.enum(riskLevels), note: nullableText(2000) }).optional()]))
  )
});

const submitRiskSchema = z.object({ approverUserId: uuidSchema.nullable().optional(), note: nullableText(2000) });

export function createSolutionArchitectureRouter({ databaseService }: RouterDependencies) {
  const router = Router();
  const authService = new AuthService(databaseService, {
    enabled: env.DATABASE_ENABLED,
    accessTokenSecret: env.JWT_ACCESS_TOKEN_SECRET,
    refreshTokenSecret: env.JWT_REFRESH_TOKEN_SECRET,
    accessTokenTtlMinutes: env.JWT_ACCESS_TOKEN_TTL_MINUTES,
    refreshTokenTtlDays: env.JWT_REFRESH_TOKEN_TTL_DAYS,
    accountLockThreshold: env.AUTH_ACCOUNT_LOCK_THRESHOLD,
    accountLockMinutes: env.AUTH_ACCOUNT_LOCK_MINUTES,
    enableAuditLogs: env.ENABLE_AUDIT_LOGS
  });
  const authMiddleware = createAuthMiddleware(authService);
  const service = new SolutionArchitectureService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS });

  router.use(authMiddleware);

  router.get(
    "/:opportunityId",
    requirePermissions({ oneOf: readPermissions }),
    validateRequest({ params: opportunityParam }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.getArchitecture(request.auth!, request.params.opportunityId));
    })
  );

  router.put(
    "/:opportunityId/technical-discovery",
    requirePermissions({ oneOf: managePermissions }),
    validateRequest({ params: opportunityParam, body: technicalDiscoverySchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.updateTechnicalDiscovery(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.body as UpdateTechnicalDiscoveryRequestBody));
    })
  );

  router.put(
    "/:opportunityId/architecture",
    requirePermissions({ oneOf: managePermissions }),
    validateRequest({ params: opportunityParam, body: architectureSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.upsertArchitecture(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.body as UpsertArchitectureRequestBody));
    })
  );

  router.post(
    "/:opportunityId/architecture/approve",
    requirePermissions({ oneOf: managePermissions }),
    validateRequest({ params: opportunityParam }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.approveArchitecture(request.auth!, getAuditMetadata(request), request.params.opportunityId));
    })
  );

  router.post(
    "/:opportunityId/integrations",
    requirePermissions({ oneOf: managePermissions }),
    validateRequest({ params: opportunityParam, body: integrationSchema }),
    asyncHandler(async (request, response) => {
      response.status(201).json(await service.addIntegration(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.body as AddIntegrationAssessmentRequestBody));
    })
  );

  router.delete(
    "/:opportunityId/integrations/:integrationId",
    requirePermissions({ oneOf: managePermissions }),
    validateRequest({ params: opportunityParam.extend({ integrationId: uuidSchema }) }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.removeIntegration(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.params.integrationId));
    })
  );

  router.post(
    "/:opportunityId/security-versions",
    requirePermissions({ oneOf: managePermissions }),
    validateRequest({ params: opportunityParam, body: securityVersionSchema }),
    asyncHandler(async (request, response) => {
      response.status(201).json(await service.addSecurityVersion(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.body as AddSecurityQuestionnaireVersionRequestBody));
    })
  );

  router.post(
    "/:opportunityId/security-versions/:versionId/approve",
    requirePermissions({ oneOf: managePermissions }),
    validateRequest({ params: opportunityParam.extend({ versionId: uuidSchema }) }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.approveSecurityVersion(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.params.versionId));
    })
  );

  router.put(
    "/:opportunityId/delivery-risk",
    requirePermissions({ oneOf: managePermissions }),
    validateRequest({ params: opportunityParam, body: deliveryRiskSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.updateDeliveryRisk(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.body as UpdateDeliveryRiskRequestBody));
    })
  );

  router.post(
    "/:opportunityId/delivery-risk/submit",
    requirePermissions({ oneOf: managePermissions }),
    validateRequest({ params: opportunityParam, body: submitRiskSchema }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.submitDeliveryRisk(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.body as SubmitDeliveryRiskRequestBody));
    })
  );

  return router;
}
