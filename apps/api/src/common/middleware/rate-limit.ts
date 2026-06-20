import type { Request, RequestHandler } from "express";
import { AppError } from "../errors/app-error.js";

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix?: string;
}

function getClientIp(request: Request) {
  const forwardedFor = request.header("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }
  return request.ip ?? request.socket.remoteAddress ?? null;
}

// Fixed-window, in-memory rate limiter. Keyed by authenticated user when
// available, otherwise by client IP. Returns 429 RATE_LIMITED past the limit.
export function createRateLimiter({ windowMs, max, keyPrefix = "global" }: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return (request, response, next) => {
    const now = Date.now();

    // Opportunistic cleanup so the bucket map cannot grow unbounded.
    if (buckets.size > 20000) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) {
          buckets.delete(key);
        }
      }
    }

    const identity = request.auth?.userId ?? getClientIp(request) ?? "anonymous";
    const key = `${keyPrefix}:${identity}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    response.setHeader("X-RateLimit-Limit", String(max));
    response.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.count)));

    if (bucket.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      response.setHeader("Retry-After", String(retryAfterSeconds));
      throw new AppError(429, "Rate limit exceeded. Please retry later.", undefined, "RATE_LIMITED");
    }

    next();
  };
}
