import { randomUUID } from "crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Long enough to cover a slow mobile upload without being a durable link;
// short enough that a URL leaked into a log or screenshot is useless
// within the hour. Matches the bucket's own access model documented in
// INFRASTRUCTURE.md — no public/anonymous path exists at all, only
// short-lived presigned URLs generated here.
const UPLOAD_URL_TTL_SECONDS = 300;
const VIEW_URL_TTL_SECONDS = 900;

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

@Injectable()
export class PhotosService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.client = new S3Client({ region: this.config.get<string>("AWS_REGION", "eu-west-2") });
    this.bucket = this.config.getOrThrow<string>("CHARGER_PHOTOS_BUCKET");
  }

  /**
   * Keyed by ownerId, not chargerId — Add Charger uploads a photo before
   * the charger row exists at all, so there's nothing to scope the key to
   * yet. The charger a photo ends up on is whatever create/update request
   * later includes this key in its `photos` array.
   */
  async createUploadUrl(ownerId: number, contentType: string): Promise<{ key: string; uploadUrl: string }> {
    const extension = ALLOWED_CONTENT_TYPES[contentType];
    if (!extension) {
      throw new BadRequestException(`Unsupported content type "${contentType}" — use image/jpeg, image/png, or image/webp`);
    }
    const key = `charger-photos/${ownerId}/${randomUUID()}${extension}`;
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
    return { key, uploadUrl };
  }

  /**
   * Presigning is a local signing operation (HMAC over the request), not a
   * network round trip to AWS — safe to call once per key, even across a
   * whole list of chargers, without a real per-call cost.
   */
  getViewUrls(keys: string[]): Promise<string[]> {
    return Promise.all(
      keys.map((key) => getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: VIEW_URL_TTL_SECONDS })),
    );
  }

  /**
   * Every charger-shaped object a client receives — from ChargersService
   * directly, or nested under a Booking in BookingsService — goes through
   * this. `photos` (fresh presigned view URLs) always replaces the raw
   * `photoKeys`. Keys themselves aren't private data (they're useless
   * without a presigned URL or real AWS credentials, same as the bucket
   * being private makes a bare key harmless) — but there's no reason to
   * hand them to a driver or the public Discover feed either, since only
   * the owner ever needs to reference a specific photo by key (to remove
   * or replace just one of the two). `includeKeys` is that one exception:
   * owner-scoped responses (create/update/findAllForOwner/findOneForOwner)
   * pass it, Discover and the driver-facing booking view don't.
   */
  async resolveCharger<T extends { photoKeys: string[] }>(
    charger: T,
    opts?: { includeKeys?: boolean },
  ): Promise<Omit<T, "photoKeys"> & { photos: string[]; photoKeys?: string[] }> {
    const { photoKeys, ...rest } = charger;
    const photos = await this.getViewUrls(photoKeys);
    return { ...rest, photos, ...(opts?.includeKeys ? { photoKeys } : {}) };
  }

  resolveChargers<T extends { photoKeys: string[] }>(chargers: T[], opts?: { includeKeys?: boolean }) {
    return Promise.all(chargers.map((c) => this.resolveCharger(c, opts)));
  }
}
