import type { Request } from "express";

// Shared request-metadata helpers used by every module router for audit logging.
// Centralized in Phase 31 review to remove duplicated copies across routers.

export function getClientIp(request: Request): string | null {
  const forwardedFor = request.header("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }
  return request.ip ?? null;
}

export interface RequestAuditMetadata {
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export function getAuditMetadata(request: Request): RequestAuditMetadata {
  return {
    requestId: request.requestId,
    ipAddress: getClientIp(request),
    userAgent: request.header("user-agent") ?? null
  };
}
