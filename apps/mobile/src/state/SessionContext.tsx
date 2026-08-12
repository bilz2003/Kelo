import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { Charger } from "@kelo/core";
import {
  startSession,
  simulateUnplug,
  getActiveSession,
  connectSessionSocket,
  requestExtension as requestExtensionApi,
  respondToExtensionRequest,
  SessionEndedEvent,
  ExtensionRequestEvent,
} from "@/api/sessions";

interface SessionContextValue {
  active: boolean;
  // Whether the ActiveSession screen is the one currently on top, vs the
  // session running minimized behind the tab bar (see the "Live session in
  // progress" banner in RootNavigator). Distinct from `active`, which just
  // means a session exists at all — mirrors sessionActive/sessionVisible
  // in the web prototype.
  visible: boolean;
  charger: Charger | null;
  kwh: number;
  seconds: number;
  // The receipt from the most recent session:ended event — the ONLY thing
  // that drives the receipt view. There is no client-triggered "end" call
  // that resolves with a result; ending only ever happens because this
  // event arrived (see simulateUnplug below).
  lastReceipt: SessionEndedEvent | null;
  // Shared between driver and host views, exactly like kwh/seconds already
  // are — the driver's ActiveSessionScreen shows "waiting"/outcome from
  // this, the host's MyChargersScreen live card shows approve/decline from
  // the same field. Both are driven purely by extension:* socket events
  // (plus reconnect hydration), never by local button-tap state.
  pendingExtension: ExtensionRequestEvent | null;
  // The booking's current window — bookingEndAt moves forward the moment
  // an extension:approved event arrives, so a picker opened right after
  // approval bounds itself against the real current end, not a stale one.
  bookingArrivalAt: Date | null;
  bookingEndAt: Date | null;
  start: (charger: Charger, bookingId: number, arrivalAt: Date, endAt: Date) => Promise<void>;
  // Mock-only test trigger, standing in for a real hardware unplug signal.
  // Fire-and-forget: it doesn't return the receipt, doesn't touch local
  // state — the session:ended event handler (wired in connect()) is what
  // actually updates active/lastReceipt, exactly as it would for a real
  // unplug the app didn't itself request.
  simulateUnplug: () => Promise<void>;
  clearReceipt: () => void;
  // Driver-side: fire-and-forget, same pattern as simulateUnplug — the
  // extension:requested event (received on this same socket, since the
  // requester is also a room subscriber) is what actually sets
  // pendingExtension, not this call's return value.
  requestExtension: (newEndAt: Date) => Promise<void>;
  // Host-side: fire-and-forget for the same reason — extension:approved/
  // declined coming back over the socket is what updates pendingExtension.
  respondToExtension: (approve: boolean) => Promise<void>;
  clearExtensionOutcome: () => void;
  show: () => void;
  hide: () => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState(false);
  const [charger, setCharger] = useState<Charger | null>(null);
  const [kwh, setKwh] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [lastReceipt, setLastReceipt] = useState<SessionEndedEvent | null>(null);
  const [pendingExtension, setPendingExtension] = useState<ExtensionRequestEvent | null>(null);
  const [bookingArrivalAt, setBookingArrivalAt] = useState<Date | null>(null);
  const [bookingEndAt, setBookingEndAt] = useState<Date | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef<number | null>(null);
  const bookingIdRef = useRef<number | null>(null);

  const disconnect = () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    sessionIdRef.current = null;
    bookingIdRef.current = null;
  };

  // The only place a session ever transitions to "ended" — driven purely
  // by the event arriving over the socket, never by a local button-tap
  // resolving a promise. Same handler whether the app requested the mock
  // unplug itself, another connection (e.g. a host session) did, or a real
  // hardware signal eventually does.
  const handleEnded = (event: SessionEndedEvent) => {
    setLastReceipt(event);
    setActive(false);
    setVisible(false);
    setCharger(null);
    setKwh(0);
    setSeconds(0);
    setPendingExtension(null);
    setBookingArrivalAt(null);
    setBookingEndAt(null);
    disconnect();
  };

  const handleExtensionEvent = (event: ExtensionRequestEvent) => {
    setPendingExtension(event);
    if (event.status === "approved") {
      setBookingEndAt(new Date(event.requestedEndAt));
    }
  };

  const connect = (sessionId: number) => {
    socketRef.current?.disconnect();
    sessionIdRef.current = sessionId;
    socketRef.current = connectSessionSocket(
      sessionId,
      (tick) => {
        setKwh(tick.kwh);
        setSeconds(tick.seconds);
      },
      handleEnded,
      handleExtensionEvent,
    );
  };

  // Backend-authoritative reconnect: on a fresh launch (including after
  // the app was force-quit mid-session), ask whether the signed-in driver
  // has a session still running server-side. If so, resume showing it —
  // minimized, not auto-opened — with its real current elapsed state
  // rather than starting blank. The mock adapter keeps ticking the whole
  // time regardless of whether anything is subscribed, so this is a real
  // resume, not a restart.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const activeSession = await getActiveSession();
        if (cancelled || !activeSession) return;
        setCharger(activeSession.charger);
        setKwh(activeSession.kwh);
        setSeconds(activeSession.seconds);
        setActive(true);
        setVisible(false);
        bookingIdRef.current = activeSession.bookingId;
        setBookingArrivalAt(new Date(activeSession.arrivalAt));
        setBookingEndAt(new Date(activeSession.endAt));
        if (activeSession.pendingExtension) {
          setPendingExtension({
            id: activeSession.pendingExtension.id,
            bookingId: activeSession.bookingId,
            sessionId: activeSession.id,
            requestedEndAt: activeSession.pendingExtension.requestedEndAt,
            status: "pending",
          });
        }
        connect(activeSession.id);
      } catch {
        // No valid session yet (e.g. not logged in) — nothing to resume.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => disconnect, []);

  const start = async (c: Charger, bookingId: number, arrivalAt: Date, endAt: Date) => {
    const session = await startSession(bookingId);
    setLastReceipt(null);
    setPendingExtension(null);
    setCharger(c);
    setActive(true);
    setVisible(true);
    setKwh(0);
    setSeconds(0);
    bookingIdRef.current = bookingId;
    setBookingArrivalAt(arrivalAt);
    setBookingEndAt(endAt);
    connect(session.id);
  };

  const triggerSimulateUnplug = async () => {
    const sessionId = sessionIdRef.current;
    if (sessionId === null) {
      throw new Error("simulateUnplug() called with no active session");
    }
    // Deliberately not using the response here — see the doc comment on
    // the context value above.
    await simulateUnplug(sessionId);
  };

  const triggerRequestExtension = async (newEndAt: Date) => {
    const bookingId = bookingIdRef.current;
    if (bookingId === null) {
      throw new Error("requestExtension() called with no active booking");
    }
    await requestExtensionApi(bookingId, newEndAt);
  };

  const triggerRespondToExtension = async (approve: boolean) => {
    if (!pendingExtension) {
      throw new Error("respondToExtension() called with no pending request");
    }
    await respondToExtensionRequest(pendingExtension.id, approve);
  };

  const clearReceipt = () => setLastReceipt(null);
  const clearExtensionOutcome = () => setPendingExtension(null);

  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  return (
    <SessionContext.Provider
      value={{
        active,
        visible,
        charger,
        kwh,
        seconds,
        lastReceipt,
        pendingExtension,
        bookingArrivalAt,
        bookingEndAt,
        start,
        simulateUnplug: triggerSimulateUnplug,
        clearReceipt,
        requestExtension: triggerRequestExtension,
        respondToExtension: triggerRespondToExtension,
        clearExtensionOutcome,
        show,
        hide,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
