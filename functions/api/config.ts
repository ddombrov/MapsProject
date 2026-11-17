/// <reference types="@cloudflare/workers-types" />
import { installEnv, type Env } from "./_env";
import { isRedditConfigured } from "../../src/lib/reddit";
import { isTicketmasterConfigured } from "../../src/lib/ticketmaster";

// The Maps JavaScript key is public by design (restricted by referrer in
// Google Cloud), but it's served at runtime from the Pages environment rather
// than baked into the static build, so it can be changed without a rebuild.
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  installEnv(env);
  return Response.json({
    reddit: isRedditConfigured(),
    ticketmaster: isTicketmasterConfigured(),
    mapsKey: env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  });
};
