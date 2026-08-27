import { apiFetch } from "./client";
import { DiscoverCharger } from "./chargers";

export interface NextHostBooking {
  id: number;
  arrivalAt: string;
  endAt: string;
  driver: { id: number; name: string };
  charger: { id: number; title: string };
}

/**
 * The soonest upcoming booking across every charger the signed-in user
 * owns, queried server-side by ownerId — not tied to whatever mock
 * chargers happen to be listed locally in ChargerStoreContext. Returns
 * null if there's nothing upcoming (an honest empty state, not an error).
 */
export function getNextBookingForHost(): Promise<NextHostBooking | null> {
  return apiFetch("/bookings/next-for-host");
}

// GET /bookings/:id is driver-scoped server-side (bookings.service.ts's
// findOneForDriver) and is the only place fullAddress is included outside
// the owner's own listing view — DiscoverCharger plus that one field.
export interface BookingDetailCharger extends DiscoverCharger {
  fullAddress: string | null;
}

export interface BookingDetail {
  id: number;
  driverId: number;
  chargerId: number;
  arrivalAt: string;
  endAt: string;
  status: "UPCOMING" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  serviceChargePaid: boolean;
  createdAt: string;
  charger: BookingDetailCharger;
}

/**
 * A 404 here means "not your booking" as much as "doesn't exist" — the
 * backend doesn't distinguish the two (see bookings.service.ts), so
 * neither does this.
 */
export function getBookingDetail(id: number): Promise<BookingDetail> {
  return apiFetch(`/bookings/${id}`);
}

/** Every booking the signed-in driver has ever made, most recent first — same shape as getBookingDetail, just a list. */
export function getMyBookings(): Promise<BookingDetail[]> {
  return apiFetch("/bookings");
}

export interface CancelBookingResult {
  free: boolean;
  feeCharged: number;
}

/**
 * Driver-only, own booking — a 409 means it can no longer be cancelled
 * (already resolved, or a session's already started on it); a 404 means
 * not found or not yours, same non-distinction as getBookingDetail.
 */
export function cancelBooking(id: number): Promise<CancelBookingResult> {
  return apiFetch(`/bookings/${id}/cancel`, { method: "POST" });
}
