export interface EventMention {
  name: string;
  date: string;
  venue: string;
  lat?: number;
  lng?: number;
  segment: string;
}

export function isTicketmasterConfigured(): boolean {
  const key = process.env.TICKETMASTER_API_KEY;
  return Boolean(key && key !== 'your_ticketmaster_api_key');
}

interface TicketmasterVenue {
  name?: string;
  location?: { latitude?: string; longitude?: string };
}

interface TicketmasterEvent {
  name?: string;
  dates?: { start?: { localDate?: string } };
  classifications?: { segment?: { name?: string } }[];
  _embedded?: { venues?: TicketmasterVenue[] };
}

// Ticketmaster Discovery API (free, self-serve key from https://developer.ticketmaster.com/)
// surfaces real dated events — concerts, festivals, sports — that a static Places search
// can't, since those aren't permanent venues so much as time-bound happenings.
// Ticketmaster lists one entry per showing, so results are de-duplicated by name and venue
// before trimming. `failed` is true when the request itself errored (for example a bad or
// expired key), as opposed to a search that legitimately found nothing.
export async function searchEvents(
  location: string,
  startDate: string,
  endDate: string,
): Promise<{ events: EventMention[]; failed: boolean }> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey || !isTicketmasterConfigured()) return { events: [], failed: false };

  const city = location.split(',')[0].trim();
  const params = new URLSearchParams({
    apikey: apiKey,
    city,
    startDateTime: `${startDate}T00:00:00Z`,
    endDateTime: `${endDate}T23:59:59Z`,
    size: '50',
    sort: 'relevance,desc',
  });

  try {
    const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`);
    if (!res.ok) {
      console.error('Ticketmaster error:', res.status, await res.text());
      return { events: [], failed: true };
    }

    const data = (await res.json()) as { _embedded?: { events?: TicketmasterEvent[] } };
    const events: TicketmasterEvent[] = data?._embedded?.events ?? [];

    const seen = new Set<string>();
    const unique = events.filter((e) => {
      const key = `${e.name}|${e._embedded?.venues?.[0]?.name}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const mapped = unique.slice(0, 10).map((e) => {
      const venue = e._embedded?.venues?.[0];
      const lat = venue?.location?.latitude ? Number(venue.location.latitude) : undefined;
      const lng = venue?.location?.longitude ? Number(venue.location.longitude) : undefined;
      return {
        name: e.name ?? '',
        date: e.dates?.start?.localDate ?? '',
        venue: venue?.name ?? '',
        lat,
        lng,
        segment: e.classifications?.[0]?.segment?.name ?? '',
      };
    });
    return { events: mapped, failed: false };
  } catch (error) {
    console.error('Ticketmaster fetch failed:', error);
    return { events: [], failed: true };
  }
}
