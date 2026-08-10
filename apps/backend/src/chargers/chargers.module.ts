import { Module } from "@nestjs/common";
import { ChargersService } from "./chargers.service";
import { ChargersController } from "./chargers.controller";

@Module({
  providers: [ChargersService],
  controllers: [ChargersController],
  exports: [ChargersService],
})
export class ChargersModule {}
