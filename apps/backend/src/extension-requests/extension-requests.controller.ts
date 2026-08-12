import { Body, Controller, Param, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/current-user.decorator";
import { ExtensionRequestsService } from "./extension-requests.service";
import { CreateExtensionRequestDto } from "./dto/create-extension-request.dto";
import { RespondExtensionRequestDto } from "./dto/respond-extension-request.dto";

@Controller()
@UseGuards(JwtAuthGuard)
export class ExtensionRequestsController {
  constructor(private readonly extensionRequestsService: ExtensionRequestsService) {}

  @Post("bookings/:bookingId/extension-requests")
  create(
    @CurrentUser() user: RequestUser,
    @Param("bookingId", ParseIntPipe) bookingId: number,
    @Body() dto: CreateExtensionRequestDto,
  ) {
    return this.extensionRequestsService.create(bookingId, user.userId, dto.requestedEndAt);
  }

  @Post("extension-requests/:id/respond")
  respond(@CurrentUser() user: RequestUser, @Param("id", ParseIntPipe) id: number, @Body() dto: RespondExtensionRequestDto) {
    return this.extensionRequestsService.respond(id, user.userId, dto.approve);
  }
}
