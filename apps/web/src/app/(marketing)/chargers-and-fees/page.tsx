import type { Metadata } from "next";
import Link from "next/link";
import {
  ENERGY_COMMISSION,
  IDLE_RATE_MULTIPLIER,
  OVERSTAY_RATE_MULTIPLIER,
  formatServiceCharge,
  getEnabledChargerModels,
  type ChargerModelOption,
} from "@kelo/core";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "Chargers & fees",
  description: "Every charger brand Kelo connects to, and the exact fee structure behind every session.",
};

// Nothing on this page is typed in by hand: the charger list is the same
// CHARGER_MODELS the app's Add Charger picker uses (enabled ones only), and
// every figure below comes from the constants the real pricing logic uses
// (packages/core/src/pricing.ts). Change a flag or a constant there and this
// page follows on the next build.
const percent = (rate: number) => `${Number((rate * 100).toFixed(2))}%`;
const multiplier = (m: number) => `${m}×`;

const ROUTE_BLURB: Record<ChargerModelOption["route"], string> = {
  ocpp: "Direct connection, no third party",
  enode: "Connects through Enode — sign in with your existing charger account",
};

export default function ChargersAndFeesPage() {
  const models = getEnabledChargerModels();

  return (
    <div className="home-wrap">
      <SiteNav />

      <div className="pad fees-head">
        <div className="eyebrow">Chargers &amp; fees</div>
        <h1 className="fees-h1">What&apos;s supported, and exactly what it costs.</h1>
        <p className="fees-lede">No hidden fees, no vague percentages. Here&apos;s every charger brand Kelo currently connects to, and the exact fee structure behind every session.</p>
      </div>

      <div className="pad fees-block">
        <h2 className="fees-h2">Supported chargers</h2>
        <div className="model-grid">
          {models.map((m) => (
            <div key={m.title} className="model-card">
              <div className="model-title">{m.title}</div>
              <div className="model-route">{ROUTE_BLURB[m.route]}</div>
            </div>
          ))}
        </div>
        <p className="fees-note">
          Don&apos;t see your charger? We&apos;re actively working on adding more brands — <Link href="/register">get in touch</Link> and we&apos;ll let you know when it&apos;s ready.
        </p>
      </div>

      <div className="pad fees-block fees-tint">
        <h2 className="fees-h2 fees-h2-tight">How fees work</h2>
        <p className="fees-intro">Every fee is derived from the host&apos;s own kWh rate — nothing is a flat, arbitrary charge unrelated to what&apos;s actually being used.</p>

        <div className="fee-box">
          <ul className="fee-list">
            <li>Energy delivered — Kelo&apos;s commission on the host&apos;s own rate: <strong className="fee-fig">{percent(ENERGY_COMMISSION)}</strong></li>
            <li>Idle occupancy — if a car stays plugged in once fully charged, still within the booking: <strong className="fee-fig">{multiplier(IDLE_RATE_MULTIPLIER)} rate</strong></li>
            <li>Overstay — if a car stays beyond the booked time, after a grace period: <strong className="fee-fig">{multiplier(OVERSTAY_RATE_MULTIPLIER)} rate</strong></li>
            <li>Service charge — a flat charge on every booking, shown before you confirm: <strong className="fee-fig fee-fig-plain">{formatServiceCharge()}</strong></li>
          </ul>
        </div>

        <p className="fee-foot">Both idle occupancy and overstay rates are calculated automatically from the host&apos;s own kWh price and the charger&apos;s power rating — a host never sets these directly, so they always stay in fair proportion to what a session is actually worth.</p>
      </div>

      <SiteFooter />
    </div>
  );
}
