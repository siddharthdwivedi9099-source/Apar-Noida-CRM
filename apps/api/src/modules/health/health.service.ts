import type { HealthResponse, ReadinessResponse, RuntimeMetricsResponse } from "@crm/types";
import { apiConfig } from "@crm/config";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { RedisService } from "../../platform/redis/redis.service.js";
import { CacheService } from "../../platform/cache/cache.service.js";

const BYTES_PER_MB = 1024 * 1024;

export class HealthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
    private readonly cacheService: CacheService
  ) {}

  // Liveness: the process is up and able to respond.
  async getHealth(): Promise<HealthResponse> {
    return {
      status: "ok",
      service: `${env.APP_NAME}-api`,
      version: apiConfig.version,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      environment: env.NODE_ENV,
      dependencies: {
        database: await this.databaseService.getHealth(),
        redis: this.redisService.getHealth()
      }
    };
  }

  // Readiness: the service can serve traffic right now. The database is the only
  // hard dependency; Redis is optional today and never blocks readiness.
  async getReadiness(): Promise<ReadinessResponse> {
    const databaseHealth = await this.databaseService.getHealth();
    const databasePass = databaseHealth.status === "connected" || databaseHealth.status === "disabled";

    const checks = [
      {
        name: "database",
        status: databasePass ? ("pass" as const) : ("fail" as const),
        detail: databaseHealth.message
      },
      {
        name: "redis",
        status: "pass" as const,
        detail: this.redisService.getHealth().message
      }
    ];

    const ready = checks.every((check) => check.status === "pass");
    return {
      status: ready ? "ready" : "not_ready",
      service: `${env.APP_NAME}-api`,
      timestamp: new Date().toISOString(),
      checks
    };
  }

  // Metrics: a JSON placeholder for a future Prometheus/OpenTelemetry exporter.
  getMetrics(): RuntimeMetricsResponse {
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();
    return {
      service: `${env.APP_NAME}-api`,
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        memoryRssMb: Number((memory.rss / BYTES_PER_MB).toFixed(2)),
        heapUsedMb: Number((memory.heapUsed / BYTES_PER_MB).toFixed(2)),
        heapTotalMb: Number((memory.heapTotal / BYTES_PER_MB).toFixed(2)),
        cpuUserMs: Number((cpu.user / 1000).toFixed(2)),
        cpuSystemMs: Number((cpu.system / 1000).toFixed(2))
      },
      cache: this.cacheService.getStatus(),
      note: "Placeholder metrics endpoint. A Prometheus/OpenTelemetry exporter is deferred to the observability runtime phase."
    };
  }
}
