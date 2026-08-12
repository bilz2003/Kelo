import { Module } from "@nestjs/common";
import { BookingsModule } from "../bookings/bookings.module";
import { ExtensionRequestsController } from "./extension-requests.controller";
import { ExtensionRequestsService } from "./extension-requests.service";

@Module({
  imports: [BookingsModule],
  controllers: [ExtensionRequestsController],
  providers: [ExtensionRequestsService],
  exports: [ExtensionRequestsService],
})
export class ExtensionRequestsModule {}
