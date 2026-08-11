import { Charger } from "@kelo/core";
import { apiFetch } from "./client";

/**
 * Discover/AddCharger/booking browsing still run entirely on local mock
 * data (ChargerStoreContext) — there's no "list real chargers" endpoint
 * yet, that's separate scope. But starting a real session needs a real
 * Booking row, which needs a real Charger row to point at. This bridges
 * the two: lazily creates a backend Charger mirroring the mock one (cached
 * per mock charger id so repeat bookings don't spawn duplicates for the
 * lifetime of the app process), then a real Booking against it.
 *
 * Consistent with Kelo's one-account model: the signed-in user ends up as
 * both the Charger's owner and the Booking's driver, exactly like a host
 * would look if they booked their own driveway for a test session.
 */

const realChargerIdCache = new Map<number, number>();

function toCableType(cable: Charger["cable"]): "TETHERED" | "BRING_YOUR_OWN" {
  return cable === "Tethered cable" ? "TETHERED" : "BRING_YOUR_OWN";
}

async function ensureRealCharger(charger: Charger): Promise<number> {
  const cached = realChargerIdCache.get(charger.id);
  if (cached !== undefined) return cached;

  const created = await apiFetch<{ id: number }>("/chargers", {
    method: "POST",
    body: {
      postcode: charger.postcode,
      fullAddress: charger.fullAddress,
      title: charger.title,
      powerKw: charger.powerNum,
      cable: toCableType(charger.cable),
      connector: charger.connector,
      rate: charger.rate,
      overstayRate: charger.overstayRate,
      idleRate: charger.idleRate,
      noShowFee: charger.noShowFee,
      hostCost: charger.hostCost,
      connectionRoute: "OCPP",
    },
  });

  realChargerIdCache.set(charger.id, created.id);
  return created.id;
}

export async function ensureRealBooking(charger: Charger, arrival: Date, endTime: Date): Promise<number> {
  const realChargerId = await ensureRealCharger(charger);
  const booking = await apiFetch<{ id: number }>("/bookings", {
    method: "POST",
    body: {
      chargerId: realChargerId,
      arrivalAt: arrival.toISOString(),
      endAt: endTime.toISOString(),
    },
  });
  return booking.id;
}
