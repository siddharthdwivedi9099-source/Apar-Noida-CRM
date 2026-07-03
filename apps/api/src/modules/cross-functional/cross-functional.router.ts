import { Router } from "express";
import { z } from "zod";
import { getAuditMetadata } from "../../common/http/request-metadata.js";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { CrossFunctionalService } from "./cross-functional.service.js";
import {
  cfEntityTypes,
  meetingSentiments,
  type AddDocumentVersionRequestBody,
  type CreateDocumentRequestBody,
  type CreateRecordCommentRequestBody,
  type DecideNbaRequestBody,
  type ReassignOwnerRequestBody,
  type RecordAttributionTouchRequestBody,
  type UpsertMeetingSummaryRequestBody
} from "@crm/types";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
// Cross-functional tools operate across CRM objects; any CRM user with view/edit access can use them.
const readPermissions: string[] = ["leads.view", "accounts.view", "opportunities.view", "support.view", "customer_success.view", "admin.view", "dashboards.view_dashboard"];
const writePermissions: string[] = ["leads.edit", "leads.create", "leads.assign", "accounts.edit", "opportunities.edit", "support.edit", "support.assign", "customer_success.edit", "admin.configure"];

const entityParams = z.object({ entityType: z.enum(cfEntityTypes), entityId: uuidSchema });
const leadParams = z.object({ leadId: uuidSchema });
const meetingIdParams = z.object({ meetingId: uuidSchema });
const actionIdParams = z.object({ actionId: uuidSchema });
const documentIdParams = z.object({ documentId: uuidSchema });

const touchSchema = z.object({ source: z.string().min(1).max(160), subSource: nullableText(160), campaign: nullableText(200), partner: nullableText(200), event: nullableText(200), referral: nullableText(200), utm: z.record(z.string()).optional(), occurredAt: nullableText(40) });
const meetingSchema = z.object({ title: z.string().min(1).max(300), summary: nullableText(8000), decisions: nullableText(8000), objections: nullableText(8000), nextSteps: nullableText(8000), stakeholders: nullableText(4000), sentiment: z.enum(meetingSentiments).optional(), save: z.boolean().optional() });
const nbaDecisionSchema = z.object({ decision: z.enum(["accept", "dismiss", "snooze"]), snoozeUntil: nullableText(40) });
const reassignSchema = z.object({ toOwnerId: uuidSchema, reason: z.string().min(1).max(2000) });
const documentSchema = z.object({ name: z.string().min(1).max(300), fileRef: z.string().min(1).max(1000), tags: z.array(z.string().max(60)).max(20).optional(), notes: nullableText(2000) });
const versionSchema = z.object({ fileRef: z.string().min(1).max(1000), notes: nullableText(2000) });
const commentSchema = z.object({ body: z.string().min(1).max(8000), isInternal: z.boolean().optional() });

export function createCrossFunctionalRouter({ databaseService }: RouterDependencies) {
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
  const service = new CrossFunctionalService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS });

  router.use(createAuthMiddleware(authService));

  // CF-001: lead attribution
  router.get("/leads/:leadId/attribution", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: leadParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getLeadAttribution(request.auth!, request.params.leadId));
  }));
  router.post("/leads/:leadId/attribution", requirePermissions({ oneOf: writePermissions }), validateRequest({ params: leadParams, body: touchSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.recordAttributionTouch(request.auth!, getAuditMetadata(request), request.params.leadId, request.body as RecordAttributionTouchRequestBody));
  }));

  // CF-004: meeting intelligence
  router.get("/:entityType/:entityId/meetings", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: entityParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listMeetingSummaries(request.auth!, request.params.entityType, request.params.entityId));
  }));
  router.post("/:entityType/:entityId/meetings", requirePermissions({ oneOf: writePermissions }), validateRequest({ params: entityParams, body: meetingSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createMeetingSummary(request.auth!, getAuditMetadata(request), request.params.entityType, request.params.entityId, request.body as UpsertMeetingSummaryRequestBody));
  }));
  router.put("/meetings/:meetingId", requirePermissions({ oneOf: writePermissions }), validateRequest({ params: meetingIdParams, body: meetingSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.updateMeetingSummary(request.auth!, getAuditMetadata(request), request.params.meetingId, request.body as UpsertMeetingSummaryRequestBody));
  }));

  // CF-005: next best action
  router.get("/:entityType/:entityId/next-best-action", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: entityParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getNextBestAction(request.auth!, request.params.entityType, request.params.entityId));
  }));
  router.post("/:entityType/:entityId/next-best-action", requirePermissions({ oneOf: writePermissions }), validateRequest({ params: entityParams }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.persistRecommendation(request.auth!, getAuditMetadata(request), request.params.entityType, request.params.entityId));
  }));
  router.post("/next-best-action/:actionId/decision", requirePermissions({ oneOf: writePermissions }), validateRequest({ params: actionIdParams, body: nbaDecisionSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.decideNba(request.auth!, getAuditMetadata(request), request.params.actionId, request.body as DecideNbaRequestBody));
  }));

  // CF-006: ownership
  router.get("/:entityType/:entityId/ownership", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: entityParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.getOwnershipHistory(request.auth!, request.params.entityType, request.params.entityId));
  }));
  router.post("/:entityType/:entityId/ownership/reassign", requirePermissions({ oneOf: writePermissions }), validateRequest({ params: entityParams, body: reassignSchema }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.reassignOwner(request.auth!, getAuditMetadata(request), request.params.entityType, request.params.entityId, request.body as ReassignOwnerRequestBody));
  }));

  // CF-009: documents
  router.get("/:entityType/:entityId/documents", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: entityParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listDocuments(request.auth!, request.params.entityType, request.params.entityId));
  }));
  router.post("/:entityType/:entityId/documents", requirePermissions({ oneOf: writePermissions }), validateRequest({ params: entityParams, body: documentSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createDocument(request.auth!, getAuditMetadata(request), request.params.entityType, request.params.entityId, request.body as CreateDocumentRequestBody));
  }));
  router.post("/documents/:documentId/versions", requirePermissions({ oneOf: writePermissions }), validateRequest({ params: documentIdParams, body: versionSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.addDocumentVersion(request.auth!, getAuditMetadata(request), request.params.documentId, request.body as AddDocumentVersionRequestBody));
  }));
  router.post("/documents/:documentId/lock", requirePermissions({ oneOf: writePermissions }), validateRequest({ params: documentIdParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.lockDocument(request.auth!, getAuditMetadata(request), request.params.documentId));
  }));

  // CF-010: comments + mentions
  router.get("/:entityType/:entityId/comments", requirePermissions({ oneOf: readPermissions }), validateRequest({ params: entityParams }), asyncHandler(async (request, response) => {
    response.status(200).json(await service.listComments(request.auth!, request.params.entityType, request.params.entityId, true));
  }));
  router.post("/:entityType/:entityId/comments", requirePermissions({ oneOf: writePermissions }), validateRequest({ params: entityParams, body: commentSchema }), asyncHandler(async (request, response) => {
    response.status(201).json(await service.createComment(request.auth!, getAuditMetadata(request), request.params.entityType, request.params.entityId, request.body as CreateRecordCommentRequestBody));
  }));

  return router;
}
