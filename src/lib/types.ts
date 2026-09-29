export type ItineraryCategory = 'Food' | 'Attraction';

export interface OpeningPeriod {
  open: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
}

// day is 0 = Sunday, matching both Google's format and JS Date.getDay().
export interface OpeningHours {
  periods: OpeningPeriod[];
  weekdayDescriptions: string[];
}

export interface ItineraryItem {
  day: number;
  slot: 'Morning' | 'Afternoon' | 'Evening';
  category: ItineraryCategory;
  name: string;
  address: string;
  lat: number;
  lng: number;
  notes: string;
  redditMentioned?: boolean;
  reviewHighlights?: string[];
  openingHours?: OpeningHours;
  // Google's place ID for this spot, when known — lets the shared city pool re-verify a
  // reused place's hours against Google again later rather than trusting a stale cache.
  placeId?: string;
}

export type ChatOp =
  | { type: 'add'; item: ItineraryItem }
  | { type: 'remove'; index: number }
  | { type: 'swap'; index: number; item: ItineraryItem };

export interface PreferenceTag {
  text: string;
  required: boolean;
}

export interface DayCounts {
  food: number;
  attraction: number;
}

export interface SourceWeights {
  google: number;
  reddit: number;
  ticketmaster: number;
}

export interface SourceConfig {
  reddit: boolean;
  ticketmaster: boolean;
}

export type Budget = 'No preference' | 'Budget' | 'Mid-range' | 'Luxury';
export type TravelParty = 'No preference' | 'Solo' | 'Couple' | 'Family' | 'Friends group';
export type Pace = 'No preference' | 'Relaxed' | 'Balanced' | 'Packed';
export type Transportation = 'No preference' | 'Walking / Transit' | 'Car';

export interface ItineraryRequest {
  location: string;
  days: number;
  startDate?: string;
  perDayCounts: DayCounts[];
  preferences: PreferenceTag[];
  budget: Budget;
  travelParty: TravelParty;
  pace: Pace;
  transportation: Transportation;
  sourceWeights: SourceWeights;
  hiddenGemMode: boolean;
  optimizeRoutes: boolean;
  // Set when only this category is being regenerated (the other's counts are zeroed).
  regenerateScope?: ItineraryCategory;
}
