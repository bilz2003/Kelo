import { Charger } from "@kelo/core";
import { apiFetch } from "./client";

/**
 * Discover now returns real backend chargers (GET /chargers/discover) —
 * charger.id is already a real Charger row's id, so booking is a direct
 * POST /bookings against it. This used to lazily mirror the mock charger
 * into a new backend Charger first (there was no real Discover data to
 * book against yet); that's gone now there's a real id to use directly,
 * which also means this never touches charger.fullAddress/hostCost —
 * neither is present on a Discover-sourced charger to begin with.
 */
export async function ensureRealBooking(charger: Charger, arrival: Date, endTime: Date): Promise<number> {
  const booking = await apiFetch<{ id: number }>("/bookings", {
    method: "POST",
    body: {
      chargerId: charger.id,
      arrivalAt: arrival.toISOString(),
      endAt: endTime.toISOString(),
    },
  });
  return booking.id;
}
