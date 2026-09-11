/**
 * Emitted the moment a session's authorize() call succeeds — consumed by
 * NotificationsService to nudge the charger's owner, and by nothing else
 * server-side. This is deliberately NOT broadcast over the session's
 * WebSocket room (unlike tick/session:ended/extension:*) — a host hasn't
 * discovered/subscribed to the room yet at this exact moment (that's the
 * whole gap this event exists to close), so there'd be no one listening.
 * The push notification this drives is what prompts the host's client to
 * go call GET /sessions/active-for-host and subscribe from there.
 */
export interface SessionStartedEvent {
  sessionId: number;
  bookingId: number;
  chargerId: number;
}
