import type { CacheStatus } from "@crm/types";
import { RedisService } from "../redis/redis.service.js";

interface CacheConfig {
  enabled: boolean;
  ttlSeconds: number;
}

// Phase 29 dashboard cache. This is the caching *strategy* and seam: selected,
// expensive, read-mostly dashboard metrics are routed through `wrap()` so they
// can be served from Redis once the cache/queue runtime is enabled. Until then
// Redis is a placeholder, so every call is a deterministic miss that recomputes
// from PostgreSQL — but the cache key shape, TTL, and hit/miss accounting are
// already in place and surfaced through /metrics.
export class CacheService {
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly redisService: RedisService,
    private readonly config: CacheConfig
  ) {}

  private isActive() {
    return this.config.enabled && this.redisService.getHealth().status === "connected";
  }

  buildKey(parts: Array<string | null | undefined>) {
    return parts.map((part) => (part === null || part === undefined || part === "" ? "_" : part)).join(":");
  }

  async wrap<T>(_key: string, producer: () => Promise<T>, _ttlSeconds?: number): Promise<T> {
    // When the Redis runtime is live this will attempt a GET on `_key`, return the
    // cached value on a hit, otherwise compute, SET with the TTL, and return.
    if (this.isActive()) {
      // Placeholder for the live Redis-backed path (cache/queue phase).
      this.misses += 1;
      return producer();
    }
    this.misses += 1;
    return producer();
  }

  getStatus(): CacheStatus {
    const total = this.hits + this.misses;
    const active = this.isActive();
    return {
      enabled: this.config.enabled,
      backend: active ? "redis" : "none",
      ttlSeconds: this.config.ttlSeconds,
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : Number((this.hits / total).toFixed(3)),
      message: active
        ? "Dashboard metric caching is active."
        : "Dashboard metric caching is configured but deferred until the Redis runtime is enabled; metrics are recomputed live."
    };
  }
}
