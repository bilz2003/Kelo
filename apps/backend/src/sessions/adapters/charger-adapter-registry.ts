import { Injectable } from "@nestjs/common";
import { ConnectionRoute } from "@prisma/client";
import { ChargerAdapter } from "./charger-adapter.interface";
import { MockChargerAdapter } from "./mock-charger-adapter";
import { EnodeChargerAdapter } from "./enode-charger-adapter";
import { OcppChargerAdapter } from "./ocpp-charger-adapter";

/**
 * Picks the right ChargerAdapter for a given charger's own connectionRoute.
 *
 * MOCK is its own explicit route now, not a synonym for OCPP — every
 * charger that used to be tagged OCPP was actually always driven by
 * MockChargerAdapter (there was no real OCPP central system until this
 * adapter existed); the migration that added MOCK re-tagged all of them so
 * nothing's behavior silently changed. OCPP now means a real OCPP 1.6-J
 * charge point, speaking to OcppCentralSystem — see OCPP-INTEGRATION.md.
 */
@Injectable()
export class ChargerAdapterRegistry {
  constructor(
    private readonly mock: MockChargerAdapter,
    private readonly enode: EnodeChargerAdapter,
    private readonly ocpp: OcppChargerAdapter,
  ) {}

  forRoute(route: ConnectionRoute): ChargerAdapter {
    switch (route) {
      case ConnectionRoute.ENODE:
        return this.enode;
      case ConnectionRoute.OCPP:
        return this.ocpp;
      case ConnectionRoute.MOCK:
      default:
        return this.mock;
    }
  }
}
