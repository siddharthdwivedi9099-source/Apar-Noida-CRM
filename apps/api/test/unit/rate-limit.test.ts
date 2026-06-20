import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../src/common/errors/app-error";
import { createRateLimiter } from "../../src/common/middleware/rate-limit";

function fakeRequest(ip: string, auth?: Request["auth"]): Request {
  return {
    auth,
    header: () => undefined,
    ip,
    socket: { remoteAddress: ip }
  } as unknown as Request;
}

function fakeResponse(): Response {
  return { setHeader: vi.fn() } as unknown as Response;
}

function call(middleware: ReturnType<typeof createRateLimiter>, request: Request) {
  const next = vi.fn() as unknown as NextFunction;
  try {
    middleware(request, fakeResponse(), next);
    return { ok: true as const, next: next as ReturnType<typeof vi.fn> };
  } catch (error) {
    return { ok: false as const, error, next: next as ReturnType<typeof vi.fn> };
  }
}

describe("Security: in-memory rate limiter", () => {
  it("allows requests up to the configured max, then rejects with 429 RATE_LIMITED", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3, keyPrefix: "test" });
    const request = fakeRequest("10.0.0.1");

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(call(limiter, request).ok).toBe(true);
    }

    const blocked = call(limiter, request);
    expect(blocked.ok).toBe(false);
    expect((blocked.error as AppError).statusCode).toBe(429);
    expect((blocked.error as AppError).code).toBe("RATE_LIMITED");
  });

  it("tracks separate buckets per client identity", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1, keyPrefix: "test" });
    expect(call(limiter, fakeRequest("10.0.0.1")).ok).toBe(true);
    // A different client IP gets its own fresh budget.
    expect(call(limiter, fakeRequest("10.0.0.2")).ok).toBe(true);
    // The first client is now over its budget.
    expect(call(limiter, fakeRequest("10.0.0.1")).ok).toBe(false);
  });

  it("keys authenticated requests by user id", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1, keyPrefix: "test" });
    const auth = {
      userId: "user-1",
      tenantId: "tenant-1",
      sessionId: "s1",
      email: "u@example.test",
      displayName: "U",
      roles: [],
      permissionCodes: []
    };
    expect(call(limiter, fakeRequest("10.0.0.9", auth)).ok).toBe(true);
    expect(call(limiter, fakeRequest("10.0.0.9", auth)).ok).toBe(false);
  });
});
