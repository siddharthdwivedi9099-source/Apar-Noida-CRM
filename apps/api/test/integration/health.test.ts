import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";

const app = createApp() as express.Express;
const prefix = "/api/v1";

describe("Observability: liveness, readiness, and metrics endpoints", () => {
  it("serves liveness on /health and /live", async () => {
    for (const path of ["/health", "/live"]) {
      const response = await request(app).get(`${prefix}${path}`);
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("ok");
      expect(response.body.dependencies.database).toBeTruthy();
      expect(response.body.dependencies.redis).toBeTruthy();
      expect(response.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    }
  });

  it("reports readiness with per-dependency checks", async () => {
    const response = await request(app).get(`${prefix}/ready`);
    // With the database disabled in tests, readiness still passes (disabled is an
    // intentional configuration, not an outage) and returns 200.
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ready");
    expect(response.body.checks.map((check: { name: string }) => check.name)).toEqual(
      expect.arrayContaining(["database", "redis"])
    );
  });

  it("exposes placeholder runtime metrics", async () => {
    const response = await request(app).get(`${prefix}/metrics`);
    expect(response.status).toBe(200);
    expect(response.body.process.pid).toBeGreaterThan(0);
    expect(response.body.process.nodeVersion).toContain("v");
    expect(response.body.cache).toBeTruthy();
    expect(typeof response.body.cache.hits).toBe("number");
    expect(response.body.note).toMatch(/placeholder/i);
  });
});

describe("Observability: admin-gated job + cache monitoring", () => {
  it("requires authentication for the background job monitor", async () => {
    const response = await request(app).get(`${prefix}/observability/jobs`);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_ERROR");
  });

  it("requires authentication for the cache status endpoint", async () => {
    const response = await request(app).get(`${prefix}/observability/cache`);
    expect(response.status).toBe(401);
  });
});
