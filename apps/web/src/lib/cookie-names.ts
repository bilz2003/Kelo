// Plain constants (no server-only import) so proxy.ts can share them.
export const ACCESS_COOKIE = "kelo_at";
export const REFRESH_COOKIE = "kelo_rt";
// Short-lived marker set by the refresh handler. If a page still gets a 401
// right after a refresh, that's not an expired token — it's a real auth
// failure, and this is what stops a refresh -> 401 -> refresh redirect loop.
export const REFRESH_GUARD_COOKIE = "kelo_rf";
