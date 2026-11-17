export interface RedditMention {
  title: string;
  excerpt: string;
  subreddit: string;
  score: number;
  url: string;
}

const USER_AGENT = 'ai-itinerary-planner/1.0 (personal local project)';

let cachedToken: { token: string; expiresAt: number } | null = null;

export function isRedditConfigured(): boolean {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  return Boolean(id && secret && id !== 'your_reddit_client_id' && secret !== 'your_reddit_client_secret');
}

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    console.error('Reddit auth error:', res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.token;
}

// Reddit's unauthenticated search.json endpoint now redirects to a login wall, so this
// uses a real OAuth app (client_credentials grant, read-only, free & self-serve via
// https://www.reddit.com/prefs/apps) against the proper oauth.reddit.com API.
export async function searchReddit(query: string, subreddit?: string): Promise<RedditMention[]> {
  const token = await getAccessToken();
  if (!token) return [];

  try {
    const base = subreddit ? `https://oauth.reddit.com/r/${encodeURIComponent(subreddit)}/search` : 'https://oauth.reddit.com/search';
    const params = new URLSearchParams({ q: query, sort: 'relevance', limit: '15' });
    if (subreddit) params.set('restrict_sr', 'true');

    const res = await fetch(`${base}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': USER_AGENT,
      },
    });

    if (!res.ok) {
      // A guessed city subreddit that doesn't exist is an expected miss, not an error.
      if (subreddit && res.status === 404) return [];
      console.error('Reddit search error:', res.status, await res.text());
      return [];
    }

    const data = (await res.json()) as { data?: { children?: { data: { title?: string; selftext?: string; subreddit?: string; score?: number; permalink?: string } }[] } };
    const posts = data?.data?.children ?? [];

    return posts.map((post: { data: { title?: string; selftext?: string; subreddit?: string; score?: number; permalink?: string } }) => ({
      title: post.data.title ?? '',
      excerpt: (post.data.selftext ?? '').slice(0, 300),
      subreddit: post.data.subreddit ?? '',
      score: post.data.score ?? 0,
      url: `https://www.reddit.com${post.data.permalink ?? ''}`,
    }));
  } catch (error) {
    console.error('Reddit fetch failed:', error);
    return [];
  }
}

function guessCitySubreddit(location: string): string {
  return location.split(',')[0].trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Mimics manually pulling from several different threads/communities instead of one
// generic sitewide search: the city's own subreddit (guessed from the destination name,
// gracefully skipped if it doesn't exist), plus r/travel and r/food, alongside the
// original general search — merged and deduped by post URL.
export async function searchRedditMultiSource(location: string, extraTerms: string): Promise<RedditMention[]> {
  const citySubreddit = guessCitySubreddit(location);
  const suffix = extraTerms ? ` ${extraTerms}` : '';

  const [general, cityLocal, travel, food] = await Promise.all([
    searchReddit(`best restaurants and things to do in ${location}${suffix}`),
    searchReddit(`best restaurants and things to do${suffix}`, citySubreddit),
    searchReddit(`${location}${suffix}`, 'travel'),
    searchReddit(`${location} food restaurants${suffix}`, 'food'),
  ]);

  const byUrl = new Map<string, RedditMention>();
  [...general, ...cityLocal, ...travel, ...food].forEach((m) => byUrl.set(m.url, m));
  return Array.from(byUrl.values()).slice(0, 25);
}
