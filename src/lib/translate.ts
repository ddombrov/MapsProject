import { GoogleGenAI, Type } from '@google/genai';

// Backs the language dropdown. Translating with an LLM on every single visit would be the
// wasteful way to do this — real sites translate static UI text once and reuse it. Since most
// of what's on this page (buttons, labels, headers) is the same for every visitor, results are
// cached in Supabase keyed by (language, source text): the first person to pick a language
// pays the (tiny) cost of translating the UI strings, and every visitor after that — anyone,
// any browser, forever, until the UI text itself changes — gets them back instantly for free.
// See translate/route.ts for the read-through cache; this file is just the actual translation
// call, used only on a genuine cache miss.

const REQUEST_TIMEOUT_MS = 4000;
const GEMINI_SCHEMA = { type: Type.ARRAY, items: { type: Type.STRING } };

function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseHeaders(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// PostgREST's `in.()` filter needs comma- or parenthesis-containing values double-quoted,
// with internal double-quotes doubled — this is the one bit of the query that isn't just
// plain encodeURIComponent.
function pgInList(values: string[]): string {
  return values
    .map((v) => (/[,()"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v))
    .join(',');
}

// Looks up whichever of these strings this language already has a cached translation for.
async function readCached(lang: string, texts: string[]): Promise<Record<string, string>> {
  if (!isSupabaseConfigured() || texts.length === 0) return {};
  try {
    const url = `${process.env.SUPABASE_URL}/rest/v1/ui_translations?lang=eq.${encodeURIComponent(lang)}&source_text=in.(${encodeURIComponent(pgInList(texts))})&select=source_text,translated_text`;
    const res = await fetchWithTimeout(url, { headers: supabaseHeaders() });
    if (!res.ok) return {};
    const rows = (await res.json()) as { source_text: string; translated_text: string }[];
    return Object.fromEntries(rows.map((r) => [r.source_text, r.translated_text]));
  } catch (error) {
    console.error('Translation cache read failed (continuing without it):', error);
    return {};
  }
}

// Fire-and-forget from the caller's point of view — a failed write just means this string
// gets translated again (at the same small cost) next time someone requests it.
async function writeCached(lang: string, pairs: Record<string, string>): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const rows = Object.entries(pairs).map(([source_text, translated_text]) => ({ lang, source_text, translated_text }));
  if (rows.length === 0) return;
  try {
    await fetchWithTimeout(`${process.env.SUPABASE_URL}/rest/v1/ui_translations?on_conflict=lang,source_text`, {
      method: 'POST',
      headers: { ...supabaseHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    });
  } catch (error) {
    console.error('Translation cache write failed (safe to ignore):', error);
  }
}

async function translateWithGemini(texts: string[], targetLang: string): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: `Translate each string in this JSON array into the language with code "${targetLang}". Return a JSON
      array of exactly the same length, in the same order, one translation per input string. Keep placeholders,
      numbers, and punctuation style natural for the target language. Do not add commentary, only the array.
      Input: ${JSON.stringify(texts)}`,
    config: { responseMimeType: 'application/json', responseSchema: GEMINI_SCHEMA },
  });
  const parsed = JSON.parse(response.text || '[]');
  if (!Array.isArray(parsed) || parsed.length !== texts.length) {
    throw new Error(`Gemini returned ${Array.isArray(parsed) ? parsed.length : 'non-array'}, expected ${texts.length}`);
  }
  return parsed;
}

async function translateWithOpenAI(texts: string[], targetLang: string): Promise<string[]> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      reasoning_effort: 'low',
      messages: [
        {
          role: 'user',
          content: `Translate each string in this JSON array into the language with code "${targetLang}". Return a
            JSON object {"translations": [...]} with exactly the same length and order as the input, one
            translation per input string. Input: ${JSON.stringify(texts)}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'translations',
          schema: { type: 'object', properties: { translations: { type: 'array', items: { type: 'string' } } }, required: ['translations'], additionalProperties: false },
          strict: true,
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI request failed: ${await res.text()}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  const parsed = JSON.parse(data.choices[0].message.content).translations;
  if (!Array.isArray(parsed) || parsed.length !== texts.length) {
    throw new Error(`OpenAI returned ${Array.isArray(parsed) ? parsed.length : 'non-array'}, expected ${texts.length}`);
  }
  return parsed;
}

async function translateUncached(texts: string[], targetLang: string): Promise<string[]> {
  try {
    return await translateWithGemini(texts, targetLang);
  } catch (geminiError) {
    console.error('Gemini translation failed, falling back to OpenAI:', geminiError);
  }
  try {
    return await translateWithOpenAI(texts, targetLang);
  } catch (openaiError) {
    console.error('Both providers failed to translate; leaving text as-is:', openaiError);
    return texts;
  }
}

// Read-through cache: anything already translated for this language comes back from Supabase
// for free; only genuinely new strings hit an LLM at all, and those get written back so the
// next request for them — from anyone — is also free.
export async function translateTexts(texts: string[], targetLang: string): Promise<string[]> {
  if (texts.length === 0) return [];

  const cached = await readCached(targetLang, texts);
  const misses = texts.filter((t) => !(t in cached));

  if (misses.length > 0) {
    const translated = await translateUncached(misses, targetLang);
    const newPairs: Record<string, string> = {};
    misses.forEach((t, i) => { newPairs[t] = translated[i]; });
    await writeCached(targetLang, newPairs);
    Object.assign(cached, newPairs);
  }

  return texts.map((t) => cached[t] ?? t);
}
