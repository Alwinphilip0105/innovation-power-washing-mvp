/**
 * Fixed-window rate limiter, in process.
 *
 * Adequate for a single-instance MVP and for making abusive traffic expensive.
 * On multi-instance deployments this limits per instance - swap the store for
 * Redis or Upstash when the platform grows past one region.
 */

interface Window {
  count: number;
  resetAt: number;
}

const globalRef = globalThis as unknown as { __ipwRateLimit?: Map<string, Window> };

function buckets(): Map<string, Window> {
  if (!globalRef.__ipwRateLimit) globalRef.__ipwRateLimit = new Map();
  return globalRef.__ipwRateLimit;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const map = buckets();
  const existing = map.get(key);

  if (!existing || existing.resetAt <= now) {
    const window: Window = { count: 1, resetAt: now + windowMs };
    map.set(key, window);

    // Opportunistic sweep so the map cannot grow without bound.
    if (map.size > 5_000) {
      for (const [entryKey, entry] of map) {
        if (entry.resetAt <= now) map.delete(entryKey);
      }
    }

    return { allowed: true, remaining: limit - 1, resetAt: window.resetAt, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;

  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: allowed ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  };
}

export function resetRateLimits() {
  buckets().clear();
}

/** Best-effort client identity for rate limiting. Never trusted for auth. */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return `${scope}:${ip}`;
}
