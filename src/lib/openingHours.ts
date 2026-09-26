import { addDays } from './dates';
import type { ItineraryItem, OpeningHours } from './types';
import type { RawPlace } from './rawPlace';

const MINUTES_PER_DAY = 1440;
const MINUTES_PER_WEEK = MINUTES_PER_DAY * 7;

// Rough windows for what each slot means, in minutes since midnight.
const SLOT_WINDOWS: Record<ItineraryItem['slot'], [number, number]> = {
  Morning: [8 * 60, 12 * 60],
  Afternoon: [12 * 60, 17 * 60],
  Evening: [17 * 60, 22 * 60],
};

export function pickOpeningHours(place: RawPlace | undefined): OpeningHours | undefined {
  const hours = place?.regularOpeningHours;
  if (!hours?.periods || hours.periods.length === 0) return undefined;
  return { periods: hours.periods, weekdayDescriptions: hours.weekdayDescriptions ?? [] };
}

// Same name-then-address matching used to attach review highlights.
export function findOpeningHours(rawPlaces: RawPlace[], name: string, address: string): OpeningHours | undefined {
  const place =
    rawPlaces.find((p) => p.displayName?.text?.toLowerCase() === name.toLowerCase()) ??
    rawPlaces.find((p) => p.formattedAddress === address);
  return pickOpeningHours(place);
}

function isOpenDuring(hours: OpeningHours, weekday: number, from: number, to: number): boolean {
  const windowStart = weekday * MINUTES_PER_DAY + from;
  const windowEnd = weekday * MINUTES_PER_DAY + to;

  return hours.periods.some((period) => {
    if (!period.close) return true; // open 24/7
    const start = period.open.day * MINUTES_PER_DAY + period.open.hour * 60 + period.open.minute;
    let end = period.close.day * MINUTES_PER_DAY + period.close.hour * 60 + period.close.minute;
    if (end <= start) end += MINUTES_PER_WEEK; // runs past Saturday night into the next week

    // Also test the window one week later, to catch periods that wrapped past the week's end.
    return [0, MINUTES_PER_WEEK].some((shift) => start < windowEnd + shift && end > windowStart + shift);
  });
}

export interface HoursNote {
  dayText: string;
  warning: string | null;
}

// What the place's hours say for the day this item is scheduled on, and whether the
// item's slot falls outside them. Needs a real start date to know the weekday.
export function hoursNoteForItem(item: ItineraryItem, startDate: string | undefined): HoursNote | null {
  if (!item.openingHours || !startDate) return null;

  const date = new Date(`${addDays(startDate, item.day - 1)}T00:00:00`);
  const weekday = date.getDay();
  const weekdayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  // weekdayDescriptions is ordered Monday to Sunday.
  const dayText = (item.openingHours.weekdayDescriptions[(weekday + 6) % 7] ?? '').replace(/[  ]/g, ' ');

  let warning: string | null = null;
  if (!isOpenDuring(item.openingHours, weekday, 0, MINUTES_PER_DAY)) {
    warning = `Closed on ${weekdayName}s`;
  } else {
    const [from, to] = SLOT_WINDOWS[item.slot];
    if (!isOpenDuring(item.openingHours, weekday, from, to)) {
      warning = `Likely closed in the ${item.slot.toLowerCase()}`;
    }
  }

  return { dayText, warning };
}
