import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ExtensionRequestStatus } from "@prisma/client";
import { MAX_BOOKING_HOURS } from "@kelo/core";
import { PrismaService } from "../prisma/prisma.service";
import { BookingsService } from "../bookings/bookings.service";
import { ExtensionRequestEvent } from "./extension-request.event";

@Injectable()
export class ExtensionRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsService: BookingsService,
    private readonly events: EventEmitter2,
  ) {}

  async create(bookingId: number, driverId: number, requestedEndAtRaw: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { session: true },
    });
    if (!booking || booking.driverId !== driverId) {
      throw new NotFoundException("Booking not found");
    }

    const now = new Date();
    if (booking.endAt <= now) {
      // Once the original window has passed, overstay rules are already
      // live for whatever's still plugged in — extension requests are a
      // pre-deadline mechanism, not a way to retroactively cover overstay.
      throw new ConflictException("This booking's end time has already passed — too late to request an extension");
    }

    const requestedEndAt = new Date(requestedEndAtRaw);
    if (requestedEndAt <= booking.endAt) {
      throw new BadRequestException("Requested end time must be after the current end time");
    }

    const maxEndAt = new Date(booking.arrivalAt.getTime() + MAX_BOOKING_HOURS * 3600_000);
    if (requestedEndAt > maxEndAt) {
      throw new BadRequestException(`Requested end time can't be more than ${MAX_BOOKING_HOURS} hours after arrival`);
    }

    const existingPending = await this.prisma.extensionRequest.findFirst({
      where: { bookingId, status: ExtensionRequestStatus.PENDING },
    });
    if (existingPending) {
      throw new ConflictException("This booking already has a pending extension request");
    }

    const request = await this.prisma.extensionRequest.create({
      data: { bookingId, requestedEndAt, status: ExtensionRequestStatus.PENDING },
    });

    if (booking.session) {
      this.emit("extension.requested", request, booking.session.id, "pending");
    }

    return request;
  }

  /**
   * On approval, re-runs the exact same conflict check the original
   * booking (and this request) already passed once, against the requested
   * new end time — something else could have been booked into that
   * charger's schedule between the request and now, so passing once at
   * request time doesn't guarantee it's still clear at approval time.
   */
  async respond(id: number, hostId: number, approve: boolean) {
    const request = await this.prisma.extensionRequest.findUnique({
      where: { id },
      include: { booking: { include: { charger: true, session: true } } },
    });
    if (!request) {
      throw new NotFoundException("Extension request not found");
    }
    if (request.booking.charger.ownerId !== hostId) {
      throw new ForbiddenException("Not your charger");
    }
    if (request.status !== ExtensionRequestStatus.PENDING) {
      throw new ConflictException("This request has already been responded to");
    }

    if (approve) {
      // Throws (409) before anything is written if it now conflicts — the
      // request stays pending rather than silently succeeding or getting
      // marked approved/declined against its will.
      await this.bookingsService.assertNoConflict(
        request.booking.chargerId,
        request.booking.arrivalAt,
        request.requestedEndAt,
        request.bookingId,
      );

      await this.prisma.booking.update({
        where: { id: request.bookingId },
        data: { endAt: request.requestedEndAt },
      });
    }

    const updated = await this.prisma.extensionRequest.update({
      where: { id },
      data: {
        status: approve ? ExtensionRequestStatus.APPROVED : ExtensionRequestStatus.DECLINED,
        respondedAt: new Date(),
      },
    });

    if (request.booking.session) {
      this.emit(approve ? "extension.approved" : "extension.declined", updated, request.booking.session.id, approve ? "approved" : "declined");
    }

    return updated;
  }

  /** Used by SessionsService.getActiveSession so a reconnecting driver doesn't lose a pending request's state. */
  async findPendingForBooking(bookingId: number) {
    return this.prisma.extensionRequest.findFirst({
      where: { bookingId, status: ExtensionRequestStatus.PENDING },
    });
  }

  private emit(
    eventName: "extension.requested" | "extension.approved" | "extension.declined",
    request: { id: number; bookingId: number; requestedEndAt: Date },
    sessionId: number,
    status: ExtensionRequestEvent["status"],
  ) {
    const payload: ExtensionRequestEvent = {
      id: request.id,
      bookingId: request.bookingId,
      sessionId,
      requestedEndAt: request.requestedEndAt,
      status,
    };
    this.events.emit(eventName, payload);
  }
}
