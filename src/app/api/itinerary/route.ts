import { NextResponse } from 'next/server';
import type { ItineraryItem, ItineraryRequest } from '@/lib/types';
import { buildDayList, addDays, MAX_TRIP_DAYS } from '@/lib/dates';
import { searchRedditMultiSource, isRedditConfigured } from '@/lib/reddit';
import { clusterByDay } from '@/lib/clusterByDay';
import { findReviewHighlights } from '@/lib/reviewHighlights';
import { repairItinerary } from '@/lib/repairItinerary';
import { searchEvents, isTicketmasterConfigured } from '@/lib/ticketmaster';
import { mergePlaces } from '@/lib/mergePlaces';
import { findOpeningHours } from '@/lib/openingHours';
import { trimPlacesForPrompt } from '@/lib/trimPlacesForPrompt';
import { annotateReviewEvidence } from '@/lib/reviewEvidence';
import { generateItinerary } from '@/lib/generateItinerary';
import type { RawPlace } from '@/lib/rawPlace';
import { checkRateLimit, clientIp, tooManyRequests, TEN_MINUTES_MS } from '@/lib/rateLimit';
import { FULL_BUILDS_PER_WINDOW } from '@/lib/limits';

const MAX_SPOTS = 50;
const SCOPED_REGENS_PER_WINDOW = 20;
const MAX_PLACES_PER_QUERY = 20; // Google Places Text Search's hard per-request cap

async function fetchPlaces(textQuery: string, pageSize: number): Promise<{ places: RawPlace[]; error?: string }> {
  if (pageSize <= 0) return { places: [] };

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.reviews,places.regularOpeningHours',
    },
    body: JSON.stringify({ textQuery, pageSize: Math.min(pageSize, MAX_PLACES_PER_QUERY) }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Places API error:', errText);
    return { places: [], error: errText };
  }

  const data = await res.json();
  return { places: data.places || [] };
}

export async function POST(request: Request) {
  // Given back if the build fails on our side, so an outage doesn't use up the user's attempts.
  let refundAttempt = () => {};

  try {
    const body: ItineraryRequest = await request.json();
    const { location, days, startDate, perDayCounts, preferences, budget, travelParty, pace, transportation, sourceWeights, hiddenGemMode, optimizeRoutes, regenerateScope } = body;

    if (!location || typeof location !== 'string') {
      return NextResponse.json({ error: 'location (string) is required' }, { status: 400 });
    }
    if (startDate !== undefined && typeof startDate !== 'string') {
      return NextResponse.json({ error: 'startDate must be a YYYY-MM-DD string' }, { status: 400 });
    }
    if (typeof days !== 'number' || days < 1 || days > MAX_TRIP_DAYS) {
      return NextResponse.json({ error: `days must be between 1 and ${MAX_TRIP_DAYS}` }, { status: 400 });
    }
    if (!Array.isArray(perDayCounts) || perDayCounts.length !== days) {
      return NextResponse.json({ error: 'perDayCounts must have one entry per day' }, { status: 400 });
    }
    const totalFoodNeeded = perDayCounts.reduce((sum, d) => sum + (d.food || 0), 0);
    const totalAttractionNeeded = perDayCounts.reduce((sum, d) => sum + (d.attraction || 0), 0);
    const totalSpots = totalFoodNeeded + totalAttractionNeeded;
    if (totalSpots < 1 || totalSpots > MAX_SPOTS) {
      return NextResponse.json({ error: `Total spots across all days must be between 1 and ${MAX_SPOTS}` }, { status: 400 });
    }

    // Rebuilding just one category after a single change (e.g. adding a diet restriction) is
    // cheap and doesn't count against the full-build allowance — but only if the request really
    // is one-category-only, so a full build can't be relabeled to dodge the limit.
    const isScopedRegen =
      (regenerateScope === 'Food' && totalFoodNeeded > 0 && totalAttractionNeeded === 0) ||
      (regenerateScope === 'Attraction' && totalAttractionNeeded > 0 && totalFoodNeeded === 0);
    const limit = checkRateLimit(
      (isScopedRegen ? 'itinerary-scoped:' : 'itinerary-full:') + clientIp(request),
      isScopedRegen ? SCOPED_REGENS_PER_WINDOW : FULL_BUILDS_PER_WINDOW,
      TEN_MINUTES_MS,
    );
    if (!limit.ok) {
      const minutes = Math.ceil(limit.retryAfterSeconds / 60);
      const wait = 'about ' + minutes + ' minute' + (minutes === 1 ? '' : 's');
      return tooManyRequests(
        isScopedRegen
          ? 'Too many quick updates in a row. Please wait ' + wait + '.'
          : 'You can build ' + FULL_BUILDS_PER_WINDOW + ' trips every 10 minutes. Try again in ' + wait + '.',
        limit.retryAfterSeconds,
      );
    }
    refundAttempt = limit.refund;

    const warnings: string[] = [];
    const weights = { ...sourceWeights };
    if (weights.reddit > 0 && !isRedditConfigured()) {
      warnings.push('Reddit is not connected yet — add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET (free, from https://www.reddit.com/prefs/apps) to enable it — see the README. Its weight was redistributed to Google.');
      weights.reddit = 0;
    }
    if (weights.ticketmaster > 0 && !isTicketmasterConfigured()) {
      warnings.push('Ticketmaster is not connected yet — add TICKETMASTER_API_KEY (free from https://developer.ticketmaster.com/) to enable it — see the README.');
      weights.ticketmaster = 0;
    }
    if (weights.google + weights.reddit <= 0) {
      weights.google = 1;
    }

    const requiredPrefs = preferences.filter((p) => p.required).map((p) => p.text);
    const preferredPrefs = preferences.filter((p) => !p.required).map((p) => p.text);

    const budgetHint = budget !== 'No preference' ? budget : '';
    const partyHint = travelParty !== 'No preference' ? travelParty : '';
    const paceHint = pace !== 'No preference' ? pace : '';
    const transportHint = transportation !== 'No preference' ? transportation : '';

    const searchHints = [budgetHint, ...requiredPrefs, ...preferredPrefs, hiddenGemMode ? 'hidden gems, local favorites' : '']
      .filter(Boolean)
      .join(', ');
    const hintSuffix = searchHints ? `, with a focus on ${searchHints}` : '';

    // Two separate targeted searches instead of one blended query: a single query capped at
    // Google's 20-result limit split across both categories was leaving too few unique
    // candidates once totalSpots got close to 20, forcing the model to repeat the same
    // places across multiple days.
    const [foodResult, attractionResult] = await Promise.all([
      fetchPlaces(`best restaurants, cafes, and bars in ${location}${hintSuffix}`, totalFoodNeeded + 6),
      fetchPlaces(`top rated tourist attractions and things to do in ${location}${hintSuffix}`, totalAttractionNeeded + 6),
    ]);

    if (foodResult.error && attractionResult.error) {
      refundAttempt();
      return NextResponse.json({ error: 'Failed to fetch places' }, { status: 502 });
    }

    const rawPlaces = mergePlaces(foodResult.places, attractionResult.places);

    if (rawPlaces.length === 0) {
      refundAttempt();
      return NextResponse.json({ error: 'No places found for this location' }, { status: 404 });
    }
    if (rawPlaces.length < totalSpots) {
      warnings.push(`Only found ${rawPlaces.length} unique candidate places for ${totalSpots} requested spots — some repetition may occur.`);
    }

    let redditSection = '';
    if (weights.reddit > 0) {
      const redditExtraTerms = [...preferredPrefs, hiddenGemMode ? 'hidden gem local favorite' : ''].filter(Boolean).join(' ');
      const mentions = await searchRedditMultiSource(location, redditExtraTerms);
      if (mentions.length > 0) {
        redditSection = `\n      Reddit discussion excerpts (real traveler/local opinions, may reference specific places by name):\n      ${mentions
          .map((m) => `- [r/${m.subreddit}, score ${m.score}] ${m.title}: ${m.excerpt}`)
          .join('\n      ')}\n`;
      } else {
        warnings.push('No relevant Reddit discussions were found for this search.');
      }
    }

    let eventsSection = '';
    if (weights.ticketmaster > 0 && startDate) {
      const tripEndDate = addDays(startDate, days - 1);
      const events = await searchEvents(location, startDate, tripEndDate);
      if (events.length > 0) {
        eventsSection = `\n      Local events during this trip (from Ticketmaster; use the given coordinates if you feature one as an Attraction spot):\n      ${events
          .map((e) => `- ${e.date}: "${e.name}" at ${e.venue}${e.lat && e.lng ? ` (lat ${e.lat}, lng ${e.lng})` : ''} [${e.segment}]`)
          .join('\n      ')}\n`;
      }
    }

    const dayList = buildDayList(days, startDate);
    const dayCountLines = dayList.map((label, i) => `${label}: ${perDayCounts[i].food} Food spot(s), ${perDayCounts[i].attraction} Attraction spot(s)`);

    const activeSourceWeights = [
      `Google Places data: ${weights.google}`,
      weights.reddit > 0 ? `Reddit community sentiment: ${weights.reddit}` : '',
      weights.ticketmaster > 0 ? `Ticketmaster events: ${weights.ticketmaster}` : '',
    ].filter(Boolean).join(', ');
    const sourceEmphasis = `Weight your selections roughly according to source importance — ${activeSourceWeights} (higher number = rely on it more).`;

    const prompt = `
      You are an expert travel guide. Create an itinerary for ${location} with this exact structure per day:
      ${dayCountLines.join('\n      ')}

      Every spot needs a "day" number matching the day list above and a "slot" of Morning, Afternoon, or Evening,
      and must respect the exact Food/Attraction counts specified for that day.
      Every one of the ${totalSpots} spots must be a distinct, unique place — never reuse the same name or address
      more than once across the whole itinerary, even on different days or slots. If the raw data below does not
      contain enough unique candidates to fill every slot without repetition, pick the closest remaining distinct
      options rather than repeating one that was already used.

      ${requiredPrefs.length ? `REQUIRED constraints — every spot must satisfy all of these, do not include a spot that conflicts with any of them: ${requiredPrefs.join(', ')}.` : ''}
      ${preferredPrefs.length ? `Preferred but not mandatory — favor spots matching these when possible: ${preferredPrefs.join(', ')}.` : ''}
      ${requiredPrefs.length || preferredPrefs.length ? `
      Be accurate about dietary and accessibility claims rather than assuming compliance:
      - Only state a specific accommodation in a spot's notes (e.g. "has a dedicated gluten-free menu") if there is
        real supporting evidence in the raw Places data or Reddit excerpts below — do not invent accommodation claims.
      - Distinguish a place being naturally compatible with a broad category (e.g. a coffee shop or bakery
        naturally has some vegan-friendly items like black coffee or fruit, a salad place is naturally
        vegetarian-friendly) from a genuine specialized accommodation (e.g. a dedicated gluten-free bakery,
        a restaurant with a certified allergen-free kitchen) — don't overstate the former as if it were the latter.
      - If no candidate place has strong evidence of meeting a REQUIRED constraint, choose the most plausible
        match by cuisine or place type rather than fabricating certainty in the notes.
      Each raw place below may include a "reviewEvidence" array — these are terms from your constraints above that
      were actually found mentioned in that specific place's real customer reviews (computed directly from the
      review text, not a guess). For REQUIRED constraints, strongly prefer places whose reviewEvidence includes
      that exact term over ones without it; only pick a place lacking evidence if no candidate has any. For
      preferred terms, treat reviewEvidence as a positive signal but not mandatory.` : ''}
      ${budgetHint ? `Budget level: ${budgetHint}.` : ''}
      ${partyHint ? `Traveling as: ${partyHint}.` : ''}
      ${paceHint ? `Preferred pace: ${paceHint}. The number of spots per day is already fixed above, so express this
      through your choices, not by changing spot counts: Packed means picking spots close together and efficient
      to visit back-to-back with little downtime; Relaxed means allowing more downtime between spots and not
      worrying about tight geographic clustering.` : ''}
      ${transportHint ? `Transportation: ${transportHint} (avoid spots impractical for this mode, e.g. remote day trips without a car).` : ''}
      ${hiddenGemMode ? `The traveler wants hidden gems and local favorites, not tourist traps — when a lesser-known
      alternative exists with reasonable ratings or Reddit/local support, prefer it over the obvious famous option,
      even if the famous one is easier to justify.` : ''}
      Each place below may include "regularOpeningHours.weekdayDescriptions" — its hours per day of the week. Avoid
      scheduling a spot on a day/slot when it would be closed, based on those hours and the day-of-week given above
      for each day; if hours aren't provided or dates aren't specific, use your best judgment.
      Take the day of week into account in your notes where it matters (e.g. weekend crowds, weekday quiet hours,
      brunch on a Sunday, nightlife on a Friday) when specific dates are given above.
      Also consider any well-known public holidays or observances that fall on these exact dates (e.g. Canada Day,
      Independence Day, Thanksgiving) from your own knowledge, even if not listed below. If a real dated event
      (from the list below, or a well-known holiday) is happening, either feature it as an Attraction spot using
      its given coordinates, or mention it in a nearby spot's notes (e.g. expect fireworks or crowds nearby that evening).

      ${sourceEmphasis}

      Raw Places (from Google Places):
      ${JSON.stringify(trimPlacesForPrompt(annotateReviewEvidence(rawPlaces, [...requiredPrefs, ...preferredPrefs])))}
      ${redditSection}
      ${eventsSection}

      Classify each spot's "category" as exactly "Food" (restaurants, cafes, bars, bakeries) or
      "Attraction" (sights, beaches, parks, museums, viewpoints, activities).
      Set "redditMentioned" to true only if that specific place is named or clearly identifiable in the Reddit
      excerpts above, otherwise false.
    `;

    let itinerary: ItineraryItem[];
    try {
      const result = await generateItinerary(prompt);
      itinerary = result.items as ItineraryItem[];
    } catch (genError) {
      console.error('Both providers failed to generate an itinerary:', genError);
      refundAttempt();
      return NextResponse.json({ error: 'Failed to generate itinerary' }, { status: 502 });
    }

    const { itinerary: repairedItinerary, hadUnresolvable } = repairItinerary(itinerary, foodResult.places, attractionResult.places);
    itinerary = repairedItinerary;
    if (hadUnresolvable) {
      warnings.push(`Not enough unique matching places were found in ${location} for all ${totalSpots} spots — some repetition was unavoidable.`);
    }

    // No Reddit excerpts were given to the model at all when its weight is 0, so any
    // redditMentioned: true here would be a hallucination, not a real match — force it
    // false deterministically rather than trust the model to always self-correct.
    if (weights.reddit <= 0) {
      itinerary = itinerary.map((item) => ({ ...item, redditMentioned: false }));
    }

    if (optimizeRoutes) {
      itinerary = clusterByDay(itinerary);
    }

    const preferenceTerms = [...requiredPrefs, ...preferredPrefs];
    const itineraryWithReviews = itinerary.map((item) => ({
      ...item,
      reviewHighlights: findReviewHighlights(rawPlaces, item.name, item.address, preferenceTerms),
      openingHours: findOpeningHours(rawPlaces, item.name, item.address),
    }));

    const response = { itinerary: itineraryWithReviews, warnings };

    return NextResponse.json(response);
  } catch (error) {
    console.error('API Error:', error);
    refundAttempt();
    return NextResponse.json({ error: 'Failed to generate itinerary' }, { status: 500 });
  }
}
