import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ChargerAdapter, MeterState } from "./charger-adapter.interface";

/**
 * Structural placeholder only — no real Enode API calls anywhere in this
 * class, no real credentials read, nothing that would fail differently
 * depending on network conditions. Every method throws a clear,
 * immediate error rather than silently behaving like the mock adapter,
 * so a charger accidentally created with connectionRoute: ENODE fails
 * loudly at session start (a 503, not a confusing downstream error once
 * something already looked like it worked). See ENODE-INTEGRATION.md
 * for what actually implementing this requires — the real OAuth2
 * client-credentials exchange, the real charger-control endpoints, and
 * the webhook subscription this adapter would need to receive real
 * charging-state updates from, none of which exist here yet.
 */
@Injectable()
export class EnodeChargerAdapter implements ChargerAdapter {
  private notConfigured(): never {
    throw new ServiceUnavailableException(
      "Enode integration is not configured — this is a structural placeholder, not a working adapter. " +
        "See ENODE-INTEGRATION.md for what real implementation requires (ENODE_CLIENT_ID/ENODE_CLIENT_SECRET, " +
        "the real OAuth2 token exchange, and Enode's actual charger-control endpoints).",
    );
  }

  async authorize(_sessionId: number): Promise<void> {
    this.notConfigured();
  }

  async stop(_sessionId: number): Promise<MeterState> {
    this.notConfigured();
  }

  async getMeterValue(_chargerId: number): Promise<MeterState | null> {
    this.notConfigured();
  }
}
