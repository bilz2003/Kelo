import { Module } from "@nestjs/common";
import { NoShowService } from "./no-show.service";

@Module({
  providers: [NoShowService],
})
export class NoShowModule {}
