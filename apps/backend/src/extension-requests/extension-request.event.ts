/**
 * Broadcast to the session's room — the same one ticks and session:ended
 * already use, not a new channel. Driver and host both receive all three
 * event types (extension:requested/approved/declined) from the same
 * broadcast, exactly like the existing tick/session:ended pattern; each
 * screen just renders differently depending on whether it's showing the
 * driver's or the host's view of that same session.
 */
export interface ExtensionRequestEvent {
  id: number;
  bookingId: number;
  sessionId: number;
  requestedEndAt: Date;
  status: "pending" | "approved" | "declined";
}
