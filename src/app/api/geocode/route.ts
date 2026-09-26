import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rateLimit';

interface GeocodeResult {
  formatted_address: string;
  types: string[];
  geometry: { location: { lat: number; lng: number } };
}

// A precise reverse-geocode of an arbitrary map click can land on a Plus Code or an
// unnamed feature (parks, water, remote areas) instead of a real address. Google's
// response includes several results at different specificity levels for the same point,
// so pick the best city-level one for cases (like choosing a destination) where a Plus
// Code isn't useful.
const LOCALITY_TYPE_PRIORITY = ['locality', 'postal_town', 'administrative_area_level_2', 'administrative_area_level_1', 'country'];

function findLocality(results: GeocodeResult[]): string | null {
  for (const type of LOCALITY_TYPE_PRIORITY) {
    const match = results.find((r) => r.types.includes(type));
    if (match) return match.formatted_address;
  }
  return null;
}

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, 'geocode', 200);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!address && !(lat && lng)) {
    return NextResponse.json({ error: 'address, or lat and lng, are required' }, { status: 400 });
  }

  const query = address ? `address=${encodeURIComponent(address)}` : `latlng=${lat},${lng}`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?${query}&key=${process.env.GOOGLE_PLACES_API_KEY}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' || !data.results?.[0]) {
      if (data.status === 'REQUEST_DENIED') {
        console.error('Geocoding API request denied:', data.error_message);
        return NextResponse.json(
          { error: 'Geocoding API is not enabled for this key — enable it in Google Cloud Console alongside Maps/Places.' },
          { status: 502 },
        );
      }
      return NextResponse.json({ error: 'Could not find that address' }, { status: 404 });
    }

    const result = data.results[0];
    return NextResponse.json({
      formattedAddress: result.formatted_address,
      locality: findLocality(data.results),
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
    });
  } catch (error) {
    console.error('Geocode error:', error);
    return NextResponse.json({ error: 'Failed to geocode address' }, { status: 500 });
  }
}
