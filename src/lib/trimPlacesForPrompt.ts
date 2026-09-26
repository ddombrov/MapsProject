import type { RawPlace } from './rawPlace';

const MAX_REVIEWS_PER_PLACE = 2;
const MAX_REVIEW_LENGTH = 200;

// The full review text (often several long reviews per place) is only needed for our own
// findReviewHighlights matching against the untrimmed data — the model itself just needs
// enough review context to write an informed note, not the whole thing. Trimming what gets
// embedded in the prompt cuts token usage without losing anything the model actually uses.
export function trimPlacesForPrompt(places: RawPlace[]): RawPlace[] {
  return places.map((p) => ({
    ...p,
    // The structured periods are for our own open/closed checks; the model only needs the text.
    regularOpeningHours: p.regularOpeningHours
      ? { weekdayDescriptions: p.regularOpeningHours.weekdayDescriptions }
      : undefined,
    reviews: p.reviews
      ?.slice(0, MAX_REVIEWS_PER_PLACE)
      .map((r) => ({
        text: { text: r.text?.text ? r.text.text.slice(0, MAX_REVIEW_LENGTH) : undefined },
      })),
  }));
}
