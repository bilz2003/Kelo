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

  /**
   * Mock-only stand-in for a real hardware unplug signal (an OCPP
   * StatusNotification/StopTransaction, or Enode's equivalent) — the ONLY
   * way a session ends. Delete this endpoint once real charger integration
   * replaces MockChargerAdapter and the real signal drives simulateUnplug
   * (or its real-adapter equivalent) directly instead of an app request.
   */
  @Post(":id/simulate-unplug")
  simulateUnplug(@CurrentUser() user: RequestUser, @Param("id", ParseIntPipe) id: number) {
    return this.sessionsService.simulateUnplug(id, user.userId);
  }

  @Get("active")
  active(@CurrentUser() user: RequestUser) {
    return this.sessionsService.getActiveSession(user.userId);
  }

  // Host-side discovery — see the doc comment on
  // SessionsService.getActiveSessionsForHost for why this exists as its
  // own endpoint rather than something derived client-side from "active".
  @Get("active-for-host")
  activeForHost(@CurrentUser() user: RequestUser) {
    return this.sessionsService.getActiveSessionsForHost(user.userId);
  }
}
