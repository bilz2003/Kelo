import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { RegisterForm } from "@/components/AuthForms";
import { ACCESS_COOKIE } from "@/lib/cookie-names";

export const metadata: Metadata = { title: "Sign up" };

export default async function RegisterPage() {
  if ((await cookies()).has(ACCESS_COOKIE)) redirect("/dashboard");

  return (
    <AuthShell title="Sign up" subtitle="One account for driving and hosting.">
      <RegisterForm />
    </AuthShell>
  );
}
