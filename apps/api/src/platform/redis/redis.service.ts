import { createPlaceholderHealth, type RedisPlaceholderConfig } from "@crm/database";

export class RedisService {
  constructor(private readonly config: RedisPlaceholderConfig) {}

  getHealth() {
    return createPlaceholderHealth(
      this.config.enabled,
      this.config.driver,
      this.config.enabled
        ? "Redis integration is configured as a placeholder for the upcoming cache and queue phase."
        : "Redis integration is currently disabled. Enable it once caching or workers are introduced."
    );
  }
}

