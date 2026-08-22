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

// Raw shape of GET /chargers and GET /chargers/:id (chargers.service.ts's
// findAllForOwner/findOneForOwner — no select, every real column) — unlike
// DiscoverCharger, this legitimately includes fullAddress/hostCost, since
// the caller is always the owner looking at their own listing.
export interface OwnerCharger {
  id: number;
  ownerId: number;
  postcode: string;
  fullAddress: string | null;
  lat: number | null;
  lng: number | null;
  title: string;
  listingName: string | null;
  powerKw: number;
  cable: "TETHERED" | "BRING_YOUR_OWN";
  connector: string;
  rate: number;
  overstayRate: number;
  idleRate: number;
  noShowFee: number;
  hostCost: number | null;
  connectionRoute: "OCPP" | "ENODE";
  available: boolean;
  createdAt: string;
  removedAt: string | null;
}

export function getMyChargers(): Promise<OwnerCharger[]> {
  return apiFetch("/chargers");
}

export function setChargerAvailability(id: number, available: boolean): Promise<OwnerCharger> {
  return apiFetch(`/chargers/${id}`, { method: "PATCH", body: { available } });
}

export function toCableDisplay(cable: DiscoverCharger["cable"]): Charger["cable"] {
  return cable === "TETHERED" ? "Tethered cable" : "Bring your own cable";
}

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Maps an owner-scoped charger onto @kelo/core's Charger type. Unlike
 * mapDiscoverCharger, fullAddress/hostCost are real values here, not
 * undefined — this is the owner looking at their own listing, the one
 * place both are legitimately visible. GET /chargers has no owner.name to
 * derive host/initials from (the caller already knows who they are), so
 * the signed-in user's own name is passed in rather than re-fetched.
 * distance/rating/sessions are meaningless for a host's own listing (My
 * Chargers never renders any of the three) — present only because
 * Charger requires them.
 */
export function mapOwnerCharger(oc: OwnerCharger, ownerName: string): Charger {
  return {
    id: oc.id,
    host: ownerName,
    initials: initialsOf(ownerName),
    postcode: oc.postcode,
    fullAddress: oc.fullAddress ?? undefined,
    title: oc.title,
    power: `${oc.powerKw}kW`,
    powerNum: oc.powerKw,
    cable: toCableDisplay(oc.cable),
    connector: oc.connector,
    rate: oc.rate,
    overstayRate: oc.overstayRate,
    idleRate: oc.idleRate,
    noShowFee: oc.noShowFee,
    hostCost: oc.hostCost ?? undefined,
    distance: "",
    rating: null,
    sessions: 0,
    available: oc.available,
  };
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
    available: dc.available,
  };
}
