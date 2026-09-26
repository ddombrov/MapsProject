import type { RawPlace } from './rawPlace';

export type PlaceWithEvidence = RawPlace & { reviewEvidence?: string[] };

// This is the deterministic version of what a traveler manually does when scanning reviews
// for "gluten free" or "vegan" mentions before picking a restaurant: scan every review for
// each preference term up front and attach the matches to the place, so the model has a
// real, grounded signal to prefer places with confirmed evidence — rather than picking a
// place first and only checking reviews afterward to decorate the result.
export function annotateReviewEvidence(places: RawPlace[], terms: string[]): PlaceWithEvidence[] {
  if (terms.length === 0) return places;
  const lowerTerms = terms.map((t) => t.toLowerCase());

  return places.map((place) => {
    if (!place.reviews) return place;

    const matched = new Set<string>();
    for (const review of place.reviews) {
      const text = review.text?.text?.toLowerCase();
      if (!text) continue;
      lowerTerms.forEach((lowerTerm, i) => {
        if (text.includes(lowerTerm)) matched.add(terms[i]);
      });
    }

    return matched.size > 0 ? { ...place, reviewEvidence: Array.from(matched) } : place;
  });
}
