import { NextResponse } from "next/server";
import { normalizeEmail } from "@kelo/core";
import { backendRequest, errorMessage } from "@/lib/backend";
import { writeSessionCookies } from "@/lib/cookies";
import { isSameOrigin } from "@/lib/origin";
import type { TokenPair } from "@/lib/types";

// BFF registration: the SAME backend /auth/register the mobile app calls.
// `createdVia: "web"` is injected here, server-side — the browser never
// supplies it, and any createdVia (or other unexpected field) in the request
// body is dropped by only forwarding what this route builds itself.
//
// The form has First name / Last name / Confirm email / Confirm password. First
// and last name are stored separately (User.firstName / User.lastName) and passed
// through as-is — the backend, not this route, owns their length rules. The
// confirm fields are re-checked server-side too: the client check is a
// convenience, not a guarantee.
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const input = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const str = (k: string) => (typeof input?.[k] === "string" ? (input[k] as string) : null);
  const firstName = str("firstName")?.trim(), lastName = str("lastName")?.trim();
  const email = str("email")?.trim(), confirmEmail = str("confirmEmail")?.trim();
  const password = str("password"), confirmPassword = str("confirmPassword");

  if (!firstName || !lastName) return NextResponse.json({ message: "Enter your first and last name." }, { status: 400 });
  if (!email || !password) return NextResponse.json({ message: "Enter your email and a password." }, { status: 400 });
  if (normalizeEmail(email) !== normalizeEmail(confirmEmail ?? "")) return NextResponse.json({ message: "Emails don’t match." }, { status: 400 });
  if (password !== confirmPassword) return NextResponse.json({ message: "Passwords don’t match." }, { status: 400 });

  const r = await backendRequest<TokenPair>("/auth/register", {
    method: "POST",
    json: { firstName, lastName, email, password, createdVia: "web" },
  });
  if (!r.ok) {
    const message =
      r.status === 429
        ? "Too many attempts — wait a minute and try again."
        : errorMessage(r.body, "Couldn't create your account — try again.");
    return NextResponse.json({ message }, { status: r.status });
  }

  const res = NextResponse.json({ user: r.body.user }, { status: 201 });
  writeSessionCookies(res.cookies, r.body);
  return res;
}
