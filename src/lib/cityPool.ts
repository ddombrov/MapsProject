import type { RawPlace } from './rawPlace';
import type { ItineraryCategory, ItineraryItem } from './types';

// A shared pool of real, previously-generated places per city, stored in Supabase. Every
// itinerary generation contributes its own verified places back to the pool for that city
// (see contributePlaces below), so a popular city accumulates more candidates over time —
// two users each adding non-overlapping places to New York leaves 100% more real candidates
// for the next person, on top of whatever a fresh Google search finds that day.
//
// This is purely additive: every function here fails soft. If Supabase is slow, down, not
// configured, or returns something unexpected, generation proceeds exactly as it did before
// this file existed — a bigger candidate pool is a bonus, never a dependency.

const REQUEST_TIMEOUT_MS = 2500;
const MAX_POOL_CANDIDATES_PER_CATEGORY = 15;
const MAX_REFRESHED_PER_CATEGORY = 10;

export function isCityPoolConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// The destination string is already fairly canonical — it comes from Google Places
// Autocomplete, which returns the same formatted string for the same city regardless of who
// typed it or when. Trimming and lowercasing is enough to group repeat visits to one city
// without a separate geocoding round trip just to compute a grouping key.
export function cityKeyFor(location: string): string {
  return location.trim().toLowerCase();
}

function placeIdentityKey(name: string, address: string): string {
  return `${name}|${address}`.toLowerCase();
}

function dedupeKeyFor(cityKey: string, name: string, address: string): string {
  return `${cityKey}|${placeIdentityKey(name, address)}`;
}

function supabaseHeaders(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface CityPlaceRow {
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: ItineraryCategory;
  google_place_id: string | null;
  rating: number | null;
  opening_hours: { weekdayDescriptions?: string[]; periods?: unknown[] } | null;
}

function rowToRawPlace(row: CityPlaceRow): RawPlace {
  return {
    id: row.google_place_id ?? undefined,
    displayName: { text: row.name },
    formattedAddress: row.address,
    location: { latitude: row.lat, longitude: row.lng },
    rating: row.rating ?? undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    regularOpeningHours: row.opening_hours as any,
  };
}

// Re-fetches hours, rating, and address for pool entries that came with a Google place ID —
// businesses move and change hours, so a cached record is only trustworthy once confirmed
// against Google again. Entries without a place ID (a user's own custom pin) can't be
// re-verified this way and are passed through as-is. Any entry that fails or times out is
// dropped rather than served with unconfirmed hours.
async function refreshMalleableDetails(rows: CityPlaceRow[]): Promise<RawPlace[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const results = await Promise.allSettled(
    rows.slice(0, MAX_REFRESHED_PER_CATEGORY).map(async (row) => {
      if (!row.google_place_id || !apiKey) return rowToRawPlace(row);
      const res = await fetchWithTimeout(`https://places.googleapis.com/v1/places/${row.google_place_id}`, {
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'displayName,formattedAddress,location,rating,regularOpeningHours',
        },
      });
      if (!res.ok) throw new Error(`Place Details ${res.status}`);
      const fresh = (await res.json()) as RawPlace;
      return { ...fresh, id: row.google_place_id, displayName: fresh.displayName ?? { text: row.name } };
    }),
  );
  const passedThrough = rows.slice(MAX_REFRESHED_PER_CATEGORY).map(rowToRawPlace);
  return [
    ...results.filter((r): r is PromiseFulfilledResult<RawPlace> => r.status === 'fulfilled').map((r) => r.value),
    ...passedThrough,
  ];
}

// Pulls this city's accumulated pool, skipping anything already covered by this request's own
// fresh Google search (no point re-verifying what's already fresh), and re-verifies the rest
// before handing them back as extra candidates.
export async function getCityPoolCandidates(
  cityKey: string,
  alreadyHaveKeys: Set<string>,
): Promise<{ food: RawPlace[]; attraction: RawPlace[] }> {
  const empty = { food: [], attraction: [] };
  if (!isCityPoolConfigured()) return empty;

  try {
    const url = `${process.env.SUPABASE_URL}/rest/v1/city_places?city_key=eq.${encodeURIComponent(cityKey)}&select=name,address,lat,lng,category,google_place_id,rating,opening_hours`;
    const res = await fetchWithTimeout(url, { headers: supabaseHeaders() });
    if (!res.ok) return empty;

    const rows = (await res.json()) as CityPlaceRow[];
    const unseen = rows.filter((r) => !alreadyHaveKeys.has(placeIdentityKey(r.name, r.address)));
    const foodRows = unseen.filter((r) => r.category === 'Food').slice(0, MAX_POOL_CANDIDATES_PER_CATEGORY);
    const attractionRows = unseen.filter((r) => r.category === 'Attraction').slice(0, MAX_POOL_CANDIDATES_PER_CATEGORY);

    const [food, attraction] = await Promise.all([refreshMalleableDetails(foodRows), refreshMalleableDetails(attractionRows)]);
    return { food, attraction };
  } catch (error) {
    console.error('City pool read failed (continuing without it):', error);
    return empty;
  }
}

// Adds this generation's (or this share's) places to the pool for next time. `source` marks
// whether these came from a real Google-backed generation or from a user's own custom
// additions still present at share time. Upserts on the dedupe key and ignores conflicts, so
// the same landmark contributed by different trips only ever counts once.
export async function contributePlaces(
  cityKey: string,
  items: ItineraryItem[],
  source: 'google' | 'custom',
): Promise<void> {
  if (!isCityPoolConfigured() || items.length === 0) return;

  try {
    const rows = items
      .filter((item) => item.name && item.address)
      .map((item) => ({
        city_key: cityKey,
        dedupe_key: dedupeKeyFor(cityKey, item.name, item.address),
        name: item.name,
        address: item.address,
        lat: item.lat,
        lng: item.lng,
        category: item.category,
        google_place_id: item.placeId ?? null,
        rating: null,
        opening_hours: item.openingHours ?? null,
        source,
        last_verified_at: new Date().toISOString(),
      }));
    if (rows.length === 0) return;

    await fetchWithTimeout(`${process.env.SUPABASE_URL}/rest/v1/city_places?on_conflict=dedupe_key`, {
      method: 'POST',
      headers: { ...supabaseHeaders(), Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    });
  } catch (error) {
    console.error('City pool contribution failed (safe to ignore):', error);
  }
}
