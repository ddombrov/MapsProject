import type { ItineraryItem } from './types';

export interface ParsedRow {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  category?: string;
  notes?: string;
  day?: number;
  slot?: ItineraryItem['slot'];
  date?: string;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((s) => s.trim());
}

function matchSlot(value: string | undefined): ItineraryItem['slot'] | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (lower.startsWith('morning')) return 'Morning';
  if (lower.startsWith('afternoon')) return 'Afternoon';
  if (lower.startsWith('evening')) return 'Evening';
  return undefined;
}

// Flexible enough to accept our own Google Maps CSV export, or a hand-built CSV with just
// Name/Address/Category/Notes columns (the shape from manually curating Reddit finds).
export function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const colIndex = (names: string[]) => headers.findIndex((h) => names.includes(h));

  const nameIdx = colIndex(['name']);
  const addressIdx = colIndex(['address']);
  const latIdx = colIndex(['latitude', 'lat']);
  const lngIdx = colIndex(['longitude', 'lng', 'lon']);
  const categoryIdx = colIndex(['category']);
  const notesIdx = colIndex(['notes', 'description']);
  const dayIdx = colIndex(['day']);
  const slotIdx = colIndex(['slot']);

  if (nameIdx === -1) return [];

  return lines
    .slice(1)
    .map((line) => parseCsvLine(line))
    .filter((cols) => cols[nameIdx])
    .map((cols) => ({
      name: cols[nameIdx],
      address: addressIdx >= 0 ? cols[addressIdx] : undefined,
      lat: latIdx >= 0 && cols[latIdx] ? Number(cols[latIdx]) : undefined,
      lng: lngIdx >= 0 && cols[lngIdx] ? Number(cols[lngIdx]) : undefined,
      category: categoryIdx >= 0 ? cols[categoryIdx] : undefined,
      notes: notesIdx >= 0 ? cols[notesIdx] : undefined,
      day: dayIdx >= 0 && cols[dayIdx] ? Number(cols[dayIdx].replace(/[^0-9]/g, '')) || undefined : undefined,
      slot: slotIdx >= 0 ? matchSlot(cols[slotIdx]) : undefined,
    }));
}

export function parseIcal(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const blocks = text.split('BEGIN:VEVENT').slice(1);

  for (const block of blocks) {
    const endIdx = block.indexOf('END:VEVENT');
    const body = endIdx >= 0 ? block.slice(0, endIdx) : block;

    const getField = (key: string) => {
      const match = body.match(new RegExp(`\\n?${key}[^:\\n]*:(.*)`));
      return match ? match[1].trim().replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, ' ') : undefined;
    };

    const name = getField('SUMMARY');
    if (!name) continue;

    const address = getField('LOCATION');
    const notes = getField('DESCRIPTION');
    const dtstart = getField('DTSTART');

    let date: string | undefined;
    let slot: ItineraryItem['slot'] | undefined;
    const dtMatch = dtstart?.match(/(\d{4})(\d{2})(\d{2})T?(\d{2})?/);
    if (dtMatch) {
      date = `${dtMatch[1]}-${dtMatch[2]}-${dtMatch[3]}`;
      const hour = dtMatch[4] ? Number(dtMatch[4]) : undefined;
      if (hour !== undefined) {
        slot = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
      }
    }

    rows.push({ name, address, notes, date, slot });
  }

  return rows;
}

function inferCategory(category: string | undefined, fallbackIndex: number): ItineraryItem['category'] {
  if (category) {
    if (/food|restaurant|cafe|caf[ée]|bar|pub|dinner|lunch|breakfast|bakery|dining|diner/i.test(category)) return 'Food';
    if (/attraction|sight|museum|park|landmark|tour|beach|shop/i.test(category)) return 'Attraction';
  }
  return fallbackIndex % 2 === 0 ? 'Attraction' : 'Food';
}

// Resolves each row into a real ItineraryItem: geocodes any missing coordinates via
// /api/geocode, computes relative day numbers from iCal dates when present, and fills in
// slot/category with reasonable defaults when the source data didn't specify them.
export async function finalizeImportedRows(rows: ParsedRow[]): Promise<ItineraryItem[]> {
  const dated = rows.filter((r) => r.date);
  const minDate = dated.length > 0 ? dated.reduce((min, r) => (r.date! < min ? r.date! : min), dated[0].date!) : null;

  const items: ItineraryItem[] = [];
  const slots: ItineraryItem['slot'][] = ['Morning', 'Afternoon', 'Evening'];
  let index = 0;

  for (const row of rows) {
    let lat = row.lat;
    let lng = row.lng;

    if ((lat === undefined || lng === undefined) && row.address) {
      try {
        const res = await fetch(`/api/geocode?address=${encodeURIComponent(row.address)}`);
        const data = await res.json();
        if (res.ok) {
          lat = data.lat;
          lng = data.lng;
        }
      } catch {
        // Skip geocoding failures — the row is dropped below if we still have no coordinates.
      }
    }

    if (lat === undefined || lng === undefined) continue;

    const day = row.day ?? (row.date && minDate
      ? Math.round((new Date(`${row.date}T00:00:00`).getTime() - new Date(`${minDate}T00:00:00`).getTime()) / 86400000) + 1
      : 1);
    const slot = row.slot ?? slots[index % 3];
    const category = inferCategory(row.category, index);

    items.push({
      day,
      slot,
      category,
      name: row.name,
      address: row.address ?? `${lat}, ${lng}`,
      lat,
      lng,
      notes: row.notes ?? 'Imported.',
    });
    index++;
  }

  return items;
}
