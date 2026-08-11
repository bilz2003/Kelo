import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { Charger } from "@kelo/core";
import { startSession, endSession, getActiveSession, connectSessionSocket, EndSessionResponse } from "@/api/sessions";

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
  start: (charger: Charger, bookingId: number) => Promise<void>;
  end: () => Promise<EndSessionResponse>;
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
  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef<number | null>(null);

  const connect = (sessionId: number) => {
    socketRef.current?.disconnect();
    sessionIdRef.current = sessionId;
    socketRef.current = connectSessionSocket(sessionId, (tick) => {
      setKwh(tick.kwh);
      setSeconds(tick.seconds);
    });
  };

  const disconnect = () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    sessionIdRef.current = null;
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

  const start = async (c: Charger, bookingId: number) => {
    const session = await startSession(bookingId);
    setCharger(c);
    setActive(true);
    setVisible(true);
    setKwh(0);
    setSeconds(0);
    connect(session.id);
  };

  const end = async (): Promise<EndSessionResponse> => {
    const sessionId = sessionIdRef.current;
    if (sessionId === null) {
      throw new Error("end() called with no active session");
    }
    const result = await endSession(sessionId);
    disconnect();
    setActive(false);
    setVisible(false);
    setCharger(null);
    setKwh(0);
    setSeconds(0);
    return result;
  };

  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  return (
    <SessionContext.Provider value={{ active, visible, charger, kwh, seconds, start, end, show, hide }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
