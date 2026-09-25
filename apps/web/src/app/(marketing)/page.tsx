import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { EarningsEstimator } from "@/components/EarningsEstimator";
import { HeroParallax } from "@/components/HeroParallax";

// Layout, copy and behaviour follow the finished homepage mockup. Content rules
// that apply to this page: no testimonials, customer logos or user counts (none
// exist), and Kelo's commission figure is never displayed — the estimator shows
// only the host's take-home number.
export default function HomePage() {
  return (
    <div className="home-wrap">
      {/* Nav */}
      <div className="pad nav-row">
        <BrandMark variant="nav" href="/" />
        <div className="nav-links">
          <a href="#how-it-works" className="nav-link">How it works</a>
          <a href="#hosts" className="nav-link">For hosts</a>
          <Link href="/login" className="nav-link nav-login">Log in</Link>
          <Link href="/register" className="nav-get-started">Get started</Link>
        </div>
      </div>

      {/* Hero */}
      <HeroParallax>
        <div className="hero-inner">
          <h1 className="hero-h1">Charging cost, read straight from the meter.</h1>
          <p className="hero-p">Not your battery percentage. Not an estimate. The number on your bill is the number the charger actually recorded.</p>
          <div className="cta-row">
            {/* No store listing exists yet (the app isn't published) — placeholder href, deliberately not a made-up store URL. */}
            <a href="#" className="cta-primary">Download Kelo</a>
          </div>
        </div>
      </HeroParallax>

      {/* The problem */}
      <div className="pad section-pad block-problem">
        <div className="block-narrow">
          <div className="eyebrow">The problem</div>
          <h2 className="h2-problem">Most home-charging apps guess.</h2>
          <p className="p-problem">Most apps estimate cost from a driver-reported battery percentage — before and after, never during. Kelo reads the charger&apos;s own meter directly. The same number, every time, for both sides.</p>
        </div>
      </div>

      {/* How metering works */}
      <div id="how-it-works" className="pad section-pad block-how">
        <div className="how-row">
          <div className="how-copy">
            <div className="eyebrow">How it works</div>
            <h2 className="h2-sm">One reading. Two people. Same number.</h2>
            <p className="p-how">The charger reports straight to Kelo the second a session starts. Energy, time, cost — live, and identical for both sides. What you see mid-session is exactly what gets billed.</p>
          </div>

          {/* An illustration of the app's listing card. The model shown must be one the app currently lets a host add (see CHARGER_MODELS in apps/mobile/src/data/mockChargers.ts) — Ohme/Pod Point are deliberately hidden there for now. */}
          <div className="listing-card" role="img" aria-label="Example charger listing card from the Kelo app">
            <div className="lc-head">
              <div className="lc-avatar">JM</div>
              <div>
                <div className="lc-name">James&apos;s driveway</div>
                <div className="lc-sub">SM5 · 0.4 mi</div>
              </div>
            </div>
            <div className="lc-title">Wallbox Pulsar Plus — 7.4kW</div>
            <div className="lc-spec">Tethered cable · Type 2</div>
            <div className="lc-foot">
              <div>
                <div className="lc-price">£0.34</div>
                <div className="lc-per">per kWh</div>
              </div>
              <div className="lc-book">Book</div>
            </div>
          </div>
        </div>
      </div>

      {/* Drivers / Hosts split */}
      <div id="hosts" className="split">
        <div className="pad split-panel">
          <div className="eyebrow">For drivers</div>
          <h3 className="h3-split">Charge at a real driveway. Pay for what you actually used.</h3>
          <p className="p-split">Browse nearby chargers, book a time, plug in. Billed from the charger&apos;s own reading — never a flat-rate guess.</p>
        </div>
        <div className="pad split-panel">
          <div className="eyebrow">For hosts</div>
          <h3 className="h3-split">List your charger. Set your own rate. Earn while it sits idle.</h3>
          <p className="p-split">Set your own rate per kWh. You only earn when a real session happens — nothing charged upfront.</p>
        </div>
      </div>

      {/* Earnings estimator */}
      <div className="pad section-pad block-est">
        <div className="est-head">
          <div className="eyebrow">Estimate your earnings</div>
          <h2 className="h2-sm h2-est">See what your driveway could bring in.</h2>
          <p className="p-est">Set your own rate, estimate your usage, see a real number.</p>
        </div>
        <EarningsEstimator />
      </div>

      {/* One account */}
      <div className="pad section-pad block-account">
        <div className="eyebrow">One account</div>
        <h2 className="h2-sm h2-account">Drive today. Host tomorrow. Same login, same person.</h2>
        <p className="p-account">One login. Every Kelo account can book a charger and list one — no separate host sign-up.</p>
        <Link href="/register" className="cta-account">Create your account</Link>
      </div>

      {/* Footer */}
      <div className="pad home-footer">
        <BrandMark variant="footer" href={null} />
        <div className="copyright">© {new Date().getFullYear()} Kelo</div>
      </div>
    </div>
  );
}
