import type { OpeningPeriod } from './types';

export interface RawPlaceReview {
  text?: { text?: string };
}

export interface RawPlace {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  reviews?: RawPlaceReview[];
  regularOpeningHours?: { weekdayDescriptions?: string[]; periods?: OpeningPeriod[] };
}
