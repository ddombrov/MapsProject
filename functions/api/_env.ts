export interface Env {
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?: string;
  GOOGLE_PLACES_API_KEY?: string;
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  REDDIT_CLIENT_ID?: string;
  REDDIT_CLIENT_SECRET?: string;
  TICKETMASTER_API_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

// The planner's server code (src/lib) was written against
// process.env, and a Pages Function only receives its secrets as the `env`
// argument. Copying them across per request keeps that code unchanged and
// works whether or not the project has Node compatibility turned on.
export function installEnv(env: Env) {
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
  g.process ??= {};
  g.process.env ??= {};
  try {
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === "string") g.process.env[key] = value;
    }
  } catch {
    // process.env is read-only here, so it must already carry the bindings.
  }
}
