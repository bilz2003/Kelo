import { Module } from "@nestjs/common";
import { GeocodingModule } from "../geocoding/geocoding.module";
import { PhotosModule } from "../photos/photos.module";
import { EnodeClientModule } from "../sessions/adapters/enode-client.module";
import { SessionsModule } from "../sessions/sessions.module";
import { ChargersService } from "./chargers.service";
import { ChargersController } from "./chargers.controller";
import { EnodeLinkService } from "./enode-link.service";

@Module({
  // SessionsModule is imported for its exported OcppOnboardingService —
  // the OCPP-route equivalent of EnodeLinkService, used the same way.
  // No circular-dependency risk: SessionsModule doesn't import
  // ChargersModule, and ChargersModule is itself only ever imported by
  // AppModule.
  imports: [GeocodingModule, PhotosModule, EnodeClientModule, SessionsModule],
  providers: [ChargersService, EnodeLinkService],
  controllers: [ChargersController],
  exports: [ChargersService],
})
export class ChargersModule {}
