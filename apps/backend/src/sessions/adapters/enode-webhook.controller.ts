import { createHmac, timingSafeEqual } from "crypto";
import { BadRequestException, Controller, ForbiddenException, Headers, Logger, Post, RawBodyRequest, Req } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { EnodeChargerAdapter } from "./enode-charger-adapter";

interface EnodeChargerEventPayload {
  event: string;
  createdAt: string;
  charger?: {
    id: string;
    chargeState?: { chargeRate: number | null };
  };
}

/**
 * Receives Enode's real-time charge-state webhooks — confirmed against
 * Enode's docs: HTTPS POST, a JSON array of up to 100 events per delivery,
 * each shaped { event, createdAt, ... }, signed via an x-enode-signature
 * header (`sha1={hex HMAC-SHA1 of the raw request body}`).
 *
 * Not wired to a real Enode webhook subscription yet — that requires a
 * publicly reachable URL (POST /webhooks with that URL, confirmed as the
 * real subscription-creation endpoint), which this local dev environment
 * doesn't have. The receiver itself is real and independently verifiable:
 * a correctly-signed payload is accepted and correctly updates the
 * matching session; an incorrectly-signed one is rejected.
 */
@Controller("webhooks/enode")
export class EnodeWebhookController {
  private readonly logger = new Logger(EnodeWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly adapter: EnodeChargerAdapter,
  ) {}

  @Post()
  receive(@Req() req: RawBodyRequest<Request>, @Headers("x-enode-signature") signatureHeader?: string): { received: number } {
    const secret = this.config.get<string>("ENODE_WEBHOOK_SECRET");
    if (!secret) {
      throw new BadRequestException("Enode webhooks are not configured — ENODE_WEBHOOK_SECRET is not set");
    }
    if (!req.rawBody) {
      throw new BadRequestException("Missing request body");
    }
    this.verifySignature(req.rawBody, signatureHeader, secret);

    const events = JSON.parse(req.rawBody.toString("utf8")) as EnodeChargerEventPayload[];
    let handled = 0;
    for (const evt of events) {
      if (evt.event !== "user:charger:updated") continue;
      const chargerId = evt.charger?.id;
      const chargeRate = evt.charger?.chargeState?.chargeRate;
      if (!chargerId || chargeRate === null || chargeRate === undefined) continue;

      this.adapter.onChargeStateUpdated(chargerId, chargeRate, new Date(evt.createdAt));
      handled++;
    }
    return { received: handled };
  }

  /**
   * HMAC-SHA1 over the *raw* bytes Enode signed, per their docs — verified
   * with a constant-time comparison so this can't be timed to leak the
   * expected signature one byte at a time. Never logs the secret, the
   * computed signature, or the header value on mismatch — only the fact
   * that verification failed.
   */
  private verifySignature(rawBody: Buffer, signatureHeader: string | undefined, secret: string): void {
    if (!signatureHeader?.startsWith("sha1=")) {
      throw new ForbiddenException("Missing or malformed x-enode-signature");
    }
    const provided = signatureHeader.slice("sha1=".length);
    const expected = createHmac("sha1", secret).update(rawBody).digest("hex");

    const providedBuf = Buffer.from(provided, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    const valid = providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf);
    if (!valid) {
      this.logger.warn("Rejected an Enode webhook delivery with an invalid signature");
      throw new ForbiddenException("Invalid signature");
    }
  }
}
