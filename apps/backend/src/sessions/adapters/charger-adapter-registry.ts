import { Injectable } from "@nestjs/common";
import { ConnectionRoute } from "@prisma/client";
import { ChargerAdapter } from "./charger-adapter.interface";
import { MockChargerAdapter } from "./mock-charger-adapter";
import { EnodeChargerAdapter } from "./enode-charger-adapter";

/**
 * Picks the right ChargerAdapter for a given charger's own connectionRoute
 * — the piece that was missing before Enode readiness: SessionsService
 * used to get one fixed adapter (the mock) regardless of what route a
 * charger actually declared. OCPP still resolves to the mock, not a real
 * OCPP adapter — there's no real OCPP central system here yet either
 * (BACKEND-PLAN.md's own recommendation is to build against the mock
 * first), so every existing OCPP-route charger keeps behaving exactly as
 * it already does. Only the route lookup itself is new.
 */
@Injectable()
export class ChargerAdapterRegistry {
  constructor(
    private readonly mock: MockChargerAdapter,
    private readonly enode: EnodeChargerAdapter,
  ) {}

  forRoute(route: ConnectionRoute): ChargerAdapter {
    switch (route) {
      case ConnectionRoute.ENODE:
        return this.enode;
      case ConnectionRoute.OCPP:
      default:
        return this.mock;
    }
  }
}
