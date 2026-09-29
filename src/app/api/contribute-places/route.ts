import { NextResponse } from 'next/server';
import type { ItineraryItem } from '@/lib/types';
import { enforceRateLimit } from '@/lib/rateLimit';
import { isCityPoolConfigured, cityKeyFor, contributePlaces } from '@/lib/cityPool';

// Called when a trip is shared (see openShare in page.tsx), on top of the automatic
// contribution every generation already makes — this is what actually captures a user's own
// custom additions (a dropped pin, a typed address, an imported CSV row), since those never
// go through the itinerary route at all. Always best-effort: never fails the share flow, and
// does nothing if the pool isn't configured.
export async function POST(request: Request) {
  const limited = enforceRateLimit(request, 'contribute-places', 30);
  if (limited) return limited;

  if (!isCityPoolConfigured()) return NextResponse.json({ ok: true });

  try {
    const body = (await request.json()) as { location?: string; itinerary?: ItineraryItem[] };
    if (!body.location || !Array.isArray(body.itinerary)) {
      return NextResponse.json({ ok: true });
    }
    await contributePlaces(cityKeyFor(body.location), body.itinerary, 'custom');
  } catch {
    // Best-effort — a malformed body or a Supabase hiccup shouldn't surface to the user.
  }

  return NextResponse.json({ ok: true });
}
