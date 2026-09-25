"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { NetworkFar, NetworkMid, NetworkNear } from "./NetworkBackground";

/**
 * The homepage hero: three network layers at three depths, tied to scroll.
 * A straight port of the mockup's script — same rates, same scales:
 *   near: 0.7 × hero height drift, +55% zoom   (fast, feels close)
 *   mid:  0.4 × drift, +30% zoom
 *   far:  0.15 × drift, +12% zoom              (slow, reads as distant)
 *   foreground content: lifts 70px and fades to 15% as you scroll through.
 * Progress is scrollY / hero height, clamped 0..1, applied in requestAnimationFrame.
 * Skipped entirely under prefers-reduced-motion (the layers simply sit still).
 */
export function HeroParallax({ children }: { children: ReactNode }) {
  const shell = useRef<HTMLDivElement>(null);
  const near = useRef<SVGSVGElement>(null);
  const mid = useRef<SVGSVGElement>(null);
  const far = useRef<SVGSVGElement>(null);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const heroShell = shell.current, nearEl = near.current, midEl = mid.current, farEl = far.current, contentEl = content.current;
    if (!heroShell || !nearEl || !midEl || !farEl || !contentEl) return;
    let ticking = false;

    const update = () => {
      const heroHeight = heroShell.offsetHeight;
      const scrollY = window.scrollY || window.pageYOffset;
      const progress = Math.min(1, Math.max(0, scrollY / heroHeight));

      nearEl.style.transform = `translateY(${progress * heroHeight * 0.7}px) scale(${1 + progress * 0.55})`;
      midEl.style.transform = `translateY(${progress * heroHeight * 0.4}px) scale(${1 + progress * 0.3})`;
      farEl.style.transform = `translateY(${progress * heroHeight * 0.15}px) scale(${1 + progress * 0.12})`;

      contentEl.style.transform = `translateY(${progress * -70}px)`;
      contentEl.style.opacity = String(Math.max(0.15, 1 - progress * 0.85));
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const svgProps = { viewBox: "0 0 1440 700", preserveAspectRatio: "xMidYMid slice", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": true } as const;
  return (
    <div className="hero-shell" ref={shell}>
      <svg ref={far} id="hero-parallax-far" className="hero-parallax" {...svgProps}><NetworkFar /></svg>
      <svg ref={mid} id="hero-parallax-mid" className="hero-parallax" {...svgProps}><NetworkMid /></svg>
      <svg ref={near} id="hero-parallax" className="hero-parallax" {...svgProps}><NetworkNear /></svg>
      <div ref={content} id="hero-content" className="hero pad hero-content-pad">{children}</div>
    </div>
  );
}
