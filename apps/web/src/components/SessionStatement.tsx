"use client";

import { useState } from "react";
import { ENERGY_COMMISSION } from "@kelo/core";
import { energySplit, gbp } from "@/lib/money";

// Every figure below is an EXAMPLE — a made-up meter register and a made-up
// rate — and the card says so. What's real is the arithmetic: it runs
// @kelo/core's computeSessionFinancials, the same function that prices real
// sessions.
const METER_START = 12408.31;
const EXAMPLE_RATE = 0.3;

export function SessionStatement() {
  const [kwh, setKwh] = useState(10.3);
  const stop = METER_START + kwh;
  const { paid, commission, received } = energySplit(kwh, EXAMPLE_RATE);
  const fmt = (n: number) => n.toLocaleString("en-GB", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  return (
    <div className="stmt" aria-label="Example session statement">
      <div className="stmt-head">
        <span className="label">Session statement</span>
        <span className="label">Example</span>
      </div>
      <div className="stmt-control">
        <div className="row">
          <label className="label" htmlFor="kwh-slider">Energy delivered</label>
          <span className="mono" style={{ fontSize: 13 }}>{kwh.toFixed(1)} kWh</span>
        </div>
        <input id="kwh-slider" type="range" min={1} max={40} step={0.5} value={kwh} onChange={(e) => setKwh(Number(e.target.value))} />
      </div>
      <div className="stmt-body">
        <div className="stmt-row"><span className="k">Meter at start</span><span className="v">{fmt(METER_START)} kWh</span></div>
        <div className="stmt-row"><span className="k">Meter at stop</span><span className="v">{fmt(stop)} kWh</span></div>
        <div className="stmt-row"><span className="k">Delivered (stop − start)</span><span className="v">{kwh.toFixed(3)} kWh</span></div>
        <div className="stmt-row"><span className="k">Rate</span><span className="v">{gbp(EXAMPLE_RATE)} / kWh</span></div>
        <div className="stmt-row"><span className="k">Driver pays</span><span className="v">{gbp(paid)}</span></div>
        <div className="stmt-row"><span className="k">Kelo commission ({Math.round(ENERGY_COMMISSION * 100)}%)</span><span className="v">−{gbp(commission)}</span></div>
        <div className="stmt-row total"><span className="k">Host receives</span><span className="v">{gbp(received)}</span></div>
      </div>
      <div className="stmt-foot">
        Illustrative session: the meter readings and the rate are invented for this example. The arithmetic is Kelo&rsquo;s real pricing code.
      </div>
    </div>
  );
}
