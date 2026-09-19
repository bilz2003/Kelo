import Link from "next/link";
import { BRAND_MARK } from "@kelo/core";

/** The network-node mark + "kelo." wordmark — same artwork as the mobile app's BrandMark. */
export function BrandMark({ size = 24, href = "/" }: { size?: number; href?: string | null }) {
  const mark = (
    <>
      <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden="true">
        <line x1="14" y1="18" x2="46" y2="18" stroke={BRAND_MARK.edge} strokeWidth="1.5" />
        <line x1="14" y1="18" x2="14" y2="42" stroke={BRAND_MARK.edge} strokeWidth="1.5" />
        <line x1="46" y1="18" x2="46" y2="42" stroke={BRAND_MARK.edge} strokeWidth="1.5" />
        <line x1="14" y1="42" x2="46" y2="42" stroke={BRAND_MARK.edge} strokeWidth="1.5" />
        <line x1="14" y1="18" x2="46" y2="42" stroke={BRAND_MARK.signal} strokeWidth="1.5" />
        <circle cx="14" cy="18" r="4" fill={BRAND_MARK.signal} />
        <circle cx="46" cy="42" r="4" fill={BRAND_MARK.signal} />
        <circle cx="46" cy="18" r="3" fill={BRAND_MARK.nodeFill} stroke={BRAND_MARK.edge} />
        <circle cx="14" cy="42" r="3" fill={BRAND_MARK.nodeFill} stroke={BRAND_MARK.edge} />
      </svg>
      <span className="brand-word">
        kelo<i>.</i>
      </span>
    </>
  );
  return href ? (
    <Link href={href} className="brand" aria-label="Kelo home">
      {mark}
    </Link>
  ) : (
    <span className="brand">{mark}</span>
  );
}
