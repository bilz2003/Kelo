import Link from "next/link";
import { BrandMark } from "./BrandMark";
import { SiteNav } from "./SiteNav";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="page">
        <BrandMark />
        <SiteNav />
        <div className="site-actions">
          <Link href="/login" className="btn btn-ghost btn-sm">Log in</Link>
          <Link href="/register" className="btn btn-primary btn-sm">Create account</Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page footer-grid">
        <div>
          <BrandMark />
          <p className="tagline">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.4 4.8 9 10 3.2" fill="none" stroke="var(--cyan)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            verified, metered charging
          </p>
        </div>
        <div>
          <h4 className="label">Product</h4>
          <ul>
            <li><Link className="link" href="/metering">How metering works</Link></li>
            <li><Link className="link" href="/hosts">For hosts</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="label">Account</h4>
          <ul>
            <li><Link className="link" href="/login">Log in</Link></li>
            <li><Link className="link" href="/register">Create account</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
