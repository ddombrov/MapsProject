import type { RawPlace } from './rawPlace';

function placeKey(p: RawPlace): string {
  return `${p.displayName?.text ?? ''}|${p.formattedAddress ?? ''}`.toLowerCase();
}

// Merges two place lists, deduping by name+address — used to combine the separate
// food and attraction searches, which can occasionally return the same place twice.
export function mergePlaces(a: RawPlace[], b: RawPlace[]): RawPlace[] {
  const byKey = new Map<string, RawPlace>();
  for (const p of a) byKey.set(placeKey(p), p);
  for (const p of b) byKey.set(placeKey(p), p);
  return Array.from(byKey.values());
}
