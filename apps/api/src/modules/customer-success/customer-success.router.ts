import { Router, type Request } from "express";
import { getAuditMetadata } from "../../common/http/request-metadata.js";
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
  type UpsertSuccessPlanRequestBody,
  onboardingImplementationTypes,
  goLiveItemStatuses,
  goLiveChecklistItems,
  type ProvisionOnboardingRequestBody,
  type RecordHandoverRequestBody,
  type RecordKickoffRequestBody,
  type UpdateGoLiveChecklistRequestBody,
  type CompleteGoLiveRequestBody,
  type CompleteOnboardingRequestBody,
  healthFactorKeys,
  healthBands,
  adoptionCampaignStatuses,
  type ComputeHealthScoreRequestBody,
  type CreateAdoptionCampaignRequestBody,
  type CreateExpansionOpportunityRequestBody,
  type LowUsageCheckRequestBody,
  type RenewalPlaybookRequestBody
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

// ---- Persona 24 (CSM — Onboarding) schemas -----------------------------------------------------
const planIdSchema = z.object({ planId: uuidSchema });
const csNullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const provisionSchema = z.object({ opportunityId: uuidSchema, implementationType: z.enum(onboardingImplementationTypes).optional() });
const handoverSchema = z.object({
  fields: z.object({
    contract: csNullableText(8000), scope: csNullableText(8000), products: csNullableText(4000), commitments: csNullableText(8000),
    stakeholders: csNullableText(4000), timeline: csNullableText(4000), risks: csNullableText(8000), specialTerms: csNullableText(8000),
    integrations: csNullableText(4000), successCriteria: csNullableText(8000)
  })
});
const kickoffSchema = z.object({
  scheduledAt: csNullableText(40),
  attendees: z.array(z.string().trim().max(200)).max(50).optional(),
  decisions: csNullableText(8000),
  actionItems: z.array(z.object({ description: z.string().min(1).max(2000), ownerId: uuidSchema.nullable().optional(), dueDate: csNullableText(40) })).max(50).optional(),
  successCriteriaConfirmed: z.boolean().optional(),
  markCompleted: z.boolean().optional()
});
const goLiveChecklistSchema = z.object({
  items: z.record(z.enum(goLiveChecklistItems.map((item) => item.key) as [string, ...string[]]), z.enum(goLiveItemStatuses))
});
const completeGoLiveSchema = z.object({ goLiveDate: dateOnlySchema });
const completeOnboardingSchema = z.object({
  goLiveDate: dateOnlySchema.nullable().optional(),
  usersTrained: z.coerce.number().int().min(0).nullable().optional(),
  adoptionBaseline: score.nullable().optional(),
  openRisks: csNullableText(8000),
  pendingItems: csNullableText(8000),
  customerSignOff: z.boolean(),
  ongoingCsmId: uuidSchema,
  initialHealthScore: score
});

// ---- Persona 25 (CSM — Scaled) schemas ---------------------------------------------------------
const healthFactorsSchema = z.object(Object.fromEntries(healthFactorKeys.map((key) => [key, score.optional()])));
const computeHealthSchema = z.object({
  factors: healthFactorsSchema,
  notes: csNullableText(4000)
});
const campaignCriteriaSchema = z.object({
  minUsage: z.coerce.number().min(0).nullable().optional(),
  module: csNullableText(160),
  role: csNullableText(160),
  segmentKey: csNullableText(160),
  healthBand: z.enum(healthBands).nullable().optional()
});
const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  criteria: campaignCriteriaSchema,
  contentTemplate: csNullableText(8000),
  status: z.enum(adoptionCampaignStatuses).optional()
});
const lowUsageSchema = z.object({ metricLabel: z.string().min(1).max(200), current: z.coerce.number().min(0), threshold: z.coerce.number().min(0) });
const renewalPlaybookSchema = z.object({
  renewalDate: dateOnlySchema,
  forecastValue: z.coerce.number().min(0).nullable().optional(),
  salesOwnerId: uuidSchema.nullable().optional(),
  financeOwnerId: uuidSchema.nullable().optional(),
  customerContact: csNullableText(200)
});
const expansionSignalsSchema = z.object({
  usageRatio: z.coerce.number().min(0).nullable().optional(),
  additionalDepartments: z.coerce.number().int().min(0).nullable().optional(),
  featureRequests: z.coerce.number().int().min(0).nullable().optional(),
  userGrowthRate: z.coerce.number().nullable().optional(),
  productSupportQueries: z.coerce.number().int().min(0).nullable().optional(),
  engagementScore: score.nullable().optional()
}).partial();
const expansionAssessSchema = z.object({ signals: expansionSignalsSchema.optional() });
const expansionOpportunitySchema = z.object({
  name: z.string().min(1).max(200),
  amount: z.coerce.number().min(0).nullable().optional(),
  salesOwnerId: uuidSchema.nullable().optional(),
  signals: expansionSignalsSchema.optional()
});

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

  // ---- Persona 24 (CSM — Onboarding) routes ----------------------------------------------------
  router.post("/onboarding/provision", requirePermissions({ oneOf: createPermissions }), validateRequest({ body: provisionSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.provisionOnboarding(request.auth!, getAuditMetadata(request), request.body as ProvisionOnboardingRequestBody));
  }));
  router.get("/onboarding/:planId", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: planIdSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getOnboardingProject(request.auth!, request.params.planId));
  }));
  router.put("/onboarding/:planId/handover", requirePermissions({ oneOf: childPermissions }), validateRequest({ params: planIdSchema, body: handoverSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.recordHandover(request.auth!, getAuditMetadata(request), request.params.planId, request.body as RecordHandoverRequestBody));
  }));
  router.post("/onboarding/:planId/kickoff", requirePermissions({ oneOf: childPermissions }), validateRequest({ params: planIdSchema, body: kickoffSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.recordKickoff(request.auth!, getAuditMetadata(request), request.params.planId, request.body as RecordKickoffRequestBody));
  }));
  router.put("/onboarding/:planId/go-live-checklist", requirePermissions({ oneOf: childPermissions }), validateRequest({ params: planIdSchema, body: goLiveChecklistSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.updateGoLiveChecklist(request.auth!, getAuditMetadata(request), request.params.planId, request.body as UpdateGoLiveChecklistRequestBody));
  }));
  router.post("/onboarding/:planId/go-live", requirePermissions({ oneOf: childPermissions }), validateRequest({ params: planIdSchema, body: completeGoLiveSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.completeGoLive(request.auth!, getAuditMetadata(request), request.params.planId, request.body as CompleteGoLiveRequestBody));
  }));
  router.post("/onboarding/:planId/complete", requirePermissions({ oneOf: childPermissions }), validateRequest({ params: planIdSchema, body: completeOnboardingSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.completeOnboarding(request.auth!, getAuditMetadata(request), request.params.planId, request.body as CompleteOnboardingRequestBody));
  }));

  // ---- Persona 25 (CSM — Scaled) routes --------------------------------------------------------
  router.post("/accounts/:csAccountId/health-score/compute", requirePermissions({ oneOf: childPermissions }), validateRequest({ params: csAccountIdSchema, body: computeHealthSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.computeAccountHealthScore(request.auth!, getAuditMetadata(request), request.params.csAccountId, request.body as ComputeHealthScoreRequestBody));
  }));
  router.get("/adoption-campaigns", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listAdoptionCampaigns(request.auth!));
  }));
  router.post("/adoption-campaigns", requirePermissions({ oneOf: createPermissions }), validateRequest({ body: createCampaignSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createAdoptionCampaign(request.auth!, getAuditMetadata(request), request.body as CreateAdoptionCampaignRequestBody));
  }));
  router.post("/accounts/:csAccountId/low-usage-check", requirePermissions({ oneOf: childPermissions }), validateRequest({ params: csAccountIdSchema, body: lowUsageSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.checkLowUsage(request.auth!, getAuditMetadata(request), request.params.csAccountId, request.body as LowUsageCheckRequestBody));
  }));
  router.post("/accounts/:csAccountId/renewal-playbook", requirePermissions({ oneOf: childPermissions }), validateRequest({ params: csAccountIdSchema, body: renewalPlaybookSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.startRenewalPlaybook(request.auth!, getAuditMetadata(request), request.params.csAccountId, request.body as RenewalPlaybookRequestBody));
  }));
  router.post("/accounts/:csAccountId/expansion/assess", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: csAccountIdSchema, body: expansionAssessSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.assessExpansion(request.auth!, request.params.csAccountId, (request.body as { signals?: CreateExpansionOpportunityRequestBody["signals"] }).signals));
  }));
  router.post("/accounts/:csAccountId/expansion/opportunity", requirePermissions({ oneOf: childPermissions }), validateRequest({ params: csAccountIdSchema, body: expansionOpportunitySchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createExpansionOpportunity(request.auth!, getAuditMetadata(request), request.params.csAccountId, request.body as CreateExpansionOpportunityRequestBody));
  }));

  return router;
}
