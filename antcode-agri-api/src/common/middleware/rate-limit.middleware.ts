import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error.js";

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message: string;
  key?: (req: Request) => string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Small in-memory fixed-window limiter for this sprint deployment.
 * It protects public/auth endpoints without adding another dependency.
 * For a horizontally scaled production deployment, replace the Map with a
 * shared Redis-backed limiter so all API instances share the same counters.
 */
export function rateLimit(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = options.key?.(req) ?? req.ip ?? req.socket.remoteAddress ?? "unknown";
    const existing = buckets.get(key);
    const bucket = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + options.windowMs }
      : existing;

    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(0, options.max - bucket.count);
    res.setHeader("RateLimit-Limit", String(options.max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > options.max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      next(new AppError(options.message, 429));
      return;
    }

    // Opportunistic cleanup prevents stale IP buckets accumulating forever.
    if (buckets.size > 10_000) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey);
      }
    }

    next();
  };
}

export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  max: 180,
  message: "Too many requests. Please try again shortly.",
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  max: 12,
  message: "Too many authentication attempts. Please try again later.",
});
