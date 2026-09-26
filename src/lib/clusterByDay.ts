import type { ItineraryItem } from './types';

interface LatLng {
  lat: number;
  lng: number;
}

function centroid(items: LatLng[]): LatLng {
  const lat = items.reduce((sum, i) => sum + i.lat, 0) / items.length;
  const lng = items.reduce((sum, i) => sum + i.lng, 0) / items.length;
  return { lat, lng };
}

function dist2(a: LatLng, b: LatLng): number {
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return dLat * dLat + dLng * dLng;
}

// A bounded 2-opt-style local search: repeatedly swaps which day two same-category spots
// are assigned to (never their slot or count) whenever doing so reduces both spots'
// distance to their day's centroid. Swapping same-category items 1-for-1 always preserves
// each day's exact Food/Attraction quota, so this can never violate what the model and
// repair pass already guaranteed — it only tightens geographic grouping within that.
export function clusterByDay(items: ItineraryItem[]): ItineraryItem[] {
  const result = items.map((i) => ({ ...i }));
  const days = Array.from(new Set(result.map((i) => i.day)));
  if (days.length <= 1) return result;

  const categories: ItineraryItem['category'][] = ['Food', 'Attraction'];
  let improved = true;
  let iterations = 0;

  while (improved && iterations < 20) {
    improved = false;
    iterations++;

    const dayCentroids = new Map<number, LatLng>();
    for (const day of days) {
      const dayItems = result.filter((i) => i.day === day);
      if (dayItems.length > 0) dayCentroids.set(day, centroid(dayItems));
    }

    for (const category of categories) {
      const catItems = result.filter((i) => i.category === category);
      for (let a = 0; a < catItems.length; a++) {
        for (let b = a + 1; b < catItems.length; b++) {
          const itemA = catItems[a];
          const itemB = catItems[b];
          if (itemA.day === itemB.day) continue;

          const centroidA = dayCentroids.get(itemA.day);
          const centroidB = dayCentroids.get(itemB.day);
          if (!centroidA || !centroidB) continue;

          const currentCost = dist2(itemA, centroidA) + dist2(itemB, centroidB);
          const swappedCost = dist2(itemA, centroidB) + dist2(itemB, centroidA);

          if (swappedCost < currentCost - 1e-9) {
            const tmp = itemA.day;
            itemA.day = itemB.day;
            itemB.day = tmp;
            improved = true;
          }
        }
      }
    }
  }

  return result;
}
