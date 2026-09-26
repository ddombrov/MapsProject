import type { ItineraryItem } from './types';

function csvField(value: string | number): string {
  const str = String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const content = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Google My Maps imports a CSV of Name/Address/Latitude/Longitude directly as pins, and can
// style pins by any text column ("Style by data column") — Day is included so pins can be
// colored per day like the map in this app, and Category to tell food from attractions.
export function exportMapsCsv(itinerary: ItineraryItem[], location: string) {
  if (itinerary.length === 0) return;

  const headers = ['Name', 'Address', 'Latitude', 'Longitude', 'Day', 'Slot', 'Category', 'Notes'];
  const rows = itinerary.map((item) => [
    csvField(item.name),
    csvField(item.address),
    csvField(item.lat),
    csvField(item.lng),
    csvField(`Day ${item.day}`),
    csvField(item.slot),
    csvField(item.category),
    csvField(item.notes),
  ]);

  downloadCsv(`${location.toLowerCase().replace(/[^a-z0-9]/g, '_')}_maps_import.csv`, [headers, ...rows]);
}
