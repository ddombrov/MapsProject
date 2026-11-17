/// <reference types="@cloudflare/workers-types" />
import { installEnv, type Env } from './_env';
import type { ItineraryItem } from '../../src/lib/types';
import { enforceRateLimit } from '../../src/lib/rateLimit';
import { isCityPoolConfigured, cityKeyFor, contributePlaces } from '../../src/lib/cityPool';

// Called when a trip is shared (see openShare in page.tsx), on top of the automatic
// contribution every generation already makes — this is what actually captures a user's own
// custom additions (a dropped pin, a typed address, an imported CSV row), since those never
// go through the itinerary route at all. Always best-effort: never fails the share flow, and
// does nothing if the pool isn't configured.
export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  installEnv(env);

  const limited = enforceRateLimit(request, 'contribute-places', 30);
  if (limited) return limited;

  if (!isCityPoolConfigured()) return Response.json({ ok: true });

  try {
    const body = (await request.json()) as { location?: string; itinerary?: ItineraryItem[] };
    if (body.location && Array.isArray(body.itinerary)) {
      waitUntil(contributePlaces(cityKeyFor(body.location), body.itinerary, 'custom'));
    }
  } catch {
    // Best-effort — a malformed body or a Supabase hiccup shouldn't surface to the user.
  }

  return Response.json({ ok: true });
};
