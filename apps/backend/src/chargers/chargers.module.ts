import { Module } from "@nestjs/common";
import { GeocodingModule } from "../geocoding/geocoding.module";
import { PhotosModule } from "../photos/photos.module";
import { EnodeClientModule } from "../sessions/adapters/enode-client.module";
import { ChargersService } from "./chargers.service";
import { ChargersController } from "./chargers.controller";
import { EnodeLinkService } from "./enode-link.service";

@Module({
  imports: [GeocodingModule, PhotosModule, EnodeClientModule],
  providers: [ChargersService, EnodeLinkService],
  controllers: [ChargersController],
  exports: [ChargersService],
})
export class ChargersModule {}
