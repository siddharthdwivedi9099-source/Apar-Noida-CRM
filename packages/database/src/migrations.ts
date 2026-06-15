import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Pool, PoolClient } from "pg";
import type {
  AppliedMigration,
  MigrationFile,
  MigrationResult,
  MigrationStatus,
  RollbackResult
} from "./types.js";

const MIGRATION_UP_MARKER = "-- migrate:up";
const MIGRATION_DOWN_MARKER = "-- migrate:down";

function createChecksum(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function parseMigrationFile(filePath: string, contents: string) {
  const upMarkerIndex = contents.indexOf(MIGRATION_UP_MARKER);
  const downMarkerIndex = contents.indexOf(MIGRATION_DOWN_MARKER);

  if (upMarkerIndex === -1 || downMarkerIndex === -1 || downMarkerIndex <= upMarkerIndex) {
    throw new Error(
      `Migration file "${filePath}" must include "${MIGRATION_UP_MARKER}" before "${MIGRATION_DOWN_MARKER}".`
    );
  }

  const upSql = contents.slice(upMarkerIndex + MIGRATION_UP_MARKER.length, downMarkerIndex).trim();
  const downSql = contents.slice(downMarkerIndex + MIGRATION_DOWN_MARKER.length).trim();

  if (!upSql) {
    throw new Error(`Migration file "${filePath}" does not contain an up migration.`);
  }

  return {
    upSql,
    downSql
  };
}

async function ensureMigrationTables(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function loadMigrationFiles(directory: string): Promise<MigrationFile[]> {
  await mkdir(directory, { recursive: true });

  const files = (await readdir(directory))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));

  const migrations = await Promise.all(
    files.map(async (fileName) => {
      const filePath = path.join(directory, fileName);
      const contents = await readFile(filePath, "utf8");
      const { upSql, downSql } = parseMigrationFile(filePath, contents);

      return {
        name: fileName,
        path: filePath,
        checksum: createChecksum(contents),
        upSql,
        downSql
      };
    })
  );

  return migrations;
}

async function getAppliedMigrationMap(pool: Pool) {
  await ensureMigrationTables(pool);

  const result = await pool.query<{
    name: string;
    checksum: string;
    applied_at: Date;
  }>("SELECT name, checksum, applied_at FROM schema_migrations ORDER BY applied_at ASC, name ASC");

  return new Map(
    result.rows.map((row) => [
      row.name,
      {
        name: row.name,
        checksum: row.checksum,
        appliedAt: row.applied_at
      } satisfies AppliedMigration
    ])
  );
}

export async function getMigrationStatus(pool: Pool, directory: string): Promise<MigrationStatus> {
  const migrations = await loadMigrationFiles(directory);
  const appliedMigrationMap = await getAppliedMigrationMap(pool);

  const pending: string[] = [];

  for (const migration of migrations) {
    const appliedMigration = appliedMigrationMap.get(migration.name);

    if (!appliedMigration) {
      pending.push(migration.name);
      continue;
    }

    if (appliedMigration.checksum !== migration.checksum) {
      throw new Error(
        `Migration "${migration.name}" has changed since it was applied. Create a new migration instead of editing an applied one.`
      );
    }
  }

  return {
    applied: [...appliedMigrationMap.values()],
    pending
  };
}

async function executeInTransaction<T>(
  pool: Pool,
  callback: (client: PoolClient) => Promise<T | void>
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function runMigrations(pool: Pool, directory: string): Promise<MigrationResult> {
  const migrations = await loadMigrationFiles(directory);
  const appliedMigrationMap = await getAppliedMigrationMap(pool);
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const migration of migrations) {
    const appliedMigration = appliedMigrationMap.get(migration.name);

    if (appliedMigration) {
      if (appliedMigration.checksum !== migration.checksum) {
        throw new Error(
          `Migration "${migration.name}" has changed since it was applied. Create a new migration instead of editing an applied one.`
        );
      }

      skipped.push(migration.name);
      continue;
    }

    await executeInTransaction(pool, async (client) => {
      await client.query(migration.upSql);
      await client.query(
        "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)",
        [migration.name, migration.checksum]
      );
    });

    applied.push(migration.name);
  }

  return {
    applied,
    skipped
  };
}

export async function rollbackMigrations(
  pool: Pool,
  directory: string,
  steps = 1
): Promise<RollbackResult> {
  if (steps < 1) {
    throw new Error("Rollback steps must be at least 1.");
  }

  await ensureMigrationTables(pool);

  const migrations = await loadMigrationFiles(directory);
  const migrationMap = new Map(migrations.map((migration) => [migration.name, migration]));
  const result = await pool.query<{
    name: string;
    checksum: string;
  }>(
    "SELECT name, checksum FROM schema_migrations ORDER BY applied_at DESC, name DESC LIMIT $1",
    [steps]
  );

  const rolledBack: string[] = [];

  for (const appliedMigration of result.rows) {
    const migration = migrationMap.get(appliedMigration.name);

    if (!migration) {
      throw new Error(
        `Migration "${appliedMigration.name}" is recorded in schema_migrations but the file is missing locally.`
      );
    }

    if (!migration.downSql) {
      throw new Error(`Migration "${migration.name}" does not define a down migration.`);
    }

    if (migration.checksum !== appliedMigration.checksum) {
      throw new Error(
        `Migration "${migration.name}" has changed since it was applied. Rollback was aborted to avoid an unsafe reversal.`
      );
    }

    await executeInTransaction(pool, async (client) => {
      await client.query(migration.downSql);
      await client.query("DELETE FROM schema_migrations WHERE name = $1", [migration.name]);
    });

    rolledBack.push(migration.name);
  }

  return {
    rolledBack
  };
}

function sanitizeMigrationName(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getTimestampPrefix() {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");
  const minute = String(now.getUTCMinutes()).padStart(2, "0");
  const second = String(now.getUTCSeconds()).padStart(2, "0");

  return `${year}${month}${day}${hour}${minute}${second}`;
}

export async function createMigrationFile(directory: string, rawName: string) {
  const sanitizedName = sanitizeMigrationName(rawName);

  if (!sanitizedName) {
    throw new Error("A migration name is required. Example: npm run db:create:migration -- add_contacts_table");
  }

  await mkdir(directory, { recursive: true });

  const fileName = `${getTimestampPrefix()}_${sanitizedName}.sql`;
  const filePath = path.join(directory, fileName);

  await writeFile(
    filePath,
    `${MIGRATION_UP_MARKER}
-- Write forward migration SQL here.

${MIGRATION_DOWN_MARKER}
-- Write rollback SQL here.
`,
    "utf8"
  );

  return filePath;
}
