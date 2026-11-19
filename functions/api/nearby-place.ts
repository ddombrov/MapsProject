/// <reference types="@cloudflare/workers-types" />
import { installEnv, type Env } from './_env';
import { limitRequest } from './_limits';

interface NearbySearchResult {
  places?: Array<{
    displayName?: { text?: string };
    formattedAddress?: string;
  }>;
}

// Tight-radius nearby search, used when a user drops a pin directly on the map: if the
// pin lands right on a real business/POI we can name it for them, rather than just
// resolving a street address. A wide radius would wrongly attribute a click on an empty
// sidewalk to some unrelated place down the block, so this stays deliberately tight.
const RADIUS_METERS = 40;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  installEnv(env);
  const limited = await limitRequest(env, request, 'nearby-place', 100);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) {
    return Response.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress',
    },
    body: JSON.stringify({
      locationRestriction: { circle: { center: { latitude: Number(lat), longitude: Number(lng) }, radius: RADIUS_METERS } },
      maxResultCount: 1,
      rankPreference: 'DISTANCE',
    }),
  });

  if (!res.ok) {
    return Response.json({ name: null, address: null });
  }

  const data: NearbySearchResult = await res.json();
  const place = data.places?.[0];

  return Response.json({
    name: place?.displayName?.text ?? null,
    address: place?.formattedAddress ?? null,
  });
};
