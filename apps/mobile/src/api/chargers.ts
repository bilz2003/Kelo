import { Charger } from "@kelo/core";
import { apiFetch } from "./client";

/**
 * Mirrors PUBLIC_CHARGER_SELECT in apps/backend/src/chargers/chargers.service.ts
 * — deliberately never fullAddress or hostCost. GET /bookings/:id is the
 * only place fullAddress is added back in, for the driver on that specific
 * booking (see api/bookings.ts).
 */
export interface DiscoverCharger {
  id: number;
  ownerId: number;
  postcode: string;
  title: string;
  listingName: string | null;
  powerKw: number;
  cable: "TETHERED" | "BRING_YOUR_OWN";
  connector: string;
  rate: number;
  overstayRate: number;
  idleRate: number;
  noShowFee: number;
  connectionRoute: "OCPP" | "ENODE";
  available: boolean;
  lat: number;
  lng: number;
  createdAt: string;
  owner: { name: string };
  distanceMiles: number;
}

export function getDiscoverChargers(radiusMiles?: number): Promise<DiscoverCharger[]> {
  const query = radiusMiles !== undefined ? `?radiusMiles=${radiusMiles}` : "";
  return apiFetch(`/chargers/discover${query}`);
}

function toCableDisplay(cable: DiscoverCharger["cable"]): Charger["cable"] {
  return cable === "TETHERED" ? "Tethered cable" : "Bring your own cable";
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Maps the backend's discover shape onto @kelo/core's Charger type.
 * fullAddress/hostCost are optional on Charger precisely so a Discover-
 * sourced charger can honestly leave them undefined rather than fabricate
 * a value — this endpoint never returns them, full stop. rating/sessions
 * are real values too, not filler: no completed-session/rating data is
 * tracked yet, so null/0 is what's actually true, matching the type's own
 * "New listing" semantics for a charger with no session history.
 */
export function mapDiscoverCharger(dc: DiscoverCharger): Charger {
  return {
    id: dc.id,
    host: dc.owner.name,
    initials: initialsOf(dc.owner.name),
    postcode: dc.postcode,
    title: dc.title,
    power: `${dc.powerKw}kW`,
    powerNum: dc.powerKw,
    cable: toCableDisplay(dc.cable),
    connector: dc.connector,
    rate: dc.rate,
    overstayRate: dc.overstayRate,
    idleRate: dc.idleRate,
    noShowFee: dc.noShowFee,
    distance: `${dc.distanceMiles.toFixed(1)} mi`,
    rating: null,
    sessions: 0,
  };
}
