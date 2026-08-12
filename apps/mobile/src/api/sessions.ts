import { io, Socket } from "socket.io-client";
import { Charger, SessionFinancials } from "@kelo/core";
import { apiFetch, getStoredTokens } from "./client";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export interface SessionTick {
  sessionId: number;
  kwh: number;
  seconds: number;
  energyCost: number;
  idleCost: number;
  totalCost: number;
  idleChargesActive: boolean;
}

/**
 * The one and only shape a session ever ends with, whatever triggered it
 * (the mock simulate-unplug endpoint now, a real hardware signal later) —
 * self-contained (includes its own charger snapshot) so the receipt never
 * depends on whatever local state happened to be around when it arrived.
 */
export interface SessionEndedEvent extends SessionFinancials {
  sessionId: number;
  bookingId: number;
  kwh: number;
  seconds: number;
  released: boolean;
  minutesReleased: number;
  charger: { id: number; title: string; rate: number };
}

export interface StartSessionResponse {
  id: number;
  bookingId: number;
  startedAt: string;
}

/**
 * Same shape the extension:requested/approved/declined socket events carry
 * — used both for the live push and for reconstructing state on reconnect
 * (see ActiveSessionResponse.pendingExtension below).
 */
export interface ExtensionRequestEvent {
  id: number;
  bookingId: number;
  sessionId: number;
  requestedEndAt: string;
  status: "pending" | "approved" | "declined";
}

export interface ActiveSessionResponse {
  id: number;
  bookingId: number;
  startedAt: string;
  arrivalAt: string;
  endAt: string;
  kwh: number;
  seconds: number;
  charger: Charger;
  pendingExtension: { id: number; requestedEndAt: string; status: "pending" } | null;
}

export function startSession(bookingId: number): Promise<StartSessionResponse> {
  return apiFetch(`/sessions/${bookingId}/start`, { method: "POST" });
}

/**
 * Mock-only stand-in for a real hardware unplug signal — test tooling, not
 * a real product action. Fire-and-forget from the caller's perspective:
 * the UI never reacts to this call's return value, only to the
 * session:ended event it triggers over the socket (see connectSessionSocket).
 */
export function simulateUnplug(sessionId: number): Promise<SessionEndedEvent> {
  return apiFetch(`/sessions/${sessionId}/simulate-unplug`, { method: "POST" });
}

export function getActiveSession(): Promise<ActiveSessionResponse | null> {
  return apiFetch("/sessions/active");
}

/** Driver-only. Rejected server-side if the current endAt has already passed, or the requested time is out of bounds. */
export function requestExtension(bookingId: number, requestedEndAt: Date): Promise<ExtensionRequestEvent> {
  return apiFetch(`/bookings/${bookingId}/extension-requests`, {
    method: "POST",
    body: { requestedEndAt: requestedEndAt.toISOString() },
  });
}

/** Host-only. Approval re-runs the booking-conflict check server-side and can fail even though the original request passed it. */
export function respondToExtensionRequest(id: number, approve: boolean): Promise<ExtensionRequestEvent> {
  return apiFetch(`/extension-requests/${id}/respond`, { method: "POST", body: { approve } });
}

/**
 * Piggybacks on apiFetch's existing silent-refresh logic (a cheap authed
 * call) so the socket handshake always carries a live access token, even
 * if the one sitting in storage has since expired.
 */
async function getFreshAccessToken(): Promise<string | null> {
  try {
    await apiFetch("/users/me");
  } catch {
    return null;
  }
  const { accessToken } = await getStoredTokens();
  return accessToken;
}

/**
 * One socket per active session, connected for as long as the session is
 * active regardless of whether the app is minimized — the tick source of
 * truth lives server-side (see mock-meter.ts), so reconnecting after any
 * drop just re-subscribes and immediately receives the correct current
 * state, never a resumed-from-zero one.
 */
export function connectSessionSocket(
  sessionId: number,
  onTick: (tick: SessionTick) => void,
  onEnded: (event: SessionEndedEvent) => void,
  onExtension: (event: ExtensionRequestEvent) => void,
): Socket {
  const socket = io(API_URL, {
    autoConnect: true,
    auth: (callback: (data: { token: string | null }) => void) => {
      getFreshAccessToken().then((token) => callback({ token }));
    },
  });

  socket.on("connect", () => {
    socket.emit("subscribe", { sessionId });
  });

  socket.on("tick", (payload: SessionTick) => {
    if (payload.sessionId === sessionId) onTick(payload);
  });

  socket.on("session:ended", (payload: SessionEndedEvent) => {
    if (payload.sessionId === sessionId) onEnded(payload);
  });

  // Driver and host both receive all three of these from the same room —
  // each screen decides what to render, see SessionContext.
  const handleExtensionEvent = (payload: ExtensionRequestEvent) => {
    if (payload.sessionId === sessionId) onExtension(payload);
  };
  socket.on("extension:requested", handleExtensionEvent);
  socket.on("extension:approved", handleExtensionEvent);
  socket.on("extension:declined", handleExtensionEvent);

  return socket;
}
