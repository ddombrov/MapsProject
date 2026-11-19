/// <reference types="@cloudflare/workers-types" />
import { installEnv, type Env } from './_env';
import { translateTexts } from '../../src/lib/translate';
import { limitRequest } from './_limits';

const MAX_TEXTS_PER_REQUEST = 200;

// Backs the language dropdown: the client collects every piece of visible text on the page,
// sends the ones it hasn't already cached, and swaps the DOM text in place once this returns
// — see domTranslate.ts. Never fails the page: on any error this still returns 200 with an
// empty translations array, so an untranslated (English) page is the worst case, not a broken
// one. translateTexts itself is a read-through cache against Supabase — see translate.ts.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  installEnv(env);

  const limited = await limitRequest(env, request, 'translate', 30);
  if (limited) return limited;

  try {
    const body = (await request.json()) as { targetLang?: string; texts?: string[] };
    if (!body.targetLang || typeof body.targetLang !== 'string') {
      return Response.json({ error: 'targetLang (string) is required' }, { status: 400 });
    }
    if (!Array.isArray(body.texts) || body.texts.some((t) => typeof t !== 'string')) {
      return Response.json({ error: 'texts (string[]) is required' }, { status: 400 });
    }
    const texts = body.texts.slice(0, MAX_TEXTS_PER_REQUEST);

    const translations = await translateTexts(texts, body.targetLang);
    return Response.json({ translations });
  } catch (error) {
    console.error('Translate API error:', error);
    return Response.json({ translations: [] }, { status: 200 });
  }
};
