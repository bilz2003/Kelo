import { LatLng } from "../geocoding/geocoding.service";

/**
 * Fixed stand-in for "the driver's current location", used by
 * GET /chargers/discover to compute distance. There's no real device-
 * location capture on mobile yet (a separate, mobile-side follow-up) —
 * this is the centroid of the SM5 (Carshalton) postcode area, matching
 * the location the Discover screen's UI already hardcodes
 * ("Carshalton, SM5" — apps/mobile/src/screens/discover/DiscoverListScreen.tsx)
 * and the postcode all of mockChargers.ts's fixture data clusters around.
 * Sourced from postcodes.io's outcode centroid lookup
 * (GET https://api.postcodes.io/outcodes/SM5), the same geocoding source
 * used for charger postcodes, not hand-picked.
 */
export const DEFAULT_SEARCH_ORIGIN: LatLng = {
  lat: 51.36874869252465,
  lng: -0.16896046685472493,
};
