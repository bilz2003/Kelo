import { createNavigationContainerRef } from "@react-navigation/native";
import { RootStackParamList } from "./types";

// A module-level ref (not component state) is what lets code outside the
// component tree — the notification-tap handler in particular, which
// fires from an app-wide listener, not from any screen — navigate at all.
// RootNavigator passes this to <NavigationContainer ref={...}>; everyone
// else just imports and uses it.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
