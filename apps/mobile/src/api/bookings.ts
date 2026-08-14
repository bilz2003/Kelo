import { apiFetch } from "./client";

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
