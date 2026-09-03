import { Charger } from "@kelo/core";
import { apiFetch } from "./client";

/**
 * Mirrors PUBLIC_CHARGER_SELECT in apps/backend/src/chargers/chargers.service.ts
 * — deliberately never fullAddress or hostCost. GET /bookings/:id is the
 * only place fullAddress is added back in, for the driver on that specific
 * booking (see api/bookings.ts). photos are resolved presigned view URLs,
 * not raw S3 keys — Discover has no legitimate reason to reference a key.
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
  photos: string[];
}

export function getDiscoverChargers(radiusMiles?: number, coords?: { lat: number; lng: number }): Promise<DiscoverCharger[]> {
  const params = new URLSearchParams();
  if (radiusMiles !== undefined) params.set("radiusMiles", String(radiusMiles));
  // Omitted entirely when location permission was denied/unavailable —
  // the backend falls back to its own fixed reference point in that case,
  // not a client-sent default.
  if (coords) {
    params.set("lat", String(coords.lat));
    params.set("lng", String(coords.lng));
  }
  const query = params.toString();
  return apiFetch(`/chargers/discover${query ? `?${query}` : ""}`);
}

// Raw shape of GET /chargers and GET /chargers/:id (chargers.service.ts's
// findAllForOwner/findOneForOwner — no select, every real column) — unlike
// DiscoverCharger, this legitimately includes fullAddress/hostCost/
// photoKeys, since the caller is always the owner looking at their own
// listing. photoKeys[i] is the raw key behind photos[i]'s presigned URL —
// needed client-side only to edit which photos are attached (e.g. remove
// just one of two), never shown to anyone but the owner.
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
  photos: string[];
  photoKeys: string[];
}

export function getMyChargers(): Promise<OwnerCharger[]> {
  return apiFetch("/chargers");
}

export function setChargerAvailability(id: number, available: boolean): Promise<OwnerCharger> {
  return apiFetch(`/chargers/${id}`, { method: "PATCH", body: { available } });
}

// The fields a host actually sets when listing or editing a charger —
// mirrors CreateChargerDto/UpdateChargerDto on the backend. `photos` here
// is S3 keys (from PhotosField's PhotoDraft.key via uploadPhoto), the
// write-side counterpart to OwnerCharger.photos being resolved view URLs.
export interface ChargerWriteFields {
  postcode: string;
  fullAddress?: string;
  title: string;
  listingName?: string;
  powerKw: number;
  cable: "TETHERED" | "BRING_YOUR_OWN";
  connector: string;
  rate: number;
  overstayRate: number;
  idleRate: number;
  noShowFee: number;
  hostCost?: number;
  connectionRoute: "OCPP" | "ENODE";
  available?: boolean;
  photos?: string[];
}

export function createCharger(dto: ChargerWriteFields): Promise<OwnerCharger> {
  return apiFetch("/chargers", { method: "POST", body: dto });
}

export function patchCharger(id: number, patch: Partial<ChargerWriteFields>): Promise<OwnerCharger> {
  return apiFetch(`/chargers/${id}`, { method: "PATCH", body: patch });
}

export function deleteCharger(id: number): Promise<void> {
  return apiFetch(`/chargers/${id}`, { method: "DELETE" });
}

export function toCableDisplay(cable: DiscoverCharger["cable"]): Charger["cable"] {
  return cable === "TETHERED" ? "Tethered cable" : "Bring your own cable";
}

export function toApiCable(cable: Charger["cable"]): DiscoverCharger["cable"] {
  return cable === "Tethered cable" ? "TETHERED" : "BRING_YOUR_OWN";
}

export function initialsOf(name: string): string {
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
    listingName: dc.listingName ?? undefined,
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
    photos: dc.photos,
  };
}

// The owner-only extension of Charger — photoKeys has nowhere honest to
// live on the shared type (Discover/booking views never get it, see
// OwnerCharger above), but MyChargersScreen/EditChargerScreen need it to
// edit which photos are attached. Structurally still a Charger (extra
// field, nothing removed), so it's a drop-in wherever a Charger is
// expected — only code that specifically needs photoKeys has to know
// about the wider type.
export interface MyCharger extends Charger {
  photoKeys: string[];
}

/**
 * Maps an owner-scoped charger onto MyCharger. Unlike mapDiscoverCharger,
 * fullAddress/hostCost are real values here, not undefined — this is the
 * owner looking at their own listing, the one place both are legitimately
 * visible. GET /chargers has no owner.name to derive host/initials from
 * (the caller already knows who they are), so the signed-in user's own
 * name is passed in rather than re-fetched. distance/rating/sessions are
 * meaningless for a host's own listing (My Chargers never renders any of
 * the three) — present only because Charger requires them.
 */
export function mapOwnerCharger(oc: OwnerCharger, ownerName: string): MyCharger {
  return {
    id: oc.id,
    host: ownerName,
    initials: initialsOf(ownerName),
    postcode: oc.postcode,
    fullAddress: oc.fullAddress ?? undefined,
    listingName: oc.listingName ?? undefined,
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
    photos: oc.photos,
    photoKeys: oc.photoKeys,
  };
}
