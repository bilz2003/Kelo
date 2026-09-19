import "server-only";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { backendRequest, errorMessage } from "./backend";
import { ACCESS_COOKIE, REFRESH_GUARD_COOKIE } from "./cookie-names";

function recoverSession(currentPath: string, guardSet: boolean): never {
  // Just refreshed and still rejected -> a real auth failure. Don't loop.
  if (guardSet) redirect("/api/auth/refresh?giveup=1");
  redirect(`/api/auth/refresh?next=${encodeURIComponent(currentPath)}`);
}

/**
 * Authenticated GET for Server Components.
 *
 * Server Components can't set cookies, and a refresh rotates the refresh
 * token — so the rotated pair MUST be persisted or the next request would
 * present a revoked token and trip replay detection. Rather than refreshing
 * here and losing the new tokens, an expired/rejected session redirects
 * through /api/auth/refresh (a Route Handler, which can set cookies), which
 * bounces straight back to this same page.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const store = await cookies();
  const h = await headers();
  const currentPath = h.get("x-kelo-path") ?? "/dashboard";
  const guardSet = store.has(REFRESH_GUARD_COOKIE);

  const access = store.get(ACCESS_COOKIE)?.value;
  if (!access) recoverSession(currentPath, guardSet);

  const result = await backendRequest<T>(path, { token: access });
  if (result.status === 401) recoverSession(currentPath, guardSet);
  if (result.status === 404) notFound();
  if (!result.ok) throw new Error(errorMessage(result.body, "Couldn't load this — try again."));
  return result.body;
}
