import { NextResponse } from "next/server";
import { backendRequest, errorMessage } from "@/lib/backend";
import { writeSessionCookies } from "@/lib/cookies";
import { isSameOrigin } from "@/lib/origin";
import type { TokenPair } from "@/lib/types";

// BFF registration: the SAME backend /auth/register the mobile app calls.
// `createdVia: "web"` is injected here, server-side — the browser never
// supplies it, and any createdVia (or other unexpected field) in the request
// body is dropped by only forwarding the three fields the form has.
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const input = (await req.json().catch(() => null)) as { name?: unknown; email?: unknown; password?: unknown } | null;
  if (typeof input?.name !== "string" || typeof input?.email !== "string" || typeof input?.password !== "string") {
    return NextResponse.json({ message: "Enter your name, email and a password." }, { status: 400 });
  }

  const r = await backendRequest<TokenPair>("/auth/register", {
    method: "POST",
    json: { name: input.name.trim(), email: input.email.trim(), password: input.password, createdVia: "web" },
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
