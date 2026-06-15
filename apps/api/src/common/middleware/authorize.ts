import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error.js";

interface PermissionRequirement {
  allOf?: string[];
  oneOf?: string[];
}

function hasAllPermissions(currentPermissions: Set<string>, requiredPermissions: string[]) {
  return requiredPermissions.every((permissionCode) => currentPermissions.has(permissionCode));
}

function hasAnyPermission(currentPermissions: Set<string>, candidatePermissions: string[]) {
  return candidatePermissions.some((permissionCode) => currentPermissions.has(permissionCode));
}

export function requirePermissions(requirement: PermissionRequirement): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth) {
      throw new AppError(401, "Authentication is required.", undefined, "AUTHENTICATION_ERROR");
    }

    const currentPermissions = new Set(request.auth.permissionCodes);

    if (requirement.allOf && !hasAllPermissions(currentPermissions, requirement.allOf)) {
      throw new AppError(403, "You do not have permission to perform this action.", undefined, "FORBIDDEN");
    }

    if (requirement.oneOf && !hasAnyPermission(currentPermissions, requirement.oneOf)) {
      throw new AppError(403, "You do not have permission to perform this action.", undefined, "FORBIDDEN");
    }

    next();
  };
}
