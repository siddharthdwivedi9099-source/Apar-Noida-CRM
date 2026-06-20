import { describe, expect, it, vi } from "vitest";
import { CacheService } from "../../src/platform/cache/cache.service";
import { RedisService } from "../../src/platform/redis/redis.service";

function buildCache(enabled = false) {
  const redis = new RedisService({ enabled: false, driver: "redis" });
  return new CacheService(redis, { enabled, ttlSeconds: 60 });
}

describe("Cache service (dashboard cache placeholder)", () => {
  it("builds tenant-scoped keys with null-safe segments", () => {
    const cache = buildCache();
    expect(cache.buildKey(["dashboard", "tenant-1", "exec", null, undefined])).toBe("dashboard:tenant-1:exec:_:_");
  });

  it("computes the value through the producer when caching is inactive", async () => {
    const cache = buildCache();
    const producer = vi.fn().mockResolvedValue({ widgets: [] });
    const result = await cache.wrap("dashboard:tenant-1:exec", producer);
    expect(result).toEqual({ widgets: [] });
    expect(producer).toHaveBeenCalledTimes(1);
  });

  it("tracks hit/miss counters and reports a status", async () => {
    const cache = buildCache();
    await cache.wrap("k1", async () => 1);
    await cache.wrap("k2", async () => 2);
    const status = cache.getStatus();
    expect(status.misses).toBe(2);
    expect(status.hits).toBe(0);
    expect(status.hitRate).toBe(0);
    expect(status.enabled).toBe(false);
    expect(status.backend).toBe("none");
    expect(status.ttlSeconds).toBe(60);
    expect(status.message).toMatch(/deferred|recomputed/i);
  });
});
