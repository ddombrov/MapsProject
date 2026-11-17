/// <reference types="@cloudflare/workers-types" />
import { installEnv, type Env } from './_env';
import { enforceRateLimit } from '../../src/lib/rateLimit';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  installEnv(env);
  const limited = enforceRateLimit(request, 'autocomplete', 400);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const input = searchParams.get('input');

  if (!input || input.trim().length < 2) {
    return Response.json({ suggestions: [] });
  }

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
      },
      body: JSON.stringify({ input }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Autocomplete API error:', errText);
      return Response.json({ suggestions: [] });
    }

    const data = (await res.json()) as any;
    const suggestions = (data.suggestions || [])
      .map((s: { placePrediction?: { text?: { text?: string } } }) => s.placePrediction?.text?.text)
      .filter((text: string | undefined): text is string => Boolean(text));

    return Response.json({ suggestions });
  } catch (error) {
    console.error('Autocomplete fetch failed:', error);
    return Response.json({ suggestions: [] });
  }
};
