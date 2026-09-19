import { NextResponse } from "next/server";
import { callBackendAuthed, relay } from "@/lib/bff";
import { isSameOrigin } from "@/lib/origin";

// Exactly the fields the website lets a host change — the mobile Edit
// Charger screen's set. Anything else in the request (connectionRoute, the
// charge-point/Enode ids, ownership) is dropped before it reaches the
// backend, so the website can't be used to alter a charger's connection.
const EDITABLE = ["listingName", "cable", "rate", "noShowFee", "hostCost", "available", "photos"] as const;

async function parseId(params: Promise<{ id: string }>): Promise<number | null> {
  const { id } = await params;
  return /^\d+$/.test(id) ? Number(id) : null;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(req)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const id = await parseId(ctx.params);
  if (id === null) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const input = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!input || typeof input !== "object") return NextResponse.json({ message: "Invalid request" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const key of EDITABLE) if (key in input) patch[key] = input[key];

  return relay(await callBackendAuthed(`/chargers/${id}`, { method: "PATCH", json: patch }));
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(req)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const id = await parseId(ctx.params);
  if (id === null) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return relay(await callBackendAuthed(`/chargers/${id}`, { method: "DELETE" }));
}

