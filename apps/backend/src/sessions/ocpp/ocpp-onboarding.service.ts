import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import { OcppCentralSystem } from "./ocpp-central-system";

/**
 * The OCPP-route equivalent of EnodeLinkService — where that mints a real
 * hosted Link session against Enode's own API, this mints the one thing an
 * OCPP charge point actually needs to connect to Kelo's own central system:
 * a stable identity, plus the WebSocket URL it should be configured with.
 *
 * There's no third-party API to call here (the "connection" is a piece of
 * hardware being configured directly), so unlike EnodeLinkService this is
 * mostly a thin wrapper around OcppCentralSystem.isConnected — the actual
 * verification that a real charge point showed up lives there, keyed by the
 * same chargePointId this mints.
 */
@Injectable()
export class OcppOnboardingService {
  constructor(
    private readonly config: ConfigService,
    private readonly centralSystem: OcppCentralSystem,
  ) {}

  /**
   * A fresh UUID per onboarding attempt — stable for the life of that
   * charge point once it's actually created (stored as
   * Charger.ocppChargePointId), and never reused, so there's no risk of a
   * new host's in-progress onboarding colliding with an old one's identity.
   * The host doesn't pick or type this; it's generated here and handed
   * back purely as connection details to enter into the physical charger.
   */
  startOnboarding(): { chargePointId: string; wsUrl: string } {
    const chargePointId = randomUUID();
    return { chargePointId, wsUrl: this.buildWsUrl(chargePointId) };
  }

  /**
   * Real connection status — true only once OcppCentralSystem has an
   * actual live client registered under this exact identity, which itself
   * only happens after a real WebSocket handshake completes (the 'client'
   * event in OcppCentralSystem.onClient). No BootNotification-specific
   * flag is tracked separately: a charge point that has connected at all
   * always sends BootNotification first per the OCPP 1.6 spec, and
   * ocpp-rpc's own handshake is already what populates `clients` — so
   * "connected" here is exactly "has a live registered client", not a
   * looser TCP-only check.
   */
  isConnected(chargePointId: string): boolean {
    return this.centralSystem.isConnected(chargePointId);
  }

  /**
   * OCPP_PUBLIC_BASE_URL is deliberately unset in this environment's real
   * .env (local/dev has no public domain for hardware to reach) — falls
   * back to the same ws://localhost:OCPP_PORT a local simulator already
   * connects to (see ocpp-simulator.js), so this works out of the box
   * today. Setting the env var to a real public wss:// domain later is the
   * *entire* change needed to make this correct in production — nothing
   * here needs to change.
   */
  private buildWsUrl(chargePointId: string): string {
    const port = this.config.get<number>("OCPP_PORT", 9220);
    const base = this.config.get<string>("OCPP_PUBLIC_BASE_URL", `ws://localhost:${port}`);
    return `${base.replace(/\/+$/, "")}/${chargePointId}`;
  }
}
