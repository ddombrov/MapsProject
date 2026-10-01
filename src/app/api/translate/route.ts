import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rateLimit';
import { translateTexts } from '@/lib/translate';

const MAX_TEXTS_PER_REQUEST = 200;

// Backs the language dropdown: the client collects every piece of visible text on the page,
// sends the ones it hasn't already cached, and swaps the DOM text in place once this returns
// — see domTranslate.ts. Never fails the page: on any error this still returns 200 with the
// original strings, so an untranslated (English) page is the worst case, not a broken one.
export async function POST(request: Request) {
  const limited = enforceRateLimit(request, 'translate', 30);
  if (limited) return limited;

  try {
    const body = (await request.json()) as { targetLang?: string; texts?: string[] };
    if (!body.targetLang || typeof body.targetLang !== 'string') {
      return NextResponse.json({ error: 'targetLang (string) is required' }, { status: 400 });
    }
    if (!Array.isArray(body.texts) || body.texts.some((t) => typeof t !== 'string')) {
      return NextResponse.json({ error: 'texts (string[]) is required' }, { status: 400 });
    }
    const texts = body.texts.slice(0, MAX_TEXTS_PER_REQUEST);

    const translations = await translateTexts(texts, body.targetLang);
    return NextResponse.json({ translations });
  } catch (error) {
    console.error('Translate API error:', error);
    return NextResponse.json({ translations: [] }, { status: 200 });
  }
}
