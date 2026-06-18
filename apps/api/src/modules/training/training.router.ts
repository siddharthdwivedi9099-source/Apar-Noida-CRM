import { Router, type Request } from "express";
import { z } from "zod";
import {
  trainingAssetTypes,
  trainingAssigneeTypes,
  trainingAssignmentStatuses,
  trainingLearnerTypes,
  trainingLessonTypes,
  trainingProgramSortFields,
  trainingProgramStatuses,
  trainingProgressStatuses,
  type CreateCustomerLearnerRequestBody,
  type CreateTrainingAssetRequestBody,
  type CreateTrainingAssignmentRequestBody,
  type CreateTrainingFeedbackRequestBody,
  type CreateTrainingLessonRequestBody,
  type CreateTrainingModuleRequestBody,
  type CreateTrainingProgramRequestBody,
  type TrainingAssignmentListQuery,
  type TrainingProgramListQuery,
  type UpdateTrainingAssignmentRequestBody,
  type UpdateTrainingLessonRequestBody,
  type UpdateTrainingModuleRequestBody,
  type UpdateTrainingProgramRequestBody,
  type UpdateTrainingProgressRequestBody
} from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { TrainingService } from "./training.service.js";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
const recordSchema = z.record(z.unknown());
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const percent = z.coerce.number().int().min(0).max(100);

const programListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  search: z.string().max(200).optional(),
  status: z.string().max(60).optional(),
  category: z.string().max(160).optional(),
  ownerId: uuidSchema.optional(),
  sortBy: z.enum(trainingProgramSortFields).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional()
});

const programCreateSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(8000).nullable().optional(),
  status: z.enum(trainingProgramStatuses).optional(),
  categoryKey: z.string().min(2).max(160).optional(),
  levelKey: z.string().min(2).max(160).optional(),
  ownerId: uuidSchema.nullable().optional(),
  estimatedMinutes: z.coerce.number().int().min(0).nullable().optional(),
  isRoleBased: z.boolean().optional(),
  targetRole: z.string().max(160).nullable().optional(),
  metadata: recordSchema.optional()
});

const programUpdateSchema = programCreateSchema.partial();

const moduleCreateSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(4000).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  metadata: recordSchema.optional()
});

const moduleUpdateSchema = moduleCreateSchema.partial();

const lessonCreateSchema = z.object({
  title: z.string().min(2).max(200),
  content: z.string().max(20000).nullable().optional(),
  lessonType: z.enum(trainingLessonTypes).optional(),
  durationMinutes: z.coerce.number().int().min(0).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  metadata: recordSchema.optional()
});

const lessonUpdateSchema = lessonCreateSchema.partial();

const assetCreateSchema = z.object({
  name: z.string().min(1).max(200),
  assetType: z.enum(trainingAssetTypes).optional(),
  url: z.string().max(2000).nullable().optional(),
  externalReference: z.string().max(400).nullable().optional(),
  metadata: recordSchema.optional()
});

const learnerCreateSchema = z.object({
  learnerType: z.enum(trainingLearnerTypes).optional(),
  userId: uuidSchema.nullable().optional(),
  contactId: uuidSchema.nullable().optional(),
  accountId: uuidSchema.nullable().optional(),
  displayName: z.string().min(1).max(200),
  email: z.string().max(320).nullable().optional(),
  metadata: recordSchema.optional()
});

const assignmentListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  status: z.string().max(60).optional(),
  programId: uuidSchema.optional(),
  userId: uuidSchema.optional(),
  accountId: uuidSchema.optional(),
  csAccountId: uuidSchema.optional(),
  sortBy: z.enum(["status", "dueDate", "updatedAt", "createdAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional()
});

const assignmentCreateSchema = z.object({
  programId: uuidSchema,
  assigneeType: z.enum(trainingAssigneeTypes).optional(),
  userId: uuidSchema.nullable().optional(),
  contactId: uuidSchema.nullable().optional(),
  accountId: uuidSchema.nullable().optional(),
  csAccountId: uuidSchema.nullable().optional(),
  onboardingPlanId: uuidSchema.nullable().optional(),
  learnerId: uuidSchema.nullable().optional(),
  dueDate: dateOnlySchema.nullable().optional(),
  metadata: recordSchema.optional()
});

const assignmentUpdateSchema = z.object({
  status: z.enum(trainingAssignmentStatuses).optional(),
  dueDate: dateOnlySchema.nullable().optional(),
  csAccountId: uuidSchema.nullable().optional(),
  onboardingPlanId: uuidSchema.nullable().optional(),
  learnerId: uuidSchema.nullable().optional(),
  metadata: recordSchema.optional()
});

const progressUpdateSchema = z.object({
  lessonId: uuidSchema,
  status: z.enum(trainingProgressStatuses).optional(),
  progressPercent: percent.optional(),
  metadata: recordSchema.optional()
});

const feedbackCreateSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comments: z.string().max(4000).nullable().optional(),
  lessonId: uuidSchema.nullable().optional(),
  learnerId: uuidSchema.nullable().optional(),
  metadata: recordSchema.optional()
});

const programIdSchema = z.object({ programId: uuidSchema });
const moduleIdSchema = z.object({ programId: uuidSchema, moduleId: uuidSchema });
const lessonIdSchema = z.object({ programId: uuidSchema, lessonId: uuidSchema });
const assignmentIdSchema = z.object({ assignmentId: uuidSchema });

const readPermissions: string[] = [
  "training.view",
  "training.create",
  "training.edit",
  "training.delete",
  "training.assign",
  "training.approve",
  "training.export",
  "training.configure",
  "training.use_ai",
  "training.manage_ai",
  "training.view_dashboard",
  "training.manage_workflow"
];
const createPermissions: string[] = ["training.create", "training.configure"];
const updatePermissions: string[] = ["training.edit", "training.configure", "training.manage_workflow"];
const deletePermissions: string[] = ["training.delete", "training.configure"];
const manageContentPermissions: string[] = ["training.create", "training.edit", "training.configure", "training.manage_workflow"];
const assignPermissions: string[] = ["training.assign", "training.create", "training.edit", "training.configure"];

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

export function createTrainingRouter({ databaseService }: RouterDependencies) {
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
  const service = new TrainingService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS });

  router.use(authMiddleware);

  router.get("/options", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getOptions(request.auth!));
  }));

  router.get("/dashboard", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getDashboard(request.auth!));
  }));

  router.get("/portal/my-training", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getMyTraining(request.auth!));
  }));

  router.get("/learners", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listLearners(request.auth!));
  }));

  router.post("/learners", requirePermissions({ oneOf: manageContentPermissions }), validateRequest({ body: learnerCreateSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createLearner(request.auth!, getAuditMetadata(request), request.body as CreateCustomerLearnerRequestBody));
  }));

  router.get("/programs", requirePermissions({ oneOf: readPermissions }), validateRequest({ query: programListQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listPrograms(request.auth!, request.query as TrainingProgramListQuery));
  }));

  router.post("/programs", requirePermissions({ oneOf: createPermissions }), validateRequest({ body: programCreateSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createProgram(request.auth!, getAuditMetadata(request), request.body as CreateTrainingProgramRequestBody));
  }));

  router.get("/programs/:programId", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: programIdSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getProgram(request.auth!, request.params.programId));
  }));

  router.patch("/programs/:programId", requirePermissions({ oneOf: updatePermissions }), validateRequest({ params: programIdSchema, body: programUpdateSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.updateProgram(request.auth!, getAuditMetadata(request), request.params.programId, request.body as UpdateTrainingProgramRequestBody));
  }));

  router.delete("/programs/:programId", requirePermissions({ oneOf: deletePermissions }), validateRequest({ params: programIdSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.deleteProgram(request.auth!, getAuditMetadata(request), request.params.programId));
  }));

  router.post("/programs/:programId/modules", requirePermissions({ oneOf: manageContentPermissions }), validateRequest({ params: programIdSchema, body: moduleCreateSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createModule(request.auth!, getAuditMetadata(request), request.params.programId, request.body as CreateTrainingModuleRequestBody));
  }));

  router.patch("/programs/:programId/modules/:moduleId", requirePermissions({ oneOf: manageContentPermissions }), validateRequest({ params: moduleIdSchema, body: moduleUpdateSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.updateModule(request.auth!, getAuditMetadata(request), request.params.programId, request.params.moduleId, request.body as UpdateTrainingModuleRequestBody));
  }));

  router.post("/programs/:programId/modules/:moduleId/lessons", requirePermissions({ oneOf: manageContentPermissions }), validateRequest({ params: moduleIdSchema, body: lessonCreateSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createLesson(request.auth!, getAuditMetadata(request), request.params.programId, request.params.moduleId, request.body as CreateTrainingLessonRequestBody));
  }));

  router.patch("/programs/:programId/lessons/:lessonId", requirePermissions({ oneOf: manageContentPermissions }), validateRequest({ params: lessonIdSchema, body: lessonUpdateSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.updateLesson(request.auth!, getAuditMetadata(request), request.params.programId, request.params.lessonId, request.body as UpdateTrainingLessonRequestBody));
  }));

  router.post("/programs/:programId/lessons/:lessonId/assets", requirePermissions({ oneOf: manageContentPermissions }), validateRequest({ params: lessonIdSchema, body: assetCreateSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createAsset(request.auth!, getAuditMetadata(request), request.params.programId, request.params.lessonId, request.body as CreateTrainingAssetRequestBody));
  }));

  router.get("/assignments", requirePermissions({ oneOf: readPermissions }), validateRequest({ query: assignmentListQuerySchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listAssignments(request.auth!, request.query as TrainingAssignmentListQuery));
  }));

  router.post("/assignments", requirePermissions({ oneOf: assignPermissions }), validateRequest({ body: assignmentCreateSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createAssignment(request.auth!, getAuditMetadata(request), request.body as CreateTrainingAssignmentRequestBody));
  }));

  router.get("/assignments/:assignmentId", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: assignmentIdSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getAssignment(request.auth!, request.params.assignmentId));
  }));

  router.patch("/assignments/:assignmentId", requirePermissions({ oneOf: updatePermissions }), validateRequest({ params: assignmentIdSchema, body: assignmentUpdateSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.updateAssignment(request.auth!, getAuditMetadata(request), request.params.assignmentId, request.body as UpdateTrainingAssignmentRequestBody));
  }));

  router.post("/assignments/:assignmentId/progress", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: assignmentIdSchema, body: progressUpdateSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.updateProgress(request.auth!, getAuditMetadata(request), request.params.assignmentId, request.body as UpdateTrainingProgressRequestBody));
  }));

  router.post("/assignments/:assignmentId/feedback", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: assignmentIdSchema, body: feedbackCreateSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createFeedback(request.auth!, getAuditMetadata(request), request.params.assignmentId, request.body as CreateTrainingFeedbackRequestBody));
  }));

  return router;
}
