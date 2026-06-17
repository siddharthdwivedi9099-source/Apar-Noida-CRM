import { Router, type Request } from "express";
import { z } from "zod";
import type { UpdateLeadWorkspaceRequestBody } from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { SalesWorkspacesService } from "./sales-workspaces.service.js";

interface SalesWorkspacesRouterDependencies {
  databaseService: DatabaseService;
}

const uuidSchema = z.string().uuid();
const recordSchema = z.record(z.unknown());

const updateLeadWorkspaceSchema = z.object({
  statusKey: z.string().min(2).max(160).optional(),
  ownerId: uuidSchema.nullable().optional(),
  outreachStatusKey: z.string().min(2).max(160).nullable().optional(),
  handoffStatusKey: z.string().min(2).max(160).nullable().optional(),
  callDispositionKey: z.string().min(2).max(160).nullable().optional(),
  qualificationFramework: z.enum(["bant", "meddic", "custom"]).optional(),
  qualificationChecklist: z
    .object({
      budget: z.boolean().optional(),
      authority: z.boolean().optional(),
      need: z.boolean().optional(),
      timeline: z.boolean().optional()
    })
    .optional(),
  customQualificationFields: z
    .array(
      z.object({
        id: z.string().max(200).optional(),
        label: z.string().max(160),
        value: z.string().max(1000)
      })
    )
    .max(30)
    .optional(),
  qualificationNotes: z.string().max(4000).nullable().optional(),
  metadata: recordSchema.optional()
});

const leadIdSchema = z.object({
  leadId: uuidSchema
});

const salesWorkspaceReadPermissions: string[] = [
  "leads.view",
  "leads.edit",
  "leads.assign",
  "leads.configure",
  "sales.view",
  "sales.edit",
  "sales.assign",
  "sales.configure",
  "dashboards.view_dashboard"
];

const salesWorkspaceUpdatePermissions: string[] = [
  "leads.edit",
  "leads.assign",
  "leads.configure",
  "sales.edit",
  "sales.assign",
  "sales.configure"
];

function getClientIp(request: Request) {
  const forwardedFor = request.header("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return request.ip ?? null;
}

export function createSalesWorkspacesRouter({ databaseService }: SalesWorkspacesRouterDependencies) {
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
  const salesWorkspacesService = new SalesWorkspacesService(databaseService, {
    enableAuditLogs: env.ENABLE_AUDIT_LOGS
  });

  router.use(authMiddleware);

  router.get(
    "/options",
    requirePermissions({ oneOf: salesWorkspaceReadPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await salesWorkspacesService.getWorkspaceOptions(request.auth!));
    })
  );

  router.get(
    "/sdr",
    requirePermissions({ oneOf: salesWorkspaceReadPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await salesWorkspacesService.getSdrWorkspace(request.auth!));
    })
  );

  router.get(
    "/inside-sales",
    requirePermissions({ oneOf: salesWorkspaceReadPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await salesWorkspacesService.getInsideSalesWorkspace(request.auth!));
    })
  );

  router.patch(
    "/leads/:leadId/workflow",
    requirePermissions({ oneOf: salesWorkspaceUpdatePermissions }),
    validateRequest({
      params: leadIdSchema,
      body: updateLeadWorkspaceSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await salesWorkspacesService.updateLeadWorkflow(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.leadId,
          request.body as UpdateLeadWorkspaceRequestBody
        )
      );
    })
  );

  return router;
}
