import "react-native-gesture-handler";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreenNative from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
// Space Grotesk and IBM Plex Mono (regular weight only) are loaded solely
// for the two deliberate exceptions that keep their exact original
// appearance — BrandMark's wordmark and the Splash screen's tagline — both
// now hardcoded to these exact family names rather than reading through
// theme/tokens.ts's fonts object. Everything else loads the new set below.
import { useFonts as useSpaceGrotesk, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { useFonts as useIBMPlexMono, IBMPlexMono_400Regular } from "@expo-google-fonts/ibm-plex-mono";
import { useFonts as useBricolageGrotesque, BricolageGrotesque_700Bold } from "@expo-google-fonts/bricolage-grotesque";
import { useFonts as usePublicSans, PublicSans_400Regular, PublicSans_500Medium } from "@expo-google-fonts/public-sans";
import { useFonts as useJetBrainsMono, JetBrainsMono_400Regular, JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono";

import { ThemeProvider, useTheme } from "@/theme/ThemeContext";
import { ChargerStoreProvider, useChargerStore } from "@/state/ChargerStoreContext";
import { SessionProvider, useSession } from "@/state/SessionContext";
import { AuthProvider, useAuth } from "@/state/AuthContext";
import { RootNavigator } from "@/navigation/RootNavigator";
import { SplashScreen } from "@/screens/SplashScreen";
import { AuthFlow } from "@/screens/auth/AuthFlow";
import { NotificationPermissionScreen } from "@/screens/notifications/NotificationPermissionScreen";
import { configureNotificationHandler } from "@/lib/pushNotifications";
import { setUpNotificationDeepLinking } from "@/lib/notificationDeepLink";

SplashScreenNative.preventAutoHideAsync().catch(() => {});
configureNotificationHandler();

function AppShell() {
  const { tokens, mode } = useTheme();
  const { status, justAuthenticated, clearJustAuthenticated } = useAuth();
  const session = useSession();
  const chargerStore = useChargerStore();
  const [booted, setBooted] = useState(false);

  // Registered once for the app's lifetime, not per-render/per-screen —
  // handles both a tap while the app's already running and a cold start
  // caused by the tap itself.
  useEffect(() => setUpNotificationDeepLinking(), []);

  // SessionProvider/ChargerStoreProvider are siblings above AuthProvider
  // (see the tree below), not nested under it, so neither one naturally
  // unmounts/resets on logout. Reset both explicitly on every transition
  // away from "authenticated" — an explicit Account > Log out tap and a
  // forced session-expiry logout (AuthContext's setSessionExpiredHandler)
  // both land here the same way, since both end up setting this same
  // status. See SessionContext.reset()/ChargerStoreContext.reset() for
  // what this was actually leaking without it.
  //
  // The reverse transition matters too: resumeIfActive() re-checks for a
  // still-running server-side session every time status becomes
  // "authenticated" — a real bug this audit found, since SessionContext
  // used to only ever check once, on its own mount, which happens before
  // any token exists on a fresh login (see resumeIfActive's own doc
  // comment for the full explanation).
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current !== "authenticated" && status === "authenticated") {
      session.resumeIfActive();
    }
    if (prevStatus.current === "authenticated" && status !== "authenticated") {
      session.reset();
      chargerStore.reset();
    }
    prevStatus.current = status;
  }, [status]);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.ink }}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      {!booted ? (
        <SplashScreen onDone={() => setBooted(true)} />
      ) : status === "loading" ? (
        <View style={{ flex: 1, backgroundColor: tokens.ink }} />
      ) : status === "authenticated" && justAuthenticated ? (
        <NotificationPermissionScreen onDone={clearJustAuthenticated} />
      ) : status === "authenticated" ? (
        <RootNavigator />
      ) : (
        <AuthFlow />
      )}
    </View>
  );
}

export default function App() {
  const [spaceGroteskLoaded] = useSpaceGrotesk({ SpaceGrotesk_700Bold });
  const [ibmPlexMonoLoaded] = useIBMPlexMono({ IBMPlexMono_400Regular });
  const [bricolageGrotesqueLoaded] = useBricolageGrotesque({ BricolageGrotesque_700Bold });
  const [publicSansLoaded] = usePublicSans({ PublicSans_400Regular, PublicSans_500Medium });
  const [jetBrainsMonoLoaded] = useJetBrainsMono({ JetBrainsMono_400Regular, JetBrainsMono_500Medium });

  const fontsReady =
    spaceGroteskLoaded && ibmPlexMonoLoaded && bricolageGrotesqueLoaded && publicSansLoaded && jetBrainsMonoLoaded;

  const onLayoutRootView = useCallback(async () => {
    if (fontsReady) await SplashScreenNative.hideAsync();
  }, [fontsReady]);

  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <ThemeProvider>
          <ChargerStoreProvider>
            <SessionProvider>
              <AuthProvider>
                <AppShell />
              </AuthProvider>
            </SessionProvider>
          </ChargerStoreProvider>
        </ThemeProvider>
      </View>
    </GestureHandlerRootView>
  );
}
