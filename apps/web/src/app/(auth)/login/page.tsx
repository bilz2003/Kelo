import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthSide } from "@/components/AuthSide";
import { LoginForm } from "@/components/AuthForms";
import { ACCESS_COOKIE } from "@/lib/cookie-names";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  // Already signed in -> straight to the dashboard. Except when the
  // dashboard itself just sent us here as "expired": the access cookie is
  // then present but known-bad (a Server Component can't clear it), so
  // honouring it would bounce straight back to the dashboard and loop.
  // Logging in overwrites the stale cookies.
  if (reason !== "expired" && (await cookies()).has(ACCESS_COOKIE)) redirect("/dashboard");

  return (
    <div className="auth">
      <div className="auth-form">
        <span className="label" style={{ marginBottom: 14 }}>Log in</span>
        <h1 className="display h2" style={{ marginBottom: 28 }}>Welcome back.</h1>
        {reason === "expired" && <p className="notice">Your session ended &mdash; log in again to continue.</p>}
        <LoginForm />
      </div>
      <AuthSide />
    </div>
  );
}
