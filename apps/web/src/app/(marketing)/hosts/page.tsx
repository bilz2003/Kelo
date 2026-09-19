import type { Metadata } from "next";
import Link from "next/link";
import { ENERGY_COMMISSION, IDLE_COMMISSION, OVERSTAY_COMMISSION } from "@kelo/core";
import { HostEstimator } from "@/components/HostEstimator";

export const metadata: Metadata = {
  title: "For hosts",
  description: "What a Kelo host earns: you set the rate per kWh, Kelo takes a fixed commission. Work it out from your own numbers.",
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

// FIRST-DRAFT COPY.
export default function HostsPage() {
  return (
    <>
      <section className="page hero" style={{ paddingBottom: 40 }}>
        <div className="eyebrow"><span className="label">For hosts</span></div>
        <h1 className="display h1" style={{ maxWidth: "12em" }}>What you&rsquo;d earn, from your own numbers.</h1>
        <p className="lede">
          You set the price per kWh. Kelo takes a fixed commission on what drivers pay &mdash; you keep the rest. Move the sliders to match your
          charger and see the arithmetic.
        </p>
      </section>

      <section className="page section" style={{ paddingTop: 24 }}>
        <div className="rule-head"><span className="label">Estimator</span></div>
        <HostEstimator />
      </section>

      <section className="page section" style={{ paddingTop: 0 }}>
        <div className="rule-head"><span className="label">The commission, in full</span></div>
        <div className="grid-2">
          <div className="col-6">
            <table className="table">
              <thead>
                <tr><th className="label">Charge</th><th className="label num">Kelo commission</th></tr>
              </thead>
              <tbody>
                <tr><td className="what">Energy delivered<small>Metered kWh &times; your rate</small></td><td className="num">{pct(ENERGY_COMMISSION)}</td></tr>
                <tr><td className="what">Idle occupancy<small>From the moment charging finishes, within the booking</small></td><td className="num">{pct(IDLE_COMMISSION)}</td></tr>
                <tr><td className="what">Overstay<small>After the booked end time, plus a 15-minute grace</small></td><td className="num">{pct(OVERSTAY_COMMISSION)}</td></tr>
                <tr><td className="what">Late-cancellation / no-show fee<small>Goes entirely to the host</small></td><td className="num">0%</td></tr>
              </tbody>
            </table>
          </div>
          <div className="col-6 prose">
            <p><b>What you control.</b> Your rate per kWh, whether a charger is available for booking, the late-cancellation fee, the listing name and photos, and whether the driver or you provides the cable.</p>
            <p><b>What&rsquo;s automatic.</b> Idle and overstay rates are derived from your rate and your charger&rsquo;s power. Every charge is computed from the charger&rsquo;s own meter reading.</p>
            <p><b>What stays private.</b> Your electricity cost is optional, is never shown to drivers, and exists so Kelo can show your real profit.</p>
          </div>
        </div>
      </section>

      <section className="page section" style={{ paddingTop: 0 }}>
        <div className="rule-head"><span className="label">Start</span></div>
        <div className="grid-2" style={{ alignItems: "end" }}>
          <h2 className="display h2 col-7">Create your account, then add your charger in the app.</h2>
          <div className="col-5" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/register" className="btn btn-primary">Create an account</Link>
            <Link href="/metering" className="btn btn-ghost">How metering works</Link>
          </div>
        </div>
      </section>
    </>
  );
}
