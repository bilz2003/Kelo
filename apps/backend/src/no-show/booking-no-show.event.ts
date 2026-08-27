/** Emitted once a booking is actually marked NO_SHOW — consumed by NotificationsService, to tell the charger's owner. */
export interface BookingNoShowEvent {
  bookingId: number;
  chargerId: number;
}
