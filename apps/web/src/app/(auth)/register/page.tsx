import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthSide } from "@/components/AuthSide";
import { RegisterForm } from "@/components/AuthForms";
import { ACCESS_COOKIE } from "@/lib/cookie-names";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  if ((await cookies()).has(ACCESS_COOKIE)) redirect("/dashboard");

  return (
    <div className="auth">
      <div className="auth-form">
        <span className="label" style={{ marginBottom: 14 }}>Create account</span>
        <h1 className="display h2" style={{ marginBottom: 28 }}>Start hosting on Kelo.</h1>
        <RegisterForm />
      </div>
      <AuthSide />
    </div>
  );
}
