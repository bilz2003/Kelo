"use client";

import { useState } from "react";
import { ENERGY_COMMISSION } from "@kelo/core";

// The host's share of every energy charge, derived from the SAME commission
// constant the backend prices real sessions with (packages/core/pricing.ts) —
// so this can never drift from what a host is actually paid. The split itself
// is deliberately never displayed on this public page: only the take-home
// figure is shown.
const HOST_SHARE = 1 - ENERGY_COMMISSION;

const RATE = { min: 0.1, max: 1.0 };
const KWH = { min: 0, max: 2000 };
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * "Estimate your earnings" card. Two inputs, each a slider AND a typeable number:
 *  - slider moves  -> its number updates;
 *  - number typed  -> its slider follows (clamped to the slider's range), but the
 *    typed value itself is left alone, so someone can type past the slider's
 *    visual ceiling if they want to.
 * Output = rate x kWh x HOST_SHARE, shown to the penny; negative typed values
 * are floored at zero for display.
 */
export function EarningsEstimator() {
  const [rateText, setRateText] = useState("0.30");
  const [kwhText, setKwhText] = useState("100");
  const [rateSlider, setRateSlider] = useState(0.3);
  const [kwhSlider, setKwhSlider] = useState(100);

  const rate = parseFloat(rateText) || 0;
  const kwh = parseFloat(kwhText) || 0;
  const earnings = Math.max(0, rate * kwh * HOST_SHARE);

  return (
    <div className="est-card">
      <div className="est-row">
        <label htmlFor="est-rate-num">Your rate (£ / kWh)</label>
        <input
          id="est-rate-num" className="est-num" type="number" step="0.01" min="0.10" max="1.00" value={rateText}
          onChange={(e) => {
            setRateText(e.target.value);
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) setRateSlider(clamp(v, RATE.min, RATE.max));
          }}
        />
      </div>
      <input
        id="est-rate" className="est-slider" type="range" min="0.10" max="1.00" step="0.01" value={rateSlider} aria-label="Your rate in pounds per kWh"
        onChange={(e) => { setRateSlider(Number(e.target.value)); setRateText(e.target.value); }}
      />

      <div className="est-row">
        <label htmlFor="est-kwh-num">Estimated usage (kWh / month)</label>
        <input
          id="est-kwh-num" className="est-num" type="number" step="10" min="0" max="2000" value={kwhText}
          onChange={(e) => {
            setKwhText(e.target.value);
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) setKwhSlider(clamp(v, KWH.min, KWH.max));
          }}
        />
      </div>
      <input
        id="est-kwh" className="est-slider" type="range" min="0" max="2000" step="10" value={kwhSlider} aria-label="Estimated usage in kWh per month"
        onChange={(e) => { setKwhSlider(Number(e.target.value)); setKwhText(e.target.value); }}
      />

      <div className="est-result" aria-live="polite">
        <div className="est-result-label">Estimated monthly earnings</div>
        <div id="est-output" className="est-output">£{earnings.toFixed(2)}</div>
      </div>
    </div>
  );
}
