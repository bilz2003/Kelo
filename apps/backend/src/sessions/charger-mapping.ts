import { Charger as PrismaCharger, CableType } from "@prisma/client";
import { Charger } from "@kelo/core";

/**
 * @kelo/core's Charger is a mobile-side view model (display strings,
 * computed rating/distance) that was deliberately kept separate from the
 * Prisma model — see the note at the top of prisma/schema.prisma. Real
 * pricing fields map straight across; the presentational-only ones
 * (host/initials/distance/rating/sessions) get placeholders since nothing
 * server-side computes them and computeSessionFinancials never reads them.
 */
export function toCoreCharger(charger: PrismaCharger): Charger {
  return {
    id: charger.id,
    host: "",
    initials: "",
    postcode: charger.postcode,
    fullAddress: charger.fullAddress ?? undefined,
    title: charger.title,
    power: `${charger.powerKw}kW`,
    powerNum: charger.powerKw,
    cable: charger.cable === CableType.TETHERED ? "Tethered cable" : "Bring your own cable",
    connector: charger.connector,
    rate: charger.rate,
    overstayRate: charger.overstayRate,
    idleRate: charger.idleRate,
    noShowFee: charger.noShowFee,
    hostCost: charger.hostCost ?? undefined,
    distance: "",
    rating: null,
    sessions: 0,
  };
}
