import { secureStorage } from "@/lib/secureStorage";

const ACCESS_TOKEN_KEY = "kelo_access_token";
const REFRESH_TOKEN_KEY = "kelo_refresh_token";

// No web target ships (see secureStorage.web.ts) — localhost is what the
// backend actually listens on for the local dev loop this app is built
// against right now. Override via EXPO_PUBLIC_API_URL for a device/LAN URL.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export async function getStoredTokens() {
  const [accessToken, refreshToken] = await Promise.all([
    secureStorage.getItem(ACCESS_TOKEN_KEY),
    secureStorage.getItem(REFRESH_TOKEN_KEY),
  ]);
  return { accessToken, refreshToken };
}

async function storeTokens(accessToken: string, refreshToken: string) {
  await Promise.all([
    secureStorage.setItem(ACCESS_TOKEN_KEY, accessToken),
    secureStorage.setItem(REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

export async function clearTokens() {
  await Promise.all([secureStorage.removeItem(ACCESS_TOKEN_KEY), secureStorage.removeItem(REFRESH_TOKEN_KEY)]);
}

// Fired when a request fails auth and silent refresh also fails — lets
// AuthContext drop the app back to the login screen from anywhere, not just
// from calls it made directly. Set once, from AuthProvider.
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

// Concurrent 401s shouldn't each rotate the refresh token — a rotation
// invalidates the token that was just used, so a second concurrent attempt
// with the same (now-stale) refresh token would itself fail. Collapsing
// concurrent refreshes into one in-flight request avoids that.
let refreshInFlight: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const { refreshToken } = await getStoredTokens();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;

    const data: TokenPair = await res.json();
    await storeTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Attach the stored access token and retry-with-refresh on 401. Default true. */
  auth?: boolean;
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    const message = data?.message ?? res.statusText;
    return Array.isArray(message) ? message.join(", ") : String(message);
  } catch {
    return res.statusText;
  }
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options;

  const doFetch = async (accessToken: string | null) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let accessToken: string | null = null;
  if (auth) {
    ({ accessToken } = await getStoredTokens());
  }

  let res = await doFetch(accessToken);

  if (auth && res.status === 401) {
    const newAccessToken = await refreshAccessToken();
    if (!newAccessToken) {
      await clearTokens();
      onSessionExpired?.();
      throw new ApiError(401, "Session expired — please log in again");
    }
    res = await doFetch(newAccessToken);
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseErrorMessage(res));
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function loginRequest(email: string, password: string): Promise<TokenPair> {
  return apiFetch<TokenPair>("/auth/login", { method: "POST", body: { email, password }, auth: false });
}

export async function registerRequest(email: string, password: string, name: string): Promise<TokenPair> {
  return apiFetch<TokenPair>("/auth/register", { method: "POST", body: { email, password, name }, auth: false });
}

export async function logoutRequest(refreshToken: string): Promise<void> {
  await apiFetch<void>("/auth/logout", { method: "POST", body: { refreshToken }, auth: false });
}

export { storeTokens };
