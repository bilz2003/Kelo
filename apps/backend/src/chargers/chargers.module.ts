import { Module } from "@nestjs/common";
import { GeocodingModule } from "../geocoding/geocoding.module";
import { PhotosModule } from "../photos/photos.module";
import { ChargersService } from "./chargers.service";
import { ChargersController } from "./chargers.controller";

@Module({
  imports: [GeocodingModule, PhotosModule],
  providers: [ChargersService],
  controllers: [ChargersController],
  exports: [ChargersService],
})
export class ChargersModule {}
