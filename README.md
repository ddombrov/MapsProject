# Itinerary Planner

Plan a trip on a map. Enter a destination and a length (up to 7 days) and it builds a
day-by-day itinerary of food and attractions from real Google Places data, optionally
blended with Reddit opinions and Ticketmaster events. Then edit it on a map, calendar or
table, and share it with a link.

## Features

- **Generate** up to 7 days and 50 places, with per-day food and attraction counts. Steer it
  with diet, attraction and food-style preferences, budget, travel party, pace,
  transportation, "hidden gems", and route optimization. Change one category's preferences
  (say, add a diet restriction) and only that category is regenerated.
- **Three views** of the same trip: a map (colored pins per day, optional road routes, a day
  filter), a calendar (day, week and month), and a table.
- **Travel times and hours.** Drive or walk time between stops and per day, plus opening
  hours with a warning when a place is closed at the day and time you scheduled it.
- **Edit anything.** Add, edit, and remove places; drag and drop to reorder or change day
  (or tap Move on touch screens); click an empty calendar day to add a place; drop a pin on
  the map to add a spot. Import from CSV or iCal.
- **Chat assistant** that can add, remove, and swap places in plain language, including
  several in one message.
- **Export and share.** Export a Google My Maps CSV or an `.ics` calendar, or copy a share
  link. Open any day's route in Google Maps.
- Works on phones, with a bottom navigation bar and touch-friendly controls.

## Setup

You need Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### API keys

`.env.example` lists every variable with instructions. In short:

| Variable | Needed for | Required |
| --- | --- | --- |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | The map in the browser (Maps JavaScript API) | Yes |
| `GOOGLE_PLACES_API_KEY` | Places API (New), Geocoding API, Routes API, on the server | Yes |
| `GEMINI_API_KEY` | Itinerary generation (primary) | One of Gemini or OpenAI |
| `OPENAI_API_KEY` | Generation fallback and the chat assistant | For chat |
| `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` | Reddit as a source | Optional |
| `TICKETMASTER_API_KEY` | Events during your dates | Optional |

Without the optional keys the matching sliders under **Source Emphasis** stay disabled.
Set spending limits on each provider's dashboard: this app calls paid APIs on your behalf.

## How sharing works

There is no database. The whole trip is compressed and stored in the URL after the `#`, along
with which tab, day, and route setting you were looking at, and the address bar updates as
you edit. Anyone who opens the link gets their own copy to edit; their changes do not sync
back. The part after `#` is never sent to a server.

## Limits

- Trips are limited to 7 days and 50 places.
- Each browser can build 5 full trips per 10 minutes (kept in `localStorage`). Regenerating
  a single category does not count.
- The API routes also count requests per IP address as a backstop. That counter lives in
  server memory, so on a serverless host each instance keeps its own count. Treat it as a
  speed bump, and use your providers' own quotas as the real limit.

## Development

```bash
npm run dev     # start the dev server
npm run build   # production build
npm run lint    # eslint
npx tsc --noEmit
```

Built with Next.js (App Router), React, TypeScript, and Tailwind CSS, using
`@vis.gl/react-google-maps`.

```
src/app/            the page and the API routes (itinerary, chat, geocode, directions, ...)
src/components/     map, calendar, table, dialogs, and form pieces
src/lib/            generation, place matching, dates, sharing, rate limits, and other logic
```
