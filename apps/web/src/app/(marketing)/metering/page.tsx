import type { Metadata } from "next";
import Link from "next/link";
import { Register } from "@/components/Register";

export const metadata: Metadata = {
  title: "How metering works",
  description: "How Kelo bills from the charger's own meter reading, message by message over OCPP 1.6-J.",
};

// FIRST-DRAFT COPY. The OCPP message names and behaviours below describe what
// Kelo's central system actually implements (apps/backend, OCPP-INTEGRATION.md).
// The values in the message log are illustrative.
export default function MeteringPage() {
  return (
    <>
      <section className="page hero" style={{ paddingBottom: 40 }}>
        <div className="eyebrow"><span className="label">How metering works</span></div>
        <h1 className="display h1" style={{ maxWidth: "11em" }}>The meter is the source of truth.</h1>
        <p className="lede">
          A charger keeps a running total of every kilowatt-hour it has ever delivered. Kelo reads that total at the start of a session and at
          the end &mdash; the difference is the bill.
        </p>
        <div style={{ marginTop: 40, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <Register value={12418.61} size="clamp(1.4rem, 4vw, 2.6rem)" />
          <span className="label">An example register reading</span>
        </div>
      </section>

      <section className="page section" style={{ paddingTop: 24 }}>
        <div className="rule-head"><span className="label">A session, step by step</span></div>
        <div className="grid-2">
          <div className="col-7">
            <div className="ledger">
              <div className="ledger-row" style={{ gridTemplateColumns: "56px 1fr" }}>
                <span className="n">01</span>
                <div>
                  <h3>The charger connects and identifies itself</h3>
                  <p style={{ marginTop: 10 }}>Before a charger can be listed, Kelo issues it a connection ID. The charger announces itself with an OCPP <code>BootNotification</code>, and it can only be added once a message from that exact ID has genuinely arrived.</p>
                </div>
              </div>
              <div className="ledger-row" style={{ gridTemplateColumns: "56px 1fr" }}>
                <span className="n">02</span>
                <div>
                  <h3>The driver confirms; Kelo starts the charger</h3>
                  <p style={{ marginTop: 10 }}>After booking and arriving, the driver confirms in the app. Kelo sends a <code>RemoteStartTransaction</code>. A charger that starts a transaction Kelo never asked for is rejected &mdash; there&rsquo;s no way to begin a Kelo session from the charger side.</p>
                </div>
              </div>
              <div className="ledger-row" style={{ gridTemplateColumns: "56px 1fr" }}>
                <span className="n">03</span>
                <div>
                  <h3>The charger reports its own meter</h3>
                  <p style={{ marginTop: 10 }}>While charging, the charger sends <code>MeterValues</code> carrying its <code>Energy.Active.Import.Register</code>. Kelo keeps the latest real reading against the session and shows it live in the app.</p>
                </div>
              </div>
              <div className="ledger-row" style={{ gridTemplateColumns: "56px 1fr" }}>
                <span className="n">04</span>
                <div>
                  <h3>The session settles from the difference</h3>
                  <p style={{ marginTop: 10 }}>When the session ends, the charger sends <code>StopTransaction</code> with its final reading. Energy delivered is final minus start; cost is that energy times the host&rsquo;s rate, plus any idle or overstay minutes.</p>
                </div>
              </div>
              <div className="ledger-row" style={{ gridTemplateColumns: "56px 1fr" }}>
                <span className="n">05</span>
                <div>
                  <h3>If a charger goes quiet, Kelo doesn&rsquo;t invent a number</h3>
                  <p style={{ marginTop: 10 }}>If a charger stops sending anything mid-session, Kelo settles from the last reading it genuinely received rather than leaving the session open or estimating the rest.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="col-5">
            <div className="wire" aria-label="Illustrative OCPP message flow">
              <div className="wire-head"><span className="label">Message flow</span><span className="label">Illustrative</span></div>
              <div className="line"><span className="dir">→</span><span className="who">charger</span><span className="msg"><b>BootNotification</b> <span>connection ID</span></span></div>
              <div className="line"><span className="dir">←</span><span className="who">kelo</span><span className="msg"><b>Accepted</b></span></div>
              <div className="line"><span className="dir">←</span><span className="who">kelo</span><span className="msg"><b>RemoteStartTransaction</b></span></div>
              <div className="line"><span className="dir">→</span><span className="who">charger</span><span className="msg"><b>StartTransaction</b> <span>meterStart</span></span></div>
              <div className="line"><span className="dir">→</span><span className="who">charger</span><span className="msg"><b>MeterValues</b> <span>register, Wh</span></span></div>
              <div className="line"><span className="dir">→</span><span className="who">charger</span><span className="msg"><b>StopTransaction</b> <span>meterStop</span></span></div>
              <div className="wire-foot">Message names are OCPP 1.6-J. Kelo&rsquo;s central system implements exactly this flow; the diagram carries no real data.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="page section" style={{ paddingTop: 0 }}>
        <div className="rule-head"><span className="label">Start</span></div>
        <div className="grid-2" style={{ alignItems: "end" }}>
          <h2 className="display h2 col-7">See what a session would earn you.</h2>
          <div className="col-5" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/hosts" className="btn btn-primary">Open the estimator</Link>
            <Link href="/register" className="btn btn-ghost">Create an account</Link>
          </div>
        </div>
      </section>
    </>
  );
}
