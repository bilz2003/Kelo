import { computeSessionFinancials, type Charger } from "@kelo/core";

export const gbp = (n: number) => `£${n.toFixed(2)}`;

// A stand-in charger for illustrative maths only. It exists so the public
// site can run @kelo/core's real computeSessionFinancials — the very
// function the backend's receipts use — instead of a second copy of the
// commission rules that could drift out of date.
function exampleCharger(rate: number, powerKw: number): Charger {
  return {
    id: 0, host: "", initials: "", postcode: "", title: "Example charger",
    power: `${powerKw}kW`, powerNum: powerKw, cable: "Tethered cable", connector: "Type 2",
    rate, overstayRate: 0, idleRate: 0, noShowFee: 0, distance: "", rating: null, sessions: 0, available: true,
  };
}

export interface EnergySplit {
  paid: number; // what the driver pays
  commission: number; // Kelo's cut
  received: number; // what the host receives
}

/**
 * Energy-only split for `kwh` delivered at `rate` £/kWh. Rounded to pence at
 * the paid/commission level and `received` derived from those two, so the
 * three figures on screen always add up exactly.
 */
export function energySplit(kwh: number, rate: number, powerKw = 7.4): EnergySplit {
  const f = computeSessionFinancials(exampleCharger(rate, powerKw), kwh, 0);
  const paid = Math.round(f.energyCost * 100) / 100;
  const commission = Math.round((f.energyCost - f.hostNet) * 100) / 100;
  return { paid, commission, received: Math.round((paid - commission) * 100) / 100 };
}
