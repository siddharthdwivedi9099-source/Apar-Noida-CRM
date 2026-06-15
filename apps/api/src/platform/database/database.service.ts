import { DatabaseClient, type DatabaseConfig } from "@crm/database";
import type { PoolClient, QueryResultRow } from "pg";

export class DatabaseService {
  private readonly client: DatabaseClient;

  constructor(config: DatabaseConfig) {
    this.client = new DatabaseClient(config);
  }

  isEnabled() {
    return this.client.isEnabled();
  }

  query<T extends QueryResultRow = QueryResultRow>(text: string, params: readonly unknown[] = []) {
    return this.client.query<T>(text, params);
  }

  async withClient<T>(callback: (client: PoolClient) => Promise<T>) {
    const client = await this.client.getPool().connect();

    try {
      return await callback(client);
    } finally {
      client.release();
    }
  }

  async withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
    const client = await this.client.getPool().connect();

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
