import type { ItineraryItem } from './types';

const SCHEMA = {
  type: 'object',
  properties: {
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['add', 'remove', 'swap'] },
          searchQuery: { type: 'string' },
          day: { type: 'integer' },
          slot: { type: 'string', enum: ['Morning', 'Afternoon', 'Evening'] },
          category: { type: 'string', enum: ['Food', 'Attraction'] },
          targetIndex: { type: 'integer' },
        },
        required: ['action', 'searchQuery', 'day', 'slot', 'category', 'targetIndex'],
        additionalProperties: false,
      },
    },
    reply: { type: 'string' },
  },
  required: ['actions', 'reply'],
  additionalProperties: false,
};

export interface ChatAction {
  action: 'add' | 'remove' | 'swap';
  searchQuery: string;
  day: number;
  slot: ItineraryItem['slot'];
  category: ItineraryItem['category'];
  targetIndex: number;
}

export interface ChatInterpretation {
  actions: ChatAction[];
  reply: string;
}

const normalizeName = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// The model occasionally points a remove/swap at the wrong index even when the user named the
// place outright. If the message names a place on the trip, that place is the target — this
// overrides the model's index rather than trusting it with a destructive edit.
function correctTargets(message: string, itinerary: ItineraryItem[], actions: ChatAction[]): ChatAction[] {
  const normalizedMessage = ` ${normalizeName(message)} `;
  const mentioned = itinerary
    .map((item, index) => ({ index, name: normalizeName(item.name).replace(/^the /, '') }))
    .filter((p) => p.name.length >= 3 && normalizedMessage.includes(` ${p.name} `))
    .sort((a, b) => b.name.length - a.name.length)
    .map((p) => p.index);

  const isMentioned = (index: number) => mentioned.includes(index);
  const claimed = new Set(actions.filter((a) => a.action !== 'add' && isMentioned(a.targetIndex)).map((a) => a.targetIndex));

  return actions.map((a) => {
    if (a.action === 'add' || isMentioned(a.targetIndex)) return a;
    const replacement = mentioned.find((index) => !claimed.has(index));
    if (replacement === undefined) return a;
    claimed.add(replacement);
    return { ...a, targetIndex: replacement };
  });
}

// Turns a free-text chat message into concrete add / remove / swap actions against the
// current itinerary. Uses gpt-5-nano (OpenAI's cheapest model) since this is a small,
// low-stakes extraction task rather than full itinerary generation.
export async function interpretChatMessage(
  message: string,
  location: string,
  days: number,
  itinerary: ItineraryItem[],
): Promise<ChatInterpretation> {
  const dayLoad = Array.from({ length: days }, (_, i) => itinerary.filter((it) => it.day === i + 1).length);
  const lightestDay = dayLoad.indexOf(Math.min(...dayLoad)) + 1;

  const listing = itinerary.length
    ? itinerary.map((it, i) => `${i}: Day ${it.day} ${it.slot} ${it.category} — ${it.name}`).join('\n')
    : '(empty)';

  const prompt = `
    A traveler is planning a ${days}-day trip to ${location}. Their current itinerary, one place per line as
    "index: day slot category — name":
    ${listing}

    They just typed this into a chat box: "${message}"

    Turn it into a list of actions. A message may contain several (e.g. "remove the museum and add a bakery").
    - "add": put a new place on the trip. searchQuery is a Google Places text search that finds it, scoped to
      ${location}. Choose day (1 to ${days}), slot (Morning, Afternoon, Evening) and category (Food or Attraction)
      from what they said; if no day is given use day ${lightestDay} (currently the lightest), and if no slot is
      given pick what fits the place (Evening for a bar, Morning for a cafe). targetIndex must be -1.
    - "remove": take an existing place off the trip. targetIndex is the index of the place they mean, matched by
      name or description from the list above. searchQuery must be "", day 0.
    - "swap": replace an existing place with a different one. targetIndex is the index being replaced, and
      searchQuery finds the replacement, scoped to ${location} — use what they asked for (e.g. "vegan restaurant"),
      or the same kind of place as the one being replaced if they didn't say. Copy that place's day, slot and category.
    If a request is unclear, matches no place in the list, or has nothing to do with the itinerary, return no
    actions and put a short helpful question or answer in "reply". When there are actions, "reply" must be "".
  `;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      reasoning_effort: 'low',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_schema', json_schema: { name: 'chat_actions', schema: SCHEMA, strict: true } },
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI request failed: ${await res.text()}`);
  }

  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  const parsed = JSON.parse(data.choices[0].message.content) as ChatInterpretation;

  const actions = (parsed.actions ?? []).map((a) => ({
    ...a,
    day: Math.min(Math.max(a.day || lightestDay, 1), Math.max(days, 1)),
  }));

  return { actions: correctTargets(message, itinerary, actions), reply: parsed.reply ?? '' };
}
