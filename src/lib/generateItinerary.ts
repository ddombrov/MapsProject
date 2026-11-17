import { GoogleGenAI, Type } from '@google/genai';

const GEMINI_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      day: { type: Type.INTEGER },
      slot: { type: Type.STRING, enum: ['Morning', 'Afternoon', 'Evening'] },
      category: { type: Type.STRING, enum: ['Food', 'Attraction'] },
      name: { type: Type.STRING },
      address: { type: Type.STRING },
      lat: { type: Type.NUMBER },
      lng: { type: Type.NUMBER },
      notes: { type: Type.STRING },
      redditMentioned: { type: Type.BOOLEAN },
    },
    required: ['day', 'slot', 'category', 'name', 'address', 'lat', 'lng', 'notes', 'redditMentioned'],
  },
};

const OPENAI_SCHEMA = {
  type: 'object',
  properties: {
    itinerary: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          day: { type: 'integer' },
          slot: { type: 'string', enum: ['Morning', 'Afternoon', 'Evening'] },
          category: { type: 'string', enum: ['Food', 'Attraction'] },
          name: { type: 'string' },
          address: { type: 'string' },
          lat: { type: 'number' },
          lng: { type: 'number' },
          notes: { type: 'string' },
          redditMentioned: { type: 'boolean' },
        },
        required: ['day', 'slot', 'category', 'name', 'address', 'lat', 'lng', 'notes', 'redditMentioned'],
        additionalProperties: false,
      },
    },
  },
  required: ['itinerary'],
  additionalProperties: false,
};

interface RawItineraryItem {
  day: number;
  slot: string;
  category: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  notes: string;
  redditMentioned: boolean;
}

async function generateWithGemini(prompt: string): Promise<RawItineraryItem[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: GEMINI_SCHEMA },
  });
  const parsed = JSON.parse(response.text || '[]');
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Gemini returned an empty or invalid itinerary');
  }
  return parsed;
}

async function generateWithOpenAI(prompt: string): Promise<RawItineraryItem[]> {
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
      response_format: { type: 'json_schema', json_schema: { name: 'itinerary_response', schema: OPENAI_SCHEMA, strict: true } },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI request failed: ${errText}`);
  }

  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  const parsed = JSON.parse(data.choices[0].message.content).itinerary;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('OpenAI returned an empty or invalid itinerary');
  }
  return parsed;
}

// Gemini flash-lite is primary: fast (2-5s) and reliable on this prompt with a schema
// constraint. OpenAI (gpt-5-nano, low reasoning) only runs if Gemini fails — it needs
// low reasoning effort to reliably honor exact per-day counts here, which costs 15-25s,
// so it's a fallback for availability, not the default path.
export async function generateItinerary(prompt: string): Promise<{ items: RawItineraryItem[]; provider: 'gemini' | 'openai' }> {
  try {
    return { items: await generateWithGemini(prompt), provider: 'gemini' };
  } catch (geminiError) {
    console.error('Gemini generation failed, falling back to OpenAI:', geminiError);
  }

  return { items: await generateWithOpenAI(prompt), provider: 'openai' };
}
