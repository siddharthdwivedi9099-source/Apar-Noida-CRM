import express from "express";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { serveProductionWebApp } from "../../src/app";

describe("Production web serving", () => {
  let webPath: string;
  let app: express.Express;

  beforeAll(() => {
    webPath = mkdtempSync(path.join(tmpdir(), "crm-production-web-"));
    mkdirSync(path.join(webPath, "assets"));
    writeFileSync(path.join(webPath, "index.html"), "<!doctype html><title>CRM login</title>");
    writeFileSync(path.join(webPath, "assets", "app.js"), "console.log('crm');");

    app = express();
    app.get("/api/v1/health", (_request, response) => response.json({ status: "ok" }));
    serveProductionWebApp(app, webPath);
    app.use("/api/v1", (_request, response) => response.status(404).json({ error: "not found" }));
  });

  afterAll(() => {
    rmSync(webPath, { recursive: true, force: true });
  });

  it.each(["/", "/login", "/dashboard"])("serves the SPA shell for %s", async (route) => {
    const response = await request(app).get(route);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.text).toContain("CRM login");
  });

  it("serves fingerprinted assets with immutable caching", async () => {
    const response = await request(app).get("/assets/app.js");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toContain("immutable");
  });

  it("keeps API routes out of the SPA fallback", async () => {
    const healthResponse = await request(app).get("/api/v1/health");
    const missingResponse = await request(app).get("/api/v1/missing");

    expect(healthResponse.body).toEqual({ status: "ok" });
    expect(missingResponse.status).toBe(404);
    expect(missingResponse.headers["content-type"]).not.toContain("text/html");
  });
});
