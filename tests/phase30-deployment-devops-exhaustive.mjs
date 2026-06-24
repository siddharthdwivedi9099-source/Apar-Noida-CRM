import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { stat, readFile } from "node:fs/promises";

function log(message) {
  console.log(`[phase30-exhaustive] ${message}`);
}

async function file(path) {
  return readFile(path, "utf8");
}

function assertIncludes(contents, expected, label) {
  assert.ok(contents.includes(expected), `${label} should include ${expected}.`);
}

async function assertFileExists(path) {
  const info = await stat(path);
  assert.ok(info.isFile(), `${path} should exist as a file.`);
  return info;
}

async function main() {
  log("Checking Phase 30 phase markers and package scripts.");
  const packageJson = JSON.parse(await file("package.json"));
  for (const scriptName of [
    "docker:config",
    "docker:build",
    "docker:infra",
    "docker:up",
    "docker:down",
    "docker:logs",
    "start"
  ]) {
    assert.ok(packageJson.scripts?.[scriptName], `package.json should define ${scriptName}.`);
  }

  assertIncludes(await file("packages/config/src/index.ts"), "Phase 30: Deployment, DevOps and CI Readiness", "platform metadata");
  assertIncludes(await file("apps/api/src/routes/v1.router.ts"), "phase-30-operational", "API root status");

  log("Checking Docker ignore and API image definition.");
  const dockerignore = await file(".dockerignore");
  assertIncludes(dockerignore, "**/node_modules", ".dockerignore");
  assertIncludes(dockerignore, "**/dist", ".dockerignore");
  assertIncludes(dockerignore, ".env", ".dockerignore");
  assertIncludes(dockerignore, "!.env.example", ".dockerignore");

  const apiDockerfile = await file("apps/api/Dockerfile");
  assertIncludes(apiDockerfile, "FROM node:20-alpine AS deps", "API Dockerfile");
  assertIncludes(apiDockerfile, "npm ci", "API Dockerfile");
  assertIncludes(apiDockerfile, "npm run build:api-deps", "API Dockerfile");
  assertIncludes(apiDockerfile, "npm run build --workspace @crm/api", "API Dockerfile");
  assertIncludes(apiDockerfile, "npm prune --omit=dev", "API Dockerfile");
  assertIncludes(apiDockerfile, "addgroup -S crm", "API Dockerfile");
  assertIncludes(apiDockerfile, "USER crm", "API Dockerfile");
  assertIncludes(apiDockerfile, "HEALTHCHECK", "API Dockerfile");
  assertIncludes(apiDockerfile, "ENTRYPOINT", "API Dockerfile");

  const entrypointInfo = await assertFileExists("apps/api/docker-entrypoint.sh");
  assert.ok((entrypointInfo.mode & 0o111) !== 0, "API docker entrypoint should be executable.");
  const entrypoint = await file("apps/api/docker-entrypoint.sh");
  assertIncludes(entrypoint, "RUN_MIGRATIONS", "API entrypoint");
  assertIncludes(entrypoint, "RUN_SEED", "API entrypoint");
  assertIncludes(entrypoint, "RUN_DEMO_SEED", "API entrypoint");
  assertIncludes(entrypoint, "node scripts/database.mjs migrate", "API entrypoint");
  assertIncludes(entrypoint, "node scripts/seed-demo-users.mjs", "API entrypoint");
  assertIncludes(entrypoint, "exec node apps/api/dist/server.js", "API entrypoint");

  log("Checking web image and nginx SPA serving.");
  const webDockerfile = await file("apps/web/Dockerfile");
  assertIncludes(webDockerfile, "ARG VITE_API_BASE_URL", "web Dockerfile");
  assertIncludes(webDockerfile, "npm run build:web-deps", "web Dockerfile");
  assertIncludes(webDockerfile, "npm run build --workspace @crm/web", "web Dockerfile");
  assertIncludes(webDockerfile, "FROM nginx:alpine AS runtime", "web Dockerfile");
  assertIncludes(webDockerfile, "HEALTHCHECK", "web Dockerfile");

  const nginxConfig = await file("apps/web/nginx.conf");
  assertIncludes(nginxConfig, "try_files $uri $uri/ /index.html", "nginx SPA fallback");
  assertIncludes(nginxConfig, "Cache-Control", "nginx asset caching");

  log("Checking Docker Compose graph.");
  const compose = await file("docker-compose.yml");
  for (const serviceName of ["postgres:", "redis:", "minio:", "api:", "web:"]) {
    assertIncludes(compose, serviceName, "docker-compose.yml");
  }
  assertIncludes(compose, "dockerfile: apps/api/Dockerfile", "docker-compose.yml");
  assertIncludes(compose, "dockerfile: apps/web/Dockerfile", "docker-compose.yml");
  assertIncludes(compose, "condition: service_healthy", "docker-compose.yml");
  assertIncludes(compose, "RUN_MIGRATIONS", "docker-compose.yml");
  assertIncludes(compose, "RUN_SEED", "docker-compose.yml");
  assertIncludes(compose, "VITE_API_BASE_URL", "docker-compose.yml");

  const composeConfig = execFileSync("docker", ["compose", "config"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  for (const serviceName of ["api:", "web:", "postgres:", "redis:", "minio:"]) {
    assertIncludes(composeConfig, serviceName, "docker compose config output");
  }
  assertIncludes(composeConfig, "service_healthy", "docker compose config output");

  log("Checking CI workflow and environment template.");
  const ci = await file(".github/workflows/ci.yml");
  assertIncludes(ci, "npm ci", "CI workflow");
  assertIncludes(ci, "npm run typecheck", "CI workflow");
  assertIncludes(ci, "npm run build", "CI workflow");
  assertIncludes(ci, "npm test", "CI workflow");
  assertIncludes(ci, "docker compose build api web", "CI workflow");

  const envExample = await file(".env.example");
  for (const variableName of [
    "DATABASE_URL",
    "JWT_ACCESS_TOKEN_SECRET",
    "JWT_REFRESH_TOKEN_SECRET",
    "API_RATE_LIMIT_ENABLED",
    "SLOW_QUERY_THRESHOLD_MS",
    "METRICS_ENABLED",
    "DASHBOARD_CACHE_ENABLED",
    "BACKGROUND_WORKERS_ENABLED",
    "AI_OPENAI_API_KEY"
  ]) {
    assertIncludes(envExample, variableName, ".env.example");
  }
  assertIncludes(envExample, "[SECRET]", ".env.example");

  log("Checking deployment documentation updates.");
  const docsToCheck = [
    ["README.md", "Phase 30: deployment, DevOps, Docker, and CI readiness"],
    ["docs/deployment/DEPLOYMENT_GUIDE.md", "Phase 30 Deployment Artifacts"],
    ["docs/deployment/DEVOPS_GUIDE.md", "Phase 30 DevOps Baseline"],
    ["docs/deployment/PRODUCTION_READINESS_CHECKLIST.md", "Deployment and CI Readiness (Phase 30)"],
    ["VERSION.md", "Phase 30: deployment, DevOps, Docker, and CI readiness"],
    ["CHANGELOG.md", "Phase 30 deployment"]
  ];
  for (const [path, expected] of docsToCheck) {
    assertIncludes(await file(path), expected, path);
  }

  log("Phase 30 exhaustive checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
