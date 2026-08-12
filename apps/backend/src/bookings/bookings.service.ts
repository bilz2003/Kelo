import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { BookingStatus } from "@prisma/client";
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

    const arrivalAt = new Date(dto.arrivalAt);
    const endAt = new Date(dto.endAt);
    await this.assertNoConflict(dto.chargerId, arrivalAt, endAt);

    return this.prisma.booking.create({
      data: {
        driverId,
        chargerId: dto.chargerId,
        arrivalAt,
        endAt,
      },
    });
  }

  /**
   * A booking whose session ended early (Session.endedAt set, before the
   * booking's own endAt — see SessionsService.simulateUnplug) only blocks
   * up to that real end, not its originally booked one. A booking with no
   * session yet, or one whose session hasn't ended, still blocks its full
   * original window — this is the only thing that changes the blocking
   * window; nothing here special-cases early vs on-time vs late, it just
   * falls out of comparing two real timestamps.
   *
   * Not private: ExtensionRequestsService re-runs this exact check (same
   * algorithm, not a reimplementation) when a host approves a new end
   * time, excluding the booking being extended from its own candidate set
   * via `excludeBookingId` — otherwise a booking would trivially conflict
   * with itself.
   */
  async assertNoConflict(chargerId: number, arrivalAt: Date, endAt: Date, excludeBookingId?: number) {
    const candidates = await this.prisma.booking.findMany({
      where: {
        chargerId,
        status: { notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW] },
        arrivalAt: { lt: endAt },
        ...(excludeBookingId !== undefined ? { id: { not: excludeBookingId } } : {}),
      },
      include: { session: true },
    });

    const conflict = candidates.some((existing) => {
      const effectiveEnd =
        existing.session?.endedAt && existing.session.endedAt < existing.endAt ? existing.session.endedAt : existing.endAt;
      return arrivalAt < effectiveEnd;
    });

    if (conflict) {
      throw new ConflictException("This charger is already booked for part of that time window");
    }
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
