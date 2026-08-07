import React, { useCallback, useState } from "react";
import { View } from "react-native";
import * as SplashScreenNative from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useFonts as useSpaceGrotesk, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { useFonts as useIBMPlexSans, IBMPlexSans_400Regular, IBMPlexSans_500Medium } from "@expo-google-fonts/ibm-plex-sans";
import { useFonts as useIBMPlexMono, IBMPlexMono_400Regular, IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono";

import { ThemeProvider, useTheme } from "@/theme/ThemeContext";
import { ChargerStoreProvider } from "@/state/ChargerStoreContext";
import { SessionProvider } from "@/state/SessionContext";
import { RootNavigator } from "@/navigation/RootNavigator";
import { SplashScreen } from "@/screens/SplashScreen";

SplashScreenNative.preventAutoHideAsync().catch(() => {});

function AppShell() {
  const { tokens, mode } = useTheme();
  const [booted, setBooted] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.ink }}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      {booted ? <RootNavigator /> : <SplashScreen onDone={() => setBooted(true)} />}
    </View>
  );
}

export default function App() {
  const [spaceGroteskLoaded] = useSpaceGrotesk({ SpaceGrotesk_700Bold });
  const [ibmPlexSansLoaded] = useIBMPlexSans({ IBMPlexSans_400Regular, IBMPlexSans_500Medium });
  const [ibmPlexMonoLoaded] = useIBMPlexMono({ IBMPlexMono_400Regular, IBMPlexMono_500Medium });

  const fontsReady = spaceGroteskLoaded && ibmPlexSansLoaded && ibmPlexMonoLoaded;

  const onLayoutRootView = useCallback(async () => {
    if (fontsReady) await SplashScreenNative.hideAsync();
  }, [fontsReady]);

  if (!fontsReady) return null;

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <ThemeProvider>
        <ChargerStoreProvider>
          <SessionProvider>
            <AppShell />
          </SessionProvider>
        </ChargerStoreProvider>
      </ThemeProvider>
    </View>
  );
}
