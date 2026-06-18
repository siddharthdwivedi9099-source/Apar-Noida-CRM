import { Router, type Request } from "express";
import { z } from "zod";
import {
  adoptionMetricTrends,
  customerSuccessAccountSortFields,
  customerSuccessScopes,
  csSupportTrends,
  csTrainingStatuses,
  escalationSeverities,
  escalationStatuses,
  onboardingMilestoneStatuses,
  onboardingPlanStatuses,
  productActivationStatuses,
  qbrStatuses,
  qbrTypes,
  successPlanStatuses,
  type CreateAdoptionMetricRequestBody,
  type CreateCustomerSuccessAccountRequestBody,
  type CreateEscalationRequestBody,
  type CreateQbrRequestBody,
  type CreateRenewalRequestBody,
  type CustomerSuccessAccountListQuery,
  type CustomerSuccessScope,
  type RecordHealthScoreRequestBody,
  type UpdateCustomerSuccessAccountRequestBody,
  type UpdateEscalationRequestBody,
  type UpdateQbrRequestBody,
  type UpdateRenewalRequestBody,
  type UpsertOnboardingPlanRequestBody,
  type UpsertSuccessPlanRequestBody
} from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { CustomerSuccessService } from "./customer-success.service.js";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
const recordSchema = z.record(z.unknown());
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const score = z.coerce.number().int().min(0).max(100);

const scopeQuerySchema = z.object({ scope: z.enum(customerSuccessScopes).optional() });

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  search: z.string().max(200).optional(),
  segment: z.string().max(160).optional(),
  lifecycleStage: z.string().max(160).optional(),
  riskStatus: z.string().max(160).optional(),
  csmOwnerId: uuidSchema.optional(),
  scope: z.enum(customerSuccessScopes).optional(),
  sortBy: z.enum(customerSuccessAccountSortFields).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional()
});

const accountCreateSchema = z.object({
  accountId: uuidSchema,
  csmOwnerId: uuidSchema.nullable().optional(),
  segmentKey: z.string().min(2).max(160).optional(),
  lifecycleStageKey: z.string().min(2).max(160).optional(),
  riskStatusKey: z.string().min(2).max(160).optional(),
  expansionPotentialKey: z.string().min(2).max(160).optional(),
  healthScore: score.nullable().optional(),
  adoptionScore: score.nullable().optional(),
  renewalDate: dateOnlySchema.nullable().optional(),
  contractValue: z.coerce.number().min(0).nullable().optional(),
  supportTrend: z.enum(csSupportTrends).optional(),
  trainingStatus: z.enum(csTrainingStatuses).optional(),
  lastTouchpointAt: z.string().datetime().nullable().optional(),
  nextAction: z.string().max(2000).nullable().optional(),
  metadata: recordSchema.optional()
});

const accountUpdateSchema = z.object({
  csmOwnerId: uuidSchema.nullable().optional(),
  segmentKey: z.string().min(2).max(160).optional(),
  lifecycleStageKey: z.string().min(2).max(160).optional(),
  riskStatusKey: z.string().min(2).max(160).optional(),
  expansionPotentialKey: z.string().min(2).max(160).optional(),
  healthScore: score.nullable().optional(),
  adoptionScore: score.nullable().optional(),
  renewalDate: dateOnlySchema.nullable().optional(),
  contractValue: z.coerce.number().min(0).nullable().optional(),
  supportTrend: z.enum(csSupportTrends).optional(),
  trainingStatus: z.enum(csTrainingStatuses).optional(),
  lastTouchpointAt: z.string().datetime().nullable().optional(),
  nextAction: z.string().max(2000).nullable().optional(),
  metadata: recordSchema.optional()
});

const milestoneSchema = z.object({
  id: uuidSchema.optional(),
  label: z.string().min(1).max(300),
  status: z.enum(onboardingMilestoneStatuses).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  dueDate: dateOnlySchema.nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

const onboardingPlanSchema = z.object({
  name: z.string().min(2).max(200),
  status: z.enum(onboardingPlanStatuses).optional(),
  startDate: dateOnlySchema.nullable().optional(),
  targetGoLiveDate: dateOnlySchema.nullable().optional(),
  productActivationStatus: z.enum(productActivationStatuses).optional(),
  firstValueAt: z.string().datetime().nullable().optional(),
  trainingCompletion: score.nullable().optional(),
  riskNotes: z.string().max(4000).nullable().optional(),
  handoverNotes: z.string().max(4000).nullable().optional(),
  milestones: z.array(milestoneSchema).max(100).optional(),
  metadata: recordSchema.optional()
});

const stakeholderSchema = z.object({
  name: z.string().min(1).max(200),
  title: z.string().max(200).nullable().optional(),
  role: z.string().max(200).nullable().optional(),
  sentiment: z.string().max(120).nullable().optional()
});

const successPlanSchema = z.object({
  name: z.string().min(2).max(200),
  status: z.enum(successPlanStatuses).optional(),
  objective: z.string().max(4000).nullable().optional(),
  valueRealization: z.string().max(4000).nullable().optional(),
  executiveSponsor: z.string().max(200).nullable().optional(),
  stakeholders: z.array(stakeholderSchema).max(100).optional(),
  expansionOpportunities: z.string().max(4000).nullable().optional(),
  renewalStrategy: z.string().max(4000).nullable().optional(),
  metadata: recordSchema.optional()
});

const healthScoreSchema = z.object({
  score,
  riskStatusKey: z.string().min(2).max(160).nullable().optional(),
  drivers: z.string().max(4000).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  metadata: recordSchema.optional()
});

const adoptionMetricSchema = z.object({
  metricKey: z.string().min(1).max(160),
  label: z.string().min(1).max(200),
  value: z.coerce.number(),
  target: z.coerce.number().nullable().optional(),
  unit: z.string().max(40).nullable().optional(),
  trend: z.enum(adoptionMetricTrends).optional(),
  periodStart: dateOnlySchema.nullable().optional(),
  periodEnd: dateOnlySchema.nullable().optional(),
  metadata: recordSchema.optional()
});

const qbrCreateSchema = z.object({
  title: z.string().min(2).max(200),
  qbrType: z.enum(qbrTypes).optional(),
  status: z.enum(qbrStatuses).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  summary: z.string().max(8000).nullable().optional(),
  outcomes: z.string().max(8000).nullable().optional(),
  nextSteps: z.string().max(8000).nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  metadata: recordSchema.optional()
});

const qbrUpdateSchema = qbrCreateSchema.partial();

const renewalCreateSchema = z.object({
  renewalDate: dateOnlySchema,
  statusKey: z.string().min(2).max(160).optional(),
  contractValue: z.coerce.number().min(0).nullable().optional(),
  forecastValue: z.coerce.number().min(0).nullable().optional(),
  probability: score.nullable().optional(),
  riskNotes: z.string().max(4000).nullable().optional(),
  strategy: z.string().max(4000).nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  metadata: recordSchema.optional()
});

const renewalUpdateSchema = z.object({
  renewalDate: dateOnlySchema.optional(),
  statusKey: z.string().min(2).max(160).optional(),
  contractValue: z.coerce.number().min(0).nullable().optional(),
  forecastValue: z.coerce.number().min(0).nullable().optional(),
  probability: score.nullable().optional(),
  riskNotes: z.string().max(4000).nullable().optional(),
  strategy: z.string().max(4000).nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  metadata: recordSchema.optional()
});

const escalationCreateSchema = z.object({
  title: z.string().min(2).max(200),
  severity: z.enum(escalationSeverities).optional(),
  status: z.enum(escalationStatuses).optional(),
  description: z.string().max(8000).nullable().optional(),
  resolution: z.string().max(8000).nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  metadata: recordSchema.optional()
});

const escalationUpdateSchema = escalationCreateSchema.partial();

const csAccountIdSchema = z.object({ csAccountId: uuidSchema });
const qbrIdSchema = z.object({ csAccountId: uuidSchema, qbrId: uuidSchema });
const renewalIdSchema = z.object({ csAccountId: uuidSchema, renewalId: uuidSchema });
const escalationIdSchema = z.object({ csAccountId: uuidSchema, escalationId: uuidSchema });

const readPermissions: string[] = [
  "customer_success.view",
  "customer_success.create",
  "customer_success.edit",
  "customer_success.delete",
  "customer_success.assign",
  "customer_success.approve",
  "customer_success.export",
  "customer_success.configure",
  "customer_success.use_ai",
  "customer_success.manage_ai",
  "customer_success.view_dashboard",
  "customer_success.manage_workflow"
];
const createPermissions: string[] = ["customer_success.create", "customer_success.configure"];
const updatePermissions: string[] = ["customer_success.edit", "customer_success.assign", "customer_success.approve", "customer_success.configure", "customer_success.manage_workflow"];
const deletePermissions: string[] = ["customer_success.delete", "customer_success.configure"];
const childPermissions: string[] = ["customer_success.create", "customer_success.edit", "customer_success.configure", "customer_success.manage_workflow"];

function getClientIp(request: Request) {
  const forwardedFor = request.header("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }
  return request.ip ?? null;
}

function getAuditMetadata(request: Request) {
  return { requestId: request.requestId, ipAddress: getClientIp(request), userAgent: request.header("user-agent") ?? null };
}

function getScope(request: Request): CustomerSuccessScope | undefined {
  return (request.query as { scope?: CustomerSuccessScope }).scope;
}

export function createCustomerSuccessRouter({ databaseService }: RouterDependencies) {
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
  const service = new CustomerSuccessService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS });

  router.use(authMiddleware);

  router.get("/options", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getOptions(request.auth!));
  }));

  router.get("/dashboard", requirePermissions({ oneOf: readPermissions }), validateRequest({ query: scopeQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getDashboard(request.auth!, getScope(request)));
  }));

  router.get("/dashboards/health", requirePermissions({ oneOf: readPermissions }), validateRequest({ query: scopeQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getHealthDashboard(request.auth!, getScope(request)));
  }));

  router.get("/dashboards/renewal", requirePermissions({ oneOf: readPermissions }), validateRequest({ query: scopeQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getRenewalDashboard(request.auth!, getScope(request)));
  }));

  router.get("/workspaces/onboarding", requirePermissions({ oneOf: readPermissions }), validateRequest({ query: scopeQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getOnboardingWorkspace(request.auth!, getScope(request)));
  }));

  router.get("/workspaces/scaled", requirePermissions({ oneOf: readPermissions }), validateRequest({ query: scopeQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getScaledWorkspace(request.auth!, getScope(request)));
  }));

  router.get("/workspaces/enterprise", requirePermissions({ oneOf: readPermissions }), validateRequest({ query: scopeQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getEnterpriseWorkspace(request.auth!, getScope(request)));
  }));

  router.get("/accounts", requirePermissions({ oneOf: readPermissions }), validateRequest({ query: listQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listAccounts(request.auth!, request.query as CustomerSuccessAccountListQuery));
  }));

  router.post("/accounts", requirePermissions({ oneOf: createPermissions }), validateRequest({ body: accountCreateSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createAccount(request.auth!, getAuditMetadata(request), request.body as CreateCustomerSuccessAccountRequestBody));
  }));

  router.get("/accounts/:csAccountId", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: csAccountIdSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getAccount(request.auth!, request.params.csAccountId));
  }));

  router.patch("/accounts/:csAccountId", requirePermissions({ oneOf: updatePermissions }), validateRequest({ params: csAccountIdSchema, body: accountUpdateSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.updateAccount(request.auth!, getAuditMetadata(request), request.params.csAccountId, request.body as UpdateCustomerSuccessAccountRequestBody));
  }));

  router.delete("/accounts/:csAccountId", requirePermissions({ oneOf: deletePermissions }), validateRequest({ params: csAccountIdSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.deleteAccount(request.auth!, getAuditMetadata(request), request.params.csAccountId));
  }));

  router.put("/accounts/:csAccountId/onboarding-plan", requirePermissions({ oneOf: childPermissions }), validateRequest({ params: csAccountIdSchema, body: onboardingPlanSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.upsertOnboardingPlan(request.auth!, getAuditMetadata(request), request.params.csAccountId, request.body as UpsertOnboardingPlanRequestBody));
  }));

  router.put("/accounts/:csAccountId/success-plan", requirePermissions({ oneOf: childPermissions }), validateRequest({ params: csAccountIdSchema, body: successPlanSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.upsertSuccessPlan(request.auth!, getAuditMetadata(request), request.params.csAccountId, request.body as UpsertSuccessPlanRequestBody));
  }));

  router.post("/accounts/:csAccountId/health-scores", requirePermissions({ oneOf: childPermissions }), validateRequest({ params: csAccountIdSchema, body: healthScoreSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.recordHealthScore(request.auth!, getAuditMetadata(request), request.params.csAccountId, request.body as RecordHealthScoreRequestBody));
  }));

  router.post("/accounts/:csAccountId/adoption-metrics", requirePermissions({ oneOf: childPermissions }), validateRequest({ params: csAccountIdSchema, body: adoptionMetricSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createAdoptionMetric(request.auth!, getAuditMetadata(request), request.params.csAccountId, request.body as CreateAdoptionMetricRequestBody));
  }));

  router.post("/accounts/:csAccountId/qbrs", requirePermissions({ oneOf: childPermissions }), validateRequest({ params: csAccountIdSchema, body: qbrCreateSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createQbr(request.auth!, getAuditMetadata(request), request.params.csAccountId, request.body as CreateQbrRequestBody));
  }));

  router.patch("/accounts/:csAccountId/qbrs/:qbrId", requirePermissions({ oneOf: childPermissions }), validateRequest({ params: qbrIdSchema, body: qbrUpdateSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.updateQbr(request.auth!, getAuditMetadata(request), request.params.csAccountId, request.params.qbrId, request.body as UpdateQbrRequestBody));
  }));

  router.post("/accounts/:csAccountId/renewals", requirePermissions({ oneOf: childPermissions }), validateRequest({ params: csAccountIdSchema, body: renewalCreateSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createRenewal(request.auth!, getAuditMetadata(request), request.params.csAccountId, request.body as CreateRenewalRequestBody));
  }));

  router.patch("/accounts/:csAccountId/renewals/:renewalId", requirePermissions({ oneOf: childPermissions }), validateRequest({ params: renewalIdSchema, body: renewalUpdateSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.updateRenewal(request.auth!, getAuditMetadata(request), request.params.csAccountId, request.params.renewalId, request.body as UpdateRenewalRequestBody));
  }));

  router.post("/accounts/:csAccountId/escalations", requirePermissions({ oneOf: childPermissions }), validateRequest({ params: csAccountIdSchema, body: escalationCreateSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createEscalation(request.auth!, getAuditMetadata(request), request.params.csAccountId, request.body as CreateEscalationRequestBody));
  }));

  router.patch("/accounts/:csAccountId/escalations/:escalationId", requirePermissions({ oneOf: childPermissions }), validateRequest({ params: escalationIdSchema, body: escalationUpdateSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.updateEscalation(request.auth!, getAuditMetadata(request), request.params.csAccountId, request.params.escalationId, request.body as UpdateEscalationRequestBody));
  }));

  return router;
}
