import {
  RATE_LIMIT_MAX_KEYS,
  RATE_LIMIT_PER_MINUTE,
  RATE_LIMIT_WINDOW_MS,
} from './config.ts';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
  size(): number;
}

/**
 * In-memory sliding window per key. Best effort: each serverless instance
 * counts separately. Map size is capped; oldest-touched keys go first.
 */
export function createRateLimiter(
  options: {
    limit?: number;
    windowMs?: number;
    maxKeys?: number;
    now?: () => number;
  } = {}
): RateLimiter {
  const limit = options.limit ?? RATE_LIMIT_PER_MINUTE;
  const windowMs = options.windowMs ?? RATE_LIMIT_WINDOW_MS;
  const maxKeys = options.maxKeys ?? RATE_LIMIT_MAX_KEYS;
  const now = options.now ?? Date.now;
  const hits = new Map<string, number[]>();

  function sweep(t: number) {
    for (const [key, times] of hits) {
      if (times[times.length - 1] <= t - windowMs) hits.delete(key);
    }
  }

  return {
    check(key) {
      const t = now();
      sweep(t);
      const recent = (hits.get(key) ?? []).filter((x) => x > t - windowMs);
      if (recent.length >= limit) {
        hits.delete(key);
        hits.set(key, recent);
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((recent[0] + windowMs - t) / 1000)
          ),
        };
      }
      recent.push(t);
      hits.delete(key);
      hits.set(key, recent);
      while (hits.size > maxKeys) {
        const oldest = hits.keys().next().value;
        if (oldest === undefined) break;
        hits.delete(oldest);
      }
      return { allowed: true, retryAfterSeconds: 0 };
    },
    size: () => hits.size,
  };
}

/** Client IP from Vercel-set headers; a shared bucket when none is present. */
export function getClientKey(headers: Headers): string {
  const first = (value: string | null) => value?.split(',')[0].trim() || null;
  return (
    first(headers.get('x-vercel-forwarded-for')) ??
    first(headers.get('x-real-ip')) ??
    'unknown'
  );
}
