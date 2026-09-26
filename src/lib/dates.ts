// A Date's local calendar day as YYYY-MM-DD. (toISOString converts to UTC first, which moves
// the day back by one for anyone east of UTC — Europe, Asia, Australia — so it can't be used.)
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

export function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diffDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  return Math.max(1, diffDays);
}

export interface CalendarCell {
  iso: string;
  dayOfMonth: number;
  monthLabel: string;
  weekdayShort: string;
  tripDay: number | null;
  inMonth?: boolean;
}

// Builds full Sun–Sat week rows spanning the trip's date range, like a Google Calendar
// week view, including the padding days from adjacent weeks (tripDay: null for those).
export function buildCalendarWeeks(startDate: string, days: number): CalendarCell[][] {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + days - 1);

  const gridStart = new Date(start);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const gridEnd = new Date(end);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  const weeks: CalendarCell[][] = [];
  const cursor = new Date(gridStart);

  while (cursor <= gridEnd) {
    const week: CalendarCell[] = [];
    for (let i = 0; i < 7; i++) {
      const inRange = cursor >= start && cursor <= end;
      const tripDay = inRange ? Math.round((cursor.getTime() - start.getTime()) / 86400000) + 1 : null;
      week.push({
        iso: toDateStr(cursor),
        dayOfMonth: cursor.getDate(),
        monthLabel: cursor.toLocaleDateString('en-US', { month: 'short' }),
        weekdayShort: cursor.toLocaleDateString('en-US', { weekday: 'short' }),
        tripDay,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

// A single row of exactly `days` cells starting at the trip's real start date, with no
// Sun–Sat padding. Used for short trips (<=7 days) so the Week view shows the whole trip
// as one page instead of splitting it across two real-calendar-week rows.
export function buildTripDayRow(startDate: string, days: number): CalendarCell[] {
  const start = new Date(`${startDate}T00:00:00`);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return {
      iso: toDateStr(d),
      dayOfMonth: d.getDate(),
      monthLabel: d.toLocaleDateString('en-US', { month: 'short' }),
      weekdayShort: d.toLocaleDateString('en-US', { weekday: 'short' }),
      tripDay: i + 1,
    };
  });
}

// The longest trip the planner supports. Used by the form, the API, and to stop calendar
// cells past it from being offered as days.
export const MAX_TRIP_DAYS = 7;

// A genuine, freely-navigable calendar month (with adjacent-month padding). With a trip start
// date, each cell also gets its trip day number (including days past the trip's current end,
// up to the maximum, so they can receive dropped or added places); without one, it's a plain
// month used for picking a date before a trip exists yet.
export function buildMonthWeeks(year: number, month: number, tripStart?: string): CalendarCell[][] {
  const start = tripStart ? new Date(`${tripStart}T00:00:00`) : null;
  const gridStart = new Date(year, month, 1);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const lastOfMonth = new Date(year, month + 1, 0);
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  const weeks: CalendarCell[][] = [];
  const cursor = new Date(gridStart);

  while (cursor <= gridEnd) {
    const week: CalendarCell[] = [];
    for (let i = 0; i < 7; i++) {
      const tripDay = start ? Math.round((cursor.getTime() - start.getTime()) / 86400000) + 1 : null;
      week.push({
        iso: toDateStr(cursor),
        dayOfMonth: cursor.getDate(),
        monthLabel: cursor.toLocaleDateString('en-US', { month: 'short' }),
        weekdayShort: cursor.toLocaleDateString('en-US', { weekday: 'short' }),
        tripDay: tripDay !== null && tripDay >= 1 && tripDay <= MAX_TRIP_DAYS ? tripDay : null,
        inMonth: cursor.getMonth() === month,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

export function buildDayList(days: number, startDate?: string): string[] {
  if (!startDate) {
    return Array.from({ length: days }, (_, i) => `Day ${i + 1}`);
  }
  const start = new Date(`${startDate}T00:00:00`);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const iso = toDateStr(d);
    const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
    return `Day ${i + 1}: ${iso} (${weekday})`;
  });
}

// "Fri, Oct 9" for a trip day, given the trip's start date.
export function formatTripDate(startDate: string, day: number): string {
  return new Date(`${addDays(startDate, day - 1)}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
