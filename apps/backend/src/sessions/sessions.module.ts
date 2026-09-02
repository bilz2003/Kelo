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
    // SessionsService depends on the registry, not on either adapter
    // directly — it looks one up per charger, by that charger's own
    // connectionRoute. A real OCPP adapter replacing the mock, later,
    // is a one-line change inside the registry, not here.
    ChargerAdapterRegistry,
  ],
})
export class SessionsModule {}
