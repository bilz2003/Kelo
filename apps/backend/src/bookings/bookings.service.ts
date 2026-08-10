import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBookingDto } from "./dto/create-booking.dto";

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(driverId: number, dto: CreateBookingDto) {
    const charger = await this.prisma.charger.findFirst({
      where: { id: dto.chargerId, removedAt: null },
    });
    if (!charger) {
      throw new NotFoundException("Charger not found");
    }

    return this.prisma.booking.create({
      data: {
        driverId,
        chargerId: dto.chargerId,
        arrivalAt: new Date(dto.arrivalAt),
        endAt: new Date(dto.endAt),
      },
    });
  }

  findAllForDriver(driverId: number) {
    return this.prisma.booking.findMany({
      where: { driverId },
      orderBy: { createdAt: "desc" },
      include: { charger: true },
    });
  }

  async findOneForDriver(driverId: number, id: number) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, driverId },
      include: { charger: true },
    });
    if (!booking) {
      throw new NotFoundException("Booking not found");
    }
    return booking;
  }
}
