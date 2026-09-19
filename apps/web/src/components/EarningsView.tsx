"use client";

import { useEffect, useMemo, useState } from "react";
import { addMonths, endOfMonth, formatRangeLabel, monthLabel, startOfMonth } from "@kelo/core";
import type { ChargerStats } from "@/lib/types";
import { gbp } from "@/lib/money";

type Mode = "month" | "last3" | "year" | "all" | "custom";

interface Range {
  start: Date;
  end: Date;
  label: string;
}

const MODES: { id: Mode; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "last3", label: "Last 3 months" },
  { id: "year", label: "This year" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom range" },
];

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// <input type="date"> yields YYYY-MM-DD; parse it as LOCAL midnight (new Date("YYYY-MM-DD") would be UTC).
const fromIsoDay = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

async function fetchStats(range: { start: Date; end: Date }, signal?: AbortSignal): Promise<ChargerStats> {
  const qs = new URLSearchParams({ start: range.start.toISOString(), end: range.end.toISOString() });
  const res = await fetch(`/api/stats?${qs.toString()}`, { signal });
  if (res.status === 401) {
    // Session is gone and couldn't be refreshed — go to login.
    window.location.assign("/login?reason=expired");
    throw new Error("Session expired");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(Array.isArray(data?.message) ? data.message.join(", ") : (data?.message ?? "Couldn't load your earnings."));
  return data as ChargerStats;
}

export function EarningsView() {
  // Dates are computed only after mount: the server render has a different
  // "now" from the browser's, and a range label built at render time would
  // mismatch on hydration.
  const [now, setNow] = useState<Date | null>(null);
  const [mode, setMode] = useState<Mode>("month");
  const [monthAnchor, setMonthAnchor] = useState<Date | null>(null);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [stats, setStats] = useState<ChargerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState<{ label: string; earned: number }[] | null>(null);

  useEffect(() => {
    const d = new Date();
    setNow(d);
    setMonthAnchor(startOfMonth(d));
    setCustomTo(isoDay(d));
    setCustomFrom(isoDay(startOfMonth(d)));
  }, []);

  const range: Range | null = useMemo(() => {
    if (!now || !monthAnchor) return null;
    switch (mode) {
      case "month":
        return { start: startOfMonth(monthAnchor), end: endOfMonth(monthAnchor), label: monthLabel(monthAnchor) };
      case "last3": {
        const start = startOfMonth(addMonths(now, -2));
        return { start, end: endOfMonth(now), label: `${monthLabel(start)} – ${monthLabel(now)}` };
      }
      case "year":
        return { start: new Date(now.getFullYear(), 0, 1), end: endOfMonth(new Date(now.getFullYear(), 11, 1)), label: String(now.getFullYear()) };
      case "all":
        return { start: new Date(2000, 0, 1), end: new Date(2100, 0, 1), label: "All time" };
      case "custom": {
        if (!customFrom || !customTo) return null;
        const start = fromIsoDay(customFrom);
        const endDay = fromIsoDay(customTo);
        const end = new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate(), 23, 59, 59, 999);
        if (end < start) return null;
        return { start, end, label: formatRangeLabel(start, end) };
      }
    }
  }, [mode, now, monthAnchor, customFrom, customTo]);

  useEffect(() => {
    if (!range) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetchStats(range, ctrl.signal)
      .then((s) => setStats(s))
      .catch((e) => {
        if (e?.name !== "AbortError") setError(e instanceof Error ? e.message : "Couldn't load your earnings.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [range]);

  // Last six calendar months, one real stats call each (same endpoint).
  useEffect(() => {
    if (!now) return;
    const ctrl = new AbortController();
    const starts = [5, 4, 3, 2, 1, 0].map((back) => addMonths(now, -back));
    Promise.all(starts.map((m) => fetchStats({ start: startOfMonth(m), end: endOfMonth(m) }, ctrl.signal).then((s) => ({ label: monthLabel(m), earned: s.earned }))))
      .then(setMonths)
      .catch(() => setMonths(null));
    return () => ctrl.abort();
  }, [now]);

  const hasActivity = !!stats && (stats.sessions > 0 || stats.kwh > 0 || stats.earned > 0);
  const atCurrentMonth = !!monthAnchor && !!now && monthAnchor >= startOfMonth(now);
  const maxMonth = months ? Math.max(...months.map((m) => m.earned), 0) : 0;

  return (
    <div>
      <div className="period" role="group" aria-label="Period">
        {MODES.map((m) => (
          <button key={m.id} type="button" className="chip" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>{m.label}</button>
        ))}
      </div>

      {mode === "month" && monthAnchor && (
        <div className="stepper">
          <button type="button" aria-label="Previous month" onClick={() => setMonthAnchor((a) => (a ? addMonths(a, -1) : a))}>‹</button>
          <span className="cur">{monthLabel(monthAnchor)}</span>
          <button type="button" aria-label="Next month" disabled={atCurrentMonth} onClick={() => setMonthAnchor((a) => (a ? addMonths(a, 1) : a))}>›</button>
        </div>
      )}
      {mode === "custom" && (
        <div className="range-row">
          <label className="label" htmlFor="from">From</label>
          <input id="from" className="input mono-input" type="date" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} />
          <label className="label" htmlFor="to">To</label>
          <input id="to" className="input mono-input" type="date" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} />
        </div>
      )}

      <p className="label" style={{ marginTop: 26 }}>Across all chargers · {range?.label ?? "…"}</p>

      {error ? (
        <div className="empty" style={{ marginTop: 14 }}><p>{error}</p></div>
      ) : (
        <>
          <div className="stat-tiles" aria-busy={loading}>
            <div className="stat-tile"><span className="label">Sessions</span><div className="num">{stats && !loading ? stats.sessions : "—"}</div></div>
            <div className="stat-tile"><span className="label">Energy delivered</span><div className="num">{stats && !loading ? stats.kwh.toFixed(1) : "—"}{stats && !loading && <small>kWh</small>}</div></div>
            <div className="stat-tile"><span className="label">Earned</span><div className="num">{stats && !loading ? gbp(stats.earned) : "—"}</div></div>
          </div>
          {!loading && stats && !hasActivity && (
            <p className="soft" style={{ marginTop: 18 }}>
              {mode === "all" ? "No earnings yet." : `No earnings in ${range?.label}.`} Completed sessions across your chargers show here once drivers have charged.
            </p>
          )}
          <p className="hint" style={{ marginTop: 14 }}>
            Sessions and energy are counted from completed sessions that ended in the period. Earned is what you receive after Kelo&rsquo;s commission.
          </p>
        </>
      )}

      {months && (
        <div className="bars">
          <span className="label">Earned per month · last 6 months</span>
          <div style={{ marginTop: 10 }}>
            {months.map((m) => (
              <div className="bar-row" key={m.label}>
                <span className="soft">{m.label}</span>
                <span className="bar-track"><span className="bar-fill" style={{ display: "block", width: maxMonth > 0 ? `${(m.earned / maxMonth) * 100}%` : "0%" }} /></span>
                <span className="amt">{gbp(m.earned)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
