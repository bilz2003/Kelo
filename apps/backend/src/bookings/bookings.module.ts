import { Module } from "@nestjs/common";
import { PhotosModule } from "../photos/photos.module";
import { BookingsService } from "./bookings.service";
import { BookingsController } from "./bookings.controller";

@Module({
  imports: [PhotosModule],
  providers: [BookingsService],
  controllers: [BookingsController],
  // ExtensionRequestsService reuses assertNoConflict rather than
  // reimplementing it — see the doc comment there.
  exports: [BookingsService],
})
export class BookingsModule {}
