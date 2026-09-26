import type { ItineraryItem } from './types';
import type { RawPlace } from './rawPlace';

function placeKey(name: string, address: string): string {
  return `${name}|${address}`.toLowerCase();
}

function rawKey(p: RawPlace): string {
  return placeKey(p.displayName?.text ?? '', p.formattedAddress ?? '');
}

// The model's own instructions ask it not to repeat or invent places, but nothing
// guarantees that at scale (especially at low reasoning effort). This deterministically
// verifies every item against the real candidate pool and swaps out anything fabricated
// or reused for a genuine unused place of the same category — the actual correctness
// guarantee, with the prompt instructions only there to reduce how often it's needed.
export function repairItinerary(
  itinerary: ItineraryItem[],
  foodPool: RawPlace[],
  attractionPool: RawPlace[],
): { itinerary: ItineraryItem[]; hadUnresolvable: boolean } {
  const realKeys = new Set([...foodPool, ...attractionPool].map(rawKey));
  const available: Record<ItineraryItem['category'], RawPlace[]> = {
    Food: [...foodPool],
    Attraction: [...attractionPool],
  };
  const usedKeys = new Set<string>();
  let hadUnresolvable = false;

  const removeFromPool = (category: ItineraryItem['category'], key: string) => {
    available[category] = available[category].filter((p) => rawKey(p) !== key);
  };

  const repaired = itinerary.map((item) => {
    const key = placeKey(item.name, item.address);
    const isReal = realKeys.has(key);
    const isDuplicate = usedKeys.has(key);

    if (isReal && !isDuplicate) {
      usedKeys.add(key);
      removeFromPool(item.category, key);
      return item;
    }

    const replacement = available[item.category][0];
    if (!replacement) {
      hadUnresolvable = true;
      usedKeys.add(key);
      return item;
    }

    const newKey = rawKey(replacement);
    usedKeys.add(newKey);
    removeFromPool(item.category, newKey);

    return {
      ...item,
      name: replacement.displayName?.text ?? item.name,
      address: replacement.formattedAddress ?? item.address,
      lat: replacement.location?.latitude ?? item.lat,
      lng: replacement.location?.longitude ?? item.lng,
      notes: `Recommended ${item.category.toLowerCase()} spot for Day ${item.day}.`,
    };
  });

  return { itinerary: repaired, hadUnresolvable };
}
