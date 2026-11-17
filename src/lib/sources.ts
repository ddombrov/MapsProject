import type { ItineraryItem } from './types';

export function sourcesForItem(item: ItineraryItem): string {
  const sources = ['Google Places'];
  if (item.reviewHighlights && item.reviewHighlights.length > 0) sources.push('Google Reviews');
  if (item.redditMentioned) sources.push('Reddit');
  return sources.join(', ');
}
