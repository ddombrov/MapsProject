'use client';

// A generic, DOM-level "translate the whole page" layer rather than threading a translation
// key through every one of the app's components: it walks the rendered text under `root`,
// batches whatever isn't already cached through /api/translate, and swaps it in place. A
// MutationObserver re-applies the (by then mostly cached, so near-instant) translation after
// every React re-render — new itinerary items, a new view, a modal opening — without the app's
// own components needing to know translation exists at all.
//
// Purely a display-layer effect: it only ever rewrites Text node values and a few attributes
// (placeholder/aria-label/title), never anything in React's own state, so nothing it touches
// can affect sharing, Google Maps links, or itinerary data.

const STORAGE_PREFIX = 'tp-translate-cache:';
const TRANSLATABLE_ATTRS = ['placeholder', 'aria-label', 'title'] as const;
type TranslatableAttr = (typeof TRANSLATABLE_ATTRS)[number];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);
const BATCH_SIZE = 150;
const OBSERVER_DEBOUNCE_MS = 400;

const originalText = new WeakMap<Text, string>();
const originalAttr = new WeakMap<Element, Partial<Record<TranslatableAttr, string>>>();

function loadCache(lang: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_PREFIX + lang) || '{}');
  } catch {
    return {};
  }
}

function saveCache(lang: string, cache: Record<string, string>) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + lang, JSON.stringify(cache));
  } catch {
    // Storage full or unavailable (private browsing) — translation still works this session,
    // it just won't be remembered next time.
  }
}

function collect(root: HTMLElement): { textNodes: Text[]; attrEls: Element[] } {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = (node as Text).parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.closest('[data-no-translate]')) return NodeFilter.FILTER_REJECT;
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n: Node | null;
  while ((n = walker.nextNode())) textNodes.push(n as Text);

  const attrEls = Array.from(root.querySelectorAll(`[${TRANSLATABLE_ATTRS.join('],[')}]`)).filter(
    (el) => !el.closest('[data-no-translate]'),
  );
  return { textNodes, attrEls };
}

async function translateMissing(texts: string[], lang: string, endpoint: string): Promise<Record<string, string>> {
  const cache = loadCache(lang);
  const unique = Array.from(new Set(texts.map((t) => t.trim()))).filter((t) => t && !(t in cache));

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const slice = unique.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetLang: lang, texts: slice }),
      });
      const data = (await res.json()) as { translations?: string[] };
      if (Array.isArray(data.translations) && data.translations.length === slice.length) {
        slice.forEach((t, idx) => { cache[t] = data.translations![idx]; });
      }
    } catch {
      // These specific strings stay untranslated for this pass; still uncached, so the next
      // applyTranslation call (the observer fires on every DOM change) retries them.
    }
  }
  if (unique.length > 0) saveCache(lang, cache);
  return cache;
}

let observer: MutationObserver | null = null;
let observerTimer: ReturnType<typeof setTimeout> | null = null;
let applying = false;
let currentLang = 'en';
let currentEndpoint = '';

function restoreEnglish(textNodes: Text[], attrEls: Element[]) {
  textNodes.forEach((node) => {
    const original = originalText.get(node);
    if (original !== undefined) node.nodeValue = original;
  });
  attrEls.forEach((el) => {
    const saved = originalAttr.get(el);
    if (!saved) return;
    for (const attr of TRANSLATABLE_ATTRS) {
      if (saved[attr] !== undefined) el.setAttribute(attr, saved[attr]!);
    }
  });
}

export async function applyTranslation(root: HTMLElement, lang: string, endpoint: string): Promise<void> {
  currentLang = lang;
  currentEndpoint = endpoint;
  applying = true;
  observer?.disconnect();

  try {
    const { textNodes, attrEls } = collect(root);

    if (lang === 'en') {
      restoreEnglish(textNodes, attrEls);
      return;
    }

    // Capture true originals before anything is overwritten, so re-translating a node that's
    // currently showing a stale translation starts from English again, not from itself.
    textNodes.forEach((node) => {
      if (!originalText.has(node)) originalText.set(node, node.nodeValue || '');
    });
    attrEls.forEach((el) => {
      if (!originalAttr.has(el)) {
        const saved: Partial<Record<TranslatableAttr, string>> = {};
        for (const attr of TRANSLATABLE_ATTRS) {
          const v = el.getAttribute(attr);
          if (v) saved[attr] = v;
        }
        originalAttr.set(el, saved);
      }
    });

    const sourceTexts = [
      ...textNodes.map((n) => (originalText.get(n) || '').trim()),
      ...attrEls.flatMap((el) =>
        TRANSLATABLE_ATTRS.map((attr) => originalAttr.get(el)?.[attr]).filter((v): v is string => Boolean(v)),
      ),
    ];

    const cache = await translateMissing(sourceTexts, lang, endpoint);
    if (currentLang !== lang) return; // language changed again while this batch was in flight

    textNodes.forEach((node) => {
      const original = originalText.get(node) || '';
      const translated = cache[original.trim()];
      if (translated) node.nodeValue = original.replace(original.trim(), translated);
    });
    attrEls.forEach((el) => {
      const saved = originalAttr.get(el);
      if (!saved) return;
      for (const attr of TRANSLATABLE_ATTRS) {
        const original = saved[attr];
        const translated = original && cache[original.trim()];
        if (translated) el.setAttribute(attr, translated);
      }
    });
  } finally {
    applying = false;
    observer ??= new MutationObserver(() => {
      if (applying || currentLang === 'en') return;
      // Debounced: a map pan or a drag can fire dozens of mutations a second, and only the
      // settled result needs translating, not every intermediate frame.
      if (observerTimer) clearTimeout(observerTimer);
      observerTimer = setTimeout(() => {
        applyTranslation(root, currentLang, currentEndpoint);
      }, OBSERVER_DEBOUNCE_MS);
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
  }
}
