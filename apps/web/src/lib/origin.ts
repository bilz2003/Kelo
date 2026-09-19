import "server-only";

/**
 * Defence in depth on top of SameSite=Lax: a state-changing request must
 * come from this site's own origin. Browsers always send Origin on
 * cross-origin and same-origin POST/PATCH/DELETE, so a missing or foreign
 * Origin is rejected.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
