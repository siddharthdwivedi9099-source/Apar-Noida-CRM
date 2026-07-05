import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { bulkImportEntities, type BulkImportEntity, type BulkImportRequestBody } from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { getClientIp } from "../../common/http/request-metadata.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { ImportsService } from "./imports.service.js";

interface ImportsRouterDependencies {
  databaseService: DatabaseService;
}

const entityParamsSchema = z.object({
  entity: z.enum(bulkImportEntities)
});

const bulkImportBodySchema = z.object({
  csv: z.string().min(1).max(900_000),
  dryRun: z.boolean().optional(),
  allowDuplicates: z.boolean().optional()
});

/** Each entity's import is gated by that module's own import permission. */
const importPermissionsByEntity: Record<BulkImportEntity, string[]> = {
  lead: ["leads.import", "leads.configure"],
  account: ["accounts.import", "accounts.configure"],
  contact: ["contacts.import", "contacts.configure"],
  opportunity: ["opportunities.import", "opportunities.configure"]
};

export function createImportsRouter({ databaseService }: ImportsRouterDependencies) {
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
  const importsService = new ImportsService(databaseService, {
    enableAuditLogs: env.ENABLE_AUDIT_LOGS
  });

  router.use(authMiddleware);

  // The required permission depends on the :entity param, so the gate resolves per request.
  const requireImportPermission: RequestHandler = (request, response, next) =>
    requirePermissions({ oneOf: importPermissionsByEntity[request.params.entity as BulkImportEntity] })(request, response, next);

  router.get(
    "/templates/:entity",
    validateRequest({ params: entityParamsSchema }),
    requireImportPermission,
    asyncHandler(async (request, response) => {
      response.status(200).json(importsService.getTemplate(request.params.entity as BulkImportEntity));
    })
  );

  router.post(
    "/:entity",
    validateRequest({ params: entityParamsSchema, body: bulkImportBodySchema }),
    requireImportPermission,
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await importsService.importRecords(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.entity as BulkImportEntity,
          request.body as BulkImportRequestBody
        )
      );
    })
  );

  return router;
}
