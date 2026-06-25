import { Router } from "express";
import { z } from "zod";
import type { ImportConfigurationRequestBody, SaveConfigurationDraftRequestBody } from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { getAuditMetadata } from "../../common/http/request-metadata.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { ConfigurationService } from "./configuration.service.js";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const snapshotSchema = z.record(z.unknown());
const versionIdParams = z.object({ versionId: z.string().uuid() });
const saveDraftSchema = z.object({
  changeReason: z.string().max(500).optional(),
  snapshot: snapshotSchema.optional()
});
const importSchema = z.object({
  snapshot: snapshotSchema,
  changeReason: z.string().max(500).optional(),
  dryRun: z.boolean().optional()
});

const readPermissions = ["admin.view", "admin.configure"];
const writePermissions = ["admin.edit", "admin.configure"];
const publishPermissions = ["admin.configure", "admin.approve"];

export function createConfigurationRouter({ databaseService }: RouterDependencies) {
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
  const service = new ConfigurationService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS });

  router.use(authMiddleware);

  // Export the current configuration as a portable, validated snapshot.
  router.get(
    "/export",
    requirePermissions({ oneOf: readPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.exportConfiguration(request.auth!));
    })
  );

  // Validate the live configuration without persisting.
  router.get(
    "/validate",
    requirePermissions({ oneOf: readPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.validateCurrent(request.auth!));
    })
  );

  router.get(
    "/versions",
    requirePermissions({ oneOf: readPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json({ versions: await service.listVersions(request.auth!) });
    })
  );

  router.post(
    "/versions",
    requirePermissions({ oneOf: writePermissions }),
    validateRequest({ body: saveDraftSchema }),
    asyncHandler(async (request, response) => {
      const version = await service.createDraft(
        request.auth!,
        getAuditMetadata(request),
        request.body as unknown as SaveConfigurationDraftRequestBody
      );
      response.status(201).json({ version });
    })
  );

  router.get(
    "/versions/:versionId",
    requirePermissions({ oneOf: readPermissions }),
    validateRequest({ params: versionIdParams }),
    asyncHandler(async (request, response) => {
      response.status(200).json({ version: await service.getVersion(request.auth!, request.params.versionId) });
    })
  );

  router.post(
    "/versions/:versionId/publish",
    requirePermissions({ oneOf: publishPermissions }),
    validateRequest({ params: versionIdParams }),
    asyncHandler(async (request, response) => {
      const version = await service.publishVersion(request.auth!, getAuditMetadata(request), request.params.versionId);
      response.status(200).json({ version });
    })
  );

  router.post(
    "/versions/:versionId/rollback",
    requirePermissions({ oneOf: publishPermissions }),
    validateRequest({ params: versionIdParams }),
    asyncHandler(async (request, response) => {
      const version = await service.rollbackToVersion(request.auth!, getAuditMetadata(request), request.params.versionId);
      response.status(201).json({ version });
    })
  );

  router.post(
    "/import",
    requirePermissions({ oneOf: writePermissions }),
    validateRequest({ body: importSchema }),
    asyncHandler(async (request, response) => {
      const result = await service.importConfiguration(
        request.auth!,
        getAuditMetadata(request),
        request.body as unknown as ImportConfigurationRequestBody
      );
      response.status(result.version ? 201 : 200).json(result);
    })
  );

  return router;
}
