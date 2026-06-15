import type { Request } from "express";

interface LoginRateLimiterConfig {
  windowMinutes: number;
  maxAttempts: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

function buildRequestKey(request: Request) {
  const body = request.body as {
    tenantSlug?: string;
    email?: string;
  };

  return [
    request.ip ?? "unknown-ip",
    body.tenantSlug?.trim().toLowerCase() ?? "unknown-tenant",
    body.email?.trim().toLowerCase() ?? "unknown-email"
  ].join(":");
}

export interface LoginRateLimiter {
  consume: (request: Request) => {
    allowed: boolean;
    retryAfterSeconds: number;
  };
  clear: (request: Request) => void;
}

export function createLoginRateLimiter(config: LoginRateLimiterConfig): LoginRateLimiter {
  const attempts = new Map<string, RateLimitEntry>();
  const windowMs = config.windowMinutes * 60_000;

  function pruneExpiredEntries(now: number) {
    for (const [key, entry] of attempts) {
      if (entry.resetAt <= now) {
        attempts.delete(key);
      }
    }
  }

  return {
    consume(request) {
      const now = Date.now();
      pruneExpiredEntries(now);

      const key = buildRequestKey(request);
      const existingEntry = attempts.get(key);
      const entry =
        existingEntry && existingEntry.resetAt > now
          ? existingEntry
          : {
              count: 0,
              resetAt: now + windowMs
            };

      entry.count += 1;
      attempts.set(key, entry);

      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);

      if (entry.count > config.maxAttempts) {
        return {
          allowed: false,
          retryAfterSeconds
        };
      }

      return {
        allowed: true,
        retryAfterSeconds
      };
    },
    clear(request) {
      attempts.delete(buildRequestKey(request));
    }
  };
}
