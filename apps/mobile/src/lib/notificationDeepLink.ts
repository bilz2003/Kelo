import * as Notifications from "expo-notifications";
import { navigationRef } from "@/navigation/navigationRef";

// Mirrors the `data` shape NotificationsService (backend) attaches to
// each of the four (soon five) triggers — see notifications.service.ts.
interface NotificationData {
  type?: "extension_requested" | "extension_responded" | "booking_created" | "session_started" | "session_ended" | "no_show";
  bookingId?: number;
}

async function navigateForNotification(data: NotificationData) {
  // Cold start: the NavigationContainer may not have mounted yet by the
  // time the tap that launched the app is processed. A few short retries
  // covers that without blocking indefinitely if navigation never
  // becomes ready for some other reason.
  for (let attempt = 0; attempt < 10 && !navigationRef.isReady(); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  if (!navigationRef.isReady()) return;

  switch (data.type) {
    // Host-facing: all land on My Chargers, where the relevant card
    // (pending extension banner, live session, next-booking) renders
    // itself from real-time state — the booking list, and, for
    // session_started/extension_requested specifically,
    // useHostActiveSessions' own server-discovered session state (not
    // this device's driver-facing SessionContext) — not from a param this
    // deep link would need to carry.
    case "extension_requested":
    case "booking_created":
    case "session_started":
    case "no_show":
      navigationRef.navigate("Tabs", { screen: "MyChargers" });
      break;
    // Driver-facing: ActiveSessionScreen reads session.charger/
    // session.lastReceipt from SessionContext, not from route params —
    // so there's nothing charger-specific to pass here either.
    case "extension_responded":
    case "session_ended":
      navigationRef.navigate("ActiveSession", {});
      break;
    default:
      break;
  }
}

function extractData(response: Notifications.NotificationResponse): NotificationData {
  return (response.notification.request.content.data ?? {}) as NotificationData;
}

/**
 * Registered once at app startup. Covers both cases: the app already
 * running (foreground or backgrounded) when a notification is tapped,
 * and a cold start caused by the tap itself, which
 * addNotificationResponseReceivedListener alone would miss since it
 * isn't registered yet at the moment that first tap happened.
 */
export function setUpNotificationDeepLinking(): () => void {
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) navigateForNotification(extractData(response));
  });

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    navigateForNotification(extractData(response));
  });
  return () => subscription.remove();
}
