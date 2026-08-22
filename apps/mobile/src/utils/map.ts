import { Charger } from "@kelo/core";

/**
 * Approximate relative positions for the stylized Discover map — illustrative
 * placements reflecting roughly how these postcode areas sit relative to
 * each other, not real GPS geocoding (which this prototype has no data
 * source for). Values are % positions within the map surface.
 */
export const POSTCODE_COORDS: Record<string, { x: number; y: number }> = {
  SM5: { x: 46, y: 50 }, // Carshalton — driver's own area, roughly central
  SM1: { x: 30, y: 38 },
  SM2: { x: 34, y: 64 },
  SM3: { x: 22, y: 56 },
  SM4: { x: 58, y: 22 },
  SM6: { x: 40, y: 74 },
  SM7: { x: 62, y: 70 },
  CR4: { x: 70, y: 32 },
  CR0: { x: 80, y: 54 },
};

/**
 * POSTCODE_COORDS is keyed by outcode (e.g. "SM5"), not a full postcode —
 * true of the mock data (which only ever stored bare outcodes) but real
 * backend chargers carry a full postcode like "SM1 1EA". Extracting the
 * outcode keeps the lookup working for real data; an outcode outside this
 * fixed set (this map only covers one corner of London, illustratively)
 * still falls through to the same center-point default as before.
 */
const outcodeOf = (postcode: string): string => postcode.trim().toUpperCase().split(/\s+/)[0];

/**
 * Deterministic small offset so multiple chargers sharing a postcode fan
 * out into a little cluster instead of stacking exactly on top of each other.
 */
export const pinPosition = (charger: Charger): { x: number; y: number } => {
  const base = POSTCODE_COORDS[outcodeOf(charger.postcode)] || { x: 50, y: 50 };
  const angle = (charger.id * 47) % 360;
  const radius = 3.2;
  const rad = (angle * Math.PI) / 180;
  return {
    x: Math.min(94, Math.max(6, base.x + radius * Math.cos(rad))),
    y: Math.min(90, Math.max(10, base.y + radius * Math.sin(rad))),
  };
};
