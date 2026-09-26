export type TravelMode = 'DRIVE' | 'WALK';

export interface RouteLeg {
  durationSeconds: number;
  distanceMeters: number;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

// Google Maps URLs accept at most 9 waypoints between origin and destination, so a day
// with more stops than that is cut off at the 11th.
const MAX_MAPS_STOPS = 11;

export function googleMapsDayUrl(stops: { lat: number; lng: number }[], mode: TravelMode): string | null {
  if (stops.length === 0) return null;
  const point = (p: { lat: number; lng: number }) => `${p.lat},${p.lng}`;

  // A single stop has no route to draw, so just open that place.
  if (stops.length === 1) return `https://www.google.com/maps/search/?api=1&query=${point(stops[0])}`;

  const used = stops.slice(0, MAX_MAPS_STOPS);

  const params = new URLSearchParams({
    api: '1',
    origin: point(used[0]),
    destination: point(used[used.length - 1]),
    travelmode: mode === 'WALK' ? 'walking' : 'driving',
  });
  if (used.length > 2) params.set('waypoints', used.slice(1, -1).map(point).join('|'));

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
