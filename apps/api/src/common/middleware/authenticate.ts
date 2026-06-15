import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error.js";
import { asyncHandler } from "../http/async-handler.js";
import { AuthService } from "../../modules/auth/auth.service.js";

export function createAuthMiddleware(authService: AuthService): RequestHandler {
  return asyncHandler(async (request, _response, next) => {
    const authorizationHeader = request.header("authorization");

    if (!authorizationHeader?.startsWith("Bearer ")) {
      throw new AppError(401, "Authentication is required.", undefined, "AUTHENTICATION_ERROR");
    }

    request.auth = await authService.authenticateAccessToken(
      authorizationHeader.slice("Bearer ".length).trim()
    );

    next();
  });
}
