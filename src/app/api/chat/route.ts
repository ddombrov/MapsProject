import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rateLimit';
import { interpretChatMessage } from '@/lib/chatActions';
import { pickOpeningHours } from '@/lib/openingHours';
import type { RawPlace } from '@/lib/rawPlace';
import type { ChatOp, ItineraryItem } from '@/lib/types';

type SearchPlace = RawPlace & { types?: string[] };

// A search for a spot should never resolve to a whole city or region.
const NON_SPOT_TYPES = new Set([
  'locality',
  'sublocality',
  'administrative_area_level_1',
  'administrative_area_level_2',
  'administrative_area_level_3',
  'country',
  'postal_code',
]);

async function searchPlaces(textQuery: string): Promise<SearchPlace[] | null> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.types,places.regularOpeningHours',
    },
    body: JSON.stringify({ textQuery, pageSize: 6 }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.places ?? [];
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, 'chat', 30);
  if (limited) return limited;

  try {
    const { message, location, days, itinerary } = (await request.json()) as {
      message?: string;
      location?: string;
      days?: number;
      itinerary?: ItineraryItem[];
    };

    if (!message?.trim() || !location || !days) {
      return NextResponse.json({ error: 'message, location, and days are required' }, { status: 400 });
    }

    const items = itinerary ?? [];
    const { actions, reply } = await interpretChatMessage(message.trim(), location, days, items);

    if (actions.length === 0) {
      return NextResponse.json({
        ops: [],
        reply: reply || 'I can add, remove, or swap places — try "swap the pizza place for something vegan".',
      });
    }

    const ops: ChatOp[] = [];
    const notes: string[] = [];
    const touched = new Set<number>();
    const usedNames = new Set(items.map((i) => i.name.toLowerCase()));

    for (const action of actions) {
      if (action.action === 'remove') {
        const target = items[action.targetIndex];
        if (!target || touched.has(action.targetIndex)) {
          notes.push("I couldn't tell which place to remove.");
          continue;
        }
        touched.add(action.targetIndex);
        ops.push({ type: 'remove', index: action.targetIndex });
        notes.push(`Removed "${target.name}".`);
        continue;
      }

      const target = action.action === 'swap' ? items[action.targetIndex] : undefined;
      if (action.action === 'swap' && (!target || touched.has(action.targetIndex))) {
        notes.push("I couldn't tell which place to swap out.");
        continue;
      }

      const places = await searchPlaces(action.searchQuery);
      if (places === null) {
        notes.push("Couldn't search for places right now.");
        continue;
      }

      const place = places.find((p) => {
        const name = p.displayName?.text?.toLowerCase();
        return name
          && p.location?.latitude !== undefined
          && p.location.longitude !== undefined
          && !p.types?.some((t) => NON_SPOT_TYPES.has(t))
          && !usedNames.has(name);
      });

      if (!place) {
        notes.push(`I couldn't find a new place for "${action.searchQuery}".`);
        continue;
      }

      const name = place.displayName!.text!;
      usedNames.add(name.toLowerCase());

      const newItem: ItineraryItem = {
        day: target ? target.day : action.day,
        slot: target ? target.slot : action.slot,
        category: target ? target.category : action.category,
        name,
        address: place.formattedAddress || location,
        lat: place.location!.latitude!,
        lng: place.location!.longitude!,
        notes: target ? 'Swapped in via chat.' : 'Added via chat.',
        openingHours: pickOpeningHours(place),
      };

      if (target) {
        touched.add(action.targetIndex);
        ops.push({ type: 'swap', index: action.targetIndex, item: newItem });
        notes.push(`Swapped "${target.name}" for "${name}".`);
      } else {
        ops.push({ type: 'add', item: newItem });
        notes.push(`Added "${name}" to ${days > 1 ? `Day ${newItem.day} • ` : ""}${newItem.slot}.`);
      }
    }

    return NextResponse.json({ ops, reply: notes.join(' ') });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Failed to process that request.' }, { status: 500 });
  }
}
