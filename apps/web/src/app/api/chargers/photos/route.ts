import { NextResponse } from "next/server";
import { applySession, callBackendAuthed } from "@/lib/bff";
import { isSameOrigin } from "@/lib/origin";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024;

// The existing S3 presigned-URL flow (POST /chargers/photos/upload-url ->
// PUT to S3), run server-side so the browser only ever posts a plain file
// input to this app. That also means no CORS configuration is needed on the
// private photo bucket — the PUT is server-to-S3, not browser-to-S3.
// Returns only the S3 key; the browser previews the file it already has, and
// the key is attached to the charger when the host saves.
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ message: "Choose a photo to upload." }, { status: 400 });
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ message: "Photos must be JPEG, PNG or WebP." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ message: "That photo is over 8 MB — choose a smaller one." }, { status: 413 });

  const call = await callBackendAuthed<{ key: string; uploadUrl: string }>("/chargers/photos/upload-url", {
    method: "POST",
    json: { contentType: file.type },
  });
  if (!call.result.ok) return applySession(NextResponse.json(call.result.body, { status: call.result.status }), call);

  const { key, uploadUrl } = call.result.body;
  let put: Response;
  try {
    put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: Buffer.from(await file.arrayBuffer()) });
  } catch {
    return applySession(NextResponse.json({ message: "Photo upload failed — try again." }, { status: 502 }), call);
  }
  if (!put.ok) return applySession(NextResponse.json({ message: "Photo upload failed — try again." }, { status: 502 }), call);

  return applySession(NextResponse.json({ key }, { status: 201 }), call);
}
