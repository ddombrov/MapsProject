import type { ItineraryItem } from './types';

export interface SharedTripData {
  location: string;
  days: number;
  startDate?: string;
  itinerary: ItineraryItem[];
}

// The view state a link restores. It always mirrors what the user is looking at right now,
// so there's nothing to configure — the address bar is the share link.
export interface ShareOptions {
  view: 'map' | 'calendar' | 'table';
  day: number | null; // null = all days
  routes: boolean;
  calendar: 'day' | 'week' | 'month';
}

// Only non-default options are written, to keep the link as short as possible.
// The trip payload is base64url, so & and = can never appear inside it.
export function buildShareHash(encodedTrip: string, options: ShareOptions): string {
  const parts = [`trip=${encodedTrip}`];
  if (options.view !== 'map') parts.push(`view=${options.view}`);
  if (options.day !== null) parts.push(`day=${options.day}`);
  if (options.routes) parts.push('routes=1');
  if (options.view === 'calendar' && options.calendar !== 'month') parts.push(`cal=${options.calendar}`);
  return `#${parts.join('&')}`;
}

export function parseShareHash(hash: string): { trip: string; options: ShareOptions } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const trip = params.get('trip');
  if (!trip) return null;

  const view = params.get('view');
  const day = Number(params.get('day'));
  const cal = params.get('cal');
  return {
    trip,
    options: {
      view: view === 'calendar' || view === 'table' ? view : 'map',
      day: Number.isInteger(day) && day >= 1 ? day : null,
      routes: params.get('routes') === '1',
      calendar: cal === 'day' || cal === 'week' ? cal : 'month',
    },
  };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// The whole trip lives in the URL (gzip, then base64url) — no server or storage involved.
// Review quotes are dropped since they're long and not needed to rebuild the trip.
export async function encodeTrip(trip: SharedTripData): Promise<string> {
  const slim: SharedTripData = {
    ...trip,
    itinerary: trip.itinerary.map((item) => ({ ...item, reviewHighlights: undefined })),
  };
  const stream = new Blob([JSON.stringify(slim)]).stream().pipeThrough(new CompressionStream('gzip'));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return toBase64Url(compressed);
}

export async function decodeTrip(encoded: string): Promise<SharedTripData | null> {
  try {
    const stream = new Blob([fromBase64Url(encoded)]).stream().pipeThrough(new DecompressionStream('gzip'));
    const parsed = JSON.parse(await new Response(stream).text());

    const validItems = Array.isArray(parsed?.itinerary)
      && parsed.itinerary.every(
        (i: ItineraryItem) => typeof i?.name === 'string' && typeof i.lat === 'number' && typeof i.lng === 'number'
          && typeof i.day === 'number' && typeof i.slot === 'string' && typeof i.category === 'string',
      );
    if (!validItems || typeof parsed.location !== 'string' || typeof parsed.days !== 'number') return null;

    return parsed as SharedTripData;
  } catch {
    return null;
  }
}
