"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/dashboard", label: "My chargers", match: (p: string) => p === "/dashboard" || p.startsWith("/dashboard/chargers") },
  { href: "/dashboard/earnings", label: "Earnings", match: (p: string) => p.startsWith("/dashboard/earnings") },
];

export function DashNav() {
  const pathname = usePathname();
  return (
    <nav className="dash-nav" aria-label="Dashboard">
      {LINKS.map((l) => (
        // prefetch off: a prefetch of a dashboard route can hit the session
        // gate while the access token is expired, and racing prefetches are
        // exactly what the refresh dedupe exists to survive — no reason to
        // invite them.
        <Link key={l.href} href={l.href} prefetch={false} aria-current={l.match(pathname) ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.push("/");
    router.refresh();
  }
  return (
    <button className="btn btn-ghost btn-sm" onClick={logout} disabled={busy}>
      {busy ? "Logging out…" : "Log out"}
    </button>
  );
}
