// Shared by the browser-side limit and the server-side backstop, so they can't drift apart.
export const FULL_BUILDS_PER_WINDOW = 5;
export const RATE_WINDOW_MS = 10 * 60 * 1000;
