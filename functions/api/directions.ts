/// <reference types="@cloudflare/workers-types" />
import { installEnv, type Env } from './_env';
import { limitRequest } from './_limits';
import { decodePolyline } from '../../src/lib/polyline';

interface LatLng {
  lat: number;
  lng: number;
}

const toWaypoint = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  installEnv(env);
  const limited = await limitRequest(env, request, 'directions', 300);
  if (limited) return limited;

  try {
    const { waypoints, mode } = (await request.json()) as { waypoints?: LatLng[]; mode?: 'DRIVE' | 'WALK' };

    if (!waypoints || waypoints.length < 2) {
      return Response.json({ error: 'At least 2 waypoints are required' }, { status: 400 });
    }

    const origin = waypoints[0];
    const destination = waypoints[waypoints.length - 1];
    const intermediates = waypoints.slice(1, -1);

    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
        'X-Goog-FieldMask': 'routes.polyline.encodedPolyline,routes.legs.duration,routes.legs.distanceMeters',
      },
      body: JSON.stringify({
        origin: toWaypoint(origin),
        destination: toWaypoint(destination),
        intermediates: intermediates.map(toWaypoint),
        travelMode: mode === 'WALK' ? 'WALK' : 'DRIVE',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Routes API error:', errText);
      return Response.json({ error: 'Could not compute route' }, { status: 502 });
    }

    const data = (await res.json()) as any;
    const encoded = data.routes?.[0]?.polyline?.encodedPolyline;

    if (!encoded) {
      return Response.json({ error: 'No route found between these stops' }, { status: 404 });
    }

    // One leg per hop between consecutive waypoints; duration comes back like "743s".
    const legs = (data.routes[0].legs ?? []).map((leg: { duration?: string; distanceMeters?: number }) => ({
      durationSeconds: parseInt(leg.duration ?? '0', 10),
      distanceMeters: leg.distanceMeters ?? 0,
    }));

    return Response.json({ path: decodePolyline(encoded), legs });
  } catch (error) {
    console.error('Directions error:', error);
    return Response.json({ error: 'Failed to compute route' }, { status: 500 });
  }
};
