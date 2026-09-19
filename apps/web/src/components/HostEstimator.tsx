"use client";

import { useState } from "react";
import { ENERGY_COMMISSION, IDLE_RATE_MULTIPLIER, OVERSTAY_RATE_MULTIPLIER, deriveIdleAndOverstayRates } from "@kelo/core";
import { energySplit, gbp } from "@/lib/money";

const POWERS = [3.6, 7.4, 11, 22];

// The inputs are the visitor's own assumptions — the defaults are starting
// points, not statistics about typical hosts (Kelo has no such data yet).
export function HostEstimator() {
  const [rate, setRate] = useState(0.3);
  const [powerKw, setPowerKw] = useState(7.4);
  const [sessions, setSessions] = useState(8);
  const [kwhEach, setKwhEach] = useState(12);
  const [cost, setCost] = useState(0.15);

  const totalKwh = sessions * kwhEach;
  const { paid, commission, received } = energySplit(totalKwh, rate, powerKw);
  const electricity = Math.round(totalKwh * cost * 100) / 100;
  const margin = Math.round((received - electricity) * 100) / 100;
  const { idleRate, overstayRate } = deriveIdleAndOverstayRates(rate, powerKw);

  return (
    <div className="grid-2">
      <div className="col-5 calc-inputs">
        <span className="label">Your assumptions</span>

        <div>
          <div className="row"><label className="label" htmlFor="est-rate">Your rate</label><span className="val">{gbp(rate)} / kWh</span></div>
          <input id="est-rate" type="range" min={0.1} max={1} step={0.01} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
        </div>
        <div>
          <div className="row"><label className="label" htmlFor="est-power">Charger power</label><span className="val">{powerKw} kW</span></div>
          <select id="est-power" className="input mono-input" value={powerKw} onChange={(e) => setPowerKw(Number(e.target.value))}>
            {POWERS.map((p) => <option key={p} value={p}>{p} kW</option>)}
          </select>
        </div>
        <div>
          <div className="row"><label className="label" htmlFor="est-sessions">Sessions per month</label><span className="val">{sessions}</span></div>
          <input id="est-sessions" type="range" min={1} max={60} step={1} value={sessions} onChange={(e) => setSessions(Number(e.target.value))} />
        </div>
        <div>
          <div className="row"><label className="label" htmlFor="est-kwh">Energy per session</label><span className="val">{kwhEach} kWh</span></div>
          <input id="est-kwh" type="range" min={2} max={60} step={1} value={kwhEach} onChange={(e) => setKwhEach(Number(e.target.value))} />
        </div>
        <div>
          <div className="row"><label className="label" htmlFor="est-cost">Your electricity cost (private)</label><span className="val">{gbp(cost)} / kWh</span></div>
          <input id="est-cost" type="range" min={0} max={1} step={0.01} value={cost} onChange={(e) => setCost(Number(e.target.value))} />
        </div>
      </div>

      <div className="col-7">
        <div className="stmt" aria-live="polite">
          <div className="stmt-head"><span className="label">Monthly estimate</span><span className="label">Energy charges only</span></div>
          <div className="stmt-body">
            <div className="stmt-row"><span className="k">Energy delivered</span><span className="v">{totalKwh} kWh</span></div>
            <div className="stmt-row"><span className="k">Drivers pay</span><span className="v">{gbp(paid)}</span></div>
            <div className="stmt-row"><span className="k">Kelo commission ({Math.round(ENERGY_COMMISSION * 100)}%)</span><span className="v">−{gbp(commission)}</span></div>
            <div className="stmt-row"><span className="k">You receive</span><span className="v">{gbp(received)}</span></div>
            <div className="stmt-row"><span className="k">Your electricity ({totalKwh} kWh × {gbp(cost)})</span><span className="v">−{gbp(electricity)}</span></div>
            <div className="stmt-row total"><span className="k">Left after electricity</span><span className="v">{gbp(margin)}</span></div>
          </div>
          <div className="stmt-foot">
            Arithmetic from Kelo&rsquo;s real pricing code, on numbers you chose &mdash; not a forecast. Idle and overstay charges, when they
            occur, are additional and not included.
          </div>
        </div>
        <p className="hint" style={{ marginTop: 18, maxWidth: "40em" }}>
          At {gbp(rate)}/kWh on a {powerKw} kW charger, Kelo sets idle occupancy at {gbp(idleRate)}/min ({IDLE_RATE_MULTIPLIER}&times; your rate at full power)
          and overstay at {gbp(overstayRate)}/min ({OVERSTAY_RATE_MULTIPLIER}&times;) &mdash; derived automatically, never set by hand.
        </p>
      </div>
    </div>
  );
}
