import { Router } from "express";
import { z } from "zod";
import type {
  AddPortalCollaborationRequestBody,
  RaiseCommissionQueryRequestBody,
  RegisterPortalDealRequestBody,
  RespondPortalCollaborationRequestBody
} from "@crm/types";
import { partnerCollaborationTypes } from "@crm/types";
import { getAuditMetadata } from "../../common/http/request-metadata.js";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { PartnerPortalService } from "./partner-portal.service.js";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
const nullableText = (max: number) => z.string().max(max).nullable().optional();

// Partner portal access is scoped in the service to the partners a user belongs to
// (owner or portal member); these base permissions keep it role-gated.
const portalPermissions = ["partners.view", "partners.edit", "partners.create", "partners.configure", "sales.view", "opportunities.view"];
const internalPermissions = ["partners.edit", "partners.configure", "partners.assign", "opportunities.edit"];

const dealIdSchema = z.object({ dealId: uuidSchema });
const registerSchema = z.object({
  partnerId: uuidSchema,
  name: z.string().min(1).max(300),
  customerName: nullableText(300),
  contact: nullableText(300),
  product: nullableText(300),
  amount: z.coerce.number().min(0).max(1_000_000_000_000).nullable().optional(),
  expectedCloseDate: z.string().max(40).nullable().optional(),
  notes: nullableText(4000),
  documents: z.array(z.string().max(1000)).max(20).optional()
});
const collaborationSchema = z.object({ type: z.enum(partnerCollaborationTypes), content: z.string().min(1).max(4000) });
const respondSchema = z.object({ content: z.string().min(1).max(4000) });
const querySchema = z.object({ message: z.string().min(1).max(2000) });

export function createPartnerPortalRouter({ databaseService }: RouterDependencies) {
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
  const service = new PartnerPortalService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS });

  router.use(authMiddleware);

  // RS-001
  router.get("/session", requirePermissions({ oneOf: portalPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getSession(request.auth!, getAuditMetadata(request)));
  }));

  // RS-002
  router.get("/deals", requirePermissions({ oneOf: portalPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listDeals(request.auth!));
  }));
  router.post("/deals", requirePermissions({ oneOf: portalPermissions }), validateRequest({ body: registerSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.registerDeal(request.auth!, getAuditMetadata(request), request.body as RegisterPortalDealRequestBody));
  }));
  router.get("/deals/:dealId", requirePermissions({ oneOf: portalPermissions }), validateRequest({ params: dealIdSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getDeal(request.auth!, request.params.dealId));
  }));

  // RS-003
  router.post("/deals/:dealId/collaboration", requirePermissions({ oneOf: portalPermissions }), validateRequest({ params: dealIdSchema, body: collaborationSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.addCollaboration(request.auth!, getAuditMetadata(request), request.params.dealId, request.body as AddPortalCollaborationRequestBody));
  }));
  router.post("/deals/:dealId/respond", requirePermissions({ oneOf: internalPermissions }), validateRequest({ params: dealIdSchema, body: respondSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.respondCollaboration(request.auth!, getAuditMetadata(request), request.params.dealId, request.body as RespondPortalCollaborationRequestBody));
  }));

  // RS-004
  router.get("/commission", requirePermissions({ oneOf: portalPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listCommission(request.auth!));
  }));
  router.post("/deals/:dealId/commission-query", requirePermissions({ oneOf: portalPermissions }), validateRequest({ params: dealIdSchema, body: querySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.raiseCommissionQuery(request.auth!, getAuditMetadata(request), request.params.dealId, request.body as RaiseCommissionQueryRequestBody));
  }));

  return router;
}
