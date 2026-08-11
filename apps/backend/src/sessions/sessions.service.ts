import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BookingStatus, SessionEndedReason, TransactionType } from "@prisma/client";
import { computeSessionFinancials, ENERGY_COMMISSION, IDLE_COMMISSION, OVERSTAY_COMMISSION } from "@kelo/core";
import { PrismaService } from "../prisma/prisma.service";
import { CHARGER_ADAPTER, ChargerAdapter } from "./adapters/charger-adapter.interface";
import { toCoreCharger } from "./charger-mapping";
import { computeMockMeterState } from "./mock-meter";
import { SessionEndedEvent } from "./session-ended.event";

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
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

  /**
   * The ONLY way a session ends. There is deliberately no app-triggered
   * "end session"/"release time" path — billing only stops when the
   * charger itself reports the driver has unplugged, whether that's early,
   * on time, or late. This mock endpoint stands in for that hardware
   * signal (a real OCPP StopTransaction/StatusNotification, or Enode's
   * equivalent) until real charger integration replaces the mock adapter —
   * see sessions.controller.ts for where it's wired up.
   *
   * Runs identically regardless of timing — no early/on-time/late branches
   * here. Whether idle or overstay actually accrued, and whether any
   * booked time gets released, all fall out of the same
   * computeSessionFinancials call plus a single "was there time left"
   * check, not special-cased handling per scenario.
   */
  async simulateUnplug(sessionId: number, driverId: number): Promise<SessionEndedEvent> {
    const session = await this.findOwnedSession(sessionId, driverId);
    if (session.endedAt) {
      throw new ConflictException("This session has already ended");
    }

    const now = new Date();
    const { booking } = session;
    const { charger } = booking;

    const { kwh, seconds } = await this.chargerAdapter.stop(sessionId);
    const bookingEndSeconds = (booking.endAt.getTime() - session.startedAt.getTime()) / 1000;
    const financials = computeSessionFinancials(toCoreCharger(charger), kwh, seconds, bookingEndSeconds);

    const minutesReleased = Math.max(0, (booking.endAt.getTime() - now.getTime()) / 60000);
    const released = minutesReleased > 0;

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        meterEndKwh: kwh,
        endedAt: now,
        energyCost: financials.energyCost,
        idleCost: financials.idleCost,
        overstayCost: financials.overstayCost,
        // Physically unplugging is still a driver action, just detected by
        // the charger rather than an app button — RELEASED_EARLY only
        // distinguishes the case where booked time actually remained.
        endedReason: released ? SessionEndedReason.RELEASED_EARLY : SessionEndedReason.DRIVER_ENDED,
      },
    });
    await this.prisma.booking.update({ where: { id: session.bookingId }, data: { status: BookingStatus.COMPLETED } });

    await this.recordTransaction(session.bookingId, TransactionType.ENERGY, financials.energyCost, ENERGY_COMMISSION);
    if (financials.idleCost > 0) {
      await this.recordTransaction(session.bookingId, TransactionType.IDLE_OCCUPANCY, financials.idleCost, IDLE_COMMISSION);
    }
    if (financials.overstayCost > 0) {
      await this.recordTransaction(session.bookingId, TransactionType.OVERSTAY, financials.overstayCost, OVERSTAY_COMMISSION);
    }

    const payload: SessionEndedEvent = {
      sessionId,
      bookingId: session.bookingId,
      kwh,
      seconds,
      ...financials,
      released,
      minutesReleased: Math.round(minutesReleased),
      charger: { id: charger.id, title: charger.title, rate: charger.rate },
    };

    // Same room every subscriber already joined for ticks — the driver and
    // the host (if connected) both get this at the same moment, from the
    // same broadcast, not two separate updates.
    this.events.emit("session.ended", payload);

    return payload;
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
