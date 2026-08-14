import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/current-user.decorator";
import { BookingsService } from "./bookings.service";
import { CreateBookingDto } from "./dto/create-booking.dto";

@Controller("bookings")
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.bookingsService.findAllForDriver(user.userId);
  }

  // Must come before @Get(":id") — otherwise "next-for-host" would match
  // the :id route first and fail ParseIntPipe instead of hitting this one.
  @Get("next-for-host")
  nextForHost(@CurrentUser() user: RequestUser) {
    return this.bookingsService.findNextUpcomingForOwner(user.userId);
  }

  @Get(":id")
  findOne(@CurrentUser() user: RequestUser, @Param("id", ParseIntPipe) id: number) {
    return this.bookingsService.findOneForDriver(user.userId, id);
  }
}
