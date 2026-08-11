import { SessionFinancials } from "@kelo/core";

/**
 * Broadcast to every subscriber of a session's room the moment it ends —
 * the one and only source the client-side receipt is driven from,
 * regardless of what actually triggered the end (mock simulate-unplug now,
 * a real hardware signal later).
 */
export interface SessionEndedEvent extends SessionFinancials {
  sessionId: number;
  bookingId: number;
  kwh: number;
  seconds: number;
  /** Whether any booked time remained at the moment of unplug (false for on-time/late). */
  released: boolean;
  minutesReleased: number;
  charger: { id: number; title: string; rate: number };
}
