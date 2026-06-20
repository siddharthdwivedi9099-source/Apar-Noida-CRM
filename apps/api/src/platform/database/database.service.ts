import { DatabaseClient, type DatabaseConfig } from "@crm/database";
import type { PoolClient, QueryResultRow } from "pg";
import { env } from "../../config/env.js";
import { logger } from "../logger/logger.js";

// Truncate SQL for log lines so we never emit unbounded statements and collapse
// whitespace for readable single-line structured logs.
function summarizeSql(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 200);
}

// Phase 29 slow-query logging: any statement slower than the configured
// threshold is logged as a structured warning so hotspots are observable.
function logSlowQuery(durationMs: number, text: string) {
  if (!env.QUERY_LOGGING_ENABLED) {
    return;
  }
  if (durationMs >= env.SLOW_QUERY_THRESHOLD_MS) {
    logger.warn(
      { durationMs: Number(durationMs.toFixed(2)), thresholdMs: env.SLOW_QUERY_THRESHOLD_MS, sql: summarizeSql(text) },
      "Slow database query detected"
    );
  }
}

export class DatabaseService {
  private readonly client: DatabaseClient;

  constructor(config: DatabaseConfig) {
    this.client = new DatabaseClient(config);
  }

  isEnabled() {
    return this.client.isEnabled();
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, params: readonly unknown[] = []) {
    const startedAt = performance.now();
    try {
      return await this.client.query<T>(text, params);
    } finally {
      logSlowQuery(performance.now() - startedAt, text);
    }
  }

  // Wrap a pooled client's query method with slow-query timing for the duration
  // of the callback, then restore the original before the client is released so
  // the instrumentation never leaks back into the pool.
  private instrument(client: PoolClient) {
    const originalQuery = client.query.bind(client);
    (client as { query: unknown }).query = (...args: unknown[]) => {
      const startedAt = performance.now();
      const text = typeof args[0] === "string" ? args[0] : (args[0] as { text?: string })?.text ?? "";
      const result = (originalQuery as (...a: unknown[]) => unknown)(...args);
      if (result && typeof (result as Promise<unknown>).finally === "function") {
        return (result as Promise<unknown>).finally(() => logSlowQuery(performance.now() - startedAt, text));
      }
      return result;
    };
    return () => {
      (client as { query: unknown }).query = originalQuery;
    };
  }

  async withClient<T>(callback: (client: PoolClient) => Promise<T>) {
    const client = await this.client.getPool().connect();
    const restore = this.instrument(client);

    try {
      return await callback(client);
    } finally {
      restore();
      client.release();
    }
  }

  async withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
    const client = await this.client.getPool().connect();
    const restore = this.instrument(client);

    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      restore();
      client.release();
    }
  }

  getPool() {
    return this.client.getPool();
  }

  async getHealth() {
    return this.client.checkHealth();
  }

  async close() {
    await this.client.close();
  }
}
