import React from "react";
import { View, Text, Pressable } from "react-native";
import { DefaultTheme, NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Compass, Calendar, PlugZap, User, ChevronUp } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeContext";
import { fonts, radii } from "@/theme/tokens";
import { PulseDot } from "@/components/Controls";
import { useSession } from "@/state/SessionContext";
import { RootStackParamList, RootTabParamList, DiscoverStackParamList } from "./types";

import { DiscoverListScreen } from "@/screens/discover/DiscoverListScreen";
import { ChargerDetailScreen } from "@/screens/discover/ChargerDetailScreen";
import { BookingFlowScreen } from "@/screens/discover/BookingFlowScreen";
import { BookingConfirmedScreen } from "@/screens/discover/BookingConfirmedScreen";
import { ActiveSessionScreen } from "@/screens/discover/ActiveSessionScreen";
import { BookingsScreen } from "@/screens/bookings/BookingsScreen";
import { MyChargersFlow } from "@/screens/chargers/MyChargersFlow";
import { AccountScreen } from "@/screens/account/AccountScreen";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();
const DiscoverStack = createNativeStackNavigator<DiscoverStackParamList>();

function DiscoverStackNavigator() {
  return (
    <DiscoverStack.Navigator screenOptions={{ headerShown: false }}>
      <DiscoverStack.Screen name="DiscoverList" component={DiscoverListScreen} />
      <DiscoverStack.Screen name="ChargerDetail" component={ChargerDetailScreen} />
      <DiscoverStack.Screen name="BookingFlow" component={BookingFlowScreen} />
      <DiscoverStack.Screen name="BookingConfirmed" component={BookingConfirmedScreen} />
    </DiscoverStack.Navigator>
  );
}

function Tabs() {
  const { tokens } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: tokens.ink, borderTopColor: tokens.hair, height: 78, paddingTop: 8 },
        tabBarActiveTintColor: tokens.cyan,
        tabBarInactiveTintColor: tokens.textSoft,
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: "500" },
      }}
    >
      <Tab.Screen
        name="Discover"
        component={DiscoverStackNavigator}
        options={{ tabBarIcon: ({ color, size }) => <Compass color={color} size={size ?? 19} /> }}
      />
      <Tab.Screen
        name="Bookings"
        component={BookingsScreen}
        options={{ tabBarIcon: ({ color, size }) => <Calendar color={color} size={size ?? 19} /> }}
      />
      <Tab.Screen
        name="MyChargers"
        component={MyChargersFlow}
        options={{ tabBarLabel: "Chargers", tabBarIcon: ({ color, size }) => <PlugZap color={color} size={size ?? 19} /> }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{ tabBarIcon: ({ color, size }) => <User color={color} size={size ?? 19} /> }}
      />
    </Tab.Navigator>
  );
}

/**
 * Persistent "Live session in progress" pill — shown above the tab bar on
 * every tab whenever a session exists but isn't the screen currently on
 * top (i.e. it's been minimized). Tapping it re-opens ActiveSession.
 * Rendered as a sibling of the root stack (not inside a Screen), so it
 * needs the container ref rather than useNavigation().
 */
function MinimizedSessionBanner({ navigationRef }: { navigationRef: ReturnType<typeof useNavigationContainerRef<RootStackParamList>> }) {
  const { tokens } = useTheme();
  const session = useSession();
  // 78 matches Tabs' tabBarStyle.height above; 28 matches the fixed
  // bottom safe-area constant every other screen's sticky footer uses.
  const TAB_BAR_HEIGHT = 78;
  const SAFE_AREA_BOTTOM = 28;

  if (!session.active || session.visible || !session.charger) return null;

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: 0 }}>
      <Pressable
        onPress={() => {
          session.show();
          navigationRef.current?.navigate("ActiveSession", { charger: session.charger! });
        }}
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: TAB_BAR_HEIGHT + SAFE_AREA_BOTTOM + 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          backgroundColor: tokens.surface,
          borderWidth: 1,
          borderColor: tokens.cyanTint30,
          borderRadius: radii.lg,
          paddingVertical: 12,
          paddingHorizontal: 14,
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      >
        <PulseDot size={7} />
        <Text style={{ flex: 1, fontSize: 13, fontWeight: "500", color: tokens.text }}>Live session in progress</Text>
        <ChevronUp size={15} color={tokens.cyan} />
      </Pressable>
    </View>
  );
}

export function RootNavigator() {
  const { mode, tokens } = useTheme();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{
        dark: mode === "dark",
        colors: {
          primary: tokens.cyan,
          background: tokens.ink,
          card: tokens.ink,
          text: tokens.text,
          border: tokens.hair,
          notification: tokens.cyan,
        },
        fonts: DefaultTheme.fonts,
      }}
    >
      <View style={{ flex: 1 }}>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Tabs" component={Tabs} />
          <RootStack.Screen
            name="ActiveSession"
            component={ActiveSessionScreen}
            options={{ presentation: "modal", gestureEnabled: false, animation: "slide_from_bottom" }}
          />
        </RootStack.Navigator>
        <MinimizedSessionBanner navigationRef={navigationRef} />
      </View>
    </NavigationContainer>
  );
}
