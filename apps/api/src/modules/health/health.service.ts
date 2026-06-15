import type { HealthResponse } from "@crm/types";
import { apiConfig } from "@crm/config";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { RedisService } from "../../platform/redis/redis.service.js";

export class HealthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService
  ) {}

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
}
