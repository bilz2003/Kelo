import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ExtensionRequestsModule } from "../extension-requests/extension-requests.module";
import { SessionsController } from "./sessions.controller";
import { SessionsService } from "./sessions.service";
import { SessionsGateway } from "./sessions.gateway";
import { MockChargerAdapter } from "./adapters/mock-charger-adapter";
import { EnodeChargerAdapter } from "./adapters/enode-charger-adapter";
import { EnodeClient } from "./adapters/enode-client";
import { EnodeWebhookController } from "./adapters/enode-webhook.controller";
import { OcppChargerAdapter } from "./adapters/ocpp-charger-adapter";
import { OcppCentralSystem } from "./ocpp/ocpp-central-system";
import { ChargerAdapterRegistry } from "./adapters/charger-adapter-registry";

@Module({
  imports: [AuthModule, ExtensionRequestsModule],
  controllers: [SessionsController, EnodeWebhookController],
  providers: [
    SessionsService,
    SessionsGateway,
    MockChargerAdapter,
    EnodeChargerAdapter,
    EnodeClient,
    OcppChargerAdapter,
    // OnModuleInit here is what actually starts the OCPP WebSocket server
    // (see OCPP-INTEGRATION.md) — a real long-lived listener, not just a
    // request-scoped helper.
    OcppCentralSystem,
    // SessionsService depends on the registry, not on any adapter
    // directly — it looks one up per charger, by that charger's own
    // connectionRoute.
    ChargerAdapterRegistry,
  ],
})
export class SessionsModule {}
