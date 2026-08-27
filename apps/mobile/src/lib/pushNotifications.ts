import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { registerPushToken } from "@/api/notifications";

/**
 * Foreground display behavior — without this, a notification arriving
 * while the app is already open (e.g. a host actively looking at My
 * Chargers when their driver requests an extension) is silently
 * swallowed on iOS by default. Called once, at app startup, not per
 * screen.
 */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export type PushPermissionOutcome =
  | { status: "granted" }
  | { status: "denied"; canAskAgain: boolean }
  // Distinct from a plain denial — permission was granted, but obtaining
  // or registering the actual token failed (no EAS project reachable, no
  // physical push capability, a network error registering with the
  // backend, etc). The UI shouldn't tell someone to check Settings for a
  // permission they already gave.
  | { status: "token_error" };

/**
 * Requests notification permission and, if granted, obtains the Expo push
 * token and registers it with the backend. Every failure mode here is
 * handled, never thrown — a denied permission, a token request failing
 * (no physical push capability, no EAS project reachable), or the
 * register-with-backend call failing over the network all resolve to a
 * clean outcome the caller can render, not a crash.
 */
export async function requestAndRegisterPushToken(): Promise<PushPermissionOutcome> {
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  let canAskAgain = existing.canAskAgain;

  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
    canAskAgain = requested.canAskAgain;
  }

  if (status !== "granted") {
    return { status: "denied", canAskAgain };
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await registerPushToken(token);
    return { status: "granted" };
  } catch {
    // Simulator (no real push capability), no EAS project configured, or
    // a network failure registering with the backend — none of these
    // should read as "permission denied" to the caller, since permission
    // genuinely was granted.
    return { status: "token_error" };
  }
}
