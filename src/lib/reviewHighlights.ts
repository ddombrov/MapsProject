import type { RawPlace } from './rawPlace';

// Pulls real excerpts from the Google Places reviews already fetched for this place,
// matching against the traveler's own preference terms (e.g. "gluten free", "vegan")
// rather than letting the model paraphrase or invent praise that wasn't actually said.
export function findReviewHighlights(
  rawPlaces: RawPlace[],
  itemName: string,
  itemAddress: string,
  preferenceTerms: string[],
  maxHighlights = 2,
): string[] {
  if (preferenceTerms.length === 0) return [];

  const place =
    rawPlaces.find((p) => p.displayName?.text?.toLowerCase() === itemName.toLowerCase()) ??
    rawPlaces.find((p) => p.formattedAddress === itemAddress);

  if (!place?.reviews) return [];

  const lowerTerms = preferenceTerms.map((t) => t.toLowerCase());
  const highlights: string[] = [];

  for (const review of place.reviews) {
    const text = review.text?.text;
    if (!text) continue;
    const lower = text.toLowerCase();
    if (lowerTerms.some((term) => lower.includes(term))) {
      highlights.push(text.length > 220 ? `${text.slice(0, 220)}…` : text);
      if (highlights.length >= maxHighlights) break;
    }
  }

  return highlights;
}
