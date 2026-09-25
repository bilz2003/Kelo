import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "@/components/AuthForms";
import { ACCESS_COOKIE } from "@/lib/cookie-names";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  // Already signed in -> straight to the dashboard. Except when the dashboard
  // itself just sent us here as "expired": the access cookie is then present but
  // known-bad (a Server Component can't clear it), so honouring it would bounce
  // back to the dashboard and loop. Logging in overwrites the stale cookies.
  if (reason !== "expired" && (await cookies()).has(ACCESS_COOKIE)) redirect("/dashboard");

  return (
    <AuthShell
      title="Log in"
      subtitle="One account for driving and hosting."
      notice={reason === "expired" ? <p className="af-notice">Your session ended &mdash; log in again to continue.</p> : undefined}
    >
      <LoginForm />
    </AuthShell>
  );
}
