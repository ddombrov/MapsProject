import { RATE_WINDOW_MS } from './limits';

export const TEN_MINUTES_MS = RATE_WINDOW_MS;

// Kept on globalThis so every route handler shares one table, even if the bundler gives each
// route its own copy of this module.
const store = globalThis as typeof globalThis & { __rateLimitHits?: Map<string, number[]> };
const hits = (store.__rateLimitHits ??= new Map<string, number[]>());

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
}

export type RateLimitResult =
  | { ok: true; refund: () => void }
  | { ok: false; retryAfterSeconds: number };

// Sliding window: at most `max` hits per `windowMs` for a key. `refund` gives an attempt back,
// for requests that failed on our side and shouldn't count against the user.
//
// NOTE: this lives in server memory, so it is per server instance. That is exact for one
// long-running server, but on a serverless host each instance keeps its own count — treat it
// as a speed bump there, and back it with a shared store (e.g. Redis) for a hard guarantee.
export function checkRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= max) {
    hits.set(key, recent);
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
  }

  recent.push(now);
  hits.set(key, recent);

  // Occasionally drop keys that have gone quiet so the table can't grow without bound.
  if (hits.size > 2000) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }

  return {
    ok: true,
    refund: () => {
      const list = hits.get(key);
      const at = list?.indexOf(now) ?? -1;
      if (list && at !== -1) list.splice(at, 1);
    },
  };
}

export function tooManyRequests(message: string, retryAfterSeconds: number): Response {
  return Response.json(
    { error: message, retryAfterSeconds },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  );
}

// A plain per-IP cap for endpoints that proxy a paid API, so nobody can hammer them.
export function enforceRateLimit(request: Request, bucket: string, max: number): Response | null {
  const result = checkRateLimit(`${bucket}:${clientIp(request)}`, max, TEN_MINUTES_MS);
  if (result.ok) return null;
  const minutes = Math.ceil(result.retryAfterSeconds / 60);
  return tooManyRequests(`Too many requests. Please try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`, result.retryAfterSeconds);
}
