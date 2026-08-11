import { Charger, SessionFinancials } from "./types";

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
export const OVERSTAY_GRACE_SECONDS = 6; // simulated stand-in for the real 15-minute grace buffer, same convention as idle's

/**
 * Computes both what the driver is actually charged (gross) and what the
 * host actually receives after Kelo's commission (net) for a given amount
 * of energy delivered and elapsed session time.
 *
 * `bookingEndSeconds` is how many seconds into the session the booking's
 * own booked window ends (i.e. (booking.endAt - session.startedAt) in
 * seconds), when known — it's what lets idle and overstay stay mutually
 * exclusive, sequential phases per BACKEND-PLAN.md §4 (idle accrues until
 * the booking's own end time, then overstay takes over after its own
 * grace) rather than both accruing over the same stretch of real time.
 * Omit it (the default) for contexts with no booking to check against,
 * e.g. the live per-tick display, which only ever shows idle.
 *
 * Kept as one shared function so the driver's live screen, the host's
 * live card, and the backend's final receipt can never silently drift
 * apart or disagree with each other.
 */
export function computeSessionFinancials(
  charger: Charger,
  kwh: number,
  seconds: number,
  bookingEndSeconds: number | null = null,
): SessionFinancials {
  const idleStartSecond = SESSION_FULL_AT_SECONDS + SESSION_IDLE_GRACE_SECONDS;
  // Idle never runs past the booking's own end — that's where overstay
  // takes over instead, per the sequential (not overlapping) model above.
  const idleEndSecond = bookingEndSeconds !== null ? Math.min(seconds, bookingEndSeconds) : seconds;
  const idleChargesActive = idleEndSecond >= idleStartSecond;
  // 1 simulated second stands in for 1 idle/overstay minute here,
  // consistent with how charging time is already compressed for the demo.
  const idleMinutesElapsed = idleChargesActive ? idleEndSecond - idleStartSecond : 0;
  const idleCost = idleMinutesElapsed * charger.idleRate;

  const overstayStartSecond = bookingEndSeconds !== null ? bookingEndSeconds + OVERSTAY_GRACE_SECONDS : Infinity;
  const overstayActive = seconds >= overstayStartSecond;
  const overstayMinutesElapsed = overstayActive ? seconds - overstayStartSecond : 0;
  const overstayCost = overstayMinutesElapsed * charger.overstayRate;

  const energyCost = kwh * charger.rate;
  const totalCost = energyCost + idleCost + overstayCost; // what the driver is billed
  const hostNet =
    energyCost * (1 - ENERGY_COMMISSION) + idleCost * (1 - IDLE_COMMISSION) + overstayCost * (1 - OVERSTAY_COMMISSION); // what the host receives

  return { idleChargesActive, idleMinutesElapsed, idleCost, overstayActive, overstayMinutesElapsed, overstayCost, energyCost, totalCost, hostNet };
}

/** Rough kWh estimate shown while a driver is still choosing arrival/end time in the booking flow. */
export function estimateBookingEnergy(charger: Charger, durationHours: number) {
  const estKwh = (charger.powerNum * durationHours * 0.55).toFixed(1);
  const estCost = (parseFloat(estKwh) * charger.rate).toFixed(2);
  return { estKwh, estCost };
}
