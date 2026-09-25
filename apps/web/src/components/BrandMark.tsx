import Link from "next/link";
import { BRAND_MARK_LIGHT as M } from "@kelo/core";

// Sizes from the finished mockups: nav 32x26 / 26px, login+sign-up 35x28 / 28px,
// footer 24x19 / 19px. `dash` is the dashboard sidebar (judgment call, between nav and footer).
const SIZES = {
  nav: { w: 32, h: 26, gap: 10, cls: "nav" },
  auth: { w: 35, h: 28, gap: 12, cls: "auth" },
  footer: { w: 24, h: 19, gap: 8, cls: "footer" },
  dash: { w: 28, h: 22, gap: 9, cls: "dash" },
} as const;

/** The network-node mark + "kelo." wordmark, drawn for a LIGHT background. */
export function BrandMark({ variant = "nav", href = "/" }: { variant?: keyof typeof SIZES; href?: string | null }) {
  const s = SIZES[variant];
  const inner = (
    <>
      <svg className="nav-logo-svg" width={s.w} height={s.h} viewBox="8 15 42 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <line x1="14" y1="18" x2="46" y2="18" stroke={M.edge} strokeWidth="1.5" opacity={M.edgeOpacity} />
        <line x1="14" y1="18" x2="14" y2="42" stroke={M.edge} strokeWidth="1.5" opacity={M.edgeOpacity} />
        <line x1="46" y1="18" x2="46" y2="42" stroke={M.edge} strokeWidth="1.5" opacity={M.edgeOpacity} />
        <line x1="14" y1="42" x2="46" y2="42" stroke={M.edge} strokeWidth="1.5" opacity={M.edgeOpacity} />
        <line x1="14" y1="18" x2="46" y2="42" stroke={M.signal} strokeWidth="1.5" />
        <circle cx="14" cy="18" r="4" fill={M.signal} />
        <circle cx="46" cy="42" r="4" fill={M.signal} />
        <circle cx="46" cy="18" r="3" fill="none" stroke={M.ring} strokeWidth="2" />
        <circle cx="14" cy="42" r="3" fill="none" stroke={M.ring} strokeWidth="2" />
      </svg>
      <span className={`brand-word brand-word-${s.cls}`}>
        kelo<i>.</i>
      </span>
    </>
  );
  const style = { gap: s.gap };
  return href ? (
    <Link href={href} className={`brand brand-${s.cls}`} style={style} aria-label="Kelo home">
      {inner}
    </Link>
  ) : (
    <span className={`brand brand-${s.cls}`} style={style}>
      {inner}
    </span>
  );
}
