import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { BookingStatus, SessionEndedReason, TransactionType } from "@prisma/client";
import { computeSessionFinancials, ENERGY_COMMISSION, IDLE_COMMISSION } from "@kelo/core";
import { PrismaService } from "../prisma/prisma.service";
import { CHARGER_ADAPTER, ChargerAdapter } from "./adapters/charger-adapter.interface";
import { toCoreCharger } from "./charger-mapping";
import { computeMockMeterState } from "./mock-meter";

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CHARGER_ADAPTER) private readonly chargerAdapter: ChargerAdapter,
  ) {}

  async startSession(bookingId: number, driverId: number) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { charger: true, session: true },
    });
    if (!booking || booking.driverId !== driverId) {
      throw new NotFoundException("Booking not found");
    }
    if (booking.session) {
      throw new ConflictException("This booking already has a session");
    }

    const session = await this.prisma.session.create({
      data: {
        bookingId: booking.id,
        startedAt: new Date(),
        meterStartKwh: 0,
      },
    });
    await this.prisma.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.ACTIVE } });

    await this.chargerAdapter.authorize(session.id);

    return { id: session.id, bookingId: session.bookingId, startedAt: session.startedAt };
  }

  async endSession(sessionId: number, driverId: number) {
    const session = await this.findOwnedSession(sessionId, driverId);
    if (session.endedAt) {
      throw new ConflictException("This session has already ended");
    }

    const { kwh, seconds } = await this.chargerAdapter.stop(sessionId);
    const charger = session.booking.charger;
    const financials = computeSessionFinancials(toCoreCharger(charger), kwh, seconds);

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        meterEndKwh: kwh,
        endedAt: new Date(),
        energyCost: financials.energyCost,
        idleCost: financials.idleCost,
        overstayCost: 0, // overstay isn't part of the mock simulation — see pricing.ts
        endedReason: SessionEndedReason.DRIVER_ENDED,
      },
    });
    await this.prisma.booking.update({ where: { id: session.bookingId }, data: { status: BookingStatus.COMPLETED } });

    await this.recordTransaction(session.bookingId, TransactionType.ENERGY, financials.energyCost, ENERGY_COMMISSION);
    if (financials.idleCost > 0) {
      await this.recordTransaction(session.bookingId, TransactionType.IDLE_OCCUPANCY, financials.idleCost, IDLE_COMMISSION);
    }

    return { kwh, seconds, ...financials };
  }

  async getActiveSession(driverId: number) {
    const session = await this.prisma.session.findFirst({
      where: { endedAt: null, booking: { driverId } },
      include: { booking: { include: { charger: true } } },
      orderBy: { startedAt: "desc" },
    });
    if (!session) return null;

    const charger = session.booking.charger;
    const { kwh, seconds } = computeMockMeterState(charger.powerKw, session.startedAt);
    return {
      id: session.id,
      bookingId: session.bookingId,
      startedAt: session.startedAt,
      kwh,
      seconds,
      charger: toCoreCharger(charger),
    };
  }

  /** Used by the WebSocket gateway to authorize a subscribe request. */
  async findSessionForAuth(sessionId: number) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { booking: { include: { charger: true } } },
    });
    if (!session) return null;
    return {
      driverId: session.booking.driverId,
      ownerId: session.booking.charger.ownerId,
    };
  }

  private async findOwnedSession(sessionId: number, driverId: number) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { booking: { include: { charger: true } } },
    });
    if (!session) {
      throw new NotFoundException("Session not found");
    }
    if (session.booking.driverId !== driverId) {
      throw new ForbiddenException("Not your session");
    }
    return session;
  }

  private async recordTransaction(bookingId: number, type: TransactionType, grossAmount: number, commissionRate: number) {
    const commissionAmount = grossAmount * commissionRate;
    await this.prisma.transaction.create({
      data: {
        bookingId,
        type,
        grossAmount,
        commissionAmount,
        hostNetAmount: grossAmount - commissionAmount,
      },
    });
  }
}
