import * as Location from "expo-location";
import { secureStorage } from "@/lib/secureStorage";

// Reuses the same wrapper the auth flow uses, rather than calling
// expo-secure-store directly — its own .web.ts override is what makes
// `expo start --web` usable at all for this: expo-secure-store's real web
// "implementation" is a bare `export default {}`, so a direct call throws
// there. This is a small, non-sensitive UI flag, not an auth value, but
// the wrapper is a plain generic key-value interface — reusing it here
// avoids either re-deriving that same platform-safe fallback or adding a
// second storage dependency for one boolean.
const APPROX_NOTICE_SHOWN_KEY = "discover_location_approx_notice_shown";

export type LocationOutcome =
  | { status: "granted"; coords: { lat: number; lng: number } }
  | { status: "denied"; canAskAgain: boolean }
  // Permission was granted but a coordinate fix couldn't be obtained
  // (simulator with no location set, GPS unavailable indoors, etc.) —
  // distinct from denial so the caller doesn't tell someone to check a
  // permission they already gave.
  | { status: "error" };

/**
 * Foreground-only — this product has no use for background location, so
 * only ever requests WHEN_IN_USE, never ALWAYS (see app.json's
 * expo-location plugin config, which explicitly suppresses the
 * Always-permission strings the plugin would otherwise add by default).
 *
 * Only prompts the OS permission dialog once: getForegroundPermissionsAsync
 * checks the current status without prompting, and requestForegroundPermissionsAsync
 * is only called when that status is genuinely UNDETERMINED (never asked
 * before). Once a user has answered — either way — this never re-triggers
 * the native dialog on a later call; a real denial state (with
 * canAskAgain) is simply returned so the caller can render its own
 * fallback UI instead of re-nagging via the OS prompt.
 */
export async function getForegroundLocation(): Promise<LocationOutcome> {
  const existing = await Location.getForegroundPermissionsAsync();
  let status = existing.status;
  let canAskAgain = existing.canAskAgain;

  if (status === Location.PermissionStatus.UNDETERMINED) {
    const requested = await Location.requestForegroundPermissionsAsync();
    status = requested.status;
    canAskAgain = requested.canAskAgain;
  }

  if (status !== Location.PermissionStatus.GRANTED) {
    return { status: "denied", canAskAgain };
  }

  try {
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { status: "granted", coords: { lat: position.coords.latitude, lng: position.coords.longitude } };
  } catch {
    return { status: "error" };
  }
}

/** True the first time this is called; persists false on every call after. */
export async function shouldShowApproxDistanceNotice(): Promise<boolean> {
  const seen = await secureStorage.getItem(APPROX_NOTICE_SHOWN_KEY);
  if (seen) return false;
  await secureStorage.setItem(APPROX_NOTICE_SHOWN_KEY, "1");
  return true;
}
