import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Charger } from "@kelo/core";
import { SESSION_FULL_AT_SECONDS } from "@kelo/core";

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
  start: (charger: Charger) => void;
  end: () => void;
  stopTicking: () => void;
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // The live tick lives here, above both the driver's ActiveSession screen
  // and the host's "Charging now" card in My Chargers, so a session
  // survives navigating away/minimizing and both views agree on the numbers.
  useEffect(() => {
    if (!active || !charger) return;
    const perSecond = (charger.powerNum / 3600) * 40; // accelerated for live demo
    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        const next = s + 1;
        setKwh((k) => (next <= SESSION_FULL_AT_SECONDS ? +(k + perSecond).toFixed(3) : k));
        return next;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, charger?.id]);

  const start = (c: Charger) => {
    setCharger(c);
    setActive(true);
    setVisible(true);
    setKwh(0);
    setSeconds(0);
  };

  const stopTicking = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const end = () => {
    stopTicking();
    setActive(false);
    setVisible(false);
    setCharger(null);
    setKwh(0);
    setSeconds(0);
  };

  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  return (
    <SessionContext.Provider value={{ active, visible, charger, kwh, seconds, start, end, stopTicking, show, hide }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
