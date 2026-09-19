import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SECURE } from "@/lib/config";
import { REFRESH_GUARD_COOKIE } from "@/lib/cookie-names";
import { REFRESH_COOKIE, clearSessionCookies, writeSessionCookies } from "@/lib/cookies";
import { refreshTokens } from "@/lib/refresh";

// Only ever redirect back into the dashboard — `next` is user-controlled
// input, so anything else (another origin, protocol-relative //, a path
// outside /dashboard) falls back to /dashboard rather than becoming an open
// redirect.
function safeNext(next: string | null): string {
  return next && /^\/dashboard(?:[/?#]|$)/.test(next) ? next : "/dashboard";
}

// Where an expired session lands after Server Components / the proxy bounce
// it here (they can't set cookies; this can). Renews the session and returns
// to the exact page the user was on, or sends them to /login.
export async function GET(req: NextRequest) {
  // giveup=1: the caller (proxy / Server Component) has decided this session
  // can't be recovered — e.g. a token rejected right after a fresh refresh —
  // so end it cleanly here, where cookies CAN be cleared, rather than
  // leaving stale ones behind.
  if (req.nextUrl.searchParams.get("giveup") === "1") {
    const res = NextResponse.redirect(new URL("/login?reason=expired", req.url));
    clearSessionCookies(res.cookies);
    return res;
  }
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  const pair = refreshToken ? await refreshTokens(refreshToken) : null;

  if (!pair) {
    const res = NextResponse.redirect(new URL("/login?reason=expired", req.url));
    clearSessionCookies(res.cookies);
    return res;
  }

  const res = NextResponse.redirect(new URL(next, req.url));
  writeSessionCookies(res.cookies, pair);
  res.cookies.set(REFRESH_GUARD_COOKIE, "1", { httpOnly: true, secure: COOKIE_SECURE, sameSite: "lax", path: "/", maxAge: 30 });
  return res;
}
