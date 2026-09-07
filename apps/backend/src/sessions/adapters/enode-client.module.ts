import { Module } from "@nestjs/common";
import { EnodeClient } from "./enode-client";

/**
 * Split out on its own so ChargersModule (the real Link flow — creating a
 * Link session, resolving which charger a completed Link produced,
 * verifying an enodeChargerId genuinely belongs to the calling host) can
 * share the exact same EnodeClient instance SessionsModule's adapters
 * use, rather than each module registering its own separate instance.
 * EnodeClient caches its OAuth2 token as instance state — two live
 * instances would just mean redundant token fetches, not a correctness
 * bug, but there's no reason to accept that when one shared, exported
 * instance is just as easy.
 */
@Module({
  providers: [EnodeClient],
  exports: [EnodeClient],
})
export class EnodeClientModule {}
