import "server-only";

// Where the Kelo backend is reachable from this Next.js server. Never sent to
// the browser: the browser only ever talks to this app's own /api routes.
export const API_URL = process.env.KELO_API_URL ?? "http://localhost:3000";

// Secure is on unless explicitly disabled — see .env.example.
export const COOKIE_SECURE = process.env.KELO_COOKIE_INSECURE !== "1";
