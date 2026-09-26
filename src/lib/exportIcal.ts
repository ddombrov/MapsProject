import type { ItineraryItem } from './types';

const SLOT_TIMES: Record<ItineraryItem['slot'], [string, string]> = {
  Morning: ['090000', '110000'],
  Afternoon: ['130000', '150000'],
  Evening: ['180000', '200000'],
};

function icsDate(anchorDate: string, dayOffset: number): string {
  const d = new Date(`${anchorDate}T00:00:00`);
  d.setDate(d.getDate() + dayOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// Slot names don't carry real times, so each is mapped to a representative 2-hour block
// (Morning 9-11, Afternoon 1-3pm, Evening 6-8pm) using floating local time — fine for a
// travel itinerary someone is importing into whatever calendar they'll actually be using
// on the trip, rather than trying to resolve the destination's real timezone.
export function exportIcal(itinerary: ItineraryItem[], anchorDate: string, location: string) {
  if (itinerary.length === 0) return;

  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AI Itinerary Planner//EN'];

  itinerary.forEach((item, idx) => {
    const dateStr = icsDate(anchorDate, item.day - 1);
    const [startTime, endTime] = SLOT_TIMES[item.slot];
    lines.push(
      'BEGIN:VEVENT',
      `UID:${dateStr}-${idx}-${Date.now()}@ai-itinerary-planner`,
      `DTSTART:${dateStr}T${startTime}`,
      `DTEND:${dateStr}T${endTime}`,
      `SUMMARY:${escapeIcsText(item.name)}`,
      `LOCATION:${escapeIcsText(item.address)}`,
      `DESCRIPTION:${escapeIcsText(item.notes)}`,
      'END:VEVENT',
    );
  });

  lines.push('END:VCALENDAR');

  const content = lines.join('\r\n');
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${location.toLowerCase().replace(/[^a-z0-9]/g, '_')}_itinerary.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
