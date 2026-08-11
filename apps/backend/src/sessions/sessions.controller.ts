import { Controller, Get, Param, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/current-user.decorator";
import { SessionsService } from "./sessions.service";

@Controller("sessions")
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post(":bookingId/start")
  start(@CurrentUser() user: RequestUser, @Param("bookingId", ParseIntPipe) bookingId: number) {
    return this.sessionsService.startSession(bookingId, user.userId);
  }

  @Post(":id/end")
  end(@CurrentUser() user: RequestUser, @Param("id", ParseIntPipe) id: number) {
    return this.sessionsService.endSession(id, user.userId);
  }

  @Get("active")
  active(@CurrentUser() user: RequestUser) {
    return this.sessionsService.getActiveSession(user.userId);
  }
}
