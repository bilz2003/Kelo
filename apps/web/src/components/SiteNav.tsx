import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

/**
 * The public site's top bar — shared by the homepage and the other marketing
 * pages so the links can't drift between them. In-page anchors are written as
 * "/#…" so they work from any page, not just the homepage. Below 900px the
 * text links collapse (see globals.css), leaving Log in / Get started.
 */
export function SiteNav() {
  return (
    <div className="pad nav-row">
      <BrandMark variant="nav" href="/" />
      <div className="nav-links">
        <Link href="/#how-it-works" className="nav-link">How it works</Link>
        <Link href="/#hosts" className="nav-link">For hosts</Link>
        <Link href="/chargers-and-fees" className="nav-link">Chargers &amp; fees</Link>
        <Link href="/login" className="nav-link nav-login">Log in</Link>
        <Link href="/register" className="nav-get-started">Get started</Link>
      </div>
    </div>
  );
}
