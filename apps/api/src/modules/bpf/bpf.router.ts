import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../common/http/async-handler.js";
import { getAuditMetadata } from "../../common/http/request-metadata.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { BpfService } from "./bpf.service.js";

interface RouterDependencies {
  databaseService: DatabaseService;
}

const recordParams = z.object({
  object: z.string().min(1).max(60),
  recordId: z.string().min(1).max(120)
});

const transitionSchema = z.object({
  toStage: z.string().min(1).max(120),
  reason: z.string().max(2000).optional(),
  overrideReason: z.string().max(2000).optional(),
  isManagerOverride: z.boolean().optional(),
  record: z.record(z.unknown()).optional()
});

export function createBpfRouter({ databaseService }: RouterDependencies) {
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
  const service = new BpfService(databaseService, { enableAuditLogs: env.ENABLE_AUDIT_LOGS });

  router.use(authMiddleware);

  router.get(
    "/:object/:recordId/state",
    validateRequest({ params: recordParams }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.getStateView(request.auth!, request.params.object, request.params.recordId));
    })
  );

  router.get(
    "/:object/:recordId/history",
    validateRequest({ params: recordParams }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await service.getHistory(request.auth!, request.params.object, request.params.recordId));
    })
  );

  router.post(
    "/:object/:recordId/transition",
    validateRequest({ params: recordParams, body: transitionSchema }),
    asyncHandler(async (request, response) => {
      const view = await service.transition(
        request.auth!,
        getAuditMetadata(request),
        request.params.object,
        request.params.recordId,
        request.body as z.infer<typeof transitionSchema>
      );
      response.status(200).json(view);
    })
  );

  return router;
}
