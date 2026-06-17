import { Pool, types, type QueryResultRow } from "pg";
import type { DatabaseConfig, DatabaseHealth, DatabaseQueryResult } from "./types.js";

// Return SQL `date` (OID 1082) values as raw `YYYY-MM-DD` strings instead of
// JavaScript Date objects. The default driver parser builds a Date at local
// midnight, which serializes to a timezone-shifted timestamp and moves the day
// for non-UTC servers. Keeping dates as strings preserves the stored calendar day.
types.setTypeParser(1082, (value) => value);

const DEFAULT_POOL_SIZE = 10;
const DEFAULT_IDLE_TIMEOUT_MS = 10_000;
const DEFAULT_CONNECTION_TIMEOUT_MS = 5_000;

function getErrorMessage(error: unknown) {
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

    const errorCode = "code" in error ? String((error as { code?: string }).code ?? "") : "";

    if (errorCode) {
      return `Error code ${errorCode}`;
    }

    return error.message;
  }

  return "Unknown database error";
}

export class DatabaseClient {
  private pool?: Pool;

  constructor(private readonly config: DatabaseConfig) {}

  isEnabled() {
    return this.config.enabled;
  }

  private createPool() {
    return new Pool({
      application_name: this.config.applicationName ?? "crm-platform",
      connectionString: this.config.url,
      max: this.config.maxPoolSize ?? DEFAULT_POOL_SIZE,
      idleTimeoutMillis: this.config.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: this.config.connectionTimeoutMs ?? DEFAULT_CONNECTION_TIMEOUT_MS
    });
  }

  getPool() {
    if (!this.config.enabled) {
      throw new Error("Database access was requested while DATABASE_ENABLED is false.");
    }

    if (!this.pool) {
      this.pool = this.createPool();
    }

    return this.pool;
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: readonly unknown[] = []
  ): Promise<DatabaseQueryResult<T>> {
    return this.getPool().query<T>(text, [...params]);
  }

  async checkHealth(): Promise<DatabaseHealth> {
    if (!this.config.enabled) {
      return {
        enabled: false,
        driver: this.config.driver,
        status: "disabled",
        message: "Database integration is disabled."
      };
    }

    const startedAt = performance.now();

    try {
      const result = await this.query<{ database_name: string }>(
        "SELECT current_database() AS database_name"
      );

      return {
        enabled: true,
        driver: this.config.driver,
        status: "connected",
        latencyMs: Number((performance.now() - startedAt).toFixed(2)),
        message: `Connected to ${result.rows[0]?.database_name ?? "database"}.`
      };
    } catch (error) {
      return {
        enabled: true,
        driver: this.config.driver,
        status: "error",
        latencyMs: Number((performance.now() - startedAt).toFixed(2)),
        message: `Connection failed: ${getErrorMessage(error)}`
      };
    }
  }

  async close() {
    if (!this.pool) {
      return;
    }

    await this.pool.end();
    this.pool = undefined;
  }
}
