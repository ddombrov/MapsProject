import { FULL_BUILDS_PER_WINDOW, RATE_WINDOW_MS } from './limits';

// A friendly, per-browser limit on full trip builds, kept in localStorage (shared across tabs,
// survives reloads). It can't stop someone determined — storage can be cleared and the API
// called directly — so it's a courtesy for ordinary users; the provider keys' own limits and
// the server-side counter are the real backstops.
const KEY = 'itinerary-full-build-times';

function readTimes(): number[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    const now = Date.now();
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'number' && now - t < RATE_WINDOW_MS) : [];
  } catch {
    return []; // storage unavailable (private mode, blocked) — don't block anyone over it
  }
}

function writeTimes(times: number[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(times));
  } catch {
    // ignore: the limit simply won't persist
  }
}

export function checkBuildLimit(): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const times = readTimes();
  if (times.length < FULL_BUILDS_PER_WINDOW) return { allowed: true };
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((Math.min(...times) + RATE_WINDOW_MS - Date.now()) / 1000)),
  };
}

// Returns a stamp that can be handed back to refundBuild if the build fails.
export function recordBuild(): number {
  const stamp = Date.now();
  writeTimes([...readTimes(), stamp]);
  return stamp;
}

export function refundBuild(stamp: number) {
  writeTimes(readTimes().filter((t) => t !== stamp));
}

export function buildLimitMessage(retryAfterSeconds: number): string {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `You can build ${FULL_BUILDS_PER_WINDOW} trips every 10 minutes. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}
