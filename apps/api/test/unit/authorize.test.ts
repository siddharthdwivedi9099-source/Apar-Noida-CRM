import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../src/common/errors/app-error";
import { requirePermissions } from "../../src/common/middleware/authorize";

function runMiddleware(
  middleware: ReturnType<typeof requirePermissions>,
  auth: Request["auth"] | undefined
) {
  const request = { auth } as Request;
  const response = {} as Response;
  const next = vi.fn() as unknown as NextFunction;
  let thrown: unknown;
  try {
    middleware(request, response, next);
  } catch (error) {
    thrown = error;
  }
  return { next: next as ReturnType<typeof vi.fn>, thrown };
}

function authWith(permissionCodes: string[]): Request["auth"] {
  return {
    userId: "user-1",
    tenantId: "tenant-1",
    sessionId: "session-1",
    email: "user@example.test",
    displayName: "Test User",
    roles: [],
    permissionCodes
  };
}

describe("RBAC: requirePermissions middleware", () => {
  it("throws 401 when the request is unauthenticated", () => {
    const { thrown, next } = runMiddleware(requirePermissions({ oneOf: ["leads.view"] }), undefined);
    expect(thrown).toBeInstanceOf(AppError);
    expect((thrown as AppError).statusCode).toBe(401);
    expect((thrown as AppError).code).toBe("AUTHENTICATION_ERROR");
    expect(next).not.toHaveBeenCalled();
  });

  it("allows access when the user holds one of the required permissions (oneOf)", () => {
    const { thrown, next } = runMiddleware(
      requirePermissions({ oneOf: ["leads.view", "leads.edit"] }),
      authWith(["leads.edit"])
    );
    expect(thrown).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it("denies with 403 when the user holds none of the required permissions (oneOf)", () => {
    const { thrown, next } = runMiddleware(
      requirePermissions({ oneOf: ["leads.view"] }),
      authWith(["accounts.view"])
    );
    expect((thrown as AppError).statusCode).toBe(403);
    expect((thrown as AppError).code).toBe("FORBIDDEN");
    expect(next).not.toHaveBeenCalled();
  });

  it("requires every permission for allOf and denies a partial match", () => {
    const allowed = runMiddleware(
      requirePermissions({ allOf: ["admin.view", "admin.configure"] }),
      authWith(["admin.view", "admin.configure"])
    );
    expect(allowed.thrown).toBeUndefined();
    expect(allowed.next).toHaveBeenCalledOnce();

    const denied = runMiddleware(
      requirePermissions({ allOf: ["admin.view", "admin.configure"] }),
      authWith(["admin.view"])
    );
    expect((denied.thrown as AppError).statusCode).toBe(403);
    expect(denied.next).not.toHaveBeenCalled();
  });
});
