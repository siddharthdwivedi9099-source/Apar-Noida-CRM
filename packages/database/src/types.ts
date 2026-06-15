import type { QueryResult, QueryResultRow } from "pg";
import type { ConnectionHealth } from "@crm/types";

export interface DatabaseConfig {
  enabled: boolean;
  driver: "postgresql";
  url: string;
  applicationName?: string;
  maxPoolSize?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
}

export interface RedisPlaceholderConfig {
  enabled: boolean;
  driver: "redis";
  url: string;
}

export interface DatabaseQueryResult<T extends QueryResultRow = QueryResultRow> extends QueryResult<T> {}

export interface DatabaseHealth extends ConnectionHealth {
  latencyMs?: number;
}

export interface MigrationFile {
  name: string;
  path: string;
  checksum: string;
  upSql: string;
  downSql: string;
}

export interface AppliedMigration {
  name: string;
  checksum: string;
  appliedAt: Date;
}

export interface MigrationStatus {
  applied: AppliedMigration[];
  pending: string[];
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

export interface RollbackResult {
  rolledBack: string[];
}

export interface PermissionCatalogEntry {
  code: string;
  resource: string;
  action: string;
  description: string;
  category: string;
}

export interface CoreSeedOptions {
  defaultTenantSlug: string;
  defaultTenantName: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
}

export interface SeedResult {
  applied: string[];
}
