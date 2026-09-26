import type { ItineraryItem } from './types';

// One emoji per category, used everywhere a place is shown (map pins, list, table).
const CATEGORY_EMOJI: Record<ItineraryItem['category'], string> = {
  Food: '🍴',
  Attraction: '🎡',
};

export function getSpotEmoji(item: ItineraryItem): string {
  return CATEGORY_EMOJI[item.category];
}
