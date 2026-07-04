import { Router } from "express";
import { z } from "zod";
import type {
  ReviewQuoteRequestBody,
  SetCommissionRequestBody,
  SubmitCommissionRequestBody,
  SubmitDiscountRequestBody,
  SubmitPaymentTermsRequestBody,
  UpsertQuoteRequestBody
} from "@crm/types";
import { getAuditMetadata } from "../../common/http/request-metadata.js";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { CommercialService } from "./commercial.service.js";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
const money = z.coerce.number().min(0).max(1_000_000_000_000);

const readPermissions = ["opportunities.view", "opportunities.view_dashboard", "opportunities.configure", "opportunities.manage_workflow", "opportunities.approve"];
const managePermissions = ["opportunities.edit", "opportunities.configure", "opportunities.manage_workflow", "opportunities.approve"];

const opportunityParam = z.object({ opportunityId: uuidSchema });

const quoteSchema = z.object({
  lineItems: z.array(z.object({
    id: uuidSchema.optional(),
    product: z.string().min(1).max(300),
    quantity: z.coerce.number().min(0).max(1_000_000),
    unitPrice: money,
    discountPct: z.coerce.number().min(0).max(100).optional(),
    taxPct: z.coerce.number().min(0).max(100).optional()
  })).max(200),
  implementationFees: money.optional(),
  recurringFees: money.optional(),
  paymentTermsKey: z.string().min(1).max(160).nullable().optional(),
  marginPct: z.coerce.number().min(-100).max(100).nullable().optional()
});
const reviewSchema = z.object({ decision: z.enum(["approved", "rejected", "changes_requested"]), comments: z.string().max(4000).nullable().optional() });
const discountSchema = z.object({ requestedDiscountPct: z.coerce.number().min(0).max(100), justification: z.string().max(4000).nullable().optional(), marginImpactPct: z.coerce.number().min(-100).max(100).nullable().optional(), approverUserId: uuidSchema });
const paymentTermsSetSchema = z.object({ termsKey: z.string().min(1).max(160) });
const paymentTermsSubmitSchema = z.object({ termsKey: z.string().min(1).max(160), approverUserId: uuidSchema, note: z.string().max(4000).nullable().optional() });
const commissionSchema = z.object({ partnerId: uuidSchema.nullable().optional(), ratePct: z.coerce.number().min(0).max(100), basisAmount: money.nullable().optional(), adjustmentAmount: z.coerce.number().min(-1_000_000_000).max(1_000_000_000).nullable().optional(), adjustmentReason: z.string().max(2000).nullable().optional() });
const commissionSubmitSchema = z.object({ approverUserId: uuidSchema, note: z.string().max(4000).nullable().optional() });

export function createCommercialRouter({ databaseService }: RouterDependencies) {
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
  const service = new CommercialService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS });

  router.use(authMiddleware);

  router.get("/options", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getOptions(request.auth!));
  }));

  router.get("/:opportunityId", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: opportunityParam }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getCommercial(request.auth!, request.params.opportunityId));
  }));

  // FIN-001
  router.put("/:opportunityId/quote", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: opportunityParam, body: quoteSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.upsertQuote(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.body as UpsertQuoteRequestBody));
  }));
  router.post("/:opportunityId/quote/review", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: opportunityParam, body: reviewSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.reviewQuote(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.body as ReviewQuoteRequestBody));
  }));

  // FIN-002
  router.post("/:opportunityId/discount", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: opportunityParam, body: discountSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.submitDiscount(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.body as SubmitDiscountRequestBody));
  }));

  // FIN-003
  router.put("/:opportunityId/payment-terms", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: opportunityParam, body: paymentTermsSetSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.setPaymentTerms(request.auth!, getAuditMetadata(request), request.params.opportunityId, (request.body as { termsKey: string }).termsKey));
  }));
  router.post("/:opportunityId/payment-terms/submit", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: opportunityParam, body: paymentTermsSubmitSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.submitPaymentTermsException(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.body as SubmitPaymentTermsRequestBody));
  }));

  // FIN-004
  router.put("/:opportunityId/commission", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: opportunityParam, body: commissionSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.setCommission(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.body as SetCommissionRequestBody));
  }));
  router.post("/:opportunityId/commission/submit", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: opportunityParam, body: commissionSubmitSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.submitCommission(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.body as SubmitCommissionRequestBody));
  }));

  return router;
}
