import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Compass, Calendar, PlugZap, User } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeContext";
import { RootStackParamList, RootTabParamList, DiscoverStackParamList } from "./types";

import { DiscoverListScreen } from "@/screens/discover/DiscoverListScreen";
import { ChargerDetailScreen } from "@/screens/discover/ChargerDetailScreen";
import { BookingFlowScreen } from "@/screens/discover/BookingFlowScreen";
import { BookingConfirmedScreen } from "@/screens/discover/BookingConfirmedScreen";
import { ActiveSessionScreen } from "@/screens/discover/ActiveSessionScreen";
import { BookingsScreen } from "@/screens/bookings/BookingsScreen";
import { MyChargersScreen } from "@/screens/chargers/MyChargersScreen";
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
        component={MyChargersScreen}
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

export function RootNavigator() {
  const { mode, tokens } = useTheme();
  return (
    <NavigationContainer
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
      }}
    >
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Tabs" component={Tabs} />
        <RootStack.Screen
          name="ActiveSession"
          component={ActiveSessionScreen}
          options={{ presentation: "modal", gestureEnabled: false, animation: "slide_from_bottom" }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
