// The node network behind the homepage hero and the auth pages, ported from
// the finished design mockups (coordinates, stroke widths and opacities are
// copied exactly). Bright cyan (#4FD8C4) is
// used here because this is DECORATION; cyan as readable text uses the darker
// --cyan-text instead.
//
// Three layers at three depths. Homepage: each layer is its own <svg>, moved at
// a different rate as you scroll (see HeroParallax). Auth pages: the same three
// layers stacked in one fixed, non-scrolling <svg> (NetworkFixedBackground) —
// those pages don't scroll, so the depth comes from the continuous hub-pulse
// and data-flow animations instead.

const CYAN = "#4FD8C4";

export function NetworkFar() {
  return (
    <>
      <g stroke={CYAN} strokeWidth="1.5" opacity="0.05">
        <line x1="-60" y1="20" x2="220" y2="140" /><line x1="220" y1="140" x2="140" y2="380" />
        <line x1="940" y1="30" x2="1220" y2="180" /><line x1="1220" y1="180" x2="1500" y2="90" />
        <line x1="500" y1="-20" x2="640" y2="120" /><line x1="80" y1="600" x2="260" y2="520" />
        <line x1="1300" y1="560" x2="1440" y2="480" />
      </g>
      <g fill={CYAN} opacity="0.08">
        <circle cx="-60" cy="20" r="9" /><circle cx="220" cy="140" r="12" /><circle cx="140" cy="380" r="8" />
        <circle cx="940" cy="30" r="8" /><circle cx="1220" cy="180" r="11" /><circle cx="1500" cy="90" r="8" />
        <circle cx="500" cy="-20" r="7" /><circle cx="640" cy="120" r="9" />
        <circle cx="80" cy="600" r="7" /><circle cx="260" cy="520" r="8" /><circle cx="1300" cy="560" r="7" /><circle cx="1440" cy="480" r="8" />
      </g>
    </>
  );
}

export function NetworkMid() {
  return (
    <>
      <g stroke={CYAN} strokeWidth="1.5" opacity="0.1">
        <line x1="60" y1="500" x2="320" y2="420" /><line x1="320" y1="420" x2="420" y2="620" />
        <line x1="1020" y1="480" x2="1260" y2="560" /><line x1="1020" y1="480" x2="1160" y2="340" />
        <line x1="180" y1="80" x2="380" y2="60" /><line x1="1100" y1="100" x2="1320" y2="160" />
      </g>
      <g fill={CYAN} opacity="0.15">
        <circle cx="60" cy="500" r="7" /><circle cx="320" cy="420" r="10" /><circle cx="420" cy="620" r="7" />
        <circle cx="1020" cy="480" r="11" /><circle cx="1260" cy="560" r="7" /><circle cx="1160" cy="340" r="7" />
        <circle cx="180" cy="80" r="6" /><circle cx="380" cy="60" r="7" /><circle cx="1100" cy="100" r="6" /><circle cx="1320" cy="160" r="7" />
      </g>
    </>
  );
}

export function NetworkNear() {
  return (
    <>
      <g stroke={CYAN} strokeWidth="1.75" opacity="0.22">
        <line x1="120" y1="120" x2="360" y2="260" /><line x1="360" y1="260" x2="300" y2="480" />
        <line x1="360" y1="260" x2="600" y2="180" /><line x1="600" y1="180" x2="820" y2="320" />
        <line x1="820" y1="320" x2="760" y2="560" /><line x1="820" y1="320" x2="1080" y2="240" />
        <line x1="1080" y1="240" x2="1280" y2="420" /><line x1="600" y1="180" x2="720" y2="40" />
        <line x1="240" y1="580" x2="360" y2="260" /><line x1="960" y1="560" x2="820" y2="320" />
        <line x1="1080" y1="240" x2="1200" y2="80" />
      </g>
      <g fill={CYAN} opacity="0.32">
        <circle cx="120" cy="120" r="6" /><circle cx="300" cy="480" r="6" /><circle cx="600" cy="180" r="6" />
        <circle cx="760" cy="560" r="6" /><circle cx="1080" cy="240" r="7" /><circle cx="1280" cy="420" r="6" />
        <circle cx="720" cy="40" r="6" /><circle cx="240" cy="580" r="6" /><circle cx="960" cy="560" r="6" /><circle cx="1200" cy="80" r="6" />
      </g>
      {/* Data-flow pulses: small dots travelling along the network — a visualisation of
          the real mechanism (a reading moving from charger to app), not decoration for its own sake. */}
      <circle className="flow-dot" r="3.5" fill={CYAN}><animateMotion dur="2.8s" repeatCount="indefinite" path="M120,120 L360,260" /></circle>
      <circle className="flow-dot" r="3.5" fill={CYAN}><animateMotion dur="3.4s" repeatCount="indefinite" begin="0.5s" path="M360,260 L600,180" /></circle>
      <circle className="flow-dot" r="3.5" fill={CYAN}><animateMotion dur="3.1s" repeatCount="indefinite" begin="1s" path="M820,320 L760,560" /></circle>
      <circle className="flow-dot" r="3.5" fill={CYAN}><animateMotion dur="2.6s" repeatCount="indefinite" begin="1.6s" path="M1080,240 L1280,420" /></circle>
      {/* Hub nodes: larger, pulsing continuously — the "live network" moment */}
      <g className="hub-node">
        <circle cx="360" cy="260" r="18" fill={CYAN} opacity="0.12" />
        <circle cx="360" cy="260" r="9" fill={CYAN} opacity="0.55" />
      </g>
      <g className="hub-node" style={{ animationDelay: "0.6s" }}>
        <circle cx="820" cy="320" r="18" fill={CYAN} opacity="0.12" />
        <circle cx="820" cy="320" r="9" fill={CYAN} opacity="0.55" />
      </g>
      <g className="hub-node" style={{ animationDelay: "1.2s" }}>
        <circle cx="1080" cy="240" r="15" fill={CYAN} opacity="0.12" />
        <circle cx="1080" cy="240" r="7" fill={CYAN} opacity="0.5" />
      </g>
    </>
  );
}

/** Login / sign-up: all three layers in one fixed, full-viewport SVG behind the form. */
export function NetworkFixedBackground() {
  return (
    <svg className="net-fixed" viewBox="0 0 1440 700" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <NetworkFar />
      <NetworkMid />
      <NetworkNear />
    </svg>
  );
}
