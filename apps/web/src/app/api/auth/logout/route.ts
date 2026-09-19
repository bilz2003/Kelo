import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { backendRequest } from "@/lib/backend";
import { REFRESH_COOKIE, clearSessionCookies } from "@/lib/cookies";
import { isSameOrigin } from "@/lib/origin";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  // Best-effort server-side revocation, same as mobile's logout — the
  // cookies are cleared either way, which is what actually ends this
  // browser's session.
  if (refreshToken) await backendRequest("/auth/logout", { method: "POST", json: { refreshToken } });

  const res = new NextResponse(null, { status: 204 });
  clearSessionCookies(res.cookies);
  return res;
}
