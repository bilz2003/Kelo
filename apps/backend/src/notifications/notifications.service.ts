import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Expo, ExpoPushMessage } from "expo-server-sdk";
import { PrismaService } from "../prisma/prisma.service";
import { ExtensionRequestEvent } from "../extension-requests/extension-request.event";
import { SessionEndedEvent } from "../sessions/session-ended.event";
import { SessionStartedEvent } from "../sessions/session-started.event";
import { BookingCreatedEvent } from "../bookings/booking-created.event";
import { BookingNoShowEvent } from "../no-show/booking-no-show.event";

interface PushPayload {
  title: string;
  body: string;
  data: Record<string, unknown>;
}

/**
 * Reacts to the same EventEmitter2 events SessionsGateway already
 * broadcasts over the WebSocket (extension.requested/approved/declined,
 * session.ended) plus booking.created — no restructuring of the services
 * that emit them, this just adds another listener. A future trigger
 * (no-show, etc.) is the same shape: emit an event where the action
 * happens, add one @OnEvent handler here.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly expo = new Expo();

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent("extension.requested")
  async onExtensionRequested(payload: ExtensionRequestEvent) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: payload.bookingId },
      select: { charger: { select: { ownerId: true, title: true } } },
    });
    if (!booking) return;
    await this.send(booking.charger.ownerId, {
      title: "Extension requested",
      body: `A driver has asked to extend their booking at ${booking.charger.title}.`,
      data: { type: "extension_requested", bookingId: payload.bookingId },
    });
  }

  @OnEvent("extension.approved")
  onExtensionApproved(payload: ExtensionRequestEvent) {
    return this.notifyDriverOfExtensionResponse(payload, true);
  }

  @OnEvent("extension.declined")
  onExtensionDeclined(payload: ExtensionRequestEvent) {
    return this.notifyDriverOfExtensionResponse(payload, false);
  }

  private async notifyDriverOfExtensionResponse(payload: ExtensionRequestEvent, approved: boolean) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: payload.bookingId },
      select: { driverId: true, charger: { select: { title: true } } },
    });
    if (!booking) return;
    await this.send(booking.driverId, {
      title: approved ? "Extension approved" : "Extension declined",
      body: approved
        ? `Your extension at ${booking.charger.title} was approved.`
        : `Your extension request at ${booking.charger.title} was declined.`,
      data: { type: "extension_responded", bookingId: payload.bookingId },
    });
  }

  @OnEvent("booking.created")
  async onBookingCreated(payload: BookingCreatedEvent) {
    const charger = await this.prisma.charger.findUnique({
      where: { id: payload.chargerId },
      select: { ownerId: true, title: true },
    });
    if (!charger) return;
    await this.send(charger.ownerId, {
      title: "New booking",
      body: `Someone booked ${charger.title}.`,
      data: { type: "booking_created", bookingId: payload.bookingId },
    });
  }

  @OnEvent("session.ended")
  async onSessionEnded(payload: SessionEndedEvent) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: payload.bookingId },
      select: { driverId: true },
    });
    if (!booking) return;
    await this.send(booking.driverId, {
      title: "Charging session ended",
      body: `£${payload.totalCost.toFixed(2)} total — tap to see your receipt.`,
      data: { type: "session_ended", bookingId: payload.bookingId },
    });
  }

  // Real-time discovery for the host's My Chargers screen, chosen over
  // polling GET /sessions/active-for-host on an interval — this reuses the
  // exact push mechanism already in place for extension.requested/
  // booking.created (both land on My Chargers too) rather than adding a
  // second, always-on real-time mechanism next to the WebSocket one that
  // already exists once a session's discovered. The one gap this leaves —
  // a host with push permission denied who leaves My Chargers open across
  // a session starting — is the same pre-existing gap every other trigger
  // here already has; the focus-triggered fetch still covers a tab switch
  // or app reopen either way.
  @OnEvent("session.started")
  async onSessionStarted(payload: SessionStartedEvent) {
    const charger = await this.prisma.charger.findUnique({
      where: { id: payload.chargerId },
      select: { ownerId: true, title: true },
    });
    if (!charger) return;
    await this.send(charger.ownerId, {
      title: "Charging started",
      body: `A session just started at ${charger.title}.`,
      data: { type: "session_started", bookingId: payload.bookingId, chargerId: payload.chargerId },
    });
  }

  @OnEvent("booking.noshow")
  async onBookingNoShow(payload: BookingNoShowEvent) {
    const charger = await this.prisma.charger.findUnique({
      where: { id: payload.chargerId },
      select: { ownerId: true, title: true, noShowFee: true },
    });
    if (!charger) return;
    await this.send(charger.ownerId, {
      title: "Driver no-show",
      body: `A driver didn't show up at ${charger.title} — £${charger.noShowFee.toFixed(2)} fee recorded.`,
      data: { type: "no_show", bookingId: payload.bookingId },
    });
  }

  /**
   * Public so a trigger that isn't a natural EventEmitter listener can
   * call straight in without duplicating the token-lookup/no-op/send
   * logic below — exactly what booking.noshow above turned out not to
   * need, since it's a plain event listener like the rest.
   *
   * No registered token — never granted permission, or hasn't registered
   * yet — is a clean no-op, not an error: most users at any given moment
   * fall in exactly this bucket, and every trigger point above must keep
   * working (booking creation, extension requests, session end) whether
   * or not the other party opted in to push.
   */
  async send(userId: number, payload: PushPayload): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { pushToken: true } });
    if (!user?.pushToken) return;

    if (!Expo.isExpoPushToken(user.pushToken)) {
      this.logger.warn(`Stored push token for user ${userId} is not a valid Expo push token — skipping and clearing it`);
      await this.prisma.user.update({ where: { id: userId }, data: { pushToken: null } });
      return;
    }

    const messages: ExpoPushMessage[] = [
      { to: user.pushToken, sound: "default", title: payload.title, body: payload.body, data: payload.data },
    ];

    for (const chunk of this.expo.chunkPushNotifications(messages)) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        for (const ticket of tickets) {
          if (ticket.status === "error") {
            this.logger.error(`Push to user ${userId} failed: ${ticket.message}`);
            // Expo's own signal that this token is dead (app uninstalled,
            // etc.) — clearing it now means the next send for this user is
            // a clean no-op instead of repeating the same failed request.
            if (ticket.details?.error === "DeviceNotRegistered") {
              await this.prisma.user.update({ where: { id: userId }, data: { pushToken: null } });
            }
          } else {
            this.logger.log(`Push to user ${userId} accepted by Expo (type=${String(payload.data.type)}, ticket=ok)`);
          }
        }
      } catch (err) {
        this.logger.error(`Push send failed for user ${userId}`, err as Error);
      }
    }
  }
}
