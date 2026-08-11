import { NavigatorScreenParams } from "@react-navigation/native";
import { BookingDetails, Charger } from "@kelo/core";

export type DiscoverStackParamList = {
  DiscoverList: undefined;
  ChargerDetail: { charger: Charger };
  BookingFlow: { charger: Charger };
  // bookingId is a real backend Booking id (see api/bookingBridge.ts) — the
  // "Simulate arrival & start charging" button needs it to start a real
  // session, not just flip local state.
  BookingConfirmed: { charger: Charger; details: BookingDetails; bookingId: number };
};

export type RootTabParamList = {
  Discover: NavigatorScreenParams<DiscoverStackParamList>;
  Bookings: undefined;
  MyChargers: undefined;
  Account: undefined;
};

// The live session is presented modally over the whole tab navigator (it
// hides the tab bar and can be minimized back to whatever screen the
// driver was on), so it lives at the root stack level, not inside a tab.
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<RootTabParamList>;
  ActiveSession: { charger: Charger };
};
