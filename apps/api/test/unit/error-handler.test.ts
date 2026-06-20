import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError } from "../../src/common/errors/app-error";
import { createErrorHandler } from "../../src/common/middleware/error-handler";

function fakeResponse() {
  const response = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    }
  };
  return response as unknown as Response & { statusCode: number; body: any };
}

const handler = createErrorHandler();
const request = { header: () => undefined } as unknown as Request;
const next = vi.fn() as unknown as NextFunction;

describe("Error handler: structured error responses", () => {
  it("maps a ZodError to a 400 VALIDATION_ERROR with details", () => {
    const response = fakeResponse();
    const zodError = z.object({ email: z.string().email() }).safeParse({ email: "bad" });
    handler((zodError as { error: unknown }).error, request, response, next);
    expect(response.statusCode).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details).toBeTruthy();
  });

  it("maps an AppError to its status code and machine-readable code", () => {
    const response = fakeResponse();
    handler(new AppError(404, "Lead not found.", undefined, "LEAD_NOT_FOUND"), request, response, next);
    expect(response.statusCode).toBe(404);
    expect(response.body.error.code).toBe("LEAD_NOT_FOUND");
    expect(response.body.error.message).toBe("Lead not found.");
  });

  it("maps an unknown error to a 500 without leaking internals", () => {
    const response = fakeResponse();
    handler(new Error("Database password is hunter2"), request, response, next);
    expect(response.statusCode).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(JSON.stringify(response.body)).not.toContain("hunter2");
  });
});
