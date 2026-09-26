import { useEffect, useRef, useState } from 'react';
import type { RouteLeg, TravelMode } from './travel';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DayRoute {
  path: LatLng[];
  legs: RouteLeg[];
}

const routeKey = (mode: TravelMode, path: LatLng[]) => `${mode}:${path.map((p) => `${p.lat},${p.lng}`).join('|')}`;

// Fetches the real road (or walking) route for each day once and caches it by its stops,
// so a day is only re-requested when its own stops change — not on every render, and not
// when some other day is edited. Feeds both the travel times and the drawn route.
export function useDayRoutes(days: { day: number; path: LatLng[] }[], mode: TravelMode): Record<number, DayRoute> {
  const [cache, setCache] = useState<Record<string, DayRoute>>({});
  const requested = useRef(new Set<string>());

  const signature = days.map((d) => routeKey(mode, d.path)).join('||');

  useEffect(() => {
    for (const { path } of days) {
      const key = routeKey(mode, path);
      if (path.length < 2 || requested.current.has(key)) continue;
      requested.current.add(key);

      fetch('/api/directions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waypoints: path, mode }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.path) setCache((prev) => ({ ...prev, [key]: { path: data.path, legs: data.legs ?? [] } }));
          else requested.current.delete(key);
        })
        .catch(() => requested.current.delete(key));
    }
    // `signature` stands in for `days`, whose array identity changes on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const result: Record<number, DayRoute> = {};
  for (const { day, path } of days) {
    const route = cache[routeKey(mode, path)];
    if (route) result[day] = route;
  }
  return result;
}
