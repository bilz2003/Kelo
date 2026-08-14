import { Module } from "@nestjs/common";
import { GeocodingModule } from "../geocoding/geocoding.module";
import { ChargersService } from "./chargers.service";
import { ChargersController } from "./chargers.controller";

@Module({
  imports: [GeocodingModule],
  providers: [ChargersService],
  controllers: [ChargersController],
  exports: [ChargersService],
})
export class ChargersModule {}
