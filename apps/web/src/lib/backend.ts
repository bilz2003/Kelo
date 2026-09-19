import "server-only";
import { API_URL } from "./config";

export interface BackendResult<T = unknown> {
  status: number;
  ok: boolean;
  body: T;
}

/**
 * Server-to-server call to the Kelo backend. The only place in this app that
 * builds a backend request. Tokens are passed in by the caller and never
 * leave the server.
 */
export async function backendRequest<T = unknown>(
  path: string,
  opts: { method?: string; token?: string | null; json?: unknown; headers?: Record<string, string> } = {},
): Promise<BackendResult<T>> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.json !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
      cache: "no-store",
    });
  } catch {
    // Backend unreachable — surfaced as a 503 rather than a thrown error so
    // every caller handles it the same way as any other failure status.
    return { status: 503, ok: false, body: { message: "Kelo's servers can't be reached right now — try again shortly." } as T };
  }

  let body: unknown = undefined;
  if (res.status !== 204) {
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
  }
  return { status: res.status, ok: res.ok, body: body as T };
}

/** The backend's error `message` (a string, or class-validator's string[]), flattened to one readable string. */
export function errorMessage(body: unknown, fallback: string): string {
  const message = (body as { message?: unknown } | undefined)?.message;
  if (Array.isArray(message)) return message.join(", ");
  if (typeof message === "string" && message) return message;
  return fallback;
}
