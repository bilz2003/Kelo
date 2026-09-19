import "server-only";
import { COOKIE_SECURE } from "./config";
import type { TokenPair } from "./types";

import { ACCESS_COOKIE, REFRESH_COOKIE } from "./cookie-names";
export { ACCESS_COOKIE, REFRESH_COOKIE };

// The refresh token is only ever needed by /api routes (the refresh handler,
// logout, and the BFF's retry-on-401). Scoping it to /api means page requests
// — and everything the browser fetches for a page — never carry it at all.
export const REFRESH_COOKIE_PATH = "/api";

const ACCESS_FALLBACK_SECONDS = 15 * 60;
const REFRESH_SECONDS = 30 * 24 * 60 * 60; // matches the backend's 30-day refresh TTL

const base = { httpOnly: true, secure: COOKIE_SECURE, sameSite: "lax" as const };

/** Seconds until a JWT's own `exp`. Decoded only to size the cookie's lifetime — the backend is what actually verifies the token. */
function secondsUntilExpiry(jwt: string): number {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
    const remaining = Math.floor(payload.exp - Date.now() / 1000);
    return remaining > 0 ? remaining : ACCESS_FALLBACK_SECONDS;
  } catch {
    return ACCESS_FALLBACK_SECONDS;
  }
}

export interface CookieWriter {
  set(name: string, value: string, options: Record<string, unknown>): unknown;
}

// SameSite=Lax rather than Strict: Strict would drop the cookie on a
// top-level navigation from another site (a link in an email, a search
// result), so a signed-in host clicking through would look logged out. Lax
// still blocks the cookie on cross-site POST/fetch, which is the CSRF
// surface — and mutating routes additionally check Origin (see origin.ts).
export function writeSessionCookies(store: CookieWriter, pair: Pick<TokenPair, "accessToken" | "refreshToken">) {
  store.set(ACCESS_COOKIE, pair.accessToken, { ...base, path: "/", maxAge: secondsUntilExpiry(pair.accessToken) });
  store.set(REFRESH_COOKIE, pair.refreshToken, { ...base, path: REFRESH_COOKIE_PATH, maxAge: REFRESH_SECONDS });
}

export function clearSessionCookies(store: CookieWriter) {
  store.set(ACCESS_COOKIE, "", { ...base, path: "/", maxAge: 0 });
  store.set(REFRESH_COOKIE, "", { ...base, path: REFRESH_COOKIE_PATH, maxAge: 0 });
}
