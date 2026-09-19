import Link from "next/link";
import { ENERGY_COMMISSION, IDLE_COMMISSION, OVERSTAY_COMMISSION } from "@kelo/core";
import { SessionStatement } from "@/components/SessionStatement";

const pct = (n: number) => `${Math.round(n * 100)}%`;

// FIRST-DRAFT COPY — written from what the product actually does today, for
// review. Nothing here is a testimonial, a customer count, or a claim about
// hardware compatibility that hasn't been proven.
export default function HomePage() {
  return (
    <>
      <section className="page hero">
        <div className="grid-2">
          <div className="col-7">
            <div className="eyebrow"><span className="label">EV charging, priced by the meter</span></div>
            <h1 className="display h1">Billed from the meter, not from a guess.</h1>
            <p className="lede">
              Kelo connects drivers with home chargers. Every session is billed from the charger&rsquo;s own meter reading,
              so what a driver pays &mdash; and what a host earns &mdash; is exactly the energy that was delivered.
            </p>
            <div className="hero-actions">
              <Link href="/register" className="btn btn-primary">Create a host account</Link>
              <Link href="/metering" className="btn btn-ghost">How metering works</Link>
            </div>
          </div>
          <div className="col-5">
            <SessionStatement />
          </div>
        </div>
      </section>

      <section className="page section" style={{ paddingTop: 0 }}>
        <div className="rule-head"><span className="label">01 &mdash; Measurement</span></div>
        <div className="grid-2" style={{ marginBottom: 48 }}>
          <h2 className="display h2 col-7">The number on the statement is the number on the meter.</h2>
          <p className="prose col-5">
            Most charging is billed from a time slot or a flat estimate. On Kelo the charger reports its own energy
            register, and the session is settled from the difference between the reading at the start and at the stop.
          </p>
        </div>
        <div className="ledger">
          <div className="ledger-row">
            <span className="n">01</span>
            <h3>The driver confirms in the app</h3>
            <p>Kelo then sends the charger a start command. A charger can&rsquo;t begin a Kelo session on its own &mdash; there has to be a matching request.</p>
          </div>
          <div className="ledger-row">
            <span className="n">02</span>
            <h3>The charger reports its own meter</h3>
            <p>Readings come straight from the charger over OCPP 1.6-J, the open standard chargers speak. Kelo doesn&rsquo;t estimate energy from time or power ratings.</p>
          </div>
          <div className="ledger-row">
            <span className="n">03</span>
            <h3>The statement is the difference</h3>
            <p>Energy delivered is the final reading minus the starting one. Cost is that energy times the host&rsquo;s rate &mdash; nothing added, nothing rounded up to a slot.</p>
          </div>
        </div>
        <p style={{ marginTop: 28 }}><Link className="link" href="/metering">Read the full flow, message by message</Link></p>
      </section>

      <section className="page section" style={{ paddingTop: 0 }}>
        <div className="rule-head"><span className="label">02 &mdash; For hosts</span></div>
        <div className="grid-2">
          <div className="col-6">
            <h2 className="display h2">You set the price per kWh. Kelo&rsquo;s commission comes out of what the driver pays.</h2>
            <p className="prose" style={{ marginTop: 24 }}>
              Idle-occupancy and overstay rates are worked out automatically from your rate and your charger&rsquo;s power, so
              there&rsquo;s nothing extra to price. Your own electricity cost stays private, and lets Kelo show your real profit per session.
            </p>
            <p style={{ marginTop: 28 }}><Link className="link" href="/hosts">Work out what you&rsquo;d earn</Link></p>
          </div>
          <div className="col-6">
            <table className="table">
              <thead>
                <tr><th className="label">Charge</th><th className="label num">Kelo commission</th></tr>
              </thead>
              <tbody>
                <tr><td className="what">Energy delivered</td><td className="num">{pct(ENERGY_COMMISSION)}</td></tr>
                <tr><td className="what">Idle occupancy<small>Car finished charging, still in the bay</small></td><td className="num">{pct(IDLE_COMMISSION)}</td></tr>
                <tr><td className="what">Overstay<small>Running past the booked end time</small></td><td className="num">{pct(OVERSTAY_COMMISSION)}</td></tr>
                <tr><td className="what">Late-cancellation / no-show fee<small>Paid to the host in full</small></td><td className="num">0%</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="page section" style={{ paddingTop: 0 }}>
        <div className="rule-head"><span className="label">03 &mdash; One account</span></div>
        <h2 className="display h2" style={{ maxWidth: "18em", marginBottom: 40 }}>One login for the app and the web.</h2>
        <div className="surfaces">
          <div>
            <span className="label">In the Kelo app</span>
            <ul>
              <li><b>Find and book</b> a charger near you</li>
              <li><b>Charge</b> with a live view of the session</li>
              <li><b>Add a charger</b> &mdash; connect it and verify it&rsquo;s online</li>
              <li><b>Watch your own chargers</b> as drivers use them</li>
            </ul>
          </div>
          <div>
            <span className="label">On the web</span>
            <ul>
              <li><b>Edit listings</b> &mdash; name, photos, cable, pricing</li>
              <li><b>Turn a charger on or off</b> for bookings</li>
              <li><b>See what you&rsquo;ve earned</b> over any period</li>
              <li>Same email and password as the app &mdash; no second account</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="page section" style={{ paddingTop: 0 }}>
        <div className="rule-head"><span className="label">04 &mdash; Start</span></div>
        <div className="grid-2" style={{ alignItems: "end" }}>
          <h2 className="display h2 col-7">Manage your listings and earnings from a browser.</h2>
          <div className="col-5" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/register" className="btn btn-primary">Create an account</Link>
            <Link href="/login" className="btn btn-ghost">Log in</Link>
          </div>
        </div>
      </section>
    </>
  );
}
