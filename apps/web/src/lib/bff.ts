import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { backendRequest, type BackendResult } from "./backend";
import { ACCESS_COOKIE, REFRESH_COOKIE, clearSessionCookies, writeSessionCookies } from "./cookies";
import { refreshTokens } from "./refresh";
import type { TokenPair } from "./types";

/** Outcome of an authenticated backend call, including any cookie changes the browser needs to receive. */
export interface AuthedCall<T = unknown> {
  result: BackendResult<T>;
  /** Set when the access token had to be refreshed — write these cookies onto whatever response is returned. */
  pair: TokenPair | null;
  /** True when the session is unrecoverable (no/invalid refresh token) — clear the cookies. */
  sessionLost: boolean;
}

/**
 * An authenticated backend call for Route Handlers — the server-side
 * adaptation of mobile's apiFetch: attach the access token; on a 401 (or no
 * access token at all), silently refresh ONCE and retry; if refresh fails the
 * session is over. Unlike mobile there's no token storage to update here —
 * the caller writes `pair` onto its response as httpOnly cookies, so a
 * rotated token reaches the browser without ever being readable by JS.
 */
export async function callBackendAuthed<T = unknown>(
  path: string,
  opts: { method?: string; json?: unknown } = {},
): Promise<AuthedCall<T>> {
  const store = await cookies();
  let access = store.get(ACCESS_COOKIE)?.value ?? null;
  const refresh = store.get(REFRESH_COOKIE)?.value ?? null;
  let pair: TokenPair | null = null;

  const refreshNow = async () => {
    if (!refresh) return false;
    pair = await refreshTokens(refresh);
    if (pair) access = pair.accessToken;
    return pair !== null;
  };

  const expired = (): AuthedCall<T> => ({
    result: { status: 401, ok: false, body: { message: "Session expired — please log in again" } as T },
    pair: null,
    sessionLost: true,
  });

  if (!access && !(await refreshNow())) return expired();

  let result = await backendRequest<T>(path, { ...opts, token: access });
  if (result.status === 401) {
    // A token we've *just* refreshed being rejected means it's genuinely bad, not merely stale.
    if (pair || !(await refreshNow())) return expired();
    result = await backendRequest<T>(path, { ...opts, token: access });
    if (result.status === 401) return expired();
  }
  return { result, pair, sessionLost: false };
}

/** Applies a call's cookie side-effects (rotated tokens / cleared session) to a response. */
export function applySession<R extends NextResponse>(res: R, call: Pick<AuthedCall, "pair" | "sessionLost">): R {
  if (call.pair) writeSessionCookies(res.cookies, call.pair);
  if (call.sessionLost) clearSessionCookies(res.cookies);
  return res;
}

/** Relays the backend's status + JSON body to the browser (never any token), applying cookie side-effects. */
export function relay(call: AuthedCall): NextResponse {
  const { status, body } = call.result;
  const res = status === 204 ? new NextResponse(null, { status }) : NextResponse.json(body ?? null, { status });
  return applySession(res, call);
}
