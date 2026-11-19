/// <reference types="@cloudflare/workers-types" />
import { checkRateLimit, clientIp, tooManyRequests, TEN_MINUTES_MS } from '../../src/lib/rateLimit';

// Site-wide caps per day, on top of each visitor's limit per 10 minutes. They keep Google Places,
// Routes and Geocoding inside their free monthly allowance: a full itinerary build makes up to six
// Text Search calls, so 5 builds a day stays under that product's roughly 1,000 free calls a month.
const DAILY_CAPS: Record<string, number> = {
  'itinerary-full': 5,
  'itinerary-scoped': 20,
  chat: 30,
  autocomplete: 300,
  directions: 100,
  geocode: 100,
  'nearby-place': 100,
  translate: 30,
  'contribute-places': 50,
};

const WINDOW_SECONDS = TEN_MINUTES_MS / 1000;
const DAY_SECONDS = 24 * 60 * 60;

export type LimitResult = { ok: true; refund: () => Promise<void> } | { ok: false; response: Response };

// Counts one request against the visitor's limit per 10 minutes and the bucket's daily cap, in KV so
// every Cloudflare instance shares the counts. KV is eventually consistent, so a burst can overshoot a
// little; that is acceptable for cost control. Without the binding (local development) it falls back
// to the in-memory limiter.
export async function countRequest(
  env: { PLANNER_USAGE?: KVNamespace },
  request: Request,
  bucket: string,
  maxPerWindow: number,
  windowMessage?: (minutes: number) => string,
): Promise<LimitResult> {
  const kv = env.PLANNER_USAGE;
  const tooMany = (seconds: number) => {
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    const message = windowMessage?.(minutes) ?? `Too many requests. Please try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`;
    return tooManyRequests(message, seconds);
  };
  if (!kv) {
    const result = checkRateLimit(`${bucket}:${clientIp(request)}`, maxPerWindow, TEN_MINUTES_MS);
    return result.ok ? { ok: true, refund: async () => result.refund() } : { ok: false, response: tooMany(result.retryAfterSeconds) };
  }

  const now = Date.now();
  const window = Math.floor(now / TEN_MINUTES_MS);
  const visitorKey = `ip:${bucket}:${clientIp(request)}:${window}`;
  const dayKey = `day:${bucket}:${new Date(now).toISOString().slice(0, 10)}`;
  const [visitorCount, dayCount] = (await Promise.all([kv.get(visitorKey), kv.get(dayKey)])).map((v) => Number(v) || 0);

  if (dayCount >= (DAILY_CAPS[bucket] ?? Infinity)) {
    return { ok: false, response: tooManyRequests("The planner has reached today's limit for this. Please try again tomorrow.", DAY_SECONDS) };
  }
  if (visitorCount >= maxPerWindow) {
    return { ok: false, response: tooMany((window + 1) * WINDOW_SECONDS - Math.floor(now / 1000)) };
  }

  await Promise.all([
    kv.put(visitorKey, String(visitorCount + 1), { expirationTtl: 2 * WINDOW_SECONDS }),
    kv.put(dayKey, String(dayCount + 1), { expirationTtl: 2 * DAY_SECONDS }),
  ]);
  return {
    ok: true,
    // Gives the attempt back when a request failed on the planner's side, not the visitor's.
    refund: async () => {
      const [v, d] = (await Promise.all([kv.get(visitorKey), kv.get(dayKey)])).map((x) => Number(x) || 0);
      await Promise.all([
        kv.put(visitorKey, String(Math.max(0, v - 1)), { expirationTtl: 2 * WINDOW_SECONDS }),
        kv.put(dayKey, String(Math.max(0, d - 1)), { expirationTtl: 2 * DAY_SECONDS }),
      ]);
    },
  };
}

// For the simple endpoints: a 429 response when over a limit, otherwise null.
export async function limitRequest(env: { PLANNER_USAGE?: KVNamespace }, request: Request, bucket: string, maxPerWindow: number): Promise<Response | null> {
  const result = await countRequest(env, request, bucket, maxPerWindow);
  return result.ok ? null : result.response;
}
