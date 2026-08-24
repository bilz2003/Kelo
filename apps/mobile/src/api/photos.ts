import { apiFetch } from "./client";

// The two live in an array in lockstep (see api/chargers.ts's OwnerCharger:
// photoKeys[i] is always the raw key behind photos[i]'s presigned view
// URL) — a draft is just that pairing, before or after it's attached to a
// charger.
export interface PhotoDraft {
  key: string;
  previewUrl: string;
}

interface UploadUrlResponse {
  key: string;
  uploadUrl: string;
}

/**
 * Uploads directly to S3 via a presigned PUT the backend hands out —
 * never routed through the NestJS server as a file body. The bucket is
 * private (see INFRASTRUCTURE.md); the presigned URL is the only path in.
 * previewUrl on the returned draft is the same local URI that was just
 * uploaded — cheaper to keep showing than round-tripping to fetch a
 * presigned view URL for something already loaded on-device.
 */
export async function uploadPhoto(localUri: string, contentType: string): Promise<PhotoDraft> {
  const { key, uploadUrl } = await apiFetch<UploadUrlResponse>("/chargers/photos/upload-url", {
    method: "POST",
    body: { contentType },
  });

  const fileResponse = await fetch(localUri);
  const blob = await fileResponse.blob();
  const putResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!putResponse.ok) {
    throw new Error("Photo upload failed — try again.");
  }

  return { key, previewUrl: localUri };
}
