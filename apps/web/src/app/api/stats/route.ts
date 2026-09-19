import { NextRequest, NextResponse } from "next/server";
import { callBackendAuthed, relay } from "@/lib/bff";
import type { ChargerStats } from "@/lib/types";

// GET /chargers/stats on the backend — real aggregation over this owner's
// Session/Transaction rows for an inclusive [start, end] window.
export async function GET(req: NextRequest) {
  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");
  const valid = (v: string | null): v is string => !!v && !Number.isNaN(Date.parse(v));
  if (!valid(start) || !valid(end)) {
    return NextResponse.json({ message: "start and end must be ISO dates" }, { status: 400 });
  }
  const qs = new URLSearchParams({ start, end });
  return relay(await callBackendAuthed<ChargerStats>(`/chargers/stats?${qs.toString()}`));
}
