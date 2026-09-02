import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { BookingStatus, Prisma, SessionEndedReason, TransactionType } from "@prisma/client";
import { computeSessionFinancials, ENERGY_COMMISSION, IDLE_COMMISSION, OVERSTAY_COMMISSION } from "@kelo/core";
import { PrismaService } from "../prisma/prisma.service";
import { ExtensionRequestsService } from "../extension-requests/extension-requests.service";
import { ChargerAdapterRegistry } from "./adapters/charger-adapter-registry";
import { MeterState } from "./adapters/charger-adapter.interface";
import { toCoreCharger } from "./charger-mapping";
import { SessionEndedEvent } from "./session-ended.event";

type SessionWithBookingAndCharger = Prisma.SessionGetPayload<{ include: { booking: { include: { charger: true } } } }>;

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly extensionRequests: ExtensionRequestsService,
    private readonly adapters: ChargerAdapterRegistry,
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

    const adapter = this.adapters.forRoute(booking.charger.connectionRoute);

    const session = await this.prisma.session.create({
      data: {
        bookingId: booking.id,
        startedAt: new Date(),
        meterStartKwh: 0,
      },
    });
    await this.prisma.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.ACTIVE } });

    try {
      await adapter.authorize(session.id);
    } catch (err) {
      // The charger refused to start (a real rejection, Enode's stub
      // throwing "not configured", or a real Enode call failing) — undo
      // the two writes above by hand rather than wrapping them in a DB
      // transaction together with authorize(): every adapter re-queries
      // the session by id internally (EnodeChargerAdapter does, to reach
      // its booking/charger), and inside an open transaction that row
      // isn't visible yet to a query running outside that same
      // transaction — it isn't committed. Compensating here instead
      // avoids that trap while still leaving no orphaned Session row and
      // no booking stuck ACTIVE with nothing actually running.
      await this.prisma.session.delete({ where: { id: session.id } });
      await this.prisma.booking.update({ where: { id: booking.id }, data: { status: booking.status } });
      throw err;
    }

    return { id: session.id, bookingId: session.bookingId, startedAt: session.startedAt };
  }

  /**
   * The driver-triggered way a session ends: a backend-forced stop
   * (mock's own endpoint standing in for a real hardware signal; a real
   * Enode STOP command; or, for OCPP, RemoteStopTransaction). Fetches the
   * adapter's own MeterState via .stop() first, then runs the one shared
   * finalization path every route uses — see finalizeSession.
   */
  async simulateUnplug(sessionId: number, driverId: number): Promise<SessionEndedEvent> {
    const session = await this.findOwnedSession(sessionId, driverId);
    if (session.endedAt) {
      throw new ConflictException("This session has already ended");
    }

    const meterState = await this.adapters.forRoute(session.booking.charger.connectionRoute).stop(sessionId);
    return this.finalizeSession(session, meterState);
  }

  /**
   * The OTHER way a session ends: a real OCPP charge point sending an
   * unsolicited StopTransaction — a genuine physical unplug it reported on
   * its own, with no RemoteStopTransaction behind it and so no HTTP caller
   * anywhere in the stack. OcppCentralSystem emits ocpp.stop.unsolicited
   * for exactly this case; this is its only handler, and it runs through
   * the exact same finalizeSession every other route (including a
   * backend-forced OCPP stop, via simulateUnplug above) already uses —
   * not a second, parallel finalization path.
   */
  @OnEvent("ocpp.stop.unsolicited")
  async onOcppUnsolicitedStop(payload: { sessionId: number; meterState: MeterState }): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: { booking: { include: { charger: true } } },
    });
    if (!session || session.endedAt) return; // unknown, or already finalized elsewhere — nothing to do
    await this.finalizeSession(session, payload.meterState);
  }

  /**
   * The ONE place Session/Transaction rows actually get written to end a
   * session, and the ONE place computeSessionFinancials gets called for
   * that — every route (mock, Enode, OCPP; driver-triggered or
   * charge-point-triggered) funnels through here with nothing but a
   * MeterState, precisely so none of them can silently diverge on the
   * pricing/idle/overstay rules.
   */
  private async finalizeSession(session: SessionWithBookingAndCharger, meterState: MeterState): Promise<SessionEndedEvent> {
    const { kwh, seconds } = meterState;
    const now = new Date();
    const { booking } = session;
    const { charger } = booking;

    const bookingEndSeconds = (booking.endAt.getTime() - session.startedAt.getTime()) / 1000;
    const financials = computeSessionFinancials(toCoreCharger(charger), kwh, seconds, bookingEndSeconds);

    const minutesReleased = Math.max(0, (booking.endAt.getTime() - now.getTime()) / 60000);
    const released = minutesReleased > 0;

    await this.prisma.session.update({
      where: { id: session.id },
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
      sessionId: session.id,
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
    // Was previously hardcoded to computeMockMeterState regardless of the
    // charger's own connectionRoute — meaning a real (non-mock) session's
    // live screen would have shown the mock's simulated curve instead of
    // real adapter-sourced data. Route through the same registry every
    // other adapter call goes through instead. If the adapter has no live
    // reading for this charger right now (e.g. the mock's own in-memory
    // tracking was lost to a backend restart since authorize() ran, or a
    // real adapter's webhook-driven tracking hasn't received an update
    // yet), fall back to zero kwh with real elapsed time rather than
    // fabricating a number.
    const live = await this.adapters.forRoute(charger.connectionRoute).getMeterValue(charger.id);
    const { kwh, seconds } =
      live ?? { kwh: 0, seconds: Math.max(0, Math.floor((Date.now() - session.startedAt.getTime()) / 1000)) };
    const pendingExtension = await this.extensionRequests.findPendingForBooking(session.bookingId);
    return {
      id: session.id,
      bookingId: session.bookingId,
      startedAt: session.startedAt,
      arrivalAt: session.booking.arrivalAt,
      endAt: session.booking.endAt,
      kwh,
      seconds,
      charger: toCoreCharger(charger),
      pendingExtension: pendingExtension
        ? { id: pendingExtension.id, requestedEndAt: pendingExtension.requestedEndAt, status: "pending" as const }
        : null,
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
