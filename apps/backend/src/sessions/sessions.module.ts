import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SessionsController } from "./sessions.controller";
import { SessionsService } from "./sessions.service";
import { SessionsGateway } from "./sessions.gateway";
import { MockChargerAdapter } from "./adapters/mock-charger-adapter";
import { CHARGER_ADAPTER } from "./adapters/charger-adapter.interface";

@Module({
  imports: [AuthModule],
  controllers: [SessionsController],
  providers: [
    SessionsService,
    SessionsGateway,
    MockChargerAdapter,
    // The only line that changes when a real OCPP/Enode adapter replaces
    // the mock — SessionsService depends on the CHARGER_ADAPTER token, not
    // on MockChargerAdapter directly.
    { provide: CHARGER_ADAPTER, useExisting: MockChargerAdapter },
  ],
})
export class SessionsModule {}
