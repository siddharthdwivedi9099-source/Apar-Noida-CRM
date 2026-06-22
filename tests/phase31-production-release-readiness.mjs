import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

function log(message) {
  console.log(`[phase31-release] ${message}`);
}

async function file(path) {
  return readFile(path, "utf8");
}

async function assertFile(path) {
  const info = await stat(path);
  assert.ok(info.isFile(), `${path} should exist.`);
}

async function assertIncludes(path, expected) {
  const contents = await file(path);
  assert.ok(contents.includes(expected), `${path} should include ${expected}.`);
}

async function assertJsonVersion(path, expected) {
  const json = JSON.parse(await file(path));
  assert.equal(json.version, expected, `${path} should be version ${expected}.`);
}

async function main() {
  log("Checking v1.0.0 package metadata.");
  for (const path of [
    "package.json",
    "apps/api/package.json",
    "apps/web/package.json",
    "packages/ai/package.json",
    "packages/auth/package.json",
    "packages/config/package.json",
    "packages/database/package.json",
    "packages/types/package.json",
    "packages/ui/package.json"
  ]) {
    await assertJsonVersion(path, "1.0.0");
  }
  await assertIncludes("package-lock.json", '"version": "1.0.0"');
  await assertIncludes("package.json", '"test:release": "node tests/phase31-production-release-readiness.mjs"');

  log("Checking required release artifacts.");
  for (const path of [
    "FINAL_PRODUCTION_READINESS_REPORT.md",
    "KNOWN_LIMITATIONS.md",
    "POST_RELEASE_ROADMAP.md",
    "RELEASE_NOTES.md",
    "VERSION.md",
    "CHANGELOG.md"
  ]) {
    await assertFile(path);
  }
  await assertIncludes("VERSION.md", "Latest documented formal release: **v1.0.0**");
  await assertIncludes("VERSION.md", "Status: **met for controlled v1.0.0 release baseline**");
  await assertIncludes("CHANGELOG.md", "## [v1.0.0] - 2026-06-20");
  await assertIncludes("RELEASE_NOTES.md", "v1.0.0 - Production Release Baseline");
  await assertIncludes("FINAL_PRODUCTION_READINESS_REPORT.md", "Release criteria met for a controlled v1.0.0 production baseline");
  await assertIncludes("KNOWN_LIMITATIONS.md", "v1.0.0 Limitation Register");
  await assertIncludes("POST_RELEASE_ROADMAP.md", "Immediate Stabilization");

  log("Checking release criteria module implementation evidence.");
  const moduleEvidence = [
    ["apps/api/src/modules/auth/auth.router.ts", "apps/api/src/modules/auth/auth.service.ts"],
    ["apps/api/src/modules/rbac/rbac.router.ts", "apps/api/src/modules/rbac/rbac.service.ts"],
    ["apps/api/src/modules/tenant-config/tenant-config.router.ts", "apps/api/src/modules/tenant-config/tenant-config.service.ts"],
    ["apps/api/src/modules/crm/crm.router.ts", "apps/api/src/modules/crm/crm.service.ts"],
    ["apps/api/src/modules/campaigns/campaigns.router.ts", "apps/api/src/modules/campaigns/campaigns.service.ts"],
    ["apps/api/src/modules/social/social.router.ts", "apps/api/src/modules/social/social.service.ts"],
    ["apps/api/src/modules/opportunities/opportunities.router.ts", "apps/api/src/modules/opportunities/opportunities.service.ts"],
    ["apps/api/src/modules/sales-workspaces/sales-workspaces.router.ts", "apps/api/src/modules/sales-workspaces/sales-workspaces.service.ts"],
    ["apps/api/src/modules/partners/partners.router.ts", "apps/api/src/modules/partners/partners.service.ts"],
    ["apps/api/src/modules/resellers/resellers.router.ts", "apps/api/src/modules/resellers/resellers.service.ts"],
    ["apps/api/src/modules/support/support.router.ts", "apps/api/src/modules/support/support.service.ts"],
    ["apps/api/src/modules/customer-success/customer-success.router.ts", "apps/api/src/modules/customer-success/customer-success.service.ts"],
    ["apps/api/src/modules/training/training.router.ts", "apps/api/src/modules/training/training.service.ts"],
    ["apps/api/src/modules/ai/ai-gateway.router.ts", "apps/api/src/modules/ai/ai-gateway.service.ts"],
    ["apps/api/src/modules/ai/ai-registry.router.ts", "apps/api/src/modules/ai/prompt-registry.service.ts"],
    ["apps/api/src/modules/rag/rag.router.ts", "apps/api/src/modules/rag/rag.service.ts"],
    ["apps/api/src/modules/customer-query/customer-query.router.ts", "apps/api/src/modules/customer-query/customer-query.service.ts"],
    ["apps/api/src/modules/dashboards/dashboards.router.ts", "apps/api/src/modules/dashboards/dashboard.service.ts"],
    ["apps/api/src/modules/workflows/workflows.router.ts", "apps/api/src/modules/workflows/workflow.service.ts"],
    ["apps/api/src/modules/audit/audit.router.ts", "apps/api/src/modules/audit/audit.service.ts"],
    ["apps/api/src/modules/notifications/notifications.router.ts", "apps/api/src/modules/notifications/notifications.service.ts"],
    ["apps/api/src/modules/approvals/approvals.router.ts", "apps/api/src/modules/approvals/approvals.service.ts"],
    ["apps/api/src/modules/customer-portal/customer-portal.router.ts", "apps/api/src/modules/customer-portal/customer-portal.service.ts"]
  ];
  for (const [router, service] of moduleEvidence) {
    await assertFile(router);
    await assertFile(service);
  }

  log("Checking frontend release surface.");
  for (const path of [
    "apps/web/src/pages/login-page.tsx",
    "apps/web/src/pages/admin-page.tsx",
    "apps/web/src/pages/leads-page.tsx",
    "apps/web/src/pages/accounts-page.tsx",
    "apps/web/src/pages/contacts-page.tsx",
    "apps/web/src/pages/opportunities-page.tsx",
    "apps/web/src/pages/campaigns-page.tsx",
    "apps/web/src/pages/social-page.tsx",
    "apps/web/src/pages/sdr-workspace-page.tsx",
    "apps/web/src/pages/inside-sales-workspace-page.tsx",
    "apps/web/src/pages/partners-page.tsx",
    "apps/web/src/pages/resellers-page.tsx",
    "apps/web/src/pages/support-page.tsx",
    "apps/web/src/pages/customer-success-page.tsx",
    "apps/web/src/pages/training-page.tsx",
    "apps/web/src/pages/ai-assistant-page.tsx",
    "apps/web/src/pages/prompt-registry-page.tsx",
    "apps/web/src/pages/rag-console-page.tsx",
    "apps/web/src/pages/analytics-dashboards-page.tsx",
    "apps/web/src/pages/workflows-page.tsx",
    "apps/web/src/pages/notifications-page.tsx",
    "apps/web/src/pages/approvals-page.tsx",
    "apps/web/src/pages/customer-portal-dashboard-page.tsx"
  ]) {
    await assertFile(path);
  }

  log("Checking database, migration, and seed foundation.");
  for (const path of [
    "packages/database/src/migrations.ts",
    "packages/database/src/seeds.ts",
    "scripts/database.mjs",
    "packages/database/migrations/20260615143000_initial_foundation.sql",
    "packages/database/migrations/20260615160000_phase4_rbac.sql",
    "packages/database/migrations/20260626050000_phase26_customer_portal.sql",
    "packages/database/migrations/20260627050000_phase27_data_governance.sql",
    "packages/database/migrations/20260629050000_phase29_performance_indexes.sql"
  ]) {
    await assertFile(path);
  }
  await assertIncludes("scripts/database.mjs", "DEFAULT_ADMIN_PASSWORD");
  await assertIncludes("packages/database/src/seeds.ts", "Admin user seed failed");
  await assertIncludes("packages/database/src/seeds.ts", "DEFAULT_ADMIN_TEMPLATE_KEY");
  await assertIncludes("packages/database/migrations/20260615143000_initial_foundation.sql", "CREATE TABLE IF NOT EXISTS tenants");
  await assertIncludes("packages/database/migrations/20260615143000_initial_foundation.sql", "audit_logs");

  log("Checking documentation completeness.");
  const docs = [
    "docs/technical/DATA_MODEL.md",
    "docs/technical/DATABASE_MIGRATIONS.md",
    "docs/technical/API_DOCUMENTATION.md",
    "docs/technical/WORKFLOW_ENGINE.md",
    "docs/architecture/MULTI_TENANCY_DESIGN.md",
    "docs/security/SECURITY_DESIGN.md",
    "docs/security/ACCESS_CONTROL_GUIDE.md",
    "docs/security/AUDIT_LOGGING_GUIDE.md",
    "docs/security/RBAC_MATRIX.md",
    "docs/ai/AI_GOVERNANCE.md",
    "docs/ai/AI_GATEWAY_DESIGN.md",
    "docs/ai/PROMPT_REGISTRY.md",
    "docs/ai/RAG_ARCHITECTURE.md",
    "docs/ai/CUSTOMER_QUERY_AI_DESIGN.md",
    "docs/deployment/DEPLOYMENT_GUIDE.md",
    "docs/deployment/DEVOPS_GUIDE.md",
    "docs/deployment/PRODUCTION_READINESS_CHECKLIST.md",
    "docs/testing/TESTING_STRATEGY.md",
    "docs/testing/QA_CHECKLIST.md",
    "docs/user-guides/USER_GUIDE.md",
    "docs/user-guides/ADMIN_GUIDE.md",
    "docs/user-guides/CUSTOMER_SUCCESS_USER_GUIDE.md",
    "docs/user-guides/CUSTOMER_PORTAL_USER_GUIDE.md"
  ];
  for (const path of docs) {
    await assertFile(path);
  }
  await assertIncludes("docs/security/SECURITY_DESIGN.md", "JWT access tokens");
  await assertIncludes("docs/security/AUDIT_LOGGING_GUIDE.md", "audit");
  await assertIncludes("docs/ai/AI_GOVERNANCE.md", "Single governed entry point");
  await assertIncludes("docs/deployment/DEPLOYMENT_GUIDE.md", "Release Promotion Guidance");
  await assertIncludes("docs/testing/TESTING_STRATEGY.md", "npm test");

  log("Checking test and deployment gates.");
  for (const path of [
    "apps/api/test/integration/api-contract.test.ts",
    "apps/api/test/integration/auth-identity.test.ts",
    "apps/api/test/unit/authorize.test.ts",
    "apps/api/test/unit/rag-retrieval.test.ts",
    "apps/api/test/unit/workflow-engine.test.ts",
    "apps/web/test/login-page.test.tsx",
    "apps/web/test/protected-route.test.tsx",
    "apps/web/test/rbac.test.ts",
    "tests/phase30-deployment-devops-exhaustive.mjs",
    ".github/workflows/ci.yml",
    "docker-compose.yml",
    "apps/api/Dockerfile",
    "apps/web/Dockerfile"
  ]) {
    await assertFile(path);
  }
  await assertIncludes(".github/workflows/ci.yml", "npm run typecheck");
  await assertIncludes(".github/workflows/ci.yml", "docker compose build api web");
  await assertIncludes("docker-compose.yml", "postgres:");
  await assertIncludes("docker-compose.yml", "api:");
  await assertIncludes("docker-compose.yml", "web:");

  log("Phase 31 production release readiness checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
