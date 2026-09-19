import { NextResponse } from "next/server";
import { backendRequest, errorMessage } from "@/lib/backend";
import { writeSessionCookies } from "@/lib/cookies";
import { isSameOrigin } from "@/lib/origin";
import type { TokenPair } from "@/lib/types";

// BFF login: calls the SAME backend /auth/login the mobile app uses (same
// User table, same database — there is no separate web account store), then
// turns the returned tokens into httpOnly cookies. The tokens themselves are
// never put in the response body, so page JavaScript can't read them.
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const input = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  if (typeof input?.email !== "string" || typeof input?.password !== "string") {
    return NextResponse.json({ message: "Enter your email and password." }, { status: 400 });
  }

  const r = await backendRequest<TokenPair>("/auth/login", {
    method: "POST",
    json: { email: input.email, password: input.password },
  });
  if (!r.ok) {
    const message =
      r.status === 429
        ? "Too many attempts — wait a minute and try again."
        : errorMessage(r.body, "Couldn't log in — try again.");
    return NextResponse.json({ message }, { status: r.status });
  }

  const res = NextResponse.json({ user: r.body.user });
  writeSessionCookies(res.cookies, r.body);
  return res;
}
