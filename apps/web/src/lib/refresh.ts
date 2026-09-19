import "server-only";
import { backendRequest } from "./backend";
import type { TokenPair } from "./types";

/**
 * Server-side counterpart of the mobile app's refresh-on-expiry
 * (apps/mobile/src/api/client.ts).
 *
 * Same problem, same shape: the backend ROTATES refresh tokens, and a
 * rotated-away token that's presented again is treated as replay — which
 * revokes every session for that user. A browser routinely fires several
 * requests at once (a page plus its data calls), so two of them can arrive
 * carrying the same soon-to-be-stale refresh token. Mobile collapses that
 * into one in-flight refresh; this does the same per refresh token, and also
 * keeps the settled result for a few seconds so a request that arrives just
 * AFTER the first one finishes (but before its Set-Cookie reached the
 * browser) still gets the new pair instead of tripping replay detection.
 *
 * Kept on globalThis so route bundles that each import this module still
 * share one map. Per-process by design: a multi-instance deployment needs
 * sticky routing or a shared store for this — noted in apps/web/README.md.
 */
const SETTLED_TTL_MS = 10_000;
const g = globalThis as unknown as { __keloRefresh?: Map<string, Promise<TokenPair | null>> };
const inflight = (g.__keloRefresh ??= new Map());

export function refreshTokens(refreshToken: string): Promise<TokenPair | null> {
  const existing = inflight.get(refreshToken);
  if (existing) return existing;

  const attempt = backendRequest<TokenPair>("/auth/refresh", { method: "POST", json: { refreshToken } })
    .then((r) => (r.ok ? r.body : null))
    .finally(() => {
      setTimeout(() => inflight.delete(refreshToken), SETTLED_TTL_MS).unref?.();
    });
  inflight.set(refreshToken, attempt);
  return attempt;
}
