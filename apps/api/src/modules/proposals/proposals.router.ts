import { Router } from "express";
import { z } from "zod";
import type {
  AddProposalComplianceItemRequestBody,
  AddProposalVersionRequestBody,
  CreateProposalContentRequestBody,
  InitProposalRequestBody,
  RecordProposalSubmissionRequestBody,
  SubmitProposalForApprovalRequestBody,
  UpdateProposalComplianceItemRequestBody,
  UpdateProposalContentRequestBody
} from "@crm/types";
import { proposalComplianceStatuses, proposalResponseStatuses } from "@crm/types";
import { getAuditMetadata } from "../../common/http/request-metadata.js";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { ProposalsService } from "./proposals.service.js";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
const nullableText = (max: number) => z.string().max(max).nullable().optional();

const readPermissions = ["opportunities.view", "opportunities.view_dashboard", "opportunities.configure", "opportunities.manage_workflow", "presales.view", "presales.edit", "presales.configure"];
const managePermissions = ["opportunities.edit", "opportunities.configure", "opportunities.manage_workflow", "opportunities.approve", "presales.edit", "presales.configure"];

const opportunityParam = z.object({ opportunityId: uuidSchema });

const initSchema = z.object({
  templateKey: z.string().min(1).max(160).nullable().optional(),
  statusKey: z.string().min(1).max(160).nullable().optional(),
  scope: nullableText(8000),
  dueDate: z.string().max(40).nullable().optional(),
  contributorIds: z.array(uuidSchema).max(50).optional()
});

const complianceSchema = z.object({
  requirement: z.string().min(1).max(4000),
  owner: nullableText(300),
  responseStatus: z.enum(proposalResponseStatuses).optional(),
  complianceStatus: z.enum(proposalComplianceStatuses).optional(),
  comments: nullableText(4000),
  evidence: nullableText(4000),
  response: nullableText(8000)
});
const complianceUpdateSchema = complianceSchema.partial();

const versionSchema = z.object({ label: z.string().min(1).max(200), notes: nullableText(4000), fileRef: nullableText(2000) });
const submitSchema = z.object({ versionId: uuidSchema, approverUserId: uuidSchema, note: nullableText(2000) });
const submissionSchema = z.object({
  submittedAt: z.string().min(1).max(40),
  mode: z.string().min(1).max(200),
  recipient: nullableText(400),
  documents: nullableText(4000),
  acknowledgement: nullableText(2000),
  remarks: nullableText(4000),
  advanceStage: z.boolean().optional()
});

const contentSchema = z.object({
  categoryKey: z.string().min(1).max(160),
  title: z.string().min(1).max(300),
  body: z.string().min(1).max(20000),
  status: z.enum(["draft", "approved"]).optional(),
  tags: z.array(z.string().max(80)).max(30).optional(),
  expiresAt: z.string().max(40).nullable().optional()
});
const contentUpdateSchema = contentSchema.partial();

export function createProposalsRouter({ databaseService }: RouterDependencies) {
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
  const service = new ProposalsService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS });

  router.use(authMiddleware);

  // Static routes first (before /:opportunityId).
  router.get("/options", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getOptions(request.auth!));
  }));
  router.get("/queue", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getQueue(request.auth!));
  }));

  router.get("/content-library", requirePermissions({ oneOf: readPermissions }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listContent(request.auth!));
  }));
  router.post("/content-library", requirePermissions({ oneOf: managePermissions }), validateRequest({ body: contentSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createContent(request.auth!, getAuditMetadata(request), request.body as CreateProposalContentRequestBody));
  }));
  router.patch("/content-library/:contentId", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: z.object({ contentId: uuidSchema }), body: contentUpdateSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.updateContent(request.auth!, getAuditMetadata(request), request.params.contentId, request.body as UpdateProposalContentRequestBody));
  }));
  router.delete("/content-library/:contentId", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: z.object({ contentId: uuidSchema }) }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.deleteContent(request.auth!, getAuditMetadata(request), request.params.contentId));
  }));

  // Per-opportunity proposal workspace.
  router.get("/:opportunityId", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: opportunityParam }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getProposal(request.auth!, request.params.opportunityId));
  }));
  router.put("/:opportunityId", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: opportunityParam, body: initSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.initProposal(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.body as InitProposalRequestBody));
  }));

  router.post("/:opportunityId/compliance", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: opportunityParam, body: complianceSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.addComplianceItem(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.body as AddProposalComplianceItemRequestBody));
  }));
  router.patch("/:opportunityId/compliance/:itemId", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: opportunityParam.extend({ itemId: uuidSchema }), body: complianceUpdateSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.updateComplianceItem(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.params.itemId, request.body as UpdateProposalComplianceItemRequestBody));
  }));
  router.delete("/:opportunityId/compliance/:itemId", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: opportunityParam.extend({ itemId: uuidSchema }) }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.removeComplianceItem(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.params.itemId));
  }));

  router.post("/:opportunityId/versions", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: opportunityParam, body: versionSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.addVersion(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.body as AddProposalVersionRequestBody));
  }));
  router.post("/:opportunityId/versions/submit", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: opportunityParam, body: submitSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.submitForApproval(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.body as SubmitProposalForApprovalRequestBody));
  }));
  router.post("/:opportunityId/versions/:versionId/lock", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: opportunityParam.extend({ versionId: uuidSchema }) }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.lockFinalVersion(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.params.versionId));
  }));

  router.post("/:opportunityId/submission", requirePermissions({ oneOf: managePermissions }), validateRequest({ params: opportunityParam, body: submissionSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.recordSubmission(request.auth!, getAuditMetadata(request), request.params.opportunityId, request.body as RecordProposalSubmissionRequestBody));
  }));

  return router;
}
