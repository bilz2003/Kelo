import type { Metadata } from "next";
import { BrandMark } from "@/components/BrandMark";
import { DashNav, LogoutButton } from "@/components/DashNav";
import { apiGet } from "@/lib/serverApi";
import type { AuthUser } from "@/lib/types";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · Kelo" }, robots: { index: false } };

// Every dashboard page renders inside this: fetching /users/me here is also
// what validates the session (an expired one redirects through the refresh
// handler — see lib/serverApi.ts).
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const me = await apiGet<AuthUser>("/users/me");
  return (
    <div className="dash">
      <aside className="dash-side">
        <BrandMark href="/dashboard" />
        <DashNav />
        <div className="dash-user">
          <div>
            <div className="name">{me.name}</div>
            <div className="email soft mono">{me.email}</div>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <main className="dash-main">{children}</main>
    </div>
  );
}
