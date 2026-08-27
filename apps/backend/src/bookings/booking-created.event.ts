/** Emitted once a booking is successfully created — currently only consumed by NotificationsService, to tell the charger's owner. */
export interface BookingCreatedEvent {
  bookingId: number;
  chargerId: number;
}
