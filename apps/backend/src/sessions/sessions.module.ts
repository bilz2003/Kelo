import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ExtensionRequestsModule } from "../extension-requests/extension-requests.module";
import { SessionsController } from "./sessions.controller";
import { SessionsService } from "./sessions.service";
import { SessionsGateway } from "./sessions.gateway";
import { MockChargerAdapter } from "./adapters/mock-charger-adapter";
import { EnodeChargerAdapter } from "./adapters/enode-charger-adapter";
import { ChargerAdapterRegistry } from "./adapters/charger-adapter-registry";

@Module({
  imports: [AuthModule, ExtensionRequestsModule],
  controllers: [SessionsController],
  providers: [
    SessionsService,
    SessionsGateway,
    MockChargerAdapter,
    EnodeChargerAdapter,
    // SessionsService depends on the registry, not on either adapter
    // directly — it looks one up per charger, by that charger's own
    // connectionRoute. A real OCPP adapter replacing the mock, later,
    // is a one-line change inside the registry, not here.
    ChargerAdapterRegistry,
  ],
})
export class SessionsModule {}
