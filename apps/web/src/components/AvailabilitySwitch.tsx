"use client";

import { useState } from "react";

export function AvailabilitySwitch({ chargerId, initial }: { chargerId: number; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (busy) return;
    const next = !on;
    setBusy(true);
    setError(null);
    setOn(next); // optimistic; rolled back below if the save fails
    try {
      const res = await fetch(`/api/chargers/${chargerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: next }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? "Couldn't update availability");
    } catch (e) {
      setOn(!next);
      setError(e instanceof Error ? e.message : "Couldn't update availability");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button type="button" role="switch" aria-checked={on} className="switch" onClick={toggle} disabled={busy}>
        <span className="track"><span className="thumb" /></span>
        <span>{on ? "Available for booking" : "Not available"}</span>
      </button>
      {error && <span className="danger" style={{ fontSize: 12 }} role="alert">{error}</span>}
    </span>
  );
}
