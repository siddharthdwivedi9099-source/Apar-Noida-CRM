import "dotenv/config";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  DatabaseClient,
  createMigrationFile,
  getMigrationStatus,
  rollbackMigrations,
  runCoreSeed,
  runMigrations
} from "@crm/database";

const DEFAULT_DATABASE_URL = "postgresql://crm:crm@localhost:5432/crm";
const DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG ?? "sample-tenant";
const DEFAULT_TENANT_NAME = process.env.DEFAULT_TENANT_NAME ?? "Sample Tenant";
const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL ?? "admin@sample-tenant.local";
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD ?? "ChangeMe123!";
const DEFAULT_ADMIN_FIRST_NAME = process.env.DEFAULT_ADMIN_FIRST_NAME ?? "Platform";
const DEFAULT_ADMIN_LAST_NAME = process.env.DEFAULT_ADMIN_LAST_NAME ?? "Admin";

const command = process.argv[2];
const commandArgument = process.argv[3];
const currentFilePath = fileURLToPath(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(currentFilePath), "..");
const migrationDirectory = path.join(workspaceRoot, "packages", "database", "migrations");

function formatError(error) {
  if (error instanceof AggregateError) {
    const nestedMessages = error.errors
      .map((entry) => (entry instanceof Error ? `${entry.name}: ${entry.message}` : String(entry)))
      .filter(Boolean);

    if (nestedMessages.length > 0) {
      return nestedMessages.join(" | ");
    }
  }

  if (error instanceof Error) {
    if (error.message) {
      return error.message;
    }

    if ("code" in error && error.code) {
      return `Error code ${String(error.code)}`;
    }

    return error.name;
  }

  return String(error);
}

function createDatabaseClient() {
  return new DatabaseClient({
    enabled: true,
    driver: "postgresql",
    url: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    applicationName: "crm-database-cli"
  });
}

function printUsage() {
  console.log(`Available commands:
  node scripts/database.mjs create-migration <name>
  node scripts/database.mjs migrate
  node scripts/database.mjs rollback [steps]
  node scripts/database.mjs seed
  node scripts/database.mjs status`);
}

async function run() {
  if (!command) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (command === "create-migration") {
    const filePath = await createMigrationFile(migrationDirectory, commandArgument ?? "");
    console.log(`Created migration: ${path.relative(workspaceRoot, filePath)}`);
    return;
  }

  const databaseClient = createDatabaseClient();

  try {
    const pool = databaseClient.getPool();

    if (command === "migrate") {
      const result = await runMigrations(pool, migrationDirectory);
      console.log(`Applied migrations: ${result.applied.length ? result.applied.join(", ") : "none"}`);
      console.log(`Skipped migrations: ${result.skipped.length ? result.skipped.join(", ") : "none"}`);
      return;
    }

    if (command === "rollback") {
      const steps = Number(commandArgument ?? "1");
      const result = await rollbackMigrations(pool, migrationDirectory, Number.isNaN(steps) ? 1 : steps);
      console.log(`Rolled back migrations: ${result.rolledBack.length ? result.rolledBack.join(", ") : "none"}`);
      return;
    }

    if (command === "seed") {
      const result = await runCoreSeed(pool, {
        defaultTenantSlug: DEFAULT_TENANT_SLUG,
        defaultTenantName: DEFAULT_TENANT_NAME,
        adminEmail: DEFAULT_ADMIN_EMAIL,
        adminPassword: DEFAULT_ADMIN_PASSWORD,
        adminFirstName: DEFAULT_ADMIN_FIRST_NAME,
        adminLastName: DEFAULT_ADMIN_LAST_NAME
      });
      console.log(`Executed seeds: ${result.applied.join(", ")}`);
      return;
    }

    if (command === "status") {
      const status = await getMigrationStatus(pool, migrationDirectory);
      console.log(`Applied migrations: ${status.applied.length ? status.applied.map((migration) => migration.name).join(", ") : "none"}`);
      console.log(`Pending migrations: ${status.pending.length ? status.pending.join(", ") : "none"}`);
      return;
    }

    printUsage();
    process.exitCode = 1;
  } finally {
    await databaseClient.close();
  }
}

run().catch((error) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
