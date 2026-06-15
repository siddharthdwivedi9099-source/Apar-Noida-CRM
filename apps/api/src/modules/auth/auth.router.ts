import { Router, type Request } from "express";
import { z } from "zod";
import type { LoginRequestBody, RefreshRequestBody } from "@crm/types";
import { AppError } from "../../common/errors/app-error.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { asyncHandler } from "../../common/http/async-handler.js";
import { getCookieValue, clearRefreshTokenCookie, setRefreshTokenCookie } from "../../common/http/cookies.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { createLoginRateLimiter } from "../../common/middleware/login-rate-limit.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "./auth.service.js";

interface AuthRouterDependencies {
  databaseService: DatabaseService;
}

const loginSchema = z.object({
  tenantSlug: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(200)
});

const refreshSchema = z.object({
  refreshToken: z.string().optional()
});

function getClientIp(request: Request) {
  const forwardedFor = request.header("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return request.ip ?? null;
}

export function createAuthRouter({ databaseService }: AuthRouterDependencies) {
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
  const loginRateLimiter = createLoginRateLimiter({
    windowMinutes: env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MINUTES,
    maxAttempts: env.AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS
  });
  const authMiddleware = createAuthMiddleware(authService);
  const cookieOptions = {
    secure: env.AUTH_COOKIE_SECURE,
    sameSite: env.AUTH_COOKIE_SAME_SITE
  } as const;

  router.post(
    "/login",
    validateRequest({
      body: loginSchema
    }),
    asyncHandler(async (request, response) => {
      const payload = request.body as LoginRequestBody;
      const rateLimitResult = loginRateLimiter.consume(request);

      response.setHeader("retry-after", rateLimitResult.retryAfterSeconds);

      if (!rateLimitResult.allowed) {
        await authService.recordRateLimitedLoginAttempt({
          tenantSlug: payload.tenantSlug,
          email: payload.email,
          ipAddress: getClientIp(request),
          userAgent: request.header("user-agent") ?? null,
          requestId: request.requestId,
          retryAfterSeconds: rateLimitResult.retryAfterSeconds
        });

        throw new AppError(
          429,
          "Too many login attempts. Please try again later.",
          {
            retryAfterSeconds: rateLimitResult.retryAfterSeconds
          },
          "RATE_LIMIT_EXCEEDED"
        );
      }

      const authResult = await authService.login({
        ...payload,
        ipAddress: getClientIp(request),
        userAgent: request.header("user-agent") ?? null,
        requestId: request.requestId
      });

      loginRateLimiter.clear(request);
      setRefreshTokenCookie(
        response,
        env.SESSION_COOKIE_NAME,
        authResult.refreshToken,
        authResult.authResponse.tokens.refreshTokenExpiresAt,
        cookieOptions
      );

      response.status(200).json(authResult.authResponse);
    })
  );

  router.post(
    "/refresh",
    validateRequest({
      body: refreshSchema
    }),
    asyncHandler(async (request, response) => {
      const payload = request.body as RefreshRequestBody;
      const refreshToken = payload.refreshToken ?? getCookieValue(request, env.SESSION_COOKIE_NAME);

      if (!refreshToken) {
        clearRefreshTokenCookie(response, env.SESSION_COOKIE_NAME, cookieOptions);
        response.status(401).json({
          error: {
            code: "AUTHENTICATION_ERROR",
            message: "Refresh token is invalid or expired."
          }
        });
        return;
      }

      const authResult = await authService.refresh({
        refreshToken,
        ipAddress: getClientIp(request),
        userAgent: request.header("user-agent") ?? null,
        requestId: request.requestId
      });

      setRefreshTokenCookie(
        response,
        env.SESSION_COOKIE_NAME,
        authResult.refreshToken,
        authResult.authResponse.tokens.refreshTokenExpiresAt,
        cookieOptions
      );

      response.status(200).json(authResult.authResponse);
    })
  );

  router.post(
    "/logout",
    asyncHandler(async (request, response) => {
      const authorizationHeader = request.header("authorization");
      const refreshToken = getCookieValue(request, env.SESSION_COOKIE_NAME);

      await authService.logout({
        accessToken: authorizationHeader?.startsWith("Bearer ")
          ? authorizationHeader.slice("Bearer ".length).trim()
          : null,
        refreshToken,
        ipAddress: getClientIp(request),
        userAgent: request.header("user-agent") ?? null,
        requestId: request.requestId
      });

      clearRefreshTokenCookie(response, env.SESSION_COOKIE_NAME, cookieOptions);
      response.status(200).json({
        success: true
      });
    })
  );

  router.get(
    "/me",
    authMiddleware,
    asyncHandler(async (request, response) => {
      response.status(200).json(await authService.getCurrentUser(request.auth!));
    })
  );

  return router;
}
