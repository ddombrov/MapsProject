import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rateLimit';
import { decodePolyline } from '@/lib/polyline';

interface LatLng {
  lat: number;
  lng: number;
}

const toWaypoint = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, 'directions', 300);
  if (limited) return limited;

  try {
    const { waypoints, mode } = (await request.json()) as { waypoints?: LatLng[]; mode?: 'DRIVE' | 'WALK' };

    if (!waypoints || waypoints.length < 2) {
      return NextResponse.json({ error: 'At least 2 waypoints are required' }, { status: 400 });
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
      return NextResponse.json({ error: 'Could not compute route' }, { status: 502 });
    }

    const data = await res.json();
    const encoded = data.routes?.[0]?.polyline?.encodedPolyline;

    if (!encoded) {
      return NextResponse.json({ error: 'No route found between these stops' }, { status: 404 });
    }

    // One leg per hop between consecutive waypoints; duration comes back like "743s".
    const legs = (data.routes[0].legs ?? []).map((leg: { duration?: string; distanceMeters?: number }) => ({
      durationSeconds: parseInt(leg.duration ?? '0', 10),
      distanceMeters: leg.distanceMeters ?? 0,
    }));

    return NextResponse.json({ path: decodePolyline(encoded), legs });
  } catch (error) {
    console.error('Directions error:', error);
    return NextResponse.json({ error: 'Failed to compute route' }, { status: 500 });
  }
}
