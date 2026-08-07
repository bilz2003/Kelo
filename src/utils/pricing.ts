import { Charger, SessionFinancials } from "@/types";

// Kelo's commission rates, per the pricing model:
// - 12% on the energy charge
// - 12% on the idle occupancy charge
// - 30% on overstay (not simulated in the live session demo below)
// - 0% on the no-show/late-cancellation fee (goes entirely to the host)
export const ENERGY_COMMISSION = 0.12;
export const IDLE_COMMISSION = 0.12;
export const OVERSTAY_COMMISSION = 0.3;

// Simulated live-session timing (accelerated for demo purposes — see
// ActiveSessionScreen). Swap these for real elapsed time once wired to an
// actual OCPP/Enode meter feed.
export const SESSION_FULL_AT_SECONDS = 18; // simulated "battery full" moment
export const SESSION_IDLE_GRACE_SECONDS = 6; // simulated stand-in for the real 15-minute grace buffer

/**
 * Computes both what the driver is actually charged (gross) and what the
 * host actually receives after Kelo's commission (net) for a given amount
 * of energy delivered and elapsed session time.
 *
 * Kept as one shared function so the driver's live screen and the host's
 * live card can never silently drift apart or disagree with each other.
 */
export function computeSessionFinancials(charger: Charger, kwh: number, seconds: number): SessionFinancials {
  const idleStartSecond = SESSION_FULL_AT_SECONDS + SESSION_IDLE_GRACE_SECONDS;
  const idleChargesActive = seconds >= idleStartSecond;
  // 1 simulated second stands in for 1 idle minute here, consistent with
  // how charging time is already compressed for the live demo.
  const idleMinutesElapsed = idleChargesActive ? seconds - idleStartSecond : 0;
  const idleCost = idleMinutesElapsed * charger.idleRate;
  const energyCost = kwh * charger.rate;
  const totalCost = energyCost + idleCost; // what the driver is billed
  const hostNet = energyCost * (1 - ENERGY_COMMISSION) + idleCost * (1 - IDLE_COMMISSION); // what the host receives

  return { idleChargesActive, idleMinutesElapsed, idleCost, energyCost, totalCost, hostNet };
}

/** Rough kWh estimate shown while a driver is still choosing arrival/end time in the booking flow. */
export function estimateBookingEnergy(charger: Charger, durationHours: number) {
  const estKwh = (charger.powerNum * durationHours * 0.55).toFixed(1);
  const estCost = (parseFloat(estKwh) * charger.rate).toFixed(2);
  return { estKwh, estCost };
}
