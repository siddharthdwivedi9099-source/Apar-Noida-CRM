import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";

const app = createApp() as express.Express;
const prefix = "/api/v1";

// Every protected module mounts the authentication middleware at the router level,
// so an unauthenticated request to its base path must be rejected before any
// database access. This is the contract that guarantees route mounting + the auth
// gate for each API surface (and, by extension, tenant isolation: no token => no data).
const protectedModuleBases: Array<{ area: string; path: string }> = [
  { area: "Lead API", path: "/leads" },
  { area: "Account API", path: "/accounts" },
  { area: "Contact API", path: "/contacts" },
  { area: "Opportunity API", path: "/opportunities" },
  { area: "Campaign API", path: "/campaigns" },
  { area: "Ticket / Support API", path: "/support" },
  { area: "Customer Success API", path: "/customer-success" },
  { area: "Training API", path: "/training" },
  { area: "AI Gateway / Registry API", path: "/ai" },
  { area: "Customer Query API", path: "/customer-query" },
  { area: "Dashboards API", path: "/dashboards" },
  { area: "Workflows API", path: "/workflows" },
  { area: "Audit API", path: "/audit" },
  { area: "RBAC API", path: "/rbac" },
  { area: "Tenant Config API", path: "/tenant-config" },
  { area: "Notifications API", path: "/notifications" },
  { area: "Approvals API", path: "/approvals" },
  { area: "Customer Portal API", path: "/customer-portal" }
];

describe("API contract: service metadata and routing", () => {
  it("serves the versioned API root with an operational phase status", async () => {
    const response = await request(app).get(`${prefix}/`);
    expect(response.status).toBe(200);
    expect(response.body.name).toContain("CRM");
    expect(response.body.status).toMatch(/^phase-\d+-operational$/);
  });

  it("returns a structured 404 for unknown top-level routes", async () => {
    const response = await request(app).get("/no-such-top-level-route");
    expect(response.status).toBe(404);
    expect(response.body.error).toBeTruthy();
  });

  it("disables the x-powered-by header and sets Helmet security headers", async () => {
    const response = await request(app).get(`${prefix}/`);
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });
});

describe("API contract: every protected module enforces authentication", () => {
  it.each(protectedModuleBases)("rejects unauthenticated access to $area ($path)", async ({ path }) => {
    const response = await request(app).get(`${prefix}${path}`);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_ERROR");
  });

  // Note: bearer-token verification (signature/expiry/tenant) is exercised directly
  // against AuthService in auth-identity.test.ts, where the database layer is faked
  // as enabled. With the database disabled here, a present token short-circuits to a
  // 503 before token validation, so that path is intentionally covered in the unit test.
});

describe("Auth API: login input validation", () => {
  it("rejects a login with a missing/invalid body", async () => {
    const response = await request(app).post(`${prefix}/auth/login`).send({ email: "not-an-email" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
