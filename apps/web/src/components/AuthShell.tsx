import type { ReactNode } from "react";
import { BrandMark } from "./BrandMark";
import { NetworkFixedBackground } from "./NetworkBackground";

/**
 * Shared frame for login and sign-up, per the mockups: the network as a FIXED
 * full-viewport background (these pages don't scroll, so it isn't scroll-tied —
 * the hub pulses and data-flow dots animate continuously instead), and a
 * centred 380px column with the logo above the form.
 */
export function AuthShell({ title, subtitle, notice, children }: { title: string; subtitle: string; notice?: ReactNode; children: ReactNode }) {
  return (
    <>
      <NetworkFixedBackground />
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-brand"><BrandMark variant="auth" href="/" /></div>
          <h1 className="auth-title">{title}</h1>
          <p className="auth-sub">{subtitle}</p>
          {notice}
          {children}
        </div>
      </div>
    </>
  );
}
