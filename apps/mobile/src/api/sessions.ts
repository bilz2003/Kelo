import { io, Socket } from "socket.io-client";
import { Charger } from "@kelo/core";
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

export interface StartSessionResponse {
  id: number;
  bookingId: number;
  startedAt: string;
}

export interface EndSessionResponse {
  kwh: number;
  seconds: number;
  idleChargesActive: boolean;
  idleMinutesElapsed: number;
  idleCost: number;
  energyCost: number;
  totalCost: number;
  hostNet: number;
}

export interface ActiveSessionResponse {
  id: number;
  bookingId: number;
  startedAt: string;
  kwh: number;
  seconds: number;
  charger: Charger;
}

export function startSession(bookingId: number): Promise<StartSessionResponse> {
  return apiFetch(`/sessions/${bookingId}/start`, { method: "POST" });
}

export function endSession(sessionId: number): Promise<EndSessionResponse> {
  return apiFetch(`/sessions/${sessionId}/end`, { method: "POST" });
}

export function getActiveSession(): Promise<ActiveSessionResponse | null> {
  return apiFetch("/sessions/active");
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
export function connectSessionSocket(sessionId: number, onTick: (tick: SessionTick) => void): Socket {
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

  return socket;
}
