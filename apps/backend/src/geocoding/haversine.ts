import { LatLng } from "./geocoding.service";

const EARTH_RADIUS_MILES = 3958.8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance in miles — miles because that's the unit the
 * mobile app's Discover screen already displays and filters by
 * (RADIUS_OPTIONS = [1, 3, 5, 10, 25] mi). Haversine, not real routing
 * distance — sufficient for "how far away roughly is this charger",
 * per the task.
 */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_MILES * c;
}
