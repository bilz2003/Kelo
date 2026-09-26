import { Charger, SessionFinancials } from "./types";

// Kelo's commission rates, per the pricing model:
// - 12% on the energy charge
// - 12% on the idle occupancy charge
// - 30% on overstay (not simulated in the live session demo below)
// - 0% on the no-show/late-cancellation fee (goes entirely to the host)
// Applies identically regardless of how idleRate/overstayRate themselves
// are set (see deriveIdleAndOverstayRates below) — this is Kelo's cut of
// whatever the charge actually is, not tied to who set that rate.
export const ENERGY_COMMISSION = 0.12;
export const IDLE_COMMISSION = 0.12;
export const OVERSTAY_COMMISSION = 0.3;

// The flat service charge (£) taken from the driver when a booking is
// confirmed — shown on the booking screen, in the receipt note and on the
// website's "Chargers & fees" page, all from this one value.
export const SERVICE_CHARGE = 1.49;
export const formatServiceCharge = () => `£${SERVICE_CHARGE.toFixed(2)}`;

// Simulated live-session timing (accelerated for demo purposes — see
// ActiveSessionScreen). Swap these for real elapsed time once wired to an
// actual OCPP/Enode meter feed.
export const SESSION_FULL_AT_SECONDS = 18; // simulated "battery full" moment
// Overstay keeps its own 15-minute grace after the booking's own end
// time — deliberately untouched by the idle-grace removal below, and
// structurally distinct: this only ever gates overstayStartSecond, never
// idleStartSecond, in computeSessionFinancials.
export const OVERSTAY_GRACE_SECONDS = 6; // simulated stand-in for the real 15-minute grace buffer

// Idle and overstay per-minute rates are fully derived from the host's
// own £/kWh rate and the charger's real power, not set directly — see
// ChargersService.create/update, the sole place that writes
// Charger.idleRate/overstayRate. (rate × powerNum) is £ earned per hour
// at this charger's full power; ÷60 converts that to £/min; each
// multiplier then scales it into a deterrent rate — a mild one for idle
// occupancy (a car that's already full, still sitting in the bay), a
// much steeper one for overstay (running past the booking's own end time
// entirely). Exported so both the backend (the real write path) and the
// mobile app (a live preview while a host types their rate) compute the
// exact same numbers from the exact same formula — never reimplemented
// twice.
export const IDLE_RATE_MULTIPLIER = 1.5;
export const OVERSTAY_RATE_MULTIPLIER = 7;

export interface DerivedRates {
  idleRate: number;
  overstayRate: number;
}

export function deriveIdleAndOverstayRates(rate: number, powerNum: number): DerivedRates {
  const perMinuteAtFullPower = (rate * powerNum) / 60;
  // Rounded to 4dp, not 2 — these are naturally small £/min figures
  // (often a few pence), and money display elsewhere already formats to
  // 2dp for its own purposes; rounding the stored/computed value itself
  // that early would throw away real precision that matters once
  // multiplied out over many minutes.
  const round4 = (n: number) => Math.round(n * 10000) / 10000;
  return {
    idleRate: round4(perMinuteAtFullPower * IDLE_RATE_MULTIPLIER),
    overstayRate: round4(perMinuteAtFullPower * OVERSTAY_RATE_MULTIPLIER),
  };
}

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
  // No grace period here anymore — idle billing starts the instant the
  // meter goes flat (seconds >= SESSION_FULL_AT_SECONDS), full stop.
  // Overstay's own, separate grace (OVERSTAY_GRACE_SECONDS, below) is
  // untouched by this — the two are structurally independent gates, not
  // two branches of shared logic.
  const idleStartSecond = SESSION_FULL_AT_SECONDS;
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
