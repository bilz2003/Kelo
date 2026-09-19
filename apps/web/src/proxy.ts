import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_GUARD_COOKIE } from "@/lib/cookie-names";

/**
 * Gate for /dashboard. Deliberately cheap: it only checks whether a session
 * cookie is PRESENT, not whether it's valid — the backend is what actually
 * verifies the token, on every data call.
 *
 * No access cookie usually just means the 15-minute access token expired (the
 * cookie's lifetime matches the token's), so the request is routed through
 * the refresh handler, which either renews the session and returns here, or
 * sends the user to /login if the refresh token is gone/invalid too.
 */
export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname + req.nextUrl.search;

  if (!req.cookies.has(ACCESS_COOKIE)) {
    if (req.cookies.has(REFRESH_GUARD_COOKIE)) {
      return NextResponse.redirect(new URL("/api/auth/refresh?giveup=1", req.url));
    }
    return NextResponse.redirect(new URL(`/api/auth/refresh?next=${encodeURIComponent(path)}`, req.url));
  }

  // Lets Server Components know the exact URL they're rendering, so an
  // expired session can bounce back to it after a refresh.
  const forwarded = new Headers(req.headers);
  forwarded.set("x-kelo-path", path);
  return NextResponse.next({ request: { headers: forwarded } });
}

export const config = { matcher: ["/dashboard/:path*"] };
